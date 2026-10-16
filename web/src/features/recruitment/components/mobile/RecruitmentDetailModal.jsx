import { useEffect, useState } from "react";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import { getToken } from "../../../../shared/utils/tokenUtils.js";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogContent,
    IconButton,
    Skeleton,
    Snackbar,
    Stack,
    Tab,
    Tabs,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { updateRecruitmentStatus } from "../../api/recruitmentApi";
import { Z } from "../../../../shared/ui/zIndex.js";
import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog";
import { getUser } from "../../../../shared/utils/tokenUtils";
import { enrichForDetail, getCategory } from "../../utils/recruitmentUtils";
import useDeleteRecruitment from "../../hooks/useDeleteRecruitment";
import TabProjectInfo from "../detail/tabs/TabProjectInfo";
import TabMembers from "../detail/tabs/TabMembers";
import TabApplicants from "../detail/tabs/TabApplicants";
import TabQuestions from "../detail/tabs/TabQuestions";
import { metaPillSx, SHADOW } from "../common/recruitmentSx";
import JoinWorkspaceBanner from "./detail/JoinWorkspaceBanner";
import ApplyMessageDialog from "./detail/ApplyMessageDialog";
import DetailFooter from "./detail/DetailFooter";
import DetailBottomBar from "./detail/DetailBottomBar";

