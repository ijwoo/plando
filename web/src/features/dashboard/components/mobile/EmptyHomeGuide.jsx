import React from "react";
import { Box, Typography, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useNavigate } from "react-router-dom";
import Press from "../../../../shared/ui/primitives/Press.jsx";
import { getGlassSx } from "../../../../shared/ui/glassSx.js";

const GUIDE_ITEMS = [
    {
        Icon: BarChartRoundedIcon,
        iconBg: "var(--plando-green-soft)",
        iconColor: "var(--plando-green)",
        title: "오늘의 진행 현황",
        sub: "완료·진행·마감을 한눈에",
        path: "/todos",
    },
    {
        Icon: CalendarMonthRoundedIcon,
        iconBg: "var(--plando-primary-soft)",
        iconColor: "var(--plando-primary)",
        title: "캘린더",
        sub: "일정을 날짜에 바로 배치",
        path: "/calendar",
    },
    {
        Icon: GroupAddRoundedIcon,
        iconBg: "var(--plando-orange-soft)",
        iconColor: "var(--plando-orange)",
        title: "멤버 초대하기",
        sub: "함께하면 채팅·협업이 열려요",
        path: "/settings",
    },
];

export default function EmptyHomeGuide() {
    const theme = useTheme();
    const navigate = useNavigate();

    return (
        <Box>
            <Typography
                sx={{
                    fontSize: "var(--plando-type-caption-size)",
                    color: "text.disabled",
                    textAlign: "center", mb: 1.25, mt: 0.5,
                }}
            >
                할 일을 추가하면 아래가 채워져요
            </Typography>

            <Stack spacing={1.25}>
                {GUIDE_ITEMS.map(({ Icon, iconBg, iconColor, title, sub, path }) => (
                    <Press key={title} onClick={() => navigate(path)} haptic="light" pressScale={0.97}>
                        <Box
                            sx={{
                                borderRadius: "var(--plando-radius-card)",
                                boxShadow: "var(--plando-elev-1)",
                                p: 2,
                                display: "flex", alignItems: "center", gap: 1.75,
                                ...getGlassSx(theme),
                                borderColor: "transparent",
                            }}
                        >
                            <Box
                                sx={{
                                    width: 42, height: 42,
                                    borderRadius: "var(--plando-radius-md)", flexShrink: 0,
                                    bgcolor: iconBg, color: iconColor,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Icon sx={{ fontSize: 20 }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography
                                    sx={{
                                        fontSize: "var(--plando-type-body-size)",
                                        fontWeight: "var(--plando-type-title3-weight)",
                                    }}
                                >
                                    {title}
                                </Typography>
                                <Typography sx={{ fontSize: "var(--plando-type-caption-size)", color: "text.disabled", mt: 0.25 }}>
                                    {sub}
                                </Typography>
                            </Box>
                            <ChevronRightRoundedIcon sx={{ color: "text.disabled", fontSize: 20 }} />
                        </Box>
                    </Press>
                ))}
            </Stack>
        </Box>
    );
}
