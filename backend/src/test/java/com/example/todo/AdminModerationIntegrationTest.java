package com.example.todo;

import com.example.todo.entity.AdminAuditLog;
import com.example.todo.entity.ContentReport;
import com.example.todo.entity.Recruitment;
import com.example.todo.entity.User;
import com.example.todo.repository.AdminAuditLogRepository;
import com.example.todo.repository.ContentReportRepository;
import com.example.todo.repository.RecruitmentRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.security.JwtTokenProvider;
import com.example.todo.security.Totp;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 신고·차단·백오피스를 HTTP 경계에서 고정한다.
 *
 * 관리자 기능은 "권한이 새는가"가 전부라, 막혀야 하는 경로를 열리는 경로보다 많이 본다.
 */
class AdminModerationIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired UserRepository userRepository;
    @Autowired RecruitmentRepository recruitmentRepository;
    @Autowired ContentReportRepository reportRepository;
    @Autowired AdminAuditLogRepository auditRepository;
    @Autowired JwtTokenProvider jwtTokenProvider;

    // ── 픽스처 ──────────────────────────────────────────────────

    private Recruitment recruitment(User author, String title) {
        return recruitmentRepository.save(Recruitment.builder()
                .title(title).summary("요약").category("study").status("모집중").author(author).build());
    }

    /** ADMIN + OTP 등록까지 마친 관리자. 비밀값은 테스트가 코드를 만들 수 있게 직접 심는다. */
    private User admin(String secret) {
        User u = fx.user("admin");
        u.setSystemRole("ADMIN");
        u.setAdminTotpSecret(secret);
        u.setAdminTotpEnabledAt(LocalDateTime.now());
        return userRepository.save(u);
    }

    private String adminToken(User admin) {
        return jwtTokenProvider.createAdminToken(admin.getEmail());
    }

    private ResultActions asAdmin(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, User admin) throws Exception {
        return mvc.perform(req.header(HttpHeaders.AUTHORIZATION, fx.bearer(admin))
                .header("X-Admin-Token", adminToken(admin)));
    }

    private ResultActions report(User reporter, String type, Long id, String reason, String detail) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>(Map.of("targetType", type, "targetId", id, "reason", reason));
        if (detail != null) body.put("detail", detail);
        return mvc.perform(post("/api/reports")
                .header(HttpHeaders.AUTHORIZATION, fx.bearer(reporter))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)));
    }

    private String body(Object o) throws Exception {
        return json.writeValueAsString(o);
    }

    // ── TOTP ────────────────────────────────────────────────────

    @Test
    @DisplayName("TOTP 계산이 RFC 6238 테스트 벡터와 같다")
    void totpMatchesRfcVector() {
        /* RFC 6238 부록 B: 비밀값 "12345678901234567890"(ASCII), T=59초 → 8자리 94287082.
           6자리는 끝 여섯 자리 287082. OTP 앱과 계산이 어긋나면 관리자가 영영 못 들어온다. */
        String secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // gitleaks:allow — RFC 6238 공개 테스트 벡터
        assertThat(Totp.code(secret, 59 / 30)).isEqualTo("287082");
    }

    // ── 관리자 접근 경계 ────────────────────────────────────────

    @Test
    @DisplayName("일반 사용자에게 관리자 API 는 없는 것처럼 404 다 (인증 단계 포함)")
    void nonAdminSeesNotFound() throws Exception {
        User user = fx.user("user");
        mvc.perform(get("/api/admin/stats").header(HttpHeaders.AUTHORIZATION, fx.bearer(user)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/auth/status").header(HttpHeaders.AUTHORIZATION, fx.bearer(user)))
                .andExpect(status().isNotFound());
        // 남의 관리자 토큰을 들고 와도 마찬가지 — 확인은 DB 역할부터 한다
        User admin = admin(Totp.newSecret());
        mvc.perform(get("/api/admin/stats")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(user))
                        .header("X-Admin-Token", adminToken(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("관리자도 OTP 토큰 없이는 403 + ADMIN_STEP_UP, 일반 JWT 를 관리자 토큰 자리에 넣어도 403")
    void adminNeedsStepUpToken() throws Exception {
        User admin = admin(Totp.newSecret());
        mvc.perform(get("/api/admin/stats").header(HttpHeaders.AUTHORIZATION, fx.bearer(admin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_STEP_UP"));
        mvc.perform(get("/api/admin/stats")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(admin))
                        .header("X-Admin-Token", fx.bearer(admin).substring(7)))
                .andExpect(status().isForbidden());
        // 다른 관리자의 토큰도 안 된다 — 토큰 주인과 로그인한 사람이 같아야 한다
        User other = admin(Totp.newSecret());
        mvc.perform(get("/api/admin/stats")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(admin))
                        .header("X-Admin-Token", adminToken(other)))
                .andExpect(status().isForbidden());

        asAdmin(get("/api/admin/stats"), admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.aiCallsDaily.length()").value(14));
    }

    @Test
    @DisplayName("관리자 토큰은 일반 Bearer 로 쓸 수 없다 (서명 키가 다르다)")
    void adminTokenIsNotABearer() throws Exception {
        User admin = admin(Totp.newSecret());
        // 인증이 서지 않으면 이 앱은 OAuth 로그인으로 302 를 보낸다 — 어쨌든 API 는 열리지 않는다
        int code = mvc.perform(get("/api/blocks").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken(admin)))
                .andReturn().getResponse().getStatus();
        assertThat(code).isNotEqualTo(200).isIn(302, 401, 403);
    }

    @Test
    @DisplayName("권한을 내리면 이미 받은 관리자 토큰도 바로 막힌다")
    void demotionTakesEffectImmediately() throws Exception {
        User admin = admin(Totp.newSecret());
        String token = adminToken(admin);
        admin.setSystemRole("USER");
        userRepository.save(admin);
        mvc.perform(get("/api/admin/stats")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(admin))
                        .header("X-Admin-Token", token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("OTP 등록 → 확인 → 같은 코드 재사용은 거절, 등록 후 재등록 불가")
    void enrollAndVerifyFlow() throws Exception {
        User u = fx.user("newadmin");
        u.setSystemRole("ADMIN");
        userRepository.save(u);
        String bearer = fx.bearer(u);

        mvc.perform(get("/api/admin/auth/status").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enrolled").value(false));

        JsonNode start = json.readTree(mvc.perform(post("/api/admin/auth/enroll").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String secret = start.get("secret").asText();
        assertThat(start.get("otpauthUri").asText()).startsWith("otpauth://totp/").contains("secret=" + secret);

        mvc.perform(post("/api/admin/auth/enroll/confirm").header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("code", "000000"))))
                .andExpect(status().isBadRequest());

        String code = Totp.code(secret, Totp.currentStep());
        JsonNode tok = json.readTree(mvc.perform(post("/api/admin/auth/enroll/confirm").header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("code", code))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(jwtTokenProvider.getAdminEmail(tok.get("token").asText())).isEqualTo(u.getEmail());

        // 방금 쓴 코드로 다시 들어오려 하면 거절 — 엿본 코드를 30초 안에 재사용하는 공격
        mvc.perform(post("/api/admin/auth/verify").header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("code", code))))
                .andExpect(status().isBadRequest());

        // 등록을 마친 뒤 새 비밀값을 받는 건 막힌다 — 덮어쓰기는 탈취와 같다
        mvc.perform(post("/api/admin/auth/enroll").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isConflict());

        assertThat(auditRepository.findAll()).extracting(AdminAuditLog::getAction).contains("TOTP_ENROLLED");
    }

    // ── 신고 ────────────────────────────────────────────────────

    @Test
    @DisplayName("신고: 접수 201, 같은 대상 중복 409, 내 글 400, 기타 사유는 내용 필수")
    void reportRules() throws Exception {
        User author = fx.user("author");
        User reporter = fx.user("reporter");
        Recruitment r = recruitment(author, "모집");

        report(reporter, "RECRUITMENT", r.getId(), "OTHER", null).andExpect(status().isBadRequest());
        report(reporter, "RECRUITMENT", r.getId(), "SPAM", null).andExpect(status().isCreated());
        report(reporter, "RECRUITMENT", r.getId(), "ABUSE", null).andExpect(status().isConflict());
        report(author, "RECRUITMENT", r.getId(), "SPAM", null).andExpect(status().isBadRequest());
        report(reporter, "USER", author.getId(), "ABUSE", null).andExpect(status().isCreated());
        report(reporter, "NOPE", r.getId(), "SPAM", null).andExpect(status().isBadRequest());

        ContentReport saved = reportRepository.findAll().stream()
                .filter(x -> x.getTargetType() == ContentReport.TargetType.RECRUITMENT).findFirst().orElseThrow();
        assertThat(saved.getTargetUserId()).isEqualTo(author.getId());
        // 신고만으로는 아무것도 숨기지 않는다 — 몰려와서 지우는 걸 막으려고
        assertThat(recruitmentRepository.findById(r.getId()).orElseThrow().getHiddenAt()).isNull();
    }

    @Test
    @DisplayName("신고 처리(숨김): 같은 대상의 대기 신고가 한꺼번에 닫히고, 사유 없으면 400, 감사 로그가 남는다")
    void resolveHidesAndClosesSiblings() throws Exception {
        User admin = admin(Totp.newSecret());
        User author = fx.user("author");
        Recruitment r = recruitment(author, "문제 글");
        report(fx.user("a"), "RECRUITMENT", r.getId(), "SPAM", null).andExpect(status().isCreated());
        report(fx.user("b"), "RECRUITMENT", r.getId(), "ABUSE", null).andExpect(status().isCreated());
        Long reportId = reportRepository.findAll().get(0).getId();

        asAdmin(post("/api/admin/reports/" + reportId + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("action", "HIDE_CONTENT", "note", " "))), admin)
                .andExpect(status().isBadRequest());

        asAdmin(post("/api/admin/reports/" + reportId + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("action", "HIDE_CONTENT", "note", "광고성 글"))), admin)
                .andExpect(status().isNoContent());

        assertThat(recruitmentRepository.findById(r.getId()).orElseThrow().getHiddenAt()).isNotNull();
        assertThat(reportRepository.findAll()).allSatisfy(x -> {
            assertThat(x.getStatus()).isEqualTo(ContentReport.Status.RESOLVED);
            assertThat(x.getHandledBy()).isEqualTo(admin.getId());
        });
        assertThat(auditRepository.findAll()).anySatisfy(a -> {
            assertThat(a.getAction()).isEqualTo("CONTENT_HIDDEN");
            assertThat(a.getTargetId()).isEqualTo(r.getId());
            assertThat(a.getReason()).isEqualTo("광고성 글");
        });

        // 이미 처리한 신고를 다시 처리하면 409
        asAdmin(post("/api/admin/reports/" + reportId + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("action", "DISMISS", "note", "다시"))), admin)
                .andExpect(status().isConflict());
    }

    // ── 숨김·차단이 실제 화면(목록·상세)에 반영되는가 ─────────────

    @Test
    @DisplayName("숨긴 모집글: 목록·검색에서 빠지고, 남에게 상세·지원은 404, 작성자 본인에게는 열린다")
    void hiddenRecruitmentIsGoneForOthers() throws Exception {
        User author = fx.user("author");
        User viewer = fx.user("viewer");
        Recruitment r = recruitment(author, "숨길글");
        r.setHiddenAt(LocalDateTime.now());
        recruitmentRepository.save(r);

        mvc.perform(get("/api/recruitments").header(HttpHeaders.AUTHORIZATION, fx.bearer(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + r.getId() + ")]").isEmpty());
        mvc.perform(get("/api/recruitments").param("search", "숨길글").header(HttpHeaders.AUTHORIZATION, fx.bearer(viewer)))
                .andExpect(jsonPath("$[?(@.id == " + r.getId() + ")]").isEmpty());
        mvc.perform(get("/api/recruitments/" + r.getId()).header(HttpHeaders.AUTHORIZATION, fx.bearer(viewer)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/recruitments/" + r.getId()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/recruitments/" + r.getId() + "/bookmark").header(HttpHeaders.AUTHORIZATION, fx.bearer(viewer)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/recruitments/" + r.getId()).header(HttpHeaders.AUTHORIZATION, fx.bearer(author)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("차단: 차단한 사람의 모집글이 내 목록에서만 빠진다 (남에게는 그대로)")
    void blockHidesOnlyForBlocker() throws Exception {
        User author = fx.user("author");
        User blocker = fx.user("blocker");
        User other = fx.user("other");
        Recruitment r = recruitment(author, "차단 대상 글");

        mvc.perform(post("/api/blocks/" + author.getId()).header(HttpHeaders.AUTHORIZATION, fx.bearer(blocker)))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/blocks/" + blocker.getId()).header(HttpHeaders.AUTHORIZATION, fx.bearer(blocker)))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/recruitments").header(HttpHeaders.AUTHORIZATION, fx.bearer(blocker)))
                .andExpect(jsonPath("$[?(@.id == " + r.getId() + ")]").isEmpty());
        mvc.perform(get("/api/recruitments").header(HttpHeaders.AUTHORIZATION, fx.bearer(other)))
                .andExpect(jsonPath("$[?(@.id == " + r.getId() + ")]").isNotEmpty());
        mvc.perform(get("/api/blocks").header(HttpHeaders.AUTHORIZATION, fx.bearer(blocker)))
                .andExpect(jsonPath("$[0].id").value(author.getId()));

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/api/blocks/" + author.getId()).header(HttpHeaders.AUTHORIZATION, fx.bearer(blocker)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/recruitments").header(HttpHeaders.AUTHORIZATION, fx.bearer(blocker)))
                .andExpect(jsonPath("$[?(@.id == " + r.getId() + ")]").isNotEmpty());
    }

    // ── 정지 ────────────────────────────────────────────────────

    @Test
    @DisplayName("정지: 이미 받은 토큰도 403 SUSPENDED, 로그인도 403, 관리자는 정지할 수 없다, 해제하면 돌아온다")
    void suspension() throws Exception {
        User admin = admin(Totp.newSecret());
        User target = fx.user("target");

        asAdmin(post("/api/admin/users/" + target.getId() + "/suspend").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("reason", "반복 스팸"))), admin).andExpect(status().isNoContent());

        mvc.perform(get("/api/blocks").header(HttpHeaders.AUTHORIZATION, fx.bearer(target)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SUSPENDED"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("email", target.getEmail(), "password", "password123"))))
                .andExpect(status().isForbidden());
        // 틀린 비밀번호에는 정지 여부를 알려 주지 않는다
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("email", target.getEmail(), "password", "wrong-password"))))
                .andExpect(status().isUnauthorized());

        User otherAdmin = admin(Totp.newSecret());
        asAdmin(post("/api/admin/users/" + otherAdmin.getId() + "/suspend").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("reason", "시험"))), admin).andExpect(status().isForbidden());

        asAdmin(post("/api/admin/users/" + target.getId() + "/unsuspend").contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("reason", "소명 확인"))), admin).andExpect(status().isNoContent());
        mvc.perform(get("/api/blocks").header(HttpHeaders.AUTHORIZATION, fx.bearer(target)))
                .andExpect(status().isOk());

        assertThat(auditRepository.findAll()).extracting(AdminAuditLog::getAction)
                .contains("USER_SUSPENDED", "USER_UNSUSPENDED");
    }

    @Test
    @DisplayName("백오피스 목록: 신고·사용자·감사 로그가 페이지로 나온다")
    void adminLists() throws Exception {
        User admin = admin(Totp.newSecret());
        User author = fx.user("listauthor");
        Recruitment r = recruitment(author, "목록 확인");
        report(fx.user("r1"), "RECRUITMENT", r.getId(), "SPAM", null).andExpect(status().isCreated());

        asAdmin(get("/api/admin/reports"), admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].target.title").value("목록 확인"))
                .andExpect(jsonPath("$.items[0].target.authorEmail").value(author.getEmail()))
                .andExpect(jsonPath("$.items[0].sameTargetCount").value(1));
        asAdmin(get("/api/admin/users").param("q", "listauthor"), admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].email").value(author.getEmail()))
                .andExpect(jsonPath("$.items[0].reportCount").value(1));
        asAdmin(get("/api/admin/audit-logs"), admin).andExpect(status().isOk());
    }

    @Test
    @DisplayName("개요: 게스트·샘플을 빼고 세고, 최근 활동 워크스페이스가 맨 위에 온다")
    void overviewCountsRealUsageOnly() throws Exception {
        User admin = admin(Totp.newSecret());
        User owner = fx.user("ovowner");
        User mate = fx.user("ovmate");
        com.example.todo.entity.Workspace ws = fx.workspace("개요 확인 팀", owner);
        fx.member(ws, mate, com.example.todo.entity.WorkspaceRole.MEMBER);
        fx.todo(ws, owner, "진짜 할 일");
        fx.sampleTodo(ws, owner, "샘플 할 일");

        asAdmin(get("/api/admin/overview").param("days", "7"), admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(7))
                .andExpect(jsonPath("$.daily.length()").value(7))
                .andExpect(jsonPath("$.teamSizes.length()").value(3))
                .andExpect(jsonPath("$.recentWorkspaces[0].name").value("개요 확인 팀"))
                .andExpect(jsonPath("$.recentWorkspaces[0].members").value(2))
                .andExpect(jsonPath("$.recentWorkspaces[0].todos").value(1))
                .andExpect(jsonPath("$.recentWorkspaces[0].ownerEmail").value(owner.getEmail()));

        // 그 밖의 기간 값은 30일로
        asAdmin(get("/api/admin/overview").param("days", "999"), admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(30))
                .andExpect(jsonPath("$.daily.length()").value(30));
    }

    @Test
    @DisplayName("개요: 관리자 토큰 없이는 열리지 않는다")
    void overviewNeedsStepUp() throws Exception {
        User admin = admin(Totp.newSecret());
        mvc.perform(get("/api/admin/overview").header(HttpHeaders.AUTHORIZATION, fx.bearer(admin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_STEP_UP"));
    }
}
