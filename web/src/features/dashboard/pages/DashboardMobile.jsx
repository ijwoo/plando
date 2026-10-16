import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useTodayTick } from "../../../shared/hooks/useTodayTick.js";

import useDashboardData from "../hooks/useDashboardData.jsx";
import { updateTodoField } from "../../todo/api/todoApi.js";
import { doneTodoStatusKey, defaultTodoStatusKey } from "../../../shared/utils/todoStatus.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { getMe } from "../../../shared/api/userApi.js";
import { getMobilePageBg } from "../../../shared/ui/glassSx.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { usePageRefresh } from "../../../shared/hooks/usePageRefresh.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { FADE_IN } from "../../../shared/ui/primitives/motion.js";
import { getGreeting } from "../utils/dashboardUtils.js";

import SlideSection from "../components/mobile/SlideSection.jsx";
import TodaySummarySlide from "../components/mobile/TodaySummarySlide.jsx";
import WeeklyBarSlide from "../components/mobile/WeeklyBarSlide.jsx";
import DDaySlide from "../components/mobile/DDaySlide.jsx";
import EmptyHomeGuide from "../components/mobile/EmptyHomeGuide.jsx";
import AiCaptureHero from "../components/mobile/AiCaptureHero.jsx";
import WeeklyWrapEntryCard from "../../wrap/components/WeeklyWrapEntryCard.jsx";
import { MemberCard, MemberAverageCard } from "../components/mobile/MemberStatsCard.jsx";
import ActivityHeatmapCard from "../components/mobile/ActivityHeatmapCard.jsx";
import WeeklyTasksCard from "../components/WeeklyTasksCard.jsx";
import ActivityFeedCard from "../components/ActivityFeedCard.jsx";
import MiniCalendarAndScheduleCard from "../components/MiniCalendarAndScheduleCard.jsx";
import WorkspaceEditSheet from "../../workspace/components/WorkspaceEditSheet.jsx";
import WelcomeFlow from "../../onboarding/components/WelcomeFlow.jsx";
import useWelcomeFlow from "../../onboarding/hooks/useWelcomeFlow.js";

function SectionHeader({ title, actionLabel, onAction, children, sx }) {
    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 1, mb: 1.25, ...sx }}
        >
            <Typography
                sx={{
                    fontSize: "var(--plando-type-title3-size)",
                    fontWeight: "var(--plando-type-title3-weight)",
                    letterSpacing: "var(--plando-type-title3-ls)",
                }}
            >
                {title}
            </Typography>
            {children ?? (actionLabel && (
                <Press
                    as="span"
                    onClick={onAction}
                    haptic="light"
                    pressScale={0.95}
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--plando-primary)",
                        letterSpacing: "-0.01em",
                        padding: "4px 6px",
                        borderRadius: 8,
                    }}
                >
                    {actionLabel}
                </Press>
            ))}
        </Stack>
    );
}

/** 섹션 제목 아래 보조 설명 한 줄 (집계 기준 안내 등). */
function SectionCaption({ children }) {
    return (
        <Typography sx={{ px: 1, mb: 1.25, fontSize: 11, fontWeight: 500, color: "text.disabled", letterSpacing: "-0.01em" }}>
            {children}
        </Typography>
    );
}

