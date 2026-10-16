import React from "react";
import { useTheme } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Press from "../primitives/Press.jsx";

/**
 * 원형 체크박스 (Toss 스타일).
 * - 체크 시: accent 색으로 채워진 원
 * - 미체크: 테두리만 (divider 색)
 * - Press wrapper로 햅틱 + scale 피드백
 *
 * Props:
 *   checked: bool
 *   onToggle: () => void
 *   size: number (기본 22). dashboard용 22, todo용 28
 *   accent: 색 override (기본 theme primary)
 *   disabled: bool
 */
export default function CircleCheckbox({
    checked,
    onToggle,
    size = 22,
    accent,
    disabled = false,
}) {
    const theme = useTheme();
    const fill = accent || theme.palette.primary.main;
    const borderColor = theme.palette.divider;
    const borderWidth = size >= 26 ? 2 : 2;
    const iconSize = Math.round(size * 0.55);

    return (
        <Press
            onClick={(e) => {
                e?.stopPropagation?.();
                if (!disabled) onToggle?.();
            }}
            haptic={checked ? "light" : "medium"}
            pressScale={0.85}
            disabled={disabled}
            style={{
                width: size,
                height: size,
                borderRadius: size,
                border: checked ? "none" : `${borderWidth}px solid ${borderColor}`,
                background: checked ? fill : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxSizing: "border-box",
                transition: "background 200ms cubic-bezier(0.2,0.8,0.2,1), border-color 200ms",
            }}
        >
            {checked && <CheckRoundedIcon sx={{ fontSize: iconSize, color: "#fff", strokeWidth: 2 }} />}
        </Press>
    );
}
