package com.example.todo.controller;

import com.example.todo.dto.RecruitmentAnswerDto;
import com.example.todo.dto.RecruitmentAnswerRequest;
import com.example.todo.dto.RecruitmentApplicationDto;
import com.example.todo.dto.RecruitmentCreateRequest;
import com.example.todo.dto.RecruitmentDetailResponse;
import com.example.todo.dto.RecruitmentListResponse;
import com.example.todo.dto.RecruitmentQuestionDto;
import com.example.todo.dto.RecruitmentQuestionRequest;
import com.example.todo.entity.User;
import com.example.todo.repository.UserRepository;
import com.example.todo.exception.ApiException;
import com.example.todo.service.RecruitmentQaService;
import com.example.todo.service.RecruitmentService;
import com.example.todo.util.GuestUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/recruitments")
@RequiredArgsConstructor
public class RecruitmentController {

    private final RecruitmentService recruitmentService;
    private final RecruitmentQaService recruitmentQaService;
    private final UserRepository userRepo;

    // ── 목록 ─────────────────────────────────────────────────────

    /** GET /api/recruitments
     *  - 전체 목록 (tab 파라미터로 browse/mine/applied 구분)
     *  - search 키워드 지원
     */
    @GetMapping
    public ResponseEntity<List<RecruitmentListResponse>> getList(
            @RequestParam(required = false, defaultValue = "browse") String tab,
            @RequestParam(required = false) String search,
            Authentication auth) {

        User currentUser = getUser(auth);
        List<RecruitmentListResponse> result;

        if ("mine".equals(tab)) {
            result = recruitmentService.getMyRecruitments(currentUser);
        } else if ("applied".equals(tab)) {
            result = recruitmentService.getAppliedRecruitments(currentUser);
        } else if ("bookmarked".equals(tab)) {
            result = recruitmentService.getBookmarkedRecruitments(currentUser);
        } else if (search != null && !search.isBlank()) {
            result = recruitmentService.search(search.trim(), currentUser);
        } else {
            result = recruitmentService.getList(currentUser);
        }

        return ResponseEntity.ok(result);
    }

    // ── 상세 ─────────────────────────────────────────────────────

    /** GET /api/recruitments/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<RecruitmentDetailResponse> getDetail(
            @PathVariable Long id,
            Authentication auth) {

        User currentUser = getUser(auth);
        return ResponseEntity.ok(recruitmentService.getDetail(id, currentUser));
    }

    // ── 생성 ─────────────────────────────────────────────────────

    /** POST /api/recruitments */
    @PostMapping
    public ResponseEntity<RecruitmentListResponse> create(
            @Valid @RequestBody RecruitmentCreateRequest req,
            Authentication auth) {

        User currentUser = requireUser(auth);
        GuestUtils.requireNonGuest(currentUser);
        return ResponseEntity.ok(recruitmentService.create(req, currentUser));
    }

    // ── 수정 ─────────────────────────────────────────────────────

