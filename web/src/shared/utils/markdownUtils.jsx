import React from "react";
import { stripTrailingPunct } from "./urlUtils.js";

/**
 * TipTap(tiptap-markdown)이 본문 저장 시 `<`·`>`를 &lt;·&gt;로 이스케이프해 둔 것을
 * 표시용으로 복원. WYSIWYG 에디터는 markdown-it로 되돌리지만, 카드 프리뷰·경량 렌더러는
 * 원문을 그대로 그려 &lt; 같은 엔티티가 노출됐다.
 */
export function decodeEntities(text) {
    if (!text) return text;
    return String(text)
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&"); // &amp;는 마지막에 (이중 디코드 방지)
}

/**
 * 미리보기용 — 마크다운 기호를 제거해 순수 텍스트로. (카드/리스트 본문 한두 줄 미리보기)
 * 굵게/기울임/취소선/코드/링크/제목/인용/목록 마커 제거.
 */
export function stripMarkdown(text) {
    if (!text) return "";
    return decodeEntities(String(text))
        .replace(/```[\s\S]*?```/g, " ")          // 코드 블록
        .replace(/`([^`]+)`/g, "$1")              // 인라인 코드
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")     // 이미지
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")   // 링크 → 텍스트
        .replace(/(\*\*|__)(.*?)\1/g, "$2")        // 굵게
        .replace(/(\*|_)(.*?)\1/g, "$2")           // 기울임
        .replace(/~~(.*?)~~/g, "$1")               // 취소선
        .replace(/^\s{0,3}#{1,6}\s+/gm, "")         // 제목
        .replace(/^\s{0,3}>\s?/gm, "")              // 인용
        .replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm, " ") // 구분선(---, ***, ___) — 슬래시 에디터 HR
        .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, "")  // 목록 마커
        .replace(/\n{2,}/g, "\n")
        .trim();
}

/**
 * 간단한 인라인 마크다운 렌더러
 * **bold** → <strong>, *italic* → <em>, http(s) 링크 → <a>, 줄바꿈 → <br>
 *
 * 링크 색은 `inherit`(밑줄)로 둬서 파란 내 버블/상대 버블 어디서나 읽히게 한다.
 *
 * @param {string|null} text
 * @returns {React.ReactNode[]|null}
 */
export function renderMarkdown(rawText) {
    if (!rawText) return null;
    const text = decodeEntities(rawText);
    const parts = [];
    // 순서 중요: bold(**) 먼저, italic(*), 그 다음 URL
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(https?:\/\/[^\s<]+)/gs;
    let last = 0;
    let match;
    let key = 0;
    const pushText = (str) => {
        parts.push(
            ...str
                .split("\n")
                .flatMap((s, i) => (i === 0 ? [s] : [<br key={key++} />, s]))
        );
    };
    while ((match = regex.exec(text)) !== null) {
        if (match.index > last) {
            pushText(text.slice(last, match.index));
        }
        if (match[1]) {
            parts.push(<strong key={key++}>{match[2]}</strong>);
        } else if (match[3]) {
            parts.push(<em key={key++}>{match[4]}</em>);
        } else if (match[5]) {
            const raw = match[5];
            const url = stripTrailingPunct(raw);
            const tail = raw.slice(url.length);
            parts.push(
                <a
                    key={key++}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "inherit", textDecoration: "underline", wordBreak: "break-all" }}
                >
                    {url}
                </a>
            );
            if (tail) pushText(tail);
        }
        last = match.index + match[0].length;
    }
    if (last < text.length) {
        pushText(text.slice(last));
    }
    return parts;
}
