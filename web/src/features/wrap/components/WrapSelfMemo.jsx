import React, { useState } from "react";
import { Box, Stack, Typography, TextField } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Press from "../../../shared/ui/primitives/Press.jsx";
import Sheet from "../../../shared/ui/primitives/Sheet.jsx";
import { saveWrapSelfMemo } from "../api/wrapApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";

/**
 * 셀프 메모 — 사용자가 한 줄 직접 적은 회고.
 * 빈 상태 / 작성된 상태 / 편집 sheet.
 *
 * onChange(newContent): 부모가 data.selfMemo 업데이트할 수 있게 콜백.
 */
export default function WrapSelfMemo({ content, weekStart, onChange }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState(content || "");
    const [saving, setSaving] = useState(false);

    const handleOpen = () => {
        setDraft(content || "");
        setEditOpen(true);
    };

    const handleSave = async () => {
        const trimmed = draft.trim();
        setSaving(true);
        try {
            await saveWrapSelfMemo(trimmed, weekStart);
            onChange?.(trimmed || null);
            setEditOpen(false);
        } catch (e) {
            toast.error(getApiError(e, "메모 저장에 실패했어요."));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await saveWrapSelfMemo("", weekStart);
            onChange?.(null);
            setEditOpen(false);
        } catch (e) {
            toast.error(getApiError(e, "메모 삭제에 실패했어요."));
        } finally {
            setSaving(false);
        }
    };

    const hasContent = content && content.trim().length > 0;

    return (
        <>
            <Press
                as="div"
                onClick={handleOpen}
                haptic="light"
                pressScale={0.99}
                style={{ display: "block", width: "100%" }}
            >
                <Box
                    sx={{
                        background: isDark ? "rgba(255,255,255,0.03)" : "var(--plando-surface-alt)",
                        borderRadius: "var(--plando-radius-md)",
                        padding: "16px 16px",
                        border: hasContent
                            ? "none"
                            : `1px dashed ${isDark ? "rgba(255,255,255,0.12)" : "var(--plando-border)"}`,
                    }}
                >
                    {hasContent ? (
                        <Stack spacing={0.75}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography
                                    sx={{
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        color: "var(--plando-primary)",
                                        letterSpacing: "0.08em",
                                    }}
                                >
                                    내 한 줄 회고
                                </Typography>
                                <EditRoundedIcon
                                    sx={{ fontSize: 14, color: "text.secondary", opacity: 0.6 }}
                                />
                            </Stack>
                            <Typography
                                sx={{
                                    fontSize: 14.5,
                                    fontWeight: 600,
                                    lineHeight: 1.55,
                                    color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                                    letterSpacing: "-0.01em",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {content}
                            </Typography>
                        </Stack>
                    ) : (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <EditRoundedIcon sx={{ fontSize: 16, color: "var(--plando-primary)" }} />
                            <Typography
                                sx={{
                                    fontSize: 13.5,
                                    fontWeight: 600,
                                    color: "text.secondary",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                한 줄로 이번 주를 적어보세요
                            </Typography>
                        </Stack>
                    )}
                </Box>
            </Press>

            {/* 편집 sheet */}
            <Sheet
                open={editOpen}
                onClose={() => setEditOpen(false)}
                height="auto"
                header={
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                            px: 2.5,
                            pt: 1,
                            pb: 1.5,
                            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "var(--plando-divider)"}`,
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: "var(--plando-type-title2-size)",
                                fontWeight: "var(--plando-type-title2-weight)",
                                color: "text.primary",
                                letterSpacing: "var(--plando-type-title2-ls)",
                            }}
                        >
                            한 줄 회고
                        </Typography>
                        <Press
                            as="span"
                            onClick={handleSave}
                            haptic="medium"
                            pressScale={0.92}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "6px 12px",
                                borderRadius: 999,
                                background: "var(--plando-primary)",
                                color: "#fff",
                                opacity: saving ? 0.6 : 1,
                            }}
                        >
                            <CheckRoundedIcon sx={{ fontSize: 16 }} />
                            <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em" }}>
                                저장
                            </Typography>
                        </Press>
                    </Stack>
                }
            >
                <Stack spacing={1.5} sx={{ px: 2.5, pt: 2, pb: "calc(20px + env(safe-area-inset-bottom))" }}>
                    <TextField
                        autoFocus
                        multiline
                        minRows={4}
                        maxRows={10}
                        fullWidth
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="이번 주를 한두 줄로 정리해보세요"
                        slotProps={{
                            input: {
                                sx: {
                                    fontSize: 15,
                                    fontWeight: 500,
                                    lineHeight: 1.55,
                                    letterSpacing: "-0.01em",
                                    "& textarea": {
                                        padding: 0,
                                    },
                                },
                            },
                        }}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "var(--plando-radius-md)",
                                background: isDark ? "rgba(255,255,255,0.03)" : "var(--plando-surface-alt)",
                                padding: "14px 14px",
                            },
                            "& fieldset": { border: "none" },
                        }}
                    />
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 0.5 }}>
                        <Typography
                            sx={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: "text.secondary",
                                opacity: 0.6,
                            }}
                        >
                            {draft.length}/2000
                        </Typography>
                        {hasContent ? (
                            <Press
                                as="span"
                                onClick={handleDelete}
                                haptic="medium"
                                pressScale={0.95}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                }}
                            >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 15, color: "var(--plando-red)" }} />
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "var(--plando-red)" }}>
                                    삭제
                                </Typography>
                            </Press>
                        ) : null}
                    </Stack>
                </Stack>
            </Sheet>
        </>
    );
}
