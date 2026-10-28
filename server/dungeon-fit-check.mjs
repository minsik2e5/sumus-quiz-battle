// V13.185 던전 긴 글자 맞춤 검사(문자열 · 데이터 검사. 브라우저는 쓰지 않는다).
// 가장 긴 영어 단어 · 구문 · 한국어 뜻이 세 문제 유형(뜻 고르기 · 영어 고르기 · 영어 쓰기) 어디서나 글자 수 규칙 클래스를 받고,
// 그 클래스에 자르기(…) 없이 줄을 바꾸는 CSS가 있는지 본다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allBooks } from './service.mjs';
import { displayEnglish } from '../public/modules/core.js';
import { textUnits, promptFit, optionFit } from '../public/modules/dungeon-fit.js';
const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export function runDungeonFitChecks(assert) {
  const words = allBooks({ extraBooks: [] }).flatMap(book => book.words || []);
  const longest = (list, pick) => list.map(pick).filter(Boolean).sort((a, b) => textUnits(b) - textUnits(a))[0];
  const en = longest(words, w => displayEnglish(w.word)), ko = longest(words, w => String(w.meaning ?? '').trim());
  assert(en.length >= 25 && ko.length >= 30, `V13.185 데이터에서 가장 긴 영어(${en.length}자) · 한국어 뜻(${ko.length}자)을 찾았다`);

  // 글자 수 규칙: 짧은 단어는 원래 크기(0), 길수록 단계가 올라가고, 아주 길어도 마지막 단계에서 멈춘다.
  assert(promptFit('opponent', 'mean') === 0 && promptFit('반대자', 'eng') === 0 && promptFit('반대자', 'spell') === 0, 'V13.185 짧은 문제는 원래 크기 그대로');
  for (const kind of ['mean', 'eng', 'spell']) {
    const text = kind === 'mean' ? en : ko;
    assert(promptFit(text, kind) >= 3 && promptFit(text, kind) <= 4, `V13.185 가장 긴 문제 글(${kind})은 줄을 바꾸는 단계(fp3 · fp4)가 붙는다`);
    const steps = [1, 4, 8, 16, 40, 400].map(n => promptFit('가'.repeat(n), kind));
    assert(steps.every((v, i) => i === 0 || v >= steps[i - 1]) && steps.at(-1) === 4, `V13.185 문제 글이 길어질수록 단계가 올라가고 4에서 멈춘다(${kind})`);
  }
  const meanOptions = words.map(w => String(w.meaning ?? '').trim()).filter(Boolean).sort((a, b) => textUnits(b) - textUnits(a)).slice(0, 6);
  const engOptions = words.map(w => displayEnglish(w.word)).filter(Boolean).sort((a, b) => textUnits(b) - textUnits(a)).slice(0, 6);
  for (const n of [4, 5, 6]) {
    assert(optionFit(meanOptions.slice(0, n), 'mean', n) === 2 && optionFit(engOptions.slice(0, n), 'eng', n) === 2, `V13.185 보기 ${n}개가 모두 긴 경우(뜻 · 영어)는 두 칸 · 여러 줄 단계(ft2)`);
    assert(optionFit(['반대자', '실험', '주장하다', '현대의', '원인', '감소'].slice(0, n), 'mean', n) === 0 && optionFit(['cause', 'argue', 'modern', 'medicine', 'decline', 'advance'].slice(0, n), 'eng', n) <= 1, `V13.185 짧은 보기 ${n}개는 한 줄(ft0)`);
  }
  assert(optionFit(['예측 불가능성', '실험적인 방법', '사망률이 높음', '의학의, 의료의', '~에 기여하다'], 'mean', 5) === 1, 'V13.185 보기가 조금 길면 두 칸 · 두 줄(ft1)');

  // 던전 화면이 단계 클래스를 실제로 붙인다(세 유형 모두 문제 글은 같은 자리, 쓰기는 문제 글만 단계를 받는다).
  const js = source('../public/modules/dungeon.js');
  assert(js.includes("from './dungeon-fit.js'") && /dgs-prompt \$\{kind === 'mean' \? 'en' : 'ko'\} fp\$\{promptFit\(q\.prompt, kind\)\}/.test(js), 'V13.185 문제 글에 fp 단계 클래스를 붙인다(뜻 고르기 · 영어 고르기 · 영어 쓰기)');
  assert(/dgs-options n\$\{n\} ft\$\{optionFit\(q\.options, kind, n\)\}/.test(js), 'V13.185 보기 칸에 ft 단계 클래스를 붙인다');

  // CSS: 자르기(…) · 가로 스크롤 없음, 줄 바꿈 · 줄어들 수 있는 칸, 줄 수 제한 없음, 글씨 크기는 읽을 수 있는 아래한도.
  const css = source('../public/v13185.css'), build = source('./build-assets.mjs');
  const rule = selector => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))?.[1] || '';
  const prompt = rule('.dgs-prompt'), optSpan = rule('.dgs-opt span');
  assert(/white-space:\s*normal/.test(prompt) && /overflow-wrap:\s*anywhere/.test(prompt) && /text-overflow:\s*clip/.test(prompt) && /min-width:\s*0/.test(prompt), 'V13.185 문제 글: 공백에서 줄을 바꾸고(white-space normal) · 아주 긴 한 덩어리도 꺾이고(overflow-wrap anywhere) · …로 자르지 않는다');
  assert(/white-space:\s*normal/.test(optSpan) && /overflow-wrap:\s*anywhere/.test(optSpan) && /text-overflow:\s*clip/.test(optSpan), 'V13.185 보기 글: 줄을 바꾸고 · 꺾이고 · …로 자르지 않는다');
  assert(/minmax\(0,\s*1fr\)/.test(css) && /\.dgs\.land \.dgs-hud \{[^}]*height:\s*auto/.test(css), 'V13.185 보기 칸은 줄어들 수 있고(minmax(0,1fr)) · 아래 칸(HUD)은 글자 높이만큼 위로 자란다');
  assert(!/line-clamp|text-overflow:\s*ellipsis|overflow-x:\s*(auto|scroll)|overflow:\s*(auto|scroll)/.test(css), 'V13.185 줄 수 제한 · … · 가로 스크롤을 쓰지 않는다');
  const sizes = [...css.matchAll(/\.dgs\.land \.dgs-prompt\.fp\d\.(?:en|ko) \{ font-size: ([\d.]+)px/g)].map(m => Number(m[1]));
  const optSizes = [...css.matchAll(/\.dgs\.land \.dgs-options\.ft\d[^{]*\{ font-size: ([\d.]+)px/g)].map(m => Number(m[1]));
  assert(sizes.length === 8 && Math.min(...sizes) >= 16 && optSizes.length === 4 && Math.min(...optSizes) >= 13, 'V13.185 글씨는 문제 16px · 보기 13px보다 작아지지 않는다');
  assert(/\.dgs\.land \.dgs-world \{ top: calc\(var\(--rise, 0px\) \* -1\)/.test(css) && /SCENE_RISE_MAX = 40/.test(js) && /setProperty\('--rise'/.test(js) && /D\.growKey !== D\.qn\) \{ D\.growKey = D\.qn; sceneRise\(\)/.test(js), 'V13.185 아래 칸이 자란 만큼(최대 40px) 장면을 위로 올려 펫 · 몬스터가 가리지 않고, 문제가 바뀔 때만 한 번 잰다');
  assert(build.includes('"v13185.css",\n  "v13184.css"') && build.includes('"v13184.css",\n  "v13178.css"'), 'V13.185 던전 글자 맞춤 CSS는 번들에 들어가고, 민트 목록 CSS가 맨 끝');
}
