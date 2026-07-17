# 다온 ERP

중소기업의 업무 흐름을 한곳에서 관리하기 위한 ERP 실증 프로젝트입니다. 1회차에는
로그인, 세션 인증, 보호된 ERP 홈을 구현했습니다.

## 실행

Node.js 20 이상에서 별도 패키지 설치 없이 실행할 수 있습니다.

```bash
npm start
```

브라우저에서 <http://127.0.0.1:3000>으로 접속합니다. 개발용 체험 계정은 다음과
같습니다.

- 아이디: `admin`
- 비밀번호: `ChangeMe123!`

운영 시에는 반드시 환경 변수로 초기 관리자 계정을 바꿉니다. 운영 모드에서는
체험 계정 안내가 화면에 표시되지 않고 세션 쿠키에 `Secure` 속성이 적용됩니다.

```bash
NODE_ENV=production \
ERP_ADMIN_USERNAME=owner \
ERP_ADMIN_PASSWORD='충분히-긴-운영용-비밀번호' \
ERP_ADMIN_NAME='대표자' \
npm start
```

## 검증

```bash
npm test
```

로그인 성공·실패, CSRF 방어, 세션 만료·로그아웃, 로그인 시도 제한, 운영 환경
보안 속성, HTTP 오류 경계를 Node.js 기본 테스트 러너로 검증합니다.
