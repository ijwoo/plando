import { useEffect } from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";

import CardSection from "../../../shared/ui/common/CardSection.jsx";
import { Z } from "../../../shared/ui/zIndex.js";

/**
 * Toast — 챗에서 task 추가 성공/실패 직후 위에 떠오르는 알림.
 * 3.5초 후 자동 닫힘. task.error === true 면 실패(error accent) 스타일.
 *
 * Phase 7 redesign — CardSection 위에 success accent + 상단 floating.
 */
export function Toast({ task, onClose }) {
    const theme = useTheme();
    const isError = !!task?.error;
    const accent = isError ? theme.palette.error.main : theme.palette.success.main;

    useEffect(() => {
        const id = setTimeout(onClose, 3500);
        return () => clearTimeout(id);
    }, [onClose]);

    return (
        <Box
            sx={{
                position: "absolute",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: Z.TOAST,
                maxWidth: 340,
                width: "calc(100% - 32px)",
            }}
        >
            <CardSection
                padding="12px 16px"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    boxShadow: `0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px ${alpha(accent, 0.30)}`,
                }}
            >
                <Box
                    sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1.5,
                        bgcolor: alpha(accent, 0.14),
                        color: accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    {isError
                        ? <ErrorOutlineRoundedIcon sx={{ fontSize: 18 }} />
                        : <CheckRoundedIcon sx={{ fontSize: 18 }} />}
                </Box>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 0.25 }}>
                        {isError ? "태스크 추가에 실패했어요. 다시 시도해 주세요" : "태스크가 추가됐어요"}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 12,
                            color: "text.secondary",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {task.title}
                    </Typography>
                </Stack>
                <IconButton
                    onClick={onClose}
                    aria-label="닫기"
                    size="small"
                    sx={{ color: "text.disabled" }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </CardSection>
        </Box>
    );
}
