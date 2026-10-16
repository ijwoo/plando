/**
 * todo 객체에서 담당자 배열을 일관되게 추출.
 * 여러 필드명 변형 (assignees / assigneeNames / assigneeNameList / assigneeName / assignee) 대응.
 * @returns {{ name: string, profileImageUrl?: string }[]}
 */
export function resolveAssigneeList(todo) {
    if (!todo) return [];
    if (Array.isArray(todo.assignees) && todo.assignees.length > 0) return todo.assignees;
    if (Array.isArray(todo.assigneeNames) && todo.assigneeNames.length > 0)
        return todo.assigneeNames.map((name) => ({ name }));
    if (Array.isArray(todo.assigneeNameList) && todo.assigneeNameList.length > 0)
        return todo.assigneeNameList.map((name) => ({ name }));
    if (todo.assigneeName) return [{ name: todo.assigneeName }];
    if (todo.assignee) return [todo.assignee];
    return [];
}

/**
 * 주어진 email 이 todo 의 담당자 목록에 포함되는지.
 * (assignees 가 객체 배열, 문자열 배열, 콤마구분 문자열 등 다양한 형태일 수 있음.)
 */
export function isAssignedToEmail(todo, email) {
    if (!email) return false;
    const list = resolveAssigneeList(todo);
    return list.some((a) => (typeof a === "string" ? a : a?.email) === email);
}

/**
 * todo 객체에서 담당자 표시 문자열을 반환.
 * e.g. "홍길동", "홍길동 외 2명"
 */
export function resolveAssigneeLabel(todo) {
    const list = resolveAssigneeList(todo);
    if (list.length === 0) return null;
    const first = typeof list[0] === "string" ? list[0] : (list[0]?.name || list[0]?.email || "");
    if (list.length === 1) return first;
    return `${first} 외 ${list.length - 1}명`;
}

export function getOptionValue(option) {
    if (typeof option === "string") return option;
    return option?.email ?? option?.value ?? option?.id ?? option?.userEmail ?? "";
}

export function getOptionLabel(option) {
    if (typeof option === "string") return option;
    return (
        option?.name ??
        option?.label ??
        option?.userName ??
        option?.email ??
        option?.userEmail ??
        "-"
    );
}

export function getAvatarSrc(option) {
    if (!option?.profileImageUrl) return undefined;
    if (
        option.profileImageUrl.startsWith("http://") ||
        option.profileImageUrl.startsWith("https://")
    ) {
        return option.profileImageUrl;
    }
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    return `${baseUrl}${option.profileImageUrl}`;
}
