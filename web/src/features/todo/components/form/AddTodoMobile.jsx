import React, { useMemo, useState } from "react";
import {
    Box,
    IconButton,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { useActiveProject } from "../../../project/context/ActiveProjectContext.jsx";
import { useProjects } from "../../../project/store/projectStore.js";
import { buildProjectOptions, getDefaultProjectScope } from "../../../project/utils/projectOptions.js";
import ProjectOptionLabel from "../../../project/components/ProjectOptionLabel.jsx";
import { useKeyboardOffset } from "../../../../shared/hooks/useKeyboardOffset.js";
import Sheet from "../../../../shared/ui/primitives/Sheet.jsx";
import CardSection from "../../../../shared/ui/common/CardSection.jsx";
import FieldLabel from "../../../../shared/ui/common/FieldLabel.jsx";
import Press from "../../../../shared/ui/primitives/Press.jsx";
import SegmentedControl from "../../../../shared/ui/common/SegmentedControl.jsx";
import UserAvatar from "../../../../shared/ui/common/UserAvatar.jsx";
import RichTextEditor from "../../../../shared/ui/editor/RichTextEditor.jsx";
import LocationPickerField from "../../../map/components/LocationPickerField.jsx";
import {
    PRIORITY_OPTIONS, PRIORITY_LABEL, priorityColor,
} from "../../../../shared/ui/tone.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../../workspace/hooks/useWorkspacePermissions.js";
import AddStatusDialog from "../board/AddStatusDialog.jsx";
import { getOptionValue } from "../../../../shared/utils/assigneeUtils.js";
import { RECURRENCE_OPTIONS } from "../../constants/recurrence.js";
import { Z } from "../../../../shared/ui/zIndex.js";
import { inputSxFlat } from "../../../../shared/ui/inputSx.js";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function quickDate(kind) {
    const d = new Date();
    if (kind === "tomorrow") d.setDate(d.getDate() + 1);
    else if (kind === "thisWeek") d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    else if (kind === "nextWeek") d.setDate(d.getDate() + 7);
    return ymd(d);
}
const PICKER_TITLE = { proj: "프로젝트", due: "마감일", prio: "우선순위", status: "상태", assign: "담당자" };

export default function AddTodoMobile({
    open, onClose, task, setTask, setTouched, userList, titleError, dateError,
    canSave, handleSave, submitting = false, onKeyDown, setEditable, setSelectedAssignees,
    location, setLocation, templates = [], onApplyTemplate,
    pendingRecurrenceType = "NONE", setPendingRecurrenceType,
    pendingRecurrenceEndDate = "", setPendingRecurrenceEndDate,
}) {
    const theme = useTheme();
    const kbOffset = useKeyboardOffset();
    const [tplSheetOpen, setTplSheetOpen] = useState(false);
    const [showDesc, setShowDesc] = useState(Boolean(task?.content));
    const [adv, setAdv] = useState(false);
    const [picker, setPicker] = useState(null); // proj | due | prio | status | assign
    const [dueQuick, setDueQuick] = useState(null); // 선택된 빠른날짜 종류 (중복 하이라이트 방지)
    const [addStatusOpen, setAddStatusOpen] = useState(false);

    /* 상태는 워크스페이스 커스텀 상태 집합이 단일 소스 — 고정 3개(tone.js STATUS_OPTIONS)를 쓰면
       커스텀 컬럼에서 추가할 때 내부 key(st_xxx)가 그대로 노출되고, 고르는 순간 기본 상태로 덮어써졌다. */
    const { statuses: statusDefs, label: statusLabelOf, colorOf: statusColorOf } = useStatuses();
    const { canManageWorkspace } = useWorkspacePermissions();

    const assigneeOptions = useMemo(() => userList ?? [], [userList]);
    const { activeProjectId } = useActiveProject();
    const projects = useProjects();
    const projectOptions = buildProjectOptions(projects);
    const projectScopeValue = getDefaultProjectScope(task, activeProjectId);
    const selProject = projectOptions.find((o) => o.key === projectScopeValue) ?? projectOptions[0];
    const ProjIcon = selProject?.icon ?? FolderRoundedIcon;

    const selectedAssigneeValues = useMemo(() => (Array.isArray(task?.assignees) ? task.assignees.map(getOptionValue) : []), [task?.assignees]);
    const handleAssigneesChange = (nextValues) => {
        setTask((prev) => ({ ...prev, assignees: nextValues }));
        setEditable?.((prev) => ({ ...prev, assignees: nextValues }));
        setSelectedAssignees?.(nextValues);
    };
    const toggleAssignee = (val) => {
        const cur = selectedAssigneeValues;
        handleAssigneesChange(cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
    };

    const set = (patch) => setTask((prev) => ({ ...prev, ...patch }));
    const priColor = (p) => priorityColor(theme, p);
    const inputSx = inputSxFlat();
    const hasTime = task?.allDay === false;

    const assigneeLabel = (() => {
        const a = task?.assignees ?? [];
        if (a.length === 0) return "담당자";
        const first = assigneeOptions.find((u) => getOptionValue(u) === getOptionValue(a[0]))?.name ?? "담당자";
        return a.length === 1 ? first : `${first} 외 ${a.length - 1}`;
    })();

    // ── 메타 칩 ──
    const chip = ({ key, icon, color, label, active, onClick }) => (
        <Press key={key} onClick={onClick} haptic="light" pressScale={0.96}
            style={{
                display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 10,
                border: `1px solid ${theme.palette.divider}`, background: "var(--plando-input-bg)",
                color: active ? theme.palette.text.primary : theme.palette.text.secondary, fontSize: 13, fontWeight: 700,
            }}>
            {icon && <span style={{ display: "flex", color: color || theme.palette.text.disabled }}>{icon}</span>}
            <span style={{ maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            <KeyboardArrowDownRoundedIcon style={{ fontSize: 16, color: theme.palette.text.disabled }} />
        </Press>
    );

    const pickRow = ({ key, selected, onClick, icon, label }) => (
        <Press key={key} onClick={onClick} haptic="light" activeBg={theme.palette.action.hover}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 12, width: "100%" }}>
            {icon}
            <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 700, color: selected ? theme.palette.primary.main : theme.palette.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            {selected && <CheckRoundedIcon style={{ fontSize: 18, color: theme.palette.primary.main }} />}
        </Press>
    );

    const dot = (color) => <span style={{ width: 10, height: 10, borderRadius: 99, background: color, flexShrink: 0 }} />;

    // ── 피커(중첩 시트) 내용 ──
    const pickerBody = () => {
        if (picker === "proj") return <Box sx={{ p: 1 }}>{projectOptions.map((opt) => (
            <Press key={opt.key} onClick={() => { set({ projectScope: opt.key }); setPicker(null); }} haptic="light" activeBg={theme.palette.action.hover}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 14px", borderRadius: 12, width: "100%" }}>
                <span style={{ flex: 1, textAlign: "left", display: "flex" }}><ProjectOptionLabel option={opt} iconSize={18} spacing={1} /></span>
                {opt.key === projectScopeValue && <CheckRoundedIcon style={{ fontSize: 18, color: theme.palette.primary.main }} />}
            </Press>
        ))}</Box>;

        if (picker === "prio") return <Box sx={{ p: 1 }}>{PRIORITY_OPTIONS.map((o) => pickRow({
            key: o.value, selected: (task?.priority || "MEDIUM") === o.value, onClick: () => { set({ priority: o.value }); setPicker(null); },
            icon: <FlagRoundedIcon sx={{ fontSize: 18, color: priColor(o.value) }} />, label: o.label,
        }))}</Box>;

        if (picker === "status") return <Box sx={{ p: 1 }}>
            {statusDefs.map((s) => pickRow({
                key: s.statusKey, selected: (task?.status || "TODO") === s.statusKey,
                onClick: () => { set({ status: s.statusKey }); setPicker(null); },
                icon: dot(s.color || statusColorOf(s.statusKey)), label: s.label,
            }))}
            {/* 데스크탑(AddTodoDesktop)과 동일하게 여기서 바로 상태를 만들 수 있다. ADMIN+에게만 노출 —
                권한이 없으면 서버가 403이라 아예 렌더하지 않는다(눌리는데 실패하는 버튼 금지). */}
            {canManageWorkspace && pickRow({
                key: "__add",
                selected: false,
                onClick: () => { setPicker(null); setAddStatusOpen(true); },
                icon: <AddRoundedIcon style={{ fontSize: 18, color: theme.palette.text.secondary }} />,
                label: "새 상태 만들기",
            })}
        </Box>;

        if (picker === "assign") return <Box sx={{ p: 1 }}>
            {assigneeOptions.length === 0 ? (
                <Typography sx={{ fontSize: 14, color: "text.disabled", textAlign: "center", py: 3 }}>참여 가능한 멤버가 없어요</Typography>
            ) : assigneeOptions.map((u) => {
                const val = getOptionValue(u);
                const selected = selectedAssigneeValues.includes(val);
                return pickRow({
                    key: val, selected, onClick: () => toggleAssignee(val),
                    icon: <UserAvatar name={u.name} src={u.profileImageUrl} size={26} />, label: u.name,
                });
            })}
        </Box>;

        if (picker === "due") return <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {[{ k: "today", l: "오늘" }, { k: "tomorrow", l: "내일" }, { k: "thisWeek", l: "이번 주" }, { k: "nextWeek", l: "다음 주" }].map((q) => {
                    const v = quickDate(q.k);
                    const on = dueQuick === q.k;
                    return (
                        <Press key={q.k} onClick={() => { set({ dueDate: v }); setDueQuick(q.k); }} haptic="light" pressScale={0.96}
                            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 38, padding: "0 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, lineHeight: 1,
                                border: `1px solid ${on ? theme.palette.primary.main : theme.palette.divider}`,
                                background: on ? theme.palette.primary.main : "var(--plando-input-bg)", color: on ? "#fff" : theme.palette.text.secondary }}>
                            {q.l}
                        </Press>
                    );
                })}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, mt: 2 }}>
                <Box>
                    <FieldLabel>시작일</FieldLabel>
                    <TextField type="date" size="small" fullWidth value={task?.startAt || ""} onChange={(e) => set({ startAt: e.target.value })} InputLabelProps={{ shrink: true }} sx={inputSx} />
                </Box>
                <Box>
                    <FieldLabel>마감일</FieldLabel>
                    <TextField type="date" size="small" fullWidth value={task?.dueDate || ""} onChange={(e) => { set({ dueDate: e.target.value }); setDueQuick(null); }} InputLabelProps={{ shrink: true }} error={Boolean(dateError)} helperText={dateError || " "} sx={inputSx} />
                </Box>
            </Box>
            {task?.dueDate && (
                <Box sx={{ mt: 2 }}>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ px: 0.5 }}>
                        <AccessTimeRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                        <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700, color: "text.secondary" }}>하루 종일</Typography>
                        <Switch size="small" checked={task?.allDay !== false} onChange={(e) => set({ allDay: e.target.checked, ...(e.target.checked ? { startTime: "", endTime: "" } : {}) })} />
                    </Stack>
                    {hasTime && (
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, mt: 1 }}>
                            <Box><FieldLabel>시작</FieldLabel><TextField type="time" size="small" fullWidth value={task?.startTime || ""} onChange={(e) => set({ startTime: e.target.value })} sx={inputSx} /></Box>
                            <Box><FieldLabel>종료</FieldLabel><TextField type="time" size="small" fullWidth value={task?.endTime || ""} onChange={(e) => set({ endTime: e.target.value })} sx={inputSx} /></Box>
                        </Box>
                    )}
                    <Press onClick={() => { set({ dueDate: "", allDay: true, startTime: "", endTime: "" }); setDueQuick(null); setPicker(null); }} haptic="light"
                        style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, color: theme.palette.error.main, fontSize: 13.5, fontWeight: 700, display: "block", textAlign: "left", width: "100%" }}>
                        날짜 지우기
                    </Press>
                </Box>
            )}
        </Box>;

        return null;
    };

    // ── 헤더 ──
    const header = (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, pt: 0.5, pb: 1.25 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>할 일 추가</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center">
                {templates.length > 0 && (
                    <Press onClick={() => setTplSheetOpen(true)} haptic="light" pressScale={0.94}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, border: `1px solid ${theme.palette.primary.main}`, color: theme.palette.primary.main, fontSize: 12.5, fontWeight: 700 }}>
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} /> 템플릿
                    </Press>
                )}
                <IconButton onClick={onClose} aria-label="닫기" size="small" sx={{ width: 36, height: 36, bgcolor: "var(--plando-input-bg)", color: "text.secondary", "&:hover": { bgcolor: "var(--plando-input-bg-hover)" } }}>
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Stack>
        </Box>
    );

    // ── 푸터 ──
    const footer = (
        <Box sx={{ px: 2, pt: 1.25, pb: kbOffset > 0 ? `${kbOffset + 12}px` : "12px", borderTop: 1, borderColor: "divider", bgcolor: "background.paper", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, transition: "padding-bottom 0.15s ease" }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "text.disabled" }}>제목 필수 · 날짜는 선택</Typography>
            <Press onClick={handleSave} disabled={!canSave || submitting} haptic="medium" pressScale={0.96}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 46, padding: "0 24px", borderRadius: 999,
                    background: canSave && !submitting ? theme.palette.primary.main : theme.palette.mode === "dark" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)",
                    color: canSave && !submitting ? "#fff" : theme.palette.text.secondary, fontSize: 15, fontWeight: 800,
                    boxShadow: canSave && !submitting ? `0 6px 18px ${theme.palette.primary.main}55` : "none", border: "none" }}>
                추가 <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
            </Press>
        </Box>
    );

    // ── 본문 (칩 압축형) ──
    const body = (
        <Box sx={{ p: "16px 16px 10px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* 제목 */}
            <Box>
                <Box component="input" value={task?.title ?? ""} onChange={(e) => set({ title: e.target.value })} onBlur={() => setTouched?.(true)}
                    placeholder="할 일 제목을 입력하세요"
                    sx={{ width: "100%", border: "none", background: "transparent", color: "text.primary", fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", outline: "none", fontFamily: "inherit", "&::placeholder": { color: "text.disabled" } }} />
                {titleError && <Typography sx={{ fontSize: 12, fontWeight: 700, color: "error.main", mt: 0.5 }}>{titleError}</Typography>}
                {showDesc ? (
                    <Box sx={{ mt: 1.25 }}>
                        <RichTextEditor
                            value={task?.content ?? ""}
                            placeholder="내용 입력, '/' 로 명령어 사용"
                            ariaLabel="내용"
                            minHeight={56}
                            slashMenu
                            onChange={(md) => set({ content: md })}
                        />
                    </Box>
                ) : (
                    <Press onClick={() => setShowDesc(true)} haptic="light"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, height: 32, padding: "0 12px", borderRadius: 8, color: theme.palette.text.disabled, fontSize: 13, fontWeight: 700 }}>
                        <NotesRoundedIcon sx={{ fontSize: 16 }} /> 설명 추가
                    </Press>
                )}
            </Box>

            {/* 메타 칩 */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {chip({ key: "proj", icon: <ProjIcon sx={{ fontSize: 16 }} />, color: selProject?.color || undefined, label: selProject?.label ?? "프로젝트", active: selProject?.key !== "inbox", onClick: () => setPicker("proj") })}
                {chip({ key: "due", icon: <EventRoundedIcon sx={{ fontSize: 16 }} />, label: task?.dueDate || "날짜", active: Boolean(task?.dueDate), onClick: () => setPicker("due") })}
                {chip({ key: "prio", icon: <FlagRoundedIcon sx={{ fontSize: 16 }} />, color: priColor(task?.priority || "MEDIUM"), label: PRIORITY_LABEL[task?.priority] ?? "중간", active: (task?.priority || "MEDIUM") !== "MEDIUM", onClick: () => setPicker("prio") })}
                {chip({ key: "status", icon: <PlayCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />, color: statusColorOf(task?.status || "TODO"), label: statusLabelOf(task?.status || "TODO"), active: (task?.status || "TODO") !== "TODO", onClick: () => setPicker("status") })}
                {chip({ key: "assign", icon: <PersonRoundedIcon sx={{ fontSize: 16 }} />, label: assigneeLabel, active: (task?.assignees ?? []).length > 0, onClick: () => setPicker("assign") })}
            </Box>

            {/* 고급 옵션 */}
            <Press onClick={() => setAdv((a) => !a)} haptic="light"
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 2px", borderTop: `1px solid ${theme.palette.divider}`, color: theme.palette.text.disabled, fontSize: 13, fontWeight: 800 }}>
                <ChevronRightRoundedIcon sx={{ fontSize: 16, transform: adv ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                고급 옵션
                <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.7 }}>반복 · 장소</span>
            </Press>

            {adv && (
                <Stack spacing="12px">
                    {/* 반복 */}
                    <CardSection>
                        <FieldLabel icon={<RepeatRoundedIcon sx={{ fontSize: 14 }} />}>반복 일정</FieldLabel>
                        <SegmentedControl fullWidth options={RECURRENCE_OPTIONS} value={pendingRecurrenceType} onChange={(v) => setPendingRecurrenceType?.(v)} />
                        {pendingRecurrenceType !== "NONE" && (
                            <Box sx={{ mt: 1.5 }}>
                                <FieldLabel>반복 종료일 (선택)</FieldLabel>
                                <TextField fullWidth size="small" type="date" value={pendingRecurrenceEndDate} onChange={(e) => setPendingRecurrenceEndDate?.(e.target.value)} InputLabelProps={{ shrink: true }} sx={inputSx} />
                            </Box>
                        )}
                    </CardSection>

                    {/* 장소 */}
                    <CardSection>
                        <FieldLabel icon={<PlaceRoundedIcon sx={{ fontSize: 14 }} />}>장소 <Box component="span" sx={{ ml: 0.5, color: "text.disabled", fontWeight: 500 }}>(현장 일정만)</Box></FieldLabel>
                        <LocationPickerField
                            value={location ?? (task?.locationName ? { locationName: task.locationName, locationAddress: task.locationAddress, locationLat: task.locationLat, locationLng: task.locationLng } : null)}
                            onChange={(loc) => {
                                if (setLocation) setLocation(loc);
                                set({ locationName: loc?.locationName ?? null, locationAddress: loc?.locationAddress ?? null, locationLat: loc?.locationLat ?? null, locationLng: loc?.locationLng ?? null });
                            }}
                        />
                    </CardSection>
                </Stack>
            )}
        </Box>
    );

    return (
        <>
            <Sheet open={open} onClose={onClose} height="86dvh" onKeyDown={onKeyDown} header={header} footer={footer}>
                {body}
            </Sheet>

            {/* 템플릿 시트 */}
            <Sheet open={tplSheetOpen} onClose={() => setTplSheetOpen(false)} height="60dvh" zIndex={Z.MODAL_NESTED}
                header={<Box sx={{ px: 2.5, pt: 0.75, pb: 1.5, borderBottom: 1, borderColor: "divider" }}><Typography sx={{ fontSize: 17, fontWeight: 800 }}>템플릿 선택</Typography></Box>}>
                <Box>
                    {templates.map((tpl) => (
                        <Press key={tpl.id} onClick={() => { onApplyTemplate?.(tpl); setTplSheetOpen(false); }} haptic="light" pressScale={0.99} activeBg={theme.palette.action.hover}
                            style={{ display: "block", padding: "14px 20px", borderBottom: `1px solid ${theme.palette.divider}` }}>
                            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{tpl.name}</Typography>
                            {tpl.defaultTitle && <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.4 }}>{tpl.defaultTitle}</Typography>}
                        </Press>
                    ))}
                </Box>
            </Sheet>

            {/* 메타 칩 피커 시트 */}
            <Sheet open={Boolean(picker)} onClose={() => setPicker(null)} height={picker === "proj" || picker === "assign" ? "60dvh" : "auto"} zIndex={Z.MODAL_NESTED}
                header={<Box sx={{ px: 2.5, pt: 0.75, pb: 1.5, borderBottom: 1, borderColor: "divider" }}><Typography sx={{ fontSize: 17, fontWeight: 800 }}>{PICKER_TITLE[picker] ?? ""}</Typography></Box>}>
                {pickerBody()}
            </Sheet>

            {/* 새 상태 만들기 — 만들자마자 이 할 일의 상태로 선택 (데스크탑과 동일 동작) */}
            <AddStatusDialog
                open={addStatusOpen}
                onClose={() => setAddStatusOpen(false)}
                onCreated={(s) => s?.statusKey && set({ status: s.statusKey })}
                zIndex={Z.DIALOG}   // 할 일 추가 시트(Z.SHEET) 위에 떠야 함
            />
        </>
    );
}
