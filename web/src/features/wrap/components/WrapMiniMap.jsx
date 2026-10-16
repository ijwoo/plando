import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { Map as KakaoMap, CustomOverlayMap, useKakaoLoader } from "react-kakao-maps-sdk";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import Press from "../../../shared/ui/primitives/Press.jsx";

/**
 * 이번 주 활동 미니맵.
 * weekTodos 중 locationLat/Lng 있는 것만 마커로 표시.
 * bounds fit + 자세히 보기 → /map 이동.
 */
export default function WrapMiniMap({ todos = [], height = 200 }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();

    const [kakaoLoading] = useKakaoLoader({
        appkey: import.meta.env.VITE_KAKAO_MAP_KEY,
        libraries: ["services"],
    });
    const kakaoReady = !kakaoLoading;

    // 좌표 있는 일정만
    const withCoords = useMemo(
        () => (todos || []).filter((t) => t.locationLat && t.locationLng),
        [todos]
    );

    // 같은 장소 중복 카운트 (마커 크기 단계화)
    const grouped = useMemo(() => {
        const acc = {};
        for (const t of withCoords) {
            const key = `${t.locationLat.toFixed(5)}_${t.locationLng.toFixed(5)}`;
            if (!acc[key]) {
                acc[key] = {
                    lat: t.locationLat,
                    lng: t.locationLng,
                    name: t.locationName || "",
                    count: 1,
                };
            } else {
                acc[key].count += 1;
            }
        }
        return Object.values(acc);
    }, [withCoords]);

    // 중심 / 영역 계산
    const { center, level } = useMemo(() => {
        if (grouped.length === 0) {
            return { center: { lat: 37.5665, lng: 126.978 }, level: 7 };
        }
        const lats = grouped.map((g) => g.lat);
        const lngs = grouped.map((g) => g.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const c = {
            lat: (minLat + maxLat) / 2,
            lng: (minLng + maxLng) / 2,
        };
        const latDiff = maxLat - minLat;
        const lngDiff = maxLng - minLng;
        const diff = Math.max(latDiff, lngDiff);
        let lv = 4;
        if (diff > 0.3) lv = 9;
        else if (diff > 0.15) lv = 8;
        else if (diff > 0.07) lv = 7;
        else if (diff > 0.03) lv = 6;
        else if (diff > 0.015) lv = 5;
        else if (diff > 0.007) lv = 4;
        else lv = 3;
        return { center: c, level: lv };
    }, [grouped]);

    // ── 지도 중심 보정 ──
    // 미니맵이 세로 스크롤/페이지 전환 안에서 초기화되면 컨테이너 크기가 확정되기 전
    // center가 계산돼 중심이 어긋난다(특히 모바일). map.relayout() 후 다시 영역을 맞춘다.
    const mapRef = useRef(null);
    const containerRef = useRef(null);

    const applyView = useCallback(
        (map) => {
            const kakao = window.kakao;
            if (!map || !kakao?.maps) return;
            map.relayout();
            if (grouped.length >= 2) {
                const b = new kakao.maps.LatLngBounds();
                grouped.forEach((g) => b.extend(new kakao.maps.LatLng(g.lat, g.lng)));
                map.setBounds(b, 28, 28, 28, 28);
            } else {
                map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
                map.setLevel(level);
            }
        },
        [grouped, center, level]
    );

    const handleCreate = useCallback(
        (map) => {
            mapRef.current = map;
            applyView(map);
        },
        [applyView]
    );

    // 컨테이너 크기 변화(레이아웃 확정·회전·리사이즈) 시 다시 보정
    useEffect(() => {
        if (!kakaoReady) return;
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => {
            if (mapRef.current) applyView(mapRef.current);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [kakaoReady, applyView]);

    // 마커/중심 데이터가 바뀌면 재적용
    useEffect(() => {
        if (mapRef.current) applyView(mapRef.current);
    }, [applyView]);

    if (!withCoords || withCoords.length === 0) return null;

    const handleExpand = () => navigate("/map");

    return (
        <Box
            ref={containerRef}
            sx={{
                position: "relative",
                width: "100%",
                height,
                borderRadius: "var(--plando-radius-md)",
                overflow: "hidden",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "var(--plando-divider)"}`,
                background: isDark ? "rgba(255,255,255,0.02)" : "var(--plando-surface-alt)",
            }}
        >
            {!kakaoReady ? (
                <Stack
                    alignItems="center"
                    justifyContent="center"
                    sx={{ width: "100%", height: "100%" }}
                >
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary" }}>
                        지도 불러오는 중…
                    </Typography>
                </Stack>
            ) : (
                <>
                    <KakaoMap
                        center={center}
                        level={level}
                        onCreate={handleCreate}
                        style={{ width: "100%", height: "100%" }}
                        draggable={false}
                        zoomable={false}
                        disableDoubleClick
                        disableDoubleClickZoom
                    >
                        {grouped.map((g, i) => {
                            const sizeStep = g.count >= 4 ? "lg" : g.count >= 2 ? "md" : "sm";
                            const size = sizeStep === "lg" ? 36 : sizeStep === "md" ? 30 : 24;
                            return (
                                <CustomOverlayMap
                                    key={`${g.lat}_${g.lng}_${i}`}
                                    position={{ lat: g.lat, lng: g.lng }}
                                    yAnchor={1}
                                >
                                    <Box
                                        sx={{
                                            transform: "translate(-50%, -100%)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: size,
                                            height: size,
                                            borderRadius: "50%",
                                            background: "var(--plando-primary)",
                                            color: "#FFFFFF",
                                            border: "2px solid #FFFFFF",
                                            boxShadow: "0 4px 10px rgba(15,23,42,0.25)",
                                            fontSize: sizeStep === "lg" ? 13 : 11,
                                            fontWeight: 800,
                                            letterSpacing: "-0.01em",
                                        }}
                                    >
                                        {g.count > 1 ? g.count : <PlaceRoundedIcon sx={{ fontSize: 14 }} />}
                                    </Box>
                                </CustomOverlayMap>
                            );
                        })}
                    </KakaoMap>

                    {/* 좌하단 카운트 chip */}
                    <Box
                        sx={{
                            position: "absolute",
                            left: 12,
                            bottom: 12,
                            padding: "5px 10px",
                            borderRadius: 999,
                            background: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.92)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "var(--plando-divider)"}`,
                            backdropFilter: "blur(6px)",
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                        }}
                    >
                        <PlaceRoundedIcon sx={{ fontSize: 13, color: "var(--plando-primary)" }} />
                        <Typography
                            sx={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                letterSpacing: "-0.01em",
                                color: isDark ? "#F1F5F9" : "var(--plando-text-primary)",
                            }}
                        >
                            장소 {grouped.length}곳 · 방문 {withCoords.length}건
                        </Typography>
                    </Box>

                    {/* 우상단 확대 버튼 */}
                    <Press
                        as="span"
                        onClick={handleExpand}
                        haptic="light"
                        pressScale={0.9}
                        style={{
                            position: "absolute",
                            right: 10,
                            top: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 32,
                            height: 32,
                            borderRadius: 999,
                            background: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.92)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "var(--plando-divider)"}`,
                            backdropFilter: "blur(6px)",
                        }}
                        aria-label="지도 자세히 보기"
                    >
                        <OpenInFullRoundedIcon
                            sx={{ fontSize: 14, color: isDark ? "#F1F5F9" : "var(--plando-text-primary)" }}
                        />
                    </Press>
                </>
            )}
        </Box>
    );
}
