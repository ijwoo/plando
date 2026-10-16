import React, { useMemo } from "react";
import { Avatar, Box, Paper, Popper, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Z } from "../zIndex.js";
import { resolveImageUrl } from "../../utils/urlUtils.js";

/**
 * 공통 @멘션 자동완성 picker. 댓글(`CommentSection`)과 DM(`DmInputBar`)이 같은 컴포넌트를 사용.
 *
 * 부모는 다음 책임:
 *  - 텍스트 입력에서 `@` 감지 + query(쿼리 텍스트) state 관리
 *  - members(후보 사용자 배열) 공급 — `{ userId, email, name, profileImageUrl }` 형태
 *  - onSelect(name) 콜백에서 입력창 텍스트 치환
 *  - anchorEl 으로 Popper 위치 기준 elem 전달 (보통 입력창 ref.current)
 *
 * 멘션 식별자 규칙: name(공백 trim) 있으면 name, 없으면 email local-part.
 * 백엔드 `MentionExtractor` 의 displayName 규칙과 일치해야 매칭됨.
 */
export default function MentionPicker({ members, query, onSelect, anchorEl, placement = "top-start" }) {
    const theme = useTheme();
    const getMentionName = (m) => m.name?.trim() || (m.email ? m.email.split("@")[0] : "");

    const filtered = useMemo(() => {
        const list = Array.isArray(members) ? members : [];
        const q = (query ?? "").toLowerCase();
        return list
            .filter((m) => getMentionName(m).toLowerCase().includes(q))
            .slice(0, 6);
    }, [members, query]);

    if (filtered.length === 0 || !anchorEl || query == null) return null;

    return (
        <Popper
            open
            anchorEl={anchorEl}
            placement={placement}
            style={{ zIndex: Z.MODAL_NESTED, width: anchorEl?.offsetWidth ?? 280 }}
        >
            <Paper
                elevation={8}
                sx={{
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    overflow: "hidden",
                    maxHeight: 220,
                    overflowY: "auto",
                    mb: 0.5,
                }}
            >
                {filtered.map((m) => {
                    const mentionName = getMentionName(m);
                    const hasName = !!m.name?.trim();
                    return (
                        <Box
                            key={m.userId ?? m.email}
                            onMouseDown={(e) => { e.preventDefault(); onSelect?.(mentionName); }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                                px: 1.75,
                                py: 1,
                                cursor: "pointer",
                                "&:hover": { bgcolor: "action.hover" },
                            }}
                        >
                            <Avatar
                                src={m.profileImageUrl ? resolveImageUrl(m.profileImageUrl) : undefined}
                                sx={{
                                    width: 26, height: 26, fontSize: 11, fontWeight: 800,
                                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                                    color: "primary.main",
                                }}
                            >
                                {mentionName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                                    {mentionName}
                                </Typography>
                                {!hasName && (
                                    <Typography sx={{ fontSize: 10, color: "warning.main" }}>이름 미설정</Typography>
                                )}
                                <Typography sx={{ fontSize: 11, color: "text.disabled" }}>{m.email}</Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Paper>
        </Popper>
    );
}
