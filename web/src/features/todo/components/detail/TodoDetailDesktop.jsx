import React, { useEffect, useRef, useState } from "react";
import { Box, Collapse, Menu, MenuItem, Switch, TextField, Typography } from "@mui/material";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { fadeDividerSx } from "../../../../shared/ui/glassSx.js";
import { formatTimeAmPm } from "../../../../shared/utils/formatters.js";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import useTodoDetailEditing from "../../hooks/useTodoDetailEditing.js";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RichTextEditor from "../../../../shared/ui/editor/RichTextEditor.jsx";
import CommentSection from "../comment/CommentSection.jsx";
import LogSection from "../log/LogSection.jsx";
import TodoAttachmentSection from "./TodoAttachmentSection.jsx";
import TodoSubtaskSection from "./TodoSubtaskSection.jsx";
import LocationCard from "./LocationCard.jsx";
import PrioIcon from "./PrioIcon.jsx";
import ActivityPreview from "./ActivityPreview.jsx";
import AssigneeInlinePopover from "./AssigneeInlinePopover.jsx";
import SegmentedControl from "../../../../shared/ui/common/SegmentedControl.jsx";
import { inputSxFlat } from "../../../../shared/ui/inputSx.js";
import UserAvatar from "../../../../shared/ui/common/UserAvatar.jsx";
import { STATUS_BAR_CLASS, STATUS_BADGE_CLASS, STATUS_DOT_CLASS } from "./panelTokens.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { alpha } from "@mui/material/styles";
import TagPickerRow from "./TagPickerRow.jsx";
import { useWorkspacePermissions } from "../../../workspace/hooks/useWorkspacePermissions.js";
import {
    STATUS_OPTIONS,
    PRIORITY_OPTIONS,
    STATUS_LABEL,
    PRIORITY_LABEL,
} from "../../../../shared/ui/tone.js";
import { RECURRENCE_LABEL, RECURRENCE_OPTIONS } from "../../constants/recurrence.js";
import DetailLayoutPicker from "./DetailLayoutPicker.jsx";
import { useLayout } from "../../../../layouts/LayoutContext.jsx";
import { buildProjectOptions, projectIconColor } from "../../../project/utils/projectOptions.js";
import { formatTimeAgo } from "../../../../shared/utils/formatters.js";
import {
    getOptionValue,
    getOptionLabel,
    getAvatarSrc,
} from "../../../../shared/utils/assigneeUtils.js";

import "./TaskDetailPanel.css";

/* ═══════════════════════════════════════════════════════════
   메인 컴포넌트
   ═══════════════════════════════════════════════════════════ */
