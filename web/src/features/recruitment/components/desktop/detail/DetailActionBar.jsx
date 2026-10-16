import React, { useState } from "react";
import { Box, Button, IconButton, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { SHADOW } from "../../common/recruitmentSx";

/**
 * DetailActionBar — CTA + 북마크/공유 + (작성자) 신청자 관리 / 더보기 메뉴
 */
export default function DetailActionBar({
    item,
    rawItem,
    isPending,
    isAccepted,
    statusLoading,
    isOpen,
    applicantCount,
    pendingCount = 0,
    onApplyClick,
    onBookmark,
    onShare,
    onOpenApplicants,
    onToggleStatus,
    onEdit,
    onOpenDeleteConfirm,
}) {
    const theme = useTheme();
    const [moreAnchor, setMoreAnchor] = useState(null);

    // 보조 버튼(저장/공유/신청자 관리 + 더보기) 공통 스타일
    const secondaryBtnSx = {
        height: 44,
        px: 2,
        borderRadius: 1.25,
        bgcolor: "background.paper",
        borderColor: alpha(theme.palette.text.primary, 0.12),
        color: "text.secondary",
        fontSize: 13,
        fontWeight: 700,
        textTransform: "none",
        boxShadow: SHADOW.sm,
        "&:hover": {
            bgcolor: alpha(theme.palette.text.primary, 0.03),
            borderColor: alpha(theme.palette.text.primary, 0.18),
            color: "text.primary",
        },
    };

    // 작성자 상태 안내 (좌측 채움) — 지원자 수 / 대기 안내
    const hasApplicants = applicantCount > 0;
    const AuthorStatusIcon = hasApplicants ? NotificationsActiveRoundedIcon : InboxRoundedIcon;
    // applicantCount(=detail.applicants)는 PENDING + ACCEPTED 합계라 "검토 대기"가 아니다.
    // 대기 인원은 서버가 따로 주는 pendingCount(=PENDING 만)를 쓴다 — 수락을 다 끝낸 팀에게
    // 아직 검토할 게 남았다고 말하지 않기 위해서다.
    const authorStatusText = !hasApplicants
        ? "아직 지원자가 없어요"
        : pendingCount > 0
            ? `검토 대기 ${pendingCount}명`
            : `지원자 ${applicantCount}명`;
    const authorStatusSub = !hasApplicants
        ? "공고를 공유해 더 많은 지원자를 만나보세요"
        : pendingCount > 0
            ? "신청자 관리에서 수락하거나 거절할 수 있어요"
            : "대기 중인 신청은 없어요";

    return (
        <Box sx={{
            maxWidth: 1100,
            mx: "auto",
            px: 4,
            mb: 3.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
        }}>
            {/* 작성자: 좌측 상태 안내 / 비-작성자: CTA */}
            {item.isAuthor ? (
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={1.5}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        py: 1.25,
                        px: 2,
                        borderRadius: 1.5,
                        bgcolor: hasApplicants
                            ? alpha(theme.palette.primary.main, 0.06)
                            : alpha(theme.palette.text.primary, 0.04),
                    }}
                >
                    <Box sx={{
                        width: 36, height: 36,
                        borderRadius: 1.25,
                        display: "grid", placeItems: "center",
                        flexShrink: 0,
                        bgcolor: hasApplicants
                            ? alpha(theme.palette.primary.main, 0.12)
                            : alpha(theme.palette.text.primary, 0.06),
                        color: hasApplicants ? "primary.main" : "text.secondary",
                    }}>
                        <AuthorStatusIcon sx={{ fontSize: 18 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: "text.primary",
                            letterSpacing: "-0.015em",
                            lineHeight: 1.3,
                        }}>
                            {authorStatusText}
                        </Typography>
                        <Typography sx={{
                            fontSize: 11.5,
                            color: "text.disabled",
                            fontWeight: 500,
                            mt: 0.25,
                            lineHeight: 1.4,
                        }}>
                            {authorStatusSub}
                        </Typography>
                    </Box>
                </Stack>
            ) : (
                <Button
                    variant="contained"
                    disableElevation
                    disabled={isAccepted || (!isOpen && !isPending)}
                    onClick={onApplyClick}
                    startIcon={isAccepted
                        ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
                        : (!isOpen && !isPending) ? null
                            : <SendRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={{
                        flex: 1,
                        py: 1.625,
                        borderRadius: 1.5,
                        fontSize: 14,
                        fontWeight: 800,
                        letterSpacing: "-0.015em",
                        textTransform: "none",
                        bgcolor: isPending
                            ? theme.palette.warning.main
                            : theme.palette.primary.main,
                        "&:hover": {
                            bgcolor: isPending
                                ? theme.palette.warning.dark
                                : theme.palette.primary.dark,
                        },
                        "&.Mui-disabled": isAccepted
                            ? {
                                bgcolor: alpha(theme.palette.success.main, 0.10),
                                color: theme.palette.success.main,
                            }
                            : {
                                bgcolor: alpha(theme.palette.text.primary, 0.06),
                                color: theme.palette.text.disabled,
                            },
                    }}
                >
                    {isAccepted
                        ? "합류됨"
                        : (!isOpen && !isPending)
                            ? "모집이 마감되었어요"
                            : isPending ? "신청 취소" : "참여 신청하기"}
                </Button>
            )}

            {/* 북마크 */}
            <Button
                variant="outlined"
                startIcon={rawItem?.bookmarked
                    ? <BookmarkRoundedIcon sx={{ fontSize: 14 }} />
                    : <BookmarkBorderRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => onBookmark?.(rawItem?.id)}
                sx={secondaryBtnSx}
            >
                저장
            </Button>

            {/* 공유 */}
            <Button
                variant="outlined"
                startIcon={<ShareRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={onShare}
                sx={secondaryBtnSx}
            >
                공유
            </Button>

            {/* 작성자 액션 */}
            {item.isAuthor && (
                <Stack direction="row" gap={0.75}>
                    <Button
                        variant="outlined"
                        startIcon={<PeopleAltRoundedIcon sx={{ fontSize: 12 }} />}
                        onClick={() => onOpenApplicants(item.id)}
                        sx={secondaryBtnSx}
                    >
                        신청자 관리{applicantCount > 0 ? ` (${applicantCount})` : ""}
                    </Button>

                    <IconButton
                        onClick={(e) => setMoreAnchor(e.currentTarget)}
                        disabled={statusLoading}
                        sx={{
                            width: 44, height: 44,
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: alpha(theme.palette.text.primary, 0.12),
                            bgcolor: "background.paper",
                            color: "text.disabled",
                            boxShadow: SHADOW.sm,
                            "&:hover": {
                                bgcolor: alpha(theme.palette.text.primary, 0.03),
                                color: "text.primary",
                            },
                        }}
                    >
                        <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>

                    <Menu
                        anchorEl={moreAnchor}
                        open={Boolean(moreAnchor)}
                        onClose={() => setMoreAnchor(null)}
                        PaperProps={{
                            sx: {
                                borderRadius: 1.5,
                                border: 0,
                                boxShadow: SHADOW.lift,
                                minWidth: 160,
                            },
                        }}
                    >
                        <MenuItem
                            onClick={() => { setMoreAnchor(null); onToggleStatus(); }}
                            sx={{ fontSize: 13, fontWeight: 700, gap: 1 }}
                        >
                            {isOpen ? "마감 처리" : "모집중으로 변경"}
                        </MenuItem>
                        <MenuItem
                            onClick={() => { setMoreAnchor(null); onEdit?.(rawItem); }}
                            sx={{ fontSize: 13, fontWeight: 700, gap: 1 }}
                        >
                            <EditRoundedIcon sx={{ fontSize: 14 }} /> 수정
                        </MenuItem>
                        <MenuItem
                            onClick={() => { setMoreAnchor(null); onOpenDeleteConfirm(); }}
                            sx={{ fontSize: 13, fontWeight: 700, color: "error.main", gap: 1 }}
                        >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} /> 삭제
                        </MenuItem>
                    </Menu>
                </Stack>
            )}
        </Box>
    );
}
