import { useEffect, useState } from "react";

/**
 * useMapDetailData — MapDetailDialog용 Kakao services 데이터 로드 hook
 *
 * 다이얼로그가 열릴 때 한 번:
 *  - 역지오코딩으로 실제 주소
 *  - 반경 1500m 지하철역 (최대 4개)
 *  - 반경 500m 카페/주차장/음식점 카운트 + 마커 좌표
 *
 * @param {boolean} open - 다이얼로그 오픈 상태
 * @param {number}  lat
 * @param {number}  lng
 */
export default function useMapDetailData(open, lat, lng) {
    const [dialogAddress, setDialogAddress] = useState(null);
    const [transitList, setTransitList] = useState([]);
    const [poiCounts, setPoiCounts] = useState({});
    const [poiMarkerData, setPoiMarkerData] = useState({});

    useEffect(() => {
        if (!open || !lat || !lng) return;
        // Reset on open
        setDialogAddress(null);
        setTransitList([]);
        setPoiCounts({});
        setPoiMarkerData({});

        const tryKakaoServices = () => {
            if (!window.kakao?.maps?.services) return false;
            const pos = new window.kakao.maps.LatLng(lat, lng);

            // 역지오코딩 → 실제 주소
            const geocoder = new window.kakao.maps.services.Geocoder();
            geocoder.coord2Address(lng, lat, (result, status) => {
                if (status === window.kakao.maps.services.Status.OK && result[0]) {
                    const r = result[0];
                    const addr = r.road_address?.address_name || r.address?.address_name || null;
                    setDialogAddress(addr);
                }
            });

            // 교통 — 주변 지하철역 (반경 1.5km)
            const places = new window.kakao.maps.services.Places();
            places.categorySearch("SW8", (data, status) => {
                if (status === window.kakao.maps.services.Status.OK) {
                    setTransitList(data.slice(0, 4).map((p) => ({
                        name: p.place_name,
                        distance: p.distance,
                    })));
                }
            }, { location: pos, radius: 1500, sort: window.kakao.maps.services.SortBy.DISTANCE });

            // 주변 시설 — 카운트 + 마커 좌표 저장
            [
                { cat: "CE7", key: "cafe" },
                { cat: "PK6", key: "parking" },
                { cat: "FD6", key: "restaurant" },
            ].forEach(({ cat: catCode, key }) => {
                places.categorySearch(catCode, (data, status) => {
                    if (status === window.kakao.maps.services.Status.OK) {
                        setPoiCounts((prev) => ({ ...prev, [key]: data.length }));
                        setPoiMarkerData((prev) => ({
                            ...prev,
                            [key]: data.map((p) => ({
                                lat: parseFloat(p.y),
                                lng: parseFloat(p.x),
                                name: p.place_name,
                                category: key,
                            })),
                        }));
                    }
                }, { location: pos, radius: 500, sort: window.kakao.maps.services.SortBy.DISTANCE });
            });

            return true;
        };

        if (!tryKakaoServices()) {
            const t = setTimeout(tryKakaoServices, 800);
            return () => clearTimeout(t);
        }
    }, [open, lat, lng]);

    return { dialogAddress, transitList, poiCounts, poiMarkerData };
}
