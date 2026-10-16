import React from "react";
import { Popover } from "@mui/material";
import AssigneeListContent from "./AssigneeListContent.jsx";
import { Z } from "../../../../shared/ui/zIndex.js";

/**
 * 데스크탑 디테일 패널 "담당자" 행 클릭 시 열리는 Popover 래퍼.
 * 실제 리스트 UI는 AssigneeListContent — 모바일 BottomSheet와 코드 공유.
 *
 * @param {{
 *   anchorEl: HTMLElement | null,
 *   open: boolean,
 *   onClose: () => void,
 *   options: any[],
 *   selectedValues: string[],
 *   onChange: (nextValues: string[]) => void,
 *   zIndex?: number,
 * }} props
 */
export default function AssigneeInlinePopover({
    anchorEl, open, onClose,
    options, selectedValues, onChange,
    zIndex = Z.DIALOG,
}) {
    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            sx={{ zIndex }}
            slotProps={{
                paper: {
                    sx: {
                        width: 280, maxHeight: 320, mt: 0.5,
                        borderRadius: 2,
                        bgcolor: "var(--plando-surface)",
                        border: "1px solid var(--plando-divider)",
                        boxShadow: "var(--plando-shadow-3)",
                        backgroundImage: "none",
                        display: "flex",
                        flexDirection: "column",
                    },
                },
            }}
        >
            <AssigneeListContent
                options={options}
                selectedValues={selectedValues}
                onApply={onChange}
                onClose={onClose}
                sizeHint="compact"
            />
        </Popover>
    );
}
