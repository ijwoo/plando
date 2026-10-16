import React, { useEffect, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    IconButton,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { fillInputSx, SHADOW } from "../common/recruitmentSx";
import { getLocationText } from "../../utils/recruitmentUtils";
import { RECRUITMENT_LIMITS } from "../../constants/recruitmentConfig";

const MESSAGE_MAX = RECRUITMENT_LIMITS.APPLY_MESSAGE;

// eslint-disable-next-line no-unused-vars
export default function ApplyDialog({ open, onClose, item, onApply, onDone }) {
    const theme = useTheme();
    const [message, setMessage] = useState("");
    const [roleId, setRoleId] = useState(null);
    const [loading, setLoading] = useState(false);

    // 다이얼로그 열릴 때 입력 초기화
    useEffect(() => {
        if (open) { setMessage(""); setRoleId(null); }
    }, [open]);

    if (!item) return null;

    const availableRoles = (item.roles || []).filter(
        (r) => (r.acceptedCount ?? 0) < (r.count ?? 0)
    );
    const hasRoles = availableRoles.length > 0;
    const canSubmit = !loading && (!hasRoles || !!roleId);

    const handleSubmit = async () => {
        if (!onApply || !canSubmit) return;
        setLoading(true);
        try {
            await onApply(item.id, message, roleId);
            setMessage("");
            setRoleId(null);
            onClose();
        } catch {
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={() => !loading && onClose()}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2.5,
                    bgcolor: "background.paper",
                    boxShadow: SHADOW.lift,
                },
            }}
        >
            {/* 헤더 */}
            <Box sx={{ px: 2.75, pt: 2.75, pb: 1.25 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: "text.primary",
                            letterSpacing: "-0.025em",
                        }}>
                            참여 신청
                        </Typography>
                        <Typography sx={{
                            fontSize: 13,
                            color: "text.disabled",
                            fontWeight: 500,
                            mt: 0.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {item.title} · {getLocationText(item)}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={onClose}
                        disabled={loading}
                        sx={{
                            width: 32, height: 32,
                            borderRadius: 1,
                            color: "text.secondary",
                            "&:hover": {
                                bgcolor: alpha(theme.palette.text.primary, 0.05),
                                color: "text.primary",
                            },
                        }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Stack>
            </Box>

            {/* 본문 */}
            <DialogContent sx={{ px: 2.75, pt: 1, pb: 3 }}>
                <Stack spacing={2}>
                    {hasRoles && (
                        <Box>
                            <Typography sx={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: "text.primary",
                                letterSpacing: "-0.015em",
                                mb: 1,
                            }}>
                                지원할 역할 <Box component="span" sx={{ color: "primary.main", ml: 0.25 }}>*</Box>
                            </Typography>
                            <TextField
                                select
                                fullWidth
                                value={roleId || ""}
                                onChange={(e) => setRoleId(e.target.value || null)}
                                disabled={loading}
                                sx={fillInputSx(theme)}
                                SelectProps={{
                                    displayEmpty: true,
                                    renderValue: (v) => {
                                        if (!v) return <Box component="span" sx={{ color: "text.disabled" }}>역할을 선택해 주세요</Box>;
                                        const r = availableRoles.find((x) => String(x.id) === String(v));
                                        return r ? r.name : "";
                                    },
                                }}
                            >
                                {availableRoles.map((r) => (
                                    <MenuItem key={r.id} value={r.id}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: "100%" }}>
                                            <span>{r.name}</span>
                                            <Box component="span" sx={{
                                                ml: 1,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: "primary.main",
                                                bgcolor: alpha(theme.palette.primary.main, 0.10),
                                                px: 0.875,
                                                py: 0.125,
                                                borderRadius: 0.75,
                                            }}>
                                                {r.acceptedCount ?? 0}/{r.count ?? 0}명
                                            </Box>
                                        </Stack>
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>
                    )}

                    <Box>
                        <Typography sx={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: "text.primary",
                            letterSpacing: "-0.015em",
                            mb: 1,
                        }}>
                            팀장에게 전할 메시지 (선택)
                        </Typography>
                        <TextField
                            value={message}
                            onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                            fullWidth
                            multiline
                            minRows={4}
                            placeholder="간단한 자기소개나 지원 동기를 적어주세요."
                            disabled={loading}
                            sx={fillInputSx(theme)}
                        />
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.75 }}>
                            <Typography sx={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                                color: message.length >= MESSAGE_MAX - 20
                                    ? "warning.main"
                                    : "text.disabled",
                            }}>
                                {message.length} / {MESSAGE_MAX}
                            </Typography>
                        </Box>
                    </Box>

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                            variant="outlined"
                            onClick={onClose}
                            disabled={loading}
                            sx={{
                                height: 42,
                                px: 2.5,
                                borderRadius: 1.25,
                                fontSize: 13.5,
                                fontWeight: 700,
                                textTransform: "none",
                                color: "text.primary",
                                borderColor: alpha(theme.palette.text.primary, 0.12),
                                "&:hover": {
                                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                                    borderColor: alpha(theme.palette.text.primary, 0.2),
                                },
                            }}
                        >
                            취소
                        </Button>
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            sx={{
                                height: 42,
                                minWidth: 120,
                                borderRadius: 1.25,
                                fontSize: 13.5,
                                fontWeight: 800,
                                textTransform: "none",
                                bgcolor: "primary.main",
                                opacity: canSubmit ? 1 : 0.55,
                                "&:hover": { bgcolor: "primary.dark" },
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                "신청하기"
                            )}
                        </Button>
                    </Stack>
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
