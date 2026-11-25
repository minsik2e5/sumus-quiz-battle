// V13.243.1 모의고사 단어장 정리 검사: 단어장 PDF를 옮길 때 생긴 흔적(쪽 번호 "      1", 다음 줄로 넘어간 뜻이
// 다른 단어 칸에 붙은 것, 끝에 남은 쉼표)이 다시 들어오지 않게 한다.
import { seonbuExternalFinalBook } from './seonbu-external-final.mjs';
import { seonbu44Correction } from './seonbu44-correction.mjs';
import { gangseoSepMockBook } from './gangseo-sep-mock.mjs';
import { danwonSepMockBook } from './danwon-sep-mock.mjs';
import { danwon2SepMockBook } from './danwon2-sep-mock.mjs';

export function runMockBookCleanChecks(assert) {
  const books = [seonbuExternalFinalBook, seonbu44Correction, gangseoSepMockBook, danwonSepMockBook, danwon2SepMockBook];
  for (const book of books) {
    for (const w of book.words) {
      const word = String(w.word), meaning = String(w.meaning);
      assert(word === word.trim() && meaning === meaning.trim() && !/\s{2,}/.test(word) && !/\s{2,}/.test(meaning),
        `V13.243.1 모의고사 단어장 ${w.id}: 앞뒤 공백 · 겹친 공백 없음`);
      assert(!/\s\d+$/.test(meaning), `V13.243.1 모의고사 단어장 ${w.id}: 뜻 끝에 쪽 번호가 붙지 않음`);
      assert(!/[,;]$/.test(meaning), `V13.243.1 모의고사 단어장 ${w.id}: 뜻이 쉼표 · 쌍반점으로 끝나지 않음(다음 줄 뜻이 빠진 흔적)`);
      // 영어 칸의 한글은 '+완전한 절' · '+to부정사' 같은 문형 표시 뒤에서만 쓴다.
      assert(!/[가-힣]/.test(word.replace(/\+.*$/, '')), `V13.243.1 모의고사 단어장 ${w.id}: 영어 칸에 뜻이 붙지 않음`);
    }
  }
  const byId = Object.fromEntries(seonbuExternalFinalBook.words.map(w => [w.id, w]));
  assert(byId.sb_final_52_24.word === 'take ~ into consideration' && byId.sb_final_52_24.meaning === '~을 고려하다',
    'V13.243.1 선부고 52번 take ~ into consideration = ~을 고려하다(산만하게 하다는 distract 뜻)');
  assert(byId.sb_final_52_09.word === 'distract' && byId.sb_final_52_09.meaning === '~을 흐트러뜨리다, ~을 산만하게 하다',
    'V13.243.1 선부고 52번 distract 뜻이 두 줄 모두 들어감');
  assert(seonbuExternalFinalBook.words.length === 461, 'V13.243.1 선부고 외부지문 45~60 단어 수는 그대로 461개');
}