function formatDateKr(date) {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${days[date.getDay()]}요일`;
}

export default function DashboardMobile() {
    // 자정을 넘겨도 상단 날짜가 어제로 남지 않게
    const todayTick = useTodayTick();
    const theme = useTheme();
    const navigate = useNavigate();

    const { showWelcome, completeWelcome } = useWelcomeFlow();
    const { currentWorkspace } = useWorkspace();
    const { statuses: statusDefs } = useStatuses();

    const {
        allTasks, recentActivity, userImageMap,
        overdueTasks, isLoading,
        openTaskDetail, refreshDashboard,
        // 파생 (useDashboardData에서 통합 제공)
        weeklyTasks, weeklyCompletionRate, weeklyDelta, weeklyBarData,
        todayDueCount, todayInProgressCount, todayDoneCount,
        dDayTasks, memberStats,
        isPeriodTaskDone,
    } = useDashboardData();

    usePageRefresh(refreshDashboard);

    const [userName, setUserName] = useState("");
    const [wsEditOpen, setWsEditOpen] = useState(false);

    useEffect(() => {
        getMe()
            .then(r => {
                setUserName(r.data?.name || r.data?.email?.split("@")[0] || "");
            })
            .catch(() => {});
    }, []);

    const workspaceImageUrl = currentWorkspace?.iconImageUrl || "";
    const workspaceMembers = memberStats;

    // 카드의 체크 표시는 isTodoDone(doneAt 우선)인데 토글만 status 문자열 비교였다 →
    // 커스텀 완료 상태("배포완료" 등) 항목은 눌러도 다시 완료로 PATCH돼 영영 해제되지 않고,
    // 그 과정에서 원래 상태 key가 기본값으로 덮어써졌다. 기록할 key도 워크스페이스 상태집합에서 조회한다.
    //
    // 여기 오는 task는 /dashboard/period-tasks 응답(PeriodTaskDto)이라 doneAt이 없다 —
    // isTodoDone만 쓰면 커스텀 완료 상태에서 위 증상이 그대로 재현되므로,
    // 카드의 체크 표시와 동일한 판정기(isPeriodTaskDone)를 쓴다.
    const handleCheckToggle = async (task) => {
        const next = isPeriodTaskDone(task) ? defaultTodoStatusKey(statusDefs) : doneTodoStatusKey(statusDefs);
        try {
            await updateTodoField(task.id, "status", next);
            await refreshDashboard();
        } catch (e) {
            toast.error(getApiError(e, "상태 변경에 실패했어요."));
        }
    };

    if (isLoading && allTasks.length === 0) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    const isEmpty = !isLoading && allTasks.length === 0;

    if (showWelcome) {
        return <WelcomeFlow onComplete={completeWelcome} />;
    }

    return (
        <Box
                component={motion.div}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={FADE_IN}
                sx={{ minHeight: "100%", background: getMobilePageBg(theme), pb: 2 }}
            >
                <Stack spacing={2.5} sx={{ pt: 2 }}>

                    {/*  오늘 현황 슬라이드 */}
                    <Box sx={{ px: 1 }}>
                        <SectionHeader title="오늘 현황" actionLabel="전체보기" onAction={() => navigate("/calendar")} />
                        <SlideSection>
                            <TodaySummarySlide
                                userName={userName}
                                greeting={getGreeting()}
                                dateStr={formatDateKr(todayTick)}
                                todayCount={todayDueCount}
                                inProgressCount={todayInProgressCount}
                                doneCount={todayDoneCount}
                            />
                            <WeeklyBarSlide
                                weeklyCompletionRate={weeklyCompletionRate}
                                weeklyDelta={weeklyDelta}
                                weeklyBarData={weeklyBarData}
                            />
                            <DDaySlide
                                tasks={dDayTasks}
                                overdueCount={overdueTasks.length}
                                onTaskClick={openTaskDetail}
                            />
                        </SlideSection>
                    </Box>

                    {/*  AI 태스크 추가 */}
                    <Box sx={{ px: 1 }}>
                        <AiCaptureHero onTaskCreated={refreshDashboard} />
                    </Box>

                    {/*  주간 회고 진입 (mock 데이터 기준 — 회고 미열람 주에만 노출 예정) */}
                    <Box sx={{ px: 1 }}>
                        <WeeklyWrapEntryCard />
                    </Box>

                    {isEmpty ? (
                        /* 빈 상태: 가이드 카드 */
                        <Box sx={{ px: 1 }}>
                            <EmptyHomeGuide />
                        </Box>
                    ) : (
                        /* 데이터가 있는 상태: 기존 섹션들 */
                        <>
                            {/*  미니 캘린더 */}
                            <Box sx={{ px: 1 }}>
                                <MiniCalendarAndScheduleCard
                                    allTasks={allTasks}
                                    onTaskClick={openTaskDetail}
                                    // "전체 보기"는 미니 캘린더에서 고른 날짜의 일정을 다 보겠다는 뜻인데
                                    // 날짜를 버리고 /calendar만 열어서 늘 오늘로 떨어졌다.
                                    // 사이드바 캘린더 패널과 같은 규약(state.date = ISO 문자열)으로 날짜를 넘긴다.
                                    onViewAll={(d) =>
                                        navigate("/calendar", { state: { date: (d ?? new Date()).toISOString() } })
                                    }
                                />
                            </Box>

                            {/*  이번 주 할 일 */}
                            <Box sx={{ px: 1 }}>
                                <SectionHeader
                                    title="이번 주 할 일"
                                    actionLabel="전체보기"
                                    onAction={() => navigate("/todos", { state: { initialTab: "week" } })}
                                    sx={{ mb: 0.25 }}
                                />
                                {/* 전체보기(할 일 > 이번 주)와 집계 기준이 달라 헷갈리지 않도록 명시 */}
                                <SectionCaption>이번 주 마감 기준 · 완료(보관) 포함</SectionCaption>
                                <WeeklyTasksCard
                                    tasks={weeklyTasks}
                                    onTaskClick={openTaskDetail}
                                    onCheckToggle={handleCheckToggle}
                                    isDone={isPeriodTaskDone}
                                    onViewAll={() => navigate("/todos", { state: { initialTab: "week" } })}
                                    hideHeader
                                />
                            </Box>

                            {/*  멤버 현황 슬라이드 */}
                            {memberStats.length > 0 && (
                                <Box sx={{ px: 1 }}>
                                    <SectionHeader title="멤버 현황" actionLabel="워크스페이스" onAction={() => setWsEditOpen(true)} sx={{ mb: 0.25 }} />
                                    {/* 목록과 집계 기준이 달라 헷갈리지 않도록 명시 */}
                                    <SectionCaption>이번 주 마감 기준 · 완료(보관) 포함</SectionCaption>
                                    <SlideSection cardHeight={160}>
                                        {memberStats.map((m, i) => (
                                            <MemberCard key={m.email} member={m} colorIdx={i} profileImageUrl={userImageMap[m.email]?.profileImageUrl} />
                                        ))}
                                        <MemberAverageCard
                                            members={workspaceMembers}
                                            workspaceImageUrl={workspaceImageUrl}
                                        />
                                    </SlideSection>
                                </Box>
                            )}

                            {/*  최근 업데이트 */}
                            <Box sx={{ px: 1 }}>
                                <SectionHeader title="최근 업데이트" />
                                <ActivityFeedCard
                                    activities={recentActivity}
                                    userImageMap={userImageMap}
                                    onTaskClick={openTaskDetail}
                                    hideHeader
                                />
                            </Box>
                        </>
                    )}
                </Stack>

                <WorkspaceEditSheet open={wsEditOpen} onClose={() => setWsEditOpen(false)} />
            </Box>
    );
}
