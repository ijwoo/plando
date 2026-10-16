import React, { useRef, useState } from "react";
import { Box, Stack } from "@mui/material";
import { hideScrollbarSx } from "../../../../shared/ui/glassSx.js";

const DEFAULT_CARD_H = 205;
const CARD_WIDTH = "86%";
const CARD_GAP = 12;

export default function SlideSection({ children, cardHeight }) {
    const CARD_H = cardHeight || DEFAULT_CARD_H;
    const trackRef = useRef(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const items = React.Children.toArray(children);
    const count = items.length;

    const getCardStep = () => {
        const track = trackRef.current;
        if (!track || !track.firstElementChild) return 0;
        return track.firstElementChild.offsetWidth + CARD_GAP;
    };

    const handleScroll = () => {
        const track = trackRef.current;
        const cardStep = getCardStep();
        if (!track || !cardStep) return;

        const idx = Math.min(Math.round(track.scrollLeft / cardStep), count - 1);
        setActiveIdx(idx);
    };

    const scrollTo = (i) => {
        const track = trackRef.current;
        const cardStep = getCardStep();
        if (!track || !cardStep) return;

        track.scrollTo({
            left: cardStep * i,
            behavior: "smooth",
        });
    };

    return (
        <Box>
            <Box
                ref={trackRef}
                onScroll={handleScroll}
                sx={{
                    display: "flex",
                    gap: `${CARD_GAP}px`,
                    overflowX: "auto",
                    scrollSnapType: "x mandatory",
                    WebkitOverflowScrolling: "touch",
                    px: 0.25,
                    pr: 0.5,
                    ...hideScrollbarSx,
                }}
            >
                {items.map((child, i) => (
                    <Box
                        key={i}
                        sx={{
                            flex: `0 0 ${CARD_WIDTH}`,
                            width: CARD_WIDTH,
                            minWidth: CARD_WIDTH,
                            scrollSnapAlign: "start",
                            height: CARD_H,
                            "& > .MuiCard-root": {
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                            },
                            "& > .MuiCard-root .MuiCardContent-root": {
                                flex: 1,
                                overflowY: "auto",
                                ...hideScrollbarSx,
                            },
                            ...(i === items.length - 1 && {
                                pr: 0.25,
                            }),
                        }}
                    >
                        {child}
                    </Box>
                ))}
            </Box>

            {count > 1 && (
                <Stack direction="row" justifyContent="center" spacing="5px" sx={{ mt: 1.25 }}>
                    {Array.from({ length: count }).map((_, i) => (
                        <Box
                            key={i}
                            onClick={() => scrollTo(i)}
                            sx={{
                                height: 5,
                                width: i === activeIdx ? 20 : 5,
                                borderRadius: 999,
                                bgcolor: i === activeIdx ? "primary.main" : "action.disabled",
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