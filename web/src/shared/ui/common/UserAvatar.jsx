import React from "react";
import { Avatar } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { resolveImageUrl } from "../../utils/urlUtils.js";

/**
 * 앱 전반에서 사용하는 표준 사용자 아바타.
 * LogSection·CommentSection이 inline으로 들고 있던 톤(primary alpha bg + primary fg + bold initial)을
 * 단일 컴포넌트로 통합. 디테일 패널의 참여자/활동/댓글 모든 아바타가 같은 룩을 갖도록 함.
 *
 * @param {{
 *   name?: string,                // initial 생성용
 *   src?: string,                 // 프로필 이미지 URL (상대 경로면 resolveImageUrl 적용)
 *   size?: number,                // px (default 28)
 *   tone?: "primary" | "muted",   // primary: 본인/액터 / muted: 타인
 *   sx?: object,                  // 추가 sx
 * }} props
 */
export default function UserAvatar({ name, src, size = 28, tone = "primary", sx }) {
    const theme = useTheme();
    const tinted = tone === "muted"
        ? { bg: alpha(theme.palette.text.secondary, 0.12), fg: theme.palette.text.secondary }
        : { bg: alpha(theme.palette.primary.main, 0.15), fg: theme.palette.primary.main };

    const initial = (String(name ?? "").trim().charAt(0) || "?").toUpperCase();
    const resolvedSrc = src ? resolveImageUrl(src) : undefined;

    return (
        <Avatar
            src={resolvedSrc}
            sx={{
                width: size,
                height: size,
                fontSize: Math.max(10, Math.round(size * 0.45)),
                fontWeight: 800,
                flexShrink: 0,
                bgcolor: tinted.bg,
                color: tinted.fg,
                ...sx,
            }}
        >
            {initial}
        </Avatar>
    );
}
