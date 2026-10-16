import React from "react";
import { Box } from "@mui/material";

export default function SegmentedControl({ options, value, onChange, fullWidth = false, sx }) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "stretch",
                bgcolor: "var(--plando-gray-soft)",
                borderRadius: "10px",
                p: "3px",
                gap: "2px",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
                ...sx,
            }}
        >
            {options.map((opt) => {
                const selected = value === opt.value;
                return (
                    <Box
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        sx={{
                            ...(fullWidth
                                ? { flex: 1, textAlign: "center" }
                                : { px: "12px", flexShrink: 0 }),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            py: "5px",
                            borderRadius: "8px",
                            fontWeight: selected ? 700 : 500,
                            fontSize: 12,
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                            cursor: "pointer",
                            userSelect: "none",
                            transition: "background 0.15s, box-shadow 0.15s, color 0.15s",
                            bgcolor: selected ? "var(--plando-surface)" : "transparent",
                            color: selected ? "var(--plando-primary)" : "var(--plando-text-secondary)",
                            boxShadow: selected ? "var(--plando-shadow-card)" : "none",
                        }}
                    >
                        {opt.label}
                    </Box>
                );
            })}
        </Box>
    );
}
