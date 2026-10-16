package com.example.todo.oauth2;

import com.example.todo.entity.*;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.example.todo.service.UserSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Optional;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserSettingsService userSettingsService;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        String nameAttributeKey = userRequest.getClientRegistration()
                .getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName();

        OAuth2UserInfo userInfo = resolveUserInfo(registrationId, oAuth2User);

        String kakaoAccessToken = null;
        String kakaoRefreshToken = null;
        if ("kakao".equalsIgnoreCase(registrationId)) {
            kakaoAccessToken = userRequest.getAccessToken().getTokenValue();
            Object additionalParams = userRequest.getAdditionalParameters().get("refresh_token");
            if (additionalParams != null) {
                kakaoRefreshToken = additionalParams.toString();
            }
        }

        boolean isNewUser = saveOrUpdate(userInfo, registrationId, kakaoAccessToken, kakaoRefreshToken);

        String email = userInfo.getEmail() != null
                ? userInfo.getEmail()
                : registrationId.toLowerCase() + "_" + userInfo.getProviderId() + "@oauth.placeholder";

        return new CustomOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                oAuth2User.getAttributes(),
                nameAttributeKey,
                email,
                isNewUser
        );
    }

    private OAuth2UserInfo resolveUserInfo(String registrationId, OAuth2User oAuth2User) {
        return switch (registrationId.toLowerCase()) {
            case "google" -> new GoogleOAuth2UserInfo(oAuth2User.getAttributes());
            case "kakao"  -> new KakaoOAuth2UserInfo(oAuth2User.getAttributes());
            default -> throw new OAuth2AuthenticationException("지원하지 않는 OAuth2 제공자: " + registrationId);
        };
    }

    private boolean saveOrUpdate(OAuth2UserInfo userInfo, String registrationId,
                                  String kakaoAccessToken, String kakaoRefreshToken) {
        OAuthProvider provider = OAuthProvider.valueOf(registrationId.toUpperCase());

        // 1) providerId로 기존 연동 유저 조회 (provider 무관 - LOCAL 연동 계정도 포함)
        // 탈퇴 계정은 되살리지 않는다. 탈퇴 시 provider_id 를 NULL 로 만들므로 보통 걸리지 않지만,
        // 익명화가 부분 실패하거나 새 소셜 제공자가 추가돼도 안전하도록 명시적으로 건다.
        Optional<User> byProviderId = userRepository.findByProviderId(userInfo.getProviderId())
                .filter(u -> !u.isDeleted());
        if (byProviderId.isPresent()) {
            User user = byProviderId.get();
            // 카카오 이름 동의 거부 시 null이 올 수 있으므로 null이 아닐 때만 업데이트
            if (userInfo.getName() != null) {
                user.setName(userInfo.getName());
            }
            // 사용자가 직접 업로드한 이미지(/uploads/)는 덮어쓰지 않음
            String currentImage = user.getProfileImageUrl();
            if (currentImage == null || !currentImage.startsWith("/uploads/")) {
                user.setProfileImageUrl(userInfo.getProfileImageUrl());
            }
            if (kakaoAccessToken != null) {
                user.setKakaoAccessToken(kakaoAccessToken);
                user.setKakaoRefreshToken(kakaoRefreshToken);
            }
            userRepository.save(user);
            return false; // 기존 유저
        }

        // 2) 같은 이메일로 가입된 일반 계정이 있으면 연동 (provider는 유지, providerId만 추가)
        String email = userInfo.getEmail();
        if (email != null) {
            Optional<User> byEmail = userRepository.findActiveByEmail(email);
            if (byEmail.isPresent()) {
                User user = byEmail.get();
                user.setProviderId(userInfo.getProviderId()); // provider(LOCAL)는 유지 → 이메일 로그인도 계속 가능
                String currentImage = user.getProfileImageUrl();
                if (currentImage == null || !currentImage.startsWith("/uploads/")) {
                    user.setProfileImageUrl(userInfo.getProfileImageUrl());
                }
                if (kakaoAccessToken != null) {
                    user.setKakaoAccessToken(kakaoAccessToken);
                    user.setKakaoRefreshToken(kakaoRefreshToken);
                }
                userRepository.save(user);
                return false; // 기존 유저 (연동)
            }
        }

        // 3) 신규 유저 생성 (워크스페이스는 프론트 콜백에서 처리)
        String fallbackEmail = email != null
                ? email
                : registrationId.toLowerCase() + "_" + userInfo.getProviderId() + "@oauth.placeholder";
        // 카카오 이름 동의 거부 시 null — 이메일 앞부분으로 대체
        String resolvedName = userInfo.getName() != null
                ? userInfo.getName()
                : fallbackEmail.contains("@") ? fallbackEmail.split("@")[0] : "사용자";
        User newUser = userRepository.save(User.builder()
                .email(fallbackEmail)
                .name(resolvedName)
                .profileImageUrl(userInfo.getProfileImageUrl())
                .provider(provider)
                .providerId(userInfo.getProviderId())
                .password(null)
                .kakaoAccessToken(kakaoAccessToken)
                .kakaoRefreshToken(kakaoRefreshToken)
                // 카카오·구글이 이미 검증한 이메일이므로 인증 절차를 면제한다.
                .emailVerifiedAt(java.time.LocalDateTime.now())
                .build());

        userSettingsService.createDefaultSettings(newUser);
        return true; // 신규 유저
    }
}
