import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { getGlassSx } from "../../../shared/ui/glassSx.js";
import { getWeeklyWrap } from "../api/wrapApi.js";
import { wasWrapViewed } from "../utils/wrapView.js";

/**
 * 대시보드 진입 카드.
 * 노출 조건:
 *  - 일요일 21시 이후 ~ 그 다음 일요일 20:59까지 (한 주)
 *  - 사용자가 회고 페이지 한 번 열면 사라짐 (localStorage)
 *  - 일정 0개면 안 보임
 */
export default function WeeklyWrapEntryCard() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();

    const [data, setData] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getWeeklyWrap()
            .then((res) => { if (!cancelled) setData(res.data); })
            .catch(() => { /* 진입 카드는 조용히 실패 — 대시보드 영향 없게 */ });
        return () => { cancelled = true; };
    }, []);

    if (!data) return null;
    if (data.totalCount === 0) return null;
    if (wasWrapViewed(data.weekStart || `${data.year}-${pad(data.month)}-w${data.weekIndex}`)) return null;

    const weekLabel = `${data.month}월 ${data.weekIndex}주차`;
    const totalCount = data.totalCount;
    const completionRate = data.pastCompletionRate ?? data.completionRate;

    const iconBoxBg = isDark
        ? "rgba(45,110,245,0.18)"
        : "var(--plando-primary-soft)";

    return (
        <Press
            as="div"
            onClick={() => navigate("/wrap")}
            haptic="light"
            pressScale={0.985}
            style={{ display: "block", width: "100%" }}
        >
            <Card
                elevation={0}
                sx={{
                    width: "100%",
                    borderRadius: "var(--plando-radius-card)",
                    boxShadow: "var(--plando-elev-1)",
                    ...getGlassSx(theme),
                    borderColor: "transparent",
                }}
            >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" spacing={1.75}>
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: "var(--plando-radius-sm)",
                                background: iconBoxBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <InsightsRoundedIcon
                                sx={{ fontSize: 22, color: "var(--plando-primary)" }}
                            />
                        </Box>

                        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                <Typography
                                    sx={{
                                        fontSize: "var(--plando-type-title3-size)",
                                        fontWeight: "var(--plando-type-title3-weight)",
                                        color: "text.primary",
                                        letterSpacing: "var(--plando-type-title3-ls)",
                                    }}
                                >
                                    지난 주 회고
                                </Typography>
                                <Box
                                    sx={{
                                        background: "var(--plando-primary-soft)",
                                        color: "var(--plando-primary)",
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: "2px 6px",
                                        borderRadius: 999,
                                        letterSpacing: "0.06em",
                                    }}
                                >
                                    NEW
                                </Box>
                            </Stack>
                            <Typography
                                sx={{
                                    fontSize: "var(--plando-type-caption-size)",
                                    fontWeight: "var(--plando-type-caption-weight)",
                                    color: "text.secondary",
                                }}
                            >
                                {weekLabel} · 일정 {totalCount}개 · 소화율 {completionRate}%
                            </Typography>
                        </Stack>

                        <ChevronRightRoundedIcon
                            sx={{
                                fontSize: 22,
                                color: "text.secondary",
                                flexShrink: 0,
                                opacity: 0.6,
                            }}
                        />
                    </Stack>
                </CardContent>
            </Card>
        </Press>
    );
}

function pad(n) { return String(n).padStart(2, "0"); }
