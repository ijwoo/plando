import React, { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";

import { createStatus } from "../../api/statusApi.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import { toast } from "../../../../shared/utils/toast.js";
import { getApiError } from "../../../../shared/api/axiosInstance.js";

const CATEGORIES = [
    { value: "TODO", label: "미시작" },
    { value: "IN_PROGRESS", label: "진행" },
    { value: "DONE", label: "완료" },
];
const COLORS = ["#94A3B8", "#3070EB", "#22B8A6", "#F59E0B", "#7C3AED", "#EC4899", "#0EA5E9", "#E5484D"];

/**
 * 커스텀 상태 생성 다이얼로그 — 이름 + 카테고리(완료판정 기준) + 색. ADMIN+ 전용.
 *
 * zIndex: 기본(MUI modal=1300)은 페이지 위에서만 안전하다. 모바일 '할 일 추가' 시트(Z.SHEET=1400)
 * 위에서 열 때는 호출부가 더 높은 값을 넘겨야 다이얼로그가 시트 뒤로 숨지 않는다.
 */
export default function AddStatusDialog({ open, onClose, onCreated, zIndex }) {
    const [label, setLabel] = useState("");
    const [category, setCategory] = useState("IN_PROGRESS");
    const [color, setColor] = useState(COLORS[3]);
    const [saving, setSaving] = useState(false);

    const reset = () => { setLabel(""); setCategory("IN_PROGRESS"); setColor(COLORS[3]); };

    const onCreate = async () => {
        const name = label.trim();
        if (!name) return;
        setSaving(true);
        try {
            const created = await createStatus({ label: name, category, color });
            window.dispatchEvent(new Event(APP_EVENTS.STATUSES_CHANGED));
            toast.success(`'${name}' 상태를 만들었어요`);
            reset();
            onClose?.();
            onCreated?.(created);
        } catch (e) {
            toast.error(getApiError(e, "상태를 만들지 못했어요. (관리자 권한 필요)"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth sx={zIndex ? { zIndex } : undefined}>
            <DialogTitle sx={{ fontWeight: 800, fontSize: 17 }}>새 상태 만들기</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 0.5 }}>
                    <TextField
                        autoFocus
                        label="상태 이름"
                        placeholder="예: 검토중, 배포대기"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onKeyDown={(e) => {
                            // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복 입력 방지
                            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                            if (e.key === "Enter") onCreate();
                        }}
                        size="small"
                        inputProps={{ maxLength: 40 }}
                        fullWidth
                    />
                    <Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: 0.75 }}>
                            카테고리 <Typography component="span" sx={{ fontSize: 11, color: "text.disabled" }}>(완료 판정 기준)</Typography>
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            {CATEGORIES.map((c) => (
                                <Box key={c.value} onClick={() => setCategory(c.value)}
                                    sx={{ flex: 1, textAlign: "center", py: 0.75, borderRadius: 2, cursor: "pointer", border: "1px solid",
                                        borderColor: category === c.value ? "primary.main" : "divider",
                                        bgcolor: category === c.value ? "primary.main" : "transparent",
                                        color: category === c.value ? "primary.contrastText" : "text.secondary",
                                        fontSize: 13, fontWeight: 700 }}>
                                    {c.label}
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", mb: 0.75 }}>색</Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                            {COLORS.map((c) => (
                                <Box key={c} onClick={() => setColor(c)}
                                    sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: c, cursor: "pointer",
                                        outline: color === c ? "2px solid" : "none", outlineColor: "text.primary", outlineOffset: 2 }} />
                            ))}
                        </Stack>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} color="inherit">취소</Button>
                <Button onClick={onCreate} variant="contained" disabled={!label.trim() || saving}>만들기</Button>
            </DialogActions>
        </Dialog>
    );
}
