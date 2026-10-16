import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { adminApi, adminToken } from "../api/adminApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";

/**
 * 관리자 2단계 인증 화면.
 * - 처음: OTP 앱에 설정 키를 넣고 → 6자리로 등록 확인
 * - 그다음부터: 6자리만
 * 6자리가 다 차면 바로 보낸다.
 */
export default function AdminGate({ enrolled, onPassed }) {
    const [enroll, setEnroll] = useState(null); // { secret, otpauthUri }
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (enrolled) return;
        adminApi.startEnroll().then(setEnroll).catch((e) => setError(getApiError(e, "등록을 시작하지 못했어요.")));
    }, [enrolled]);

    const submit = async (value) => {
        if (busy || value.length !== 6) return;
        setBusy(true);
        setError("");
        try {
            const t = enrolled ? await adminApi.verify(value) : await adminApi.confirmEnroll(value);
            adminToken.set(t);
            onPassed();
        } catch (e) {
            setError(getApiError(e, "확인하지 못했어요."));
            setCode("");
            requestAnimationFrame(() => inputRef.current?.focus());
        } finally {
            setBusy(false);
        }
    };

    const onChange = (e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
        setCode(v);
        if (v.length === 6) submit(v);
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(enroll.secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* 복사 실패 — 키는 화면에 그대로 보인다 */ }
    };

    return (
        <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2, bgcolor: "background.default" }}>
            <Box sx={{
                width: "100%", maxWidth: 400, p: { xs: 3, sm: 4 }, borderRadius: 4,
                bgcolor: "background.paper", border: 1, borderColor: "divider",
                boxShadow: "0 24px 48px -24px rgba(15, 23, 42, .25)",
            }}>
                <Box sx={{
                    width: 44, height: 44, borderRadius: 3, display: "grid", placeItems: "center", mb: 2.5,
                    bgcolor: "primary.main", color: "primary.contrastText",
                }}>
                    <ShieldCheck size={22} />
                </Box>
                <Typography variant="h6" fontWeight={700}>
                    {enrolled ? "관리자 인증" : "OTP 앱 등록"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                    {enrolled
                        ? "OTP 앱에 표시된 6자리를 입력하세요. 30분 동안 유지돼요."
                        : "Google Authenticator·1Password 같은 OTP 앱에서 ‘설정 키 입력’으로 아래 키를 넣고, 앱에 뜬 6자리를 입력하세요."}
                </Typography>

                {!enrolled && (
                    <Box sx={{ mb: 3 }}>
                        {enroll ? (
                            <Box sx={{
                                display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2,
                                bgcolor: "action.hover", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}>
                                <Typography sx={{ flex: 1, fontFamily: "inherit", fontSize: 14, letterSpacing: ".06em", wordBreak: "break-all" }}>
                                    {enroll.secret.match(/.{1,4}/g).join(" ")}
                                </Typography>
                                <Tooltip title={copied ? "복사됨" : "복사"}>
                                    <IconButton size="small" onClick={copy} aria-label="설정 키 복사">
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ) : !error && <CircularProgress size={20} />}
                        {enroll && (
                            <Button href={enroll.otpauthUri} size="small" sx={{ mt: 1, px: 0 }}>
                                이 기기의 OTP 앱으로 열기
                            </Button>
                        )}
                    </Box>
                )}

                <TextField
                    inputRef={inputRef}
                    value={code}
                    onChange={onChange}
                    autoFocus
                    fullWidth
                    disabled={busy || (!enrolled && !enroll)}
                    placeholder="000000"
                    error={!!error}
                    helperText={error || " "}
                    slotProps={{
                        htmlInput: {
                            inputMode: "numeric", autoComplete: "one-time-code", "aria-label": "6자리 OTP",
                            style: { textAlign: "center", fontSize: 28, letterSpacing: "0.5em", fontWeight: 600, paddingLeft: "0.5em" },
                        },
                    }}
                />
                <Button fullWidth variant="contained" size="large" disabled={busy || code.length !== 6}
                        onClick={() => submit(code)} sx={{ mt: 1 }}>
                    {busy ? <CircularProgress size={20} color="inherit" /> : enrolled ? "확인" : "등록 완료"}
                </Button>
            </Box>
        </Box>
    );
}
