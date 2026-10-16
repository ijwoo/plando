import { useCallback, useMemo, useState } from "react";
import { STATUSES } from "../../../shared/ui/tone.js";
import { toDateFromYmd } from "../../calendar/utils/calendarUtils.js";
import { isSameDay } from "../../../shared/utils/formatters.js";
import { isAssignedToEmail, resolveAssigneeList } from "../../../shared/utils/assigneeUtils.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { isTodoDone } from "../../../shared/utils/todoStatus.js";

function matchesDueDateFilter(row, filter) {
    if (!filter) return true;
    if (!row.dueDate) return false;
    const due = toDateFromYmd(row.dueDate);
    if (!due) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (filter === "today") return isSameDay(due, today);
    if (filter === "overdue") return due < today && !isTodoDone(row);
    return true;
}

export default function useTaskListFilters(rows = []) {
    // ==============================
    // 검색어 / 필터 상태
    // ==============================
    const [statusSet, setStatusSet] = useState(new Set());
    const [prioritySet, setPrioritySet] = useState(new Set());
    const [recurringOnly, setRecurringOnly] = useState(false);
    const [dueDateFilter, setDueDateFilter] = useState(null); // null | 'today' | 'overdue'
    // 담당 다중 필터 토큰: 'me'(내 할 일) · 'none'(미지정) · <email>(멤버). 합집합(OR).
    const [assigneeSel, setAssigneeSel] = useState([]);
    const toggleAssignee = useCallback((token) => {
        setAssigneeSel((prev) => (prev.includes(token) ? prev.filter((x) => x !== token) : [...prev, token]));
    }, []);
    /* 태그 다중 필터(합집합). 담당자 축과 같은 규칙 — 선택한 태그 중 하나라도 붙어 있으면 통과.
       태그는 응답(row.tags)에 이미 실려 오므로 추가 요청이 없다.
       모바일이 먼저 이 축을 갖고 있었고 웹만 없어서, 검색에서 태그를 눌러도 필터가 안 걸렸다. */
    const [tagSel, setTagSel] = useState([]);
    const toggleTag = useCallback((id) => {
        setTagSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }, []);
    /** 검색 등 외부에서 특정 태그 하나로 진입할 때 — 이전 선택을 덮는다(누적되면 엉뚱한 항목이 섞인다) */
    const setOnlyTag = useCallback((id) => { setTagSel(id == null ? [] : [id]); }, []);

    const myEmail = useMemo(() => getUser()?.email || "", []);

    // ==============================
    // 활성 필터 개수
    // ==============================
    // 상태는 별도 칩으로 빠졌으므로 "필터 추가" 개수에서 제외
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (prioritySet.size > 0) count += 1;
        if (recurringOnly) count += 1;
        if (dueDateFilter) count += 1;
        if (assigneeSel.length > 0) count += 1;
        if (tagSel.length > 0) count += 1;
        return count;
    }, [prioritySet, recurringOnly, dueDateFilter, assigneeSel, tagSel]);

    // ==============================
    // 검색 + 필터 적용 목록
    // ==============================
    const filteredRows = useMemo(() => {
        const useStatus = statusSet.size > 0;
        const usePriority = prioritySet.size > 0;

        return (rows ?? []).filter((row) => {
            const okStatus = !useStatus || statusSet.has(row.status);
            const okPriority = !usePriority || prioritySet.has(row.priority);
            const okRecurring = !recurringOnly || row.hasRecurrence || row.recurrenceSourceId != null;
            const okDueDate = matchesDueDateFilter(row, dueDateFilter);
            // 담당자: 다중 선택(합집합). 선택된 토큰 중 하나라도 매칭되면 통과.
            let okAssignee = true;
            if (assigneeSel.length > 0) {
                okAssignee = assigneeSel.some((tok) => {
                    if (tok === "none") return resolveAssigneeList(row).length === 0;
                    if (tok === "me") return isAssignedToEmail(row, myEmail);
                    return isAssignedToEmail(row, tok);
                });
            }

            // 태그: 다중 선택(합집합)
            let okTag = true;
            if (tagSel.length > 0) {
                const ids = new Set((row.tags ?? []).map((t) => t?.id).filter((v) => v != null));
                okTag = tagSel.some((id) => ids.has(id));
            }

            return okStatus && okPriority && okRecurring && okDueDate && okAssignee && okTag;
        });
    }, [rows, statusSet, prioritySet, recurringOnly, dueDateFilter, assigneeSel, tagSel, myEmail]);

    // ==============================
    // 상태별 그룹핑
    // ==============================
    const grouped = useMemo(() => {
        const map = { TODO: [], IN_PROGRESS: [], DONE: [] };

        for (const row of filteredRows) {
            if (map[row.status]) {
                map[row.status].push(row);
            }
        }

        return map;
    }, [filteredRows]);

    // ==============================
    // 현재 화면에 보여줄 상태 목록
    // - 상태 필터가 없으면 전체 상태 표시
    // - 상태 필터가 있으면 선택된 상태만 표시
    // ==============================
    const visibleStatuses = useMemo(() => {
        if (statusSet.size === 0) return STATUSES;
        return STATUSES.filter((status) => statusSet.has(status));
    }, [statusSet]);

    // ==============================
    // 필터 토글 공통 함수
    // ==============================
    const toggleSetValue = useCallback((setFn, key) => {
        setFn((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }, []);

    // ==============================
    // 상태 / 우선순위 토글
    // ==============================
    const toggleStatus = useCallback(
        (status) => {
            toggleSetValue(setStatusSet, status);
        },
        [toggleSetValue]
    );

    const togglePriority = useCallback(
        (priority) => {
            toggleSetValue(setPrioritySet, priority);
        },
        [toggleSetValue]
    );

    // ==============================
    // 필터 초기화
    // ==============================
    const toggleRecurringOnly = useCallback(() => setRecurringOnly((v) => !v), []);

    const clearFilters = useCallback(() => {
        setStatusSet(new Set());
        setPrioritySet(new Set());
        setRecurringOnly(false);
        setDueDateFilter(null);
        setAssigneeSel([]);
        setTagSel([]);
    }, []);

    return {
        statusSet,
        setStatusSet,

        prioritySet,
        setPrioritySet,

        activeFilterCount,
        filteredRows,
        grouped,
        visibleStatuses,

        toggleStatus,
        togglePriority,
        recurringOnly,
        setRecurringOnly,
        toggleRecurringOnly,

        // ── 신규 필터 차원 ──
        dueDateFilter,
        setDueDateFilter,
        assigneeSel,
        setAssigneeSel,
        toggleAssignee,
        tagSel,
        toggleTag,
        setOnlyTag,

        clearFilters,
    };
}
