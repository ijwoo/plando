import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import { blurSx, fadeDividerSx } from "../../../../shared/ui/glassSx.js";
import {
    Alert,
    Avatar,
    Box,
    CircularProgress,
    IconButton,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
// keyboard offset는 부모(TodoDetailMobile)에서 컨테이너 높이로 처리
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { addComment, deleteComment, fetchComments } from "../../api/commentApi.js";
import { getUser } from "../../../../shared/utils/tokenUtils.js";
import { formatTimeAgo } from "../../../../shared/utils/formatters.js";
import { getWorkspaceMembers } from "../../../workspace/api/workspaceMemberApi.js";
import { resolveImageUrl } from "../../../../shared/utils/urlUtils.js";
import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog.jsx";
import { Z } from "../../../../shared/ui/zIndex.js";
import MentionPicker from "../../../../shared/ui/common/MentionPicker.jsx";

function getDisplayName(comment) {
    return comment.writerName || comment.writerEmail || "작성자";
}

/** @홍길동 형태의 멘션을 하이라이트로 변환 */
function renderContentWithMentions(content, theme, isMine = false) {
    if (!content || !content.includes("@")) return content;
    const parts = content.split(/(@[\w가-힣]+)/g);
    return parts.map((part, i) =>
        /^@[\w가-힣]+$/.test(part) ? (
            <Box
                key={i}
                component="span"
                sx={{
                    color: isMine ? "rgba(255,255,255,0.95)" : "primary.main",
                    fontWeight: 700,
                    bgcolor: isMine ? "rgba(255,255,255,0.22)" : alpha(theme.palette.primary.main, 0.1),
                    borderRadius: 0.5,
                    px: 0.3,
                }}
            >
                {part}
            </Box>
        ) : (
            part
        )
    );
}

// ── 데스크탑 스레드 스타일 댓글 ──────────────────────────────
function ThreadComment({ comment, isMine, onDelete }) {
    const theme = useTheme();
    const [hovered, setHovered] = useState(false);

    return (
        <Box
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            sx={{ display: "flex", gap: 1.25, position: "relative", alignItems: "flex-start" }}
        >
            <Avatar
                src={comment.writerProfileImageUrl ? resolveImageUrl(comment.writerProfileImageUrl) : undefined}
                sx={{
                    width: 28,
                    height: 28,
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                    mt: 0.25,
                    bgcolor: isMine
                        ? alpha(theme.palette.primary.main, 0.15)
                        : alpha(theme.palette.text.secondary, 0.12),
                    color: isMine ? "primary.main" : "text.secondary",
                }}
            >
                {getDisplayName(comment).charAt(0).toUpperCase()}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.4 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                        {getDisplayName(comment)}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "text.disabled", lineHeight: 1 }}>
                        {formatTimeAgo(comment.createdAt)}
                    </Typography>
                </Box>
                <Typography
                    component="div"
                    className="selectable"
                    sx={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "text.primary",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                    }}
                >
                    {renderContentWithMentions(comment.content, theme)}
                </Typography>
            </Box>

            {isMine && hovered && (
                <IconButton
                    size="small"
                    onClick={() => onDelete(comment.id)}
                    sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 24,
                        height: 24,
                        color: "text.disabled",
                        "&:hover": { color: "error.main", bgcolor: alpha(theme.palette.error.main, 0.08) },
                    }}
                >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            )}
        </Box>
    );
}

