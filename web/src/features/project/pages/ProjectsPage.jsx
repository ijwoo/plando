import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Box, ListItemIcon, Menu, MenuItem, Stack, Typography, useMediaQuery, Skeleton} from "@mui/material";
import HeaderActionButton from "../../../shared/ui/common/HeaderActionButton.jsx";
import { useTheme } from "@mui/material/styles";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";

import { getProjectById, resolveProject, deleteProjectById, getProjectActivity, projectsLoaded, useProjects } from "../store/projectStore.js";
import { selectNextTasks } from "../utils/nextTasks.js";
import ScopeTitle from "../components/ScopeTitle.jsx";
import ProjectCreateDialog from "../components/ProjectCreateDialog.jsx";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import { useActiveProject } from "../context/ActiveProjectContext.jsx";
import useTodoBoardData from "../../todo/hooks/useTodoBoardData.jsx";
import ProjectDetailPage from "./ProjectDetailPage.jsx";
import TaskViewTabs from "../../todo/components/board/TaskViewTabs.jsx";
import AddTodoModal from "../../todo/components/form/AddTodoModal.jsx";
import CircleCheckbox from "../../../shared/ui/common/CircleCheckbox.jsx";
import AssigneeStack from "../../../shared/ui/common/AssigneeStack.jsx";
import { PriorityPill } from "../../../shared/ui/common/Chips.jsx";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { formatTimeAgo, formatAbsoluteDue } from "../../../shared/utils/formatters.js";
import { isOverdueDate, daysUntilDue } from "../../todo/utils/todoFilters.js";
import { resolveAssigneeList } from "../../../shared/utils/assigneeUtils.js";
import { getLogActor, getLogActivityText, collapseLogs } from "../../todo/utils/todoLogFormatters.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../workspace/hooks/useWorkspacePermissions.js";
import { isTodoDone, doneTodoStatusKey, defaultTodoStatusKey } from "../../../shared/utils/todoStatus.js";
import { updateTodoField } from "../../todo/api/todoApi.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";

