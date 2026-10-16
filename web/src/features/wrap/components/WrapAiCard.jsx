import React, { useState } from "react";
import { Card, CardContent, Stack, Typography, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { getGlassSx, hideScrollbarSx } from "../../../shared/ui/glassSx.js";
import Press from "../../../shared/ui/primitives/Press.jsx";

// 라벨은 iPhone 앱(`mobile/src/app/wrap.tsx`)과 같은 말을 쓴다.
// id는 백엔드가 받는 값이라 건드리지 않는다 — 표시 문구만 통일한 것이다.
const PERSONAS = [
    { id: "analyst", label: "분석" },
    { id: "cheer",   label: "응원" },
    { id: "cynical", label: "조언" },
    { id: "brutal",  label: "직설" },
];

/**
 * AI 한마디 — 페르소나 chip + 새로고침.
 * onRefresh: () => Promise<void>
 * onPersonaChange: (personaId) => Promise<void>
 * persona: 현재 활성 페르소나 ID
 */
export default function WrapAiCard({ comment, persona = "analyst", onRefresh, onPersonaChange }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const [busy, setBusy] = useState(false);

    const handleRefresh = async () => {
        if (!onRefresh || busy) return;
        setBusy(true);
        try { await onRefresh(); } finally { setBusy(false); }
    };

    const handlePersona = async (id) => {
        if (!onPersonaChange || busy || id === persona) return;
        setBusy(true);
        try { await onPersonaChange(id); } finally { setBusy(false); }
    };

    return (
        <Card
            elevation={0}
            sx={{
                width: "100%",
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                ...getGlassSx(theme),
                borderColor: "transparent",
            }}
        >
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <AutoAwesomeRoundedIcon
                                sx={{ fontSize: 14, color: "var(--plando-primary)" }}
                            />
                            <Typography
                                sx={{
                                    fontSize: "var(--plando-type-label-size)",
                                    fontWeight: 700,
                                    color: "var(--plando-primary)",
                                    letterSpacing: "var(--plando-type-label-ls)",
                                }}
                            >
                                AI 한마디
                            </Typography>
                        </Stack>
                        {onRefresh ? (
                            <Press
                                as="span"
                                onClick={handleRefresh}
                                haptic="light"
                                pressScale={0.9}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: 999,
                                }}
                                aria-label="다시 생성"
                            >
                                {busy ? (
                                    <CircularProgress size={14} thickness={5} sx={{ color: "var(--plando-primary)" }} />
                                ) : (
                                    <RefreshRoundedIcon
                                        sx={{ fontSize: 17, color: "text.secondary", opacity: 0.7 }}
                                    />
                                )}
                            </Press>
                        ) : null}
                    </Stack>

                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-body-size)",
                            fontWeight: "var(--plando-type-body-weight)",
                            lineHeight: "var(--plando-type-body-lh)",
                            letterSpacing: "var(--plando-type-body-ls)",
                            color: "text.primary",
                            opacity: busy ? 0.5 : 1,
                            transition: "opacity 0.25s",
                            minHeight: 24,
                        }}
                    >
                        {comment}
                    </Typography>

                    {onPersonaChange ? (
                        <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{
                                pt: 0.5,
                                overflowX: "auto",
                                ...hideScrollbarSx,
                            }}
                        >
                            {PERSONAS.map((p) => {
                                const active = p.id === persona;
                                return (
                                    <Press
                                        key={p.id}
                                        as="span"
                                        onClick={() => handlePersona(p.id)}
                                        haptic="light"
                                        pressScale={0.95}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            padding: "6px 12px",
                                            borderRadius: 999,
                                            background: active
                                                ? "var(--plando-primary)"
                                                : (isDark ? "rgba(255,255,255,0.06)" : "var(--plando-surface-alt)"),
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                letterSpacing: "-0.01em",
                                                color: active
                                                    ? "#FFFFFF"
                                                    : (isDark ? "rgba(255,255,255,0.7)" : "var(--plando-text-secondary)"),
                                            }}
                                        >
                                            {p.label}
                                        </Typography>
                                    </Press>
                                );
                            })}
                        </Stack>
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}
