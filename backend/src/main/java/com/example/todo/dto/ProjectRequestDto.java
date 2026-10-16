package com.example.todo.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProjectRequestDto {
    @NotBlank(message = "프로젝트 이름을 입력해주세요.")
    private String name;
    private String color;
    private String icon;
}
