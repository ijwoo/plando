import React, { useEffect, useState } from "react";
import { Dialog } from "@mui/material";
import { haversineKm } from "../../constants/recruitmentConfig";
import { getCurrentPosition } from "../../../../shared/utils/geoUtils";
import { SHADOW } from "../common/recruitmentSx";
import MapDialogSidebar from "./map/MapDialogSidebar";
import MapDialogMapArea from "./map/MapDialogMapArea";
import useMapDetailData from "./map/useMapDetailData";

const NEARBY_KM = 10;

/**
 * MapDetailDialog — 큰 지도 다이얼로그 (좌 사이드바 + 우 지도)
 *
 * 책임:
 *  - 다이얼로그 shell + state (nearbyMode / activePoi / tooltipItem / dialog 내 my location)
 *  - useMapDetailData hook으로 주소/교통/POI 데이터 로드
 *  - MapDialogSidebar / MapDialogMapArea 조립
 */
export default function MapDetailDialog({
    open,
    onClose,
    item,
    allItems,
    myLocation,
    setMyLocation,
    isPending,
    isAccepted,
    onApplyClick,
    onCopyToast,
    onDetailNav,
    cat,
    isUrgent,
    dueText,
    locationText,
    memberText,
    meetLabel,
}) {
    const [nearbyMode, setNearbyMode] = useState(false);
    const [activePoi, setActivePoi] = useState(new Set());
    const [tooltipItem, setTooltipItem] = useState(null);
    const [dialogLocLoading, setDialogLocLoading] = useState(false);

    const { dialogAddress, transitList, poiCounts, poiMarkerData } = useMapDetailData(
        open, item.locationLat, item.locationLng
    );

    const nearbyItems = (allItems || []).filter((i) =>
        i.id !== item.id &&
        i.locationLat && i.locationLng &&
        item.locationLat && item.locationLng &&
        haversineKm(item.locationLat, item.locationLng, i.locationLat, i.locationLng) <= NEARBY_KM
    );
    const nearbyCount = nearbyItems.length;

    useEffect(() => {
        if (open) setTooltipItem(null);
    }, [open]);

    const togglePoiCategory = (key) => {
        setActivePoi((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleDialogMyLocation = async () => {
        setDialogLocLoading(true);
        try {
            const pos = await getCurrentPosition({ timeout: 10000 });
            setMyLocation({ lat: pos.latitude, lng: pos.longitude });
        } catch { /* 위치 권한 없음 */ }
        finally { setDialogLocLoading(false); }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"
            PaperProps={{
                sx: {
                    borderRadius: 2.5,
                    overflow: "hidden",
                    height: 680,
                    maxHeight: "82vh",
                    display: "flex",
                    flexDirection: "row",
                    m: 2,
                    boxShadow: SHADOW.lift,
                },
            }}
        >
            <MapDialogSidebar
                item={item}
                cat={cat}
                isUrgent={isUrgent}
                isAccepted={isAccepted}
                isPending={isPending}
                dueText={dueText}
                locationText={locationText}
                memberText={memberText}
                meetLabel={meetLabel}
                dialogAddress={dialogAddress}
                transitList={transitList}
                poiCounts={poiCounts}
                activePoi={activePoi}
                onTogglePoiCategory={togglePoiCategory}
                onClose={onClose}
                onCopyToast={onCopyToast}
                onApplyClick={onApplyClick}
            />

            <MapDialogMapArea
                item={item}
                nearbyItems={nearbyItems}
                nearbyMode={nearbyMode}
                nearbyCount={nearbyCount}
                onToggleNearbyMode={() => setNearbyMode((v) => !v)}
                myLocation={myLocation}
                dialogLocLoading={dialogLocLoading}
                onDialogMyLocation={handleDialogMyLocation}
                tooltipItem={tooltipItem}
                setTooltipItem={setTooltipItem}
                activePoi={activePoi}
                poiMarkerData={poiMarkerData}
                locationText={locationText}
                onClose={onClose}
                onDetailNav={onDetailNav}
            />
        </Dialog>
    );
}
