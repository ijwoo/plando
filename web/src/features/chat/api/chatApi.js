import api from "../../../shared/api/axiosInstance.js";


/**
 * @param history 최근 대화 [{role, text}] — 서버가 프롬프트에 실어 맥락을 잡는다.
 *   서버에 대화를 저장하지 않기로 한 판단을 지키면서 맥락만 얻는 방법이라, 갖고 있는 쪽이
 *   매 요청에 실어 보낸다. 서버도 받은 뒤 한 번 더 자른다.
 */
export async function callChat(message, context = {}, agentId = null, history = []) {
    const res = await api.post("/chat/service", { message, context, agentId, history });
    return res;
}

/**
 * 고를 수 있는 역할 목록.
 *
 * 화면에서 하드코딩하지 않고 서버에서 받는다 — 목록을 양쪽에 두면 서버가 바뀔 때 조용히
 * 어긋난다(없는 역할을 고르거나, 새로 생긴 역할이 안 보이거나).
 * 실패해도 화면이 죽으면 안 되므로 빈 배열을 돌려주고, 호출부는 기본 역할로 동작한다.
 */
export async function fetchAgents() {
    try {
        const res = await api.get("/chat/agents");
        return Array.isArray(res.data) ? res.data : [];
    } catch {
        return [];
    }
}

/** 오늘 AI 사용량. 대화 전에도 남은 횟수를 보여주려면 필요하다. */
export async function fetchUsage() {
    try {
        const res = await api.get("/chat/usage");
        return res.data ?? null;
    } catch {
        return null;
    }
}

/* 역할 만들기·수정·삭제.
   실패는 삼키지 않는다 — 저장이 안 됐는데 닫히면 사용자는 저장된 줄 안다. */
export async function createAgent(payload) {
    const res = await api.post("/chat/agents", payload);
    return res.data;
}

export async function updateAgent(id, payload) {
    const res = await api.put(`/chat/agents/${id}`, payload);
    return res.data;
}

export async function deleteAgent(id) {
    await api.delete(`/chat/agents/${id}`);
}

/**
 * 예약 실행 — 역할을 시간에 걸어둔다.
 *
 * days 는 "DAILY" 또는 "MON,TUE,..." 형식이다. 한글 요일을 보내면 서버가 버리고 매일로
 * 되돌린다(모르는 값을 그대로 두면 영원히 안 도는 예약이 되므로).
 *
 * 목록은 **실패를 삼키지 않는다.** 빈 배열로 돌려주면 화면이 "아직 예약이 없어요" 를 그리는데,
 * 못 받은 것과 없는 것이 같은 그림이 된다. 예약 하나를 지운 직후 목록 조회가 429 로 막혀
 * 둘 다 지워진 것처럼 보인 일이 있었다(2026-08-22). 저장·삭제도 마찬가지로 삼키지 않는다.
 */
export async function fetchSchedules() {
    const res = await api.get("/chat/schedules");
    return Array.isArray(res.data) ? res.data : [];
}

export async function createSchedule(payload) {
    const res = await api.post("/chat/schedules", payload);
    return res.data;
}

export async function updateSchedule(id, payload) {
    const res = await api.put(`/chat/schedules/${id}`, payload);
    return res.data;
}

export async function deleteSchedule(id) {
    await api.delete(`/chat/schedules/${id}`);
}
