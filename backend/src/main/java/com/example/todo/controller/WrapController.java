package com.example.todo.controller;

import com.example.todo.dto.WrapResponseDto;
import com.example.todo.service.WrapService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * 주간 회고 카드 응답 + 셀프 메모 저장.
 */
@RestController
@RequestMapping("/api/wrap")
@RequiredArgsConstructor
public class WrapController {

    private final WrapService wrapService;

    @GetMapping("/weekly")
    public ResponseEntity<WrapResponseDto> getWeekly(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            @RequestParam(value = "weekStart", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(value = "refresh", required = false, defaultValue = "false") boolean refresh,
            @RequestParam(value = "persona", required = false) String persona
    ) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(wrapService.getWeekly(userEmail, workspaceId, weekStart, refresh, persona));
    }

    @GetMapping("/history")
    public ResponseEntity<java.util.List<com.example.todo.dto.WrapHistoryItemDto>> getHistory(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            @RequestParam(value = "weeks", required = false, defaultValue = "12") int weeks
    ) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(wrapService.getHistory(userEmail, workspaceId, weeks));
    }

    /**
     * 셀프 메모 저장 (upsert). content 빈 문자열이면 삭제.
     * Body: { "content": "...", "weekStart": "2026-05-25" }  // weekStart 생략 시 이번 주
     */
    @PutMapping("/weekly/memo")
    public ResponseEntity<Void> saveMemo(
            Authentication authentication,
            @RequestBody Map<String, Object> body
    ) {
        String userEmail = authentication.getName();
        String content = (String) body.get("content");
        Object weekStartObj = body.get("weekStart");
        LocalDate weekStart = null;
        if (weekStartObj instanceof String s && !s.isBlank()) {
            try { weekStart = LocalDate.parse(s); } catch (Exception ignore) {}
        }
        wrapService.saveSelfMemo(userEmail, weekStart, content);
        return ResponseEntity.noContent().build();
    }
}
