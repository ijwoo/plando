/**
 * 게스트 계정(guest1/guest2@plando.app) 식별 + 차단 헬퍼.
 * 기존에 산발적으로 정의돼있던 패턴들을 하나로 통합:
 *   - userEmail.startsWith("guest") && userEmail.endsWith("@plando.app")
 *   - user?.email?.endsWith("@plando.app") && user?.email?.startsWith("guest")
 *
 * 새 코드는 이 모듈만 사용.
 */
import { getUser } from "./tokenUtils.js";
import { APP_EVENTS } from "../constants/events.js";

/** 게스트 이메일인지 단순 체크 (소문자 비교) */
export const isGuestEmail = (email) => {
    if (!email) return false;
    const e = String(email).toLowerCase();
    return e.startsWith("guest") && e.endsWith("@plando.app");
};

/** 현재 user(또는 인자) 가 게스트인지 */
export const isGuest = (user = getUser()) => isGuestEmail(user?.email);

/**
 * 게스트(또는 미로그인)면 전역 GuestBlockModal 트리거 후 true 반환.
 * 회원이면 false.
 *
 * @param {object}   [opts]
 * @param {Node}     [opts.description] - 모달 본문 컨텍스트별 문구 (없으면 기본값)
 * @param {object}   [opts.user]        - 검사할 user (기본: getUser())
 *
 * 호출 패턴:
 *   if (blockIfGuest()) return;
 *   if (blockIfGuest({ description: <>지원/북마크는 회원만...</> })) return;
 */
export const blockIfGuest = (opts = {}) => {
    const { description, user = getUser() } = opts;
    if (!user || isGuest(user)) {
        window.dispatchEvent(new CustomEvent(APP_EVENTS.GUEST_BLOCK_REQUEST, {
            detail: description ? { description } : undefined,
        }));
        return true;
    }
    return false;
};
