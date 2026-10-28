# 그림 61: 칭호 4탄 메달 12개

내장 imagegen으로 시트마다 따로 생성했다. split/61-1~3 프롬프트에서 Drive 지시를 제거하고 저장소 기존 등급별 메달과 preview-25를 참고했다. 두 번째 시트부터 첫 시트도 첨부했다. 원본은 work/art에 보관하고 커밋하지 않는다. 생성 PNG는 1254px로 반환되어 투명도를 유지한 채 1024px로 맞춘 뒤 지정 fit-assets 도구로 잘랐다.

| 시트 | 칸 | 칭호 | 파일(public/assets/titles/) | 재생성 |
|---|---|---|---|---|
| 61-1 | 왼쪽 위 | 낚싯대 풀강 | rod5.webp · rod5-s.webp | 0 |
| 61-1 | 오른쪽 위 | 모의고사 씹어먹기 | mockclear.webp · mockclear-s.webp | 0 |
| 61-1 | 왼쪽 아래 | 통장 텅장 | broke.webp · broke-s.webp | 0 |
| 61-1 | 오른쪽 아래 | 100일 집사 | care100.webp · care100-s.webp | 0 |
| 61-2 | 왼쪽 위 | 올빼미 포획단 | huntnight.webp · huntnight-s.webp | 0 |
| 61-2 | 오른쪽 위 | 수산시장 사장님 | fishall.webp · fishall-s.webp | 0 |
| 61-2 | 왼쪽 아래 | 심해 탐사대장 | deepall.webp · deepall-s.webp | 0 |
| 61-2 | 오른쪽 아래 | 시험 범위 올킬 | rangeall.webp · rangeall-s.webp | 0 |
| 61-3 | 왼쪽 위 | 걸어다니는 금고 | coin30k.webp · coin30k-s.webp | 0 |
| 61-3 | 오른쪽 위 | 만렙 펫의 보호자 | petmax.webp · petmax-s.webp | 0 |
| 61-3 | 왼쪽 아래 | 몬스터 동사무소장 | huntall.webp · huntall-s.webp | 0 |
| 61-3 | 오른쪽 아래 | 주간 초시계왕 | timingweek.webp · timingweek-s.webp | 0 |

## 넣지 못한 그림
없음. 메달 12개 × 256px 본그림·96px 작은 그림 = WebP 24개.

## 확인
- 모든 시트 투명 배경·빈 칸 검사 통과. 최종 24개 크기 및 네 모서리 alpha 0 확인.
- 메달 가운데 그림, 글자·숫자 없음, 등급별 테두리를 기존 메달과 비교해 눈으로 확인했다.
- 눈으로 확인 필요: 실제 앱 48px에서의 최종 가독성과 등급 테두리 일치도는 선생님 최종 검토 대상.
- npm ci, npm run build:assets, npm run check:cloudflare 성공.
- npm run check 실패: Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent
- 관련 앱 코드와 점검 파일은 변경하지 않았다. 기존 그림 수정·삭제 없음(실제 PR 기준).
- build:assets가 갱신한 범위 밖 모듈은 되돌리고 허용된 public/sw.js만 반영한다. 버전 변경·운영 Supabase 연결·머지 없음.

새 칭호는 코드 등록(TITLES · TITLE_ART, 다음 세션) 후에 앱에 나온다
