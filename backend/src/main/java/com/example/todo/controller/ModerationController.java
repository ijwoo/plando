package com.example.todo.controller;

import com.example.todo.dto.admin.AdminDtos.BlockedUser;
import com.example.todo.dto.admin.AdminDtos.ReportRequest;
import com.example.todo.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 사용자 쪽 신고·차단. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ModerationController {

    private final ModerationService moderationService;

    /** POST /api/reports — 모집글·Q&A·사용자 신고 */
    @PostMapping("/reports")
    public ResponseEntity<Void> report(@RequestBody ReportRequest req, Authentication auth) {
        moderationService.report(auth.getName(), req);
        return ResponseEntity.status(201).build();
    }

    @GetMapping("/blocks")
    public List<BlockedUser> blocked(Authentication auth) {
        return moderationService.blocked(auth.getName());
    }

    @PostMapping("/blocks/{userId}")
    public ResponseEntity<Void> block(@PathVariable Long userId, Authentication auth) {
        moderationService.block(auth.getName(), userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/blocks/{userId}")
    public ResponseEntity<Void> unblock(@PathVariable Long userId, Authentication auth) {
        moderationService.unblock(auth.getName(), userId);
        return ResponseEntity.noContent().build();
    }
}
