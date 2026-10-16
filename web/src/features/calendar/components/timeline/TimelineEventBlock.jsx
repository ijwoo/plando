import React from "react";
import DayEventBlock from "./DayEventBlock.jsx";
import WeekEventBlock from "./WeekEventBlock.jsx";

/**
 * 타임라인 이벤트 블록 라우터.
 * @param variant "day" | "week"
 */
export default function TimelineEventBlock({ variant = "day", ...props }) {
    if (variant === "week") return <WeekEventBlock {...props} />;
    return <DayEventBlock {...props} />;
}
