import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ConfirmDialog from "../../../../../shared/ui/common/ConfirmDialog";
import { Z } from "../../../../../shared/ui/zIndex.js";
import useRecruitmentQuestions from "../../../hooks/useRecruitmentQuestions";
import QuestionCard from "./QuestionCard";
import { RECRUITMENT_LIMITS } from "../../../constants/recruitmentConfig";
import { blockIfGuest } from "../../../../../shared/utils/guestUtils.js";

const QUESTION_MAX = RECRUITMENT_LIMITS.QUESTION;

/**
 * 모집글 공개 Q&A 탭.
 * - 게스트/미로그인 → onGuestBlock 호출
 * - 작성자 본인 → 안내 박스(질문 X)
 * - 일반 로그인 → TextField + 등록
 *
 * props.onCountsChange: items 변경 시 (total, unanswered) 동기화 콜백.
 *   부모(상세 화면)는 받은 카운트로 헤더 배지/카드 배지를 즉시 갱신.
 */
export default function TabQuestions({
    recruitmentId,
    isAuthor,
    currentUserId,
    onGuestBlock,
    open = true,
    onCountsChange,
    /** 외부에서 "질문하기" 진입 시 자동으로 비공개 ON으로 시작 */
    defaultPrivate = false,
}) {
    const theme = useTheme();
    const {
        items, loading, loadError, posting, busyId, counts,
        load, post, remove, answerUpsert, answerRemove, togglePin,
    } = useRecruitmentQuestions(recruitmentId, { open });

    const [draft, setDraft] = useState("");
    const [isPrivate, setIsPrivate] = useState(defaultPrivate);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const inputRef = useRef(null);

    // 외부에서 defaultPrivate=true로 진입 시 적용 + 포커스
    useEffect(() => {
        if (open && defaultPrivate) {
            setIsPrivate(true);
            // 다음 tick에 포커스 (Tabs 마운트 완료 후)
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open, defaultPrivate]);

    // items 변경 시 부모에게 카운트 동기화 — 답변 등록/삭제 시 헤더 배지 즉시 갱신
    useEffect(() => {
        if (!loading) onCountsChange?.(counts);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [counts.total, counts.unanswered, loading]);

    const isLoggedIn = Boolean(currentUserId);
    const canAsk = isLoggedIn && !isAuthor;

    const handleSubmitQuestion = async () => {
        const body = draft.trim();
        if (body.length < 2) return;
        // 미로그인이면 부모 콜백, 게스트면 전역 GuestBlockModal 트리거 (모집은 차단 정책 유지)
        if (!isLoggedIn) { onGuestBlock?.(); return; }
        if (blockIfGuest({
            description: (
                <>회원가입하고 팀을 찾아보세요.<br />지원 신청, 북마크, 모집글 작성은<br />회원만 이용할 수 있어요.</>
            ),
        })) return;
        try {
            await post(body, { isPrivate });
            setDraft("");
            setIsPrivate(false); // 다음 질문은 기본 공개로
        } catch { /* hook toast */ }
    };

    return (
        <Stack spacing={1.5}>
            {/* ── 입력 영역 ── */}
            {isAuthor ? (
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    sx={{
                        p: 1.25, borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                    }}
                >
                    <QuestionAnswerRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                    <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.5 }}>
                        내 모집글에 도착한 질문에 답변해보세요.
                    </Typography>
                </Stack>
            ) : !isLoggedIn ? (
                <Box
                    onClick={() => onGuestBlock?.()}
                    sx={{
                        p: 1.5, borderRadius: 1.5, cursor: "pointer",
                        bgcolor: "action.hover",
                        textAlign: "center",
                        "&:hover": { bgcolor: "action.selected" },
                    }}
                >
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>
                        로그인 후 질문할 수 있어요
                    </Typography>
                </Box>
            ) : (
                <Box>
                    <TextField
                        inputRef={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.slice(0, QUESTION_MAX))}
                        placeholder={isPrivate
                            ? "작성자만 볼 수 있는 비공개 질문을 입력하세요. (2~500자)"
                            : "궁금한 점을 자유롭게 물어보세요. (2~500자)"}
                        multiline
                        minRows={2}
                        maxRows={5}
                        fullWidth
                        disabled={posting}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: 13 } }}
                    />
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.5} gap={1}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={isPrivate}
                                    onChange={(e) => setIsPrivate(e.target.checked)}
                                    disabled={posting}
                                    icon={<LockOutlinedIcon sx={{ fontSize: 16 }} />}
                                    checkedIcon={<LockOutlinedIcon sx={{ fontSize: 16 }} />}
                                    sx={{
                                        py: 0,
                                        color: "text.disabled",
                                        "&.Mui-checked": { color: "primary.main" },
                                    }}
                                />
                            }
                            label={
                                <Typography sx={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: isPrivate ? "primary.main" : "text.disabled",
                                }}>
                                    비공개로 묻기
                                </Typography>
                            }
                            sx={{ m: 0 }}
                        />
                        <Stack direction="row" alignItems="center" gap={1}>
                            <Typography sx={{
                                fontSize: 11,
                                color: draft.length >= QUESTION_MAX - 20 ? "warning.main" : "text.disabled",
                            }}>
                                {draft.length} / {QUESTION_MAX}
                            </Typography>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={posting
                                    ? <CircularProgress size={12} color="inherit" />
                                    : <SendRoundedIcon sx={{ fontSize: 14 }} />}
                                disabled={posting || draft.trim().length < 2 || !canAsk}
                                onClick={(e) => { e.stopPropagation(); handleSubmitQuestion(); }}
                                sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12.5, minHeight: 30 }}
                            >
                                질문 등록
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            )}

            {/* ── 리스트 ── */}
            {loading ? (
                <Stack spacing={1}>
                    <Skeleton variant="rounded" height={60} />
                    <Skeleton variant="rounded" height={60} />
                    <Skeleton variant="rounded" height={60} />
                </Stack>
            ) : loadError ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                    <Box sx={{
                        width: 48, height: 48,
                        borderRadius: 1.75,
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        mb: 1.25,
                    }}>
                        ⚠️
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
                        질문을 불러오지 못했어요
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 0.5, mb: 1.5 }}>
                        잠시 후 다시 시도해 주세요.
                    </Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={load}
                        sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12.5 }}
                    >
                        다시 시도
                    </Button>
                </Box>
            ) : items.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                    <Box sx={{
                        width: 48, height: 48,
                        borderRadius: 1.75,
                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        mb: 1.25,
                    }}>
                        💬
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary" }}>
                        아직 질문이 없어요
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 0.5 }}>
                        {isAuthor ? "지원자들의 궁금증을 미리 풀어보세요" : "첫 질문을 남겨보세요"}
                    </Typography>
                </Box>
            ) : (
                <Stack spacing={1}>
                    {items.map((q) => (
                        <QuestionCard
                            key={q.id}
                            q={q}
                            isAuthor={isAuthor}
                            currentUserId={currentUserId}
                            busy={busyId === q.id}
                            onDelete={() => setConfirmDelete({ qId: q.id, type: "question" })}
                            onPin={() => togglePin(q.id, !q.isPinned)}
                            onAnswerUpsert={(body) => answerUpsert(q.id, body)}
                            onAnswerDelete={() => setConfirmDelete({ qId: q.id, type: "answer" })}
                        />
                    ))}
                </Stack>
            )}

            {/* ── 삭제 확인 (모달 안에서도 위로 뜨도록 zIndex 명시) ── */}
            <ConfirmDialog
                open={Boolean(confirmDelete)}
                title={confirmDelete?.type === "answer" ? "답변 삭제" : "질문 삭제"}
                message={
                    confirmDelete?.type === "answer"
                        ? "이 답변을 삭제하시겠어요?"
                        : "이 질문을 삭제하시겠어요?\n삭제된 질문은 다른 사용자에게 보이지 않아요."
                }
                confirmText="삭제"
                cancelText="취소"
                confirmColor="error"
                onClose={() => setConfirmDelete(null)}
                onConfirm={async () => {
                    if (!confirmDelete) return;
                    if (confirmDelete.type === "answer") await answerRemove(confirmDelete.qId);
                    else await remove(confirmDelete.qId);
                    setConfirmDelete(null);
                }}
                zIndex={Z.MODAL_NESTED}
            />
        </Stack>
    );
}
