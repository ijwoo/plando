/**
 * "할 일" surface의 마지막 뷰(보드/목록) 경로 기억.
 * 사이드바에서 스코프(전체/인박스/프로젝트)를 고를 때 보던 뷰를 유지하기 위함.
 *
 * 기본값은 **목록**(/tasklist)이다. 예전엔 보드였는데, 실제로는 목록을 훨씬 많이 본다.
 * 한 번이라도 보드를 열면 그 선택이 기억되므로, 바뀌는 건 "아직 고른 적 없는 사람"뿐이다.
 */
const KEY = "plando.taskView";

export function rememberTaskView(path) {
    try { localStorage.setItem(KEY, path); } catch { /* ignore */ }
}

export function getTaskPath() {
    try { return localStorage.getItem(KEY) || "/tasklist"; } catch { return "/tasklist"; }
}
