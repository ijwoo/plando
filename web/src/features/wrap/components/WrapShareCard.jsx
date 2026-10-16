import React, { forwardRef } from "react";
import { Box, Stack, Typography } from "@mui/material";

/**
 * 공유용 인스타 피드 카드 (1080×1350, 4:5).
 * Refined Light 톤 — 옅은 회색 배경 + 그리드 패턴 + 흰 미니 카드 + 검은 AI 카드.
 */
const COL = {
    text1: "#191F28",
    text2: "#4E5968",
    text3: "#8B95A1",
    line: "#E4E8EF",
    bg: "#F4F7FB",
    panel: "#FFFFFF",
    primary: "#3182F6",
    primarySoft: "#E8F2FF",
    primaryLight: "#7FB2FF",
    green: "#15C47E",
    aiBg: "#191F28",
    aiMessage: "#E6EBF2",
};

// iPhone 앱과 같은 라벨. id는 백엔드 값이므로 그대로 둔다.
const PERSONA_LABEL = {
    analyst: "분석",
    cheer:   "응원",
    cynical: "조언",
    brutal:  "직설",
};

const WrapShareCard = forwardRef(function WrapShareCard({ data }, ref) {
    if (!data) return null;

    const totalDelta = (data.totalCount || 0) - (data.prevWeekTotalCount || 0);
    const personaLabel = PERSONA_LABEL[data.aiPersona] || "AI";

    // 집중 리듬 — collabRatio 기반
    const collab = data.collabRatio;
    const rhythm = (() => {
        if (!collab) return null;
        const total = (collab.primary || 0) + (collab.secondary || 0);
        if (total === 0) return null;
        const collabPct = collab.primary / total;
        if (collabPct >= 0.6) return "협업형";
        if (collabPct <= 0.4) return "단독형";
        return "균형형";
    })();

    // 4개 미니 카드 데이터 — 데이터 있는 것만 (최대 4개)
    const miniCards = [];
    if (data.busiestDay && data.busiestDay.count > 0) {
        miniCards.push({
            label: "🏆 가장 바쁜 날",
            value: data.busiestDay.label,
            sub: `${data.busiestDay.count}개`,
        });
    }
    if (data.topPlace?.name) {
        miniCards.push({
            label: "🏕️ 베이스캠프",
            value: data.topPlace.name,
            sub: `${data.topPlace.count}번`,
        });
    } else if (data.topPeople?.[0]) {
        miniCards.push({
            label: "🥇 함께한 사람",
            value: data.topPeople[0].name,
            sub: `${data.topPeople[0].count}회`,
        });
    }
    if (data.meetingMinutes > 0) {
        miniCards.push({
            label: "⏱ 총 일정 시간",
            value: formatHoursShort(data.meetingMinutes),
            sub: data.meetingMinutes >= 60 ? "시간" : "분",
            sameLine: true,
        });
    }
    if (rhythm) {
        miniCards.push({
            label: "🌙 집중 리듬",
            value: rhythm,
        });
    } else if (data.pastDoneCount > 0) {
        miniCards.push({
            label: "✓ 마무리",
            value: String(data.pastDoneCount),
            sub: "건",
            sameLine: true,
        });
    }

    return (
        <Box
            ref={ref}
            sx={{
                width: 1080,
                height: 1350,
                background: COL.bg,
                color: COL.text1,
                fontFamily: "var(--plando-font)",
                position: "relative",
                overflow: "hidden",
                padding: "84px 78px 72px",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* 옅은 그리드 패턴 — 상단만 (mask 그라데) */}
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0.6,
                    backgroundImage:
                        "linear-gradient(rgba(49,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(49,130,246,0.06) 1px, transparent 1px)",
                    backgroundSize: "84px 84px",
                    WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent 65%)",
                    maskImage: "linear-gradient(180deg, #000 0%, transparent 65%)",
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />

            {/* 1. 헤더 */}
            <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                sx={{ position: "relative", zIndex: 1 }}
            >
                <Stack direction="row" alignItems="baseline" spacing={1.5}>
                    <Typography
                        sx={{
                            fontSize: 42,
                            fontWeight: 900,
                            color: COL.primary,
                            letterSpacing: "-0.02em",
                            lineHeight: 1,
                        }}
                    >
                        Plan Do!
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 30,
                            fontWeight: 700,
                            color: COL.text3,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        · 주간 요약
                    </Typography>
                </Stack>
                <Stack alignItems="flex-end" spacing={0.5}>
                    <Typography sx={{ fontSize: 28, fontWeight: 700, color: COL.text3, letterSpacing: "-0.01em" }}>
                        {data.rangeLabel}
                    </Typography>
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: COL.text3 }}>
                        {data.month}월 {data.weekIndex}주차
                    </Typography>
                </Stack>
            </Stack>

            {/* 2. 큰 헤더 카피 */}
            <Typography
                sx={{
                    fontSize: 60,
                    fontWeight: 800,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.25,
                    color: COL.text1,
                    mt: "48px",
                    position: "relative",
                    zIndex: 1,
                }}
            >
                {data.userName ? `${data.userName}님, ` : ""}이번 주
                <br />
                <Box component="span" sx={{ color: COL.primary }}>
                    {data.totalCount}개
                </Box>
                의 일정을 보냈어요
            </Typography>

            {/* 3. 큰 숫자 + delta */}
            <Stack
                direction="row"
                alignItems="flex-end"
                spacing={3}
                sx={{ mt: "44px", position: "relative", zIndex: 1 }}
            >
                <Stack direction="row" alignItems="baseline" spacing={1}>
                    <Typography
                        sx={{
                            fontSize: 220,
                            fontWeight: 900,
                            letterSpacing: "-0.055em",
                            lineHeight: 0.85,
                            color: COL.text1,
                        }}
                    >
                        {data.totalCount}
                    </Typography>
                    <Typography sx={{ fontSize: 58, fontWeight: 800, color: COL.text3 }}>개</Typography>
                </Stack>
                {totalDelta !== 0 ? (
                    <Typography
                        sx={{
                            fontSize: 26,
                            fontWeight: 800,
                            color: totalDelta > 0 ? COL.green : COL.text3,
                            mb: "20px",
                        }}
                    >
                        {totalDelta > 0 ? "▲" : "▼"} 지난주 {totalDelta > 0 ? "+" : ""}{totalDelta}
                    </Typography>
                ) : null}
            </Stack>

            {/* 4. 미니 카드 2x2 */}
            {miniCards.length > 0 ? (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "20px",
                        mt: "44px",
                        position: "relative",
                        zIndex: 1,
                    }}
                >
                    {miniCards.slice(0, 4).map((m, i) => (
                        <Box
                            key={i}
                            sx={{
                                background: COL.panel,
                                borderRadius: "24px",
                                padding: "26px 28px",
                                boxShadow: "0 2px 6px rgba(15,23,42,0.04)",
                                minHeight: 140,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    color: COL.text3,
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {m.label}
                            </Typography>
                            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: "12px" }}>
                                <Typography
                                    sx={{
                                        fontSize: 34,
                                        fontWeight: 800,
                                        letterSpacing: "-0.025em",
                                        color: COL.text1,
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {m.value}
                                </Typography>
                                {m.sub ? (
                                    <Typography sx={{ fontSize: 22, fontWeight: 700, color: COL.text3 }}>
                                        {m.sub}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </Box>
                    ))}
                </Box>
            ) : null}

            <Box sx={{ flex: 1 }} />

            {/* 5. AI 한마디 — 검은 카드 */}
            {data.aiComment ? (
                <Box
                    sx={{
                        background: COL.aiBg,
                        borderRadius: "28px",
                        padding: "34px 38px",
                        mt: "36px",
                        position: "relative",
                        zIndex: 1,
                        boxShadow: "0 12px 32px rgba(25,31,40,0.22)",
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: COL.primaryLight,
                            letterSpacing: "0.01em",
                            mb: "14px",
                        }}
                    >
                        {/* 라벨이 짧아져서 "분석의 한마디"는 어색하다 — 톤은 뒤에 덧붙인다. */}
                        ✦ AI 한마디 · {personaLabel}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 30,
                            fontWeight: 600,
                            lineHeight: 1.5,
                            letterSpacing: "-0.01em",
                            color: COL.aiMessage,
                        }}
                    >
                        {data.aiComment}
                    </Typography>
                </Box>
            ) : null}
        </Box>
    );
});

function formatHoursShort(min) {
    if (min < 60) return String(min);
    return String(Math.round(min / 60));
}

export default WrapShareCard;
