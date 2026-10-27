package kr.ongi.firststep;

import java.time.Instant;
import java.util.*;

public final class Recommendations {
    private static final List<String> BARRIER_KEYS=List.of("selection","documents","cost","prework","eligibility");
    public record Ranked(Program program, String eligibility, List<String> reasons, int known,
                         Double barrierMean, Double personalScore) {}
    public static List<Ranked> rank(List<Program> programs, Program.Profile profile, Instant now,
                                     boolean demo, String category, String mode, String search) {
        return programs.stream().filter(p -> demo==p.synthetic() && p.recruiting(now))
            .filter(p -> profile.age()==null || (p.minAge()==null || profile.age()>=p.minAge())
                    && (p.maxAge()==null || profile.age()<=p.maxAge()))
            .filter(p -> profile.region()==null || p.region()==null || p.region().equals("전국")
                    || p.region().equals(profile.region()))
            .filter(p -> category==null || p.interests().contains(category))
            .filter(p -> mode==null || p.modes().contains(mode))
            .filter(p -> search==null || p.title().contains(search) || p.organizer().contains(search))
            .map(p -> score(p,profile))
            .sorted(Comparator.<Ranked,Double>comparing(r -> r.personalScore()==null ? -1 : r.personalScore()).reversed()
                .thenComparing(r -> r.known()<4)
                .thenComparing(r -> r.known()<4 ? Double.MAX_VALUE : r.barrierMean())
                .thenComparing(Comparator.comparingInt(Ranked::known).reversed())
                .thenComparing(r -> r.program().verifiedAt(),Comparator.reverseOrder())
                .thenComparing(r -> r.program().id()))
            .toList();
    }
    static Ranked score(Program p, Program.Profile profile) {
        var values=BARRIER_KEYS.stream().map(k -> p.barriers().get(k)).filter(Objects::nonNull).toList();
        double score=0; int coverage=0;
        var reasons=new ArrayList<String>();
        if (!profile.interests().isEmpty() && !p.interests().isEmpty()) { coverage+=40; if(intersects(p.interests(),profile.interests())) { score+=40; reasons.add("선택한 관심 활동과 연결되는 프로그램이에요."); } }
        if (!profile.modes().isEmpty() && !p.modes().isEmpty()) { coverage+=25; if(intersects(p.modes(),profile.modes())) { score+=25; reasons.add("선택한 참여 방식과 맞아요."); } }
        if (!profile.concerns().isEmpty() && !p.concerns().isEmpty()) { coverage+=20; if(intersects(p.concerns(),profile.concerns())) { score+=20; reasons.add("선택한 걱정과 연결된 연습을 제공해요."); } }
        if (coverage<50) reasons.clear();
        // Barrier explanations are emitted only from reviewed official facts, never from unknown values.
        p.facts().stream().filter(f -> "verified".equals(f.status()) && f.field().startsWith("barrierReason"))
                .limit(2).forEach(f -> reasons.add(f.value()));
        if (reasons.isEmpty()) reasons.add("참여 조건과 공식 안내를 먼저 확인해 주세요.");
        return new Ranked(p,"unknown",List.copyOf(reasons),values.size(),values.isEmpty()?null:
                values.stream().mapToInt(Integer::intValue).average().orElseThrow(),coverage>=50?score/coverage:null);
    }
    private static boolean intersects(List<String> a,List<String> b) { return a.stream().anyMatch(b::contains); }
}
