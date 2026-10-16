import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Stack,
    useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";

import AddTodoModal from "../components/form/AddTodoModal.jsx";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import MobileKanban from "../components/board/MobileKanban.jsx";
import MobileProjectFilter from "../../project/components/MobileProjectFilter.jsx";
import MobileArchiveView from "../components/board/MobileArchiveView.jsx";
import MobileListView from "../components/board/MobileListView.jsx";
import MobileFab from "../../../shared/ui/common/MobileFab.jsx";
import TextTabs from "../../../shared/ui/common/TextTabs.jsx";
import TodoViewToggle from "../components/board/TodoViewToggle.jsx";
import BoardHeader from "../components/board/desktop/BoardHeader.jsx";
import BoardColumn from "../components/board/desktop/BoardColumn.jsx";
import AddStatusDialog from "../components/board/AddStatusDialog.jsx";
import ManageStatusesDialog from "../components/board/ManageStatusesDialog.jsx";

import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../workspace/hooks/useWorkspacePermissions.js";
import { isTodoDone, defaultTodoStatusKey, doneTodoStatusKey } from "../../../shared/utils/todoStatus.js";
import { getMobilePageBg } from "../../../shared/ui/glassSx.js";
import useTodoBoardData from "../hooks/useTodoBoardData.jsx";
import { usePageRefresh } from "../../../shared/hooks/usePageRefresh.js";
import { TODO_FILTERS, DATE_FILTERS, filterTodosByView, filterTodosByDate, filterTodosByRecurrence } from "../utils/todoFilters.js";
import { rememberTaskView } from "../utils/taskView.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { updateTodoField, archiveTodo } from "../api/todoApi.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";
import AccessErrorBanner from "../../../shared/ui/common/AccessErrorBanner.jsx";

