package kr.ongi.firststep;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class DomainTests {
    static Program program(String id,Map<String,Integer> barriers,String end,Integer minAge,boolean demo) {
        return new Program(id,"version","프로그램","기관","https://example.org","2026-10-24T00:00:00Z","open","2026-10-01",end,"published",demo,List.of("요리"),List.of("오프라인"),List.of("첫 인사"),minAge,39,"서울",barriers,List.of(),List.of());
    }
    final Instant now=Instant.parse("2026-10-24T14:00:00Z");
    @Test void dateOnlyDeadlineUsesKoreaDateWithoutInventingEndTime(){
        var p=program("a",Map.of(),"2026-10-24",19,false);
        assertTrue(p.recruiting(Instant.parse("2026-10-24T14:59:59Z")));
        assertFalse(p.recruiting(Instant.parse("2026-10-24T15:00:00Z")));
    }
    @Test void datedTimeDeadlineIsExact(){assertFalse(program("a",Map.of(),"2026-10-24T13:00:00Z",19,false).recruiting(now));}
    @Test void unknownBarriersNeverBecomeZero(){
        var a=program("a",Map.of("cost",0),"2026-11-01",19,false);
        var b=program("b",Map.of("cost",1,"documents",1,"selection",1,"prework",1),"2026-11-01",19,false);
        var result=Recommendations.rank(List.of(a,b),Program.Profile.empty(),now,false,null,null,null);
        assertEquals("b",result.getFirst().program().id());assertEquals(1,result.get(1).known());
    }
    @Test void knownAgeMismatchIsExcludedButUnknownAgeIsAllowed(){
        var a=program("a",Map.of(),"2026-11-01",30,false);
        assertEquals(1,Recommendations.rank(List.of(a),Program.Profile.empty(),now,false,null,null,null).size());
        assertTrue(Recommendations.rank(List.of(a),new Program.Profile(0,List.of(),List.of(),List.of(),25,"서울"),now,false,null,null,null).isEmpty());
    }
    @Test void interestAloneDoesNotClaimPersonalization(){var p=new Program.Profile(0,List.of("요리"),List.of(),List.of(),null,null);assertNull(Recommendations.score(program("a",Map.of(),"2026-11-01",19,false),p).personalScore());}
    @Test void confirmedInterestAndModeEnablePersonalization(){var p=new Program.Profile(0,List.of("요리"),List.of("오프라인"),List.of(),null,null);assertEquals(1.0,Recommendations.score(program("a",Map.of(),"2026-11-01",19,false),p).personalScore());}
    @Test void syntheticAndRealCataloguesNeverMix(){var d=program("d",Map.of(),"2026-11-01",19,true);assertTrue(Recommendations.rank(List.of(d),Program.Profile.empty(),now,false,null,null,null).isEmpty());}
    @Test void noPredictionOrDiagnosticRoleplayPassesGuard(){assertFalse(ResponseGuard.safeText("합격할 수 있어요"));assertFalse(ResponseGuard.safeText("불안 수준이 높으시네요"));assertFalse(ResponseGuard.safeText("3시에 오세요"));assertTrue(ResponseGuard.safeText("원하시면 인사부터 연습해볼까요?"));}
    @Test void sessionsAreIsolatedAndDeletedTokensStopWorking(){var sessions=new Sessions();String a=sessions.create(new Sessions.Consents(true,false,false)),b=sessions.create(new Sessions.Consents(true,false,false));assertNotSame(sessions.require("Bearer "+a),sessions.require("Bearer "+b));sessions.remove("Bearer "+a);assertThrows(ApiError.class,()->sessions.require("Bearer "+a));assertNotNull(sessions.require("Bearer "+b));}
    @Test void pausedGenerationRejectsDelayedWork(){var s=new Sessions.Session(new Sessions.Consents(true,true,false));var p=new Sessions.Practice("p","o","v","greeting","short");Api.active(s,p,0);p.generation++;p.state="paused";assertThrows(ApiError.class,()->Api.active(s,p,0));}
    @Test void factualQuestionsUseOnlyVerifiedRelevantFieldsWithoutCallingAi(){
        var base=program("p",Map.of(),"2026-11-01",19,false);
        var facts=List.of(new Program.Fact("date","activityDate","2026년 11월 19일","공식 날짜","https://example.org","목록","verified"),new Program.Fact("bad","preparation","임의 준비물","미확인","https://example.org","목록","unknown"));
        var p=new Program(base.id(),base.versionId(),base.title(),base.organizer(),base.officialUrl(),base.verifiedAt(),base.recruitmentStatus(),base.applicationStart(),base.applicationEnd(),base.publicationStatus(),base.synthetic(),base.interests(),base.modes(),base.concerns(),base.minAge(),base.maxAge(),base.region(),base.barriers(),facts,List.of());
        var guard=new ResponseGuard(null);var practice=new Sessions.Practice("p","o","v","greeting","short");
        assertEquals(List.of("date"),guard.reply(p,practice,"날짜가 언제인가요?").factIds());
        assertEquals("unknown",guard.reply(p,practice,"준비물은 무엇인가요?").kind());
        assertEquals("unknown",guard.reply(p,practice,"실제 담당자가 기다려 주나요?").kind());
    }
}
