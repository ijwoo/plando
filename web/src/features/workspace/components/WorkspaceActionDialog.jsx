import React, { useEffect, useState } from "react";
import { Dialog, useTheme } from "@mui/material";
import { blurSx } from "../../../shared/ui/glassSx.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

export default function WorkspaceActionDialog({
    open,
    mode, // "create" | "join"
    onClose,
    onSubmit,
    loading = false,
}) {
    const isCreate = mode === "create";
    const [value, setValue] = useState("");
    const [error, setError] = useState("");

    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const tok = isDark ? {
        bg:      "rgba(19,19,23,0.98)",
        border:  "rgba(255,255,255,0.14)",
        text:    "rgba(255,255,255,0.92)",
        text2:   "rgba(255,255,255,0.50)",
        sep:     "rgba(255,255,255,0.08)",
        input:   "rgba(255,255,255,0.06)",
        inputBd: "rgba(255,255,255,0.12)",
        inputFc: "rgba(255,255,255,0.20)",
        err:     "#F87171",
        primary: "#5B8DEF",
    } : {
        bg:      "rgba(248,248,252,0.98)",
        border:  "rgba(60,60,67,0.18)",
        text:    "rgba(0,0,0,0.88)",
        text2:   "rgba(0,0,0,0.50)",
        sep:     "rgba(0,0,0,0.07)",
        input:   "rgba(0,0,0,0.04)",
        inputBd: "rgba(0,0,0,0.12)",
        inputFc: "rgba(0,0,0,0.20)",
        err:     "#DC2626",
        primary: "#2563EB",
    };

    useEffect(() => {
        if (open) {
            setValue("");
            setError("");
        }
    }, [open, mode]);

    const handleSubmit = async () => {
        const trimmed = value.trim();
        if (!trimmed) {
            setError(isCreate ? "워크스페이스 이름을 입력해주세요." : "초대코드를 입력해주세요.");
            return;
        }
        setError("");
        await onSubmit(trimmed, { setError, reset: () => setValue("") });
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
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
            {/* header */}
            <div style={{ padding: "22px 20px 16px", fontFamily: F }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: tok.text, marginBottom: 4, letterSpacing: -0.3 }}>
                    {isCreate ? "새 워크스페이스 만들기" : "초대코드로 참여하기"}
                </div>
                <div style={{ fontSize: 13, color: tok.text2, lineHeight: 1.5 }}>
                    {isCreate
                        ? "새로운 작업 공간을 만들고 멤버를 초대할 수 있어요."
                        : "초대코드를 입력하면 기존 워크스페이스에 참여할 수 있어요."}
                </div>
            </div>

            {/* input area */}
            <div style={{ padding: "0 20px 16px", fontFamily: F }}>
                {error && (
                    <div style={{
                        fontSize: 12.5, color: tok.err, marginBottom: 10,
                        background: isDark ? "rgba(248,113,113,0.10)" : "rgba(220,38,38,0.07)",
                        border: `1px solid ${isDark ? "rgba(248,113,113,0.20)" : "rgba(220,38,38,0.15)"}`,
                        borderRadius: 10, padding: "8px 12px",
                    }}>
                        {error}
                    </div>
                )}
                <input
                    autoFocus
                    disabled={loading}
                    placeholder={isCreate ? "워크스페이스 이름을 입력하세요" : "예: ABCD2345"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        // IME 조합 중 Enter 무시 — 한글 이름 마지막 글자 유실/중복 제출 방지
                        if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                        e.preventDefault();
                        handleSubmit();
                    }}
                    style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "11px 14px",
                        background: tok.input,
                        border: `1px solid ${tok.inputBd}`,
                        borderRadius: 12,
                        fontSize: 14.5, color: tok.text, fontFamily: F,
                        outline: "none",
                        opacity: loading ? 0.6 : 1,
                    }}
                    onFocus={(e) => { e.target.style.borderColor = tok.inputFc; }}
                    onBlur={(e) => { e.target.style.borderColor = tok.inputBd; }}
                />
            </div>

            {/* buttons */}
            <div style={{ display: "flex", borderTop: `1px solid ${tok.sep}`, fontFamily: F }}>
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
                    취소
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        flex: 1, padding: "14px", background: "none", border: "none",
                        fontSize: 15, fontWeight: 700, color: tok.primary,
                        cursor: loading ? "default" : "pointer",
                        fontFamily: F, opacity: loading ? 0.5 : 1,
                    }}
                >
                    {loading ? (isCreate ? "생성 중..." : "참여 중...") : (isCreate ? "생성" : "참여")}
                </button>
            </div>
        </Dialog>
    );
}
