import React, { useEffect, useRef, useState } from "react";
import { Map, CustomOverlayMap, Circle } from "react-kakao-maps-sdk";
import { Z } from "../../../../shared/ui/zIndex.js";
import { Box, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import CoffeeRoundedIcon from "@mui/icons-material/CoffeeRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import LocalParkingRoundedIcon from "@mui/icons-material/LocalParkingRounded";
import { getCategory } from "../../utils/recruitmentUtils";
import { getCurrentPosition } from "../../../../shared/utils/geoUtils";

// POI category → visual style mapping
const POI_STYLE = {
    cafe:       { bg: "#fffbeb", border: "#f59e0b", color: "#92400e", Icon: CoffeeRoundedIcon },
    restaurant: { bg: "#fff7ed", border: "#f97316", color: "#9a3412", Icon: RestaurantRoundedIcon },
    parking:    { bg: "#eff6ff", border: "#3b82f6", color: "#1e40af", Icon: LocalParkingRoundedIcon },
};

// Small POI label marker — plain HTML for Kakao DOM
function PoiPin({ marker }) {
    const style = POI_STYLE[marker.category] || { bg: "#f9fafb", border: "#d1d5db", color: "#374151", Icon: null };
    const Icon = style.Icon;
    return (
        <div style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            background: style.bg,
            border: `1.5px solid ${style.border}`,
            borderRadius: "8px",
            padding: "3px 8px 3px 6px",
            fontSize: "11px", fontWeight: 700,
            color: style.color,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
            cursor: "default",
            userSelect: "none",
        }}>
            {Icon && <Icon style={{ fontSize: "12px", color: style.color, display: "block" }} />}
            {marker.name}
        </div>
    );
}

