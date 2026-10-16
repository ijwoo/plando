import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import Press from "../../../shared/ui/primitives/Press.jsx";
import Sheet from "../../../shared/ui/primitives/Sheet.jsx";

/**
 * 섹션 자세히보기 — 회고 톤 타임테이블.
 * 공용 Sheet primitive 사용 (SwipeableDrawer + 핸들 드래그 + body scroll lock).
 */
export default function WrapDetailSheet({
    open,
    onClose,
    title,
    subtitle,
    todos,
    filterFn,
    emptyText = "해당 조건의 일정이 없어요",
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const items = (todos || []).filter((t) => (filterFn ? filterFn(t) : true));

    // 요일별 그룹핑 — 회고 타임테이블 톤
    const grouped = items.reduce((acc, t) => {
        const key = `${t.dayIndex}-${t.dateLabel}`;
        if (!acc[key]) acc[key] = { dayLabel: t.dayLabel, dateLabel: t.dateLabel, dayIndex: t.dayIndex, items: [] };
        acc[key].items.push(t);
        return acc;
    }, {});
    const groups = Object.values(grouped).sort((a, b) => a.dayIndex - b.dayIndex);

    const header = (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
                px: 2.5,
                pt: 1,
                pb: 1.5,
                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "var(--plando-divider)"}`,
                background: "background.paper",
            }}
        >
            <Stack spacing={0.5}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography
                        sx={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "var(--plando-primary)",
                            letterSpacing: "0.12em",
                        }}
                    >
                        REWIND
                    </Typography>
                    <Box
                        sx={{
                            width: 3,
                            height: 3,
                            borderRadius: "50%",
                            background: isDark
                                ? "rgba(255,255,255,0.25)"
                                : "var(--plando-text-tertiary)",
                        }}
                    />
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", letterSpacing: "-0.01em" }}>
                        지난 7일
                    </Typography>
                </Stack>
                <Typography
                    sx={{
                        fontSize: 19,
                        fontWeight: 800,
                        color: "text.primary",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.25,
                    }}
                >
                    {title}
                </Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>
                    {subtitle ? `${subtitle} · 총 ${items.length}건` : `총 ${items.length}건`}
                </Typography>
            </Stack>
            <Press
                as="span"
                onClick={onClose}
                haptic="light"
                pressScale={0.9}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                }}
            >
                <CloseRoundedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
            </Press>
        </Stack>
    );

    return (
        <Sheet open={open} onClose={onClose} height="80dvh" header={header}>
            {items.length === 0 ? (
                <Stack alignItems="center" sx={{ py: 6, px: 3 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "text.secondary", textAlign: "center" }}>
                        {emptyText}
                    </Typography>
                </Stack>
            ) : (
                <Stack spacing={2} sx={{ pt: 2, pb: "calc(20px + env(safe-area-inset-bottom))" }}>
                    {groups.map((g) => (
                        <Stack key={`${g.dayIndex}-${g.dateLabel}`} spacing={0.5}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5 }}>
                                <Typography
                                    sx={{
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color: "text.primary",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    {g.dateLabel} {g.dayLabel}요일
                                </Typography>
                                <Box
                                    sx={{
                                        flex: 1,
                                        height: "1px",
                                        background: isDark ? "rgba(255,255,255,0.06)" : "var(--plando-divider)",
                                    }}
                                />
                            </Stack>
                            {g.items.map((t) => (
                                <BriefRow key={t.id} todo={t} isDark={isDark} />
                            ))}
                        </Stack>
                    ))}
                </Stack>
            )}
        </Sheet>
    );
}

function StatusChip({ status, isDark }) {
    let label, bg, color, icon = null;
    if (status === "DONE") {
        label = "완료";
        bg = "var(--plando-green-soft)";
        color = "var(--plando-green)";
        icon = <CheckRoundedIcon sx={{ fontSize: 11 }} />;
    } else if (status === "IN_PROGRESS") {
        label = "진행 중";
        bg = "var(--plando-orange-soft)";
        color = "var(--plando-orange)";
    } else {
        label = "예정";
        bg = "var(--plando-gray-soft)";
        color = isDark ? "rgba(255,255,255,0.55)" : "var(--plando-text-secondary)";
    }
    return (
        <Stack
            direction="row"
            alignItems="center"
            spacing={0.25}
            sx={{
                display: "inline-flex",
                background: bg,
                color,
                padding: "3px 8px 3px 6px",
                borderRadius: 999,
            }}
        >
            {icon}
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1 }}>
                {label}
            </Typography>
        </Stack>
    );
}

function BriefRow({ todo, isDark }) {
    const t = todo;
    const isDone = t.status === "DONE";
    const timeMain = t.startTime || "종일";
    const timeSub = t.startTime && t.endTime ? t.endTime : null;

    return (
        <Stack
            direction="row"
            alignItems="flex-start"
            spacing={1.75}
            sx={{ px: 2.5, py: 1.25, opacity: isDone ? 0.62 : 1 }}
        >
            <Stack
                spacing={0}
                sx={{
                    width: 50,
                    flexShrink: 0,
                    pt: 0.25,
                }}
            >
                <Typography
                    sx={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: t.startTime ? "var(--plando-primary)" : "text.secondary",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.1,
                    }}
                >
                    {timeMain}
                </Typography>
                {timeSub ? (
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", lineHeight: 1.4 }}>
                        ~ {timeSub}
                    </Typography>
                ) : null}
            </Stack>

            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "text.primary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.015em",
                    }}
                >
                    {t.title}
                </Typography>
                {(t.locationName || (t.assigneeNames && t.assigneeNames.length > 0)) ? (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: "wrap" }}>
                        {t.locationName ? (
                            <Stack direction="row" alignItems="center" spacing={0.25}>
                                <PlaceRoundedIcon sx={{ fontSize: 12, color: "var(--plando-green)" }} />
                                <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "var(--plando-green)" }}>
                                    {t.locationName}
                                </Typography>
                            </Stack>
                        ) : null}
                        {t.assigneeNames && t.assigneeNames.length > 0 ? (
                            <Typography
                                sx={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: isDark ? "rgba(255,255,255,0.42)" : "var(--plando-text-tertiary)",
                                }}
                            >
                                {t.assigneeNames.slice(0, 3).join(", ")}
                                {t.assigneeNames.length > 3 ? ` 외 ${t.assigneeNames.length - 3}명` : ""}
                            </Typography>
                        ) : null}
                    </Stack>
                ) : null}
            </Stack>

            <Box sx={{ flexShrink: 0, pt: 0.25 }}>
                <StatusChip status={t.status} isDark={isDark} />
            </Box>
        </Stack>
    );
}
