import React, { useEffect, useRef, useState } from "react";
import { blurSx } from "../../../shared/ui/glassSx.js";
import { Z } from "../../../shared/ui/zIndex.js";
import { STATUSES, STATUS_LABEL, statusColor } from "../../../shared/ui/tone.js";
import {
    Box, CircularProgress, IconButton, InputAdornment,
    Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Map, CustomOverlayMap } from "react-kakao-maps-sdk";
import { getCurrentPosition } from "../../../shared/utils/geoUtils.js";
import SearchRoundedIcon        from "@mui/icons-material/SearchRounded";
import MyLocationRoundedIcon    from "@mui/icons-material/MyLocationRounded";
import AddRoundedIcon           from "@mui/icons-material/AddRounded";
import CloseRoundedIcon         from "@mui/icons-material/CloseRounded";
import TravelExploreRoundedIcon from "@mui/icons-material/TravelExploreRounded";
import MapMarker from "./MapMarker.jsx";
import PlaceSearchModal from "./PlaceSearchModal.jsx";
import { getTaskMarkerColor } from "../utils/mapUtils.js";
import SelectedTaskPanelDesktop from "./SelectedTaskPanelDesktop.jsx";

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };

function MapLoadingOverlay() {
    return (
        <Box
            sx={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                bgcolor: "background.paper", gap: 2, zIndex: Z.STICKY,
            }}
        >
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">지도를 불러오는 중...</Typography>
        </Box>
    );
}


