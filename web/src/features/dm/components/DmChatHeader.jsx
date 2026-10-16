import React, { useState, useEffect } from "react";
import {
    Box,
    Stack,
    Typography,
    Avatar,
    IconButton,
    Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { Z } from "../../../shared/ui/zIndex.js";
import { fetchPartnerProfile } from "../api/dmApi.js";
import { formatLastActive, isOnlineRecently } from "../../../shared/utils/formatters.js";
import { PRESENCE_ONLINE_COLOR } from "../constants/dmTags.js";
import ExpandableProfilePill from "./ExpandableProfilePill.jsx";
import DmPartnerProfileModal from "./DmPartnerProfileModal.jsx";
import DmGroupInviteModal from "./DmGroupInviteModal.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";

export default function DmChatHeader({
    room,
    onBack,
    profileOpen,
    setProfileOpen,
    isDark,
    border,
    primaryColor,
    textColor,
    openPreview,
    isDesktop = false,
    onRoomUpdated,
    onSearch,
}) {
    const [partnerModalOpen, setPartnerModalOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [activity, setActivity] = useState(null);
    const [partnerOnline, setPartnerOnline] = useState(false);
    /** STOMP presence broadcast로 받은 실시간 상태. true/false면 lastActiveAt보다 우선.
        (ExpandableProfilePill이 쓰던 방식과 동일 — 헤더만 구독을 안 해서 같은 화면에서
         프로필 필은 "현재 활동 중", 헤더는 "3일 전 활동"이 동시에 뜰 수 있었다) */
    const [livePresence, setLivePresence] = useState(null);

    const isGroup = room?.isGroup;

    useEffect(() => {
        if (!isDesktop || isGroup || !room?.id) return;
        fetchPartnerProfile(room.id)
            .then((r) => {
                setActivity(formatLastActive(r.data?.lastActiveAt));
                setPartnerOnline(isOnlineRecently(r.data?.lastActiveAt));
            })
            .catch(() => {});
    }, [room?.id, isGroup, isDesktop]);

    // presence broadcast 수신 — 상대가 접속/종료하면 방을 다시 열지 않아도 반영된다
    useEffect(() => {
        const handler = (e) => {
            const payload = e.detail;
            if (!payload?.email || payload.email !== room?.partnerEmail) return;
            setLivePresence(!!payload.online);
        };
        window.addEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
        return () => window.removeEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
    }, [room?.partnerEmail]);

    // 방 전환 시 이전 상대의 상태가 남지 않게 리셋
    useEffect(() => {
        setLivePresence(null);
    }, [room?.partnerEmail]);

    // 실시간 값이 있으면 그쪽이 우선, 없으면 마지막 활동 시각 기반 라벨
    const shownActivity = livePresence === null
        ? activity
        : (livePresence ? { online: true, label: "현재 활동 중" } : activity ?? { online: false, label: "오프라인" });
    const shownOnline = livePresence === null ? partnerOnline : livePresence;

    const displayName = isGroup
        ? (room?.groupName || "그룹 채팅")
        : room?.partnerName;
    const avatarSrc = isGroup
        ? (room?.groupImageUrl ? resolveImageUrl(room.groupImageUrl) : undefined)
        : (room?.partnerProfileImageUrl ? resolveImageUrl(room.partnerProfileImageUrl) : undefined);

    // ── 데스크탑 헤더 ──────────────────────────────────────
    if (isDesktop) {
        const actionBtnSx = {
            width: 32, height: 32, borderRadius: 1.5,
            border: "1px solid",
            borderColor: "var(--plando-surface-strong)",
            bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
            "&:hover": {
                bgcolor: "var(--plando-surface-mid)",
            },
        };

        return (
            <>
                <Box
                    sx={{
                        height: 58,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 2.5,
                        borderBottom: `1px solid ${border}`,
                        bgcolor: isDark ? "rgba(19,19,23,0.95)" : "rgba(248,248,252,0.92)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        flexShrink: 0,
                    }}
                >
                    {/* 왼쪽: 아바타 + 이름 */}
                    <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        onClick={isGroup ? undefined : () => setPartnerModalOpen(true)}
                        sx={{ cursor: isGroup ? "default" : "pointer", "&:hover": { opacity: isGroup ? 1 : 0.82 }, transition: "opacity 0.15s" }}
                    >
                        <Box sx={{ position: "relative", width: 36, height: 36 }}>
                            <Avatar
                                src={avatarSrc}
                                sx={{
                                    width: 36, height: 36, fontSize: 14, fontWeight: 700,
                                    bgcolor: isGroup ? alpha(primaryColor, isDark ? 0.2 : 0.12) : undefined,
                                    color: isGroup ? primaryColor : undefined,
                                }}
                            >
                                {isGroup ? <GroupsRoundedIcon sx={{ fontSize: 18 }} /> : displayName?.charAt(0)?.toUpperCase()}
                            </Avatar>
                            {!isGroup && shownOnline && (
                                <Box sx={{
                                    position: "absolute", right: -1, bottom: -1,
                                    width: 11, height: 11, borderRadius: "50%",
                                    bgcolor: PRESENCE_ONLINE_COLOR,
                                    border: `2px solid ${isDark ? "#0E0E16" : "#F8F8FC"}`,
                                }} />
                            )}
                        </Box>
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography sx={{ fontWeight: 800, fontSize: 15, color: textColor, lineHeight: 1.2 }}>
                                    {displayName}
                                </Typography>
                                {isGroup && room?.memberCount > 0 && (
                                    <Box sx={{
                                        fontSize: 10, fontWeight: 700,
                                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                        bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                                        border: "1px solid",
                                        borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)",
                                        borderRadius: "5px", px: 0.75, py: "1px",
                                    }}>
                                        {room.memberCount}명
                                    </Box>
                                )}
                                {!isGroup && room?.partnerEmail && (
                                    <Box sx={{
                                        fontSize: 10, fontWeight: 600,
                                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                                        bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                                        border: "1px solid",
                                        borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.09)",
                                        borderRadius: "5px", px: 0.75, py: "1px",
                                    }}>
                                        {room.partnerEmail.split("@")[0]}
                                    </Box>
                                )}
                            </Stack>
                            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 0.2 }}>
                                {isGroup ? (
                                    <Typography sx={{ fontSize: 10, color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.4)" }}>
                                        그룹 채팅
                                    </Typography>
                                ) : (
                                    <>
                                        <Box sx={{
                                            width: 6, height: 6, borderRadius: "50%",
                                            bgcolor: shownActivity?.online ? PRESENCE_ONLINE_COLOR : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.22)"),
                                            boxShadow: activity?.online ? "0 0 0 2px rgba(34,197,94,0.25)" : "none",
                                        }} />
                                        <Typography sx={{ fontSize: 10, color: shownActivity?.online ? PRESENCE_ONLINE_COLOR : (isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.4)"), fontWeight: shownActivity?.online ? 700 : 500 }}>
                                            {shownActivity?.label ?? "오프라인"}
                                        </Typography>
                                    </>
                                )}
                            </Stack>
                        </Box>
                    </Stack>

                    {/* 오른쪽: 액션 버튼 */}
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mr: 1 }}>
                            <Typography sx={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)" }}>메시지</Typography>
                            <Typography sx={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)" }}>›</Typography>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: primaryColor }}>{displayName}</Typography>
                        </Stack>

                        {/* 음성통화·화상통화·고정 — 미지원, 추후 활성화
                        <Tooltip title="음성통화">
                            <IconButton size="small" sx={actionBtnSx}>
                                <CallRoundedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="화상통화">
                            <IconButton size="small" sx={actionBtnSx}>
                                <VideocamRoundedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="고정">
                            <IconButton size="small" sx={actionBtnSx}>
                                <PushPinRoundedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                        </Tooltip>
                        */}
                        {onSearch && (
                            <Tooltip title="대화 내 검색">
                                <IconButton size="small" sx={actionBtnSx} onClick={onSearch}>
                                    <SearchRoundedIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        {isGroup ? (
                            <Tooltip title="멤버 초대">
                                <IconButton size="small" sx={actionBtnSx} onClick={() => setInviteOpen(true)}>
                                    <PersonAddRoundedIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <Tooltip title="프로필 보기">
                                <IconButton size="small" sx={actionBtnSx} onClick={() => setPartnerModalOpen(true)}>
                                    <PersonRoundedIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                </Box>

                {!isGroup && (
                    <DmPartnerProfileModal
                        open={partnerModalOpen}
                        onClose={() => setPartnerModalOpen(false)}
                        room={room}
                    />
                )}
                {isGroup && (
                    <DmGroupInviteModal
                        open={inviteOpen}
                        onClose={() => setInviteOpen(false)}
                        room={room}
                        onInvited={onRoomUpdated}
                    />
                )}
            </>
        );
    }

    // ── 모바일 헤더 ────────────────────────────────────────
    const backBtnSx = {
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 44, width: 44, borderRadius: "50%",
        pointerEvents: "auto",
        bgcolor: isDark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.82)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `0.5px solid ${border}`,
        boxShadow: isDark ? "none" : "0 1px 6px rgba(0,0,0,0.08)",
        cursor: "pointer", flexShrink: 0,
    };

    // 그룹 채팅: 그룹 헤더 pill
    if (isGroup) {
        return (
            <>
                <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: Z.FAB, pointerEvents: "none" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.25, minHeight: 60, pointerEvents: "none" }}>
                        {onBack && (
                            <Box component="button" onClick={onBack} sx={{ ...backBtnSx, flexShrink: 0 }}>
                                <ArrowBackIosNewRoundedIcon sx={{ fontSize: 16, color: "primary.main" }} />
                            </Box>
                        )}
                        {/* 그룹 정보 pill - flex-grow, 클릭하면 초대 모달 */}
                        <Box
                            onClick={() => setInviteOpen(true)}
                            sx={{
                                pointerEvents: "auto",
                                flex: 1, minWidth: 0,
                                display: "flex", alignItems: "center", gap: 1,
                                px: 1.5, py: 0.75,
                                height: 44,
                                borderRadius: 999,
                                bgcolor: isDark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.88)",
                                backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                                border: `0.5px solid ${border}`,
                                boxShadow: isDark ? "none" : "0 1px 8px rgba(0,0,0,0.1)",
                                cursor: "pointer",
                                "&:active": { opacity: 0.75 },
                            }}
                        >
                            <Avatar
                                sx={{
                                    width: 28, height: 28, flexShrink: 0,
                                    bgcolor: alpha(primaryColor, isDark ? 0.22 : 0.12),
                                }}
                            >
                                <GroupsRoundedIcon sx={{ fontSize: 15, color: primaryColor }} />
                            </Avatar>
                            <Typography
                                sx={{
                                    fontWeight: 700, fontSize: 15, color: textColor, lineHeight: 1,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    flex: 1, minWidth: 0,
                                }}
                            >
                                {displayName}
                            </Typography>
                            {room?.memberCount > 0 && (
                                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.disabled", flexShrink: 0 }}>
                                    {room.memberCount}명
                                </Typography>
                            )}
                            <PersonAddRoundedIcon sx={{ fontSize: 16, color: primaryColor, flexShrink: 0, opacity: 0.7 }} />
                        </Box>
                    </Box>
                </Box>
                <DmGroupInviteModal
                    open={inviteOpen}
                    onClose={() => setInviteOpen(false)}
                    room={room}
                    onInvited={onRoomUpdated}
                />
            </>
        );
    }

    // 1:1 채팅: 기존 ExpandableProfilePill
    return (
        <>
            <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: Z.FAB, pointerEvents: "none" }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 1.5, py: 1.25, background: "transparent", minHeight: 60, pointerEvents: "none" }}>
                    {onBack && !profileOpen && (
                        <Box component="button" onClick={onBack} sx={{ ...backBtnSx }}>
                            <ArrowBackIosNewRoundedIcon sx={{ fontSize: 16, color: "primary.main" }} />
                        </Box>
                    )}
                    {onSearch && !profileOpen && (
                        <Box component="button" onClick={onSearch} sx={{ ...backBtnSx, order: 2, flexShrink: 0, pointerEvents: "auto" }}>
                            <SearchRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                        </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0, pointerEvents: "auto" }}>
                        <ExpandableProfilePill
                            room={room}
                            open={profileOpen}
                            onToggle={() => setProfileOpen((v) => !v)}
                            onClose={() => setProfileOpen(false)}
                            isDark={isDark}
                            border={border}
                            primaryColor={primaryColor}
                            textColor={textColor}
                            openPreview={openPreview}
                        />
                    </Box>
                </Box>
            </Box>
        </>
    );
}
