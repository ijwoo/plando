import React from "react";
import { SwipeableDrawer, Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { blurSx } from "../glassSx.js";
import { Z } from "../zIndex.js";

/**
 * 모바일 바텀시트 primitive.
 * MUI SwipeableDrawer 위에 토스 톤 chrome(radius / drag handle / safe-area / blur)을 통일.
 *
 * 기존에 AddTodoMobile / AssigneePicker / 기타 시트 컴포넌트가 각자 SwipeableDrawer 옵션을
 * 인라인으로 적은 부분을 한곳으로 모음. 핸들 마크업 / paperBg / divider도 일관 처리.
 *
 * Props:
 *   open, onClose: 필수
 *   onOpen?: SwipeableDrawer는 onOpen을 요구하지만 거의 사용 안함 (no-op default)
 *   height: dvh 또는 px (기본 "86dvh"). "full" 입력 시 100dvh
 *   header?: ReactNode — drag handle 아래, 본문 위 sticky 영역
 *   footer?: ReactNode — 본문 아래 sticky 영역
 *   children: 본문 (자동 overflowY:auto)
 *   showHandle?: 드래그 핸들 표시 여부 (기본 true)
 *   disableSwipeToOpen?: 기본 true (제스처로 열리는 일은 거의 없음)
 *   zIndex?: 기본 Z.SHEET
 *
 * 자체 스크롤 영역을 만들어주므로 children에 별도 overflow 처리는 보통 불필요.
 */
export default function Sheet({
    open,
    onClose,
    onOpen = () => {},
    height = "86dvh",
    header,
    footer,
    children,
    showHandle = true,
    disableSwipeToOpen = true,
    zIndex = Z.SHEET,
    onKeyDown,
}) {
    const theme = useTheme();
    const paperBg = theme.palette.background.paper;
    const divider = theme.palette.divider;

    const resolvedHeight = height === "full" ? "100dvh" : height;

    return (
        <SwipeableDrawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            onOpen={onOpen}
            disableSwipeToOpen={disableSwipeToOpen}
            hysteresis={0.4}
            minFlingVelocity={300}
            ModalProps={{ keepMounted: true }}
            sx={{ zIndex }}
            PaperProps={{
                sx: {
                    height: resolvedHeight,
                    maxHeight: "96dvh",
                    borderTopLeftRadius: "var(--plando-radius-modal)",
                    borderTopRightRadius: "var(--plando-radius-modal)",
                    overflow: "hidden",
                    background: paperBg,
                    backgroundImage: "none",
                    ...blurSx("blur(20px)"),
                    borderTop: `1px solid ${divider}`,
                    boxShadow: "0 -8px 40px rgba(0,0,0,0.30)",
                },
            }}
        >
            <Box
                onKeyDown={onKeyDown}
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: "var(--plando-font)",
                }}
            >
                {showHandle && (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            pt: "10px",
                            pb: "4px",
                            flexShrink: 0,
                        }}
                    >
                        <Box
                            sx={{
                                width: 40,
                                height: 4,
                                borderRadius: 999,
                                background: "var(--plando-sheet-handle)",
                            }}
                        />
                    </Box>
                )}

                {header && (
                    <Box sx={{ flexShrink: 0 }}>
                        {header}
                    </Box>
                )}

                <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    {children}
                </Box>

                {footer && (
                    <Box sx={{ flexShrink: 0 }}>
                        {footer}
                    </Box>
                )}
            </Box>
        </SwipeableDrawer>
    );
}
