import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { FieldLabel } from "./createFormShared";

export default function WsExistingStep({ workspaces, selectedWsId, setSelectedWsId }) {
    const theme = useTheme();
    return (
        <Stack spacing={2.75}>
            <Box>
                <FieldLabel
                    required
                    hint={workspaces.length > 0 ? `${workspaces.length}개` : null}
                >
                    사용할 워크스페이스
                </FieldLabel>

                {workspaces.length === 0 ? (
                    <Box sx={{
                        p: 3,
                        textAlign: "center",
                        bgcolor: alpha(theme.palette.text.primary, 0.02),
                        border: "1px dashed",
                        borderColor: alpha(theme.palette.text.primary, 0.12),
                        borderRadius: 1.75,
                    }}>
                        <Typography sx={{ fontSize: 12.5, color: "text.disabled", fontWeight: 600 }}>
                            아직 워크스페이스가 없어요
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={1}>
                        {workspaces.map((ws) => {
                            const isA = selectedWsId === ws.workspaceId;
                            const initial = ws.workspaceName?.charAt(0) || "W";
                            return (
                                <Box
                                    key={ws.workspaceId}
                                    onClick={() => setSelectedWsId(ws.workspaceId)}
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
                                        fontWeight: 800,
                                        fontSize: 16,
                                    }}>
                                        {initial}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: "text.primary",
                                            letterSpacing: "-0.02em",
                                            mb: 0.25,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>
                                            {ws.workspaceName}
                                        </Typography>
                                        {ws.memberCount != null && (
                                            <Typography sx={{
                                                fontSize: 11.5,
                                                color: "text.disabled",
                                                fontWeight: 500,
                                            }}>
                                                멤버 {ws.memberCount}명
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box sx={{
                                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                                        bgcolor: isA ? "primary.main" : "transparent",
                                        border: isA ? "0" : "1.5px solid",
                                        borderColor: alpha(theme.palette.text.primary, 0.18),
                                        display: "grid", placeItems: "center",
                                        transition: "all 0.15s ease",
                                    }}>
                                        {isA && <CheckRoundedIcon sx={{ fontSize: 14, color: "common.white", strokeWidth: 2 }} />}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </Box>
        </Stack>
    );
}
