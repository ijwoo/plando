import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";

import { getGlassSx, getMobilePageBg } from "../../../shared/ui/glassSx.js";
import { FADE_IN } from "../../../shared/ui/primitives/motion.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { markWrapViewed } from "../utils/wrapView.js";
import { getWeeklyWrap } from "../api/wrapApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";

import WrapWeekdayBars from "../components/WrapWeekdayBars.jsx";
import WrapStatRow from "../components/WrapStatRow.jsx";
import WrapCompletionPill from "../components/WrapCompletionPill.jsx";
import WrapAiCard from "../components/WrapAiCard.jsx";
import WrapTrendChip from "../components/WrapTrendChip.jsx";
import WrapNextActions from "../components/WrapNextActions.jsx";
import WrapShareSheet from "../components/WrapShareSheet.jsx";
import WrapTimeBuckets from "../components/WrapTimeBuckets.jsx";
import WrapTopPeopleList from "../components/WrapTopPeopleList.jsx";
import WrapMilestones from "../components/WrapMilestones.jsx";
import WrapActivityHeatmap from "../components/WrapActivityHeatmap.jsx";
import WrapQuickStats from "../components/WrapQuickStats.jsx";
import WrapDetailSheet from "../components/WrapDetailSheet.jsx";
import WrapStatusBreakdown from "../components/WrapStatusBreakdown.jsx";
import WrapPriorityBreakdown from "../components/WrapPriorityBreakdown.jsx";
import WrapTopPlacesList from "../components/WrapTopPlacesList.jsx";
import WrapRatioDual from "../components/WrapRatioDual.jsx";
import WrapNotableTodos from "../components/WrapNotableTodos.jsx";
import WrapNextWeekPreview from "../components/WrapNextWeekPreview.jsx";
import WrapKeywords from "../components/WrapKeywords.jsx";
import WrapSelfMemo from "../components/WrapSelfMemo.jsx";
import WrapMiniMap from "../components/WrapMiniMap.jsx";

import { Stack as MuiStack } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

function SectionLabel({ children, isDark, onAction }) {
    return (
        <MuiStack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
        >
            <Typography
                sx={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    color: isDark
                        ? "rgba(255,255,255,0.42)"
                        : "var(--plando-text-tertiary)",
                }}
            >
                {children}
            </Typography>
            {onAction ? (
                <Press
                    as="span"
                    onClick={onAction}
                    haptic="light"
                    pressScale={0.95}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                        padding: "2px 4px",
                        borderRadius: 8,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--plando-primary)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        자세히
                    </Typography>
                    <ChevronRightRoundedIcon
                        sx={{ fontSize: 14, color: "var(--plando-primary)" }}
                    />
                </Press>
            ) : null}
        </MuiStack>
    );
}

