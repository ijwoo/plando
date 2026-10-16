package com.example.todo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CommentCreateRequest {
    @NotNull(message = "작업 ID는 필수입니다.")
    private Long todoId;

    /*
     * comment.content 는 TEXT 라 DB 길이 제한이 없다. 즉 이 값은 컬럼 제약을 맞춘 게 아니라
     * **정책 상한**이다. 상한이 없으면 한 명이 요청 본문 크기만큼 그대로 저장해 목록 응답을
     * 통째로 무겁게 만들 수 있다. DM(2000자)과 눈높이를 맞췄고, 운영 데이터 116건의 최대
     * 길이가 46자라 지금 막히는 사용자는 없다.
     */
    @NotBlank(message = "댓글 내용을 입력해주세요.")
    @Size(max = 2000, message = "댓글은 2000자까지 쓸 수 있어요.")
    private String content;
}