export default function ProjectsPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const navigate = useNavigate();
    const { id } = useParams();
    const { setActiveProject } = useActiveProject();
    const { statuses: statusDefs, label: resolveStatusLabel, categoryOf: statusCategoryOf } = useStatuses();
    const { canDeleteProject, canEditContent } = useWorkspacePermissions();

    useProjects(); // PROJECTS_CHANGED 구독 — 목록 로딩/수정/삭제가 개요에 즉시 반영 (모바일과 동일)
    const isInbox = id === "inbox";
    const project = (!isInbox && id) ? getProjectById(Number(id)) : null;

    const {
        todos, loaded, openRightDetail,
        open, setOpen, openAddModalWithStatus, task, setTask, handleAdd, refresh,
    } = useTodoBoardData({ nav: navigate });

    const [activity, setActivity] = useState([]);
    const [settingsAnchor, setSettingsAnchor] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    useEffect(() => {
        if (isMobile) return;
        if (isInbox) setActiveProject("inbox");
        else if (project) setActiveProject(project.id);
    }, [id, isInbox, project, isMobile, setActiveProject]);

    const projectTodos = useMemo(() => {
        if (!project) return [];
        return todos.filter((t) => resolveProject(t)?.id === project.id);
    }, [todos, project]);

    // 개요 활동 피드 — 소속 할 일들의 최근 변경 로그 (todos 변경 시 갱신)
    useEffect(() => {
        if (isMobile || !project) return;
        let alive = true;
        getProjectActivity(project.id)
            .then((list) => { if (alive) setActivity(Array.isArray(list) ? list : []); })
            .catch(() => { if (alive) setActivity([]); });
        return () => { alive = false; };
    }, [project, isMobile, todos]);

    // 활동 피드 정리 — 무변경/연속중복 접기 + 과도한 길이 캡
    const activityFeed = useMemo(() => collapseLogs(activity).slice(0, 20), [activity]);

    // 다음 할 일 — 미완료를 마감 임박 → 우선순위 순으로 상위 5개 (모바일 개요와 공용 셀렉터)
    const nextTasks = useMemo(() => selectNextTasks(projectTodos, 5), [projectTodos]);

    // 완료 판정은 isTodoDone(doneAt 우선), 기록할 key는 워크스페이스 상태집합에서 조회한다.
    // 리터럴 'DONE'/'TODO' 비교·기록이던 시절엔 커스텀 완료 상태("배포완료" 등) 항목이 체크 해제되지 않고
    // (비교가 false → 다시 완료로 PATCH) 원래 상태 key까지 덮어써져 복구할 수 없었다.
    const handleToggleStatus = useCallback(async (t) => {
        const wasDone = isTodoDone(t);
        const next = wasDone ? defaultTodoStatusKey(statusDefs) : doneTodoStatusKey(statusDefs);
        // doneAt도 함께 패치 — 소비처가 doneAt 우선으로 완료를 판정하므로 status만 보내면 체크가 안 바뀐다
        window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: t.id, patch: { status: next, doneAt: wasDone ? null : new Date().toISOString() } } }));
        try {
            await updateTodoField(t.id, "status", next);
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
        } catch (e) {
            toast.error(getApiError(e, "상태 변경에 실패했어요."));
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: t.id, patch: { status: t.status, doneAt: t.doneAt ?? null } } }));
            await refresh();
        }
    }, [refresh, statusDefs]);

    // 모바일: 기존 구조
    if (isMobile) {
        if (id && !isInbox) return <ProjectDetailPage />;
        return <Navigate to="/todos" replace />;
    }
    // 인박스/무-id는 개요 대상이 아니라 보드로 보내고, "없는 프로젝트"만 안내 화면 (모바일과 동일)
    if (!project) {
        if (isInbox || !id) return <Navigate to="/todos" replace />;
        if (!projectsLoaded()) return null; // 목록 로딩 중 — "찾을 수 없어요" 깜빡임 방지
        return (
            <Box sx={{ minHeight: "100%", bgcolor: "background.default", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, py: 12 }}>
                <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: "text.primary" }}>프로젝트를 찾을 수 없어요</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", mb: 0.5 }}>삭제됐거나 접근할 수 없는 프로젝트예요.</Typography>
                <LinkBtn onClick={() => navigate("/todos")}>할일 보드로 <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} /></LinkBtn>
            </Box>
        );
    }

    // 집계는 전부 isTodoDone / categoryOf 기준. status 문자열 비교였을 때 커스텀 완료 상태 항목이
    // done에도 in-progress에도 안 잡혀 "할 일"로 세어지고, 마감이 지났으면 "지연"으로 한 번 더 세어졌다
    // (같은 항목이 두 칸에 동시 계상 + 진행률은 실제보다 낮게).
    // 서버 규칙: 수정 = MEMBER 이상(requireCanEditProject), 삭제 = 작성자 본인 || ADMIN 이상.
    // 두 항목의 규칙이 다르므로 각각 따로 비활성 + 이유를 붙인다.
    // (예전 주석은 "수정은 열어둔다"고 적혀 있었지만 실제로 수정도 MEMBER 이상이라,
    //  VIEWER가 수정 창을 다 채우고 저장에서 403을 맞았다.)
    const canDelete = canDeleteProject(project);
    const canEdit = canEditContent;

    const doneCount = projectTodos.filter((t) => isTodoDone(t)).length;
    const inProgress = projectTodos.filter((t) => !isTodoDone(t) && statusCategoryOf(t.status) === "IN_PROGRESS").length;
    const totalCount = projectTodos.length;
    const todoCount = totalCount - doneCount - inProgress;
    // "지연"은 로컬 자정끼리 비교한다(isOverdueDate). 예전 식은 new Date("2026-07-22")를
    // UTC 자정으로 파싱해 로컬 자정과 비교했기 때문에, UTC 오프셋이 음수인 기기에서
    // "오늘 마감"인 할 일이 하루 앞서 지연으로 세어졌다.
    const overdue = projectTodos.filter((t) => !isTodoDone(t) && isOverdueDate(t.dueDate)).length;
    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const ringColor = progress === 100 ? theme.palette.success.main : progress === 0 ? theme.palette.text.disabled : project.color;
    const statusLabel = progress === 0 ? "시작 전" : progress === 100 ? "완료" : "진행 중";

    return (
        <Box sx={{ minHeight: "100%", bgcolor: "background.default" }}>
            {/* ── 헤더 바 ── */}
            <Box sx={{ px: { md: 3, lg: 4 }, pt: 3, pb: 1.75, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
                {/* 보드/목록 헤더와 동일 구조 — 좌측: 워크스페이스/동기화 위 + 제목+탭, 우측: 버튼 하단 정렬 */}
                <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2}>
                    <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                            <ScopeTitle color={project.color} iconKey={project.icon} label={project.name} />
                            <Box sx={{ flexShrink: 0 }}><TaskViewTabs current="overview" /></Box>
                        </Stack>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                        <HeaderActionButton variant="secondary" icon={<SettingsRoundedIcon sx={{ fontSize: 16 }} />} onClick={(e) => setSettingsAnchor(e.currentTarget)}>설정</HeaderActionButton>
                        {/* 할 일 생성 = MEMBER 이상(requireCanCreateContent) — 보드·목록과 같은 게이팅 */}
                        {canEditContent && (
                            <HeaderActionButton icon={<AddRoundedIcon sx={{ fontSize: 17 }} />} onClick={() => openAddModalWithStatus("TODO")}>새 할 일</HeaderActionButton>
                        )}
                    </Stack>
                </Stack>
            </Box>

            {/* ── 본문: 개요 ── */}
            <Box sx={{ px: { md: 3, lg: 4 }, py: 3 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    {/* 히어로: 진행 */}
                    <Card>
                        <Stack direction="row" spacing={3} alignItems="center">
                            <Box sx={{ position: "relative", width: 116, height: 116, flexShrink: 0 }}>
                                <Box sx={{ width: "100%", height: "100%", borderRadius: "50%", background: `conic-gradient(${ringColor} ${progress * 3.6}deg, var(--plando-surface-low) 0deg)` }} />
                                <Box sx={{ position: "absolute", inset: 11, borderRadius: "50%", bgcolor: "background.paper", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em", color: ringColor, fontVariantNumeric: "tabular-nums" }}>{progress}%</Typography>
                                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.disabled", mt: 0.4 }}>{statusLabel}</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: { xs: 1.5, sm: 2 } }}>
                                <StatusRow dot="#3B82F6" label="할 일" value={todoCount} />
                                <StatusRow dot={theme.palette.warning.main} label="진행 중" value={inProgress} />
                                <StatusRow dot={theme.palette.success.main} label="완료" value={doneCount} />
                                <StatusRow dot={theme.palette.error.main} label="지연" value={overdue} />
                            </Box>
                        </Stack>
                    </Card>

                    {/* 다음 할 일 */}
                    <Card>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <BoltRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                                <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: "text.primary" }}>다음 할 일</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "text.disabled" }}>{nextTasks.length}</Typography>
                            </Stack>
                            <LinkBtn onClick={() => navigate("/todos")}>보드에서 보기 <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} /></LinkBtn>
                        </Stack>

                        {!loaded ? (
                            /* 첫 조회 전에는 안내를 띄우지 않는다 — todos가 []로 시작해서
                               "아직 할 일이 없어요"가 매번 한 프레임 번쩍였다. */
                            <Skeleton variant="rounded" height={44} sx={{ my: 1 }} />
                        ) : nextTasks.length === 0 ? (
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.disabled", py: 1.5 }}>
                                {totalCount === 0 ? "아직 할 일이 없어요" : "남은 할 일을 모두 끝냈어요"}
                            </Typography>
                        ) : nextTasks.map((t) => {
                            const sub = t.content || "";
                            const assignees = resolveAssigneeList(t);
                            const due = dueLabel(t.dueDate, theme);
                            return (
                                <Stack key={t.id} direction="row" alignItems="center" spacing={1.5} onClick={() => openRightDetail(t.id)} sx={{ py: 1.125, px: 1, mx: -1, borderRadius: "10px", cursor: "pointer", "&:hover": { bgcolor: "var(--plando-surface-faint)" } }}>
                                    <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
                                        <CircleCheckbox checked={isTodoDone(t)} onToggle={() => handleToggleStatus(t)} size={22} accent={theme.palette.success.main} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title || "(제목 없음)"}</Typography>
                                        {sub && <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.disabled", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</Typography>}
                                    </Box>
                                    {t.priority && <PriorityPill priority={t.priority} />}
                                    {due && <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: due.color, whiteSpace: "nowrap", flexShrink: 0 }}>{due.text}</Typography>}
                                    {assignees.length > 0 && <AssigneeStack assignees={assignees} size={22} max={2} overlap={-6} />}
                                </Stack>
                            );
                        })}

                        {/* 생성 권한이 없으면 이 줄도 내린다 — 눌러서 모달을 다 채운 뒤 403을 맞는 흐름을 없앤다 */}
                        {canEditContent && (
                            <Stack direction="row" alignItems="center" spacing={1} onClick={() => openAddModalWithStatus("TODO")} sx={{ mt: 1, py: 1.125, borderRadius: "10px", border: "1px dashed", borderColor: "divider", justifyContent: "center", cursor: "pointer", color: "text.secondary", "&:hover": { color: "primary.main", borderColor: "primary.main" } }}>
                                <AddRoundedIcon sx={{ fontSize: 17 }} />
                                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>할 일 추가</Typography>
                            </Stack>
                        )}
                    </Card>

                    {/* 최근 활동 — 소속 할 일들의 최근 변경 로그 (실데이터) */}
                    <Card>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: activityFeed.length ? 1 : 0 }}>
                            <HistoryRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: "text.secondary" }}>최근 활동</Typography>
                        </Stack>
                        {activityFeed.length === 0 ? (
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.disabled", py: 1.5 }}>아직 활동이 없어요.</Typography>
                        ) : (
                            <Stack>
                                {activityFeed.map((a, i) => {
                                    const actor = getLogActor(a);
                                    const src = actor.profileImageUrl ? resolveImageUrl(actor.profileImageUrl) : null;
                                    return (
                                        <Stack key={a.id ?? i} direction="row" spacing={1.5} alignItems="flex-start"
                                            onClick={() => a.todoId && openRightDetail(a.todoId)}
                                            sx={{ py: 1.25, borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider", cursor: a.todoId ? "pointer" : "default", borderRadius: "8px", px: 1, mx: -1, "&:hover": a.todoId ? { bgcolor: "var(--plando-surface-faint)" } : {} }}>
                                            <Avatar src={src} sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 800, mt: 0.25, flexShrink: 0, bgcolor: "var(--plando-surface-mid)", color: "text.secondary" }}>{actor.name.charAt(0)}</Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{ fontSize: 13.5, color: "text.primary", lineHeight: 1.5 }}>
                                                    <Box component="span" sx={{ fontWeight: 800 }}>{actor.name}</Box>님이 {getLogActivityText(a, resolveStatusLabel)}
                                                </Typography>
                                                <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "text.disabled", mt: 0.25 }}>{formatTimeAgo(a.modifiedAt)}</Typography>
                                            </Box>
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        )}
                    </Card>
                </Box>
            </Box>

            <AddTodoModal open={open} onClose={() => setOpen(false)} task={task} setTask={setTask} onSave={handleAdd} />

            {/* 프로젝트 설정 메뉴 */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ sx: { minWidth: 168, mt: 0.5, borderRadius: "12px" } }}
            >
                <MenuItem
                    disabled={!canEdit}
                    onClick={() => { setSettingsAnchor(null); setEditOpen(true); }}
                    sx={{ borderRadius: "8px", mx: 0.5, my: 0.25, fontSize: 13.5, fontWeight: 700 }}
                >
                    <ListItemIcon sx={{ minWidth: 32 }}><EditRoundedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                    수정
                </MenuItem>
                {!canEdit && (
                    /* 비활성 MenuItem은 툴팁이 안 뜨므로(pointer-events 없음) 이유를 아래에 직접 적는다 */
                    <Typography sx={{ px: 1.75, pb: 0.75, pt: 0.25, fontSize: 11.5, fontWeight: 600, color: "text.disabled", maxWidth: 210, lineHeight: 1.45 }}>
                        읽기 전용 역할은 프로젝트를 수정할 수 없어요
                    </Typography>
                )}
                <MenuItem
                    disabled={!canDelete}
                    onClick={() => { setSettingsAnchor(null); setDeleteOpen(true); }}
                    sx={{ borderRadius: "8px", mx: 0.5, my: 0.25, fontSize: 13.5, fontWeight: 700, color: "error.main" }}
                >
                    <ListItemIcon sx={{ minWidth: 32 }}><DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: "error.main" }} /></ListItemIcon>
                    삭제
                </MenuItem>
                {!canDelete && (
                    /* 비활성 MenuItem은 툴팁이 안 뜨므로(pointer-events 없음) 이유를 아래에 직접 적는다 */
                    <Typography sx={{ px: 1.75, pb: 1, pt: 0.25, fontSize: 11.5, fontWeight: 600, color: "text.disabled", maxWidth: 210, lineHeight: 1.45 }}>
                        만든 사람이나 관리자만 삭제할 수 있어요
                    </Typography>
                )}
            </Menu>

            <ProjectCreateDialog open={editOpen} project={project} onClose={() => setEditOpen(false)} />

            <ConfirmDialog
                open={deleteOpen}
                title="프로젝트 삭제"
                message={`"${project.name}" 프로젝트를 삭제할까요?\n삭제하면 되돌릴 수 없어요. (할 일 자체는 삭제되지 않아요)`}
                confirmText="삭제"
                onClose={() => setDeleteOpen(false)}
                onConfirm={async () => {
                    try {
                        await deleteProjectById(project.id);
                    } catch {
                        toast.error("프로젝트 삭제에 실패했어요.");
                        return; // 실패 시 이동·성공토스트 없이 유지
                    }
                    setDeleteOpen(false);
                    setActiveProject(null);
                    navigate("/todos");
                    toast.success("프로젝트가 삭제됐어요 · 할 일은 인박스로 이동");
                }}
            />
        </Box>
    );
}

