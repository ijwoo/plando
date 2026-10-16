export function timeStr(d) {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function dateSep(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

// 공용 isSameDay(Date·문자열·타임스탬프 허용)로 통합 — 파일 내부에서도 쓰므로 import 후 재export
import { isSameDay } from "../../../shared/utils/formatters.js";
export { isSameDay };

export function minDiff(a, b) {
    if (!a || !b) return 999;
    return Math.abs(new Date(a) - new Date(b)) / 60000;
}

export function buildGroups(messages, myIdentifier) {
    return messages.map((msg, idx) => {
        // senderEmail(문자열) 비교 우선, 없으면 senderId 숫자 비교 (fallback)
        const isMe = msg.senderEmail
            ? msg.senderEmail === myIdentifier
            : String(msg.senderId) === String(myIdentifier);
        const prev = messages[idx - 1];
        const next = messages[idx + 1];

        const grouped =
            !!prev &&
            prev.senderId === msg.senderId &&
            isSameDay(prev.sentAt, msg.sentAt) &&
            minDiff(prev.sentAt, msg.sentAt) < 5;

        const lastInGroup =
            !next ||
            next.senderId !== msg.senderId ||
            !isSameDay(msg.sentAt, next.sentAt) ||
            minDiff(msg.sentAt, next.sentAt) >= 5;

        const showDate = !prev || !isSameDay(prev.sentAt, msg.sentAt);

        return {
            msg,
            isMe,
            grouped,
            lastInGroup,
            showDate,
        };
    });
}