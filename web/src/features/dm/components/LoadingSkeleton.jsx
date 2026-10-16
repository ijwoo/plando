import React from "react";
import { Box, Skeleton } from "@mui/material";

export default function LoadingSkeleton() {
    return (
        <Box sx={{ px: 2, py: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {[0, 1, 2, 3, 4].map((i) => (
                <Box
                    key={i}
                    sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "flex-end",
                        justifyContent: i % 3 === 2 ? "flex-end" : "flex-start",
                    }}
                >
                    {i % 3 !== 2 && <Skeleton variant="circular" width={32} height={32} />}
                    <Skeleton
                        variant="rounded"
                        width={80 + (i * 37) % 120}
                        height={38}
                        sx={{ borderRadius: 2.5 }}
                    />
                </Box>
            ))}
        </Box>
    );
}