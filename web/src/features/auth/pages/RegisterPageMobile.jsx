import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import { buildTheme } from "../../../shared/ui/theme.js";
import SignupFlow from "../components/SignupFlow.jsx";
import { AUTH_PAGE_BG_MODERN } from "../utils/pageBg.js";

/* ── 페이지 배경 — auth/utils/pageBg.js에서 import ─────────── */
const PAGE_BG = AUTH_PAGE_BG_MODERN;

/* ── 모바일 회원가입 페이지 ─────────────────────────────────────
   껍데기(그라데이션 + 흰 카드)만 담당하고, 단계 흐름은 SignupFlow가 처리한다.
   LoginPageMobile의 email step 카드와 같은 톤(22px radius / 흰 배경 / 옅은 그림자).

   URL 쿼리: ?step=account | workspace (없으면 method) — 브라우저 뒤로가기가 단계 뒤로가기가 된다.
   가입 제출 후에는 URL과 무관하게 verify(메일 확인 안내) 단계가 표시된다. */
export default function RegisterPageMobile() {
    const lightTheme = useMemo(() => buildTheme("light"), []);

    return (
        <ThemeProvider theme={lightTheme}>
            <Box
                sx={{
                    minHeight: "100dvh",
                    background: PAGE_BG,
                    display: "flex",
                    flexDirection: "column",
                    pt: "calc(env(safe-area-inset-top) + 24px)",
                    pb: "calc(env(safe-area-inset-bottom) + 16px)",
                    px: 2,
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: "#fff",
                        borderRadius: "22px",
                        p: 2.75,
                        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                    }}
                >
                    <SignupFlow dense />
                </Box>
            </Box>
        </ThemeProvider>
    );
}
