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

  function median(list) {
    const s = list.slice().sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  }

  // 측정값(sample)을 넣으면 자세를 돌려주는 순수 로직 (테스트 가능)
  // sample: { t, face, pitch, lookDown, blink, jaw }
  //   pitch: 눈-코-턱 비율 (고개를 숙일수록 커짐), lookDown: 눈동자 아래 보기 0~1, blink: 눈 감김 0~1, jaw: 입 벌림 0~1
  function createClassifier() {
    let baseline = null;
    const calib = [];
    let startedAt = null;
    let lastFaceAt = null;
    let closedSince = null;
    let yawnUntil = 0;
    const recent = [];

    function raw(s) {
      if (!s.face) return (lastFaceAt == null || s.t - lastFaceAt > GONE_AFTER_MS) ? 'gone' : null;
      lastFaceAt = s.t;
      if (startedAt == null) startedAt = s.t;
      if (baseline == null) {
        calib.push(s.pitch);
        if (s.t - startedAt >= CALIBRATE_MS) baseline = median(calib);
      }
      const ref = baseline == null ? median(calib) : baseline;
      const down = s.pitch - ref > 0.06 || s.lookDown > 0.42;
      if (s.jaw > 0.55) yawnUntil = s.t + YAWN_HOLD_MS;
      if (s.t < yawnUntil) return 'yawn';
      // 책을 보면 눈꺼풀이 내려와 감은 것처럼 보이므로, 고개를 든 상태에서만 졸음으로 본다
      if (s.blink > 0.6 && !down) {
        if (closedSince == null) closedSince = s.t;
        if (s.t - closedSince >= SLEEP_AFTER_MS) return 'sleep';
      } else {
        closedSince = null;
      }
      return down ? 'down' : 'up';
    }

    return {
      push(s) {
        const r = raw(s);
        if (r == null) return this.pose;
        if (r === 'gone' || r === 'yawn' || r === 'sleep') {
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
        else if (!this.pose || this.pose === 'gone' || this.pose === 'yawn' || this.pose === 'sleep') this.pose = r;
        return this.pose;
      },
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
      jaw: blend(bs, 'jawOpen')
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
    const timer = setInterval(() => {
      if (stopped || video.readyState < 2) return;
      try {
        const t = performance.now();
        const sample = toSample(landmarker.detectForVideo(video, t), t);
        const pose = classifier.push(sample);
        if (pose && pose !== lastPose) {
          lastPose = pose;
          onPose(pose, sample);
        } else if (pose) onPose(null, sample);
      } catch (err) {
        if (onError) onError(err);
      }
    }, SAMPLE_MS);
    const track = stream.getVideoTracks()[0];
    return {
      get alive() { return !stopped && track && track.readyState === 'live'; },
      stop() {
        stopped = true;
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    };
  }

  const LABEL = { down: '공부 중 (고개 숙임)', up: '고개 듦', yawn: '하품 중', sleep: '조는 중 💤', gone: '자리 비움' };

  return { createClassifier, toSample, start, loadLandmarker, LABEL, MODEL_URL };
});
