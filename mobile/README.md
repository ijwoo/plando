# Plan Do! iOS 앱

React Native · Expo로 작성한 iOS 앱입니다. 실행 방법과 전체 구조는 [루트 README](../README.md)를 참고해 주세요.

- `src/app` — Expo Router 화면
- `src/features` — 기능별 화면 로직과 API 호출
- `src/api` — 백엔드 OpenAPI 명세(`openapi.json`)에서 생성한 타입과 API 클라이언트
- `modules/` — 로컬 네이티브 모듈 (위젯 데이터 공유, Live Activity, Spotlight)
- `targets/` — iOS 확장 타깃 (홈 화면 위젯, 공유 확장)
- `plugins/` — Expo config plugin (앱 단축어, 위젯 타깃)

`app.config.ts`와 `eas.json`의 Apple 팀 ID, EAS 프로젝트 ID, App Store Connect 키 정보는 공개 스냅샷에서 환경변수·자리표시자로 바꿨습니다.
