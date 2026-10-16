import React from "react";
import { Dialog } from "@mui/material";
import { blurSx } from "../../../../shared/ui/glassSx.js";
import { Z } from "../../../../shared/ui/zIndex.js";

/**
 * 디테일 패널 안에서 띄우는 작은 모바일 바텀시트 (참여자/반복 등).
 * MUI Dialog를 하단 고정 + 라운드 + 핸들 표시로 시트 형태로 렌더.
 *
 * 상세 패널 자체가 Z.DETAIL_PANEL=1500 Drawer이므로 zIndex는 Z.DIALOG로 설정해
 * 그 위에서 동작.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   children: React.ReactNode,
 *   maxHeight?: string,           // e.g. "60vh"
 *   zIndex?: number,
 * }} props
 */
export default function MobileBottomSheet({
    open, onClose, children,
    maxHeight = "70vh",
    zIndex = Z.DIALOG,
}) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            sx={{ zIndex }}
            PaperProps={{
                sx: {
                    position: "fixed",
                    bottom: 0, left: 0, right: 0,
                    width: "100%", m: 0,
                    borderRadius: "20px 20px 0 0",
                    maxHeight,
                    display: "flex", flexDirection: "column",
                    background: "var(--plando-surface)",
                    backgroundImage: "none",
                    ...blurSx("blur(20px)"),
                    border: "1px solid var(--plando-divider)",
                    borderBottom: "none",
                    boxShadow: "0 -8px 40px rgba(0,0,0,0.28)",
                    overflow: "hidden",
                    pb: "env(safe-area-inset-bottom)",
                },
            }}
            slotProps={{ backdrop: { sx: { ...blurSx("blur(4px)"), backgroundColor: "rgba(0,0,0,0.4)" } } }}
        >
            {/* 시트 핸들 */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--plando-sheet-handle)" }} />
            </div>

            {children}
        </Dialog>
    );
}
