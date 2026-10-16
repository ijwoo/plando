import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, InputBase, CircularProgress, Dialog } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Sheet from "../../../shared/ui/primitives/Sheet.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { timeStr } from "../utils/dmMessageUtils.js";

/**
 * 대화 내 메시지 검색. q 입력(디바운스) → onSearch, 결과 탭 → onJump(메시지).
 * 모바일은 바텀시트, 데스크탑은 가운데 정렬 Dialog (데스크탑에서 바텀시트는 어색).
 */
export default function DmSearchSheet({ open, onClose, results = [], loading = false, onSearch, onJump, isDesktop = false }) {
    const [q, setQ] = useState("");
    const debRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 200);
        else setQ("");
    }, [open]);

    const handleChange = (v) => {
        setQ(v);
        clearTimeout(debRef.current);
        debRef.current = setTimeout(() => onSearch?.(v), 300);
    };

    const searchHeader = (
        <Box sx={{ px: 2, pt: 0.5, pb: 1.25 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: "var(--plando-surface-low)" }}>
                <SearchRoundedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                <InputBase
                    inputRef={inputRef}
                    value={q}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder="대화 내 메시지 검색"
                    sx={{ flex: 1, fontSize: 15 }}
                />
                {loading && <CircularProgress size={16} />}
            </Box>
        </Box>
    );

    const body = (
        <Box sx={{ px: 1, pb: 2 }}>
            {!q.trim() ? (
                <Typography sx={{ textAlign: "center", color: "text.disabled", fontSize: 13, py: 4 }}>
                    검색어를 입력하세요
                </Typography>
            ) : results.length === 0 && !loading ? (
                <Typography sx={{ textAlign: "center", color: "text.disabled", fontSize: 13, py: 4 }}>
                    결과가 없어요
                </Typography>
            ) : (
                results.map((m) => (
                    <Press
                        key={m.id}
                        onClick={() => onJump?.(m.id)}
                        haptic="light"
                        activeBg="var(--plando-surface-faint)"
                        style={{ display: "block", width: "100%", padding: "11px 14px", borderRadius: 12, textAlign: "left" }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.25 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>{m.senderName}</Typography>
                            <Typography sx={{ fontSize: 11, color: "text.disabled", flexShrink: 0 }}>{timeStr(m.sentAt)}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 13.5, color: "text.secondary" }} noWrap>{m.content}</Typography>
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
                <Box sx={{ maxHeight: 420, overflowY: "auto" }}>{body}</Box>
            </Dialog>
        );
    }

    return (
        <Sheet open={open} onClose={onClose} height="80dvh" header={searchHeader}>
            {body}
        </Sheet>
    );
}
