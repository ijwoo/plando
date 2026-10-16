package com.example.todo.controller;

import com.example.todo.dto.LinkPreviewResponse;
import com.example.todo.service.LinkPreviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 링크 미리보기(unfurl) — 메시지 등에서 URL 메타데이터 조회 */
@RestController
@RequiredArgsConstructor
public class LinkPreviewController {

    private final LinkPreviewService linkPreviewService;

    @GetMapping("/api/link-preview")
    public LinkPreviewResponse preview(@RequestParam String url) {
        return linkPreviewService.fetch(url);
    }
}
