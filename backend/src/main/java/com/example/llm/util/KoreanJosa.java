package com.example.llm.util;

/**
 * 한국어 조사 붙이기 (서버판).
 *
 * "진행 중예요", "우선순위을(를)" 같은 문장은 기계가 쓴 글로 읽힌다. 받침만 보면 되는
 * 규칙이라 라이브러리를 들이지 않는다. 웹에도 같은 것이 있다(shared/utils/josa.js) —
 * 서버가 만드는 문장은 서버에서 붙여야 해서 한 벌 더 둔다.
 *
 * 유니코드 한글 음절은 (초성×21 + 중성)×28 + 종성 으로 배치돼 있어서, 코드포인트를 28로
 * 나눈 나머지가 곧 종성이다(0이면 받침 없음).
 *
 * **낱말이 사용자가 지은 이름이면 조사를 붙이지 마라.** 한글이 아닐 수도 있고(이모지·영문),
 * 그때는 무엇을 골라도 어색하다. 문장 구조로 피하는 편이 낫다.
 */
public final class KoreanJosa {

    private KoreanJosa() {}

    private static final int HANGUL_START = 0xAC00;
    private static final int HANGUL_END   = 0xD7A3;

    /** 종성 번호. 한글이 아니면 -1(조사를 고를 근거가 없다). */
    private static int finalConsonant(String word) {
        if (word == null || word.isBlank()) return -1;
        String t = word.trim();
        char c = t.charAt(t.length() - 1);
        if (c < HANGUL_START || c > HANGUL_END) return -1;
        return (c - HANGUL_START) % 28;
    }

    /** 받침이 있으면 앞쪽, 없으면 뒤쪽. 판단할 수 없으면 뒤쪽(모음형). */
    private static String pick(String word, String withBatchim, String withoutBatchim) {
        int jong = finalConsonant(word);
        if (jong < 0) return withoutBatchim;
        return jong == 0 ? withoutBatchim : withBatchim;
    }

    /** 이에요/예요 — "진행 중이에요", "보통 우선순위예요" */
    public static String iEyo(String word) {
        return pick(word, "이에요", "예요");
    }

    /** 은/는 */
    public static String eunNeun(String word) {
        return pick(word, "은", "는");
    }

    /**
     * 으로/로. ㄹ 받침(종성 8)은 예외로 "로" 를 쓴다 — "서울로", "높음으로".
     */
    public static String euRo(String word) {
        int jong = finalConsonant(word);
        if (jong < 0 || jong == 0 || jong == 8) return "로";
        return "으로";
    }

    /** 을/를 */
    public static String eulReul(String word) {
        return pick(word, "을", "를");
    }
}
