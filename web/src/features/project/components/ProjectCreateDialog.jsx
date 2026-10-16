import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, Stack, SwipeableDrawer, TextField, Typography, useMediaQuery } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";

import { PROJECT_COLORS, addProject, updateProjectById } from "../store/projectStore.js";
import { PROJECT_ICONS, getProjectIcon } from "../projectIcons.js";
import { Z } from "../../../shared/ui/zIndex.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";

/**
 * 프로젝트 만들기/수정 — 데스크탑은 Dialog, 모바일은 바텀시트 (다른 입력 UI와 문법 통일).
 * `project` 전달 시 수정 모드.
 */
export default function ProjectCreateDialog({ open, onClose, onCreated, project }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const isEdit = !!project;
    const [name, setName] = useState("");
    const [color, setColor] = useState(PROJECT_COLORS[0]);
    const [icon, setIcon] = useState("folder");
    const [saving, setSaving] = useState(false);

    // 열릴 때 수정 모드면 기존 값으로 prefill, 생성 모드면 초기화
    useEffect(() => {
        if (!open) return;
        if (project) {
            setName(project.name || "");
            setColor(project.color || PROJECT_COLORS[0]);
            setIcon(project.icon || "folder");
        } else {
            setName(""); setColor(PROJECT_COLORS[0]); setIcon("folder");
        }
    }, [open, project]);

    const reset = () => { setName(""); setColor(PROJECT_COLORS[0]); setIcon("folder"); };
    const close = () => { onClose?.(); };

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed || saving) return;
        setSaving(true);
        try {
            const p = isEdit
                ? await updateProjectById(project.id, { name: trimmed, color, icon })
                : await addProject({ name: trimmed, color, icon });
            if (!isEdit) reset();
            onClose?.();
            onCreated?.(p);
        } catch (e) {
            toast.error(getApiError(e, isEdit ? "프로젝트 수정에 실패했어요." : "프로젝트 생성에 실패했어요."));
        } finally {
            setSaving(false);
        }
    };

    const PreviewIcon = getProjectIcon(icon);

    const body = (
            <Box sx={{ p: 3, pt: isMobile ? 1.5 : 3, pb: isMobile ? "calc(20px + env(safe-area-inset-bottom))" : 3 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", mb: 2.5 }}>
                    {isEdit ? "프로젝트 수정" : "새 프로젝트"}
                </Typography>

                {/* 미리보기 */}
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ p: 1.5, mb: 2.5, borderRadius: "12px", bgcolor: "var(--plando-surface-low)" }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: "10px", bgcolor: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <PreviewIcon sx={{ fontSize: 19 }} />
                    </Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: name.trim() ? "text.primary" : "text.disabled" }}>
                        {name.trim() || "프로젝트 이름"}
                    </Typography>
                </Stack>

                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary", mb: 0.75 }}>이름</Typography>
                <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    placeholder="프로젝트 이름"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        // IME 조합 중 Enter 무시 — 한글 프로젝트명 마지막 글자 유실/중복 생성 방지
                        if (e.key === "Enter" && !(e.nativeEvent?.isComposing || e.keyCode === 229)) submit();
                    }}
                    sx={{ mb: 2.5 }}
                />

                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary", mb: 1 }}>아이콘</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1, mb: 2.5 }}>
                    {PROJECT_ICONS.map((opt) => {
                        const sel = icon === opt.key;
                        const Icon = opt.Icon;
                        return (
                            <Box
                                key={opt.key}
                                onClick={() => setIcon(opt.key)}
                                sx={{
                                    aspectRatio: "1 / 1",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    borderRadius: "10px", cursor: "pointer",
                                    border: "1px solid",
                                    borderColor: sel ? color : "divider",
                                    bgcolor: sel ? alpha(color, 0.14) : "transparent",
                                    color: sel ? color : "text.secondary",
                                    transition: "border-color 0.12s, background 0.12s, color 0.12s",
                                    "&:hover": { borderColor: sel ? color : alpha(color, 0.5), color: sel ? color : "text.primary" },
                                }}
                            >
                                <Icon sx={{ fontSize: 20 }} />
                            </Box>
                        );
                    })}
                </Box>

                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary", mb: 1 }}>색</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, mb: 3 }}>
                    {PROJECT_COLORS.map((c) => (
                        <Box
                            key={c}
                            onClick={() => setColor(c)}
                            sx={{
                                width: 28, height: 28, borderRadius: "50%", bgcolor: c, cursor: "pointer",
                                outline: color === c ? `2px solid ${theme.palette.text.primary}` : "2px solid transparent",
                                outlineOffset: 2,
                                transition: "outline-color 0.12s",
                            }}
                        />
                    ))}
                </Stack>

                {isMobile ? (
                    <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        disabled={!name.trim() || saving}
                        onClick={submit}
                        sx={{ fontWeight: 800, py: 1.4, borderRadius: 999, fontSize: 15 }}
                    >
                        {isEdit ? "저장" : "만들기"}
                    </Button>
                ) : (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button onClick={close} sx={{ fontWeight: 700, color: "text.secondary", borderRadius: "10px" }}>취소</Button>
                        <Button
                            variant="contained"
                            disableElevation
                            disabled={!name.trim() || saving}
                            onClick={submit}
                            sx={{ fontWeight: 800, px: 2.5, borderRadius: "10px" }}
                        >
                            {isEdit ? "저장" : "만들기"}
                        </Button>
                    </Stack>
                )}
            </Box>
    );

    if (isMobile) {
        return (
            <SwipeableDrawer
                anchor="bottom"
                open={open}
                onClose={close}
                onOpen={() => {}}
                disableSwipeToOpen
                sx={{ zIndex: Z.SHEET }}
                PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}
            >
                {/* drag handle */}
                <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}>
                    <Box sx={{ width: 36, height: 4, borderRadius: 2, background: theme.palette.text.disabled, opacity: 0.4 }} />
                </Box>
                {body}
            </SwipeableDrawer>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={close}
            PaperProps={{ sx: { width: 440, maxWidth: "92vw", borderRadius: "18px" } }}
        >
            {body}
        </Dialog>
    );
}
