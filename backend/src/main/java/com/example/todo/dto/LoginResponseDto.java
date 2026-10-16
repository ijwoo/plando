package com.example.todo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class LoginResponseDto {
    private String accessToken;
    private String name;
    private String email;
    private Long id;
    @JsonProperty("isNew")
    private boolean isNew;

    public LoginResponseDto(String accessToken, String name, String email, Long id) {
        this(accessToken, name, email, id, false);
    }
}