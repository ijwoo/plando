import React, { useState } from "react";
import { useKeyboardOffset } from "../../../../shared/hooks/useKeyboardOffset.js";
import { inputSxFlat } from "../../../../shared/ui/inputSx.js";
import { fadeDividerSx } from "../../../../shared/ui/glassSx.js";
import { formatTimeAmPm, formatAbsoluteDue } from "../../../../shared/utils/formatters.js";
import { Box, Collapse, Menu, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

import { Z } from "../../../../shared/ui/zIndex.js";
import { buildProjectOptions, projectIconColor } from "../../../project/utils/projectOptions.js";

import RichTextEditor from "../../../../shared/ui/editor/RichTextEditor.jsx";
import CommentSection from "../comment/CommentSection.jsx";
import LogSection from "../log/LogSection.jsx";
import TodoAttachmentSection from "./TodoAttachmentSection.jsx";
import TodoSubtaskSection from "./TodoSubtaskSection.jsx";
import LocationCard from "./LocationCard.jsx";
import PrioIcon from "./PrioIcon.jsx";
import SegmentedControl from "../../../../shared/ui/common/SegmentedControl.jsx";
import ActivityPreview from "./ActivityPreview.jsx";
import AssigneeListContent from "./AssigneeListContent.jsx";
import MobileBottomSheet from "./MobileBottomSheet.jsx";
import { STATUS_BAR_CLASS, STATUS_BADGE_CLASS, STATUS_DOT_CLASS } from "./panelTokens.js";

import {
    PRIORITY_OPTIONS,
    PRIORITY_LABEL,
} from "../../../../shared/ui/tone.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { RECURRENCE_LABEL, RECURRENCE_OPTIONS } from "../../constants/recurrence.js";
import useTodoDetailEditing from "../../hooks/useTodoDetailEditing.js";
import {
    getOptionValue,
    getOptionLabel,
} from "../../../../shared/utils/assigneeUtils.js";

import "./TaskDetailPanel.css";
import { useWorkspacePermissions } from "../../../workspace/hooks/useWorkspacePermissions.js";

/* ───────── 모바일 속성 행 (iOS 설정 스타일) ───────── */
/**
 * 모바일 속성 행 (iOS 설정 스타일).
 *
 * dateInput을 넘기면 행 영역 전체를 덮는 투명 `<input type="date">`를 깔아둠 →
 * 네이티브 date picker가 행 위치에서 자연스럽게 뜸. (showPicker()를 ref로 호출하면
 * input의 화면상 위치 기준으로 떠서 카드 하단/엉뚱한 곳에 나타나는 문제를 회피)
 */
function MobileAttrRow({
    icon, label, value, muted = false, lastInGroup = false,
    onClick,
    dateInput,                   // { value, onChange, disabled? } — 날짜 행 전용 오버레이
    interactive,                 // chevron 표시 여부 (onClick/dateInput 둘 다 없을 때도 강제 표시)
    expanded = false,            // 인라인 확장(아코디언) 행 — chevron이 아래쪽 가리키도록
}) {
    const showChevron = interactive || Boolean(onClick) || Boolean(dateInput);
    const tappable = Boolean(onClick) || Boolean(dateInput);

    return (
        <Box
            onClick={dateInput ? undefined : onClick}
            sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                minHeight: 44,
                py: "10px",
                ...(lastInGroup ? {} : fadeDividerSx("var(--plando-divider)", "bottom")),
                cursor: tappable ? "pointer" : "default",
                "&:active": tappable ? { background: "var(--plando-surface-alt)" } : undefined,
            }}
        >
            <Box sx={{
                display: "flex", alignItems: "center", gap: 1,
                flex: "0 0 100px",
                color: "var(--plando-text-tertiary)",
                fontSize: 13,
            }}>
                {icon}
                {label}
            </Box>
            <Box sx={{
                flex: 1,
                display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.75,
                fontSize: 14,
                color: muted ? "var(--plando-text-tertiary)" : "var(--plando-text-primary)",
                minWidth: 0,
            }}>
                <Box sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.75,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    minWidth: 0,
                }}>
                    {value}
                </Box>
                {showChevron && (
                    <KeyboardArrowDownRoundedIcon
                        sx={{
                            fontSize: 18,
                            color: "var(--plando-text-disabled)",
                            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform .2s ease",
                            flexShrink: 0,
                        }}
                    />
                )}
            </Box>

            {/* 날짜 행 — 투명 input을 행 영역 위에 덮어 native picker가 행 위치에서 뜨도록.
                iOS Safari에서 native picker 동작을 막지 않도록 스타일은 최소화 (appearance/color 등은 건드리지 않음). */}
            {dateInput && !dateInput.disabled && (
                <input
                    type={dateInput.type || "date"}
                    value={dateInput.value || ""}
                    onChange={dateInput.onChange}
                    min={dateInput.min || undefined}
                    max={dateInput.max || undefined}
                    // 행 어디를 탭해도 네이티브 피커가 뜨도록 showPicker() 호출.
                    // (오버레이 input은 행을 정확히 덮고 있어 피커 위치도 행 기준으로 맞음.
                    //  네이티브 date input은 우측 인디케이터를 눌러야만 열려서, 미지원 시엔 기존 동작 유지)
                    onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* 무시 */ } }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        cursor: "pointer",
                    }}
                />
            )}
        </Box>
    );
}

