import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { fieldSx, FieldLabel } from "../../../shared/ui/common/fieldStyles.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { createSchedule, deleteSchedule, fetchSchedules, updateSchedule } from "../api/chatApi.js";

/**
 * 예약 실행 — 역할을 시간에 걸어둔다.
 *
 * 역할은 지금까지 "도구"였다. 화면을 열고 직접 쳐야 무언가 일어난다. 시간에 걸리면 정해둔
 * 시각에 알아서 돌고 결과가 알림으로 온다.
 *
 * **조회만 하는 역할만 걸 수 있다.** 사람이 없는 사이 데이터가 바뀌면, 아침에 열었을 때
 * 마감이 옮겨져 있고 누가 한 건지 알 수 없다. 서버도 같은 규칙으로 막지만, 고를 수 없게
 * 하는 편이 낫다 — 저장을 눌렀다가 거절당하고 나서야 아는 것보다.
 */

const DAY_TOKENS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_LABELS = { MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일" };
const DAILY = "DAILY";

/** "MON,WED" → "월·수" · "DAILY" → "매일" */
function daysLabel(days) {
    if (!days || days === DAILY) return "매일";
    const picked = String(days).split(",").map((d) => d.trim()).filter((d) => DAY_LABELS[d]);
    if (picked.length === 0) return "매일";
    if (picked.length === 5 && !picked.includes("SAT") && !picked.includes("SUN")) return "평일";
    return picked.map((d) => DAY_LABELS[d]).join("·");
}

function timeLabel(hour, minute) {
    const h = Number(hour) || 0;
    const m = Number(minute) || 0;
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${ampm} ${h12}:${String(m).padStart(2, "0")}`;
}

/** "08:30" ↔ {hour, minute} — <input type="time"> 이 쓰는 형식 */
const toTimeInput = (hour, minute) =>
    `${String(Number(hour) || 0).padStart(2, "0")}:${String(Number(minute) || 0).padStart(2, "0")}`;

export default function ScheduleDialog({ open, agents, onClose }) {
    const theme = useTheme();

    const [items, setItems] = useState(null);
    /* 못 불러온 것과 없는 것은 다르다. 구분하지 않으면 조회 한 번 실패에 "예약이 다 사라졌다" 가 된다. */
    const [loadError, setLoadError] = useState("");
    /** null = 편집 안 함 · {} = 새로 만들기 */
    const [editing, setEditing] = useState(null);

    // 조회만 하는 역할만 예약할 수 있다. 서버 판정(readOnly)을 그대로 쓴다.
    const schedulable = (agents ?? []).filter((a) => a.readOnly);

    const reload = () => {
        setLoadError("");
        void fetchSchedules()
            .then(setItems)
            .catch((e) => {
                setItems(null);
                setLoadError(e?.response?.data?.message || "예약을 불러오지 못했어요.");
            });
    };

    useEffect(() => {
        if (!open) return;
        setItems(null);
        setEditing(null);
        reload();
    }, [open]);

    const byId = (id) => (agents ?? []).find((a) => a.id === id);

    return (
        <>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
                <DialogTitle sx={{ pb: 1 }}>예약</DialogTitle>
                <DialogContent sx={{ pt: 0 }}>
                    <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.7, mb: 1.5 }}>
                        정해둔 시각에 역할이 알아서 돌고, 결과를 알림으로 보내드려요. 창을 열어두지 않아도 됩니다.
                    </Typography>

                    {schedulable.length === 0 && (
                        /* 빈 목록만 보여주면 "고장났나" 로 읽힌다 — 왜 못 만드는지 말한다 */
                        <Alert severity="info" sx={{ mb: 1.5, fontSize: 12.5 }}>
                            예약할 수 있는 역할이 없어요. 조회만 하는 역할(예: 점검 도우미)이 있어야 걸 수 있어요.
                        </Alert>
                    )}

                    {loadError ? (
                        /* 빈 목록으로 그리면 "지워졌다" 로 읽힌다. 못 불러왔다고 말하고 길을 준다. */
                        <Alert
                            severity="error"
                            sx={{ mb: 1.5, fontSize: 12.5 }}
                            action={
                                <Button size="small" color="inherit" onClick={reload}>
                                    다시 시도
                                </Button>
                            }>
                            {loadError}
                        </Alert>
                    ) : items === null ? (
                        <Typography sx={{ fontSize: 12.5, color: "text.disabled", py: 2 }}>불러오는 중…</Typography>
                    ) : items.length === 0 ? (
                        <Typography sx={{ fontSize: 12.5, color: "text.disabled", py: 2 }}>아직 예약이 없어요.</Typography>
                    ) : (
                        <Stack spacing={0.75}>
                            {items.map((s) => {
                                const agent = byId(s.agentId);
                                return (
                                    <Press
                                        key={s.id}
                                        onClick={() => setEditing(s)}
                                        haptic="light"
                                        pressScale={0.99}
                                        activeBg={theme.palette.action.hover}
                                        style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 10,
                                            padding: "10px 12px",
                                            borderRadius: 10,
                                            textAlign: "left",
                                            border: `1px solid ${theme.palette.divider}`,
                                            opacity: s.enabled ? 1 : 0.6,
                                        }}
                                    >
                                        <span style={{ fontSize: 15, lineHeight: "18px", flex: "none" }}>
                                            {agent?.emoji ?? "🔎"}
                                        </span>
                                        <span style={{ minWidth: 0, flex: 1 }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                                <b>{timeLabel(s.hour, s.minute)}</b>
                                                <span style={{ color: theme.palette.text.secondary }}>{daysLabel(s.days)}</span>
                                                {/* 꺼진 예약을 목록에서 지우면 "사라졌다" 로 읽힌다. 남기고 상태를 적는다. */}
                                                {!s.enabled && (
                                                    <span style={{ fontSize: 11, color: theme.palette.text.disabled }}>꺼짐</span>
                                                )}
                                            </span>
                                            <span
                                                style={{
                                                    display: "block", marginTop: 2, fontSize: 11.5,
                                                    color: theme.palette.text.disabled,
                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                }}
                                            >
                                                {agent ? `${agent.name} · ` : ""}{s.prompt}
                                            </span>
                                        </span>
                                    </Press>
                                );
                            })}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={onClose} color="inherit">닫기</Button>
                    {/* 걸 수 있는 역할이 없으면 버튼을 두지 않는다 — 눌러봐야 막다른 길이다 */}
                    {schedulable.length > 0 && (
                        <Button onClick={() => setEditing({})} variant="contained">예약 추가</Button>
                    )}
                </DialogActions>
            </Dialog>

            {editing && (
                <ScheduleEditDialog
                    schedule={editing}
                    agents={schedulable}
                    onClose={() => setEditing(null)}
                    onSaved={reload}
                />
            )}
        </>
    );
}

function ScheduleEditDialog({ schedule, agents, onClose, onSaved }) {
    const theme = useTheme();
    const editing = Boolean(schedule?.id);

    const [agentId, setAgentId] = useState(schedule?.agentId ?? agents[0]?.id ?? "");
    const [prompt, setPrompt] = useState(schedule?.prompt ?? "오늘 뭐부터 하면 좋을까?");
    const [time, setTime] = useState(toTimeInput(schedule?.hour ?? 8, schedule?.minute ?? 0));
    const [days, setDays] = useState(schedule?.days ?? DAILY);
    const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const picked = days === DAILY ? [...DAY_TOKENS] : String(days).split(",").map((d) => d.trim());

    const toggleDay = (d) => {
        const next = picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d];
        // 하나도 안 고르면 영원히 안 도는 예약이 된다 — 매일로 되돌린다(서버도 같은 규칙)
        if (next.length === 0 || next.length === 7) return setDays(DAILY);
        setDays(DAY_TOKENS.filter((t) => next.includes(t)).join(","));
    };

    const save = async () => {
        if (!agentId) return setError("역할을 고르세요.");
        if (!prompt.trim()) return setError("무엇을 물어볼지 적어주세요.");
        const [h, m] = time.split(":");
        setSaving(true);
        setError("");
        try {
            const payload = {
                agentId,
                prompt: prompt.trim(),
                hour: Number(h) || 0,
                minute: Number(m) || 0,
                days,
                enabled,
            };
            if (editing) await updateSchedule(schedule.id, payload);
            else await createSchedule(payload);
            onSaved();
            onClose();
        } catch (e) {
            // 저장이 안 됐는데 닫히면 사용자는 저장된 줄 안다 — 열어둔 채 이유를 보여준다
            setError(e?.response?.data?.message || "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setSaving(true);
        try {
            await deleteSchedule(schedule.id);
            onSaved();
            onClose();
        } catch (e) {
            setError(e?.response?.data?.message || "삭제하지 못했어요.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ pb: 1 }}>{editing ? "예약 수정" : "예약 추가"}</DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {error && <Alert severity="error" sx={{ fontSize: 12.5 }}>{error}</Alert>}

                    <Box>
                        <FieldLabel>역할</FieldLabel>
                        <Stack spacing={0.5}>
                            {agents.map((a) => {
                                const active = a.id === agentId;
                                return (
                                    <Press
                                        key={a.id}
                                        onClick={() => setAgentId(a.id)}
                                        haptic="light"
                                        pressScale={0.99}
                                        activeBg={theme.palette.action.hover}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "8px 10px", borderRadius: 10, textAlign: "left",
                                            backgroundColor: active ? alpha(theme.palette.primary.main, 0.10) : "transparent",
                                            border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.32) : theme.palette.divider}`,
                                        }}
                                    >
                                        <span style={{ fontSize: 15, flex: "none" }}>{a.emoji ?? "🔎"}</span>
                                        <span style={{ minWidth: 0, flex: 1 }}>
                                            <span style={{ fontSize: 13, fontWeight: active ? 700 : 600 }}>{a.name}</span>
                                            {a.description && (
                                                <span
                                                    style={{
                                                        display: "block", fontSize: 11.5,
                                                        color: theme.palette.text.disabled,
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {a.description}
                                                </span>
                                            )}
                                        </span>
                                    </Press>
                                );
                            })}
                        </Stack>
                    </Box>

                    <Box>
                        <FieldLabel>물어볼 내용</FieldLabel>
                        <TextField
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
                            placeholder="예: 오늘 뭐부터 하면 좋을까?"
                            fullWidth
                            size="small"
                            sx={fieldSx}
                        />
                    </Box>

                    <Box>
                        <FieldLabel>시각</FieldLabel>
                        <TextField
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            fullWidth
                            size="small"
                            sx={fieldSx}
                        />
                    </Box>

                    <Box>
                        <FieldLabel>요일 · {daysLabel(days)}</FieldLabel>
                        <Stack direction="row" spacing={0.5}>
                            {DAY_TOKENS.map((d) => {
                                const on = picked.includes(d);
                                return (
                                    <Press
                                        key={d}
                                        onClick={() => toggleDay(d)}
                                        haptic="light"
                                        pressScale={0.95}
                                        style={{
                                            /* Press 는 motion.div(블록)를 그린다. flex 정렬을 안 주면
                                               글자가 좌상단에 붙는다 — 이 파일의 다른 Press 들은 전부
                                               display:flex 를 갖고 있는데 여기만 빠져 있었다.
                                               높이는 숫자로 고정한다. 상속된 line-height 에 따라 세로
                                               크기가 들쭉날쭉해지지 않게. */
                                            flex: 1, height: 36, borderRadius: 8,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 12, fontWeight: 700, lineHeight: 1,
                                            backgroundColor: on ? theme.palette.primary.main : "transparent",
                                            color: on ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                                            border: `1px solid ${on ? theme.palette.primary.main : theme.palette.divider}`,
                                        }}
                                    >
                                        {DAY_LABELS[d]}
                                    </Press>
                                );
                            })}
                        </Stack>
                    </Box>

                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>예약 켜기</Typography>
                            <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>
                                꺼두면 지우지 않고 잠시 멈출 수 있어요
                            </Typography>
                        </Box>
                        <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                    </Stack>

                    <Divider />
                    {/* 비용을 문구로 적는다 — 하루 한도가 왜 닳는지 모르면 기능을 의심하게 된다 */}
                    <Typography sx={{ fontSize: 11.5, color: "text.disabled", lineHeight: 1.7 }}>
                        예약이 한 번 돌 때마다 하루 AI 사용량을 씁니다. 남은 양이 없으면 그날은 건너뛰어요.
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                {editing && (
                    <Button onClick={remove} disabled={saving} color="error" sx={{ mr: "auto" }}>
                        삭제
                    </Button>
                )}
                <Button onClick={onClose} disabled={saving} color="inherit">취소</Button>
                <Button onClick={save} disabled={saving} variant="contained">저장</Button>
            </DialogActions>
        </Dialog>
    );
}
