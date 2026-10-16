import React, { useRef, useState, useEffect } from "react";
import { Box, Stack, Typography } from "@mui/material";
import RecruitmentCard, { CARD_H } from "../../list/RecruitmentCard";
import { hideScrollbarSx } from "../../../../../shared/ui/glassSx.js";

/**
 * FeaturedCarousel — "추천 모집" 가로 스크롤 + dot indicator
 */
export default function FeaturedCarousel({ items, onDetail, onBookmark, resetTrigger }) {
    const carouselRef = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        setActiveSlide(0);
        carouselRef.current?.scrollTo({ left: 0, behavior: "auto" });
    }, [resetTrigger]);

    const handleCarouselScroll = () => {
        const el = carouselRef.current;
        if (!el) return;
        const cardW = el.clientWidth * 0.78 + 12;
        const next = Math.round(el.scrollLeft / cardW);
        setActiveSlide(Math.max(0, Math.min(next, items.length - 1)));
    };

    if (items.length === 0) return null;

    return (
        <Box sx={{ pt: 1.5, pb: 0.25 }}>
            <Stack direction="row" alignItems="center" gap={0.625} sx={{ px: 2, mb: 1.125 }}>
                <Box sx={{
                    width: 3, height: 13,
                    borderRadius: 99,
                    bgcolor: "primary.main",
                    flexShrink: 0,
                }} />
                <Typography sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "text.secondary",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                }}>
                    추천 모집
                </Typography>
            </Stack>

            <Box
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                sx={{
                    display: "flex",
                    gap: "12px",
                    overflowX: "auto",
                    scrollSnapType: "x mandatory",
                    WebkitOverflowScrolling: "touch",
                    pl: 2,
                    pr: "10%",
                    pb: 0.25,
                    ...hideScrollbarSx,
                }}
            >
                {items.map((item) => (
                    <Box
                        key={item.id}
                        sx={{
                            flex: "0 0 88%",
                            width: "88%",
                            minWidth: "88%",
                            height: CARD_H,
                            scrollSnapAlign: "start",
                        }}
                    >
                        <RecruitmentCard
                            item={item}
                            featured
                            onDetail={onDetail}
                            onBookmark={onBookmark}
                        />
                    </Box>
                ))}
            </Box>

            {items.length > 1 && (
                <Stack direction="row" justifyContent="center" spacing="5px" sx={{ mt: 1 }}>
                    {items.map((_, i) => (
                        <Box
                            key={i}
                            onClick={() => {
                                const el = carouselRef.current;
                                if (!el) return;
                                const child = el.children[i];
                                if (child) el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
                                setActiveSlide(i);
                            }}
                            sx={{
                                height: 5,
                                width: i === activeSlide ? 20 : 5,
                                borderRadius: 99,
                                bgcolor: i === activeSlide ? "primary.main" : "action.disabled",
                                transition: "all 0.25s ease",
                                cursor: "pointer",
                            }}
                        />
                    ))}
                </Stack>
            )}
        </Box>
    );
}
