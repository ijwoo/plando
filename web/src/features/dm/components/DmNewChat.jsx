import React, { useState, useEffect } from "react";
import {
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
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { fetchAllUsers } from "../../../shared/api/userApi.js";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { getOrCreateRoom, createGroupRoom } from "../api/dmApi.js";
import { getUser } from "../../../shared/utils/tokenUtils.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";

export default function DmNewChat({ onRoomReady, defaultGroupMode = false }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const { currentWorkspace } = useWorkspace();

    const [mode, setMode] = useState(defaultGroupMode ? "group" : "dm");
    const [users, setUsers] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(null);
    const [creating, setCreating] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selected, setSelected] = useState([]);

    const myEmail = getUser()?.email;

    useEffect(() => {
        fetchAllUsers()
            .then((res) => setUsers((res.data || []).filter((u) => u.email !== myEmail)))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [myEmail]);

    const filtered = users.filter((u) =>
        u.name?.toLowerCase().includes(query.toLowerCase()) ||
        u.email?.toLowerCase().includes(query.toLowerCase())
    );

    const toggleUser = (user) => {
        setSelected((prev) =>
            prev.some((u) => u.id === user.id)
                ? prev.filter((u) => u.id !== user.id)
                : [...prev, user]
        );
    };

    const handleSelectDm = async (user) => {
        if (!user.id || starting) return;
        setStarting(user.id);
        try {
            const res = await getOrCreateRoom(user.id);
            onRoomReady?.(res.data);
        } catch (e) {
            console.error("DM room error", e);
        } finally {
            setStarting(null);
        }
    };

    const handleGroupCreate = async () => {
        if (!selected.length || creating) return;
        setCreating(true);
        try {
            const name = groupName.trim() || currentWorkspace?.name || null;
        const res = await createGroupRoom(
                name,
                selected.map((u) => u.id)
            );
            onRoomReady?.(res.data);
        } catch {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message: "그룹 채팅방 생성에 실패했습니다.", severity: "error" } }));
        } finally {
            setCreating(false);
        }
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* 모드 토글 — Toss 스타일 segmented pill (gray track + white pill) */}
            <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
                <Box
                    sx={{
                        display: "flex",
                        gap: 0.5,
                        p: 0.5,
                        bgcolor: isDark ? "rgba(255,255,255,0.06)" : "#F2F4F6",
                        borderRadius: 999,
                    }}
                >
                    {[
                        { id: "dm", label: "1:1 대화", Icon: PersonRoundedIcon },
                        { id: "group", label: "그룹 채팅", Icon: GroupsRoundedIcon },
                    ].map((opt) => {
                        const active = mode === opt.id;
                        const Icon = opt.Icon;
                        return (
                            <Box
                                key={opt.id}
                                component="button"
                                onClick={() => { setMode(opt.id); setSelected([]); }}
                                sx={{
                                    flex: 1,
                                    height: 40,
                                    borderRadius: 999,
                                    border: "none",
                                    bgcolor: active
                                        ? (isDark ? "rgba(255,255,255,0.10)" : "#FFFFFF")
                                        : "transparent",
                                    color: active ? primary : "text.secondary",
                                    fontWeight: 700,
                                    fontSize: 14,
                                    letterSpacing: "-0.01em",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.75,
                                    boxShadow: active
                                        ? (isDark ? "none" : "0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)")
                                        : "none",
                                    transition: "all 0.2s",
                                    fontFamily: "inherit",
                                }}
                            >
                                <Icon sx={{ fontSize: 16 }} />
                                {opt.label}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* 그룹 이름 입력 */}
            {mode === "group" && (
                <Box sx={{ px: 1.5, pb: 1 }}>
                    <TextField
                        fullWidth size="small"
                        placeholder="채팅방 이름(선택)"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        InputProps={{ sx: { borderRadius: 2.5 } }}
                    />
                </Box>
            )}

            {/* 선택된 멤버 태그 */}
            {mode === "group" && selected.length > 0 && (
                <Box sx={{ px: 1.5, pb: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
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
            <Box sx={{ px: 1.5, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                <TextField
                    fullWidth size="small"
                    placeholder="이름 또는 이메일 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                            </InputAdornment>
                        ),
                        sx: { borderRadius: 2.5 },
                    }}
                />
            </Box>

            {/* 유저 목록 */}
            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                    <CircularProgress size={28} />
                </Box>
            ) : (
                <List disablePadding sx={{ overflowY: "auto", flex: 1 }}>
                    {filtered.map((user) => {
                        const isChecked = selected.some((u) => u.id === user.id);
                        return (
                            <ListItemButton
                                key={user.id || user.email}
                                onClick={() =>
                                    mode === "dm" ? handleSelectDm(user) : toggleUser(user)
                                }
                                disabled={mode === "dm" && starting === user.id}
                                sx={{
                                    py: 1.25, px: 2,
                                    bgcolor: mode === "group" && isChecked
                                        ? isDark ? alpha(primary, 0.08) : alpha(primary, 0.05)
                                        : "transparent",
                                }}
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        src={user.profileImageUrl ? resolveImageUrl(user.profileImageUrl) : undefined}
                                        sx={{ width: 40, height: 40 }}
                                    >
                                        {user.name?.charAt(0)}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {user.name}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            {user.email}
                                        </Typography>
                                    }
                                />
                                {mode === "dm" && starting === user.id && (
                                    <CircularProgress size={18} />
                                )}
                                {mode === "group" && (
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
                        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                            {/* 검색 전(멤버 없음)과 검색 결과 없음을 구분 */}
                            <Typography variant="body2">
                                {query.trim() ? "검색 결과가 없어요" : "대화할 멤버가 아직 없어요"}
                            </Typography>
                            {!query.trim() && (
                                <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                                    워크스페이스에 멤버를 초대해보세요
                                </Typography>
                            )}
                        </Box>
                    )}
                </List>
            )}

            {/* 그룹 만들기 버튼 */}
            {mode === "group" && (
                <Box sx={{ px: 1.5, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                    <Button
                        fullWidth
                        variant="contained"
                        disabled={!selected.length || creating}
                        onClick={handleGroupCreate}
                        sx={{ borderRadius: 2.5, fontWeight: 700, py: 1.1 }}
                    >
                        {creating ? (
                            <CircularProgress size={18} sx={{ color: "inherit" }} />
                        ) : (
                            `그룹 만들기${selected.length > 0 ? ` (${selected.length}명)` : ""}`
                        )}
                    </Button>
                </Box>
            )}
        </Box>
    );
}