// ── 모바일 채팅 버블 스타일 댓글 ─────────────────────────────
function BubbleComment({ comment, isMine, onDelete, theme }) {
    return (
        <Box
            sx={{
                display: "flex",
                gap: 1.25,
                flexDirection: isMine ? "row-reverse" : "row",
                alignItems: "flex-end",
            }}
        >
            {!isMine && (
                <Avatar
                    src={comment.writerProfileImageUrl ? resolveImageUrl(comment.writerProfileImageUrl) : undefined}
                    sx={{
                        width: 30,
                        height: 30,
                        fontSize: 13,
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: "primary.main",
                        flexShrink: 0,
                    }}
                >
                    {getDisplayName(comment).charAt(0).toUpperCase()}
                </Avatar>
            )}

            <Box
                sx={{
                    maxWidth: "72%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                    gap: 0.5,
                    minWidth: 0,
                }}
            >
                {!isMine && (
                    <Typography sx={{ fontSize: 11, color: "text.secondary", ml: 0.25 }}>
                        {getDisplayName(comment)}
                    </Typography>
                )}

                <Box
                    component="div"
                    className="selectable"
                    sx={{
                        px: 1.75,
                        py: 1.2,
                        bgcolor: isMine ? "primary.main" : "action.hover",
                        border: "1px solid",
                        borderColor: isMine ? "transparent" : "divider",
                        borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        color: isMine ? "#fff" : "text.primary",
                        fontSize: 14,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                    }}
                >
                    {renderContentWithMentions(comment.content, theme, isMine)}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography sx={{ fontSize: 10.5, color: "text.disabled" }}>
                        {formatTimeAgo(comment.createdAt)}
                    </Typography>
                    {isMine && (
                        <IconButton
                            size="small"
                            onClick={() => onDelete(comment.id)}
                            sx={{ width: 18, height: 18, color: "text.disabled", p: 0 }}
                        >
                            <Box component="span" sx={{ fontSize: 12, lineHeight: 1, fontWeight: 700 }}>
                                ×
                            </Box>
                        </IconButton>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function CommentSection({ todoId, workspaceId, variant = "chat" }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const bottomRef = useRef(null);
    const commentInputRef = useRef(null);
    const isThread = variant === "thread";
    const currentUser = getUser?.();
    const currentUserEmail = currentUser?.email || "";

    const [comments, setComments] = useState([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // 멘션 관련 상태
    const [members, setMembers] = useState([]);
    const [mentionQuery, setMentionQuery] = useState(null); // null이면 드롭다운 닫힘

    useEffect(() => {
        if (workspaceId) {
            getWorkspaceMembers(workspaceId)
                .then((data) => setMembers(Array.isArray(data) ? data : []))
                .catch(() => {});
        }
    }, [workspaceId]);

    const sortedComments = useMemo(() =>
        [...comments].sort((a, b) =>
            (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0)
        ), [comments]);

    const loadComments = useCallback(async () => {
        if (!todoId) return;
        try {
            setInitialLoading(true);
            setErrorMessage("");
            const res = await fetchComments(todoId);
            setComments(res.data ?? []);
        } catch (e) {
            setErrorMessage("댓글을 불러오지 못했습니다.");
        } finally {
            setInitialLoading(false);
        }
    }, [todoId]);

    useEffect(() => { loadComments(); }, [loadComments]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [sortedComments.length]);

    const handleContentChange = (value) => {
        setContent(value);
        // @ 멘션 감지: 마지막 @ 이후 텍스트
        const atIdx = value.lastIndexOf("@");
        if (atIdx !== -1) {
            const afterAt = value.slice(atIdx + 1);
            // 공백이 없으면 멘션 중
            if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
                setMentionQuery(afterAt);
                return;
            }
        }
        setMentionQuery(null);
    };

    const handleMentionSelect = (name) => {
        // 마지막 @이후 텍스트를 선택한 이름으로 교체
        const atIdx = content.lastIndexOf("@");
        const newContent = content.slice(0, atIdx) + "@" + name + " ";
        setContent(newContent);
        setMentionQuery(null);
        // 입력창 포커스
        setTimeout(() => {
            if (isThread && commentInputRef.current) {
                const input = commentInputRef.current.querySelector("textarea") || commentInputRef.current;
                input?.focus?.();
            } else if (commentInputRef.current) {
                commentInputRef.current.focus();
            }
        }, 0);
    };

    const handleAddComment = async () => {
        if (!content.trim() || loading) return;
        try {
            setLoading(true);
            setErrorMessage("");
            await addComment({ todoId, content: content.trim() });
            setContent("");
            setMentionQuery(null);
            await loadComments();
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
        } catch (e) {
            setErrorMessage("댓글 등록 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            setErrorMessage("");
            await deleteComment(commentId);
            await loadComments();
        } catch (e) {
            setErrorMessage(e?.response?.status === 403
                ? "본인 댓글만 삭제할 수 있습니다."
                : "댓글 삭제 중 오류가 발생했습니다.");
        }
    };

    const handleKeyDown = (e) => {
        if (mentionQuery !== null) {
            // 멘션 드롭다운 열린 상태에서 Escape → 닫기
            if (e.key === "Escape") { setMentionQuery(null); return; }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복 전송 방지
            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            handleAddComment();
        }
    };

    const emptyHeight = isThread ? 120 : 180;

    return (
        <Box sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            bgcolor: "transparent",
            minHeight: 0,
        }}>
            {/* 댓글 목록 */}
            <Box
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    px: isThread ? 0 : 2.25,
                    pt: isThread ? 1 : 2,
                    pb: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: isThread ? 2 : 1.5,
                    minHeight: 0,
                }}
            >
                {initialLoading ? (
                    <Box sx={{ minHeight: emptyHeight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CircularProgress size={26} />
                    </Box>
                ) : sortedComments.length === 0 ? (
                    <Box sx={{ minHeight: emptyHeight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                            아직 댓글이 없어요
                        </Typography>
                    </Box>
                ) : (
                    sortedComments.map((comment) => {
                        const isMine = comment.writerEmail === currentUserEmail;
                        return isThread ? (
                            <ThreadComment
                                key={comment.id}
                                comment={comment}
                                isMine={isMine}
                                onDelete={setDeleteConfirmId}
                            />
                        ) : (
                            <BubbleComment
                                key={comment.id}
                                comment={comment}
                                isMine={isMine}
                                onDelete={setDeleteConfirmId}
                                theme={theme}
                            />
                        );
                    })
                )}
                <Box ref={bottomRef} />
            </Box>

            {errorMessage && (
                <Box sx={{ px: isThread ? 0 : 2, pb: 1 }}>
                    <Alert severity="error" sx={{ fontSize: 12 }}>{errorMessage}</Alert>
                </Box>
            )}

            <ConfirmDialog
                open={deleteConfirmId !== null}
                title="댓글 삭제"
                message="댓글을 삭제하시겠습니까?"
                confirmText="삭제"
                confirmColor="error"
                // 모바일 상세 Drawer(Z.DETAIL_PANEL=1500) 안에서 호출되므로 그 위로 띄움
                zIndex={Z.DIALOG}
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={() => { handleDeleteComment(deleteConfirmId); setDeleteConfirmId(null); }}
            />

            {/* 입력창 */}
            {isThread ? (
                <Box
                    sx={{
                        flexShrink: 0,
                        pt: 1.5,
                        ...fadeDividerSx(theme.palette.divider),
                        display: "flex",
                        gap: 1,
                        alignItems: "flex-end",
                        position: "relative",
                    }}
                >
                    {mentionQuery !== null && members.length > 0 && (
                        <MentionPicker
                            members={members}
                            query={mentionQuery}
                            onSelect={handleMentionSelect}
                            anchorEl={commentInputRef.current?.querySelector?.("textarea") ?? commentInputRef.current}
                        />
                    )}
                    <TextField
                        ref={commentInputRef}
                        fullWidth
                        size="small"
                        multiline
                        maxRows={4}
                        placeholder="댓글을 입력하세요... (@ 로 멘션, Enter 로 전송)"
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                                fontSize: 13,
                                bgcolor: "background.default",
                            },
                        }}
                    />
                    <IconButton
                        onClick={handleAddComment}
                        disabled={loading || !content.trim()}
                        sx={{
                            width: 36,
                            height: 36,
                            flexShrink: 0,
                            borderRadius: 2,
                            bgcolor: content.trim() ? "primary.main" : "action.hover",
                            color: content.trim() ? "#fff" : "text.disabled",
                            "&:hover": { bgcolor: content.trim() ? "primary.dark" : "action.hover" },
                            "&.Mui-disabled": { color: "text.disabled" },
                        }}
                    >
                        {loading
                            ? <CircularProgress size={14} color="inherit" />
                            : <SendRoundedIcon sx={{ fontSize: 15 }} />
                        }
                    </IconButton>
                </Box>
            ) : (
                <Box sx={{
                    flexShrink: 0,
                    px: 1.5,
                    py: 1,
                    ...fadeDividerSx(theme.palette.divider),
                    background: isDark ? "rgba(19,19,23,0.95)" : "rgba(255,255,255,0.97)",
                    ...blurSx("blur(20px)"),
                    position: "relative",
                }}>
                    {mentionQuery !== null && members.length > 0 && (
                        <MentionPicker
                            members={members}
                            query={mentionQuery}
                            onSelect={handleMentionSelect}
                            anchorEl={commentInputRef.current}
                        />
                    )}
                    <Box sx={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 1,
                        bgcolor: "var(--plando-surface-low)",
                        border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                        borderRadius: 3,
                        px: 1.5,
                        py: 0.75,
                        transition: "border-color 0.15s",
                        "&:focus-within": { borderColor: "primary.main" },
                    }}>
                        <textarea
                            ref={commentInputRef}
                            value={content}
                            onChange={(e) => {
                                handleContentChange(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                            }}
                            onFocus={() => {
                                setTimeout(() => {
                                    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                                }, 300);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="댓글을 입력하세요... (@ 로 멘션)"
                            rows={1}
                            style={{
                                flex: 1,
                                background: "none",
                                border: "none",
                                outline: "none",
                                resize: "none",
                                fontSize: 15,
                                lineHeight: 1.5,
                                color: isDark ? "#E8EAED" : "rgba(0,0,0,0.87)",
                                fontFamily: "-apple-system, 'Noto Sans KR', sans-serif",
                                padding: 0,
                                overflowY: "hidden",
                                minHeight: 24,
                                maxHeight: 100,
                                caretColor: isDark ? "#8AB4F8" : "#1976D2",
                            }}
                        />
                        <IconButton
                            size="small"
                            onClick={handleAddComment}
                            disabled={loading || !content.trim()}
                            sx={{
                                bgcolor: content.trim() ? "primary.main" : "transparent",
                                color: content.trim() ? "#fff" : "text.disabled",
                                width: 34, height: 34,
                                flexShrink: 0,
                                transition: "background 0.2s, color 0.2s",
                                "&:hover": { bgcolor: content.trim() ? "primary.dark" : "action.hover" },
                                "&.Mui-disabled": { bgcolor: "transparent", color: "text.disabled" },
                            }}
                        >
                            {loading
                                ? <CircularProgress size={16} color="inherit" />
                                : <SendRoundedIcon sx={{ fontSize: 18 }} />
                            }
                        </IconButton>
                    </Box>
                </Box>
            )}
        </Box>
    );
}
