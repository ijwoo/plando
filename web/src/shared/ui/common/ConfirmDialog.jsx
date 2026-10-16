import React from "react";
import { Dialog, SwipeableDrawer, useMediaQuery, useTheme } from "@mui/material";
import { blurSx } from "../glassSx.js";
import { getDialogTokens } from "../dialogTokens.js";
import { Z } from "../zIndex.js";
import Press from "../primitives/Press.jsx";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

/**
 * 확인 다이얼로그 — 데스크탑: 중앙 글래스 다이얼로그 / 모바일: 바텀시트(슬라이드 업).
 * props 동일 — 호출부는 분기를 모름.
 */
export default function ConfirmDialog({
    open,
    title = "확인",
    message,
    confirmText = "확인",
    cancelText = "취소",
    confirmColor = "error",   // "error" | "primary" | "warning"
    onClose,
    onConfirm,
    loading = false,
    hideCancel = false,
    zIndex,                   // override (기본 Z.DIALOG — 컨펌은 항상 최상위)
}) {
    const theme  = useTheme();
    const isDark = theme.palette.mode === "dark";
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const tok = getDialogTokens(theme);

    const confirmColorMap = {
        error:   isDark ? "#F87171" : "#DC2626",
        primary: isDark ? "#5B8DEF" : "#2563EB",
        warning: isDark ? "#FBBF24" : "#D97706",
    };
    const confirmC = confirmColorMap[confirmColor] ?? confirmColorMap.error;

    // ── 모바일: 바텀시트 (앱 문법 — 슬라이드 업 + 필 버튼 + 햅틱) ──
    if (isMobile) {
        return (
            <SwipeableDrawer
                anchor="bottom"
                open={open}
                onClose={loading ? () => {} : onClose}
                onOpen={() => {}}
                disableSwipeToOpen
                // 확인창은 항상 최상위 — 시트/상세 패널 위에서 뜨는 경우가 대부분
                sx={{ zIndex: zIndex ?? Z.DIALOG }}
                transitionDuration={{ enter: 280, exit: 200 }}
                PaperProps={{
                    sx: {
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        background: tok.bg,
                        backgroundImage: "none",
                        fontFamily: F,
                    },
                }}
                slotProps={{
                    backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.45)" } },
                }}
            >
                <div style={{ padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", fontFamily: F }}>
                    {/* drag handle */}
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: tok.text2, opacity: 0.35 }} />
                    </div>

                    <div style={{ fontSize: 17, fontWeight: 800, color: tok.text, marginBottom: 8, letterSpacing: -0.3 }}>
                        {title}
                    </div>
                    {message && (
                        <div style={{ fontSize: 14, color: tok.text2, lineHeight: 1.6, whiteSpace: "pre-line", marginBottom: 20 }}>
                            {message}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                        {!hideCancel && (
                            <Press
                                onClick={onClose}
                                disabled={loading}
                                haptic="light"
                                pressScale={0.97}
                                style={{
                                    flex: 1, height: 52, borderRadius: 14, border: "none",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
                                    fontSize: 15.5, fontWeight: 700, color: tok.text2,
                                    fontFamily: F, opacity: loading ? 0.5 : 1,
                                }}
                            >
                                {cancelText}
                            </Press>
                        )}
                        <Press
                            onClick={onConfirm}
                            disabled={loading}
                            haptic="medium"
                            pressScale={0.97}
                            style={{
                                flex: 1, height: 52, borderRadius: 14, border: "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: confirmC,
                                fontSize: 15.5, fontWeight: 800, color: "#fff",
                                fontFamily: F, opacity: loading ? 0.6 : 1,
                            }}
                        >
                            {loading ? "처리 중..." : confirmText}
                        </Press>
                    </div>
                </div>
            </SwipeableDrawer>
        );
    }

    // ── 데스크탑: 기존 중앙 다이얼로그 ──
    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            sx={{ zIndex: zIndex ?? Z.DIALOG }}
            PaperProps={{
                sx: {
                    borderRadius: "20px",
                    background: tok.bg,
                    backgroundImage: "none",
                    ...blurSx("blur(40px)"),
                    border: `1px solid ${tok.border}`,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                    overflow: "hidden",
                    fontFamily: F,
                },
            }}
            slotProps={{
                backdrop: {
                    sx: { ...blurSx("blur(4px)"), backgroundColor: "rgba(0,0,0,0.4)" },
                },
            }}
        >
            {/* body */}
            <div style={{ padding: "22px 20px 16px", fontFamily: F }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: tok.text, marginBottom: 8, letterSpacing: -0.3 }}>
                    {title}
                </div>
                {message && (
                    <div style={{ fontSize: 13.5, color: tok.text2, lineHeight: 1.55, whiteSpace: "pre-line" }}>
                        {typeof message === "string" ? message : message}
                    </div>
                )}
            </div>

            {/* buttons */}
            <div style={{ display: "flex", borderTop: `1px solid ${tok.sep}`, fontFamily: F }}>
                {!hideCancel && (
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            flex: 1, padding: "14px", background: "none", border: "none",
                            borderRight: `1px solid ${tok.sep}`,
                            fontSize: 15, fontWeight: 600, color: tok.text2,
                            cursor: loading ? "default" : "pointer",
                            fontFamily: F, opacity: loading ? 0.5 : 1,
                        }}
                    >
                        {cancelText}
                    </button>
                )}
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    style={{
                        flex: 1, padding: "14px", background: "none", border: "none",
                        fontSize: 15, fontWeight: 700, color: confirmC,
                        cursor: loading ? "default" : "pointer",
                        fontFamily: F, opacity: loading ? 0.5 : 1,
                    }}
                >
                    {loading ? "처리 중..." : confirmText}
                </button>
            </div>
        </Dialog>
    );
}
