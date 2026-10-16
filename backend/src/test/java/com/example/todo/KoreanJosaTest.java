package com.example.todo;

import com.example.llm.util.KoreanJosa;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 조사 붙이기.
 *
 * [고정하는 결함] "진행 중예요" 처럼 받침을 무시하고 붙이거나 "은(는)" 으로 괄호를
 * 내보내면 기계가 쓴 글로 읽힌다. 웹에서 한 번 고쳤던 것을 서버에서 또 냈다.
 */
class KoreanJosaTest {

    @Test
    @DisplayName("받침이 있으면 이에요")
    void withBatchim() {
        assertThat(KoreanJosa.iEyo("진행 중")).isEqualTo("이에요");   // 중 — 받침 ㅇ
        assertThat(KoreanJosa.iEyo("완료")).isEqualTo("예요");        // 료 — 받침 없음
    }

    @Test
    @DisplayName("우선순위 문구도 맞게 붙는다")
    void priorityPhrase() {
        assertThat(KoreanJosa.iEyo("보통 우선순위")).isEqualTo("예요"); // 위 — 받침 없음
        assertThat(KoreanJosa.iEyo("높음 우선순위")).isEqualTo("예요");
    }

    @Test
    @DisplayName("은/는 · 을/를")
    void others() {
        assertThat(KoreanJosa.eunNeun("계획")).isEqualTo("은");
        assertThat(KoreanJosa.eunNeun("회의")).isEqualTo("는");
        assertThat(KoreanJosa.eulReul("보고서")).isEqualTo("를");
        assertThat(KoreanJosa.eulReul("문서작업")).isEqualTo("을");
    }

    @Test
    @DisplayName("으로/로 — ㄹ 받침은 예외")
    void euRo() {
        assertThat(KoreanJosa.euRo("보통")).isEqualTo("으로");   // ㅇ 받침
        assertThat(KoreanJosa.euRo("높음")).isEqualTo("으로");   // ㅁ 받침
        assertThat(KoreanJosa.euRo("낮음")).isEqualTo("으로");
        assertThat(KoreanJosa.euRo("서울")).as("ㄹ 받침은 '로'").isEqualTo("로");
        assertThat(KoreanJosa.euRo("완료")).as("받침 없으면 '로'").isEqualTo("로");
    }

    @Test
    @DisplayName("한글이 아니면 모음형으로 둔다")
    void nonHangul() {
        /* 이모지·영문·숫자로 끝나면 무엇을 골라도 어색하다. 적어도 괄호는 내보내지 않는다. */
        assertThat(KoreanJosa.iEyo("TODO")).isEqualTo("예요");
        assertThat(KoreanJosa.iEyo("2026-08-21 마감")).as("한글로 끝나면 받침을 본다").isEqualTo("이에요");
        assertThat(KoreanJosa.iEyo("T-1281")).as("숫자로 끝나면 모음형").isEqualTo("예요");
        assertThat(KoreanJosa.iEyo(null)).isEqualTo("예요");
        assertThat(KoreanJosa.iEyo("")).isEqualTo("예요");
    }
}
