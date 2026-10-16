import React from "react";
import { Box, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Press from "../../../../shared/ui/primitives/Press.jsx";

const ICONS = {
    list: (color) => (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
    ),
    kanban: (color) => (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2.5" y="3" width="3.5" height="10" rx="1" stroke={color} strokeWidth="1.6" />
            <rect x="7.5" y="3" width="3.5" height="6.5" rx="1" stroke={color} strokeWidth="1.6" />
            <rect x="12.5" y="3" width="1.5" height="8" rx="0.7" stroke={color} strokeWidth="1.4" />
        </svg>
    ),
};

/**
 * list ↔ kanban 작은 토글. 활성 옵션은 흰 배경 pill.
 *
 * Props:
 *   value: "list" | "kanban"
 *   onChange: (v) => void
 */
export default function TodoViewToggle({ value, onChange }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const trackBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
    const activeBg = isDark ? theme.palette.background.paper : "#fff";
    const activeColor = theme.palette.text.primary;
    const inactiveColor = theme.palette.text.disabled;

    const options = [
        { id: "list" },
        { id: "kanban" },
    ];

    return (
        <Stack
            direction="row"
            sx={{
                display: "inline-flex",
                bgcolor: trackBg,
                borderRadius: 999,
                p: "3px",
                gap: 0,
            }}
        >
            {options.map((o) => {
                const active = o.id === value;
                return (
                    <Press
                        key={o.id}
                        onClick={() => onChange?.(o.id)}
                        haptic="light"
                        pressScale={0.92}
                        style={{
                            width: 32,
                            height: 28,
                            borderRadius: 999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: active ? activeBg : "transparent",
                            boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                            transition: "background 200ms, box-shadow 200ms",
                        }}
                    >
                        {ICONS[o.id](active ? activeColor : inactiveColor)}
                    </Press>
                );
            })}
        </Stack>
    );
}
