/**
 * 바텀시트 하단 안전영역 계산.
 *
 * RN Modal 안에서는 useSafeAreaInsets()의 bottom이 실제 홈 인디케이터 높이보다
 * 크게 잡히는 경우가 있다. 그 값을 그대로 paddingBottom에 쓰면
 *  (1) 시트 아래에 큰 빈 공간이 생기고
 *  (2) 그만큼 스크롤 영역이 밀려 마지막 항목이 잘린다.
 * 시트 구현이 여러 곳에 복제돼 있어(todoPickers / ProjectScopeFilter / calendar DaySheet)
 * 상한 로직을 여기 한 곳에 둔다.
 */
export const SHEET_MAX_BOTTOM_INSET = 34; // 홈 인디케이터 기준

export function sheetBottomInset(bottom: number): number {
  return Math.min(bottom ?? 0, SHEET_MAX_BOTTOM_INSET);
}
