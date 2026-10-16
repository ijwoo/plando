import React, { useState } from "react";
import { Dialog, useTheme } from "@mui/material";
import { blurSx } from "../../../shared/ui/glassSx.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

export default function KakaoLoginDialog({ open, onClose, label = "카카오 로그인" }) {
    const [step, setStep] = useState("ask"); // "ask" | "code"
    const [inviteCode, setInviteCode] = useState("");

    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const tok = isDark ? {
        bg:      "rgba(19,19,23,0.98)",
        border:  "rgba(255,255,255,0.14)",
        sep:     "rgba(255,255,255,0.08)",
        text:    "rgba(255,255,255,0.92)",
        text2:   "rgba(255,255,255,0.50)",
        inputBg: "rgba(255,255,255,0.06)",
        inputBd: "rgba(255,255,255,0.12)",
    } : {
        bg:      "rgba(248,248,252,0.98)",
        border:  "rgba(60,60,67,0.18)",
        sep:     "rgba(0,0,0,0.07)",
        text:    "rgba(0,0,0,0.88)",
        text2:   "rgba(0,0,0,0.50)",
        inputBg: "rgba(0,0,0,0.04)",
        inputBd: "rgba(0,0,0,0.12)",
    };

    const handleClose = () => {
        setStep("ask");
        setInviteCode("");
        onClose();
    };

    const redirectToKakao = (code) => {
        if (code?.trim()) {
            sessionStorage.setItem("oauthInviteCode", code.trim());
        } else {
            sessionStorage.removeItem("oauthInviteCode");
        }
        window.location.href = `${import.meta.env.VITE_API_BASE_URL ?? ""}/oauth2/authorization/kakao`;
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="xs"
            fullWidth
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
            {step === "ask" ? (
                <>
                    <div style={{ padding: "22px 20px 16px", fontFamily: F }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: tok.text, marginBottom: 8, letterSpacing: -0.3 }}>
                            팀에 초대받으셨나요?
                        </div>
                        <div style={{ fontSize: 13.5, color: tok.text2, lineHeight: 1.55 }}>
                            팀원에게 초대코드를 받으셨다면 입력 후 로그인하면 바로 팀 워크스페이스에 참여할 수 있어요.
                        </div>
                    </div>
                    <div style={{ display: "flex", borderTop: `1px solid ${tok.sep}`, fontFamily: F }}>
                        <button
                            onClick={() => setStep("code")}
                            style={{
                                flex: 1, padding: "14px", background: "none", border: "none",
                                borderRight: `1px solid ${tok.sep}`,
                                fontSize: 14, fontWeight: 600, color: tok.text2,
                                cursor: "pointer", fontFamily: F,
                            }}
                        >
                            초대코드가 있어요
                        </button>
                        <button
                            onClick={() => redirectToKakao(null)}
                            style={{
                                flex: 1, padding: "14px", background: "none", border: "none",
                                fontSize: 14, fontWeight: 700, color: "#B8860B",
                                cursor: "pointer", fontFamily: F,
                            }}
                        >
                            처음 시작할게요
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div style={{ padding: "22px 20px 16px", fontFamily: F }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: tok.text, marginBottom: 8, letterSpacing: -0.3 }}>
                            초대코드를 입력해주세요
                        </div>
                        <div style={{ fontSize: 13.5, color: tok.text2, lineHeight: 1.55, marginBottom: 14 }}>
                            팀원에게 받은 초대코드를 입력하면 로그인 후 해당 워크스페이스에 자동으로 합류해요.
                        </div>
                        <input
                            autoFocus
                            placeholder="예: ABCD2345"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            onKeyDown={(e) => {
                                // IME 조합 중 Enter 무시 — 조합 확정 Enter로 즉시 이동하는 문제 방지
                                if (e.key === "Enter" && !(e.nativeEvent?.isComposing || e.keyCode === 229)) redirectToKakao(inviteCode);
                            }}
                            style={{
                                width: "100%", boxSizing: "border-box",
                                padding: "11px 14px",
                                background: tok.inputBg,
                                border: `1px solid ${tok.inputBd}`,
                                borderRadius: 12,
                                fontSize: 14.5, color: tok.text, fontFamily: F,
                                outline: "none",
                            }}
                        />
                    </div>
                    <div style={{ display: "flex", borderTop: `1px solid ${tok.sep}`, fontFamily: F }}>
                        <button
                            onClick={() => setStep("ask")}
                            style={{
                                flex: 1, padding: "14px", background: "none", border: "none",
                                borderRight: `1px solid ${tok.sep}`,
                                fontSize: 14, fontWeight: 600, color: tok.text2,
                                cursor: "pointer", fontFamily: F,
                            }}
                        >
                            뒤로
                        </button>
                        <button
                            onClick={() => redirectToKakao(inviteCode)}
                            style={{
                                flex: 1, padding: "14px", background: "none", border: "none",
                                fontSize: 14, fontWeight: 700, color: "#B8860B",
                                cursor: "pointer", fontFamily: F,
                            }}
                        >
                            {label}
                        </button>
                    </div>
                </>
            )}
        </Dialog>
    );
}