/** 칸반 보드형 작업 페이지 */
export default function TodoBoardPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const isDark = theme.palette.mode === "dark";
    const nav = useNavigate();
    const location = useLocation();
    const { statuses: statusDefs, categoryOf: statusCategoryOf } = useStatuses();
    const perms = useWorkspacePermissions();
    const canCreate = perms.canEditContent;
    const [addStatusOpen, setAddStatusOpen] = useState(false);
    const [manageStatusOpen, setManageStatusOpen] = useState(false);

    const {
        todos,

        open,
        setOpen,
        openAddModalWithStatus,
        task,
        setTask,
        handleAdd,

        deleteOpen,
        setDeleteOpen,
        deleteTarget,
        setDeleteTarget,

        errorOpen,
        setErrorOpen,
        errorMessage,

        refresh,
        onDrop,
        onDropByTouch,
        requestDelete,
        handleConfirmDelete,
        openRightDetail,
        accessError,
    } = useTodoBoardData({ nav });

    usePageRefresh(refresh);
    const { matchesActiveProject, activeProjectId, activeProject } = useActiveProject();

    // 더보기 등 외부에서 ?view=archive 로 진입하면 보관함을 바로 연다
    const [mobileView, setMobileView] = useState(
        () => (new URLSearchParams(location.search).get("view") === "archive" ? "archive" : "board")
    ); // "board" | "archive"

    // 외부(DM 등)에서 ?openTodoId=N 으로 진입 시 해당 할 일 상세 자동 오픈
    const openedTodoRef = useRef(null);
    useEffect(() => {
        const id = new URLSearchParams(location.search).get("openTodoId");
        if (!id || openedTodoRef.current === id) return;
        openedTodoRef.current = id;
        // openRightDetail은 id를 받아 상세를 직접 fetch — 목록 로드 대기 불필요
        openRightDetail(Number(id) || id);
        nav("/todos", { replace: true }); // 쿼리 제거 — 재오픈 방지
    }, [location.search, openRightDetail, nav]);
    const [viewFilter, setViewFilter] = useState(TODO_FILTERS.ALL);
    const [dateFilter, setDateFilter] = useState(null);
    const [recurringOnly, setRecurringOnly] = useState(false);
    const [dragOverStatus, setDragOverStatus] = useState(null);
    const [draggingId, setDraggingId] = useState(null);

    // ── 모바일 전용 state ──
    // location.state.initialTab으로 진입 탭 override 가능 (Dashboard "전체보기" 등에서)
    const initialMobileTab = location.state?.initialTab || "today";
    const [mobileTab, setMobileTab] = useState(initialMobileTab); // today | week | all | done | recurring
    const [mobileViewType, setMobileViewType] = useState("list"); // list | kanban

    // 다른 페이지에서 navigate 후 location.state.initialTab이 다시 오면 적용 (라우트 재진입 대응)
    useEffect(() => {
        if (location.state?.initialTab) {
            setMobileTab(location.state.initialTab);
        }
    }, [location.state?.initialTab]);

    const loginUser = getUser();
    const myEmail = loginUser?.email || "";

    // 이 surface가 "할 일"의 보드 뷰. 사이드바 스코프가 last view로 돌아오도록 기억.
    useEffect(() => { rememberTaskView("/todos"); }, []);

    // 스코프(전체/인박스/프로젝트) 타이틀 + 뷰 탭(보드/목록)
    const scopeLabel = activeProjectId == null
        ? "전체 할 일"
        : activeProjectId === "inbox" ? "인박스" : (activeProject?.name ?? "프로젝트");
    const scopeColor = activeProject?.color ?? null;

    const DATE_CHIP_OPTIONS = [
        { key: DATE_FILTERS.TODAY, label: "오늘" },
        { key: DATE_FILTERS.TOMORROW, label: "내일" },
        { key: DATE_FILTERS.THIS_WEEK, label: "이번 주" },
    ];

    /* 온보딩 활성화 시 아래 코드 주석 해제
    useEffect(() => {
        let mounted = true;

        const fetchSettings = async () => {
            try {
                const res = await getMySettings();
                if (!mounted) return;

                const seen = res.data?.todoTutorialSeen ?? false;
                setTutorialSeen(seen);
            } catch (e) {
                console.error("설정 조회 실패", e);
                setTutorialSeen(true);
            } finally {
                if (mounted) setSettingsLoaded(true);
            }
        };

        fetchSettings();

        return () => {
            mounted = false;
        };
    }, []);

    const finishTutorial = useCallback(async () => {
        close();

        if (tutorialSeen) return;

        setTutorialSeen(true);

        try {
            await markTutorialSeen("todo");
        } catch (e) {
            console.error("튜토리얼 상태 저장 실패", e);
        }
    }, [close, tutorialSeen]);
    */

    // 데스크탑/모바일 모두 글로벌 프로젝트 스코프(ActiveProjectContext)를 따른다.
    const scopedTodos = useMemo(
        () => (todos ?? []).filter(matchesActiveProject),
        [todos, matchesActiveProject]
    );

    const filteredTodos = useMemo(() => {
        const byView = filterTodosByView(scopedTodos, viewFilter, myEmail);
        const byDate = filterTodosByDate(byView, dateFilter);
        return filterTodosByRecurrence(byDate, recurringOnly);
    }, [scopedTodos, viewFilter, myEmail, dateFilter, recurringOnly]);

    /* 세로 휠로 보드를 가로 이동. 예전엔 가운데 버튼 드래그밖에 없어 불편했다.
       ⚠️ 컬럼 안에는 자체 세로 스크롤이 있다 — 아직 더 스크롤할 여지가 있으면 그쪽에 양보하고,
       끝에 닿았을 때만 가로로 바꾼다. 트랙패드의 가로 제스처(deltaX)는 브라우저 기본 동작에 맡긴다. */
    const boardScrollRef = useRef(null);
    useEffect(() => {
        const el = boardScrollRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            const col = e.target instanceof Element ? e.target.closest("[data-board-scroll]") : null;
            if (col) {
                const atTop = col.scrollTop <= 0;
                const atBottom = col.scrollTop + col.clientHeight >= col.scrollHeight - 1;
                const wantsUp = e.deltaY < 0;
                if ((wantsUp && !atTop) || (!wantsUp && !atBottom)) return; // 컬럼이 더 스크롤될 수 있으면 양보
            }
            el.scrollLeft += e.deltaY;
            e.preventDefault();
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const grouped = useMemo(() => {
        const map = {};
        for (const s of statusDefs) map[s.statusKey] = [];
        const fallbackKey = statusDefs[0]?.statusKey ?? "TODO";
        for (const todo of filteredTodos) {
            (map[todo.status] ?? map[fallbackKey])?.push(todo);
        }
        return map;
    }, [filteredTodos, statusDefs]);

    // 데스크탑 BoardHeader용 카운트 (필터 무관 — 전체 todos 기준 + viewFilter 변환)
    const headerCounts = useMemo(() => {
        const baseAll = scopedTodos;
        const baseMine = filterTodosByView(baseAll, TODO_FILTERS.ASSIGNED_TO_ME, myEmail);
        const active = baseAll.filter((t) => !isTodoDone(t));
        return {
            /* 스코프 카운트는 **화면에 보이는 수**여야 한다.
               [고치는 결함] 전체에서 완료를 빼고 셌는데, 보드는 완료 칼럼까지 그린다.
               그래서 헤더는 15, 칼럼 합계는 16 이 되어 자기 화면과 어긋났고 목록 뷰(16)와도
               달랐다. 숫자 두 개가 다르면 사용자는 둘 다 안 믿는다.
               아래 날짜 칩은 그대로 "남은 일" 기준이다 — 오늘 칩이 끝낸 일까지 세면
               "오늘 할 일 3개" 가 이미 다 한 일을 포함하게 된다. */
            all: baseAll.length,
            mine: baseMine.length,
            [DATE_FILTERS.TODAY]: filterTodosByDate(active, DATE_FILTERS.TODAY).length,
            [DATE_FILTERS.TOMORROW]: filterTodosByDate(active, DATE_FILTERS.TOMORROW).length,
            [DATE_FILTERS.THIS_WEEK]: filterTodosByDate(active, DATE_FILTERS.THIS_WEEK).length,
            recurring: filterTodosByRecurrence(active, true).length,
        };
    }, [scopedTodos, myEmail]);

    // ── 모바일: 스코프 → viewFilter(전체/내할일) → mobileTab 순서로 필터 ──
    const mobileFilteredTodos = useMemo(() => {
        const base = filterTodosByView(scopedTodos, viewFilter, myEmail);
        if (mobileTab === "recurring") return filterTodosByRecurrence(base, true);
        if (mobileTab === "today") return filterTodosByDate(base, DATE_FILTERS.TODAY);
        if (mobileTab === "week") return filterTodosByDate(base, DATE_FILTERS.THIS_WEEK);
        return base;
    }, [scopedTodos, mobileTab, viewFilter, myEmail]);

    const mobileTabCounts = useMemo(() => {
        // 카운트도 스코프·viewFilter 반영해서 사용자 시각 상에 일관됨
        const base = filterTodosByView(scopedTodos, viewFilter, myEmail);
        const today = filterTodosByDate(base, DATE_FILTERS.TODAY).filter(t => !isTodoDone(t)).length;
        const week = filterTodosByDate(base, DATE_FILTERS.THIS_WEEK).filter(t => !isTodoDone(t)).length;
        const all = base.filter(t => !isTodoDone(t)).length;
        const done = base.filter(t => isTodoDone(t)).length;
        const recurring = filterTodosByRecurrence(base, true).length;
        return { today, week, all, done, recurring };
    }, [scopedTodos, viewFilter, myEmail]);

    // ── 모바일 칸반에서 사용할 grouped (mobileTab 기준) ──
    const mobileGrouped = useMemo(() => {
        const map = {};
        for (const s of statusDefs) map[s.statusKey] = [];
        const fallbackKey = statusDefs[0]?.statusKey ?? "TODO";
        for (const todo of mobileFilteredTodos) {
            (map[todo.status] ?? map[fallbackKey])?.push(todo);
        }
        return map;
    }, [mobileFilteredTodos, statusDefs]);

    // ── 모바일 스와이프 완료: optimistic update + API ──
    /* deps에 statusDefs/statusCategoryOf가 빠져 있으면 첫 렌더의 FALLBACK_STATUSES(TODO/IN_PROGRESS/DONE)를
       영구히 캡처한다 → 커스텀 상태 워크스페이스에서 "되돌리기"가 존재하지 않는 key를 보내 400이 났다. */
    const handleMobileToggleStatus = useCallback(async (id, currentStatus) => {
        const wasDone = statusCategoryOf(currentStatus) === "DONE";
        const next = wasDone ? defaultTodoStatusKey(statusDefs) : doneTodoStatusKey(statusDefs);
        // doneAt도 같이 패치 — 완료 판정(isTodoDone)이 doneAt 기준이라 커스텀 완료 상태도 즉시 반영된다
        const nextDoneAt = wasDone ? null : new Date().toISOString();
        window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id, patch: { status: next, doneAt: nextDoneAt } } }));
        try {
            await updateTodoField(id, "status", next);
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
        } catch (e) {
            toast.error(getApiError(e, "상태 변경에 실패했어요."));
            // 롤백도 doneAt까지 되돌린다 (직후 refresh가 서버 값으로 덮어씀)
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id, patch: { status: currentStatus, doneAt: wasDone ? new Date().toISOString() : null } } }));
            await refresh();
        }
    }, [refresh, statusDefs, statusCategoryOf]);

    // ── 모바일 스와이프 보관: archiveTodo API 사용 ──
    const handleMobileArchive = useCallback(async (id) => {
        try {
            await archiveTodo(id);
            /* 보관 이벤트는 top-level `archived`로 알린다 — 수신부(useTodoBoardData/useTaskListData/
               useCalendarData, WS 브리지)가 모두 detail.archived만 보고 행을 목록에서 치운다.
               patch 안에 넣으면 archived: true가 필드로 머지될 뿐 목록에서 사라지지 않아,
               캘린더·목록에는 보관된 항목이 그대로 남아 있었다. (TodoDetailPanel의 보관과 같은 모양) */
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id, archived: true } }));
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
            toast.success("아카이브로 보관됐어요.");
            await refresh();
        } catch (e) {
            toast.error(getApiError(e, "보관에 실패했어요."));
            await refresh();
        }
    }, [refresh]);

    // 칸반은 status별 컬럼이 이미 있어 "완료" 탭 의미 없음 → 자동 전환
    useEffect(() => {
        if (mobileViewType === "kanban" && mobileTab === "done") {
            setMobileTab("all");
        }
    }, [mobileViewType, mobileTab]);

    const handleDragTodoStart = useCallback(() => {}, []);
    const handleDragTodoEnd = useCallback(() => {}, []);

    const handleArchiveClick = useCallback(() => {
        if (isMobile) {
            setMobileView("archive");
        } else {
            nav("/tasklist", { state: { openArchive: true } });
        }
    }, [isMobile, nav]);

    /* 온보딩 활성화 시 아래 코드 주석 해제
    useEffect(() => {
        if (!settingsLoaded) return;
        if (tutorialSeen) return;
        if (autoStartedRef.current) return;

        if (isMobile) {
            const target = document.querySelector('[data-tour="todo-card-demo"]');
            if (!target) return;
        }

        const timer = setTimeout(() => {
            autoStartedRef.current = true;
            start();
        }, 150);

        return () => clearTimeout(timer);
    }, [isMobile, settingsLoaded, tutorialSeen, start, todos, viewFilter]);
    */

    /* 상태 추가·관리 다이얼로그는 모바일/데스크탑 return 블록이 함께 렌더한다.
       예전엔 데스크탑 블록에만 있어서 모바일 칸반의 "+ 상태 추가"가 state만 바꾸고 아무것도 안 떴다(완전 무반응). */
    const statusDialogs = (
        <>
            <AddStatusDialog open={addStatusOpen} onClose={() => setAddStatusOpen(false)} />
            <ManageStatusesDialog open={manageStatusOpen} onClose={() => setManageStatusOpen(false)} />
        </>
    );

    // 모바일 아카이브 전용 화면
    if (isMobile && mobileView === "archive") {
        return (
            <MobileArchiveView
                /* 아카이브는 완료 history — 보드의 일시 필터(전체/날짜/반복)와 분리, 프로젝트 스코프만 반영 */
                doneTodos={scopedTodos.filter((t) => isTodoDone(t))}
                onBack={() => setMobileView("board")}
                onOpenDetail={openRightDetail}
                onRestored={refresh}
            />
        );
    }

    // ── 모바일 전용 렌더링 ──
    if (isMobile) {
        // 칸반은 status별 컬럼이 이미 있으므로 "완료" 탭 제외 → 4개 탭 (스크롤 불필요)
        const allMobileTabs = [
            { id: "today",     label: "오늘",     count: mobileTabCounts.today },
            { id: "week",      label: "이번 주",   count: mobileTabCounts.week },
            { id: "all",       label: "전체",     count: mobileTabCounts.all },
            { id: "done",      label: "완료",     count: mobileTabCounts.done },
            { id: "recurring", label: "반복",     count: mobileTabCounts.recurring },
        ];
        const mobileTabs = mobileViewType === "kanban"
            ? allMobileTabs.filter((t) => t.id !== "done")
            : allMobileTabs;

        return (
            <Box
                sx={{
                    minHeight: 0,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    background: getMobilePageBg(theme),
                    position: "relative",
                    overflow: "hidden",
                }}
                data-tour="todo-board"
            >
                {/* 403 — 세션은 유지하고 안내만 (워크스페이스 전환으로 복구) */}
                <AccessErrorBanner message={accessError} />

                {/* 스코프 필터 — 데스크탑 사이드바와 동일한 글로벌 스코프 */}
                <MobileProjectFilter pendingCount={mobileTabCounts.all} />

                {/* underline 5탭 + view 토글 — 아카이브는 첫 GroupHeader 우측으로 이동 (5탭 다 보이도록) */}
                <Stack
                    direction="row"
                    alignItems="flex-end"
                    justifyContent="space-between"
                    sx={{
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        pt: 0.5,
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TextTabs tabs={mobileTabs} value={mobileTab} onChange={setMobileTab} />
                    </Box>
                    <Box sx={{ pr: 1.5, pb: 0.75, flexShrink: 0 }}>
                        <TodoViewToggle value={mobileViewType} onChange={setMobileViewType} />
                    </Box>
                </Stack>

                {/* 본문 */}
                <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
                    {mobileViewType === "list" ? (
                        <MobileListView
                            todos={mobileFilteredTodos}
                            tab={mobileTab}
                            onOpenDetail={openRightDetail}
                            onToggleStatus={handleMobileToggleStatus}
                            onArchive={handleArchiveClick}
                            onArchiveTodo={handleMobileArchive}
                            myOnly={viewFilter === TODO_FILTERS.ASSIGNED_TO_ME}
                            onToggleMyOnly={() => setViewFilter((v) =>
                                v === TODO_FILTERS.ASSIGNED_TO_ME ? TODO_FILTERS.ALL : TODO_FILTERS.ASSIGNED_TO_ME
                            )}
                        />
                    ) : (
                        <MobileKanban
                            grouped={mobileGrouped}
                            isDark={isDark}
                            onMoveStatus={onDropByTouch}
                            onOpenDetail={openRightDetail}
                            onDelete={requestDelete}
                            onOpenAddWithStatus={openAddModalWithStatus}
                            onBulkArchiveDone={handleArchiveClick}
                            onAddStatus={() => setAddStatusOpen(true)}
                            onManageStatuses={() => setManageStatusOpen(true)}
                        />
                    )}
                </Box>

                {/* FAB — list 뷰일 때만 (B안). 상태는 워크스페이스 기본값 (TODO가 없는 워크스페이스도 있다) */}
                {mobileViewType === "list" && canCreate && (
                    <MobileFab onClick={() => openAddModalWithStatus(defaultTodoStatusKey(statusDefs))} ariaLabel="할 일 추가" />
                )}

                {statusDialogs}

                <AddTodoModal
                    open={open}
                    onClose={() => setOpen(false)}
                    task={task}
                    setTask={setTask}
                    onSave={handleAdd}
                />

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
                    onClose={() => {
                        setDeleteOpen(false);
                        setDeleteTarget(null);
                    }}
                    onConfirm={handleConfirmDelete}
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
            </Box>
        );
    }

    // ── 데스크톱 렌더링 (Phase 14) ──
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                flex: 1,
                bgcolor: "background.default",
            }}
        >
            {/* 403 — 세션은 유지하고 안내만 (워크스페이스 전환으로 복구) */}
            <AccessErrorBanner message={accessError} />

            <BoardHeader
                scopeLabel={scopeLabel}
                scopeColor={scopeColor}
                scopeIcon={activeProject?.icon ?? null}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                recurringOnly={recurringOnly}
                onToggleRecurring={() => setRecurringOnly((v) => !v)}
                viewFilter={viewFilter}
                onViewFilterChange={setViewFilter}
                counts={headerCounts}
                onAddTask={canCreate ? () => openAddModalWithStatus(defaultTodoStatusKey(statusDefs)) : undefined}
            />

            {/* 칸반(보드) 뷰 */}
            <Stack
                ref={boardScrollRef}
                direction="row"
                spacing={1.75}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    px: { md: 3, lg: 4 },
                    py: 2.5,
                    overflowX: "auto",
                }}
            >
                {statusDefs.map((s) => (
                    <BoardColumn
                        key={s.statusKey}
                        // 상태가 3개 이하면 남는 공간을 채운다(빈 여백 방지). 그보다 많으면 고정폭 + 가로 스크롤
                        grow={statusDefs.length <= 3}
                        status={s.statusKey}
                        statusLabel={s.label}
                        statusColor={s.color}
                        tasks={grouped[s.statusKey] ?? []}
                        isDragOver={dragOverStatus === s.statusKey}
                        onDragOver={setDragOverStatus}
                        onDragLeave={() => setDragOverStatus(null)}
                        onDrop={(e, st) => { setDragOverStatus(null); setDraggingId(null); onDrop(e, st); }}
                        onDragStartTask={(t) => { setDraggingId(t.id); handleDragTodoStart(t); }}
                        onDragEndTask={() => { setDraggingId(null); handleDragTodoEnd(); }}
                        draggingId={draggingId}
                        onCardClick={openRightDetail}
                        onCardDelete={requestDelete}
                        onAddTask={canCreate ? openAddModalWithStatus : undefined}
                        onArchive={s.category === "DONE" ? handleArchiveClick : undefined}
                    />
                ))}
                {/* 상태 추가·관리 (ADMIN 이상) */}
                {perms.canManageWorkspace && (
                    <Stack spacing={1} sx={{ flexShrink: 0, minWidth: 150, alignSelf: "flex-start", mt: 0.5 }}>
                        <Box onClick={() => setAddStatusOpen(true)}
                            sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, py: 1.25, borderRadius: "var(--plando-radius-lg)",
                                border: "1.5px dashed", borderColor: "divider", color: "text.disabled", fontSize: 13, fontWeight: 700, cursor: "pointer",
                                "&:hover": { borderColor: "primary.main", color: "primary.main", bgcolor: "var(--plando-primary-soft)" } }}>
                            + 상태 추가
                        </Box>
                        <Box onClick={() => setManageStatusOpen(true)}
                            sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, py: 0.75, borderRadius: "var(--plando-radius-md)",
                                color: "text.disabled", fontSize: 12, fontWeight: 700, cursor: "pointer", "&:hover": { color: "text.primary" } }}>
                            ⚙ 상태 관리
                        </Box>
                    </Stack>
                )}
            </Stack>

            <AddTodoModal
                open={open}
                onClose={() => setOpen(false)}
                task={task}
                setTask={setTask}
                onSave={handleAdd}
            />

            {statusDialogs}

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
                onClose={() => {
                    setDeleteOpen(false);
                    setDeleteTarget(null);
                }}
                onConfirm={handleConfirmDelete}
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

        </Box>
    );
}