import { useEffect, useRef } from "react";
import { notifyLocationEnter } from "../api/triggerApi.js";
import { watchPosition } from "../../../shared/utils/geoUtils.js";
import { isGeofenceAvailable, syncGeofences } from "../../../shared/native/geofenceBridge.js";
import { toast } from "../../../shared/utils/toast.js";

/** 두 좌표 간 거리(m) 계산 — Haversine */
function getDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 활성화된 트리거가 있는 태스크들의 위치를 모니터링.
 *
 * - iOS native: CLLocationManager geofencing (백그라운드 동작)
 * - Web / Android: watchPosition + Haversine (포그라운드만)
 *
 * @param {Array}  tasks      - 위치 있는 태스크 목록
 * @param {Object} triggerMap - { [todoId]: { enabled, radius } }
 */
export default function useLocationTrigger(tasks, triggerMap) {
    const insideRef = useRef({});
    const watchIdRef = useRef(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        // iOS native: OS 레벨 geofencing 등록 (백그라운드 포함)
        if (isGeofenceAvailable()) {
            syncGeofences(tasks, triggerMap).catch(() => {});
            return;
        }

        // Web / Android: 포그라운드 GPS watchPosition
        const activeTasks = tasks.filter(
            (t) => t.locationLat && t.locationLng && triggerMap[String(t.id)]?.enabled
        );

        if (activeTasks.length === 0) {
            if (watchIdRef.current) {
                watchIdRef.current();
                watchIdRef.current = null;
            }
            return;
        }

        initializedRef.current = false;

        const clearWatch = watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;

                if (!initializedRef.current) {
                    activeTasks.forEach((task) => {
                        const trigger = triggerMap[String(task.id)];
                        const radius = trigger?.radius ?? 200;
                        const dist = getDistanceMeters(latitude, longitude, task.locationLat, task.locationLng);
                        insideRef.current[task.id] = dist <= radius;
                    });
                    initializedRef.current = true;
                    return;
                }

                activeTasks.forEach((task) => {
                    const trigger = triggerMap[String(task.id)];
                    const radius = trigger?.radius ?? 200;
                    const dist = getDistanceMeters(latitude, longitude, task.locationLat, task.locationLng);
                    const isInside = dist <= radius;
                    const wasInside = insideRef.current[task.id] ?? false;

                    if (isInside && !wasInside) {
                        notifyLocationEnter(task.id).catch(() => {});
                    }
                    insideRef.current[task.id] = isInside;
                });
            },
            (err) => {
                if (err?.code === 1) {
                    toast.warning("위치 권한이 거부되었어요. 설정에서 허용해주세요.");
                }
            }
        );

        watchIdRef.current = clearWatch;

        return () => {
            if (watchIdRef.current) {
                watchIdRef.current();
                watchIdRef.current = null;
            }
        };
    }, [tasks, triggerMap]);
}
