import { canAccess, departmentLabel, PERMISSIONS } from "./access-control.js";

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

export function loginPage({
  csrfToken = "",
  error = "",
  username = "",
  showDemoAccount = true,
  demoAccounts = [],
} = {}) {
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

            ${showDemoAccount ? `<aside class="demo-account department-demo" aria-label="체험 계정 안내">
              <span>DEMO</span>
              <div><p><strong>부서별 체험 계정</strong><small>비밀번호 공통 · <code>ChangeMe123!</code></small></p><ul>${demoAccounts.map((account) => `<li data-demo-account="${escapeHtml(account.username)}"><b>${escapeHtml(account.department === "management" ? "관리" : departmentLabel(account))}</b><code>${escapeHtml(account.username)}</code></li>`).join("")}</ul></div>
            </aside>` : ""}
            <p class="help-text">로그인에 문제가 있나요? <a href="mailto:help@ohmyvibeerp.example">관리자에게 문의</a></p>
          </div>
        </section>
      </main>`,
  });
}

const navigationGroups = Object.freeze([
  Object.freeze({ label: "WORKSPACE", links: Object.freeze([
    Object.freeze({ active: "home", href: "/app", icon: "⌂", label: "홈", description: "내 부서 업무 시작", permission: PERMISSIONS.HOME }),
  ]) }),
  Object.freeze({ label: "기준 정보", links: Object.freeze([
    Object.freeze({ active: "sales", href: "/partners/sales", icon: "↗", label: "판매처", description: "판매 거래처 등록", permission: PERMISSIONS.SALES_PARTNERS }),
    Object.freeze({ active: "purchases", href: "/partners/purchases", icon: "↙", label: "구매처", description: "구매 거래처 등록", permission: PERMISSIONS.PURCHASE_PARTNERS }),
    Object.freeze({ active: "items", href: "/items", icon: "◇", label: "품목", description: "품목·재고 기준정보", permission: PERMISSIONS.ITEMS_MANAGE }),
  ]) }),
  Object.freeze({ label: "업무 관리", links: Object.freeze([
    Object.freeze({ active: "sales-orders", href: "/sales-orders", icon: "↗", label: "주문 · 출고", description: "판매 주문과 출고", permission: PERMISSIONS.SALES_ORDERS_VIEW }),
    Object.freeze({ active: "purchase-orders", href: "/purchase-orders", icon: "▦", label: "발주 관리", description: "구매 발주와 입고", permission: PERMISSIONS.PURCHASE_ORDERS_VIEW }),
    Object.freeze({ active: "production", href: "/production", icon: "⚙", label: "생산 관리", description: "BOM과 생산 지시", permission: PERMISSIONS.PRODUCTION_MANAGE }),
    Object.freeze({ active: "inventory", href: "/inventory", icon: "▤", label: "재고 현황", description: "세 창고별 현재고", permission: PERMISSIONS.INVENTORY_VIEW }),
  ]) }),
  Object.freeze({ label: "보고서", links: Object.freeze([
    Object.freeze({ active: "monthly-report", href: "/reports/monthly", icon: "₩", label: "월간 매입·판매", description: "월간 금액과 회계월 마감", permission: PERMISSIONS.FINANCE_REPORT }),
    Object.freeze({ active: "vat-report", href: "/reports/vat", icon: "VAT", label: "분기 부가세", description: "매출·매입세액과 예상 납부액", permission: PERMISSIONS.FINANCE_REPORT }),
    Object.freeze({ active: "settlements", href: "/settlements", icon: "◎", label: "받을 돈 · 줄 돈", description: "거래처별 입금·지급과 잔액", permission: PERMISSIONS.FINANCE_SETTLEMENTS }),
  ]) }),
  Object.freeze({ label: "인사 · 급여", links: Object.freeze([
    Object.freeze({ active: "employees", href: "/employees", icon: "♙", label: "직원 명부", description: "직원·급여 기준정보", permission: PERMISSIONS.EMPLOYEES_MANAGE }),
    Object.freeze({ active: "payroll", href: "/payroll", icon: "₩", label: "급여 관리", description: "월 급여와 명세서", permission: PERMISSIONS.PAYROLL_MANAGE }),
  ]) }),
]);

const allowedNavigationLinks = (user) => navigationGroups.flatMap(({ links }) => (
  links.filter(({ permission }) => canAccess(user, permission))
));

const navigation = ({ active, user }) => `<nav aria-label="주 메뉴">${navigationGroups.map((group, index) => {
  const links = group.links.filter(({ permission }) => canAccess(user, permission));
  if (!links.length) return "";
  return `<p${index ? ' class="nav-section"' : ""}>${escapeHtml(group.label)}</p>${links.map((link) => `<a class="${active === link.active ? "active" : ""}" href="${escapeHtml(link.href)}"><span aria-hidden="true">${escapeHtml(link.icon)}</span> ${escapeHtml(link.label)}</a>`).join("")}`;
}).join("")}</nav>`;

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
          ${navigation({ active, user })}
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

export function appPage({ user, csrfToken, dashboard, asOfDate }) {
  if (!dashboard) {
    const department = departmentLabel(user);
    const taskLinks = allowedNavigationLinks(user).filter(({ active }) => active !== "home");
    return workspacePage({
      title: `${department} 업무`,
      active: "home",
      user,
      csrfToken,
      content: `<section class="department-home">
        <header><p class="form-kicker">MY DEPARTMENT</p><h1>${escapeHtml(department)} 업무</h1><p>${escapeHtml(user.displayName)}님에게 허용된 업무만 표시합니다.</p></header>
        <aside><span aria-hidden="true">✓</span><p><strong>부서 권한이 적용되었습니다.</strong> 다른 부서 메뉴는 숨겨지고 URL이나 처리 요청으로 직접 접근해도 차단됩니다.</p></aside>
        <div class="department-task-grid">${taskLinks.map((link) => `<a href="${escapeHtml(link.href)}"><span aria-hidden="true">${escapeHtml(link.icon)}</span><div><strong>${escapeHtml(link.label)}</strong><small>${escapeHtml(link.description)}</small></div><b aria-hidden="true">→</b></a>`).join("")}</div>
      </section>`,
    });
  }
  const [year, month] = dashboard.month.split("-").map(Number);
  const lowStockItems = dashboard.lowStockItems.map((item) => `<article class="dashboard-stock-row" data-dashboard-low-stock>
    <div class="dashboard-row-heading"><div><span class="record-code">${escapeHtml(item.code)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || "분류 미등록")} · ${escapeHtml(item.unit)}</small></div><span class="dashboard-alert-badge">${item.shortageQuantity > 0 ? `${escapeHtml(formatQuantity(item.shortageQuantity, item.unit))} 부족` : "안전재고 도달"}</span></div>
    <div class="dashboard-stock-numbers"><span>현재 <strong>${escapeHtml(formatQuantity(item.totalStock, item.unit))}</strong></span><span>안전재고 <strong>${escapeHtml(formatQuantity(item.safetyStock, item.unit))}</strong></span></div>
    <div class="dashboard-warehouse-line"><span>서울 ${escapeHtml(formatQuantity(item.stockByWarehouse.seoul, item.unit))}</span><span>인천 ${escapeHtml(formatQuantity(item.stockByWarehouse.incheon, item.unit))}</span><span>부산 ${escapeHtml(formatQuantity(item.stockByWarehouse.busan, item.unit))}</span></div>
  </article>`).join("");
  const recentSales = dashboard.recentSales.map((sale) => `<article class="dashboard-money-row" data-dashboard-sale>
    <div><span class="record-code">${escapeHtml(sale.documentNumber)}</span><strong>${escapeHtml(sale.customerName)}</strong><small>${escapeHtml(formatDate(sale.occurredAt))} · ${escapeHtml(sale.warehouseName)}</small></div>
    <strong>${escapeHtml(formatMoney(sale.amount))}</strong>
  </article>`).join("");
  const receivableOrders = dashboard.receivableOrders.map((order) => `<article class="dashboard-money-row receivable" data-dashboard-receivable>
    <div><span class="record-code">${escapeHtml(order.number)}</span><strong>${escapeHtml(order.customerName)}</strong><small>${escapeHtml(order.lastShippedAt ? formatDate(order.lastShippedAt) : order.orderDate)} · ${escapeHtml(order.warehouseName)}</small></div>
    <strong>${escapeHtml(formatMoney(order.receivableAmount))}</strong>
  </article>`).join("");

  return workspacePage({
    title: "대표 대시보드",
    active: "home",
    user,
    csrfToken,
    content: `<section class="executive-dashboard">
      <header class="dashboard-heading">
        <div><p class="form-kicker">MORNING BRIEF</p><h1>${escapeHtml(user.displayName)}님, 오늘 볼 숫자입니다.</h1><p>${escapeHtml(formatDate(asOfDate))} · OhMyVibeERP 실제 업무 데이터 기준</p></div>
        <div class="dashboard-date"><span>${year}</span><strong>${String(month).padStart(2, "0")}</strong><small>MONTH</small></div>
      </header>

      <section class="dashboard-kpis" aria-label="대표 핵심 지표">
        <a class="dashboard-kpi low-stock" href="/inventory" data-dashboard-kpi="low-stock"><span><i aria-hidden="true">!</i> 재고 부족</span><strong>${dashboard.lowStockCount.toLocaleString("ko-KR")}<small>개 품목</small></strong><p>전체 ${dashboard.totalItemCount.toLocaleString("ko-KR")}개 중 안전재고 이하 <b>재고 보기 →</b></p></a>
        <a class="dashboard-kpi monthly-sales" href="/reports/monthly?month=${escapeHtml(dashboard.month)}" data-dashboard-kpi="monthly-sales"><span><i aria-hidden="true">↗</i> ${month}월 매출</span><strong>${escapeHtml(formatMoney(dashboard.monthlySalesAmount))}</strong><p>이번 달 실제 출고 ${dashboard.monthlyShipmentCount.toLocaleString("ko-KR")}건 <b>매출 근거 →</b></p></a>
        <a class="dashboard-kpi outstanding" href="/settlements" data-dashboard-kpi="receivable"><span><i aria-hidden="true">₩</i> 받을 돈</span><strong>${escapeHtml(formatMoney(dashboard.outstandingReceivableAmount))}</strong><p>출고액에서 입금액을 뺀 잔액 ${dashboard.receivableOrderCount.toLocaleString("ko-KR")}건 <b>정산 보기 →</b></p></a>
      </section>

      <aside class="dashboard-basis"><span aria-hidden="true">i</span><p><strong>숫자 기준</strong> 매출은 한국 시간 이번 달의 실제 출고액입니다. 받을 돈은 실제 출고액에서 재무가 기록한 입금액을 뺀 현재 잔액입니다.</p></aside>

      <div class="dashboard-detail-grid">
        <section class="dashboard-panel stock-panel" aria-labelledby="dashboard-stock-title">
          <header><div><p>STOCK ALERT</p><h2 id="dashboard-stock-title">먼저 채워야 할 재고</h2></div><a href="/inventory">전체 재고</a></header>
          <div class="dashboard-panel-list">${lowStockItems || `<div class="dashboard-empty"><span aria-hidden="true">✓</span><strong>안전재고 이하 품목이 없습니다.</strong><p>전체 창고 합계가 안전재고보다 높습니다.</p></div>`}</div>
        </section>

        <div class="dashboard-money-stack">
          <section class="dashboard-panel" aria-labelledby="dashboard-sales-title">
            <header><div><p>MONTHLY SALES</p><h2 id="dashboard-sales-title">이번 달 최근 매출</h2></div><a href="/reports/monthly?month=${escapeHtml(dashboard.month)}">월간 보고서</a></header>
            <div class="dashboard-panel-list compact">${recentSales || `<div class="dashboard-empty compact"><strong>이번 달 출고 매출이 없습니다.</strong><p>출고 처리 후 자동 표시됩니다.</p></div>`}</div>
          </section>

          <section class="dashboard-panel" aria-labelledby="dashboard-receivable-title">
            <header><div><p>RECEIVABLES</p><h2 id="dashboard-receivable-title">받을 돈이 남은 주문</h2></div><a href="/settlements">입금 처리</a></header>
            <div class="dashboard-panel-list compact">${receivableOrders || `<div class="dashboard-empty compact"><strong>받을 금액이 없습니다.</strong><p>출고된 판매 주문이 아직 없습니다.</p></div>`}</div>
          </section>
        </div>
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

