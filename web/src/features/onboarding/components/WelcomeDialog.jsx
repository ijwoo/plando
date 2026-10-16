import React from "react";
import { Dialog } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { blurSx } from "../../../shared/ui/glassSx.js";
import { getDialogTokens } from "../../../shared/ui/dialogTokens.js";
import { Z } from "../../../shared/ui/zIndex.js";
import WelcomeFlow from "./WelcomeFlow.jsx";

// 슬라이드 영역을 고정 크기로 잡아 5장을 넘길 때 모달 높이가 튀지 않게 한다.
//
// 420×620은 텍스트만 있던 3장짜리 기준이었다. 지금은 각 단계가 미니 앱 화면 목업을
// 품고 있어서(보드 3컬럼 · 월 캘린더 7열 등) 가로가 부족하면 목업이 뭉개진다.
// 560×660 = 목업이 읽히는 최소치 + 1366×768 노트북에서도 maxHeight 캡(704px)에
// 걸리지 않는 높이. 캡은 그대로 유지해 작은 창에서도 안전하게 줄어든다.
const DIALOG_W = 560;
const DIALOG_H = 660;

/**
 * 데스크탑 온보딩 — 어두운 백드롭 위 중앙 모달로 WelcomeFlow를 띄운다.
 * 모바일은 DashboardMobile의 전체화면 경로를 그대로 쓰므로 이 컴포넌트를 쓰지 않는다.
 *
 * onSkip        — 지금만 닫기 (이번 방문에만 숨김)
 * onNeverShow   — 다시 보지 않기 (영구)
 * onComplete    — 마지막 CTA로 플로우를 끝냄 (영구)
 */
export default function WelcomeDialog({ open, onComplete, onSkip, onNeverShow }) {
    const theme = useTheme();
    const tok = getDialogTokens(theme);

    return (
        <Dialog
            open={open}
            onClose={onSkip}
            maxWidth={false}
            sx={{ zIndex: Z.MODAL }}
            PaperProps={{
                sx: {
                    width: DIALOG_W,
                    maxWidth: "calc(100vw - 48px)",
                    height: DIALOG_H,
                    maxHeight: "calc(100dvh - 64px)",
                    borderRadius: "24px",
                    background: tok.bg,
                    backgroundImage: "none",
                    ...blurSx("blur(40px)"),
                    border: `1px solid ${tok.border}`,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                    overflow: "hidden",
                },
            }}
            slotProps={{
                backdrop: {
                    sx: { ...blurSx("blur(4px)"), backgroundColor: "rgba(0,0,0,0.55)" },
                },
            }}
        >
            <WelcomeFlow
                variant="modal"
                onComplete={onComplete}
                onDismiss={onSkip}
                onNeverShow={onNeverShow}
            />
        </Dialog>
    );
}
