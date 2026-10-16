import React from "react";
import { PriorityTag } from "../../../../shared/ui/common/Tags.jsx";

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];

/** 우선순위 flag — 공용 PriorityTag의 얇은 래퍼(높이 22 고정 형태). */
export default function PriorityFlag({ priority }) {
    if (!priority) return null;
    return <PriorityTag priority={priority} size="sm" sx={{ height: 22, px: "10px", fontWeight: 600, lineHeight: 1, flexShrink: 0 }} />;
}
