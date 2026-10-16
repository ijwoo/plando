import { useState } from "react";
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    IconButton,
    Menu,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Z } from "../../../../../shared/ui/zIndex.js";
import { formatTimeAgo } from "../../../../../shared/utils/formatters";

const ANSWER_MAX = 1000;

/** 액션 버튼 클릭 시 부모(Dialog 등)의 onClose 전파를 차단하는 헬퍼 */
const stop = (fn) => (e) => { e.stopPropagation(); fn?.(e); };

/**
 * 단일 질문 + (있다면) 답변 카드.
 * 디자인은 모바일/데스크탑 공통. 답변 영역은 단순 들여쓰기 + 좌측 선만 사용.
 */
export default function QuestionCard({
    q,
    isAuthor,
    currentUserId,
    busy,
    onDelete,
    onPin,
    onAnswerUpsert,
    onAnswerDelete,
}) {
    const theme = useTheme();
    const isAsker = Boolean(currentUserId && q.askerId === currentUserId);
    const hasAnswer = Boolean(q.answer);
    const unanswered = isAuthor && !hasAnswer;
    const showMenu = isAuthor || isAsker;

    // 비공개 질문 + 권한 없음 → 백엔드가 body/askerId 등을 null로 마스킹해서 내려줌
    const isPrivate = Boolean(q.isPrivate);
    const isMasked = isPrivate && q.body == null;
    // 비공개 답변 (body는 null이지만 createdAt은 있음) → 답변 완료 표시
    const answerMasked = hasAnswer && q.answer.body == null;

    const [menuAnchor, setMenuAnchor] = useState(null);
    const [answerOpen, setAnswerOpen] = useState(false);
    const [answerDraft, setAnswerDraft] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const closeMenu = () => setMenuAnchor(null);

    const openAnswerForm = (initial = "") => {
        setAnswerDraft(initial);
        setAnswerOpen(true);
    };

    const submitAnswer = async () => {
        const body = answerDraft.trim();
        if (body.length < 2) return;
        setSubmitting(true);
        try {
            await onAnswerUpsert(body);
            setAnswerOpen(false);
            setAnswerDraft("");
        } catch { /* hook toast */ }
        setSubmitting(false);
    };

    return (
        <Box sx={{
            p: 1.75,
            borderRadius: 1.75,
            border: "1px solid",
            borderColor: unanswered
                ? alpha(theme.palette.warning.main, 0.30)
                : alpha(theme.palette.text.primary, 0.06),
            bgcolor: "background.paper",
        }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" gap={1}>
                {isMasked ? (
                    <Box sx={{
                        width: 28, height: 28, borderRadius: "50%",
                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                        color: "text.disabled",
                        display: "grid", placeItems: "center",
                    }}>
                        <LockOutlinedIcon sx={{ fontSize: 14 }} />
                    </Box>
                ) : (
                    <Avatar src={q.askerAvatar} sx={{ width: 28, height: 28, fontSize: 12 }}>
                        {q.askerName?.[0] || "?"}
                    </Avatar>
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.primary" }}>
                            {isMasked ? "비공개 질문" : (q.askerName || "익명")}
                        </Typography>
                        {isPrivate && !isMasked && (
                            <Typography sx={{ fontSize: 10.5, color: "primary.main", fontWeight: 700 }}>
                                · 🔒 비공개
                            </Typography>
                        )}
                        {q.isPinned && (
                            <Typography sx={{ fontSize: 10.5, color: "primary.main", fontWeight: 700 }}>
                                · 고정됨
                            </Typography>
                        )}
                        {unanswered && (
                            <Typography sx={{ fontSize: 10.5, color: "warning.main", fontWeight: 700 }}>
                                · 미답변
                            </Typography>
                        )}
                    </Stack>
                    <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.1 }}>
                        {q.createdAt ? formatTimeAgo(q.createdAt) : ""}
                    </Typography>
                </Box>
                {showMenu && (
                    <>
                        <IconButton
                            size="small"
                            disabled={busy}
                            onClick={stop((e) => setMenuAnchor(e.currentTarget))}
                            sx={{ color: "text.disabled", width: 28, height: 28 }}
                        >
                            <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <Menu
                            anchorEl={menuAnchor}
                            open={Boolean(menuAnchor)}
                            onClose={closeMenu}
                            sx={{ zIndex: Z.MODAL_NESTED }}
                            PaperProps={{ sx: { borderRadius: 2, minWidth: 140 } }}
                        >
                            {isAuthor && (
                                <MenuItem
                                    onClick={stop(() => { closeMenu(); onPin(); })}
                                    sx={{ fontSize: 13, fontWeight: 600, gap: 1 }}
                                >
                                    {q.isPinned
                                        ? <><PushPinOutlinedIcon sx={{ fontSize: 16 }} /> 고정 해제</>
                                        : <><PushPinRoundedIcon sx={{ fontSize: 16 }} /> 상단 고정</>}
                                </MenuItem>
                            )}
                            {(isAuthor || isAsker) && (
                                <MenuItem
                                    onClick={stop(() => { closeMenu(); onDelete(); })}
                                    sx={{ fontSize: 13, fontWeight: 600, color: "error.main", gap: 1 }}
                                >
                                    {isAuthor && !isAsker
                                        ? <><VisibilityOffRoundedIcon sx={{ fontSize: 16 }} /> 숨기기</>
                                        : <><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /> 삭제</>}
                                </MenuItem>
                            )}
                        </Menu>
                    </>
                )}
            </Stack>

            {/* 본문 */}
            {isMasked ? (
                <Typography sx={{
                    fontSize: 12.5,
                    color: "text.disabled",
                    mt: 1,
                    fontStyle: "italic",
                }}>
                    🔒 비공개 질문이에요. 작성자만 내용을 볼 수 있어요.
                </Typography>
            ) : (
                <Typography sx={{
                    fontSize: 13.5, lineHeight: 1.55, color: "text.primary",
                    mt: 1, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                    {q.body}
                </Typography>
            )}

            {/* 답변 영역 — 좌측 얇은 선 + 들여쓰기, 배경 없음 */}
            {hasAnswer ? (
                <Box sx={{
                    mt: 1.25,
                    ml: 1,
                    pl: 1.25,
                    borderLeft: "2px solid",
                    borderColor: alpha(theme.palette.primary.main, 0.35),
                }}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "primary.main" }}>
                            작성자 답변
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
                            · {q.answer.createdAt ? formatTimeAgo(q.answer.createdAt) : ""}
                        </Typography>
                        {isAuthor && (
                            <IconButton
                                size="small"
                                disabled={busy}
                                onClick={stop(onAnswerDelete)}
                                sx={{ width: 22, height: 22, color: "text.disabled", ml: "auto" }}
                            >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                        )}
                    </Stack>
                    {answerMasked ? (
                        <Typography sx={{
                            fontSize: 12.5, color: "text.disabled", mt: 0.5,
                            fontStyle: "italic",
                        }}>
                            🔒 비공개 답변이에요. 작성자만 내용을 볼 수 있어요.
                        </Typography>
                    ) : (
                        <Typography sx={{
                            fontSize: 13, lineHeight: 1.55, color: "text.primary",
                            mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}>
                            {q.answer.body}
                        </Typography>
                    )}
                </Box>
            ) : isAuthor ? (
                <Box sx={{ mt: 1.25 }}>
                    {!answerOpen ? (
                        <Button
                            size="small"
                            variant="text"
                            onClick={stop(() => openAnswerForm(""))}
                            sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, px: 1, minHeight: 28 }}
                        >
                            답변 작성
                        </Button>
                    ) : (
                        <Box>
                            <TextField
                                autoFocus
                                value={answerDraft}
                                onChange={(e) => setAnswerDraft(e.target.value.slice(0, ANSWER_MAX))}
                                placeholder="답변을 입력하세요. (2~1000자)"
                                multiline
                                minRows={2}
                                maxRows={5}
                                fullWidth
                                disabled={submitting}
                                onClick={(e) => e.stopPropagation()}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: 13 } }}
                            />
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.5}>
                                <Typography sx={{
                                    fontSize: 11,
                                    color: answerDraft.length >= ANSWER_MAX - 30 ? "warning.main" : "text.disabled",
                                }}>
                                    {answerDraft.length} / {ANSWER_MAX}
                                </Typography>
                                <Stack direction="row" gap={0.75}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={stop(() => { setAnswerOpen(false); setAnswerDraft(""); })}
                                        disabled={submitting}
                                        sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, minHeight: 28 }}
                                    >
                                        취소
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={submitting || answerDraft.trim().length < 2}
                                        onClick={stop(submitAnswer)}
                                        sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, minHeight: 28 }}
                                    >
                                        {submitting
                                            ? <CircularProgress size={12} color="inherit" />
                                            : "등록"}
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>
                    )}
                </Box>
            ) : null}
        </Box>
    );
}
