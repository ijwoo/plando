import React, { useRef, useState } from "react";
import { Box, Stack, Typography, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { toPng } from "html-to-image";
import Press from "../../../shared/ui/primitives/Press.jsx";
import Sheet from "../../../shared/ui/primitives/Sheet.jsx";
import { toast } from "../../../shared/utils/toast.js";
import WrapShareCard from "./WrapShareCard.jsx";

function ActionTile({ icon, label, onClick }) {
    return (
        <Press
            as="div"
            onClick={onClick}
            haptic="light"
            pressScale={0.94}
            style={{ display: "block", flex: 1 }}
        >
            <Stack alignItems="center" spacing={1}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        borderRadius: "var(--plando-radius-md)",
                        background: "var(--plando-surface-alt)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "text.primary",
                    }}
                >
                    {icon}
                </Box>
                <Typography
                    sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "text.primary",
                        letterSpacing: "-0.01em",
                    }}
                >
                    {label}
                </Typography>
            </Stack>
        </Press>
    );
}

/**
 * 공유 bottom sheet — 공용 Sheet primitive 사용.
 */
export default function WrapShareSheet({ open, onClose, data }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const [copied, setCopied] = useState(false);
    const [generating, setGenerating] = useState(false);
    const cardRef = useRef(null);

    const generatePng = async () => {
        if (!cardRef.current) return null;
        // 폰트 로드 보장 위해 약간 대기
        await new Promise((r) => setTimeout(r, 60));
        return await toPng(cardRef.current, {
            cacheBust: true,
            pixelRatio: 1,           // 카드가 이미 1080×1920 실사이즈
            backgroundColor: "#FFFFFF",
        });
    };

    const handleNativeShare = async () => {
        if (!navigator.share) {
            toast.info("이 기기는 시스템 공유를 지원하지 않아요.");
            return;
        }
        try {
            await navigator.share({
                title: "Plando 주간 회고",
                text: `${data.year}년 ${data.month}월 ${data.weekIndex}주차 · 일정 ${data.totalCount}개`,
                url: window.location.href,
            });
            onClose();
        } catch {
            /* user cancel */
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            toast.error("링크 복사에 실패했어요.");
        }
    };

    const handleSaveImage = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const dataUrl = await generatePng();
            if (!dataUrl) throw new Error("렌더링 실패");
            const link = document.createElement("a");
            link.download = `plando-wrap-${data.year}-${data.month}-w${data.weekIndex}.png`;
            link.href = dataUrl;
            link.click();
            toast.info("이미지를 저장했어요.");
        } catch (e) {
            toast.error("이미지 저장에 실패했어요.");
        } finally {
            setGenerating(false);
        }
    };

    const handleShareImage = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const dataUrl = await generatePng();
            if (!dataUrl) throw new Error("렌더링 실패");
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `plando-wrap-${data.year}-${data.month}-w${data.weekIndex}.png`, {
                type: "image/png",
            });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Plando 주간 회고",
                    text: `${data.year}년 ${data.month}월 ${data.weekIndex}주차 · 일정 ${data.totalCount}개`,
                });
                onClose();
            } else {
                handleSaveImage();
            }
        } catch (e) {
            if (e?.name !== "AbortError") toast.error("공유에 실패했어요.");
        } finally {
            setGenerating(false);
        }
    };

    const header = (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
                px: 2.5,
                pt: 1,
                pb: 1.5,
                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "var(--plando-divider)"}`,
            }}
        >
            <Typography
                sx={{
                    fontSize: "var(--plando-type-title2-size)",
                    fontWeight: "var(--plando-type-title2-weight)",
                    color: "text.primary",
                    letterSpacing: "var(--plando-type-title2-ls)",
                }}
            >
                회고 카드 공유
            </Typography>
            <Press
                as="span"
                onClick={onClose}
                haptic="light"
                pressScale={0.9}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                }}
            >
                <CloseRoundedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
            </Press>
        </Stack>
    );

    return (
        <Sheet open={open} onClose={onClose} height="auto" header={header}>
            <Stack spacing={2.5} sx={{ px: 2.5, pt: 2.5, pb: "calc(24px + env(safe-area-inset-bottom))" }}>
                {/* 카드 미리보기 */}
                <Box
                    sx={{
                        borderRadius: "var(--plando-radius-md)",
                        background: "var(--plando-surface-alt)",
                        padding: "18px 18px",
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1.75}>
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: "var(--plando-radius-sm)",
                                background: isDark
                                    ? "rgba(45,110,245,0.18)"
                                    : "var(--plando-primary-soft)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <InsightsRoundedIcon sx={{ fontSize: 22, color: "var(--plando-primary)" }} />
                        </Box>
                        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                sx={{
                                    fontSize: "var(--plando-type-title3-size)",
                                    fontWeight: 800,
                                    color: "text.primary",
                                    letterSpacing: "var(--plando-type-title3-ls)",
                                }}
                            >
                                {data.month}월 {data.weekIndex}주차 회고
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: "var(--plando-type-caption-size)",
                                    color: "text.secondary",
                                    fontWeight: 600,
                                }}
                            >
                                일정 {data.totalCount}개 · 완료 {data.completionRate}%
                            </Typography>
                        </Stack>
                    </Stack>
                </Box>

                {/* 액션 grid */}
                <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                    <ActionTile
                        icon={
                            generating ? (
                                <CircularProgress size={18} thickness={5} sx={{ color: "var(--plando-primary)" }} />
                            ) : (
                                <IosShareRoundedIcon sx={{ fontSize: 24, color: "var(--plando-primary)" }} />
                            )
                        }
                        label="이미지로 공유"
                        onClick={handleShareImage}
                    />
                    <ActionTile
                        icon={
                            copied ? (
                                <CheckRoundedIcon sx={{ fontSize: 24, color: "var(--plando-green)" }} />
                            ) : (
                                <LinkRoundedIcon sx={{ fontSize: 24, color: "var(--plando-text-primary)" }} />
                            )
                        }
                        label={copied ? "복사됨" : "링크 복사"}
                        onClick={handleCopyLink}
                    />
                    <ActionTile
                        icon={
                            generating ? (
                                <CircularProgress size={18} thickness={5} sx={{ color: "var(--plando-text-primary)" }} />
                            ) : (
                                <DownloadRoundedIcon sx={{ fontSize: 24, color: "var(--plando-text-primary)" }} />
                            )
                        }
                        label="이미지 저장"
                        onClick={handleSaveImage}
                    />
                </Stack>

                {/* 캡쳐용 hidden 카드 — 화면 밖으로 보냄 */}
                <Box
                    sx={{
                        position: "fixed",
                        left: -10000,
                        top: 0,
                        pointerEvents: "none",
                        zIndex: -1,
                    }}
                    aria-hidden
                >
                    <WrapShareCard ref={cardRef} data={data} />
                </Box>

                <Typography
                    sx={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: "text.secondary",
                        textAlign: "center",
                        opacity: 0.7,
                    }}
                >
                    공유 시 워크스페이스 멤버 이름은 비공개로 표시돼요
                </Typography>
            </Stack>
        </Sheet>
    );
}
