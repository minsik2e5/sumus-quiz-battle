import { GACHA_ITEMS } from './rewards.js';
import { PET_ART, PET_REVEAL } from './pet-art.js';
export const EXAM_TYPES = {
  write_meaning: { label: '뜻쓰기', help: '영어를 보고 뜻 직접 쓰기', input: true },
  write_en: { label: '영어쓰기', help: '뜻을 보고 영어 직접 쓰기', input: true },
  eng2mean_mc: { label: '영어 → 뜻 객관식', help: '영어를 보고 뜻 고르기', input: false },
  mean2eng_mc: { label: '뜻 → 영어 객관식', help: '뜻을 보고 영어 고르기', input: false }
};
// Shared class roster used by teacher assignment forms. Keep values stable so
// student visibility (school + class match) remains deterministic.
export const CLASS_OPTIONS = ['고1A', '고1B', '중3', '중2'];
export const PRACTICE_TYPES = {
  write_meaning: '뜻 직접 쓰기', mixed: '골고루 연습', eng2mean: '영어 → 뜻', mean2eng: '뜻 → 영어',
  spell: '영어 직접 쓰기', listen: '듣기', scramble: '철자 배열', vowelblank: '모음 빈칸', initial: '첫 글자 힌트'
};
export const PRACTICE_SECONDS_PER_QUESTION = {
  write_meaning: 8,
  spell: 12,
  mixed: 9,
  eng2mean: 6,
  mean2eng: 7,
  listen: 7,
  scramble: 10,
  vowelblank: 10,
  initial: 10
};
// V13.76 실전시험: a countdown for every word (searching elsewhere does not fit in it), and the
// test is handed in by itself the third time the student leaves the app while it runs.
export const TEST_SECONDS_PER_QUESTION = { eng2mean: 10, mean2eng: 10, write_meaning: 15, spell: 20 }; // V13.76 per-word countdown (tests started before V13.80)
// V13.80 실전시험: one calm time limit for the whole test instead of a countdown per word
// (students found the per-word seconds too stressful). Each word adds its share; at least 2 minutes.
export const TEST_TIME_PER_QUESTION = { eng2mean: 15, mean2eng: 15, write_meaning: 24, spell: 24 };
export const testDurationSec = (mode, target) => Math.max(120, Math.ceil(Math.max(1, Number(target) || 1) * (TEST_TIME_PER_QUESTION[mode] || 20)));
export const TEST_LEAVE_LIMIT = 3;
// V13.76 펫 교감: 쓰다듬기 and 밥 주기, once a day each, a little 경험치 for the partner pet.
export const PET_CARE = { pet: { name: '쓰다듬기', xp: 10 }, feed: { name: '밥 주기', xp: 10 } };
export const PET_MISS_DAYS = 3; // away this long: the pet says it missed the student
export const STARS_MAX = 500;
export const practiceDurationSec = (mode, total) => Math.max(60, Math.ceil(Math.max(1, Number(total) || 1) * (PRACTICE_SECONDS_PER_QUESTION[mode] || 8)));
export const CHARACTERS = {
  dog: { name: 'MONG', ko: '몽이', type: '강아지', color: '#D79B54', light: '#F3C985', soft: '#FFF5E8' },
  pig: { name: 'PINKY', ko: '핑키', type: '돼지', color: '#F3A7A8', light: '#FFD0C8', soft: '#FFF1F0' },
  cat: { name: 'NABI', ko: '나비', type: '고양이', color: '#8B8582', light: '#C8C1BC', soft: '#F4F2F1' },
  dragon: { name: 'YONG', ko: '용이', type: '용', color: '#59B982', light: '#A8DE9E', soft: '#ECF8ED' },
  panda: { name: 'BAMBOO', ko: '밤부', type: '팬더', color: '#3F4442', light: '#F2F0E8', soft: '#F5F7F4' },
  snake: { name: 'CHORONG', ko: '초롱', type: '뱀', color: '#71C96E', light: '#BDEB8F', soft: '#F0F9E8' },
  rabbit: { name: 'TORI', ko: '토리', type: '토끼', color: '#F09AAE', light: '#FFD3DC', soft: '#FFF1F4' },
  fox: { name: 'HOYA', ko: '호야', type: '여우', color: '#E8893A', light: '#F8C27D', soft: '#FFF4E8' },
  haechi: { name: 'HAECHI', ko: '해치', type: '한국 수호수', color: '#63B89B', light: '#BFE8D7', soft: '#F0FBF6', legendary: true },
  // V13.118: 불새 is retired (nobody owned it) because 주작 became its mythic cousin. It stays here so an old record still draws; it is no longer in any egg or the dex.
  phoenix: { name: 'PHOENIX', ko: '불새', type: '봉황', color: '#E96A2E', light: '#FFD06A', soft: '#FFF3E8', legendary: true, retired: true },
  whale: { name: 'STAR WHALE', ko: '별고래', type: '별고래', color: '#4659B8', light: '#A9B7FF', soft: '#F0F1FF', legendary: true },
  qilin: { name: 'QILIN', ko: '기린', type: '동양 신수', color: '#77C9B2', light: '#F2C9F0', soft: '#FFF7FC', legendary: true },
  // V13.118 전설 천마, and the new top tier 신화 (mythic): 구미호 + the four guardian beasts. A mythic pet comes from any egg at a tiny chance (rewards.js MYTHIC_RATE), with no pity.
  cheonma: { name: 'CHEONMA', ko: '천마', type: '날개 달린 말', color: '#5A56C9', light: '#C9C7F5', soft: '#F2F1FD', legendary: true },
  gumiho: { name: 'MIHO', ko: '미호', type: '구미호', color: '#7BA7E8', light: '#D5E4FB', soft: '#F3F7FE', mythic: true },
  cheongryong: { name: 'CHEONGRYONG', ko: '청룡', type: '사신수 · 동쪽', color: '#2E8FD6', light: '#BEE0F8', soft: '#EFF8FE', mythic: true },
  baekho: { name: 'BAEKHO', ko: '백호', type: '사신수 · 서쪽', color: '#8E9CC4', light: '#E0E6F5', soft: '#F6F8FD', mythic: true },
  jujak: { name: 'JUJAK', ko: '주작', type: '사신수 · 남쪽', color: '#E2503A', light: '#FFC9A8', soft: '#FFF1EA', mythic: true },
  hyeonmu: { name: 'HYEONMU', ko: '현무', type: '사신수 · 북쪽', color: '#2E8C86', light: '#A9E0DA', soft: '#EAF8F6', mythic: true },
  // V13.92 영웅 펫: one step below the legendary pets (영웅 알 in the shop, or a coin capsule).
  capybara: { name: 'YUJA', ko: '유자', type: '카피바라', color: '#C08A4E', light: '#EBCB9C', soft: '#FBF3E8', epic: true },
  penguin: { name: 'PENGI', ko: '펭이', type: '펭귄', color: '#3E5A9A', light: '#A9C8F0', soft: '#EEF4FC', epic: true },
  owl: { name: 'OLLIE', ko: '올리', type: '부엉이', color: '#9A7BC9', light: '#D9C8F2', soft: '#F6F1FD', epic: true },
  hamster: { name: 'COOKIE', ko: '쿠키', type: '햄스터', color: '#D9A52E', light: '#F6DC8E', soft: '#FFF8E6', epic: true },
  shark: { name: 'PADO', ko: '파도', type: '아기 상어', color: '#3B8FD9', light: '#A6D3F7', soft: '#EDF6FE', epic: true },
  alpaca: { name: 'MONGGEUL', ko: '몽글', type: '알파카', color: '#A98BC4', light: '#E4D6F2', soft: '#F8F4FC', epic: true },
  hedgehog: { name: 'DOCHI', ko: '도치', type: '고슴도치', color: '#B07A3E', light: '#E8C79A', soft: '#FBF4EA', epic: true },
  otter: { name: 'DARI', ko: '달이', type: '수달', color: '#7A5233', light: '#D6B595', soft: '#F8F1EA', epic: true },
  // V13.110 새 펫: 기본 4종(랜덤 알) · 영웅 4종(영웅 알).
  squirrel: { name: 'DOTORI', ko: '도토리', type: '다람쥐', color: '#C8642E', light: '#F1B27A', soft: '#FFF2E8' },
  turtle: { name: 'NEURIT', ko: '느릿', type: '거북이', color: '#3FA58A', light: '#A8E3CF', soft: '#EEFAF5' },
  duck: { name: 'KKWAK', ko: '꽥꽥', type: '오리', color: '#E9B92E', light: '#FBE48C', soft: '#FFFBEA' },
  sheep: { name: 'MUNGSIL', ko: '뭉실', type: '양', color: '#D9A27E', light: '#F6DCC8', soft: '#FFF7F1' },
  redpanda: { name: 'DANPUNG', ko: '단풍', type: '레서판다', color: '#C2452D', light: '#F2A27E', soft: '#FFF0EA', epic: true },
  arcticfox: { name: 'NUNSONG', ko: '눈송', type: '북극여우', color: '#5E9BD6', light: '#C9E2F7', soft: '#F2F8FE', epic: true },
  koala: { name: 'KULKUL', ko: '쿨쿨', type: '코알라', color: '#7C8697', light: '#D3D8E2', soft: '#F5F6F9', epic: true },
  parrot: { name: 'AENGDU', ko: '앵두', type: '앵무새', color: '#D9382E', light: '#FFC24A', soft: '#FFF4EC', epic: true },
  frog: { name: 'POLJJAK', ko: '폴짝', type: '개구리', color: '#65B95E', light: '#BCE991', soft: '#F0FAEA' },
  sapsaree: { name: 'BOKSIL', ko: '복실', type: '삽살개', color: '#A9A9A0', light: '#E5E2D8', soft: '#FAF8F2' },
  deer: { name: 'SAESSAK', ko: '새싹', type: '사슴', color: '#BA8B5D', light: '#EACAA0', soft: '#FCF5E9' },
  bear: { name: 'DEUNDEUN', ko: '든든', type: '곰', color: '#A87955', light: '#DCB895', soft: '#F8EFE7' },
  seal: { name: 'DONGGEUL', ko: '동글', type: '물범', color: '#80A5B8', light: '#C8E3EA', soft: '#F0F9FA', epic: true },
  wolf: { name: 'DALBIT', ko: '달빛', type: '늑대', color: '#7385AE', light: '#C4CDE8', soft: '#F1F3FC', epic: true },
  crocodile: { name: 'DEOPSSAK', ko: '덥썩', type: '악어', color: '#6FAD68', light: '#BFE0A1', soft: '#F0F8E9', epic: true },
  octopus: { name: 'MALLANG', ko: '말랑', type: '문어', color: '#CB84B8', light: '#F0C1DF', soft: '#FFF1F8', epic: true },
  // V13.148 새 펫 3탄(그림 24): 기본 5 + 영웅 5.
  elephant: { name: 'KORONG', ko: '코롱', type: '아기 코끼리', color: '#7E9BB8', light: '#C9D9EA', soft: '#F2F6FB' },
  meerkat: { name: 'JJONGGEUT', ko: '쫑긋', type: '미어캣', color: '#C29A62', light: '#EBD5AE', soft: '#FCF6EA' },
  raccoondog: { name: 'NEOGUL', ko: '너굴', type: '아기 너구리', color: '#8D7C6A', light: '#D9CBB8', soft: '#F8F4EE' },
  longtit: { name: 'PORONG', ko: '포롱', type: '오목눈이', color: '#D58AA6', light: '#F4D2DF', soft: '#FFF5F9' },
  hippo: { name: 'HAMUNG', ko: '하뭉', type: '아기 하마', color: '#A688B8', light: '#DCCBE8', soft: '#F8F3FC' },
  guineapig: { name: 'KKUI', ko: '꾸이', type: '기니피그', color: '#D48A3E', light: '#F4CFA0', soft: '#FFF5EA', epic: true },
  axolotl: { name: 'UPA', ko: '우파', type: '아홀로틀', color: '#E27A9A', light: '#F8C6D5', soft: '#FFF2F6', epic: true },
  chinchilla: { name: 'CHINCHIN', ko: '친친', type: '친칠라', color: '#8E8FA8', light: '#D7D8E6', soft: '#F6F6FB', epic: true },
  sloth: { name: 'NEULBO', ko: '늘보', type: '나무늘보', color: '#8F7A5A', light: '#D9C9A6', soft: '#F8F3E8', epic: true },
  platypus: { name: 'NAPJAK', ko: '납작', type: '오리너구리', color: '#3E8E8A', light: '#A8DAD4', soft: '#EEF9F7', epic: true },
  // V13.168 새 펫 14종(그림 주문서 36 · 37 · 38): 12지를 채우는 기본 6 · 영웅 6 · 신화 2.
  // `artOrder`가 있는 펫은 그림이 들어올 때까지(public/modules/pet-art.js, build:assets가 만든다) 알 · 선물 · 사냥 · 도감 목록에 없다(petReady).
  mouse: { name: 'JJIKJJIK', ko: '찍찍이', type: '아기 쥐', color: '#8F8FA3', light: '#D9D9E6', soft: '#F5F5FA', artOrder: 36 },
  calf: { name: 'EUMMAE', ko: '음매', type: '송아지', color: '#C38B3C', light: '#F0D19A', soft: '#FDF6E8', artOrder: 36 },
  tiger: { name: 'EOHEUNG', ko: '어흥', type: '아기 호랑이', color: '#E5862A', light: '#FFCB85', soft: '#FFF4E6', artOrder: 36 },
  pony: { name: 'DAGEUDAK', ko: '다그닥', type: '조랑말', color: '#B06A3B', light: '#EBC39A', soft: '#FBF1E8', artOrder: 36 },
  monkey: { name: 'KKIKKI', ko: '끼끼', type: '꼬마 원숭이', color: '#B57B4A', light: '#F1C9A0', soft: '#FCF3EA', artOrder: 36 },
  rooster: { name: 'KKOKKO', ko: '꼬꼬', type: '꼬마 닭', color: '#E2A92A', light: '#FFE38A', soft: '#FFFAE6', artOrder: 36 },
  flamingo: { name: 'MINGO', ko: '밍고', type: '플라밍고', color: '#E9799B', light: '#FFC6D5', soft: '#FFF1F5', epic: true, artOrder: 37 },
  quokka: { name: 'BANGGEUT', ko: '방긋', type: '쿼카', color: '#A8754A', light: '#E9C59D', soft: '#FBF3EA', epic: true, artOrder: 37 },
  chameleon: { name: 'KAMEL', ko: '카멜', type: '카멜레온', color: '#36A98F', light: '#B5EBD9', soft: '#EEFAF6', epic: true, artOrder: 37 },
  polarbear: { name: 'NUNGOM', ko: '눈곰', type: '아기 북극곰', color: '#6FA9CF', light: '#D6EBF7', soft: '#F3F9FD', epic: true, artOrder: 37 },
  snowleopard: { name: 'SEOLPYO', ko: '설표', type: '아기 눈표범', color: '#868D9C', light: '#DADDE4', soft: '#F5F6F8', epic: true, artOrder: 37 },
  hummingbird: { name: 'WINGWING', ko: '윙윙', type: '벌새', color: '#2A9F86', light: '#A9EAD6', soft: '#EDFAF6', epic: true, artOrder: 37 },
  hwangryong: { name: 'HWANGRYONG', ko: '황룡', type: '오방신 · 중앙', color: '#D29B17', light: '#FFE38A', soft: '#FFF9E6', mythic: true, artOrder: 38 },
  samjogo: { name: 'SAMJOGO', ko: '삼족오', type: '세 발 까마귀', color: '#4A3F6B', light: '#F2C14E', soft: '#FFF8E5', mythic: true, artOrder: 38 },
  // V13.109 한정 펫: sold for one season only (its own egg), then found only in 영웅 eggs. No yacha skill.
  // V13.117: the 가을 이벤트 알 holds all five: the Halloween pair and the exam-cheering three.
  pumpkincat: { name: 'HOBAK', ko: '호박냥', type: '호박 고양이', color: '#E8842C', light: '#FFC98A', soft: '#FFF3E6', limited: 'autumn' },
  ghost: { name: 'BOO', ko: '부우', type: '꼬마 유령', color: '#8E7CC3', light: '#DCD3F5', soft: '#F7F4FE', limited: 'autumn' },
  riceball: { name: 'JUMEOKI', ko: '주먹이', type: '주먹밥 병아리', color: '#8C7B6B', light: '#F3E9D8', soft: '#FFFAF1', limited: 'autumn' },
  tissue: { name: 'SULSUL', ko: '술술이', type: '두루마리 휴지', color: '#D9A441', light: '#FBE7B0', soft: '#FFFBEF', limited: 'autumn' },
  glue: { name: 'CHALSSAK', ko: '찰싹이', type: '딱풀', color: '#6FA8DC', light: '#CFE6F8', soft: '#F1F8FE', limited: 'autumn' },
  // V13.195 곤충 · 공룡 시리즈(docs/bug-dino-pets-design.md, 그림 54 · 55): 알 상점의 시리즈 알(SERIES_EGG)에서만 나온다.
  // 전역 등급 표시(epic · legendary)는 넣지 않는다: 기본 · 영웅 · 전설 알, 선물 알, 사냥, 코인 뽑기, 영웅 수 · 전역 전설 셈에 안 섞인다.
  // `rank`는 시리즈 안 등급(기본 · 영웅 · 전설: 알 확률 무게 · 특기 세기 · 도감 테두리), `group`은 곤충(bug) · 공룡(dino).
  ladybug: { name: 'JEOMSUNI', ko: '점순이', type: '무당벌레', color: '#D9443F', light: '#FFB8AD', soft: '#FFF1EE', series: 'bugdino', rank: 'basic', group: 'bug', artOrder: 54 },
  bee: { name: 'BUNGBUNG', ko: '붕붕이', type: '꿀벌', color: '#D9A21F', light: '#FFE08A', soft: '#FFF9E3', series: 'bugdino', rank: 'basic', group: 'bug', artOrder: 54 },
  ant: { name: 'YEONGCHA', ko: '영차', type: '일개미', color: '#8A5A3C', light: '#E3BFA0', soft: '#FAF1EA', series: 'bugdino', rank: 'basic', group: 'bug', artOrder: 54 },
  firefly: { name: 'BANJJAK', ko: '반짝이', type: '반딧불이', color: '#3D4F8C', light: '#FFE680', soft: '#F1F3FB', series: 'bugdino', rank: 'basic', group: 'bug', artOrder: 54 },
  rhinobeetle: { name: 'JANGSU', ko: '장수', type: '장수풍뎅이', color: '#7A4A2A', light: '#D9B08C', soft: '#F8EFE6', series: 'bugdino', rank: 'epic', group: 'bug', artOrder: 54 },
  butterfly: { name: 'NAPUL', ko: '나풀', type: '호랑나비', color: '#E88A2E', light: '#FFD08A', soft: '#FFF5E6', series: 'bugdino', rank: 'epic', group: 'bug', artOrder: 54 },
  tricera: { name: 'PPULPPUL', ko: '뿔뿔이', type: '아기 트리케라톱스', color: '#3FA98B', light: '#B8EBDB', soft: '#EEFAF6', series: 'bugdino', rank: 'basic', group: 'dino', artOrder: 55 },
  stego: { name: 'PPIJUK', ko: '삐죽이', type: '아기 스테고사우루스', color: '#8E72C9', light: '#DCCFF5', soft: '#F6F2FD', series: 'bugdino', rank: 'basic', group: 'dino', artOrder: 55 },
  brachio: { name: 'LONGLONG', ko: '롱롱이', type: '아기 브라키오사우루스', color: '#4F9BCF', light: '#C6E4F7', soft: '#F0F8FD', series: 'bugdino', rank: 'basic', group: 'dino', artOrder: 55 },
  ptera: { name: 'HWIIK', ko: '휘익', type: '아기 프테라노돈', color: '#E57C63', light: '#FFCDBF', soft: '#FFF2EE', series: 'bugdino', rank: 'epic', group: 'dino', artOrder: 55 },
  ankylo: { name: 'DANDAN', ko: '단단이', type: '아기 안킬로사우루스', color: '#8F7F4E', light: '#E3D8A8', soft: '#FAF7EA', series: 'bugdino', rank: 'epic', group: 'dino', artOrder: 55 },
  tyranno: { name: 'REX', ko: '렉스', type: '아기 티라노사우루스', color: '#C8463A', light: '#FFC0A8', soft: '#FFF0EA', series: 'bugdino', rank: 'legendary', group: 'dino', artOrder: 55 }
};
// V13.168 그림이 다 들어온 펫만 준비됨: `artOrder` 펫은 기본 · 작은 그림 · 표정 · 알 반응(신화는 등장 포즈 · 등장 배경까지)이 있어야 한다.
// 아래 목록(알 · 선물 · 사냥 · 낚시 교환소 · 뽑기 · 도감 · 펫 수)은 모두 준비된 펫만 담는다. 그림을 넣고 build:assets를 돌리면 자동으로 나온다.
export const petReady = key => !!CHARACTERS[key] && (!CHARACTERS[key].artOrder || (PET_ART.has(key) && (!CHARACTERS[key].mythic || PET_REVEAL.has(key))));
const readyKeys = test => Object.keys(CHARACTERS).filter(key => test(CHARACTERS[key]) && petReady(key));
// V13.195 시리즈 펫(`series`)은 아래 전역 등급 목록에 하나도 들어가지 않는다(SERIES_PET_KEYS만). 펫 수(ACTIVE)에는 들어간다.
export const LEGENDARY_PET_KEYS = readyKeys(c => c.legendary && !c.retired && !c.series);
// The pets a student can ever meet (a retired pet such as 불새 is left out of every count and list).
export const ACTIVE_PET_KEYS = readyKeys(c => !c.retired);
export const MYTHIC_PET_KEYS = readyKeys(c => c.mythic && !c.series);
// V13.150 바다 펫(sea)은 낚시 교환소에서만: 영웅 알 · 뽑기 확률표에는 넣지 않는다.
export const EPIC_PET_KEYS = readyKeys(c => c.epic && !c.sea && !c.series);
export const LIMITED_PET_KEYS = readyKeys(c => c.limited && !c.series);
export const STANDARD_PET_KEYS = readyKeys(c => !c.legendary && !c.mythic && !c.epic && !c.limited && !c.sea && !c.series);
// V13.168 그림을 기다리는 펫(도감의 '곧 만나요' 그림자).
export const SOON_PET_KEYS = Object.keys(CHARACTERS).filter(key => !CHARACTERS[key].retired && !petReady(key));
// V13.168 12지(쥐 · 소 · 호랑이 · 토끼 · 용 · 뱀 · 말 · 양 · 원숭이 · 닭 · 개 · 돼지): 다 모으면 칭호 '12지 수호자'.
export const ZODIAC_PET_KEYS = ['mouse', 'calf', 'tiger', 'rabbit', 'dragon', 'snake', 'pony', 'sheep', 'monkey', 'rooster', 'dog', 'pig'];
// The pet tiers, lowest first: 기본 (the shop egg), 영웅, 전설, 신화 (V13.118). 한정 sits beside them (a season's pets).
export const petTier = key => CHARACTERS[key]?.mythic ? 'mythic' : CHARACTERS[key]?.legendary ? 'legendary' : CHARACTERS[key]?.epic ? 'epic' : CHARACTERS[key]?.limited ? 'limited' : 'basic';
// V13.109 시즌 한정: the season's egg is sold from `start` to `end` (Korea time, `end` included).
// After the season its pets come only from 영웅 eggs: a 영웅 result (영웅 알 or 코인 뽑기) is one of
// them `after_rate`% of the time, while the student still misses one.
export const SEASONS = {
  // V13.117: the Halloween egg became the 가을 이벤트 알 (Halloween + 수능·기말 응원), on sale until 11/30.
  autumn: { name: '가을 이벤트', egg: '가을 이벤트 알', price: 600, start: '2026-10-01', end: '2026-11-30', until: '11월 30일', after_rate: 5, stage: 'halloween', stage_end: '2026-11-07' }
};
const kstDay = now => new Date(Number(now) + 9 * 3600000).toISOString().slice(0, 10);
export const seasonKeys = id => LIMITED_PET_KEYS.filter(key => CHARACTERS[key].limited === id);
// The season whose egg is on sale now (or null).
export function seasonOnSale(now = Date.now()) {
  const day = kstDay(now);
  const id = Object.keys(SEASONS).find(k => day >= SEASONS[k].start && day <= SEASONS[k].end);
  return id ? { id, ...SEASONS[id], keys: seasonKeys(id) } : null;
}
// V13.117: the battle stage of the season (the Halloween one), only until `stage_end` (11/7), though the egg sells until 11/30.
export function seasonStage(now = Date.now()) {
  const s = seasonOnSale(now);
  return s?.stage && kstDay(now) <= (s.stage_end || s.end) ? s.stage : null;
}
// Limited pets of seasons already over: these hide in 영웅 eggs.
export const seasonsOver = (now = Date.now()) => Object.keys(SEASONS).filter(id => kstDay(now) > SEASONS[id].end);
// Pet growth: an egg, then three evolution forms. `form` is 0 (egg) .. 3 (final).
export const PET_FORMS = ['알', '아기', '성장', '최종'];
export const PET_FORM_LEVELS = [1, 3, 10, 20];
export const petForm = (level = 1) => PET_FORM_LEVELS.reduce((form, min, i) => (Number(level) >= min ? i : form), 0);
export const PET_NAME_MAX = 8;
export const EGG_PRICE = 400; // V13.73: 800 -> 400
export const EPIC_EGG_PRICE = 800; // V13.92 영웅 알: a random 영웅 pet not met yet (V13.98: 1200 -> 800)
// V13.98: a 영웅 알 bought by a student without a legendary pet opens as a legendary pet 1% of the time.
export const EPIC_EGG_LEGENDARY_RATE = 1;
// V13.182 전설 알(docs/legend-egg-design.md): 영웅 펫(EPIC_PET_KEYS)을 LEGEND_EGG_EPIC_NEED마리 모으면 한 번 받고,
// 알 상점에서 LEGEND_EGG_PRICE코인에 살 수 있다. 열면 갖고 있지 않은 전설 펫 하나가 랜덤으로 나온다(신화는 없다).
// V13.197: 학생당 1마리 제한 없음. 상점 알은 못 만난 전설이 남은 만큼 살 수 있고, 다 만났으면 알 대신 LEGEND_EGG_COINS코인과 칭호 '전설의 주인'.
export const LEGEND_EGG_EPIC_NEED = 20;
export const LEGEND_EGG_PRICE = 15000;
export const LEGEND_EGG_COINS = 3000;
// V13.195 곤충 · 공룡 시리즈 알(docs/bug-dino-pets-design.md): 알 상점 탭 하나, SERIES_EGG.price코인.
// 열면 아직 없는 시리즈 펫 하나(중복 없음): 남은 펫이 있는 시리즈 등급끼리 `weights`로 등급을 고르고, 그 등급의 남은 펫 중 랜덤.
// 다 모으면 더 팔지 않는다. 신화를 굴리지 않는다(전역 알이 아니다). 어떤 펫이 나올지는 열 때 서버가 정한다.
export const SERIES_EGG = { id: 'bugdino', item: 'bugdino_egg', name: '곤충 · 공룡 알', price: 1000, weights: { basic: 60, epic: 30, legendary: 2 } };
export const SERIES_PET_KEYS = readyKeys(c => c.series === SERIES_EGG.id);
export const SERIES_RANKS = { basic: '기본', epic: '영웅', legendary: '전설' };
export const seriesRank = key => CHARACTERS[key]?.series ? CHARACTERS[key].rank : null;
export const seriesGroupKeys = group => SERIES_PET_KEYS.filter(key => CHARACTERS[key].group === group);
// Student-chosen pet name, checked the same way on the device and on the server.
// An empty name is allowed and means "use the pet's default name".
export function cleanPetName(value) {
  const name = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name) return { name: '', error: '' };
  if (Array.from(name).length > PET_NAME_MAX) return { name, error: `이름은 ${PET_NAME_MAX}자까지 지을 수 있어요.` };
  if (!/^[\p{Script=Hangul}A-Za-z0-9 ·._~!-]+$/u.test(name)) return { name, error: '한글, 영어, 숫자로 지어주세요.' };
  return { name, error: '' };
}
// V13.67: capsule-machine auras join as frames; they are worn only by students who pulled them
// (`gacha`: the capsule key, checked in `unlocked`). V13.68 dropped the capsule badges.
const gachaWear = kind => Object.fromEntries(Object.entries(GACHA_ITEMS).filter(([, item]) => item.kind === kind).map(([key, item]) => [item.wear, { name: item.name, gacha: key, tier: item.tier }]));
export const ACCESSORIES = {
  none: { name: '기본', level: 1 }, headset: { name: '헤드셋', level: 3 }, glasses: { name: '포커스 글래스', level: 6 },
  starpin: { name: '스타 핀', level: 9 }, visor: { name: '바이저', level: 13 }, crown: { name: '크라운', level: 18 }
};
export const FRAMES = { basic: { name: '기본', level: 1 }, silver: { name: '실버', level: 5 }, neon: { name: '블루 라인', level: 10 }, aurora: { name: '오로라', level: 15 }, legend: { name: '골드', level: 20 }, ...gachaWear('aura') };
export const TITLES = { rookie: { name: '첫걸음', level: 1 }, focus: { name: '집중의 힘', level: 5 }, combo: { name: '10연속의 주인공', combo: 10 }, streak: { name: '7일의 기록', streak: 7 }, master: { name: '단어 마스터', level: 15 }, legend: { name: '한계를 넘어서', level: 20 }, yacha3: { name: '야차 3연승', battle_streak: 3 }, yachaking: { name: '야차왕', battle_streak: 5 } };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// V13.78: the level cap went from 50 to 60.
// V13.153 펫 레벨만 60에서 멈춘다. 학생 레벨(본렙)은 끝없이 오른다(같은 공식: 한 레벨마다 필요한 경험치가 70씩 는다).
export const MAX_LEVEL = 60;
export const PLAYER_MAX_LEVEL = Infinity;
export function levelInfo(points = 0, cap = MAX_LEVEL) {
  let level = 1, base = 0, need = 180;
  points = Math.max(0, Number(points) || 0);
  while (level < cap && points >= base + need) { base += need; level++; need = 180 + (level - 1) * 70; }
  const current = level === cap ? need : points - base;
  // `stage` (1..5) is kept for app versions still installed on phones; new screens use `form`.
  return { level, current, need, percent: clamp(current / need * 100, 0, 100), remaining: Math.max(0, need - current), stage: level >= 20 ? 5 : level >= 15 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1, form: petForm(level) };
}
// V13.78 partner card rarity by level (trading-card style). Each tier changes the card's finish;
// reaching a new tier plays the card-upgrade moment (modules/card-levelup.js).
export const CARD_TIERS = [
  { key: 'c', label: 'C', name: '커먼', min: 1 },
  { key: 'u', label: 'U', name: '언커먼', min: 3 },
  { key: 'r', label: 'R', name: '레어', min: 6 },
  { key: 'rr', label: 'RR', name: '더블 레어', min: 10 },
  { key: 'rrr', label: 'RRR', name: '트리플 레어', min: 15 },
  { key: 'sr', label: 'SR', name: '슈퍼 레어', min: 20 },
  { key: 'hr', label: 'HR', name: '하이퍼 레어', min: 25 },
  { key: 'ur', label: 'UR', name: '울트라 레어', min: 30 },
  { key: 'ssr', label: 'SSR', name: '샤이니 레어', min: 40 },
  { key: 'lgd', label: 'LGD', name: '레전드', min: 50 }
];
export const cardTierIndex = (level = 1) => CARD_TIERS.reduce((index, tier, i) => (Number(level) >= tier.min ? i : index), 0);
export function cardTier(level = 1) {
  const index = cardTierIndex(level), next = CARD_TIERS[index + 1] || null;
  return { ...CARD_TIERS[index], index, next, max: Number(level) >= MAX_LEVEL };
}
// Each owned pet grows with the XP of practice finished while it was the partner.
// Records from before pets were collectible (no pet_key) belong to the first pet.
export function petProgress(pets = [], sessions = [], activeKey) {
  return pets.map(pet => {
    const xp = sessions.reduce((n, s) => n + ((s.pet_key ? s.pet_key === pet.key : pet.first) ? Number(s.xp || 0) : 0), 0);
    const info = levelInfo(xp);
    return { key: pet.key, name: pet.name || '', first: !!pet.first, acquired_at: pet.acquired_at || 0, xp, level: info.level, form: info.form, percent: info.percent, remaining: info.remaining, active: pet.key === activeKey };
  });
}
export const unlocked = (item, growth) => !!item && (!item.gacha || Number(growth?.gacha?.[item.gacha] || 0) > 0) && (!item.level || growth.level >= item.level) && (!item.combo || growth.best_combo >= item.combo) && (!item.streak || growth.streak >= item.streak) && (!item.battle_streak || Number(growth.battle?.best_streak || 0) >= item.battle_streak);
export function displayEnglish(raw) {
  return String(raw ?? '').normalize('NFKC').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[*~～]/g, '').replace(/\s+/g, ' ').trim();
}
export function normalizeEnglish(raw) {
  return displayEnglish(raw).toLowerCase().replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/^[.,;:!?]+|[.,;:!?]+$/g, '').trim();
}
export function englishAccepted(raw) {
  const values = [normalizeEnglish(raw)];
  for (const m of String(raw).matchAll(/\((?:pl\.?|plural)\s*[:.]?\s*([^)]*)\)/gi)) values.push(...m[1].split(/[,;/]/).map(normalizeEnglish));
  return [...new Set(values.filter(Boolean))];
}
export function normalizeMeaning(raw) {
  return String(raw ?? '').normalize('NFKC').toLowerCase().replace(/[~～·•・.,;:!?()[\]{}"'‘’“”]/g, '').replace(/\s+/g, '').trim();
}
function meaningParts(raw) {
  const original = String(raw ?? '').normalize('NFKC');
  const text = original.replace(/\([^)]*\)|\[[^\]]*\]/g, '');
  return [...new Set([original, text, ...text.split(/[,;；，/\n]|또는/)].map(value => value.trim()).filter(Boolean))];
}
const SAFE_MEANING_GROUPS = [
  ['만족한', '흡족한'],
  ['알아보다', '인식하다', '알아차리다'],
  ['요구하다', '필요로 하다'],
  ['감소하다', '줄어들다'],
  ['감소시키다', '줄이다'],
  ['증가하다', '늘어나다'],
  ['증가시키다', '늘리다'],
  ['선택하다', '고르다'],
  ['구매하다', '사다'],
  ['판매하다', '팔다'],
  ['돕다', '도와주다', '도움을 주다'],
  ['보호하다', '지키다'],
  ['포함하다', '포함시키다'],
  ['제외하다', '빼다'],
  ['발생하다', '일어나다', '생기다'],
  ['끝내다', '마치다'],
  ['사용하다', '이용하다'],
  ['비슷한', '유사한'],
  ['신뢰할 수 있는', '믿을 수 있는', '믿을 만한'],
  ['회상하다', '기억해 내다'],
  ['독립적으로', '스스로'],
  ['궁극적으로', '결국']
].map(group => group.map(normalizeMeaning));

