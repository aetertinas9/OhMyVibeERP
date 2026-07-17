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

const navigation = ({ active }) => `
  <nav aria-label="주 메뉴">
    <p>WORKSPACE</p>
    <a class="${active === "home" ? "active" : ""}" href="/app"><span aria-hidden="true">⌂</span> 홈</a>
    <p class="nav-section">기준 정보</p>
    <a class="${active === "sales" ? "active" : ""}" href="/partners/sales"><span aria-hidden="true">↗</span> 판매처</a>
    <a class="${active === "purchases" ? "active" : ""}" href="/partners/purchases"><span aria-hidden="true">↙</span> 구매처</a>
    <a href="#" aria-disabled="true"><span aria-hidden="true">◇</span> 품목 <em>준비 중</em></a>
    <p class="nav-section">업무 관리</p>
    <a href="#" aria-disabled="true"><span aria-hidden="true">▦</span> 매출 · 매입 <em>준비 중</em></a>
    <a href="#" aria-disabled="true"><span aria-hidden="true">♙</span> 인사 · 급여 <em>준비 중</em></a>
  </nav>`;

function workspacePage({ title, active, user, csrfToken, content }) {
  return document({
    title: `${title} | 다온 ERP`,
    pageClass: "app-page",
    body: `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand sidebar-brand" href="/app" aria-label="다온 ERP 홈">
            <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>DAON <b>ERP</b></span>
          </a>
          ${navigation({ active })}
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
          ${content}
        </main>
      </div>`,
  });
}

export function appPage({ user, csrfToken }) {
  return workspacePage({
    title: "홈",
    active: "home",
    user,
    csrfToken,
    content: `<section class="workspace-content">
            <p class="form-kicker">TODAY'S WORKSPACE</p>
            <h1>${escapeHtml(user.displayName)}님, 안녕하세요.</h1>
            <p class="workspace-intro">다온 ERP에 안전하게 로그인했습니다.</p>

            <div class="welcome-card">
              <div>
                <span class="card-label">첫 번째 설정</span>
                <h2>회사 업무를 시작할 준비가 됐어요.</h2>
                <p>판매처와 구매처를 구분해 회사의 거래 기준 정보를 등록할 수 있습니다.</p>
              </div>
              <div class="check-seal" aria-hidden="true">✓</div>
            </div>

            <div class="summary-grid" aria-label="업무 요약">
              <article><span>오늘 매출</span><strong>—</strong><small>데이터 연결 전</small></article>
              <article><span>처리할 주문</span><strong>—</strong><small>데이터 연결 전</small></article>
              <article><span>재고 알림</span><strong>—</strong><small>데이터 연결 전</small></article>
            </div>
          </section>`,
  });
}

const fieldError = (field, errors) => errors[field]
  ? `<small class="field-error" id="${field}-error">${escapeHtml(errors[field])}</small>`
  : "";

const inputState = (field, errors) => errors[field]
  ? ` aria-invalid="true" aria-describedby="${field}-error"`
  : "";

