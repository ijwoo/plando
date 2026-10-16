package com.example.todo.oauth2;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;

import java.util.Collection;
import java.util.Map;

/**
 * OAuth2 인증 성공 후 SuccessHandler에서 이메일을 꺼내기 위한 커스텀 래퍼
 */
public class CustomOAuth2User extends DefaultOAuth2User {

    private final String email;
    private final boolean isNewUser;

    public CustomOAuth2User(Collection<? extends GrantedAuthority> authorities,
                            Map<String, Object> attributes,
                            String nameAttributeKey,
                            String email,
                            boolean isNewUser) {
        super(authorities, attributes, nameAttributeKey);
        this.email = email;
        this.isNewUser = isNewUser;
    }

    public String getEmail() {
        return email;
    }

    public boolean isNewUser() {
        return isNewUser;
    }
}
