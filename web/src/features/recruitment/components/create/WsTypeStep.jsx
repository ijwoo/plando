import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { FieldLabel } from "./createFormShared";

const OPTIONS = [
    { id: "existing", icon: FolderRoundedIcon,       title: "기존 워크스페이스", desc: "이미 만든 워크스페이스로 모집해요" },
    { id: "new",      icon: AutoAwesomeRoundedIcon,  title: "새 워크스페이스",   desc: "새 팀을 위한 워크스페이스를 만들어요" },
];

export default function WsTypeStep({ wsMode, setWsMode }) {
    const theme = useTheme();
    return (
        <Stack spacing={2.75}>
            <Box>
                <FieldLabel required>어떤 워크스페이스로 모집할까요?</FieldLabel>
                <Stack spacing={1}>
                    {OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isA = wsMode === opt.id;
                        return (
                            <Box
                                key={opt.id}
                                onClick={() => setWsMode(opt.id)}
                                sx={{
                                    display: "flex", alignItems: "center", gap: 1.75,
                                    p: 2,
                                    cursor: "pointer",
                                    bgcolor: isA ? alpha(theme.palette.primary.main, 0.08) : "background.paper",
                                    border: "1.5px solid",
                                    borderColor: isA ? "primary.main" : alpha(theme.palette.text.primary, 0.07),
                                    borderRadius: 1.75,
                                    transition: "all 0.15s ease",
                                    "&:hover": { borderColor: isA ? "primary.main" : alpha(theme.palette.text.primary, 0.18) },
                                }}
                            >
                                <Box sx={{
                                    width: 40, height: 40, borderRadius: 1.375,
                                    flexShrink: 0,
                                    display: "grid", placeItems: "center",
                                    bgcolor: isA ? "background.paper" : alpha(theme.palette.text.primary, 0.05),
                                    color: isA ? "primary.main" : "text.secondary",
                                    transition: "all 0.15s ease",
                                }}>
                                    <Icon sx={{ fontSize: 20 }} />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: "text.primary",
                                        letterSpacing: "-0.02em",
                                        mb: 0.25,
                                    }}>
                                        {opt.title}
                                    </Typography>
                                    <Typography sx={{
                                        fontSize: 11.5,
                                        color: "text.disabled",
                                        fontWeight: 500,
                                        letterSpacing: "-0.005em",
                                    }}>
                                        {opt.desc}
                                    </Typography>
                                </Box>
                                <Box sx={{
                                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                                    border: "2px solid",
                                    borderColor: isA ? "primary.main" : alpha(theme.palette.text.primary, 0.12),
                                    display: "grid", placeItems: "center",
                                    transition: "all 0.15s ease",
                                }}>
                                    {isA && <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "primary.main" }} />}
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            </Box>
        </Stack>
    );
}
