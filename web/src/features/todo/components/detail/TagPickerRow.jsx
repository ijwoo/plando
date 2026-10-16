import React, { useMemo, useRef, useState } from "react";
import { Box, Popover, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";

import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { createTag, setTodoTags } from "../../api/tagApi.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import { toast } from "../../../../shared/utils/toast.js";
import { getApiError } from "../../../../shared/api/axiosInstance.js";

const TAG_COLORS = ["#94A3B8", "#3070EB", "#22B8A6", "#F59E0B", "#7C3AED", "#EC4899", "#0EA5E9", "#E5484D"];

/** 상세 속성 카드의 태그 행 — 칩 표시 + 팝오버(워크스페이스 태그 토글 + 새 태그 생성). */
export default function TagPickerRow({ todoId, tags = [], readOnly, onPatchLocal }) {
    const { tags: wsTags, reloadTags } = useStatuses();
    const [anchor, setAnchor] = useState(null);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const selectedIds = useMemo(() => new Set((tags ?? []).map((t) => t.id)), [tags]);
    const inputRef = useRef(null);

    const commitTags = async (rawNext) => {
        // id 중복 제거. 태그 생성 API 는 같은 이름이 있으면 **기존 태그를 그대로 돌려준다** —
        // 이미 이 할 일에 붙어 있는 이름을 다시 만들면 같은 태그가 목록에 두 번 들어가고,
        // 서버가 uk_todo_tag 위반으로 전체 저장에 실패했다.
        const seen = new Set();
        const nextTags = (rawNext ?? []).filter((t) => {
            if (t?.id == null || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        });
        onPatchLocal?.({ tags: nextTags });
        window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: todoId, patch: { tags: nextTags } } }));
        try {
            setSaving(true);
            await setTodoTags(todoId, nextTags.map((t) => t.id));
        } catch (e) {
            toast.error(getApiError(e, "태그 저장에 실패했어요."));
        } finally {
            setSaving(false);
        }
    };

    const toggle = (tag) => {
        const has = selectedIds.has(tag.id);
        const next = has ? (tags ?? []).filter((t) => t.id !== tag.id) : [...(tags ?? []), tag];
        commitTags(next);
    };

    const onCreate = async () => {
        const name = draft.trim();
        if (!name) return;
        const color = TAG_COLORS[(wsTags?.length ?? 0) % TAG_COLORS.length];
        try {
            const created = await createTag({ name, color });
            setDraft("");
            window.dispatchEvent(new Event(APP_EVENTS.TAGS_CHANGED));
            reloadTags?.();
            commitTags([...(tags ?? []), created]);
        } catch (e) {
            toast.error(getApiError(e, "태그를 만들지 못했어요."));
        }
    };

    return (
        <>
            <div className="pdp-row" onClick={(e) => !readOnly && setAnchor(e.currentTarget)} style={{ cursor: readOnly ? "default" : "pointer" }}>
                <div className="pdp-row-label">
                    <LocalOfferRoundedIcon sx={{ fontSize: 14, color: "var(--plando-text-tertiary)" }} />
                    태그
                </div>
                <div className="pdp-row-value">
                    {tags && tags.length > 0 ? (
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, justifyContent: "flex-end" }}>
                            {tags.map((t) => (
                                <Box key={t.id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.875, py: 0.25, borderRadius: 999, bgcolor: alpha(t.color || "#94A3B8", 0.16) }}>
                                    <Box sx={{ width: 7, height: 7, borderRadius: 999, bgcolor: t.color || "#94A3B8" }} />
                                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.primary" }}>{t.name}</Typography>
                                </Box>
                            ))}
                        </Stack>
                    ) : (
                        <Typography sx={{ fontSize: 12.5, color: "var(--plando-text-tertiary)" }}>{readOnly ? "없음" : "태그 추가"}</Typography>
                    )}
                </div>
            </div>

            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { width: 260, p: 1, borderRadius: "var(--plando-radius-md)" } } }}
            >
                <Typography sx={{ px: 1, py: 0.5, fontSize: 11, fontWeight: 800, color: "text.disabled" }}>태그</Typography>
                <Stack sx={{ maxHeight: 220, overflowY: "auto" }}>
                    {(wsTags ?? []).map((t) => {
                        const on = selectedIds.has(t.id);
                        return (
                            <Box key={t.id} onClick={() => toggle(t)} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.75, borderRadius: 1, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                                <Box sx={{ width: 9, height: 9, borderRadius: 999, bgcolor: t.color || "#94A3B8" }} />
                                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{t.name}</Typography>
                                {on && <CheckRoundedIcon sx={{ fontSize: 16, color: "primary.main" }} />}
                            </Box>
                        );
                    })}
                    {(wsTags ?? []).length === 0 && (
                        <Typography sx={{ px: 1, py: 1, fontSize: 12, color: "text.disabled" }}>태그가 아직 없어요. 아래에서 만들어보세요.</Typography>
                    )}
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, px: 0.5, alignItems: "center" }}>
                    <AddRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                    <TextField
                        inputRef={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복 입력 방지
                            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                            if (e.key === "Enter") { e.preventDefault(); onCreate(); }
                        }}
                        placeholder="새 태그 만들기"
                        variant="standard"
                        fullWidth
                        InputProps={{ disableUnderline: true, sx: { fontSize: 13 } }}
                        inputProps={{ maxLength: 40 }}
                    />
                    {draft.trim() && (
                        <Typography onClick={onCreate} sx={{ fontSize: 12, fontWeight: 800, color: "primary.main", cursor: "pointer", whiteSpace: "nowrap", px: 0.5 }}>만들기</Typography>
                    )}
                </Stack>
            </Popover>
        </>
    );
}