export default function TodoDetailMobile({
    todo,
    onClose,
    onPatchLocal,
    showClose = true,
    tab,
    setTab,
    editable,
    setEditable,
    assigneeOptions = [],
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
    const kbOffset = useKeyboardOffset();

    /* ── 기본 파생값 ──────────────────────────────────── */
    /* 상태는 워크스페이스 커스텀 상태(st_xxx)까지 있으므로 하드코딩 맵이 아니라 useStatuses에서 파생한다.
       (하드코딩 시 커스텀 상태에서 컬러바가 사라지고 배지가 빈 칸으로 렌더됐다 — 데스크탑과 동일 방식으로 통일) */
    const { statuses: statusDefs, label: statusLabelOf, colorOf: statusColorOf } = useStatuses();
    const status = editable?.status || "TODO";
    const statusHex = statusColorOf(status);
    const statusOptions = statusDefs.map((s) => ({ value: s.statusKey, label: s.label }));
    const priority = editable?.priority || "MEDIUM";
    const perms = useWorkspacePermissions();
    const isReadOnly = saveState === "readonly" || todo?.isSample || !perms.canEditContent;

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

    const commentCount = todo?.commentCount ?? todo?.comments?.length ?? 0;
    const activityCount = todo?.logCount ?? todo?.logs?.length ?? 0;

    /* ── 메뉴/팝오버 anchor ───────────────────────────── */
    const [moreMenuEl, setMoreMenuEl] = useState(null);
    const [assigneeSheetOpen, setAssigneeSheetOpen] = useState(false);

    /* ── 푸터 자동저장 표시 ───────────────────────────── */
    let footer = null;
    if (saveState === "saving")        footer = { dotClass: "is-saving",   text: "저장 중...",                 onClick: undefined };
    else if (saveState === "saved")    footer = { dotClass: "",            text: "자동 저장됨",                onClick: undefined };
    else if (saveState === "error")    footer = { dotClass: "is-error",    text: "저장 실패 · 다시 시도",        onClick: retryCommit };
    else if (saveState === "readonly") footer = { dotClass: "is-readonly", text: "읽기 전용",                  onClick: undefined };
    else                                footer = { dotClass: "",            text: "자동 저장됨",                onClick: undefined };

    if (!editable) return null;

    return (
        <Box
            className="pd-panel"
            sx={{
                background: "var(--plando-surface)",
                height: kbOffset > 0 ? `calc(100dvh - ${kbOffset}px)` : "100%",
                transition: kbOffset > 0 ? "none" : "height 0.15s ease",
            }}
        >
            {/* 컬러바 — safe-area 만큼 상단 공간 확보 + 컬러바 두께 */}
            <Box sx={{ pt: "env(safe-area-inset-top, 0px)", background: "var(--plando-surface)", flexShrink: 0 }}>
                {/* 커스텀 상태는 CSS 클래스가 없으므로 상태 색을 인라인으로 (클래스 미매칭 시 컬러바가 통째로 사라졌었다) */}
                <div
                    className={STATUS_BAR_CLASS[status] ?? "pdp-colorbar"}
                    style={STATUS_BAR_CLASS[status] ? undefined : { background: statusHex }}
                />
            </Box>

            {/* 헤더 */}
            <Box
                sx={{
                    background: "var(--plando-surface)",
                    px: "16px",
                    pt: "10px",
                    pb: "10px",
                    flexShrink: 0,
                }}
            >
                {/* 상단 아이콘 줄 */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                    <button type="button" className="pd-iconbtn" style={{ width: 36, height: 36 }} onClick={onClose} title="뒤로">
                        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 16 }} />
                    </button>
                    <Box sx={{ flex: 1 }} />
                    {onToggleFocus && (
                        <button
                            type="button"
                            className={`pd-iconbtn${focused ? " is-active" : ""}`}
                            style={{ width: 36, height: 36 }}
                            onClick={onToggleFocus}
                            title={focused ? "포커스 해제" : "포커스로 마킹"}
                        >
                            {focused ? <BoltRoundedIcon sx={{ fontSize: 18 }} /> : <BoltOutlinedIcon sx={{ fontSize: 18 }} />}
                        </button>
                    )}
                    <button
                        type="button"
                        className="pd-iconbtn"
                        style={{ width: 36, height: 36 }}
                        onClick={(e) => setMoreMenuEl(e.currentTarget)}
                        title="더보기"
                    >
                        <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
                    </button>
                    {showClose && (
                        <button type="button" className="pd-iconbtn" style={{ width: 36, height: 36 }} onClick={onClose} title="닫기">
                            <CloseRoundedIcon sx={{ fontSize: 18 }} />
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
                    style={{ fontSize: 22, marginTop: 2 }}
                />

                {/* 상태·우선순위 배지 + 읽기 전용 */}
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
                    <span
                        className={STATUS_BADGE_CLASS[status] ?? "pd-badge"}
                        style={STATUS_BADGE_CLASS[status]
                            ? { padding: "3px 9px", fontSize: 11.5 }
                            : { padding: "3px 9px", fontSize: 11.5, background: alpha(statusHex, 0.14), color: statusHex }}
                    >
                        {statusLabelOf(status)}
                    </span>
                    <span
                        className="pd-badge"
                        style={{
                            background: "var(--plando-surface-low)",
                            color: "var(--plando-text-secondary)",
                            padding: "3px 9px", fontSize: 11.5,
                        }}
                    >
                        <PrioIcon priority={priority} />
                        {PRIORITY_LABEL[priority]}
                    </span>
                    {(todo?.userName || todo?.userEmail) && (
                        <Typography sx={{ ml: 0.5, fontSize: 11.5, color: "var(--plando-text-tertiary)", letterSpacing: "-0.1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                            작성자 : {todo.userName || todo.userEmail}
                        </Typography>
                    )}
                    {!todo?.userName && !todo?.userEmail && <Box sx={{ flex: 1 }} />}
                    {isReadOnly && (
                        <span className="pd-callout">
                            <LockOutlinedIcon sx={{ fontSize: 12 }} /> 읽기 전용
                        </span>
                    )}
                </Box>
            </Box>

            {/* 탭 */}
            <Box sx={{ background: "var(--plando-surface)", flexShrink: 0 }}>
                <div className="pd-tabs">
                    <button type="button" className={`pd-tab${tab === 0 ? " is-active" : ""}`} onClick={() => setTab(0)}>
                        개요
                    </button>
                    <button type="button" className={`pd-tab${tab === 1 ? " is-active" : ""}`} onClick={() => setTab(1)}>
                        댓글
                        {commentCount > 0 && <span className="pd-tab-count">{commentCount}</span>}
                    </button>
                    <button type="button" className={`pd-tab${tab === 2 ? " is-active" : ""}`} onClick={() => setTab(2)}>
                        첨부
                    </button>
                    <button type="button" className={`pd-tab${tab === 3 ? " is-active" : ""}`} onClick={() => setTab(3)}>
                        활동
                        {activityCount > 0 && <span className="pd-tab-count">{activityCount}</span>}
                    </button>
                </div>
            </Box>

            {/* 본문 */}
            {tab === 1 ? (
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--plando-bg)" }}>
                    <CommentSection todoId={todo?.id} workspaceId={workspaceId} />
                </Box>
            ) : (
                <Box className="pd-scroll" sx={{ flex: 1, minHeight: 0, background: "var(--plando-bg)", p: "12px" }}>
                    {tab === 0 && (
                        <>
                            {/* 내용 카드 */}
                            <div className="pdp-card" style={{ marginBottom: 12, padding: "14px" }}>
                                <label className="pd-label" style={{ marginBottom: 6 }}>내용</label>
                                <RichTextEditor
                                    value={todo?.content ?? ""}
                                    editable={!isReadOnly}
                                    placeholder="내용 입력, '/' 로 명령어 사용"
                                    ariaLabel="내용"
                                    minHeight={56}
                                    slashMenu
                                    onChange={handleDescChange}
                                />
                            </div>

                            {/* 속성 카드 (iOS 설정 스타일) — 헤더 라벨 없이 그룹핑만 */}
                            <div className="pdp-card" style={{ marginBottom: 12, padding: 0 }}>
                                <Box sx={{ px: "14px", pt: "6px" }}>
                                    <MobileAttrRow
                                        icon={
                                            <span
                                                className={STATUS_DOT_CLASS[status] ?? undefined}
                                                style={STATUS_DOT_CLASS[status]
                                                    ? { width: 8, height: 8 }
                                                    : { width: 8, height: 8, borderRadius: 999, background: statusHex, display: "inline-block" }}
                                            />
                                        }
                                        label="상태"
                                        value={
                                            <span
                                                className={STATUS_BADGE_CLASS[status] ?? "pd-badge"}
                                                style={STATUS_BADGE_CLASS[status]
                                                    ? { padding: "2px 8px" }
                                                    : { padding: "2px 8px", background: alpha(statusHex, 0.14), color: statusHex }}
                                            >
                                                {statusLabelOf(status)}
                                            </span>
                                        }
                                        onClick={isReadOnly ? undefined : () => toggleAttr("status")}
                                        expanded={expandedAttr === "status"}
                                    />
                                    <Collapse in={expandedAttr === "status"} unmountOnExit >
                                        <Box sx={{ py: 1.25, ...fadeDividerSx("var(--plando-divider)", "bottom") }}>
                                            {/* 상태가 3개 이하(기본 워크스페이스)면 기존 세그먼트, 그 이상이면 목록 —
                                                좁은 모바일 폭에서 세그먼트에 커스텀 상태를 다 밀어넣으면 라벨이 전부 잘려 고를 수 없다. */}
                                            {statusOptions.length <= 3 ? (
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
                                            ) : (
                                                statusDefs.map((s) => {
                                                    const selected = s.statusKey === status;
                                                    return (
                                                        <Box
                                                            key={s.statusKey}
                                                            onClick={() => {
                                                                if (selected) { setExpandedAttr(null); return; }
                                                                setEditable((prev) => ({ ...prev, status: s.statusKey }));
                                                                onPatchLocal?.({ status: s.statusKey });
                                                                commit("status", s.statusKey);
                                                                setExpandedAttr(null);
                                                            }}
                                                            sx={{
                                                                display: "flex", alignItems: "center", gap: 1.25,
                                                                px: 1, py: 1, borderRadius: "8px", cursor: "pointer",
                                                                "&:active": { background: "var(--plando-surface-alt)" },
                                                            }}
                                                        >
                                                            <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: statusColorOf(s.statusKey), flexShrink: 0 }} />
                                                            <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: selected ? 700 : 500 }} noWrap>
                                                                {s.label}
                                                            </Typography>
                                                            {selected && <CheckRoundedIcon sx={{ fontSize: 15, color: "primary.main" }} />}
                                                        </Box>
                                                    );
                                                })
                                            )}
                                        </Box>
                                    </Collapse>

                                    <MobileAttrRow
                                        icon={<PrioIcon priority={priority} />}
                                        label="우선순위"
                                        value={<>{PRIORITY_LABEL[priority]}</>}
                                        onClick={isReadOnly ? undefined : () => toggleAttr("priority")}
                                        expanded={expandedAttr === "priority"}
                                    />
                                    <Collapse in={expandedAttr === "priority"} unmountOnExit >
                                        <Box sx={{ py: 1.25, ...fadeDividerSx("var(--plando-divider)", "bottom") }}>
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
                                    <MobileAttrRow
                                        icon={<CurProjectIcon sx={{ fontSize: 14, color: curProjectIsInbox ? "var(--plando-text-tertiary)" : projectIconColor(curProject.color) }} />}
                                        label="프로젝트"
                                        value={curProjectIsInbox ? "인박스" : curProject.name}
                                        onClick={isReadOnly ? undefined : () => toggleAttr("project")}
                                        expanded={expandedAttr === "project"}
                                    />
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
                                                            display: "flex", alignItems: "center", gap: 1.25,
                                                            px: 1, py: 1, borderRadius: "8px", cursor: "pointer",
                                                            "&:active": { background: "var(--plando-surface-alt)" },
                                                        }}
                                                    >
                                                        <OptIcon sx={{ fontSize: 16, color: projectIconColor(opt.color) ?? "var(--plando-text-tertiary)", flexShrink: 0 }} />
                                                        <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: selected ? 700 : 500 }} noWrap>
                                                            {opt.label}
                                                        </Typography>
                                                        {selected && <CheckRoundedIcon sx={{ fontSize: 15, color: "primary.main" }} />}
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    </Collapse>

                                    <MobileAttrRow
                                        icon={<EventOutlinedIcon sx={{ fontSize: 14 }} />}
                                        label="시작일"
                                        value={editable.startAt ? formatAbsoluteDue(editable.startAt) : "추가"}
                                        muted={!editable.startAt}
                                        dateInput={{
                                            value: editable.startAt,
                                            disabled: isReadOnly,
                                            max: editable.dueDate || undefined,   // 마감일보다 늦은 시작일 선택 불가
                                            onChange: (e) => {
                                                const v = e.target.value;
                                                setEditable((prev) => ({ ...prev, startAt: v }));
                                                onPatchLocal?.({ startAt: v });
                                                commit("startAt", v);
                                            },
                                        }}
                                    />
                                    <MobileAttrRow
                                        icon={<EventOutlinedIcon sx={{ fontSize: 14 }} />}
                                        label="마감일"
                                        value={editable.dueDate ? formatAbsoluteDue(editable.dueDate) : "추가"}
                                        muted={!editable.dueDate}
                                        dateInput={{
                                            value: editable.dueDate,
                                            disabled: isReadOnly,
                                            min: editable.startAt || undefined,   // 시작일보다 빠른 마감일 선택 불가
                                            onChange: (e) => {
                                                const v = e.target.value;
                                                setEditable((prev) => ({ ...prev, dueDate: v }));
                                                onPatchLocal?.({ dueDate: v });
                                                commit("dueDate", v);
                                            },
                                        }}
                                    />
                                    {/* 하루종일 토글 + 시간 */}
                                    {(editable.startAt || editable.dueDate) && (
                                        <>
                                            <MobileAttrRow
                                                icon={<ScheduleRoundedIcon sx={{ fontSize: 14 }} />}
                                                label="하루종일"
                                                value={
                                                    <Switch
                                                        size="small"
                                                        checked={!editable.startTime && !editable.endTime}
                                                        disabled={isReadOnly}
                                                        /* startTime/endTime은 반드시 한 묶음(commitMany)으로 — 데스크탑과 동일.
                                                           commit 2회는 같은 롤백 기준값을 캡처해서 서로의 저장 결과를 지운다. */
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
                                                }
                                            />
                                            {(editable.startTime || editable.endTime) && (
                                                <>
                                                    <MobileAttrRow
                                                        icon={<ScheduleRoundedIcon sx={{ fontSize: 14 }} />}
                                                        label="시작 시간"
                                                        value={formatTimeAmPm(editable.startTime) || "추가"}
                                                        muted={!editable.startTime}
                                                        dateInput={{
                                                            type: "time",
                                                            value: editable.startTime || "",
                                                            disabled: isReadOnly,
                                                            onChange: (e) => {
                                                                const v = e.target.value;
                                                                setEditable((prev) => ({ ...prev, startTime: v }));
                                                                onPatchLocal?.({ startTime: v });
                                                                commit("startTime", v);
                                                            },
                                                        }}
                                                    />
                                                    <MobileAttrRow
                                                        icon={<ScheduleRoundedIcon sx={{ fontSize: 14 }} />}
                                                        label="종료 시간"
                                                        value={formatTimeAmPm(editable.endTime) || "추가"}
                                                        muted={!editable.endTime}
                                                        dateInput={{
                                                            type: "time",
                                                            value: editable.endTime || "",
                                                            disabled: isReadOnly,
                                                            onChange: (e) => {
                                                                const v = e.target.value;
                                                                setEditable((prev) => ({ ...prev, endTime: v }));
                                                                onPatchLocal?.({ endTime: v });
                                                                commit("endTime", v);
                                                            },
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}
                                    <MobileAttrRow
                                        icon={<PersonOutlineRoundedIcon sx={{ fontSize: 14 }} />}
                                        label="담당자"
                                        value={
                                            selectedAssigneeValues.length === 0
                                                ? "추가"
                                                : selectedAssigneeValues.length === 1
                                                    ? (() => {
                                                        const opt = assigneeOptions.find((u) => getOptionValue(u) === selectedAssigneeValues[0]);
                                                        return opt ? getOptionLabel(opt) : selectedAssigneeValues[0];
                                                    })()
                                                    : `${(() => {
                                                        const opt = assigneeOptions.find((u) => getOptionValue(u) === selectedAssigneeValues[0]);
                                                        return opt ? getOptionLabel(opt) : selectedAssigneeValues[0];
                                                    })()} 외 ${selectedAssigneeValues.length - 1}명`
                                        }
                                        muted={selectedAssigneeValues.length === 0}
                                        onClick={isReadOnly ? undefined : () => setAssigneeSheetOpen(true)}
                                    />
                                    <MobileAttrRow
                                        icon={<RepeatRoundedIcon sx={{ fontSize: 14 }} />}
                                        label="반복"
                                        value={recurrence.type === "NONE" ? "없음" : (RECURRENCE_LABEL[recurrence.type] || "없음")}
                                        muted={recurrence.type === "NONE"}
                                        onClick={isReadOnly ? undefined : () => toggleAttr("recurrence")}
                                        expanded={expandedAttr === "recurrence"}
                                        lastInGroup={expandedAttr !== "recurrence"}
                                    />
                                    <Collapse in={expandedAttr === "recurrence"} unmountOnExit >
                                        <Box sx={{ py: 1.25 }}>
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
                                                <Box sx={{ mt: 1.5 }}>
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
                                </Box>

                            </div>

                            {/* 서브태스크(parentId 기반 실제 할 일) — parentId 있으면 상위 브레드크럼, 없으면 서브태스크 목록 */}
                            <Box sx={{ mb: "12px" }}>
                                <TodoSubtaskSection todoId={todo?.id} parentId={todo?.parentId} />
                            </Box>

                            {/* 최근 활동 */}
                            <div className="pdp-card" style={{ marginBottom: 12 }}>
                                <div className="pdp-card-head">
                                    <div className="pdp-card-head-title">최근 활동</div>
                                    <button type="button" className="pd-textbtn" onClick={() => setTab(3)}>
                                        모두 보기
                                    </button>
                                </div>
                                <Box sx={{ px: "14px", pb: "12px" }}>
                                    <ActivityPreview todoId={todo?.id} onShowAll={() => setTab(3)} users={assigneeOptions} />
                                </Box>
                            </div>

                            {/* 위치 */}
                            <LocationCard todo={todo} onMapClick={onMapClick} />

                            <Box sx={{ height: 8 }} />
                        </>
                    )}
                    {tab === 2 && <TodoAttachmentSection todoId={todo?.id} />}
                    {tab === 3 && <LogSection todoId={todo?.id} compact users={assigneeOptions} />}
                </Box>
            )}

            {/* 푸터 (댓글 탭 제외) — 댓글 탭 input bar(약 64px)와 높이 통일.
                safe-area는 Drawer paper(.MuiDrawer-paperAnchorBottom 글로벌 rule)에서 이미 적용되므로 여기서 추가하지 않음. */}
            {tab !== 1 && (
                <Box
                    onClick={footer?.onClick}
                    sx={{
                        px: 1.5,
                        py: 1,
                        minHeight: 64,
                        boxSizing: "border-box",
                        ...fadeDividerSx("var(--plando-divider)"),
                        background: "var(--plando-surface)",
                        display: "flex", alignItems: "center", gap: 1.25,
                        flexShrink: 0,
                        cursor: footer?.onClick ? "pointer" : "default",
                    }}
                >
                    <Box sx={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: 12, color: "var(--plando-text-tertiary)" }}>
                        <span className={`pdp-minifooter-dot ${footer.dotClass}`} />
                        {footer.text}
                    </Box>
                    <button
                        type="button"
                        className="pd-textbtn"
                        onClick={(e) => { e.stopPropagation(); setTab(1); }}
                        style={{ padding: "9px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} /> 댓글
                    </button>
                </Box>
            )}

            {/* 상태/우선순위는 속성 카드 안에서 Collapse로 인라인 확장됨 (Menu 사용 안 함) */}

            {/* ── 더보기 메뉴 (보관/복원/삭제) ─────────── */}
            <Menu
                anchorEl={moreMenuEl}
                open={Boolean(moreMenuEl)}
                onClose={() => setMoreMenuEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                sx={{ zIndex: Z.DIALOG }}
                slotProps={{ paper: { sx: { minWidth: 180, mt: 0.5, borderRadius: 2 } } }}
            >
                {onRestore && (
                    <MenuItem onClick={() => { setMoreMenuEl(null); onRestore(); onClose?.(); }}>
                        <RestoreRoundedIcon sx={{ fontSize: 18, mr: 1 }} /> 복원
                    </MenuItem>
                )}
                {!onRestore && onArchive && (
                    <MenuItem onClick={() => { setMoreMenuEl(null); onArchive(); }}>
                        <Inventory2RoundedIcon sx={{ fontSize: 18, mr: 1 }} /> 아카이브로 보관
                    </MenuItem>
                )}
                <MenuItem
                    onClick={() => { setMoreMenuEl(null); setDeleteOpen(true); }}
                    sx={{ color: "var(--plando-red)" }}
                >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 18, mr: 1 }} /> 삭제
                </MenuItem>
            </Menu>

            {/* ── 참여자 바텀시트 ───────────────────────── */}
            <MobileBottomSheet
                open={assigneeSheetOpen}
                onClose={() => setAssigneeSheetOpen(false)}
                maxHeight="65vh"
            >
                <AssigneeListContent
                    options={assigneeOptions}
                    selectedValues={selectedAssigneeValues}
                    onApply={(nextValues) => {
                        setEditable((prev) => ({ ...prev, assignees: nextValues }));
                        setSelectedAssignees?.(nextValues);
                        onPatchLocal?.({ assignees: nextValues });
                        commit("assignees", nextValues.join(","));
                    }}
                    onClose={() => setAssigneeSheetOpen(false)}
                    sizeHint="comfortable"
                />
            </MobileBottomSheet>

        </Box>
    );
}
