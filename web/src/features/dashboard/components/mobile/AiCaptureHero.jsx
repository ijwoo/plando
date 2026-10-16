import React, { useState, useCallback } from "react";
import { Box, Card, CardContent, Stack, Typography, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
// eslint-disable-next-line no-unused-vars -- motion은 <motion.div>로 사용됨(린터가 namespaced JSX를 미탐지)
import { AnimatePresence, motion } from "framer-motion";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import { getGlassSx } from "../../../../shared/ui/glassSx.js";
import { callChat } from "../../../chat/api/chatApi.js";
import { addTodo } from "../../../todo/api/todoApi.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import { PriorityPill } from "../../../../shared/ui/common/Chips.jsx";
import Press from "../../../../shared/ui/primitives/Press.jsx";

function extractParsedTask(data) {
    const { actions = [] } = data;
    const created = actions.find((a) => a.type === "TASK_CREATED");
    if (!created?.payload?.task) return null;
    const t = created.payload.task;
    return {
        title: t.title || "",
        dueDate: t.dueDate || t.startAt || "",
        startAt: t.startAt || "",
        startTime: t.startTime || "",
        endTime: t.endTime || "",
        location: t.locationName || "",
        locationName: t.locationName || null,
        locationAddress: t.locationAddress || null,
        locationLat: t.locationLat ?? null,
        locationLng: t.locationLng ?? null,
        priority: t.priority || "MEDIUM",
        status: t.status || "TODO",
        assigneeId: t.assigneeId || "",
    };
}

function formatDateKr(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AiCaptureHero({ onTaskCreated }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;

    const [value, setValue] = useState("");
    const [focused, setFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [parsed, setParsed] = useState(null);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const hasValue = value.trim().length > 0;

    const handleSubmit = useCallback(async () => {
        const text = value.trim();
        if (!text || loading) return;

        setLoading(true);
        setError("");
        setParsed(null);

        try {
            const res = await callChat(text, {});
            const task = extractParsedTask(res.data);

            if (task) {
                const assignees = task.assigneeId
                    ? task.assigneeId.split(",").map((e) => e.trim()).filter(Boolean)
                    : [];

                await addTodo({
                    title: task.title,
                    content: "",
                    priority: task.priority,
                    status: task.status,
                    startAt: task.startAt || null,
                    dueDate: task.dueDate || null,
                    startTime: task.startTime || null,
                    endTime: task.endTime || null,
                    assignees,
                    locationName: task.locationName || task.location || null,
                    locationAddress: task.locationAddress || null,
                    locationLat: task.locationLat ?? null,
                    locationLng: task.locationLng ?? null,
                });

                // 결과 카드는 생성이 실제로 끝난 뒤에만 띄운다 — 파싱 직후 setParsed 하던 때는
                // addTodo가 403/500이어도 초록 "할 일이 생성됐어요" 카드가 그대로 남아, 아래 에러 문구와
                // 동시에 표시됐다(사용자는 생성된 줄 알고 떠남).
                setParsed(task);
                setDone(true);
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED));
                window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
                // 생성 결과 카드를 잠깐 보여준 뒤 자동으로 정리 — 입력창 다시 사용 가능 상태로 복귀.
                // (이전엔 카드가 영구히 떠 있어서 화면 새로고침 전까지 다음 입력 못함)
                setTimeout(() => {
                    onTaskCreated?.();
                    setParsed(null);
                    setDone(false);
                    setValue("");
                    setError("");
                }, 1500);
            } else {
                setError("할 일을 인식하지 못했어요. 다시 입력해주세요.");
            }
        } catch {
            setError("요청 중 오류가 발생했어요. 다시 시도해주세요.");
        } finally {
            setLoading(false);
        }
    }, [value, loading, onTaskCreated]);

    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                overflow: "visible",
                ...getGlassSx(theme),
                borderColor: "transparent",
            }}
        >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-label-size)",
                            fontWeight: "var(--plando-type-label-weight)",
                            color: "text.primary",
                        }}
                    >
                        AI로 빠르게 추가
                    </Typography>
                </Stack>

                {/* Input */}
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                        bgcolor: "var(--plando-surface-faint)",
                        border: `1.5px solid ${focused
                            ? alpha(primary, 0.5)
                            : isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)"}`,
                        borderRadius: "var(--plando-radius-md)",
                        px: 1.5, py: 1,
                        transition: `all var(--plando-dur-base) var(--plando-ease)`,
                        boxShadow: focused ? `0 0 0 3px ${alpha(primary, 0.10)}` : "none",
                    }}
                >
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
                        placeholder="예: 내일까지 보고서 작성"
                        disabled={loading || done}
                        maxLength={100}
                        sx={{
                            flex: 1, border: "none", background: "transparent",
                            fontSize: 14, fontFamily: "inherit", color: "text.primary",
                            outline: "none", fontWeight: 500, letterSpacing: "-0.01em",
                            "&::placeholder": { color: "text.disabled", fontWeight: 400 },
                            "&:disabled": { opacity: 0.6 },
                        }}
                    />
                    <Press
                        onClick={handleSubmit}
                        disabled={!hasValue || loading || done}
                        haptic={hasValue ? "medium" : false}
                        pressScale={0.92}
                        style={{
                            width: 30, height: 30, borderRadius: 10,
                            background: hasValue && !loading && !done ? primary : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            opacity: hasValue && !loading ? 1 : 0.5,
                            transition: "background 0.2s",
                        }}
                    >
                        {loading
                            ? <CircularProgress size={14} sx={{ color: "#fff" }} />
                            : <SendRoundedIcon sx={{ fontSize: 14, color: hasValue && !done ? "#fff" : "text.disabled" }} />
                        }
                    </Press>
                </Stack>

                {/* AI Parse Result */}
                <AnimatePresence>
                    {parsed && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        >
                            <Box sx={{
                                mt: 1.5, p: 1.75,
                                borderRadius: "var(--plando-radius-md)",
                                border: "1px solid",
                                ...getGlassSx(theme),
                            }}>
                                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                                    <CheckCircleRoundedIcon sx={{ fontSize: 15, color: "var(--plando-green)" }} />
                                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "var(--plando-green)" }}>
                                        할 일이 생성됐어요
                                    </Typography>
                                </Stack>

                                <Typography
                                    sx={{
                                        fontSize: "var(--plando-type-body-size)",
                                        fontWeight: "var(--plando-type-title3-weight)",
                                        mb: 1,
                                    }}
                                >
                                    {parsed.title}
                                </Typography>

                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                    {parsed.dueDate && (
                                        <Stack direction="row" spacing={0.35} alignItems="center">
                                            <ScheduleRoundedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                                            <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>
                                                {formatDateKr(parsed.dueDate)}
                                                {parsed.startTime && ` ${parsed.startTime}`}
                                                {parsed.endTime && `–${parsed.endTime}`}
                                            </Typography>
                                        </Stack>
                                    )}
                                    {parsed.location && (
                                        <Stack direction="row" spacing={0.35} alignItems="center">
                                            <LocationOnRoundedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                                            <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>
                                                {parsed.location}
                                            </Typography>
                                        </Stack>
                                    )}
                                    <PriorityPill priority={parsed.priority} />
                                </Stack>
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error */}
                {error && (
                    <Typography sx={{ fontSize: 12, color: "error.main", mt: 1, px: 0.5 }}>
                        {error}
                    </Typography>
                )}

                {/* Hint */}
                {!parsed && !loading && (
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-caption-size)",
                            color: "text.disabled", mt: 1.25, px: 0.25,
                        }}
                    >
                        날짜·장소·우선순위를 AI가 알아서 정리해드려요
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}
