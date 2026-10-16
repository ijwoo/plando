import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import TrainRoundedIcon from "@mui/icons-material/TrainRounded";
import SubwayRoundedIcon from "@mui/icons-material/SubwayRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import CoffeeRoundedIcon from "@mui/icons-material/CoffeeRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import LocalParkingRoundedIcon from "@mui/icons-material/LocalParkingRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { SHADOW } from "../../common/recruitmentSx";

/**
 * MapDialogSidebar — 좌측 320px 사이드바
 *
 * 헤더(브레드크럼 + 태그 + 제목) → 주소 블록 → 스크롤 영역(교통/주변시설/모집정보) → CTA
 */
export default function MapDialogSidebar({
    item,
    cat,
    isUrgent,
    isAccepted,
    isPending,
    dueText,
    locationText,
    memberText,
    meetLabel,
    dialogAddress,
    transitList,
    poiCounts,
    activePoi,
    onTogglePoiCategory,
    onClose,
    onCopyToast,
    onApplyClick,
}) {
    const theme = useTheme();
    const isClosed = item?.statusLabel === "마감";

    return (
        <Box sx={{
            width: 320,
            flexShrink: 0,
            borderRight: "1px solid",
            borderColor: alpha(theme.palette.text.primary, 0.06),
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
        }}>
            {/* 헤더 */}
            <Box sx={{
                px: 2.75,
                pt: 2.5,
                pb: 2,
                borderBottom: "1px solid",
                borderColor: alpha(theme.palette.text.primary, 0.06),
            }}>
                {/* 브레드크럼 */}
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.25 }}>
                    <Typography
                        onClick={onClose}
                        sx={{
                            fontSize: 11.5,
                            color: "text.secondary",
                            fontWeight: 600,
                            cursor: "pointer",
                            "&:hover": { color: "text.primary" },
                        }}
                    >
                        ← 상세 페이지
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "text.disabled" }}>›</Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.primary", fontWeight: 600 }}>
                        위치 상세
                    </Typography>
                </Stack>

                {/* 태그 */}
                <Stack direction="row" gap={0.75} sx={{ mb: 1.5 }}>
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1.125,
                        py: 0.375,
                        borderRadius: 99,
                        fontSize: 11.5,
                        fontWeight: 600,
                        bgcolor: alpha(cat.color, 0.10),
                        color: cat.color,
                    }}>
                        <span>{cat.icon}</span>
                        <span>{item.typeLabel}</span>
                    </Box>
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.625,
                        px: 1.125,
                        py: 0.375,
                        borderRadius: 99,
                        fontSize: 11.5,
                        fontWeight: 700,
                        bgcolor: isUrgent
                            ? alpha(theme.palette.error.main, 0.10)
                            : alpha(theme.palette.primary.main, 0.10),
                        color: isUrgent ? "error.main" : "primary.main",
                        ...(isUrgent ? {
                            "&::before": {
                                content: '""',
                                width: 5, height: 5,
                                borderRadius: "50%",
                                bgcolor: "error.main",
                                flexShrink: 0,
                                "@keyframes sbPulse": {
                                    "0%, 100%": { opacity: 1 },
                                    "50%": { opacity: 0.4 },
                                },
                                animation: "sbPulse 2s ease-in-out infinite",
                            },
                        } : {}),
                    }}>
                        {dueText}
                    </Box>
                </Stack>

                {/* 제목 */}
                <Typography sx={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.35,
                    color: "text.primary",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                }}>
                    {item.title}
                </Typography>
            </Box>

            {/* 주소 블록 */}
            <Box sx={{
                mx: 2.75, mt: 2,
                p: "14px 16px",
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                borderRadius: 1.75,
            }}>
                <Stack direction="row" alignItems="flex-start" gap={1}>
                    <Box sx={{
                        width: 28, height: 28,
                        borderRadius: 1,
                        bgcolor: "primary.main",
                        display: "grid",
                        placeItems: "center",
                        color: "primary.contrastText",
                        flexShrink: 0,
                        boxShadow: SHADOW.sm,
                    }}>
                        <NearMeRoundedIcon sx={{ fontSize: 14 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: "-0.015em",
                            lineHeight: 1.35,
                            color: "text.primary",
                            mb: 0.375,
                        }}>
                            {locationText}
                        </Typography>
                        {(dialogAddress || item.locationText) && (
                            <Typography sx={{
                                fontSize: 11.5,
                                color: "text.disabled",
                                fontWeight: 500,
                                lineHeight: 1.4,
                            }}>
                                {dialogAddress || item.locationText}
                            </Typography>
                        )}
                    </Box>
                </Stack>
                <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 12 }} />}
                    onClick={() => {
                        const addr = dialogAddress || item.locationText;
                        if (addr) {
                            navigator.clipboard?.writeText(addr).catch(() => {});
                            onCopyToast?.("주소를 복사했어요.");
                        }
                    }}
                    sx={{
                        mt: 1.25,
                        py: 1,
                        borderRadius: 1,
                        bgcolor: "background.paper",
                        borderColor: alpha(theme.palette.text.primary, 0.12),
                        color: "text.secondary",
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "none",
                        boxShadow: SHADOW.sm,
                        "&:hover": {
                            bgcolor: alpha(theme.palette.text.primary, 0.03),
                            color: "text.primary",
                        },
                    }}
                >
                    주소 복사
                </Button>
            </Box>

            {/* 스크롤 영역 */}
            <Box sx={{
                flex: 1,
                overflowY: "auto",
                px: 2.75,
                py: 2.25,
                "&::-webkit-scrollbar": { width: 4 },
                "&::-webkit-scrollbar-thumb": {
                    bgcolor: alpha(theme.palette.text.primary, 0.10),
                    borderRadius: 99,
                },
            }}>
                {/* 교통 */}
                <Box sx={{ mb: 2.25 }}>
                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.25 }}>
                        <TrainRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                        <Typography sx={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "text.disabled",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                        }}>
                            교통
                        </Typography>
                    </Stack>
                    {transitList.length === 0 ? (
                        <Typography sx={{ fontSize: 12, color: "text.disabled", py: 1 }}>
                            반경 1.5km 내 지하철역 없음
                        </Typography>
                    ) : (
                        <Stack spacing={0.25}>
                            {transitList.map((s) => (
                                <Stack
                                    key={s.name}
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{
                                        px: 1.75,
                                        py: 1.125,
                                        bgcolor: alpha(theme.palette.text.primary, 0.03),
                                        borderRadius: 1.25,
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" gap={0.75}>
                                        <SubwayRoundedIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.primary" }}>
                                            {s.name}
                                        </Typography>
                                    </Stack>
                                    <Typography sx={{
                                        fontSize: 11.5,
                                        color: "text.disabled",
                                        fontWeight: 600,
                                        fontVariantNumeric: "tabular-nums",
                                    }}>
                                        {s.distance >= 1000
                                            ? `${(s.distance / 1000).toFixed(1)}km`
                                            : `${s.distance}m`}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </Box>

                {/* 주변 시설 */}
                <Box sx={{ mb: 2.25 }}>
                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.25 }}>
                        <GridViewRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                        <Typography sx={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "text.disabled",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                        }}>
                            주변 시설 (반경 500m)
                        </Typography>
                        <Typography sx={{
                            fontSize: 10,
                            color: "text.disabled",
                            fontWeight: 500,
                            ml: "auto",
                        }}>
                            눌러서 지도 표시
                        </Typography>
                    </Stack>
                    <Stack direction="row" gap={1}>
                        {[
                            { key: "cafe",       label: "카페",   themeColor: theme.palette.warning.main },
                            { key: "parking",    label: "주차장", themeColor: theme.palette.primary.main },
                            { key: "restaurant", label: "음식점", themeColor: "#F97316" },
                        ].map(({ key, label, themeColor }) => {
                            const isActive = activePoi.has(key);
                            const count = poiCounts[key];
                            const PoiIcon = key === "cafe" ? CoffeeRoundedIcon
                                : key === "restaurant" ? RestaurantRoundedIcon
                                : LocalParkingRoundedIcon;
                            return (
                                <Box
                                    key={key}
                                    component="button"
                                    onClick={() => onTogglePoiCategory(key)}
                                    sx={{
                                        flex: 1,
                                        textAlign: "center",
                                        p: "10px 4px",
                                        bgcolor: isActive
                                            ? alpha(themeColor, 0.10)
                                            : alpha(theme.palette.text.primary, 0.03),
                                        borderRadius: 1.25,
                                        border: "1.5px solid",
                                        borderColor: isActive ? themeColor : "transparent",
                                        cursor: "pointer",
                                        transition: "all 0.15s",
                                        fontFamily: "inherit",
                                        "&:hover": { opacity: 0.85 },
                                    }}
                                >
                                    <PoiIcon sx={{
                                        fontSize: 18,
                                        mb: 0.25,
                                        display: "block",
                                        mx: "auto",
                                        color: isActive ? themeColor : "text.secondary",
                                    }} />
                                    <Typography sx={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        letterSpacing: "-0.02em",
                                        color: isActive ? themeColor : "text.primary",
                                    }}>
                                        {count !== undefined ? count : "·"}
                                    </Typography>
                                    <Typography sx={{
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        color: isActive ? themeColor : "text.disabled",
                                    }}>
                                        {label}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Stack>
                </Box>

                {/* 모집 정보 */}
                <Box>
                    <Typography sx={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "text.disabled",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        mb: 1.25,
                    }}>
                        모집 정보
                    </Typography>
                    <Stack spacing={0.25}>
                        {[
                            { label: "인원", value: memberText },
                            { label: "마감", value: dueText, urgent: !!isUrgent },
                            { label: "진행", value: meetLabel },
                        ].map(({ label, value, urgent }) => (
                            <Stack
                                key={label}
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                    px: 1.75,
                                    py: 1.25,
                                    bgcolor: alpha(theme.palette.text.primary, 0.03),
                                    borderRadius: 1.25,
                                }}
                            >
                                <Typography sx={{
                                    fontSize: 11.5,
                                    color: "text.disabled",
                                    fontWeight: 600,
                                }}>
                                    {label}
                                </Typography>
                                <Typography sx={{
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    letterSpacing: "-0.015em",
                                    color: urgent ? "error.main" : "text.primary",
                                }}>
                                    {value}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Box>
            </Box>

            {/* CTA */}
            <Box sx={{
                px: 2.75,
                py: 1.75,
                borderTop: "1px solid",
                borderColor: alpha(theme.palette.text.primary, 0.06),
                bgcolor: "background.paper",
            }}>
                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={isAccepted || (isClosed && !isPending)}
                    onClick={onApplyClick}
                    startIcon={isAccepted
                        ? <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                        : (isClosed && !isPending) ? null
                            : <SendRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                        py: 1.625,
                        borderRadius: 1.75,
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
                        : (isClosed && !isPending)
                            ? "모집이 마감되었어요"
                            : isPending ? "신청 취소" : "참여 신청하기"}
                </Button>
            </Box>
        </Box>
    );
}
