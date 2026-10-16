import api from "../../../shared/api/axiosInstance.js";

/** 내 장소 알림 트리거 전체 조회 → { [todoId]: { enabled, radius } } */
export const fetchTriggers = () => api.get("/triggers");

/** 트리거 일괄 저장 (upsert) */
export const saveTriggers = (triggerMap) => api.put("/triggers", triggerMap);

/** 장소 반경 진입 시 호출 → 서버에서 푸시 알림 발송 */
export const notifyLocationEnter = (todoId) => api.post(`/triggers/enter/${todoId}`);
