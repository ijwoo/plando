import React from "react";
import {
    Box, Dialog, DialogContent, DialogTitle,
    IconButton, Typography, Divider,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Z } from "../zIndex.js";

/**
 * 정보 탭 문서 모달 공용 chrome — 이용약관 / 오픈소스 라이선스 등.
 * (개인정보처리방침은 별도 PrivacyPolicyModal 유지)
 * 본문은 children으로 받고, 단락은 export된 Section/Body/BulletList로 구성.
 */
export function Section({ title, children }) {
    return (
        <Box sx={{ mb: 3 }}>
            {title && <Typography sx={{ fontSize: 14, fontWeight: 800, mb: 1 }}>{title}</Typography>}
            {children}
        </Box>
    );
}

export function Body({ children }) {
    return (
        <Typography sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.75 }}>
            {children}
        </Typography>
    );
}

export function BulletList({ items }) {
    return (
        <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {items.map((item, i) => (
                <Box component="li" key={i} sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.75, mb: 0.25 }}>
                    {item}
                </Box>
            ))}
        </Box>
    );
}

export default function InfoDocModal({ open, onClose, title, updated, children }) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            sx={{ zIndex: Z.MODAL_NESTED }}
            PaperProps={{ sx: { borderRadius: 3, maxHeight: "85vh" } }}
        >
            <DialogTitle sx={{ pb: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                        <Typography sx={{ fontWeight: 900, fontSize: 17 }}>{title}</Typography>
                        {updated && <Typography variant="caption" color="text.secondary">최종 업데이트: {updated}</Typography>}
                    </Box>
                    <IconButton size="small" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <Divider sx={{ mt: 1.5 }} />

            <DialogContent sx={{ py: 2.5 }}>
                {children}
            </DialogContent>
        </Dialog>
    );
}
