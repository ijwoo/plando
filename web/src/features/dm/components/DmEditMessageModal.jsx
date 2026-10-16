import React, { useEffect, useState } from "react";
import { Dialog, Box, Typography, TextField, Button, Stack, useTheme } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Z } from "../../../shared/ui/zIndex.js";
import { getDialogTokens } from "../../../shared/ui/dialogTokens.js";

/**
 * DM 메시지 수정 모달. 본인 텍스트 메시지만 호출.
 */
export default function DmEditMessageModal({ open, onClose, message, onSave }) {
    const theme = useTheme();
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setContent(message?.content || "");
    }, [open, message]);

    const tok = getDialogTokens(theme);

    const handleSave = async () => {
        const finalContent = content.trim();
        if (!finalContent || !message) return;
        if (finalContent === message.content) {
            onClose?.();
            return;
        }
        setSaving(true);
        try {
            await onSave?.(message.id, finalContent);
            onClose?.();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            fullWidth
            maxWidth="xs"
            sx={{ zIndex: Z.DIALOG }}
            PaperProps={{
                sx: {
                    bgcolor: tok.bg,
                    backgroundImage: "none",
                    border: `1px solid ${tok.border}`,
                    borderRadius: "16px",
                    overflow: "hidden",
                },
            }}
            slotProps={{ backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.45)" } } }}
        >
            <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <EditOutlinedIcon sx={{ fontSize: 20, color: "primary.main" }} />
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: tok.text }}>
                        메시지 수정
                    </Typography>
                </Stack>
                <TextField
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                    maxRows={8}
                    size="small"
                    autoFocus
                    disabled={saving}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            bgcolor: tok.inputBg,
                            borderRadius: 2,
                            fontSize: 14,
                        },
                    }}
                />
            </Box>
            <Box sx={{ display: "flex", borderTop: `1px solid ${tok.border}` }}>
                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={{ flex: 1, py: 1.25, borderRadius: 0, borderRight: `1px solid ${tok.border}`,
                        color: tok.text2, fontWeight: 600, fontSize: 14, textTransform: "none" }}
                >
                    취소
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={saving || !content.trim()}
                    sx={{ flex: 1, py: 1.25, borderRadius: 0,
                        color: "primary.main", fontWeight: 800, fontSize: 14, textTransform: "none" }}
                >
                    {saving ? "저장 중..." : "저장"}
                </Button>
            </Box>
        </Dialog>
    );
}
