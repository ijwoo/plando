/**
 * 공통 디자인 토큰 — 기존 웹 `frontend-todo/src/shared/ui/tone.js`를 RN으로 미러.
 * 상태·우선순위 라벨/색을 여기 한 곳에서 관리해 기존 앱과 동일하게 유지한다.
 */

export const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TodoStatus = (typeof STATUSES)[number];

export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type TodoPriority = (typeof PRIORITIES)[number];

export const STATUS_OPTIONS: { value: TodoStatus; label: string }[] = [
  { value: 'TODO', label: '할 일' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'DONE', label: '완료' },
];

export const PRIORITY_OPTIONS: { value: TodoPriority; label: string }[] = [
  { value: 'HIGH', label: '높음' },
  { value: 'MEDIUM', label: '중간' },
  { value: 'LOW', label: '낮음' },
];

export const STATUS_LABEL: Record<TodoStatus, string> = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
};

export const PRIORITY_LABEL: Record<TodoPriority, string> = {
  HIGH: '높음',
  MEDIUM: '중간',
  LOW: '낮음',
};

type StatusTheme = { danger: string; orange: string; green: string };

/**
 * 채움색 위에 올릴 가독 텍스트 색(#fff 또는 진한 회색)을 색의 밝기로 결정.
 * 다크모드에서 priority/status 토큰이 밝아지는데(예: primary #8AB4F8, orange #FBBF24),
 * 그 위에 흰 텍스트는 대비가 부족하므로 밝은 배경엔 진한 텍스트를 쓴다.
 */
export function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#fff';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1A1A1A' : '#fff';
}

/**
 * 상태별 dot/아이콘 색 — 테마 토큰 기반(라이트/다크 자동).
 * 웹의 var(--plando-red/orange/green)와 동일하게 모드 인식으로 통일.
 * (TODO=빨강 / IN_PROGRESS=주황 / DONE=초록)
 */
/**
 * 상태 키 → 색. **커스텀 상태에는 쓸 수 없다** — 호출부는 먼저 `useStatusMap().color(key)` 를
 * 보고, 색이 지정되지 않았을 때만 이 함수를 폴백으로 써야 한다.
 * (커스텀 키는 세 분기 어디에도 안 걸려 전부 danger=빨강이 된다.)
 * 가능하면 category 를 넘겨 계열 색이라도 맞춘다.
 */
export function statusColor(theme: StatusTheme, status?: string | null, category?: string | null): string {
  const k = category ?? status;
  if (k === 'IN_PROGRESS') return theme.orange;
  if (k === 'DONE') return theme.green;
  return theme.danger; // TODO(또는 미지정)
}

/**
 * 우선순위별 색 (HIGH=빨강 / MEDIUM=주황 / LOW=파랑) — 테마 토큰 기반(라이트/다크 자동).
 * 웹의 var(--plando-red/orange/primary)와 동일하게 모드 인식으로 통일.
 */
export function priorityColor(
  theme: { danger: string; orange: string; primary: string },
  priority?: string | null,
): string {
  if (priority === 'HIGH') return theme.danger;
  if (priority === 'MEDIUM') return theme.orange;
  return theme.primary; // LOW(또는 미지정)
}

export const BRAND_COLOR = { KAKAO: '#FEE500' };

export function getStatusLabel(status?: string): string {
  return (status && STATUS_LABEL[status as TodoStatus]) ?? status ?? '-';
}

export function getPriorityLabel(priority?: string): string {
  return (priority && PRIORITY_LABEL[priority as TodoPriority]) ?? priority ?? '-';
}
