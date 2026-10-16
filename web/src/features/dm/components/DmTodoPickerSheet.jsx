import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, Typography, InputBase, CircularProgress, Dialog } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import Sheet from "../../../shared/ui/primitives/Sheet.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { fetchTodos } from "../../todo/api/todoApi.js";
import { STATUS_LABEL } from "../../../shared/ui/tone.js";

/**
 * 메시지에 첨부할 "기존 할 일" 선택기. 워크스페이스 할 일을 불러와 제목으로 필터 → onSelect.
 * 모바일은 바텀시트, 데스크탑은 가운데 정렬 Dialog (넓은 화면에서 바텀시트는 어색).
 */
export default function DmTodoPickerSheet({ open, onClose, onSelect, isDesktop = false }) {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) { setQ(""); return; }
        setLoading(true);
        fetchTodos()
            .then((res) => setTodos(res.data || []))
            .catch(() => setTodos([]))
            .finally(() => setLoading(false));
    }, [open]);

    const filtered = useMemo(() => {
        const k = q.trim().toLowerCase();
        const list = k ? todos.filter((t) => t.title?.toLowerCase().includes(k)) : todos;
        return list.slice(0, 50);
    }, [todos, q]);

    const searchHeader = (
        <Box sx={{ px: 2, pt: 0.5, pb: 1.25 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 1 }}>할 일 첨부</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: "var(--plando-surface-low)" }}>
                <SearchRoundedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                <InputBase inputRef={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="할 일 검색" sx={{ flex: 1, fontSize: 15 }} />
                {loading && <CircularProgress size={16} />}
            </Box>
        </Box>
    );

    const list = (
        <Box sx={{ px: 1, pb: 2 }}>
            {filtered.length === 0 && !loading ? (
                <Typography sx={{ textAlign: "center", color: "text.disabled", fontSize: 13, py: 4 }}>할 일이 없어요</Typography>
            ) : (
                filtered.map((t) => (
                    <Press
                        key={t.id}
                        onClick={() => { onSelect?.(t); onClose?.(); }}
                        haptic="light"
                        activeBg="var(--plando-surface-faint)"
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", borderRadius: 12, textAlign: "left" }}
                    >
                        <Box sx={{ width: 30, height: 30, borderRadius: "9px", flexShrink: 0, bgcolor: "var(--plando-surface-low)", color: "text.secondary", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <AssignmentRoundedIcon sx={{ fontSize: 17 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>{t.title}</Typography>
                            <Typography sx={{ fontSize: 12, color: "text.disabled" }}>{STATUS_LABEL[t.status] || t.status}</Typography>
                        </Box>
                    </Press>
                ))
            )}
        </Box>
    );

    if (isDesktop) {
        return (
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
            >
                <Box sx={{ pt: 1.5 }}>{searchHeader}</Box>
                <Box sx={{ maxHeight: 420, overflowY: "auto" }}>{list}</Box>
            </Dialog>
        );
    }

    return (
        <Sheet open={open} onClose={onClose} height="80dvh" header={searchHeader}>
            {list}
        </Sheet>
    );
}
