/**
 * 이름 문자열을 기반으로 아바타 배경/글자 색상을 결정합니다.
 * 같은 이름은 항상 같은 색상을 반환합니다.
 *
 * @param {string} name
 * @returns {{ bg: string, color: string }}
 */
export function getAvatarTone(name = "") {
    const tones = [
        { bg: "#E8F0FE", color: "#2563EB" },
        { bg: "#EEF2FF", color: "#4F46E5" },
        { bg: "#ECFDF5", color: "#059669" },
        { bg: "#FFF7ED", color: "#EA580C" },
        { bg: "#F5F3FF", color: "#7C3AED" },
        { bg: "#FCE7F3", color: "#DB2777" },
    ];
    const seed = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return tones[seed % tones.length];
}
