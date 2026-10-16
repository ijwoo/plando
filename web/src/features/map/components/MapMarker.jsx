import React from "react";
import { Box } from "@mui/material";

/**
 * 카카오맵 CustomOverlayMap 안에 들어가는 마커 핀
 * position 은 CustomOverlayMap 이 처리하므로 여기선 시각적 요소만
 */
export default function MapMarker({ color, selected, onClick }) {
    return (
        <Box
            onClick={onClick}
            sx={{
                position: "relative",
                cursor: "pointer",
                width: selected ? 28 : 22,
                height: selected ? 28 : 22,
                transition: "width 0.15s ease, height 0.15s ease",
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50% 50% 50% 0",
                    transform: selected ? "rotate(-45deg) scale(1.1)" : "rotate(-45deg)",
                    bgcolor: color,
                    boxShadow: selected
                        ? "0 8px 20px rgba(0,0,0,0.35)"
                        : "0 4px 12px rgba(0,0,0,0.28)",
                    border: "3px solid rgba(255,255,255,0.96)",
                    transition: "transform 0.15s ease",
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: "#fff",
                    pointerEvents: "none",
                }}
            />
        </Box>
    );
}
