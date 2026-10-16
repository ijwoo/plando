import { createPortal } from "react-dom";
import { Avatar } from "@mui/material";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { Z } from "../../../shared/ui/zIndex.js";

const F = "-apple-system,'Noto Sans KR',BlinkMacSystemFont,sans-serif";

/**
 * 관리자 위임 다이얼로그
 *
 * Props:
 *   open, t (토큰), members, currentEmail
 *   transferTarget, onTargetSet
 *   onConfirm, onClose, loading
 */
export default function TransferOwnerDialog({
                                                open,
                                                t,
                                                members,
                                                currentEmail,
                                                transferTarget,
                                                onTargetSet,
                                                onConfirm,
                                                onClose,
                                                loading,
                                            }) {
    const others = (members || []).filter((m) => m.email !== currentEmail);

    if (!open) return null;

    const getMemberKey = (member) => {
        if (!member) return null;
        if (member.userId != null) return `user-${member.userId}`;
        if (member.id != null) return `id-${member.id}`;
        if (member.email) return `email-${member.email}`;
        return null;
    };

    const selectedKey = getMemberKey(transferTarget);

    return createPortal(
        <>
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: Z.DIALOG_BACKDROP,
                    background: "rgba(0,0,0,0.5)",
                }}
            />

            <div
                style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                    zIndex: Z.DIALOG,
                    background: t.sheet,
                    borderRadius: 20,
                    padding: "24px",
                    width: "min(400px, calc(100vw - 40px))",
                    maxHeight: "70dvh",
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: F,
                    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
                }}
            >
                <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 6 }}>
                    관리자 위임
                </div>

                <div style={{ fontSize: 13, color: t.text2, marginBottom: 16 }}>
                    나가기 전에 관리자 권한을 위임할 멤버를 선택해주세요.
                </div>

                <div style={{ overflowY: "auto", flex: 1, marginBottom: 16 }}>
                    {others.length === 0 ? (
                        <div
                            style={{
                                fontSize: 13,
                                color: t.text2,
                                textAlign: "center",
                                padding: "20px 0",
                            }}
                        >
                            위임할 멤버가 없습니다.
                        </div>
                    ) : (
                        others.map((m) => {
                            const memberKey = getMemberKey(m);
                            const selected = selectedKey != null && memberKey != null && selectedKey === memberKey;

                            return (
                                <div
                                    key={memberKey || m.email || Math.random()}
                                    onClick={() => onTargetSet(m)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "10px 12px",
                                        borderRadius: 12,
                                        marginBottom: 6,
                                        background: selected ? t.primaryDim : t.surface,
                                        border: `1.5px solid ${selected ? t.primary + "66" : t.border}`,
                                        cursor: "pointer",
                                    }}
                                >
                                    <Avatar
                                        src={m.profileImageUrl ? resolveImageUrl(m.profileImageUrl) : undefined}
                                        sx={{ width: 32, height: 32, fontSize: 13 }}
                                    >
                                        {(m.name || m.nickname || "?")[0]}
                                    </Avatar>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: t.text,
                                            }}
                                        >
                                            {m.name || m.nickname || m.email}
                                        </div>
                                        <div style={{ fontSize: 11.5, color: t.text2 }}>
                                            {m.email}
                                        </div>
                                    </div>

                                    {selected && (
                                        <div
                                            style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: "50%",
                                                background: t.primary,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <CheckRounded sx={{ fontSize: 12, color: "#fff" }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "11px", background: t.surfaceMd, border: `1px solid ${t.border}`, borderRadius: 12, fontSize: 14, fontWeight: 600, color: t.text2, cursor: "pointer", fontFamily: F }}>
                        취소
                    </button>

                    <button
                        onClick={onConfirm}
                        disabled={!transferTarget || loading}
                        style={{
                            flex: 1, padding: "11px", border: "none", borderRadius: 12,
                            fontSize: 14, fontWeight: 700, fontFamily: F,
                            background: transferTarget && !loading ? t.red : t.surfaceMd,
                            color: transferTarget && !loading ? "#fff" : t.text3,
                            cursor: transferTarget && !loading ? "pointer" : "not-allowed",
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? "처리 중..." : "위임 후 나가기"}
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
}