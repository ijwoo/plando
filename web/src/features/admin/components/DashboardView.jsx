import { useEffect, useState } from "react";
import { Box, MenuItem, Select, Skeleton, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    Users, Building2, ListChecks, Flag, CalendarDays, ChevronRight, ShieldAlert, UserX, ScrollText, CheckCircle2,
} from "lucide-react";
import {
    CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { adminApi, LABEL } from "../api/adminApi.js";
import { formatTimeAgo } from "../../../shared/utils/formatters.js";
import { Initial, PageHead, Panel, Pill } from "./ui.jsx";

const n = (v) => (v == null ? "—" : Number(v).toLocaleString("ko-KR"));

function Kpi({ icon: Icon, label, value, children, tone = "primary", onClick }) {
    return (
        <Panel onClick={onClick} sx={{
            p: { xs: 2, sm: 2.5 }, display: "flex", gap: 2, alignItems: "flex-start",
            cursor: onClick ? "pointer" : "default", transition: "border-color .15s",
            "&:hover": onClick ? { borderColor: "primary.main" } : undefined,
        }}>
            <Box sx={(t) => ({
                width: 52, height: 52, borderRadius: 3, display: "grid", placeItems: "center", flex: "none",
                color: t.palette[tone].main, bgcolor: alpha(t.palette[tone].main, t.palette.mode === "dark" ? 0.16 : 0.09),
            })}>
                <Icon size={24} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: "text.secondary" }}>{label}</Typography>
                <Typography sx={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.25, mt: 0.25, fontVariantNumeric: "tabular-nums" }}>
                    {value}
                </Typography>
                <Box sx={{ mt: 0.5, fontSize: 12.5, color: "text.secondary" }}>{children}</Box>
            </Box>
        </Panel>
    );
}

/** ▲ 12.8% / ▼ 3.1% — 비교 대상이 0 이면 퍼센트를 만들지 않는다 */
function Delta({ now, before, caption }) {
    if (!before) {
        return <>{caption}{now > 0 ? " · 지난달 기록 없음" : ""}</>;
    }
    const pct = ((now - before) / before) * 100;
    const up = pct >= 0;
    return (
        <>
            <Box component="span" sx={{ color: up ? "success.main" : "error.main", fontWeight: 700, mr: 0.75 }}>
                {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
            </Box>
            {caption}
        </>
    );
}

function SectionTitle({ children, action }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Typography sx={{ flex: 1, fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{children}</Typography>
            {action}
        </Box>
    );
}

function MoreLink({ onClick, children = "전체 보기" }) {
    return (
        <Box component="button" type="button" onClick={onClick} sx={{
            all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.25,
            fontSize: 13, fontWeight: 600, color: "primary.main", "&:hover": { textDecoration: "underline" },
        }}>
            {children}<ChevronRight size={15} />
        </Box>
    );
}

function Legend({ color, children }) {
    return (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: 13, color: "text.secondary" }}>
            <Box component="span" sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color }} />{children}
        </Box>
    );
}

