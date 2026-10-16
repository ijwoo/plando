package com.example.todo.util;

/**
 * 둘러보기(게스트) 홈 화면 기본 시드.
 *
 * 왜 필요한가: GuestCleanupService 는 게스트 로그인마다 대시보드 개인화(레이아웃·메모·북마크)를
 * 지운다. 이전 게스트가 남긴 메모가 다음 사람에게 보이면 안 되기 때문이다. 그런데 그냥 null 로
 * 비우면 둘러보기 첫 화면이 기본 배치에 빈 카드만 남아 "써볼 게 없는 화면"이 된다.
 * 그래서 **비우는 대신 이 시드로 되돌린다.**
 *
 * 값을 여기 상수로 둔 이유: DB 에 직접 넣으면 다음 로그인에 지워지고, 클라이언트에 두면
 * 게스트가 고친 뒤 되돌릴 기준이 사라진다. 서버가 초기화 시점에 쓰는 단일 출처가 필요하다.
 *
 * 체험 워크스페이스 id(43)가 메모 키에 박혀 있다 — 메모는 워크스페이스별 맵이기 때문이다.
 * 워크스페이스를 새로 만들면 이 값도 함께 고쳐야 한다.
 */
public final class GuestDashboardSeed {

    private GuestDashboardSeed() {}

    /** 체험 워크스페이스 id — 메모 맵의 키. */
    public static final long SAMPLE_WORKSPACE_ID = 43L;

    /** 카드 배치. 홈이 비어 보이지 않게 목록·캘린더·프로젝트·메모·북마크·팀·완료율을 함께 깐다. */
    public static final String LAYOUT = """
[{"w":2,"h":2,"x":0,"y":7,"i":"list","minW":1,"minH":2,"moved":false,"static":false},\
{"w":1,"h":5,"x":0,"y":0,"i":"minical","minW":1,"minH":4,"moved":false,"static":false},\
{"w":3,"h":2,"x":1,"y":5,"i":"recent","minW":1,"minH":2,"moved":false,"static":false},\
{"w":1,"h":5,"x":1,"y":0,"i":"projects","minW":1,"minH":2,"moved":false,"static":false},\
{"w":2,"h":4,"x":0,"y":9,"i":"activity","minW":1,"minH":2,"moved":false,"static":false},\
{"w":2,"h":5,"x":2,"y":0,"i":"memo","minW":1,"minH":2,"moved":false,"static":false},\
{"w":1,"h":2,"x":0,"y":5,"i":"bookmarks","minW":1,"minH":2,"moved":false,"static":false},\
{"w":2,"h":2,"x":2,"y":7,"i":"team","minW":1,"minH":2,"moved":false,"static":false},\
{"w":2,"h":4,"x":2,"y":9,"i":"completion","minW":1,"minH":2,"moved":false,"static":false}]""";

    /** 스티커 메모 — 협업 중인 팀처럼. 워크스페이스별 맵이라 최상위 키가 워크스페이스 id 다. */
    public static final String STICKIES = """
{"43":[\
{"i":"gs-1","text":"이번 스프린트 목표\\n· 온보딩 이탈 20% 줄이기\\n· 뉴스레터 발송 검수","color":"#BFDBFE","x":0,"y":0,"w":1,"h":6},\
{"i":"gs-2","text":"회의에서 나온 것\\n- 결제 오류 재현 조건 정리됨\\n- FAQ 최신화는 다음 주","color":"#FBCFE8","x":1,"y":0,"w":1,"h":5},\
{"i":"gs-3","text":"둘러보기 중이에요.\\n메모는 자유롭게 고쳐보세요!","color":"#BBF7D0","x":0,"y":6,"w":1,"h":4},\
{"i":"gs-4","text":"확인 필요\\n· 디자인 시안 최종안\\n· 발송 세그먼트 기준","color":"#FEF08A","x":1,"y":5,"w":1,"h":5}\
]}""";

    /** 북마크 — 팀이 자주 여는 링크처럼. */
    public static final String BOOKMARKS = """
[{"id":"gb-1","url":"https://plando.imjaewoo.dev/docs/","label":"Plan Do! 사용 안내서"},\
{"id":"gb-2","url":"https://www.figma.com","label":"디자인 시안 (Figma)"},\
{"id":"gb-3","url":"https://github.com","label":"코드 저장소"},\
{"id":"gb-4","url":"https://www.notion.so","label":"팀 위키"}]""";
}
