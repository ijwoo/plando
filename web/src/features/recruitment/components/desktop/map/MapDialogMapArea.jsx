import React from "react";
import { CustomOverlayMap } from "react-kakao-maps-sdk";
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import RecruitMapCanvas from "../../common/RecruitMapCanvas";
import { getCategory, getMemberText, getDueText } from "../../../utils/recruitmentUtils";
import { Z } from "../../../../../shared/ui/zIndex.js";
import { SHADOW } from "../../common/recruitmentSx";

/**
 * MapDialogMapArea — 우측 지도 영역
 *
 * RecruitMapCanvas 위에:
 *  - 우상단 닫기 버튼
 *  - 우하단 근처 모집 토글 + 내 위치 버튼
 *  - 하단 중앙 floating action bar (길찾기 / 카카오맵 / 네이버지도)
 *  - 선택된 근처 핀 위에 카드 툴팁 (CustomOverlayMap)
 */
export default function MapDialogMapArea({
    item,
    nearbyItems,
    nearbyMode,
    nearbyCount,
    onToggleNearbyMode,
    myLocation,
    dialogLocLoading,
    onDialogMyLocation,
    tooltipItem,
    setTooltipItem,
    activePoi,
    poiMarkerData,
    locationText,
    onClose,
    onDetailNav,
}) {
    const theme = useTheme();

    return (
        <Box sx={{ flex: 1, position: "relative", overflow: "hidden", bgcolor: "#EEEBE0" }}>
            {/* 닫기 버튼 */}
            <IconButton
                onClick={onClose}
                size="small"
                sx={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    zIndex: Z.MAP_CONTROL,
                    width: 36, height: 36,
                    borderRadius: "50%",
                    bgcolor: "background.paper",
                    border: 0,
                    boxShadow: SHADOW.card,
                    color: "text.secondary",
                    "&:hover": {
                        bgcolor: alpha(theme.palette.error.main, 0.10),
                        color: "error.main",
                    },
                }}
            >
                <CloseRoundedIcon sx={{ fontSize: 15 }} />
            </IconButton>

            {/* 실제 지도 */}
            <Box sx={{ position: "absolute", inset: 0 }}>
                <RecruitMapCanvas
                    items={nearbyMode ? [item, ...nearbyItems] : [item]}
                    selected={item}
                    onSelect={(clicked) => {
                        if (clicked?.id !== item.id) {
                            setTooltipItem((prev) => prev?.id === clicked?.id ? null : clicked);
                        }
                    }}
                    centerOn={tooltipItem ? { lat: tooltipItem.locationLat, lng: tooltipItem.locationLng } : null}
                    level={4}
                    kakaoReady
                    myLocation={myLocation}
                    showMyLocation={false}
                    poiMarkers={[...activePoi].flatMap((key) => poiMarkerData[key] || [])}
                    mapChildren={tooltipItem && nearbyMode && (() => {
                        const tCat = getCategory(tooltipItem.typeLabel, theme);
                        const mText = getMemberText(tooltipItem);
                        const dText = getDueText(tooltipItem, { fallback: null });
                        return (
                            <CustomOverlayMap
                                position={{ lat: tooltipItem.locationLat, lng: tooltipItem.locationLng }}
                                yAnchor={0}
                                zIndex={30}
                            >
                                {/* 인라인 스타일 — CustomOverlayMap은 DOM div를 직접 받음 */}
                                <div style={{
                                    marginTop: "8px",
                                    background: theme.palette.background.paper,
                                    border: 0,
                                    borderRadius: "14px",
                                    boxShadow: SHADOW.lift,
                                    overflow: "hidden",
                                    width: "230px",
                                    position: "relative",
                                    fontFamily: "inherit",
                                }}>
                                    <div style={{ height: "3px", background: tCat.color }} />
                                    <button
                                        onClick={() => setTooltipItem(null)}
                                        style={{
                                            position: "absolute",
                                            top: "8px", right: "8px",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "2px",
                                            color: theme.palette.text.disabled,
                                            fontSize: "13px",
                                            lineHeight: 1,
                                        }}
                                    >✕</button>
                                    <div style={{ padding: "10px 12px 11px" }}>
                                        <span style={{
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            color: tCat.color,
                                            background: alpha(tCat.color, 0.10),
                                            borderRadius: "99px",
                                            padding: "2px 8px",
                                            display: "inline-block",
                                            marginBottom: "6px",
                                        }}>
                                            {tCat.icon} {tooltipItem.typeLabel}
                                        </span>
                                        <div style={{
                                            fontSize: "13px",
                                            fontWeight: 700,
                                            color: theme.palette.text.primary,
                                            lineHeight: 1.35,
                                            letterSpacing: "-0.02em",
                                            marginBottom: "10px",
                                            paddingRight: "22px",
                                            overflow: "hidden",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                        }}>
                                            {tooltipItem.title}
                                        </div>
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}>
                                            <span style={{
                                                fontSize: "11px",
                                                color: theme.palette.text.secondary,
                                                fontWeight: 600,
                                            }}>
                                                인원 {mText}{dText ? ` · ${dText}` : ""}
                                            </span>
                                            <button
                                                onClick={() => { setTooltipItem(null); onClose(); onDetailNav?.(tooltipItem); }}
                                                style={{
                                                    padding: "5px 11px",
                                                    borderRadius: "7px",
                                                    background: theme.palette.primary.main,
                                                    color: "#fff",
                                                    fontSize: "11px",
                                                    fontWeight: 700,
                                                    border: "none",
                                                    cursor: "pointer",
                                                }}
                                            >상세보기</button>
                                        </div>
                                    </div>
                                </div>
                            </CustomOverlayMap>
                        );
                    })()}
                />
            </Box>

            {/* 내 위치 버튼 + 근처 모집 토글 — 하단 우측 가로 배치 */}
            <Box sx={{
                position: "absolute",
                bottom: 84,
                right: 16,
                zIndex: Z.MAP_CONTROL,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
            }}>
                {/* 근처 모집 토글 */}
                <Box
                    onClick={onToggleNearbyMode}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 1.25,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: "background.paper",
                        border: 0,
                        boxShadow: SHADOW.card,
                        cursor: "pointer",
                        userSelect: "none",
                    }}
                >
                    <Typography sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "text.secondary",
                        whiteSpace: "nowrap",
                    }}>
                        근처 모집
                    </Typography>
                    <Box sx={{
                        px: 0.625,
                        py: 0.125,
                        borderRadius: 99,
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        color: "primary.main",
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1.6,
                    }}>
                        +{nearbyCount}
                    </Box>
                    {/* 슬라이딩 토글 */}
                    <Box sx={{
                        width: 36, height: 20,
                        borderRadius: 99,
                        bgcolor: nearbyMode
                            ? "primary.main"
                            : alpha(theme.palette.text.primary, 0.18),
                        position: "relative",
                        flexShrink: 0,
                        transition: "background-color 0.2s",
                    }}>
                        <Box sx={{
                            position: "absolute",
                            top: 2,
                            left: nearbyMode ? 18 : 2,
                            width: 16, height: 16,
                            borderRadius: "50%",
                            bgcolor: "common.white",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.20)",
                            transition: "left 0.2s cubic-bezier(.34,1.56,.64,1)",
                        }} />
                    </Box>
                </Box>

                {/* 내 위치 버튼 */}
                <Tooltip title="내 위치로 이동" placement="left">
                    <IconButton
                        onClick={onDialogMyLocation}
                        disabled={dialogLocLoading}
                        size="small"
                        sx={{
                            width: 36, height: 36,
                            bgcolor: "background.paper",
                            border: 0,
                            boxShadow: SHADOW.card,
                            "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.03) },
                        }}
                    >
                        {dialogLocLoading
                            ? <CircularProgress size={16} />
                            : <MyLocationRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                        }
                    </IconButton>
                </Tooltip>
            </Box>

            {/* 하단 floating action bar */}
            <Stack
                direction="row"
                alignItems="center"
                gap={0.25}
                sx={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    bgcolor: "background.paper",
                    border: 0,
                    borderRadius: 99,
                    p: 0.5,
                    boxShadow: SHADOW.lift,
                    zIndex: Z.MAP_CONTROL,
                    whiteSpace: "nowrap",
                }}
            >
                {/* 길찾기 (primary) */}
                <Box
                    component="button"
                    onClick={() => {
                        if (item.locationLat && item.locationLng)
                            window.open(
                                `https://map.kakao.com/link/to/${encodeURIComponent(locationText)},${item.locationLat},${item.locationLng}`,
                                "_blank"
                            );
                    }}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 2,
                        py: 1.125,
                        borderRadius: 99,
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        fontSize: 12,
                        fontWeight: 700,
                        border: 0,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        "&:hover": { bgcolor: "primary.dark" },
                    }}
                >
                    <NearMeRoundedIcon sx={{ fontSize: 14 }} /> 길찾기
                </Box>

                <Box sx={{ width: 1, height: 18, bgcolor: alpha(theme.palette.text.primary, 0.06), mx: 0.25 }} />

                {/* 카카오맵 */}
                <Box
                    component="button"
                    onClick={() => {
                        if (item.locationLat && item.locationLng)
                            window.open(
                                `https://map.kakao.com/link/map/${encodeURIComponent(locationText)},${item.locationLat},${item.locationLng}`,
                                "_blank"
                            );
                    }}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 2,
                        py: 1.125,
                        borderRadius: 99,
                        bgcolor: "transparent",
                        color: "text.secondary",
                        fontSize: 12,
                        fontWeight: 700,
                        border: 0,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                    }}
                >
                    <OpenInNewRoundedIcon sx={{ fontSize: 14 }} /> 카카오맵
                </Box>

                <Box sx={{ width: 1, height: 18, bgcolor: alpha(theme.palette.text.primary, 0.06), mx: 0.25 }} />

                {/* 네이버지도 */}
                <Box
                    component="button"
                    onClick={() => {
                        if (item.locationLat && item.locationLng)
                            window.open(
                                `https://map.naver.com/v5/search/${encodeURIComponent(locationText || item.locationText || "")}`,
                                "_blank"
                            );
                    }}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 2,
                        py: 1.125,
                        borderRadius: 99,
                        bgcolor: "transparent",
                        color: "text.secondary",
                        fontSize: 12,
                        fontWeight: 700,
                        border: 0,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                    }}
                >
                    <OpenInNewRoundedIcon sx={{ fontSize: 14 }} /> 네이버지도
                </Box>
            </Stack>
        </Box>
    );
}
