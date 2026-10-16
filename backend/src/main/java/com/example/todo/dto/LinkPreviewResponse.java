package com.example.todo.dto;

import lombok.Builder;
import lombok.Getter;

/** 링크 미리보기(unfurl) 메타데이터 */
@Getter
@Builder
public class LinkPreviewResponse {
    private String url;
    private String title;
    private String description;
    private String image;
    private String siteName;
}
