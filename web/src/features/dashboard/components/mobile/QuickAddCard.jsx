import React, { useState } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { getGlassSx } from "../../../../shared/ui/glassSx.js";
import Press from "../../../../shared/ui/primitives/Press.jsx";

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getTomorrowStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function OptionChip({ icon, label, selected, selectedColor, onClick, isDark }) {
    return (
        <Press
            onClick={onClick}
            haptic="light"
            pressScale={0.95}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 10px",
                borderRadius: 999,
                background: selected
                    ? alpha(selectedColor, isDark ? 0.20 : 0.10)
                    : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${selected
                    ? alpha(selectedColor, 0.30)
                    : isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)"}`,
                color: selected ? selectedColor : "inherit",
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
                transition: "background 0.18s, border-color 0.18s",
            }}
        >
            {icon}
            <span style={{ letterSpacing: "-0.01em" }}>{label}</span>
        </Press>
    );
}

/**
 * 빠른 태스크 추가. mock의 QuickAdd와 거의 동일 구조.
 * props 시그니처 동일 (onAdd, myEmail). 새 토큰 + Press 적용.
 */
export default function QuickAddCard({ onAdd, myEmail }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const danger = theme.palette.error.main;

    const [value, setValue] = useState("");
    const [priority, setPriority] = useState(null);
    const [date, setDate] = useState(null);
    const [assignToMe, setAssignToMe] = useState(false);
    const [focused, setFocused] = useState(false);

    const hasValue = value.trim().length > 0;

    const handleSubmit = async () => {
        if (!hasValue) return;
        await onAdd?.({
            title: value.trim(),
            content: "",
            priority: priority === "high" ? "HIGH" : "MEDIUM",
            status: "TODO",
            dueDate: date === "today" ? getTodayStr() : date === "tomorrow" ? getTomorrowStr() : null,
            assignees: assignToMe && myEmail ? [myEmail] : [],
        });
        setValue("");
        setPriority(null);
        setDate(null);
        setAssignToMe(false);
    };

    const iconSx = { fontSize: 11 };

    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                ...getGlassSx(theme),
                borderColor: "transparent",
            }}
        >
            <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                <Typography
                    sx={{
                        fontSize: "var(--plando-type-label-size)",
                        fontWeight: "var(--plando-type-label-weight)",
                        color: "text.secondary",
                        mb: 1.25,
                    }}
                >
                    빠른 태스크 추가
                </Typography>

                {/* Input row */}
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                        bgcolor: "var(--plando-surface-faint)",
                        border: `1.5px solid ${focused
                            ? alpha(primary, 0.5)
                            : isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)"}`,
                        borderRadius: "12px",
                        px: 1.5, py: 1,
                        transition: "all 0.22s",
                        boxShadow: focused
                            ? `0 0 0 3px ${alpha(primary, 0.10)}`
                            : "none",
                    }}
                >
                    <AddRoundedIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
                    <Box
                        component="input"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onKeyDown={(e) => {
                            // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복/조기 제출 방지
                            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                            if (e.key === "Enter") handleSubmit();
                        }}
                        placeholder="할 일을 입력하세요..."
                        maxLength={60}
                        sx={{
                            flex: 1,
                            border: "none",
                            background: "transparent",
                            fontSize: 14,
                            fontFamily: "inherit",
                            color: "text.primary",
                            outline: "none",
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                            "&::placeholder": {
                                color: "text.disabled",
                                fontWeight: 400,
                            },
                        }}
                    />
                    <Press
                        onClick={handleSubmit}
                        disabled={!hasValue}
                        haptic={hasValue ? "medium" : false}
                        pressScale={0.92}
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            background: hasValue ? primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            opacity: hasValue ? 1 : 0.5,
                            boxShadow: hasValue ? `0 2px 8px ${alpha(primary, 0.30)}` : "none",
                            transition: "background 0.2s, box-shadow 0.2s",
                        }}
                    >
                        <SendRoundedIcon sx={{ fontSize: 14, color: hasValue ? "#fff" : "text.disabled" }} />
                    </Press>
                </Stack>

                {/* Option chips */}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px", mt: 1.25 }}>
                    <OptionChip
                        icon={<FlagRoundedIcon sx={{ ...iconSx, color: priority === "high" ? danger : "text.disabled" }} />}
                        label="높음"
                        selected={priority === "high"}
                        selectedColor={danger}
                        onClick={() => setPriority((p) => (p === "high" ? null : "high"))}
                        isDark={isDark}
                    />
                    <OptionChip
                        icon={<FlagRoundedIcon sx={{ ...iconSx, color: priority === "mid" ? primary : "text.disabled" }} />}
                        label="중간"
                        selected={priority === "mid"}
                        selectedColor={primary}
                        onClick={() => setPriority((p) => (p === "mid" ? null : "mid"))}
                        isDark={isDark}
                    />
                    <OptionChip
                        icon={<CalendarTodayRoundedIcon sx={{ ...iconSx, color: date === "today" ? primary : "text.disabled" }} />}
                        label="오늘"
                        selected={date === "today"}
                        selectedColor={primary}
                        onClick={() => setDate((d) => (d === "today" ? null : "today"))}
                        isDark={isDark}
                    />
                    <OptionChip
                        icon={<CalendarTodayRoundedIcon sx={{ ...iconSx, color: date === "tomorrow" ? primary : "text.disabled" }} />}
                        label="내일"
                        selected={date === "tomorrow"}
                        selectedColor={primary}
                        onClick={() => setDate((d) => (d === "tomorrow" ? null : "tomorrow"))}
                        isDark={isDark}
                    />
                    <OptionChip
                        icon={<PersonRoundedIcon sx={{ ...iconSx, color: assignToMe ? primary : "text.disabled" }} />}
                        label="나에게"
                        selected={assignToMe}
                        selectedColor={primary}
                        onClick={() => setAssignToMe((v) => !v)}
                        isDark={isDark}
                    />
                </Box>
            </CardContent>
        </Card>
    );
}
