import React, { useMemo, useState } from "react";
import { Dialog, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { blurSx } from "../../../shared/ui/glassSx.js";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { copyToClipboard } from "../utils/clipboard.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

/**
 * MUI theme palette 기반 토큰. primary는 사용자 accent 따라감.
 * kakao 색상은 외부 브랜드라 고정.
 */
function buildTokens(theme) {
    const isDark = theme.palette.mode === "dark";
    return {
        bg:        theme.palette.background.paper,
        sep:       theme.palette.divider,
        text:      theme.palette.text.primary,
        text2:     theme.palette.text.secondary,
        text3:     theme.palette.text.disabled,
        border:    isDark ? "rgba(255,255,255,0.12)" : "rgba(60,60,67,0.16)",
        surface:   isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
        surfaceMd: "var(--plando-surface-mid)",
        inputBg:   isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        inputBd:   isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
        primary:   theme.palette.primary.main,
        kakao:     "#FEE500",   // 카카오 브랜드 고정
        kakaoText: "#3C1E1E",
        err:       theme.palette.error.main,
    };
}

function buildInviteUrl(workspace) {
    const inviteCode = workspace?.inviteCode ?? "";
    const base = import.meta.env.VITE_APP_URL || window.location.origin;
    return `${base}/#/join?code=${encodeURIComponent(inviteCode)}`;
}

export default function KakaoInviteDialog({ open, onClose, workspace }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const t = buildTokens(theme);

    const [copied, setCopied] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [error, setError] = useState("");

    const inviteUrl = useMemo(() => buildInviteUrl(workspace), [workspace]);
    const workspaceName = workspace?.workspaceName || "워크스페이스";
    const inviteCode = workspace?.inviteCode || "";

    const handleCopy = async () => {
        if (!inviteCode) return;

        // 폴백(execCommand)까지 실패했는데 "복사됨"으로 바뀌면 사용자는 복사된 줄 알고 붙여넣기한다.
        // 성공 여부를 확인해서 실패는 실패라고 알린다.
        const ok = await copyToClipboard(inviteCode);
        if (!ok) {
            setError("초대 코드를 복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.");
            return;
        }

        setError("");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleShare = async () => {
        setError("");

        if (!workspace?.inviteCode) {
            setError("초대 코드가 없어요.");
            return;
        }

        if (!window.Kakao || !window.Kakao.Share) {
            setError("카카오 공유 기능을 사용할 수 없어요. Kakao SDK 로드 상태를 확인해주세요.");
            return;
        }
        try {
            setSharing(true);

            window.Kakao.Share.sendDefault({
                objectType: "feed",
                content: {
                    title: `[${workspaceName}] 워크스페이스에 초대되었어요`,
                    description: `Plan Do!에서 일정과 할 일을 함께 관리해보세요.\n초대 코드 ${inviteCode}`,
                    imageUrl: `${import.meta.env.VITE_APP_URL || window.location.origin}/kakaoimg.jpg`,
                    link: {
                        mobileWebUrl: inviteUrl,
                        webUrl: inviteUrl,
                    },
                },
                buttons: [
                    {
                        title: "워크스페이스 참여하기",
                        link: {
                            mobileWebUrl: inviteUrl,
                            webUrl: inviteUrl,
                        },
                    },
                ],
            });
        } catch {
            setError("카카오톡 공유를 열지 못했어요.");
        } finally {
            setSharing(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={sharing ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: "20px",
                    background: t.bg,
                    backgroundImage: "none",
                    ...blurSx("blur(40px)"),
                    boxShadow: "var(--plando-elev-3)",
                    overflow: "hidden",
                    fontFamily: F,
                },
            }}
            slotProps={{
                backdrop: {
                    sx: {
                        ...blurSx("blur(4px)"),
                        backgroundColor: "rgba(0,0,0,0.4)",
                    },
                },
            }}
        >
            <div
                style={{
                    padding: "18px 20px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`,
                    backgroundSize: "100% 1px",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "bottom",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: "#FEE500",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 900,
                            fontSize: 13,
                            flexShrink: 0,
                            color: "#3C1E1E",
                        }}
                    >
                        K
                    </div>
                    <span
                        style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: t.text,
                            letterSpacing: -0.3,
                            fontFamily: F,
                        }}
                    >
                        카카오톡으로 초대
                    </span>
                </div>

                <button
                    onClick={onClose}
                    disabled={sharing}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: sharing ? "default" : "pointer",
                        padding: 4,
                        color: t.text2,
                        display: "flex",
                        alignItems: "center",
                        opacity: sharing ? 0.4 : 1,
                    }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </button>
            </div>

            <div style={{ padding: "16px" }}>
                <div
                    style={{
                        background: t.surface,
                        borderRadius: 16,
                        padding: "14px",
                        marginBottom: 14,
                        boxShadow: "var(--plando-elev-1)",
                    }}
                >
                    <div
                        style={{
                            fontSize: 12,
                            color: t.text3,
                            fontWeight: 700,
                            marginBottom: 8,
                            fontFamily: F,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                        }}
                    >
                        Workspace
                    </div>

                    <div
                        style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: t.text,
                            marginBottom: 10,
                            fontFamily: F,
                            lineHeight: 1.35,
                        }}
                    >
                        {workspaceName}
                    </div>

                    <div
                        style={{
                            fontSize: 13,
                            color: t.text2,
                            lineHeight: 1.5,
                            fontFamily: F,
                        }}
                    >
                        카카오톡 공유창이 열리면 그 안에서 보낼 대상을 선택할 수 있어요.
                    </div>
                </div>

                <div
                    style={{
                        background: t.surface,
                        borderRadius: 14,
                        padding: "10px 14px",
                        marginBottom: 12,
                        boxShadow: "var(--plando-elev-1)",
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: t.text3,
                            letterSpacing: 0.4,
                            textTransform: "uppercase",
                            marginBottom: 6,
                            fontFamily: F,
                        }}
                    >
                        초대 코드
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                            style={{
                                flex: 1,
                                padding: "8px 12px",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBd}`,
                                borderRadius: 10,
                                fontSize: 14,
                                fontWeight: 700,
                                color: t.text,
                                fontFamily: "monospace, sans-serif",
                                letterSpacing: 1,
                            }}
                        >
                            {inviteCode || "—"}
                        </div>

                        <button
                            onClick={handleCopy}
                            style={{
                                background: copied ? "rgba(34,197,94,0.15)" : t.surfaceMd,
                                border: `1px solid ${copied ? "rgba(34,197,94,0.30)" : t.border}`,
                                borderRadius: 10,
                                padding: "8px 12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: copied ? "#22C55E" : t.text2,
                                fontFamily: F,
                                transition: "all 0.2s",
                            }}
                        >
                            {copied ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
                            {copied ? "복사됨" : "복사"}
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        background: t.surface,
                        borderRadius: 14,
                        padding: "12px 14px",
                        marginBottom: 12,
                        boxShadow: "var(--plando-elev-1)",
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: t.text3,
                            letterSpacing: 0.4,
                            textTransform: "uppercase",
                            marginBottom: 6,
                            fontFamily: F,
                        }}
                    >
                        참여 링크
                    </div>

                    <div
                        style={{
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: t.text2,
                            wordBreak: "break-all",
                            fontFamily: F,
                        }}
                    >
                        {inviteUrl}
                    </div>
                </div>

                {error && (
                    <div
                        style={{
                            background: alpha(t.err, isDark ? 0.10 : 0.07),
                            border: `1px solid ${alpha(t.err, isDark ? 0.20 : 0.15)}`,
                            borderRadius: 10,
                            padding: "8px 14px",
                            marginBottom: 12,
                            fontSize: 13,
                            color: t.err,
                            fontWeight: 600,
                            fontFamily: F,
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>

            <div style={{ display: "flex", backgroundImage: `linear-gradient(to right, transparent, ${t.sep} 15%, ${t.sep} 85%, transparent)`, backgroundSize: "100% 1px", backgroundRepeat: "no-repeat", backgroundPosition: "top", fontFamily: F }}>
                <button
                    onClick={onClose}
                    disabled={sharing}
                    style={{
                        flex: 1,
                        padding: "14px",
                        background: "none",
                        border: "none",
                        fontSize: 15,
                        fontWeight: 600,
                        color: t.text2,
                        cursor: sharing ? "default" : "pointer",
                        fontFamily: F,
                        opacity: sharing ? 0.5 : 1,
                    }}
                >
                    닫기
                </button>

                <button
                    onClick={handleShare}
                    disabled={sharing}
                    style={{
                        flex: 1,
                        padding: "14px",
                        background: t.kakao,
                        border: "none",
                        fontSize: 15,
                        fontWeight: 800,
                        color: t.kakaoText,
                        cursor: sharing ? "default" : "pointer",
                        fontFamily: F,
                        opacity: sharing ? 0.7 : 1,
                    }}
                >
                    카카오톡 공유하기
                </button>
            </div>
        </Dialog>
    );
}