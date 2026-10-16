package com.example.todo.controller;

import com.example.todo.dto.UserSettingsResponse;
import com.example.todo.dto.UserSettingsUpdateRequest;
import com.example.todo.entity.User;
import com.example.todo.service.UserService;
import com.example.todo.service.UserSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class UserSettingsController {

    private final UserSettingsService userSettingsService;
    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserSettingsResponse> getMySettings(Authentication authentication) {
        Long userId = getCurrentUserId(authentication);
        return ResponseEntity.ok(userSettingsService.getMySettings(userId));
    }

    @PutMapping("/me")
    public ResponseEntity<UserSettingsResponse> updateMySettings(
            @Valid @RequestBody UserSettingsUpdateRequest request,
            Authentication authentication
    ) {
        Long userId = getCurrentUserId(authentication);
        return ResponseEntity.ok(userSettingsService.updateMySettings(userId, request));
    }

    private Long getCurrentUserId(Authentication authentication) {
        String email = authentication.getName();
        User user = userService.findByEmail(email);
        return user.getId();
    }
}