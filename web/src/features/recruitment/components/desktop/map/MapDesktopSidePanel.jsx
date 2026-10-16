import React, { useEffect, useRef } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PostCard from "../../list/PostCard";
import { SHADOW } from "../../common/recruitmentSx";

/**
 * MapDesktopSidePanel — 데스크탑 풀스크린 지도뷰 우측 사이드 패널
 *
 * 모바일 MapBottomSheet과 같은 패턴이지만 데스크탑은 큰 화면이라
 * 바텀시트 대신 우측 고정 패널로 — 360px width, 세로 스크롤.
 *
 * 표시 데이터는 부모가 bbox로 필터한 `visibleItems`.
 * 선택된 핀이 있으면 자동으로 해당 카드로 스크롤.
 */
export default function MapDesktopSidePanel({
    items,
    selected,
    onSelect,
    onDetail,
    onBookmark,
}) {
    const theme = useTheme();
    const listRef = useRef(null);

    // selected 변경 시 해당 카드로 스크롤
    useEffect(() => {
        if (!selected || !listRef.current) return;
        const card = listRef.current.querySelector(`[data-card-id="${selected.id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Box sx={{
            width: 360,
            flexShrink: 0,
            bgcolor: "background.paper",
            boxShadow: SHADOW.card,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 2,
        }}>
            {/* 헤더 */}
            <Box sx={{
                px: 2.5,
                py: 1.875,
                borderBottom: "1px solid",
                borderColor: alpha(theme.palette.text.primary, 0.06),
                flexShrink: 0,
            }}>
                <Typography sx={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "text.disabled",
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    mb: 0.5,
                }}>
                    이 지역
                </Typography>
                <Stack direction="row" alignItems="baseline" gap={0.625}>
                    <Typography sx={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "text.primary",
                        letterSpacing: "-0.025em",
                    }}>
                        {items.length}개
                    </Typography>
                    <Typography sx={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "text.secondary",
                    }}>
                        의 모집
                    </Typography>
                </Stack>
                <Typography sx={{
                    fontSize: 11.5,
                    color: "text.disabled",
                    fontWeight: 500,
                    mt: 0.5,
                }}>
                    지도를 움직이면 결과가 갱신돼요
                </Typography>
            </Box>

            {/* 리스트 */}
            <Box
                ref={listRef}
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: 0.5,
                    scrollbarWidth: "thin",
                    "&::-webkit-scrollbar": { width: 6 },
                    "&::-webkit-scrollbar-thumb": {
                        bgcolor: alpha(theme.palette.text.primary, 0.10),
                        borderRadius: 99,
                    },
                }}
            >
                {items.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: "center" }}>
                        <Box sx={{
                            width: 48, height: 48,
                            borderRadius: 1.75,
                            bgcolor: alpha(theme.palette.text.primary, 0.04),
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                            mb: 1.25,
                        }}>
                            📍
                        </Box>
                        <Typography sx={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: "text.primary",
                        }}>
                            이 지역에 모집이 없어요
                        </Typography>
                        <Typography sx={{
                            fontSize: 12,
                            color: "text.disabled",
                            mt: 0.5,
                        }}>
                            지도를 다른 지역으로 옮겨보세요
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={1.5}>
                        {items.map((item) => {
                            const isSel = selected?.id === item.id;
                            return (
                                <Box
                                    key={item.id}
                                    data-card-id={item.id}
                                    onClick={() => {
                                        if (isSel) onDetail?.(item);
                                        else onSelect?.(item);
                                    }}
                                    sx={isSel ? {
                                        borderRadius: 1.75,
                                        outline: "2px solid",
                                        outlineColor: "primary.main",
                                        outlineOffset: -2,
                                    } : {}}
                                >
                                    <PostCard
                                        compact
                                        item={item}
                                        onDetail={null}
                                        onBookmark={onBookmark}
                                    />
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </Box>
        </Box>
    );
}
