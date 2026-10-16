import { useCallback, useState } from "react";
import { Box, Button, IconButton, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExploreRoundedIcon from "@mui/icons-material/ExploreRounded";
import { Link as RouterLink } from "react-router-dom";

import { isAndroid } from "../../../shared/utils/platformUtils.js";
import { Z } from "../../../shared/ui/zIndex.js";

/** 닫기는 이 브라우저 세션 동안만 — 새로 둘러보기를 시작하면 다시 안내한다 */
const DISMISS_KEY = "guestModeBannerDismissed";

/**
 * 둘러보기(게스트) 안내.
 *
 * 왜 필요한가: 둘러보기로 들어온 사람은 "이걸 눌러도 되나" 를 모른다. 그래서 아무것도
 * 만지지 않고 나가는 경우가 많다. 마음껏 해보라고 먼저 말해준다.
 *
 * **왜 떠 있는가:** 예전엔 문서 흐름에 놓인 가로 배너라 본문 전체를 아래로 밀었다.
 * 한 번 읽으면 그만인 안내가 화면을 계속 차지하는 셈이라, 볼 때마다 걸리적거린다.
 * 지금은 화면 아래에 떠 있어 **레이아웃을 전혀 건드리지 않는다** — 눈길만 한 번 가고,
 * 본문은 원래 자리를 지킨다.
 *
 * 문구에서 조심한 것: 예시로 깔아 둔 항목은 읽기 전용이다(서버가 403).
 * "다 만져도 된다"고만 하면 예시를 완료하려다 막혀서 오히려 고장으로 읽힌다.
 */
export default function GuestModeBanner({ sx }) {
    const theme = useTheme();
    const [dismissed, setDismissed] = useState(
        () => sessionStorage.getItem(DISMISS_KEY) === "1"
    );

    const dismiss = useCallback(() => {
        sessionStorage.setItem(DISMISS_KEY, "1");
        setDismissed(true);
    }, []);

    if (dismissed) return null;

    const dark = theme.palette.mode === "dark";
    /* Android WebView 는 backdrop-filter 를 못 그린다 — blur 를 기대하고 배경을 옅게 두면
       글자가 본문 위에 그대로 겹쳐 읽힌다. 그쪽은 불투명에 가깝게 올린다. */
    const blur = isAndroid
        ? {}
        : { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" };
    const bg = dark
        ? alpha(theme.palette.common.black, isAndroid ? 0.92 : 0.55)
        : alpha(theme.palette.common.white, isAndroid ? 0.96 : 0.72);

    return (
        <Box
            component={motion.div}
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            sx={{
                position: "fixed",
                /* 데스크톱은 가운데, 모바일은 좌우로 붙인다(폭이 좁아 가운데 정렬이 의미 없다).
                   모바일 하단은 탭바가 차지하므로 그 위로 올린다. */
                bottom: {
                    xs: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
                    md: 20,
                },
                left: { xs: 12, md: "50%" },
                right: { xs: 12, md: "auto" },
                transform: { md: "translateX(-50%)" },
                /* 떠 있되 위에 서지 않는다. 모달·드로어·토스트는 이 위를 덮어야 한다 —
                   안내 하나가 실제 조작을 가리면 안 된다. */
                zIndex: Z.FAB,
                display: "flex",
                alignItems: "center",
                gap: 1,
                maxWidth: { md: 560 },
                pl: 1.5,
                pr: 0.5,
                py: 0.75,
                borderRadius: 999,
                bgcolor: bg,
                ...blur,
                border: `1px solid ${alpha(theme.palette.divider, dark ? 0.8 : 1)}`,
                boxShadow: dark
                    ? `0 6px 24px ${alpha(theme.palette.common.black, 0.5)}`
                    : `0 6px 24px ${alpha(theme.palette.common.black, 0.12)}`,
                ...sx,
            }}
        >
            <ExploreRoundedIcon
                fontSize="small"
                sx={{ flex: "none", color: "primary.main", fontSize: 18 }}
            />
            <Typography
                variant="caption"
                sx={{ minWidth: 0, lineHeight: 1.45, color: "text.secondary" }}
            >
                <Box component="b" sx={{ color: "text.primary" }}>둘러보기 중</Box>
                {" · 무엇을 해도 괜찮아요. 예시 항목만 수정할 수 없어요."}
            </Typography>
            <Button
                component={RouterLink}
                to="/register"
                size="small"
                sx={{ flex: "none", fontWeight: 700, whiteSpace: "nowrap", minWidth: "auto", px: 1 }}
            >
                계정 만들기
            </Button>
            <IconButton size="small" onClick={dismiss} aria-label="둘러보기 안내 닫기" sx={{ flex: "none" }}>
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
        </Box>
    );
}
