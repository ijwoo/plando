import React from "react";
import { Avatar, Box, Stack } from "@mui/material";
import { resolveImageUrl } from "../../utils/urlUtils.js";
import { getAvatarTone } from "../../utils/avatarUtils.js";

/**
 * 담당자 아바타 stack (overlap). 토스 톤 — Phase 12+ 데스크탑 컴포넌트 공통.
 *
 * Props:
 *   assignees: Array<string | { name, email, profileImageUrl }>
 *   size: 아바타 px (기본 24)
 *   max: 최대 노출 수 (기본 3). 초과 시 "+N" 배지
 *   overlap: 음수 marginLeft 픽셀 (기본 -7)
 *
 * 사용처: TaskRow (Phase 13), BoardCard (Phase 14+), TodayFocusHero 등
 */
export default function AssigneeStack({ assignees = [], size = 24, max = 3, overlap = -7 }) {
    const visible = assignees.slice(0, max);
    const extra = assignees.length - visible.length;
    return (
        <Stack direction="row" alignItems="center">
            {visible.map((a, i) => {
                const name = typeof a === "string" ? a : (a?.name || a?.email || "");
                const src = typeof a === "object" && a?.profileImageUrl
                    ? resolveImageUrl(a.profileImageUrl)
                    : undefined;
                const tone = getAvatarTone(name);
                return (
                    <Avatar
                        key={i}
                        src={src}
                        sx={{
                            width: size,
                            height: size,
                            fontSize: Math.round(size * 0.46),
                            fontWeight: 800,
                            marginLeft: i === 0 ? 0 : `${overlap}px`,
                            border: "2px solid",
                            borderColor: "background.paper",
                            bgcolor: tone.bg,
                            color: tone.color,
                        }}
                    >
                        {name?.charAt?.(0) || "?"}
                    </Avatar>
                );
            })}
            {extra > 0 && (
                <Box
                    sx={{
                        marginLeft: `${overlap}px`,
                        width: size,
                        height: size,
                        borderRadius: 999,
                        bgcolor: "background.paper",
                        color: "text.disabled",
                        fontSize: Math.round(size * 0.42),
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    +{extra}
                </Box>
            )}
        </Stack>
    );
}
