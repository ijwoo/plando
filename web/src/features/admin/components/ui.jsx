import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/* 백오피스 공통 조각 — 카드, 상태 점, 빈 화면, 표 머리글·바닥. 앱 테마 색만 쓴다. */

export function Panel({ children, sx, ...rest }) {
    return (
        <Box sx={{
            bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2,
            boxShadow: "0 1px 2px rgba(15, 23, 42, .04)", ...sx,
        }} {...rest}>
            {children}
        </Box>
    );
}

const TONE = {
    neutral: { fg: "text.secondary", bg: "action.hover" },
    warn: { fg: "warning.main", bg: "rgba(245, 158, 11, .12)" },
    danger: { fg: "error.main", bg: "rgba(225, 29, 72, .1)" },
    ok: { fg: "success.main", bg: "rgba(16, 185, 129, .12)" },
    info: { fg: "primary.main", bg: "action.selected" },
};

export function Pill({ tone = "neutral", dot, children }) {
    const t = TONE[tone];
    return (
        <Box component="span" sx={{
            display: "inline-flex", alignItems: "center", gap: 0.625, px: 1, height: 22, borderRadius: 11,
            fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", color: t.fg, bgcolor: t.bg,
        }}>
            {dot && <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "currentColor" }} />}
            {children}
        </Box>
    );
}

export function Empty({ icon: Icon, title, hint }) {
    return (
        <Box sx={{ py: 9, px: 3, textAlign: "center" }}>
            {Icon && (
                <Box sx={{
                    width: 44, height: 44, mx: "auto", mb: 1.5, borderRadius: 3, display: "grid", placeItems: "center",
                    bgcolor: "action.hover", color: "text.secondary",
                }}>
                    <Icon size={20} />
                </Box>
            )}
            <Typography fontWeight={600}>{title}</Typography>
            {hint && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{hint}</Typography>}
        </Box>
    );
}

export function PageHead({ title, sub, right }) {
    return (
        <Box sx={{
            display: "flex", gap: 2, mb: 3,
            flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "flex-end" },
        }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                    {title}
                </Typography>
                {sub && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{sub}</Typography>}
            </Box>
            {right && <Box sx={{ flex: "none", maxWidth: "100%", overflowX: "auto" }}>{right}</Box>}
        </Box>
    );
}

/** 표 머리글 — 스크롤해도 위에 붙어 있다. 감싸는 Panel 은 overflow: clip 이어야 sticky 가 걸린다. */
export function TableHead({ cols, children }) {
    return (
        <Box sx={{
            display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, gap: 2, px: 2.5, height: 40, alignItems: "center",
            position: "sticky", top: 0, zIndex: 1, bgcolor: "background.paper",
            borderBottom: 1, borderColor: "divider", color: "text.secondary", fontSize: 12, fontWeight: 600,
        }}>
            {children}
        </Box>
    );
}

/** 표 바닥 — "1–20 / 44" 와 페이지 넘김 */
export function TableFoot({ page, size, total, children }) {
    if (!total) return null;
    const from = page * size + 1;
    const to = Math.min(total, (page + 1) * size);
    return (
        <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, px: 2.5, py: 1.25,
            borderTop: 1, borderColor: "divider", flexWrap: "wrap",
        }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")} / {total.toLocaleString("ko-KR")}
            </Typography>
            {children}
        </Box>
    );
}

const AVATAR_HUES = [211, 262, 330, 24, 150, 190, 45];

/** 이름 첫 글자 동그라미 — 색은 id 로 고정 */
export function Initial({ id = 0, text, size = 34 }) {
    const hue = AVATAR_HUES[Math.abs(Number(id) || 0) % AVATAR_HUES.length];
    const ch = (text || "?").trim().charAt(0).toUpperCase() || "?";
    return (
        <Box aria-hidden sx={(t) => {
            const dark = t.palette.mode === "dark";
            return {
                width: size, height: size, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center",
                fontSize: Math.round(size * 0.42), fontWeight: 700,
                color: `hsl(${hue}, 60%, ${dark ? 72 : 40}%)`,
                bgcolor: alpha(`hsl(${hue}, 70%, 55%)`, dark ? 0.2 : 0.14),
            };
        }}>
            {ch}
        </Box>
    );
}
