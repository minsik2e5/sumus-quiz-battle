// V13.247 학교마다 고를 수 있는 반 (서버 · 화면이 같이 쓴다).
// - 부마다 기본 반: 중등부 중2 · 중3, 고등부 고1A · 고1B.
// - 학교마다 따로 정한 반: 단원고2(고2 학교)는 고2 한 반. 다른 학교의 반 목록은 그대로다.
// 단어장은 school_id로 학교마다 갈리므로 책 규칙은 바꾸지 않는다.
export const DIVISION_CLASSES = { middle: ['중2', '중3'], high: ['고1A', '고1B'] };
export const SCHOOL_CLASSES = { 'danwon-high-2': ['고2'] };

const gradeOfClass = value => String(value || '').match(/^(중[1-3]|고[1-3])/)?.[1] || String(value || '');
const schoolIdOf = school => typeof school === 'string' ? school : school?.id || '';

// 학교 하나의 반 목록. division을 따로 주면(학교 객체에 division이 없을 때) 그것을 쓴다.
export function schoolClasses(school, division = school?.division) {
  return [...(SCHOOL_CLASSES[schoolIdOf(school)] || DIVISION_CLASSES[division] || [])];
}
export const schoolClassAllowed = (school, className, division = school?.division) => schoolClasses(school, division).includes(className);
// 학년 묶음(교실 게임 · 대회 대상): 중2 · 중3, 고1(단원고2는 고2).
export const schoolGrades = (school, division = school?.division) => [...new Set(schoolClasses(school, division).map(gradeOfClass))];
// 교실 게임 · 대회 대상 목록: 반이 둘 이상인 학년은 '고1 전체' + 반, 한 반뿐이면 그 학년 하나.
export const gradeTargets = (school, division = school?.division) => schoolGrades(school, division).flatMap(grade => {
  const classes = schoolClasses(school, division).filter(c => gradeOfClass(c) === grade);
  return classes.length === 1 && classes[0] === grade ? [[grade, grade]] : [[grade, `${grade} 전체`], ...classes.map(c => [c, c])];
});