export default function DashboardView({ onError, go }) {
    const theme = useTheme();
    const dark = theme.palette.mode === "dark";
    const [days, setDays] = useState(30);
    const [o, setO] = useState(null);
    const [alerts, setAlerts] = useState(null);

    useEffect(() => {
        setO(null);
        adminApi.overview(days).then(setO).catch(onError);
    }, [days, onError]);

    // 운영 알림 — 대기 중인 신고와 최근 조치를 시간순으로 섞는다
    useEffect(() => {
        Promise.all([adminApi.reports("OPEN", 0), adminApi.audit(0)])
            .then(([r, a]) => {
                const fromReports = r.items.slice(0, 4).map((x) => ({
                    key: `r${x.id}`, at: x.createdAt, kind: "report", go: "reports",
                    title: `${LABEL.target[x.targetType]} 신고 · ${LABEL.reason[x.reason]}`,
                    body: x.target.title || x.target.body || x.target.authorName || "삭제된 대상",
                }));
                const fromAudit = a.items.filter((x) => x.action !== "ADMIN_LOGIN").slice(0, 4).map((x) => ({
                    key: `a${x.id}`, at: x.createdAt, kind: x.action, go: "audit",
                    title: LABEL.action[x.action] ?? x.action,
                    body: [x.targetType ? `${LABEL.target[x.targetType] ?? x.targetType} #${x.targetId}` : null, x.reason].filter(Boolean).join(" · "),
                }));
                setAlerts([...fromReports, ...fromAudit].sort((p, q) => new Date(q.at) - new Date(p.at)).slice(0, 4));
            })
            .catch(onError);
    }, [onError]);

    const c1 = theme.palette.primary.main;
    const c2 = dark ? "#C4B5FD" : "#A5A0F5";
    const c3 = dark ? alpha("#C4B5FD", 0.35) : "#DCDAFB";
    const chart = (o?.daily ?? []).map((d) => ({ day: d.date.slice(5).replace("-", "."), created: d.created, done: d.done }));
    const sizes = o?.teamSizes ?? [];
    const sizeTotal = sizes.reduce((s, b) => s + b.count, 0);
    const teamCount = sizes.filter((b) => b.key !== "SOLO").reduce((s, b) => s + b.count, 0);

    return (
        <>
            <PageHead
                title="운영 대시보드"
                sub="Plan Do! 의 사용자와 워크스페이스 활동을 한눈에 확인하세요. 게스트·샘플은 빼고 셉니다."
                right={
                    <Select size="small" value={days} onChange={(e) => setDays(e.target.value)}
                            renderValue={(v) => (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <CalendarDays size={17} />최근 {v}일
                                </Box>
                            )}
                            sx={{ minWidth: 150, height: 42, borderRadius: 2.5, bgcolor: "background.paper", fontSize: 14, fontWeight: 600 }}>
                        <MenuItem value={7}>최근 7일</MenuItem>
                        <MenuItem value={30}>최근 30일</MenuItem>
                    </Select>
                }
            />

            {/* 숫자 카드 */}
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" } }}>
                {o ? (
                    <>
                        <Kpi icon={Users} label="전체 사용자" value={n(o.members)}>
                            7일 활성 <b>{n(o.active7d)}</b> · 30일 <b>{n(o.active30d)}</b>
                        </Kpi>
                        <Kpi icon={Building2} label="워크스페이스" value={n(o.workspaces)}>
                            2명 이상 함께 쓰는 곳 <b>{n(teamCount)}</b>
                        </Kpi>
                        <Kpi icon={ListChecks} label="이번 달 만든 할 일" value={n(o.todosThisMonth)}>
                            <Delta now={o.todosThisMonth} before={o.todosLastMonth} caption="지난달 같은 기간 대비" />
                        </Kpi>
                        <Kpi icon={Flag} tone={o.openReports ? "error" : "primary"} label="대기 중인 신고" value={n(o.openReports)} onClick={() => go("reports")}>
                            {o.suspended ? `정지된 계정 ${n(o.suspended)}명` : "정지된 계정 없음"}
                        </Kpi>
                    </>
                ) : [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={118} sx={{ borderRadius: 3 }} />)}
            </Box>

            {/* 추이 + 규모 */}
            <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.9fr) minmax(0, 1fr)" } }}>
                <Panel sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
                    <SectionTitle action={
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                            <Legend color={c1}>만든 할 일</Legend>
                            <Legend color={c2}>완료한 할 일</Legend>
                        </Box>
                    }>
                        서비스 이용 추이
                    </SectionTitle>
                    <Box sx={{ height: 280 }}>
                        {o ? (
                            <ResponsiveContainer>
                                <LineChart data={chart} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                                    <CartesianGrid stroke={theme.palette.divider} />
                                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke={theme.palette.text.secondary}
                                           interval={days === 7 ? 0 : 2} tickMargin={8} />
                                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke={theme.palette.text.secondary} />
                                    <Tooltip formatter={(v, k) => [`${v}개`, k === "created" ? "만든 할 일" : "완료한 할 일"]}
                                             contentStyle={{ borderRadius: 12, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }} />
                                    <Line type="linear" dataKey="created" stroke={c1} strokeWidth={2.5} dot={{ r: 3, fill: c1 }} activeDot={{ r: 5 }} />
                                    <Line type="linear" dataKey="done" stroke={c2} strokeWidth={2.5} dot={{ r: 3, fill: c2 }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : <Skeleton variant="rounded" height="100%" />}
                    </Box>
                </Panel>

                <Panel sx={{ p: { xs: 2, sm: 3 } }}>
                    <SectionTitle>워크스페이스 규모별 분포</SectionTitle>
                    {o ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", justifyContent: "center", minHeight: 240 }}>
                            <Box sx={{ position: "relative", width: 190, height: 190, flex: "none" }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie data={sizeTotal ? sizes : [{ key: "none", count: 1 }]} dataKey="count" nameKey="label"
                                             innerRadius={60} outerRadius={92} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                                            {(sizeTotal ? sizes : [{ key: "none" }]).map((b, i) => (
                                                <Cell key={b.key} fill={sizeTotal ? [c1, c2, c3][i] : theme.palette.divider} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
                                    <Box>
                                        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>전체</Typography>
                                        <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2 }}>{n(sizeTotal)}</Typography>
                                    </Box>
                                </Box>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 170, display: "grid", gap: 2 }}>
                                {sizes.map((b, i) => (
                                    <Box key={b.key} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                                        <Box sx={{ width: 12, height: 12, borderRadius: "50%", mt: 0.5, flex: "none", bgcolor: [c1, c2, c3][i] }} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{b.label}</Typography>
                                            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{n(b.count)}곳</Typography>
                                        </Box>
                                        <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                            {sizeTotal ? `${((b.count / sizeTotal) * 100).toFixed(1)}%` : "—"}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    ) : <Skeleton variant="rounded" height={240} />}
                </Panel>
            </Box>

            {/* 워크스페이스 + 알림 */}
            <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.9fr) minmax(0, 1fr)" } }}>
                <Panel sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
                    <SectionTitle>최근 활동한 워크스페이스</SectionTitle>
                    <RecentWorkspaces items={o?.recentWorkspaces} />
                </Panel>
                <Panel sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
                    <SectionTitle action={<MoreLink onClick={() => go("audit")} />}>운영 알림</SectionTitle>
                    <Alerts items={alerts} go={go} />
                </Panel>
            </Box>
        </>
    );
}

const WS_COLS = "minmax(0, 1.6fr) minmax(0, 1.4fr) 72px 110px 60px";

function RecentWorkspaces({ items }) {
    if (!items) return <Box>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={60} />)}</Box>;
    if (!items.length) return <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>아직 활동한 워크스페이스가 없어요.</Typography>;
    const weekAgo = Date.now() - 7 * 86_400_000;
    return (
        <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 640 }}>
                <Box sx={{
                    display: "grid", gridTemplateColumns: WS_COLS, gap: 2, px: 1.5, height: 38, alignItems: "center", borderRadius: 2,
                    bgcolor: "action.hover", fontSize: 12.5, fontWeight: 600, color: "text.secondary",
                }}>
                    <span>워크스페이스</span><span>소유자</span><span>멤버</span><span>마지막 활동</span><span>상태</span>
                </Box>
                {items.map((w) => {
                    const active = w.lastActivityAt && new Date(w.lastActivityAt).getTime() >= weekAgo;
                    return (
                        <Box key={w.id} sx={{
                            display: "grid", gridTemplateColumns: WS_COLS, gap: 2, px: 1.5, py: 1.5, alignItems: "center",
                            borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 },
                        }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                                <Box sx={(t) => ({
                                    width: 40, height: 40, borderRadius: 2.5, flex: "none", display: "grid", placeItems: "center",
                                    color: "primary.main", bgcolor: alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.16 : 0.09),
                                })}>
                                    <Building2 size={19} />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{w.name}</Typography>
                                    <Typography sx={{ fontSize: 12.5, color: "text.secondary" }} noWrap>할 일 {n(w.todos)}개</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                                <Initial id={w.id} text={w.ownerName || w.ownerEmail} size={32} />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} noWrap>{w.ownerName || "—"}</Typography>
                                    <Typography sx={{ fontSize: 12, color: "text.secondary" }} noWrap>{w.ownerEmail || ""}</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: 13.5, color: "text.secondary" }}>
                                <Users size={15} />{n(w.members)}명
                            </Box>
                            <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>{w.lastActivityAt ? formatTimeAgo(w.lastActivityAt) : "—"}</Typography>
                            <Box>{active ? <Pill tone="ok">활성</Pill> : <Pill>휴면</Pill>}</Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

