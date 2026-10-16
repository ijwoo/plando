import React, { useMemo, useRef, useState } from "react";
import {
    Box, Modal, Typography, Stack, Switch, IconButton, Button, ButtonBase,
    TextField, Tooltip, Popover, Popper, Paper, CircularProgress,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";

import { useActiveProject } from "../../../project/context/ActiveProjectContext.jsx";
import { useProjects } from "../../../project/store/projectStore.js";
import { buildProjectOptions, getDefaultProjectScope } from "../../../project/utils/projectOptions.js";
import ProjectOptionLabel from "../../../project/components/ProjectOptionLabel.jsx";
import { PRIORITIES } from "../common/PriorityFlag.jsx";
import LocationPickerField from "../../../map/components/LocationPickerField.jsx";
import { PRIORITY_LABEL, priorityColor } from "../../../../shared/ui/tone.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../../workspace/hooks/useWorkspacePermissions.js";
import AddStatusDialog from "../board/AddStatusDialog.jsx";
import { Z } from "../../../../shared/ui/zIndex.js";
import UserAvatar from "../../../../shared/ui/common/UserAvatar.jsx";
import RichTextEditor from "../../../../shared/ui/editor/RichTextEditor.jsx";

const RECURRENCE_OPTIONS = [
    { value: "NONE", label: "반복 없음" },
    { value: "DAILY", label: "매일" },
    { value: "WEEKLY", label: "매주" },
    { value: "MONTHLY", label: "매월" },
];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function quickDate(kind) {
    const d = new Date();
    if (kind === "tomorrow") d.setDate(d.getDate() + 1);
    else if (kind === "thisWeek") d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7)); // 이번 주 토요일
    else if (kind === "nextWeek") d.setDate(d.getDate() + 7);
    return ymd(d);
}

// ── 칩(메타) — 클릭 시 팝오버 ─────────────────────────────────────────────
function MetaChip({ icon, color, label, active, popWidth = 220, children }) {
    const [anchor, setAnchor] = useState(null);
    return (
        <>
            <ButtonBase
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                    height: 34, px: 1.25, borderRadius: "9px", gap: 0.75,
                    border: "1px solid", borderColor: "divider",
                    bgcolor: "var(--plando-surface-low)",
                    color: active ? "text.primary" : "text.secondary",
                    fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.01em",
                    "&:hover": { bgcolor: "var(--plando-surface-mid, var(--plando-surface-low))", borderColor: "var(--plando-border)" },
                }}
            >
                {icon && <Box component="span" sx={{ display: "flex", color: color || "text.disabled" }}>{icon}</Box>}
                <Box component="span" sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</Box>
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 15, color: "text.disabled", ml: "-2px" }} />
            </ButtonBase>
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                sx={{ zIndex: Z.MODAL_NESTED }}
                slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "13px", border: "1px solid", borderColor: "divider", boxShadow: "0 18px 50px rgba(0,0,0,0.28)", minWidth: popWidth, p: 0.75 } } }}
            >
                {typeof children === "function" ? children(() => setAnchor(null)) : children}
            </Popover>
        </>
    );
}

