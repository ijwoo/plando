import { useState } from "react";
import { Box, Button, IconButton, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { recruitmentRoleOptions } from "../../mock/recruitmentFormOptions";
import { CountStepper, FieldLabel, scrollInputIntoView } from "./createFormShared";
import { APP_EVENTS } from "../../../../shared/constants/events.js";

function toast(message, severity = "warning") {
    window.dispatchEvent(
        new CustomEvent(APP_EVENTS.APP_TOAST, { detail: { message, severity } })
    );
}

const MAX_TEAM_SIZE = 20;
const MAX_ROLE_NAME_LEN = 30;
const POPULAR_COUNT = 5;

export default function Step2Roles({ form, setForm }) {
    const theme = useTheme();
    const [custom, setCustom] = useState("");
    const [showMoreRoles, setShowMoreRoles] = useState(false);

    const surfaceBg = alpha(theme.palette.text.primary, 0.05);
    const surfaceBg2 = alpha(theme.palette.text.primary, 0.03);

    const totalRoles = form.roles.reduce((s, r) => s + Number(r.count), 0);
    const availableSlots = Math.max(0, form.maxMembers - form.currentMembers);
    const remainingSlots = Math.max(0, availableSlots - totalRoles);
    const overflow = totalRoles > availableSlots;
    const progressPct = availableSlots > 0
        ? Math.min(100, (totalRoles / availableSlots) * 100)
        : 0;

    const addRole = (rawName, { silent = false } = {}) => {
        const name = (rawName || "").trim();
        if (!name) {
            if (!silent) toast("역할 이름을 입력해 주세요.");
            return;
        }
        if (name.length > MAX_ROLE_NAME_LEN) {
            if (!silent) toast(`역할 이름은 ${MAX_ROLE_NAME_LEN}자 이내로 입력해 주세요.`);
            return;
        }
        const exists = form.roles.some((r) => r.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            if (!silent) toast("이미 추가된 역할이에요.");
            return;
        }
        if (remainingSlots <= 0) {
            if (!silent) toast("남은 자리가 없어요. 인원을 늘려주세요.");
            return;
        }
        const newId =
            typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setForm((f) => ({ ...f, roles: [...f.roles, { id: newId, name, count: 1, desc: "" }] }));
        setCustom("");
    };

    const removeRole = (id) => setForm((f) => ({ ...f, roles: f.roles.filter((r) => r.id !== id) }));
    const removeRoleByName = (name) => {
        const target = form.roles.find((r) => r.name.toLowerCase() === name.toLowerCase());
        if (target) removeRole(target.id);
    };
    const updateRole = (id, key, val) => setForm((f) => ({
        ...f, roles: f.roles.map((r) => r.id === id ? { ...r, [key]: val } : r),
    }));

    const presetStates = recruitmentRoleOptions.map((r) => ({
        name: r,
        selected: form.roles.some((x) => x.name.toLowerCase() === r.toLowerCase()),
    }));
    const togglePreset = (name, selected) => {
        if (selected) removeRoleByName(name);
        else addRole(name);
    };
    const visiblePresets = showMoreRoles
        ? presetStates
        : presetStates.slice(0, POPULAR_COUNT);

    const fillInputSx = {
        "& .MuiOutlinedInput-root": {
            bgcolor: surfaceBg,
            borderRadius: 1.375,
            fontSize: 13.5,
            fontWeight: 500,
            transition: "all 0.12s ease",
            "& fieldset": { border: "1.5px solid transparent" },
            "&:hover fieldset": { borderColor: alpha(theme.palette.text.primary, 0.1) },
            "&.Mui-focused": { bgcolor: "background.paper" },
            "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: "1.5px" },
        },
        "& .MuiOutlinedInput-input": { py: 1.125, px: 1.625 },
    };

    return (
        <Stack spacing={2.75}>
            {/* ── 인원 카드 ─────────────────────────────────── */}
            <Box>
                <FieldLabel required hint={`최대 ${MAX_TEAM_SIZE}명`}>
                    몇 명을 모을까요?
                </FieldLabel>

                <Box sx={{
                    bgcolor: surfaceBg,
                    borderRadius: 2,
                    p: { xs: 1.75, sm: 2.25 },
                }}>
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        alignItems={{ xs: "stretch", sm: "center" }}
                        justifyContent="space-between"
                        gap={{ xs: 1.5, sm: 2 }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{
                                fontSize: 12,
                                color: "text.disabled",
                                fontWeight: 600,
                                letterSpacing: "-0.005em",
                                mb: 0.5,
                            }}>
                                워크스페이스에{" "}
                                <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>
                                    {form.currentMembers}명
                                </Box>
                                {" · "}추가로 모집할 인원
                            </Typography>
                            <Stack direction="row" alignItems="baseline" gap={0.75}>
                                <Typography sx={{
                                    fontSize: { xs: 28, sm: 32 },
                                    fontWeight: 800,
                                    color: "primary.main",
                                    letterSpacing: "-0.03em",
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums",
                                }}>
                                    {availableSlots}
                                </Typography>
                                <Typography sx={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "text.disabled",
                                }}>
                                    명
                                </Typography>
                            </Stack>
                        </Box>
                        <Box sx={{ alignSelf: { xs: "center", sm: "center" } }}>
                            <CountStepper
                                size="md"
                                value={form.maxMembers}
                                min={form.currentMembers + 1}
                                max={MAX_TEAM_SIZE}
                                onChange={(v) => setForm((f) => ({ ...f, maxMembers: v }))}
                            />
                        </Box>
                    </Stack>
                </Box>

                {/* Progress strip */}
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={1.25}
                    sx={{ mt: 1.5 }}
                >
                    <Typography sx={{
                        fontSize: 12,
                        color: "text.secondary",
                        fontWeight: 500,
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                    }}>
                        역할 배정{" "}
                        <Box component="span" sx={{
                            fontWeight: 700,
                            color: overflow ? "warning.main" : "text.primary",
                        }}>
                            {totalRoles}/{availableSlots}
                        </Box>
                        명
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={progressPct}
                        sx={{
                            flex: 1,
                            height: 4,
                            borderRadius: 99,
                            bgcolor: alpha(theme.palette.text.primary, 0.06),
                            "& .MuiLinearProgress-bar": {
                                borderRadius: 99,
                                bgcolor: overflow ? "warning.main" : "primary.main",
                                transition: "width 0.2s ease",
                            },
                        }}
                    />
                    <Typography sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0,
                        color: overflow
                            ? "warning.main"
                            : remainingSlots === 0
                                ? "success.main"
                                : "text.disabled",
                        fontVariantNumeric: "tabular-nums",
                    }}>
                        {overflow
                            ? `${totalRoles - availableSlots}명 초과`
                            : remainingSlots === 0
                                ? "완료"
                                : `${remainingSlots}명 더 배정`}
                    </Typography>
                </Stack>
            </Box>

            {/* ── 모집할 역할 ──────────────────────────────── */}
            <Box>
                <FieldLabel
                    required
                    hint={form.roles.length > 0 ? `${form.roles.length}개 역할` : null}
                >
                    모집할 역할
                </FieldLabel>

                {form.roles.length === 0 ? (
                    <Box sx={{
                        p: "22px 18px",
                        textAlign: "center",
                        bgcolor: surfaceBg2,
                        border: "1px dashed",
                        borderColor: alpha(theme.palette.text.primary, 0.14),
                        borderRadius: 1.5,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5,
                    }}>
                        <Box sx={{
                            width: 36, height: 36, borderRadius: 1.25,
                            bgcolor: "background.paper",
                            display: "grid", placeItems: "center",
                            color: "text.disabled",
                            mb: 0.75,
                        }}>
                            <GroupsRoundedIcon sx={{ fontSize: 18 }} />
                        </Box>
                        <Typography sx={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "text.primary",
                            letterSpacing: "-0.015em",
                        }}>
                            아직 추가된 역할이 없어요
                        </Typography>
                        <Typography sx={{
                            fontSize: 11.5,
                            color: "text.disabled",
                            fontWeight: 500,
                            letterSpacing: "-0.005em",
                        }}>
                            아래에서 역할을 골라 추가하세요
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={1}>
                        {form.roles.map((role) => (
                            <Box key={role.id} sx={{
                                position: "relative",
                                bgcolor: "background.paper",
                                border: "1px solid",
                                borderColor: alpha(theme.palette.text.primary, 0.1),
                                borderRadius: 1.5,
                                p: "12px 14px 12px 18px",
                                overflow: "hidden",
                            }}>
                                {/* 좌측 컬러 bar */}
                                <Box sx={{
                                    position: "absolute",
                                    left: 0, top: 8, bottom: 8,
                                    width: 3,
                                    borderRadius: 1,
                                    bgcolor: "primary.main",
                                }} />
                                <Stack direction="row" alignItems="center" gap={1.25}>
                                    <Typography sx={{
                                        flex: 1,
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: "text.primary",
                                        letterSpacing: "-0.015em",
                                        minWidth: 0,
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    }}>
                                        {role.name}
                                    </Typography>
                                    <CountStepper
                                        size="sm"
                                        value={role.count}
                                        min={1}
                                        max={MAX_TEAM_SIZE}
                                        onChange={(v) => updateRole(role.id, "count", v)}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => removeRole(role.id)}
                                        sx={{
                                            width: 28, height: 28,
                                            borderRadius: 1.25,
                                            color: "text.disabled",
                                            "&:hover": {
                                                color: "error.main",
                                                bgcolor: alpha(theme.palette.error.main, 0.08),
                                            },
                                        }}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Stack>
                                <TextField
                                    fullWidth
                                    value={role.desc}
                                    onChange={(e) => updateRole(role.id, "desc", e.target.value)}
                                    onFocus={scrollInputIntoView}
                                    inputProps={{ maxLength: 200 }}
                                    placeholder="예: React 1년 이상, 디자인 시스템 작업 환영 (선택)"
                                    sx={{ ...fillInputSx, mt: 1.25 }}
                                />
                            </Box>
                        ))}
                    </Stack>
                )}

                {/* 자주 찾는 역할 — quick-add chips */}
                <Box sx={{ mt: 2 }}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 1 }}
                    >
                        <Typography sx={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "text.secondary",
                            letterSpacing: "-0.005em",
                        }}>
                            자주 찾는 역할
                        </Typography>
                        {!showMoreRoles && presetStates.length > POPULAR_COUNT && (
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={0.25}
                                onClick={() => setShowMoreRoles(true)}
                                sx={{
                                    cursor: "pointer",
                                    fontSize: 11.5,
                                    color: "text.disabled",
                                    fontWeight: 600,
                                    "&:hover": { color: "text.primary" },
                                }}
                            >
                                <span>더보기</span>
                                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14 }} />
                            </Stack>
                        )}
                    </Stack>

                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {visiblePresets.map(({ name, selected }) => {
                            const disabled = !selected && remainingSlots <= 0;
                            return (
                                <Stack
                                    key={name}
                                    direction="row"
                                    alignItems="center"
                                    gap={0.5}
                                    onClick={() => !disabled && togglePreset(name, selected)}
                                    sx={{
                                        height: 32,
                                        px: 1.25,
                                        borderRadius: 99,
                                        bgcolor: selected
                                            ? alpha(theme.palette.primary.main, 0.12)
                                            : surfaceBg,
                                        color: selected ? "primary.main" : "text.secondary",
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        letterSpacing: "-0.005em",
                                        cursor: disabled ? "default" : "pointer",
                                        opacity: disabled ? 0.55 : 1,
                                        transition: "all 0.12s ease",
                                        "&:hover": disabled ? {} : {
                                            bgcolor: selected
                                                ? alpha(theme.palette.primary.main, 0.16)
                                                : alpha(theme.palette.primary.main, 0.08),
                                            color: "primary.main",
                                        },
                                    }}
                                >
                                    {selected ? (
                                        <CheckRoundedIcon sx={{ fontSize: 13, color: "primary.main" }} />
                                    ) : (
                                        <Box component="span" sx={{
                                            fontSize: 13, fontWeight: 700,
                                            color: disabled ? "text.disabled" : "text.disabled",
                                            lineHeight: 1,
                                        }}>+</Box>
                                    )}
                                    <span>{name}</span>
                                </Stack>
                            );
                        })}
                    </Stack>
                </Box>

                {/* 직접 입력 */}
                <Stack direction="row" gap={1} sx={{ mt: 1.75 }}>
                    <TextField
                        fullWidth
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="직접 입력 (예: AI 리서처)"
                        inputProps={{ maxLength: MAX_ROLE_NAME_LEN }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                // IME 조합 중 Enter 무시 — 한글 역할명 조합 확정 Enter가 바로 추가되는 문제 방지
                                if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                                e.preventDefault();
                                addRole(custom);
                            }
                        }}
                        disabled={remainingSlots <= 0}
                        sx={fillInputSx}
                    />
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={() => addRole(custom)}
                        disabled={!custom.trim() || remainingSlots <= 0}
                        sx={{
                            flexShrink: 0,
                            borderRadius: 1.375,
                            fontWeight: 800,
                            fontSize: 13,
                            px: 2.25,
                            height: 42,
                            bgcolor: "text.primary",
                            color: "background.paper",
                            "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.85) },
                            "&.Mui-disabled": {
                                bgcolor: surfaceBg,
                                color: "text.disabled",
                            },
                        }}
                    >
                        추가
                    </Button>
                </Stack>
            </Box>
        </Stack>
    );
}
