import React, { useState } from "react";
import { Box } from "@mui/material";
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
 * 데스크탑 말풍선 호버 액션 버튼 묶음.
 * - 이모지(👍 ❤️ 등) 빠른 picker / 텍스트 복사 / 수정 / 할 일로 만들기 / 삭제
 * - 부모 row가 `.bubble-row:hover &` 로 opacity 제어함
 */
export default function MessageBubbleActions({ msg, isMe, isDark, onDelete, onCreateTodo, onEdit, onReact, onReply, onPinNotice }) {
    const [reactionOpen, setReactionOpen] = useState(false);
    const btn = {
        background: "none", border: "none", cursor: "pointer",
        padding: "4px 6px", borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.4)",
        transition: "background 0.12s, color 0.12s",
    };

    const handleCopy = (e) => { e.stopPropagation(); copyText(msg?.content); };
    const handleDelete = (e) => { e.stopPropagation(); onDelete(msg.id); };
    const handleCreateTodo = (e) => { e.stopPropagation(); onCreateTodo?.(msg); };
    const handleEdit = (e) => { e.stopPropagation(); onEdit?.(msg); };
    const handleReact = (e, emo) => { e.stopPropagation(); onReact?.(msg.id, emo); setReactionOpen(false); };
    const handleReply = (e) => { e.stopPropagation(); onReply?.(msg); };
    const handlePinNotice = (e) => { e.stopPropagation(); onPinNotice?.(msg); };

    const hasText = !!msg?.content?.trim();
    const isNotice = msg?.tag === "NOTICE";
    return (
        <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 0.25, opacity: 0, transition: "opacity 0.15s", ".bubble-row:hover &": { opacity: 1 } }}>
            {onReact && (
                <button
                    style={btn}
                    onClick={(e) => { e.stopPropagation(); setReactionOpen((v) => !v); }}
                    title="이모지 추가"
                >
                    <Box component="span" sx={{ fontSize: 14 }}>😀</Box>
                </button>
            )}
            {onReply && (
                <button style={btn} onClick={handleReply} title="답장">
                    <ReplyRoundedIcon sx={{ fontSize: 14 }} />
                </button>
            )}
            {hasText && (
                <button style={btn} onClick={handleCopy} title="텍스트 복사">
                    <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
                </button>
            )}
            {hasText && onPinNotice && (
                <button
                    style={isNotice ? { ...btn, color: "#f59e0b" } : btn}
                    onClick={handlePinNotice}
                    title={isNotice ? "공지 해제" : "공지로 등록"}
                >
                    <PushPinOutlinedIcon sx={{ fontSize: 14 }} />
                </button>
            )}
            {hasText && isMe && onEdit && (
                <button style={btn} onClick={handleEdit} title="메시지 수정">
                    <EditOutlinedIcon sx={{ fontSize: 14 }} />
                </button>
            )}
            {hasText && onCreateTodo && (
                <button style={btn} onClick={handleCreateTodo} title="할 일로 만들기">
                    <AssignmentRoundedIcon sx={{ fontSize: 14 }} />
                </button>
            )}
            {isMe && (
                <button style={{ ...btn, color: "#ef4444" }} onClick={handleDelete} title="메시지 삭제">
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                </button>
            )}
            {reactionOpen && (
                <Box
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                        position: "absolute", bottom: "calc(100% + 4px)", right: 0,
                        display: "flex", gap: 0.5, p: 0.75, borderRadius: 2,
                        bgcolor: isDark ? "rgba(24,24,36,0.98)" : "rgba(248,248,252,0.98)",
                        border: "1px solid", borderColor: "divider",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                        zIndex: Z.POPOVER,
                    }}
                >
                    {QUICK_REACTIONS.map((emo) => (
                        <Box
                            key={emo}
                            onClick={(e) => handleReact(e, emo)}
                            sx={{
                                width: 28, height: 28, borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 16, cursor: "pointer",
                                "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" },
                            }}
                        >
                            {emo}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}
