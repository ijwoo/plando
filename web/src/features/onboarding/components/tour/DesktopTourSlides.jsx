import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";
import { getTourTokens } from "./tourTokens.js";
import { useTourReduced } from "../../hooks/useTourMotion.jsx";
import {
    BoardMockup,
    AiParseMockup,
    CalendarMockup,
    MapMockup,
    CollabMockup,
} from "./TourMockups.jsx";

/* ─────────────────────────────────────────────────────────────
   데스크탑 전용 프로덕트 투어 슬라이드.

   ⚠️ 모바일(variant="fullscreen")은 이 파일을 쓰지 않는다. 모바일은 예전 3장
   (Brand / AIDemo / Permission)을 그대로 유지한다 — WelcomeFlow.jsx의 MOBILE_SLIDES.
   여기 있는 5장은 데스크탑 모달에서만 쓰이며, 브라우저 위치/알림 권한을 묻던
   PermissionSlide는 데스크탑 맥락에서 어색해 "지도 · 위치 알림" 기능 소개로 대체했다.

   각 슬라이드는 실제로 존재하는 기능만 광고한다.
   (보드/목록·커스텀 상태 · AI 빠른 추가 · 캘린더 월주일+드래그 · 카카오 지도+위치 트리거 ·
    워크스페이스/담당자/댓글·DM). 최근 제거된 체크리스트는 어디에도 등장하지 않는다.
   ───────────────────────────────────────────────────────────── */

const EASE = [0.2, 0.8, 0.2, 1];

/**
 * 슬라이드 공통 골격 — 카피 블록 높이를 고정해서 5장 사이에 목업 상단선이 흔들리지 않게 한다.
 * (제목은 전부 2줄, 설명 영역은 minHeight로 2줄 확보)
 */
function TourSlide({ eyebrow, title, desc, children }) {
    const theme = useTheme();
    const k = getTourTokens(theme);
    const reduced = useTourReduced();

    const rise = (delay) =>
        reduced
            ? {}
            : {
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.38, delay, ease: EASE },
            };

    return (
        <Box
            sx={{
                px: 4,
                pt: 1.25,
                pb: 1.5,
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box component={motion.div} {...rise(0)} sx={{ flexShrink: 0 }}>
                <Box
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.625,
                        px: 1.125,
                        py: 0.375,
                        mb: 1.25,
                        borderRadius: "var(--plando-radius-pill)",
                        bgcolor: k.accentSoft,
                    }}
                >
                    <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "primary.main" }} />
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "primary.main", letterSpacing: "-0.01em" }}>
                        {eyebrow}
                    </Typography>
                </Box>
            </Box>

            <Box component={motion.div} {...rise(0.05)} sx={{ flexShrink: 0 }}>
                <Typography
                    sx={{
                        fontSize: "var(--plando-type-title1-size)",
                        fontWeight: "var(--plando-type-title1-weight)",
                        lineHeight: "var(--plando-type-title1-lh)",
                        letterSpacing: "var(--plando-type-title1-ls)",
                        color: "text.primary",
                    }}
                >
                    {title}
                </Typography>
            </Box>

            <Box component={motion.div} {...rise(0.11)} sx={{ flexShrink: 0, minHeight: 48, mt: 0.875 }}>
                <Typography
                    sx={{
                        fontSize: "var(--plando-type-body-size)",
                        color: "text.secondary",
                        lineHeight: 1.55,
                    }}
                >
                    {desc}
                </Typography>
            </Box>

            {/* 목업 — 남는 높이를 전부 차지. 슬라이드마다 동일한 박스라 페이징 시 튀지 않는다. */}
            <Box
                component={motion.div}
                {...(reduced
                    ? {}
                    : {
                        initial: { opacity: 0, y: 14 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.45, delay: 0.16, ease: EASE },
                    })}
                sx={{ flex: 1, minHeight: 0, mt: 1.75 }}
            >
                {children}
            </Box>
        </Box>
    );
}

/* ── 5장 ─────────────────────────────────────────────────── */

export function BoardSlide() {
    return (
        <TourSlide
            eyebrow="Plan Do! 둘러보기"
            title={<>계획하고,<br />함께 해내는 곳</>}
            desc="보드에서 끌어다 놓으면 상태가 바뀌고, 목록으로는 전체를 훑어봐요. 상태는 팀에 맞게 직접 만들고요."
        >
            <BoardMockup />
        </TourSlide>
    );
}

export function AiSlide() {
    return (
        <TourSlide
            eyebrow="AI 빠른 추가"
            title={<>한 줄이면<br />할 일이 완성돼요</>}
            desc="제목·날짜·시간·장소·우선순위까지 알아서 채워 넣어요."
        >
            <AiParseMockup />
        </TourSlide>
    );
}

export function CalendarSlide() {
    return (
        <TourSlide
            eyebrow="캘린더"
            title={<>일정도<br />같은 자리에서</>}
            desc="월·주·일로 바꿔 보고, 드래그로 시간을 옮길 수 있어요."
        >
            <CalendarMockup />
        </TourSlide>
    );
}

export function MapSlide() {
    return (
        <TourSlide
            eyebrow="지도 · 위치 알림"
            title={<>장소를 정해두면<br />근처에서 알려드려요</>}
            desc="장소를 붙인 할 일은 지도에 모여요. 정해둔 반경에 들어오면 모바일 앱이 알려드려요."
        >
            <MapMockup />
        </TourSlide>
    );
}

export function CollabSlide() {
    return (
        <TourSlide
            eyebrow="함께 하기"
            title={<>혼자 말고,<br />팀이랑 같이</>}
            desc="워크스페이스로 나누고, 담당자를 지정하고, 댓글과 DM으로 바로 이야기해요."
        >
            <CollabMockup />
        </TourSlide>
    );
}

/* 슬라이드 "순서"와 단계별 CTA 라벨은 WelcomeFlow.jsx에 있다.
   (모바일 3장 세트와 나란히 둬서 variant별 분기를 한눈에 보이게) */
