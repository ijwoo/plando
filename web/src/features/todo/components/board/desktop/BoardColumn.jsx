import React from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import BoardCard from "./BoardCard.jsx";
import { getStatusLabel } from "../../../../../shared/ui/tone.js";
import { StatusTag } from "../../../../../shared/ui/common/Tags.jsx";

/**
 * 칸반 컬럼 (Phase 14).
 * 헤더: dot + 라벨 + 카운트 + (+) + subtitle
 * 바디: BoardCard 리스트 + dashed (+) 새 작업 추가
 * 드래그 오버 시 강조.
 */
const SUBTITLES = {
    TODO: "백로그 · 우선순위 정리 필요",
    IN_PROGRESS: "집중해서 마무리",
    DONE: "최근 완료",
};

export default function BoardColumn({
    status,
    statusLabel,
    statusColor: statusColorProp,
    tasks,
    isDragOver,
    grow = false,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragStartTask,
    onDragEndTask,
    draggingId,
    onCardClick,
    onCardDelete,
    onAddTask,
    onArchive,
}) {
    const theme = useTheme();
    const label = statusLabel ?? getStatusLabel(status);
    const total = tasks.length;

    return (
        <Box
            onDragOver={(e) => { e.preventDefault(); onDragOver?.(status); }}
            onDragLeave={() => onDragLeave?.()}
            onDrop={(e) => { e.preventDefault(); onDrop?.(e, status); }}
            sx={{
                /* 컬럼은 기본적으로 고정폭이다.
                   예전엔 flex:1이라 상태가 늘어날수록 컬럼이 minWidth(280)까지 쭈그러들었고,
                   그 뒤에야 가로 스크롤이 생겨서 상태 6개쯤 되면 전부 최소폭으로 눌렸다.
                   컬럼이 적을 때(3개 이하)만 남는 공간을 채우게 호출부에서 grow를 넘긴다. */
                flexGrow: grow ? 1 : 0,
                flexShrink: 0,
                flexBasis: 300,
                minWidth: 300,
                display: "flex",
                flexDirection: "column",
                bgcolor: "var(--plando-surface-alt)",
                borderRadius: "var(--plando-radius-lg)",
                border: "1px solid",
                borderColor: isDragOver ? "primary.main" : "transparent",
                boxShadow: isDragOver ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}` : "none",
                transition: "border-color var(--plando-dur-fast) var(--plando-ease), box-shadow var(--plando-dur-fast) var(--plando-ease)",
            }}
        >
            {/* 헤더 */}
            <Box sx={{ px: 1.75, py: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.625 }}>
                    {/* 커스텀 상태는 정의된 색(statusColorProp)을 쓰고, 없으면 tone.js 폴백 */}
                    <StatusTag status={status} color={statusColorProp} variant="dot" size="md" />
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                        {label}
                    </Typography>
                    <Box
                        sx={{
                            px: 0.875,
                            py: 0.125,
                            borderRadius: 999,
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            fontSize: 11,
                            fontWeight: 800,
                            color: "text.disabled",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {total}
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    {onAddTask && <IconButton
                        size="small"
                        onClick={() => onAddTask?.(status)}
                        title="새 작업"
                        sx={{
                            width: 24,
                            height: 24,
                            borderRadius: "var(--plando-radius-sm)",
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: "background.paper",
                            color: "text.secondary",
                            "&:hover": { color: "primary.main", borderColor: "primary.main" },
                        }}
                    >
                        <AddRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>}
                    {onArchive && (
                        <IconButton
                            size="small"
                            onClick={onArchive}
                            title="아카이브"
                            sx={{
                                width: 24,
                                height: 24,
                                borderRadius: "var(--plando-radius-sm)",
                                color: "text.disabled",
                                "&:hover": { color: "text.secondary" },
                            }}
                        >
                            <Inventory2RoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    )}
                </Stack>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.disabled", letterSpacing: "-0.01em" }}>
                    {SUBTITLES[status] ?? ""}
                </Typography>
            </Box>

            {/* 카드 리스트 */}
            <Box
                /* 보드의 휠→가로스크롤 핸들러(TodoBoardPage)가 이 표식을 보고
                   "여기서는 세로 스크롤을 먼저 소진시킨다"를 판단한다 */
                data-board-scroll=""
                sx={{
                    flex: 1,
                    minHeight: 200,
                    overflowY: "auto",
                    px: 1.25,
                    pb: 1.25,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                    scrollbarGutter: "stable",
                }}
            >
                {tasks.length === 0 && (
                    <Box
                        sx={{
                            minHeight: 120,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px dashed",
                            borderColor: "divider",
                            borderRadius: "var(--plando-radius-md)",
                            color: "text.disabled",
                            fontSize: 12.5,
                            fontWeight: 600,
                        }}
                    >
                        아직 작업이 없어요
                    </Box>
                )}
                {tasks.map((t) => (
                    <BoardCard
                        key={t.id}
                        todo={t}
                        isDragging={draggingId === t.id}
                        onDragStart={(e) => {
                            e.dataTransfer.setData("todoId", String(t.id));
                            onDragStartTask?.(t);
                        }}
                        onDragEnd={() => onDragEndTask?.()}
                        onClick={() => onCardClick?.(t.id)}
                        onDelete={onCardDelete}
                    />
                ))}

                {/* 새 작업 추가 dashed 버튼 (편집 권한 있을 때만) */}
                {onAddTask && <Box
                    onClick={() => onAddTask?.(status)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        height: 40,
                        borderRadius: "var(--plando-radius-md)",
                        border: "1.5px dashed",
                        borderColor: "divider",
                        color: "text.disabled",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "border-color var(--plando-dur-fast) var(--plando-ease), color var(--plando-dur-fast) var(--plando-ease), background var(--plando-dur-fast) var(--plando-ease)",
                        "&:hover": {
                            borderColor: "primary.main",
                            color: "primary.main",
                            bgcolor: "var(--plando-primary-soft)",
                        },
                    }}
                >
                    <AddRoundedIcon sx={{ fontSize: 14 }} />
                    새 작업 추가
                </Box>}
            </Box>
        </Box>
    );
}