function PopItem({ selected, onClick, icon, children }) {
    return (
        <ButtonBase
            onClick={onClick}
            sx={{
                width: "100%", justifyContent: "flex-start", gap: 1.25, px: 1.25, py: 1, borderRadius: "9px",
                fontSize: 13, fontWeight: 700, color: selected ? "primary.main" : "text.secondary",
                bgcolor: selected ? "var(--plando-primary-soft)" : "transparent",
                "&:hover": { bgcolor: selected ? "var(--plando-primary-soft)" : "action.hover", color: selected ? "primary.main" : "text.primary" },
            }}
        >
            {icon}
            <Box component="span" sx={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</Box>
            {selected && <CheckRoundedIcon sx={{ fontSize: 16 }} />}
        </ButtonBase>
    );
}

const Dot = ({ color }) => <Box sx={{ width: 9, height: 9, borderRadius: "3px", bgcolor: color, flexShrink: 0 }} />;

export default function AddTodoDesktop({
    open, onClose, task, setTask, setTouched,
    userList, loadingUsers, titleError, dateError, canSave, handleSave, submitting = false,
    onKeyDown, location, setLocation, templates = [], onApplyTemplate,
    pendingRecurrenceType = "NONE", setPendingRecurrenceType,
    pendingRecurrenceEndDate = "", setPendingRecurrenceEndDate,
}) {
    const theme = useTheme();
    const assigneeOptions = useMemo(() => userList ?? [], [userList]);
    const titleRef = useRef(null);
    const templateBtnRef = useRef(null);
    const [tplOpen, setTplOpen] = useState(false);
    const [showDesc, setShowDesc] = useState(Boolean(task?.content));
    const [adv, setAdv] = useState(false);
    const [dueQuick, setDueQuick] = useState(null); // 선택된 빠른날짜 종류 (날짜 충돌 시 중복 하이라이트 방지)

    const { activeProjectId } = useActiveProject();
    const projects = useProjects();
    const projectOptions = buildProjectOptions(projects);
    const projectScopeValue = getDefaultProjectScope(task, activeProjectId);
    const selProject = projectOptions.find((o) => o.key === projectScopeValue) ?? projectOptions[0];
    const ProjIcon = selProject?.icon ?? FolderRoundedIcon;

    const set = (patch) => setTask((prev) => ({ ...prev, ...patch }));
    const { statuses: statusDefs, colorOf: statusColorOf, label: statusLabelOf } = useStatuses();
    const { canManageWorkspace } = useWorkspacePermissions();
    const [addStatusOpen, setAddStatusOpen] = useState(false);

    const priColor = (p) => priorityColor(theme, p);

    const dueText = task.dueDate || "날짜";
    const hasTime = task.allDay === false;

    const toggleAssignee = (email) => set({
        assignees: (task.assignees ?? []).includes(email)
            ? (task.assignees ?? []).filter((x) => x !== email)
            : [...(task.assignees ?? []), email],
    });
    const assigneeLabel = (() => {
        const a = task.assignees ?? [];
        if (a.length === 0) return "담당자";
        const first = assigneeOptions.find((u) => u.email === a[0])?.name ?? a[0];
        return a.length === 1 ? first : `${first} 외 ${a.length - 1}`;
    })();

    const fieldSx = {
        "& .MuiOutlinedInput-root": { borderRadius: "9px", fontSize: 13, bgcolor: "var(--plando-surface-low)" },
    };
    const sectionLabelSx = { display: "flex", alignItems: "center", gap: 0.75, fontSize: 11.5, fontWeight: 800, color: "text.disabled", letterSpacing: "0.04em", textTransform: "uppercase", mb: 1 };

    return (
        <>
        <Modal open={open} onClose={onClose}>
            <Box
                onKeyDown={onKeyDown}
                sx={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    width: { xs: "94vw", sm: 560 }, maxHeight: "90vh",
                    bgcolor: "background.paper", borderRadius: "18px", border: "1px solid", borderColor: "divider",
                    boxShadow: theme.palette.mode === "dark" ? "0 40px 100px rgba(0,0,0,0.6)" : "0 30px 80px rgba(15,23,42,0.22)",
                    display: "flex", flexDirection: "column", overflow: "hidden", outline: "none",
                }}
            >
                {/* 헤더 */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>할 일 추가</Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.disabled", mt: "2px" }}>⌘+Enter 저장 · Esc 닫기</Typography>
                    </Box>
                    {templates.length > 0 && (
                        <>
                            <Button ref={templateBtnRef} size="small" onClick={() => setTplOpen((p) => !p)}
                                startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: "15px !important" }} />}
                                sx={{ height: 32, borderRadius: "9px", fontSize: 12.5, fontWeight: 700, color: "primary.main", border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.4) }}>
                                템플릿
                            </Button>
                            <Popper open={tplOpen} anchorEl={templateBtnRef.current} placement="bottom-end" style={{ zIndex: Z.MODAL_NESTED }}>
                                <Paper elevation={8} sx={{ borderRadius: "12px", border: "1px solid", borderColor: "divider", minWidth: 190, overflow: "hidden", mt: 0.5 }}>
                                    {templates.map((tpl) => (
                                        <Box key={tpl.id} onClick={() => { onApplyTemplate?.(tpl); setTplOpen(false); }}
                                            sx={{ px: 2, py: 1.25, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: "none" } }}>
                                            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{tpl.name}</Typography>
                                            {tpl.defaultTitle && <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.25 }}>{tpl.defaultTitle}</Typography>}
                                        </Box>
                                    ))}
                                </Paper>
                            </Popper>
                        </>
                    )}
                    <IconButton onClick={onClose} size="small" sx={{ color: "text.disabled" }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
                </Stack>

                {/* 본문 */}
                <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2.25 }}>
                    {/* 제목 — 주인공 */}
                    <Box
                        component="input"
                        ref={titleRef}
                        autoFocus
                        value={task.title}
                        onChange={(e) => set({ title: e.target.value })}
                        onBlur={() => setTouched(true)}
                        placeholder="할 일 제목을 입력하세요"
                        sx={{ width: "100%", border: "none", background: "transparent", color: "text.primary", fontSize: 21, fontWeight: 800, letterSpacing: "-0.03em", outline: "none", fontFamily: "inherit", "&::placeholder": { color: "text.disabled" } }}
                    />
                    {titleError && <Typography sx={{ fontSize: 12, fontWeight: 700, color: "error.main", mt: 0.75 }}>{titleError}</Typography>}

                    {/* 설명 (인라인 토글) */}
                    {showDesc ? (
                        <Box sx={{ mt: 1.5 }}>
                            <RichTextEditor
                                value={task.content ?? ""}
                                placeholder="내용 입력, '/' 로 명령어 사용"
                                ariaLabel="내용"
                                slashMenu
                                onChange={(md) => set({ content: md })}
                            />
                        </Box>
                    ) : (
                        <ButtonBase onClick={() => setShowDesc(true)} sx={{ mt: 1.25, height: 30, px: 1.25, borderRadius: "8px", gap: 0.75, color: "text.disabled", fontSize: 12.5, fontWeight: 700, "&:hover": { color: "text.secondary", bgcolor: "action.hover" } }}>
                            <NotesRoundedIcon sx={{ fontSize: 16 }} /> 설명 추가
                        </ButtonBase>
                    )}

                    {/* 메타 칩 한 줄 */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                        {/* 프로젝트 */}
                        <MetaChip icon={<ProjIcon sx={{ fontSize: 15 }} />} color={selProject?.color || undefined} active={selProject?.key !== "inbox"} popWidth={220}
                            label={selProject?.label ?? "프로젝트"}>
                            {(close) => projectOptions.map((opt) => (
                                <PopItem key={opt.key} selected={opt.key === projectScopeValue} onClick={() => { set({ projectScope: opt.key }); close(); }}>
                                    <ProjectOptionLabel option={opt} iconSize={16} spacing={0.75} />
                                </PopItem>
                            ))}
                        </MetaChip>

                        {/* 마감일 */}
                        <MetaChip icon={<EventRoundedIcon sx={{ fontSize: 15 }} />} active={Boolean(task.dueDate)} label={dueText} popWidth={252}>
                            {(close) => (
                                <Box>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, p: 0.5 }}>
                                        {[{ k: "today", l: "오늘" }, { k: "tomorrow", l: "내일" }, { k: "thisWeek", l: "이번 주" }, { k: "nextWeek", l: "다음 주" }].map((q) => {
                                            const v = quickDate(q.k);
                                            const on = dueQuick === q.k;
                                            return (
                                                <ButtonBase key={q.k} onClick={() => { set({ dueDate: v }); setDueQuick(q.k); }}
                                                    sx={{ height: 30, px: 1.25, borderRadius: "8px", fontSize: 12, fontWeight: 800, border: "1px solid", borderColor: on ? "primary.main" : "divider", bgcolor: on ? "primary.main" : "var(--plando-surface-low)", color: on ? "#fff" : "text.secondary" }}>
                                                    {q.l}
                                                </ButtonBase>
                                            );
                                        })}
                                    </Box>
                                    <Box sx={{ p: 0.5, pt: 1, borderTop: "1px solid", borderColor: "divider", mt: 0.5 }}>
                                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", px: 0.25, mb: 0.5 }}>시작일</Typography>
                                        <TextField type="date" size="small" fullWidth value={task.startAt || ""} onChange={(e) => set({ startAt: e.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", px: 0.25, mt: 1, mb: 0.5 }}>마감일</Typography>
                                        <TextField type="date" size="small" fullWidth value={task.dueDate || ""} onChange={(e) => { set({ dueDate: e.target.value }); setDueQuick(null); }} InputLabelProps={{ shrink: true }} error={Boolean(dateError)} helperText={dateError || ""} sx={fieldSx} />
                                    </Box>
                                    {task.dueDate && (
                                        <Box sx={{ p: 0.5, pt: 1, borderTop: "1px solid", borderColor: "divider", mt: 0.5 }}>
                                            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5 }}>
                                                <AccessTimeRoundedIcon sx={{ fontSize: 15, color: "text.disabled" }} />
                                                <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "text.secondary" }}>하루 종일</Typography>
                                                <Switch size="small" checked={task.allDay !== false}
                                                    onChange={(e) => set({ allDay: e.target.checked, ...(e.target.checked ? { startTime: "", endTime: "" } : {}) })} />
                                            </Stack>
                                            {hasTime && (
                                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                                    <TextField type="time" size="small" fullWidth value={task.startTime || ""} onChange={(e) => set({ startTime: e.target.value })} sx={fieldSx} />
                                                    <TextField type="time" size="small" fullWidth value={task.endTime || ""} onChange={(e) => set({ endTime: e.target.value })} sx={fieldSx} />
                                                </Stack>
                                            )}
                                        </Box>
                                    )}
                                    {task.dueDate && (
                                        <Box sx={{ p: 0.5, pt: 1, borderTop: "1px solid", borderColor: "divider", mt: 0.5 }}>
                                            <PopItem onClick={() => { set({ dueDate: "", allDay: true, startTime: "", endTime: "" }); setDueQuick(null); close(); }}>
                                                <Box component="span" sx={{ color: "error.main" }}>날짜 지우기</Box>
                                            </PopItem>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </MetaChip>

                        {/* 우선순위 */}
                        <MetaChip icon={<FlagRoundedIcon sx={{ fontSize: 15 }} />} color={priColor(task.priority || "MEDIUM")} active={(task.priority || "MEDIUM") !== "MEDIUM"} label={PRIORITY_LABEL[task.priority] ?? "중간"} popWidth={190}>
                            {(close) => PRIORITIES.map((p) => (
                                <PopItem key={p} selected={(task.priority || "MEDIUM") === p} onClick={() => { set({ priority: p }); close(); }}
                                    icon={<FlagRoundedIcon sx={{ fontSize: 16, color: priColor(p) }} />}>
                                    {PRIORITY_LABEL[p] ?? p}
                                </PopItem>
                            ))}
                        </MetaChip>

                        {/* 상태 */}
                        <MetaChip icon={<PlayCircleOutlineRoundedIcon sx={{ fontSize: 15 }} />} color={statusColorOf(task.status || "TODO")} active={(task.status || "TODO") !== "TODO"} label={statusLabelOf(task.status || "TODO")} popWidth={210}>
                            {(close) => (
                                <>
                                    {statusDefs.map((s) => (
                                        <PopItem key={s.statusKey} selected={(task.status || "TODO") === s.statusKey} onClick={() => { set({ status: s.statusKey }); close(); }} icon={<Dot color={s.color || statusColorOf(s.statusKey)} />}>
                                            {s.label}
                                        </PopItem>
                                    ))}
                                    {canManageWorkspace && (
                                        <PopItem key="__add" onClick={() => { close(); setAddStatusOpen(true); }} icon={<AddRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />}>
                                            새 상태 만들기
                                        </PopItem>
                                    )}
                                </>
                            )}
                        </MetaChip>

                        {/* 담당자 */}
                        <MetaChip icon={<PersonRoundedIcon sx={{ fontSize: 15 }} />} active={(task.assignees ?? []).length > 0} label={assigneeLabel} popWidth={230}>
                            {() => (
                                loadingUsers ? (
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 1 }}><CircularProgress size={16} /><Typography sx={{ fontSize: 13 }}>불러오는 중…</Typography></Stack>
                                ) : assigneeOptions.length === 0 ? (
                                    <Typography sx={{ fontSize: 13, color: "text.disabled", px: 1.25, py: 1 }}>참여 가능한 멤버가 없어요</Typography>
                                ) : assigneeOptions.map((u) => (
                                    <PopItem key={u.email} selected={(task.assignees ?? []).includes(u.email)} onClick={() => toggleAssignee(u.email)}
                                        icon={<UserAvatar name={u.name} src={u.profileImageUrl} size={22} />}>
                                        {u.name}
                                    </PopItem>
                                ))
                            )}
                        </MetaChip>
                    </Box>

                    {/* 고급 옵션 */}
                    <ButtonBase onClick={() => setAdv((a) => !a)} sx={{ width: "100%", justifyContent: "flex-start", gap: 0.75, mt: 2.25, py: 1, borderTop: "1px solid", borderColor: "divider", color: "text.disabled", fontSize: 12.5, fontWeight: 800 }}>
                        <ChevronRightRoundedIcon sx={{ fontSize: 16, transform: adv ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                        고급 옵션
                        <Box component="span" sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled", opacity: 0.7 }}>반복 · 장소</Box>
                    </ButtonBase>

                    {adv && (
                        <Stack spacing={2.25} sx={{ pt: 1 }}>
                            {/* 반복 */}
                            <Box>
                                <Box sx={sectionLabelSx}><RepeatRoundedIcon sx={{ fontSize: 15 }} /> 반복</Box>
                                <TextField select size="small" fullWidth value={pendingRecurrenceType} onChange={(e) => setPendingRecurrenceType?.(e.target.value)} SelectProps={{ native: true }} sx={fieldSx}>
                                    {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </TextField>
                                {pendingRecurrenceType !== "NONE" && (
                                    <TextField type="date" size="small" fullWidth value={pendingRecurrenceEndDate} onChange={(e) => setPendingRecurrenceEndDate?.(e.target.value)} InputLabelProps={{ shrink: true }} placeholder="종료일" sx={{ ...fieldSx, mt: 1 }} />
                                )}
                            </Box>

                            {/* 장소 */}
                            <Box>
                                <Box sx={sectionLabelSx}><PlaceRoundedIcon sx={{ fontSize: 15 }} /> 장소 <Box component="span" sx={{ textTransform: "none", letterSpacing: 0, fontWeight: 600, color: "text.disabled" }}>· 현장 일정만</Box></Box>
                                <LocationPickerField
                                    value={location ?? (task?.locationName ? { locationName: task.locationName, locationAddress: task.locationAddress, locationLat: task.locationLat, locationLng: task.locationLng } : null)}
                                    onChange={(loc) => {
                                        if (setLocation) setLocation(loc);
                                        set({ locationName: loc?.locationName ?? null, locationAddress: loc?.locationAddress ?? null, locationLat: loc?.locationLat ?? null, locationLng: loc?.locationLng ?? null });
                                    }}
                                />
                            </Box>
                        </Stack>
                    )}
                </Box>

                {/* 푸터 */}
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2.5, py: 1.75, borderTop: "1px solid", borderColor: "divider", bgcolor: "var(--plando-surface-low)" }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "text.disabled" }}>제목은 필수 · 날짜는 선택</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Button variant="outlined" onClick={onClose} sx={{ height: 38, borderRadius: "10px", fontWeight: 700 }}>취소</Button>
                    <Tooltip title={!canSave ? "제목/날짜를 확인해 주세요" : "저장"}>
                        <span>
                            <Button variant="contained" disableElevation onClick={handleSave} disabled={!canSave || submitting} sx={{ height: 38, borderRadius: "10px", fontWeight: 800, px: 2.5 }}>저장</Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Box>
        </Modal>
        <AddStatusDialog open={addStatusOpen} onClose={() => setAddStatusOpen(false)} onCreated={(s) => set({ status: s.statusKey })} />
        </>
    );
}
