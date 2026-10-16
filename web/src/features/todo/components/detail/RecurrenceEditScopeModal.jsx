import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItemButton,
    ListItemText,
    Radio,
    ListItemIcon,
    Typography,
} from "@mui/material";
import RepeatIcon from "@mui/icons-material/Repeat";
import { Z } from "../../../../shared/ui/zIndex.js";

const SCOPE_OPTIONS = [
    { value: "SINGLE", label: "이 일정만", desc: "이 일정만 변경됩니다." },
    {
        value: "THIS_AND_FOLLOWING",
        label: "이 일정 및 이후 일정",
        desc: "이 일정과 이후에 생성된 반복 일정이 모두 변경됩니다.",
    },
    {
        value: "ALL",
        label: "모든 일정",
        desc: "이 반복 일정 시리즈 전체가 변경됩니다.",
    },
];

export default function RecurrenceEditScopeModal({ open, isGeneratedInstance, onSelect, onClose }) {
    const [selected, setSelected] = React.useState("SINGLE");

    const options = isGeneratedInstance
        ? SCOPE_OPTIONS
        : SCOPE_OPTIONS.filter((o) => o.value !== "THIS_AND_FOLLOWING");

    const handleConfirm = () => {
        onSelect(selected);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth sx={{ zIndex: Z.TOAST }}>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
                <RepeatIcon fontSize="small" color="primary" />
                반복 일정 수정
            </DialogTitle>
            <DialogContent sx={{ pb: 0 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    이 반복 일정의 어떤 항목을 변경할까요?
                </Typography>
                <List disablePadding>
                    {options.map((opt) => (
                        <ListItemButton
                            key={opt.value}
                            onClick={() => setSelected(opt.value)}
                            selected={selected === opt.value}
                            sx={{ borderRadius: 1, mb: 0.5 }}
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <Radio
                                    checked={selected === opt.value}
                                    size="small"
                                    tabIndex={-1}
                                    disableRipple
                                />
                            </ListItemIcon>
                            <ListItemText
                                primary={opt.label}
                                secondary={opt.desc}
                                primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }}
                                secondaryTypographyProps={{ fontSize: 12 }}
                            />
                        </ListItemButton>
                    ))}
                </List>
            </DialogContent>
            <DialogActions sx={{ pt: 2 }}>
                <Button onClick={onClose} color="inherit">취소</Button>
                <Button onClick={handleConfirm} variant="contained">확인</Button>
            </DialogActions>
        </Dialog>
    );
}
