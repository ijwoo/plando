/**
 * 커스텀 상태 도입 후 완료 판정 단일 소스.
 *
 * 백엔드가 상태를 임의 문자열 key(TODO/IN_PROGRESS/DONE + 커스텀)로 바꾸면서,
 * "완료"는 더 이상 `status === 'DONE'` 하나로 판정할 수 없다(커스텀 완료-카테고리 상태 존재).
 * 서버가 내려주는 `doneAt`(완료 시각, 카테고리 DONE일 때만 세팅)을 1차 기준으로,
 * doneAt이 없는 구(舊) 응답은 기존 'DONE' 문자열로 폴백한다.
 *
 * 기존 `status === 'DONE'` 산재 코드를 이 함수로 점진 교체 → 커스텀 완료 상태도 완료로 집계된다.
 */
export function isTodoDone(todo) {
    if (!todo) return false;
    if (todo.doneAt != null) return true;
    return todo.status === "DONE";
}

/** 상태 목록에서 "미완료로 되돌릴" 기본 상태 key (TODO 카테고리 중 기본, 없으면 'TODO'). */
export function defaultTodoStatusKey(statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) return "TODO";
    const todoCat = statuses.filter((s) => s.category === "TODO");
    const pick = todoCat.find((s) => s.isDefault) || todoCat[0] || statuses[0];
    return pick?.statusKey ?? "TODO";
}

/** 상태 목록에서 "완료 처리할" 상태 key (DONE 카테고리 기본, 없으면 첫 항목, 그것도 없으면 'DONE'). */
export function doneTodoStatusKey(statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) return "DONE";
    const doneCat = statuses.filter((s) => s.category === "DONE");
    const pick = doneCat.find((s) => s.isDefault) || doneCat[0];
    return pick?.statusKey ?? "DONE";
}

/**
 * "미완료"로 취급할 상태 key 목록 (DONE 카테고리 제외).
 *
 * 스마트 뷰(오늘 마감 등)가 `["TODO","IN_PROGRESS"]`를 하드코딩하면 커스텀 상태의 할 일이
 * 통째로 사라진다 — 상태 집합에서 파생하도록 이 헬퍼를 쓴다.
 * 상태 로드 전(빈 배열)에는 기본 2종으로 폴백해 화면이 비지 않게 한다.
 */
export function notDoneTodoStatusKeys(statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) return ["TODO", "IN_PROGRESS"];
    const keys = statuses.filter((s) => s.category !== "DONE").map((s) => s.statusKey);
    return keys.length ? keys : ["TODO", "IN_PROGRESS"];
}
