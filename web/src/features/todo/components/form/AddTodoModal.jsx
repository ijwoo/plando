import React, { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import moment from "moment";

// 설정 "기본 마감일"(none/today/tomorrow/week) → 새 할 일에 채울 dueDate(YYYY-MM-DD)
function computeDefaultDueDate() {
    try {
        const v = localStorage.getItem("settings.defaultDue") || "none";
        if (v === "today") return moment().format("YYYY-MM-DD");
        if (v === "tomorrow") return moment().add(1, "day").format("YYYY-MM-DD");
        if (v === "week") return moment().endOf("week").format("YYYY-MM-DD");
        return "";
    } catch {
        return "";
    }
}

import { fetchAllUsers } from "../../../../shared/api/userApi.js";
import { fetchTemplates } from "../../api/todoTemplateApi.js";
import { upsertRecurrence } from "../../api/todoRecurrenceApi.js";
import { useWorkspace } from "../../../workspace/context/WorkspaceContext.jsx";
import AddTodoDesktop from "./AddTodoDesktop.jsx";
import AddTodoMobile from "./AddTodoMobile.jsx";

export default function AddTodoModal({ open, onClose, task, setTask, onSave, location, setLocation }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { currentWorkspace } = useWorkspace();

    const [touched, setTouched] = useState(false);
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [templates, setTemplates] = useState([]);

    const [pendingRecurrenceType, setPendingRecurrenceType] = useState("NONE");
    const [pendingRecurrenceEndDate, setPendingRecurrenceEndDate] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) return;

        setTouched(false);
        setPendingRecurrenceType("NONE");
        setPendingRecurrenceEndDate("");

        setTask((prev) => ({
            title: prev?.title ?? "",
            content: prev?.content ?? "",
            startAt: prev?.startAt ?? "",
            dueDate: prev?.dueDate || computeDefaultDueDate(),
            startTime: prev?.startTime ?? "",
            endTime: prev?.endTime ?? "",
            allDay: prev?.allDay ?? true,
            priority: prev?.priority ?? "MEDIUM",
            status: prev?.status ?? "TODO",
            assignees: Array.isArray(prev?.assignees) ? prev.assignees : [],
        }));

        setLoadingUsers(true);
        fetchAllUsers()
            .then((res) => setUserList(res.data ?? []))
            .catch((e) => console.error("유저 목록 실패", e))
            .finally(() => setLoadingUsers(false));

        if (currentWorkspace?.workspaceId) {
            fetchTemplates(currentWorkspace.workspaceId)
                .then((res) => setTemplates(res.data ?? []))
                .catch(() => {});
        }
    }, [open, setTask, currentWorkspace?.workspaceId]);

    const titleError = useMemo(() => {
        if (!touched) return "";
        if (!task?.title?.trim()) return "제목은 필수예요.";
        if (task.title.trim().length < 2) return "제목은 2글자 이상이 좋아요.";
        return "";
    }, [touched, task?.title]);

    const dateError = useMemo(() => {
        if (!task?.startAt || !task?.dueDate) return "";
        return task.startAt > task.dueDate
            ? "시작일이 마감일보다 늦을 수 없어요."
            : "";
    }, [task?.startAt, task?.dueDate]);

    const canSave = useMemo(() => {
        if (!task?.title?.trim()) return false;
        if (dateError) return false;
        return true;
    }, [task?.title, dateError]);

    const handleSave = async () => {
        setTouched(true);
        if (!canSave || submitting) return;
        setSubmitting(true);
        try {
            const todoId = await onSave?.();
            if (todoId) {
                const afterSave = [];
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
        } finally {
            setSubmitting(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose?.();
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            // IME 조합 중 Enter 무시 — 조합 확정용 Enter로 미리 저장되는 것 방지
            if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            handleSave();
        }
    };

    const handleApplyTemplate = (tpl) => {
        setTask((prev) => ({
            ...prev,
            title: tpl.defaultTitle || prev.title || "",
            content: tpl.defaultContent || prev.content || "",
            priority: tpl.defaultPriority || prev.priority || "MEDIUM",
            assignees: tpl.defaultAssigneeEmails?.length ? tpl.defaultAssigneeEmails : prev.assignees ?? [],
            // 템플릿에 소속 프로젝트가 지정돼 있으면 그 스코프로(없으면 기존 유지)
            projectScope: tpl.defaultProjectId != null ? tpl.defaultProjectId : prev.projectScope,
        }));
        // tpl.defaultSubtasks(실제로는 체크리스트 항목)는 더 이상 적용하지 않는다 — 체크리스트 기능 제거
    };

    const viewProps = {
        open,
        onClose,
        task,
        setTask,
        onSave,
        touched,
        setTouched,
        userList,
        loadingUsers,
        titleError,
        dateError,
        canSave,
        handleSave,
        submitting,
        onKeyDown,
        location,
        setLocation,
        templates,
        onApplyTemplate: handleApplyTemplate,
        pendingRecurrenceType,
        setPendingRecurrenceType,
        pendingRecurrenceEndDate,
        setPendingRecurrenceEndDate,
    };

    return isMobile ? (
        <AddTodoMobile {...viewProps} />
    ) : (
        <AddTodoDesktop {...viewProps} />
    );
}