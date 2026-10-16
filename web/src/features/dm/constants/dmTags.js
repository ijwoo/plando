/**
 * DM 도메인 상수 — 단일 출처(single source of truth).
 *
 * 색상/이모지/라벨이 여러 컴포넌트에 흩어지지 않도록 여기 모아 둠.
 *  - DmInputBar       : 입력 시 공지 토글 활성 컬러
 *  - DmMessageList    : 말풍선 위 태그 chip 메타
 *  - DmNoticePin      : 카톡-스타일 상단 핀 컬러
 *  - 액션 시트/popover: QUICK_REACTIONS
 */

export const NOTICE_COLOR = "#F59E0B";

/** 온라인(최근 활동) 표시용 — presence dot / 활동 라벨 텍스트 등. */
export const PRESENCE_ONLINE_COLOR = "#22C55E";

/**
 * 백엔드 `dm_messages.tag` 컬럼 값과 매칭.
 * 추가 라벨이 필요해지면 여기에만 등록하면 됨.
 */
export const TAG_META = {
    NOTICE: { label: "고정", emoji: "📌", color: NOTICE_COLOR },
};

/** 메시지 reaction 빠른 picker — 액션 시트 / DesktopBubbleActions 양쪽에서 공유. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "✅", "👀"];
