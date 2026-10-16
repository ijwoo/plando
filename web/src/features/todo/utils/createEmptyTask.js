export function createEmptyTask(priority = "MEDIUM", status = "TODO") {
    return {
        title: "",
        content: "",
        startAt: "",
        dueDate: "",
        startTime: "",
        endTime: "",
        allDay: true,
        priority: priority || "MEDIUM",
        status,
    };
}

export function isPristineTask(task) {
    return !task?.title && !task?.content && !task?.startAt && !task?.dueDate;
}
