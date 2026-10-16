package com.example.todo.oauth2;

import com.example.todo.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        CustomOAuth2User oAuth2User = (CustomOAuth2User) authentication.getPrincipal();
        String token = jwtTokenProvider.createToken(oAuth2User.getEmail());

        String platform = readAndClearPlatform(request);

        String redirectUrl;
        if ("app".equals(platform)) {
            redirectUrl = "plando://oauth?token=" + token
                    + "&isNew=" + oAuth2User.isNewUser();
        } else {
            // HashRouter 기준: /#/oauth2/callback?token=...&isNew=true/false
            redirectUrl = frontendUrl + "/#/oauth2/callback?token=" + token
                    + "&isNew=" + oAuth2User.isNewUser();
        }
        response.sendRedirect(redirectUrl);
    }

    private String readAndClearPlatform(HttpServletRequest request) {
        if (request.getSession(false) == null) return null;
        Object attr = request.getSession().getAttribute("oauth_platform");
        request.getSession().removeAttribute("oauth_platform");
        return attr == null ? null : attr.toString();
    }
}
