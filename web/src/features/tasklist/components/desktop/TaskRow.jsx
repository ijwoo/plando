import React from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import CircleCheckbox from "../../../../shared/ui/common/CircleCheckbox.jsx";
import TagChips from "../../../../shared/ui/common/TagChips.jsx";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import AssigneeStack from "../../../../shared/ui/common/AssigneeStack.jsx";
import { resolveAssigneeList } from "../../../../shared/utils/assigneeUtils.js";
import { STATUS_LABEL, priorityColor } from "../../../../shared/ui/tone.js";
import { PriorityTag, StatusTag } from "../../../../shared/ui/common/Tags.jsx";
import { formatRelativeDue, formatAbsoluteDue } from "../../../../shared/utils/formatters.js";
import { isTodoDone, defaultTodoStatusKey, doneTodoStatusKey } from "../../../../shared/utils/todoStatus.js";
import { resolveProject } from "../../../project/store/projectStore.js";
import { getProjectIcon } from "../../../project/projectIcons.js";
import { projectIconColor } from "../../../project/utils/projectOptions.js";
import { buildGridCols } from "./taskListColumns.js";

/**
 * 커스텀 컬럼 grid row. 데스크탑 TaskList 전용.
 * cols: [priority-bar][title+meta][...표시 컬럼...][actions]
 * 표시 컬럼은 columns prop(상태/참여자/마감일/우선순위/프로젝트 중 선택).
 *
 * 확장(쉐브론) 시 서브태스크를 인라인 노출.
 */
