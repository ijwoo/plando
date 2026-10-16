import { Badge, Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import { Z } from "../../../../../shared/ui/zIndex.js";

/**
 * 데스크탑 모집 목록 상단 sticky 바.
 * 뒤로가기 / 페이지 타이틀 + BETA / 알림 / 모집글 올리기 액션.
 */
export default function ListTopBar({
    notifUnread,
    onOpenNotif,
    onOpenCreate,
}) {
    const theme = useTheme();
    const navigate = useNavigate();

    return (
        <Box
            sx={{
                position: "sticky",
                top: 0,
                zIndex: Z.STICKY,
                bgcolor: "background.paper",
                borderBottom: "1px solid",
                borderColor: theme.palette.divider,
            }}
        >
            <Box
                sx={{
                    maxWidth: 1560,
                    mx: "auto",
                    px: 3,
                    height: 60,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Stack direction="row" alignItems="center" gap={1.25}>
                    <IconButton
                        size="small"
                        onClick={() => navigate(-1)}
                        sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 1.25,
                            color: "text.secondary",
                            "&:hover": {
                                bgcolor: alpha(theme.palette.text.primary, 0.05),
                                color: "text.primary",
                            },
                        }}
                    >
                        <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
                    </IconButton>

                    <Typography sx={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: "text.primary",
                        letterSpacing: "-0.025em",
                    }}>
                        팀 모집
                    </Typography>
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        px: 0.75,
                        py: 0.125,
                        ml: 0.25,
                        borderRadius: 0.625,
                        bgcolor: alpha(theme.palette.primary.main, 0.10),
                        color: "primary.main",
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                    }}>
                        BETA
                    </Box>
                </Stack>

                <Stack direction="row" alignItems="center" gap={1}>
                    <IconButton
                        size="small"
                        onClick={onOpenNotif}
                        sx={{
                            width: 38,
                            height: 38,
                            borderRadius: 1.25,
                            color: "text.secondary",
                            "&:hover": {
                                bgcolor: alpha(theme.palette.text.primary, 0.05),
                                color: "text.primary",
                            },
                        }}
                    >
                        <Badge badgeContent={notifUnread || 0} color="error" max={99}>
                            <NotificationsNoneRoundedIcon sx={{ fontSize: 20 }} />
                        </Badge>
                    </IconButton>

                    <Button
                        size="small"
                        disableElevation
                        startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        onClick={onOpenCreate}
                        sx={{
                            px: 2,
                            height: 38,
                            fontSize: 13,
                            fontWeight: 700,
                            textTransform: "none",
                            borderRadius: 1.25,
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            "&:hover": { bgcolor: "primary.dark" },
                        }}
                    >
                        모집글 올리기
                    </Button>
                </Stack>
            </Box>
        </Box>
    );
}
