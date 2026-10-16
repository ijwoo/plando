import React from "react";
import {
    Avatar,
    Box,
    CircularProgress,
    Dialog,
    DialogContent,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { metaPillSx, SHADOW } from "../common/recruitmentSx";
import {
    APPLICATION_STATUS_CFG,
    resolveStatusColor,
} from "../../constants/recruitmentConfig";

export default function ApplicantsDialog({
    open,
    onClose,
    apps,
    appsLoading,
    reviewing,
    recruitmentId,
    onReviewApp,
}) {
    const theme = useTheme();

    return (
        <Dialog
            open={open}
            onClose={onClose}
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
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                        <Typography sx={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: "text.primary",
                            letterSpacing: "-0.025em",
                        }}>
                            신청자 관리
                        </Typography>
                        <Typography sx={{
                            fontSize: 13,
                            color: "text.disabled",
                            fontWeight: 500,
                            mt: 0.5,
                        }}>
                            지원자를 수락하거나 거절할 수 있어요
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={onClose}
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

            <DialogContent sx={{ px: 2.75, pt: 1, pb: 3 }}>
                {appsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                        <CircularProgress size={28} sx={{ color: "primary.main" }} />
                    </Box>
                ) : apps.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 5 }}>
                        <Box sx={{
                            width: 56, height: 56,
                            borderRadius: 1.75,
                            bgcolor: alpha(theme.palette.text.primary, 0.04),
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 26,
                            mb: 1.5,
                        }}>
                            📬
                        </Box>
                        <Typography sx={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "text.primary",
                            letterSpacing: "-0.015em",
                        }}>
                            아직 신청자가 없어요
                        </Typography>
                        <Typography sx={{
                            fontSize: 12.5,
                            color: "text.disabled",
                            fontWeight: 500,
                            mt: 0.75,
                            lineHeight: 1.6,
                        }}>
                            모집 글을 공유하면 더 많은 지원자를 만날 수 있어요
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={1.25}>
                        {apps.map((app) => {
                            const cfg = APPLICATION_STATUS_CFG[app.status] || APPLICATION_STATUS_CFG.PENDING;
                            const label = cfg.label;
                            const chipColor = resolveStatusColor(theme, cfg.colorKey);
                            const isPendingApp = app.status === "PENDING";
                            return (
                                <Box
                                    key={app.id}
                                    sx={{
                                        p: 1.875,
                                        borderRadius: 1.75,
                                        border: 0,
                                        bgcolor: "background.paper",
                                        boxShadow: SHADOW.card,
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" gap={1.5}>
                                        <Avatar
                                            src={app.applicantAvatar}
                                            sx={{
                                                width: 40, height: 40,
                                                bgcolor: alpha(theme.palette.primary.main, 0.10),
                                                color: "primary.main",
                                                fontWeight: 700,
                                                fontSize: 15,
                                            }}
                                        >
                                            {app.applicantName?.[0]}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack direction="row" alignItems="center" gap={0.875} flexWrap="wrap">
                                                <Typography sx={{
                                                    fontSize: 13.5,
                                                    fontWeight: 700,
                                                    color: "text.primary",
                                                    letterSpacing: "-0.015em",
                                                }}>
                                                    {app.applicantName}
                                                </Typography>
                                                <Box sx={{
                                                    ...metaPillSx(theme, chipColor),
                                                    fontSize: 10.5,
                                                    fontWeight: 700,
                                                    px: 1,
                                                    py: 0.25,
                                                }}>
                                                    {label}
                                                </Box>
                                                {app.selectedRoleName && (
                                                    <Box sx={{
                                                        ...metaPillSx(theme, theme.palette.primary.main),
                                                        fontSize: 10.5,
                                                        fontWeight: 700,
                                                        px: 1,
                                                        py: 0.25,
                                                    }}>
                                                        {app.selectedRoleName}
                                                    </Box>
                                                )}
                                            </Stack>
                                            <Typography sx={{
                                                fontSize: 11.5,
                                                color: "text.disabled",
                                                fontWeight: 500,
                                                mt: 0.25,
                                            }}>
                                                {app.appliedAt}
                                            </Typography>
                                        </Box>
                                        {isPendingApp && (
                                            <Stack direction="row" gap={0.5}>
                                                <IconButton
                                                    size="small"
                                                    disabled={reviewing === app.id}
                                                    onClick={() =>
                                                        onReviewApp(recruitmentId, app.id, "accept")
                                                    }
                                                    sx={{
                                                        width: 32, height: 32,
                                                        color: "success.main",
                                                        bgcolor: alpha(theme.palette.success.main, 0.10),
                                                        "&:hover": {
                                                            bgcolor: alpha(theme.palette.success.main, 0.20),
                                                        },
                                                    }}
                                                >
                                                    {reviewing === app.id ? (
                                                        <CircularProgress size={13} color="inherit" />
                                                    ) : (
                                                        <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                                    )}
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    disabled={reviewing === app.id}
                                                    onClick={() =>
                                                        onReviewApp(recruitmentId, app.id, "reject")
                                                    }
                                                    sx={{
                                                        width: 32, height: 32,
                                                        color: "error.main",
                                                        bgcolor: alpha(theme.palette.error.main, 0.10),
                                                        "&:hover": {
                                                            bgcolor: alpha(theme.palette.error.main, 0.20),
                                                        },
                                                    }}
                                                >
                                                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Stack>
                                        )}
                                    </Stack>
                                    {app.message && (
                                        <Typography sx={{
                                            fontSize: 12.5,
                                            color: "text.secondary",
                                            mt: 1.5,
                                            pl: 1,
                                            lineHeight: 1.6,
                                            borderLeft: "2px solid",
                                            borderColor: alpha(theme.palette.text.primary, 0.10),
                                        }}>
                                            {app.message}
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </DialogContent>
        </Dialog>
    );
}
