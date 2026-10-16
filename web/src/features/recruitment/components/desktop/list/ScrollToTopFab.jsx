import { useEffect, useRef, useState } from "react";
import { Fab, Fade } from "@mui/material";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import { Z } from "../../../../../shared/ui/zIndex.js";
import { SHADOW } from "../../common/recruitmentSx";

const SHOW_AFTER_PX = 320;

export default function ScrollToTopFab() {
    const sentinelRef = useRef(null);
    const scrollElRef = useRef(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        let el = sentinelRef.current?.parentElement;
        while (el) {
            const { overflow, overflowY } = getComputedStyle(el);
            if (overflow === "auto" || overflow === "scroll" || overflowY === "auto" || overflowY === "scroll") break;
            el = el.parentElement;
        }
        scrollElRef.current = el || null;
        const target = el || window;
        const handler = () => {
            const top = el ? el.scrollTop : window.scrollY;
            setShow(top > SHOW_AFTER_PX);
        };
        target.addEventListener("scroll", handler, { passive: true });
        return () => target.removeEventListener("scroll", handler);
    }, []);

    const handleClick = () => {
        const el = scrollElRef.current;
        if (el) el.scrollTo({ top: 0, behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <>
            <span ref={sentinelRef} style={{ display: "none" }} />
            <Fade in={show}>
                <Fab
                    size="medium"
                    onClick={handleClick}
                    aria-label="맨 위로"
                    sx={{
                        position: "fixed",
                        bottom: 36,
                        right: 36,
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        boxShadow: SHADOW.lift,
                        "&:hover": {
                            bgcolor: "primary.dark",
                            boxShadow: SHADOW.lift,
                        },
                        zIndex: Z.FAB,
                    }}
                >
                    <KeyboardArrowUpRoundedIcon sx={{ fontSize: 22 }} />
                </Fab>
            </Fade>
        </>
    );
}
