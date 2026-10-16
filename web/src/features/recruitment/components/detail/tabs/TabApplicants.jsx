import { useEffect, useState } from "react";
import { Avatar, Box, CircularProgress, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseIcon from "@mui/icons-material/Close";
import { fetchApplications, reviewApplication } from "../../../api/recruitmentApi";
import { metaPillSx, SHADOW } from "../../common/recruitmentSx";
import {
    APPLICATION_STATUS_CFG,
    resolveStatusColor,
} from "../../../constants/recruitmentConfig";
import { APP_EVENTS } from "../../../../../shared/constants/events.js";

function toast(message, severity = "success") {
    window.dispatchEvent(
        new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message, severity } })
    );
}

export default function TabApplicants({ recruitmentId, onReview }) {
    const theme = useTheme();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState(null);

    useEffect(() => {
        if (!recruitmentId) return;
        setLoading(true);
        fetchApplications(recruitmentId)
            .then((res) => setApps(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [recruitmentId]);

    const handleReview = async (appId, action) => {
        setReviewing(appId);
        try {
            const res = await reviewApplication(recruitmentId, appId, action);
            setApps((prev) =>
                prev.map((a) => (a.id === appId ? { ...a, status: res.data.status } : a))
            );
            const label = action === "accept" ? "수락" : "거절";
            toast(`${label} 처리됐어요.`, "success");
            if (onReview) onReview(recruitmentId);
        } catch (err) {
            const msg = err?.response?.data?.message
                || (action === "accept" ? "수락 처리에 실패했어요." : "거절 처리에 실패했어요.");
            toast(msg, "error");
        } finally {
            setReviewing(null);
        }
    };

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
        </Box>
    );

    if (apps.length === 0) return (
        <Box sx={{ textAlign: "center", py: 6 }}>
            <Box sx={{
                width: 64, height: 64,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                mb: 2,
            }}>
                📬
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }}>
                아직 신청자가 없어요
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.75, lineHeight: 1.6 }}>
                모집 글을 공유하면<br />더 많은 지원자를 만날 수 있어요
            </Typography>
        </Box>
    );

    return (
        <Stack gap={1.5}>
            {apps.map((app) => {
                const cfg = APPLICATION_STATUS_CFG[app.status] || APPLICATION_STATUS_CFG.PENDING;
                const chipColor = resolveStatusColor(theme, cfg.colorKey);
                const isPending = app.status === "PENDING";
                return (
                    <Box key={app.id} sx={{
                        p: 2,
                        borderRadius: 2,
                        border: 0,
                        bgcolor: "background.paper",
                        boxShadow: SHADOW.card,
                    }}>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <Avatar
                                src={app.applicantAvatar}
                                sx={{
                                    width: 40, height: 40,
                                    bgcolor: alpha(theme.palette.primary.main, 0.10),
                                    color: "primary.main",
                                    fontWeight: 700,
                                }}
                            >
                                {app.applicantName?.[0]}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
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
                                        fontSize: 10,
                                        fontWeight: 700,
                                        px: 0.875,
                                        py: 0.125,
                                    }}>
                                        {cfg.label}
                                    </Box>
                                    {app.selectedRoleName && (
                                        <Box sx={{
                                            ...metaPillSx(theme, theme.palette.primary.main),
                                            fontSize: 10,
                                            fontWeight: 700,
                                            px: 0.875,
                                            py: 0.125,
                                        }}>
                                            {app.selectedRoleName}
                                        </Box>
                                    )}
                                </Stack>
                                <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 0.25 }}>
                                    {app.appliedAt}
                                </Typography>
                            </Box>
                            {isPending && (
                                <Stack direction="row" gap={0.5}>
                                    <IconButton
                                        size="small"
                                        disabled={reviewing === app.id}
                                        onClick={() => handleReview(app.id, "accept")}
                                        sx={{
                                            color: "success.main",
                                            bgcolor: alpha(theme.palette.success.main, 0.10),
                                            "&:hover": { bgcolor: alpha(theme.palette.success.main, 0.18) },
                                            width: 32, height: 32,
                                        }}
                                    >
                                        {reviewing === app.id
                                            ? <CircularProgress size={14} color="inherit" />
                                            : <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                        }
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        disabled={reviewing === app.id}
                                        onClick={() => handleReview(app.id, "reject")}
                                        sx={{
                                            color: "error.main",
                                            bgcolor: alpha(theme.palette.error.main, 0.10),
                                            "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.18) },
                                            width: 32, height: 32,
                                        }}
                                    >
                                        <CloseIcon sx={{ fontSize: 16 }} />
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
                                lineHeight: 1.55,
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
    );
}
