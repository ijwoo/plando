package com.example.todo.config;

import com.example.todo.entity.DmRoom;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.DmRoomRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import org.springframework.beans.factory.annotation.Value;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenProvider jwtTokenProvider;
    private final DmRoomRepository dmRoomRepository;
    private final UserRepository userRepository;
    private final com.example.todo.repository.WorkspaceRepository workspaceRepository;
    private final com.example.todo.repository.WorkspaceMemberRepository workspaceMemberRepository;

    /** "/topic/workspace/{id}/todos" 에서 {id} 추출. 형식이 다르면 null. */
    private static Long parseWorkspaceId(String dest) {
        String rest = dest.substring(WORKSPACE_TOPIC_PREFIX.length());
        int slash = rest.indexOf('/');
        if (slash <= 0) return null;
        try {
            return Long.parseLong(rest.substring(0, slash));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 서버가 실제로 publish 하는 DM 목적지 접두사 (DmService.convertAndSend와 일치) */
    private static final String DM_TOPIC_PREFIX = "/topic/dm/";
    /** 워크스페이스 단위 브로드캐스트 접두사 — /topic/workspace/{id}/todos (TodoEventPublisher와 일치) */
    private static final String WORKSPACE_TOPIC_PREFIX = "/topic/workspace/";

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/user", "/topic");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .collect(java.util.stream.Collectors.toList());
        origins.add("http://localhost:*");
        origins.add("http://127.0.0.1:*");
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins.toArray(new String[0]));
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) return message;

                /* SUBSCRIBE 인가.
                   예전엔 CONNECT에서 JWT만 검증하고 SUBSCRIBE는 무검사였다. 그래서 로그인한
                   사용자라면 누구나 /topic/dm/{임의 roomId}를 구독해 남의 대화 본문·첨부 URL·
                   읽음 정보를 실시간으로 받아볼 수 있었다(roomId가 순차 정수라 전수 구독도 가능).
                   REST 경로는 전부 DmService.validateParticipant로 막혀 있는데 WS만 뚫려 있었다. */
                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    String dest = accessor.getDestination();
                    if (dest != null && dest.startsWith(DM_TOPIC_PREFIX)) {
                        if (accessor.getUser() == null) {
                            throw new org.springframework.messaging.MessageDeliveryException("인증이 필요합니다.");
                        }
                        Long roomId;
                        try {
                            roomId = Long.parseLong(dest.substring(DM_TOPIC_PREFIX.length()));
                        } catch (NumberFormatException e) {
                            throw new org.springframework.messaging.MessageDeliveryException("잘못된 구독 대상입니다.");
                        }
                        String email = accessor.getUser().getName();
                        User user = userRepository.findActiveByEmail(email).orElse(null);
                        DmRoom room = dmRoomRepository.findById(roomId).orElse(null);
                        boolean allowed = user != null && room != null
                                && room.getParticipants().stream().anyMatch(u -> u.getId().equals(user.getId()));
                        if (!allowed) {
                            throw new org.springframework.messaging.MessageDeliveryException("채팅방 참여자가 아닙니다.");
                        }
                    }
                    /* 워크스페이스 토픽 인가.
                       DM과 같은 이유다 — 구독을 막지 않으면 남의 워크스페이스 할 일 변경이
                       그대로 흘러들어간다. 멤버가 아니면 구독을 거절한다. */
                    if (dest != null && dest.startsWith(WORKSPACE_TOPIC_PREFIX)) {
                        if (accessor.getUser() == null) {
                            throw new org.springframework.messaging.MessageDeliveryException("인증이 필요합니다.");
                        }
                        Long wsId = parseWorkspaceId(dest);
                        if (wsId == null) {
                            throw new org.springframework.messaging.MessageDeliveryException("잘못된 구독 대상입니다.");
                        }
                        String email = accessor.getUser().getName();
                        User user = userRepository.findActiveByEmail(email).orElse(null);
                        Workspace ws = workspaceRepository.findById(wsId).orElse(null);
                        boolean allowed = user != null && ws != null
                                && workspaceMemberRepository.existsByWorkspaceAndUser(ws, user);
                        if (!allowed) {
                            throw new org.springframework.messaging.MessageDeliveryException("워크스페이스 멤버가 아닙니다.");
                        }
                    }

                    return message;
                }

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String token = accessor.getFirstNativeHeader("Authorization");
                    if (token != null && token.startsWith("Bearer ")) {
                        token = token.substring(7);
                        if (jwtTokenProvider.validateToken(token)) {
                            String email = jwtTokenProvider.getEmailFromToken(token);
                            // /ws/** 는 permitAll 이라 이 인터셉터가 유일한 관문이다.
                            // 탈퇴 계정이 남은 토큰으로 접속해 프레즌스에 등록되면 안 된다.
                            if (!userRepository.existsActiveByEmail(email)) {
                                throw new org.springframework.messaging.MessageDeliveryException("사용할 수 없는 계정입니다.");
                            }
                            UsernamePasswordAuthenticationToken auth =
                                    new UsernamePasswordAuthenticationToken(
                                            email, null,
                                            List.of(new SimpleGrantedAuthority("ROLE_USER")));
                            accessor.setUser(auth);
                        } else {
                            throw new org.springframework.messaging.MessageDeliveryException("유효하지 않은 토큰입니다.");
                        }
                    } else {
                        throw new org.springframework.messaging.MessageDeliveryException("인증 토큰이 필요합니다.");
                    }
                }
                return message;
            }
        });
    }
}
