import React from "react";
import {
    Avatar,
    Badge,
    Box,
    Skeleton,
    Stack,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { formatTimeAgo } from "../../../shared/utils/formatters.js";
import { getAvatarTone } from "../../../shared/utils/avatarUtils.js";
import Press from "../../../shared/ui/primitives/Press.jsx";

/**
 * 밀도 토큰 — 모바일 전체화면 목록(기본) / 데스크탑 맥락 패널(dense, 폭 236px).
 * 레이아웃은 하나뿐이고 치수만 두 벌이다.
 */
function metrics(dense) {
    return dense
        ? { avatar: 38, avatarFont: 15, groupIcon: 18, padding: "10px 12px", gap: 10, name: 14, sub: 12.5, time: 11, divider: 1.5 }
        : { avatar: 48, avatarFont: 18, groupIcon: 22, padding: "14px 20px", gap: 14, name: 15.5, sub: 13.5, time: 12, divider: 2 };
}

function RoomListSkeleton({ dense }) {
    const m = metrics(dense);
    return (
        <Box sx={{ pb: 1.5 }}>
            {[0, 1, 2, 3, 4].map((i) => (
                <Box
                    key={i}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: `${m.gap}px`,
                        padding: m.padding,
                    }}
                >
                    <Skeleton variant="circular" width={m.avatar} height={m.avatar} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Skeleton variant="text" width="34%" height={20} />
                        <Skeleton variant="text" width="70%" height={18} />
                    </Box>
                </Box>
            ))}
        </Box>
    );
}

function EmptyState() {
    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 260,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                px: 3,
                textAlign: "center",
            }}
        >
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: "text.primary" }}>
                대화가 없어요
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: 13, lineHeight: 1.5, color: "text.secondary" }}>
                새 대화를 시작하면 여기에 목록이 표시됩니다.
            </Typography>
        </Box>
    );
}

function UnreadBadge({ count }) {
    if (!count || count <= 0) return null;
    return (
        <Box
            sx={{
                minWidth: 20,
                height: 20,
                px: count > 9 ? 0.75 : 0.5,
                borderRadius: 999,
                bgcolor: "#EF4444",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1,
                flexShrink: 0,
            }}
        >
            {count > 99 ? "99+" : count}
        </Box>
    );
}

function DmRoomItem({ room, selected, onSelect, dense = false }) {
    const theme = useTheme();
    const m = metrics(dense);
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const unreadCount = room?.unreadCount || 0;
    const hasUnread = unreadCount > 0;

    const isGroup = room?.isGroup;
    const displayName = isGroup
        ? (room?.groupName || "그룹 채팅")
        : (room?.partnerName || "이름 없음");
    const tone = getAvatarTone(displayName);
    const avatarSrc = isGroup
        ? (room?.groupImageUrl ? resolveImageUrl(room.groupImageUrl) : undefined)
        : (room?.partnerProfileImageUrl ? resolveImageUrl(room.partnerProfileImageUrl) : undefined);
    const secondaryText = room?.lastMessage || (isGroup
        ? `${room?.memberCount || 0}명 참여 중`
        : (room?.partnerEmail || "대화를 시작해보세요"));

    const avatarEl = (
        <Avatar
            src={avatarSrc}
            sx={{
                width: m.avatar,
                height: m.avatar,
                fontSize: isGroup ? m.avatarFont + 2 : m.avatarFont,
                fontWeight: 800,
                bgcolor: isGroup
                    ? alpha(primary, isDark ? 0.22 : 0.12)
                    : tone.bg,
                color: isGroup ? primary : tone.color,
                border: "1px solid rgba(0,0,0,0.04)",
                flexShrink: 0,
            }}
        >
            {isGroup
                ? <GroupsRoundedIcon sx={{ fontSize: m.groupIcon }} />
                : displayName.charAt(0).toUpperCase()}
        </Avatar>
    );

    return (
        <Press
            onClick={() => onSelect?.(room)}
            haptic="light"
            pressScale={0.99}
            activeBg={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
            style={{
                display: "flex",
                alignItems: "center",
                gap: m.gap,
                padding: m.padding,
                background: selected
                    ? alpha(primary, isDark ? 0.10 : 0.06)
                    : "transparent",
            }}
        >
            <Badge
                overlap="circular"
                variant="dot"
                invisible={!hasUnread}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                sx={{
                    "& .MuiBadge-dot": {
                        bgcolor: "#EF4444",
                        width: 10,
                        height: 10,
                        // 안읽음 점 테두리 = 행 배경색. 데스크탑 패널은 background.paper, 모바일은 페이지 배경.
                        border: `2px solid ${dense ? theme.palette.background.paper : (isDark ? "#0A0A0F" : "#F5F6F8")}`,
                    },
                }}
            >
                {avatarEl}
            </Badge>

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.35 }}>
                    <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontWeight: hasUnread ? 800 : 700,
                                fontSize: m.name,
                                letterSpacing: "-0.02em",
                                color: "text.primary",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                lineHeight: 1.25,
                            }}
                        >
                            {displayName}
                        </Typography>
                        {isGroup && room?.memberCount > 0 && (
                            <Typography sx={{ fontSize: m.time + 0.5, fontWeight: 700, color: "text.disabled", flexShrink: 0, letterSpacing: "-0.01em" }}>
                                {room.memberCount}
                            </Typography>
                        )}
                    </Stack>
                    <Typography
                        sx={{
                            fontSize: m.time,
                            color: hasUnread ? "text.secondary" : "text.disabled",
                            fontWeight: hasUnread ? 600 : 500,
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {formatTimeAgo(room?.lastMessageAt)}
                    </Typography>
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography
                        sx={{
                            fontSize: m.sub,
                            color: hasUnread ? "text.primary" : "text.disabled",
                            fontWeight: hasUnread ? 600 : 500,
                            letterSpacing: "-0.01em",
                            lineHeight: 1.45,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        {secondaryText}
                    </Typography>
                    {hasUnread && <UnreadBadge count={unreadCount} />}
                </Stack>
            </Box>
        </Press>
    );
}

/**
 * 대화 목록 — 레이아웃은 하나(행), 밀도만 두 벌.
 * dense=true: 데스크탑 사이드바 맥락 패널(폭 236px) / 기본: 모바일 전체화면 목록.
 * selectedRoomId를 주면 선택된 행에 강조 배경이 들어간다(마스터/디테일에서 필수).
 */
export default function DmRoomList({
    rooms = [],
    loading = false,
    selectedRoomId = null,
    onSelect,
    dense = false,
}) {
    if (loading) return <RoomListSkeleton dense={dense} />;
    if (!rooms.length) return <EmptyState />;

    const dividerMx = metrics(dense).divider;

    return (
        <Box sx={{ pb: 1.5 }}>
            {rooms.map((room, idx) => (
                <React.Fragment key={room.id}>
                    <DmRoomItem
                        room={room}
                        selected={selectedRoomId != null && selectedRoomId === room.id}
                        onSelect={onSelect}
                        dense={dense}
                    />
                    {idx < rooms.length - 1 && (
                        <Box sx={{ height: "1px", bgcolor: "divider", mx: dividerMx, opacity: 0.55 }} />
                    )}
                </React.Fragment>
            ))}
        </Box>
    );
}
