import React from "react";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import DashboardCard from "./DashboardCard.jsx";
import { fadeDividerSx } from "../../../shared/ui/glassSx.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { FIELD_LABEL, formatTimeAgo, formatModifierName, filterActivities } from "../utils/dashboardUtils.js";
import { eulReul, josa } from "../../../shared/utils/josa.js";

/**
 * 최근 활동 피드. mock의 ActivityFeed 스타일.
 * props 시그니처 동일 (Desktop / Mobile 둘 다 사용).
 */
export default function ActivityFeedCard({
    activities,
    userImageMap = {},
    onTaskClick,
    sx,
    hideHeader = false,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const filtered = filterActivities(activities).slice(0, 12);

    return (
        <DashboardCard title="최근 업데이트" sx={sx} hideHeader={hideHeader}>
            {filtered.length === 0 ? (
                <Box
                    sx={{
                        py: 2.5,
                        textAlign: "center",
                        color: "text.disabled",
                        fontSize: 13,
                        fontWeight: 500,
                    }}
                >
                    최근 활동이 없어요
                </Box>
            ) : (
                <Stack spacing={0}>
                    {filtered.map((item, i) => {
                        const name =
                            userImageMap[item.modifier]?.name ||
                            item.modifierName ||
                            formatModifierName(item.modifier);
                        const fieldLabel = FIELD_LABEL[item.field] ?? item.field ?? "";
                        const userInfo = userImageMap[item.modifier];
                        const avatarSrc = userInfo?.profileImageUrl
                            ? resolveImageUrl(userInfo.profileImageUrl)
                            : undefined;

                        return (
                            <Press
                                key={i}
                                onClick={() => onTaskClick?.(item.todoId)}
                                style={{
                                    ...(i > 0 ? fadeDividerSx(theme.palette.divider) : {}),
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1.25}
                                    alignItems="flex-start"
                                    sx={{ py: 1.25, px: 0.5 }}
                                >
                                    <Avatar
                                        src={avatarSrc}
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            fontSize: 12,
                                            fontWeight: 800,
                                            bgcolor: alpha(primary, isDark ? 0.20 : 0.15),
                                            color: "primary.main",
                                            flexShrink: 0,
                                            mt: 0.25,
                                        }}
                                    >
                                        {name.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            sx={{
                                                fontSize: 13,
                                                lineHeight: 1.5,
                                                color: "text.secondary",
                                                wordBreak: "keep-all",
                                                letterSpacing: "-0.01em",
                                            }}
                                        >
                                            <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>
                                                {name}
                                            </Box>
                                            {"님이 "}
                                            <Box
                                                component="span"
                                                sx={{ fontWeight: 700, color: "primary.main" }}
                                            >
                                                "{item.todoTitle}"
                                            </Box>
                                            {fieldLabel
                                                ? ` 태스크의 ${josa(fieldLabel, eulReul)} 변경했어요`
                                                : " 태스크를 수정했어요"}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                fontSize: 11,
                                                color: "text.disabled",
                                                mt: 0.3,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {formatTimeAgo(item.modifiedAt)}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Press>
                        );
                    })}
                </Stack>
            )}
        </DashboardCard>
    );
}
