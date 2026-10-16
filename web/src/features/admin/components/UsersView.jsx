import { useCallback, useEffect, useState } from "react";
import { Box, Button, InputAdornment, Pagination, Skeleton, TextField, Typography } from "@mui/material";
import { Search, UserX } from "lucide-react";
import { adminApi } from "../api/adminApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { useDebouncedCallback } from "../../../shared/hooks/useDebouncedCallback.js";
import { formatTimeAgo } from "../../../shared/utils/formatters.js";
import { Empty, Initial, PageHead, Panel, Pill, TableFoot, TableHead } from "./ui.jsx";
import ReasonDialog from "./ReasonDialog.jsx";

const PROVIDER = { LOCAL: "이메일", GOOGLE: "Google", KAKAO: "Kakao", APPLE: "Apple" };
const COLS = "minmax(0, 1fr) 96px 112px 56px 76px 92px";

function Status({ u }) {
    if (u.suspendedAt) return <Pill tone="danger" dot>정지</Pill>;
    if (u.admin) return <Pill tone="info" dot>관리자</Pill>;
    if (u.guest) return <Pill dot>게스트</Pill>;
    return <Pill tone="ok" dot>정상</Pill>;
}

export default function UsersView({ onError, onChanged, initialQuery = "" }) {
    const [q, setQ] = useState(initialQuery);
    const [query, setQuery] = useState(initialQuery);
    const [page, setPage] = useState(0);
    const [data, setData] = useState(null);
    const [target, setTarget] = useState(null); // { user, mode: 'suspend' | 'unsuspend' }

    const debounced = useDebouncedCallback((v) => { setQuery(v); setPage(0); }, 250);

    const load = useCallback(() => {
        adminApi.users(query, page).then(setData).catch(onError);
    }, [query, page, onError]);
    useEffect(() => { load(); }, [load]);

    const pages = data ? Math.ceil(data.total / data.size) : 0;

    const action = (u) => {
        if (u.admin) return null;
        return u.suspendedAt ? (
            <Button size="small" variant="outlined" onClick={() => setTarget({ user: u, mode: "unsuspend" })}
                    sx={{ minWidth: 0, px: 1.25, height: 30, borderRadius: 2, whiteSpace: "nowrap" }}>
                정지 해제
            </Button>
        ) : (
            <Button size="small" variant="outlined" color="inherit" onClick={() => setTarget({ user: u, mode: "suspend" })}
                    sx={{
                        minWidth: 0, px: 1.5, height: 30, borderRadius: 2, color: "text.secondary", borderColor: "divider",
                        "&:hover": { color: "error.main", borderColor: "error.main", bgcolor: "transparent" },
                    }}>
                정지
            </Button>
        );
    };

    return (
        <>
            <PageHead
                title="사용자 관리"
                sub={data ? `회원 ${data.total.toLocaleString("ko-KR")}명 · 탈퇴한 계정은 빼고 보여요` : " "}
                right={
                    <TextField size="small" placeholder="이메일·이름 검색" value={q} sx={{ width: { xs: "100%", sm: 280 } }}
                               onChange={(e) => { setQ(e.target.value); debounced(e.target.value); }}
                               slotProps={{ input: {
                                   sx: { borderRadius: 2, bgcolor: "background.paper" },
                                   startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                               } }} />
                }
            />
            <Panel sx={{ overflow: "clip" }}>
                <TableHead cols={COLS}>
                    <span>사용자</span><span>가입 방식</span><span>최근 활동</span>
                    <span style={{ textAlign: "right" }}>신고</span><span>상태</span><span />
                </TableHead>
                {!data ? (
                    <Box sx={{ px: 2.5, py: 1 }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={60} />)}</Box>
                ) : data.items.length === 0 ? (
                    <Empty icon={UserX} title="찾는 사용자가 없어요" hint={query ? "이메일이나 이름의 일부로도 찾을 수 있어요." : undefined} />
                ) : data.items.map((u) => (
                    <Box key={u.id} sx={{
                        display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: COLS }, gap: { xs: 1.5, md: 2 },
                        alignItems: "center", px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider",
                        transition: "background-color .12s", "&:hover": { bgcolor: "action.hover" },
                        "&:last-of-type": { borderBottom: 0 },
                    }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                            <Initial id={u.id} text={u.name || u.email} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>{u.name || "이름 없음"}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{u.email}</Typography>
                                {/* 좁은 화면에서는 표 칸 대신 한 줄로 */}
                                <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                                    <Status u={u} />
                                    <Typography variant="caption" color="text.secondary">
                                        {PROVIDER[u.provider] ?? u.provider}
                                        {u.lastActiveAt ? ` · ${formatTimeAgo(u.lastActiveAt)}` : ""}
                                        {u.reportCount ? ` · 신고 ${u.reportCount}` : ""}
                                    </Typography>
                                </Box>
                                {u.suspendedReason && (
                                    <Typography variant="caption" color="error.main" noWrap sx={{ display: "block", mt: 0.25 }}>
                                        사유: {u.suspendedReason}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                        <Typography variant="body2" sx={{ display: { xs: "none", md: "block" } }}>{PROVIDER[u.provider] ?? u.provider}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
                            {u.lastActiveAt ? formatTimeAgo(u.lastActiveAt) : "—"}
                        </Typography>
                        <Typography variant="body2" sx={{
                            display: { xs: "none", md: "block" }, textAlign: "right", fontVariantNumeric: "tabular-nums",
                            color: u.reportCount ? "error.main" : "text.disabled", fontWeight: u.reportCount ? 700 : 500,
                        }}>
                            {u.reportCount}
                        </Typography>
                        <Box sx={{ display: { xs: "none", md: "block" } }}><Status u={u} /></Box>
                        <Box sx={{ textAlign: "right" }}>{action(u)}</Box>
                    </Box>
                ))}
                {data && (
                    <TableFoot page={page} size={data.size} total={data.total}>
                        {pages > 1 && <Pagination size="small" shape="rounded" count={pages} page={page + 1} onChange={(_, p) => setPage(p - 1)} />}
                    </TableFoot>
                )}
            </Panel>

            <ReasonDialog
                open={!!target}
                danger={target?.mode === "suspend"}
                title={target?.mode === "suspend" ? `${target?.user.name || target?.user.email} 정지` : "정지 해제"}
                description={target?.mode === "suspend"
                    ? "정지하면 이미 로그인한 기기에서도 바로 쓸 수 없게 돼요."
                    : "해제하면 다시 로그인해서 쓸 수 있어요."}
                confirmLabel={target?.mode === "suspend" ? "정지" : "해제"}
                onClose={() => setTarget(null)}
                onConfirm={async (reason) => {
                    try {
                        if (target.mode === "suspend") await adminApi.suspend(target.user.id, reason);
                        else await adminApi.unsuspend(target.user.id, reason);
                    } catch (e) {
                        onError(e);
                        throw new Error(getApiError(e, "처리하지 못했어요."));
                    }
                    load();
                    onChanged();
                }}
            />
        </>
    );
}
