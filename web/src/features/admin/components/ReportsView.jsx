import { useCallback, useEffect, useState } from "react";
import { Box, Button, Pagination, Skeleton, TextField, ToggleButton, ToggleButtonGroup, Typography, useTheme } from "@mui/material";
import { Flag, MousePointerClick } from "lucide-react";
import { adminApi, fmt, LABEL } from "../api/adminApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { Empty, PageHead, Panel, Pill, TableFoot } from "./ui.jsx";

const STATUS_TONE = { OPEN: "warn", RESOLVED: "ok", DISMISSED: "neutral" };

/** 오른쪽 상세 — 원문을 보고, 사유를 적고, 조치를 고른다. */
function Detail({ item, onDone, onError }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => { setNote(""); setError(""); }, [item?.id]);

    if (!item) return <Empty icon={MousePointerClick} title="신고를 고르세요" hint="왼쪽 목록에서 하나를 누르면 원문과 조치가 보여요." />;
    const t = item.target;
    const open = item.status === "OPEN";

    const act = async (action) => {
        if (note.trim().length < 2) return setError("사유를 2자 이상 적어 주세요. 감사 로그에 남아요.");
        setBusy(true);
        try {
            await adminApi.resolve(item.id, action, note.trim());
            onDone();
        } catch (e) {
            onError(e);
            setError(getApiError(e, "처리하지 못했어요."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                <Pill tone="info">{LABEL.target[item.targetType]}</Pill>
                <Pill tone={STATUS_TONE[item.status]}>{LABEL.status[item.status]}</Pill>
                {item.sameTargetCount > 1 && <Pill tone="danger">같은 대상 신고 {item.sameTargetCount}건</Pill>}
                {t.hidden && <Pill>{item.targetType === "USER" ? "정지됨" : "숨김 상태"}</Pill>}
                {!t.exists && <Pill>삭제됨</Pill>}
            </Box>

            <Typography variant="caption" color="text.secondary" fontWeight={600}>원문</Typography>
            <Box sx={{ mt: 0.75, p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                {t.title && <Typography fontWeight={700} sx={{ mb: t.body ? 0.75 : 0 }}>{t.title}</Typography>}
                {t.body && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{t.body}</Typography>}
                {!t.title && !t.body && <Typography variant="body2" color="text.secondary">내용이 없어요.</Typography>}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                    작성자 {t.authorName ?? "—"} · {t.authorEmail ?? "—"}
                </Typography>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "88px 1fr", rowGap: 1, columnGap: 2, mt: 2.5, fontSize: 14 }}>
                <Typography variant="body2" color="text.secondary">사유</Typography>
                <Typography variant="body2" fontWeight={600}>{LABEL.reason[item.reason]}</Typography>
                {item.detail && <>
                    <Typography variant="body2" color="text.secondary">신고 내용</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{item.detail}</Typography>
                </>}
                <Typography variant="body2" color="text.secondary">신고자</Typography>
                <Typography variant="body2">{item.reporterName ?? `#${item.reporterId}`}</Typography>
                <Typography variant="body2" color="text.secondary">접수</Typography>
                <Typography variant="body2">{fmt(item.createdAt)}</Typography>
                {!open && <>
                    <Typography variant="body2" color="text.secondary">조치</Typography>
                    <Typography variant="body2">{LABEL.resolution[item.resolution]} · {fmt(item.handledAt)}<br />{item.resolutionNote}</Typography>
                </>}
            </Box>

            {open && (
                <Box sx={{ mt: 3 }}>
                    <TextField fullWidth multiline minRows={2} size="small" label="처리 사유" value={note}
                               onChange={(e) => { setNote(e.target.value); setError(""); }}
                               error={!!error} helperText={error || "같은 대상의 대기 신고도 함께 닫혀요."}
                               slotProps={{ htmlInput: { maxLength: 500 } }} />
                    <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
                        {item.targetType !== "USER" && (
                            <Button variant="contained" disabled={busy || !t.exists} onClick={() => act("HIDE_CONTENT")}>숨기기</Button>
                        )}
                        <Button variant="outlined" color="error" disabled={busy || !t.authorId} onClick={() => act("SUSPEND_USER")}>
                            작성자 정지
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        <Button color="inherit" disabled={busy} onClick={() => act("DISMISS")}>기각</Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

export default function ReportsView({ onError, onChanged }) {
    const theme = useTheme();
    const line = `1px solid ${theme.palette.divider}`;
    const [status, setStatus] = useState("OPEN");
    const [page, setPage] = useState(0);
    const [data, setData] = useState(null);
    const [selId, setSelId] = useState(null);

    const load = useCallback(() => {
        adminApi.reports(status, page).then((d) => {
            setData(d);
            setSelId((cur) => (d.items.some((x) => x.id === cur) ? cur : d.items[0]?.id ?? null));
        }).catch(onError);
    }, [status, page, onError]);

    useEffect(() => { setData(null); load(); }, [load]);

    const sel = data?.items.find((x) => x.id === selId) ?? null;
    const pages = data ? Math.ceil(data.total / data.size) : 0;

    return (
        <>
            <PageHead
                title="신고"
                sub="신고만으로는 아무것도 숨겨지지 않아요. 여기서 정한 조치만 반영돼요."
                right={
                    <ToggleButtonGroup size="small" exclusive value={status}
                                       onChange={(_, v) => { if (v) { setStatus(v); setPage(0); } }}>
                        {["OPEN", "RESOLVED", "DISMISSED", "ALL"].map((s) => (
                            <ToggleButton key={s} value={s} sx={{ px: 1.75 }}>{s === "ALL" ? "전체" : LABEL.status[s]}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                }
            />
            <Panel sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 440px" }, overflow: "clip", alignItems: "start" }}>
                <Box sx={{ borderRight: { xs: "none", lg: line }, minHeight: { lg: 460 }, alignSelf: "stretch" }}>
                    {!data ? (
                        <Box sx={{ p: 2 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}</Box>
                    ) : data.items.length === 0 ? (
                        <Empty icon={Flag} title={status === "OPEN" ? "대기 중인 신고가 없어요" : "신고가 없어요"} />
                    ) : (
                        <>
                            {data.items.map((r) => (
                                <Box key={r.id} component="button" type="button" onClick={() => setSelId(r.id)} sx={{
                                    all: "unset", boxSizing: "border-box", display: "flex", gap: 2, alignItems: "center", width: "100%",
                                    px: 2.5, py: 1.75, cursor: "pointer", borderBottom: 1, borderColor: "divider",
                                    bgcolor: r.id === selId ? "action.selected" : "transparent",
                                    "&:hover": { bgcolor: r.id === selId ? "action.selected" : "action.hover" },
                                    "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: -2 },
                                }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
                                            <Pill tone="info">{LABEL.target[r.targetType]}</Pill>
                                            <Typography variant="body2" fontWeight={600}>{LABEL.reason[r.reason]}</Typography>
                                            {r.sameTargetCount > 1 && <Pill tone="danger">{r.sameTargetCount}건</Pill>}
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            {r.target.title || r.target.body || r.target.authorName || "삭제된 대상"}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ textAlign: "right", flex: "none" }}>
                                        <Pill tone={STATUS_TONE[r.status]}>{LABEL.status[r.status]}</Pill>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>{fmt(r.createdAt)}</Typography>
                                    </Box>
                                </Box>
                            ))}
                            <TableFoot page={page} size={data.size} total={data.total}>
                                {pages > 1 && <Pagination size="small" shape="rounded" count={pages} page={page + 1} onChange={(_, p) => setPage(p - 1)} />}
                            </TableFoot>
                        </>
                    )}
                </Box>
                <Box sx={{ borderTop: { xs: line, lg: "none" }, position: { lg: "sticky" }, top: 0 }}>
                    <Detail item={sel} onError={onError} onDone={() => { load(); onChanged(); }} />
                </Box>
            </Panel>
        </>
    );
}
