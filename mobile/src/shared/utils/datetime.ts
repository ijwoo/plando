/** 로컬 날짜 YYYY-MM-DD */
export function toDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 설정 "기본 마감일"(none/today/tomorrow/week) → 새 할 일 dueDate.
 * week = 이번 주 토요일 (기존 웹 AddTodoMobile과 동일: (6 - getDay() + 7) % 7).
 */
export function defaultDueToDate(defaultDue?: string): string | undefined {
  if (!defaultDue || defaultDue === 'none') return undefined;
  const d = new Date();
  if (defaultDue === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (defaultDue === 'week') d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toDateString(d);
}

/** 상대 시간 표기 (방금 전 / N분 전 / N시간 전 / N일 전 / M월 D일) */
export function relativeTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
