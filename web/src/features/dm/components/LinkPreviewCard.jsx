import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { getLinkPreview } from "../../../shared/api/linkPreviewApi.js";

/**
 * 메시지 속 첫 URL의 미리보기(unfurl) 카드 — 말풍선 아래 표시.
 * 제목/이미지가 없으면 아무것도 렌더하지 않음(평문 링크만 유지).
 */
const clamp = (lines) => ({
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
});

export default function LinkPreviewCard({ url, isDark, maxWidth = 280 }) {
    const [data, setData] = useState(null);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        let alive = true;
        setData(null);
        setImgError(false);
        getLinkPreview(url).then((d) => { if (alive) setData(d); });
        return () => { alive = false; };
    }, [url]);

    if (!data || (!data.title && !data.image)) return null;

    const showImage = data.image && !imgError;

    return (
        <Box
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{
                display: "block", textDecoration: "none", mt: 0.5, maxWidth,
                borderRadius: 2, overflow: "hidden",
                border: "1px solid", borderColor: "divider",
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                "&:hover": { borderColor: "primary.main" },
            }}
        >
            {showImage && (
                <Box
                    component="img"
                    src={data.image}
                    alt=""
                    onError={() => setImgError(true)}
                    sx={{ width: "100%", maxHeight: 150, objectFit: "cover", display: "block" }}
                />
            )}
            <Box sx={{ px: 1.25, py: 0.875, minWidth: 0 }}>
                {data.siteName && (
                    <Typography sx={{ fontSize: 10.5, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.03em" }} noWrap>
                        {data.siteName}
                    </Typography>
                )}
                {data.title && (
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary", lineHeight: 1.3, mt: 0.125, ...clamp(2) }}>
                        {data.title}
                    </Typography>
                )}
                {data.description && (
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary", lineHeight: 1.4, mt: 0.25, ...clamp(2) }}>
                        {data.description}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}