export default function TaskRow({
    task,
    columns = [],
    isActive,
    subtasks,
    expanded,
    onToggleExpand,
    onOpen,
    onToggleStatus,
    onToggleFocus,
    onDelete,
    selectMode = false,
    selected = false,
    onToggleSelect,
}) {
    const theme = useTheme();
    const { statuses: statusDefs, colorOf: statusColorOf, label: statusLabelOf } = useStatuses();
    const status = task.status || "TODO";
    // 완료 판정은 doneAt/카테고리 인지 단일 소스 사용 — 커스텀 완료 상태도 완료로 취급
    const isDone = isTodoDone(task);
    const isOverdue = !isDone && task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
    const statusHex = statusColorOf(status);
    const priority = task.priority || "MEDIUM";
    const priorityHex = priorityColor(theme, priority);
    const assignees = resolveAssigneeList(task);
    const project = resolveProject(task);
    const isRecurring = !!(task.hasRecurrence || task.recurrenceSourceId);
    // 서브태스크(parentId 기반 실제 할 일) 배지 N/M.
    // 자식 행을 받으면 그걸로 N/M 계산(자식 완료 토글 시 배지 즉시 갱신), 없으면 서버 집계값 폴백.
    const subtaskList = Array.isArray(subtasks) ? subtasks : [];
    const hasSubtaskRows = subtaskList.length > 0;
    /* 실제 자식 행과 서버 집계값 중 큰 쪽을 쓴다.
       상세에서 서브태스크를 방금 추가하면 서버 집계(patch로 갱신됨)가 먼저 늘고 자식 행은
       아직 목록에 안 들어와 있을 수 있는데, 자식 행 길이만 믿으면 배지가 옛 값에 머문다. */
    const subtaskTotal = Math.max(subtaskList.length, task.subtaskTotal ?? 0);
    const subtaskDone = hasSubtaskRows
        ? Math.max(subtaskList.filter(isTodoDone).length, task.subtaskDone ?? 0)
        : (task.subtaskDone ?? 0);
    const hasSubtasks = subtaskTotal > 0;
    // 실제 자식 행을 받아 둔 경우에만 펼칠 수 있다 (서버 집계값만 있는 경우는 배지만 표시)
    const canExpand = hasSubtaskRows;

    return (
        <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Box
            onClick={() => (selectMode ? onToggleSelect?.(task.id) : onOpen?.(task.id))}
            sx={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: buildGridCols(columns),
                alignItems: "center",
                gap: 1.75,
                px: 2.25,
                py: 1.25,
                bgcolor: selected ? "var(--plando-primary-soft)" : isActive ? "var(--plando-primary-soft)" : "background.paper",
                cursor: "pointer",
                transition: "background var(--plando-dur-fast) var(--plando-ease)",
                "&:hover": {
                    bgcolor: (selected || isActive) ? "var(--plando-primary-soft)" : "var(--plando-surface-faint)",
                },
                "&:hover .row-actions": { opacity: 1 },
                ...((isActive || selected) && {
                    boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
                }),
            }}
        >
            {/* priority bar (선택 모드에선 체크박스로 교체) */}
            {selectMode ? (
                <Box sx={{ justifySelf: "center" }}>
                    <CircleCheckbox checked={selected} onToggle={() => onToggleSelect?.(task.id)} size={20} />
                </Box>
            ) : (
                <Box
                    sx={{
                        width: 4,
                        height: 24,
                        borderRadius: 999,
                        bgcolor: priorityHex,
                        opacity: isDone ? 0.35 : 1,
                        justifySelf: "center",
                    }}
                />
            )}

            {/* title + meta */}
            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                    {/* 선택 모드에선 완료 원을 숨긴다 — 행 왼쪽에 이미 선택 원이 있어 원이 두 개로 보이고,
                        둘 중 뭘 누르는 건지 알기 어렵다(선택 모드에서 행 클릭은 '선택'이라 완료 토글도 어긋난다).
                        모바일 TaskListRow가 이미 같은 규칙이다. */}
                    {!selectMode ? (
                        <CircleCheckbox
                            size={18}
                            checked={isDone}
                            onToggle={() => onToggleStatus?.(task, isDone ? defaultTodoStatusKey(statusDefs) : doneTodoStatusKey(statusDefs))}
                            accent={theme.palette.success.main}
                        />
                    ) : null}
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: isDone ? 600 : 800,
                            letterSpacing: "-0.02em",
                            color: isDone ? "text.disabled" : "text.primary",
                            textDecoration: isDone ? "line-through" : "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                        }}
                    >
                        {task.title || "(제목 없음)"}
                    </Typography>
                    {onToggleFocus && (
                        <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onToggleFocus(task); }}
                            sx={{
                                p: 0.375,
                                color: task.focused ? "warning.main" : "text.disabled",
                                "&:hover": { color: "warning.main", bgcolor: alpha(theme.palette.warning.main, 0.08) },
                            }}
                        >
                            <BoltRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    )}
                    {isRecurring && (
                        <RepeatRoundedIcon sx={{ fontSize: 14, color: "primary.main", flexShrink: 0 }} />
                    )}
                    {task.tags?.length > 0 && <TagChips tags={task.tags} max={3} />}
                </Stack>
                {/* 확장 요약 줄 — 쉐브론/배지 클릭으로 서브태스크 인라인 펼침 */}
                {hasSubtasks && (
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.75}
                        onClick={(e) => { e.stopPropagation(); if (canExpand) onToggleExpand?.(task.id); }}
                        sx={{
                            pl: 3.5,
                            cursor: canExpand ? "pointer" : "default",
                            color: expanded ? "primary.main" : "text.disabled",
                            fontSize: 11,
                            transition: "color var(--plando-dur-fast) var(--plando-ease)",
                            ...(canExpand && { "&:hover": { color: "primary.main" } }),
                        }}
                    >
                        {canExpand && (
                            <ExpandMoreRoundedIcon
                                sx={{
                                    fontSize: 14,
                                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform var(--plando-dur-fast) var(--plando-ease)",
                                }}
                            />
                        )}
                        {hasSubtasks && (
                            <Stack
                                direction="row"
                                alignItems="center"
                                spacing={0.375}
                                sx={{ flexShrink: 0, color: subtaskDone === subtaskTotal ? "success.main" : "inherit" }}
                            >
                                <AccountTreeRoundedIcon sx={{ fontSize: 12 }} />
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "inherit", fontVariantNumeric: "tabular-nums" }}>
                                    {subtaskDone}/{subtaskTotal}
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                )}
            </Box>

            {/* 표시 컬럼 (커스텀) */}
            {columns.map((col) => {
                if (col.key === "status") {
                    return <Box key="status"><StatusTag status={status} color={statusHex} label={statusLabelOf(status)} size="sm" /></Box>;
                }
                if (col.key === "assignees") {
                    return (
                        <Box key="assignees">
                            {assignees.length > 0 ? (
                                <AssigneeStack assignees={assignees} />
                            ) : (
                                <Typography sx={{ fontSize: 12, color: "text.disabled", fontWeight: 700 }}>—</Typography>
                            )}
                        </Box>
                    );
                }
                if (col.key === "due") {
                    return (
                        <Stack key="due" spacing={0.125}>
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    letterSpacing: "-0.02em",
                                    color: isOverdue ? "error.main" : isDone ? "text.disabled" : "text.primary",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {task.dueDate ? formatAbsoluteDue(task.dueDate) : "—"}
                            </Typography>
                            {task.dueDate && (
                                <Typography
                                    sx={{
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        color: isOverdue ? "error.main" : "text.disabled",
                                        letterSpacing: "-0.01em",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {isOverdue ? "지난 일정" : formatRelativeDue(task.dueDate)}
                                </Typography>
                            )}
                        </Stack>
                    );
                }
                if (col.key === "priority") {
                    return <Box key="priority"><PriorityTag priority={priority} size="sm" /></Box>;
                }
                if (col.key === "project") {
                    return (
                        <Box key="project" sx={{ minWidth: 0 }}>
                            {project ? (() => {
                                const ProjIcon = getProjectIcon(project.icon);
                                return (
                                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                                        <ProjIcon sx={{ fontSize: 15, color: projectIconColor(project.color) ?? "text.secondary", flexShrink: 0 }} />
                                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {project.name}
                                        </Typography>
                                    </Stack>
                                );
                            })() : (
                                <Typography sx={{ fontSize: 12, color: "text.disabled", fontWeight: 700 }}>—</Typography>
                            )}
                        </Box>
                    );
                }
                return null;
            })}

            {/* actions */}
            <Stack
                direction="row"
                spacing={0.25}
                className="row-actions"
                sx={{
                    justifyContent: "flex-end",
                    opacity: 0,
                    transition: "opacity var(--plando-dur-fast) var(--plando-ease)",
                }}
            >
                {/* onDelete가 없으면(삭제 권한 없음) 삭제 버튼 자체를 숨김 — 그리드 열은 유지 */}
                {onDelete && (
                    <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onDelete(task); }}
                        sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
                    >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                )}
            </Stack>
        </Box>

        {/* 인라인 확장 — 서브태스크.
            목록의 활성 필터를 적용하지 않고 해당 부모의 자식 전체를 노출
            (사용자가 "이 할 일의 전체 구성"을 보려고 펼친 것이므로 필터로 잘라내지 않는다) */}
        {expanded && hasSubtaskRows && (
            <Box
                sx={{
                    bgcolor: "var(--plando-surface-faint)",
                    borderTop: "1px dashed",
                    borderColor: "divider",
                    py: 0.5,
                }}
            >
                {subtaskList.map((st) => (
                    <SubtaskRow
                        key={st.id}
                        task={st}
                        statusDefs={statusDefs}
                        statusLabelOf={statusLabelOf}
                        statusColorOf={statusColorOf}
                        columns={columns}
                        onOpen={onOpen}
                        onToggleStatus={onToggleStatus}
                    />
                ))}
            </Box>
        )}
        </Box>
    );
}

