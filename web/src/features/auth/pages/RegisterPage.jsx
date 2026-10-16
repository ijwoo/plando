import React, { useMemo } from "react";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import { Box, Stack, Typography, useMediaQuery } from "@mui/material";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";

import { buildTheme } from "../../../shared/ui/theme.js";
import RegisterPageMobile from "./RegisterPageMobile.jsx";
import BrandMark from "../components/BrandMark.jsx";
import AuthVisualPanel from "../components/AuthVisualPanel.jsx";
import SignupFlow from "../components/SignupFlow.jsx";
import { AUTH_PAGE_BG_GLASS } from "../utils/pageBg.js";

// ── 상수 ───────────────────────────────────────────────────────────
const BLUE       = "#1976d2";
const BLUE_LIGHT = "#EFF6FF";

// 페이지 배경 — 데스크톱 LoginPage와 동일한 glass 레이어
const PAGE_BG = AUTH_PAGE_BG_GLASS;

const FEATURES = [
    {
        icon: <ViewKanbanRoundedIcon sx={{ fontSize: 17, color: BLUE }} />,
        title: "칸반 보드",
        desc: "할 일을 상태별로 한눈에 정리해요",
    },
    {
        icon: <GroupsRoundedIcon sx={{ fontSize: 17, color: BLUE }} />,
        title: "워크스페이스",
        desc: "팀원과 함께 작업을 공유할 수 있어요",
    },
    {
        icon: <CalendarMonthRoundedIcon sx={{ fontSize: 17, color: BLUE }} />,
        title: "캘린더",
        desc: "일정과 마감일을 달력으로 관리해요",
    },
];

// ── 왼쪽 브랜딩 패널 — 데스크톱 LoginPage의 glass 패널과 동일한 톤 ───

// ── 라우터 wrapper — 모바일/데스크톱 분기 ─────────────────────────
export default function RegisterPage() {
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
    return isMobile ? <RegisterPageMobile /> : <RegisterPageDesktop />;
}

/* ── 데스크톱 ────────────────────────────────────────────────────
   껍데기(glass 2단 카드 + 브랜딩 패널)만 담당하고, 단계 흐름은
   SignupFlow가 모바일/앱과 동일한 구조로 처리한다.
   method → account → workspace → verify(메일 확인 안내) */
function RegisterPageDesktop() {
    const lightTheme = useMemo(() => buildTheme("light"), []);

    /* 로그인과 같은 풀블리드 2분할. 예전엔 940px 글래스 카드였는데, 로그인만 바꿔 두니
       로그인 → 회원가입으로 넘어갈 때 화면 구조가 통째로 바뀌어 다른 서비스처럼 보였다.
       오른쪽 비주얼은 AuthVisualPanel 로 공용화해 두 화면이 같은 것을 보여준다. */
    return (
        <ThemeProvider theme={lightTheme}>
            <Box
                sx={{
                    height: "100dvh",
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1.2fr)" },
                    bgcolor: "#fff",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        overflowY: "auto",
                        px: { md: 5, lg: 8 },
                        pt: "calc(40px + env(safe-area-inset-top))",
                        pb: "calc(40px + env(safe-area-inset-bottom))",
                    }}
                >
                    {/* m:auto 로 가운데 정렬 — justifyContent:center 를 쓰면 내용이 화면보다
                        길어졌을 때 위쪽이 잘려 스크롤로도 닿지 못한다. */}
                    <Box sx={{ width: "100%", maxWidth: 400, m: "auto" }}>
                        <Box sx={{ mb: 3.5 }}>
                            <BrandMark size={34} />
                        </Box>
                        <SignupFlow />
                    </Box>
                </Box>

                <AuthVisualPanel />
            </Box>
        </ThemeProvider>
    );
}