// Plain HTML marker — must use inline styles because it renders inside Kakao DOM context
function RecruitPin({ cat, selected, onClick }) {
    const pinSize = selected ? 40 : 32;
    const iconSize = selected ? 16 : 13;

    return (
        <div onClick={onClick} style={{ position: "relative", cursor: "pointer", display: "inline-block" }}>
            {/* pin */}
            <div style={{
                width: `${pinSize}px`,
                height: `${pinSize}px`,
                borderRadius: "50% 50% 50% 0",
                transform: "rotate(-45deg)",
                backgroundColor: selected ? cat.color : `${cat.color}D9`,
                border: `2px solid ${selected ? "#fff" : `${cat.color}99`}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s cubic-bezier(.34,1.56,.64,1)",
                boxShadow: `0 4px 16px ${cat.color}80`,
            }}>
                <span style={{ transform: "rotate(45deg)", fontSize: `${iconSize}px`, display: "inline-block" }}>
                    {cat.icon}
                </span>
            </div>
        </div>
    );
}

const DEFAULT_CENTER = { lat: 37.5200, lng: 127.0350 };

export default function RecruitMapCanvas({
    items,
    selected,
    onSelect,
    kakaoReady,
    children,
    level = 8,
    myLocation = null,
    nearbyRadius = null,
    onMyLocation = null,
    staticMap = false,
    showMyLocation = true,   // false 전달 시 내장 내 위치 버튼 숨김 (Dialog 등에서 커스텀 버튼 사용)
    onBoundsChange = null,
    yPanOffset = 0,
    poiMarkers = [],         // [{ lat, lng, name, category }] — POI 마커 표시
    centerOn = null,         // { lat, lng } — 지도 중심 이동 (선택 상태 변경 없이)
    mapChildren = null,      // Map 컴포넌트 내부에 렌더링 (CustomOverlayMap 등)
}) {
    const mapRef = useRef(null);
    const [locLoading, setLocLoading] = useState(false);
    const yPanOffsetRef = useRef(yPanOffset);
    yPanOffsetRef.current = yPanOffset;
    const onBoundsChangeRef = useRef(onBoundsChange);
    onBoundsChangeRef.current = onBoundsChange;
    const idleListenerRegistered = useRef(false);

    const handleMyLocation = async () => {
        setLocLoading(true);
        try {
            const pos = await getCurrentPosition({ timeout: 10000 });
            const loc = { lat: pos.latitude, lng: pos.longitude };
            panTo(loc.lat, loc.lng);
            if (onMyLocation) onMyLocation(loc);
        } catch { /* 위치 권한 없음 */ }
        finally { setLocLoading(false); }
    };

    // mapItems = items that have location data
    const mapItems = (items || []).filter((i) => i.locationLat && i.locationLng);

    // Initialize center: myLocation → selected → first item → Seoul
    const [center, setCenter] = useState(() => {
        if (myLocation?.lat && myLocation?.lng) return myLocation;
        if (selected?.locationLat && selected?.locationLng) {
            return { lat: selected.locationLat, lng: selected.locationLng };
        }
        const first = mapItems[0];
        return first ? { lat: first.locationLat, lng: first.locationLng } : DEFAULT_CENTER;
    });

    const panTo = (lat, lng, offsetY = 0) => {
        if (mapRef.current && window.kakao?.maps) {
            const map = mapRef.current;
            if (offsetY !== 0) {
                // 시트 높이만큼 중심을 아래로 보정 → 마커가 시트 위 가시 영역 중앙에 표시
                const proj = map.getProjection();
                const target = new window.kakao.maps.LatLng(lat, lng);
                const pt = proj.pointFromCoords(target);
                const adjusted = proj.coordsFromPoint(
                    new window.kakao.maps.Point(pt.x, pt.y + offsetY)
                );
                map.panTo(adjusted);
            } else {
                map.panTo(new window.kakao.maps.LatLng(lat, lng));
            }
        } else {
            setCenter({ lat, lng });
        }
    };

    useEffect(() => {
        if (!selected?.locationLat || !selected?.locationLng) return;
        panTo(selected.locationLat, selected.locationLng, yPanOffsetRef.current);
    }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!centerOn?.lat || !centerOn?.lng) return;
        panTo(centerOn.lat, centerOn.lng);
    }, [centerOn?.lat, centerOn?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    // Pan to myLocation when it changes
    useEffect(() => {
        if (myLocation?.lat && myLocation?.lng) {
            panTo(myLocation.lat, myLocation.lng);
        }
    }, [myLocation]);

    if (!kakaoReady) {
        return (
            <Box sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                bgcolor: "background.paper",
            }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">지도를 불러오는 중...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
            <Map
                center={center}
                style={{ width: "100%", height: "100%" }}
                level={level}
                onCreate={(map) => {
                    mapRef.current = map;
                    if (!idleListenerRegistered.current && window.kakao?.maps) {
                        idleListenerRegistered.current = true;
                        const emit = () => {
                            const b = map.getBounds();
                            const sw = b.getSouthWest();
                            const ne = b.getNorthEast();
                            onBoundsChangeRef.current?.({
                                sw: { lat: sw.getLat(), lng: sw.getLng() },
                                ne: { lat: ne.getLat(), lng: ne.getLng() },
                            });
                        };
                        window.kakao.maps.event.addListener(map, "idle", emit);
                        // 초기 bounds: 렌더 사이클 이후 실행해 무한루프 방지
                        setTimeout(emit, 0);
                    }
                }}
                draggable={!staticMap}
                scrollwheel={!staticMap}
                disableDoubleClickZoom={staticMap}
                zoomable={!staticMap}
            >
                {/* Nearby radius circle */}
                {myLocation && nearbyRadius && (
                    <Circle
                        center={myLocation}
                        radius={nearbyRadius * 1000}
                        strokeWeight={1.5}
                        strokeColor="#5B8AF5"
                        strokeOpacity={0.65}
                        strokeStyle="dashed"
                        fillColor="#5B8AF5"
                        fillOpacity={0.06}
                    />
                )}

                {/* My location dot */}
                {myLocation && (
                    <CustomOverlayMap position={myLocation}>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                bgcolor: "#2563EB",
                                border: "3px solid #fff",
                                boxShadow: "0 0 0 0 rgba(37,99,235,0.4)",
                                transform: "translate(-50%, -50%)",
                                animation: "recLocPulse 2s infinite",
                                "@keyframes recLocPulse": {
                                    "0%": { boxShadow: "0 0 0 0 rgba(37,99,235,0.4)" },
                                    "70%": { boxShadow: "0 0 0 10px rgba(37,99,235,0)" },
                                    "100%": { boxShadow: "0 0 0 0 rgba(37,99,235,0)" },
                                },
                            }}
                        />
                    </CustomOverlayMap>
                )}

                {mapItems.map((item) => {
                    const cat = getCategory(item.typeLabel);
                    const isSel = selected?.id === item.id;
                    return (
                        <CustomOverlayMap
                            key={item.id}
                            position={{ lat: item.locationLat, lng: item.locationLng }}
                            yAnchor={1}
                            zIndex={isSel ? 20 : 10}
                        >
                            <RecruitPin
                                cat={cat}
                                selected={isSel}
                                onClick={() => onSelect && onSelect(isSel ? null : item)}
                            />
                        </CustomOverlayMap>
                    );
                })}

                {/* POI 마커 */}
                {poiMarkers.map((m, idx) => (
                    <CustomOverlayMap
                        key={`poi-${m.category}-${idx}`}
                        position={{ lat: m.lat, lng: m.lng }}
                        yAnchor={1.3}
                        zIndex={5}
                    >
                        <PoiPin marker={m} />
                    </CustomOverlayMap>
                ))}

                {mapChildren}
            </Map>

            {/* 내 위치 버튼 — staticMap 또는 showMyLocation=false 이면 숨김 */}
            {!staticMap && showMyLocation && (
                <Tooltip title="내 위치로 이동" placement="left">
                    <IconButton
                        onClick={handleMyLocation}
                        disabled={locLoading}
                        size="small"
                        sx={{
                            position: "absolute",
                            top: 12, right: 12,
                            zIndex: Z.MAP_CONTROL,
                            width: 36, height: 36,
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            "&:hover": { bgcolor: "action.hover" },
                        }}
                    >
                        {locLoading
                            ? <CircularProgress size={16} />
                            : <MyLocationRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                        }
                    </IconButton>
                </Tooltip>
            )}

            {/* optional overlay content (e.g. selected card at bottom) */}
            {children && (
                <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: Z.MAP_CONTROL }}>
                    {children}
                </Box>
            )}
        </Box>
    );
}
