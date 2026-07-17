const SYNTHETIC_NAMES = Object.freeze([
  "김민준", "이서준", "박도윤", "최예준", "정시우", "강주원", "조하준", "윤지호", "장현우", "임건우",
  "한우진", "오선우", "서유준", "신연우", "권정우", "황승현", "안준혁", "송도현", "류민재", "홍태윤",
  "김서연", "이서윤", "박지우", "최하윤", "정민서", "강지민", "조수아", "윤지아", "장하은", "임서아",
  "한예은", "오채원", "서다은", "신유나", "권수빈", "황소율", "안예린", "송나은", "류아린", "홍가은",
  "김현준", "이도훈", "박준영", "최민석", "정재현", "강동현", "조성민", "윤태호", "장우석", "임상현",
  "한진우", "오민호", "서정민", "신동욱", "권혁진", "황경민", "안성준", "송재원", "류건희", "홍승우",
  "김지은", "이수연", "박혜진", "최은지", "정다영", "강민지", "조유진", "윤소희", "장지현", "임예진",
  "한수진", "오지영", "서현아", "신보미", "권아영", "황유림", "안채영", "송은서", "류다솜", "홍세은",
  "김태민", "이준호", "박상우", "최영준", "정우성", "강현수", "조민규", "윤성호", "장동훈", "임재훈",
  "한승민", "오준서", "서진호", "신태영", "권도윤", "황민규", "안재민", "송현석", "류준호", "홍성민",
]);

export const EMPLOYEE_DEPARTMENTS = Object.freeze([
  "경영지원", "재무회계", "인사총무", "영업1팀", "영업2팀",
  "구매", "생산1팀", "생산2팀", "품질관리", "물류",
]);

const POSITIONS = Object.freeze(["사원", "주임", "대리", "과장", "차장", "부장"]);
const BASE_SALARY_BY_POSITION = Object.freeze({
  사원: 3_000_000,
  주임: 3_400_000,
  대리: 3_900_000,
  과장: 4_800_000,
  차장: 5_700_000,
  부장: 6_800_000,
});
const WORK_LOCATIONS = Object.freeze(["서울", "인천", "부산"]);
const pad = (value, length = 2) => String(value).padStart(length, "0");

export const SYNTHETIC_EMPLOYEES = Object.freeze(SYNTHETIC_NAMES.map((name, index) => {
  const sequence = index + 1;
  const position = POSITIONS[index % POSITIONS.length];
  const hireYear = 2015 + (index % 11);
  const hireMonth = (index % 12) + 1;
  const hireDay = (index % 20) + 1;
  return Object.freeze({
    id: `employee_seed_${pad(sequence, 4)}`,
    employeeNumber: `EMP-${pad(sequence, 4)}`,
    name,
    department: EMPLOYEE_DEPARTMENTS[Math.floor(index / 10)],
    position,
    workLocation: WORK_LOCATIONS[index % WORK_LOCATIONS.length],
    hireDate: `${hireYear}-${pad(hireMonth)}-${pad(hireDay)}`,
    email: `employee${pad(sequence, 4)}@ohmyvibeerp.example`,
    employmentType: "regular",
    employmentStatus: "active",
    baseSalary: BASE_SALARY_BY_POSITION[position] + (index % 5) * 100_000,
    mealAllowance: 200_000,
    otherAllowance: (index % 4) * 50_000,
    fixedDeduction: 300_000 + (index % 6) * 50_000,
    isSynthetic: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "system_seed",
  });
}));

export function createSyntheticEmployees() {
  return structuredClone(SYNTHETIC_EMPLOYEES);
}