function formatBusinessNumber(value) {
  return value?.length === 10 ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}` : value || "—";
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function partnerPage({
  type,
  user,
  csrfToken,
  partners,
  values = {},
  fieldErrors = {},
  error = "",
  created = false,
}) {
  const isSales = type === "sales";
  const label = isSales ? "판매처" : "구매처";
  const description = isSales ? "우리 회사가 상품과 서비스를 판매하는 곳" : "우리 회사가 상품과 원재료를 구매하는 곳";
  const rows = partners.length
    ? partners.map((partner) => `
      <tr>
        <td><strong class="record-code">${escapeHtml(partner.code)}</strong></td>
        <td><strong>${escapeHtml(partner.name)}</strong><small>${escapeHtml(partner.representative || "대표자 미등록")}</small></td>
        <td>${escapeHtml(formatBusinessNumber(partner.businessNumber))}</td>
        <td>${escapeHtml(partner.contactName || partner.phone || "—")}</td>
        <td>${escapeHtml(formatDate(partner.createdAt))}</td>
      </tr>`).join("")
    : `<tr><td colspan="5"><div class="empty-state"><span aria-hidden="true">＋</span><strong>등록된 ${label}가 없습니다.</strong><p>왼쪽 양식에서 첫 ${label}를 등록해 보세요.</p></div></td></tr>`;

  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">${label} 등록을 완료했습니다.</div>`
      : "";

  return workspacePage({
    title: `${label} 관리`,
    active: type,
    user,
    csrfToken,
    content: `<section class="master-content">
      <header class="master-heading">
        <div>
          <p class="form-kicker">BUSINESS PARTNERS</p>
          <h1>${label} 관리</h1>
          <p>${description}을(를) 별도로 관리합니다.</p>
        </div>
        <div class="partner-tabs" aria-label="거래처 구분">
          <a href="/partners/sales"${isSales ? ' aria-current="page"' : ""}>판매처</a>
          <a href="/partners/purchases"${!isSales ? ' aria-current="page"' : ""}>구매처</a>
        </div>
      </header>

      ${notice}

      <div class="master-grid">
        <section class="master-form-card" aria-labelledby="partner-form-title">
          <div class="card-heading"><span>01</span><div><h2 id="partner-form-title">${label} 등록</h2><p><b>*</b> 표시는 필수 입력입니다.</p></div></div>
          <form action="/partners/${type}" method="post" class="master-form">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <div class="form-row two-columns">
              <label>거래처 코드 <b>*</b>
                <input name="code" value="${escapeHtml(values.code)}" placeholder="예: ${isSales ? "S-001" : "P-001"}" maxlength="30" required${inputState("code", fieldErrors)}>
                ${fieldError("code", fieldErrors)}
              </label>
              <label>사업자등록번호
                <input name="businessNumber" value="${escapeHtml(values.businessNumber)}" placeholder="000-00-00000" inputmode="numeric" maxlength="12"${inputState("businessNumber", fieldErrors)}>
                ${fieldError("businessNumber", fieldErrors)}
              </label>
            </div>
            <label>거래처명 <b>*</b>
              <input name="name" value="${escapeHtml(values.name)}" placeholder="회사 또는 사업체 이름" maxlength="100" required${inputState("name", fieldErrors)}>
              ${fieldError("name", fieldErrors)}
            </label>
            <div class="form-row two-columns">
              <label>대표자
                <input name="representative" value="${escapeHtml(values.representative)}" placeholder="대표자명" maxlength="60">
              </label>
              <label>담당자
                <input name="contactName" value="${escapeHtml(values.contactName)}" placeholder="업무 담당자명" maxlength="60">
              </label>
            </div>
            <div class="form-row two-columns">
              <label>연락처
                <input name="phone" value="${escapeHtml(values.phone)}" placeholder="02-0000-0000" maxlength="30">
              </label>
              <label>이메일
                <input name="email" type="email" value="${escapeHtml(values.email)}" placeholder="partner@example.com" maxlength="120"${inputState("email", fieldErrors)}>
                ${fieldError("email", fieldErrors)}
              </label>
            </div>
            <label>주소
              <input name="address" value="${escapeHtml(values.address)}" placeholder="사업장 주소" maxlength="200">
            </label>
            <label>메모
              <textarea name="note" placeholder="거래 조건 등 참고할 내용을 입력하세요" maxlength="500">${escapeHtml(values.note)}</textarea>
            </label>
            <button type="submit" class="primary-action">${label} 등록 <span aria-hidden="true">→</span></button>
          </form>
        </section>

        <section class="master-list-card" aria-labelledby="partner-list-title">
          <div class="list-heading"><div><p>REGISTERED</p><h2 id="partner-list-title">${label} 목록</h2></div><strong>${partners.length}<small>곳</small></strong></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>코드</th><th>거래처명</th><th>사업자번호</th><th>담당/연락처</th><th>등록일</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
      </div>
    </section>`,
  });
}

export { escapeHtml };
