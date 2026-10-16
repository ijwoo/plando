import React, { useMemo } from "react";
import { Box, Paper, Popper, Typography } from "@mui/material";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Z } from "../zIndex.js";
import { STATUS_LABEL } from "../tone.js";

/**
 * `#` 인라인 할 일 자동완성 picker (@멘션 picker의 todo 버전).
 * 부모 책임:
 *  - 입력에서 `#` 감지 + query state 관리
 *  - todos 공급 (`{ id, title, status }`)
 *  - onSelect(todo) — 선택 시 `#query` 제거 + 할 일 첨부
 *  - anchorEl (입력창 ref.current)
 */
export default function TodoMentionPicker({ todos, query, onSelect, anchorEl, placement = "top-start" }) {
    const filtered = useMemo(() => {
        const list = Array.isArray(todos) ? todos : [];
        const q = (query ?? "").toLowerCase();
        return list
            .filter((t) => (t.title || "").toLowerCase().includes(q))
            .slice(0, 6);
    }, [todos, query]);

    if (filtered.length === 0 || !anchorEl || query == null) return null;

    return (
        <Popper open anchorEl={anchorEl} placement={placement} style={{ zIndex: Z.MODAL_NESTED, width: anchorEl?.offsetWidth ?? 280 }}>
            <Paper
                elevation={8}
                sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden", maxHeight: 220, overflowY: "auto", mb: 0.5 }}
            >
                {filtered.map((t) => (
                    <Box
                        key={t.id}
                        onMouseDown={(e) => { e.preventDefault(); onSelect?.(t); }}
                        sx={{
                            display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, cursor: "pointer",
                            "&:hover": { bgcolor: "var(--plando-surface-low)" },
                        }}
                    >
                        <Box sx={{ width: 26, height: 26, borderRadius: "8px", flexShrink: 0, bgcolor: "var(--plando-surface-low)", color: "text.secondary", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <AssignmentRoundedIcon sx={{ fontSize: 15 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>{t.title}</Typography>
                            <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>{STATUS_LABEL[t.status] || t.status}</Typography>
                        </Box>
                    </Box>
                ))}
            </Paper>
        </Popper>
    );
}
