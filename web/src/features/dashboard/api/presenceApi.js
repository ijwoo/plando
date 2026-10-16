import api from "../../../shared/api/axiosInstance.js";

/**
 * 현재 워크스페이스 멤버 전체의 presence snapshot.
 * 응답: { [email]: { online: boolean, lastSeen: ISOString | null } }
 *
 * STOMP 세션 기반 — 백엔드 PresenceController. 다중 인스턴스 배포 시 Redis 등으로 확장 필요.
 */
export const fetchWorkspacePresence = () => api.get("/presence");

export const fetchUserPresence = (email) => api.get(`/presence/${encodeURIComponent(email)}`);
