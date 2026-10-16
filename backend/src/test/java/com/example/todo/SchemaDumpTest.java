package com.example.todo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import javax.sql.DataSource;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * 엔티티가 만들어내는 스키마를 파일로 덤프한다.
 *
 * 왜 필요한가: ddl-auto=validate 는 **nullability 를 검사하지 않는다.** 그래서 엔티티가
 * @Column(nullable=false) 라고 선언해도 운영 컬럼이 nullable 이면 아무도 모른 채 지나간다.
 * 실제로 Todo.priority 가 그랬고, 같은 요청이 운영에선 통과하고 테스트에선 실패했다.
 * 테스트 DB 는 엔티티에서 생성되므로(create-drop), 이 덤프가 곧 "엔티티가 기대하는 스키마"다.
 *
 * 이건 검증이 아니라 도구다 — 평소 CI 를 느리게 하지 않도록 실행 결과에 단정을 두지 않는다.
 */
class SchemaDumpTest extends IntegrationTestBase {

    @Autowired DataSource dataSource;

    @Test
    void dumpEntitySchema() throws Exception {
        try (Connection c = dataSource.getConnection();
             Statement st = c.createStatement();
             PrintWriter out = new PrintWriter("/tmp/entity-schema.tsv")) {
            ResultSet rs = st.executeQuery("""
                SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'TODO'
                ORDER BY TABLE_NAME, COLUMN_NAME
                """);
            while (rs.next()) {
                out.printf("%s\t%s\t%s\t%s\t%s%n",
                        rs.getString(1).toLowerCase(), rs.getString(2).toLowerCase(),
                        rs.getString(3), rs.getString(4),
                        rs.getObject(5) == null ? "" : rs.getString(5));
            }
        }
    }
}
