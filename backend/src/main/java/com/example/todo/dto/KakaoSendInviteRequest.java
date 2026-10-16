package com.example.todo.dto;

import lombok.Getter;

import java.util.List;

@Getter
public class KakaoSendInviteRequest {
    private List<String> receiverUuids; // 친구의 uuid 목록
    private Long workspaceId;
}
