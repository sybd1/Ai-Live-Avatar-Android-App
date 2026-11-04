package kr.ongi.firststep;

import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import java.time.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

@Component
public class Sessions {
    private final Map<String,Session> sessions=new ConcurrentHashMap<>();
    private final SecureRandom random=new SecureRandom();
    public record Consents(boolean syntheticOnly, boolean voiceProcessing, boolean preferenceAnalysis) {}
    public static final class Session {
        final Instant created=Instant.now();
        volatile Instant lastActive=created;
        volatile boolean deleted;
        final Consents consents;
        Program.Profile profile=Program.Profile.empty();
        final Map<String,Practice> practices=new ConcurrentHashMap<>();
        final Map<String,Audio> audio=new ConcurrentHashMap<>();
        final Deque<Instant> turnTimes=new ArrayDeque<>();
        Session(Consents consents) { this.consents=consents; }
        boolean expired(Instant now) { return deleted || created.plusSeconds(7200).isBefore(now) || lastActive.plusSeconds(1800).isBefore(now); }
        void clear() { deleted=true; practices.values().forEach(p -> {synchronized(p) {p.state="ended";p.generation++;p.history.clear();}}); audio.clear();practices.clear();profile=Program.Profile.empty(); }
    }
    public static final class Practice {
        final String id=UUID.randomUUID().toString();
        final String programId,occurrenceId,versionId,scene;
        String difficulty,state="ready";
        int generation=0,turn=0;
        Instant started=Instant.now();
        boolean busy=false;
        int busyGeneration=-1;
        String liveId=null;
        Map<String,Object> interaction=new HashMap<>(Map.of("inputMode","text","responseLength","short","playbackRate",1.0,"waitHintEnabled",true));
        final Map<String,Map<String,Object>> results=new LinkedHashMap<>();
        final Map<String,String> controls=new LinkedHashMap<>();
        final List<Map<String,String>> history=new ArrayList<>();
        List<Map<String,String>> candidates=List.of();
        Practice(String program,String occurrence,String version,String scene,String difficulty) {
            this.programId=program;this.occurrenceId=occurrence;this.versionId=version;this.scene=scene;this.difficulty=difficulty;
        }
        Map<String,Object> snapshot() { return Map.of("practiceId",id,"state",state,"generation",generation,"expectedTurn",turn,"difficulty",difficulty); }
    }
    public record Audio(byte[] bytes,String mime,String practiceId,Instant expires) {}
    public String create(Consents consent) {
        if(sessions.size()>=1000) throw ApiError.of(429,"RATE_LIMITED","잠시 후 다시 시작해 주세요.");
        byte[] token=new byte[32]; random.nextBytes(token);
        String key=Base64.getUrlEncoder().withoutPadding().encodeToString(token);
        sessions.put(key,new Session(consent));return key;
    }
    public Session require(String authorization) {
        if(authorization==null || !authorization.startsWith("Bearer ")) throw ApiError.of(401,"SESSION_EXPIRED","새 세션을 시작해 주세요.");
        String token=authorization.substring(7); Session s=sessions.get(token);
        if(s==null || s.expired(Instant.now())) {if(s!=null){s.clear();sessions.remove(token);}throw ApiError.of(401,"SESSION_EXPIRED","세션이 만료됐어요. 새로 시작해 주세요.");}
        s.lastActive=Instant.now();return s;
    }
    public Practice practice(Session s,String id) {
        Practice p=s.practices.get(id);
        if(p==null) throw ApiError.of(404,"NOT_FOUND","연습을 찾을 수 없어요."); return p;
    }
    public void remove(String auth) { Session s=require(auth);s.clear();sessions.remove(auth.substring(7)); }
    @Scheduled(fixedDelay=30000)
    public void cleanup() {
        Instant now=Instant.now();sessions.forEach((key,s)->{if(s.expired(now)){s.clear();sessions.remove(key);}else s.audio.entrySet().removeIf(a->a.getValue().expires().isBefore(now));});
    }
}