export default function MapCanvasDesktop({
    tasks,
    selectedTask,
    onSelect,
    onClear,
    onRefresh,
    onAddClick,
    searchValue,
    onSearchChange,
    kakaoReady,
    loading,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const [center, setCenter]         = useState(DEFAULT_CENTER);
    const [locating, setLocating]     = useState(false);
    const [myLocation, setMyLocation] = useState(null);
    const [placeModalOpen, setPlaceModalOpen] = useState(false);

    const mapRef       = useRef(null);
    const containerRef = useRef(null);

    /* 컨테이너 크기 변화 감지 → relayout (사이드바/패널 토글 대응) */
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => {
            if (mapRef.current) mapRef.current.relayout();
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const panTo = (lat, lng) => {
        if (mapRef.current && window.kakao) {
            mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng));
        } else {
            setCenter({ lat, lng });
        }
    };

    /* 진입 시 내 위치로 이동 */
    useEffect(() => {
        getCurrentPosition().then(({ latitude: lat, longitude: lng }) => {
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
        getCurrentPosition().then(({ latitude: lat, longitude: lng }) => {
            panTo(lat, lng);
            setMyLocation({ lat, lng });
        }).catch(() => {}).finally(() => setLocating(false));
    };

    return (
        <Box
            ref={containerRef}
            sx={{
                position: "relative", width: "100%", height: "100%",
                overflow: "hidden", border: "1px solid", borderColor: "divider",
                bgcolor: "background.paper",
            }}
        >
            {(loading || !kakaoReady) && <MapLoadingOverlay />}

            {kakaoReady && (
                <Map
                    center={center}
                    onCreate={(map) => { mapRef.current = map; }}
                    style={{ width: "100%", height: "100%" }}
                    level={5}
                >
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
                                    width: 18, height: 18, borderRadius: "50%",
                                    bgcolor: "#2563EB", border: "3px solid #fff",
                                    boxShadow: "0 0 0 0 rgba(37,99,235,0.4)",
                                    transform: "translate(-50%, -50%)",
                                    animation: "myLocPulse 2s infinite",
                                    "@keyframes myLocPulse": {
                                        "0%":   { boxShadow: "0 0 0 0 rgba(37,99,235,0.4)" },
                                        "70%":  { boxShadow: "0 0 0 10px rgba(37,99,235,0)" },
                                        "100%": { boxShadow: "0 0 0 0 rgba(37,99,235,0)" },
                                    },
                                }}
                            />
                        </CustomOverlayMap>
                    )}
                </Map>
            )}

            {/* ── 상단 오버레이 ── */}
            <Box
                sx={{
                    position: "absolute", left: 16, right: 16, top: 16,
                    display: "flex", justifyContent: "space-between", gap: 1, zIndex: Z.MAP_CONTROL,
                }}
            >
                {/* 할 일 제목 검색 */}
                <TextField
                    fullWidth
                    size="small"
                    placeholder="할 일 제목 검색"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    sx={(theme) => ({
                        maxWidth: 420,
                        "& .MuiOutlinedInput-root": {
                            borderRadius: 3,
                            bgcolor: alpha(theme.palette.background.paper, 0.96),
                            boxShadow: "0 6px 16px rgba(15,23,42,0.16)",
                        },
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

                <Stack direction="row" spacing={1}>
                    {/* 장소 찾기 → 모달 */}
                    <Tooltip title="장소 찾기">
                        <IconButton
                            onClick={() => setPlaceModalOpen(true)}
                            sx={(theme) => ({
                                bgcolor: alpha(theme.palette.background.paper, 0.95),
                                boxShadow: 3,
                            })}
                        >
                            <TravelExploreRoundedIcon />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={locating ? "위치 확인 중..." : "내 위치"}>
                        <IconButton
                            onClick={handleMyLocation}
                            disabled={locating}
                            sx={(theme) => ({ bgcolor: alpha(theme.palette.background.paper, 0.95), boxShadow: 3 })}
                        >
                            {locating ? <CircularProgress size={18} /> : <MyLocationRoundedIcon />}
                        </IconButton>
                    </Tooltip>

                    <IconButton
                        onClick={onAddClick}
                        sx={{
                            bgcolor: isDark ? "rgba(147,197,253,0.78)" : "rgba(59,130,246,1)",
                            color:   isDark ? "#0f172a" : "#eff6ff",
                            ...blurSx("blur(10px)"),
                            border:     isDark ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.28)",
                            boxShadow:  isDark ? "0 10px 24px rgba(0,0,0,0.28)" : "0 8px 24px rgba(37,99,235,0.22)",
                            "&:hover": { bgcolor: isDark ? "rgba(147,197,253,0.92)" : "rgba(37,99,235,1)" },
                        }}
                    >
                        <AddRoundedIcon />
                    </IconButton>
                </Stack>
            </Box>

            {/* ── 핀 레전드 (검색 인풋 아래) ── */}
            <Box
                sx={{
                    position: "absolute", left: 16, top: 66, zIndex: Z.MAP_CONTROL,
                    display: "flex", alignItems: "center", gap: "14px",
                    px: "14px", py: "10px", borderRadius: 999,
                    bgcolor: "var(--plando-surface)",
                    boxShadow: "var(--plando-shadow-raised)",
                    border: "1px solid var(--plando-border)",
                    fontSize: 11.5, fontWeight: 600, color: "var(--plando-text-secondary)",
                }}
            >
                {STATUSES.map((s) => ({ color: statusColor(theme, s), label: STATUS_LABEL[s] })).map(({ color, label }) => (
                    <Box key={label} sx={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
                        {label}
                    </Box>
                ))}
            </Box>

            {/* ── 선택된 task 상세 패널 ── */}
            {selectedTask && (
                <Box sx={{ position: "absolute", right: 16, bottom: 16, zIndex: Z.MAP_CONTROL, width: 320 }}>
                    <SelectedTaskPanelDesktop
                        task={selectedTask}
                        onClear={onClear}
                        onRefresh={onRefresh}
                    />
                </Box>
            )}

            {/* ── 장소 찾기 모달 ── */}
            <PlaceSearchModal
                open={placeModalOpen}
                onClose={() => setPlaceModalOpen(false)}
                onSaved={onRefresh}
                kakaoReady={kakaoReady}
            />
        </Box>
    );
}