export function inventoryPage({
  user,
  csrfToken,
  items,
  warehouses,
  transfers = [],
  counts = [],
  suppliers = [],
  replenishments = [],
  values = {},
  fieldErrors = {},
  error = "",
  countValues = {},
  countFieldErrors = {},
  countError = "",
  replenishmentValues = {},
  replenishmentFieldErrors = {},
  replenishmentError = "",
  transferred = false,
  counted = false,
  replenishmentOrdered = false,
  today = "",
}) {
  const canTransfer = canAccess(user, PERMISSIONS.INVENTORY_TRANSFER);
  const canCount = canAccess(user, PERMISSIONS.INVENTORY_COUNT);
  const canCreatePurchase = canAccess(user, PERMISSIONS.PURCHASE_ORDERS_CREATE);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const transferLines = Array.from({ length: 6 }, (_, index) => values.lines?.[index] ?? {});
  const countLines = Array.from({ length: 6 }, (_, index) => countValues.lines?.[index] ?? {});
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
  const warehouseOptions = (selectedId) => warehouses.map((warehouse) => (
    `<option value="${escapeHtml(warehouse.id)}"${selectedId === warehouse.id ? " selected" : ""}>${escapeHtml(warehouse.name)}</option>`
  )).join("");
  const supplierOptions = (selectedId) => suppliers.map((supplier) => (
    `<option value="${escapeHtml(supplier.id)}"${selectedId === supplier.id ? " selected" : ""}>${escapeHtml(supplier.code)} · ${escapeHtml(supplier.name)}</option>`
  )).join("");
  const itemOptions = (selectedId) => items.map((item) => (
    `<option value="${escapeHtml(item.id)}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.code)} · ${escapeHtml(item.name)} (${warehouses.map((warehouse) => `${warehouse.location} ${formatQuantity(item.stockByWarehouse[warehouse.id], item.unit)}`).join(" · ")})</option>`
  )).join("");
  const transferRows = transfers.map((transfer) => {
    const source = warehouseMap.get(transfer.sourceWarehouseId);
    const destination = warehouseMap.get(transfer.destinationWarehouseId);
    const lineDetails = transfer.lines.map((line) => {
      const item = itemMap.get(line.itemId);
      return `<div><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><span>${escapeHtml(item?.code ?? line.itemId)} · ${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))}</span></div>`;
    }).join("");
    return `<tr data-inventory-transfer="${escapeHtml(transfer.number)}">
      <td><strong class="record-code">${escapeHtml(transfer.number)}</strong><small>${escapeHtml(formatKoreanDateTime(transfer.transferredAt))}</small></td>
      <td><strong>${escapeHtml(formatDate(transfer.transferDate))}</strong></td>
      <td><span class="transfer-route"><b>${escapeHtml(source?.name ?? transfer.sourceWarehouseId)}</b><i aria-hidden="true">→</i><b>${escapeHtml(destination?.name ?? transfer.destinationWarehouseId)}</b></span></td>
      <td class="transfer-line-details">${lineDetails}</td>
      <td>${escapeHtml(transfer.note || "이동 메모 없음")}</td>
    </tr>`;
  }).join("");
  const countRows = counts.map((count) => {
    const warehouse = warehouseMap.get(count.warehouseId);
    const lineDetails = count.lines.map((line) => {
      const item = itemMap.get(line.itemId);
      const unit = item?.unit ?? "";
      const difference = Number(line.differenceQuantity || 0);
      const signedDifference = `${difference > 0 ? "+" : ""}${formatQuantity(difference, unit)}`;
      const differenceClass = difference > 0 ? "positive" : difference < 0 ? "negative" : "zero";
      return `<div><strong>${escapeHtml(item?.name ?? "삭제된 품목")}<small>${escapeHtml(item?.code ?? line.itemId)}</small></strong><span>장부 ${escapeHtml(formatQuantity(line.bookQuantity, unit))}</span><span>실사 ${escapeHtml(formatQuantity(line.actualQuantity, unit))}</span><b class="count-difference ${differenceClass}">${escapeHtml(signedDifference)}</b></div>`;
    }).join("");
    return `<tr data-inventory-count="${escapeHtml(count.number)}">
      <td><strong class="record-code">${escapeHtml(count.number)}</strong><small>${escapeHtml(formatKoreanDateTime(count.adjustedAt))}</small></td>
      <td><strong>${escapeHtml(formatDate(count.countDate))}</strong><small>${escapeHtml(warehouse?.name ?? count.warehouseId)}</small></td>
      <td class="count-line-details">${lineDetails}</td>
      <td><strong>${escapeHtml(count.adjustedBy || "처리자 미상")}</strong><small>조정 처리자</small></td>
      <td>${escapeHtml(count.note || "실사 메모 없음")}</td>
    </tr>`;
  }).join("");
  const replenishmentCards = replenishments.map((suggestion) => {
    const isErrorTarget = replenishmentValues.itemId === suggestion.itemId;
    const rowValues = isErrorTarget ? replenishmentValues : {
      supplierId: "",
      warehouseId: suggestion.suggestedWarehouseId,
      expectedDate: "",
      unitPrice: suggestion.purchasePrice,
      note: "안전재고 자동 발주",
    };
    const rowErrors = isErrorTarget ? replenishmentFieldErrors : {};
    let action;
    if (suggestion.suggestedQuantity <= 0) {
      action = `<div class="replenishment-covered"><span aria-hidden="true">✓</span><p><strong>추가 발주 불필요</strong> 진행 중인 미입고 발주로 안전재고를 채울 수 있습니다.</p></div>`;
    } else if (!canCreatePurchase) {
      action = `<div class="replenishment-restricted"><span aria-hidden="true">i</span><p><strong>구매 부서 발주 필요</strong> 권장량을 구매 담당자에게 전달해 주세요.</p></div>`;
    } else if (!suppliers.length) {
      action = `<div class="replenishment-restricted"><span aria-hidden="true">!</span><p><strong>구매처를 먼저 등록해 주세요.</strong> <a href="/partners/purchases">구매처 등록 바로가기 →</a></p></div>`;
    } else {
      action = `<form action="/inventory/replenishments" method="post" class="replenishment-order-form">
        <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
        <input type="hidden" name="itemId" value="${escapeHtml(suggestion.itemId)}">
        <input type="hidden" name="orderDate" value="${escapeHtml(today)}">
        <label>구매처 <b>*</b><select name="supplierId" required${inputState("supplierId", rowErrors)}><option value="">구매처 선택</option>${supplierOptions(rowValues.supplierId)}</select>${fieldError("supplierId", rowErrors)}</label>
        <label>입고 창고 <b>*</b><select name="warehouseId" required${inputState("warehouseId", rowErrors)}>${warehouseOptions(rowValues.warehouseId)}</select>${fieldError("warehouseId", rowErrors)}</label>
        <label>입고 예정일<input name="expectedDate" type="date" value="${escapeHtml(rowValues.expectedDate)}" min="${escapeHtml(today)}"${inputState("expectedDate", rowErrors)}>${fieldError("expectedDate", rowErrors)}</label>
        <label>발주 단가<input name="unitPrice" type="number" value="${escapeHtml(rowValues.unitPrice)}" min="0" max="999999999999" step="1" inputmode="numeric"${inputState("line0UnitPrice", rowErrors)}>${fieldError("line0UnitPrice", rowErrors)}</label>
        <label>메모<input name="note" value="${escapeHtml(rowValues.note)}" maxlength="500"></label>
        <button type="submit"><span>권장 ${escapeHtml(formatQuantity(suggestion.suggestedQuantity, suggestion.unit))}</span> 바로 발주 <b aria-hidden="true">→</b></button>
      </form>`;
    }
    return `<article class="replenishment-item" data-replenishment-item="${escapeHtml(suggestion.itemId)}">
      <header><div><span class="record-code">${escapeHtml(suggestion.itemCode)}</span><h3>${escapeHtml(suggestion.itemName)}</h3></div><strong>${suggestion.suggestedQuantity > 0 ? `추가 ${escapeHtml(formatQuantity(suggestion.suggestedQuantity, suggestion.unit))} 권장` : "미입고 발주 진행 중"}</strong></header>
      <div class="replenishment-metrics"><span>현재고<strong>${escapeHtml(formatQuantity(suggestion.totalStock, suggestion.unit))}</strong></span><span>안전재고<strong>${escapeHtml(formatQuantity(suggestion.safetyStock, suggestion.unit))}</strong></span><span>미입고 발주<strong>${escapeHtml(formatQuantity(suggestion.outstandingPurchaseQuantity, suggestion.unit))}</strong></span><span>입고 후 예상<strong>${escapeHtml(formatQuantity(suggestion.projectedStock, suggestion.unit))}</strong></span></div>
      <p class="replenishment-warehouses">서울 ${escapeHtml(formatQuantity(suggestion.stockByWarehouse.seoul, suggestion.unit))} · 인천 ${escapeHtml(formatQuantity(suggestion.stockByWarehouse.incheon, suggestion.unit))} · 부산 ${escapeHtml(formatQuantity(suggestion.stockByWarehouse.busan, suggestion.unit))}</p>
      ${action}
    </article>`;
  }).join("");
  const notice = error || countError || replenishmentError
    ? `<div class="form-notice error" role="alert">${escapeHtml(error || countError || replenishmentError)}</div>`
    : transferred
      ? `<div class="form-notice success" role="status">창고 이동을 완료해 출발·도착 재고를 함께 반영했습니다.</div>`
      : counted
        ? `<div class="form-notice success" role="status">재고 실사를 반영했습니다. 장부·실사·차이와 처리 이력을 함께 보관합니다.</div>`
        : replenishmentOrdered
          ? `<div class="form-notice success" role="status">권장 발주를 등록했습니다. 미입고 수량을 반영해 추가 권장량을 다시 계산했습니다.</div>`
      : "";

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

      ${notice}

      <section class="inventory-replenishment" aria-labelledby="inventory-replenishment-title">
        <header><div><p>AUTO REPLENISHMENT</p><h2 id="inventory-replenishment-title">안전재고 자동 발주 제안</h2><span>전체 현재고와 이미 발주한 미입고 수량을 합산해 추가로 필요한 수량만 권장합니다.</span></div><strong>${replenishments.length}<small>개 부족 품목</small></strong></header>
        ${replenishmentCards ? `<div class="replenishment-list">${replenishmentCards}</div>` : `<div class="replenishment-empty"><span aria-hidden="true">✓</span><strong>안전재고 아래로 떨어진 품목이 없습니다.</strong><p>현재고가 안전재고 미만이 되면 품목과 추가 권장 발주량이 자동으로 표시됩니다.</p></div>`}
      </section>

      ${canTransfer ? `<details class="inventory-transfer-create"${!transfers.length || error ? " open" : ""}>
        <summary><span><i>MOVE</i><strong>창고 간 재고 이동</strong></span><em>출발 차감 · 도착 증가 동시 처리</em></summary>
        <form action="/inventory/transfers" method="post" class="inventory-transfer-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
          <div class="transfer-form-header">
            <label>출발 창고 <b>*</b><select name="sourceWarehouseId" required${inputState("sourceWarehouseId", fieldErrors)}><option value="">출발 창고 선택</option>${warehouseOptions(values.sourceWarehouseId)}</select>${fieldError("sourceWarehouseId", fieldErrors)}</label>
            <span class="transfer-direction" aria-hidden="true">→</span>
            <label>도착 창고 <b>*</b><select name="destinationWarehouseId" required${inputState("destinationWarehouseId", fieldErrors)}><option value="">도착 창고 선택</option>${warehouseOptions(values.destinationWarehouseId)}</select>${fieldError("destinationWarehouseId", fieldErrors)}</label>
            <label>이동일 <b>*</b><input name="transferDate" type="date" value="${escapeHtml(values.transferDate)}" required${inputState("transferDate", fieldErrors)}>${fieldError("transferDate", fieldErrors)}</label>
          </div>
          ${fieldErrors.lines ? `<div class="inline-error">${escapeHtml(fieldErrors.lines)}</div>` : ""}
          <div class="transfer-lines"><div class="transfer-line transfer-line-head"><span>이동 품목</span><span>수량</span></div>
            ${transferLines.map((line, index) => `<div class="transfer-line"><label><span class="sr-only">${index + 1}번 이동 품목</span><select name="lineItemId"${inputState(`line${index}ItemId`, fieldErrors)}><option value="">품목 선택</option>${itemOptions(line.itemId)}</select>${fieldError(`line${index}ItemId`, fieldErrors)}</label><label><span class="sr-only">${index + 1}번 이동 수량</span><input name="lineQuantity" type="number" value="${escapeHtml(line.quantity)}" placeholder="0" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState(`line${index}Quantity`, fieldErrors)}>${fieldError(`line${index}Quantity`, fieldErrors)}</label></div>`).join("")}
          </div>
          <div class="transfer-form-footer"><input name="note" value="${escapeHtml(values.note)}" placeholder="운송·이동 메모 (선택)" maxlength="300"><button type="submit"${!items.length ? " disabled" : ""}>이동 처리 <span aria-hidden="true">→</span></button></div>
        </form>
      </details>` : `<aside class="inventory-transfer-role-note"><span aria-hidden="true">i</span><p><strong>창고 이동 처리는 물류 부서 업무입니다.</strong> 현재고와 이동 이력은 조회할 수 있습니다.</p></aside>`}

      ${canCount ? `<details class="inventory-transfer-create inventory-count-create"${countError ? " open" : ""}>
        <summary><span><i>COUNT</i><strong>재고 실사·조정</strong></span><em>저장 전 장부 수량 고정 · 실사 수량으로 즉시 조정</em></summary>
        <form action="/inventory/counts" method="post" class="inventory-transfer-form inventory-count-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
          <div class="count-form-warning"><span aria-hidden="true">!</span><p><strong>저장 즉시 선택 창고의 재고가 실사 수량으로 바뀝니다.</strong> 저장 직전 장부 수량과 차이, 처리자, 처리 시각은 수정할 수 없는 이력으로 남습니다.</p></div>
          <div class="count-form-header">
            <label>실사 창고 <b>*</b><select name="warehouseId" required${inputState("warehouseId", countFieldErrors)}><option value="">실사 창고 선택</option>${warehouseOptions(countValues.warehouseId)}</select>${fieldError("warehouseId", countFieldErrors)}</label>
            <label>실사일 <b>*</b><input name="countDate" type="date" value="${escapeHtml(countValues.countDate)}" required${inputState("countDate", countFieldErrors)}>${fieldError("countDate", countFieldErrors)}</label>
          </div>
          ${countFieldErrors.lines ? `<div class="inline-error">${escapeHtml(countFieldErrors.lines)}</div>` : ""}
          <div class="transfer-lines count-lines"><div class="transfer-line transfer-line-head"><span>실사 품목 · 현재 창고별 장부 재고</span><span>실사 수량</span></div>
            ${countLines.map((line, index) => `<div class="transfer-line"><label><span class="sr-only">${index + 1}번 실사 품목</span><select name="countLineItemId"${inputState(`line${index}ItemId`, countFieldErrors)}><option value="">품목 선택</option>${itemOptions(line.itemId)}</select>${fieldError(`line${index}ItemId`, countFieldErrors)}</label><label><span class="sr-only">${index + 1}번 실사 수량</span><input name="countActualQuantity" type="number" value="${escapeHtml(line.actualQuantity)}" placeholder="0 포함 실제 수량" min="0" max="999999999" step="0.01" inputmode="decimal"${inputState(`line${index}ActualQuantity`, countFieldErrors)}>${fieldError(`line${index}ActualQuantity`, countFieldErrors)}</label></div>`).join("")}
          </div>
          <div class="transfer-form-footer"><input name="note" value="${escapeHtml(countValues.note)}" placeholder="차이 사유·실사 메모 (선택)" maxlength="300"><button type="submit"${!items.length ? " disabled" : ""}>실사 반영 <span aria-hidden="true">→</span></button></div>
        </form>
      </details>` : ""}

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

      <section class="inventory-table-card inventory-transfer-history" aria-labelledby="inventory-transfer-history-title">
        <div class="list-heading"><div><p>TRANSFER HISTORY</p><h2 id="inventory-transfer-history-title">창고 이동 이력</h2></div><strong>${transfers.length}<small>건 이동</small></strong></div>
        ${transferRows ? `<div class="table-scroll"><table><thead><tr><th>이동 번호·처리 시각</th><th>이동일</th><th>출발 → 도착</th><th>품목·수량</th><th>메모</th></tr></thead><tbody>${transferRows}</tbody></table></div>` : `<div class="inventory-transfer-empty"><span aria-hidden="true">⇄</span><strong>창고 이동 이력이 없습니다.</strong><p>물류 담당자가 이동을 처리하면 양쪽 재고와 근거가 여기에 함께 남습니다.</p></div>`}
      </section>

      <section class="inventory-table-card inventory-count-history" aria-labelledby="inventory-count-history-title">
        <div class="list-heading"><div><p>COUNT &amp; ADJUSTMENT HISTORY</p><h2 id="inventory-count-history-title">재고 실사·조정 이력</h2></div><strong>${counts.length}<small>건 실사</small></strong></div>
        ${countRows ? `<div class="table-scroll"><table><thead><tr><th>실사 번호·처리 시각</th><th>실사일·창고</th><th>품목별 장부 → 실사 · 차이</th><th>처리자</th><th>메모</th></tr></thead><tbody>${countRows}</tbody></table></div>` : `<div class="inventory-transfer-empty"><span aria-hidden="true">✓</span><strong>재고 실사 이력이 없습니다.</strong><p>실사 수량을 반영하면 조정 전 장부 수량과 차이, 처리자가 여기에 남습니다.</p></div>`}
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
  returned = false,
  today = "",
  receiptOrderId = "",
  returnOrderId = "",
}) {
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const lines = Array.from({ length: 5 }, (_, index) => values.lines?.[index] ?? {});
  const prerequisitesReady = suppliers.length > 0 && items.length > 0;
  const canCreatePurchase = canAccess(user, PERMISSIONS.PURCHASE_ORDERS_CREATE);
  const canReceive = canAccess(user, PERMISSIONS.PURCHASE_RECEIVE);
  const canReturn = canAccess(user, PERMISSIONS.PURCHASE_RETURN);
  const canViewPurchaseAmounts = canCreatePurchase;

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
      const returnErrors = returnOrderId === order.id ? fieldErrors : {};
      const orderLines = order.lines.map((line) => {
        const item = itemMap.get(line.itemId);
        const remaining = Math.round((line.quantity - line.receivedQuantity) * 100) / 100;
        const netReceived = Math.round((line.receivedQuantity - line.returnedQuantity) * 100) / 100;
        return `<tr>
          <td><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><small>${escapeHtml(item?.code ?? line.itemId)} · ${escapeHtml(item?.unit ?? "")}</small></td>
          <td>${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))}</td>
          <td><strong class="received-quantity">${escapeHtml(formatQuantity(line.receivedQuantity, item?.unit ?? ""))}</strong></td>
          <td><strong>${escapeHtml(formatQuantity(line.returnedQuantity, item?.unit ?? ""))}</strong></td>
          <td>${escapeHtml(formatQuantity(netReceived, item?.unit ?? ""))}</td>
          <td>${escapeHtml(formatQuantity(remaining, item?.unit ?? ""))}</td>
          <td class="number-cell">${canViewPurchaseAmounts ? escapeHtml(formatMoney(line.unitPrice)) : "—"}</td>
          <td class="number-cell">${canViewPurchaseAmounts ? escapeHtml(formatMoney(line.quantity * line.unitPrice)) : "—"}</td>
        </tr>`;
      }).join("");
      const receiptFields = order.status !== "received" && !canReceive
        ? `<div class="restricted-action"><span aria-hidden="true">↙</span><div><strong>입고 처리는 물류 부서 업무입니다.</strong><p>발주 내용은 조회할 수 있지만 재고 반영은 물류 계정에서만 실행합니다.</p></div></div>`
        : order.status !== "received"
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

      const hasReturnableQuantity = order.lines.some((line) => line.receivedQuantity - line.returnedQuantity > 0);
      const returnFields = !hasReturnableQuantity
        ? ""
        : !canReturn
          ? `<div class="restricted-action"><span aria-hidden="true">↗</span><div><strong>구매 반품 출고는 물류 부서 업무입니다.</strong><p>반품 이력과 금액은 조회할 수 있지만 창고 재고 차감은 물류 계정에서만 실행합니다.</p></div></div>`
          : `<form action="/purchase-orders/${escapeHtml(order.id)}/return" method="post" class="receipt-form return-form purchase-return-form">
              <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
              <div class="receipt-heading"><div><span>PURCHASE RETURN</span><h3>구매 반품 출고</h3></div><p>불량품을 공급처로 보내면 ${escapeHtml(warehouse?.name ?? "입고 창고")} 재고와 줄 돈이 함께 줄어듭니다.</p></div>
              ${returnErrors.return ? `<div class="inline-error">${escapeHtml(returnErrors.return)}</div>` : ""}
              <div class="receipt-inputs">
                ${order.lines.map((line) => {
                  const item = itemMap.get(line.itemId);
                  const returnable = Math.round((line.receivedQuantity - line.returnedQuantity) * 100) / 100;
                  if (returnable <= 0) return "";
                  const available = Number(item?.stockByWarehouse?.[order.warehouseId] || 0);
                  const field = `return_${line.id}`;
                  return `<label><span>${escapeHtml(item?.name ?? "품목")} <small>반품 가능 ${escapeHtml(formatQuantity(returnable, item?.unit ?? ""))} · 재고 ${escapeHtml(formatQuantity(available, item?.unit ?? ""))}</small></span>
                    <input name="${escapeHtml(field)}" type="number" placeholder="0" min="0" max="${escapeHtml(Math.min(returnable, available))}" step="0.01" inputmode="decimal"${inputState(field, returnErrors)}>
                    ${fieldError(field, returnErrors)}
                  </label>`;
                }).join("")}
              </div>
              <div class="receipt-actions return-actions"><label>반품일<input name="returnDate" type="date" value="${escapeHtml(today)}" required${inputState("returnDate", returnErrors)}>${fieldError("returnDate", returnErrors)}</label><input name="returnNote" placeholder="불량 사유·반품 메모 (선택)" maxlength="300"><button type="submit">반품 출고 <span aria-hidden="true">→</span></button></div>
            </form>`;
      const returnHistory = order.returns.length
        ? `<section class="return-history"><h3>구매 반품 이력 <small>${order.returns.length.toLocaleString("ko-KR")}건</small></h3>${order.returns.map((returnRecord) => `<article data-return-record="${escapeHtml(returnRecord.number)}"><header><strong>${escapeHtml(returnRecord.number)}</strong><span>${escapeHtml(formatDate(returnRecord.returnDate))}${canViewPurchaseAmounts ? ` · ${escapeHtml(formatMoney(returnRecord.amount))}` : ""}</span></header><p>${returnRecord.lines.map((returnLine) => { const line = order.lines.find(({ id }) => id === returnLine.lineId); const item = itemMap.get(line?.itemId); return `${escapeHtml(item?.name ?? "삭제된 품목")} ${escapeHtml(formatQuantity(returnLine.quantity, item?.unit ?? ""))}`; }).join(" · ")}</p><small>${escapeHtml(returnRecord.note || "반품 메모 없음")}</small></article>`).join("")}</section>`
        : "";

      return `<article class="purchase-order-card">
        <header>
          <div><span class="order-number">${escapeHtml(order.number)}</span><h2>${escapeHtml(supplier?.name ?? "알 수 없는 구매처")}</h2><p>${escapeHtml(supplier?.code ?? "")} · ${escapeHtml(warehouse?.name ?? order.warehouseId)} 입고</p></div>
          <div class="order-meta"><span class="order-status ${status.className}">${status.label}</span><dl><div><dt>발주일</dt><dd>${escapeHtml(formatDate(order.orderDate))}</dd></div><div><dt>입고 예정</dt><dd>${escapeHtml(order.expectedDate ? formatDate(order.expectedDate) : "미정")}</dd></div></dl></div>
        </header>
        <div class="table-scroll"><table class="order-lines-table"><thead><tr><th>품목</th><th>발주</th><th>입고</th><th>반품</th><th>순입고</th><th>미입고</th><th>단가</th><th>금액</th></tr></thead><tbody>${orderLines}</tbody></table></div>
        <div class="order-total"><span>${escapeHtml(order.note || "메모 없음")}</span>${canViewPurchaseAmounts ? `<div><p>발주합계 <strong>${escapeHtml(formatMoney(order.totalAmount))}</strong></p><p>입고금액 <strong>${escapeHtml(formatMoney(order.receivedAmount))}</strong></p><p>반품금액 <strong>${escapeHtml(formatMoney(order.returnedAmount))}</strong></p><p>순매입 <strong>${escapeHtml(formatMoney(order.netPurchaseAmount))}</strong></p><p>지급금액 <strong>${escapeHtml(formatMoney(order.paidAmount))}</strong></p><p class="payable-amount">줄 금액 <strong>${escapeHtml(formatMoney(order.payableAmount))}</strong></p>${order.supplierRefundReceivableAmount > 0 ? `<p class="receivable-amount">공급처 환급 예정 <strong>${escapeHtml(formatMoney(order.supplierRefundReceivableAmount))}</strong></p>` : ""}</div>` : "발주 금액은 구매 부서 전용"}</div>
        ${receiptFields}
        ${returnFields}
        ${returnHistory}
      </article>`;
    }).join("")
    : `<div class="order-empty"><span aria-hidden="true">▦</span><h2>등록된 발주가 없습니다.</h2><p>구매처와 입고 창고를 선택해 첫 발주를 등록해 보세요.</p></div>`;

  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">발주 등록을 완료했습니다.</div>`
      : received
        ? `<div class="form-notice success" role="status">입고 수량을 재고에 반영했습니다.</div>`
        : returned
          ? `<div class="form-notice success" role="status">구매 반품을 출고하고 재고와 줄 돈을 차감했습니다.</div>`
        : "";

  return workspacePage({
    title: "발주 관리",
    active: "purchase-orders",
    user,
    csrfToken,
    content: `<section class="purchase-content">
      <header class="purchase-heading"><div><p class="form-kicker">PURCHASE ORDER</p><h1>발주 관리</h1><p>구매처에 발주하고 입고된 수량을 창고 재고에 바로 반영합니다.</p></div><span><b>${orders.length}</b>건 발주</span></header>
      ${notice}
      ${canCreatePurchase && !prerequisitesReady ? `<div class="prerequisite-notice"><strong>발주 전에 기준정보가 필요합니다.</strong><p>${!suppliers.length ? "구매처" : ""}${!suppliers.length && !items.length ? "와 " : ""}${!items.length ? "품목" : ""}을 먼저 등록해 주세요.</p></div>` : ""}

      ${canCreatePurchase ? `<details class="purchase-create"${!orders.length || error && !receiptOrderId && !returnOrderId ? " open" : ""}>
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
      </details>` : ""}

      <section class="orders-section"><div class="orders-title"><p>ORDER HISTORY</p><h2>발주·입고·반품 현황</h2></div>${orderCards}</section>
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
          <fieldset><legend>월 급여 기준</legend><p>소득세·4대 보험은 급여 확정 시 자동 추정 공제됩니다. 여기에는 그 외 회사 고정 공제(상조회비 등) 총액만 등록하세요.</p><div class="employee-form-grid salary">
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
    const legacyRun = run.totalStatutoryDeduction === undefined;
    const lineRows = run.lines.map((line) => {
      const legacyLine = line.statutoryDeduction === undefined;
      const withholding = legacyLine ? null : line.incomeTax + line.localIncomeTax;
      const insurance = legacyLine
        ? null
        : line.nationalPension + line.healthInsurance + line.longTermCareInsurance + line.employmentInsurance;
      return `<tr data-payroll-line>
      <td><strong class="record-code">${escapeHtml(line.employeeNumber)}</strong></td>
      <td><strong>${escapeHtml(line.name)}</strong><small>${escapeHtml(line.department)} · ${escapeHtml(line.position)}</small></td>
      <td class="number-cell"><strong>${escapeHtml(formatMoney(line.grossPay))}</strong></td>
      <td class="number-cell deduction-cell">${legacyLine ? "—" : `-${escapeHtml(formatMoney(withholding))}`}</td>
      <td class="number-cell deduction-cell">${legacyLine ? "—" : `-${escapeHtml(formatMoney(insurance))}`}</td>
      <td class="number-cell deduction-cell">-${escapeHtml(formatMoney(line.fixedDeduction))}</td>
      <td class="number-cell net-pay-cell"><strong>${escapeHtml(formatMoney(line.netPay))}</strong></td>
      <td><a class="statement-link" href="/payroll/${escapeHtml(run.id)}/statements?employee=${escapeHtml(line.employeeId)}" target="_blank" rel="noopener">개인 명세</a></td>
    </tr>`;
    }).join("");
    const [year, month] = run.payPeriod.split("-").map(Number);
    return `<article class="payroll-run-card">
      <header><div><span class="order-number">${escapeHtml(run.number)}</span><h2>${year}년 ${month}월 급여대장</h2><p>급여일 ${escapeHtml(formatDate(run.payDate))} · ${run.employeeCount.toLocaleString("ko-KR")}명</p></div><div class="payroll-run-actions"><span class="order-status received">확정</span><a href="/payroll/${escapeHtml(run.id)}/statements" target="_blank" rel="noopener">${run.employeeCount.toLocaleString("ko-KR")}명 명세서 전체 출력</a></div></header>
      <div class="payroll-totals"><div><span>지급 합계</span><strong>${escapeHtml(formatMoney(run.totalGrossPay))}</strong></div><div><span>법정 공제 합계(추정)</span><strong>${legacyRun ? "확정 당시 미계산" : escapeHtml(formatMoney(run.totalStatutoryDeduction))}</strong></div><div><span>등록 공제 합계</span><strong>${escapeHtml(formatMoney(legacyRun ? run.totalDeduction : run.totalFixedDeduction))}</strong></div><div><span>실지급 합계</span><strong>${escapeHtml(formatMoney(run.totalNetPay))}</strong></div></div>
      <details class="payroll-lines"${runIndex === 0 ? " open" : ""}><summary>직원별 급여 내역 ${run.employeeCount.toLocaleString("ko-KR")}건 보기</summary><div class="table-scroll"><table><thead><tr><th>직원번호</th><th>직원</th><th>지급 합계</th><th>소득세·지방세</th><th>4대 보험</th><th>등록 공제</th><th>실지급액</th><th>출력</th></tr></thead><tbody>${lineRows}</tbody></table></div></details>
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
      <aside class="payroll-caution"><span aria-hidden="true">!</span><p><strong>소득세·지방소득세·4대 보험 근로자 부담분을 개략 추정해 자동 공제합니다.</strong> 비과세 식대(월 20만 원)를 제외한 과세 급여 기준이며 간이세액표·부양가족·연말정산·보험료 정산은 반영하지 않습니다. 실제 지급 전 세무·노무 담당자가 반드시 확인하세요.</p></aside>

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
  const slips = lines.map((line) => {
    const legacyLine = line.statutoryDeduction === undefined;
    const deductionRows = legacyLine
      ? `<div><dt>등록 공제액</dt><dd>${escapeHtml(formatMoney(line.fixedDeduction))}</dd></div><div class="slip-spacer"><dt>공제 기준</dt><dd>직원 명부 등록액</dd></div><div class="subtotal"><dt>공제 합계</dt><dd>${escapeHtml(formatMoney(line.fixedDeduction))}</dd></div>`
      : `<div><dt>소득세(추정)</dt><dd>${escapeHtml(formatMoney(line.incomeTax))}</dd></div><div><dt>지방소득세(추정)</dt><dd>${escapeHtml(formatMoney(line.localIncomeTax))}</dd></div><div><dt>국민연금</dt><dd>${escapeHtml(formatMoney(line.nationalPension))}</dd></div><div><dt>건강보험</dt><dd>${escapeHtml(formatMoney(line.healthInsurance))}</dd></div><div><dt>장기요양보험</dt><dd>${escapeHtml(formatMoney(line.longTermCareInsurance))}</dd></div><div><dt>고용보험</dt><dd>${escapeHtml(formatMoney(line.employmentInsurance))}</dd></div><div><dt>등록 공제액</dt><dd>${escapeHtml(formatMoney(line.fixedDeduction))}</dd></div><div class="subtotal"><dt>공제 합계</dt><dd>${escapeHtml(formatMoney(line.totalDeduction))}</dd></div>`;
    return `<article class="payroll-slip" data-payroll-statement>
    <header><div><p>OhMyVibeERP</p><h1>${year}년 ${month}월 급여명세서</h1></div><span>${escapeHtml(run.number)}</span></header>
    <dl class="slip-employee"><div><dt>직원번호</dt><dd>${escapeHtml(line.employeeNumber)}</dd></div><div><dt>성명</dt><dd>${escapeHtml(line.name)}</dd></div><div><dt>부서·직급</dt><dd>${escapeHtml(line.department)} · ${escapeHtml(line.position)}</dd></div><div><dt>급여일</dt><dd>${escapeHtml(formatDate(run.payDate))}</dd></div></dl>
    <div class="slip-columns">
      <section><h2>지급 내역</h2><dl><div><dt>기본급</dt><dd>${escapeHtml(formatMoney(line.baseSalary))}</dd></div><div><dt>식대</dt><dd>${escapeHtml(formatMoney(line.mealAllowance))}</dd></div><div><dt>기타 수당</dt><dd>${escapeHtml(formatMoney(line.otherAllowance))}</dd></div><div class="subtotal"><dt>지급 합계</dt><dd>${escapeHtml(formatMoney(line.grossPay))}</dd></div></dl></section>
      <section><h2>공제 내역</h2><dl>${deductionRows}</dl></section>
    </div>
    <div class="slip-net"><span>실지급액</span><strong>${escapeHtml(formatMoney(line.netPay))}</strong></div>
    <footer><p>본 명세서는 OhMyVibeERP 등록 급여 기준으로 생성되었습니다. 소득세·4대 보험 공제액은 간이세액표·부양가족을 반영하지 않은 개략 추정으로, 실제 지급 전 담당자 확인이 필요합니다.</p><span>확정일 ${escapeHtml(formatKoreanDateTime(run.confirmedAt))}</span></footer>
  </article>`;
  }).join("");
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
  returned = false,
  today = "",
  shipmentOrderId = "",
  returnOrderId = "",
}) {
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const lines = Array.from({ length: 5 }, (_, index) => values.lines?.[index] ?? {});
  const prerequisitesReady = customers.length > 0 && items.length > 0;
  const totalReceivable = Math.round(orders.reduce((total, order) => total + Number(order.receivableAmount || 0), 0) * 100) / 100;
  const canCreateSales = canAccess(user, PERMISSIONS.SALES_ORDERS_CREATE);
  const canShip = canAccess(user, PERMISSIONS.SALES_SHIP);
  const canReturn = canAccess(user, PERMISSIONS.SALES_RETURN);
  const canViewSalesAmounts = canCreateSales;

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
      const returnErrors = returnOrderId === order.id ? fieldErrors : {};
      const orderLines = order.lines.map((line) => {
        const item = itemMap.get(line.itemId);
        const remaining = Math.round((line.quantity - line.shippedQuantity) * 100) / 100;
        const netShipped = Math.round((line.shippedQuantity - line.returnedQuantity) * 100) / 100;
        return `<tr>
          <td><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><small>${escapeHtml(item?.code ?? line.itemId)} · ${escapeHtml(item?.unit ?? "")}</small></td>
          <td>${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))}</td>
          <td><strong class="shipped-quantity">${escapeHtml(formatQuantity(line.shippedQuantity, item?.unit ?? ""))}</strong></td>
          <td><strong>${escapeHtml(formatQuantity(line.returnedQuantity, item?.unit ?? ""))}</strong></td>
          <td>${escapeHtml(formatQuantity(netShipped, item?.unit ?? ""))}</td>
          <td>${escapeHtml(formatQuantity(remaining, item?.unit ?? ""))}</td>
          <td class="number-cell">${canViewSalesAmounts ? escapeHtml(formatMoney(line.unitPrice)) : "—"}</td>
          <td class="number-cell">${canViewSalesAmounts ? escapeHtml(formatMoney(line.quantity * line.unitPrice)) : "—"}</td>
        </tr>`;
      }).join("");
      const shipmentFields = order.status !== "shipped" && !canShip
        ? `<div class="restricted-action"><span aria-hidden="true">↗</span><div><strong>출고 처리는 물류 부서 업무입니다.</strong><p>주문 내용은 조회할 수 있지만 재고·받을 금액 반영은 물류 계정에서만 실행합니다.</p></div></div>`
        : order.status !== "shipped"
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

      const hasReturnableQuantity = order.lines.some((line) => line.shippedQuantity - line.returnedQuantity > 0);
      const returnFields = !hasReturnableQuantity
        ? ""
        : !canReturn
          ? `<div class="restricted-action"><span aria-hidden="true">↙</span><div><strong>판매 반품 입고는 물류 부서 업무입니다.</strong><p>반품 이력과 금액은 조회할 수 있지만 창고 재고 증가는 물류 계정에서만 실행합니다.</p></div></div>`
          : `<form action="/sales-orders/${escapeHtml(order.id)}/return" method="post" class="receipt-form return-form sales-return-form">
              <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
              <div class="receipt-heading"><div><span>SALES RETURN</span><h3>판매 반품 입고</h3></div><p>고객에게 돌아온 불량품을 받으면 ${escapeHtml(warehouse?.name ?? "출고 창고")} 재고가 늘고 받을 돈이 줄어듭니다.</p></div>
              ${returnErrors.return ? `<div class="inline-error">${escapeHtml(returnErrors.return)}</div>` : ""}
              <div class="receipt-inputs">
                ${order.lines.map((line) => {
                  const item = itemMap.get(line.itemId);
                  const returnable = Math.round((line.shippedQuantity - line.returnedQuantity) * 100) / 100;
                  if (returnable <= 0) return "";
                  const field = `return_${line.id}`;
                  return `<label><span>${escapeHtml(item?.name ?? "품목")} <small>반품 가능 ${escapeHtml(formatQuantity(returnable, item?.unit ?? ""))}</small></span>
                    <input name="${escapeHtml(field)}" type="number" placeholder="0" min="0" max="${escapeHtml(returnable)}" step="0.01" inputmode="decimal"${inputState(field, returnErrors)}>
                    ${fieldError(field, returnErrors)}
                  </label>`;
                }).join("")}
              </div>
              <div class="receipt-actions return-actions"><label>반품일<input name="returnDate" type="date" value="${escapeHtml(today)}" required${inputState("returnDate", returnErrors)}>${fieldError("returnDate", returnErrors)}</label><input name="returnNote" placeholder="불량 사유·반품 메모 (선택)" maxlength="300"><button type="submit">반품 입고 <span aria-hidden="true">→</span></button></div>
            </form>`;
      const returnHistory = order.returns.length
        ? `<section class="return-history"><h3>판매 반품 이력 <small>${order.returns.length.toLocaleString("ko-KR")}건</small></h3>${order.returns.map((returnRecord) => `<article data-return-record="${escapeHtml(returnRecord.number)}"><header><strong>${escapeHtml(returnRecord.number)}</strong><span>${escapeHtml(formatDate(returnRecord.returnDate))}${canViewSalesAmounts ? ` · ${escapeHtml(formatMoney(returnRecord.amount))}` : ""}</span></header><p>${returnRecord.lines.map((returnLine) => { const line = order.lines.find(({ id }) => id === returnLine.lineId); const item = itemMap.get(line?.itemId); return `${escapeHtml(item?.name ?? "삭제된 품목")} ${escapeHtml(formatQuantity(returnLine.quantity, item?.unit ?? ""))}`; }).join(" · ")}</p><small>${escapeHtml(returnRecord.note || "반품 메모 없음")}</small></article>`).join("")}</section>`
        : "";

      return `<article class="purchase-order-card sales-order-card">
        <header>
          <div><span class="order-number">${escapeHtml(order.number)}</span><h2>${escapeHtml(customer?.name ?? "알 수 없는 판매처")}</h2><p>${escapeHtml(customer?.code ?? "")} · ${escapeHtml(warehouse?.name ?? order.warehouseId)} 출고</p></div>
          <div class="order-meta"><span class="order-status ${status.className}">${status.label}</span><dl><div><dt>주문일</dt><dd>${escapeHtml(formatDate(order.orderDate))}</dd></div><div><dt>출고 요청</dt><dd>${escapeHtml(order.requestedShipDate ? formatDate(order.requestedShipDate) : "미정")}</dd></div></dl></div>
        </header>
        <div class="table-scroll"><table class="order-lines-table"><thead><tr><th>품목</th><th>주문</th><th>출고</th><th>반품</th><th>순출고</th><th>미출고</th><th>판매 단가</th><th>금액</th></tr></thead><tbody>${orderLines}</tbody></table></div>
        <div class="order-total sales-order-total"><span>${escapeHtml(order.note || "메모 없음")}</span>${canViewSalesAmounts ? `<div><p>주문금액 <strong>${escapeHtml(formatMoney(order.totalAmount))}</strong></p><p>출고금액 <strong>${escapeHtml(formatMoney(order.shippedAmount))}</strong></p><p>반품금액 <strong>${escapeHtml(formatMoney(order.returnedAmount))}</strong></p><p>순매출 <strong>${escapeHtml(formatMoney(order.netSalesAmount))}</strong></p><p>받은 금액 <strong>${escapeHtml(formatMoney(order.collectedAmount))}</strong></p><p class="receivable-amount">받을 금액 <strong>${escapeHtml(formatMoney(order.receivableAmount))}</strong></p>${order.customerRefundPayableAmount > 0 ? `<p class="payable-amount">고객 환불 예정 <strong>${escapeHtml(formatMoney(order.customerRefundPayableAmount))}</strong></p>` : ""}</div>` : `<p>주문·채권 금액은 영업 부서 전용</p>`}</div>
        ${shipmentFields}
        ${returnFields}
        ${returnHistory}
      </article>`;
    }).join("")
    : `<div class="order-empty"><span aria-hidden="true">↗</span><h2>접수된 판매 주문이 없습니다.</h2><p>판매처와 출고 창고를 선택해 첫 주문을 등록해 보세요.</p></div>`;

  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : created
      ? `<div class="form-notice success" role="status">판매 주문 등록을 완료했습니다.</div>`
      : shipped
        ? `<div class="form-notice success" role="status">출고 수량을 재고와 받을 금액에 반영했습니다.</div>`
        : returned
          ? `<div class="form-notice success" role="status">판매 반품을 입고하고 재고와 받을 돈을 조정했습니다.</div>`
        : "";

  return workspacePage({
    title: "주문·출고",
    active: "sales-orders",
    user,
    csrfToken,
    content: `<section class="purchase-content sales-content">
      <header class="purchase-heading sales-heading"><div><p class="form-kicker">SALES ORDER</p><h1>주문 · 출고</h1><p>판매 주문을 접수하고 출고 재고와 받을 금액을 함께 관리합니다.</p></div><div class="sales-summary"><span>누적 받을 금액</span><strong>${escapeHtml(formatMoney(totalReceivable))}</strong></div></header>
      ${notice}
      ${canCreateSales && !prerequisitesReady ? `<div class="prerequisite-notice"><strong>주문 전에 기준정보가 필요합니다.</strong><p>${!customers.length ? "판매처" : ""}${!customers.length && !items.length ? "와 " : ""}${!items.length ? "품목" : ""}을 먼저 등록해 주세요.</p></div>` : ""}

      ${canCreateSales ? `<details class="purchase-create sales-create"${!orders.length || error && !shipmentOrderId && !returnOrderId ? " open" : ""}>
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
      </details>` : ""}

      <section class="orders-section"><div class="orders-title"><p>ORDER & SHIPMENT</p><h2>주문·출고·반품 현황</h2></div>${orderCards}</section>
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

export function settlementsPage({
  user,
  csrfToken,
  overview,
  today,
  values = {},
  fieldErrors = {},
  error = "",
  errorType = "",
  recorded = "",
}) {
  const partnerTable = (type, balances) => {
    const isCollection = type === "collection";
    const rows = balances.map((partner) => `<tr data-partner-balance="${escapeHtml(partner.partnerId)}">
      <td><strong>${escapeHtml(partner.name)}</strong><small>${escapeHtml(partner.code)}</small></td>
      <td class="number-cell">${escapeHtml(formatMoney(partner.transactionAmount))}</td>
      <td class="number-cell settled">${escapeHtml(formatMoney(partner.settledAmount))}</td>
      <td class="number-cell balance ${partner.balance > 0 ? "open" : "clear"}"><strong>${escapeHtml(formatMoney(partner.balance))}</strong></td>
      <td class="number-cell balance ${partner.refundBalance > 0 ? "open" : "clear"}"><strong>${escapeHtml(formatMoney(partner.refundBalance))}</strong></td>
      <td>${partner.documentCount ? `<span class="open-document-count">${partner.documentCount.toLocaleString("ko-KR")}건</span>` : `<span class="cleared-label">정산 완료</span>`}</td>
    </tr>`).join("");
    return `<section class="partner-balance-card ${isCollection ? "receivable" : "payable"}" aria-labelledby="${type}-partner-title">
      <header><div><p>${isCollection ? "ACCOUNTS RECEIVABLE" : "ACCOUNTS PAYABLE"}</p><h2 id="${type}-partner-title">${isCollection ? "판매처별 받을 돈" : "구매처별 줄 돈"}</h2></div><strong>${balances.length.toLocaleString("ko-KR")}<small>개 거래처</small></strong></header>
      ${balances.length ? `<div class="table-scroll"><table><thead><tr><th>거래처</th><th>반품 차감 후 ${isCollection ? "판매" : "매입"}</th><th>${isCollection ? "받은 금액" : "지급금액"}</th><th>${isCollection ? "받을 돈" : "줄 돈"}</th><th>${isCollection ? "고객 환불 예정" : "공급처 환급 예정"}</th><th>미결 문서</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="settlement-empty compact"><strong>${isCollection ? "등록된 판매처" : "등록된 구매처"}가 없습니다.</strong></div>`}
    </section>`;
  };

  const documentCards = (type, documents) => {
    const isCollection = type === "collection";
    return documents.map((document) => {
      const hasError = errorType === type && values.orderId === document.id;
      return `<article class="settlement-document ${isCollection ? "receivable" : "payable"}" data-settlement-document="${escapeHtml(document.id)}">
        <header><div><span>${isCollection ? "받을 돈" : "줄 돈"}</span><strong>${escapeHtml(document.partnerName)}</strong><small>${escapeHtml(document.partnerCode)} · ${escapeHtml(document.number)} · ${escapeHtml(formatDate(document.documentDate))}</small></div><b>${escapeHtml(formatMoney(document.balance))}</b></header>
        <dl><div><dt>${isCollection ? "출고금액" : "입고금액"}</dt><dd>${escapeHtml(formatMoney(document.transactionAmount))}</dd></div><div><dt>${isCollection ? "받은 금액" : "지급금액"}</dt><dd>${escapeHtml(formatMoney(document.settledAmount))}</dd></div><div><dt>현재 잔액</dt><dd>${escapeHtml(formatMoney(document.balance))}</dd></div></dl>
        <form action="/settlements/${isCollection ? "collections" : "payments"}" method="post" class="settlement-entry-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}"><input type="hidden" name="orderId" value="${escapeHtml(document.id)}">
          <label>${isCollection ? "입금일" : "지급일"}<input name="transactionDate" type="date" value="${escapeHtml(hasError ? values.transactionDate : today)}" required${hasError ? inputState("transactionDate", fieldErrors) : ""}>${hasError ? fieldError("transactionDate", fieldErrors) : ""}</label>
          <label>${isCollection ? "받은 금액" : "지급한 금액"}<span class="money-input"><input name="amount" type="number" value="${escapeHtml(hasError ? values.amount : "")}" placeholder="최대 ${escapeHtml(document.balance)}" min="0.01" max="${escapeHtml(document.balance)}" step="0.01" inputmode="decimal" required${hasError ? inputState("amount", fieldErrors) : ""}><i>원</i></span>${hasError ? fieldError("amount", fieldErrors) : ""}</label>
          <label>메모<input name="note" value="${escapeHtml(hasError ? values.note : "")}" placeholder="계좌·지급 메모 (선택)" maxlength="300"></label>
          <button type="submit">${isCollection ? "입금 반영" : "지급 반영"} <span aria-hidden="true">→</span></button>
        </form>
      </article>`;
    }).join("");
  };

  const transactionRows = overview.transactions.map((transaction) => {
    const isCollection = transaction.type === "collection";
    return `<tr data-settlement-transaction="${escapeHtml(transaction.number)}"><td><span class="settlement-type ${isCollection ? "collection" : "payment"}">${isCollection ? "입금" : "지급"}</span></td><td><strong>${escapeHtml(formatDate(transaction.transactionDate))}</strong><small>${escapeHtml(transaction.number)}</small></td><td><strong>${escapeHtml(transaction.partnerName)}</strong><small>${escapeHtml(transaction.partnerCode)}</small></td><td><strong>${escapeHtml(transaction.documentNumber)}</strong></td><td class="number-cell settlement-transaction-amount ${isCollection ? "collection" : "payment"}">${isCollection ? "+" : "-"}${escapeHtml(formatMoney(transaction.amount))}</td><td>${escapeHtml(transaction.note || "메모 없음")}</td></tr>`;
  }).join("");
  const refundRows = [
    ...overview.customerRefundDocuments.map((document) => ({ ...document, type: "customer" })),
    ...overview.supplierRefundDocuments.map((document) => ({ ...document, type: "supplier" })),
  ].map((document) => `<tr data-refund-document="${escapeHtml(document.id)}"><td><span class="settlement-type ${document.type === "customer" ? "payment" : "collection"}">${document.type === "customer" ? "고객 환불" : "공급처 환급"}</span></td><td><strong>${escapeHtml(document.partnerName)}</strong><small>${escapeHtml(document.partnerCode)}</small></td><td><strong>${escapeHtml(document.number)}</strong><small>${escapeHtml(formatDate(document.documentDate))}</small></td><td class="number-cell balance open"><strong>${escapeHtml(formatMoney(document.balance))}</strong></td></tr>`).join("");
  const notice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : recorded === "collection"
      ? `<div class="form-notice success" role="status">입금을 반영해 받을 돈을 차감했습니다.</div>`
      : recorded === "payment"
        ? `<div class="form-notice success" role="status">지급을 반영해 줄 돈을 차감했습니다.</div>`
        : "";

  return workspacePage({
    title: "받을 돈 · 줄 돈",
    active: "settlements",
    user,
    csrfToken,
    content: `<section class="settlements-content">
      <header class="settlements-heading"><div><p class="form-kicker">RECEIVABLES & PAYABLES</p><h1>받을 돈 · 줄 돈</h1><p>실제 입금과 지급을 기록하고 거래처별 남은 금액을 확인합니다.</p></div><div class="settlement-asof"><span>기준일</span><strong>${escapeHtml(formatDate(today))}</strong></div></header>
      ${notice}
      <section class="settlement-kpis" aria-label="채권 채무 합계"><article class="receivable"><span>전체 받을 돈</span><strong>${escapeHtml(formatMoney(overview.receivableTotal))}</strong><p>미수 판매 주문 ${overview.receivableDocuments.length.toLocaleString("ko-KR")}건 · 공급처 환급 예정 ${escapeHtml(formatMoney(overview.supplierRefundReceivableTotal))}</p></article><article class="payable"><span>전체 줄 돈</span><strong>${escapeHtml(formatMoney(overview.payableTotal))}</strong><p>미지급 구매 발주 ${overview.payableDocuments.length.toLocaleString("ko-KR")}건 · 고객 환불 예정 ${escapeHtml(formatMoney(overview.customerRefundPayableTotal))}</p></article><article class="net"><span>받을 돈 - 줄 돈</span><strong>${overview.receivableTotal - overview.payableTotal >= 0 ? "+" : "-"}${escapeHtml(formatMoney(Math.abs(overview.receivableTotal - overview.payableTotal)))}</strong><p>반품 환불·환급 예정액은 위 보조 금액으로 별도 표시</p></article></section>
      <aside class="settlement-basis"><span aria-hidden="true">i</span><p><strong>실제 입출고와 반품 기준입니다.</strong> 판매 반품은 받을 돈을, 구매 반품은 줄 돈을 먼저 줄입니다. 이미 정산한 금액을 넘으면 고객 환불 예정액 또는 공급처 환급 예정액으로 보존됩니다.</p></aside>
      <div class="partner-balance-grid">${partnerTable("collection", overview.customerBalances)}${partnerTable("payment", overview.supplierBalances)}</div>
      <section class="open-settlements" aria-labelledby="open-settlements-title"><header><div><p>OPEN DOCUMENTS</p><h2 id="open-settlements-title">입금 · 지급 처리</h2></div><span>잔액이 있는 문서만 표시</span></header><div class="open-settlement-columns"><section><h3>받을 돈 <small>${overview.receivableDocuments.length.toLocaleString("ko-KR")}건</small></h3>${documentCards("collection", overview.receivableDocuments) || `<div class="settlement-empty"><span aria-hidden="true">✓</span><strong>받을 돈이 없습니다.</strong><p>출고 후 아직 입금되지 않은 문서가 없습니다.</p></div>`}</section><section><h3>줄 돈 <small>${overview.payableDocuments.length.toLocaleString("ko-KR")}건</small></h3>${documentCards("payment", overview.payableDocuments) || `<div class="settlement-empty"><span aria-hidden="true">✓</span><strong>줄 돈이 없습니다.</strong><p>입고 후 아직 지급하지 않은 문서가 없습니다.</p></div>`}</section></div></section>
      ${refundRows ? `<section class="settlement-history return-settlement-history" aria-labelledby="return-settlement-title"><header><div><p>RETURN SETTLEMENTS</p><h2 id="return-settlement-title">반품 환불 · 환급 예정액</h2></div><span>총 <strong>${(overview.customerRefundDocuments.length + overview.supplierRefundDocuments.length).toLocaleString("ko-KR")}</strong>건</span></header><div class="table-scroll"><table><thead><tr><th>구분</th><th>거래처</th><th>원 문서</th><th>남은 금액</th></tr></thead><tbody>${refundRows}</tbody></table></div></section>` : ""}
      <section class="settlement-history" aria-labelledby="settlement-history-title"><header><div><p>CASH SETTLEMENT HISTORY</p><h2 id="settlement-history-title">최근 입금 · 지급 근거</h2></div><span>총 <strong>${overview.transactions.length.toLocaleString("ko-KR")}</strong>건</span></header>${transactionRows ? `<div class="table-scroll"><table><thead><tr><th>구분</th><th>처리일·번호</th><th>거래처</th><th>대상 문서</th><th>금액</th><th>메모</th></tr></thead><tbody>${transactionRows}</tbody></table></div>` : `<div class="settlement-empty"><span aria-hidden="true">◎</span><strong>입금·지급 이력이 없습니다.</strong><p>위 미결 문서에서 처리하면 근거가 여기에 남습니다.</p></div>`}</section>
    </section>`,
  });
}

export function vatReportPage({ user, csrfToken, warehouses, partners, items, summary }) {
  const partnerMap = new Map(partners.map((partner) => [partner.id, partner]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const quarterLabel = `${summary.year}년 ${summary.quarter}분기`;
  const taxTypeLabels = { ...taxLabels, unclassified: "미분류" };
  const result = summary.estimatedVatBalance > 0
    ? { label: "예상 납부세액", amount: summary.estimatedPayableVat, className: "payable", note: "매출세액이 공제 가정 매입세액보다 많습니다." }
    : summary.estimatedVatBalance < 0
      ? { label: "예상 환급세액", amount: summary.estimatedRefundVat, className: "refund", note: "공제 가정 매입세액이 매출세액보다 많습니다." }
      : { label: "납부·환급 예상", amount: 0, className: "balanced", note: "매출세액과 공제 가정 매입세액이 같습니다." };
  const breakdown = (title, totals, className) => `<article class="vat-breakdown ${className}">
    <header><div><p>${className === "sales" ? "OUTPUT TAX" : "INPUT TAX"}</p><h2>${title}</h2></div><strong>${escapeHtml(formatMoney(totals.vatAmount))}</strong></header>
    <dl>
      <div><dt>과세 공급가액</dt><dd>${escapeHtml(formatMoney(totals.taxableSupplyAmount))}</dd></div>
      <div><dt>영세율 공급가액</dt><dd>${escapeHtml(formatMoney(totals.zeroRatedSupplyAmount))}</dd></div>
      <div><dt>면세 공급가액</dt><dd>${escapeHtml(formatMoney(totals.exemptSupplyAmount))}</dd></div>
      <div${totals.unclassifiedSupplyAmount ? ' class="warning"' : ""}><dt>미분류 공급가액</dt><dd>${escapeHtml(formatMoney(totals.unclassifiedSupplyAmount))}</dd></div>
      <div class="total"><dt>순 공급가액</dt><dd>${escapeHtml(formatMoney(totals.netSupplyAmount))}</dd></div>
      <div><dt>부가세 포함 합계</dt><dd>${escapeHtml(formatMoney(totals.grossAmount))}</dd></div>
    </dl>
    <p>정상 거래 ${totals.transactionCount.toLocaleString("ko-KR")}건 · 반품 ${totals.returnCount.toLocaleString("ko-KR")}건</p>
  </article>`;
  const transactionRows = summary.transactions.map((transaction) => {
    const typeMeta = {
      purchase: { label: "구매 입고", className: "purchase" },
      sale: { label: "판매 출고", className: "sale" },
      purchase_return: { label: "구매 반품", className: "sale" },
      sales_return: { label: "판매 반품", className: "purchase" },
    }[transaction.type];
    const partner = partnerMap.get(transaction.partnerId);
    const warehouse = warehouseMap.get(transaction.warehouseId);
    const sign = transaction.isReturn ? "-" : "";
    const lineDetails = transaction.lines.map((line) => {
      const item = itemMap.get(line.itemId);
      return `<div class="vat-line-detail"><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><span class="tax-badge ${escapeHtml(line.taxType)}">${escapeHtml(taxTypeLabels[line.taxType] ?? line.taxType)}</span><span>${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))} × ${escapeHtml(formatMoney(line.unitPrice))}</span><em>공급 ${sign}${escapeHtml(formatMoney(line.supplyAmount))} · 세액 ${sign}${escapeHtml(formatMoney(line.vatAmount))}</em></div>`;
    }).join("");
    return `<tr data-vat-transaction="${escapeHtml(transaction.id)}">
      <td><span class="trade-type ${typeMeta.className}">${typeMeta.label}</span></td>
      <td><strong>${escapeHtml(formatKoreanDateTime(transaction.occurredAt))}</strong><small>${escapeHtml(transaction.documentNumber)}${transaction.sourceDocumentNumber ? ` · 원문서 ${escapeHtml(transaction.sourceDocumentNumber)}` : ""}</small></td>
      <td><strong>${escapeHtml(partner?.name ?? "알 수 없는 거래처")}</strong><small>${escapeHtml(partner?.code ?? transaction.partnerId)}</small></td>
      <td>${escapeHtml(warehouse?.name ?? transaction.warehouseId)}</td>
      <td class="vat-lines">${lineDetails}</td>
      <td class="number-cell vat-amount"><strong>${sign}${escapeHtml(formatMoney(transaction.supplyAmount))}</strong><small>세액 ${sign}${escapeHtml(formatMoney(transaction.vatAmount))}</small></td>
    </tr>`;
  }).join("");

  return workspacePage({
    title: "분기 부가세 예상",
    active: "vat-report",
    user,
    csrfToken,
    content: `<section class="report-content vat-report-content">
      <header class="report-heading">
        <div><p class="form-kicker">QUARTERLY VAT ESTIMATE</p><h1>분기 부가세 예상</h1><p>실제 입고·출고와 반품을 기준으로 이번 분기 납부 또는 환급 예상액을 계산합니다.</p></div>
        <form action="/reports/vat" method="get" class="month-filter quarter-filter"><label for="vat-year">조회 분기</label><input id="vat-year" name="year" type="number" min="2000" max="9999" value="${escapeHtml(summary.year)}" required aria-label="조회 연도"><select name="quarter" aria-label="조회 분기">${[1, 2, 3, 4].map((quarter) => `<option value="${quarter}"${quarter === summary.quarter ? " selected" : ""}>${quarter}분기</option>`).join("")}</select><button type="submit">조회</button></form>
      </header>

      <aside class="report-basis vat-basis"><span aria-hidden="true">i</span><p><strong>일반과세자 단순 추정입니다.</strong> 품목 단가는 부가세 별도 공급가액으로 보고 과세 품목에 10%, 영세율·면세 품목에 0%를 적용했습니다. 구매 과세분은 적격 증빙과 업무 관련성 등 공제 요건을 모두 충족한다고 가정하며 신고서 제출 기능은 아닙니다.</p></aside>
      ${summary.hasUnclassifiedItems ? `<div class="form-notice error" role="alert">과세 유형이 미분류인 거래가 있습니다. 해당 공급가액의 부가세는 0원으로 계산되므로 품목 기준정보를 확인해 주세요.</div>` : ""}

      <section class="vat-summary" aria-label="${escapeHtml(quarterLabel)} 부가세 요약" data-vat-period="${escapeHtml(summary.period)}">
        <article><span>매출세액</span><strong>${escapeHtml(formatMoney(summary.sales.vatAmount))}</strong><p>판매 출고 − 판매 반품</p></article>
        <article><span>공제 가정 매입세액</span><strong>${escapeHtml(formatMoney(summary.purchases.vatAmount))}</strong><p>구매 입고 − 구매 반품</p></article>
        <article class="result ${result.className}"><span>${result.label}</span><strong>${escapeHtml(formatMoney(result.amount))}</strong><p>${escapeHtml(result.note)}</p></article>
      </section>

      <div class="vat-breakdown-grid">${breakdown("매출 과세표준과 세액", summary.sales, "sales")}${breakdown("매입 공급가액과 공제 가정 세액", summary.purchases, "purchases")}</div>

      <aside class="vat-disclaimer"><h2>신고 전 반드시 확인하세요</h2><p>세금계산서·카드전표 등 적격 증빙, 불공제 매입세액, 공통매입 안분, 의제매입·대손·신용카드 세액공제, 수입·고정자산, 예정고지·가산세와 수정신고는 반영하지 않습니다. 품목의 현재 과세 유형을 사용하므로 과거 유형이 바뀐 거래도 원 증빙과 대조해야 합니다.</p></aside>

      <section class="trade-history vat-history" aria-labelledby="vat-history-title">
        <div class="trade-history-heading"><div><p>TRANSACTION BASIS</p><h2 id="vat-history-title">${escapeHtml(quarterLabel)} 계산 근거</h2><small>${escapeHtml(formatDate(summary.startDate))} ~ ${escapeHtml(formatDate(summary.endDate))}</small></div><span>총 <strong>${summary.transactions.length.toLocaleString("ko-KR")}</strong>건</span></div>
        ${summary.transactions.length ? `<div class="table-scroll"><table><thead><tr><th>구분</th><th>처리 일시·문서</th><th>거래처</th><th>창고</th><th>품목·과세 유형·산식</th><th>공급가액·세액</th></tr></thead><tbody>${transactionRows}</tbody></table></div>` : `<div class="report-empty"><span aria-hidden="true">VAT</span><strong>이 분기에 반영된 매출·매입이 없습니다.</strong><p>실제 입고 또는 출고를 처리하면 공급가액과 세액이 여기에 표시됩니다.</p></div>`}
      </section>
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
  periodStatus = { closedThrough: "", closures: [] },
  currentMonth = "",
  error = "",
  closed = false,
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
  const selectedIsClosed = Boolean(periodStatus.closedThrough && summary.month <= periodStatus.closedThrough);
  const canCloseSelected = canAccess(user, PERMISSIONS.FINANCE_CLOSE)
    && summary.month < currentMonth
    && !selectedIsClosed;
  const latestClosure = periodStatus.closures[0];
  const [closedYear, closedMonth] = (periodStatus.closedThrough || "-").split("-").map(Number);
  const closedThroughLabel = periodStatus.closedThrough ? `${closedYear}년 ${closedMonth}월` : "마감 이력 없음";
  const periodNotice = error
    ? `<div class="form-notice error" role="alert">${escapeHtml(error)}</div>`
    : closed
      ? `<div class="form-notice success" role="status">${escapeHtml(monthLabel)} 마감을 완료했습니다. 이 월과 이전 월 자료가 잠겼습니다.</div>`
      : "";

  const transactionRows = summary.transactions.map((transaction) => {
    const typeMeta = {
      purchase: { label: "구매 입고", className: "purchase", sign: "-" },
      sale: { label: "판매 출고", className: "sale", sign: "+" },
      purchase_return: { label: "구매 반품", className: "sale", sign: "+" },
      sales_return: { label: "판매 반품", className: "purchase", sign: "-" },
    }[transaction.type];
    const partner = partnerMap.get(transaction.partnerId);
    const warehouse = warehouseMap.get(transaction.warehouseId);
    const lineDetails = transaction.lines.map((line) => {
      const item = itemMap.get(line.itemId);
      return `<div><strong>${escapeHtml(item?.name ?? "삭제된 품목")}</strong><span>${escapeHtml(formatQuantity(line.quantity, item?.unit ?? ""))} × ${escapeHtml(formatMoney(line.unitPrice))}</span><em>${escapeHtml(formatMoney(line.amount))}</em></div>`;
    }).join("");
    return `<tr>
      <td><span class="trade-type ${typeMeta.className}">${typeMeta.label}</span></td>
      <td><strong>${escapeHtml(formatKoreanDateTime(transaction.occurredAt))}</strong><small>${escapeHtml(transaction.documentNumber)}${transaction.sourceDocumentNumber ? ` · 원문서 ${escapeHtml(transaction.sourceDocumentNumber)}` : ""}</small></td>
      <td><strong>${escapeHtml(partner?.name ?? "알 수 없는 거래처")}</strong><small>${escapeHtml(partner?.code ?? transaction.partnerId)}</small></td>
      <td>${escapeHtml(warehouse?.name ?? transaction.warehouseId)}</td>
      <td class="trade-lines">${lineDetails}</td>
      <td class="number-cell trade-amount ${typeMeta.className}">${typeMeta.sign}${escapeHtml(formatMoney(transaction.amount))}</td>
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

      ${periodNotice}

      <aside class="report-basis"><span aria-hidden="true">i</span><p><strong>입고·출고와 반품 금액 기준입니다.</strong> 반품일의 판매·구매 금액을 차감합니다. 실제 지급·수금이나 부가세, 급여, 운임 등은 반영되지 않아 회계상 순이익과는 다릅니다.</p></aside>

      <section class="period-close-card ${selectedIsClosed ? "closed" : canCloseSelected ? "closable" : "open"}" aria-labelledby="period-close-title" data-period-status="${selectedIsClosed ? "closed" : "open"}">
        <div class="period-close-icon" aria-hidden="true">${selectedIsClosed ? "▣" : "□"}</div>
        <div class="period-close-copy"><p>ACCOUNTING PERIOD</p><h2 id="period-close-title">${selectedIsClosed ? `${escapeHtml(monthLabel)}은 잠겼습니다.` : `${escapeHtml(monthLabel)} 마감 상태`}</h2>
          <span>${selectedIsClosed
            ? `${escapeHtml(closedThroughLabel)}까지 마감되어 발주·주문·생산·급여의 과거 자료를 새로 등록하거나 변경할 수 없습니다.${latestClosure ? ` 최종 마감 ${escapeHtml(formatKoreanDateTime(latestClosure.closedAt))}` : ""}`
            : canCloseSelected
              ? "금액과 거래 근거를 확인한 뒤 마감하세요. 선택 월과 그 이전 월이 함께 잠기며 이 화면에서는 되돌릴 수 없습니다."
              : summary.month >= currentMonth
                ? "현재 월과 미래 월은 마감할 수 없습니다. 월이 끝난 뒤 마감할 수 있습니다."
                : "이 회계기간은 아직 열려 있습니다."}</span>
        </div>
        <div class="period-close-state"><small>마감 기준</small><strong>${escapeHtml(closedThroughLabel)}</strong>
          ${canCloseSelected ? `<form action="/reports/monthly/close" method="post" data-period-close-form><input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}"><input type="hidden" name="month" value="${escapeHtml(summary.month)}"><button type="submit">${escapeHtml(monthLabel)} 마감</button></form>` : `<em>${selectedIsClosed ? "수정 잠금" : "기간 열림"}</em>`}
        </div>
      </section>

      <section class="trade-summary" aria-label="${escapeHtml(monthLabel)} 금액 요약">
        <article class="spent"><span>이번 달 쓴 금액</span><strong>${escapeHtml(formatMoney(summary.purchaseAmount))}</strong><p>구매 입고 ${summary.purchaseCount.toLocaleString("ko-KR")}건 · 반품 ${summary.purchaseReturnCount.toLocaleString("ko-KR")}건</p></article>
        <article class="earned"><span>이번 달 번 금액</span><strong>${escapeHtml(formatMoney(summary.salesAmount))}</strong><p>판매 출고 ${summary.salesCount.toLocaleString("ko-KR")}건 · 반품 ${summary.salesReturnCount.toLocaleString("ko-KR")}건</p></article>
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
