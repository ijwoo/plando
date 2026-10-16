import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import {
    Box,
    Typography,
    IconButton,
    useMediaQuery,
    TextField,
    InputAdornment,
    Stack,
    alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { fetchDmRooms, getOrCreateRoom } from "../api/dmApi.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { DM_ROOM_OPENED } from "../constants/dmEvents.js";
import DmRoomList from "../components/DmRoomList.jsx";
import DmChatRoom from "../components/DmChatRoom.jsx";
import DmNewChat from "../components/DmNewChat.jsx";

export default function DmPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const isDark = theme.palette.mode === "dark";
    const { currentWorkspace } = useWorkspace();
    const location = useLocation();

    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showNewChat, setShowNewChat] = useState(false);
    const [groupMode, setGroupMode] = useState(false);
    const [keyword, setKeyword] = useState("");

    // location.state에서 자동 선택할 room/partner 처리
    const pendingStateRef = useRef(location.state ?? null);

    const loadRooms = useCallback(() => {
        setLoadingRooms(true);
        fetchDmRooms()
            .then((res) => {
                const loaded = res.data || [];
                setRooms(loaded);
                // 검색 결과에서 넘어온 경우: 바로 해당 룸 열기
                const pending = pendingStateRef.current;
                if (pending?.openRoomId) {
                    const match = loaded.find((r) => r.id === pending.openRoomId);
                    if (match) { setSelectedRoom(match); setShowNewChat(false); }
                    pendingStateRef.current = null;
                } else if (pending?.openPartnerId) {
                    getOrCreateRoom(pending.openPartnerId)
                        .then((r) => {
                            const room = r.data;
                            setRooms((prev) => {
                                const exists = prev.find((x) => x.id === room.id);
                                return exists ? prev : [room, ...prev];
                            });
                            setSelectedRoom(room);
                            setShowNewChat(false);
                        })
                        .catch(() => {});
                    pendingStateRef.current = null;
                }
            })
            .catch(() => {})
            .finally(() => setLoadingRooms(false));
    }, []);

    useEffect(() => {
        setSelectedRoom(null);
        setShowNewChat(false);
        pendingStateRef.current = location.state ?? null;
        loadRooms();
    }, [currentWorkspace?.workspaceId, loadRooms]);

    // 새 메시지/수정/삭제/읽음 등으로 방 목록 미리보기·순서가 낡지 않도록
    // DM_UNREAD_CHANGED 이벤트 시 조용히 재조회 (로딩 스피너 없이 — 사이드바 패널과 동일 이벤트)
    useEffect(() => {
        const onChanged = () => {
            fetchDmRooms()
                .then((res) => setRooms(res.data || []))
                .catch(() => {});
        };
        window.addEventListener(APP_EVENTS.DM_UNREAD_CHANGED, onChanged);
        return () => window.removeEventListener(APP_EVENTS.DM_UNREAD_CHANGED, onChanged);
    }, []);

    // 열린 대화방 브로드캐스트 — 사이드바 목록(마스터)이 선택 상태를 표시할 수 있게.
    // 첫 렌더의 null은 보내지 않는다 — 사이드바가 방금 낙관적으로 잡은 선택을 지워 깜빡이기 때문.
    const broadcastedRoomRef = useRef(undefined);
    useEffect(() => {
        const roomId = selectedRoom?.id ?? null;
        if (broadcastedRoomRef.current === undefined && roomId == null) {
            broadcastedRoomRef.current = null;
            return;
        }
        if (broadcastedRoomRef.current === roomId) return;
        broadcastedRoomRef.current = roomId;
        window.dispatchEvent(new CustomEvent(DM_ROOM_OPENED, { detail: { roomId } }));
    }, [selectedRoom?.id]);

    // 언마운트(다른 섹션으로 이동/로그아웃) 시 선택 해제 브로드캐스트
    useEffect(() => () => {
        window.dispatchEvent(new CustomEvent(DM_ROOM_OPENED, { detail: { roomId: null } }));
    }, []);

    // 사이드바 DM 패널에서 /dm으로 재네비게이트(같은 페이지) 시 방 열기/새 대화 반영
    useEffect(() => {
        const st = location.state;
        if (!st) return;
        if (st.newChat) {
            setGroupMode(false);
            setShowNewChat(true);
            setSelectedRoom(null);
            return;
        }
        if (st.openRoomId) {
            const match = rooms.find((r) => r.id === st.openRoomId);
            if (match) { setSelectedRoom(match); setShowNewChat(false); }
            else { pendingStateRef.current = st; loadRooms(); }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    const handleSelectRoom = (room) => {
        setSelectedRoom(room);
        setShowNewChat(false);
        setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, unreadCount: 0 } : r));
        window.dispatchEvent(new Event(APP_EVENTS.DM_UNREAD_CHANGED));
    };

    const handleNewRoomReady = (room) => {
        setShowNewChat(false);
        setSelectedRoom(room);
        loadRooms();
    };

    const handleBack = () => {
        setSelectedRoom(null);
        setShowNewChat(false);
        loadRooms();
    };

    const filteredRooms = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return rooms;
        return rooms.filter((room) => {
            const lastMessage = (room?.lastMessage || "").toLowerCase();
            if (room?.isGroup) {
                const groupName = (room?.groupName || "그룹 채팅").toLowerCase();
                return groupName.includes(q) || lastMessage.includes(q);
            }
            const partnerName = (room?.partnerName || "").toLowerCase();
            const partnerEmail = (room?.partnerEmail || "").toLowerCase();
            return partnerName.includes(q) || partnerEmail.includes(q) || lastMessage.includes(q);
        });
    }, [rooms, keyword]);

    const unreadCount = filteredRooms.reduce(
        (sum, room) => sum + (room?.unreadCount || 0),
        0
    );

    const pageBg = "transparent";
    const borderColor = isDark
        ? "rgba(255,255,255,0.08)"
        : "rgba(15,23,42,0.08)";

    if (isMobile) {
        if (showNewChat) {
            return (
                <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: pageBg }}>
                    <Box
                        sx={{
                            display: "flex", alignItems: "center", gap: 1,
                            px: 2, py: 1.5,
                            borderBottom: "1px solid", borderColor: borderColor,
                            bgcolor: isDark ? "transparent" : "rgba(255,255,255,0.92)",
                            backdropFilter: isDark ? "none" : "blur(10px)",
                        }}
                    >
                        <IconButton size="small" onClick={() => setShowNewChat(false)}>
                            <ArrowBackRoundedIcon />
                        </IconButton>
                        <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
                            새 대화
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1, overflow: "hidden" }}>
                        <DmNewChat onRoomReady={handleNewRoomReady} defaultGroupMode={groupMode} />
                    </Box>
                </Box>
            );
        }

        if (selectedRoom) {
            return createPortal(
                <DmChatRoom
                    /* key로 방마다 컴포넌트를 새로 마운트한다. 안 그러면 useDmChatRoom의
                       text state가 유지돼서, 안 보낸 초안이 다음 대화로 따라가 엉뚱한
                       사람에게 전송될 수 있다(훅은 reply/첨부만 리셋하고 text는 안 지운다). */
                    key={selectedRoom.id}
                    room={selectedRoom}
                    onBack={handleBack}
                    fullscreen
                    onRoomUpdated={(updatedRoom) => {
                        setSelectedRoom(updatedRoom);
                        loadRooms();
                    }}
                />,
                document.body
            );
        }

        // ── 대화목록 (flat 리디자인) ──────────────────────
        return (
            <Box
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: pageBg,
                    overflow: "hidden",
                }}
            >
                {/* 헤더 — Toss 톤 polish */}
                <Box sx={{ px: 2.5, pt: 2.5, pb: 0 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em", color: "text.primary", lineHeight: 1 }}>
                            메시지
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => { setGroupMode(false); setShowNewChat(true); }}
                            sx={{
                                width: 40, height: 40, borderRadius: 999,
                                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.10),
                                color: "primary.main",
                                "&:hover": {
                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.14),
                                },
                            }}
                        >
                            <EditRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Stack>

                    {/* 검색 — gray pill 스타일 */}
                    <TextField
                        fullWidth
                        placeholder="이름 또는 메시지 검색"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        size="small"
                        sx={{
                            mb: 1.5,
                            "& .MuiOutlinedInput-root": {
                                height: 48,
                                borderRadius: "var(--plando-radius-card)",
                                bgcolor: isDark ? "rgba(255,255,255,0.05)" : "#F0F1F3",
                                "& fieldset": { border: "none" },
                                "&:hover fieldset": { border: "none" },
                                "&.Mui-focused fieldset": { border: "none" },
                            },
                            "& input": {
                                fontSize: 14,
                                fontWeight: 500,
                                letterSpacing: "-0.01em",
                            },
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRoundedIcon sx={{ color: "text.disabled", fontSize: 18 }} />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>

                {/* 섹션 레이블 */}
                <Box sx={{ px: 2.5, pb: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.disabled", letterSpacing: "-0.01em" }}>
                        {unreadCount > 0 ? `읽지 않음 ${unreadCount}` : `대화 ${filteredRooms.length}개`}
                    </Typography>
                </Box>

                {/* flat 대화 목록 */}
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                    <DmRoomList
                        rooms={filteredRooms}
                        loading={loadingRooms}
                        selectedRoomId={selectedRoom?.id}
                        onSelect={handleSelectRoom}
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                height: "100%",
                overflow: "hidden",
                bgcolor: pageBg,
            }}
        >
            {/* ── 채팅 영역 (목록은 사이드바 맥락 패널이 제공) ── */}
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    overflow: "hidden",
                    minWidth: 0,
                }}
            >
                {showNewChat ? (
                    <DmNewChat onRoomReady={handleNewRoomReady} defaultGroupMode={groupMode} />
                ) : selectedRoom ? (
                    <DmChatRoom
                        /* 방 전환 시 초안이 따라가지 않도록 재마운트 — 위 fullscreen 경로와 동일 이유 */
                        key={selectedRoom.id}
                        room={selectedRoom}
                        isDesktop
                        onRoomUpdated={(updatedRoom) => {
                            setSelectedRoom(updatedRoom);
                            loadRooms();
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "text.secondary",
                            gap: 1.25,
                        }}
                    >
                        <EditRoundedIcon sx={{ fontSize: 48, opacity: 0.28 }} />
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            대화를 선택하세요
                        </Typography>
                        <Typography variant="body2">
                            {/* "왼쪽에서" 라고 못 박지 않는다 — 대화 목록은 접히는 사이드바 패널에
                                들어 있어서, 접으면 왼쪽에 아무것도 없는 상태로 이 문구만 남는다. */}
                            목록에서 대화를 선택하거나{" "}
                            <Box
                                component="span"
                                sx={{ color: "primary.main", cursor: "pointer", fontWeight: 700 }}
                                onClick={() => setShowNewChat(true)}
                            >
                                새 대화를 시작
                            </Box>
                            하세요.
                        </Typography>
                    </Box>
                )}
            </Box>

        </Box>
    );
}