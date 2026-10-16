import React, { useEffect, useMemo, useState } from "react";
import { Box, Card, Checkbox, InputBase, Menu, MenuItem, Stack, Typography, useMediaQuery } from "@mui/material";
import HeaderActionButton from "../../../shared/ui/common/HeaderActionButton.jsx";
import { useTheme } from "@mui/material/styles";
import ScopeTitle from "../../project/components/ScopeTitle.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BookmarkAddRoundedIcon from "@mui/icons-material/BookmarkAddRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { addSavedView, viewAssignees } from "../utils/savedViews.js";
import { getWorkspaceMembers } from "../../workspace/api/workspaceMemberApi.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { getUser } from "../../../shared/utils/tokenUtils.js";

/** 로컬 오늘 YYYY-MM-DD (타임존 안전) */
function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 목록 상단 인라인 빠른 추가 — 모달 없이 제목만으로 즉시 생성(Enter). '오늘' 필터 중이면 마감 오늘로. */
function QuickAddRow({ onAdd, dueToday, scopeName }) {
    const [value, setValue] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        const t = value.trim();
        if (!t || busy) return;
        setBusy(true);
        try {
            // 추가에 실패하면 입력한 제목을 잃지 않도록, 성공했을 때만 비운다
            const res = await onAdd(t, dueToday ? { dueDate: localToday() } : {});
            if (res?.ok) setValue("");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 1,
                borderBottom: "1px solid var(--plando-divider)",
                color: "text.secondary",
                "&:focus-within": { color: "var(--plando-primary)" },
            }}
        >
            <AddRoundedIcon sx={{ fontSize: 20 }} />
            <InputBase
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복 추가 방지
                    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                    if (e.key === "Enter") submit();
                }}
                placeholder={scopeName ? `${scopeName}에 빠른 추가 · 제목 입력 후 Enter` : "빠른 추가 · 제목 입력 후 Enter"}
                sx={{ flex: 1, fontSize: 14, fontWeight: 500, color: "text.primary" }}
                inputProps={{ "aria-label": "빠른 추가" }}
            />
        </Box>
    );
}

import AddTodoModal from "../../todo/components/form/AddTodoModal.jsx";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import TaskListFilterPopover from "../components/TaskListFilterPopover.jsx";
import ArchiveView from "../components/ArchiveView.jsx";
import useTaskListData from "../hooks/useTaskListData.jsx";
import { usePageRefresh } from "../../../shared/hooks/usePageRefresh.js";
import useTaskListFilters from "../hooks/useTaskListFilters.js";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";

import StatusStatChips from "../../../shared/ui/common/StatusStatChips.jsx";
import TaskListFilterStrip from "../components/desktop/TaskListFilterStrip.jsx";
import TaskListColumnHeader from "../components/desktop/TaskListColumnHeader.jsx";
import { useTaskListColumns, columnVars } from "../components/desktop/taskListColumns.js";
import TaskGroupHeader from "../components/desktop/TaskGroupHeader.jsx";
import TaskRow from "../components/desktop/TaskRow.jsx";
import { groupTasksByDueDate } from "../utils/groupTasksByDueDate.js";

import { updateTodoField, updateTodoFocus, archiveTodo, deleteTodo } from "../../todo/api/todoApi.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../workspace/hooks/useWorkspacePermissions.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { defaultTodoStatusKey, doneTodoStatusKey, notDoneTodoStatusKeys } from "../../../shared/utils/todoStatus.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import TaskViewTabs from "../../todo/components/board/TaskViewTabs.jsx";
import { rememberTaskView } from "../../todo/utils/taskView.js";
import AccessErrorBanner from "../../../shared/ui/common/AccessErrorBanner.jsx";

