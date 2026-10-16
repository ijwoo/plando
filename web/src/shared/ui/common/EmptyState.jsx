import React from "react";
import { Box, Stack, Typography } from "@mui/material";

import HeaderActionButton from "./HeaderActionButton.jsx";

/**
 * 빈 상태 공용 프리미티브.
 *
 * 왜 만들었나: 앱 전체에 빈 상태가 ~135곳 있는데 아이콘+헤드라인+설명+CTA를 다 갖춘 건 9곳뿐이고,
 * 나머지는 맨 텍스트 한 줄이거나 아예 아무것도 안 그렸다(26곳). 화면마다 자체 헬퍼를 만든 탓에
 * 이모지·문체("없음" vs "없어요")·간격이 제각각으로 드리프트했다.
 *
 * 좋은 빈 상태의 조건 — 이 컴포넌트가 강제하는 것:
 *  1) **왜 비었는지** 알려준다 (title)
 *  2) **어떻게 채우는지** 알려준다 (desc)
 *  3) 가능하면 **바로 채울 수단**을 준다 (action)
 * 문체는 "~어요"체로 통일한다(앱 전반 톤).
 *
 * ⚠️ 로딩 중에는 이걸 띄우지 말 것. 데이터가 []로 시작하는 화면에서 그대로 쓰면
 * 진입할 때마다 빈 상태가 번쩍인다. 반드시 `loaded && items.length === 0` 형태로 감쌀 것.
 */
export default function EmptyState({
    /** 이모지 한 글자. 아이콘 컴포넌트를 쓰려면 icon 사용 */
    emoji,
    /** MUI 아이콘 엘리먼트 (emoji 대신) */
    icon,
    title,
    desc,
    /** 문자열이면 기본 버튼으로, 엘리먼트면 그대로 렌더 */
    action,
    onAction,
    /** sm = 카드/섹션 안, md = 화면 전체 */
    size = "md",
    sx,
}) {
    const compact = size === "sm";

    return (
        <Stack
            alignItems="center"
            justifyContent="center"
            spacing={compact ? 0.75 : 1.25}
            sx={{
                textAlign: "center",
                px: 2,
                py: compact ? 3 : 6,
                ...sx,
            }}
        >
            {icon ? (
                <Box
                    sx={{
                        width: compact ? 40 : 52,
                        height: compact ? 40 : 52,
                        borderRadius: "var(--plando-radius-md)",
                        bgcolor: "var(--plando-primary-soft)",
                        color: "primary.main",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 0.25,
                    }}
                >
                    {icon}
                </Box>
            ) : emoji ? (
                <Box sx={{ fontSize: compact ? 28 : 40, lineHeight: 1 }}>{emoji}</Box>
            ) : null}

            {title && (
                <Typography
                    sx={{
                        fontSize: compact ? 14 : 16,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "text.primary",
                    }}
                >
                    {title}
                </Typography>
            )}

            {desc && (
                <Typography
                    sx={{
                        fontSize: compact ? 12.5 : 13,
                        fontWeight: 500,
                        color: "text.secondary",
                        lineHeight: 1.6,
                        maxWidth: 320,
                    }}
                >
                    {desc}
                </Typography>
            )}

            {action && (
                <Box sx={{ mt: compact ? 0.5 : 1 }}>
                    {typeof action === "string" ? (
                        <HeaderActionButton variant="ghost" onClick={onAction}>
                            {action}
                        </HeaderActionButton>
                    ) : (
                        action
                    )}
                </Box>
            )}
        </Stack>
    );
}
