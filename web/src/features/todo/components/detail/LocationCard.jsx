import React from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import { Map, CustomOverlayMap, useKakaoLoader } from "react-kakao-maps-sdk";

import { Z } from "../../../../shared/ui/zIndex.js";

/**
 * 할 일 상세 위치 카드 — mobile/desktop 공용.
 * 기존에 TodoDetailMobile.jsx 와 TodoDetailDesktop.jsx 가 거의 동일하게 인라인으로
 * 가지고 있던 LocationCard 두 벌을 통합. 카드 chrome / map 높이만 prop으로 분기.
 *
 * Props:
 *   todo: { locationName?, locationAddress?, placeName?, address?, locationLat?/lat?/latitude?, locationLng?/lng?/longitude? }
 *   onMapClick?: 지도/카드 클릭 시 핸들러 (보통 /map 이동)
 *   mapHeight?: 미니 맵 높이 (기본 160 — mobile 기준)
 *   variant?: "card" (기본 — outlined Card 사용) | "plain" (Box, 카드 안에 들어갈 때)
 *
 * 위치 정보가 전혀 없으면 null 반환.
 */
export default function LocationCard({
    todo,
    onMapClick,
    mapHeight = 160,
    variant = "card",
}) {
    const [kakaoLoading] = useKakaoLoader({
        appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
        libraries: ["services"],
    });
    const kakaoReady = !kakaoLoading;

    const lat = todo?.locationLat ?? todo?.lat ?? todo?.latitude;
    const lng = todo?.locationLng ?? todo?.lng ?? todo?.longitude;

    const hasLocation = Boolean(
        todo?.locationName ||
        todo?.locationAddress ||
        todo?.placeName ||
        todo?.address ||
        (lat && lng)
    );

    if (!hasLocation) return null;

    const locationTitle = todo?.locationName || todo?.placeName || "저장된 위치";
    const locationAddress = todo?.locationAddress || todo?.address || "주소 정보 없음";
    const hasCoords = Boolean(lat && lng);

    const inner = (
        <Stack spacing={1.4}>
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
                <Box
                    sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 2.2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: (t) => alpha(t.palette.warning.main, 0.14),
                        color: "warning.main",
                        flexShrink: 0,
                    }}
                >
                    <PlaceRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 900, lineHeight: 1.35 }}>
                        {locationTitle}
                    </Typography>
                    <Typography
                        sx={{
                            mt: 0.4,
                            fontSize: 13,
                            color: "text.secondary",
                            wordBreak: "break-word",
                        }}
                    >
                        {locationAddress}
                    </Typography>
                </Box>
            </Stack>

            <Box
                onClick={onMapClick}
                sx={{
                    position: "relative",
                    height: mapHeight,
                    borderRadius: 3,
                    overflow: "hidden",
                    boxShadow: "var(--plando-elev-1)",
                    cursor: onMapClick ? "pointer" : "default",
                }}
            >
                {hasCoords && !kakaoReady ? (
                    <Box
                        sx={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "action.hover",
                        }}
                    >
                        <Typography variant="caption" color="text.disabled">
                            지도 불러오는 중...
                        </Typography>
                    </Box>
                ) : hasCoords ? (
                    <>
                        <Map
                            center={{ lat: Number(lat), lng: Number(lng) }}
                            style={{ width: "100%", height: "100%" }}
                            level={4}
                            draggable={false}
                            zoomable={false}
                            scrollwheel={false}
                            disableDoubleClick
                            disableDoubleClickZoom
                        >
                            <CustomOverlayMap position={{ lat: Number(lat), lng: Number(lng) }}>
                                <Box
                                    sx={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: "50%",
                                        bgcolor: "#FFB74D",
                                        border: "3px solid #fff",
                                        boxShadow: "0 0 0 6px rgba(255,183,77,0.25)",
                                        transform: "translate(-50%, -50%)",
                                    }}
                                />
                            </CustomOverlayMap>
                        </Map>
                        {/* 클릭 가로채기용 투명 오버레이 (Map 자체 이벤트 무력화) */}
                        <Box
                            onClick={onMapClick}
                            sx={{
                                position: "absolute",
                                inset: 0,
                                zIndex: Z.STICKY,
                                cursor: "pointer",
                            }}
                        />
                    </>
                ) : (
                    <Box
                        sx={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "action.hover",
                        }}
                    >
                        <Typography variant="caption" color="text.disabled">
                            좌표 정보 없음
                        </Typography>
                    </Box>
                )}

                <Chip
                    icon={<MapRoundedIcon sx={{ fontSize: 18 }} />}
                    label="지도에서 보기"
                    size="small"
                    onClick={onMapClick}
                    sx={{
                        position: "absolute",
                        right: 10,
                        bottom: 10,
                        zIndex: Z.STICKY,
                        height: 30,
                        borderRadius: 999,
                        bgcolor: alpha("#091224", 0.9),
                        color: "#DCEBFF",
                        border: "1px solid rgba(255,255,255,0.08)",
                        cursor: "pointer",
                        "& .MuiChip-icon": { color: "primary.light" },
                    }}
                />
            </Box>
        </Stack>
    );

    if (variant === "plain") {
        return inner;
    }

    return (
        <Card variant="outlined" sx={{ borderRadius: 3, mb: 1.5 }}>
            <CardContent sx={{ pt: 2, "&:last-child": { pb: 2 } }}>
                {inner}
            </CardContent>
        </Card>
    );
}
