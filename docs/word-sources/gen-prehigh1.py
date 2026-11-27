import re, json, sys
src, out = sys.argv[1], sys.argv[2]
rows = [l.rstrip('\n').split('\t') for l in open(src, encoding='utf-8')][1:]
rows = [r for r in rows if int(r[0]) <= 1800]
assert len(rows) == 1800
JOSA = ['으로', '에서', '에게', '로', '에', '을', '를', '의', '이', '가', '은', '는', '와', '과']
def expand(s, depth=0):
    m = re.search(r'\[([^\]]+)\]', s)
    if not m or depth > 3: return [s]
    i, j = m.start(), m.end()
    k = i
    while k > 0 and s[k-1] not in ' ]()~': k -= 1
    token, rest_before, after = s[k:i], s[:k], s[j:]
    outs = [rest_before + token + after]
    for alt in m.group(1).split('/'):
        alt = alt.strip()
        if not alt: continue
        if alt in JOSA:
            jo = next((x for x in JOSA if token.endswith(x) and len(token) > len(x)), None)
            rep = token[:-len(jo)] + alt if jo else token + alt
        else:
            rep = alt
        outs.append(rest_before + rep + after)
    res = []
    for o in outs:
        for e in expand(o, depth + 1):
            if e not in res: res.append(e)
    return res
data = []
for n, day, word, meaning in rows:
    parts = [p.strip() for p in meaning.split(',')]
    acc = []
    for p in parts:
        if '[' not in p: continue
        for e in expand(p):
            e = re.sub(r'\s+', ' ', e).strip()
            if e and e not in acc and e != p: acc.append(e)
    data.append([word, meaning] + ([acc[:12]] if acc else []))
    assert int(day) == (int(n) - 1) // 30 + 1
head = """// V13.249 원일중 예비고1 단어장: 동아출판 「뜯어먹는 중학영단어 1800」 1~60일(하루 30단어, 모두 1800단어).
// 출처: 선생님이 보낸 일일테스트 답지에서 뽑은 단어표 docs/word-sources/prehigh1-1800-plus-300.tsv(번호 1~1800만 쓴다. 61~70일 +300은 넣지 않음).
// 단어 · 뜻은 표 그대로. 학생 전원 교재 구입(선생님 확인).
// 학교 원일중(wonil-middle) · 학년 grade: '예비고1'이라 예비고1 학생에게만 보인다(중2 · 중3 · 다른 학교에는 안 보임).
// 범위는 일차마다 하나: '1일' … '60일'. id는 prehigh:ddm1800:<번호 4자리>이고 다시 매기지 않는다.
// 시험 묶음 exam_period: 'midterm'(기본값과 같음): 학교 시험 범위가 아니라 한 갈래뿐이라 범위 고르기에 기말/중간 탭이 생기지 않는다.
// 렉 방지: 단어가 1800개라 단어 칸은 화면이 쓰는 것만 둔다(id · 범위 · 학년 · 단어 · 뜻). 출처는 책에 한 번.
// 정답 인정 목록(accepted_meanings)은 서버 채점에만 쓰므로 학생 첫 화면에는 보내지 않는다(client_slim, server/service.mjs).
// accepted_meanings: 뜻의 [ ] 대안(삶[인생/생활] → 인생 · 생활, 위층으로[에] → 위층에)을 채점이 받도록 펼친 것(만드는 법: python3 docs/word-sources/gen-prehigh1.py docs/word-sources/prehigh1-1800-plus-300.tsv server/prehigh1-vocab.mjs).
// 줄: [단어, 뜻, 추가 정답?]. 번호 = 줄 순서 + 1, 일차 = (번호 - 1) / 30 + 1.
export const PREHIGH1_BOOK_ID = 'prehigh:ddm1800';
export const PREHIGH1_DAYS = 60;
export const PREHIGH1_PER_DAY = 30;
const ROWS = [
"""
body = ',\n'.join(json.dumps(r, ensure_ascii=False) for r in data)
tail = """
];
export const prehigh1Book = {
  id: PREHIGH1_BOOK_ID,
  school_id: 'wonil-middle',
  school: '원일중',
  division: 'middle',
  grade: '예비고1',
  exam_period: 'midterm',
  client_slim: true,
  source: '뜯어먹는 중학영단어 1800',
  title: '예비고1 · 뜯어먹는 중학영단어 1800(1~60일)',
  words: ROWS.map(([word, meaning, accepted], i) => ({
    id: `prehigh:ddm1800:${String(i + 1).padStart(4, '0')}`, range_code: `${Math.floor(i / PREHIGH1_PER_DAY) + 1}일`, grade: '예비고1',
    word, meaning, ...(accepted ? { accepted_meanings: accepted } : {})
  }))
};
"""
open(out, 'w', encoding='utf-8').write(head + body + tail)
print(sum(1 for d in data if len(d) > 2), 'with accepted')
for d in data[:15]: 
    if len(d) > 2: print(d)
