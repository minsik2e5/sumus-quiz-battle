// V13.87 내부 정보 quiz: five questions per share of the 문법 증권거래소. A right answer earns a
// hint on that share's next move (server/market.mjs marketHint). Kept on the server only, so the
// answers never reach a browser; the app gets the question and the choices.
//   q  the question (a blank is ___)   c  four choices   a  the right one (0-3)   why  the reason
export const MARKET_QUIZ = {
  POS8: [
    { q: 'She runs very fast.에서 fast의 품사는?', c: ['명사', '형용사', '부사', '동사'], a: 2, why: 'fast가 동사 runs를 꾸미므로 부사예요. a fast car에서는 형용사예요.' },
    { q: '다음 중 전치사는?', c: ['quickly', 'under', 'happy', 'run'], a: 1, why: 'under(~아래에)는 명사 앞에 와서 위치를 나타내는 전치사예요.' },
    { q: 'Wow! That is amazing.에서 Wow의 품사는?', c: ['감탄사', '부사', '대명사', '접속사'], a: 0, why: '놀람·기쁨 같은 감정을 나타내는 말은 감탄사예요.' },
    { q: 'They are my friends.에서 They의 품사는?', c: ['명사', '대명사', '형용사', '전치사'], a: 1, why: 'They는 사람이나 사물을 대신 가리키는 대명사예요.' },
    { q: '형용사가 하는 일은?', c: ['동사를 꾸민다', '명사를 꾸민다', '문장을 잇는다', '감정을 외친다'], a: 1, why: '형용사는 명사를 꾸미거나(a tall boy) 보어로 설명해요(He is tall).' }
  ],
  REL: [
    { q: 'I have a friend ___ lives in Busan.', c: ['who', 'which', 'what', 'where'], a: 0, why: '선행사가 사람(a friend)이고 뒤에 주어가 빠졌으니 who예요.' },
    { q: 'This is the book ___ I bought yesterday.', c: ['who', 'which', 'what', 'whose'], a: 1, why: '선행사가 사물(the book)이고 뒤에 목적어가 빠졌으니 which(또는 that)예요.' },
    { q: '___ he said was true.', c: ['That', 'Which', 'What', 'Who'], a: 2, why: '앞에 꾸밀 명사(선행사)가 없고 "~하는 것"이라는 뜻이니 what이에요.' },
    { q: 'I met a girl ___ father is a doctor.', c: ['who', 'whose', 'whom', 'which'], a: 1, why: '"그 소녀의 아버지"처럼 소유 관계이니 whose예요.' },
    { q: '관계대명사 뒤에 오는 문장은?', c: ['완전한 문장', '주어나 목적어가 빠진 문장', '동사가 없는 문장', '항상 의문문'], a: 1, why: '관계대명사가 주어나 목적어 역할을 하므로 뒤 문장에는 그 자리가 비어 있어요.' }
  ],
  RADV: [
    { q: 'This is the town ___ I was born.', c: ['which', 'where', 'when', 'what'], a: 1, why: '장소(the town)이고 뒤 문장이 완전하니 관계부사 where예요.' },
    { q: 'I remember the day ___ we first met.', c: ['where', 'why', 'when', 'which'], a: 2, why: '시간(the day)을 꾸미고 뒤 문장이 완전하니 when이에요.' },
    { q: 'Tell me the reason ___ you were late.', c: ['why', 'how', 'where', 'what'], a: 0, why: '이유(the reason)를 꾸미니 why예요.' },
    { q: '다음 중 틀린 표현은?', c: ['the way I study', 'how I study', 'the way how I study', 'the way that I study'], a: 2, why: 'the way와 how는 함께 쓰지 않아요. 둘 중 하나만 써요.' },
    { q: 'where를 바꿔 쓸 수 있는 것은? (This is the house where I live.)', c: ['in which', 'which', 'what', 'that which'], a: 0, why: '관계부사 = 전치사 + 관계대명사. live in the house → in which예요.' }
  ],
  PART: [
    { q: 'The movie was very ___.', c: ['bored', 'boring', 'bore', 'to bore'], a: 1, why: '영화가 지루함을 "주는" 쪽이니 -ing(boring)예요.' },
    { q: 'I was ___ at the news.', c: ['surprising', 'surprised', 'surprise', 'to surprise'], a: 1, why: '내가 놀람을 "느끼는" 쪽이니 p.p.(surprised)예요.' },
    { q: 'Look at the ___ baby.', c: ['sleep', 'slept', 'sleeping', 'to sleep'], a: 2, why: '아기가 "자고 있는" 능동·진행이니 -ing예요.' },
    { q: 'I found a ___ window.', c: ['breaking', 'broken', 'break', 'broke'], a: 1, why: '창문은 "깨진" 쪽(수동·완료)이니 p.p.(broken)예요.' },
    { q: 'The man ___ a red hat is my uncle.', c: ['wear', 'wore', 'wearing', 'worn'], a: 2, why: '남자가 모자를 "쓰고 있는" 능동이니 wearing이에요.' }
  ],
  GER: [
    { q: 'I enjoy ___ soccer.', c: ['play', 'to play', 'playing', 'played'], a: 2, why: 'enjoy 뒤에는 동명사(-ing)가 와요.' },
    { q: 'He finished ___ his homework.', c: ['doing', 'to do', 'do', 'did'], a: 0, why: 'finish 뒤에는 동명사(-ing)가 와요.' },
    { q: 'She is good at ___.', c: ['swim', 'to swim', 'swimming', 'swam'], a: 2, why: '전치사(at) 뒤에는 동명사가 와요.' },
    { q: 'Would you mind ___ the door?', c: ['open', 'to open', 'opening', 'opened'], a: 2, why: 'mind 뒤에는 동명사가 와요.' },
    { q: '___ English is fun.', c: ['Learn', 'Learning', 'Learned', 'Learns'], a: 1, why: '동명사는 명사처럼 주어 자리에 올 수 있어요.' }
  ],
  INF: [
    { q: 'I want ___ a doctor.', c: ['be', 'being', 'to be', 'been'], a: 2, why: 'want 뒤에는 to부정사가 와요.' },
    { q: 'She decided ___ abroad.', c: ['study', 'studying', 'to study', 'studied'], a: 2, why: 'decide 뒤에는 to부정사가 와요.' },
    { q: 'I have something ___ you.', c: ['tell', 'telling', 'to tell', 'told'], a: 2, why: 'to부정사가 앞의 something을 꾸며요(형용사적 용법).' },
    { q: 'He stopped ___ to his friend. (친구에게 말을 걸려고 멈췄다)', c: ['talking', 'to talk', 'talk', 'talked'], a: 1, why: 'stop to ~는 "~하려고 멈추다", stop -ing는 "~을 그만두다"예요.' },
    { q: 'I went to the library ___ books.', c: ['borrow', 'to borrow', 'borrowing', 'borrowed'], a: 1, why: '"~하기 위해"라는 목적은 to부정사(부사적 용법)예요.' }
  ],
  SUBJ: [
    { q: 'If I ___ rich, I would buy a car.', c: ['am', 'was being', 'were', 'will be'], a: 2, why: '현재 사실의 반대는 If + 과거. be동사는 주어와 상관없이 were를 써요.' },
    { q: 'If I had time, I ___ you.', c: ['will help', 'would help', 'help', 'helped'], a: 1, why: '가정법 과거의 주절은 would/could + 동사원형이에요.' },
    { q: 'I wish I ___ fly.', c: ['can', 'could', 'will', 'am'], a: 1, why: 'I wish + 과거(could)는 지금 이룰 수 없는 소망이에요.' },
    { q: 'If it ___ tomorrow, we will stay home. (내일 비가 오면)', c: ['rains', 'rained', 'will rain', 'were rain'], a: 0, why: '일어날 수 있는 일(조건)이라 현재형 rains를 써요. 가정법이 아니에요.' },
    { q: 'If I were you, I ___ that.', c: ['don\'t do', 'won\'t do', 'wouldn\'t do', 'didn\'t do'], a: 2, why: '가정법 과거의 주절은 would + 동사원형이에요.' }
  ],
  PASS: [
    { q: 'The window ___ by Tom.', c: ['broke', 'was broken', 'was breaking', 'has break'], a: 1, why: '창문이 "깨진" 쪽이니 be + p.p.(was broken)예요.' },
    { q: 'English ___ in many countries.', c: ['speaks', 'is spoken', 'is speaking', 'spoke'], a: 1, why: '영어가 "말해지는" 쪽이니 수동태(is spoken)예요.' },
    { q: '수동태로 바꿀 수 없는 동사는?', c: ['make', 'write', 'happen', 'build'], a: 2, why: 'happen처럼 목적어가 없는 동사는 수동태로 쓸 수 없어요.' },
    { q: 'This song ___ by many people.', c: ['loves', 'is loved', 'is loving', 'loving'], a: 1, why: '노래가 "사랑받는" 쪽이니 is loved예요.' },
    { q: 'The cake was made ___ my mom.', c: ['by', 'of', 'to', 'with'], a: 0, why: '수동태에서 행위자는 by로 나타내요.' }
  ],
  PERF: [
    { q: 'I ___ here for three years.', c: ['live', 'lived', 'have lived', 'am living'], a: 2, why: '과거부터 지금까지 계속(for three years)이니 현재완료예요.' },
    { q: '다음 중 현재완료와 함께 쓸 수 없는 것은?', c: ['since 2020', 'for a week', 'yesterday', 'already'], a: 2, why: 'yesterday 같은 분명한 과거 표현은 현재완료와 함께 못 써요.' },
    { q: 'Have you ever ___ to Jeju?', c: ['go', 'went', 'been', 'going'], a: 2, why: '"가 본 적 있니?"라는 경험은 have been to예요.' },
    { q: 'She ___ just finished her homework.', c: ['has', 'have', 'is', 'did'], a: 0, why: '주어가 She이니 has + p.p.예요.' },
    { q: 'I have known him ___ 2019.', c: ['for', 'since', 'ago', 'during'], a: 1, why: '시작한 시점(2019) 앞에는 since를 써요. 기간 앞에는 for예요.' }
  ],
  CONJ: [
    { q: 'I stayed home ___ it rained.', c: ['because', 'because of', 'but', 'or'], a: 0, why: '뒤에 문장(it rained)이 오니 because예요. because of 뒤에는 명사구가 와요.' },
    { q: '___ he was tired, he kept working.', c: ['Because', 'Although', 'So', 'And'], a: 1, why: '"피곤했지만 계속 일했다"처럼 반대 내용이니 although예요.' },
    { q: 'Hurry up, ___ you will be late.', c: ['and', 'or', 'so', 'because'], a: 1, why: '명령문 + or는 "그렇지 않으면"이에요.' },
    { q: 'I was hungry, ___ I ate a sandwich.', c: ['so', 'but', 'or', 'although'], a: 0, why: '배고팠고 그래서 먹었다는 결과니 so예요.' },
    { q: 'I listen to music ___ I study.', c: ['while', 'because of', 'during', 'or'], a: 0, why: '"~하는 동안"이고 뒤에 문장이 오니 while이에요. during 뒤에는 명사가 와요.' }
  ]
};
