package com.example.todo.controller;

import com.example.todo.dto.SearchResultDto;
import com.example.todo.exception.ApiException;
import com.example.todo.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    /**
     * 전체 검색
     *
     * GET /api/search?q={keyword}
     * Header: Authorization: Bearer {token}
     * Header: X-Workspace-Id: {workspaceId}
     *
     * @param q           검색어 (필수, 2자 이상 권장)
     * @param workspaceId 워크스페이스 ID (없으면 기본 워크스페이스 사용)
     */
    @GetMapping
    public SearchResultDto search(
            @RequestParam String q,
            /* 할 일 결과 페이지(0부터). 검색은 오래된 항목까지 찾는 기능이라 상위 N건으로
               잘라 버리면 안 된다 — 클라이언트가 '더 보기'로 이어 받는다. */
            @RequestParam(defaultValue = "0") int page,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        if (q == null || q.trim().length() < 2) {
            throw new ApiException(400, "검색어는 2자 이상 입력해주세요.");
        }
        String userEmail = authentication.getName();
        return searchService.search(userEmail, workspaceId, q.trim(), page);
    }
}
