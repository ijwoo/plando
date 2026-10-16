package com.example.todo.service;

import com.example.todo.dto.KakaoFriendDto;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class KakaoService {

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private static final String KAKAO_FRIENDS_URL = "https://kapi.kakao.com/v1/api/talk/friends";
    private static final String KAKAO_SEND_MSG_URL = "https://kapi.kakao.com/v1/api/talk/friends/message/default/send";
    /** 연동 해제 — 카카오 계정에서 우리 앱 연결을 끊는다. */
    private static final String KAKAO_UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink";

    public KakaoFriendDto.FriendListResponse getFriends(String userEmail) {
        User user = getUser(userEmail);
        String accessToken = getKakaoToken(user);

        HttpHeaders headers = bearerHeaders(accessToken);
        try {
            ResponseEntity<KakaoFriendDto.FriendListResponse> response = restTemplate.exchange(
                    KAKAO_FRIENDS_URL,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    KakaoFriendDto.FriendListResponse.class
            );
            return response.getBody();
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                throw new ApiException(401, "카카오 토큰이 만료되었습니다. 카카오 계정으로 다시 로그인해주세요.");
            }
            throw new ApiException(500, "카카오 친구 목록 조회 실패: " + e.getMessage());
        }
    }

    public void sendInvite(String userEmail, List<String> receiverUuids, Long workspaceId) {
        User user = getUser(userEmail);
        String accessToken = getKakaoToken(user);

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

        if (!workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)) {
            throw new ApiException(403, "해당 워크스페이스의 멤버만 초대할 수 있습니다.");
        }

        String inviteCode = workspace.getInviteCode();
        String inviteUrl = frontendUrl + "/#/join?code=" + inviteCode;

        String templateJson = buildTemplateJson(workspace.getName(), inviteCode, inviteUrl);
        String uuidsJson = buildUuidsJson(receiverUuids);

        HttpHeaders headers = bearerHeaders(accessToken);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("receiver_uuids", uuidsJson);
        body.add("template_object", templateJson);

        try {
            restTemplate.exchange(
                    KAKAO_SEND_MSG_URL,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    Map.class
            );
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                throw new ApiException(401, "카카오 토큰이 만료되었습니다. 카카오 계정으로 다시 로그인해주세요.");
            }
            throw new ApiException(500, "카카오 메시지 전송 실패: " + e.getMessage());
        }
    }

    private String buildTemplateJson(String workspaceName, String inviteCode, String inviteUrl) {
        try {
            Map<String, Object> link = Map.of(
                    "web_url", inviteUrl,
                    "mobile_web_url", inviteUrl
            );
            Map<String, Object> content = Map.of(
                    "title", "📋 " + workspaceName + " 팀에 초대되었어요!",
                    "description", "Plan Do! 에서 팀원과 함께 업무를 관리해보세요.\n\n초대 코드 : " + inviteCode,
                    "link", link
            );
            Map<String, Object> button = Map.of(
                    "title", "지금 참여하기",
                    "link", link
            );
            Map<String, Object> template = Map.of(
                    "object_type", "feed",
                    "content", content,
                    "buttons", List.of(button)
            );
            return objectMapper.writeValueAsString(template);
        } catch (JsonProcessingException e) {
            throw new ApiException(500, "메시지 템플릿 생성 실패");
        }
    }

    private String buildUuidsJson(List<String> uuids) {
        try {
            return objectMapper.writeValueAsString(uuids);
        } catch (JsonProcessingException e) {
            throw new ApiException(500, "UUID 직렬화 실패");
        }
    }

    private HttpHeaders bearerHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        return headers;
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
    }

    private String getKakaoToken(User user) {
        if (user.getKakaoAccessToken() == null) {
            throw new ApiException(400, "카카오 계정으로 로그인한 사용자가 아닙니다.");
        }
        return user.getKakaoAccessToken();
    }

    /**
     * 카카오 쪽 앱 연결을 실제로 끊는다(연동 해제).
     *
     * 우리 DB에서 토큰을 지우는 것만으로는 부족하다 — 카카오 계정 설정에는 우리 앱이 계속
     * 연결된 것으로 남는다. 사용자가 "연동 해제"를 눌렀으면 카카오에서도 끊겨야 한다.
     *
     * 실패해도 예외를 던지지 않는다. 호출하는 쪽은 이 호출 뒤 **우리 토큰을 지우므로**,
     * 카카오 API 가 실패해도 우리는 더 이상 그 토큰을 쓸 수 없다. 이미 만료된 토큰이면
     * 401 이 오는 게 정상이고, 그때 연동 해제 자체를 실패시킬 이유가 없다.
     *
     * @return 카카오에서도 끊겼으면 true
     */
    public boolean unlinkFromKakao(String accessToken) {
        if (accessToken == null) return false;
        try {
            restTemplate.exchange(
                    KAKAO_UNLINK_URL,
                    org.springframework.http.HttpMethod.POST,
                    new org.springframework.http.HttpEntity<>(bearerHeaders(accessToken)),
                    String.class
            );
            return true;
        } catch (Exception e) {
            log.warn("[kakao] 연결 끊기 실패(우리 토큰은 그대로 폐기한다): {}", e.getMessage());
            return false;
        }
    }
}
