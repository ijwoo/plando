package com.example.todo.dto;

import com.example.todo.entity.Tag;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TagResponse {
    private Long id;
    private String name;
    private String color;

    public static TagResponse from(Tag t) {
        return TagResponse.builder()
                .id(t.getId())
                .name(t.getName())
                .color(t.getColor())
                .build();
    }
}