    /** PUT /api/recruitments/{id} */
    @PutMapping("/{id}")
    public ResponseEntity<RecruitmentDetailResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody RecruitmentCreateRequest req,
            Authentication auth) {

        User currentUser = requireUser(auth);
        return ResponseEntity.ok(recruitmentService.update(id, req, currentUser));
    }

    // ── 상태 변경 ────────────────────────────────────────────────

    /** PATCH /api/recruitments/{id}/status */
    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth) {

        User currentUser = requireUser(auth);
        recruitmentService.updateStatus(id, body.get("status"), currentUser);
        return ResponseEntity.ok().build();
    }

    // ── 삭제 ─────────────────────────────────────────────────────

    /** DELETE /api/recruitments/{id} */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            Authentication auth) {

        User currentUser = requireUser(auth);
        recruitmentService.delete(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    // ── 지원 신청/취소 ────────────────────────────────────────────

    /** POST /api/recruitments/{id}/apply
     *  body: { "message": "...", "roleId": 123 }  (roleId 선택 — 신청 시에만 의미)
     */
    @PostMapping("/{id}/apply")
    public ResponseEntity<Map<String, String>> apply(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {

        User currentUser = requireUser(auth);
        GuestUtils.requireNonGuest(currentUser);
        String message = "";
        Long roleId = null;
        if (body != null) {
            Object m = body.get("message");
            if (m instanceof String s) message = s;
            Object r = body.get("roleId");
            if (r instanceof Number n) roleId = n.longValue();
        }
        String status = recruitmentService.toggleApply(id, message, roleId, currentUser);
        return ResponseEntity.ok(Map.of("status", status));
    }

    // ── 북마크 토글 ──────────────────────────────────────────────

    /** POST /api/recruitments/{id}/bookmark */
    @PostMapping("/{id}/bookmark")
    public ResponseEntity<Map<String, Boolean>> toggleBookmark(
            @PathVariable Long id,
            Authentication auth) {

        User currentUser = requireUser(auth);
        GuestUtils.requireNonGuest(currentUser);
        boolean bookmarked = recruitmentService.toggleBookmark(id, currentUser);
        return ResponseEntity.ok(Map.of("bookmarked", bookmarked));
    }

    // ── 신청자 목록 조회 ──────────────────────────────────────────

    /** GET /api/recruitments/{id}/applications */
    @GetMapping("/{id}/applications")
    public ResponseEntity<List<RecruitmentApplicationDto>> getApplications(
            @PathVariable Long id,
            Authentication auth) {

        User currentUser = requireUser(auth);
        return ResponseEntity.ok(recruitmentService.getApplications(id, currentUser));
    }

    // ── 신청 수락/거절 ────────────────────────────────────────────

    /** PATCH /api/recruitments/{id}/applications/{appId}
     *  body: { "action": "accept" | "reject" }
     */
    @PatchMapping("/{id}/applications/{appId}")
    public ResponseEntity<RecruitmentApplicationDto> reviewApplication(
            @PathVariable Long id,
            @PathVariable Long appId,
            @RequestBody Map<String, String> body,
            Authentication auth) {

        User currentUser = requireUser(auth);
        return ResponseEntity.ok(
                recruitmentService.reviewApplication(id, appId, body.get("action"), currentUser));
    }

    // ── 체크리스트 토글 ───────────────────────────────────────────

    /** PATCH /api/recruitments/{id}/checklist/{checklistId} */
    @PatchMapping("/{id}/checklist/{checklistId}")
    public ResponseEntity<Void> toggleChecklist(
            @PathVariable Long id,
            @PathVariable Long checklistId,
            Authentication auth) {

        User currentUser = requireUser(auth);
        recruitmentService.toggleChecklist(id, checklistId, currentUser);
        return ResponseEntity.ok().build();
    }

    // ── Q&A ─────────────────────────────────────────────────────

    /** GET /api/recruitments/{id}/questions
     *  공개 Q&A 목록 (핀 우선 → 최신순). 게스트 포함 누구나 조회 가능.
     */
    @GetMapping("/{id}/questions")
    public ResponseEntity<List<RecruitmentQuestionDto>> getQuestions(
            @PathVariable Long id,
            Authentication auth) {

        User currentUser = getUser(auth);
        return ResponseEntity.ok(recruitmentQaService.getQuestions(id, currentUser));
    }

    /** POST /api/recruitments/{id}/questions
     *  질문 등록. 본인 모집글에는 등록 불가, 게스트 불가.
     */
    @PostMapping("/{id}/questions")
    public ResponseEntity<RecruitmentQuestionDto> createQuestion(
            @PathVariable Long id,
            @Valid @RequestBody RecruitmentQuestionRequest req,
            Authentication auth) {

        User currentUser = requireUser(auth);
        GuestUtils.requireNonGuest(currentUser);
        return ResponseEntity.ok(recruitmentQaService.createQuestion(id, req, currentUser));
    }

    /** DELETE /api/recruitments/{id}/questions/{qId}
     *  질문 숨김 처리 (soft). asker 본인 또는 모집 작성자.
     */
    @DeleteMapping("/{id}/questions/{qId}")
    public ResponseEntity<Void> deleteQuestion(
            @PathVariable Long id,
            @PathVariable Long qId,
            Authentication auth) {

        User currentUser = requireUser(auth);
        recruitmentQaService.deleteQuestion(id, qId, currentUser);
        return ResponseEntity.noContent().build();
    }

    /** PUT /api/recruitments/{id}/questions/{qId}/answer
     *  답변 등록/수정 (upsert). 모집 작성자만.
     */
    @PutMapping("/{id}/questions/{qId}/answer")
    public ResponseEntity<RecruitmentAnswerDto> upsertAnswer(
            @PathVariable Long id,
            @PathVariable Long qId,
            @Valid @RequestBody RecruitmentAnswerRequest req,
            Authentication auth) {

        User currentUser = requireUser(auth);
        return ResponseEntity.ok(recruitmentQaService.upsertAnswer(id, qId, req, currentUser));
    }

    /** DELETE /api/recruitments/{id}/questions/{qId}/answer
     *  답변 삭제. 모집 작성자만. idempotent.
     */
    @DeleteMapping("/{id}/questions/{qId}/answer")
    public ResponseEntity<Void> deleteAnswer(
            @PathVariable Long id,
            @PathVariable Long qId,
            Authentication auth) {

        User currentUser = requireUser(auth);
        recruitmentQaService.deleteAnswer(id, qId, currentUser);
        return ResponseEntity.noContent().build();
    }

    /** PATCH /api/recruitments/{id}/questions/{qId}/pin
     *  핀 토글. body: { "pinned": true|false }. 모집 작성자만.
     */
    @PatchMapping("/{id}/questions/{qId}/pin")
    public ResponseEntity<RecruitmentQuestionDto> pinQuestion(
            @PathVariable Long id,
            @PathVariable Long qId,
            @RequestBody Map<String, Boolean> body,
            Authentication auth) {

        User currentUser = requireUser(auth);
        boolean pinned = body != null && Boolean.TRUE.equals(body.get("pinned"));
        return ResponseEntity.ok(recruitmentQaService.pinQuestion(id, qId, pinned, currentUser));
    }

    // ── 유틸 ─────────────────────────────────────────────────────

    private User getUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return null;
        String email = auth.getName();
        return userRepo.findByEmail(email).orElse(null);
    }

    private User requireUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            throw new ApiException(401, "인증이 필요합니다.");
        String email = auth.getName();
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
    }

}
