package com.example.todo.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum TodoStatus {
    TODO,
    IN_PROGRESS,
    DONE;

    @JsonCreator
    public static TodoStatus from(String value) {
        return TodoStatus.valueOf(value.toUpperCase());
    }

    @JsonValue
    public String getValue() {
        return this.name();
    }
}
