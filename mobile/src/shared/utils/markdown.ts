/**
 * 마크다운 → 순수 텍스트 (웹 stripMarkdown 미러).
 * 웹 앱이 할 일 본문을 마크다운 문자열로 저장하므로, 미리보기 줄에서
 * `**굵게**`·`# 제목`·`- 목록` 같은 문법이 그대로 노출되지 않게 벗겨낸다.
 */
export function stripMarkdown(md?: string | null): string {
  if (!md) return '';
  return (
    md
      // 코드블록·인라인 코드
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      // 이미지 ![alt](url) → alt, 링크 [text](url) → text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 헤딩/인용/리스트 마커 (줄 시작)
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/^\s{0,3}\d+\.\s+/gm, '')
      // 강조 **bold** *italic* ~~strike~~
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      // 수평선
      .replace(/^\s{0,3}([-*_]\s?){3,}$/gm, '')
      // 연속 공백 정리
      .replace(/\n{2,}/g, '\n')
      .trim()
  );
}
