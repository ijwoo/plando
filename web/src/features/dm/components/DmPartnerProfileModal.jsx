import React, { useEffect, useState } from "react";
import {
    Box,
    Dialog,
    DialogContent,
    IconButton,
    Skeleton,
    Stack,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";

import { fetchPartnerProfile } from "../api/dmApi.js";
import { formatLastActive } from "../../../shared/utils/formatters.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { PRESENCE_ONLINE_COLOR } from "../constants/dmTags.js";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { getDialogTokens } from "../../../shared/ui/dialogTokens.js";
import { Z } from "../../../shared/ui/zIndex.js";
import UserAvatar from "../../../shared/ui/common/UserAvatar.jsx";
import FieldLabel from "../../../shared/ui/common/FieldLabel.jsx";
import SharedTodoList from "./SharedTodoList.jsx";
import SharedFileSection from "./SharedFileSection.jsx";
import { ROLE_LABEL } from "../../workspace/hooks/useWorkspacePermissions.js";

export default function DmPartnerProfileModal({ open, onClose, room }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const tok = getDialogTokens(theme);

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [livePresence, setLivePresence] = useState(null);
    const openTodoDetail = useOpenTodoDetail();

    useEffect(() => {
        if (!open || !room?.id) return;
        setLoading(true);
        fetchPartnerProfile(room.id)
            .then((r) => setProfile(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open, room?.id]);

    // STOMP presence 실시간 갱신
    useEffect(() => {
        const handler = (e) => {
            const payload = e.detail;
            if (payload?.email !== room?.partnerEmail) return;
            setLivePresence(!!payload.online);
        };
        window.addEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
        return () => window.removeEventListener(APP_EVENTS.PRESENCE_CHANGED, handler);
    }, [room?.partnerEmail]);

    useEffect(() => { setLivePresence(null); }, [room?.partnerEmail]);

    const baseActivity = profile ? formatLastActive(profile.lastActiveAt) : null;
    const activity = livePresence === null
        ? baseActivity
        : (livePresence
            ? { online: true, label: "현재 활동 중" }
            : baseActivity ?? { online: false, label: "오프라인" });

    const sep = `1px solid ${tok.sep}`;
    const isOwner = profile?.role === "OWNER";

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            sx={{ zIndex: Z.DIALOG }}
            slotProps={{ backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.45)" } } }}
            PaperProps={{
                sx: {
                    bgcolor: tok.bg,
                    backgroundImage: "none",
                    border: `1px solid ${tok.border}`,
                    borderRadius: "16px",
                    overflow: "hidden",
                },
            }}
        >
            <DialogContent sx={{ p: 0 }}>
                {/* 헤더 — 닫기 버튼 + 가운데 아바타/이름/상태 */}
                <Box sx={{ px: 3, pt: 2, pb: 2.25, borderBottom: sep, position: "relative" }}>
                    <IconButton
                        onClick={onClose}
                        size="small"
                        sx={{
                            position: "absolute", top: 10, right: 10,
                            color: tok.text2,
                            bgcolor: tok.inputBg,
                            "&:hover": { bgcolor: tok.border },
                        }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>

                    <Stack direction="row" alignItems="center" spacing={1.75}>
                        {loading ? (
                            <Skeleton variant="circular" width={64} height={64} sx={{ flexShrink: 0 }} />
                        ) : (
                            <UserAvatar
                                name={profile?.partnerName}
                                src={profile?.partnerProfileImageUrl ? resolveImageUrl(profile.partnerProfileImageUrl) : undefined}
                                size={64}
                                sx={{ fontSize: 24, fontWeight: 800, flexShrink: 0 }}
                            />
                        )}

                        <Box sx={{ flex: 1, minWidth: 0, pr: 3 }}>
                            {loading ? (
                                <>
                                    <Skeleton width={140} height={24} sx={{ mb: 0.5 }} />
                                    <Skeleton width={180} height={16} />
                                </>
                            ) : (
                                <>
                                    <Typography sx={{ fontWeight: 800, fontSize: 19, color: tok.text, lineHeight: 1.2, letterSpacing: "-0.01em" }} noWrap>
                                        {profile?.partnerName}
                                    </Typography>
                                    <Typography sx={{ fontSize: 12, color: tok.text2, mt: 0.25 }} noWrap>
                                        {profile?.partnerEmail}
                                    </Typography>
                                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
                                        <Box sx={{
                                            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                            bgcolor: activity?.online ? PRESENCE_ONLINE_COLOR : alpha(theme.palette.text.primary, 0.22),
                                            boxShadow: activity?.online ? `0 0 0 2px ${alpha(PRESENCE_ONLINE_COLOR, 0.25)}` : "none",
                                        }} />
                                        <Typography sx={{ fontSize: 12, color: activity?.online ? PRESENCE_ONLINE_COLOR : tok.text2, fontWeight: activity?.online ? 700 : 500 }} noWrap>
                                            {activity ? activity.label : "활동 기록 없음"}
                                        </Typography>
                                    </Stack>
                                </>
                            )}
                        </Box>
                    </Stack>
                </Box>

                {/* 워크스페이스 역할 */}
                {(loading || ROLE_LABEL[profile?.role]) && (
                    <Box sx={{ px: 3, py: 1.75, borderBottom: sep }}>
                        <FieldLabel>역할</FieldLabel>
                        {loading ? (
                            <Skeleton width={80} height={20} />
                        ) : (
                            <Box component="span" sx={{
                                display: "inline-flex", alignItems: "center",
                                fontSize: 11, fontWeight: 800,
                                color: isOwner ? "primary.main" : tok.text2,
                                bgcolor: alpha(isOwner ? primary : theme.palette.text.secondary, isDark ? 0.18 : 0.10),
                                borderRadius: 999, px: 1.25, py: "3px",
                            }}>
                                {ROLE_LABEL[profile?.role] ?? ""}
                            </Box>
                        )}
                    </Box>
                )}

                {/* 함께하는 할 일 */}
                <Box sx={{ px: 3, py: 1.75, borderBottom: sep }}>
                    <FieldLabel>함께하는 할 일</FieldLabel>
                    {loading ? (
                        [1, 2, 3].map((i) => (
                            <Skeleton key={i} height={36} sx={{ mb: 0.5, borderRadius: 1 }} />
                        ))
                    ) : (
                        <SharedTodoList
                            todos={profile?.sharedTodos ?? []}
                            onTodoClick={openTodoDetail}
                        />
                    )}
                </Box>

                {/* 공유 파일 */}
                {(loading || profile?.sharedFiles?.length > 0) && (
                    <Box sx={{ px: 3, py: 1.75 }}>
                        <FieldLabel>공유 파일</FieldLabel>
                        {loading ? (
                            [1, 2].map((i) => (
                                <Skeleton key={i} height={32} sx={{ mb: 0.5, borderRadius: 1 }} />
                            ))
                        ) : (
                            <SharedFileSection
                                files={profile?.sharedFiles ?? []}
                                imageSize={72}
                            />
                        )}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
