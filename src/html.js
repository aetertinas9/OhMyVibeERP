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
    title: "로그인 | OhMyVibeERP",
    pageClass: "login-page",
    body: `
      <main class="login-shell">
        <section class="brand-panel" aria-labelledby="brand-title">
          <a class="brand" href="/login" aria-label="OhMyVibeERP 로그인">
            <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>OhMyVibe<b>ERP</b></span>
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
          <p class="brand-foot">© 2026 OhMyVibeERP. All rights reserved.</p>
        </section>

        <section class="form-panel">
          <div class="form-wrap">
            <div class="mobile-brand" aria-hidden="true">
              <span class="brand-mark"><i></i><i></i><i></i></span>
              <span>OhMyVibe<b>ERP</b></span>
            </div>
            <p class="form-kicker">OHMYVIBE WORKSPACE</p>
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
            <p class="help-text">로그인에 문제가 있나요? <a href="mailto:help@ohmyvibeerp.example">관리자에게 문의</a></p>
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
    <a class="${active === "items" ? "active" : ""}" href="/items"><span aria-hidden="true">◇</span> 품목</a>
    <p class="nav-section">업무 관리</p>
    <a class="${active === "sales-orders" ? "active" : ""}" href="/sales-orders"><span aria-hidden="true">↗</span> 주문 · 출고</a>
    <a class="${active === "purchase-orders" ? "active" : ""}" href="/purchase-orders"><span aria-hidden="true">▦</span> 발주 관리</a>
    <a class="${active === "production" ? "active" : ""}" href="/production"><span aria-hidden="true">⚙</span> 생산 관리</a>
    <a class="${active === "inventory" ? "active" : ""}" href="/inventory"><span aria-hidden="true">▤</span> 재고 현황</a>
    <p class="nav-section">보고서</p>
    <a class="${active === "monthly-report" ? "active" : ""}" href="/reports/monthly"><span aria-hidden="true">₩</span> 월간 매입·판매</a>
    <p class="nav-section">인사 · 급여</p>
    <a class="${active === "employees" ? "active" : ""}" href="/employees"><span aria-hidden="true">♙</span> 직원 명부</a>
    <a class="${active === "payroll" ? "active" : ""}" href="/payroll"><span aria-hidden="true">₩</span> 급여 관리</a>
  </nav>`;

