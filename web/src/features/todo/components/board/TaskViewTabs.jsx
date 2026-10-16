import React from "react";
import { useNavigate } from "react-router-dom";
import SegmentedControl from "../../../../shared/ui/common/SegmentedControl.jsx";

/**
 * "할 일" surface의 뷰 탭 — [보드 | 목록] (모든 스코프 공통).
 * 보드=/todos, 목록=/tasklist (같은 글로벌 스코프).
 * 프로젝트 개요(/projects/:id)는 별도 페이지로, 헤더의 프로젝트 이름 클릭으로 진입.
 * (current="overview"면 개요 페이지에 있는 상태 → 어느 탭도 활성 아님)
 */
export default function TaskViewTabs({ current }) {
    const navigate = useNavigate();

    const options = [
        { value: "board", label: "보드" },
        { value: "list", label: "목록" },
    ];

    const onChange = (v) => {
        if (v === current) return;
        if (v === "board") navigate("/todos");
        else navigate("/tasklist");
    };

    return <SegmentedControl options={options} value={current} onChange={onChange} />;
}
