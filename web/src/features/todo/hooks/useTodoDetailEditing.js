import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import useRecurrence from "./useRecurrence.js";
import { useProjects, resolveProject, assignTodoToProjectAndNotify } from "../../project/store/projectStore.js";
import { getProjectIcon } from "../../project/projectIcons.js";
import { getOptionValue } from "../../../shared/utils/assigneeUtils.js";
import { toast } from "../../../shared/utils/toast.js";

/**
 * TodoDetailDesktop / TodoDetailMobile 공통 편집 로직.
 *
 * 두 뷰에 글자 단위로 중복돼 있던 파생값·핸들러를 통합한다:
 *  - selectedAssigneeValues (참여자 선택값)
 *  - 제목 인플레이스 편집(titleRef + 동기화 effect + handleTitleInput)
 *  - 설명 변경(handleDescChange)
 *  - 속성 아코디언(expandedAttr / toggleAttr)
 *  - 반복(useRecurrence)
 *  - 프로젝트 소속(curProject / changeProject 등)
 *
 * 푸터 문구는 두 뷰가 서로 달라(데스크탑은 "· 방금 전" 등) 각 컴포넌트에 남겨둔다.
 */
export default function useTodoDetailEditing({
    todo,
    editable,
    setEditable,
    onPatchLocal,
    debouncedCommit,
    selectedAssignees,
}) {
    /* ── 참여자 선택값 ─────────────────────────────────── */
    const selectedAssigneeValues = useMemo(() => {
        if (Array.isArray(editable?.assignees)) {
            return editable.assignees.map((item) => getOptionValue(item));
        }
        if (Array.isArray(selectedAssignees)) {
            return selectedAssignees.map((item) => getOptionValue(item));
        }
        return [];
    }, [editable?.assignees, selectedAssignees]);

    /* ── 제목 인플레이스 편집 ──────────────────────────── */
    const titleRef = useRef(null);
    useEffect(() => {
        // 새 todo 진입 시에만 동기화. 값은 갓 받아온 prop(todo)에서 읽는다.
        // editable은 부모 useTodoDetailPanel의 [todo] effect로 늦게 갱신되어, 여기서
        // editable을 읽으면 제목/내용이 한 박자 밀려(off-by-one) 직전 일정 내용이 남는다.
        if (titleRef.current) {
            const next = todo?.title ?? "";
            if (titleRef.current.textContent !== next) titleRef.current.textContent = next;
        }
        // 내용은 RichTextEditor가 value(todo.content)로 자체 동기화.
    }, [todo?.id]);

    const handleTitleInput = useCallback((e) => {
        const v = e.currentTarget.textContent;
        setEditable((prev) => ({ ...prev, title: v }));
        onPatchLocal?.({ title: v });
        if (v.trim()) debouncedCommit("title", v);
    }, [debouncedCommit, onPatchLocal, setEditable]);

    // RichTextEditor는 마크다운 문자열을 직접 넘겨준다.
    const handleDescChange = useCallback((v) => {
        setEditable((prev) => ({ ...prev, content: v }));
        onPatchLocal?.({ content: v });
        debouncedCommit("content", v);
    }, [debouncedCommit, onPatchLocal, setEditable]);

    /* ── 속성 아코디언(한 번에 하나만 펼침) ────────────── */
    const [expandedAttr, setExpandedAttr] = useState(null);
    const toggleAttr = (key) => setExpandedAttr((p) => (p === key ? null : key));

    /* ── 반복 ──────────────────────────────────────────── */
    const recurrence = useRecurrence(todo?.id);

    /* ── 프로젝트 소속 ─────────────────────────────────── */
    const projects = useProjects();
    const curProject = resolveProject(editable ?? todo);
    const curProjectIsInbox = !curProject;
    const CurProjectIcon = curProjectIsInbox ? InboxRoundedIcon : getProjectIcon(curProject.icon);
    const changeProject = (scope) => {
        const isInbox = scope == null || scope === "inbox";
        const patch = { projectId: isInbox ? null : Number(scope) };
        // 패널/보드 로컬 상태 즉시 반영 (assign...Notify는 서버 저장 + 카운트 갱신만 담당)
        setEditable((prev) => (prev ? { ...prev, ...patch } : prev));
        onPatchLocal?.(patch);
        assignTodoToProjectAndNotify(todo?.id, scope)
            .catch(() => toast.error("프로젝트 변경에 실패했어요."));
        setExpandedAttr(null);
    };

    return {
        selectedAssigneeValues,
        titleRef,
        handleTitleInput,
        handleDescChange,
        expandedAttr,
        setExpandedAttr,
        toggleAttr,
        recurrence,
        projects,
        curProject,
        curProjectIsInbox,
        CurProjectIcon,
        changeProject,
    };
}