/**
 * 인라인 서브태스크 행 — 부모 확장 시 한 단계 들여쓴 행.
 *
 * 부모와 **같은 그리드**를 쓴다. 예전엔 flex 한 줄이라 상태·마감·우선순위·프로젝트 열이
 * 통째로 비어 있었는데, 서브태스크도 자기 상태·담당자·마감일·우선순위를 부모와 다르게
 * 가질 수 있는 진짜 할 일이다. 값이 안 보이면 하위 7개 중 어느 게 지연됐는지 알 수 없어
 * 하나씩 열어봐야 했다.
 *
 * 부모와의 구분은 들여쓰기 + ↳ 아이콘 + 한 단계 작고 옅은 표기로 준다(열 값 자체는 채운다).
 * 프로젝트 열만 비운다 — 부모와 같을 수밖에 없어 반복이 소음이 된다.
 */
function SubtaskRow({ task, statusDefs, statusLabelOf, statusColorOf, columns = [], onOpen, onToggleStatus }) {
    const theme = useTheme();
    // 완료 판정은 상위 행과 동일하게 isTodoDone 단일 소스 (커스텀 완료 상태 포함)
    const isDone = isTodoDone(task);
    const isOverdue = !isDone && task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
    const assignees = resolveAssigneeList(task);
    const status = task.status;
    const priority = task.priority || "MEDIUM";

    return (
        <Box
            onClick={(e) => { e.stopPropagation(); onOpen?.(task.id); }}
            sx={{
                display: "grid",
                gridTemplateColumns: buildGridCols(columns),
                alignItems: "center",
                gap: 1.75,
                pl: 5.5,
                pr: 2.25,
                py: 1,           // 부모(1.25)보다 살짝 좁게 — 계층은 유지하되 답답하지 않게
                cursor: "pointer",
                "&:hover": { bgcolor: "var(--plando-surface-low)" },
            }}
        >
            {/* buildGridCols는 `6px | 제목 | 열들 | 36px` 이다.
                맨 앞 6px(부모의 우선순위 색 막대 자리)과 맨 뒤 36px(액션 자리)을 빈 셀로 채워야
                열이 부모와 맞는다 — 빠뜨리면 모든 값이 한 칸씩 왼쪽으로 밀린다. */}
            <Box />

            {/* 제목 셀 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0 }} />
                <CircleCheckbox
                    size={16}
                    checked={isDone}
                    onToggle={() => onToggleStatus?.(task, isDone ? defaultTodoStatusKey(statusDefs) : doneTodoStatusKey(statusDefs))}
                    accent={theme.palette.success.main}
                />
                <Typography
                    sx={{
                        fontSize: 13,
                        fontWeight: isDone ? 500 : 700,
                        letterSpacing: "-0.01em",
                        color: isDone ? "text.disabled" : "text.primary",
                        textDecoration: isDone ? "line-through" : "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                    }}
                >
                    {task.title || "(제목 없음)"}
                </Typography>
            </Box>

            {/* 부모와 같은 컬럼 구성으로 값 채우기 (프로젝트는 제외) */}
            {columns.map((col) => {
                if (col.key === "status") {
                    return (
                        <Box key="status">
                            <StatusTag
                                status={status}
                                color={statusColorOf?.(status)}
                                label={statusLabelOf?.(status) ?? status}
                                size="xs"
                            />
                        </Box>
                    );
                }
                if (col.key === "assignees") {
                    return (
                        <Box key="assignees" sx={{ minWidth: 0 }}>
                            {assignees.length > 0
                                ? <AssigneeStack assignees={assignees} size={20} max={2} />
                                : <Dash />}
                        </Box>
                    );
                }
                if (col.key === "due") {   // 컬럼 키는 'due' 다 ('dueDate'로 쓰면 빈 셀이 된다)
                    return (
                        <Box key="due" sx={{ minWidth: 0 }}>
                            {task.dueDate ? (
                                <Typography
                                    sx={{
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        letterSpacing: "-0.01em",
                                        color: isOverdue ? "error.main" : "text.disabled",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {formatAbsoluteDue(task.dueDate)}
                                </Typography>
                            ) : <Dash />}
                        </Box>
                    );
                }
                if (col.key === "priority") {
                    return <Box key="priority"><PriorityTag priority={priority} size="xs" /></Box>;
                }
                // 프로젝트는 부모와 동일하므로 자리만 차지시킨다(열 정렬 유지)
                return <Box key={col.key} />;
            })}

            {/* 마지막 36px 트랙(부모의 삭제 버튼 자리) */}
            <Box />
        </Box>
    );
}

/** 값 없음 표시 — 부모 행과 같은 기호를 쓴다 */
function Dash() {
    return <Typography sx={{ fontSize: 12, color: "text.disabled" }}>—</Typography>;
}
