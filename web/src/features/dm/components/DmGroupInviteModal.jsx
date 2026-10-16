import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    List,
    ListItemButton,
    ListItemAvatar,
    ListItemText,
    Avatar,
    TextField,
    InputAdornment,
    CircularProgress,
    Checkbox,
    Button,
    Chip,
    Stack,
    IconButton,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { fetchAllUsers } from "../../../shared/api/userApi.js";
import { toast } from "../../../shared/utils/toast.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { inviteToGroupRoom } from "../api/dmApi.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { Z } from "../../../shared/ui/zIndex.js";

export default function DmGroupInviteModal({ open, onClose, room, onInvited }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;

    const [users, setUsers] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [selected, setSelected] = useState([]);
    const [loadError, setLoadError] = useState("");

    const myEmail = getUser()?.email;
    const existingIds = new Set(room?.memberIds ?? []);

    useEffect(() => {
        if (!open) return;
        setSelected([]);
        setQuery("");
        setLoading(true);
        fetchAllUsers()
            .then((res) => {
                setUsers((res.data || []).filter((u) => u.email !== myEmail));
                setLoadError("");
            })
            // 조회 실패를 삼키면 "초대할 수 있는 멤버가 없어요"로 보여서 사용자가 잘못 이해한다
            .catch((e) => setLoadError(getApiError(e, "멤버 목록을 불러오지 못했어요.")))
            .finally(() => setLoading(false));
    }, [open, myEmail]);

    const filtered = users.filter((u) => {
        const q = query.toLowerCase();
        return (
            (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        );
    });

    const toggleUser = (user) => {
        setSelected((prev) =>
            prev.some((u) => u.id === user.id)
                ? prev.filter((u) => u.id !== user.id)
                : [...prev, user]
        );
    };

    const handleInvite = async () => {
        if (!selected.length || inviting) return;
        setInviting(true);
        try {
            const res = await inviteToGroupRoom(room.id, selected.map((u) => u.id));
            onInvited?.(res.data);
            onClose();
        } catch (e) {
            // 콘솔에만 찍으면 사용자는 모달이 그대로 있는 이유(권한·이미 참여·인원 초과 등)를 알 수 없다.
            // 서버가 내려주는 한국어 사유를 그대로 보여준다.
            console.error("초대 실패", e);
            toast.error(getApiError(e, "멤버를 초대하지 못했어요."));
        } finally {
            setInviting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            sx={{ zIndex: Z.MODAL_NESTED }}
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    bgcolor: isDark ? "#141428" : "#fff",
                    backgroundImage: "none",
                    boxShadow: isDark
                        ? "0 24px 48px rgba(0,0,0,0.5)"
                        : "0 24px 48px rgba(0,0,0,0.12)",
                },
            }}
        >
            <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 800, fontSize: 17 }}>멤버 초대</Typography>
                <IconButton size="small" onClick={onClose}>
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ px: 2, pb: 0 }}>
                {/* 선택된 멤버 태그 */}
                {selected.length > 0 && (
                    <Box sx={{ mb: 1.25, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((u) => (
                            <Chip
                                key={u.id}
                                label={u.name}
                                size="small"
                                onDelete={() => toggleUser(u)}
                                deleteIcon={<CloseRoundedIcon sx={{ fontSize: 13 }} />}
                                sx={{
                                    height: 26, fontSize: 12.5, fontWeight: 600,
                                    bgcolor: isDark ? alpha(primary, 0.14) : alpha(primary, 0.08),
                                    color: primary,
                                    border: "1px solid",
                                    borderColor: isDark ? alpha(primary, 0.25) : alpha(primary, 0.2),
                                    "& .MuiChip-deleteIcon": { color: alpha(primary, 0.6) },
                                }}
                            />
                        ))}
                    </Box>
                )}

                {/* 검색 */}
                <TextField
                    fullWidth size="small"
                    placeholder="이름 또는 이메일 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    sx={{ mb: 1 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                            </InputAdornment>
                        ),
                        sx: { borderRadius: 2.5 },
                    }}
                />

                {/* 유저 목록 */}
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size={28} />
                    </Box>
                ) : (
                    <List disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
                        {filtered.map((user) => {
                            const isChecked = selected.some((u) => u.id === user.id);
                            const alreadyMember = existingIds.has(user.id);
                            return (
                                <ListItemButton
                                    key={user.id || user.email}
                                    onClick={() => !alreadyMember && toggleUser(user)}
                                    disabled={alreadyMember}
                                    sx={{
                                        py: 1, px: 1, borderRadius: 2,
                                        bgcolor: isChecked
                                            ? isDark ? alpha(primary, 0.08) : alpha(primary, 0.05)
                                            : "transparent",
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar
                                            src={user.profileImageUrl ? resolveImageUrl(user.profileImageUrl) : undefined}
                                            sx={{ width: 38, height: 38 }}
                                        >
                                            {user.name?.charAt(0)}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {user.name}
                                                </Typography>
                                                {alreadyMember && (
                                                    <Typography sx={{ fontSize: 10.5, color: "text.disabled" }}>
                                                        이미 참여 중
                                                    </Typography>
                                                )}
                                            </Stack>
                                        }
                                        secondary={
                                            <Typography variant="caption" color="text.secondary">
                                                {user.email}
                                            </Typography>
                                        }
                                    />
                                    {!alreadyMember && (
                                        <Checkbox
                                            checked={isChecked}
                                            size="small"
                                            sx={{ color: "text.disabled", "&.Mui-checked": { color: primary } }}
                                        />
                                    )}
                                </ListItemButton>
                            );
                        })}
                        {!filtered.length && (
                            <Box sx={{ p: 2.5, textAlign: "center", color: "text.secondary" }}>
                                {/* 조회 실패 / 검색 전(초대 가능 멤버 없음) / 검색 결과 없음을 구분 */}
                                <Typography variant="body2" color={loadError ? "error.main" : "text.secondary"}>
                                    {loadError || (query.trim() ? "검색 결과가 없어요" : "초대할 수 있는 멤버가 없어요")}
                                </Typography>
                            </Box>
                        )}
                    </List>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 2, py: 1.5 }}>
                <Button onClick={onClose} sx={{ borderRadius: 2.5, fontWeight: 700 }}>취소</Button>
                <Button
                    variant="contained"
                    disabled={!selected.length || inviting}
                    onClick={handleInvite}
                    sx={{ borderRadius: 2.5, fontWeight: 700, minWidth: 90 }}
                >
                    {inviting
                        ? <CircularProgress size={16} sx={{ color: "inherit" }} />
                        : `초대 (${selected.length}명)`
                    }
                </Button>
            </DialogActions>
        </Dialog>
    );
}
