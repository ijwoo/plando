package com.example.todo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WorkspaceJoinRequest {
    @NotBlank(message = "초대코드를 입력해주세요.")
    private String inviteCode;
}