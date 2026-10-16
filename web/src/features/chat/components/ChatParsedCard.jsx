import { useState, useEffect } from "react";
import {
    Box,
    Chip,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import LocationPickerField from "../../map/components/LocationPickerField.jsx";

import CardSection from "../../../shared/ui/common/CardSection.jsx";
import FieldLabel from "../../../shared/ui/common/FieldLabel.jsx";
import { fieldSx } from "../../../shared/ui/common/fieldStyles.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import SegmentedControl from "../../../shared/ui/common/SegmentedControl.jsx";
import AssigneePicker from "../../../shared/ui/common/AssigneePicker.jsx";
import { getOptionValue, getOptionLabel } from "../../../shared/utils/assigneeUtils.js";
import { TagChip, PRIORITY } from "./ChatWidgetTokens.jsx";
import { priorityColor, softOn } from "../../../shared/ui/tone.js";

const PRIORITY_OPTIONS = [
    { value: "high",   label: "높음" },
    { value: "medium", label: "중간" },
    { value: "low",    label: "낮음" },
];

/**
 * AI가 파싱한 새 task 미리보기/편집 카드.
 * Phase 7 redesign — CardSection 위에 AI 그라데이션 헤더 + 본문(미리보기/편집) + 액션 버튼.
 *
 * 기능 보존: 편집 모드 토글, 제목/내용/시작일/마감일/우선순위/참여자, 재생성, 추가/취소.
 */
export default function ChatParsedCard({ task, assigneeOptions = [], onConfirm, onEdit, onRetry }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const [editMode, setEditMode] = useState(false);
    /*
     * 비어 있는 선택 항목은 접어 둔다.
     * 예전엔 내용·장소·참여자가 값이 없어도 항상 펼쳐져, **빈 필드가 카드의 절반 이상**을
     * 차지했다. 실제로 채운 건 제목·마감일·우선순위뿐인데 카드만 길었다.
     * 값이 있으면 자동으로 보이고, 없으면 "항목 더하기"로 꺼낸다.
     */
    const [showOptional, setShowOptional] = useState(false);
    const [edited, setEdited]     = useState(task);

    useEffect(() => { setEdited(task); }, [task]);

    /* 우선순위별 색조 — tone.js 단일 소스 (AI 파싱값은 소문자라 대문자로 정규화) */
    const priorityHex = priorityColor(theme, String(edited.priority ?? "").toUpperCase());
    const priorityDim = softOn(theme, priorityHex, 0.8);

    const handleAssigneeChange = (selectedEmails) => {
        const names = selectedEmails.map((email) => {
            const user = assigneeOptions.find((u) => getOptionValue(u) === email);
            return user
                ? getOptionLabel(user)
                : (email.includes("@") ? email.split("@")[0] : email);
        });
        setEdited((p) => ({ ...p, assigneeEmails: selectedEmails, assignees: names }));
    };

    /**
     * 로그인·회원가입·설정에서 쓰는 공용 필드 스타일로 맞춘다.
     * 예전엔 inputSxFlat(테두리 투명 + 채움 배경)을 써서 이 카드만 평평하고 옛날 화면처럼 보였다.
     * 같은 제품 안에서 입력칸이 두 가지로 보이면 그 자체가 낡은 인상을 준다.
     */
    const inputSx = fieldSx(theme);

    /** 값이 있으면 항상 보이고, 없으면 사용자가 펼쳤을 때만 보인다. */
    const show = (key) => {
        if (showOptional) return true;
        if (key === "desc") return Boolean(edited.description);
        if (key === "place") return Boolean(edited.locationName);
        if (key === "assignee") return (edited.assigneeEmails ?? []).length > 0;
        return true;
    };
    const hiddenCount = ["desc", "place", "assignee"].filter((k) => !show(k)).length;

    return (
        <CardSection padding={0} sx={{ overflow: "hidden" }}>
            {/* AI 배지 헤더.
                예전엔 배경·아이콘·제목이 각각 다른 그라디언트를 써서 세 겹으로 겹쳤다.
                그라디언트는 아이콘 하나에만 남기고 나머지는 평범한 색으로 — 강조가 한 군데일 때
                그게 강조로 읽힌다. */}
            <Box
                sx={{
                    bgcolor: "background.paper",
                    px: 2,
                    py: 1.125,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                        sx={{
                            width: 22,
                            height: 22,
                            borderRadius: 1,
                            background: "var(--plando-ai-grad)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                        }}
                    >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary" }}>
                        AI 초안
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={0.75}>
                    <Press
                        as="span"
                        onClick={onRetry}
                        haptic="light"
                        pressScale={0.95}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: theme.palette.background.paper,
                            boxShadow: "var(--plando-shadow-card-ring)",
                            color: theme.palette.text.secondary,
                            fontSize: 11.5,
                            fontWeight: 600,
                        }}
                    >
                        <RefreshRoundedIcon sx={{ fontSize: 13 }} />
                        재생성
                    </Press>
                    <Press
                        as="span"
                        onClick={() => setEditMode((p) => !p)}
                        haptic="light"
                        pressScale={0.95}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: editMode
                                ? alpha(theme.palette.primary.main, 0.12)
                                : theme.palette.background.paper,
                            boxShadow: editMode ? "none" : "var(--plando-shadow-card-ring)",
                            color: editMode ? theme.palette.primary.main : theme.palette.text.secondary,
                            fontSize: 11.5,
                            fontWeight: 700,
                        }}
                    >
                        <EditRoundedIcon sx={{ fontSize: 13 }} />
                        {editMode ? "편집 닫기" : "편집"}
                    </Press>
                </Stack>
            </Box>

            {/* 본문 */}
            <Box sx={{ p: 2.25 }}>
                {editMode ? (
                    /* 편집 모드 */
                    <Stack spacing={1.5}>
                        <Box>
                            <FieldLabel>제목</FieldLabel>
                            <TextField
                                fullWidth
                                value={edited.title}
                                onChange={(e) => setEdited((p) => ({ ...p, title: e.target.value }))}
                                sx={{
                                    ...inputSx,
                                    "& .MuiOutlinedInput-root": {
                                        ...inputSx["& .MuiOutlinedInput-root"],
                                        fontWeight: 800,
                                        fontSize: 16,
                                    },
                                }}
                            />
                        </Box>

                            {show("desc") && (
                        <Box>
                            <FieldLabel>내용</FieldLabel>
                            <TextField
                                fullWidth
                                multiline
                                minRows={3}
                                value={edited.description}
                                onChange={(e) => setEdited((p) => ({ ...p, description: e.target.value }))}
                                sx={inputSx}
                            />
                        </Box>
                            )}

                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
                            <Box>
                                <FieldLabel>시작일</FieldLabel>
                                <TextField
                                    fullWidth
                                    type="date"
                                    size="small"
                                    value={edited.startAt || ""}
                                    onChange={(e) => setEdited((p) => ({ ...p, startAt: e.target.value }))}
                                    InputLabelProps={{ shrink: true }}
                                    sx={inputSx}
                                />
                            </Box>
                            <Box>
                                <FieldLabel>마감일</FieldLabel>
                                <TextField
                                    fullWidth
                                    type="date"
                                    size="small"
                                    value={edited.dueDate || ""}
                                    onChange={(e) => setEdited((p) => ({ ...p, dueDate: e.target.value }))}
                                    InputLabelProps={{ shrink: true }}
                                    sx={inputSx}
                                />
                            </Box>
                        </Box>

                        {/* 시간 (선택) */}
                        {(edited.startTime || edited.endTime || edited.allDay === false) && (
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
                                <Box>
                                    <FieldLabel>시작 시간</FieldLabel>
                                    <TextField
                                        fullWidth
                                        type="time"
                                        size="small"
                                        value={edited.startTime || ""}
                                        onChange={(e) => setEdited((p) => ({ ...p, startTime: e.target.value, allDay: !e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                        sx={inputSx}
                                    />
                                </Box>
                                <Box>
                                    <FieldLabel>종료 시간</FieldLabel>
                                    <TextField
                                        fullWidth
                                        type="time"
                                        size="small"
                                        value={edited.endTime || ""}
                                        onChange={(e) => setEdited((p) => ({ ...p, endTime: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                        sx={inputSx}
                                    />
                                </Box>
                            </Box>
                        )}

                        <Box>
                            <FieldLabel
                                icon={<FlagRoundedIcon sx={{ fontSize: 14 }} />}
                            >
                                우선순위
                            </FieldLabel>
                            <SegmentedControl
                                fullWidth
                                options={PRIORITY_OPTIONS}
                                value={edited.priority}
                                onChange={(v) => setEdited((p) => ({ ...p, priority: v }))}
                            />
                        </Box>

                            {show("place") && (
                        <Box>
                            <FieldLabel
                                icon={<PlaceRoundedIcon sx={{ fontSize: 14 }} />}
                            >
                                장소 <Box component="span" sx={{ ml: 0.5, color: "text.disabled", fontWeight: 500 }}>(선택)</Box>
                            </FieldLabel>
                            <LocationPickerField
                                inputSx={inputSx}
                                value={edited.locationName ? {
                                    locationName: edited.locationName,
                                    locationAddress: edited.locationAddress,
                                    locationLat: edited.locationLat,
                                    locationLng: edited.locationLng,
                                } : null}
                                onChange={(loc) => setEdited((p) => ({
                                    ...p,
                                    locationName: loc?.locationName ?? null,
                                    locationAddress: loc?.locationAddress ?? null,
                                    locationLat: loc?.locationLat ?? null,
                                    locationLng: loc?.locationLng ?? null,
                                    place: loc?.locationName ?? "",
                                }))}
                            />
                        </Box>
                            )}

                            {show("assignee") && (
                        <Box>
                            <FieldLabel
                                icon={<PersonRoundedIcon sx={{ fontSize: 14 }} />}
                            >
                                참여자
                            </FieldLabel>
                            {isMobile ? (
                                <AssigneePicker
                                    assigneeOptions={assigneeOptions}
                                    selectedValues={edited.assigneeEmails ?? []}
                                    onChange={handleAssigneeChange}
                                    title=""
                                    emptyText="담당자를 선택하세요"
                                    dialogTitle="담당자 선택"
                                />
                            ) : (
                                <Select
                                    multiple
                                    size="small"
                                    fullWidth
                                    value={edited.assigneeEmails ?? []}
                                    onChange={(e) => handleAssigneeChange(e.target.value)}
                                    displayEmpty
                                    renderValue={(selected) =>
                                        selected.length === 0 ? (
                                            <Typography sx={{ color: "text.disabled", fontSize: 13 }}>
                                                담당자를 선택하세요
                                            </Typography>
                                        ) : (
                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                                {selected.map((email) => {
                                                    const u = assigneeOptions.find((x) => getOptionValue(x) === email);
                                                    return (
                                                        <Chip
                                                            key={email}
                                                            label={u ? getOptionLabel(u) : email}
                                                            size="small"
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        )
                                    }
                                    // 위 입력칸들과 같은 테두리·포커스 링을 쓴다.
                                    // 여기만 테두리 투명이면 한 카드 안에서 입력칸이 두 종류로 보인다.
                                    sx={{
                                        borderRadius: "12px",
                                        fontSize: 14,
                                        bgcolor: "background.paper",
                                        "& .MuiOutlinedInput-notchedOutline": {
                                            borderColor: (t) => t.palette.mode === "dark"
                                                ? alpha("#fff", 0.18) : "#CBD5E1",
                                        },
                                        "&:hover .MuiOutlinedInput-notchedOutline": {
                                            borderColor: (t) => t.palette.mode === "dark"
                                                ? alpha("#fff", 0.30) : "#94A3B8",
                                        },
                                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                            borderColor: "primary.main",
                                            borderWidth: "1px",
                                        },
                                        "&.Mui-focused": {
                                            boxShadow: (t) => `0 0 0 4px ${alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.22 : 0.12)}`,
                                        },
                                    }}
                                >
                                    {assigneeOptions.map((u) => (
                                        <MenuItem key={getOptionValue(u)} value={getOptionValue(u)}>
                                            {getOptionLabel(u)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            )}
                        </Box>
                            )}

                        {/* 접어 둔 항목을 꺼내는 길. 접기만 하고 꺼낼 수 없으면 기능이 사라진 것이다. */}
                        {hiddenCount > 0 && (
                            <Press
                                onClick={() => setShowOptional(true)}
                                haptic="light"
                                pressScale={0.99}
                                activeBg={theme.palette.action.hover}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    alignSelf: "flex-start",
                                    padding: "7px 12px",
                                    borderRadius: 9,
                                    backgroundColor: "transparent",
                                    boxShadow: "var(--plando-shadow-card-ring)",
                                    color: theme.palette.text.secondary,
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                }}
                            >
                                + 내용 · 장소 · 참여자 추가
                            </Press>
                        )}
                    </Stack>
                ) : (
                    /* 미리보기 모드 */
                    <Box>
                        <Typography
                            sx={{
                                fontSize: 17,
                                fontWeight: 800,
                                lineHeight: 1.35,
                                mb: 0.75,
                                wordBreak: "break-word",
                            }}
                        >
                            {edited.title}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.875} useFlexGap>
                            <TagChip
                                label={PRIORITY[edited.priority]?.label || edited.priority}
                                bg={priorityDim}
                                color={priorityHex}
                                icon={<FlagRoundedIcon sx={{ fontSize: 11 }} />}
                            />
                            {edited.dueDate && (
                                <TagChip
                                    label={edited.dueDate}
                                    bg={alpha(theme.palette.primary.main, 0.10)}
                                    color={theme.palette.primary.main}
                                    icon={<CalendarMonthRoundedIcon sx={{ fontSize: 11 }} />}
                                />
                            )}
                            {edited.startTime && (
                                <TagChip
                                    label={edited.endTime ? `${edited.startTime} – ${edited.endTime}` : edited.startTime}
                                    bg={alpha(theme.palette.primary.main, 0.10)}
                                    color={theme.palette.primary.main}
                                />
                            )}
                            {(edited.assignees || []).length > 0 && (
                                <TagChip
                                    label={edited.assignees.join(", ")}
                                    bg="var(--plando-input-bg)"
                                    color={theme.palette.text.secondary}
                                    icon={<PersonRoundedIcon sx={{ fontSize: 11 }} />}
                                />
                            )}
                            {edited.category && (
                                <TagChip
                                    label={edited.category}
                                    bg="var(--plando-purple-soft)"
                                    color="var(--plando-purple)"
                                />
                            )}
                            {edited.place && (
                                <TagChip
                                    label={edited.place}
                                    bg="var(--plando-input-bg-hover)"
                                    color={theme.palette.text.secondary}
                                />
                            )}
                        </Stack>
                        {(edited.tags || []).length > 0 && (
                            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                                {edited.tags.map((tag) => {
                                    // 태그는 문자열(사용자 입력) 또는 객체({id,name,color}, AI 매칭) — 둘 다 안전 처리
                                    const label = typeof tag === "string" ? tag : tag?.name;
                                    const key = typeof tag === "string" ? tag : tag?.id ?? label;
                                    return (
                                        <Box
                                            key={key}
                                            component="span"
                                            sx={{
                                                fontSize: 11.5,
                                                color: "text.disabled",
                                                background: "var(--plando-input-bg)",
                                                borderRadius: 999,
                                                px: 1.125,
                                                py: 0.25,
                                            }}
                                        >
                                            #{label}
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </Box>
                )}
            </Box>

            {/* 액션 버튼 */}
            {/* 버튼 위계.
                예전엔 "취소"와 "할 일 추가"가 1:2 그리드로 나란히 있고, 추가 버튼이 파랑→보라
                그라디언트에 글로우까지 얹혀 카드의 절반을 먹었다. 취소가 그렇게 클 이유가 없고,
                그라디언트는 헤더 아이콘·제목·버튼 세 군데에서 제각각이라 산만했다.
                주 동작만 채우고 취소는 텍스트로 물러난다. */}
            <Box
                sx={{
                    px: 2.25,
                    pb: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 0.5,
                }}
            >
                <Press
                    onClick={onEdit}
                    haptic="light"
                    pressScale={0.97}
                    activeBg={theme.palette.action.hover}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: 38,
                        padding: "0 14px",
                        borderRadius: 10,
                        backgroundColor: "transparent",
                        color: theme.palette.text.secondary,
                        fontSize: 13.5,
                        fontWeight: 600,
                        border: "none",
                    }}
                >
                    취소
                </Press>
                <Press
                    onClick={() => onConfirm(edited)}
                    haptic="medium"
                    pressScale={0.97}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        height: 38,
                        padding: "0 18px",
                        borderRadius: 10,
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        fontSize: 13.5,
                        fontWeight: 700,
                        border: "none",
                    }}
                >
                    <AddRoundedIcon sx={{ fontSize: 16 }} />
                    할 일 추가
                </Press>
            </Box>
        </CardSection>
    );
}
