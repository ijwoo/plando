import { useEffect, useState } from "react";
import { Box, Pagination, Skeleton, Typography } from "@mui/material";
import { ScrollText } from "lucide-react";
import { adminApi, fmt, LABEL } from "../api/adminApi.js";
import { Empty, Initial, PageHead, Panel, Pill, TableFoot, TableHead } from "./ui.jsx";

const COLS = "150px 120px minmax(0, 1fr) 160px";

const TONE = { USER_SUSPENDED: "danger", CONTENT_HIDDEN: "warn", ADMIN_LOGIN: "neutral", TOTP_ENROLLED: "info" };

export default function AuditView({ onError }) {
    const [page, setPage] = useState(0);
    const [data, setData] = useState(null);
    useEffect(() => { adminApi.audit(page).then(setData).catch(onError); }, [page, onError]);
    const pages = data ? Math.ceil(data.total / data.size) : 0;

    return (
        <>
            <PageHead title="감사 로그" sub="운영자가 한 일은 모두 여기에 남고, 고치거나 지울 수 없어요." />
            <Panel sx={{ overflow: "clip" }}>
                <TableHead cols={COLS}><span>시각</span><span>조치</span><span>대상 · 사유</span><span>운영자</span></TableHead>
                {!data ? (
                    <Box sx={{ p: 2 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={52} />)}</Box>
                ) : data.items.length === 0 ? (
                    <Empty icon={ScrollText} title="기록이 없어요" />
                ) : data.items.map((a) => (
                    <Box key={a.id} sx={{
                        display: "grid", gridTemplateColumns: { xs: "1fr", md: COLS }, gap: { xs: 0.75, md: 2 },
                        alignItems: "center", px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 }, "&:hover": { bgcolor: "action.hover" },
                    }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>{fmt(a.createdAt)}</Typography>
                        <Box><Pill tone={TONE[a.action] ?? "neutral"}>{LABEL.action[a.action] ?? a.action}</Pill></Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                                {a.targetType ? `${LABEL.target[a.targetType] ?? a.targetType} #${a.targetId}` : "—"}
                                {a.reason && <Box component="span" sx={{ color: "text.secondary" }}> · {a.reason}</Box>}
                            </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                            <Initial id={a.adminId} text={a.adminName} size={22} />
                            <Typography variant="caption" color="text.secondary" noWrap>{a.adminName ?? `#${a.adminId}`}</Typography>
                        </Box>
                    </Box>
                ))}
                {data && (
                    <TableFoot page={page} size={data.size} total={data.total}>
                        {pages > 1 && <Pagination size="small" shape="rounded" count={pages} page={page + 1} onChange={(_, p) => setPage(p - 1)} />}
                    </TableFoot>
                )}
            </Panel>
        </>
    );
}
