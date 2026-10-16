import React, { useEffect, useRef } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Z } from "../../../../shared/ui/zIndex.js";
import { getCategory } from "../../utils/recruitmentUtils";
import RecruitmentCard from "../list/RecruitmentCard";
import { hideScrollbarSx } from "../../../../shared/ui/glassSx.js";
import { SHADOW } from "../common/recruitmentSx";

// 지도 바텀시트 snap 단계별 높이(%) — RecruitmentListMobile / CreateFab에서도 사용
export const SNAP_H = { peek: 22, half: 50, full: 90 };

export default function MapBottomSheet({
    items,
    selected,
    onSelect,
    onDetail,
    onBookmark,
    snap,
    onSnap,
}) {
    const theme = useTheme();
    const dragStartY = useRef(0);
    const listRef = useRef(null);

    // snap이 half/full로 바뀌거나 selected가 바뀔 때 해당 카드로 스크롤
    useEffect(() => {
        if (snap === "peek" || !selected || !listRef.current) return;
        const card = listRef.current.querySelector(`[data-card-id="${selected.id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [snap, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const onDragStart = (e) => { dragStartY.current = e.touches[0].clientY; };
    const onDragEnd = (e) => {
        const delta = dragStartY.current - e.changedTouches[0].clientY;
        if (delta > 30) {
            if (snap === "peek") onSnap("half");
            else if (snap === "half") onSnap("full");
        } else if (delta < -30) {
            if (snap === "full") onSnap("half");
            else if (snap === "half") onSnap("peek");
        }
    };

    const h = SNAP_H[snap] ?? 50;
    const primary = theme.palette.primary.main;

    return (
        <Box sx={{
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            height: `${h}%`,
            zIndex: Z.FAB,
            bgcolor: "background.paper",
            borderRadius: "20px 20px 0 0",
            boxShadow: SHADOW.lift,
            border: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "height 0.35s cubic-bezier(0.32,0.72,0,1)",
        }}>
            {/* 드래그 영역 */}
            <Box
                onTouchStart={onDragStart}
                onTouchEnd={onDragEnd}
                sx={{
                    flexShrink: 0,
                    cursor: "grab",
                    userSelect: "none",
                    pt: 1.25,
                    px: 2,
                    pb: 1.25,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                }}
            >
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Box sx={{
                        width: 40, height: 4,
                        borderRadius: 99,
                        bgcolor: alpha(theme.palette.text.primary, 0.18),
                    }} />
                </Box>
                <Typography sx={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "text.primary",
                    letterSpacing: "-0.015em",
                }}>
                    이 지역 {items.length}개 모집
                </Typography>
            </Box>

            {/* PEEK: 수평 슬라이드 캐러셀 */}
            {snap === "peek" && (
                <Box sx={{
                    flex: 1,
                    display: "flex",
                    gap: "10px",
                    pl: "max(20px, calc(env(safe-area-inset-left, 0px) + 20px))",
                    pr: "max(20px, calc(env(safe-area-inset-right, 0px) + 20px))",
                    pb: 1.5,
                    overflowX: "auto",
                    overflowY: "hidden",
                    scrollSnapType: "x mandatory",
                    scrollPaddingLeft: "max(20px, calc(env(safe-area-inset-left, 0px) + 20px))",
                    alignItems: "stretch",
                    ...hideScrollbarSx,
                }}>
                    {items.length === 0 ? (
                        <Box sx={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Typography variant="caption" color="text.disabled">
                                이 지역에 모집이 없어요
                            </Typography>
                        </Box>
                    ) : items.map((item) => {
                        const cat = getCategory(item.typeLabel, theme);
                        const isSel = selected?.id === item.id;
                        return (
                            <Box
                                key={item.id}
                                onClick={() => {
                                    if (isSel) onDetail?.(item);
                                    else { onSelect(item); onSnap("half"); }
                                }}
                                sx={{
                                    flexShrink: 0,
                                    width: "calc(75% - 5px)",
                                    scrollSnapAlign: "start",
                                    borderRadius: 1.5,
                                    border: 0,
                                    px: 1.5,
                                    py: 1.25,
                                    cursor: "pointer",
                                    bgcolor: isSel
                                        ? alpha(primary, 0.08)
                                        : alpha(theme.palette.text.primary, 0.03),
                                    boxShadow: isSel
                                        ? `0 0 0 1.5px ${primary}`
                                        : "none",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    overflow: "hidden",
                                    minHeight: 0,
                                }}
                            >
                                {/* 1행: 카테고리 배지 + 제목 */}
                                <Stack direction="row" spacing={0.875} alignItems="center" sx={{ overflow: "hidden" }}>
                                    <Box sx={{
                                        fontSize: 9.5,
                                        fontWeight: 600,
                                        flexShrink: 0,
                                        color: cat.color,
                                        bgcolor: alpha(cat.color, 0.10),
                                        borderRadius: 99,
                                        px: 0.625,
                                        py: 0.25,
                                        lineHeight: 1.6,
                                        whiteSpace: "nowrap",
                                    }}>
                                        {cat.icon} {item.typeLabel}
                                    </Box>
                                    <Typography sx={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "text.primary",
                                        letterSpacing: "-0.015em",
                                        lineHeight: 1.25,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        flex: 1,
                                    }}>
                                        {item.title}
                                    </Typography>
                                </Stack>

                                {/* 2행: 팀장 아바타 + 이름 + 인원 */}
                                <Stack direction="row" spacing={0.875} alignItems="center" sx={{ mt: 0.75 }}>
                                    <Box sx={{
                                        width: 14, height: 14,
                                        borderRadius: "50%",
                                        flexShrink: 0,
                                        bgcolor: cat.color,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 7,
                                        color: "common.white",
                                        fontWeight: 700,
                                    }}>
                                        {item.author?.[0]}
                                    </Box>
                                    <Typography sx={{
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        color: "text.secondary",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        maxWidth: "60%",
                                    }}>
                                        {item.author}
                                    </Typography>
                                    {item.members && (
                                        <Typography sx={{
                                            fontSize: 10.5,
                                            color: "text.disabled",
                                            flexShrink: 0,
                                            ml: "auto !important",
                                        }}>
                                            {item.members}
                                        </Typography>
                                    )}
                                </Stack>
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* HALF / FULL: 수직 리스트 */}
            {snap !== "peek" && (
                <Box
                    ref={listRef}
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        px: 2,
                        pb: 2,
                        ...hideScrollbarSx,
                    }}
                >
                    {items.length === 0 ? (
                        <Box sx={{ py: 5, textAlign: "center" }}>
                            <Typography sx={{ fontSize: 24, mb: 1 }}>📍</Typography>
                            <Typography sx={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "text.primary",
                            }}>
                                이 지역에 모집이 없어요
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={1}>
                            {items.map((item) => {
                                const isSel = selected?.id === item.id;
                                return (
                                    <Box key={item.id} data-card-id={item.id}>
                                        <Box
                                            onClick={() => {
                                                if (isSel) onDetail?.(item);
                                                else onSelect(item);
                                            }}
                                            sx={isSel ? {
                                                borderRadius: 1.75,
                                                outline: `2px solid ${primary}`,
                                                outlineOffset: -2,
                                            } : {}}
                                        >
                                            <RecruitmentCard
                                                item={item}
                                                onDetail={null}
                                                onBookmark={onBookmark}
                                            />
                                        </Box>
                                        {isSel && (
                                            <Box
                                                onClick={() => onDetail?.(item)}
                                                sx={{
                                                    mt: 0.5,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 0.5,
                                                    py: 1,
                                                    borderRadius: 1.25,
                                                    bgcolor: "primary.main",
                                                    color: "common.white",
                                                    fontSize: 12.5,
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                    letterSpacing: "-0.01em",
                                                    "&:active": { opacity: 0.85 },
                                                }}
                                            >
                                                자세히 보기
                                                <Box component="span" sx={{ fontSize: 14, lineHeight: 1 }}>→</Box>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
}
