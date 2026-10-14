// 실사 모드: 카메라 사진 한 장에서 얼굴(머리)만 캐릭터 얼굴 스티커로 덮는다.
// 사진은 이 기기에서 만들어지고, 얼굴을 못 찾으면 아예 만들지 않는다.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Photo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SIZE = 240; // 친구들에게 보내는 정사각형 사진 크기(px)
  const QUALITY = 0.7;
  const COVER = 1.0; // 얼굴 크기 대비 스티커 반지름 (지름은 얼굴의 2배 → 머리카락·귀까지 덮음)

  // 얼굴 점(0~1 좌표)들로 정사각형 사진 안의 머리 원(cx, cy, r)을 구한다.
  // vw, vh: 카메라 영상 크기. 가운데 정사각형만 잘라 쓰고, 셀카처럼 좌우를 뒤집는다.
  function headCircle(lm, vw, vh, size = SIZE, mirror = true) {
    if (!lm || !lm.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of lm) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (!(maxX > minX && maxY > minY)) return null;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    const k = size / side;
    const fw = (maxX - minX) * vw * k;
    const fh = (maxY - minY) * vh * k;
    let cx = (((minX + maxX) / 2) * vw - sx) * k;
    const cy = (((minY + maxY) / 2) * vh - sy) * k - fh * 0.12; // 이마·머리카락 쪽으로 살짝 올림
    if (mirror) cx = size - cx;
    const r = Math.max(fw, fh) * COVER;
    return { cx, cy, r, sx, sy, side };
  }

  const images = new Map();
  function loadImage(src) {
    let p = images.get(src);
    if (!p) {
      p = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
      p.catch(() => images.delete(src));
      images.set(src, p);
    }
    return p;
  }

  // 캐릭터 얼굴 그림을 준비한다 (스프라이트 시트의 한 칸 일부, 또는 사람 아바타 SVG)
  async function faceArt(Avatar, avatar, pose) {
    const a = Avatar.normalize(avatar);
    const url = a.kind && Avatar.spriteUrl(a.kind);
    if (url) {
      const cell = Avatar.SPRITE_CELL[pose] != null ? Avatar.SPRITE_CELL[pose] : 0;
      // 카드 얼굴 아이콘과 같은 부분 (viewBox 36 28 128 128 → 512px 칸 기준)
      return { img: await loadImage(url), sx: (cell % 3) * 512 + 63, sy: Math.floor(cell / 3) * 512 + 6, sw: 385, sh: 385 };
    }
    const svg = Avatar.face(a).replace('<svg ', '<svg width="256" height="256" ');
    const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    return { img, sx: 0, sy: 0, sw: 256, sh: 256 };
  }

  // 사진 한 장 만들기. 얼굴이 없으면 null.
  async function compose({ video, lm, Avatar, avatar, pose }) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const circle = headCircle(lm, vw, vh);
    if (!circle) return null;
    // 얼굴 위치를 잰 그 장면을 바로 떠 둔다 (캐릭터 그림을 기다리는 사이 영상이 바뀌지 않게)
    const frame = document.createElement('canvas');
    frame.width = SIZE;
    frame.height = SIZE;
    const fctx = frame.getContext('2d');
    fctx.translate(SIZE, 0);
    fctx.scale(-1, 1);
    fctx.drawImage(video, circle.sx, circle.sy, circle.side, circle.side, 0, 0, SIZE, SIZE);
    const art = await faceArt(Avatar, avatar, pose).catch(() => null);
    const first = render(frame, circle, art);
    if (first || !art) return first;
    return render(frame, circle, null); // 캐릭터 그림 때문에 막히면 캐릭터 없이 원만 덮는다
  }

  function render(frame, circle, art) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(frame, 0, 0);
    const { cx, cy, r } = circle;
    // 1) 불투명한 원으로 얼굴을 먼저 완전히 덮고  2) 그 위에 캐릭터 얼굴  3) 스티커 테두리
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6ee';
    ctx.fill();
    if (art) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.lineWidth = Math.max(3, r * 0.08);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    try {
      return canvas.toDataURL('image/jpeg', QUALITY);
    } catch {
      return null; // 그림 때문에 캔버스를 읽을 수 없는 브라우저
    }
  }

  return { SIZE, headCircle, compose };
});
