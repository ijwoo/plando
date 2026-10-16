import React from "react";
import { Box } from "@mui/material";

/**
 * 월/주/일 뷰 토글 세그먼트 컨트롤 (iOS 스타일).
 *
 * @param {{
 *   value: string,
 *   onChange: (key: string) => void,
 *   options: Array<{ key: string, label: string }>,
 * }} props
 */
export default function ViewSegmentControl({ value, onChange, options }) {
    return (
        <Box sx={{
            display: "flex",
            bgcolor: "var(--plando-surface-low)",
            borderRadius: "var(--plando-radius-sm)",
            p: "2px",
        }}>
            {options.map((opt) => {
                const active = value === opt.key;
                return (
                    <Box
                        key={opt.key}
                        onClick={() => onChange(opt.key)}
                        sx={{
                            px: 1.25, py: 0.375,
                            borderRadius: "6px",
                            fontSize: 12, fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.12s",
                            bgcolor: active ? "var(--plando-surface)" : "transparent",
                            color: active ? "text.primary" : "text.secondary",
                            boxShadow: active ? "var(--plando-elev-2)" : "none",
                        }}
                    >
                        {opt.label}
                    </Box>
                );
            })}
        </Box>
    );
}
