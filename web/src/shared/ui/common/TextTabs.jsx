import React, { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import Press from "../primitives/Press.jsx";
import { hideScrollbarSx } from "../glassSx.js";

/**
 * Toss 스타일 underline 텍스트 탭.
 * 활성 탭 아래 굵은 막대가 부드럽게 슬라이드.
 *
 * Props:
 *   tabs: [{ id, label, count? }]
 *   value: 활성 tab id
 *   onChange: (id) => void
 */
export default function TextTabs({ tabs, value, onChange }) {
    const refs = useRef({});
    const containerRef = useRef(null);
    const [bar, setBar] = useState({ left: 0, width: 0 });

    useEffect(() => {
        const el = refs.current[value];
        const container = containerRef.current;
        if (!el || !container) return;

        // getBoundingClientRect는 viewport 기준이라 스크롤된 양만큼 보정.
        // (offsetLeft 사용도 가능하나 motion.div/MUI 합성에서 offsetParent 의도와
        // 다르게 잡히는 경우가 있어 명시적 계산이 더 안전.)
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setBar({
            left: elRect.left - containerRect.left + container.scrollLeft,
            width: elRect.width,
        });
    }, [value, tabs]);

    return (
        <Box
            ref={containerRef}
            sx={{
                display: "flex",
                alignItems: "flex-end",
                gap: 0,
                px: 2,
                position: "relative",
                overflowX: "auto",
                ...hideScrollbarSx,
            }}
        >
            {tabs.map((t) => {
                const isActive = value === t.id;
                return (
                    <Press
                        key={t.id}
                        onClick={() => onChange?.(t.id)}
                        haptic="light"
                        pressScale={0.96}
                        style={{
                            padding: "12px 0",
                            marginRight: 24,
                            display: "flex",
                            alignItems: "baseline",
                            gap: 4,
                            flexShrink: 0,
                        }}
                    >
                        <Box
                            ref={(el) => { refs.current[t.id] = el; }}
                            sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}
                        >
                            <Typography
                                sx={{
                                    fontSize: "var(--plando-type-title3-size)",
                                    fontWeight: 700,
                                    color: isActive ? "text.primary" : "text.disabled",
                                    letterSpacing: "-0.01em",
                                    whiteSpace: "nowrap",
                                    transition: "color 180ms",
                                }}
                            >
                                {t.label}
                            </Typography>
                            {t.count != null && (
                                <Typography
                                    sx={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: isActive ? "primary.main" : "text.disabled",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    {t.count}
                                </Typography>
                            )}
                        </Box>
                    </Press>
                );
            })}

            {/* Animated underline */}
            <Box
                sx={{
                    position: "absolute",
                    bottom: 0,
                    left: bar.left,
                    width: bar.width,
                    height: 2.5,
                    borderRadius: 999,
                    bgcolor: "text.primary",
                    transition: "left 280ms cubic-bezier(0.2,0.8,0.2,1), width 280ms cubic-bezier(0.2,0.8,0.2,1)",
                    pointerEvents: "none",
                }}
            />
        </Box>
    );
}
