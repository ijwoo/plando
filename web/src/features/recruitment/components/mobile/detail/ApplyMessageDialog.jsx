import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Z } from "../../../../../shared/ui/zIndex.js";
import { fillInputSx, SHADOW } from "../../common/recruitmentSx";
import { RECRUITMENT_LIMITS } from "../../../constants/recruitmentConfig";

const MAX_LENGTH = RECRUITMENT_LIMITS.APPLY_MESSAGE;

/**
 * 참여 신청 메시지 입력 다이얼로그.
 * roles: 모집글의 역할 목록 [{ id, name, count, acceptedCount }]
 * selectedRoleId: 현재 선택된 역할 id (필수). 미선택 시 신청 버튼 비활성.
 */
export default function ApplyMessageDialog({
    open,
    loading,
    roles = [],
    selectedRoleId,
    onRoleChange,
    message,
    onMessageChange,
    onClose,
    onSubmit,
    footerSecondarySx,
}) {
    const theme = useTheme();

    // 빈 자리가 있는 역할만 노출. acceptedCount == count 면 가득찬 거.
    const availableRoles = roles.filter((r) => (r.acceptedCount ?? 0) < (r.count ?? 0));
    const hasRoles = availableRoles.length > 0;
    const canSubmit = !loading && (!hasRoles || !!selectedRoleId);

    return (
        <Dialog
            open={open}
            onClose={() => !loading && onClose()}
            maxWidth="xs"
            fullWidth
            sx={{ zIndex: Z.MODAL_NESTED }}
            PaperProps={{
                sx: {
                    borderRadius: 2.5,
                    overflow: "hidden",
                    boxShadow: SHADOW.lift,
                },
            }}
        >
            <DialogTitle sx={{
                fontWeight: 700,
                fontSize: 16,
                pb: 1,
                letterSpacing: "-0.025em",
            }}>
                참여 신청
            </DialogTitle>
            <DialogContent sx={{ pt: "8px !important" }}>
                {hasRoles && (
                    <Box sx={{ mb: 2 }}>
                        <Typography sx={{ mb: 1, fontSize: 13, color: "text.primary", fontWeight: 600 }}>
                            지원할 역할 <Box component="span" sx={{ color: "primary.main", ml: 0.25 }}>*</Box>
                        </Typography>
                        <TextField
                            select
                            fullWidth
                            value={selectedRoleId || ""}
                            onChange={(e) => onRoleChange(e.target.value || null)}
                            disabled={loading}
                            placeholder="역할을 선택해 주세요"
                            sx={fillInputSx(theme)}
                            SelectProps={{
                                displayEmpty: true,
                                // Dialog(Z.MODAL_NESTED=1500) 위에 떠야 하므로 zIndex 명시
                                MenuProps: { sx: { zIndex: Z.TOAST } },
                                renderValue: (v) => {
                                    if (!v) return <Box component="span" sx={{ color: "text.disabled" }}>역할을 선택해 주세요</Box>;
                                    const r = availableRoles.find((x) => String(x.id) === String(v));
                                    return r ? r.name : "";
                                },
                            }}
                        >
                            {availableRoles.map((r) => {
                                return (
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
                                );
                            })}
                        </TextField>
                    </Box>
                )}

                <Typography sx={{ mb: 1.5, fontSize: 13, color: "text.disabled", fontWeight: 500 }}>
                    팀장에게 전할 메시지 (선택)
                </Typography>
                <TextField
                    autoFocus={!hasRoles}
                    multiline
                    rows={3}
                    fullWidth
                    placeholder="간단한 자기소개나 지원 동기를 적어주세요."
                    value={message}
                    onChange={(e) => onMessageChange(e.target.value.slice(0, MAX_LENGTH))}
                    disabled={loading}
                    sx={fillInputSx(theme)}
                />
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.75 }}>
                    <Typography sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: message.length >= MAX_LENGTH - 20 ? "warning.main" : "text.disabled",
                    }}>
                        {message.length} / {MAX_LENGTH}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
                <Button
                    variant="outlined"
                    onClick={onClose}
                    disabled={loading}
                    sx={{ ...footerSecondarySx, height: 42, flex: 1 }}
                >
                    취소
                </Button>
                <Button
                    variant="contained"
                    disableElevation
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    sx={{
                        height: 42,
                        borderRadius: 1.25,
                        fontWeight: 800,
                        fontSize: 13.5,
                        flex: 2,
                        textTransform: "none",
                        opacity: canSubmit ? 1 : 0.55,
                    }}
                >
                    {loading ? <CircularProgress size={16} color="inherit" /> : "신청하기"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
