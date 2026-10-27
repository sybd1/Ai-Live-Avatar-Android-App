package kr.ongi.firststep;

import java.time.*;
import java.util.*;

public record Program(String id, String versionId, String title, String organizer, String officialUrl,
        String verifiedAt, String recruitmentStatus, String applicationStart, String applicationEnd,
        String publicationStatus, boolean synthetic, List<String> interests, List<String> modes,
        List<String> concerns, Integer minAge, Integer maxAge, String region,
        Map<String,Integer> barriers, List<Fact> facts, List<Occurrence> occurrences) {
    public record Fact(String id, String field, String value, String quote, String sourceUrl,
                       String locator, String status) {}
    public record Step(String id, String title, Integer orderIndex, String time, List<String> factIds) {}
    public record Preparation(String label, String kind, List<String> factIds) {}
    public record Occurrence(String id, String title, String address, Double longitude, Double latitude,
            List<String> placeFactIds, List<Step> timeline, List<Preparation> preparations,
            List<String> unknowns) {}
    public record Profile(int version, List<String> interests, List<String> modes, List<String> concerns,
                          Integer age, String region) {
        public static Profile empty() { return new Profile(0,List.of(),List.of(),List.of(),null,null); }
    }
    public boolean recruiting(Instant now) {
        if (!"published".equals(publicationStatus) || !"open".equals(recruitmentStatus)) return false;
        if (applicationStart != null && !applicationStart.isBlank() && after(applicationStart, now)) return false;
        return applicationEnd != null && !applicationEnd.isBlank() && !before(applicationEnd, now);
    }
    private static boolean after(String date, Instant now) {
        return date.length()==10 ? LocalDate.parse(date).isAfter(now.atZone(ZoneId.of("Asia/Seoul")).toLocalDate())
                : Instant.parse(date).isAfter(now);
    }
    private static boolean before(String date, Instant now) {
        return date.length()==10 ? LocalDate.parse(date).isBefore(now.atZone(ZoneId.of("Asia/Seoul")).toLocalDate())
                : Instant.parse(date).isBefore(now);
    }
    public Optional<Fact> fact(String id) {
        return facts.stream().filter(f -> f.id().equals(id) && "verified".equals(f.status())).findFirst();
    }
    public Occurrence occurrence(String id) {
        return occurrences.stream().filter(o -> o.id().equals(id)).findFirst()
                .orElseThrow(() -> ApiError.of(404,"NOT_FOUND","회차를 찾을 수 없어요."));
    }
}
