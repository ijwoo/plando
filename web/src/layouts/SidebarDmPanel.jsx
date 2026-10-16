import React, { useState, useEffect, useMemo } from "react";
import { Box, InputBase, IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { useNavigate } from "react-router-dom";
import { fetchDmRooms } from "../features/dm/api/dmApi.js";
import DmRoomList from "../features/dm/components/DmRoomList.jsx";
import { DM_ROOM_OPENED } from "../features/dm/constants/dmEvents.js";
import { APP_EVENTS } from "../shared/constants/events.js";
import { useWorkspace } from "../features/workspace/context/WorkspaceContext.jsx";

/**
 * 메시지 섹션 맥락 패널 — 대화 목록(슬랙식: 목록은 여기, 채팅은 본문).
 * 조회·검색·새 대화 진입을 담당하고, 선택/생성은 /dm으로 네비게이트해서 본문(DmPage)이 채팅을 연다.
 */
export default function SidebarDmPanel({ onMobileClose }) {
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspace();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState("");
    // 열려 있는 대화 — 마스터/디테일이라 목록에 선택 상태가 보여야 한다.
    // 진실은 DmPage(본문)에 있고 DM_ROOM_OPENED로 따라간다. 클릭 시엔 낙관적으로 먼저 표시.
    const [selectedRoomId, setSelectedRoomId] = useState(null);

    useEffect(() => {
        const onOpened = (e) => setSelectedRoomId(e.detail?.roomId ?? null);
        window.addEventListener(DM_ROOM_OPENED, onOpened);
        return () => window.removeEventListener(DM_ROOM_OPENED, onOpened);
    }, []);

    // 워크스페이스가 바뀌면 본문도 선택을 비운다
    useEffect(() => { setSelectedRoomId(null); }, [currentWorkspace?.workspaceId]);

    // 워크스페이스 변경 시 목록 재조회 — DM은 워크스페이스 스코프라 스코프가 바뀌면 비우고 다시 로드.
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setRooms([]);
        const load = () => {
            fetchDmRooms()
                .then((res) => { if (alive) setRooms(res.data || []); })
                .catch(() => { if (alive) setRooms([]); })
                .finally(() => { if (alive) setLoading(false); });
        };
        load();
        const onChange = () => load();
        window.addEventListener(APP_EVENTS.DM_UNREAD_CHANGED, onChange);
        return () => { alive = false; window.removeEventListener(APP_EVENTS.DM_UNREAD_CHANGED, onChange); };
    }, [currentWorkspace?.workspaceId]);

    const filtered = useMemo(() => {
        const k = keyword.trim().toLowerCase();
        if (!k) return rooms;
        return rooms.filter((r) => {
            const name = (r.isGroup ? r.groupName : r.partnerName) || "";
            const last = r.lastMessage || "";
            return name.toLowerCase().includes(k) || last.toLowerCase().includes(k);
        });
    }, [rooms, keyword]);

    const openRoom = (room) => {
        const id = room?.id ?? room;
        if (id == null) return;
        setSelectedRoomId(id);
        navigate("/dm", { state: { openRoomId: id } });
        onMobileClose?.();
    };

    const newChat = () => {
        setSelectedRoomId(null);
        navigate("/dm", { state: { newChat: true } });
        onMobileClose?.();
    };

    return (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* 검색 + 새 대화 */}
            <Box sx={{ px: 1.5, pb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{
                    flex: 1, display: "flex", alignItems: "center", gap: 0.75, height: 34, px: 1.25,
                    borderRadius: "10px", border: "1px solid", borderColor: "divider",
                    bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.06 : 0.04),
                    "&:focus-within": { borderColor: "primary.main", bgcolor: "background.paper" },
                }}>
                    <SearchRoundedIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
                    <InputBase value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="대화 검색" sx={{ flex: 1, fontSize: 13 }} />
                </Box>
                <Tooltip title="새 대화" placement="bottom" arrow>
                    <IconButton onClick={newChat} size="small" sx={{ width: 34, height: 34, borderRadius: "10px", color: "primary.main", bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.16 : 0.10), "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.24 : 0.15) } }}>
                        <EditRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            </Box>
            <Box className="plando-scroll" sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 0.5 }}>
                <DmRoomList rooms={filtered} loading={loading} selectedRoomId={selectedRoomId} onSelect={openRoom} dense />
            </Box>
        </Box>
    );
}
