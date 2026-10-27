package kr.ongi.firststep;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;
import java.nio.file.*;
import java.net.URI;
import java.util.*;

@Component
public class ImportPrograms implements ApplicationRunner {
    final JdbcTemplate jdbc;
    public ImportPrograms(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @Override public void run(ApplicationArguments args) throws Exception {
        if(!args.containsOption("import.file"))return;
        String file=args.getOptionValues("import.file").getFirst();
        if(Files.size(Path.of(file))>2_000_000)throw new IllegalArgumentException("공고 파일 크기 제한 초과");
        var json=JsonMapper.builder().build();Program[] programs=json.readValue(Files.readString(Path.of(file)),Program[].class);
        for(var p:programs)validate(p);
        for(var p:programs) {
            String document=json.writeValueAsString(p);
            var existing=jdbc.queryForList("select document::text from program_versions where version_id=?::uuid",String.class,p.versionId());
            if(!existing.isEmpty()&&!json.readTree(existing.getFirst()).equals(json.readTree(document)))throw new IllegalArgumentException("같은 버전 ID로 다른 내용을 덮어쓸 수 없습니다.");
            jdbc.update("insert into program_versions(version_id,program_id,document) values (?::uuid,?::uuid,?::jsonb) on conflict(version_id) do nothing",p.versionId(),p.id(),document);
            jdbc.update("insert into program_documents(program_id,version_id,document) values (?::uuid,?::uuid,?::jsonb) on conflict(program_id) do update set version_id=excluded.version_id,document=excluded.document,imported_at=now()",p.id(),p.versionId(),document);
        }
        System.out.println("공개 공고 검증·등록: "+programs.length);
        if("true".equals(System.getProperty("firststep.importOnly")))System.exit(0);
    }
    static void validate(Program p) {
        UUID.fromString(p.id());UUID.fromString(p.versionId());
        if(p.title()==null||p.title().isBlank()||p.organizer()==null||p.organizer().isBlank())throw new IllegalArgumentException("공식 제목·기관 필요");
        if(!p.synthetic())https(p.officialUrl());
        if(p.facts()==null||p.occurrences()==null||p.barriers()==null||p.interests()==null||p.modes()==null||p.concerns()==null)throw new IllegalArgumentException("필수 목록 필요");
        if(p.verifiedAt()==null)throw new IllegalArgumentException("확인 시각 필요");
        java.time.Instant.parse(p.verifiedAt());
        p.recruiting(java.time.Instant.now());
        for(var score:p.barriers().values())if(score!=null&&(score<0||score>2))throw new IllegalArgumentException("장벽 값 범위 오류");
        Set<String> ids=new HashSet<>();
        for(var f:p.facts()) {
            if(!ids.add(f.id()))throw new IllegalArgumentException("근거 ID 중복");
            if("verified".equals(f.status())&&(f.quote()==null||f.quote().isBlank()||f.value()==null||f.value().isBlank()||f.locator()==null||f.locator().isBlank()))throw new IllegalArgumentException("검증 사실의 인용·위치 필요");
            if(!p.synthetic())https(f.sourceUrl());
        }
        for(var occurrence:p.occurrences()) {
            UUID.fromString(occurrence.id());
            for(var step:occurrence.timeline())for(var id:step.factIds())if(p.fact(id).isEmpty())throw new IllegalArgumentException("미검증 타임라인 근거");
            for(var prep:occurrence.preparations())if(!prep.kind().equals("unknown")) {
                if(prep.factIds().isEmpty())throw new IllegalArgumentException("준비물 근거 필요");
                for(var id:prep.factIds())if(p.fact(id).isEmpty())throw new IllegalArgumentException("미검증 준비물 근거");
            }
            if(occurrence.address()!=null && (occurrence.placeFactIds().isEmpty()||occurrence.placeFactIds().stream().anyMatch(id->p.fact(id).isEmpty())))throw new IllegalArgumentException("장소 근거 필요");
        }
    }
    static void https(String value){var uri=URI.create(value);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw new IllegalArgumentException("HTTPS 출처 필요");}
}
