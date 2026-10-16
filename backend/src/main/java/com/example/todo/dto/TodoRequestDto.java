package com.example.todo.dto;

import com.example.todo.entity.Priority;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class TodoRequestDto {
    // title 컬럼은 varchar(255). DTO 에 길이 제한이 없어서 넘치면 DB 오류가 그대로 올라왔다.
    @NotBlank(message = "제목을 입력해주세요.")
    @Size(max = 255, message = "제목은 255자 이하로 입력해주세요.")
    private String title;
    private String content;
    @NotBlank(message = "상태값은 필수입니다.")
    private String status;
    private Priority priority;
    private LocalDate startAt;
    private LocalDate dueDate;
    private java.time.LocalTime startTime;
    private java.time.LocalTime endTime;
    /** 소속 프로젝트 — null = 인박스 */
    private Long projectId;
    /** 부모 할 일 ID — null = 최상위. 서브태스크(1단계)만 허용 */
    /** 오프라인 재전송 중복 방지 열쇠(선택). 같은 값이 이미 있으면 서버가 있던 것을 돌려준다. */
    private String clientKey;

    private Long parentId;
    private List<String> assignees;
    private Double locationLat;
    private Double locationLng;
    private String locationAddress;
    private String locationName;
}
