import React from "react";
import { Alert, Box } from "@mui/material";

/**
 * 워크스페이스 접근 권한 없음(403) 안내 배너.
 * 401과 달리 세션은 유효하므로 로그아웃하지 않고 이 배너로만 알린다
 * (진행 중이던 입력·화면 상태 보존). message가 없으면 아무것도 렌더하지 않는다.
 */
export default function AccessErrorBanner({ message, sx }) {
    if (!message) return null;
    return (
        <Box sx={{ px: { xs: 1.5, md: 3 }, pt: 1.5, flexShrink: 0, ...sx }}>
            <Alert severity="warning" sx={{ borderRadius: "var(--plando-radius-md)", fontSize: 13 }}>
                {message}
            </Alert>
        </Box>
    );
}
