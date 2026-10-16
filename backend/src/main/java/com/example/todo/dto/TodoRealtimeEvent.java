package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 워크스페이스 구독자에게 보내는 할 일 변경 알림.
 *
 * 전체 DTO를 싣지 않는 이유:
 *  - TodoResponseDto에는 담당자 이메일·프로필·위치·본문이 들어간다. 토픽 구독자 전원에게
 *    그대로 뿌리면 나중에 "특정 할 일만 비공개" 같은 요구가 생겼을 때 되돌리기 어렵다.
 *  - 일괄 작업(보관 정리 등)이 수십 건을 한 번에 바꾼다. 전체 DTO × N은 크다.
 *  - 클라이언트가 이미 patch 기반으로 갱신한다(웹 TODO_UPDATED의 detail.patch). 모양이 같다.
 *
 * 단 ADDED는 예외다 — 클라이언트에 그 항목이 아예 없어 patch로는 만들 수 없다.
 * 생성된 항목의 DTO를 todo에 싣는다(웹 TODO_ADDED 리스너가 detail을 그대로 배열에 넣는 계약).
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TodoRealtimeEvent {

    public enum Type { ADDED, UPDATED, DELETED }

    private Type type;
    private Long todoId;
    private Long workspaceId;

    /**
     * 변경을 일으킨 사용자 id. 클라이언트는 자기 id와 같으면 무시한다 —
     * 낙관적 업데이트가 이미 반영해 둔 것을 다시 적용하면 카드가 두 번 움직인다.
     */
    private Long actorId;
    /** id가 null인 클라이언트(구버전 로그인 세션)를 위한 폴백 식별자 */
    private String actorEmail;
    private String actorName;

    /** UPDATED 전용 — 바뀐 필드만 */
    private Map<String, Object> patch;

    /** ADDED 전용 — 생성된 항목 */
    private TodoResponseDto todo;

    /**
     * 발생 시각. 재연결 중 REST 응답과 뒤섞여 옛 값이 나중에 도착하는 경우를 수신 측이
     * 걸러낼 수 있게 한다.
     */
    private LocalDateTime at;
}
