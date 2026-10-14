// 카메라로 얼굴 방향만 읽어서 캐릭터 자세를 정한다.
// 영상은 이 기기 안에서만 쓰고 서버로는 자세 이름('down', 'up', 'yawn', 'sleep', 'gone')만 보낸다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Cam = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const VISION_URL = '/vendor/mediapipe/vision_bundle.mjs';
  const WASM_URL = '/vendor/mediapipe/wasm';
  const SAMPLE_MS = 500; // 1초에 2번만 검사해서 배터리를 아낀다

  const GONE_AFTER_MS = 3000; // 얼굴이 3초 넘게 안 보이면 자리 비움
  const SLEEP_AFTER_MS = 15000; // 눈 감은 채 15초 넘으면 조는 중
  const YAWN_HOLD_MS = 2500;
  const CALIBRATE_MS = 1500; // 켤 때 화면을 보는 자세를 기준으로 잡는다
  // 앉아서 꾸벅꾸벅: 고개가 갑자기 떨어졌다 돌아오는 걸 2분 안에 3번 하면 조는 중
  const NOD_DROP = 0.12;
  const NOD_RETURN_MS = 4000;
  const NOD_WINDOW_MS = 2 * 60 * 1000;
  const NOD_COUNT = 3;
  const NOD_SLEEP_HOLD_MS = 20000;
  // 고개 숙인 채 거의 안 움직이기(졸거나 멍때리기): 1분 움직임 합이 기준보다 작은 상태가 10분
  const STILL_MOVE_PER_MIN = 0.6;
  const STILL_AFTER_MS = 10 * 60 * 1000;
  // 고개를 옆으로 돌린 채(친구와 얘기 등) 3분
  const SIDE_YAW = 0.25;
  const SIDE_AFTER_MS = 3 * 60 * 1000;
  // 자습 앱이라 책을 안 보고 화면(정면)만 3분 넘게 보면 딴짓으로 본다 (잠깐 생각하며 고개 드는 건 괜찮음)
  const SCREEN_AFTER_MS = 3 * 60 * 1000;

  function median(list) {
    const s = list.slice().sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  }

  // 측정값(sample)을 넣으면 자세를 돌려주는 순수 로직 (테스트 가능)
  // sample: { t, face, pitch, lookDown, blink, jaw, yaw, nx, gaze }
  //   pitch: 눈-코-턱 비율 (고개를 숙일수록 커짐), lookDown: 눈동자 아래 보기 0~1, blink: 눈 감김 0~1, jaw: 입 벌림 0~1
  //   yaw: 고개 좌우 돌림, nx: 코 가로 위치, gaze: 눈동자 좌우
  // 자세: down(공부) up(고개 듦) yawn sleep(졸음) still(숙인 채 안 움직임) side(옆 보기) screen(화면만 봄) gone(자리 비움)
  function createClassifier() {
    let baseline = null;
    let yawBase = null;
    const calib = [];
    const yawCalib = [];
    const moves = [];
    let last = null;
    let stillSince = null;
    let sideSince = null;
    let upSince = null;
    const nods = [];
    let nodStart = null;
    let nodSleepUntil = 0;
    let sleepSince = null;
    let startedAt = null;
    let lastFaceAt = null;
    let closedSince = null;
    let yawnUntil = 0;
    const recent = [];

    function raw(s) {
      if (!s.face) return (lastFaceAt == null || s.t - lastFaceAt > GONE_AFTER_MS) ? 'gone' : null;
      lastFaceAt = s.t;
      if (startedAt == null) startedAt = s.t;
      const yaw = s.yaw || 0;
      if (baseline == null) {
        calib.push(s.pitch);
        yawCalib.push(yaw);
        if (s.t - startedAt >= CALIBRATE_MS) {
          baseline = median(calib);
          yawBase = median(yawCalib);
        }
      }
      const ref = baseline == null ? median(calib) : baseline;
      const down = s.pitch - ref > 0.06 || s.lookDown > 0.42;

      // 움직임 양 (책 읽을 땐 눈동자·고개가 조금씩 계속 움직인다)
      if (last) {
        const m = Math.abs((s.gaze || 0) - (last.gaze || 0)) + Math.abs((s.nx || 0) - (last.nx || 0)) * 10
          + Math.abs(s.pitch - last.pitch) * 2 + Math.abs(s.blink - last.blink) * 0.5;
        moves.push({ t: s.t, m });
      }
      last = s;
      while (moves.length && s.t - moves[0].t > 60000) moves.shift();
      const perMin = moves.reduce((sum, x) => sum + x.m, 0);

      // 꾸벅: 기준보다 고개가 확 떨어졌다가 4초 안에 돌아오면 한 번
      if (nodStart == null && s.pitch - ref > NOD_DROP + 0.06 && last && moves.length && moves[moves.length - 1].m > 0.15) nodStart = s.t;
      if (nodStart != null) {
        if (s.pitch - ref < 0.06) {
          if (s.t - nodStart <= NOD_RETURN_MS) nods.push(s.t);
          nodStart = null;
        } else if (s.t - nodStart > NOD_RETURN_MS) nodStart = null;
      }
      while (nods.length && s.t - nods[0] > NOD_WINDOW_MS) nods.shift();
      if (nods.length >= NOD_COUNT) {
        nodSleepUntil = s.t + NOD_SLEEP_HOLD_MS;
        if (sleepSince == null) sleepSince = nods[0];
        nods.length = 0;
      }

      if (s.jaw > 0.55) yawnUntil = s.t + YAWN_HOLD_MS;
      if (s.t < yawnUntil) return 'yawn';
      // 책을 보면 눈꺼풀이 내려와 감은 것처럼 보이므로, 고개를 든 상태에서만 눈 감김을 졸음으로 본다
      if (s.blink > 0.6 && !down) {
        if (closedSince == null) closedSince = s.t;
        if (s.t - closedSince >= SLEEP_AFTER_MS) {
          if (sleepSince == null) sleepSince = closedSince;
          return 'sleep';
        }
      } else {
        closedSince = null;
      }
      if (s.t < nodSleepUntil) return 'sleep';
      sleepSince = null;

      // 고개를 옆으로 오래 돌림
      if (yawBase != null && Math.abs(yaw - yawBase) > SIDE_YAW) {
        if (sideSince == null) sideSince = s.t;
        if (s.t - sideSince >= SIDE_AFTER_MS) return 'side';
      } else {
        sideSince = null;
      }

      // 책 대신 화면(정면)만 오래 봄
      if (!down) {
        if (upSince == null) upSince = s.t;
        if (s.t - upSince >= SCREEN_AFTER_MS) return 'screen';
      } else {
        upSince = null;
      }

      // 고개 숙인 채 거의 안 움직임
      if (down && moves.length > 20 && perMin < STILL_MOVE_PER_MIN) {
        if (stillSince == null) stillSince = s.t - 60000;
        if (s.t - stillSince >= STILL_AFTER_MS) return 'still';
      } else if (!down || perMin > STILL_MOVE_PER_MIN * 2) {
        stillSince = null;
      }
      return down ? 'down' : 'up';
    }

    // 지금 특별한 자세(졸음/정지/옆 보기)가 언제부터였는지
    function sinceOf(pose) {
      if (pose === 'sleep') return sleepSince;
      if (pose === 'still') return stillSince;
      if (pose === 'side') return sideSince;
      if (pose === 'screen') return upSince;
      return null;
    }

    return {
      push(s) {
        const r = raw(s);
        if (r == null) return this.pose;
        if (r === 'gone' || r === 'yawn' || r === 'sleep' || r === 'still' || r === 'side' || r === 'screen') {
          recent.length = 0;
          this.pose = r;
          return r;
        }
        // 고개 숙임/듦은 최근 4번 중 다수결로 흔들림을 줄인다
        recent.push(r);
        if (recent.length > 4) recent.shift();
        const downs = recent.filter((x) => x === 'down').length;
        if (downs * 2 > recent.length) this.pose = 'down';
        else if (downs * 2 < recent.length) this.pose = 'up';
        else if (!this.pose || !['down', 'up'].includes(this.pose)) this.pose = r;
        return this.pose;
      },
      since() { return sinceOf(this.pose); },
      pose: null,
      get calibrated() { return baseline != null; }
    };
  }

  function blend(categories, name) {
    const c = categories.find((x) => x.categoryName === name);
    return c ? c.score : 0;
  }

  // MediaPipe 결과 → sample
  function toSample(result, t) {
    const lm = result && result.faceLandmarks && result.faceLandmarks[0];
    if (!lm) return { t, face: false };
    const eyeY = (lm[33].y + lm[263].y) / 2;
    const span = Math.max(1e-3, lm[152].y - eyeY);
    const bs = (result.faceBlendshapes && result.faceBlendshapes[0] && result.faceBlendshapes[0].categories) || [];
    return {
      t,
      face: true,
      pitch: (lm[1].y - eyeY) / span,
      lookDown: (blend(bs, 'eyeLookDownLeft') + blend(bs, 'eyeLookDownRight')) / 2,
      blink: (blend(bs, 'eyeBlinkLeft') + blend(bs, 'eyeBlinkRight')) / 2,
      jaw: blend(bs, 'jawOpen'),
      // 고개 좌우: 코가 두 눈 가운데에서 얼마나 벗어났는지 (눈 사이 거리 기준)
      yaw: (lm[1].x - (lm[33].x + lm[263].x) / 2) / Math.max(1e-3, Math.abs(lm[263].x - lm[33].x)),
      nx: lm[1].x,
      gaze: (blend(bs, 'eyeLookOutLeft') - blend(bs, 'eyeLookInLeft') + blend(bs, 'eyeLookInRight') - blend(bs, 'eyeLookOutRight')) / 2
    };
  }

  let landmarkerPromise = null;
  async function loadLandmarker() {
    if (!landmarkerPromise) {
      landmarkerPromise = (async () => {
        const vision = await import(VISION_URL);
        const files = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        const opts = (delegate) => ({
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true
        });
        try {
          return await vision.FaceLandmarker.createFromOptions(files, opts('GPU'));
        } catch {
          return await vision.FaceLandmarker.createFromOptions(files, opts('CPU'));
        }
      })();
      landmarkerPromise.catch(() => { landmarkerPromise = null; });
    }
    return landmarkerPromise;
  }

  // 카메라를 켜고 주기적으로 자세를 알려준다. onPose(pose, sample)
  async function start({ video, onPose, onError }) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('이 브라우저는 카메라를 쓸 수 없어요.');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => {});
    let landmarker;
    try {
      landmarker = await loadLandmarker();
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('얼굴 인식 준비에 실패했어요. 인터넷 연결을 확인해 주세요.');
    }
    const classifier = createClassifier();
    let stopped = false;
    let lastPose = null;
    let lastT = 0;
    // detectForVideo는 시간이 계속 늘어나야 한다
    const stamp = () => { lastT = Math.max(lastT + 1, performance.now()); return lastT; };
    const timer = setInterval(() => {
      if (stopped || video.readyState < 2) return;
      try {
        const t = stamp();
        const sample = toSample(landmarker.detectForVideo(video, t), t);
        const pose = classifier.push(sample);
        if (pose && pose !== lastPose) {
          lastPose = pose;
          const since = classifier.since();
          onPose(pose, sample, since != null ? Math.max(0, t - since) : 0);
        } else if (pose) onPose(null, sample);
      } catch (err) {
        if (onError) onError(err);
      }
    }, SAMPLE_MS);
    const track = stream.getVideoTracks()[0];
    return {
      get alive() { return !stopped && track && track.readyState === 'live'; },
      // 지금 화면 한 장의 얼굴 위치 (실사 모드에서 얼굴을 가릴 때 씀). 얼굴이 없으면 null
      landmarks() {
        if (stopped || video.readyState < 2) return null;
        try {
          const r = landmarker.detectForVideo(video, stamp());
          return (r && r.faceLandmarks && r.faceLandmarks[0]) || null;
        } catch {
          return null;
        }
      },
      stop() {
        stopped = true;
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    };
  }

  const LABEL = { down: '공부 중 (고개 숙임)', up: '고개 듦', yawn: '하품 중', sleep: '조는 중 💤', still: '움직임 없음 (확인 중)', side: '옆 보는 중', screen: '화면 보는 중', gone: '자리 비움' };

  return { createClassifier, toSample, start, loadLandmarker, LABEL, MODEL_URL };
});
