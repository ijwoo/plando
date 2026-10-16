package com.example.todo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TodoLocationDto {
    private Double locationLat;
    private Double locationLng;
    private String locationAddress;
    private String locationName;
}