export default function TaskListPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const nav = useNavigate();
    const location = useLocation();
    const { currentWorkspace } = useWorkspace();
    const myEmail = getUser()?.email || "";
    const { matchesActiveProject, activeProjectId, activeProject } = useActiveProject();
    // 워크스페이스 상태 정의 (커스텀 상태 포함) — 상태 칩·완료 토글 키에 사용
    const { tags = [], statuses: statusDefs, label: statusLabelOf, colorOf: statusColorOf, categoryOf: statusCategoryOf } = useStatuses();
    // 생성·편집 권한 (보드와 동일 게이팅 — VIEWER는 생성/빠른추가/대량편집 UI 자체를 숨김).
    // 행 삭제만은 편집이 아니라 perms.canDeleteTodo(항목별)로 따로 판정한다 — 서버 규칙이 다르다.
    const perms = useWorkspacePermissions();
    const canCreate = perms.canEditContent;

    // 이 surface가 "할 일"의 목록 뷰. 사이드바 스코프가 last view로 돌아오도록 기억.
    useEffect(() => { rememberTaskView("/tasklist"); }, []);

    // 스코프(전체/인박스/프로젝트) 타이틀 + 뷰 탭(보드/목록/현황)
    const scopeLabel = activeProjectId == null
        ? "전체 할 일"
        : activeProjectId === "inbox" ? "인박스" : (activeProject?.name ?? "프로젝트");
    const scopeColor = activeProject?.color ?? null;

    // 모바일 → /todos 로 redirect (모바일은 /todos가 토스 톤으로 통합 제공)
    useEffect(() => {
        if (isMobile) nav("/todos", { replace: true });
    }, [isMobile, nav]);

    const {
        rows,
        subtasksByParent,
        loading,
        refresh,
        openAdd,
        setOpenAdd,
        openAddModal,
        task,
        setTask,
        handleAdd,
        quickAdd,
        deleteOpen,
        setDeleteOpen,
        deleteTarget,
        setDeleteTarget,
        errorOpen,
        setErrorOpen,
        errorMessage,
        openDetail,
        askDelete,
        confirmDelete,
        accessError,
    } = useTaskListData({ nav });

    const { columns: savedColumns, allColumns, isVisible, toggle, setWidth, reorder } = useTaskListColumns();
    // 프로젝트/인박스 스코프에선 프로젝트 컬럼이 전부 같은 값 → 숨김 (저장된 표시 설정은 유지)
    const projectScoped = activeProjectId != null;
    const columns = useMemo(
        () => (projectScoped ? savedColumns.filter((c) => c.key !== "project") : savedColumns),
        [savedColumns, projectScoped]
    );

    const [archiveOpen, setArchiveOpen] = useState(false);
    const [filterAnchor, setFilterAnchor] = useState(null);
    const [colMenuAnchor, setColMenuAnchor] = useState(null);
    const [collapsed, setCollapsed] = useState(new Set(["done"]));
    const [expandedRows, setExpandedRows] = useState(new Set());

    // ── 다중선택 대량 편집 ──
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkPrioAnchor, setBulkPrioAnchor] = useState(null);
    const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
    const toggleSelect = (id) => setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    // 상단 네비의 글로벌 프로젝트 필터를 먼저 적용 (전체면 그대로)
    const scopedRows = useMemo(() => rows.filter(matchesActiveProject), [rows, matchesActiveProject]);

    // 상태 칩 목록/집계는 워크스페이스 상태 정의 기준 — 커스텀 상태 작업도 빠짐없이 집계.
    // 정의에 없는 상태 키(삭제된 상태 등)는 보드 mobileGrouped와 동일하게 첫 상태로 폴백.
    const statusKeys = useMemo(() => statusDefs.map((s) => s.statusKey), [statusDefs]);
    const stats = useMemo(() => {
        const map = {};
        for (const key of statusKeys) map[key] = 0;
        const fallbackKey = statusKeys[0] ?? "TODO";
        for (const row of scopedRows) {
            const key = map[row.status] != null ? row.status : fallbackKey;
            map[key] += 1;
        }
        return map;
    }, [scopedRows, statusKeys]);

    const {
        statusSet, setStatusSet,
        prioritySet, setPrioritySet,
        activeFilterCount,
        filteredRows,
        toggleStatus,
        togglePriority,
        recurringOnly,
        setRecurringOnly,
        toggleRecurringOnly,
        dueDateFilter,
        setDueDateFilter,
        assigneeSel,
        tagSel,
        toggleTag,
        setOnlyTag,
        setAssigneeSel,
        toggleAssignee,
        clearFilters,
    } = useTaskListFilters(scopedRows);

    // 워크스페이스 멤버 목록 (담당자 필터 선택지)
    const [members, setMembers] = useState([]);
    useEffect(() => {
        const wid = currentWorkspace?.workspaceId;
        if (!wid) { setMembers([]); return; }
        let alive = true;
        getWorkspaceMembers(wid)
            .then((res) => { if (alive) setMembers(Array.isArray(res) ? res : []); })
            .catch(() => { if (alive) setMembers([]); });
        return () => { alive = false; };
    }, [currentWorkspace?.workspaceId]);

    useEffect(() => {
        /* 예전엔 location.state.priorityFilter를 읽어 값은 버리고 history.state만 비웠다.
           이 state를 실어 navigate하는 곳이 앱 전체에 하나도 없어서(=항상 undefined),
           "우선순위로 필터해서 들어오는 동선"이 있는 것처럼 보이지만 실제로는 죽은 코드였다.
           살릴 호출부가 생기면 아래 tagId 처리처럼 setPrioritySet까지 같이 붙일 것. */
        if (location.state?.openArchive) {
            setArchiveOpen(true);
            window.history.replaceState({}, "");
        }
        /* 검색에서 태그를 눌러 들어온 경우 — 그 태그 하나로만 필터한다(누적하면 엉뚱한 항목이 섞인다).
           state를 지우는 이유: 다른 필터를 만진 뒤 새로고침하면 태그가 되살아나 혼란스럽다. */
        if (location.state?.tagId != null) {
            setOnlyTag(location.state.tagId);
            window.history.replaceState({}, "");
        }
        // ── 사이드바에서 진입한 경우 (state.smartView 가 명시되어 있음) ──
        // string  → 해당 스마트 뷰 필터 hydration
        // null    → 메인 nav "할 일 목록" 클릭. 모든 필터 reset (스마트 뷰에서 빠져나오기)
        // undefined → 다른 페이지에서 진입했거나 직접 navigation. 기존 필터 유지.
        //
        // (history.replaceState 호출 안 함 — Sidebar 가 location.state.smartView 로 active 표시.
        //  필터 사용 중 새로고침 시에도 같은 view 가 유지되도록.)
        const view = location.state?.smartView;
        if (view !== undefined) {
            // 기존 필터 모두 초기화
            setStatusSet(new Set());
            setPrioritySet(new Set());
            setRecurringOnly(false);
            setDueDateFilter(null);
            setAssigneeSel([]);

            if (view === "today") {
                setDueDateFilter("today");
                // 커스텀 상태 워크스페이스에선 "TODO"/"IN_PROGRESS" 키가 아예 없을 수 있다.
                // 그대로 두면 사이드바 뱃지는 7인데 목록은 0건이 되고 이유를 알 방법이 없었다.
                setStatusSet(new Set(notDoneTodoStatusKeys(statusDefs)));
            } else if (view === "mine") {
                setAssigneeSel(["me"]);
            } else if (view === "overdue") {
                setDueDateFilter("overdue");
            } else if (view === "recurring") {
                setRecurringOnly(true);
            } else if (view && typeof view === "object" && view.filters) {
                // 사용자 저장 뷰 — 저장된 필터 조합 복원
                const f = view.filters;
                setStatusSet(new Set(f.statusSet ?? []));
                setPrioritySet(new Set(f.prioritySet ?? []));
                setRecurringOnly(!!f.recurringOnly);
                setDueDateFilter(f.dueDateFilter ?? null);
                setAssigneeSel(viewAssignees(f));
            }
            // view === null 이면 reset 만 하고 종료 (위에서 이미 초기화 완료)
        }
    }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

    const groups = useMemo(() => groupTasksByDueDate(filteredRows), [filteredRows]);

    usePageRefresh(refresh);

    // 행 펼침 — 서브태스크 인라인 노출
    const toggleExpand = (id) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleGroup = (id) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleToggleStatus = async (taskItem, newStatus) => {
        try {
            await updateTodoField(taskItem.id, "status", newStatus);
            // doneAt도 함께 패치 — 커스텀 완료 상태(key !== 'DONE')도 isTodoDone 기반 UI(체크/취소선)에 즉시 반영
            const done = statusCategoryOf(newStatus) === "DONE";
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: taskItem.id, patch: { status: newStatus, doneAt: done ? new Date().toISOString() : null } } }));
        } catch (e) {
            console.error("상태 변경 실패", e);
            // 서버가 거부하면 조용히 넘기지 않는다 — 백엔드 메시지를 띄우고 서버 상태로 재동기화 (보드와 동일)
            await refresh();
            toast.error(getApiError(e, "상태 변경 중 오류가 발생했어요."));
        }
    };

    const handleToggleFocus = async (taskItem) => {
        const next = !taskItem.focused;
        try {
            await updateTodoFocus(taskItem.id, next);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: taskItem.id, patch: { focused: next } } }));
        } catch (e) {
            console.error("포커스 토글 실패", e);
            await refresh();
            toast.error(getApiError(e, "포커스 변경 중 오류가 발생했어요."));
        }
    };

    // ── 대량 편집 실행 — 선택된 항목에 같은 작업을 일괄 적용 후 새로고침 ──
    const runBulk = async (fn, doneMsg) => {
        const ids = [...selectedIds];
        if (!ids.length || bulkBusy) return;
        setBulkBusy(true);
        try {
            // 항목별 실패를 삼키지 않는다 — 실패 개수를 세어 사실대로 알린다 (권한 없음 등으로 전부 실패 가능)
            const results = await Promise.allSettled(ids.map((id) => fn(id)));
            const failures = results.filter((r) => r.status === "rejected");
            if (failures.length) console.error("대량 작업 실패", failures.length, failures[0].reason);
            await refresh();
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
            if (failures.length === ids.length) {
                // 전부 실패 — 성공 토스트를 띄우지 않고, 재시도할 수 있게 선택도 유지
                toast.error(getApiError(failures[0].reason, "선택한 항목을 처리하지 못했어요."));
                return;
            }
            if (failures.length) toast.warning(`${doneMsg} ${failures.length}개는 처리하지 못했어요.`);
            else toast.success(doneMsg);
            exitSelect();
        } finally {
            setBulkBusy(false);
        }
    };
    // 완료/되돌림도 워크스페이스에 설정된 완료·기본 상태 키 사용 (보드와 동일)
    const bulkComplete = (done) => runBulk((id) => updateTodoField(id, "status", done ? doneTodoStatusKey(statusDefs) : defaultTodoStatusKey(statusDefs)), done ? "완료 처리했어요." : "되돌렸어요.");
    const bulkPriority = (p) => { setBulkPrioAnchor(null); runBulk((id) => updateTodoField(id, "priority", p), "우선순위를 변경했어요."); };
    const bulkArchive = () => runBulk((id) => archiveTodo(id), "보관했어요.");
    const bulkDelete = () => {
        if (!selectedIds.size) return;
        if (!window.confirm(`선택한 ${selectedIds.size}개를 삭제할까요? 되돌릴 수 없습니다.`)) return;
        runBulk((id) => deleteTodo(id), "삭제했어요.");
    };

    return (
        <Box sx={{ minHeight: "100%", bgcolor: "background.default" }}>
            {/* 403 — 세션은 유지하고 안내만 (워크스페이스 전환으로 복구) */}
            <AccessErrorBanner message={accessError} />

            {/* ── 헤더 바 (보드와 동일하게 paper) ── */}
            <Box
                sx={{
                    px: { md: 3, lg: 4 },
                    pt: 3,
                    pb: 2,
                    bgcolor: "background.paper",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
            {/* ── 헤더 ── */}
            <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} sx={{ mb: 2.25 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <ScopeTitle
                            color={scopeColor}
                            iconKey={activeProject?.icon}
                            label={scopeLabel}
                            onClick={typeof activeProjectId === "number" ? () => nav(`/projects/${activeProjectId}`) : undefined}
                        />
                        <Box sx={{ flexShrink: 0 }}>
                            <TaskViewTabs current="list" />
                        </Box>
                    </Stack>
                </Box>
                {canCreate && (
                    <HeaderActionButton icon={<AddRoundedIcon sx={{ fontSize: 17 }} />} onClick={openAddModal}>
                        새 할 일
                    </HeaderActionButton>
                )}
            </Stack>

            {/* ── 상태 칩 + 필터 strip (한 줄) ── */}
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
                <StatusStatChips
                    stats={stats}
                    total={scopedRows.length}
                    statuses={statusKeys}
                    labelOf={statusLabelOf}
                    colorOf={statusColorOf}
                    statusSet={statusSet}
                    onToggleStatus={toggleStatus}
                    onClearStatus={() => setStatusSet(new Set())}
                    sx={{ flexWrap: "nowrap", flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 260 }}>
                    <TaskListFilterStrip
                        recurringOnly={recurringOnly}
                        onToggleRecurring={toggleRecurringOnly}
                        archiveOpen={archiveOpen}
                        onToggleArchive={() => setArchiveOpen((p) => !p)}
                        activeFilterCount={activeFilterCount}
                        onOpenFilter={(e) => setFilterAnchor(e.currentTarget)}
                    />
                </Box>
                {/* 현재 필터 조합을 저장 뷰로 — 활성 필터가 있을 때만 */}
                {activeFilterCount > 0 && (
                    <HeaderActionButton
                        variant="ghost"
                        icon={<BookmarkAddRoundedIcon sx={{ fontSize: 18 }} />}
                        onClick={() => {
                            const name = window.prompt("저장할 뷰 이름을 입력하세요");
                            if (!name || !name.trim()) return;
                            addSavedView(name, {
                                statusSet: [...statusSet],
                                prioritySet: [...prioritySet],
                                recurringOnly,
                                dueDateFilter,
                                assignees: assigneeSel,
                            });
                            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: `"${name.trim()}" 뷰를 저장했어요.`, severity: "success" } }));
                        }}
                    >
                        필터 저장
                    </HeaderActionButton>
                )}
                {canCreate && (
                    <HeaderActionButton
                        variant={selectMode ? "ghost" : "secondary"}
                        icon={<ChecklistRoundedIcon sx={{ fontSize: 18 }} />}
                        onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                    >
                        {selectMode ? "선택 해제" : "선택"}
                    </HeaderActionButton>
                )}
            </Stack>
            </Box>

            {/* ── 본문 ── */}
            <Box sx={{ px: { md: 3, lg: 4 }, py: 3 }}>
            {/* ── 아카이브 뷰 ── */}
            {archiveOpen ? (
                <Card
                    variant="outlined"
                    className="tlc-table"
                    style={columnVars(columns)}
                    sx={{
                        borderRadius: "var(--plando-radius-card)",
                        boxShadow: "var(--plando-shadow-1)",
                        overflow: "hidden",
                    }}
                >
                    {/* p:2.5 로 한 겹 더 감싸지 않는다 — 목록과 같은 Card 표면에 행이 바로 붙어야
                        같은 화면으로 읽힌다(카드 안 카드가 되면 폭이 좁아져 작아 보인다).
                        tlc-table + columnVars: 목록에서 조정한 열 너비를 그대로 쓰기 위해 필요하다. */}
                    <ArchiveView onRefreshParent={refresh} />
                </Card>
            ) : (
                <Card
                    variant="outlined"
                    className="tlc-table"
                    style={columnVars(columns)}
                    sx={{
                        borderRadius: "var(--plando-radius-card)",
                        boxShadow: "var(--plando-shadow-1)",
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    <TaskListColumnHeader
                        columns={columns}
                        onReorder={reorder}
                        onResize={setWidth}
                        onOpenColumns={(e) => setColMenuAnchor(e.currentTarget)}
                    />

                    {canCreate && (
                        <QuickAddRow
                            onAdd={(title, extras) =>
                                quickAdd(title, {
                                    ...extras,
                                    // 프로젝트 스코프 안에서 추가하면 그 프로젝트로 (인박스/전체는 프로젝트 없음)
                                    ...(typeof activeProjectId === "number" ? { projectId: activeProjectId } : {}),
                                })
                            }
                            dueToday={dueDateFilter === "today"}
                            scopeName={typeof activeProjectId === "number" ? (activeProject?.name ?? "프로젝트") : null}
                        />
                    )}

                    {groups.length === 0 && !loading && (
                        <Box sx={{ py: 6, textAlign: "center", color: "text.disabled", fontSize: 13, fontWeight: 600 }}>
                            표시할 할 일이 없어요
                        </Box>
                    )}

                    {groups.map((g) => {
                        const isCollapsed = collapsed.has(g.id);
                        return (
                            <Box key={g.id}>
                                <TaskGroupHeader
                                    groupId={g.id}
                                    count={g.tasks.length}
                                    collapsed={isCollapsed}
                                    onToggle={() => toggleGroup(g.id)}
                                />
                                {!isCollapsed && g.tasks.map((t) => (
                                    <TaskRow
                                        key={t.id}
                                        task={t}
                                        columns={columns}
                                        // 확장 시 보여줄 서브태스크 — 필터 적용 전 전체 자식 (부모 펼침 = 전체 구성 보기)
                                        subtasks={subtasksByParent.get(t.id)}
                                        expanded={expandedRows.has(t.id)}
                                        onToggleExpand={toggleExpand}
                                        onOpen={openDetail}
                                        onToggleStatus={handleToggleStatus}
                                        onToggleFocus={handleToggleFocus}
                                        /* 삭제는 편집 권한이 아니라 삭제 권한(작성자 본인 || ADMIN, 샘플 제외)으로 게이팅한다.
                                           canCreate(=편집 권한)로 묶여 있던 동안 ① MEMBER인 작성자는 서버가 허용하는데도
                                           버튼을 못 봤고 ② 남이 만든 항목엔 눌러도 403인 버튼이 떴다. */
                                        onDelete={perms.canDeleteTodo(t) ? (taskItem) => askDelete(null, taskItem) : undefined}
                                        selectMode={selectMode}
                                        selected={selectedIds.has(t.id)}
                                        onToggleSelect={toggleSelect}
                                    />
                                ))}
                            </Box>
                        );
                    })}
                </Card>
            )}
            </Box>

            <TaskListFilterPopover
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}
                prioritySet={prioritySet}
                onTogglePriority={togglePriority}
                recurringOnly={recurringOnly}
                onToggleRecurring={toggleRecurringOnly}
                dueDateFilter={dueDateFilter}
                onSetDueDateFilter={setDueDateFilter}
                assigneeSel={assigneeSel}
                onToggleAssignee={toggleAssignee}
                tagSel={tagSel}
                onToggleTag={toggleTag}
                tags={tags}
                members={members}
                myEmail={myEmail}
                onClear={clearFilters}
            />

            {/* 표시할 열 (커스텀) */}
            <Menu
                anchorEl={colMenuAnchor}
                open={Boolean(colMenuAnchor)}
                onClose={() => setColMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ sx: { minWidth: 190, mt: 0.5, borderRadius: "12px" } }}
            >
                <Typography variant="caption" sx={{ px: 2, pt: 1.2, pb: 0.5, display: "block", fontWeight: 800, fontSize: 10.5, color: "text.disabled", letterSpacing: 0.5, textTransform: "uppercase" }}>
                    표시할 열
                </Typography>
                {allColumns.map((col) => {
                    const scopeHidden = projectScoped && col.key === "project";
                    return (
                        <MenuItem
                            key={col.key}
                            onClick={() => !scopeHidden && toggle(col.key)}
                            disabled={scopeHidden}
                            sx={{ mx: 0.75, my: 0.25, borderRadius: "10px", px: 0.75, py: 0.25 }}
                        >
                            <Checkbox checked={isVisible(col.key)} size="small" disableRipple sx={{ p: 0.5, mr: 0.5 }} />
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{col.label}</Typography>
                            {scopeHidden && (
                                <Typography sx={{ fontSize: 10.5, color: "text.disabled", ml: 1 }}>스코프 중 숨김</Typography>
                            )}
                        </MenuItem>
                    );
                })}
            </Menu>

            <ConfirmDialog
                open={deleteOpen}
                title="삭제 확인"
                message={
                    deleteTarget?.title
                        ? `"${deleteTarget.title}" 삭제할까요?\n삭제하면 되돌릴 수 없어요.`
                        : "이 작업을 삭제할까요?\n삭제하면 되돌릴 수 없어요."
                }
                confirmText="삭제"
                confirmColor="error"
                onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
                onConfirm={confirmDelete}
            />
            <ConfirmDialog
                open={errorOpen}
                title="삭제할 수 없음"
                message={errorMessage}
                confirmText="확인"
                confirmColor="primary"
                hideCancel
                onClose={() => setErrorOpen(false)}
                onConfirm={() => setErrorOpen(false)}
            />

            <AddTodoModal open={openAdd} onClose={() => setOpenAdd(false)} task={task} setTask={setTask} onSave={handleAdd} />

            {/* ── 대량 편집 액션 바 (선택된 항목이 있을 때 하단 플로팅) ── */}
            {canCreate && selectMode && selectedIds.size > 0 && (
                <Box
                    sx={{
                        position: "fixed",
                        left: "50%",
                        bottom: 24,
                        transform: "translateX(-50%)",
                        zIndex: 1300,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1.5,
                        py: 1,
                        borderRadius: 999,
                        bgcolor: "background.paper",
                        boxShadow: "var(--plando-elev-3)",
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Typography sx={{ fontSize: 13, fontWeight: 800, px: 1, color: "text.primary", whiteSpace: "nowrap" }}>
                        {selectedIds.size}개 선택
                    </Typography>
                    <Box sx={{ width: "1px", height: 20, bgcolor: "divider", mx: 0.5 }} />
                    <BulkBtn icon={<CheckCircleRoundedIcon />} label="완료" onClick={() => bulkComplete(true)} disabled={bulkBusy} />
                    <BulkBtn icon={<RadioButtonUncheckedRoundedIcon />} label="되돌림" onClick={() => bulkComplete(false)} disabled={bulkBusy} />
                    <BulkBtn icon={<FlagRoundedIcon />} label="우선순위" onClick={(e) => setBulkPrioAnchor(e.currentTarget)} disabled={bulkBusy} />
                    <BulkBtn icon={<ArchiveRoundedIcon />} label="보관" onClick={bulkArchive} disabled={bulkBusy} />
                    <BulkBtn icon={<DeleteRoundedIcon />} label="삭제" onClick={bulkDelete} disabled={bulkBusy} danger />
                    <Box sx={{ width: "1px", height: 20, bgcolor: "divider", mx: 0.5 }} />
                    <BulkBtn icon={<CloseRoundedIcon />} label="취소" onClick={exitSelect} />
                </Box>
            )}
            <Menu
                anchorEl={bulkPrioAnchor}
                open={Boolean(bulkPrioAnchor)}
                onClose={() => setBulkPrioAnchor(null)}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
                transformOrigin={{ vertical: "bottom", horizontal: "center" }}
                PaperProps={{ sx: { borderRadius: "12px", minWidth: 140 } }}
            >
                {[["HIGH", "높음"], ["MEDIUM", "보통"], ["LOW", "낮음"]].map(([val, lbl]) => (
                    <MenuItem key={val} onClick={() => bulkPriority(val)} sx={{ fontWeight: 700, fontSize: 13 }}>{lbl}</MenuItem>
                ))}
            </Menu>
        </Box>
    );
}

/** 대량 편집 바의 아이콘+라벨 버튼 */
function BulkBtn({ icon, label, onClick, disabled, danger }) {
    return (
        <Box
            component="button"
            onClick={onClick}
            disabled={disabled}
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.1,
                background: "none",
                border: "none",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
                px: 1,
                py: 0.5,
                borderRadius: "10px",
                color: danger ? "error.main" : "text.secondary",
                "&:hover": { bgcolor: "action.hover" },
            }}
        >
            {React.cloneElement(icon, { sx: { fontSize: 19 } })}
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</Typography>
        </Box>
    );
}

