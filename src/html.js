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
    <a class="${active === "purchase-orders" ? "active" : ""}" href="/purchase-orders"><span aria-hidden="true">▦</span> 발주 관리</a>
    <a class="${active === "inventory" ? "active" : ""}" href="/inventory"><span aria-hidden="true">▤</span> 재고 현황</a>
    <a href="#" aria-disabled="true"><span aria-hidden="true">♙</span> 인사 · 급여 <em>준비 중</em></a>
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

export { escapeHtml };
