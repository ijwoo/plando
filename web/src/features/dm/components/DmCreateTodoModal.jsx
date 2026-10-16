import React, { useEffect, useState } from "react";
import {
    Dialog,
    Box,
    Typography,
    TextField,
    Button,
    Stack,
    Chip,
    useTheme,
} from "@mui/material";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { addTodo } from "../../todo/api/todoApi.js";
import { toast } from "../../../shared/utils/toast.js";
import { Z } from "../../../shared/ui/zIndex.js";
import { getDialogTokens } from "../../../shared/ui/dialogTokens.js";

/**
 * DM 메시지를 todo로 변환하는 가벼운 모달.
 * - 제목: 메시지 본문 미리 채움 (사용자 수정 가능)
 * - 담당자: 1:1 DM이면 상대방 자동, 그룹이면 비움 (사용자가 나중에 todo 패널에서 지정)
 * - 우선순위/마감일: 기본값 — 필요 시 todo detail에서 보완
 */
export default function DmCreateTodoModal({ open, onClose, sourceMessage, room }) {
    const theme = useTheme();
    const [title, setTitle] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            const raw = sourceMessage?.content?.trim() || "";
            // 너무 긴 메시지는 첫 줄 + 80자 기준으로 잘라 제목 후보로
            const firstLine = raw.split(/\r?\n/, 1)[0] || raw;
            setTitle(firstLine.length > 80 ? firstLine.slice(0, 80) : firstLine);
        }
    }, [open, sourceMessage]);

    const partnerEmail = !room?.isGroup ? room?.partnerEmail : null;
    const partnerName = !room?.isGroup ? room?.partnerName : null;

    const tok = getDialogTokens(theme);

    const handleConfirm = async () => {
        const finalTitle = title.trim();
        if (!finalTitle) {
            toast.error("제목을 입력해주세요.");
            return;
        }
        setSaving(true);
        try {
            await addTodo({
                title: finalTitle,
                content: sourceMessage?.content || "",
                status: "TODO",
                priority: "MEDIUM",
                startAt: null,
                dueDate: null,
                assignees: partnerEmail ? [partnerEmail] : [],
            });
            toast.success("할 일로 만들어졌어요");
            onClose?.();
        } catch (e) {
            toast.error(e?.response?.data?.message || "할 일 생성에 실패했어요");
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
                    <AssignmentRoundedIcon sx={{ fontSize: 20, color: "primary.main" }} />
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: tok.text }}>
                        메시지를 할 일로 만들기
                    </Typography>
                </Stack>

                <Stack spacing={1.5}>
                    <Box>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tok.text2, mb: 0.5, letterSpacing: 0.3 }}>
                            제목
                        </Typography>
                        <TextField
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            fullWidth
                            size="small"
                            autoFocus
                            disabled={saving}
                            placeholder="할 일 제목"
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    bgcolor: tok.inputBg,
                                    borderRadius: 2,
                                    fontSize: 14,
                                },
                            }}
                        />
                    </Box>

                    <Box>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tok.text2, mb: 0.5, letterSpacing: 0.3 }}>
                            담당자
                        </Typography>
                        {partnerEmail ? (
                            <Chip
                                label={partnerName || partnerEmail.split("@")[0]}
                                size="small"
                                sx={{ height: 24, fontSize: 12, fontWeight: 600 }}
                            />
                        ) : (
                            <Typography sx={{ fontSize: 12.5, color: tok.text2 }}>
                                그룹 대화예요. 만든 뒤 할 일 상세에서 지정해 주세요
                            </Typography>
                        )}
                    </Box>
                </Stack>
            </Box>

            <Box sx={{ display: "flex", borderTop: `1px solid ${tok.border}` }}>
                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={{
                        flex: 1, py: 1.25,
                        borderRadius: 0, borderRight: `1px solid ${tok.border}`,
                        color: tok.text2, fontWeight: 600, fontSize: 14,
                        textTransform: "none",
                    }}
                >
                    취소
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={saving || !title.trim()}
                    sx={{
                        flex: 1, py: 1.25,
                        borderRadius: 0,
                        color: "primary.main", fontWeight: 800, fontSize: 14,
                        textTransform: "none",
                    }}
                >
                    {saving ? "만드는 중..." : "만들기"}
                </Button>
            </Box>
        </Dialog>
    );
}
