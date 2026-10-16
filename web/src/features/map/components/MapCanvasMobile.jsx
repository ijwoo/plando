import React, { useEffect, useRef, useState } from "react";
import { blurSx } from "../../../shared/ui/glassSx.js";
import { Z } from "../../../shared/ui/zIndex.js";
import { Box, CircularProgress, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Map, CustomOverlayMap, Circle } from "react-kakao-maps-sdk";
import { getCurrentPosition } from "../../../shared/utils/geoUtils.js";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TravelExploreRoundedIcon from "@mui/icons-material/TravelExploreRounded";
import MapMarker from "./MapMarker.jsx";
import { getTaskMarkerColor } from "../utils/mapUtils.js";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };

export default function MapCanvasMobile({
    tasks,
    selectedTask,
    onSelect,
    onAddClick,
    onPlaceSearchClick,
    searchValue,
    onSearchChange,
    sheetHeight,
    kakaoReady,
    loading,
    triggerMap = {},
    showTriggers = false,
    hideRightActions = false,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const [center, setCenter] = useState(DEFAULT_CENTER);
    const [locating, setLocating] = useState(false);
    const [myLocation, setMyLocation] = useState(null);
    const mapRef = useRef(null);

    const panTo = (lat, lng) => {
        if (mapRef.current && window.kakao) {
            mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng));
        } else {
            setCenter({ lat, lng });
        }
    };

    // 진입 시 자동으로 내 위치로 이동 (selectedTask가 있으면 중심 이동 스킵)
    useEffect(() => {
        getCurrentPosition().then((coords) => {
            const { latitude: lat, longitude: lng } = coords;
            setMyLocation({ lat, lng });
            if (!selectedTask?.locationLat || !selectedTask?.locationLng) {
                setCenter({ lat, lng });
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (selectedTask?.locationLat && selectedTask?.locationLng) {
            panTo(selectedTask.locationLat, selectedTask.locationLng);
        }
    }, [selectedTask]);

    const handleMyLocation = () => {
        setLocating(true);
        getCurrentPosition().then((coords) => {
            const { latitude: lat, longitude: lng } = coords;
            panTo(lat, lng);
            setMyLocation({ lat, lng });
        }).catch(() => {}).finally(() => setLocating(false));
    };

    return (
        <Box sx={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            {/* 로딩 */}
            {(loading || !kakaoReady) && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "background.paper",
                        gap: 2,
                        zIndex: Z.STICKY,
                    }}
                >
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary">
                        지도를 불러오는 중...
                    </Typography>
                </Box>
            )}

            {/* 실제 카카오 지도 */}
            {kakaoReady && (
                <Map
                    center={center}
                    onCreate={(map) => { mapRef.current = map; }}
                    style={{ width: "100%", height: "100%" }}
                    level={5}
                >
                    {/* 장소 알림 반경 원 */}
                    {showTriggers && tasks
                        .filter((t) => triggerMap[t.id]?.enabled && t.locationLat && t.locationLng)
                        .map((task) => (
                            <Circle
                                key={`trigger-${task.id}`}
                                center={{ lat: task.locationLat, lng: task.locationLng }}
                                radius={triggerMap[task.id]?.radius || 200}
                                strokeWeight={1.5}
                                strokeColor={getTaskMarkerColor(theme, task.status)}
                                strokeOpacity={0.75}
                                strokeStyle="dashed"
                                fillColor={getTaskMarkerColor(theme, task.status)}
                                fillOpacity={0.06}
                            />
                        ))
                    }

                    {tasks.map((task) => (
                        <CustomOverlayMap
                            key={task.id}
                            position={{ lat: task.locationLat, lng: task.locationLng }}
                            yAnchor={1}
                        >
                            <MapMarker
                                color={getTaskMarkerColor(theme, task.status)}
                                selected={selectedTask?.id === task.id}
                                onClick={() => onSelect(task)}
                            />
                        </CustomOverlayMap>
                    ))}
                    {myLocation && (
                        <CustomOverlayMap position={myLocation}>
                            <Box
                                sx={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: "50%",
                                    bgcolor: "#2563EB",
                                    border: "3px solid #fff",
                                    boxShadow: "0 0 0 0 rgba(37,99,235,0.4)",
                                    transform: "translate(-50%, -50%)",
                                    animation: "myLocPulse 2s infinite",
                                    "@keyframes myLocPulse": {
                                        "0%": { boxShadow: "0 0 0 0 rgba(37,99,235,0.4)" },
                                        "70%": { boxShadow: "0 0 0 10px rgba(37,99,235,0)" },
                                        "100%": { boxShadow: "0 0 0 0 rgba(37,99,235,0)" },
                                    },
                                }}
                            />
                        </CustomOverlayMap>
                    )}
                </Map>
            )}

            {/* 검색바 */}
            <Box sx={{ position: "absolute", left: 12, right: 12, top: "calc(12px + env(safe-area-inset-top, 0px))", zIndex: Z.MAP_CONTROL }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="업무 제목 또는 장소 검색"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    sx={(theme) => ({
                        "& .MuiOutlinedInput-root": {
                            borderRadius: 3,
                            bgcolor: alpha(theme.palette.background.paper, 0.96),
                            boxShadow: "0 4px 20px rgba(15,23,42,0.20)",
                            height: 46,
                        },
                        "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                    })}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                            </InputAdornment>
                        ),
                        endAdornment: searchValue ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={() => onSearchChange("")} edge="end">
                                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    }}
                />
            </Box>

            {/* 우측 FAB 버튼 — 바텀시트 위에 위치. 시트 expanded 시 숨김. */}
            <Box
                sx={{
                    position: "absolute",
                    right: 14,
                    bottom: `min(calc(${sheetHeight}px + 16px), calc(100% - 180px))`,
                    zIndex: Z.MAP_CONTROL,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    transition: "bottom 0.3s ease, opacity 0.25s ease, transform 0.25s ease",
                    opacity: hideRightActions ? 0 : 1,
                    transform: hideRightActions ? "translateY(8px) scale(0.95)" : "none",
                    pointerEvents: hideRightActions ? "none" : "auto",
                }}
            >
                <IconButton
                    onClick={onAddClick}
                    sx={{
                        width: 48,
                        height: 48,
                        bgcolor: isDark ? "rgba(147,197,253,0.78)" : "rgba(59,130,246,1)",
                        color: isDark ? "#0f172a" : "#eff6ff",
                        ...blurSx("blur(10px)"),
                        border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.28)",
                        boxShadow: isDark ? "0 10px 24px rgba(0,0,0,0.28)" : "0 12px 30px rgba(37,99,235,0.22)",
                        "&:hover": {
                            bgcolor: isDark ? "rgba(147,197,253,0.92)" : "rgba(37,99,235,1)",
                        },
                    }}
                >
                    <AddRoundedIcon />
                </IconButton>
                <IconButton
                    onClick={onPlaceSearchClick}
                    sx={(theme) => ({
                        width: 48,
                        height: 48,
                        bgcolor: alpha(theme.palette.background.paper, 0.96),
                        boxShadow: "0 4px 16px rgba(15,23,42,0.20)",
                    })}
                >
                    <TravelExploreRoundedIcon />
                </IconButton>
                <IconButton
                    onClick={handleMyLocation}
                    disabled={locating}
                    sx={(theme) => ({
                        bgcolor: alpha(theme.palette.background.paper, 0.96),
                        boxShadow: "0 4px 16px rgba(15,23,42,0.20)",
                        width: 48,
                        height: 48,
                    })}
                >
                    {locating ? <CircularProgress size={20} /> : <MyLocationRoundedIcon />}
                </IconButton>
            </Box>
        </Box>
    );
}
