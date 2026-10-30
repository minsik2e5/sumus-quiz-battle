# v13.196.1 — 아이폰 Safari 펫 카드 뒷면 비침 고침 · 미리보기 그림 빼기

## 바뀐 것
- 아이폰 Safari(WebKit)에서 홈의 펫 카드가 앞면 대신 **뒷면(야차전 기록)이 좌우로 뒤집힌 채** 보이던 것을 고쳤다. `backface-visibility`만 믿지 않고, 카드가 반쯤 돌았을 때(0.27초) 안 보이는 면을 `visibility`로 숨긴다. 뒤집는 움직임은 그대로다.
- PR 확인용 합본 미리보기 2장(`public/assets/review/art-37-preview.webp`, `public/assets/reviews/art-36.webp`, 각 약 800KB)을 앱 폴더에서 뺐다. 앱은 이 그림을 쓰지 않는다.

## 검사
- `server/release-check.mjs`: CSS 묶음에 펫 카드 면 숨기기 규칙이 있다. `public/assets/review` · `reviews` 폴더가 없다.