function workspacePage({ title, active, user, csrfToken, content }) {
  return document({
    title: `${title} | OhMyVibeERP`,
    pageClass: "app-page",
    body: `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand sidebar-brand" href="/app" aria-label="OhMyVibeERP 홈">
            <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>OhMyVibe<b>ERP</b></span>
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
            <p class="workspace-intro">OhMyVibeERP에 안전하게 로그인했습니다.</p>

            <div class="welcome-card">
              <div>
                <span class="card-label">첫 번째 설정</span>
                <h2>회사 업무를 시작할 준비가 됐어요.</h2>
                <p>판매처·구매처와 품목을 등록해 회사의 거래 기준 정보를 준비할 수 있습니다.</p>
              </div>
              <div class="check-seal" aria-hidden="true">✓</div>
            </div>

            <div class="summary-grid" aria-label="업무 요약">
              <article><span>오늘 매출</span><strong>—</strong><small>데이터 연결 전</small></article>
              <article><span>처리할 발주</span><strong>—</strong><small>발주 관리에서 확인</small></article>
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

function formatKoreanDateTime(value) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
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

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatQuantity(value, unit) {
  return `${Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ${unit}`;
}

const taxLabels = {
  taxable: "과세",
  "zero-rated": "영세",
  exempt: "면세",
};

export function itemPage({
  user,
  csrfToken,
  items,
  values = {},
  fieldErrors = {},
  error = "",
  created = false,
}) {
  const rows = items.length
    ? items.map((item) => `
      <tr>
        <td><strong class="record-code">${escapeHtml(item.code)}</strong></td>
        <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || "분류 미등록")}</small></td>
        <td>${escapeHtml(item.unit)}</td>
        <td class="number-cell">${escapeHtml(formatMoney(item.purchasePrice))}</td>
        <td class="number-cell">${escapeHtml(formatMoney(item.salesPrice))}</td>
        <td class="number-cell"><strong>${escapeHtml(formatQuantity(item.openingStock, item.unit))}</strong><small>안전 ${escapeHtml(formatQuantity(item.safetyStock, item.unit))}</small></td>
        <td><span class="tax-badge ${escapeHtml(item.taxType)}">${escapeHtml(taxLabels[item.taxType] ?? item.taxType)}</span></td>
      </tr>`).join("")
    : `<tr><td colspan="7"><div class="empty-state"><span aria-hidden="true">＋</span><strong>등록된 품목이 없습니다.</strong><p>왼쪽 양식에서 첫 품목을 등록해 보세요.</p></div></td></tr>`;

  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">품목 등록을 완료했습니다.</div>`
      : "";
  const selectedTax = values.taxType || "taxable";

  return workspacePage({
    title: "품목 관리",
    active: "items",
    user,
    csrfToken,
    content: `<section class="master-content">
      <header class="master-heading">
        <div>
          <p class="form-kicker">ITEM MASTER</p>
          <h1>품목 관리</h1>
          <p>거래에 사용할 상품·제품·원재료의 기준 정보를 관리합니다.</p>
        </div>
        <span class="heading-count"><b>${items.length}</b>개 품목 등록됨</span>
      </header>

      ${notice}

      <div class="master-grid item-master-grid">
        <section class="master-form-card" aria-labelledby="item-form-title">
          <div class="card-heading"><span>02</span><div><h2 id="item-form-title">품목 등록</h2><p><b>*</b> 표시는 필수 입력입니다.</p></div></div>
          <form action="/items" method="post" class="master-form">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <div class="form-row two-columns">
              <label>품목 코드 <b>*</b>
                <input name="code" value="${escapeHtml(values.code)}" placeholder="예: ITEM-001" maxlength="30" required${inputState("code", fieldErrors)}>
                ${fieldError("code", fieldErrors)}
              </label>
              <label>분류
                <input name="category" value="${escapeHtml(values.category)}" placeholder="예: 완제품, 원재료" maxlength="60">
              </label>
            </div>
            <label>품목명 <b>*</b>
              <input name="name" value="${escapeHtml(values.name)}" placeholder="상품 또는 자재 이름" maxlength="120" required${inputState("name", fieldErrors)}>
              ${fieldError("name", fieldErrors)}
            </label>
            <div class="form-row three-columns">
              <label>단위 <b>*</b>
                <input name="unit" value="${escapeHtml(values.unit)}" placeholder="EA, kg, BOX" maxlength="20" required${inputState("unit", fieldErrors)}>
                ${fieldError("unit", fieldErrors)}
              </label>
              <label>과세 구분 <b>*</b>
                <select name="taxType"${inputState("taxType", fieldErrors)}>
                  <option value="taxable"${selectedTax === "taxable" ? " selected" : ""}>과세</option>
                  <option value="zero-rated"${selectedTax === "zero-rated" ? " selected" : ""}>영세</option>
                  <option value="exempt"${selectedTax === "exempt" ? " selected" : ""}>면세</option>
                </select>
                ${fieldError("taxType", fieldErrors)}
              </label>
              <span class="form-hint">부가세 신고 기준</span>
            </div>
            <div class="form-row two-columns">
              <label>매입 단가
                <span class="money-input"><input name="purchasePrice" type="number" value="${escapeHtml(values.purchasePrice)}" placeholder="0" min="0" max="999999999999" step="1" inputmode="numeric"${inputState("purchasePrice", fieldErrors)}><i>원</i></span>
                ${fieldError("purchasePrice", fieldErrors)}
              </label>
              <label>판매 단가
                <span class="money-input"><input name="salesPrice" type="number" value="${escapeHtml(values.salesPrice)}" placeholder="0" min="0" max="999999999999" step="1" inputmode="numeric"${inputState("salesPrice", fieldErrors)}><i>원</i></span>
                ${fieldError("salesPrice", fieldErrors)}
              </label>
            </div>
            <fieldset class="warehouse-stock-fields">
              <legend>창고별 기초 재고</legend>
              <p>서울·인천·부산 창고의 현재 수량을 각각 입력하세요.</p>
              <div class="form-row three-columns">
                <label><span class="warehouse-label"><i class="seoul"></i>서울 창고</span>
                  <input name="seoulStock" type="number" value="${escapeHtml(values.seoulStock)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState("seoulStock", fieldErrors)}>
                  ${fieldError("seoulStock", fieldErrors)}
                </label>
                <label><span class="warehouse-label"><i class="incheon"></i>인천 창고</span>
                  <input name="incheonStock" type="number" value="${escapeHtml(values.incheonStock)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState("incheonStock", fieldErrors)}>
                  ${fieldError("incheonStock", fieldErrors)}
                </label>
                <label><span class="warehouse-label"><i class="busan"></i>부산 창고</span>
                  <input name="busanStock" type="number" value="${escapeHtml(values.busanStock)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState("busanStock", fieldErrors)}>
                  ${fieldError("busanStock", fieldErrors)}
                </label>
              </div>
            </fieldset>
            <label>안전 재고
              <input name="safetyStock" type="number" value="${escapeHtml(values.safetyStock)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState("safetyStock", fieldErrors)}>
              ${fieldError("safetyStock", fieldErrors)}
            </label>
            <label>메모
              <textarea name="note" placeholder="품목 사양 등 참고할 내용을 입력하세요" maxlength="500">${escapeHtml(values.note)}</textarea>
            </label>
            <button type="submit" class="primary-action">품목 등록 <span aria-hidden="true">→</span></button>
          </form>
        </section>

        <section class="master-list-card" aria-labelledby="item-list-title">
          <div class="list-heading"><div><p>REGISTERED</p><h2 id="item-list-title">품목 목록</h2></div><strong>${items.length}<small>개</small></strong></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>코드</th><th>품목명</th><th>단위</th><th>매입 단가</th><th>판매 단가</th><th>재고</th><th>과세</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
      </div>
    </section>`,
  });
}

export function inventoryPage({ user, csrfToken, items, warehouses }) {
  const warehouseItemCounts = Object.fromEntries(warehouses.map(({ id }) => [
    id,
    items.filter((item) => Number(item.stockByWarehouse[id] || 0) > 0).length,
  ]));
  const warehouseCards = warehouses.map((warehouse, index) => `
    <article class="warehouse-card ${escapeHtml(warehouse.id)}">
      <div class="warehouse-card-top"><span>0${index + 1}</span><i></i></div>
      <p>${escapeHtml(warehouse.code)}</p>
      <h2>${escapeHtml(warehouse.name)}</h2>
      <strong>${escapeHtml(warehouseItemCounts[warehouse.id])}<small> 보관 품목</small></strong>
    </article>`).join("");
  const rows = items.length
    ? items.map((item) => {
      const total = Number(item.openingStock || 0);
      const isLow = Number(item.safetyStock || 0) > 0 && total <= Number(item.safetyStock);
      return `<tr>
        <td><strong class="record-code">${escapeHtml(item.code)}</strong></td>
        <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || "분류 미등록")} · ${escapeHtml(item.unit)}</small></td>
        ${warehouses.map((warehouse) => `<td class="warehouse-quantity ${escapeHtml(warehouse.id)}"><strong>${escapeHtml(formatQuantity(item.stockByWarehouse[warehouse.id], item.unit))}</strong><small>${escapeHtml(warehouse.location)}</small></td>`).join("")}
        <td class="total-quantity"><strong>${escapeHtml(formatQuantity(total, item.unit))}</strong><span class="stock-state ${isLow ? "low" : "normal"}">${isLow ? "안전재고 이하" : "정상"}</span></td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="6"><div class="empty-state"><span aria-hidden="true">◇</span><strong>재고를 확인할 품목이 없습니다.</strong><p>품목 관리에서 창고별 기초 재고를 등록해 주세요.</p></div></td></tr>`;

  return workspacePage({
    title: "재고 현황",
    active: "inventory",
    user,
    csrfToken,
    content: `<section class="inventory-content">
      <header class="inventory-heading">
        <div>
          <p class="form-kicker">WAREHOUSE INVENTORY</p>
          <h1>창고별 재고 현황</h1>
          <p>품목별로 서울·인천·부산 창고에 보관된 수량을 확인합니다.</p>
        </div>
        <div class="inventory-total"><span>등록 품목</span><strong>${escapeHtml(items.length)}<small>개</small></strong></div>
      </header>

      <div class="warehouse-grid">${warehouseCards}</div>

      <section class="inventory-table-card" aria-labelledby="inventory-list-title">
        <div class="list-heading"><div><p>STOCK BY ITEM</p><h2 id="inventory-list-title">품목별 창고 재고</h2></div><strong>${items.length}<small>개 품목</small></strong></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>품목 코드</th><th>품목명</th>${warehouses.map(({ name }) => `<th>${escapeHtml(name)}</th>`).join("")}<th>전체</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    </section>`,
  });
}

const orderStatus = {
  ordered: { label: "발주 완료", className: "ordered" },
  partially_received: { label: "일부 입고", className: "partial" },
  received: { label: "입고 완료", className: "received" },
};

export function purchaseOrdersPage({
  user,
  csrfToken,
  suppliers,
  items,
  warehouses,
  orders,
  values = {},
  fieldErrors = {},
  error = "",
  created = false,
  received = false,
  receiptOrderId = "",
}) {
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const lines = Array.from({ length: 5 }, (_, index) => values.lines?.[index] ?? {});
  const prerequisitesReady = suppliers.length > 0 && items.length > 0;

  const supplierOptions = suppliers.map((supplier) => (
    `<option value="${escapeHtml(supplier.id)}"${values.supplierId === supplier.id ? " selected" : ""}>${escapeHtml(supplier.code)} · ${escapeHtml(supplier.name)}</option>`
  )).join("");
  const itemOptions = (selectedId) => items.map((item) => (
    `<option value="${escapeHtml(item.id)}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.code)} · ${escapeHtml(item.name)} (${escapeHtml(item.unit)}, 매입 ${escapeHtml(formatMoney(item.purchasePrice))})</option>`
  )).join("");

  const orderCards = orders.length
    ? orders.map((order) => {
      const supplier = supplierMap.get(order.supplierId);
      const warehouse = warehouseMap.get(order.warehouseId);
      const status = orderStatus[order.status] ?? orderStatus.ordered;
      const receiptErrors = receiptOrderId === order.id ? fieldErrors : {};
      const orderLines = order.lines.map((line) => {
        const item = itemMap.get(line.itemId);
        const remaining = Math.round((line.quantity - line.receivedQuantity) * 100) / 100;
        return `<tr>
          <td><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><small>${escapeHtml(item?.code ?? line.itemId)} · ${escapeHtml(item?.unit ?? "")}</small></td>
          <td>${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))}</td>
          <td><strong class="received-quantity">${escapeHtml(formatQuantity(line.receivedQuantity, item?.unit ?? ""))}</strong></td>
          <td>${escapeHtml(formatQuantity(remaining, item?.unit ?? ""))}</td>
          <td class="number-cell">${escapeHtml(formatMoney(line.unitPrice))}</td>
          <td class="number-cell">${escapeHtml(formatMoney(line.quantity * line.unitPrice))}</td>
        </tr>`;
      }).join("");
      const receiptFields = order.status !== "received"
        ? `<form action="/purchase-orders/${escapeHtml(order.id)}/receive" method="post" class="receipt-form">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <div class="receipt-heading"><div><span>GOODS RECEIPT</span><h3>입고 처리</h3></div><p>실제로 도착한 수량만 입력하세요. 저장 즉시 ${escapeHtml(warehouse?.name ?? "입고 창고")} 재고가 늘어납니다.</p></div>
            ${receiptErrors.receipt ? `<div class="inline-error">${escapeHtml(receiptErrors.receipt)}</div>` : ""}
            <div class="receipt-inputs">
              ${order.lines.map((line) => {
                const item = itemMap.get(line.itemId);
                const remaining = Math.round((line.quantity - line.receivedQuantity) * 100) / 100;
                const field = `receipt_${line.id}`;
                if (remaining <= 0) return "";
                return `<label><span>${escapeHtml(item?.name ?? "품목")} <small>미입고 ${escapeHtml(formatQuantity(remaining, item?.unit ?? ""))}</small></span>
                  <input name="${escapeHtml(field)}" type="number" placeholder="0" min="0" max="${escapeHtml(remaining)}" step="0.01" inputmode="decimal"${inputState(field, receiptErrors)}>
                  ${fieldError(field, receiptErrors)}
                </label>`;
              }).join("")}
            </div>
            <div class="receipt-actions"><input name="receiptNote" placeholder="입고 메모 (선택)" maxlength="300"><button type="submit">입고 반영 <span aria-hidden="true">→</span></button></div>
          </form>`
        : `<div class="receipt-complete"><span aria-hidden="true">✓</span><div><strong>모든 품목의 입고가 완료됐습니다.</strong><p>${escapeHtml(formatDate(order.receivedAt))} · ${escapeHtml(warehouse?.name ?? "")}</p></div></div>`;

      return `<article class="purchase-order-card">
        <header>
          <div><span class="order-number">${escapeHtml(order.number)}</span><h2>${escapeHtml(supplier?.name ?? "알 수 없는 구매처")}</h2><p>${escapeHtml(supplier?.code ?? "")} · ${escapeHtml(warehouse?.name ?? order.warehouseId)} 입고</p></div>
          <div class="order-meta"><span class="order-status ${status.className}">${status.label}</span><dl><div><dt>발주일</dt><dd>${escapeHtml(formatDate(order.orderDate))}</dd></div><div><dt>입고 예정</dt><dd>${escapeHtml(order.expectedDate ? formatDate(order.expectedDate) : "미정")}</dd></div></dl></div>
        </header>
        <div class="table-scroll"><table class="order-lines-table"><thead><tr><th>품목</th><th>발주</th><th>입고</th><th>미입고</th><th>단가</th><th>금액</th></tr></thead><tbody>${orderLines}</tbody></table></div>
        <div class="order-total"><span>${escapeHtml(order.note || "메모 없음")}</span><p>발주 합계 <strong>${escapeHtml(formatMoney(order.totalAmount))}</strong></p></div>
        ${receiptFields}
      </article>`;
    }).join("")
    : `<div class="order-empty"><span aria-hidden="true">▦</span><h2>등록된 발주가 없습니다.</h2><p>구매처와 입고 창고를 선택해 첫 발주를 등록해 보세요.</p></div>`;

  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">발주 등록을 완료했습니다.</div>`
      : received
        ? `<div class="form-notice success" role="status">입고 수량을 재고에 반영했습니다.</div>`
        : "";

  return workspacePage({
    title: "발주 관리",
    active: "purchase-orders",
    user,
    csrfToken,
    content: `<section class="purchase-content">
      <header class="purchase-heading"><div><p class="form-kicker">PURCHASE ORDER</p><h1>발주 관리</h1><p>구매처에 발주하고 입고된 수량을 창고 재고에 바로 반영합니다.</p></div><span><b>${orders.length}</b>건 발주</span></header>
      ${notice}
      ${!prerequisitesReady ? `<div class="prerequisite-notice"><strong>발주 전에 기준정보가 필요합니다.</strong><p>${!suppliers.length ? "구매처" : ""}${!suppliers.length && !items.length ? "와 " : ""}${!items.length ? "품목" : ""}을 먼저 등록해 주세요.</p></div>` : ""}

      <details class="purchase-create"${!orders.length || error && !receiptOrderId ? " open" : ""}>
        <summary><span><i>NEW</i><strong>새 발주 등록</strong></span><em>구매처·입고 창고·품목 선택</em></summary>
        <form action="/purchase-orders" method="post" class="purchase-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
          <div class="purchase-form-header">
            <label>구매처 <b>*</b><select name="supplierId" required${inputState("supplierId", fieldErrors)}><option value="">구매처 선택</option>${supplierOptions}</select>${fieldError("supplierId", fieldErrors)}</label>
            <label>입고 창고 <b>*</b><select name="warehouseId" required${inputState("warehouseId", fieldErrors)}><option value="">창고 선택</option>${warehouses.map((warehouse) => `<option value="${escapeHtml(warehouse.id)}"${values.warehouseId === warehouse.id ? " selected" : ""}>${escapeHtml(warehouse.name)}</option>`).join("")}</select>${fieldError("warehouseId", fieldErrors)}</label>
            <label>발주일 <b>*</b><input name="orderDate" type="date" value="${escapeHtml(values.orderDate)}" required${inputState("orderDate", fieldErrors)}>${fieldError("orderDate", fieldErrors)}</label>
            <label>입고 예정일<input name="expectedDate" type="date" value="${escapeHtml(values.expectedDate)}"${inputState("expectedDate", fieldErrors)}>${fieldError("expectedDate", fieldErrors)}</label>
          </div>
          ${fieldErrors.lines ? `<div class="inline-error">${escapeHtml(fieldErrors.lines)}</div>` : ""}
          <div class="po-lines"><div class="po-line po-line-head"><span>품목</span><span>수량</span><span>발주 단가</span></div>
            ${lines.map((line, index) => `<div class="po-line">
              <label><span class="sr-only">${index + 1}번 품목</span><select name="lineItemId"${inputState(`line${index}ItemId`, fieldErrors)}><option value="">품목 선택</option>${itemOptions(line.itemId)}</select>${fieldError(`line${index}ItemId`, fieldErrors)}</label>
              <label><span class="sr-only">${index + 1}번 수량</span><input name="lineQuantity" type="number" value="${escapeHtml(line.quantity)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState(`line${index}Quantity`, fieldErrors)}>${fieldError(`line${index}Quantity`, fieldErrors)}</label>
              <label><span class="money-input"><input name="lineUnitPrice" type="number" value="${escapeHtml(line.unitPrice)}" placeholder="0" min="0" max="999999999999" step="1" inputmode="numeric"${inputState(`line${index}UnitPrice`, fieldErrors)}><i>원</i></span>${fieldError(`line${index}UnitPrice`, fieldErrors)}</label>
            </div>`).join("")}
          </div>
          <div class="purchase-form-footer"><input name="note" value="${escapeHtml(values.note)}" placeholder="발주 메모 (선택)" maxlength="500"><button type="submit"${!prerequisitesReady ? " disabled" : ""}>발주 등록 <span aria-hidden="true">→</span></button></div>
        </form>
      </details>

      <section class="orders-section"><div class="orders-title"><p>ORDER HISTORY</p><h2>발주·입고 현황</h2></div>${orderCards}</section>
    </section>`,
  });
}

const employmentTypeLabels = {
  regular: "정규직",
  contract: "계약직",
  "part-time": "시간제",
};

export function employeePage({
  user,
  csrfToken,
  employees,
  totalEmployees,
  departments,
  filters = {},
  values = {},
  fieldErrors = {},
  error = "",
  created = false,
}) {
  const totalBaseSalary = employees.reduce((total, employee) => total + Number(employee.baseSalary || 0), 0);
  const departmentOptions = departments.map((department) => (
    `<option value="${escapeHtml(department)}"${filters.department === department ? " selected" : ""}>${escapeHtml(department)}</option>`
  )).join("");
  const employeeRows = employees.map((employee) => `<tr data-employee-row>
    <td><strong class="record-code">${escapeHtml(employee.employeeNumber)}</strong>${employee.isSynthetic ? `<small class="synthetic-label">합성 데이터</small>` : ""}</td>
    <td><strong>${escapeHtml(employee.name)}</strong><small>${escapeHtml(employee.email)}</small></td>
    <td><strong>${escapeHtml(employee.department)}</strong><small>${escapeHtml(employee.position)}</small></td>
    <td><strong>${escapeHtml(employee.workLocation)}</strong><small>${escapeHtml(employmentTypeLabels[employee.employmentType] ?? employee.employmentType)}</small></td>
    <td><strong>${escapeHtml(formatDate(employee.hireDate))}</strong><small>${employee.employmentStatus === "active" ? "재직" : "퇴직"}</small></td>
    <td class="number-cell"><strong>${escapeHtml(formatMoney(employee.baseSalary))}</strong><small>식대 ${escapeHtml(formatMoney(employee.mealAllowance))}</small></td>
    <td class="number-cell"><strong>${escapeHtml(formatMoney(employee.fixedDeduction))}</strong><small>등록 공제액</small></td>
  </tr>`).join("");
  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">직원 등록을 완료했습니다.</div>`
      : "";

  return workspacePage({
    title: "직원 명부",
    active: "employees",
    user,
    csrfToken,
    content: `<section class="people-content">
      <header class="people-heading"><div><p class="form-kicker">PEOPLE DIRECTORY</p><h1>직원 명부</h1><p>재직자와 급여 산정 기준정보를 한곳에서 관리합니다.</p></div><div class="people-count"><span>전체 직원</span><strong>${totalEmployees.toLocaleString("ko-KR")}<small>명</small></strong></div></header>
      ${notice}
      <aside class="synthetic-notice"><span aria-hidden="true">S</span><p><strong>초기 직원 100명은 테스트용 합성 데이터입니다.</strong> 실제 인물의 개인정보가 아니며 직원번호·이름·부서·직급·급여 기준정보가 각각 저장되어 있습니다.</p></aside>

      <details class="employee-create"${error ? " open" : ""}>
        <summary><span><i>NEW</i><strong>새 직원 등록</strong></span><em>인사·급여 기준정보 입력</em></summary>
        <form action="/employees" method="post" class="employee-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
          <fieldset><legend>기본 정보</legend><div class="employee-form-grid basic">
            <label>직원번호 <b>*</b><input name="employeeNumber" value="${escapeHtml(values.employeeNumber)}" placeholder="예: EMP-0101" maxlength="20" required${inputState("employeeNumber", fieldErrors)}>${fieldError("employeeNumber", fieldErrors)}</label>
            <label>이름 <b>*</b><input name="name" value="${escapeHtml(values.name)}" maxlength="60" required${inputState("name", fieldErrors)}>${fieldError("name", fieldErrors)}</label>
            <label>부서 <b>*</b><input name="department" value="${escapeHtml(values.department)}" list="employee-departments" maxlength="60" required${inputState("department", fieldErrors)}><datalist id="employee-departments">${departments.map((department) => `<option value="${escapeHtml(department)}"></option>`).join("")}</datalist>${fieldError("department", fieldErrors)}</label>
            <label>직급 <b>*</b><input name="position" value="${escapeHtml(values.position)}" placeholder="예: 대리" maxlength="40" required${inputState("position", fieldErrors)}>${fieldError("position", fieldErrors)}</label>
            <label>근무지 <b>*</b><select name="workLocation" required${inputState("workLocation", fieldErrors)}>${["서울", "인천", "부산"].map((location) => `<option value="${location}"${values.workLocation === location ? " selected" : ""}>${location}</option>`).join("")}</select>${fieldError("workLocation", fieldErrors)}</label>
            <label>입사일 <b>*</b><input name="hireDate" type="date" value="${escapeHtml(values.hireDate)}" required${inputState("hireDate", fieldErrors)}>${fieldError("hireDate", fieldErrors)}</label>
            <label>이메일 <b>*</b><input name="email" type="email" value="${escapeHtml(values.email)}" placeholder="employee@company.example" maxlength="120" required${inputState("email", fieldErrors)}>${fieldError("email", fieldErrors)}</label>
            <label>고용 형태 <b>*</b><select name="employmentType"${inputState("employmentType", fieldErrors)}>${Object.entries(employmentTypeLabels).map(([value, label]) => `<option value="${value}"${values.employmentType === value ? " selected" : ""}>${label}</option>`).join("")}</select>${fieldError("employmentType", fieldErrors)}</label>
          </div></fieldset>
          <fieldset><legend>월 급여 기준</legend><p>법정 공제는 자동 계산하지 않습니다. 회사에서 확인한 월 고정 공제 총액을 등록하세요.</p><div class="employee-form-grid salary">
            <label>월 기본급 <b>*</b><span class="money-input"><input name="baseSalary" type="number" value="${escapeHtml(values.baseSalary)}" min="1" max="999999999999" step="1" required${inputState("baseSalary", fieldErrors)}><i>원</i></span>${fieldError("baseSalary", fieldErrors)}</label>
            <label>식대<span class="money-input"><input name="mealAllowance" type="number" value="${escapeHtml(values.mealAllowance)}" min="0" max="999999999999" step="1"${inputState("mealAllowance", fieldErrors)}><i>원</i></span>${fieldError("mealAllowance", fieldErrors)}</label>
            <label>기타 수당<span class="money-input"><input name="otherAllowance" type="number" value="${escapeHtml(values.otherAllowance)}" min="0" max="999999999999" step="1"${inputState("otherAllowance", fieldErrors)}><i>원</i></span>${fieldError("otherAllowance", fieldErrors)}</label>
            <label>등록 공제액<span class="money-input"><input name="fixedDeduction" type="number" value="${escapeHtml(values.fixedDeduction)}" min="0" max="999999999999" step="1"${inputState("fixedDeduction", fieldErrors)}><i>원</i></span>${fieldError("fixedDeduction", fieldErrors)}</label>
          </div></fieldset>
          <div class="employee-form-actions"><input name="note" value="${escapeHtml(values.note)}" placeholder="인사 메모 (선택)" maxlength="500"><button type="submit">직원 등록 <span aria-hidden="true">→</span></button></div>
        </form>
      </details>

      <section class="employee-directory">
        <div class="employee-directory-heading"><div><p>ALL EMPLOYEES</p><h2>재직자 목록</h2></div><form action="/employees" method="get" class="employee-filters"><input name="q" value="${escapeHtml(filters.query)}" placeholder="이름·직원번호·이메일 검색"><select name="department"><option value="">전체 부서</option>${departmentOptions}</select><button type="submit">검색</button><a href="/employees">초기화</a></form></div>
        <div class="directory-summary"><span>검색 결과 <strong>${employees.length.toLocaleString("ko-KR")}</strong>명</span><span>표시 직원 월 기본급 합계 <strong>${escapeHtml(formatMoney(totalBaseSalary))}</strong></span></div>
        ${employees.length ? `<div class="table-scroll"><table><thead><tr><th>직원번호</th><th>이름·이메일</th><th>부서·직급</th><th>근무지·고용</th><th>입사일·상태</th><th>월 기본급</th><th>공제 기준</th></tr></thead><tbody>${employeeRows}</tbody></table></div>` : `<div class="report-empty"><span aria-hidden="true">♙</span><strong>검색 조건에 맞는 직원이 없습니다.</strong><p>검색어나 부서 조건을 바꿔 주세요.</p></div>`}
      </section>
    </section>`,
  });
}

export function payrollPage({
  user,
  csrfToken,
  employees,
  runs,
  values = {},
  fieldErrors = {},
  error = "",
  created = false,
}) {
  const activeEmployees = employees.filter(({ employmentStatus }) => employmentStatus === "active");
  const eligibleEmployees = activeEmployees.filter(({ hireDate }) => !values.payDate || hireDate <= values.payDate);
  const runCards = runs.map((run, runIndex) => {
    const lineRows = run.lines.map((line) => `<tr data-payroll-line>
      <td><strong class="record-code">${escapeHtml(line.employeeNumber)}</strong></td>
      <td><strong>${escapeHtml(line.name)}</strong><small>${escapeHtml(line.department)} · ${escapeHtml(line.position)}</small></td>
      <td class="number-cell">${escapeHtml(formatMoney(line.baseSalary))}</td>
      <td class="number-cell">${escapeHtml(formatMoney(line.mealAllowance + line.otherAllowance))}</td>
      <td class="number-cell"><strong>${escapeHtml(formatMoney(line.grossPay))}</strong></td>
      <td class="number-cell deduction-cell">-${escapeHtml(formatMoney(line.fixedDeduction))}</td>
      <td class="number-cell net-pay-cell"><strong>${escapeHtml(formatMoney(line.netPay))}</strong></td>
      <td><a class="statement-link" href="/payroll/${escapeHtml(run.id)}/statements?employee=${escapeHtml(line.employeeId)}" target="_blank" rel="noopener">개인 명세</a></td>
    </tr>`).join("");
    const [year, month] = run.payPeriod.split("-").map(Number);
    return `<article class="payroll-run-card">
      <header><div><span class="order-number">${escapeHtml(run.number)}</span><h2>${year}년 ${month}월 급여대장</h2><p>급여일 ${escapeHtml(formatDate(run.payDate))} · ${run.employeeCount.toLocaleString("ko-KR")}명</p></div><div class="payroll-run-actions"><span class="order-status received">확정</span><a href="/payroll/${escapeHtml(run.id)}/statements" target="_blank" rel="noopener">${run.employeeCount.toLocaleString("ko-KR")}명 명세서 전체 출력</a></div></header>
      <div class="payroll-totals"><div><span>지급 합계</span><strong>${escapeHtml(formatMoney(run.totalGrossPay))}</strong></div><div><span>공제 합계</span><strong>${escapeHtml(formatMoney(run.totalDeduction))}</strong></div><div><span>실지급 합계</span><strong>${escapeHtml(formatMoney(run.totalNetPay))}</strong></div></div>
      <details class="payroll-lines"${runIndex === 0 ? " open" : ""}><summary>직원별 급여 내역 ${run.employeeCount.toLocaleString("ko-KR")}건 보기</summary><div class="table-scroll"><table><thead><tr><th>직원번호</th><th>직원</th><th>기본급</th><th>수당</th><th>지급 합계</th><th>등록 공제</th><th>실지급액</th><th>출력</th></tr></thead><tbody>${lineRows}</tbody></table></div></details>
    </article>`;
  }).join("");
  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">급여대장을 확정하고 직원별 급여명세를 생성했습니다.</div>`
      : "";

  return workspacePage({
    title: "급여 관리",
    active: "payroll",
    user,
    csrfToken,
    content: `<section class="payroll-content">
      <header class="payroll-heading"><div><p class="form-kicker">PAYROLL</p><h1>급여 관리</h1><p>월급날 재직자의 급여대장을 확정하고 개인별 명세서를 출력합니다.</p></div><div class="payroll-headcount"><span>현재 재직자</span><strong>${activeEmployees.length.toLocaleString("ko-KR")}<small>명</small></strong></div></header>
      ${notice}
      <aside class="payroll-caution"><span aria-hidden="true">!</span><p><strong>법정 세금·보험료 자동 계산 기능이 아닙니다.</strong> 직원 명부에 등록한 월 고정 공제 총액을 사용합니다. 실제 지급 전 세무·노무 담당자가 반드시 확인하세요.</p></aside>

      <section class="payroll-create-card">
        <div><p>NEW PAYROLL RUN</p><h2>월 급여 확정</h2><span>급여일 기준 입사 완료·재직 상태인 직원의 명세를 한 번에 생성합니다.</span></div>
        <form action="/payroll/runs" method="post" class="payroll-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
          <label>급여 귀속월 <b>*</b><input name="payPeriod" type="month" value="${escapeHtml(values.payPeriod)}" required${inputState("payPeriod", fieldErrors)}>${fieldError("payPeriod", fieldErrors)}</label>
          <label>급여일 <b>*</b><input name="payDate" type="date" value="${escapeHtml(values.payDate)}" required${inputState("payDate", fieldErrors)}>${fieldError("payDate", fieldErrors)}</label>
          <label class="payroll-note">메모<input name="note" value="${escapeHtml(values.note)}" placeholder="예: 7월 정기 급여" maxlength="500"></label>
          <div class="payroll-target"><span>예상 대상</span><strong>${eligibleEmployees.length.toLocaleString("ko-KR")}명</strong></div>
          <button type="submit">급여 확정 <span aria-hidden="true">→</span></button>
        </form>
      </section>

      <section class="payroll-history"><div class="orders-title"><p>CONFIRMED PAYROLL</p><h2>급여대장·명세서</h2></div>${runCards || `<div class="order-empty"><span aria-hidden="true">₩</span><h2>확정된 급여대장이 없습니다.</h2><p>급여 귀속월과 급여일을 확인하고 첫 급여를 확정하세요.</p></div>`}</section>
    </section>`,
  });
}

export function payrollStatementsPage({ run, lines }) {
  const [year, month] = run.payPeriod.split("-").map(Number);
  const slips = lines.map((line) => `<article class="payroll-slip" data-payroll-statement>
    <header><div><p>OhMyVibeERP</p><h1>${year}년 ${month}월 급여명세서</h1></div><span>${escapeHtml(run.number)}</span></header>
    <dl class="slip-employee"><div><dt>직원번호</dt><dd>${escapeHtml(line.employeeNumber)}</dd></div><div><dt>성명</dt><dd>${escapeHtml(line.name)}</dd></div><div><dt>부서·직급</dt><dd>${escapeHtml(line.department)} · ${escapeHtml(line.position)}</dd></div><div><dt>급여일</dt><dd>${escapeHtml(formatDate(run.payDate))}</dd></div></dl>
    <div class="slip-columns">
      <section><h2>지급 내역</h2><dl><div><dt>기본급</dt><dd>${escapeHtml(formatMoney(line.baseSalary))}</dd></div><div><dt>식대</dt><dd>${escapeHtml(formatMoney(line.mealAllowance))}</dd></div><div><dt>기타 수당</dt><dd>${escapeHtml(formatMoney(line.otherAllowance))}</dd></div><div class="subtotal"><dt>지급 합계</dt><dd>${escapeHtml(formatMoney(line.grossPay))}</dd></div></dl></section>
      <section><h2>공제 내역</h2><dl><div><dt>등록 공제액</dt><dd>${escapeHtml(formatMoney(line.fixedDeduction))}</dd></div><div class="slip-spacer"><dt>공제 기준</dt><dd>직원 명부 등록액</dd></div><div class="subtotal"><dt>공제 합계</dt><dd>${escapeHtml(formatMoney(line.fixedDeduction))}</dd></div></dl></section>
    </div>
    <div class="slip-net"><span>실지급액</span><strong>${escapeHtml(formatMoney(line.netPay))}</strong></div>
    <footer><p>본 명세서는 OhMyVibeERP 등록 급여 기준으로 생성되었습니다. 법정 공제 및 실제 지급 전 담당자 확인이 필요합니다.</p><span>확정일 ${escapeHtml(formatKoreanDateTime(run.confirmedAt))}</span></footer>
  </article>`).join("");
  return document({
    title: `${year}년 ${month}월 급여명세서 | OhMyVibeERP`,
    pageClass: "payroll-print-page",
    body: `<div class="print-toolbar"><a href="/payroll">← 급여 관리로</a><p><strong>${lines.length.toLocaleString("ko-KR")}명 명세서</strong> · 브라우저 인쇄(Ctrl/⌘ + P)로 인쇄하거나 PDF로 저장하세요.</p></div><main class="payroll-slip-stack">${slips}</main>`,
  });
}

const salesOrderStatus = {
  ordered: { label: "주문 접수", className: "ordered" },
  partially_shipped: { label: "일부 출고", className: "partial" },
  shipped: { label: "출고 완료", className: "shipped" },
};

export function salesOrdersPage({
  user,
  csrfToken,
  customers,
  items,
  warehouses,
  orders,
  values = {},
  fieldErrors = {},
  error = "",
  created = false,
  shipped = false,
  shipmentOrderId = "",
}) {
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const lines = Array.from({ length: 5 }, (_, index) => values.lines?.[index] ?? {});
  const prerequisitesReady = customers.length > 0 && items.length > 0;
  const totalReceivable = Math.round(orders.reduce((total, order) => total + Number(order.receivableAmount || 0), 0) * 100) / 100;

  const customerOptions = customers.map((customer) => (
    `<option value="${escapeHtml(customer.id)}"${values.customerId === customer.id ? " selected" : ""}>${escapeHtml(customer.code)} · ${escapeHtml(customer.name)}</option>`
  )).join("");
  const itemOptions = (selectedId) => items.map((item) => (
    `<option value="${escapeHtml(item.id)}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.code)} · ${escapeHtml(item.name)} (${escapeHtml(item.unit)}, 판매 ${escapeHtml(formatMoney(item.salesPrice))})</option>`
  )).join("");

  const orderCards = orders.length
    ? orders.map((order) => {
      const customer = customerMap.get(order.customerId);
      const warehouse = warehouseMap.get(order.warehouseId);
      const status = salesOrderStatus[order.status] ?? salesOrderStatus.ordered;
      const shipmentErrors = shipmentOrderId === order.id ? fieldErrors : {};
      const orderLines = order.lines.map((line) => {
        const item = itemMap.get(line.itemId);
        const remaining = Math.round((line.quantity - line.shippedQuantity) * 100) / 100;
        return `<tr>
          <td><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><small>${escapeHtml(item?.code ?? line.itemId)} · ${escapeHtml(item?.unit ?? "")}</small></td>
          <td>${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))}</td>
          <td><strong class="shipped-quantity">${escapeHtml(formatQuantity(line.shippedQuantity, item?.unit ?? ""))}</strong></td>
          <td>${escapeHtml(formatQuantity(remaining, item?.unit ?? ""))}</td>
          <td class="number-cell">${escapeHtml(formatMoney(line.unitPrice))}</td>
          <td class="number-cell">${escapeHtml(formatMoney(line.quantity * line.unitPrice))}</td>
        </tr>`;
      }).join("");
      const shipmentFields = order.status !== "shipped"
        ? `<form action="/sales-orders/${escapeHtml(order.id)}/ship" method="post" class="receipt-form shipment-form">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <div class="receipt-heading"><div><span>SHIPMENT</span><h3>출고 처리</h3></div><p>실제로 내보낼 수량을 입력하세요. 저장 즉시 ${escapeHtml(warehouse?.name ?? "출고 창고")} 재고가 줄고 받을 금액이 늘어납니다.</p></div>
            ${shipmentErrors.shipment ? `<div class="inline-error">${escapeHtml(shipmentErrors.shipment)}</div>` : ""}
            <div class="receipt-inputs">
              ${order.lines.map((line) => {
                const item = itemMap.get(line.itemId);
                const remaining = Math.round((line.quantity - line.shippedQuantity) * 100) / 100;
                const field = `shipment_${line.id}`;
                if (remaining <= 0) return "";
                const available = Number(item?.stockByWarehouse?.[order.warehouseId] || 0);
                return `<label><span>${escapeHtml(item?.name ?? "품목")} <small>미출고 ${escapeHtml(formatQuantity(remaining, item?.unit ?? ""))} · 재고 ${escapeHtml(formatQuantity(available, item?.unit ?? ""))}</small></span>
                  <input name="${escapeHtml(field)}" type="number" placeholder="0" min="0" max="${escapeHtml(Math.min(remaining, available))}" step="0.01" inputmode="decimal"${inputState(field, shipmentErrors)}>
                  ${fieldError(field, shipmentErrors)}
                </label>`;
              }).join("")}
            </div>
            <div class="receipt-actions"><input name="shipmentNote" placeholder="출고 메모 (선택)" maxlength="300"><button type="submit">출고 반영 <span aria-hidden="true">→</span></button></div>
          </form>`
        : `<div class="receipt-complete shipment-complete"><span aria-hidden="true">✓</span><div><strong>모든 품목의 출고가 완료됐습니다.</strong><p>${escapeHtml(formatDate(order.shippedAt))} · 받을 금액 ${escapeHtml(formatMoney(order.receivableAmount))}</p></div></div>`;

      return `<article class="purchase-order-card sales-order-card">
        <header>
          <div><span class="order-number">${escapeHtml(order.number)}</span><h2>${escapeHtml(customer?.name ?? "알 수 없는 판매처")}</h2><p>${escapeHtml(customer?.code ?? "")} · ${escapeHtml(warehouse?.name ?? order.warehouseId)} 출고</p></div>
          <div class="order-meta"><span class="order-status ${status.className}">${status.label}</span><dl><div><dt>주문일</dt><dd>${escapeHtml(formatDate(order.orderDate))}</dd></div><div><dt>출고 요청</dt><dd>${escapeHtml(order.requestedShipDate ? formatDate(order.requestedShipDate) : "미정")}</dd></div></dl></div>
        </header>
        <div class="table-scroll"><table class="order-lines-table"><thead><tr><th>품목</th><th>주문</th><th>출고</th><th>미출고</th><th>판매 단가</th><th>금액</th></tr></thead><tbody>${orderLines}</tbody></table></div>
        <div class="order-total sales-order-total"><span>${escapeHtml(order.note || "메모 없음")}</span><div><p>주문금액 <strong>${escapeHtml(formatMoney(order.totalAmount))}</strong></p><p class="receivable-amount">받을 금액 <strong>${escapeHtml(formatMoney(order.receivableAmount))}</strong></p></div></div>
        ${shipmentFields}
      </article>`;
    }).join("")
    : `<div class="order-empty"><span aria-hidden="true">↗</span><h2>접수된 판매 주문이 없습니다.</h2><p>판매처와 출고 창고를 선택해 첫 주문을 등록해 보세요.</p></div>`;

  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">판매 주문 등록을 완료했습니다.</div>`
      : shipped
        ? `<div class="form-notice success" role="status">출고 수량을 재고와 받을 금액에 반영했습니다.</div>`
        : "";

  return workspacePage({
    title: "주문·출고",
    active: "sales-orders",
    user,
    csrfToken,
    content: `<section class="purchase-content sales-content">
      <header class="purchase-heading sales-heading"><div><p class="form-kicker">SALES ORDER</p><h1>주문 · 출고</h1><p>판매 주문을 접수하고 출고 재고와 받을 금액을 함께 관리합니다.</p></div><div class="sales-summary"><span>누적 받을 금액</span><strong>${escapeHtml(formatMoney(totalReceivable))}</strong></div></header>
      ${notice}
      ${!prerequisitesReady ? `<div class="prerequisite-notice"><strong>주문 전에 기준정보가 필요합니다.</strong><p>${!customers.length ? "판매처" : ""}${!customers.length && !items.length ? "와 " : ""}${!items.length ? "품목" : ""}을 먼저 등록해 주세요.</p></div>` : ""}

      <details class="purchase-create sales-create"${!orders.length || error && !shipmentOrderId ? " open" : ""}>
        <summary><span><i>NEW</i><strong>새 판매 주문 등록</strong></span><em>판매처·출고 창고·품목 선택</em></summary>
        <form action="/sales-orders" method="post" class="purchase-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
          <div class="purchase-form-header">
            <label>판매처 <b>*</b><select name="customerId" required${inputState("customerId", fieldErrors)}><option value="">판매처 선택</option>${customerOptions}</select>${fieldError("customerId", fieldErrors)}</label>
            <label>출고 창고 <b>*</b><select name="warehouseId" required${inputState("warehouseId", fieldErrors)}><option value="">창고 선택</option>${warehouses.map((warehouse) => `<option value="${escapeHtml(warehouse.id)}"${values.warehouseId === warehouse.id ? " selected" : ""}>${escapeHtml(warehouse.name)}</option>`).join("")}</select>${fieldError("warehouseId", fieldErrors)}</label>
            <label>주문일 <b>*</b><input name="orderDate" type="date" value="${escapeHtml(values.orderDate)}" required${inputState("orderDate", fieldErrors)}>${fieldError("orderDate", fieldErrors)}</label>
            <label>출고 요청일<input name="requestedShipDate" type="date" value="${escapeHtml(values.requestedShipDate)}"${inputState("requestedShipDate", fieldErrors)}>${fieldError("requestedShipDate", fieldErrors)}</label>
          </div>
          ${fieldErrors.lines ? `<div class="inline-error">${escapeHtml(fieldErrors.lines)}</div>` : ""}
          <div class="po-lines"><div class="po-line po-line-head"><span>품목</span><span>수량</span><span>판매 단가</span></div>
            ${lines.map((line, index) => `<div class="po-line">
              <label><span class="sr-only">${index + 1}번 품목</span><select name="lineItemId"${inputState(`line${index}ItemId`, fieldErrors)}><option value="">품목 선택</option>${itemOptions(line.itemId)}</select>${fieldError(`line${index}ItemId`, fieldErrors)}</label>
              <label><span class="sr-only">${index + 1}번 수량</span><input name="lineQuantity" type="number" value="${escapeHtml(line.quantity)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState(`line${index}Quantity`, fieldErrors)}>${fieldError(`line${index}Quantity`, fieldErrors)}</label>
              <label><span class="money-input"><input name="lineUnitPrice" type="number" value="${escapeHtml(line.unitPrice)}" placeholder="0" min="0" max="999999999999" step="1" inputmode="numeric"${inputState(`line${index}UnitPrice`, fieldErrors)}><i>원</i></span>${fieldError(`line${index}UnitPrice`, fieldErrors)}</label>
            </div>`).join("")}
          </div>
          <div class="purchase-form-footer"><input name="note" value="${escapeHtml(values.note)}" placeholder="주문 메모 (선택)" maxlength="500"><button type="submit"${!prerequisitesReady ? " disabled" : ""}>주문 등록 <span aria-hidden="true">→</span></button></div>
        </form>
      </details>

      <section class="orders-section"><div class="orders-title"><p>ORDER & SHIPMENT</p><h2>주문·출고 현황</h2></div>${orderCards}</section>
    </section>`,
  });
}

export function productionPage({
  user,
  csrfToken,
  items,
  warehouses,
  bills,
  productionOrders,
  bomValues = {},
  productionValues = {},
  fieldErrors = {},
  error = "",
  errorForm = "",
  bomCreated = false,
  produced = false,
}) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const bomByProduct = new Map(bills.map((bill) => [bill.productItemId, bill]));
  const componentRows = Array.from({ length: 6 }, (_, index) => bomValues.components?.[index] ?? {});
  const bomErrors = errorForm === "bom" ? fieldErrors : {};
  const productionErrors = errorForm === "production" ? fieldErrors : {};
  const itemOptions = (selectedId, { onlyProductsWithBom = false } = {}) => items
    .filter((item) => !onlyProductsWithBom || bomByProduct.has(item.id))
    .map((item) => (
      `<option value="${escapeHtml(item.id)}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.code)} · ${escapeHtml(item.name)} (${escapeHtml(item.unit)})</option>`
    )).join("");

  const billCards = bills.length
    ? bills.map((bill) => {
      const product = itemMap.get(bill.productItemId);
      const componentTableRows = bill.components.map((component) => {
        const item = itemMap.get(component.itemId);
        const warehouseStocks = warehouses.map(({ id }) => (
          `<td>${escapeHtml(formatQuantity(item?.stockByWarehouse?.[id] ?? 0, item?.unit ?? ""))}</td>`
        )).join("");
        return `<tr><td><strong>${escapeHtml(item?.name ?? "삭제된 부품")}</strong><small>${escapeHtml(item?.code ?? component.itemId)}</small></td><td><strong>${escapeHtml(formatQuantity(component.quantity, item?.unit ?? ""))}</strong></td>${warehouseStocks}</tr>`;
      }).join("");
      return `<article class="purchase-order-card bom-card">
        <header><div><span class="order-number">BILL OF MATERIALS</span><h2>${escapeHtml(product?.name ?? "삭제된 완제품")}</h2><p>${escapeHtml(product?.code ?? bill.productItemId)} · 완제품 1 ${escapeHtml(product?.unit ?? "")}</p></div><span class="order-status received">구성 완료</span></header>
        <div class="table-scroll"><table class="order-lines-table bom-table"><thead><tr><th>부품</th><th>제품 1개당 필요</th>${warehouses.map(({ name }) => `<th>${escapeHtml(name)} 현재고</th>`).join("")}</tr></thead><tbody>${componentTableRows}</tbody></table></div>
        <div class="order-total"><span>${escapeHtml(bill.note || "구성 메모 없음")}</span><p>구성 부품 <strong>${bill.components.length}종</strong></p></div>
      </article>`;
    }).join("")
    : `<div class="order-empty"><span aria-hidden="true">⚙</span><h2>등록된 부품 구성표가 없습니다.</h2><p>완제품과 제품 1개당 필요한 부품 수량을 먼저 등록하세요.</p></div>`;

  const productionCards = productionOrders.length
    ? productionOrders.map((order) => {
      const product = itemMap.get(order.productItemId);
      const warehouse = warehouseMap.get(order.warehouseId);
      const consumedRows = order.components.map((component) => {
        const item = itemMap.get(component.itemId);
        return `<tr><td><strong>${escapeHtml(item?.name ?? "삭제된 부품")}</strong><small>${escapeHtml(item?.code ?? component.itemId)}</small></td><td>${escapeHtml(formatQuantity(component.quantityPerProduct, item?.unit ?? ""))}</td><td><strong class="consumed-quantity">-${escapeHtml(formatQuantity(component.consumedQuantity, item?.unit ?? ""))}</strong></td></tr>`;
      }).join("");
      return `<article class="purchase-order-card production-order-card">
        <header><div><span class="order-number">${escapeHtml(order.number)}</span><h2>${escapeHtml(product?.name ?? "삭제된 완제품")}</h2><p>${escapeHtml(warehouse?.name ?? order.warehouseId)}에서 생산</p></div><div class="order-meta"><span class="order-status received">생산 완료</span><dl><div><dt>생산일</dt><dd>${escapeHtml(formatDate(order.productionDate))}</dd></div><div><dt>완료 시각</dt><dd>${escapeHtml(formatDate(order.completedAt))}</dd></div></dl></div></header>
        <div class="production-result"><div><span>완제품 입고</span><strong>+${escapeHtml(formatQuantity(order.quantity, product?.unit ?? ""))}</strong></div><p>생산 지시와 동시에 부품 출고 및 완제품 입고가 반영되었습니다.</p></div>
        <div class="table-scroll"><table class="order-lines-table production-components-table"><thead><tr><th>사용 부품</th><th>제품 1개당</th><th>총 차감 수량</th></tr></thead><tbody>${consumedRows}</tbody></table></div>
        <div class="order-total"><span>${escapeHtml(order.note || "생산 메모 없음")}</span><p>${escapeHtml(warehouse?.name ?? "")}</p></div>
      </article>`;
    }).join("")
    : `<div class="order-empty"><span aria-hidden="true">◇</span><h2>생산 지시 이력이 없습니다.</h2><p>구성표가 등록된 완제품을 선택해 첫 생산을 지시하세요.</p></div>`;

  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : bomCreated
      ? `<div class="form-notice success" role="status">완제품 부품 구성표를 등록했습니다.</div>`
      : produced
        ? `<div class="form-notice success" role="status">생산을 완료하고 부품·완제품 재고에 반영했습니다.</div>`
        : "";

  return workspacePage({
    title: "생산 관리",
    active: "production",
    user,
    csrfToken,
    content: `<section class="purchase-content production-content">
      <header class="purchase-heading"><div><p class="form-kicker">MANUFACTURING</p><h1>생산 관리</h1><p>부품 구성표를 기준으로 생산하고 창고 재고를 한 번에 반영합니다.</p></div><div class="production-summary"><span><b>${bills.length}</b>개 구성표</span><span><b>${productionOrders.length}</b>건 생산</span></div></header>
      ${notice}
      ${items.length < 2 ? `<div class="prerequisite-notice"><strong>생산 전에 품목 기준정보가 필요합니다.</strong><p>완제품과 부품을 포함해 품목을 2개 이상 등록해 주세요.</p></div>` : ""}

      <div class="production-forms">
        <details class="purchase-create bom-create"${!bills.length || errorForm === "bom" ? " open" : ""}>
          <summary><span><i>BOM</i><strong>부품 구성표 등록</strong></span><em>완제품 1개당 부품 소요량</em></summary>
          <form action="/production/boms" method="post" class="purchase-form">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <div class="bom-product-field"><label>완제품 <b>*</b><select name="productItemId" required${inputState("productItemId", bomErrors)}><option value="">완제품 선택</option>${itemOptions(bomValues.productItemId)}</select>${fieldError("productItemId", bomErrors)}</label><p>등록된 모든 품목 중 조립 결과로 입고할 완제품을 선택하세요.</p></div>
            ${bomErrors.components ? `<div class="inline-error">${escapeHtml(bomErrors.components)}</div>` : ""}
            <div class="po-lines bom-lines"><div class="po-line bom-line po-line-head"><span>부품</span><span>제품 1개당 필요 수량</span></div>
              ${componentRows.map((component, index) => `<div class="po-line bom-line"><label><span class="sr-only">${index + 1}번 부품</span><select name="componentItemId"${inputState(`component${index}ItemId`, bomErrors)}><option value="">부품 선택</option>${itemOptions(component.itemId)}</select>${fieldError(`component${index}ItemId`, bomErrors)}</label><label><span class="sr-only">${index + 1}번 필요 수량</span><input name="componentQuantity" type="number" value="${escapeHtml(component.quantity)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState(`component${index}Quantity`, bomErrors)}>${fieldError(`component${index}Quantity`, bomErrors)}</label></div>`).join("")}
            </div>
            <div class="purchase-form-footer"><input name="note" value="${escapeHtml(bomValues.note)}" placeholder="구성 메모 (선택)" maxlength="500"><button type="submit"${items.length < 2 ? " disabled" : ""}>구성표 등록 <span aria-hidden="true">→</span></button></div>
          </form>
        </details>

        <details class="purchase-create production-create"${errorForm === "production" || bills.length && !productionOrders.length ? " open" : ""}>
          <summary><span><i>MO</i><strong>생산 지시</strong></span><em>부품 차감 · 완제품 입고</em></summary>
          <form action="/production/orders" method="post" class="purchase-form">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <div class="purchase-form-header production-form-header">
              <label>완제품 <b>*</b><select name="productItemId" required${inputState("productItemId", productionErrors)}><option value="">구성표가 있는 완제품 선택</option>${itemOptions(productionValues.productItemId, { onlyProductsWithBom: true })}</select>${fieldError("productItemId", productionErrors)}</label>
              <label>생산 창고 <b>*</b><select name="warehouseId" required${inputState("warehouseId", productionErrors)}><option value="">창고 선택</option>${warehouses.map((warehouse) => `<option value="${escapeHtml(warehouse.id)}"${productionValues.warehouseId === warehouse.id ? " selected" : ""}>${escapeHtml(warehouse.name)}</option>`).join("")}</select>${fieldError("warehouseId", productionErrors)}</label>
              <label>생산일 <b>*</b><input name="productionDate" type="date" value="${escapeHtml(productionValues.productionDate)}" required${inputState("productionDate", productionErrors)}>${fieldError("productionDate", productionErrors)}</label>
              <label>생산 수량 <b>*</b><input name="quantity" type="number" value="${escapeHtml(productionValues.quantity)}" placeholder="0" min="1" max="999999999" step="1" inputmode="numeric" required${inputState("quantity", productionErrors)}>${fieldError("quantity", productionErrors)}</label>
            </div>
            <div class="production-warning"><strong>생산 지시 즉시 재고가 변동됩니다.</strong><span>선택 창고에서 필요한 모든 부품을 차감하고 완제품을 입고합니다.</span></div>
            <div class="purchase-form-footer"><input name="note" value="${escapeHtml(productionValues.note)}" placeholder="생산 메모 (선택)" maxlength="500"><button type="submit"${!bills.length ? " disabled" : ""}>생산 지시 <span aria-hidden="true">→</span></button></div>
          </form>
        </details>
      </div>

      <section class="orders-section production-section"><div class="orders-title"><p>PRODUCT STRUCTURE</p><h2>완제품별 부품 구성</h2></div>${billCards}</section>
      <section class="orders-section production-section"><div class="orders-title"><p>PRODUCTION HISTORY</p><h2>생산·재고 반영 이력</h2></div>${productionCards}</section>
    </section>`,
  });
}

export function monthlyTradeReportPage({
  user,
  csrfToken,
  warehouses,
  partners,
  items,
  summary,
}) {
  const partnerMap = new Map(partners.map((partner) => [partner.id, partner]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const [year, month] = summary.month.split("-").map(Number);
  const monthLabel = `${year}년 ${month}월`;
  const isPositive = summary.differenceAmount >= 0;
  const differenceMessage = isPositive
    ? `판매액이 매입액보다 ${formatMoney(summary.differenceAmount)} 많습니다.`
    : `매입액이 판매액보다 ${formatMoney(Math.abs(summary.differenceAmount))} 많습니다.`;

  const transactionRows = summary.transactions.map((transaction) => {
    const isPurchase = transaction.type === "purchase";
    const partner = partnerMap.get(transaction.partnerId);
    const warehouse = warehouseMap.get(transaction.warehouseId);
    const lineDetails = transaction.lines.map((line) => {
      const item = itemMap.get(line.itemId);
      return `<div><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><span>${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))} × ${escapeHtml(formatMoney(line.unitPrice))}</span><em>${escapeHtml(formatMoney(line.amount))}</em></div>`;
    }).join("");
    return `<tr>
      <td><span class="trade-type ${isPurchase ? "purchase" : "sale"}">${isPurchase ? "구매 입고" : "판매 출고"}</span></td>
      <td><strong>${escapeHtml(formatKoreanDateTime(transaction.occurredAt))}</strong><small>${escapeHtml(transaction.documentNumber)}</small></td>
      <td><strong>${escapeHtml(partner?.name ?? "알 수 없는 거래처")}</strong><small>${escapeHtml(partner?.code ?? transaction.partnerId)}</small></td>
      <td>${escapeHtml(warehouse?.name ?? transaction.warehouseId)}</td>
      <td class="trade-lines">${lineDetails}</td>
      <td class="number-cell trade-amount ${isPurchase ? "purchase" : "sale"}">${isPurchase ? "-" : "+"}${escapeHtml(formatMoney(transaction.amount))}</td>
    </tr>`;
  }).join("");

  return workspacePage({
    title: "월간 매입·판매",
    active: "monthly-report",
    user,
    csrfToken,
    content: `<section class="report-content">
      <header class="report-heading">
        <div><p class="form-kicker">MONTHLY TRADE REPORT</p><h1>월간 매입·판매</h1><p>실제로 입고하고 출고한 수량을 돈 기준으로 정리합니다.</p></div>
        <form action="/reports/monthly" method="get" class="month-filter"><label for="report-month">조회 월</label><input id="report-month" name="month" type="month" value="${escapeHtml(summary.month)}" required><button type="submit">조회</button></form>
      </header>

      <aside class="report-basis"><span aria-hidden="true">i</span><p><strong>입고·출고 금액 기준입니다.</strong> 실제 지급·수금이나 부가세, 급여, 운임 등은 반영되지 않아 회계상 순이익과는 다릅니다.</p></aside>

      <section class="trade-summary" aria-label="${escapeHtml(monthLabel)} 금액 요약">
        <article class="spent"><span>이번 달 쓴 금액</span><strong>${escapeHtml(formatMoney(summary.purchaseAmount))}</strong><p>구매 입고 ${summary.purchaseCount.toLocaleString("ko-KR")}건</p></article>
        <article class="earned"><span>이번 달 번 금액</span><strong>${escapeHtml(formatMoney(summary.salesAmount))}</strong><p>판매 출고 ${summary.salesCount.toLocaleString("ko-KR")}건</p></article>
        <article class="difference ${isPositive ? "positive" : "negative"}"><span>매입·판매 차액</span><strong>${isPositive ? "+" : "-"}${escapeHtml(formatMoney(Math.abs(summary.differenceAmount)))}</strong><p>${escapeHtml(differenceMessage)}</p></article>
      </section>

      <section class="trade-history" aria-labelledby="trade-history-title">
        <div class="trade-history-heading"><div><p>TRANSACTION BASIS</p><h2 id="trade-history-title">${escapeHtml(monthLabel)} 거래 근거</h2></div><span>총 <strong>${summary.transactions.length.toLocaleString("ko-KR")}</strong>건</span></div>
        ${summary.transactions.length ? `<div class="table-scroll"><table><thead><tr><th>구분</th><th>처리 일시·문서</th><th>거래처</th><th>창고</th><th>품목·산식</th><th>금액</th></tr></thead><tbody>${transactionRows}</tbody></table></div>` : `<div class="report-empty"><span aria-hidden="true">₩</span><strong>이 달에 반영된 매입·판매가 없습니다.</strong><p>발주 입고 또는 판매 출고를 처리하면 금액이 여기에 표시됩니다.</p></div>`}
      </section>
    </section>`,
  });
}

export { escapeHtml };