export default function TodoDetailDesktop({
    todo,
    onClose,
    onPatchLocal,
    showClose = true,

    tab,
    setTab,

    editable,
    setEditable,

    assigneeOptions,

    selectedAssignees,
    setSelectedAssignees,

    saveState,

    setDeleteOpen,

    commit,
    commitMany,
    debouncedCommit,
    retryCommit,

    onMapClick,
    onArchive,
    onRestore,
    focused,
    onToggleFocus,
    workspaceId,
}) {
    const { detailLayout, setDetailLayout } = useLayout();
    // 전체화면에서는 댓글을 오른쪽 열에 상시 노출한다(탭 뒤에 숨기지 않는다).
    const isFullscreen = detailLayout === "fullscreen";
    // 댓글 탭(1)을 보던 중 전체화면으로 바꾸면 왼쪽 열이 빈다 — 개요로 되돌린다.
    useEffect(() => {
        if (isFullscreen && tab === 1) setTab(0);
    }, [isFullscreen, tab, setTab]);
    const { statuses: statusDefs, label: statusLabelOf, colorOf: statusColorOf } = useStatuses();
    const statusOptions = statusDefs.map((s) => ({ value: s.statusKey, label: s.label }));
    const status = editable?.status || "TODO";
    const statusHex = statusColorOf(status);
    const priority = editable?.priority || "MEDIUM";
    const perms = useWorkspacePermissions();
    const isReadOnly = saveState === "readonly" || todo?.isSample || !perms.canEditContent;

    const commentCount = todo?.commentCount ?? todo?.comments?.length ?? 0;
    const activityCount = todo?.logCount ?? todo?.logs?.length ?? 0;

    // 데스크탑/모바일 공통 편집 로직 (파생값·핸들러)
    const {
        selectedAssigneeValues,
        titleRef,
        handleTitleInput,
        handleDescChange,
        expandedAttr,
        setExpandedAttr,
        toggleAttr,
        recurrence,
        projects,
        curProject,
        curProjectIsInbox,
        CurProjectIcon,
        changeProject,
    } = useTodoDetailEditing({ todo, editable, setEditable, onPatchLocal, debouncedCommit, selectedAssignees });

    /* ── 메뉴/팝오버 anchor 상태 ──────────────────────── */
    const [moreMenuEl, setMoreMenuEl] = useState(null);
    const [assigneeAnchor, setAssigneeAnchor] = useState(null);
    const startDateRef = useRef(null);
    const dueDateRef = useRef(null);
    const startTimeRef = useRef(null);
    const endTimeRef = useRef(null);

    /* ── 작성자/시간 메타 ─────────────────────────────── */
    const createdAt = todo?.createdAt || todo?.modifiedAt;
    const createdAtLabel = createdAt ? formatTimeAgo(createdAt) : "";
    const authorName = todo?.userName || todo?.userEmail || "사용자";

    /* ── 짧은 ID 표기 ─────────────────────────────────── */
    const shortId = todo?.id != null ? `TODO-${todo.id}` : null;

    /* ── 푸터 자동저장 상태 ───────────────────────────── */
    let footer = null;
    if (saveState === "saving") {
        footer = { dotClass: "is-saving", text: "저장 중..." };
    } else if (saveState === "saved") {
        footer = { dotClass: "", text: "자동 저장됨 · 방금 전" };
    } else if (saveState === "error") {
        footer = { dotClass: "is-error", text: "저장 실패 · 클릭해서 다시 시도", onClick: retryCommit };
    } else if (saveState === "readonly") {
        // 403: 샘플 데이터가 아니면 "권한 없음"으로 안내 (샘플 문구는 진짜 샘플에만)
        footer = { dotClass: "is-readonly", text: todo?.isSample ? "샘플 데이터 · 읽기 전용" : "편집 권한이 없어요 · 읽기 전용" };
    } else {
        footer = { dotClass: "", text: "자동 저장됨" };
    }

    /* ── 본문 — 배치와 무관하게 같은 내용을 쓴다 ─────────
       전체화면에서는 이 노드를 왼쪽 열에 넣고 오른쪽에 댓글을 붙인다.
       (같은 JSX 를 두 번 적으면 한쪽만 고치는 사고가 난다) */
    const bodyNode = (
                tab === 1 ? (
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", px: "12px", pt: "4px" }}>
                        <CommentSection todoId={todo?.id} workspaceId={workspaceId} variant="thread" />
                    </Box>
                ) : (
                    <div className="pd-scroll" style={{ padding: "16px 18px 0 18px" }}>
                        {tab === 0 && (
                            <>
                                {/* 내용 */}
                                <Box sx={{ mb: "16px" }}>
                                    <label className="pd-label">내용</label>
                                    <RichTextEditor
                                        value={todo?.content ?? ""}
                                        editable={!isReadOnly}
                                        placeholder="내용 입력, '/' 로 명령어 사용"
                                        ariaLabel="내용"
                                        slashMenu
                                        onChange={handleDescChange}
                                    />
                                </Box>

                                {/* 속성 카드 — 아코디언 스타일 */}
                                <div className="pdp-card" style={{ marginBottom: 14 }}>
                                    <div className="pdp-card-body" style={{ padding: "8px 14px" }}>
                                        {/* 상태 */}
                                        <div
                                            className="pdp-row"
                                            onClick={() => !isReadOnly && toggleAttr("status")}
                                        >
                                            <div className="pdp-row-label">
                                                <span className={STATUS_DOT_CLASS[status] ?? undefined} style={{ width: 8, height: 8, borderRadius: 999, ...(STATUS_DOT_CLASS[status] ? {} : { background: statusHex, display: "inline-block" }) }} />
                                                상태
                                            </div>
                                            <div className="pdp-row-value">
                                                <div className="pdp-vchip">
                                                    <span className={STATUS_BADGE_CLASS[status] ?? undefined} style={STATUS_BADGE_CLASS[status] ? undefined : { background: alpha(statusHex, 0.14), color: statusHex, padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{statusLabelOf(status)}</span>
                                                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, color: "var(--plando-text-tertiary)", transform: expandedAttr === "status" ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .2s ease" }} />
                                                </div>
                                            </div>
                                        </div>
                                        <Collapse in={expandedAttr === "status"} unmountOnExit>
                                            <Box sx={{ py: 1, ...fadeDividerSx("var(--plando-divider)", "bottom") }}>
                                                <SegmentedControl
                                                    fullWidth
                                                    options={statusOptions}
                                                    value={status}
                                                    onChange={(v) => {
                                                        setEditable((prev) => ({ ...prev, status: v }));
                                                        onPatchLocal?.({ status: v });
                                                        commit("status", v);
                                                        setExpandedAttr(null);
                                                    }}
                                                />
                                            </Box>
                                        </Collapse>

                                        {/* 우선순위 */}
                                        <div
                                            className="pdp-row"
                                            onClick={() => !isReadOnly && toggleAttr("priority")}
                                        >
                                            <div className="pdp-row-label">
                                                <span className="pdp-prio-icon"><PrioIcon priority={priority} /></span>
                                                우선순위
                                            </div>
                                            <div className="pdp-row-value">
                                                <div className="pdp-vchip">
                                                    <PrioIcon priority={priority} />
                                                    {PRIORITY_LABEL[priority]}
                                                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, color: "var(--plando-text-tertiary)", transform: expandedAttr === "priority" ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .2s ease" }} />
                                                </div>
                                            </div>
                                        </div>
                                        <Collapse in={expandedAttr === "priority"} unmountOnExit>
                                            <Box sx={{ py: 1, ...fadeDividerSx("var(--plando-divider)", "bottom") }}>
                                                <SegmentedControl
                                                    fullWidth
                                                    options={PRIORITY_OPTIONS}
                                                    value={priority}
                                                    onChange={(v) => {
                                                        setEditable((prev) => ({ ...prev, priority: v }));
                                                        onPatchLocal?.({ priority: v });
                                                        commit("priority", v);
                                                        setExpandedAttr(null);
                                                    }}
                                                />
                                            </Box>
                                        </Collapse>

                                        {/* 태그 */}
                                        <TagPickerRow
                                            todoId={todo?.id}
                                            tags={editable?.tags ?? todo?.tags ?? []}
                                            readOnly={isReadOnly}
                                            onPatchLocal={onPatchLocal}
                                        />

                                        {/* 프로젝트 */}
                                        <div
                                            className="pdp-row"
                                            onClick={() => !isReadOnly && toggleAttr("project")}
                                        >
                                            <div className="pdp-row-label">
                                                <CurProjectIcon sx={{ fontSize: 14, color: curProjectIsInbox ? "var(--plando-text-tertiary)" : projectIconColor(curProject.color) }} />
                                                프로젝트
                                            </div>
                                            <div className="pdp-row-value">
                                                <div className="pdp-vchip">
                                                    {curProjectIsInbox ? "인박스" : curProject.name}
                                                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, color: "var(--plando-text-tertiary)", transform: expandedAttr === "project" ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .2s ease" }} />
                                                </div>
                                            </div>
                                        </div>
                                        <Collapse in={expandedAttr === "project"} unmountOnExit>
                                            <Box sx={{ py: 0.75, ...fadeDividerSx("var(--plando-divider)", "bottom") }}>
                                                {buildProjectOptions(projects).map((opt) => {
                                                    const selected = opt.key === "inbox" ? curProjectIsInbox : (!curProjectIsInbox && curProject.id === opt.key);
                                                    const OptIcon = opt.icon;
                                                    return (
                                                        <Box
                                                            key={opt.key}
                                                            onClick={() => { if (!selected) changeProject(opt.key); else setExpandedAttr(null); }}
                                                            sx={{
                                                                display: "flex", alignItems: "center", gap: 1,
                                                                px: 1, py: 0.625, borderRadius: "8px", cursor: "pointer",
                                                                "&:hover": { background: "var(--plando-hover, rgba(127,127,127,0.08))" },
                                                            }}
                                                        >
                                                            <OptIcon sx={{ fontSize: 15, color: projectIconColor(opt.color) ?? "var(--plando-text-tertiary)", flexShrink: 0 }} />
                                                            <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: selected ? 700 : 500 }} noWrap>
                                                                {opt.label}
                                                            </Typography>
                                                            {selected && <CheckRoundedIcon sx={{ fontSize: 14, color: "primary.main" }} />}
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Collapse>

                                        {/* 시작일 */}
                                        <div
                                            className="pdp-row"
                                            onClick={() => !isReadOnly && startDateRef.current?.showPicker?.()}
                                        >
                                            <div className="pdp-row-label">
                                                <EventOutlinedIcon sx={{ fontSize: 14 }} /> 시작일
                                            </div>
                                            <div className="pdp-row-value">
                                                <div className={`pdp-vchip${editable?.startAt ? "" : " pdp-vchip-empty"}`}>
                                                    {editable?.startAt || "날짜 선택"}
                                                </div>
                                                <input
                                                    ref={startDateRef}
                                                    type="date"
                                                    value={editable?.startAt || ""}
                                                    max={editable?.dueDate || undefined}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setEditable((prev) => ({ ...prev, startAt: v }));
                                                        onPatchLocal?.({ startAt: v });
                                                        commit("startAt", v);
                                                    }}
                                                    style={{
                                                        position: "absolute", opacity: 0, width: 1, height: 1,
                                                        pointerEvents: "none",
                                                    }}
                                                    aria-hidden
                                                    tabIndex={-1}
                                                />
                                            </div>
                                        </div>

                                        {/* 마감일 */}
                                        <div
                                            className="pdp-row"
                                            onClick={() => !isReadOnly && dueDateRef.current?.showPicker?.()}
                                        >
                                            <div className="pdp-row-label">
                                                <EventOutlinedIcon sx={{ fontSize: 14 }} /> 마감일
                                            </div>
                                            <div className="pdp-row-value">
                                                <div className={`pdp-vchip${editable?.dueDate ? "" : " pdp-vchip-empty"}`}>
                                                    {editable?.dueDate || "날짜 선택"}
                                                </div>
                                                <input
                                                    ref={dueDateRef}
                                                    type="date"
                                                    value={editable?.dueDate || ""}
                                                    min={editable?.startAt || undefined}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setEditable((prev) => ({ ...prev, dueDate: v }));
                                                        onPatchLocal?.({ dueDate: v });
                                                        commit("dueDate", v);
                                                    }}
                                                    style={{
                                                        position: "absolute", opacity: 0, width: 1, height: 1,
                                                        pointerEvents: "none",
                                                    }}
                                                    aria-hidden
                                                    tabIndex={-1}
                                                />
                                            </div>
                                        </div>

                                        {/* 하루종일 토글 + 시간 */}
                                        {(editable?.startAt || editable?.dueDate) && (
                                            <>
                                                <div className="pdp-row">
                                                    <div className="pdp-row-label">
                                                        <ScheduleRoundedIcon sx={{ fontSize: 14 }} /> 하루종일
                                                    </div>
                                                    <div className="pdp-row-value">
                                                        <Switch
                                                            size="small"
                                                            checked={!editable?.startTime && !editable?.endTime}
                                                            disabled={isReadOnly}
                                                            /* startTime/endTime은 반드시 한 묶음(commitMany)으로 보낸다.
                                                               commit을 연달아 두 번 부르면 두 저장이 같은 롤백 기준값을 캡처해서,
                                                               나중에 끝난 쪽이 먼저 끝난 쪽의 저장 결과를 기준값에서 지웠다
                                                               (이후 저장 실패 시 이미 지운 시간이 되살아남). */
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setEditable((prev) => ({ ...prev, startTime: null, endTime: null }));
                                                                    onPatchLocal?.({ startTime: null, endTime: null });
                                                                    commitMany({ startTime: "", endTime: "" });
                                                                } else {
                                                                    setEditable((prev) => ({ ...prev, startTime: "09:00", endTime: "10:00" }));
                                                                    onPatchLocal?.({ startTime: "09:00", endTime: "10:00" });
                                                                    commitMany({ startTime: "09:00", endTime: "10:00" });
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                {(editable?.startTime || editable?.endTime) && (
                                                    <>
                                                        <div className="pdp-row" onClick={() => !isReadOnly && startTimeRef.current?.showPicker?.()}>
                                                            <div className="pdp-row-label">
                                                                <ScheduleRoundedIcon sx={{ fontSize: 14 }} /> 시작 시간
                                                            </div>
                                                            <div className="pdp-row-value">
                                                                <div className={`pdp-vchip${editable?.startTime ? "" : " pdp-vchip-empty"}`}>
                                                                    {formatTimeAmPm(editable?.startTime) || "시간 선택"}
                                                                </div>
                                                                <input ref={startTimeRef} type="time" value={editable?.startTime || ""}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        setEditable((prev) => ({ ...prev, startTime: v }));
                                                                        onPatchLocal?.({ startTime: v });
                                                                        commit("startTime", v);
                                                                    }}
                                                                    style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
                                                                    aria-hidden tabIndex={-1}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="pdp-row" onClick={() => !isReadOnly && endTimeRef.current?.showPicker?.()}>
                                                            <div className="pdp-row-label">
                                                                <ScheduleRoundedIcon sx={{ fontSize: 14 }} /> 종료 시간
                                                            </div>
                                                            <div className="pdp-row-value">
                                                                <div className={`pdp-vchip${editable?.endTime ? "" : " pdp-vchip-empty"}`}>
                                                                    {formatTimeAmPm(editable?.endTime) || "시간 선택"}
                                                                </div>
                                                                <input ref={endTimeRef} type="time" value={editable?.endTime || ""}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        setEditable((prev) => ({ ...prev, endTime: v }));
                                                                        onPatchLocal?.({ endTime: v });
                                                                        commit("endTime", v);
                                                                    }}
                                                                    style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
                                                                    aria-hidden tabIndex={-1}
                                                                />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}

                                        {/* 참여자 */}
                                        <div
                                            className="pdp-row"
                                            onClick={(e) => !isReadOnly && setAssigneeAnchor(e.currentTarget)}
                                        >
                                            <div className="pdp-row-label">
                                                <PersonOutlineRoundedIcon sx={{ fontSize: 14 }} /> 참여자
                                            </div>
                                            <div className="pdp-row-value">
                                                {selectedAssigneeValues.length === 0 ? (
                                                    <div className="pdp-vchip pdp-vchip-empty">
                                                        <AddRoundedIcon sx={{ fontSize: 14 }} /> 추가
                                                    </div>
                                                ) : (
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                                                        {selectedAssigneeValues.slice(0, 3).map((val) => {
                                                            const opt = assigneeOptions.find((u) => getOptionValue(u) === val);
                                                            const label = opt ? getOptionLabel(opt) : val;
                                                            const src = opt ? getAvatarSrc(opt) : undefined;
                                                            return (
                                                                <UserAvatar key={val} name={label} src={src} size={24} />
                                                            );
                                                        })}
                                                        {selectedAssigneeValues.length > 3 && (
                                                            <Typography sx={{ fontSize: 12, color: "var(--plando-text-tertiary)", ml: 0.5 }}>
                                                                +{selectedAssigneeValues.length - 3}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                )}
                                            </div>
                                        </div>

                                        {/* 반복 */}
                                        <div
                                            className="pdp-row"
                                            onClick={() => !isReadOnly && toggleAttr("recurrence")}
                                        >
                                            <div className="pdp-row-label">
                                                <RepeatRoundedIcon sx={{ fontSize: 14 }} /> 반복
                                            </div>
                                            <div className={`pdp-row-value${recurrence.type === "NONE" ? " pdp-row-value-muted" : ""}`}>
                                                <div className="pdp-vchip">
                                                    {RECURRENCE_LABEL[recurrence.type] || "반복 없음"}
                                                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, color: "var(--plando-text-tertiary)", transform: expandedAttr === "recurrence" ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .2s ease" }} />
                                                </div>
                                            </div>
                                        </div>
                                        <Collapse in={expandedAttr === "recurrence"} unmountOnExit>
                                            <Box sx={{ py: 1 }}>
                                                <SegmentedControl
                                                    fullWidth
                                                    options={RECURRENCE_OPTIONS}
                                                    value={recurrence.type}
                                                    onChange={(v) => {
                                                        if (v === recurrence.type) return;
                                                        recurrence.save(v, v === "NONE" ? "" : recurrence.endDate);
                                                    }}
                                                />
                                                {recurrence.type !== "NONE" && (
                                                    <Box sx={{ mt: 1.25 }}>
                                                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: "var(--plando-text-tertiary)", mb: 0.5 }}>
                                                            반복 종료일 (선택)
                                                        </Typography>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            type="date"
                                                            value={recurrence.endDate || ""}
                                                            onChange={(e) => recurrence.save(recurrence.type, e.target.value)}
                                                            disabled={recurrence.saving}
                                                            InputLabelProps={{ shrink: true }}
                                                            sx={inputSxFlat()}
                                                        />
                                                    </Box>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </div>
                                </div>

                                {/* 서브태스크(parentId 기반 실제 할 일) — parentId 있으면 상위 브레드크럼, 없으면 서브태스크 목록 */}
                                <TodoSubtaskSection todoId={todo?.id} parentId={todo?.parentId} />

                                {/* 최근 활동 */}
                                <div className="pdp-card" style={{ marginBottom: 14 }}>
                                    <div className="pdp-card-head">
                                        <div className="pdp-card-head-title">
                                            <HistoryRoundedIcon sx={{ fontSize: 14 }} /> 최근 활동
                                        </div>
                                        <button
                                            type="button" className="pd-textbtn"
                                            onClick={() => setTab(3)}
                                        >
                                            모두 보기
                                        </button>
                                    </div>
                                    <div style={{ padding: "4px 14px 12px 14px" }}>
                                        <ActivityPreview todoId={todo?.id} onShowAll={() => setTab(3)} users={assigneeOptions} />
                                    </div>
                                </div>

                                {/* 위치 */}
                                <LocationCard todo={todo} onMapClick={onMapClick} mapHeight={180} />

                                <div style={{ height: 20 }} />
                            </>
                        )}

                        {tab === 2 && (
                            <Box sx={{ py: 0.5 }}>
                                <TodoAttachmentSection todoId={todo?.id} />
                            </Box>
                        )}

                        {tab === 3 && (
                            <Box sx={{ mx: "-18px" }}>
                                <LogSection todoId={todo?.id} compact users={assigneeOptions} />
                            </Box>
                        )}
                    </div>
                    )
    );

    return (
        <div className="pd-panel">
            {/* ── 컬러바 (상태 색 — 커스텀 상태 포함) ───────── */}
            <div className={STATUS_BAR_CLASS[status] ?? "pdp-bar"} style={STATUS_BAR_CLASS[status] ? undefined : { background: statusHex }} />

            {/* ── 헤더 ─────────────────────────────────── */}
            <Box sx={{ px: "18px", pt: "12px", pb: "6px" }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: "4px" }}>
                    <Box sx={{
                        display: "inline-flex", alignItems: "center", gap: 0.75,
                        fontSize: 11, fontWeight: 600,
                        color: "var(--plando-text-tertiary)",
                        letterSpacing: "0.04em",
                    }}>
                        <span className={STATUS_DOT_CLASS[status] ?? undefined} style={{ width: 8, height: 8, borderRadius: 999, ...(STATUS_DOT_CLASS[status] ? {} : { background: statusHex, display: "inline-block" }) }} />
                        {statusLabelOf(status)}
                        {shortId && <span style={{ opacity: 0.65 }}>· {shortId}</span>}
                    </Box>
                    <Box sx={{ flex: 1 }} />

                    {onToggleFocus && (
                        <button
                            type="button"
                            className={`pd-iconbtn${focused ? " is-active" : ""}`}
                            title={focused ? "포커스 해제" : "포커스로 마킹"}
                            onClick={onToggleFocus}
                        >
                            {focused ? <BoltRoundedIcon sx={{ fontSize: 16 }} /> : <BoltOutlinedIcon sx={{ fontSize: 16 }} />}
                        </button>
                    )}
                    {onRestore && (
                        <button
                            type="button" className="pd-iconbtn" title="복원"
                            onClick={() => { onRestore(); onClose?.(); }}
                        >
                            <RestoreRoundedIcon sx={{ fontSize: 16 }} />
                        </button>
                    )}
                    {!onRestore && onArchive && (
                        <button type="button" className="pd-iconbtn" title="아카이브" onClick={onArchive}>
                            <Inventory2RoundedIcon sx={{ fontSize: 16 }} />
                        </button>
                    )}
                    <button
                        type="button" className="pd-iconbtn" title="더보기"
                        onClick={(e) => setMoreMenuEl(e.currentTarget)}
                    >
                        <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
                    </button>
                    <DetailLayoutPicker
                        value={detailLayout}
                        onChange={setDetailLayout}
                        onBeforeChange={() => debouncedCommit?.flush?.()}
                    />
                    {showClose && (
                        <button type="button" className="pd-iconbtn" title="닫기" onClick={onClose}>
                            <CloseRoundedIcon sx={{ fontSize: 16 }} />
                        </button>
                    )}
                </Box>

                {/* 인플레이스 편집 제목 */}
                <div
                    ref={titleRef}
                    className="pdp-title-edit"
                    contentEditable={!isReadOnly}
                    suppressContentEditableWarning
                    spellCheck={false}
                    data-ph="제목을 입력하세요"
                    onInput={handleTitleInput}
                    onBlur={() => debouncedCommit.flush?.()}
                    onKeyDown={(e) => {
                        // IME 조합 중 Enter 무시 — 조합 확정용 Enter로 제목이 미리 커밋되는 것 방지
                        if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    }}
                />

                <Box sx={{
                    display: "flex", alignItems: "center", gap: 0.75,
                    mb: "10px", fontSize: "11.5px", color: "var(--plando-text-tertiary)",
                }}>
                    <span>작성자 : {authorName}{createdAtLabel ? ` · ${createdAtLabel}` : ""}</span>
                    <Box sx={{ flex: 1 }} />
                    {isReadOnly && (
                        <span className="pd-callout">
                            <LockOutlinedIcon sx={{ fontSize: 12 }} /> 읽기 전용
                        </span>
                    )}
                </Box>
            </Box>

            {/* ── 탭 ───────────────────────────────────── */}
            <div className="pd-tabs">
                <button
                    type="button"
                    className={`pd-tab${tab === 0 ? " is-active" : ""}`}
                    onClick={() => setTab(0)}
                >
                    <HistoryRoundedIcon sx={{ fontSize: 14 }} /> 개요
                </button>
                {/* 전체화면에서는 댓글이 오른쪽 열에 늘 보이므로 탭을 두지 않는다 */}
                {!isFullscreen && (
                    <button
                        type="button"
                        className={`pd-tab${tab === 1 ? " is-active" : ""}`}
                        onClick={() => setTab(1)}
                    >
                        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14 }} /> 댓글
                        {commentCount > 0 && <span className="pd-tab-count">{commentCount}</span>}
                    </button>
                )}
                <button
                    type="button"
                    className={`pd-tab${tab === 2 ? " is-active" : ""}`}
                    onClick={() => setTab(2)}
                >
                    <AttachFileRoundedIcon sx={{ fontSize: 14 }} /> 첨부
                </button>
                <button
                    type="button"
                    className={`pd-tab${tab === 3 ? " is-active" : ""}`}
                    onClick={() => setTab(3)}
                >
                    변경내역
                    {activityCount > 0 && <span className="pd-tab-count">{activityCount}</span>}
                </button>
            </div>

            {/* ── 본문 ─────────────────────────────────── */}
            {isFullscreen ? (
                <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
                    {/* 왼쪽 = 내용. 폭이 넓어지면 속성 행이 과하게 벌어져 허전해지므로
                        pd-fullscreen-main 클래스로 내부 최대 폭을 제한한다(CSS). */}
                    <Box className="pd-fullscreen-main" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {bodyNode}
                    </Box>
                    {/* 오른쪽 댓글 열 — 전체화면에서만 */}
                    <Box
                        sx={{
                            width: 400,
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                            overflow: "hidden",
                            borderLeft: "1px solid var(--plando-divider)",
                            px: "12px",
                        }}
                    >
                        <Box sx={{
                            display: "flex", alignItems: "center", gap: 0.75,
                            px: "6px", pt: "14px", pb: "10px",
                            fontSize: 12, fontWeight: 800,
                            color: "var(--plando-text-tertiary)",
                            letterSpacing: "0.03em",
                        }}>
                            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14 }} />
                            댓글
                            {commentCount > 0 && <span className="pd-tab-count">{commentCount}</span>}
                        </Box>
                        <CommentSection todoId={todo?.id} workspaceId={workspaceId} variant="thread" />
                    </Box>
                </Box>
            ) : bodyNode}

            {/* ── 미니 푸터 ───────────────────────────── */}
            <div
                className="pdp-minifooter"
                onClick={footer?.onClick}
                style={footer?.onClick ? { cursor: "pointer" } : undefined}
            >
                <span className={`pdp-minifooter-dot ${footer.dotClass}`} />
                {footer.text}
                <span style={{ flex: 1 }} />
                <span style={{ color: "var(--plando-text-disabled)" }}>삭제는 ⋯ 메뉴에서</span>
            </div>


            {/* ── 더보기 메뉴 (삭제 등) ───────────────── */}
            <Menu
                anchorEl={moreMenuEl}
                open={Boolean(moreMenuEl)}
                onClose={() => setMoreMenuEl(null)}
                slotProps={{ paper: { sx: { minWidth: 160, mt: 0.5, borderRadius: 2 } } }}
            >
                <MenuItem
                    onClick={() => { setMoreMenuEl(null); setDeleteOpen(true); }}
                    sx={{ color: "var(--plando-red)" }}
                >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 18, mr: 1 }} />
                    삭제
                </MenuItem>
            </Menu>


            {/* ── 참여자 팝오버 ───────────────────────── */}
            <AssigneeInlinePopover
                anchorEl={assigneeAnchor}
                open={Boolean(assigneeAnchor)}
                onClose={() => setAssigneeAnchor(null)}
                options={assigneeOptions}
                selectedValues={selectedAssigneeValues}
                onChange={(nextValues) => {
                    setEditable((prev) => ({ ...prev, assignees: nextValues }));
                    setSelectedAssignees?.(nextValues);
                    onPatchLocal?.({ assignees: nextValues });
                    commit("assignees", nextValues.join(","));
                }}
            />
        </div>
    );
}
