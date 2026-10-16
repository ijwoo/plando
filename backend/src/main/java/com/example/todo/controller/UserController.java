package com.example.todo.controller;

import com.example.todo.dto.UserDto;
import com.example.todo.dto.UserQaStatsDto;
import com.example.todo.service.RecruitmentQaService;
import com.example.todo.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final RecruitmentQaService recruitmentQaService;

    @GetMapping("/me")
    public ResponseEntity<?> getMe(Authentication authentication) {
        String userEmail = authentication.getName();
        UserDto user = userService.getMe(userEmail);
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/me/link-kakao")
    public ResponseEntity<?> unlinkKakao(Authentication authentication) {
        userService.unlinkKakao(authentication.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public List<UserDto> getWorkspaceUsers(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return userService.getUsersByWorkspace(userEmail, workspaceId);
    }

    /** 작성자 Q&A 응답 신뢰도 통계 — public (비로그인 OK). 프론트 사이드바 한 줄 라인용. */
    @GetMapping("/{userId}/qa-stats")
    public ResponseEntity<UserQaStatsDto> getUserQaStats(@PathVariable Long userId) {
        return ResponseEntity.ok(recruitmentQaService.getUserQaStats(userId));
    }

    @PostMapping("/me/profile-image")
    public ResponseEntity<?> uploadProfileImage(
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        try {
            String userEmail = authentication.getName();
            String url = userService.uploadProfileImage(userEmail, file);
            return ResponseEntity.ok(Map.of("profileImageUrl", url));
        } catch (Exception e) {
            log.error("프로필 이미지 업로드 실패: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}