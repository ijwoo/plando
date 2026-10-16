// 본문에서 첫 http(s) 링크 추출 / 링크 끝 문장부호 제거 (메시지 링크화·미리보기 공용)
export const URL_REGEX = /(https?:\/\/[^\s<]+)/;
const TRAILING_PUNCT = /[.,!?;:)\]}'"]+$/;

export function stripTrailingPunct(url) {
    return url ? url.replace(TRAILING_PUNCT, "") : url;
}

export function extractFirstUrl(text) {
    if (!text) return null;
    const m = text.match(URL_REGEX);
    return m ? stripTrailingPunct(m[1]) : null;
}

export function resolveImageUrl(url, bustCache = false) {
    if (!url) return undefined;
    // 이미 절대 URL이거나 로컬 미리보기(blob:/data:)면 그대로 — base 붙이면 깨짐
    const isAbsolute = /^(https?:|blob:|data:)/.test(url);
    const base = isAbsolute ? url : `${import.meta.env.VITE_API_BASE_URL ?? ""}${url}`;
    return bustCache ? `${base}?t=${Date.now()}` : base;
}
