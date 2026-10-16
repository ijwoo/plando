import React, { useState } from "react";
import { Box, InputBase, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { callChat } from "../features/chat/api/chatApi.js";
import { addTodo } from "../features/todo/api/todoApi.js";
import { useActiveProject } from "../features/project/context/ActiveProjectContext.jsx";
import { APP_EVENTS } from "../shared/constants/events.js";
import { toast } from "../shared/utils/toast.js";
import { getApiError } from "../shared/api/axiosInstance.js";

/**
 * 패널 상단 빠른 캡처 — 자연어로 치면 LLM이 파싱해 할 일 생성.
 * (모바일 대시보드 AiCaptureHero와 동일한 callChat→파싱→addTodo 흐름, 현재 스코프에 소속)
 * AI 인식 실패 시 입력 텍스트를 제목으로 그냥 추가(입력 유실 방지).
 */
function extractParsedTask(data) {
    const { actions = [] } = data || {};
    const created = actions.find((a) => a.type === "TASK_CREATED");
    const t = created?.payload?.task;
    if (!t) return null;
    return {
        title: t.title || "",
        startAt: t.startAt || "",
        dueDate: t.dueDate || t.startAt || "",
        startTime: t.startTime || "",
        endTime: t.endTime || "",
        priority: t.priority || "MEDIUM",
        status: t.status || "TODO",
        locationName: t.locationName || null,
        locationAddress: t.locationAddress || null,
        locationLat: t.locationLat ?? null,
        locationLng: t.locationLng ?? null,
        assigneeId: t.assigneeId || "",
    };
}

export default function SidebarQuickCapture() {
    const { activeProjectId } = useActiveProject();
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        const text = value.trim();
        if (!text || loading) return;
        setLoading(true);
        const projectId = typeof activeProjectId === "number" ? activeProjectId : null;
        try {
            let payload = { title: text, content: "", status: "TODO", priority: "MEDIUM", projectId };
            try {
                const res = await callChat(text, {});
                const t = extractParsedTask(res.data);
                if (t) {
                    payload = {
                        title: t.title || text,
                        content: "",
                        priority: t.priority,
                        status: t.status,
                        startAt: t.startAt || null,
                        dueDate: t.dueDate || null,
                        startTime: t.startTime || null,
                        endTime: t.endTime || null,
                        assignees: t.assigneeId ? t.assigneeId.split(",").map((e) => e.trim()).filter(Boolean) : [],
                        locationName: t.locationName,
                        locationAddress: t.locationAddress,
                        locationLat: t.locationLat,
                        locationLng: t.locationLng,
                        projectId,
                    };
                }
            } catch {
                /* AI 호출 실패 → 제목만으로 폴백 (payload 그대로) */
            }
            const { data } = await addTodo(payload);
            if (data) window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED, { detail: data }));
            else window.dispatchEvent(new Event(APP_EVENTS.TODO_ADDED));
            window.dispatchEvent(new Event(APP_EVENTS.NOTIFICATIONS_CHANGED));
            toast.success("추가됐어요.");
            setValue("");
        } catch (e) {
            toast.error(getApiError(e, "추가 중 오류가 발생했어요."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                width: "100%",
                height: 34,
                px: 1.25,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.06 : 0.04),
                transition: "border-color 0.15s, background 0.15s",
                "&:focus-within": { borderColor: "primary.main", bgcolor: "background.paper" },
            }}
        >
            <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: "primary.main", flexShrink: 0 }} />
            <InputBase
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent?.isComposing && e.keyCode !== 229) {
                        e.preventDefault();
                        submit();
                    }
                }}
                placeholder="AI 빠른 할 일 추가"
                disabled={loading}
                sx={{ flex: 1, fontSize: 13, color: "text.primary" }}
            />
            {loading && <CircularProgress size={14} sx={{ flexShrink: 0, color: "text.disabled" }} />}
        </Box>
    );
}
