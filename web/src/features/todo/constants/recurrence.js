/**
 * 반복 일정 옵션 — 단일 source of truth.
 * 기존에 AddTodoMobile / AddTodoDesktop / TodoRecurrenceSection 3곳에 동일 정의가
 * 따로 있던 걸 통일. backend recurrenceType enum에 직접 매핑됨.
 */
export const RECURRENCE_OPTIONS = [
    { value: "NONE", label: "반복 없음" },
    { value: "DAILY", label: "매일" },
    { value: "WEEKLY", label: "매주" },
    { value: "MONTHLY", label: "매월" },
];

/**
 * 반복 타입 → 라벨 맵 (값 하나만 들고 라벨을 찾을 때).
 * RECURRENCE_OPTIONS와 항상 동기화.
 */
export const RECURRENCE_LABEL = RECURRENCE_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = opt.label;
    return acc;
}, {});

/**
 * 반복 타입 → 안내 문구 (반복 종료일 입력 시 helper).
 */
export const RECURRENCE_HINTS = {
    DAILY: "매일 새 할 일이 자동으로 생성됩니다.",
    WEEKLY: "매주 같은 요일에 새 할 일이 생성됩니다.",
    MONTHLY: "매월 같은 날짜에 새 할 일이 생성됩니다.",
};
