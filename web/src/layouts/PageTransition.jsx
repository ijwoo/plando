import React from "react";
import { Box } from "@mui/material";
import { useLocation } from "react-router-dom";

// 내부에서 height:100%를 직접 사용하는 페이지 — minHeight가 아닌 height로 고정
const FIXED_HEIGHT_PATHS = ["/todos", "/calendar", "/map", "/recruitments", "/tasklist"];
// "들어가는" 화면(허브에서 푸시) — 우→좌 슬라이드로 깊이감 표현
const PUSH_PATHS = ["/more", "/settings", "/wrap", "/projects"];

/**
 * 모바일 탭 전환 애니메이션 래퍼.
 * pathname이 바뀔 때마다 key가 교체되어 CSS 키프레임이 재실행된다.
 * - 탭 전환(보드/캘린더 등): fade + 살짝 위로 (가벼움)
 * - 푸시 화면(더보기/설정/회고/프로젝트): 우→좌 슬라이드 (네이티브 푸시 느낌)
 */
export default function PageTransition({ children, sx }) {
    const { pathname } = useLocation();
    const isFixed = FIXED_HEIGHT_PATHS.some((p) => pathname.startsWith(p));
    const isPush = PUSH_PATHS.some((p) => pathname.startsWith(p));

    return (
        <Box
            key={pathname}
            sx={{
                ...(isFixed ? { height: "100%" } : { minHeight: "100%" }),
                display: "flex",
                flexDirection: "column",
                "@keyframes _pageIn": {
                    from: { opacity: 0, transform: "translateY(6px)" },
                    to:   { opacity: 1, transform: "translateY(0)" },
                },
                "@keyframes _pagePush": {
                    from: { opacity: 0.4, transform: "translateX(40px)" },
                    to:   { opacity: 1, transform: "translateX(0)" },
                },
                animation: isPush
                    ? "_pagePush 0.42s cubic-bezier(0.32, 0.72, 0, 1)"
                    : "_pageIn 0.22s ease-out",
                willChange: "opacity, transform",
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}
