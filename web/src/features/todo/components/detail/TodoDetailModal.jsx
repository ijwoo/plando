import React from "react";
import { Dialog, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { blurSx } from "../../../../shared/ui/glassSx.js";
import TodoDetailPanel from "./TodoDetailPanel.jsx";

/**
 * Calendar / Dashboard 등 페이지 외부에서 todo detail을 모달로 띄울 때 사용.
 * 모바일/데스크톱 모두 TodoDetailPanel을 그대로 렌더 (Panel이 내부적으로 mobile/desktop 분기).
 * 이로써 mobile detail UI 경로가 단일화 — 이전엔 TodoDetailModalMobileView (modal 경유) /
 * TodoDetailMobile (panel 경유) 두 컴포넌트가 따로 존재했음.
 */
export default function TodoDetailModal({ open, onClose, todo, onDelete, onPatchLocal }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const mobileBg = theme.palette.background.paper;
    const mobileBorder = theme.palette.divider;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen={false}
            maxWidth={isMobile ? false : "md"}
            fullWidth={!isMobile}
            // 모바일: Dialog 자체 sx로 Paper class 타겟해 width/maxWidth/margin override.
            // PaperProps.sx만으로는 MUI default class (margin: 16px, maxWidth: calc(100% - 32px))가
            // media query 우선순위 때문에 안 덮임 → "& .MuiDialog-paper" 직접 selector 사용.
            sx={isMobile ? {
                "& .MuiDialog-paper": {
                    m: "6px",
                    width: "calc(100% - 12px)",
                    maxWidth: "calc(100% - 12px)",
                },
            } : {}}
            slotProps={{
                backdrop: { sx: { ...blurSx("blur(4px)"), backgroundColor: "rgba(0,0,0,0.45)" } },
            }}
            PaperProps={{
                sx: isMobile
                    ? {
                        borderRadius: "24px",
                        height: "88vh",
                        maxHeight: "88vh",
                        overflow: "hidden",
                        background: mobileBg,
                        backgroundImage: "none",
                        ...blurSx("blur(20px)"),
                        border: `1px solid ${mobileBorder}`,
                        boxShadow: "0 16px 48px rgba(0,0,0,0.30)",
                    }
                    : { borderRadius: 3, maxHeight: "90vh" },
            }}
        >
            <TodoDetailPanel
                todo={todo}
                onClose={onClose}
                onDelete={onDelete}
                onPatchLocal={onPatchLocal}
                showClose
            />
        </Dialog>
    );
}
