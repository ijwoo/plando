# Plan Do!

할 일·캘린더·팀 협업·메시지·AI 에이전트·위치 알림을 한 앱에 묶은 생산성 앱입니다. 기획부터 App Store 출시까지 1인으로 만들고 운영하고 있습니다.

- 서비스: https://plando.imjaewoo.dev
- 프로젝트 소개: https://imjaewoo.dev/work/plando

> 이 저장소는 비공개로 운영 중인 작업 저장소 세 개(백엔드·웹·iOS 앱)의 공개용 스냅샷입니다.
> 실제 설정 파일, 비밀값, 서버·배포 관련 스크립트와 문서, 내부 작업 문서, 사용자 업로드 파일, 빌드 산출물은 제외했고,
> 커밋 이력도 이 스냅샷 하나만 남겼습니다. 설정은 각 폴더의 예시 파일(아래 [로컬 실행](#로컬-실행))을 참고해 주세요.

## 구조

```
plando/
├── backend/   Spring Boot API 서버 (REST + STOMP WebSocket, AI 에이전트, 알림·예약 작업)
├── web/       React 19 SPA · PWA (Capacitor iOS/Android 래퍼와 Electron 데스크톱 셸 포함)
└── mobile/    React Native · Expo iOS 앱 (홈 화면 위젯, Live Activity, 공유 확장 포함)
```

웹과 iOS 앱은 같은 백엔드 API를 씁니다. 웹은 처음 PWA로 시작해 iOS를 Capacitor로 감쌌고, 이후 모바일만 React Native로 다시 작성했습니다. 이 과정에서 백엔드는 그대로 두었습니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 백엔드 | Java 17, Spring Boot 3.5, Spring Security(JWT, Google·Kakao OAuth2, Sign in with Apple), Spring Data JPA, Spring WebSocket(STOMP), Spring AI(OpenAI) |
| DB | PostgreSQL (테스트는 H2 PostgreSQL 호환 모드) |
| 웹 | React 19, Vite 6, MUI 7, React Router 7, STOMP.js, Capacitor, Electron |
| iOS 앱 | React Native 0.85, Expo SDK 56, Expo Router, TanStack Query, Zustand, TypeScript |
| 네이티브 확장 | Swift — 홈 화면 위젯, Live Activity, Spotlight, 공유 확장 (`mobile/modules`, `mobile/targets`) |
| 알림 | APNs(Pushy), Web Push(VAPID), 메일(SMTP) |
| 관측 | Sentry (백엔드·웹·앱) |

## 주요 기능

- **할 일·캘린더** — 반복 일정, 체크리스트·하위 할 일, 태그, 템플릿, 워크스페이스별 사용자 정의 상태
- **팀 협업** — 워크스페이스 단위 멤버·역할 관리, 초대, 칸반·목록 보기, 실시간 보드 갱신
- **메시지** — 1:1·그룹 DM, 답장, 읽음 표시, 멘션 알림
- **AI 에이전트** — 자연어로 할 일을 만들고 정리하는 에이전트. "정리 도우미", "점검 도우미"처럼 역할을 나누고 역할마다 쓸 수 있는 도구를 제한하며, 역할을 정해진 시각에 실행하는 예약 기능이 있습니다
- **위치 알림** — 할 일에 장소를 붙이면 기기가 지오펜스 진입을 감지해 알려 줍니다 (지도는 카카오 지도)
- **iOS 앱 표면** — 홈 화면 위젯, 잠금 화면 Live Activity, 푸시, 공유 확장, 앱 단축어
- **팀 모집** — 모집글과 Q&A, 신고·차단 및 운영자 조치

## 설계에서 고민한 점

**실시간 이벤트는 커밋된 뒤에 보냅니다.**
할 일 변경과 DM은 트랜잭션이 커밋된 다음(`afterCommit`)에 WebSocket으로 발행합니다(`TodoEventPublisher`, `DmService`). 롤백될 변경이 다른 사람 화면에 먼저 뜨지 않게 하기 위해서이고, 알림 발송도 `@Async`로 요청 트랜잭션 밖에서 처리합니다.

**WebSocket은 연결할 때 한 번, 구독할 때 한 번 더 확인합니다.**
STOMP 연결 시 JWT를 검사하고, `/topic/dm/{방}`·`/topic/workspace/{id}`를 구독하는 순간 그 방의 참여자인지, 워크스페이스 멤버인지 다시 확인합니다(`backend/.../config/WebSocketConfig.java`). 처음에는 연결 시에만 검사했는데, 코드 리뷰에서 이 구멍을 찾아 막았습니다.

**AI에게는 "무엇까지 건드릴 수 있는지"를 먼저 정합니다.**
에이전트는 최대 5단계까지 도구를 호출하는 루프로 동작하고(`ChatService`), 역할마다 허용 도구를 `ToolRegistry`가 검증합니다. 데이터를 바꾸는 역할은 예약 실행에 걸 수 없도록 생성 시점과 실행 시점에 모두 검사합니다(`AiScheduleService`). 사람이 보지 않는 사이에 마감이 옮겨지면 누가 한 일인지 알 수 없기 때문입니다.

**모바일 리라이트의 위험은 API 계약으로 줄였습니다.**
백엔드의 OpenAPI 명세(`mobile/openapi.json`)에서 TypeScript 타입을 생성해(`npm run gen:api`) 앱이 사용하므로, 앱과 서버의 계약이 어긋나면 타입 검사에서 드러납니다. 또 할 일 생성 요청에 앱이 만든 키(`client_key`)를 붙여, 응답을 받지 못해 다시 보낸 요청이 할 일을 중복으로 만들지 않게 했습니다.

## 로컬 실행

### 백엔드 (`backend/`)

Java 17과 PostgreSQL이 필요합니다. 엔티티는 `todo` 스키마를 사용합니다.

```sh
cd backend
cp src/main/resources/application.example.properties src/main/resources/application.properties

export DB_URL=jdbc:postgresql://localhost:5432/plando
export DB_USERNAME=plando
export DB_PASSWORD=...          # 로컬 DB 비밀번호
export JWT_SECRET=...           # 충분히 긴 임의 문자열
# 선택: GOOGLE_CLIENT_ID, KAKAO_CLIENT_ID, OPENAI_API_KEY, VAPID_PUBLIC_KEY ... (예시 파일 참고)

./gradlew bootRun               # http://localhost:8080
```

예시 파일의 `${...}` 자리는 모두 환경변수로 채울 수 있고, 외부 연동 값이 비어 있으면 해당 기능만 동작하지 않습니다. `backend/sql/`에는 운영 DB에 적용했던 스키마 변경 스크립트를 날짜순으로 두었습니다(데이터 정리·시드 스크립트는 제외).

테스트는 H2 인메모리 DB로 실행되며, 외부 연동 자격증명은 `build.gradle`이 더미 값으로 채웁니다.

```sh
./gradlew test
```

### 웹 (`web/`)

```sh
cd web
cp .env.example .env.local      # VITE_API_BASE_URL=http://localhost:8080
npm install
npm run dev                     # http://localhost:5173
```

### iOS 앱 (`mobile/`)

```sh
cd mobile
cp .env.example .env            # EXPO_PUBLIC_API_URL=http://localhost:8080
npm install
npx expo run:ios                # 위젯·Live Activity 등 네이티브 모듈 때문에 Expo Go 대신 개발 빌드가 필요합니다
```

## 참고

- `./gradlew test`는 이 스냅샷 기준으로 `backend/src/test` 아래 Java 소스 파일 38개에 들어 있는 테스트 162개를 실행하며 모두 통과했습니다(2026-10-16, 예시 설정으로 직접 실행해 확인).
- 라이선스를 붙이지 않았습니다. 코드는 열람용으로 공개하며, 모든 권리는 저작자에게 있습니다.
