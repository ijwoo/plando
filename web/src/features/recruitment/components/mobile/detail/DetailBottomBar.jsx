import { useState } from "react";
import { Box, Button, CircularProgress, Menu, MenuItem, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { Z } from "../../../../../shared/ui/zIndex.js";
import { SHADOW } from "../../common/recruitmentSx";

/**
 * 모바일(< md) 모달 sticky bottom bar.
 * 작성자: 더보기 메뉴 + 신청자 관리. 지원자: 신청 버튼만.
 */
export default function DetailBottomBar({
    detail,
    isAccepted,
    isPending,
    statusLoading,
    applyLoading,
    onToggleStatus,
    onOpenDelete,
    onEdit,
    onOpenApplicantsTab,
    onApplyClick,
    footerSecondarySx,
}) {
    const theme = useTheme();
    const [moreAnchor, setMoreAnchor] = useState(null);
    const closeMenu = () => setMoreAnchor(null);
    const isClosed = detail.statusLabel === "마감";

    return (
        <Box sx={{
            position: "sticky",
            bottom: 0,
            px: 2,
            py: 1.75,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: alpha(theme.palette.text.primary, 0.06),
            flexShrink: 0,
        }}>
            {detail.isAuthor ? (
                <>
                    <Stack direction="row" gap={1}>
                        <Button
                            variant="outlined"
                            startIcon={<MoreHorizRoundedIcon sx={{ fontSize: 18 }} />}
                            onClick={(e) => setMoreAnchor(e.currentTarget)}
                            disabled={statusLoading}
                            sx={{
                                ...footerSecondarySx,
                                height: 44,
                                fontSize: 13.5,
                                px: 2,
                                flexShrink: 0,
                            }}
                        >
                            더보기
                        </Button>
                        <Button
                            variant="contained"
                            disableElevation
                            fullWidth
                            startIcon={<PersonRoundedIcon />}
                            onClick={onOpenApplicantsTab}
                            sx={{
                                height: 44,
                                borderRadius: 1.25,
                                fontWeight: 800,
                                fontSize: 13.5,
                                textTransform: "none",
                            }}
                        >
                            신청자 관리{detail.applicants > 0 ? ` (${detail.applicants})` : ""}
                        </Button>
                    </Stack>

                    <Menu
                        anchorEl={moreAnchor}
                        open={Boolean(moreAnchor)}
                        onClose={closeMenu}
                        anchorOrigin={{ vertical: "top", horizontal: "left" }}
                        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
                        sx={{ zIndex: Z.MODAL_NESTED }}
                        PaperProps={{
                            sx: {
                                borderRadius: 1.5,
                                minWidth: 180,
                                boxShadow: SHADOW.lift,
                                border: 0,
                            },
                        }}
                    >
                        <MenuItem
                            disabled={statusLoading}
                            onClick={() => { closeMenu(); onToggleStatus(); }}
                            sx={{ fontSize: 14, fontWeight: 700 }}
                        >
                            {detail.statusLabel === "모집중" ? "마감 처리" : "모집중으로 변경"}
                        </MenuItem>
                        <MenuItem
                            onClick={() => { closeMenu(); onEdit(); }}
                            sx={{ fontSize: 14, fontWeight: 700, gap: 1 }}
                        >
                            <EditRoundedIcon sx={{ fontSize: 17 }} /> 수정
                        </MenuItem>
                        <MenuItem
                            onClick={() => { closeMenu(); onOpenDelete(); }}
                            sx={{ fontSize: 14, fontWeight: 700, color: "error.main", gap: 1 }}
                        >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /> 삭제
                        </MenuItem>
                    </Menu>
                </>
            ) : isAccepted ? (
                <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.75,
                    height: 44,
                    borderRadius: 1.25,
                    bgcolor: alpha(theme.palette.success.main, 0.12),
                    color: "success.main",
                    fontSize: 14,
                    fontWeight: 700,
                }}>
                    <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
                    합류 완료
                </Box>
            ) : isClosed && !isPending ? (
                <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 44,
                    borderRadius: 1.25,
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                    color: "text.disabled",
                    fontSize: 14,
                    fontWeight: 700,
                }}>
                    모집이 마감되었어요
                </Box>
            ) : (
                <Button
                    variant={isPending ? "outlined" : "contained"}
                    disableElevation
                    color={isPending ? "error" : "primary"}
                    fullWidth
                    disabled={applyLoading}
                    onClick={onApplyClick}
                    sx={{
                        height: 44,
                        borderRadius: 1.25,
                        fontWeight: 800,
                        fontSize: 13.5,
                        textTransform: "none",
                    }}
                >
                    {applyLoading
                        ? <CircularProgress size={18} color="inherit" />
                        : isPending ? "신청 취소" : "참여 신청하기"}
                </Button>
            )}
        </Box>
    );
}