export default function WeeklyWrapMobile() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();
    const weekStartParam = searchParams.get("weekStart");

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryTick, setRetryTick] = useState(0);
    const [shareOpen, setShareOpen] = useState(false);
    const [detail, setDetail] = useState({ open: false, title: "", subtitle: "", filterFn: null });

    const openDetail = (title, subtitle, filterFn) => {
        setDetail({ open: true, title, subtitle, filterFn });
    };
    const closeDetail = () => setDetail((d) => ({ ...d, open: false }));

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getWeeklyWrap(weekStartParam || null)
            .then((res) => {
                if (cancelled) return;
                setData(res.data);
                // 진입 카드 사라짐 처리 — 이 주차의 회고를 한 번 본 것으로 기록
                if (res.data?.weekStart) markWrapViewed(res.data.weekStart);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(getApiError(e, "회고 카드를 불러오지 못했어요."));
                toast.error(getApiError(e, "회고 카드를 불러오지 못했어요."));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [weekStartParam, retryTick]);

    const refreshAiComment = async () => {
        try {
            const res = await getWeeklyWrap(weekStartParam || null, true, data?.aiPersona);
            setData(res.data);
        } catch (e) {
            toast.error(getApiError(e, "AI 한마디를 다시 생성하지 못했어요."));
        }
    };

    const changePersona = async (personaId) => {
        try {
            const res = await getWeeklyWrap(weekStartParam || null, false, personaId);
            setData(res.data);
        } catch (e) {
            toast.error(getApiError(e, "페르소나를 바꾸지 못했어요."));
        }
    };

    // 로딩 실패 — 뒤로가기 헤더 + 재시도 버튼 (스피너에 갇히지 않도록)
    if (!loading && !data && error) {
        return (
            <Box sx={{ minHeight: "100vh", background: getMobilePageBg(theme) }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    sx={{ px: 1.5, py: 1.25 }}
                >
                    <Press
                        as="span"
                        onClick={() => navigate(-1)}
                        haptic="light"
                        pressScale={0.9}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            borderRadius: 999,
                        }}
                    >
                        <ArrowBackRoundedIcon
                            sx={{
                                fontSize: 22,
                                color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            }}
                        />
                    </Press>
                </Stack>
                <Stack alignItems="center" spacing={2} sx={{ px: 3, pt: "26vh" }}>
                    <Typography
                        sx={{
                            fontSize: 14.5,
                            fontWeight: 600,
                            textAlign: "center",
                            color: isDark ? "rgba(255,255,255,0.7)" : "var(--plando-text-secondary)",
                        }}
                    >
                        {error}
                    </Typography>
                    <Press
                        as="span"
                        onClick={() => setRetryTick((t) => t + 1)}
                        haptic="light"
                        pressScale={0.96}
                        style={{ display: "inline-flex" }}
                    >
                        <Box
                            sx={{
                                px: 2.5,
                                py: 1,
                                borderRadius: 999,
                                background: "var(--plando-primary)",
                                color: "#fff",
                                fontSize: 14,
                                fontWeight: 700,
                                letterSpacing: "-0.01em",
                            }}
                        >
                            재시도
                        </Box>
                    </Press>
                </Stack>
            </Box>
        );
    }

    if (loading || !data) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    background: getMobilePageBg(theme),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    const totalDelta = data.totalCount - data.prevWeekTotalCount;
    const rateDelta = data.completionRate - data.prevWeekCompletionRate;

    // 섹션 표시 여부 — 데이터가 있을 때만 카드에 노출.
    const hasWeekday = (data.weekdayCounts || []).some((c) => c > 0);
    const tb = data.timeBuckets || {};
    const hasTimeBuckets = (tb.dawn || 0) + (tb.morning || 0) + (tb.afternoon || 0) + (tb.evening || 0) > 0;
    const hasHeatmap = (data.activityHeatmap || []).some((row) => row.some((c) => c > 0));
    const qs = data.quickStats || {};
    const hasQuickStats = !!(qs.earliestStart || qs.latestEnd || qs.longestTodo || (qs.dailyAverage > 0));
    const hasTopPeople = (data.topPeople || []).length > 0;
    const hasTopPlaces = (data.topPlaces || []).length > 0;
    const hasBusiest = data.busiestDay && data.busiestDay.count > 0;
    const hasMeetingMin = data.meetingMinutes > 0;
    const hasBest = hasBusiest || hasMeetingMin;
    const hasMilestones = (data.milestones || []).length > 0;
    const hasAi = !!data.aiComment;

    const sb = data.statusBreakdown || {};
    const hasStatus = (sb.todo || 0) + (sb.inProgress || 0) + (sb.done || 0) > 0;
    const pb = data.priorityBreakdown || {};
    const hasPriority = (pb.high || 0) + (pb.medium || 0) + (pb.low || 0) > 0;

    const nt = data.notableTodos || {};
    const hasNotable = !!(nt.firstOfWeek || nt.lastOfWeek || nt.longest);

    const cr = data.collabRatio;
    const tr = data.timedRatio;
    const hasRatios = !!(cr && tr) && (
        ((cr.primary || 0) + (cr.secondary || 0) > 0) || ((tr.primary || 0) + (tr.secondary || 0) > 0)
    );

    const hasKeywords = (data.keywords || []).length > 0;
    const hasNextWeek = !!data.nextWeekPreview;

    const todosWithCoords = (data.weekTodos || []).filter((t) => t.locationLat && t.locationLng);
    const hasMap = todosWithCoords.length > 0;


    return (
        <Box
            component={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={FADE_IN}
            sx={{
                minHeight: "100vh",
                background: getMobilePageBg(theme),
                pb: "calc(100px + env(safe-area-inset-bottom))",
            }}
        >
            {/* 상단 헤더 */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                    px: 1.5,
                    py: 1.25,
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    background: isDark
                        ? "rgba(15, 23, 42, 0.55)"
                        : "rgba(240, 242, 245, 0.55)",
                }}
            >
                <Press
                    as="span"
                    onClick={() => navigate(-1)}
                    haptic="light"
                    pressScale={0.9}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                    }}
                >
                    <ArrowBackRoundedIcon
                        sx={{
                            fontSize: 22,
                            color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                        }}
                    />
                </Press>

                <Press
                    as="span"
                    onClick={() => navigate("/wrap/history")}
                    haptic="light"
                    pressScale={0.9}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                    }}
                >
                    <HistoryRoundedIcon
                        sx={{
                            fontSize: 22,
                            color: isDark
                                ? "rgba(255,255,255,0.6)"
                                : "var(--plando-text-secondary)",
                        }}
                    />
                </Press>
            </Stack>

            <Stack sx={{ px: 2.5, pt: 1.5 }}>
                {/* 타이틀 */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                    <Stack spacing={0.75} sx={{ mb: 3 }}>
                        <Typography
                            sx={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: isDark
                                    ? "rgba(255,255,255,0.5)"
                                    : "var(--plando-text-tertiary)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {data.rangeLabel} · 지난 주 회고
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: 26,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                                lineHeight: 1.32,
                                color: isDark ? "#F8FAFC" : "var(--plando-text-primary)",
                            }}
                        >
                            {data.userName}님, 지난 주
                            <br />
                            일정{" "}
                            <Box component="span" sx={{ color: "var(--plando-primary)" }}>
                                {data.totalCount}개
                            </Box>
                            를 함께했어요
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: isDark ? "rgba(255,255,255,0.7)" : "var(--plando-text-secondary)",
                                }}
                            >
                                ✓ 마무리 {data.doneCount}건
                            </Typography>
                            {totalDelta !== 0 ? (
                                <>
                                    <Box
                                        sx={{
                                            width: 3,
                                            height: 3,
                                            borderRadius: "50%",
                                            background: isDark ? "rgba(255,255,255,0.25)" : "var(--plando-text-tertiary)",
                                        }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: totalDelta > 0
                                                ? "var(--plando-primary)"
                                                : (isDark ? "rgba(255,255,255,0.55)" : "var(--plando-text-secondary)"),
                                        }}
                                    >
                                        지난주 대비 {totalDelta > 0 ? "+" : ""}{totalDelta}개
                                    </Typography>
                                </>
                            ) : null}
                        </Stack>
                    </Stack>
                </motion.div>

                {/* 메인 카드 — 한 카드에 모든 통계 */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
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
                        <CardContent sx={{ p: 2.75, "&:last-child": { pb: 2.75 } }}>
                        <Stack spacing={3.5}>
                            {/* (1) 헤드 — 소화율 박스 */}
                            <WrapCompletionPill
                                pastDone={data.pastDoneCount}
                                pastTotal={data.pastCount}
                                pastRate={data.pastCompletionRate}
                                totalAll={data.totalCount}
                            />

                            {/* (1.5) 상태 분포 */}
                            {hasStatus && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => openDetail(
                                            "이번 주 일정 전체",
                                            `${data.totalCount}개 · 상태별`,
                                            null
                                        )}
                                    >상태 분포</SectionLabel>
                                    <WrapStatusBreakdown data={data.statusBreakdown} />
                                </Stack>
                            )}

                            {/* (1.6) 우선순위 분포 */}
                            {hasPriority && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => openDetail(
                                            "우선순위 높은 일정",
                                            "HIGH 만 보기",
                                            (t) => t.priority === "HIGH"
                                        )}
                                    >우선순위 분포</SectionLabel>
                                    <WrapPriorityBreakdown data={data.priorityBreakdown} />
                                </Stack>
                            )}

                            {/* (2) 요일별 분포 */}
                            {hasWeekday && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => openDetail(
                                            `${data.busiestDay.label} 일정`,
                                            `${data.busiestDay.count}개 일정`,
                                            (t) => t.dayIndex === data.busiestDay.dayIndex
                                        )}
                                    >요일별 분포</SectionLabel>
                                    <WrapWeekdayBars
                                        counts={data.weekdayCounts}
                                        highlightIndex={data.busiestDay.dayIndex}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: 12.5,
                                            fontWeight: 600,
                                            color: isDark
                                                ? "rgba(255,255,255,0.5)"
                                                : "var(--plando-text-tertiary)",
                                            mt: 1.5,
                                            textAlign: "center",
                                        }}
                                    >
                                        <Box component="span" sx={{ color: "var(--plando-primary)", fontWeight: 800 }}>
                                            {data.busiestDay.label}
                                        </Box>
                                        이 가장 바빴어요
                                    </Typography>
                                </Stack>
                            )}

                            {/* (3) 시간대별 분포 */}
                            {hasTimeBuckets && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => {
                                            const peakBucket = Object.entries(data.timeBuckets).sort((a, b) => b[1] - a[1])[0]?.[0];
                                            const labelMap = { morning: "오전", afternoon: "오후", evening: "저녁" };
                                            openDetail(
                                                `${labelMap[peakBucket] || ""} 일정`,
                                                "시간대 기준",
                                                (t) => t.bucket === peakBucket
                                            );
                                        }}
                                    >시간대별 분포</SectionLabel>
                                    <WrapTimeBuckets buckets={data.timeBuckets} />
                                </Stack>
                            )}

                            {/* (3.5) 활동 히트맵 — 시간대 × 요일 그리드 */}
                            {hasHeatmap && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => openDetail(
                                            "이번 주 일정 전체",
                                            `${data.totalCount}개 · 시간 순`,
                                            null
                                        )}
                                    >활동 히트맵</SectionLabel>
                                    <WrapActivityHeatmap grid={data.activityHeatmap} />
                                </Stack>
                            )}

                            {/* (3.6) 빠른 통계 — 2x2 */}
                            {hasQuickStats && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => openDetail(
                                            "이번 주 일정 전체",
                                            `${data.totalCount}개 · 시간 순`,
                                            null
                                        )}
                                    >이번 주 한눈에</SectionLabel>
                                    <WrapQuickStats stats={data.quickStats} />
                                </Stack>
                            )}

                            {/* (3.7) 비율 — 협업/단독, 시간정한/종일 */}
                            {hasRatios && (
                                <Stack>
                                    <SectionLabel isDark={isDark}>이번 주 비율</SectionLabel>
                                    <WrapRatioDual collab={data.collabRatio} timed={data.timedRatio} />
                                </Stack>
                            )}

                            {/* (4) 함께한 사람 TOP N */}
                            {hasTopPeople && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => {
                                            const top = data.topPeople?.[0];
                                            if (!top) return;
                                            openDetail(
                                                `${top.name}님과의 일정`,
                                                `${top.count}회 함께`,
                                                (t) => t.assigneeNames?.includes(top.name)
                                            );
                                        }}
                                    >함께한 사람 TOP {data.topPeople.length}</SectionLabel>
                                    <WrapTopPeopleList people={data.topPeople} />
                                </Stack>
                            )}

                            {/* (4.4) 이번 주 활동 지도 */}
                            {hasMap && (
                                <Stack>
                                    <SectionLabel isDark={isDark}>이번 주 활동 지도</SectionLabel>
                                    <WrapMiniMap todos={todosWithCoords} height={200} />
                                </Stack>
                            )}

                            {/* (4.5) 자주 간 곳 TOP N */}
                            {hasTopPlaces && (
                                <Stack>
                                    <SectionLabel
                                        isDark={isDark}
                                        onAction={() => {
                                            const top = data.topPlaces?.[0];
                                            if (!top) return;
                                            openDetail(
                                                `${top.name} 일정`,
                                                `${top.count}번 방문`,
                                                (t) => t.locationName === top.name
                                            );
                                        }}
                                    >자주 간 곳 TOP {data.topPlaces.length}</SectionLabel>
                                    <WrapTopPlacesList places={data.topPlaces} />
                                </Stack>
                            )}

                            {/* (6) 마일스톤 */}
                            {hasMilestones && (
                                <Stack>
                                    <SectionLabel isDark={isDark}>이번 주 마일스톤</SectionLabel>
                                    <WrapMilestones milestones={data.milestones} />
                                </Stack>
                            )}

                            {/* (7) 이번 주 특별한 순간 */}
                            {hasNotable && (
                                <Stack>
                                    <SectionLabel isDark={isDark}>이번 주 특별한 순간</SectionLabel>
                                    <WrapNotableTodos notable={data.notableTodos} />
                                </Stack>
                            )}

                            {/* (8) 이번 주 키워드 */}
                            {hasKeywords && (
                                <Stack>
                                    <SectionLabel isDark={isDark}>이번 주 키워드</SectionLabel>
                                    <WrapKeywords keywords={data.keywords} />
                                </Stack>
                            )}

                            {/* (9) 다음 주 미리보기 */}
                            {hasNextWeek && (
                                <Stack>
                                    <SectionLabel isDark={isDark}>다음 주 미리보기</SectionLabel>
                                    <WrapNextWeekPreview data={data.nextWeekPreview} />
                                </Stack>
                            )}
                        </Stack>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* 셀프 메모 (외부 카드 형태로) */}
                <Box sx={{ mt: 1.5 }}>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <WrapSelfMemo
                            content={data.selfMemo}
                            weekStart={weekStartParam || null}
                            onChange={(newContent) => setData((d) => ({ ...d, selfMemo: newContent }))}
                        />
                    </motion.div>
                </Box>

                {/* AI 한마디 카드 */}
                {hasAi && (
                    <Box sx={{ mt: 1.5 }}>
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <WrapAiCard
                                comment={data.aiComment}
                                persona={data.aiPersona}
                                onRefresh={refreshAiComment}
                                onPersonaChange={changePersona}
                            />
                        </motion.div>
                    </Box>
                )}

                {/* Next actions 카드 — 지난 회고/목표/알림 설정 */}
                <Box sx={{ mt: 1.5 }}>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <WrapNextActions />
                    </motion.div>
                </Box>

            </Stack>

            {/* 하단 고정 공유 버튼 */}
            <Box
                sx={{
                    position: "fixed",
                    left: 20,
                    right: 20,
                    bottom: "calc(20px + env(safe-area-inset-bottom))",
                    zIndex: 10,
                }}
            >
                <Press
                    as="div"
                    onClick={() => setShareOpen(true)}
                    haptic="medium"
                    pressScale={0.97}
                    style={{ display: "block", width: "100%" }}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="center"
                        spacing={1}
                        sx={{
                            background: "var(--plando-primary)",
                            color: "#fff",
                            borderRadius: "var(--plando-radius-md)",
                            padding: "18px 16px",
                            boxShadow: isDark
                                ? "0 8px 20px rgba(25,118,210,0.36)"
                                : "0 8px 20px rgba(25,118,210,0.24)",
                        }}
                    >
                        <IosShareRoundedIcon sx={{ fontSize: 19 }} />
                        <Typography
                            sx={{
                                fontSize: 15.5,
                                fontWeight: 800,
                                letterSpacing: "-0.015em",
                            }}
                        >
                            공유하기
                        </Typography>
                    </Stack>
                </Press>
            </Box>

            {/* 공유 bottom sheet */}
            <WrapShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                data={data}
            />

            {/* 자세히보기 sheet */}
            <WrapDetailSheet
                open={detail.open}
                onClose={closeDetail}
                title={detail.title}
                subtitle={detail.subtitle}
                todos={data.weekTodos}
                filterFn={detail.filterFn}
            />
        </Box>
    );
}
