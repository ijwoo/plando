import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import { fetchTodoLogs } from "../../api/todoApi.js";
import { formatTimeAgo } from "../../../../shared/utils/formatters.js";
import { Z } from "../../../../shared/ui/zIndex.js";
import { getLogActor, getLogActivityText, collapseLogs } from "../../utils/todoLogFormatters.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import UserAvatar from "../../../../shared/ui/common/UserAvatar.jsx";

export default function LogSection({ todoId, compact = false, users = [] }) {
    const { label: statusLabel } = useStatuses();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const sortedLogs = useMemo(() => {
        const sorted = [...logs].sort((a, b) => {
            const aTime = new Date(a.modifiedAt || a.createdAt).getTime() || 0;
            const bTime = new Date(b.modifiedAt || b.createdAt).getTime() || 0;
            return bTime - aTime;
        });
        return collapseLogs(sorted);
    }, [logs]);

    const loadLogs = useCallback(async () => {
        if (!todoId) return;

        try {
            setLoading(true);
            setErrorMessage("");


              const res = await fetchTodoLogs(todoId);
              setLogs(res.data ?? []);
        } catch (e) {
            console.error("활동 조회 실패", e);
            setErrorMessage("활동 내역을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [todoId]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    return (
        <Box
            sx={{
                px: 2.25,
                py: 2,
                display: "flex",
                flexDirection: "column",
                gap: 0,
            }}
        >
            {loading ? (
                <Box
                    sx={{
                        minHeight: 180,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <CircularProgress size={26} />
                </Box>
            ) : errorMessage ? (
                <Typography color="error" sx={{ fontSize: 13 }}>
                    {errorMessage}
                </Typography>
            ) : sortedLogs.length === 0 ? (
                <Box
                    sx={{
                        minHeight: 180,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                        최근 활동이 없어요
                    </Typography>
                </Box>
            ) : (
                sortedLogs.map((item, index) => {
                    const actor = getLogActor(item, users);
                    const activityText = getLogActivityText(item, statusLabel);

                    return (
                        <Box
                            key={item.id ?? index}
                            sx={{
                                display: "flex",
                                gap: 1.5,
                                position: "relative",
                                pb: index < sortedLogs.length - 1 ? 2.5 : 0,
                            }}
                        >
                            {index < sortedLogs.length - 1 && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        left: 15,
                                        top: 30,
                                        width: "1px",
                                        height: "calc(100% - 30px)",
                                        bgcolor: "divider",
                                        zIndex: Z.STICKY,
                                    }}
                                />
                            )}

                            <Box sx={{ position: "relative", zIndex: Z.STICKY }}>
                                <UserAvatar name={actor.name} src={actor.profileImageUrl} size={30} />
                            </Box>

                            <Box sx={{ flex: 1, pt: 0.5, minWidth: 0 }}>
                                <Typography
                                    sx={{
                                        fontSize: compact ? 13.5 : 14,
                                        color: "text.primary",
                                        lineHeight: 1.5,
                                        wordBreak: "break-word",
                                    }}
                                >
                                    <Box
                                        component="span"
                                        sx={{
                                            fontWeight: 600,
                                            color: "primary.main",
                                        }}
                                    >
                                        {actor.name}
                                    </Box>
                                    {"님이 "}
                                    {activityText}
                                </Typography>

                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                        mt: 0.5,
                                        color: "text.disabled",
                                    }}
                                >
                                    <AccessTimeRoundedIcon sx={{ fontSize: 12 }} />
                                    <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>
                                        {formatTimeAgo(item.modifiedAt || item.createdAt)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    );
                })
            )}
        </Box>
    );
}