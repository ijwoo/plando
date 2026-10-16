/**
 * 앱 밖으로 나가는 링크 모음.
 *
 * 한 곳에 모아두는 이유: 문서 사이트는 지금 백엔드와 같은 도메인 아래(/docs)에 얹혀 있다.
 * 나중에 별도 도메인으로 옮기면 여기만 고치면 된다 — 화면마다 하드코딩해 두면 놓친다.
 */

/** 사용 안내서 (VitePress 정적 사이트) */
export const DOCS_URL = "https://plando.imjaewoo.dev/docs/";

/** 안내서 안의 특정 문서로 바로 보내고 싶을 때 */
export const docsPath = (page) => `${DOCS_URL}${String(page).replace(/^\//, "")}`;