const ALERT_ICON = {
    report: { icon: ShieldAlert, tone: "error" },
    USER_SUSPENDED: { icon: UserX, tone: "error" },
    CONTENT_HIDDEN: { icon: ShieldAlert, tone: "warning" },
    REPORT_DISMISSED: { icon: CheckCircle2, tone: "success" },
    USER_UNSUSPENDED: { icon: CheckCircle2, tone: "success" },
    CONTENT_RESTORED: { icon: CheckCircle2, tone: "success" },
};

function Alerts({ items, go }) {
    if (!items) return <Box>{[0, 1, 2].map((i) => <Skeleton key={i} height={68} />)}</Box>;
    if (!items.length) {
        return (
            <Box sx={{ py: 5, textAlign: "center" }}>
                <Box sx={{ color: "success.main", mb: 1 }}><CheckCircle2 size={28} /></Box>
                <Typography sx={{ fontWeight: 700 }}>새로운 알림이 없어요</Typography>
                <Typography variant="body2" color="text.secondary">대기 중인 신고도, 최근 조치도 없어요.</Typography>
            </Box>
        );
    }
    return (
        <Box>
            {items.map((a) => {
                const { icon: Icon, tone } = ALERT_ICON[a.kind] ?? { icon: ScrollText, tone: "primary" };
                return (
                    <Box key={a.key} component="button" type="button" onClick={() => go(a.go)} sx={{
                        all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", display: "flex", gap: 1.5, alignItems: "center",
                        py: 1.5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 },
                        "&:hover .alert-title": { color: "primary.main" },
                        "&:focus-visible": { outline: 2, outlineColor: "primary.main" },
                    }}>
                        <Box sx={(t) => ({
                            width: 42, height: 42, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center",
                            color: t.palette[tone].main, bgcolor: alpha(t.palette[tone].main, t.palette.mode === "dark" ? 0.16 : 0.1),
                        })}>
                            <Icon size={19} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                                <Typography className="alert-title" sx={{ flex: 1, fontSize: 14, fontWeight: 700, transition: "color .12s" }} noWrap>{a.title}</Typography>
                                <Typography sx={{ fontSize: 12, color: "text.secondary", flex: "none" }}>{formatTimeAgo(a.at)}</Typography>
                            </Box>
                            <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }} noWrap>{a.body || "—"}</Typography>
                        </Box>
                        <ChevronRight size={17} style={{ opacity: 0.45, flex: "none" }} />
                    </Box>
                );
            })}
        </Box>
    );
}
