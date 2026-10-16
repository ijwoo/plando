/**
 * 캘린더 날짜 유틸 — 기존 웹(frontend-todo calendar)과 동일한 라벨/주말색/주 시작을 RN에서 재현.
 * moment 없이 네이티브 Date만 사용.
 */

/** 요일 라벨 (일~토, getDay() 인덱스 기준) */
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const WK_BASE = WEEKDAY_LABELS;

/** 2자리 0 패딩 (예: 3 → "03") */
export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → "YYYY-MM-DD" (로컬) */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → Date (로컬 자정) */
export function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

export function todayYmd(): string {
  return ymd(new Date());
}

/**
 * 할 일이 걸치는 모든 날짜("YYYY-MM-DD")를 반환한다.
 *
 * 예전엔 캘린더가 `dueDate ?? startAt` 로 **하루에만** 넣어서, 7/1~7/5 일정이 7/5에만 보이고
 * 1~4일은 빈 날로 나왔다(월 점·주 타임라인·아젠다·날짜 시트 전부). 웹은 forEachEventDay로
 * 걸친 날 전부에 그린다 — 그쪽 규칙을 미러한다.
 *
 * 상한 366일: 잘못된 데이터(먼 미래 dueDate)로 루프가 폭주하지 않게.
 */
export function eventDays(startAt?: string | null, dueDate?: string | null): string[] {
  const start = startAt?.slice(0, 10) ?? dueDate?.slice(0, 10);
  const end = dueDate?.slice(0, 10) ?? start;
  if (!start) return [];
  if (!end || end <= start) return [start];

  const out: string[] = [];
  let cur = start;
  for (let i = 0; i < 366; i += 1) {
    out.push(cur);
    if (cur >= end) break;
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

export function addDaysYmd(s: string, days: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

/** 주 시작(0=일,1=월)에 맞춘 요일 헤더 라벨 + 실제 요일 인덱스 */
export function weekdayHeader(weekStartsOn: 0 | 1): { label: string; weekday: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const weekday = (i + weekStartsOn) % 7;
    return { label: WK_BASE[weekday], weekday };
  });
}

/** 일(0)=빨강, 토(6)=primary, 그 외 secondary — 기존 앱과 동일 */
export function weekdayColor(
  weekday: number,
  theme: { danger: string; primary: string; textSecondary: string },
): string {
  if (weekday === 0) return theme.danger;
  if (weekday === 6) return theme.primary;
  return theme.textSecondary;
}

/** "M월 D일" */
export function shortDateLabel(s: string): string {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
