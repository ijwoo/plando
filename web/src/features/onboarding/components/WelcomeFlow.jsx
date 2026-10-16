import React, { useState, useCallback } from "react";
import { Box, Typography, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { Z } from "../../../shared/ui/zIndex.js";
import { getGlassSx } from "../../../shared/ui/glassSx.js";
import { PriorityPill } from "../../../shared/ui/common/Chips.jsx";
import {
    BoardSlide,
    AiSlide,
    CalendarSlide,
    MapSlide,
    CollabSlide,
} from "./tour/DesktopTourSlides.jsx";
import { TourMotionProvider, useTourReduced, useTourMotionControl } from "../hooks/useTourMotion.jsx";

// 모바일(전체화면) 전용 CTA — 3장짜리 기존 플로우 그대로. 건드리지 말 것.
const MOBILE_CTAS = ["시작하기", "다음", "위치 · 알림 허용하기"];

// 데스크탑 모달 전용 제품 투어 5장. 모바일 세트와 완전히 별개다.
const DESKTOP_SLIDES = [BoardSlide, AiSlide, CalendarSlide, MapSlide, CollabSlide];
const DESKTOP_CTAS = ["둘러보기", "다음", "다음", "다음", "Plan Do! 시작하기"];

const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};
// prefers-reduced-motion: 가로 슬라이드 대신 페이드만.
const fadeVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
};
const slideTx = { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] };

