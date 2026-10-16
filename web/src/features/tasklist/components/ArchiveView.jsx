import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import InventoryRoundedIcon from "@mui/icons-material/InventoryRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { fetchArchivedTodos, restoreTodo, archiveDoneTodos } from "../../todo/api/todoApi.js";
import { deleteTodo } from "../../todo/api/todoApi.js";
import { PriorityTag, StatusTag } from "../../../shared/ui/common/Tags.jsx";
import AssigneeStack from "../../../shared/ui/common/AssigneeStack.jsx";
import { buildGridCols, useTaskListColumns } from "./desktop/taskListColumns.js";
import { formatAbsoluteDue } from "../../../shared/utils/formatters.js";
import { toDateOnly } from "../../todo/utils/todoFilters.js";
import { resolveAssigneeList } from "../../../shared/utils/assigneeUtils.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../workspace/hooks/useWorkspacePermissions.js";
import ConfirmDialog from "../../../shared/ui/common/ConfirmDialog.jsx";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { resolveProject, useProjects } from "../../project/store/projectStore.js";
import { getProjectIcon } from "../../project/projectIcons.js";
import { projectIconColor } from "../../project/utils/projectOptions.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";

function groupByMonth(todos) {
    const groups = {};
    for (const todo of todos) {
        let key = "날짜 미설정";
        // 로컬 자정으로 파싱한다 — new Date("2026-08-01")은 UTC 자정이라 UTC 오프셋이 음수인
        // 기기에서 7월 31일로 읽혀 "8월 1일 마감"이 7월 그룹에 들어갔다.
        const d = toDateOnly(todo.dueDate);
        if (d) {
            key = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(todo);
    }
    return groups;
}

export default function ArchiveView({ onRefreshParent }) {
    const openTodoDetail = useOpenTodoDetail();
    // 목록과 같은 컬럼 설정을 그대로 쓴다 — 보관함만 다른 열 구성이면 눈이 다시 적응해야 한다
    const { columns } = useTaskListColumns();
    const { colorOf: statusColorOf, label: statusLabelOf } = useStatuses();
    // 프로젝트 열을 채우려면 프로젝트 캐시가 필요하다. 보관함은 한 번 로드하고 가만히 있어서
    // 구독을 안 걸면 프로젝트 목록이 나중에 도착했을 때 열이 "—"인 채로 남는다.
    useProjects();
    const perms = useWorkspacePermissions();
    /* 월별 접기. 보관함은 시간이 갈수록 계속 쌓이므로 전부 펼쳐 두면 벽이 된다.
       가장 최근 달만 펼치고 나머지는 접어 둔다 — 헤더의 건수로 안에 뭐가 있는지는 보인다. */
    const [collapsed, setCollapsed] = useState(() => new Set());
    const initedRef = React.useRef(false);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
    const [archiving, setArchiving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchArchivedTodos();
            setItems(res.data ?? []);
            setLoadError(null);
        } catch (e) {
            /* 조회 실패를 빈 목록으로 뭉개면 "아카이브된 작업이 없어요"가 뜬다 —
               보관해 둔 게 사라진 것처럼 보이고, 재시도할 방법도 없다. 실패는 실패로 알린다. */
            setItems([]);
            setLoadError(getApiError(e, "보관함을 불러오지 못했어요.") || "보관함을 불러오지 못했어요.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleRestore = useCallback(async (id) => {
        setItems((prev) => prev.filter((t) => t.id !== id));
        try {
            await restoreTodo(id);
            onRefreshParent?.();
            toast.success("할 일 목록으로 복원됐어요.");
        } catch (e) {
            load();
            // 서버의 한국어 사유를 그대로 노출 (샘플 차단·역할 부족 등 이유가 다르다)
            toast.error(getApiError(e, "복원 중 오류가 발생했어요."));
        }
    }, [load, onRefreshParent]);

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return;
        const id = deleteTarget.id;
        setDeleteTarget(null);
        setItems((prev) => prev.filter((t) => t.id !== id));
        try {
            await deleteTodo(id);
            toast.success("영구 삭제됐어요.");
        } catch (e) {
            load();
            toast.error(getApiError(e, "삭제 중 오류가 발생했어요."));
        }
    }, [deleteTarget, load]);

    const handleOpenDetail = useCallback((todo) => {
        openTodoDetail(todo.id, {
            // 복원 권한이 없으면 상세의 "복원" 항목도 내보내지 않는다 (행 버튼과 같은 규칙)
            onRestore: perms.canEditTodo(todo) ? async () => {
                setItems((prev) => prev.filter((t) => t.id !== todo.id));
                try {
                    await restoreTodo(todo.id);
                    onRefreshParent?.();
                    toast.success("할 일 목록으로 복원됐어요.");
                } catch (e) {
                    load();
                    toast.error(getApiError(e, "복원 중 오류가 발생했어요."));
                }
            } : undefined,
        });
    }, [openTodoDetail, onRefreshParent, load, perms]);

    /* 일괄 보관은 서버(POST /todos/archive-done)가 **워크스페이스 전체**의 완료 항목을 대상으로 한다.
       프로젝트 필터가 없다. 그런데 이 화면은 프로젝트 스코프처럼 보여서, 확인 없이 실행하면
       "이 프로젝트만 정리하려다 남의 프로젝트 완료분까지 통째로 치우는" 사고가 난다.
       → 반드시 확인 창을 거치고, 범위를 문구로 못박는다. */
    const handleArchiveDone = useCallback(async () => {
        setArchiving(true);
        try {
            const res = await archiveDoneTodos();
            // 서버가 { archived: N }을 준다. 실제 건수를 알려야 "눌렀는데 뭐가 됐는지 모르겠다"가 없다.
            const archivedCount = res?.data?.archived ?? 0;
            setArchiveConfirmOpen(false);
            await load();
            onRefreshParent?.();
            if (archivedCount === 0) toast.info("보관할 완료된 작업이 없었어요.");
            else toast.success(`완료된 작업 ${archivedCount}건을 보관했어요.`);
        } catch (err) {
            setArchiveConfirmOpen(false);
            // 서버의 한국어 사유를 그대로 (VIEWER = "읽기 전용 역할은 편집할 수 없습니다." 등)
            toast.error(getApiError(err, "아카이브 중 오류가 발생했어요."));
        } finally {
            setArchiving(false);
        }
    }, [load, onRefreshParent]);

    const grouped = useMemo(() => groupByMonth(items), [items]);
    const monthKeys = Object.keys(grouped);

    /* 첫 로드에서 가장 최근 달만 펼친다. 이후 사용자의 접기/펼치기는 그대로 존중한다
       (initedRef가 없으면 목록이 갱신될 때마다 접힘 상태가 초기화된다). */
    useEffect(() => {
        if (initedRef.current || monthKeys.length === 0) return;
        initedRef.current = true;
        setCollapsed(new Set(monthKeys.slice(1)));
    }, [monthKeys]);

    // 일괄 보관은 서버가 MEMBER 이상만 허용한다(VIEWER는 403). 눌리기만 하고 실패하는 버튼을 두지 않는다.
    const canBulkArchive = perms.canEditContent;
    const archiveButton = (
        /* 비활성 버튼은 hover 이벤트를 받지 않아 title이 안 뜬다 → 감싼 span에 이유를 붙인다 */
        <Box component="span" sx={{ display: "inline-flex" }} title={canBulkArchive ? undefined : "읽기 전용 역할은 보관할 수 없어요"}>
            <Button
                size="small"
                variant="outlined"
                disabled={archiving || !canBulkArchive}
                onClick={() => setArchiveConfirmOpen(true)}
                sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12 }}
            >
                {archiving ? "보관 중..." : "완료된 작업 아카이브"}
            </Button>
        </Box>
    );

    let body;
    if (loading) {
        body = (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 6, pb: 6 }}>
                <CircularProgress size={28} />
            </Box>
        );
    } else if (loadError) {
        // 실패는 "없음"과 다르게 보여야 한다 — 원인 + 다시 시도
        body = (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 8, px: 2.25, gap: 1.5 }}>
                <ErrorOutlineRoundedIcon sx={{ fontSize: 44, color: "error.main", opacity: 0.7 }} />
                <Typography variant="body2" color="text.secondary" fontWeight={700}>
                    보관함을 불러오지 못했어요
                </Typography>
                <Typography variant="caption" color="text.disabled" textAlign="center" sx={{ maxWidth: 320 }}>
                    {loadError}
                </Typography>
                <Button size="small" variant="outlined" onClick={load} sx={{ mt: 1, borderRadius: 2, fontWeight: 700 }}>
                    다시 시도
                </Button>
            </Box>
        );
    } else if (items.length === 0) {
        body = (
            <Box sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 8,
                px: 2.25,
                gap: 1.5,
            }}>
                <InventoryRoundedIcon sx={{ fontSize: 48, color: "text.disabled", opacity: 0.5 }} />
                <Typography variant="body2" color="text.secondary" fontWeight={700}>
                    아카이브된 작업이 없어요
                </Typography>
                <Typography variant="caption" color="text.disabled" textAlign="center">
                    완료된 작업을 아카이브하면 여기에 표시돼요
                </Typography>
                <Box sx={{ mt: 1 }}>{archiveButton}</Box>
            </Box>
        );
    } else {
        body = (
        <>
            {/* 상단 일괄 아카이브 버튼 — 바깥 Card에 바로 붙으므로 좌우 패딩을 여기서 준다.
                보관함 조회(GET /todos/archived)도 워크스페이스 단위라 프로젝트 스코프와 무관하게
                전부 보인다 — 프로젝트를 고른 채 열면 오해하기 쉬워서 범위를 적어 둔다. */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, px: 2.25, py: 1.5 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.disabled" }}>
                    워크스페이스 전체 보관함 · {items.length}건
                </Typography>
                {archiveButton}
            </Box>
            {monthKeys.map((month) => {
                const isCollapsed = collapsed.has(month);
                return (
                <Box key={month}>
                    {/* 월 헤더 — 눌러서 접기/펼치기 */}
                    <Box
                        onClick={() => setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(month)) next.delete(month); else next.add(month);
                            return next;
                        })}
                        sx={{
                            px: 2.25,
                            py: 1.25,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            cursor: "pointer",
                            userSelect: "none",
                            borderTop: "1px solid",
                            borderColor: "divider",
                            bgcolor: "var(--plando-surface-faint)",
                            "&:hover": { bgcolor: "action.hover" },
                        }}
                    >
                        <ExpandMoreRoundedIcon
                            sx={{
                                fontSize: 18,
                                color: "text.disabled",
                                transition: "transform 0.15s",
                                transform: isCollapsed ? "rotate(-90deg)" : "none",
                            }}
                        />
                        <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em", color: "text.primary" }}>
                            {month}
                        </Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.disabled" }}>
                            {grouped[month].length}건
                        </Typography>
                    </Box>

                    {/* 항목 — 카드 안에 카드를 두지 않는다. 바깥 Card가 이미 표면이다 */}
                    {!isCollapsed && (
                      <Box>
                        {grouped[month].map((todo, idx) => (
                            <React.Fragment key={todo.id}>
                                {idx > 0 && <Divider />}
                                <Box
                                    onClick={() => handleOpenDetail(todo)}
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: buildGridCols(columns),
                                        alignItems: "center",
                                        gap: 1.75,
                                        px: 2.25,
                                        py: 1.25,
                                        cursor: "pointer",
                                        // 보관은 '지난 것'이라 한 톤 죽인다. 다만 열 구성은 목록과 동일하다.
                                        opacity: 0.78,
                                        "&:hover": { opacity: 1, bgcolor: "action.hover" },
                                    }}
                                >
                                    {/* buildGridCols = `6px | 제목 | 열들 | 36px` — 앞 6px 자리 */}
                                    <Box />

                                    {/* 제목 */}
                                    <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
                                        <InventoryRoundedIcon sx={{ fontSize: 14, color: "text.disabled", flexShrink: 0 }} />
                                        <Typography
                                            sx={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                letterSpacing: "-0.02em",
                                                color: "text.secondary",
                                                textDecoration: "line-through",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                minWidth: 0,
                                            }}
                                        >
                                            {todo.title || "(제목 없음)"}
                                        </Typography>
                                    </Box>

                                    {/* 목록과 같은 열 구성·같은 컴포넌트 — 보관함만 다른 언어를 쓰지 않게 */}
                                    {columns.map((col) => {
                                        if (col.key === "status") {
                                            return (
                                                <Box key="status">
                                                    <StatusTag
                                                        status={todo.status}
                                                        color={statusColorOf(todo.status)}
                                                        label={statusLabelOf(todo.status)}
                                                        size="sm"
                                                    />
                                                </Box>
                                            );
                                        }
                                        if (col.key === "assignees") {
                                            const list = resolveAssigneeList(todo);
                                            return (
                                                <Box key="assignees" sx={{ minWidth: 0 }}>
                                                    {list.length > 0
                                                        ? <AssigneeStack assignees={list} />
                                                        : <ArchiveDash />}
                                                </Box>
                                            );
                                        }
                                        if (col.key === "due") {
                                            return (
                                                <Box key="due" sx={{ minWidth: 0 }}>
                                                    {todo.dueDate ? (
                                                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.disabled", whiteSpace: "nowrap" }}>
                                                            {formatAbsoluteDue(todo.dueDate)}
                                                        </Typography>
                                                    ) : <ArchiveDash />}
                                                </Box>
                                            );
                                        }
                                        if (col.key === "priority") {
                                            return <Box key="priority"><PriorityTag priority={todo.priority} size="sm" /></Box>;
                                        }
                                        if (col.key === "project") {
                                            /* 보관함은 워크스페이스 전체를 보여준다 — 어느 프로젝트의 작업인지가
                                               특히 중요한데도 늘 "—"였다. 목록 행과 같은 resolveProject로 채운다. */
                                            const proj = resolveProject(todo);
                                            const ProjIcon = proj ? getProjectIcon(proj.icon) : null;
                                            return (
                                                <Box key="project" sx={{ minWidth: 0 }}>
                                                    {proj ? (
                                                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                                                            <ProjIcon sx={{ fontSize: 15, color: projectIconColor(proj.color) ?? "text.secondary", flexShrink: 0 }} />
                                                            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {proj.name}
                                                            </Typography>
                                                        </Stack>
                                                    ) : <ArchiveDash />}
                                                </Box>
                                            );
                                        }
                                        return <Box key={col.key} />;
                                    })}

                                    {/* 마지막 36px — 복원/삭제.
                                        복원 = 편집 권한(MEMBER+, 샘플 차단), 영구삭제 = 작성자 본인 || ADMIN(샘플 차단).
                                        서버 규칙과 어긋나면 눌러서 403을 맞는 버튼이 되므로 여기서 같은 규칙으로 잠근다. */}
                                    <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                        <RowAction
                                            enabled={perms.canEditTodo(todo)}
                                            color="primary"
                                            label="복원"
                                            reason={todo.isSample ? "샘플 데이터는 복원할 수 없어요" : "읽기 전용 역할은 복원할 수 없어요"}
                                            onClick={() => handleRestore(todo.id)}
                                        >
                                            <RestoreRoundedIcon sx={{ fontSize: 17 }} />
                                        </RowAction>
                                        <RowAction
                                            enabled={perms.canDeleteTodo(todo)}
                                            color="error"
                                            label="삭제"
                                            reason={todo.isSample ? "샘플 데이터는 삭제할 수 없어요" : "만든 사람이나 관리자만 삭제할 수 있어요"}
                                            onClick={() => setDeleteTarget(todo)}
                                        >
                                            <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                                        </RowAction>
                                    </Stack>
                                </Box>
                            </React.Fragment>
                        ))}
                      </Box>
                    )}
                </Box>
                );
            })}
        </>
        );
    }

    return (
        <Box>
            {body}

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                title="영구 삭제"
                message={deleteTarget?.title
                    ? `"${deleteTarget.title}"\n삭제하면 되돌릴 수 없어요.`
                    : "이 작업을 삭제할까요?"}
                confirmText="삭제"
                confirmColor="error"
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
            />

            {/* 범위를 문구로 못박는다 — 서버에 프로젝트 필터가 없어서 정말 워크스페이스 전체가 대상이다 */}
            <ConfirmDialog
                open={archiveConfirmOpen}
                title="완료된 작업 아카이브"
                message={"이 워크스페이스의 완료된 작업을 전부 보관함으로 옮겨요.\n지금 보고 있는 프로젝트만이 아니라, 다른 프로젝트·다른 사람이 완료한 작업까지 모두 포함돼요.\n\n보관해도 지워지지는 않아요. 보관함에서 하나씩 되돌릴 수 있어요."}
                confirmText="전체 보관"
                confirmColor="warning"
                loading={archiving}
                onClose={() => setArchiveConfirmOpen(false)}
                onConfirm={handleArchiveDone}
            />
        </Box>
    );
}

/** 값 없음 — 목록과 같은 기호 */
function ArchiveDash() {
    return <Typography sx={{ fontSize: 12, color: "text.disabled" }}>—</Typography>;
}

/**
 * 보관함 행 액션(복원/영구삭제).
 * 권한이 없으면 사라지게 두지 않고 비활성 + 이유를 붙인다 — 아이콘이 조용히 없어지면
 * "왜 나만 안 보이지"가 되고, 그대로 두면 눌러서 403을 맞는다.
 * 비활성 IconButton은 hover 이벤트를 못 받아 title이 안 뜨므로 감싼 span에 이유를 단다.
 */
function RowAction({ enabled, color, label, reason, onClick, children }) {
    return (
        <Box component="span" sx={{ display: "inline-flex" }} title={enabled ? label : reason}>
            <IconButton
                size="small"
                color={color}
                disabled={!enabled}
                onClick={onClick}
                aria-label={label}
                sx={{ borderRadius: 1.5 }}
            >
                {children}
            </IconButton>
        </Box>
    );
}
