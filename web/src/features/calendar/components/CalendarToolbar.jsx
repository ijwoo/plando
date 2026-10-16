import React from "react";
import {
    Box,
    Button,
    Chip,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import ScopeFilterChip from "./ScopeFilterChip.jsx";
import { formatCalendarTitle } from "../utils/calendarUtils.js";
import SegmentedControl from "../../../shared/ui/common/SegmentedControl.jsx";
import HeaderActionButton from "../../../shared/ui/common/HeaderActionButton.jsx";

const VIEW_OPTIONS = [
    { value: "month", label: "월" },
    { value: "week", label: "주" },
    { value: "day", label: "일" },
    { value: "agenda", label: "목록" },
];

export default function CalendarToolbar({
    label,
    date,
    onNavigate,
    onView,
    view,
    isMobile = false,
    selectedDate,
    onAdd,
}) {
    // react-big-calendar가 넘겨주는 label은 현재 뷰의 실제 표시 범위다
    // (월 "2026년 7월" / 주 "2026년 7월 5일 – 11일" / 일 "2026년 7월 8일 (수)" / 목록 범위).
    // 전부 calendarUtils.getCalendarFormats에서 한국어로 조립되므로 그대로 쓴다.
    // 예전엔 date만 보고 항상 "YYYY년 M월"을 그려서, 주/일 뷰에서 제목이 보고 있는 범위와 어긋났다.
    const title = label || (date ? formatCalendarTitle(date) : "");
    const today = new Date();
    const checkDate = isMobile && selectedDate ? selectedDate : date;
    const isToday = checkDate
        ? (checkDate.getFullYear() === today.getFullYear() &&
           checkDate.getMonth() === today.getMonth() &&
           checkDate.getDate() === today.getDate())
        : false;

    if (isMobile) {
        return (
            <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, px: 1.5 }}>
                <IconButton
                    onClick={() => onNavigate("PREV")}
                    sx={{ width: 26, height: 26, border: "1px solid", borderColor: "primary.main", color: "primary.main" }}
                >
                    <ChevronLeftIcon sx={{ fontSize: 15 }} />
                </IconButton>

                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flex: 1, justifyContent: "center" }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 17, lineHeight: 1.2 }}>
                        {title}
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={() => onNavigate("TODAY")}
                        disabled={isToday}
                        sx={{ minWidth: 0, minHeight: 0, borderRadius: "8px", padding: "4px 10px", fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}
                    >
                        오늘
                    </Button>
                </Stack>

                <IconButton
                    onClick={() => onNavigate("NEXT")}
                    sx={{ width: 26, height: 26, border: "1px solid", borderColor: "primary.main", color: "primary.main" }}
                >
                    <ChevronRightIcon sx={{ fontSize: 15 }} />
                </IconButton>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", pb: 0.75, "&:empty": { display: "none" } }}>
                <ScopeFilterChip />
            </Box>
            </>
        );
    }

    const navBtnSx = (active) => ({
        height: 36,
        px: "12px",
        borderRadius: "10px",
        border: active ? "1px solid transparent" : "1px solid var(--plando-border)",
        bgcolor: active ? "var(--plando-primary-soft)" : "var(--plando-surface)",
        color: active ? "var(--plando-primary)" : "var(--plando-text-secondary)",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "-0.01em",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontFamily: "inherit",
        transition: "background 0.15s, border-color 0.15s",
        "&:hover": {
            bgcolor: active ? "var(--plando-primary-soft)" : "var(--plando-gray-soft)",
        },
    });

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", gap: "4px" }}>
                <Box component="button" onClick={() => onNavigate("PREV")} sx={navBtnSx(false)}>
                    <ChevronLeftIcon sx={{ fontSize: 16 }} />이전
                </Box>
                <Box component="button" onClick={() => onNavigate("TODAY")} sx={navBtnSx(isToday)}>
                    오늘
                </Box>
                <Box component="button" onClick={() => onNavigate("NEXT")} sx={navBtnSx(false)}>
                    다음<ChevronRightIcon sx={{ fontSize: 16 }} />
                </Box>
            </Box>

            <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em", mx: 0.5 }}>
                {title}
            </Typography>

            <ScopeFilterChip />

            <Box data-tour="calendar-view-switch">
                <SegmentedControl
                    options={VIEW_OPTIONS}
                    value={view}
                    onChange={(v) => onView(v)}
                    sx={{ height: 36 }}
                />
            </Box>

            <Box sx={{ flex: 1 }} />

            {onAdd && (
                <HeaderActionButton icon={<AddIcon sx={{ fontSize: 17 }} />} onClick={onAdd}>
                    새 일정
                </HeaderActionButton>
            )}
        </Box>
    );
}