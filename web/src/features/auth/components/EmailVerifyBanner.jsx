import { Alert, Box, Button, IconButton, Stack, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";

/**
 * 이메일 미인증 안내 배너 — 순수 UI.
 * 상태는 Layout이 useEmailVerification()으로 한 번만 만들어 props로 내린다
 * (데스크탑/모바일 배치 지점이 달라 컴포넌트가 훅을 직접 들면 조회가 중복된다).
 * 여백은 배치하는 쪽에서 sx로 준다.
 */
export default function EmailVerifyBanner({ show, email, resending, resend, dismiss, sx }) {
    if (!show) return null;

    return (
        <Alert
            severity="warning"
            icon={<MarkEmailUnreadRoundedIcon fontSize="small" />}
            sx={{
                borderRadius: 2,
                alignItems: "center",
                "& .MuiAlert-message": { minWidth: 0, py: 0.5 },
                ...sx,
            }}
            action={
                <Stack direction="row" spacing={0.25} alignItems="center">
                    <Button
                        size="small"
                        color="inherit"
                        onClick={resend}
                        disabled={resending}
                        sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                    >
                        {resending ? "보내는 중..." : "인증 메일 다시 받기"}
                    </Button>
                    <IconButton size="small" color="inherit" onClick={dismiss} aria-label="닫기">
                        <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                </Stack>
            }
        >
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700}>
                    이메일 인증이 필요해요
                </Typography>
                <Typography variant="caption" sx={{ display: "block", opacity: 0.85 }}>
                    {email ? `${email}로 보낸 인증 링크를 눌러주세요. ` : "메일로 보낸 인증 링크를 눌러주세요. "}
                    인증 전에는 초대코드로 팀에 참여할 수 없어요.
                </Typography>
            </Box>
        </Alert>
    );
}
