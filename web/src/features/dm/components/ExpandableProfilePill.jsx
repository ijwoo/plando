import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Avatar, Skeleton, Stack } from "@mui/material";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { blurSx } from "../../../shared/ui/glassSx.js";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { fetchPartnerProfile } from "../api/dmApi.js";
import { formatLastActive } from "../../../shared/utils/formatters.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { Z } from "../../../shared/ui/zIndex.js";
import { PRESENCE_ONLINE_COLOR } from "../constants/dmTags.js";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import SharedTodoList from "./SharedTodoList.jsx";
import SharedFileSection from "./SharedFileSection.jsx";
import { ROLE_LABEL } from "../../workspace/hooks/useWorkspacePermissions.js";

const SECTION_LABEL_SX = {
    fontSize: 10,
    fontWeight: 700,
    color: "text.secondary",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    mb: 1,
};

export default function ExpandableProfilePill({
                                                  room,
                                                  open,
                                                  onToggle,
                                                  onClose,
                                                  isDark,
                                                  border,
                                                  primaryColor,
                                                  textColor,
                                                  openPreview,
                                              }) {
    const openTodoDetail = useOpenTodoDetail();
    const bg = isDark ? "rgba(18,18,38,0.98)" : "rgba(255,255,255,0.98)";
    const muted = isDark ? "rgba(255,255,255,0.58)" : "rgba(28,28,30,0.58)";
    const shadow = isDark
        ? "0 18px 46px rgba(0,0,0,0.52)"
        : "0 18px 46px rgba(0,0,0,0.16)";

    const [profile, setProfile] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    /** STOMP presence broadcast로 받은 실시간 상태. true/false면 lastActiveAt보다 우선. */
    const [livePresence, setLivePresence] = useState(null);

    const loadProfile = useCallback(() => {
        if (!room?.id) return;
        setLoadingProfile(true);
        fetchPartnerProfile(room.id)
            .then((r) => setProfile(r.data))
            .catch(() => setProfile(null))
            .finally(() => setLoadingProfile(false));
    }, [room?.id]);

    useEffect(() => {
        if (open) loadProfile();
    }, [open, loadProfile]);

    useEffect(() => {
        window.addEventListener(APP_EVENTS.DM_FILE_SENT, loadProfile);
        return () => window.removeEventListener(APP_EVENTS.DM_FILE_SENT, loadProfile);
    }, [loadProfile]);

    // STOMP /topic/presence broadcast 수신 → partner email 매칭 시 실시간 갱신
    useEffect(() => {
        const handler = (e) => {
            const payload = e.detail;
            if (!payload?.email) return;
            if (payload.email !== room?.partnerEmail) return;
            setLivePresence(!!payload.online);
        };
        window.addEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
        return () => window.removeEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
    }, [room?.partnerEmail]);

    // 방 전환 시 livePresence 리셋
    useEffect(() => {
        setLivePresence(null);
    }, [room?.partnerEmail]);

    const baseActivity = profile ? formatLastActive(profile.lastActiveAt) : null;
    const activity = livePresence === null
        ? baseActivity
        : (livePresence
            ? { online: true, label: "현재 활동 중" }
            : baseActivity ?? { online: false, label: "오프라인" });

    return (
        <>
            {open && (
                <Box
                    onClick={onClose}
                    sx={{
                        position: "fixed",
                        inset: 0,
                        zIndex: Z.FAB,
                        // 카드로 포커스를 모으는 scrim — 뒤 채팅이 그대로 비치던 문제 보완
                        bgcolor: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.28)",
                        animation: "dmPillScrimIn 0.18s ease-out",
                        "@keyframes dmPillScrimIn": { from: { opacity: 0 }, to: { opacity: 1 } },
                    }}
                />
            )}

            <Box sx={{ flex: 1, minWidth: 0, position: "relative", zIndex: Z.FAB }}>
                <Box
                    sx={{
                        position: "relative",
                        zIndex: Z.FAB,
                        bgcolor: bg,
                        ...blurSx("blur(24px)"),
                        border: `0.5px solid ${border}`,
                        borderRadius: open ? "18px" : "99px",
                        boxShadow: open ? shadow : "none",
                        overflow: open ? "clip" : "hidden",
                        transition: "border-radius 0.24s ease, box-shadow 0.24s ease",
                    }}
                >
                    <Box
                        onClick={onToggle}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                            minWidth: 0,
                            px: "10px",
                            py: open ? "10px" : "6px",
                            pl: "6px",
                            cursor: "pointer",
                            transition: "padding 0.24s ease",
                            "&:active": { opacity: 0.82 },
                        }}
                    >
                        <Avatar
                            src={
                                room?.partnerProfileImageUrl
                                    ? resolveImageUrl(room.partnerProfileImageUrl)
                                    : undefined
                            }
                            sx={{
                                width: open ? 40 : 32,
                                height: open ? 40 : 32,
                                fontSize: open ? 15 : 13,
                                fontWeight: 700,
                                flexShrink: 0,
                                transition: "all 0.24s ease",
                            }}
                        >
                            {room?.partnerName?.charAt(0)}
                        </Avatar>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                                sx={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: textColor,
                                    lineHeight: 1.2,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {room?.partnerName}
                            </Typography>

                            {open && (
                                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.3 }}>
                                    <Box
                                        sx={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: "50%",
                                            bgcolor: activity?.online ? PRESENCE_ONLINE_COLOR : muted,
                                            boxShadow: activity?.online
                                                ? "0 0 0 2px rgba(34,197,94,0.25)"
                                                : "none",
                                            flexShrink: 0,
                                        }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: 11,
                                            color: activity?.online ? PRESENCE_ONLINE_COLOR : muted,
                                            fontWeight: activity?.online ? 600 : 400,
                                        }}
                                    >
                                        {activity ? activity.label : "활동 기록 없음"}
                                    </Typography>
                                </Stack>
                            )}
                        </Box>

                        {open && ROLE_LABEL[profile?.role] && (
                            <Box
                                sx={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    flexShrink: 0,
                                    color: profile.role === "OWNER" ? primaryColor : muted,
                                    bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                                    borderRadius: 99,
                                    px: 1.25,
                                    py: "2px",
                                    border: `0.5px solid ${border}`,
                                }}
                            >
                                {ROLE_LABEL[profile.role] ?? ""}
                            </Box>
                        )}

                        <Box
                            component={open ? "button" : "div"}
                            onClick={
                                open
                                    ? (e) => {
                                        e.stopPropagation();
                                        onClose();
                                    }
                                    : undefined
                            }
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                border: "none",
                                cursor: open ? "pointer" : "default",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: open
                                    ? isDark
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(0,0,0,0.05)"
                                    : "transparent",
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(28,28,30,0.55)",
                                flexShrink: 0,
                                transition: "all 0.24s ease",
                            }}
                        >
                            {open ? (
                                <CloseRoundedIcon sx={{ fontSize: 16 }} />
                            ) : (
                                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 20 }} />
                            )}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            maxHeight: open ? "calc(75dvh - 80px)" : 0,
                            opacity: open ? 1 : 0,
                            overflowY: open ? "auto" : "hidden",
                            overflowX: "hidden",
                            WebkitOverflowScrolling: "touch",
                            pointerEvents: open ? "auto" : "none",
                            transition: "max-height 0.26s ease-out, opacity 0.16s ease-out",
                        }}
                    >
                        <Box sx={{ px: 2, pt: 0.5, pb: 2, borderTop: `0.5px solid ${border}` }}>
                            {room?.partnerEmail && (
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={0.5}
                                    sx={{ py: 1.25, borderBottom: `0.5px solid ${border}` }}
                                >
                                    <MailOutlineRoundedIcon
                                        sx={{ fontSize: 13, color: muted, flexShrink: 0 }}
                                    />
                                    <Typography
                                        sx={{
                                            fontSize: 12.5,
                                            color: muted,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {room.partnerEmail}
                                    </Typography>
                                </Stack>
                            )}

                            <Box sx={{ mt: 1.75 }}>
                                <Typography sx={SECTION_LABEL_SX}>함께하는 할 일</Typography>
                                {loadingProfile ? (
                                    [1, 2, 3].map((i) => (
                                        <Skeleton key={i} height={32} sx={{ mb: 0.5, borderRadius: 1 }} />
                                    ))
                                ) : (
                                    <SharedTodoList
                                        todos={profile?.sharedTodos ?? []}
                                        onTodoClick={(id) => {
                                            onClose();
                                            openTodoDetail(id);
                                        }}
                                        compact
                                    />
                                )}
                            </Box>

                            <Box sx={{ mt: 1.75, pt: 1.75, borderTop: `0.5px solid ${border}` }}>
                                <Typography sx={SECTION_LABEL_SX}>공유 파일</Typography>
                                {loadingProfile ? (
                                    [1, 2].map((i) => (
                                        <Skeleton key={i} height={28} sx={{ mb: 0.5, borderRadius: 1 }} />
                                    ))
                                ) : (
                                    <SharedFileSection
                                        files={profile?.sharedFiles ?? []}
                                        imageSize={60}
                                        compact
                                        onPreview={openPreview}
                                    />
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </>
    );
}