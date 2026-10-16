package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserDto {
    private Long id;
    private String email;
    private String name;
    private String profileImageUrl;
    private String provider;
    private boolean kakaoLinked;

    /**
     * 비밀번호가 설정된 계정인지.
     *
     * 소셜(카카오/구글/Apple)로만 가입하면 password 가 null 이다. 이때 "비밀번호 재설정 메일"을
     * 보내도 서버는 (계정 열거 방지를 위해) 조용히 아무것도 하지 않는데, 앱은 무조건
     * "메일을 보냈어요"라고 알려 사용자가 오지 않는 메일을 기다렸다. 게다가 카카오 연동 해제는
     * 비밀번호가 있어야 가능해서, 그 사용자는 연동 해제가 구조적으로 불가능했다.
     * 클라이언트가 미리 분기할 수 있도록 내려준다.
     */
    private boolean hasPassword;

    /**
     * 둘러보기(게스트) 계정인가.
     *
     * 클라이언트는 이미 `me.guest` 로 회원 전용 기능(팀모집 북마크·모집 만들기 등)을 막도록
     * 짜여 있었는데, **서버가 이 필드를 내려주지 않아 항상 undefined** 였다. 그래서 게스트가
     * 북마크를 누르면 아이콘만 잠깐 켜졌다 아무 안내 없이 되돌아가고, "모집 만들기"는 5단계
     * 위저드를 다 채운 뒤 마지막에야 403 을 만났다. 의도했던 "회원 전용" 안내는 한 번도 뜬 적이 없다.
     *
     * 판정은 서버가 이미 쓰는 이메일 기준(GuestUtils)을 그대로 따른다 — 클라이언트마다
     * 게스트 이메일 목록을 복제하면 계정이 늘 때 반드시 어긋난다.
     */
    private boolean guest;

    public UserDto(String email, String name, String profileImageUrl) {
        this.email = email;
        this.name = name;
        this.profileImageUrl = profileImageUrl;
    }

    public UserDto(String email, String name, String profileImageUrl, String provider) {
        this.email = email;
        this.name = name;
        this.profileImageUrl = profileImageUrl;
        this.provider = provider;
    }

    public UserDto(String email, String name, String profileImageUrl, String provider, boolean kakaoLinked, boolean hasPassword) {
        this.email = email;
        this.name = name;
        this.profileImageUrl = profileImageUrl;
        this.provider = provider;
        this.kakaoLinked = kakaoLinked;
        this.hasPassword = hasPassword;
        this.guest = com.example.todo.util.GuestUtils.isGuestEmail(email);
    }
}
