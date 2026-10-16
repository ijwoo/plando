import React, { useEffect, useState } from "react";
import AddTodoModal from "../../todo/components/form/AddTodoModal.jsx";
import { addTodo } from "../../todo/api/todoApi.js";
import { updateTodoLocation } from "../api/mapApi.js";

const INITIAL_TASK = {
    title: "",
    content: "",
    startAt: "",
    dueDate: "",
    priority: "MEDIUM",
    status: "TODO",
    assignees: [],
};

export default function MapAddTodoModal({ open, onClose, onSaved, initialLocation = null }) {
    const [task, setTask] = useState(INITIAL_TASK);
    const [location, setLocation] = useState(null);

    useEffect(() => {
        if (open) {
            setTask(INITIAL_TASK);
            setLocation(initialLocation ?? null);
        }
    }, [open]);

    const handleSave = async () => {
        try {
            const res = await addTodo({
                title: task.title?.trim(),
                content: task.content,
                startAt: task.startAt || null,
                dueDate: task.dueDate || null,
                priority: task.priority,
                status: task.status,
                assignees: task.assignees,
            });
            if (location && res.data?.id) {
                await updateTodoLocation(res.data.id, location);
            }
            onSaved?.();
            onClose();
        } catch (e) {
            console.error("일정 저장 실패", e);
        }
    };

    return (
        <AddTodoModal
            open={open}
            onClose={onClose}
            task={task}
            setTask={setTask}
            onSave={handleSave}
            location={location}
            setLocation={setLocation}
        />
    );
}