function dueLabel(dueStr, theme) {
    if (!dueStr) return null;
    // 로컬 자정 기준 일수차 — new Date(dueStr)(UTC 자정)를 로컬 자정과 빼면
    // 음수 오프셋 기기에서 "오늘"이 "1일 지연"으로 표시됐다.
    const d = daysUntilDue(dueStr);
    if (d === null) return null;
    if (d < 0) return { text: `${Math.abs(d)}일 지연`, color: theme.palette.error.main };
    if (d === 0) return { text: "오늘", color: theme.palette.warning.main };
    if (d === 1) return { text: "내일", color: theme.palette.warning.main };
    return { text: formatAbsoluteDue(dueStr), color: theme.palette.text.secondary };
}

function Card({ children }) {
    return (
        <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: "var(--plando-radius-card)", p: 3 }}>
            {children}
        </Box>
    );
}

// 세로 KPI 타일 — 점+라벨(위) / 큰 숫자(아래). 4열 그리드에서 가로 "라벨…값"보다 정렬이 깔끔.
function StatusRow({ dot, label, value }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: dot, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", whiteSpace: "nowrap" }}>{label}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: "text.primary", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        </Box>
    );
}

function LinkBtn({ children, onClick }) {
    return (
        <Box component="button" onClick={onClick} sx={{ display: "inline-flex", alignItems: "center", gap: 0.375, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--plando-font)", fontSize: 12.5, fontWeight: 700, color: "primary.main", "&:hover": { opacity: 0.8 } }}>
            {children}
        </Box>
    );
}

