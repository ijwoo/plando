import React, { useCallback, useMemo, useState } from "react";
import { Box, Menu, MenuItem, Skeleton, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import Press from "../../../shared/ui/primitives/Press.jsx";
import CircleCheckbox from "../../../shared/ui/common/CircleCheckbox.jsx";
import { PriorityPill } from "../../../shared/ui/common/Chips.jsx";
import { getMobilePageBg } from "../../../shared/ui/glassSx.js";
import { formatAbsoluteDue } from "../../../shared/utils/formatters.js";
import { getProjectById, resolveProject, deleteProjectById, projectsLoaded, useProjects } from "../store/projectStore.js";
import { getProjectIcon } from "../projectIcons.js";
import { useActiveProject } from "../context/ActiveProjectContext.jsx";
import ProjectCreateDialog from "../components/ProjectCreateDialog.jsx";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import { updateTodoField } from "../../todo/api/todoApi.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../workspace/hooks/useWorkspacePermissions.js";
import { isTodoDone, doneTodoStatusKey, defaultTodoStatusKey } from "../../../shared/utils/todoStatus.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import useTodoBoardData from "../../todo/hooks/useTodoBoardData.jsx";
import { getTaskPath } from "../../todo/utils/taskView.js";
import { selectNextTasks } from "../utils/nextTasks.js";
import { isOverdueDate } from "../../todo/utils/todoFilters.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

/**
 * 모바일 프로젝트 홈 (/projects/:id) — 개요 화면.
 * 리스트/칸반 토글 없음(그건 보드 문법) — 요약 + 다음 할 일 + "보드에서 모두 보기" 동선.
 * 진입: 스코프 시트 프로젝트 행의 > 버튼.
 */
export default function ProjectDetailPage() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();
    const { id } = useParams();

    useProjects(); // PROJECTS_CHANGED 구독 — 수정/삭제 즉시 반영
    const project = getProjectById(Number(id));
    const { setActiveProject } = useActiveProject();

    const { todos, loaded, refresh, openRightDetail } = useTodoBoardData({ nav: navigate });
    const { statuses: statusDefs, categoryOf: statusCategoryOf } = useStatuses();
    const { canDeleteProject, canEditContent } = useWorkspacePermissions();

    // 관리 메뉴 (수정/삭제)
    const [menuEl, setMenuEl] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

    const handleDeleteProject = useCallback(async () => {
        try {
            await deleteProjectById(Number(id));
            setDeleteProjectOpen(false);
            toast.success("프로젝트가 삭제됐어요 · 할 일은 인박스로 이동");
            navigate("/todos", { replace: true });
        } catch (e) {
            toast.error(getApiError(e, "프로젝트 삭제에 실패했어요."));
        }
    }, [id, navigate]);

    // 체크 완료 토글 — 보드와 동일 (낙관적 이벤트 + API).
    // 완료 판정은 isTodoDone(doneAt 우선), 기록할 key는 워크스페이스 상태집합에서 조회한다.
    // 리터럴 'DONE'/'TODO'를 쓰던 시절엔 커스텀 완료 상태("배포완료" 등) 항목의 체크가 해제되지 않고
    // 그 상태 key가 기본값으로 덮어써져 복구할 수 없었다. doneAt도 함께 패치해야 수신 화면의 체크가 즉시 풀린다.
    const handleToggleStatus = useCallback(async (todo) => {
        const wasDone = isTodoDone(todo);
        const next = wasDone ? defaultTodoStatusKey(statusDefs) : doneTodoStatusKey(statusDefs);
        window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todo.id, patch: { status: next, doneAt: wasDone ? null : new Date().toISOString() } } }));
        try {
            await updateTodoField(todo.id, "status", next);
        } catch (e) {
            toast.error(getApiError(e, "상태 변경에 실패했어요."));
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todo.id, patch: { status: todo.status, doneAt: todo.doneAt ?? null } } }));
            await refresh();
        }
    }, [refresh, statusDefs]);

    // 이 프로젝트에 속하는 todo만 — resolveProject 단일 진입점
    const projectTodos = useMemo(() => {
        if (!project) return [];
        return todos.filter((t) => resolveProject(t)?.id === project.id);
    }, [todos, project]);

    // 집계는 전부 isTodoDone / categoryOf 기준. status 문자열 비교였을 때 커스텀 완료 상태 항목이
    // 완료로 잡히지 않아 진행률이 실제보다 낮았고, 마감이 지났으면 "지연" 칩에까지 다시 잡혔다.
    const doneCount = projectTodos.filter((t) => isTodoDone(t)).length;
    const inProgressCount = projectTodos.filter((t) => !isTodoDone(t) && statusCategoryOf(t.status) === "IN_PROGRESS").length;
    // "지연"은 로컬 자정끼리 비교한다(isOverdueDate). 예전 식은 new Date("2026-07-22")를
    // UTC 자정으로 파싱해 로컬 자정과 비교했기 때문에, UTC 오프셋이 음수인 기기에서
    // "오늘 마감"인 할 일이 하루 앞서 지연 칩에 잡혔다.
    const overdueCount = projectTodos.filter((t) => !isTodoDone(t) && isOverdueDate(t.dueDate)).length;
    const totalCount = projectTodos.length;
    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    // 다음 할 일 — 미완료를 마감 임박 → 우선순위 순으로 상위 5개 (데스크탑 개요와 공용 셀렉터)
    const nextTodos = useMemo(() => selectNextTasks(projectTodos, 5), [projectTodos]);

    // 최근 완료 — 완료 시각(doneAt) 최신순 상위 3개.
    // 정렬 없이 slice만 하면 목록 순서(=생성 최신순)의 앞 3개가 나와서, 어제 끝낸 일이
    // "최근 완료"에 안 뜨고 한참 전에 끝낸 일이 뜨는 일이 있었다.
    // doneAt이 없는 예전 데이터는 뒤로 보낸다(생성 순서로만 알 수 있어 "최근"이라 부를 수 없다).
    const recentDone = useMemo(
        () => projectTodos
            .filter((t) => isTodoDone(t))
            .sort((a, b) => {
                if (!a.doneAt && !b.doneAt) return 0;
                if (!a.doneAt) return 1;
                if (!b.doneAt) return -1;
                return a.doneAt < b.doneAt ? 1 : a.doneAt > b.doneAt ? -1 : 0;
            })
            .slice(0, 3),
        [projectTodos]
    );

    const pendingCount = totalCount - doneCount;

    // 보드에서 모두 보기 — 이 프로젝트로 스코프 걸고 할 일 surface로
    const goBoard = useCallback(() => {
        setActiveProject(project.id);
        navigate(getTaskPath());
    }, [project, setActiveProject, navigate]);

    const openAdd = useCallback(() => {
        window.dispatchEvent(new CustomEvent(APP_EVENTS.OPEN_ADD_TODO, { detail: { projectId: project.id } }));
    }, [project]);

    if (!project) {
        if (!projectsLoaded()) return null; // 목록 로딩 중 — "찾을 수 없어요" 깜빡임 방지
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography>프로젝트를 찾을 수 없어요.</Typography>
                <Press as="span" onClick={() => navigate("/todos")} style={{ marginTop: 16, display: "inline-block", color: theme.palette.primary.main, cursor: "pointer" }}>
                    할일 보드로
                </Press>
            </Box>
        );
    }

    const ProjIcon = getProjectIcon(project.icon);
    // 서버 규칙: 수정 = MEMBER 이상(requireCanEditProject), 삭제 = 작성자 본인 || ADMIN 이상.
    // 규칙이 서로 달라 각각 따로 비활성 + 이유를 붙인다 — 수정 창을 다 채운 뒤 403을 맞는 흐름을 없앤다.
    const canDelete = canDeleteProject(project);
    const canEdit = canEditContent;

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
        >
            {/* 상단 바 — 뒤로/더보기만 (제목은 본문 헤더로) */}
            <Stack
                direction="row"
                alignItems="center"
                sx={{ px: 1, pt: "calc(env(safe-area-inset-top, 0px) + 4px)", pb: 0.5, flexShrink: 0 }}
            >
                <Press
                    as="span"
                    onClick={() => navigate(-1)}
                    haptic="light"
                    pressScale={0.9}
                    style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 40, height: 40, borderRadius: 999, cursor: "pointer",
                    }}
                >
                    <ArrowBackRoundedIcon sx={{ fontSize: 22, color: theme.palette.text.secondary }} />
                </Press>
                <Box sx={{ flex: 1 }} />
                <Press
                    as="span"
                    onClick={(e) => setMenuEl(e.currentTarget)}
                    haptic="light"
                    pressScale={0.9}
                    style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 40, height: 40, borderRadius: 999, cursor: "pointer",
                    }}
                >
                    <MoreHorizRoundedIcon sx={{ fontSize: 22, color: theme.palette.text.secondary }} />
                </Press>
                <Menu
                    anchorEl={menuEl}
                    open={Boolean(menuEl)}
                    onClose={() => setMenuEl(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    slotProps={{ paper: { sx: { minWidth: 160, mt: 0.5, borderRadius: 2 } } }}
                >
                    <MenuItem disabled={!canEdit} onClick={() => { setMenuEl(null); setEditOpen(true); }}>
                        <EditOutlinedIcon sx={{ fontSize: 18, mr: 1 }} /> 프로젝트 수정
                    </MenuItem>
                    {!canEdit && (
                        /* 비활성 MenuItem은 툴팁이 안 뜨므로(pointer-events 없음) 이유를 아래에 직접 적는다 */
                        <Typography sx={{ px: 2, pb: 0.75, pt: 0.25, fontSize: 11.5, fontWeight: 600, color: "text.disabled", maxWidth: 200, lineHeight: 1.45 }}>
                            읽기 전용 역할은 프로젝트를 수정할 수 없어요
                        </Typography>
                    )}
                    <MenuItem disabled={!canDelete} onClick={() => { setMenuEl(null); setDeleteProjectOpen(true); }} sx={{ color: "error.main" }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 18, mr: 1 }} /> 프로젝트 삭제
                    </MenuItem>
                    {!canDelete && (
                        /* 비활성 MenuItem은 툴팁이 안 뜨므로(pointer-events 없음) 이유를 아래에 직접 적는다 */
                        <Typography sx={{ px: 2, pb: 1, pt: 0.25, fontSize: 11.5, fontWeight: 600, color: "text.disabled", maxWidth: 200, lineHeight: 1.45 }}>
                            만든 사람이나 관리자만 삭제할 수 있어요
                        </Typography>
                    )}
                </Menu>
            </Stack>

            {/* 프로젝트 헤더 — 아이콘 타일 + 제목 + 통계 칩 + 진행률 (컴팩트) */}
            <Box sx={{ px: 2.5, pt: 0.5, pb: 1.75, flexShrink: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                    <Box
                        sx={{
                            width: 40, height: 40, borderRadius: "12px", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            bgcolor: alpha(project.color, isDark ? 0.22 : 0.14),
                            color: project.color,
                        }}
                    >
                        <ProjIcon sx={{ fontSize: 22 }} />
                    </Box>
                    <Typography
                        sx={{
                            flex: 1, minWidth: 0,
                            fontSize: 21, fontWeight: 800, letterSpacing: "-0.025em",
                            color: theme.palette.text.primary, lineHeight: 1.2,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                    >
                        {project.name}
                    </Typography>
                    <Typography sx={{ fontSize: 22, fontWeight: 800, color: project.color, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                        {progress}%
                    </Typography>
                </Stack>

                {/* 진행률 바 */}
                <Box
                    sx={{
                        height: 6, borderRadius: 999, mb: 1.25,
                        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            height: "100%", width: `${progress}%`, background: project.color, borderRadius: 999,
                            transition: "width 0.4s cubic-bezier(0.16,1,0.3,1)",
                        }}
                    />
                </Box>

                {/* 통계 칩 */}
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                    <StatChip label="전체" value={totalCount} color={theme.palette.text.secondary} isDark={isDark} />
                    <StatChip label="진행 중" value={inProgressCount} color={theme.palette.warning.main} isDark={isDark} />
                    <StatChip label="완료" value={doneCount} color={theme.palette.success.main} isDark={isDark} />
                    {overdueCount > 0 && <StatChip label="지연" value={overdueCount} color={theme.palette.error.main} isDark={isDark} />}
                </Stack>
            </Box>

            {/* 본문 — 개요 */}
            <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0, pb: "calc(env(safe-area-inset-bottom) + 96px)" }}>

                {/* 다음 할 일 */}
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ px: 2.5, pt: 3, pb: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "text.secondary" }}>
                        다음 할 일
                    </Typography>
                    {pendingCount > 0 && (
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.disabled" }}>{pendingCount}</Typography>
                    )}
                </Stack>

                {!loaded ? (
                    /* 첫 조회 전에는 안내를 띄우지 않는다 — todos가 []로 시작해서
                       "아직 할 일이 없어요"가 매번 한 프레임 번쩍였다. */
                    <Skeleton variant="rounded" height={44} sx={{ mx: 2.5, my: 2 }} />
                ) : nextTodos.length === 0 ? (
                    <Typography sx={{ px: 2.5, py: 2.5, fontSize: 13, color: "text.disabled", textAlign: "center" }}>
                        {totalCount === 0 ? "아직 할 일이 없어요" : "남은 할 일을 모두 끝냈어요"}
                    </Typography>
                ) : (
                    nextTodos.map((t, i) => (
                        <Press
                            key={t.id}
                            onClick={() => openRightDetail(t.id)}
                            haptic="light"
                            pressScale={0.99}
                            activeBg="var(--plando-surface-faint)"
                            style={{
                                display: "flex", alignItems: "center", gap: 14, width: "100%",
                                padding: "13px 20px",
                                borderBottom: i === nextTodos.length - 1 ? "none" : `1px solid ${theme.palette.divider}`,
                            }}
                        >
                            <CircleCheckbox
                                checked={false}
                                onToggle={() => handleToggleStatus(t)}
                                size={26}
                                accent={theme.palette.success.main}
                            />
                            <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                                <Typography sx={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.title}
                                </Typography>
                                {t.dueDate && (
                                    <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.25 }}>
                                        {formatAbsoluteDue(t.dueDate)}
                                    </Typography>
                                )}
                            </Box>
                            {t.priority && <PriorityPill priority={t.priority} sx={{ flexShrink: 0 }} />}
                        </Press>
                    ))
                )}

                {/* 할 일 추가 — 생성은 MEMBER 이상(requireCanCreateContent). 권한이 없으면 줄 자체를 내린다 */}
                {canEditContent && (
                    <Press
                        onClick={openAdd}
                        haptic="light"
                        pressScale={0.99}
                        activeBg="var(--plando-surface-faint)"
                        style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "13px 20px" }}
                    >
                        <Box sx={{ width: 26, display: "flex", justifyContent: "center", color: "text.disabled" }}>
                            <AddRoundedIcon sx={{ fontSize: 20 }} />
                        </Box>
                        <Typography sx={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "text.secondary", textAlign: "left" }}>
                            할 일 추가
                        </Typography>
                    </Press>
                )}

                {/* 보드에서 모두 보기 */}
                <Box sx={{ px: 2.5, pt: 1.5 }}>
                    <Press
                        onClick={goBoard}
                        haptic="light"
                        pressScale={0.98}
                        style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            width: "100%", padding: "13px 0", borderRadius: 14,
                            background: "var(--plando-surface-low)",
                        }}
                    >
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>
                            보드에서 모두 보기
                        </Typography>
                        <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                    </Press>
                </Box>

                {/* 최근 완료 */}
                {recentDone.length > 0 && (
                    <>
                        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ px: 2.5, pt: 3, pb: 0.5 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "text.secondary" }}>
                                최근 완료
                            </Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.disabled" }}>{doneCount}</Typography>
                        </Stack>
                        {recentDone.map((t, i) => (
                            <Press
                                key={t.id}
                                onClick={() => openRightDetail(t.id)}
                                haptic="light"
                                pressScale={0.99}
                                activeBg="var(--plando-surface-faint)"
                                style={{
                                    display: "flex", alignItems: "center", gap: 14, width: "100%",
                                    padding: "12px 20px",
                                    borderBottom: i === recentDone.length - 1 ? "none" : `1px solid ${theme.palette.divider}`,
                                }}
                            >
                                <CircleCheckbox
                                    checked
                                    onToggle={() => handleToggleStatus(t)}
                                    size={26}
                                    accent={theme.palette.success.main}
                                />
                                <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 500, color: "text.disabled", textDecoration: "line-through", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {t.title}
                                </Typography>
                            </Press>
                        ))}
                    </>
                )}
            </Box>

            {/* 프로젝트 수정 */}
            <ProjectCreateDialog
                open={editOpen}
                onClose={() => setEditOpen(false)}
                project={project}
            />

            {/* 프로젝트 삭제 확인 */}
            <ConfirmDialog
                open={deleteProjectOpen}
                title="프로젝트 삭제"
                message={`"${project.name}" 프로젝트를 삭제할까요?\n소속 할 일 ${totalCount}개는 인박스로 이동해요.`}
                confirmText="삭제"
                onClose={() => setDeleteProjectOpen(false)}
                onConfirm={handleDeleteProject}
            />
        </Box>
    );
}

/** 통계 칩 — "전체 3" 식 (헤더용) */
function StatChip({ label, value, color, isDark }) {
    return (
        <Box
            sx={{
                display: "inline-flex", alignItems: "center", gap: 0.5,
                px: 1, py: 0.375, borderRadius: 999,
                bgcolor: alpha(color, isDark ? 0.16 : 0.10),
            }}
        >
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "text.secondary", lineHeight: 1 }}>{label}</Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        </Box>
    );
}
