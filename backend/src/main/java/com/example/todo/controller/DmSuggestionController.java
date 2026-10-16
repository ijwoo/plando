package com.example.todo.controller;

import com.example.todo.dto.DmMessageResponse;
import com.example.todo.dto.DmTodoSuggestionResponse;
import com.example.todo.service.DmSuggestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * DM 할 일 제안 — 목록/수락/거절.
 * 수락은 클라이언트가 기존 POST /api/todos 로 할 일을 만든 뒤 todoId를 넘기는 방식
 * (생성 로직 중복 없이 메시지 연결 + 제안 종결만 담당).
 */
@RestController
@RequiredArgsConstructor
public class DmSuggestionController {

    private final DmSuggestionService dmSuggestionService;

    @GetMapping("/api/dm/rooms/{roomId}/suggestions")
    public ResponseEntity<List<DmTodoSuggestionResponse>> list(
            @PathVariable Long roomId,
            Principal principal) {
        return ResponseEntity.ok(dmSuggestionService.listPending(principal.getName(), roomId));
    }

    @PostMapping("/api/dm/suggestions/{id}/accept")
    public ResponseEntity<DmMessageResponse> accept(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body,
            Principal principal) {
        return ResponseEntity.ok(dmSuggestionService.accept(principal.getName(), id, body.get("todoId")));
    }

    @PostMapping("/api/dm/suggestions/{id}/dismiss")
    public ResponseEntity<Void> dismiss(@PathVariable Long id, Principal principal) {
        dmSuggestionService.dismiss(principal.getName(), id);
        return ResponseEntity.noContent().build();
    }

    /** 내 방들의 대기 제안 수 — 방 목록 ✨ 뱃지용 {roomId: count} */
    @GetMapping("/api/dm/suggestions/pending-counts")
    public ResponseEntity<Map<Long, Long>> pendingCounts(
            Principal principal,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        return ResponseEntity.ok(dmSuggestionService.pendingCounts(principal.getName(), workspaceId));
    }

    /** 긴 메시지(회의록 등)에서 할 일 후보 일괄 추출 — 비영속, 수동 트리거 */
    @PostMapping("/api/dm/rooms/{roomId}/messages/{messageId}/extract")
    public ResponseEntity<List<DmSuggestionService.ExtractedItem>> extract(
            @PathVariable Long roomId,
            @PathVariable Long messageId,
            Principal principal) {
        return ResponseEntity.ok(dmSuggestionService.extract(principal.getName(), roomId, messageId));
    }
}