export default function RecruitmentDetailModal({
    open,
    onClose,
    item,
    detailLoading = false,
    detailError = false,
    onRetryDetail,
    kakaoReady,
    onApply,
    onReview,
    onDelete,
    onStatusChange,
    onEdit,
    onGuestBlock,
    initialTabIndex = 0,
    onQuestionsCountsChange,
}) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const [tabIndex, setTabIndex] = useState(0);
    const [applyDialogOpen, setApplyDialogOpen] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [applyMessage, setApplyMessage] = useState("");
    const [applyRoleId, setApplyRoleId] = useState(null);
    const [applyLoading, setApplyLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [snackbar, setSnackbar] = useState(null);

    const {
        deleteLoading,
        deleteConfirmOpen,
        openDeleteConfirm,
        closeDeleteConfirm,
        handleConfirmDelete,
    } = useDeleteRecruitment({
        onDelete,
        onBack: onClose,
        onError: (msg) => setSnackbar({ msg, severity: "error" }),
    });

    useEffect(() => {
        if (open) setTabIndex(initialTabIndex || 0);
    }, [open, initialTabIndex]);

    const detail = enrichForDetail(item);
    const cat = getCategory(detail.typeLabel, theme);

    const appliedStatus = detail.appliedStatus;
    const isPending  = appliedStatus === "PENDING";
    const isAccepted = appliedStatus === "ACCEPTED";

    const handleApplyClick = () => {
        if (!getToken()) {
            window.dispatchEvent(new CustomEvent(APP_EVENTS.GUEST_BLOCK_REQUEST, {
                detail: {
                    description: (
                        <>회원가입하고 팀을 찾아보세요.<br />지원 신청, 북마크, 모집글 작성은<br />회원만 이용할 수 있어요.</>
                    ),
                },
            }));
            return;
        }
        if (isPending) setCancelConfirmOpen(true);
        else if (!isAccepted) {
            setApplyMessage("");
            setApplyRoleId(null);
            setApplyDialogOpen(true);
        }
    };

    const handleConfirmApply = async () => {
        if (!onApply) return;
        setApplyLoading(true);
        try {
            await onApply(detail.id, applyMessage, applyRoleId);
            setApplyDialogOpen(false);
        } finally {
            setApplyLoading(false);
        }
    };

    const handleConfirmCancel = async () => {
        if (!onApply) return;
        setApplyLoading(true);
        await onApply(detail.id, "");
        setApplyLoading(false);
        setCancelConfirmOpen(false);
    };

    const handleToggleStatus = async () => {
        const next = detail.statusLabel === "모집중" ? "마감" : "모집중";
        setStatusLoading(true);
        try {
            await updateRecruitmentStatus(detail.id, next);
            onStatusChange?.(detail.id, next);
            setSnackbar({ msg: `상태를 '${next}'으로 변경했어요.`, severity: "success" });
        } catch {
            setSnackbar({ msg: "상태 변경에 실패했어요.", severity: "error" });
        } finally {
            setStatusLoading(false);
        }
    };

    // 보조 버튼 톤 (footer/bottomBar 공용)
    const footerSecondarySx = {
        height: 40,
        borderRadius: 1.25,
        fontWeight: 700,
        fontSize: 13,
        textTransform: "none",
        color: "text.primary",
        borderColor: alpha(theme.palette.text.primary, 0.12),
        "&:hover": {
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            borderColor: alpha(theme.palette.text.primary, 0.2),
        },
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={isMobile}
            maxWidth="lg"
            fullWidth
            sx={{ zIndex: Z.SHEET }}
            PaperProps={{
                sx: {
                    borderRadius: isMobile ? 0 : 2.5,
                    overflow: "hidden",
                    bgcolor: "background.paper",
                    boxShadow: SHADOW.lift,
                },
            }}
        >
            <DialogContent sx={{
                p: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                height: isMobile ? "100dvh" : "80vh",
            }}>
                {/* ── Hero Header ─────────────────────────────────────── */}
                <Box sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: Z.FAB,
                    flexShrink: 0,
                    background: `linear-gradient(180deg, ${alpha(cat.color, theme.palette.mode === "dark" ? 0.08 : 0.05)} 0%, transparent 80%)`,
                    borderBottom: "1px solid",
                    borderColor: alpha(theme.palette.text.primary, 0.06),
                    px: { xs: 2, md: 3 },
                    pb: 0,
                }}>
                    <Box sx={{ pt: 2.5 }}>
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            mb={1.25}
                        >
                            <Stack direction="row" gap={0.625} flexWrap="wrap">
                                <Box sx={metaPillSx(theme, cat.color)}>
                                    {detail.typeLabel}
                                </Box>
                                <Box sx={metaPillSx(theme, theme.palette.success.main)}>
                                    {detail.statusLabel || "모집중"}
                                </Box>
                            </Stack>
                            <IconButton
                                size="small"
                                onClick={onClose}
                                sx={{
                                    mr: -0.5,
                                    color: "text.secondary",
                                    "&:hover": {
                                        bgcolor: alpha(theme.palette.text.primary, 0.05),
                                        color: "text.primary",
                                    },
                                }}
                            >
                                <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                        </Stack>

                        <Typography sx={{
                            fontSize: 22,
                            fontWeight: 800,
                            lineHeight: 1.25,
                            mb: 1.75,
                            letterSpacing: "-0.03em",
                            color: "text.primary",
                        }}>
                            {detail.title}
                        </Typography>
                    </Box>

                    <Tabs
                        value={tabIndex}
                        onChange={(_, v) => setTabIndex(v)}
                        sx={{
                            minHeight: 40,
                            "& .MuiTab-root": {
                                minHeight: 40,
                                fontWeight: 700,
                                fontSize: 13,
                                px: 1.5,
                                color: "text.disabled",
                            },
                            "& .MuiTabs-indicator": {
                                bgcolor: cat.color,
                                height: 2.5,
                                borderRadius: "2px 2px 0 0",
                            },
                            "& .Mui-selected": { color: `${cat.color} !important` },
                        }}
                    >
                        <Tab label="프로젝트 정보" />
                        <Tab label={`Q&A${detail.questionCount > 0 ? ` (${detail.questionCount})` : ""}`} />
                        <Tab label="팀원" />
                        {detail.isAuthor && (
                            <Tab label={`신청자${detail.applicants > 0 ? ` (${detail.applicants})` : ""}`} />
                        )}
                    </Tabs>
                </Box>

                {isAccepted && !detail.isAuthor && (
                    <JoinWorkspaceBanner
                        detail={detail}
                        onClose={onClose}
                        onNotify={setSnackbar}
                    />
                )}

                <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
                    {/* 상세 로드 실패 — 예전엔 조용히 무시돼 오래된 목록 데이터가 그대로 보였음 */}
                    {detailError && !detailLoading && (
                        <Alert
                            severity="error"
                            action={<Button color="inherit" size="small" onClick={onRetryDetail}>재시도</Button>}
                            sx={{ mb: 2 }}
                        >
                            모집 정보를 불러오지 못했어요. 표시된 내용이 최신이 아닐 수 있어요.
                        </Alert>
                    )}
                    {detailLoading ? (
                        <Stack spacing={2}>
                            <Skeleton variant="rounded" height={24} width="60%" />
                            <Skeleton variant="rounded" height={80} />
                            <Skeleton variant="rounded" height={24} width="40%" />
                            <Stack spacing={1}>
                                <Skeleton variant="rounded" height={48} />
                                <Skeleton variant="rounded" height={48} />
                            </Stack>
                            <Skeleton variant="rounded" height={180} />
                        </Stack>
                    ) : (
                        <>
                            {tabIndex === 0 && (
                                <TabProjectInfo detail={detail} cat={cat} kakaoReady={kakaoReady} />
                            )}
                            {tabIndex === 1 && (
                                <TabQuestions
                                    recruitmentId={detail.id}
                                    isAuthor={detail.isAuthor}
                                    currentUserId={getUser()?.id ?? null}
                                    onGuestBlock={onGuestBlock}
                                    open={open && tabIndex === 1}
                                    onCountsChange={(counts) => onQuestionsCountsChange?.(detail.id, counts)}
                                />
                            )}
                            {tabIndex === 2 && (
                                <TabMembers
                                    leader={detail.leader}
                                    members={detail.members}
                                    cat={cat}
                                />
                            )}
                            {tabIndex === 3 && detail.isAuthor && (
                                <TabApplicants recruitmentId={detail.id} onReview={onReview} />
                            )}
                        </>
                    )}

                    {isMobile && <Box sx={{ height: 80 }} />}
                </Box>

                {!isMobile && (
                    <DetailFooter
                        detail={detail}
                        isAccepted={isAccepted}
                        isPending={isPending}
                        statusLoading={statusLoading}
                        applyLoading={applyLoading}
                        onToggleStatus={handleToggleStatus}
                        onOpenDelete={openDeleteConfirm}
                        onEdit={() => onEdit?.(item)}
                        onClose={onClose}
                        onOpenApplicantsTab={() => setTabIndex(3)}
                        onApplyClick={handleApplyClick}
                        footerSecondarySx={footerSecondarySx}
                    />
                )}

                {isMobile && (
                    <DetailBottomBar
                        detail={detail}
                        isAccepted={isAccepted}
                        isPending={isPending}
                        statusLoading={statusLoading}
                        applyLoading={applyLoading}
                        onToggleStatus={handleToggleStatus}
                        onOpenDelete={openDeleteConfirm}
                        onEdit={() => onEdit?.(item)}
                        onOpenApplicantsTab={() => setTabIndex(3)}
                        onApplyClick={handleApplyClick}
                        footerSecondarySx={footerSecondarySx}
                    />
                )}
            </DialogContent>

            <ApplyMessageDialog
                open={applyDialogOpen}
                loading={applyLoading}
                roles={detail.roles}
                selectedRoleId={applyRoleId}
                onRoleChange={setApplyRoleId}
                message={applyMessage}
                onMessageChange={setApplyMessage}
                onClose={() => setApplyDialogOpen(false)}
                onSubmit={handleConfirmApply}
                footerSecondarySx={footerSecondarySx}
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                title="모집글 삭제"
                message={`'${detail.title}' 모집글을 삭제하시겠어요?\n삭제 후에는 복구할 수 없어요.`}
                confirmText="삭제하기"
                cancelText="취소"
                confirmColor="error"
                onClose={() => !deleteLoading && closeDeleteConfirm()}
                onConfirm={() => handleConfirmDelete(detail.id)}
                loading={deleteLoading}
                zIndex={Z.MODAL_NESTED}
            />

            <ConfirmDialog
                open={cancelConfirmOpen}
                title="신청 취소"
                message={`'${detail.title}'에 대한 신청을 취소하시겠어요?`}
                confirmText="취소하기"
                cancelText="아니요"
                confirmColor="error"
                onClose={() => !applyLoading && setCancelConfirmOpen(false)}
                onConfirm={handleConfirmCancel}
                loading={applyLoading}
                zIndex={Z.MODAL_NESTED}
            />

            <Snackbar
                open={Boolean(snackbar)}
                autoHideDuration={3500}
                onClose={() => setSnackbar(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                sx={{ zIndex: Z.TOAST }}
            >
                {snackbar && (
                    <Alert
                        severity={snackbar.severity}
                        onClose={() => setSnackbar(null)}
                        sx={{
                            borderRadius: 1.5,
                            fontWeight: 700,
                            fontSize: 13,
                            boxShadow: SHADOW.card,
                        }}
                    >
                        {snackbar.msg}
                    </Alert>
                )}
            </Snackbar>
        </Dialog>
    );
}
