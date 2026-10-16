import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Box, Button, Chip, CircularProgress, Dialog, DialogActions, Divider,
    FormControl, IconButton, InputAdornment, InputLabel,
    MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import CloseRoundedIcon         from "@mui/icons-material/CloseRounded";
import ArrowBackRoundedIcon     from "@mui/icons-material/ArrowBackRounded";
import SearchRoundedIcon        from "@mui/icons-material/SearchRounded";
import RoomRoundedIcon          from "@mui/icons-material/RoomRounded";
import AddRoundedIcon           from "@mui/icons-material/AddRounded";
import RepeatRoundedIcon        from "@mui/icons-material/RepeatRounded";
import { Map, CustomOverlayMap } from "react-kakao-maps-sdk";
import { addTodo } from "../../todo/api/todoApi.js";
import { updateTodoLocation } from "../api/mapApi.js";
import { upsertRecurrence } from "../../todo/api/todoRecurrenceApi.js";
import { fetchAllUsers } from "../../../shared/api/userApi.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { fetchTemplates } from "../../todo/api/todoTemplateApi.js";
import { STATUS_OPTIONS, PRIORITY_LABEL } from "../../../shared/ui/tone.js";
import { PRIORITIES } from "../../todo/components/common/PriorityFlag.jsx";
import MapMarker from "./MapMarker.jsx";

const DEFAULT_CENTER     = { lat: 37.5665, lng: 126.978 };
const PLACE_MARKER_COLOR = "#8b5cf6";

const RECURRENCE_OPTIONS = [
    { value: "NONE",    label: "반복 없음" },
    { value: "DAILY",   label: "매일" },
    { value: "WEEKLY",  label: "매주" },
    { value: "MONTHLY", label: "매월" },
];

const INITIAL_TASK = {
    title: "", content: "", startAt: "", dueDate: "",
    priority: "MEDIUM", status: "TODO", assignees: [],
};