const SAFE_MEANING_LOOKUP = (() => {
  const lookup = new Map();
  for (const group of SAFE_MEANING_GROUPS) {
    for (const value of group) lookup.set(value, group);
  }
  return lookup;
})();

function addPredicateFamily(set, raw) {
  const value = normalizeMeaning(raw);
  if (!value) return;
  set.add(value);
  const add = (...values) => values.filter(Boolean).forEach(item => set.add(item));

  // 하다 계열: 서술어 활용만 인정. 명사형(어간 단독/하기/함/한 것)은 제외.
  if (value.endsWith('하다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '하다', stem + '한', stem + '하는', stem + '하여', stem + '해서');
    return;
  }
  if (value.endsWith('하는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '하다', stem + '한', stem + '하는', stem + '하여', stem + '해서');
    return;
  }
  if (value.endsWith('한') && value.length > 1) {
    const stem = value.slice(0, -1);
    add(stem + '하다', stem + '한', stem + '하는', stem + '하여', stem + '해서');
    return;
  }
  if ((value.endsWith('하여') || value.endsWith('해서')) && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '하다', stem + '한', stem + '하는', stem + '하여', stem + '해서');
    return;
  }

  // 되다 계열: 동사 활용만 인정. '형성' 같은 명사 어간은 제외.
  if (value.endsWith('되다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '되다', stem + '된', stem + '되는', stem + '되어', stem + '돼');
    return;
  }
  if (value.endsWith('되는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '되다', stem + '된', stem + '되는', stem + '되어', stem + '돼');
    return;
  }
  if (value.endsWith('된') && value.length > 1) {
    const stem = value.slice(0, -1);
    add(stem + '되다', stem + '된', stem + '되는', stem + '되어', stem + '돼');
    return;
  }

  if (value.endsWith('시키다') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '시키다', stem + '시키는', stem + '시킨');
    return;
  }
  if (value.endsWith('시키는') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '시키다', stem + '시키는', stem + '시킨');
    return;
  }
  if (value.endsWith('시킨') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '시키다', stem + '시키는', stem + '시킨');
    return;
  }

  if (value.endsWith('있다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '있다', stem + '있는');
    return;
  }
  if (value.endsWith('있는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '있다', stem + '있는');
    return;
  }
  if (value.endsWith('없다') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '없다', stem + '없는');
    return;
  }
  if (value.endsWith('없는') && value.length > 2) {
    const stem = value.slice(0, -2);
    add(stem + '없다', stem + '없는');
    return;
  }

  // -적이다 계열: '효과적이다 ↔ 효과적인'만 인정. '효과적' 단독은 제외.
  if (value.endsWith('적이다') && value.length > 3) {
    const stem = value.slice(0, -2);
    add(stem + '이다', stem + '인');
    return;
  }
  if (value.endsWith('적인') && value.length > 2) {
    const stem = value.slice(0, -1);
    add(stem + '이다', stem + '인');
    return;
  }

  if (value.endsWith('스럽다') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '스럽다', stem + '스러운');
    return;
  }
  if (value.endsWith('스러운') && value.length > 3) {
    const stem = value.slice(0, -3);
    add(stem + '스럽다', stem + '스러운');
  }
}
function stripMeaningParticle(raw) {
  const value = normalizeMeaning(raw);
  if (value.length < 3) return value;
  for (const suffix of ['으로는','로는','에게는','에서는','부터는','까지는','은','는','이','가','을','를','도','만']) {
    if (value.endsWith(suffix) && value.length > suffix.length + 1) return value.slice(0, -suffix.length);
  }
  return value;
}
export function automaticMeaningAccepted(raw) {
  const accepted = new Set();
  for (const part of meaningParts(raw)) {
    const normalized = normalizeMeaning(part);
    addPredicateFamily(accepted, normalized);
    const group = SAFE_MEANING_LOOKUP.get(normalized);
    if (group) for (const alias of group) addPredicateFamily(accepted, alias);
  }
  return [...accepted];
}
export function meaningAccepted(raw, aliases = []) {
  const accepted = new Set(automaticMeaningAccepted(raw));
  for (const alias of Array.isArray(aliases) ? aliases : []) {
    addPredicateFamily(accepted, alias);
  }
  return [...accepted];
}
export function grade(type, answer, word) {
  if (typeof answer !== 'string' || !answer.trim()) return false;
  if (type === 'write_en' || ['spell', 'scramble', 'vowelblank', 'initial'].includes(type)) return englishAccepted(word.word).includes(normalizeEnglish(answer));
  if (type === 'write_meaning') {
    const accepted = new Set(meaningAccepted(word.meaning, word.accepted_meanings));
    const input = normalizeMeaning(answer);
    const candidates = new Set();
    addPredicateFamily(candidates, input);
    const withoutParticle = stripMeaningParticle(input);
    if (withoutParticle !== input) addPredicateFamily(candidates, withoutParticle);
    return [...candidates].some(value => accepted.has(value));
  }
  return answer === (type === 'mean2eng_mc' || type === 'mean2eng' ? displayEnglish(word.word) : word.meaning);
}
export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function buildQuestion(word, type, pool) {
  const isEn = ['mean2eng_mc', 'mean2eng', 'write_en', 'spell', 'scramble', 'vowelblank', 'initial'].includes(type);
  let prompt = isEn ? word.meaning : displayEnglish(word.word);
  let hint = '';
  if (type === 'vowelblank') hint = displayEnglish(word.word).replace(/[aeiou]/gi, '＿');
  if (type === 'initial') hint = displayEnglish(word.word).split(' ').map(s => s[0] + '＿'.repeat(Math.max(0, s.length - 1))).join(' ');
  if (type === 'scramble') hint = shuffle([...displayEnglish(word.word)]).join(' · ');
  if (type === 'listen') prompt = '';
  const mc = ['eng2mean_mc', 'mean2eng_mc', 'eng2mean', 'mean2eng', 'listen'].includes(type);
  const value = w => isEn ? displayEnglish(w.word) : w.meaning;
  const correct = value(word);
  const options = mc ? shuffle([correct, ...shuffle([...new Set(pool.filter(w => w.id !== word.id).map(value))].filter(v => v !== correct)).slice(0, 3)]) : [];
  return { word_id: word.id, type, prompt, hint, options, ...(type === 'listen' ? { audio: displayEnglish(word.word) } : {}) };
}
export function choosePracticeWord(words, mastery, state, random = Math.random) {
  const due = state.retry.findIndex(r => r.at <= state.total);
  if (due >= 0) { const retry = state.retry.splice(due, 1)[0]; return words.find(w => w.id === retry.id); }
  const candidates = words.filter(w => w.id !== state.last && !state.retry.some(r => r.id === w.id));
  const pool = candidates.length ? candidates : words;
  const weighted = pool.map(w => ({ w, weight: 1 + (100 - (mastery[w.id]?.mastery || 0)) / 20 + Math.min(4, mastery[w.id]?.wrong || 0) }));
  let roll = random() * weighted.reduce((n, v) => n + v.weight, 0);
  return (weighted.find(v => (roll -= v.weight) <= 0) || weighted.at(-1)).w;
}
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });
export const dayKey = ts => dayFormatter.format(new Date(ts));
// V13.149 `extraDays`: days kept by a 연속 학습 보호권 or 되살리기 ('YYYY-MM-DD', streak-guard.js guardDayKeys).
export function growthFor(sessions, extraDays = []) {
  const points = sessions.reduce((n, s) => n + (s.xp || 0), 0);
  // answered_count is absent on older records; only an explicit 0 is skipped.
  const days = new Set([...sessions.filter(s => s.total > 0 && s.answered_count !== 0).map(s => dayKey(s.created_at)), ...extraDays]);
  let streak = 0, day = Date.now();
  if (!days.has(dayKey(day))) day -= 86400000;
  while (days.has(dayKey(day))) { streak++; day -= 86400000; }
  return { ...levelInfo(points, PLAYER_MAX_LEVEL), points, streak, best_combo: Math.max(0, ...sessions.map(s => s.best_combo || 0)) };
}
