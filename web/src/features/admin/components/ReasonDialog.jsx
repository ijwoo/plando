import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";

/** 운영자 조치 확인 — 사유는 필수이고 감사 로그에 그대로 남는다. */
export default function ReasonDialog({ open, title, description, confirmLabel = "확인", danger, onClose, onConfirm }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) { setReason(""); setError(""); setBusy(false); }
    }, [open]);

    const ok = async () => {
        if (reason.trim().length < 2) return setError("사유를 2자 이상 적어 주세요.");
        setBusy(true);
        try {
            await onConfirm(reason.trim());
            onClose();
        } catch (e) {
            setError(e?.message || "처리하지 못했어요.");
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
            <DialogContent>
                {description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{description}</Typography>}
                <TextField
                    autoFocus fullWidth multiline minRows={3} label="사유" value={reason}
                    onChange={(e) => { setReason(e.target.value); setError(""); }}
                    error={!!error} helperText={error || "감사 로그에 기록돼요."}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} disabled={busy} color="inherit">취소</Button>
                <Button onClick={ok} disabled={busy} variant="contained" color={danger ? "error" : "primary"}>{confirmLabel}</Button>
            </DialogActions>
        </Dialog>
    );
}
