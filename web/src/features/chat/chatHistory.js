import { getUser } from "../../shared/utils/tokenUtils.js";

/**
 * AI 대화 기록 — 브라우저에 저장한다.
 *
 * 왜 서버가 아니라 localStorage 인가: 대화 자체를 서버에 남기면 보관 기간·삭제 요청·국외
 * 이전 같은 개인정보 문제가 따라온다. 지금 필요한 건 "방금 하던 대화로 돌아가기"지
 * 기기 간 동기화가 아니다. 필요해지면 그때 서버로 올리면 된다.
 *
 * 예전에는 아무것도 저장하지 않아 **새로고침하면 대화가 통째로 사라졌다.** 그래서 왼쪽에
 * 목록을 그릴 수도 없었다(그릴 게 없으니 빈 껍데기가 된다).
 */

/**
 * 저장 키는 **계정마다 다르다.**
 *
 * [고치는 결함] 키가 하나뿐이라 로그아웃하고 다른 계정으로 들어가면 이전 사용자의 대화
 * 목록이 그대로 보였다. 제목이 첫 발화라 목록만 봐도 무슨 얘기였는지 읽힌다.
 *
 * 로그아웃 때 지우는 것(tokenUtils)만으로는 부족하다 — 토큰 만료나 브라우저 강제 종료로
 * 로그아웃을 거치지 않고 계정이 바뀌는 경로가 있다. 키를 나눠 두면 그때도 섞이지 않는다.
 */
const KEY_BASE = "plando.chat.history.v1";

function storageKey() {
    // 저장 키 이름을 여기서 다시 적지 않는다 — 베껴 두면 저쪽이 바뀔 때 조용히 어긋난다
    const email = getUser()?.email;
    return email ? `${KEY_BASE}.${email}` : KEY_BASE;
}
const MAX = 30;          // 오래된 것부터 버린다 — 무한히 쌓이면 저장 한도에 걸린다
const TITLE_MAX = 40;

/** 저장된 대화 목록. 최근 수정순. 깨진 데이터는 조용히 버린다(여기서 화면이 죽으면 안 된다). */
export function listConversations() {
    try {
        const raw = JSON.parse(localStorage.getItem(storageKey()) || "[]");
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((c) => c && c.id && Array.isArray(c.messages))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
        return [];
    }
}

/** 첫 사용자 발화를 제목으로 쓴다 — 목록에서 "무슨 얘기였는지"가 바로 읽힌다. */
export function titleOf(messages) {
    const first = messages.find((m) => m.role === "user" && typeof m.text === "string");
    const t = (first?.text || "").trim().replace(/\s+/g, " ");
    if (!t) return "새 대화";
    return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX)}…` : t;
}

/**
 * 대화를 저장하고 갱신된 목록을 돌려준다.
 * 메시지가 없으면 저장하지 않는다 — 열었다 닫기만 해도 빈 항목이 쌓이면 목록이 지저분해진다.
 */
export function saveConversation(id, messages) {
    if (!id || !Array.isArray(messages) || messages.length === 0) return listConversations();
    try {
        const rest = listConversations().filter((c) => c.id !== id);
        const next = [{ id, title: titleOf(messages), messages, updatedAt: Date.now() }, ...rest].slice(0, MAX);
        localStorage.setItem(storageKey(), JSON.stringify(next));
        return next;
    } catch {
        // 저장 한도 초과 등 — 대화는 계속 쓸 수 있어야 하므로 삼킨다
        return listConversations();
    }
}

export function removeConversation(id) {
    try {
        const next = listConversations().filter((c) => c.id !== id);
        localStorage.setItem(storageKey(), JSON.stringify(next));
        return next;
    } catch {
        return listConversations();
    }
}

export function newConversationId() {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 목록에 보여줄 상대 시각 — "3분 전"처럼. */
export function relativeTime(ts) {
    if (!ts) return "";
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "방금";
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}일 전`;
    return new Date(ts).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

/**
 * 목록을 날짜로 묶는다 — 30건이 한 덩어리로 늘어서면 "언제 것인지"가 안 읽힌다.
 * 빈 그룹은 내보내지 않으므로 호출부에서 따로 거르지 않아도 된다.
 */
export function groupByDate(conversations) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const weekAgo = startOfToday - 6 * 86400000;

    const buckets = [
        { key: "today", label: "오늘", items: [] },
        { key: "yesterday", label: "어제", items: [] },
        { key: "week", label: "지난 7일", items: [] },
        { key: "older", label: "그 이전", items: [] },
    ];
    for (const c of conversations) {
        const t = c.updatedAt || 0;
        if (t >= startOfToday) buckets[0].items.push(c);
        else if (t >= startOfYesterday) buckets[1].items.push(c);
        else if (t >= weekAgo) buckets[2].items.push(c);
        else buckets[3].items.push(c);
    }
    return buckets.filter((b) => b.items.length > 0);
}
