import React, { useRef } from "react";
import { Box, Dialog } from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { Z } from "../../../shared/ui/zIndex.js";
import { copyText } from "../utils/copyText.js";
import { QUICK_REACTIONS } from "../constants/dmTags.js";

/**
 * 모바일 롱프레스 액션 시트.
 * - 상단 reaction quick row (onReact 있을 때)
 * - 텍스트 복사 / 수정 / 할 일로 만들기 / 메시지 삭제
 */
export default function MessageActionSheet({ open, onClose, msg, isMe, isDark, onDelete, onCreateTodo, onEdit, onReact, onReply, onPinNotice }) {
    const bd = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
    const bg = isDark ? "rgba(24,24,36,0.98)" : "rgba(248,248,252,0.98)";
    const text = isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.85)";
    const sep = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
    const paperRef = useRef(null);

    const handleCopy = () => { copyText(msg?.content, paperRef.current); onClose(); };
    const handleDelete = () => { onDelete?.(msg.id); onClose(); };
    const handleCreateTodo = () => { onCreateTodo?.(msg); onClose(); };
    const handleEdit = () => { onEdit?.(msg); onClose(); };
    const handleReact = (emoji) => { onReact?.(msg.id, emoji); onClose(); };
    const handleReply = () => { onReply?.(msg); onClose(); };
    const handlePinNotice = () => { onPinNotice?.(msg); onClose(); };

    const hasText = !!msg?.content?.trim();
    const isNotice = msg?.tag === "NOTICE";
    const mineSet = new Set(msg?.myReactions || []);
    const actions = [
        onReply && { icon: <ReplyRoundedIcon sx={{ fontSize: 18 }} />, label: "답장", onClick: handleReply },
        hasText && { icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />, label: "텍스트 복사", onClick: handleCopy },
        hasText && onPinNotice && { icon: <PushPinOutlinedIcon sx={{ fontSize: 18 }} />, label: isNotice ? "공지 해제" : "공지로 등록", onClick: handlePinNotice },
        hasText && isMe && onEdit && { icon: <EditOutlinedIcon sx={{ fontSize: 18 }} />, label: "메시지 수정", onClick: handleEdit },
        hasText && onCreateTodo && { icon: <AssignmentRoundedIcon sx={{ fontSize: 18 }} />, label: "할 일로 만들기", onClick: handleCreateTodo },
        isMe && onDelete && { icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: "#ef4444" }} />, label: "메시지 삭제", onClick: handleDelete, danger: true },
    ].filter(Boolean);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            disableEnforceFocus
            sx={{ zIndex: Z.TOAST }}
            PaperProps={{
                ref: paperRef,
                sx: {
                    position: "fixed", bottom: 0, left: 0, right: 0,
                    width: "100%", m: 0,
                    borderRadius: "20px 20px 0 0",
                    background: bg, backgroundImage: "none",
                    border: `1px solid ${bd}`, borderBottom: "none",
                    boxShadow: "0 -8px 40px rgba(0,0,0,0.28)",
                    overflow: "hidden",
                },
            }}
            slotProps={{ backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.35)" } } }}
        >
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1.2, pb: 0.5 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: bd }} />
            </Box>
            {onReact && (
                <Box sx={{ display: "flex", justifyContent: "space-around", px: 2, py: 1.25, borderBottom: `1px solid ${sep}` }}>
                    {QUICK_REACTIONS.map((emo) => {
                        const active = mineSet.has(emo);
                        return (
                            <Box
                                key={emo}
                                onClick={() => handleReact(emo)}
                                sx={{
                                    width: 38, height: 38, borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 22, cursor: "pointer",
                                    bgcolor: active ? (isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.12)") : "transparent",
                                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" },
                                }}
                            >
                                {emo}
                            </Box>
                        );
                    })}
                </Box>
            )}
            {actions.map((a, i) => (
                <Box
                    key={i}
                    onClick={a.onClick}
                    sx={{
                        display: "flex", alignItems: "center", gap: 1.5,
                        px: 2.5, py: 1.6,
                        borderTop: i > 0 ? `1px solid ${sep}` : "none",
                        cursor: "pointer",
                        color: a.danger ? "#ef4444" : text,
                        fontSize: 15, fontWeight: 600,
                        "&:hover": { bgcolor: "var(--plando-surface-low)" },
                    }}
                >
                    {a.icon}
                    {a.label}
                </Box>
            ))}
            <Box
                onClick={onClose}
                sx={{
                    textAlign: "center", py: 2,
                    borderTop: `1px solid ${sep}`,
                    fontSize: 15, fontWeight: 600, color: text,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "var(--plando-surface-low)" },
                }}
            >
                취소
            </Box>
        </Dialog>
    );
}
