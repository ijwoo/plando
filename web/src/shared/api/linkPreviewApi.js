import api from "./axiosInstance.js";

// URL → 미리보기 결과 캐시 (중복 요청 방지). null = 미리보기 없음(실패 포함)
const cache = new Map();
const inflight = new Map();

export function getLinkPreview(url) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    if (inflight.has(url)) return inflight.get(url);

    const p = api
        .get("/link-preview", { params: { url } })
        .then((r) => {
            const data = r.data && (r.data.title || r.data.image) ? r.data : null;
            cache.set(url, data);
            inflight.delete(url);
            return data;
        })
        .catch(() => {
            cache.set(url, null);
            inflight.delete(url);
            return null;
        });

    inflight.set(url, p);
    return p;
}
