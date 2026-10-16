package com.example.todo.controller;

import com.example.todo.dto.DmMessageResponse;
import com.example.todo.dto.DmPartnerProfileResponse;
import com.example.todo.dto.DmRoomResponse;
import com.example.todo.dto.DmSendRequest;
import com.example.todo.service.DmService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class DmController {

    private final DmService dmService;
    private final SimpMessagingTemplate messagingTemplate;

    // ── REST ──────────────────────────────────────────────────────────────

    @GetMapping("/api/dm/rooms")
    public ResponseEntity<List<DmRoomResponse>> getRooms(
            Principal principal,
            @RequestHeader("X-Workspace-Id") Long workspaceId) {
        return ResponseEntity.ok(dmService.getMyRooms(principal.getName(), workspaceId));
    }

    @PostMapping("/api/dm/rooms")
    public ResponseEntity<DmRoomResponse> getOrCreateRoom(
            @RequestBody Map<String, Long> body,
            Principal principal,
            @RequestHeader("X-Workspace-Id") Long workspaceId) {
        Long partnerId = body.get("partnerId");
        return ResponseEntity.ok(dmService.getOrCreateRoom(principal.getName(), partnerId, workspaceId));
    }

    @PostMapping("/api/dm/rooms/group")
    public ResponseEntity<DmRoomResponse> createGroupRoom(
            @RequestBody Map<String, Object> body,
            Principal principal,
            @RequestHeader("X-Workspace-Id") Long workspaceId) {
        String groupName = (String) body.get("groupName");
        @SuppressWarnings("unchecked")
        List<Long> memberIds = ((List<Number>) body.get("memberIds"))
                .stream().map(Number::longValue).toList();
        return ResponseEntity.ok(dmService.createGroupRoom(principal.getName(), memberIds, groupName, workspaceId));
    }

    @GetMapping("/api/dm/rooms/{roomId}/messages")
    public ResponseEntity<List<DmMessageResponse>> getMessages(
            @PathVariable Long roomId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "30") int size,
            Principal principal) {
        return ResponseEntity.ok(dmService.getMessages(principal.getName(), roomId, before, size));
    }

    // 텍스트 메시지 전송 (REST) — 요청/응답으로 성공·실패를 확실히 알 수 있어
    // 낙관적 UI 정합 + 미연결 시 유실 방지에 사용. 저장 후 참여자에게 WebSocket 브로드캐스트.
    @PostMapping("/api/dm/rooms/{roomId}/messages")
    public ResponseEntity<DmMessageResponse> postMessage(
            @PathVariable Long roomId,
            @RequestBody DmSendRequest request,
            Principal principal) {
        DmMessageResponse message = dmService.sendMessage(
                principal.getName(), roomId, request.getContent(), request.getTag(), request.getLinkedTodoId(), request.getReplyToId());
        messagingTemplate.convertAndSend("/topic/dm/" + roomId, message);
        return ResponseEntity.ok(message);
    }

    // 대화 내 검색 — 방 안에서 내용 매칭 메시지(최신순)
    @GetMapping("/api/dm/rooms/{roomId}/search")
    public ResponseEntity<List<DmMessageResponse>> searchInRoom(
            @PathVariable Long roomId,
            @RequestParam String q,
            Principal principal) {
        return ResponseEntity.ok(dmService.searchInRoom(principal.getName(), roomId, q));
    }

    @PostMapping("/api/dm/rooms/{roomId}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long roomId, Principal principal) {
        int count = dmService.markAsRead(principal.getName(), roomId);
        if (count > 0) {
            // 발신자에게 읽음 처리 알림
            messagingTemplate.convertAndSend("/topic/dm/" + roomId,
                    Map.of("type", "READ_RECEIPT", "roomId", roomId));
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/dm/rooms/{roomId}/partner-profile")
    public ResponseEntity<DmPartnerProfileResponse> getPartnerProfile(
            @PathVariable Long roomId,
            Principal principal) {
        return ResponseEntity.ok(dmService.getPartnerProfile(principal.getName(), roomId));
    }

    @PostMapping("/api/dm/rooms/{roomId}/invite")
    public ResponseEntity<DmRoomResponse> inviteToGroupRoom(
            @PathVariable Long roomId,
            @RequestBody Map<String, Object> body,
            Principal principal,
            @RequestHeader("X-Workspace-Id") Long workspaceId) {
        @SuppressWarnings("unchecked")
        List<Long> memberIds = ((List<Number>) body.get("memberIds"))
                .stream().map(Number::longValue).toList();
        return ResponseEntity.ok(dmService.inviteToGroupRoom(principal.getName(), roomId, memberIds));
    }

    @PostMapping(value = "/api/dm/rooms/{roomId}/send-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DmMessageResponse> sendFile(
            @PathVariable Long roomId,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String content,
            Principal principal) throws IOException {
        DmMessageResponse msg = dmService.sendFile(principal.getName(), roomId, file, content);
        // WebSocket으로 채팅방 참여자에게 브로드캐스트
        messagingTemplate.convertAndSend("/topic/dm/" + roomId, msg);
        return ResponseEntity.ok(msg);
    }

    @DeleteMapping("/api/dm/rooms/{roomId}/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable Long roomId,
            @PathVariable Long messageId,
            Principal principal) {
        dmService.deleteMessage(principal.getName(), roomId, messageId);
        // 같은 채팅방 참여자에게 삭제 이벤트 브로드캐스트
        messagingTemplate.convertAndSend("/topic/dm/" + roomId,
                Map.of("type", "MESSAGE_DELETED", "messageId", messageId));
        return ResponseEntity.noContent().build();
    }

    // ── WebSocket (STOMP) ─────────────────────────────────────────────────

    @MessageMapping("/dm.send")
    public void sendMessage(@Payload DmSendRequest request, Principal principal) {
        DmMessageResponse message = dmService.sendMessage(
                principal.getName(),
                request.getRoomId(),
                request.getContent(),
                request.getTag(),
                request.getLinkedTodoId(),
                request.getReplyToId()
        );

        // 채팅방 참여자 모두에게 실시간 전송
        messagingTemplate.convertAndSend("/topic/dm/" + request.getRoomId(), message);
    }

    // ── 타이핑 인디케이터 (영속 X, 일시 이벤트) ─────────────────────────────
    @MessageMapping("/dm.typing")
    public void typing(@Payload Map<String, Object> body, Principal principal) {
        Object rawRoomId = body.get("roomId");
        if (rawRoomId == null) return;
        Long roomId;
        try {
            roomId = Long.valueOf(String.valueOf(rawRoomId).trim());
        } catch (NumberFormatException e) {
            return;
        }

        /* 여기만 참여자 검사가 없어서 클라이언트가 준 roomId·senderName 을 그대로 믿고
           브로드캐스트했다. 남의 방 번호를 넣으면 그 방에 가짜 "OOO 님이 입력 중" 이벤트를
           꽂을 수 있었다(구독 자체는 인가되어 있어 유출은 아니고 위조 주입). 다른 DM 진입점과
           똑같이 참여자인지 확인하고, 표시 이름도 클라이언트 값이 아니라 서버가 정한다. */
        String senderName = dmService.resolveTypingSenderName(principal.getName(), roomId);
        if (senderName == null) return;

        messagingTemplate.convertAndSend("/topic/dm/" + roomId, Map.of(
                "type", "TYPING",
                "senderEmail", principal.getName(),
                "senderName", senderName
        ));
    }

    // ── 메시지 수정 ───────────────────────────────────────────────────────
    @PatchMapping("/api/dm/rooms/{roomId}/messages/{messageId}")
    public ResponseEntity<DmMessageResponse> updateMessage(
            @PathVariable Long roomId,
            @PathVariable Long messageId,
            @RequestBody Map<String, Object> body,
            Principal principal
    ) {
        String content = (String) body.get("content");
        DmMessageResponse updated = dmService.updateMessage(principal.getName(), roomId, messageId, content);
        messagingTemplate.convertAndSend("/topic/dm/" + roomId,
                Map.of("type", "MESSAGE_UPDATED", "message", updated));
        return ResponseEntity.ok(updated);
    }

    // ── 공지 등록/해제 ───────────────────────────────────────────────────
    @PatchMapping("/api/dm/rooms/{roomId}/messages/{messageId}/notice")
    public ResponseEntity<DmMessageResponse> setNotice(
            @PathVariable Long roomId,
            @PathVariable Long messageId,
            @RequestBody Map<String, Object> body,
            Principal principal
    ) {
        boolean pinned = Boolean.TRUE.equals(body.get("pinned"));
        DmMessageResponse updated = dmService.setNotice(principal.getName(), roomId, messageId, pinned);
        messagingTemplate.convertAndSend("/topic/dm/" + roomId,
                Map.of("type", "MESSAGE_UPDATED", "message", updated));
        return ResponseEntity.ok(updated);
    }

    // ── 이모지 reaction 토글 ──────────────────────────────────────────────
    @PostMapping("/api/dm/rooms/{roomId}/messages/{messageId}/reactions")
    public ResponseEntity<DmMessageResponse> toggleReaction(
            @PathVariable Long roomId,
            @PathVariable Long messageId,
            @RequestBody Map<String, String> body,
            Principal principal
    ) {
        String emoji = body.get("emoji");
        DmMessageResponse updated = dmService.toggleReaction(principal.getName(), roomId, messageId, emoji);
        messagingTemplate.convertAndSend("/topic/dm/" + roomId,
                Map.of("type", "REACTION_UPDATED", "message", updated));
        return ResponseEntity.ok(updated);
    }
}