function BrandSlide({ isDark }) {
    return (
        <Box sx={{ px: 3.5, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
            <Box
                component={motion.div}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                sx={{
                    width: 80, height: 80, borderRadius: "var(--plando-radius-lg)",
                    overflow: "hidden", mb: 4, flexShrink: 0,
                    boxShadow: "var(--plando-shadow-3)",
                }}
            >
                <Box
                    component="img"
                    src="/icon.png"
                    alt="Plan Do!"
                    sx={{ width: "100%", height: "100%", display: "block" }}
                />
            </Box>

            <Typography
                sx={{
                    fontFamily: '"Manrope", "Pretendard", sans-serif',
                    fontSize: 14, fontWeight: 800, letterSpacing: "-0.03em",
                    color: "text.primary", mb: 1.75,
                }}
            >
                Plan <Box component="span" sx={{ color: "primary.main" }}>Do!</Box>
            </Typography>
            <Typography
                sx={{
                    fontSize: "var(--plando-type-display-size)",
                    fontWeight: "var(--plando-type-display-weight)",
                    lineHeight: "var(--plando-type-display-lh)",
                    letterSpacing: "var(--plando-type-display-ls)",
                }}
            >
                계획하고,<br />함께 해내는 곳
            </Typography>
            <Typography
                sx={{
                    fontSize: "var(--plando-type-body-size)",
                    color: "text.secondary", lineHeight: 1.65, mt: 2, maxWidth: 250,
                }}
            >
                생각났을 때 한 줄.<br />나머지는 Plan Do!가 정리할게요.
            </Typography>
        </Box>
    );
}

function AIDemoSlide() {
    const theme = useTheme();
    return (
        <Box sx={{ px: 3.5, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
            <Typography
                sx={{
                    fontSize: "var(--plando-type-title1-size)",
                    fontWeight: "var(--plando-type-title1-weight)",
                    lineHeight: "var(--plando-type-title1-lh)",
                    letterSpacing: "var(--plando-type-title1-ls)",
                }}
            >
                한 줄이면<br />
                <Box component="span" sx={{ color: "primary.main" }}>할 일이 완성</Box>돼요
            </Typography>
            <Typography sx={{ fontSize: "var(--plando-type-body-size)", color: "text.secondary", lineHeight: 1.6, mb: 3.5, mt: 1 }}>
                날짜·장소·우선순위까지 알아서 정리해드려요.
            </Typography>

            <Box sx={{
                borderRadius: "var(--plando-radius-card)",
                border: "1px solid", p: "15px 16px",
                fontSize: 14, display: "flex", alignItems: "center", gap: "10px",
                boxShadow: "var(--plando-shadow-1)",
                ...getGlassSx(theme),
            }}>
                <span>✦</span> 내일 강남에서 거래처 미팅
            </Box>

            <Box
                component={motion.div}
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                sx={{ textAlign: "center", color: "text.disabled", fontSize: 20, my: 1.75 }}
            >
                ↓
            </Box>

            <Box sx={{
                borderRadius: "var(--plando-radius-card)", p: 2,
                borderLeft: "4px solid", borderLeftColor: "primary.main",
                boxShadow: "var(--plando-shadow-2)",
                ...getGlassSx(theme),
            }}>
                <Typography
                    sx={{
                        fontSize: "var(--plando-type-body-size)",
                        fontWeight: "var(--plando-type-title3-weight)",
                        mb: 1,
                    }}
                >
                    거래처 미팅
                </Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Stack direction="row" spacing={0.35} alignItems="center">
                        <ScheduleRoundedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>내일</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.35} alignItems="center">
                        <LocationOnRoundedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>강남</Typography>
                    </Stack>
                    <PriorityPill priority="HIGH" />
                </Stack>
            </Box>
        </Box>
    );
}

function PermissionSlide() {
    const theme = useTheme();
    const cards = [
        {
            Icon: LocationOnRoundedIcon,
            iconBg: "var(--plando-primary-soft)",
            iconColor: "primary.main",
            title: "위치",
            desc: "할 일에 등록한 장소 근처에 도착하면 알림을 보내드려요.",
        },
        {
            Icon: NotificationsActiveRoundedIcon,
            iconBg: "var(--plando-orange-soft)",
            iconColor: "var(--plando-orange)",
            title: "알림",
            desc: "마감과 위치 알림, 팀원이 보낸 메시지를 놓치지 않게.",
        },
    ];

    return (
        <Box sx={{ px: 3.5, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
            <Typography
                sx={{
                    fontSize: "var(--plando-type-title1-size)",
                    fontWeight: "var(--plando-type-title1-weight)",
                    lineHeight: "var(--plando-type-title1-lh)",
                    letterSpacing: "var(--plando-type-title1-ls)",
                }}
            >
                딱 두 가지만<br />허용해주세요
            </Typography>
            <Typography sx={{ fontSize: 14, color: "text.secondary", lineHeight: 1.6, mb: 3.25, mt: 1 }}>
                Plan Do!를 200% 쓰려면 필요해요. 나중에 바꿀 수 있어요.
            </Typography>

            {cards.map(({ Icon, iconBg, iconColor, title, desc }) => (
                <Box
                    key={title}
                    sx={{
                        borderRadius: "var(--plando-radius-card)", p: 2.125,
                        display: "flex", alignItems: "flex-start", gap: 1.75,
                        border: "1px solid", mb: 1.625,
                        boxShadow: "var(--plando-shadow-1)",
                        ...getGlassSx(theme),
                    }}
                >
                    <Box sx={{
                        width: 46, height: 46, borderRadius: "var(--plando-radius-md)", flexShrink: 0,
                        bgcolor: iconBg, color: iconColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <Icon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
                        <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.5, mt: 0.375 }}>
                            {desc}
                        </Typography>
                    </Box>
                </Box>
            ))}
        </Box>
    );
}

async function requestPermissions() {
    try {
        if ("Notification" in window && Notification.permission === "default") {
            await Notification.requestPermission();
        }
    } catch { /* noop */ }
    try {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(() => {}, () => {});
        }
    } catch { /* noop */ }
}

// 모바일 전체화면 플로우 — 예전부터 이 3장이다. 데스크탑 투어와 완전히 분리해 둔 이유는
// 모바일 동작(권한 요청 포함)을 한 글자도 바꾸지 않기 위해서다.
const MOBILE_SLIDES = [BrandSlide, AIDemoSlide, PermissionSlide];

/**
 * 온보딩 캐러셀.
 *
 * variant
 *  - "fullscreen" (기본) — 모바일. DashboardMobile이 대시보드 대신 전체화면으로 띄운다.
 *    슬라이드: MOBILE_SLIDES 3장(Brand/AIDemo/Permission), 마지막에 브라우저 권한 요청.
 *  - "modal" — 데스크탑. WelcomeDialog가 고정 크기 Paper 안에 넣어 띄운다.
 *              세이프에어리어/고정 위치 대신 부모(Paper)를 100% 채운다.
 *    슬라이드: DESKTOP_SLIDES 5장(제품 투어). 권한 요청 없음 — 데스크탑에서 브라우저
 *              위치/알림 권한을 온보딩에서 묻는 건 맥락에 맞지 않아 기능 소개로 대체했다.
 *
 * 콜백
 *  - onComplete  — 플로우를 끝까지 마침(마지막 CTA). 영구 저장.
 *  - onDismiss   — 지금만 닫기(건너뛰기 등). 없으면 onComplete로 폴백해 기존 모바일 동작 유지.
 *  - onNeverShow — 다시 보지 않기(모달 전용). 영구 저장.
 */
function WelcomeFlowInner({ onComplete, onDismiss, onNeverShow, variant = "fullscreen" }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const isModal = variant === "modal";
    // 모바일은 예전부터 건너뛰기 == 영구 완료였다. onDismiss를 안 넘기면 그 동작 그대로.
    const dismiss = onDismiss ?? onComplete;
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const reduced = useTourReduced();
    const motionControl = useTourMotionControl();

    const slides = isModal ? DESKTOP_SLIDES : MOBILE_SLIDES;
    const ctas = isModal ? DESKTOP_CTAS : MOBILE_CTAS;
    const lastStep = slides.length - 1;

    const goNext = useCallback(async () => {
        if (step < lastStep) {
            setDirection(1);
            setStep((s) => s + 1);
        } else {
            // 권한 요청은 모바일 PermissionSlide 전용. 데스크탑 투어에는 없다.
            if (!isModal) await requestPermissions();
            onComplete();
        }
    }, [step, lastStep, isModal, onComplete]);

    const goPrev = useCallback(() => {
        setDirection(-1);
        setStep((s) => Math.max(0, s - 1));
    }, []);

    const Slide = slides[step];

    return (
        <Box
            sx={isModal ? {
                position: "relative",
                width: "100%", height: "100%",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
            } : {
                position: "fixed", inset: 0,
                bgcolor: "var(--plando-bg)",
                zIndex: Z.OVERLAY_TOP,
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                height: "100dvh",
            }}
        >
            {/* 이전 — 5단계짜리 데스크탑 투어에서만. 모바일 3장 플로우는 기존대로 없음. */}
            {isModal && step > 0 && (
                <Press
                    onClick={goPrev}
                    haptic="light"
                    pressScale={0.95}
                    style={{
                        position: "absolute",
                        top: 14, left: 18, zIndex: 30,
                        fontSize: 13.5, fontWeight: 600,
                        color: "var(--plando-text-tertiary)",
                        background: "none", border: "none",
                    }}
                >
                    이전
                </Press>
            )}

            {/* 건너뛰기 — 모달에서는 "지금은 닫기"라 마지막 단계에서도 남겨둔다 */}
            {(isModal || step < lastStep) && (
                <Press
                    onClick={dismiss}
                    haptic="light"
                    pressScale={0.95}
                    style={{
                        position: "absolute",
                        top: isModal ? 14 : "calc(env(safe-area-inset-top, 20px) + 12px)",
                        right: isModal ? 18 : 24, zIndex: 30,
                        fontSize: 13.5, fontWeight: 600,
                        color: "var(--plando-text-tertiary)",
                        background: "none", border: "none",
                    }}
                >
                    건너뛰기
                </Press>
            )}

            {/* 인디케이터 */}
            <Box sx={{
                display: "flex", gap: "7px", justifyContent: "center",
                pt: isModal ? 2.25 : "calc(env(safe-area-inset-top, 20px) + 16px)",
                pb: 0.5, flexShrink: 0, position: "relative", zIndex: 2,
            }}>
                {slides.map((_, i) => (
                    <Box
                        key={i}
                        sx={{
                            width: i === step ? 22 : 7,
                            height: 7,
                            borderRadius: i === step ? "5px" : "50%",
                            bgcolor: i === step ? "primary.main" : "var(--plando-text-disabled)",
                            transition: `all var(--plando-dur-base) var(--plando-ease)`,
                        }}
                    />
                ))}
            </Box>

            {/* 슬라이드 */}
            <Box sx={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={reduced ? fadeVariants : slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={slideTx}
                        style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
                    >
                        <Slide isDark={isDark} />
                    </motion.div>
                </AnimatePresence>
            </Box>

            {/* CTA */}
            <Box sx={{
                flexShrink: 0,
                px: isModal ? 4 : 3.75,   // 데스크탑 투어 슬라이드(px:4)와 좌우선 맞춤
                pb: isModal ? 2.5 : "calc(env(safe-area-inset-bottom, 20px) + 16px)",
                position: "relative", zIndex: 2,
            }}>
                <Press
                    onClick={goNext}
                    haptic="medium"
                    pressScale={0.97}
                    style={{
                        width: "100%", padding: 17,
                        borderRadius: "var(--plando-radius-card)",
                        background: "var(--plando-primary)",
                        color: "#fff", fontSize: 16, fontWeight: 700, textAlign: "center",
                        boxShadow: "var(--plando-shadow-float)",
                        border: "none",
                    }}
                >
                    {ctas[step]}
                </Press>

                {/* 모달: "다시 보지 않기"(영구) — 건너뛰기(이번만)와 다른 동작이라 항상 노출.
                    전체화면: 마지막 단계의 "권한 없이 시작하기"(기존 동작 그대로). */}
                {isModal ? (
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="center"
                        spacing={1.25}
                        sx={{ mt: "14px" }}
                    >
                        <Press
                            onClick={onNeverShow ?? onComplete}
                            haptic="light"
                            pressScale={0.95}
                            style={{
                                background: "none", border: "none",
                                fontSize: 13.5, fontWeight: 600,
                                color: "var(--plando-text-tertiary)",
                                padding: 4,
                            }}
                        >
                            다시 보지 않기
                        </Press>

                        {/* OS가 "동작 줄이기"를 켠 사람에게만 보이는 되돌리기 스위치.
                            윈도우는 성능 옵션만 만져도 같은 신호가 나가서, 정적 화면이
                            의도치 않게 걸리는 경우가 있다. 기본값은 여전히 '끔'. */}
                        {motionControl?.osReduced && (
                            <>
                                <Box
                                    aria-hidden
                                    sx={{
                                        width: 3, height: 3, borderRadius: "50%",
                                        bgcolor: "var(--plando-text-disabled)",
                                    }}
                                />
                                <Press
                                    onClick={motionControl.togglePlayMotion}
                                    haptic="light"
                                    pressScale={0.95}
                                    style={{
                                        background: "none", border: "none",
                                        fontSize: 13.5, fontWeight: 600,
                                        color: motionControl.playMotion
                                            ? "var(--plando-primary)"
                                            : "var(--plando-text-tertiary)",
                                        padding: 4,
                                    }}
                                >
                                    {motionControl.playMotion ? "애니메이션 끄기" : "애니메이션으로 보기"}
                                </Press>
                            </>
                        )}
                    </Stack>
                ) : step === lastStep && (
                    <Press
                        onClick={onComplete}
                        haptic="light"
                        pressScale={0.95}
                        style={{
                            display: "block", width: "100%", textAlign: "center",
                            background: "none", border: "none",
                            fontSize: 13.5, fontWeight: 600,
                            color: "var(--plando-text-tertiary)",
                            marginTop: 14, padding: 4,
                        }}
                    >
                        권한 없이 시작하기
                    </Press>
                )}
            </Box>
        </Box>
    );
}

/**
 * 투어 전체를 모션 컨텍스트로 감싼다. 안쪽(WelcomeFlowInner / 슬라이드 / 목업)이 전부
 * 같은 판정을 공유해야 "애니메이션으로 보기"가 한 번에 반영된다.
 */
export default function WelcomeFlow(props) {
    return (
        <TourMotionProvider>
            <WelcomeFlowInner {...props} />
        </TourMotionProvider>
    );
}
