/**
 * Capacitor Geolocation 우선, 웹 브라우저 fallback
 * - 앱(iOS/Android): Capacitor plugin 사용 → 네이티브 권한 프롬프트
 * - 웹: navigator.geolocation 사용
 */

function isCapacitor() {
    return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
}

/**
 * 현재 위치 한 번 가져오기
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export async function getCurrentPosition(options = {}) {
    const opts = { enableHighAccuracy: true, timeout: 15000, ...options };

    if (isCapacitor()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: opts.enableHighAccuracy, timeout: opts.timeout });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }

    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            reject,
            opts
        );
    });
}

/**
 * 위치 지속 감시 (watchPosition)
 * @returns {Function} clearWatch 함수
 */
export function watchPosition(onSuccess, onError, options = {}) {
    const opts = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000, ...options };

    if (isCapacitor()) {
        // watchId 는 비동기 then 안에서 세팅되므로 cleanup 이 그 전에 호출되면
        // watchId=null 인 채로 빠져나가 GPS watch 가 누수됨.
        // cleaned 플래그로 cleanup 의도를 기억하고, watchId 가 늦게 도착하더라도 즉시 clearWatch.
        let watchId = null;
        let cleaned = false;
        import("@capacitor/geolocation").then(({ Geolocation }) => {
            Geolocation.requestPermissions().then(() => {
                Geolocation.watchPosition(
                    { enableHighAccuracy: opts.enableHighAccuracy, timeout: opts.timeout },
                    (pos, err) => {
                        if (err) { onError?.(err); return; }
                        onSuccess({
                            coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
                        });
                    }
                ).then((id) => {
                    if (cleaned) {
                        Geolocation.clearWatch({ id });
                    } else {
                        watchId = id;
                    }
                });
            });
        });
        return () => {
            cleaned = true;
            if (watchId != null) {
                import("@capacitor/geolocation").then(({ Geolocation }) => {
                    Geolocation.clearWatch({ id: watchId });
                });
            }
        };
    }

    if (!navigator.geolocation) return () => {};
    const id = navigator.geolocation.watchPosition(onSuccess, onError, opts);
    return () => navigator.geolocation.clearWatch(id);
}
