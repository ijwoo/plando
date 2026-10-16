import React, { useState } from "react";
import { Box, CircularProgress, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import DashboardMobile from "./DashboardMobile.jsx";
import useDashboardData from "../hooks/useDashboardData.jsx";
import { addTodo } from "../../todo/api/todoApi.js";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";
import { toast } from "../../../shared/utils/toast.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import AddTodoModal from "../../todo/components/form/AddTodoModal.jsx";
import { getUser } from "../../../shared/utils/tokenUtils.js";

import DesktopGreeting from "../components/desktop/DesktopGreeting.jsx";
import OverviewDashboard from "../overview/OverviewDashboard.jsx";

/**
 * 데스크탑 대시보드 — ClickUp Overview식 커스텀 카드 허브.
 * 상단 인사(DesktopGreeting) + 카드 그리드(OverviewDashboard: 추가/제거/드래그 순서변경, localStorage 저장).
 * 기존 통계 컴포넌트(포커스/완료율/팀)는 추가 가능한 카드로 흡수.
 */
export default function DashboardPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const user = getUser();

    const {
        allTasks,
        recentActivity,
        userImageMap,
        overdueTasks,
        todayTodos,
        presenceMap,
        isLoading,
        openTaskDetail,
        refreshDashboard,
        weeklyCompletionRate,
        weeklyDelta,
        weeklyBarData,
        todayDueCount,
        todayInProgressCount,
        memberStats,
    } = useDashboardData();

    const userName = user?.name ?? user?.nickname ?? user?.username ?? "";

    const [openAdd, setOpenAdd] = useState(false);
    const [newTask, setNewTask] = useState({ title: "", content: "", priority: "MEDIUM" });
    const { activeProjectId } = useActiveProject();

    const handleAdd = async () => {
        if (!newTask.title.trim()) return null;
        try {
            // 소속: 폼 선택값(projectScope) > 현재 스코프 > 인박스(null) — payload projectId로 전송
            const { projectScope, ...payload } = newTask;
            const scope = projectScope ?? (typeof activeProjectId === "number" ? activeProjectId : "inbox");
            const { data } = await addTodo({ ...payload, projectId: scope === "inbox" ? null : scope });
            setOpenAdd(false);
            setNewTask({ title: "", content: "", priority: "MEDIUM" });
            toast.success("작업이 추가됐어요.");
            await refreshDashboard();
            return data?.id ?? null;
        } catch (e) {
            toast.error(getApiError(e, "작업 추가 중 오류가 발생했어요."));
            return null;
        }
    };

    if (isMobile) return <DashboardMobile />;

    if (isLoading && allTasks.length === 0) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: "100%",
                bgcolor: "background.default",
                px: { xs: 1.5, md: 2 },
                py: 2,
            }}
        >
            <DesktopGreeting
                userName={userName}
                todayDueCount={todayDueCount}
                todayInProgressCount={todayInProgressCount}
            />

            <OverviewDashboard
                onAddTask={() => setOpenAdd(true)}
                data={{
                    allTasks, recentActivity, userImageMap, presenceMap,
                    overdueTasks, todayTodos, openTaskDetail,
                    weeklyCompletionRate, weeklyDelta, weeklyBarData, memberStats,
                }}
            />

            <AddTodoModal
                open={openAdd}
                onClose={() => setOpenAdd(false)}
                task={newTask}
                setTask={setNewTask}
                onSave={handleAdd}
            />
        </Box>
    );
}
