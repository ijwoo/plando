package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.Map;

public class LocationTriggerDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TriggerItem {
        private Boolean enabled;
        private Integer radius;
    }

    /** GET 응답 / PUT 요청 공용: { "todoId": { enabled, radius }, ... } */
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BulkRequest {
        private Map<Long, TriggerItem> triggers;
    }
}
