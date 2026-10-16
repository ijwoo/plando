import React, { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { updateStatus, deleteStatus, reorderStatuses, setDefaultStatus } from "../../api/statusApi.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import { toast } from "../../../../shared/utils/toast.js";
import { getApiError } from "../../../../shared/api/axiosInstance.js";

const CATS = [{ value: "TODO", label: "미시작" }, { value: "IN_PROGRESS", label: "진행" }, { value: "DONE", label: "완료" }];
const COLORS = ["#94A3B8", "#3070EB", "#22B8A6", "#F59E0B", "#7C3AED", "#EC4899", "#0EA5E9", "#E5484D"];
const catLabel = (c) => CATS.find((x) => x.value === c)?.label ?? c;

/** 커스텀 상태 통합 관리 — 편집(이름·색·카테고리)·기본지정·순서·삭제(재배정). ADMIN+. */
export default function ManageStatusesDialog({ open, onClose }) {
    const { statuses, reloadStatuses } = useStatuses();
    const [editId, setEditId] = useState(null);
    const [draft, setDraft] = useState({ label: "", category: "TODO", color: COLORS[0] });
    const [delTarget, setDelTarget] = useState(null); // 삭제 대상 status
    const [reassignTo, setReassignTo] = useState("");
    const [busy, setBusy] = useState(false);

    const fire = () => window.dispatchEvent(new Event(APP_EVENTS.STATUSES_CHANGED));

    const startEdit = (s) => { setEditId(s.id); setDraft({ label: s.label, category: s.category, color: s.color || COLORS[0] }); };
    const saveEdit = async (s) => {
        const label = draft.label.trim();
        if (!label) return;
        setBusy(true);
        try {
            await updateStatus(s.id, { label, category: draft.category, color: draft.color });
            fire();
            reloadStatuses();
            // 카테고리가 바뀌면 서버가 해당 상태의 할 일 doneAt을 backfill/clear 한다 →
            // 목록·완료 판정(isTodoDone)이 새로고침 없이 따라오도록 갱신 신호를 쏜다.
            if (draft.category !== s.category) {
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: {} }));
            }
            setEditId(null);
        }
        catch (e) { toast.error(getApiError(e, "수정에 실패했어요.")); }
        finally { setBusy(false); }
    };

    /**
     * 순서 이동.
     *
     * 목록은 StatusContext에서 "카테고리(미시작→진행→완료) 먼저, 그 안에서 sortOrder"로 정렬된다.
     * 그래서 카테고리 경계를 넘는 스왑은 서버에 저장돼도 다시 제자리로 정렬돼 아무 일도 일어나지
     * 않는다(무반응 버그). → 같은 카테고리 이웃이 있을 때만 이동을 허용하고, 없으면 버튼을
     * 비활성 + 이유 표기한다. (같은 카테고리끼리는 목록에서 항상 인접하므로 idx±1로 충분)
     */
    const canMove = (idx, dir) => {
        const j = idx + dir;
        return j >= 0 && j < statuses.length && statuses[j].category === statuses[idx].category;
    };
    const move = async (idx, dir) => {
        if (!canMove(idx, dir)) return;
        const arr = statuses.slice();
        const j = idx + dir;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        setBusy(true);
        try { await reorderStatuses(arr.map((s) => s.id)); fire(); reloadStatuses(); }
        catch (e) { toast.error(getApiError(e, "순서 변경에 실패했어요.")); }
        finally { setBusy(false); }
    };
    const makeDefault = async (s) => {
        setBusy(true);
        try { await setDefaultStatus(s.id); fire(); reloadStatuses(); }
        catch (e) { toast.error(getApiError(e, "기본 지정에 실패했어요.")); }
        finally { setBusy(false); }
    };
    const confirmDelete = async () => {
        if (!delTarget || !reassignTo) return;
        setBusy(true);
        try {
            await deleteStatus(delTarget.id, reassignTo);
            fire();
            reloadStatuses();
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: {} })); // 재배정된 할일 갱신
            setDelTarget(null); setReassignTo("");
            toast.success("상태를 삭제하고 할 일을 재배정했어요");
        } catch (e) { toast.error(getApiError(e, "삭제에 실패했어요.")); }
        finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>상태 관리</DialogTitle>
            <DialogContent>
                <Stack spacing={0.5}>
                    {statuses.map((s, idx) => (
                        <Box key={s.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
                            {editId === s.id ? (
                                <Stack spacing={1.25}>
                                    <TextField autoFocus size="small" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} inputProps={{ maxLength: 40 }} fullWidth />
                                    <Stack direction="row" spacing={1}>
                                        {CATS.map((c) => (
                                            <Box key={c.value} onClick={() => setDraft((d) => ({ ...d, category: c.value }))}
                                                sx={{ flex: 1, textAlign: "center", py: 0.5, borderRadius: 1.5, cursor: "pointer", border: "1px solid",
                                                    borderColor: draft.category === c.value ? "primary.main" : "divider",
                                                    bgcolor: draft.category === c.value ? "primary.main" : "transparent",
                                                    color: draft.category === c.value ? "primary.contrastText" : "text.secondary", fontSize: 12.5, fontWeight: 700 }}>
                                                {c.label}
                                            </Box>
                                        ))}
                                    </Stack>
                                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                                        {COLORS.map((c) => (
                                            <Box key={c} onClick={() => setDraft((d) => ({ ...d, color: c }))} sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: c, cursor: "pointer", outline: draft.color === c ? "2px solid" : "none", outlineColor: "text.primary", outlineOffset: 2 }} />
                                        ))}
                                    </Stack>
                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                        <Button size="small" color="inherit" onClick={() => setEditId(null)}>취소</Button>
                                        <Button size="small" variant="contained" onClick={() => saveEdit(s)} disabled={busy || !draft.label.trim()}>저장</Button>
                                    </Stack>
                                </Stack>
                            ) : (
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: s.color || "#94A3B8", flexShrink: 0 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75 }}>
                                            {s.label}
                                            {s.isDefault && <StarRoundedIcon sx={{ fontSize: 15, color: "warning.main" }} titleAccess="기본" />}
                                        </Typography>
                                        <Typography sx={{ fontSize: 11.5, color: "text.disabled" }}>{catLabel(s.category)}</Typography>
                                    </Box>
                                    {/* 비활성 IconButton은 title이 안 뜨므로 span으로 감싸 이유를 노출한다 */}
                                    <Box component="span" title={canMove(idx, -1) ? "위로" : `'${catLabel(s.category)}' 안에 위쪽 상태가 없어요`} sx={{ display: "inline-flex" }}>
                                        <IconButton size="small" disabled={busy || !canMove(idx, -1)} onClick={() => move(idx, -1)}><ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                                    </Box>
                                    <Box component="span" title={canMove(idx, 1) ? "아래로" : `'${catLabel(s.category)}' 안에 아래쪽 상태가 없어요`} sx={{ display: "inline-flex" }}>
                                        <IconButton size="small" disabled={busy || !canMove(idx, 1)} onClick={() => move(idx, 1)}><ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                                    </Box>
                                    <IconButton size="small" disabled={busy || s.isDefault} onClick={() => makeDefault(s)} title="기본 상태로">{s.isDefault ? <StarRoundedIcon sx={{ fontSize: 17, color: "warning.main" }} /> : <StarOutlineRoundedIcon sx={{ fontSize: 17 }} />}</IconButton>
                                    <IconButton size="small" disabled={busy} onClick={() => startEdit(s)}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                                    <IconButton size="small" disabled={busy} onClick={() => { setDelTarget(s); setReassignTo(statuses.find((x) => x.id !== s.id)?.statusKey ?? ""); }}><DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: "error.main" }} /></IconButton>
                                </Stack>
                            )}

                            {/* 삭제 확인(재배정) — 해당 행 아래 인라인 */}
                            {delTarget?.id === s.id && (
                                <Box sx={{ mt: 1.25, pt: 1.25, borderTop: "1px dashed", borderColor: "divider" }}>
                                    <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 1 }}>
                                        '{s.label}'의 할 일을 어느 상태로 옮길까요?
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Select size="small" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} sx={{ flex: 1 }}>
                                            {statuses.filter((x) => x.id !== s.id).map((x) => (
                                                <MenuItem key={x.id} value={x.statusKey}>{x.label}</MenuItem>
                                            ))}
                                        </Select>
                                        <Button size="small" color="inherit" onClick={() => { setDelTarget(null); setReassignTo(""); }}>취소</Button>
                                        <Button size="small" variant="contained" color="error" onClick={confirmDelete} disabled={busy || !reassignTo}>삭제</Button>
                                    </Stack>
                                </Box>
                            )}
                        </Box>
                    ))}
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 1.5, lineHeight: 1.7 }}>
                    · 완료·미시작 카테고리는 각각 최소 1개 필요합니다<br />
                    · 목록은 미시작 → 진행 → 완료 순으로 고정돼요. 순서 변경(↑↓)은 같은 카테고리 안에서만 가능합니다<br />
                    · 새 상태는 '할 일 추가 → 상태 → 새 상태 만들기'에서도 만들 수 있어요
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}
