import { Capacitor, registerPlugin } from "@capacitor/core";
import { isIOS } from "../utils/platformUtils.js";

/**
 * iOS native Geofence plugin (ios/App/App/GeofencePlugin.swift).
 *
 * 비 iOS / 비 native 환경에서는 모든 함수가 no-op.
 */

const isAvailable = () => isIOS && Capacitor.isNativePlatform();

const Geofence = isAvailable() ? registerPlugin("Geofence") : null;

export function isGeofenceAvailable() {
    return !!Geofence;
}

export async function requestGeofencePermission() {
    if (!Geofence) return;
    return Geofence.requestPermission();
}

export async function registerGeofence(todoId, lat, lng, radius = 200) {
    if (!Geofence) return;
    return Geofence.register({ todoId: String(todoId), lat, lng, radius });
}

export async function removeGeofence(todoId) {
    if (!Geofence) return;
    return Geofence.remove({ todoId: String(todoId) });
}

export async function removeAllGeofences() {
    if (!Geofence) return;
    return Geofence.removeAll();
}

export async function getMonitoredGeofences() {
    if (!Geofence) return { ids: [] };
    return Geofence.getMonitored();
}

/**
 * triggerMap + tasks 기반으로 네이티브 geofence 를 전체 동기화.
 * 활성화된 트리거만 등록하고, 나머지는 해제.
 */
export async function syncGeofences(tasks, triggerMap) {
    if (!Geofence) return;

    await removeAllGeofences();

    const promises = tasks
        .filter((t) => t.locationLat && t.locationLng && triggerMap[String(t.id)]?.enabled)
        .map((t) => {
            const trigger = triggerMap[String(t.id)];
            const radius = trigger?.radius ?? 200;
            return registerGeofence(t.id, t.locationLat, t.locationLng, radius);
        });

    await Promise.all(promises);
}
