const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );

const document = ({ title, body, pageClass = "" }) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="#153a33">
    <title>${escapeHtml(title)}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="${escapeHtml(pageClass)}">
    ${body}
  </body>
</html>`;

export function loginPage({ csrfToken = "", error = "", username = "", showDemoAccount = true } = {}) {
  const message = error
    ? `<div class="alert" role="alert"><span aria-hidden="true">!</span><p>${escapeHtml(error)}</p></div>`
    : "";

  return document({
    title: "로그인 | 다온 ERP",
    pageClass: "login-page",
    body: `
      <main class="login-shell">
        <section class="brand-panel" aria-labelledby="brand-title">
          <a class="brand" href="/login" aria-label="다온 ERP 로그인">
            <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>DAON <b>ERP</b></span>
          </a>
          <div class="brand-copy">
            <p class="eyebrow">Work, in one flow</p>
            <h1 id="brand-title">회사의 모든 흐름을<br>한곳에서.</h1>
            <p>복잡한 업무는 단순하게,<br>중요한 숫자는 더 선명하게 관리하세요.</p>
          </div>
          <div class="brand-art" aria-hidden="true">
            <span class="orbit orbit-one"></span>
            <span class="orbit orbit-two"></span>
            <span class="glow-dot dot-one"></span>
            <span class="glow-dot dot-two"></span>
          </div>
          <p class="brand-foot">© 2026 Daon Company. All rights reserved.</p>
        </section>

        <section class="form-panel">
          <div class="form-wrap">
            <div class="mobile-brand" aria-hidden="true">
              <span class="brand-mark"><i></i><i></i><i></i></span>
              <span>DAON <b>ERP</b></span>
            </div>
            <p class="form-kicker">DAON WORKSPACE</p>
            <h2>다시 만나 반갑습니다</h2>
            <p class="form-intro">업무를 계속하려면 계정에 로그인하세요.</p>

            ${message}

            <form action="/login" method="post" class="login-form">
              <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
              <label for="username">아이디</label>
              <div class="field">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"/></svg>
                <input id="username" name="username" type="text" value="${escapeHtml(username)}" placeholder="아이디를 입력하세요" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="80" required autofocus>
              </div>

              <div class="label-row">
                <label for="password">비밀번호</label>
                <span>안전한 접속</span>
              </div>
              <div class="field">
                <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                <input id="password" name="password" type="password" placeholder="비밀번호를 입력하세요" autocomplete="current-password" maxlength="200" required>
              </div>

              <button type="submit">로그인 <span aria-hidden="true">→</span></button>
            </form>

            ${showDemoAccount ? `<aside class="demo-account" aria-label="체험 계정 안내">
              <span>DEMO</span>
              <p><strong>체험 계정</strong><br><code>admin</code> / <code>ChangeMe123!</code></p>
            </aside>` : ""}
            <p class="help-text">로그인에 문제가 있나요? <a href="mailto:help@daon.example">관리자에게 문의</a></p>
          </div>
        </section>
      </main>`,
  });
}

export function appPage({ user, csrfToken }) {
  return document({
    title: "홈 | 다온 ERP",
    pageClass: "app-page",
    body: `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand sidebar-brand" href="/app" aria-label="다온 ERP 홈">
            <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>DAON <b>ERP</b></span>
          </a>
          <nav aria-label="주 메뉴">
            <p>WORKSPACE</p>
            <a class="active" href="/app"><span aria-hidden="true">⌂</span> 홈</a>
            <a href="#" aria-disabled="true"><span aria-hidden="true">▦</span> 매출 · 매입 <em>준비 중</em></a>
            <a href="#" aria-disabled="true"><span aria-hidden="true">▤</span> 재고 관리 <em>준비 중</em></a>
            <a href="#" aria-disabled="true"><span aria-hidden="true">♙</span> 인사 · 급여 <em>준비 중</em></a>
          </nav>
          <div class="sidebar-user">
            <span class="avatar">${escapeHtml(user.displayName.slice(0, 1))}</span>
            <div><strong>${escapeHtml(user.displayName)}</strong><small>${escapeHtml(user.role)}</small></div>
          </div>
        </aside>

        <main class="workspace">
          <header class="topbar">
            <div><span class="status-dot"></span> 시스템 정상</div>
            <form action="/logout" method="post">
              <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
              <button type="submit">로그아웃</button>
            </form>
          </header>
          <section class="workspace-content">
            <p class="form-kicker">TODAY'S WORKSPACE</p>
            <h1>${escapeHtml(user.displayName)}님, 안녕하세요.</h1>
            <p class="workspace-intro">다온 ERP에 안전하게 로그인했습니다.</p>

            <div class="welcome-card">
              <div>
                <span class="card-label">첫 번째 설정</span>
                <h2>회사 업무를 시작할 준비가 됐어요.</h2>
                <p>다음 단계에서 매출·매입, 재고, 인사 기능을 하나씩 연결할 수 있습니다.</p>
              </div>
              <div class="check-seal" aria-hidden="true">✓</div>
            </div>

            <div class="summary-grid" aria-label="업무 요약">
              <article><span>오늘 매출</span><strong>—</strong><small>데이터 연결 전</small></article>
              <article><span>처리할 주문</span><strong>—</strong><small>데이터 연결 전</small></article>
              <article><span>재고 알림</span><strong>—</strong><small>데이터 연결 전</small></article>
            </div>
          </section>
        </main>
      </div>`,
  });
}

export { escapeHtml };
