import { Box, Button, CircularProgress, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";

/**
 * 데스크탑(>= md) 모달 footer — 작성자/지원자 분기.
 * 모바일 fixed bottom bar는 DetailBottomBar 컴포넌트가 담당.
 */
export default function DetailFooter({
    detail,
    isAccepted,
    isPending,
    statusLoading,
    applyLoading,
    onToggleStatus,
    onOpenDelete,
    onEdit,
    onClose,
    onOpenApplicantsTab,
    onApplyClick,
    footerSecondarySx,
}) {
    const theme = useTheme();
    const isClosed = detail.statusLabel === "마감";

    return (
        <Box sx={{
            px: 3,
            py: 2,
            borderTop: "1px solid",
            borderColor: alpha(theme.palette.text.primary, 0.06),
            flexShrink: 0,
        }}>
            <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={1.25}>
                {detail.isAuthor ? (
                    <>
                        <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={statusLoading}
                            onClick={onToggleStatus}
                            sx={footerSecondarySx}
                        >
                            {detail.statusLabel === "모집중" ? "마감 처리" : "모집중으로 변경"}
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<DeleteOutlineRoundedIcon />}
                            onClick={onOpenDelete}
                            sx={{
                                ...footerSecondarySx,
                                color: "error.main",
                                "&:hover": {
                                    ...footerSecondarySx["&:hover"],
                                    color: "error.dark",
                                },
                            }}
                        >
                            삭제
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<EditRoundedIcon />}
                            onClick={onEdit}
                            sx={footerSecondarySx}
                        >
                            수정
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={onClose}
                            sx={footerSecondarySx}
                        >
                            닫기
                        </Button>
                        <Button
                            variant="contained"
                            disableElevation
                            startIcon={<PersonRoundedIcon />}
                            onClick={onOpenApplicantsTab}
                            sx={{
                                height: 40,
                                borderRadius: 1.25,
                                fontWeight: 800,
                                fontSize: 13,
                                px: 3,
                                textTransform: "none",
                            }}
                        >
                            신청자 관리{detail.applicants > 0 ? ` (${detail.applicants})` : ""}
                        </Button>
                    </>
                ) : isAccepted ? (
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                        height: 34,
                        px: 1.75,
                        borderRadius: 99,
                        bgcolor: alpha(theme.palette.success.main, 0.12),
                        color: "success.main",
                        fontSize: 13,
                        fontWeight: 700,
                    }}>
                        <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
                        합류 완료
                    </Box>
                ) : isClosed && !isPending ? (
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: 34,
                        px: 1.75,
                        borderRadius: 99,
                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                        color: "text.disabled",
                        fontSize: 13,
                        fontWeight: 700,
                    }}>
                        모집이 마감되었어요
                    </Box>
                ) : (
                    <Button
                        variant={isPending ? "outlined" : "contained"}
                        disableElevation
                        color={isPending ? "error" : "primary"}
                        disabled={applyLoading}
                        onClick={onApplyClick}
                        sx={{
                            height: 40,
                            borderRadius: 1.25,
                            fontWeight: 800,
                            fontSize: 13,
                            px: 3,
                            textTransform: "none",
                        }}
                    >
                        {applyLoading
                            ? <CircularProgress size={18} color="inherit" />
                            : isPending ? "신청 취소" : "참여 신청하기"}
                    </Button>
                )}
            </Stack>
        </Box>
    );
}