export default function PlaceSearchModal({ open, onClose, onSaved, kakaoReady }) {
    const { currentWorkspace } = useWorkspace();

    /* ── 단계 ── */
    const [step, setStep] = useState("search"); // "search" | "form"

    /* ── 장소 검색 ── */
    const [query, setQuery]         = useState("");
    const [results, setResults]     = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const debounceRef = useRef(null);

    /* ── 할 일 폼 ── */
    const [task, setTask]           = useState(INITIAL_TASK);
    const [touched, setTouched]     = useState(false);
    const [userList, setUserList]   = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [pendingRecurrenceType, setPendingRecurrenceType]       = useState("NONE");
    const [pendingRecurrenceEndDate, setPendingRecurrenceEndDate] = useState("");
    const [saving, setSaving] = useState(false);

    /* 열릴 때 초기화 + 유저 목록 로드 */
    useEffect(() => {
        if (!open) return;
        setStep("search");
        setQuery("");
        setResults([]);
        setSelectedPlace(null);
        setTask(INITIAL_TASK);
        setTouched(false);
        setPendingRecurrenceType("NONE");
        setPendingRecurrenceEndDate("");

        setLoadingUsers(true);
        fetchAllUsers()
            .then((res) => setUserList(res.data ?? []))
            .catch(() => {})
            .finally(() => setLoadingUsers(false));

        if (currentWorkspace?.workspaceId) {
            fetchTemplates(currentWorkspace.workspaceId)
                .then((res) => setTemplates(res.data ?? []))
                .catch(() => {});
        }
    }, [open, currentWorkspace?.workspaceId]);

    /* 카카오 장소 검색 — 정확도순 (거리 정렬 제거) */
    const search = useCallback((keyword) => {
        if (!keyword.trim() || !window.kakao?.maps?.services) { setResults([]); return; }
        setSearching(true);
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data, status) => {
            setSearching(false);
            setResults(
                status === window.kakao.maps.services.Status.OK ? data.slice(0, 8) : []
            );
        }); // 옵션 없음 → 기본 정확도순
    }, []);

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(val), 350);
    };

    const handleSelectPlace = (place) => {
        setSelectedPlace({
            lat:      parseFloat(place.y),
            lng:      parseFloat(place.x),
            name:     place.place_name,
            address:  place.road_address_name || place.address_name,
        });
    };

    /* 저장 */
    const handleSave = async () => {
        setTouched(true);
        if (!task.title?.trim() || saving) return;
        setSaving(true);
        try {
            const res = await addTodo({
                title:    task.title.trim(),
                content:  task.content || "",
                startAt:  task.startAt || null,
                dueDate:  task.dueDate || null,
                priority: task.priority,
                status:   task.status,
                assignees: task.assignees ?? [],
            });
            const todoId = res.data?.id;
            if (todoId) {
                const afterSave = [];
                if (selectedPlace) {
                    afterSave.push(updateTodoLocation(todoId, {
                        locationLat:     selectedPlace.lat,
                        locationLng:     selectedPlace.lng,
                        locationName:    selectedPlace.name,
                        locationAddress: selectedPlace.address,
                    }));
                }
                if (pendingRecurrenceType !== "NONE") {
                    afterSave.push(
                        upsertRecurrence(todoId, {
                            recurrenceType: pendingRecurrenceType,
                            endDate: pendingRecurrenceEndDate || null,
                        })
                    );
                }
                await Promise.all(afterSave).catch(() => {});
            }
            onSaved?.();
            onClose();
        } catch (e) {
            console.error("저장 실패", e);
        } finally {
            setSaving(false);
        }
    };

    const titleError = touched && !task.title?.trim() ? "제목은 필수예요." : "";
    const dateError  = task.startAt && task.dueDate && task.startAt > task.dueDate
        ? "시작일이 마감일보다 늦을 수 없어요." : "";
    const mapCenter  = selectedPlace
        ? { lat: selectedPlace.lat, lng: selectedPlace.lng }
        : DEFAULT_CENTER;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={false}
            PaperProps={{
                sx: {
                    width:     step === "form" ? { xs: "92vw", sm: 560 } : { xs: "95vw", md: 1060 },
                    height:    step === "form" ? "auto" : "82vh",
                    maxHeight: step === "form" ? "90vh" : "82vh",
                    borderRadius: 3,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "width 220ms ease-out",
                },
            }}
        >
            {/* ── 헤더 ── */}
            <Box sx={{ px: "20px", py: "14px", display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                {step === "form" && (
                    <IconButton size="small" onClick={() => setStep("search")} sx={{ mr: 0.5 }}>
                        <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                )}
                <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
                    {step === "search" ? "장소 찾기" : "할 일 추가"}
                </Typography>
                <IconButton size="small" onClick={onClose}>
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
            <Divider />

            {/* ══ STEP 1: 장소 검색 ══ */}
            {step === "search" && (
                <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>

                    {/* 좌측 50%: 검색 인풋 + 결과 */}
                    <Box sx={{ width: "50%", display: "flex", flexDirection: "column", borderRight: "1px solid var(--plando-border)" }}>
                        <Box sx={{ p: "14px 16px 12px", flexShrink: 0 }}>
                            <TextField
                                fullWidth autoFocus size="small"
                                placeholder="장소 이름으로 검색"
                                value={query}
                                onChange={handleQueryChange}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            {searching
                                                ? <CircularProgress size={16} />
                                                : <SearchRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                                            }
                                        </InputAdornment>
                                    ),
                                    endAdornment: query ? (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => { setQuery(""); setResults([]); setSelectedPlace(null); }}>
                                                <CloseRoundedIcon sx={{ fontSize: 15 }} />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : null,
                                }}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                            />
                        </Box>
                        <Divider />

                        {/* 결과 리스트 */}
                        <Box sx={{ flex: 1, overflowY: "auto" }}>
                            {results.length === 0 && !searching && (
                                <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, opacity: 0.45 }}>
                                    <RoomRoundedIcon sx={{ fontSize: 36, color: "text.secondary" }} />
                                    <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                                        {query.trim() ? "검색 결과가 없어요" : "장소 이름을 입력해주세요"}
                                    </Typography>
                                </Box>
                            )}

                            {results.map((place) => {
                                const isSelected =
                                    selectedPlace?.lat === parseFloat(place.y) &&
                                    selectedPlace?.lng === parseFloat(place.x);

                                return (
                                    <Box
                                        key={place.id}
                                        onClick={() => handleSelectPlace(place)}
                                        sx={{
                                            px: "16px", py: "12px",
                                            cursor: "pointer",
                                            borderBottom: "1px solid var(--plando-border)",
                                            borderLeft: `3px solid ${isSelected ? "var(--plando-primary)" : "transparent"}`,
                                            bgcolor: isSelected ? "var(--plando-primary-soft)" : "transparent",
                                            transition: "background 0.1s",
                                            "&:last-child": { borderBottom: "none" },
                                            "&:hover": { bgcolor: isSelected ? "var(--plando-primary-soft)" : "action.hover" },
                                        }}
                                    >
                                        {/* 장소명 */}
                                        <Typography
                                            sx={{
                                                fontSize: 13.5, fontWeight: 700, mb: "3px",
                                                color: isSelected ? "var(--plando-primary)" : "var(--plando-text-primary)",
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}
                                        >
                                            {place.place_name}
                                        </Typography>
                                        {/* 주소 */}
                                        <Typography
                                            sx={{
                                                fontSize: 12, color: "var(--plando-text-tertiary)",
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}
                                        >
                                            {place.road_address_name || place.address_name}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>

                        {/* CTA */}
                        <Divider />
                        <Box sx={{ p: "12px 16px", flexShrink: 0 }}>
                            <Button
                                fullWidth variant="contained"
                                disabled={!selectedPlace}
                                startIcon={<AddRoundedIcon />}
                                onClick={() => setStep("form")}
                                sx={{
                                    borderRadius: 2, fontWeight: 700, fontSize: 13.5,
                                    ...(selectedPlace && {
                                        }),
                                }}
                            >
                                {selectedPlace ? `"${selectedPlace.name}" 에서 할 일 추가` : "장소를 선택해주세요"}
                            </Button>
                        </Box>
                    </Box>

                    {/* 우측 50%: 미니맵 */}
                    <Box sx={{ width: "50%", position: "relative", overflow: "hidden" }}>
                        {!kakaoReady ? (
                            <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <CircularProgress size={28} />
                            </Box>
                        ) : (
                            <Map
                                center={mapCenter}
                                style={{ width: "100%", height: "100%" }}
                                level={selectedPlace ? 4 : 7}
                            >
                                {selectedPlace && (
                                    <CustomOverlayMap
                                        position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                                        yAnchor={1}
                                    >
                                        <MapMarker color={PLACE_MARKER_COLOR} selected />
                                    </CustomOverlayMap>
                                )}
                            </Map>
                        )}
                        {selectedPlace && (
                            <Box
                                sx={{
                                    position: "absolute", bottom: 12, left: 12, right: 12,
                                    bgcolor: "var(--plando-surface)", borderRadius: 2,
                                    boxShadow: "var(--plando-shadow-raised)",
                                    border: "1px solid var(--plando-border)",
                                    p: "10px 12px",
                                }}
                            >
                                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "var(--plando-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    📍 {selectedPlace.name}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: "var(--plando-text-tertiary)", mt: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {selectedPlace.address}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {/* ══ STEP 2: 할 일 생성 폼 (기존 AddTodoDesktop 양식 동일) ══ */}
            {step === "form" && (
                <>
                    <Box sx={{ flex: 1, overflowY: "auto", p: "20px 24px", display: "flex", flexDirection: "column", gap: 2 }}>

                        {/* 선택된 장소 (읽기전용) */}
                        {selectedPlace && (
                            <Box sx={{ p: "12px 14px", borderRadius: 2, bgcolor: "var(--plando-primary-soft)", border: "1px solid var(--plando-primary)" }}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <RoomRoundedIcon sx={{ fontSize: 16, color: "var(--plando-primary)", flexShrink: 0 }} />
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "var(--plando-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {selectedPlace.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: 11.5, color: "var(--plando-primary)", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {selectedPlace.address}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Box>
                        )}

                        {/* 제목 */}
                        <Box>
                            <Typography variant="caption" color="text.secondary">제목</Typography>
                            <TextField
                                autoFocus fullWidth
                                placeholder="할 일 제목을 입력하세요"
                                value={task.title}
                                onChange={(e) => setTask((p) => ({ ...p, title: e.target.value }))}
                                onBlur={() => setTouched(true)}
                                error={Boolean(titleError)}
                                helperText={titleError || " "}
                                inputProps={{ style: { fontWeight: 900 } }}
                                sx={{ mt: 0.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                        // IME 조합 중 Enter 무시 — 한글 조합 확정이 저장으로 이어지지 않도록
                                        if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                                        handleSave();
                                    }
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>내용</Typography>
                            <TextField
                                fullWidth multiline minRows={3}
                                placeholder="해야 할 일을 간단히 적어두면 좋아요."
                                value={task.content}
                                onChange={(e) => setTask((p) => ({ ...p, content: e.target.value }))}
                                sx={{ mt: 0.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                            />
                        </Box>

                        {/* 상태 정보 */}
                        <Box>
                            <Typography sx={{ fontWeight: 900, mb: 1.5 }}>상태 정보</Typography>
                            <Stack spacing={2}>
                                {/* 날짜 */}
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                    <TextField
                                        fullWidth type="date" size="small" label="시작일"
                                        value={task.startAt}
                                        onChange={(e) => setTask((p) => ({ ...p, startAt: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                        helperText=" "
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                    />
                                    <TextField
                                        fullWidth type="date" size="small" label="마감일"
                                        value={task.dueDate}
                                        onChange={(e) => setTask((p) => ({ ...p, dueDate: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                        error={Boolean(dateError)}
                                        helperText={dateError || " "}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                                    />
                                </Stack>

                                {/* 상태 */}
                                <FormControl fullWidth size="small">
                                    <InputLabel shrink>상태</InputLabel>
                                    <Select
                                        value={task.status} label="상태" notched
                                        onChange={(e) => setTask((p) => ({ ...p, status: e.target.value }))}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* 우선순위 */}
                                <FormControl fullWidth size="small">
                                    <InputLabel shrink>우선순위</InputLabel>
                                    <Select
                                        value={task.priority} label="우선순위" notched
                                        onChange={(e) => setTask((p) => ({ ...p, priority: e.target.value }))}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        {PRIORITIES.map((p) => (
                                            <MenuItem key={p} value={p}>{PRIORITY_LABEL[p] ?? p}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* 참여자 */}
                                <FormControl fullWidth size="small" disabled={loadingUsers}>
                                    <InputLabel shrink>담당자</InputLabel>
                                    <Select
                                        multiple
                                        value={task.assignees ?? []}
                                        label="담당자" notched
                                        onChange={(e) => setTask((p) => ({ ...p, assignees: e.target.value }))}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                                {selected.map((email) => {
                                                    const u = userList.find((x) => x.email === email);
                                                    return <Chip key={email} size="small" label={u ? u.name : email} />;
                                                })}
                                            </Box>
                                        )}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        {loadingUsers && (
                                            <MenuItem disabled>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <CircularProgress size={16} />
                                                    <Typography variant="body2">불러오는 중...</Typography>
                                                </Stack>
                                            </MenuItem>
                                        )}
                                        {!loadingUsers && userList.map((u) => (
                                            <MenuItem key={u.email} value={u.email}>
                                                {u.name} ({u.email})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Stack>
                        </Box>

                        {/* 반복 일정 */}
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                <RepeatRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "text.secondary" }}>
                                    반복 일정
                                </Typography>
                            </Stack>
                            <FormControl fullWidth size="small">
                                <Select
                                    value={pendingRecurrenceType}
                                    onChange={(e) => setPendingRecurrenceType(e.target.value)}
                                    sx={{ borderRadius: 2, fontSize: 14 }}
                                >
                                    {RECURRENCE_OPTIONS.map((opt) => (
                                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {pendingRecurrenceType !== "NONE" && (
                                <TextField
                                    size="small" type="date" label="반복 종료일 (선택)"
                                    value={pendingRecurrenceEndDate}
                                    onChange={(e) => setPendingRecurrenceEndDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                    sx={{ mt: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 14 } }}
                                />
                            )}
                        </Box>
                    </Box>

                    <Divider />
                    <DialogActions sx={{ p: "12px 20px", gap: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                            제목 필수 · Ctrl(⌘)+Enter 저장 / ESC 닫기
                        </Typography>
                        <Button variant="outlined" onClick={onClose} disabled={saving}>취소</Button>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={!task.title?.trim() || Boolean(dateError) || saving}
                            startIcon={saving ? <CircularProgress size={14} /> : undefined}
                        >
                            저장
                        </Button>
                    </DialogActions>
                </>
            )}
        </Dialog>
    );
}
