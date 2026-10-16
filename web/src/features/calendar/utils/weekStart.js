/**
 * 월 그리드(헤더 순서·리딩 빈칸) 공통 헬퍼 — 주는 항상 일요일 시작이다.
 * 팀 공유 지표(주간 완료율·팀원 현황)와 백엔드 주간 리포트(WrapService)가 일요일 시작
 * 기준이라, 주 시작 요일은 사용자가 바꿀 수 없는 고정값이다.
 * 셀 자체의 요일 색(일=빨강/토=파랑)은 각 컴포넌트가 date.getDay()로 칠하므로 여기선 다루지 않는다.
 */
const BASE_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 표시 순서대로의 요일 헤더 (일~토).
 * 각 항목: { label, weekday } — weekday는 실제 요일 인덱스(0=일~6=토)라 색 판정에 사용.
 */
const HEADER = BASE_LABELS.map((label, weekday) => ({ label, weekday }));

export function weekdayHeader() {
    return HEADER;
}
