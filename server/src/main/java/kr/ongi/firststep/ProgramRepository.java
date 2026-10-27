package kr.ongi.firststep;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;
import java.util.*;

@Repository
public class ProgramRepository {
    private final JdbcTemplate jdbc;
    private final JsonMapper json=JsonMapper.builder().build();
    public ProgramRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public List<Program> all() {
        return jdbc.query("select document::text from program_documents order by program_id",
                (rs,n) -> json.readValue(rs.getString(1),Program.class));
    }
    public Program get(String id) {
        return all().stream().filter(p -> p.id().equals(id)).findFirst()
                .orElseThrow(() -> ApiError.of(404,"NOT_FOUND","공고를 찾을 수 없어요."));
    }
}
