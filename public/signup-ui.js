const app = document.querySelector('#app');
const SIGNUP_CATALOG = {
  middle: { label: '중등부', schools: ['원일중'], classes: ['중2', '중3'] },
  high: { label: '고등부', schools: ['단원고', '선부고', '강서고'], classes: ['고1A', '고1B'] }
};

function selectedLoginDivision() {
  return app?.querySelector('[data-division].selected')?.dataset.division === 'middle' ? 'middle' : 'high';
}

function signupSelectOptions(division) {
  const item = SIGNUP_CATALOG[division] || SIGNUP_CATALOG.high;
  const school = document.querySelector('#signup-school');
  const className = document.querySelector('#signup-class');
  if (!school || !className) return;
  school.innerHTML = '<option value="">학교 선택</option>' + item.schools.map(value => `<option value="${value}">${value}</option>`).join('');
  className.innerHTML = '<option value="">반 선택</option>' + item.classes.map(value => `<option value="${value}">${value}</option>`).join('');
  document.querySelector('#signup-division-value').value = division;
  document.querySelectorAll('[data-signup-division]').forEach(button => button.classList.toggle('selected', button.dataset.signupDivision === division));
}

function injectStyles() {
  if (document.querySelector('#signup-style')) return;
  const style = document.createElement('style');
  style.id = 'signup-style';
  style.textContent = `
    .signup-entry{margin-top:14px;text-align:center;font-size:14px;color:#6b7280}
    .signup-entry button{border:0;background:transparent;color:#4f46e5;font:inherit;font-weight:700;cursor:pointer;padding:4px 6px}
    .signup-back{border:0;background:transparent;color:#667085;font:inherit;font-weight:650;cursor:pointer;padding:8px 0;margin-bottom:8px}
    .signup-terms{font-size:12px;line-height:1.55;color:#98a2b3;margin:12px 0 0}
    .signup-form .form-columns{align-items:end}
    @media(max-width:560px){.signup-form .form-columns{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function studentLoginVisible() {
  const student = app?.querySelector('[data-role="student"]');
  return !!student?.classList.contains('selected');
}

function enhanceLogin() {
  injectStyles();
  const form = app?.querySelector('#login-form');
  if (!form || !studentLoginVisible() || form.querySelector('.signup-entry')) return;
  const note = form.querySelector('.auth-note');
  const wrap = document.createElement('div');
  wrap.className = 'signup-entry';
  wrap.innerHTML = `처음인가요? <button type="button" id="open-signup">학생 회원가입</button>`;
  note?.before(wrap);
  wrap.querySelector('#open-signup').onclick = showSignup;
}

function showSignup() {
  injectStyles();
  const initialDivision = selectedLoginDivision();
  app.innerHTML = `<div class="auth">
    <section class="auth-visual">
      <div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div>
      <div><h1>내 계정으로<br>바로 시작해요.</h1><p>회원가입 후 바로 연습할 수 있어요.<br>학교와 반을 정확히 선택해주세요.</p></div>
      <footer>SUMUS ENGLISH ACADEMY</footer>
    </section>
    <form class="auth-form signup-form" id="signup-form">
      <div class="brand"><img src="/icon.svg" alt=""><div>SUMUS <span>VOCA</span></div></div>
      <button class="signup-back" type="button" id="signup-back">← 로그인으로 돌아가기</button>
      <h2>학생 회원가입</h2>
      <p>내가 사용할 아이디와 비밀번호를 직접 만들어요.</p>
      <input type="hidden" name="division" id="signup-division-value" value="${initialDivision}">
      <div class="segment" aria-label="가입 부서">
        <button type="button" data-signup-division="middle" class="${initialDivision === 'middle' ? 'selected' : ''}">중등부</button>
        <button type="button" data-signup-division="high" class="${initialDivision === 'high' ? 'selected' : ''}">고등부</button>
      </div>
      <label class="field"><span>이름</span><input name="display_name" autocomplete="name" required maxlength="40" placeholder="학생 이름"></label>
      <div class="form-columns">
        <label class="field"><span>학교</span><select id="signup-school" name="school" required></select></label>
        <label class="field"><span>반</span><select id="signup-class" name="class_name" required></select></label>
      </div>
      <label class="field"><span>아이디</span><input name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required minlength="3" maxlength="40" pattern="[a-z0-9_.-]{3,40}" placeholder="영문 소문자·숫자 3자 이상"></label>
      <label class="field"><span>비밀번호</span><input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="8자 이상"></label>
      <label class="field"><span>비밀번호 확인</span><input name="password_confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="한 번 더 입력"></label>
      <div class="form-error" id="signup-error" role="alert"></div>
      <button class="btn primary full" type="submit" id="signup-submit">가입하고 시작하기</button>
      <p class="signup-terms">가입하면 본인의 학습 기록과 시험 결과가 SUMUS 선생님에게 표시됩니다.</p>
    </form>
  </div>`;

  document.querySelector('#signup-back').onclick = () => location.reload();
  document.querySelectorAll('[data-signup-division]').forEach(button => {
    button.onclick = () => signupSelectOptions(button.dataset.signupDivision);
  });
  signupSelectOptions(initialDivision);
  document.querySelector('#signup-form').onsubmit = submitSignup;
  window.scrollTo(0, 0);
}

async function request(path, body) {
  const response = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || '잠시 후 다시 시도해주세요.');
  return data;
}

async function submitSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('#signup-submit');
  const error = form.querySelector('#signup-error');
  error.textContent = '';
  const values = Object.fromEntries(new FormData(form));
  if (values.password !== values.password_confirm) {
    error.textContent = '비밀번호가 서로 같지 않아요.';
    return;
  }
  button.disabled = true;
  button.textContent = '계정을 만들고 있어요…';
  try {
    await request('/signup', values);
    button.textContent = '로그인 중…';
    await request('/login', { username: values.username, password: values.password, role: 'student', division: values.division });
    location.reload();
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
    button.textContent = '가입하고 시작하기';
  }
}

const observer = new MutationObserver(enhanceLogin);
observer.observe(app, { childList: true, subtree: true });
enhanceLogin();
