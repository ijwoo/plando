package com.example.todo.controller;

import com.example.todo.dto.KakaoFriendDto;
import com.example.todo.dto.KakaoSendInviteRequest;
import com.example.todo.service.KakaoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/kakao")
@RequiredArgsConstructor
public class KakaoController {

    private final KakaoService kakaoService;

    // 카카오 친구 목록 조회
    @GetMapping("/friends")
    public ResponseEntity<KakaoFriendDto.FriendListResponse> getFriends(Authentication authentication) {
        return ResponseEntity.ok(kakaoService.getFriends(authentication.getName()));
    }

    // 선택한 친구에게 워크스페이스 초대 메시지 전송
    @PostMapping("/send-invite")
    public ResponseEntity<Void> sendInvite(
            Authentication authentication,
            @Valid @RequestBody KakaoSendInviteRequest request
    ) {
        kakaoService.sendInvite(authentication.getName(), request.getReceiverUuids(), request.getWorkspaceId());
        return ResponseEntity.ok().build();
    }
}
