let kakaoSdkPromise = null;

export function loadKakaoSdk() {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("window is not available"));
    }

    if (window.Kakao) {
        return Promise.resolve(window.Kakao);
    }

    if (kakaoSdkPromise) {
        return kakaoSdkPromise;
    }

    kakaoSdkPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-kakao-sdk="true"]');
        if (existing) {
            existing.addEventListener("load", () => resolve(window.Kakao));
            existing.addEventListener("error", reject);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://developers.kakao.com/sdk/js/kakao.min.js";
        script.async = true;
        script.defer = true;
        script.dataset.kakaoSdk = "true";

        script.onload = () => {
            if (window.Kakao) resolve(window.Kakao);
            else reject(new Error("Kakao SDK loaded but window.Kakao is missing"));
        };

        script.onerror = () => reject(new Error("Failed to load Kakao SDK"));
        document.head.appendChild(script);
    });

    return kakaoSdkPromise;
}

export async function initKakaoSdk() {
    const Kakao = await loadKakaoSdk();
    const jsKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;

    if (!jsKey) {
        throw new Error("VITE_KAKAO_JAVASCRIPT_KEY is missing");
    }

    if (!Kakao.isInitialized()) {
        Kakao.init(jsKey);
    }

    return Kakao;
}