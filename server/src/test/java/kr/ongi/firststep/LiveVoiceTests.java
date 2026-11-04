package kr.ongi.firststep;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.TextMessage;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Timeout;
import tools.jackson.databind.JsonNode;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LiveVoiceTests {
    static class Harness implements AutoCloseable {
        final Gemini ai=mock(Gemini.class);
        final Settings config=mock(Settings.class);
        final WebSocketSession socket=mock(WebSocketSession.class);
        final List<JsonNode> messages=new CopyOnWriteArrayList<>();
        final Sessions.Session session=new Sessions.Session(new Sessions.Consents(true,true,false));
        final Sessions.Practice practice=new Sessions.Practice("p","o","v","greeting","short");
        final LiveVoice live;
        final LiveVoice.Bridge bridge;
        Harness() throws Exception {
            when(socket.isOpen()).thenReturn(true);when(socket.getId()).thenReturn("phone");
            when(config.number(anyString(),anyInt())).thenAnswer(a->a.getArgument(1));
            when(ai.speech(anyString())).thenReturn(new byte[]{'R','I','F','F'});
            live=new LiveVoice(null,null,config,ai,null);
            doAnswer(a->{messages.add(live.json.readTree(((TextMessage)a.getArgument(0)).getPayload()));return null;}).when(socket).sendMessage(any());
            bridge=live.new Bridge(socket,session,practice,null);bridge.ready=true;
        }
        void input(String text){bridge.incoming(live.json.readTree(live.json.writeValueAsString(Map.of("serverContent",Map.of("inputTranscription",Map.of("text",text))))));}
        void output(String text){bridge.incoming(live.json.readTree(live.json.writeValueAsString(Map.of("serverContent",Map.of("outputTranscription",Map.of("text",text))))));}
        void awaitMessages(String type) throws Exception {
            for(int i=0;i<100;i++){if(messages.stream().anyMatch(m->m.path("type").asText().equals(type)))return;Thread.sleep(10);}
            fail("Missing message: "+type);
        }
        public void close(){bridge.close();live.dispose();}
    }

    @Test void crisisPhrasesUseReviewedGuidanceWithoutRelaxingOrdinaryRoleplayChecks(){
        var guard=new ResponseGuard(null);
        for(String text:List.of("극단적인 선택을 하려고 해요","극단적 선택을 생각하고 있어요","죽고 싶어요","자살할 생각이 있어요","지금 자해할 것 같아요")){
            assertEquals("help",ResponseGuard.voiceControl(text),text);
            assertEquals(ResponseGuard.HELP,guard.reply(null,null,text).text());
        }
        assertTrue(ResponseGuard.forbiddenLiveText("실제로 3시에 오세요."));
        assertTrue(ResponseGuard.forbiddenLiveText(ResponseGuard.HELP));
        assertFalse(ResponseGuard.needsHelp("처음 와서 어색해요"));
    }

    @Test @Timeout(5) void fragmentedCrisisInputDeliversCompleteReviewedAudioAndKeepsClientOpen() throws Exception {
        try(var h=new Harness()){
            h.input("극단적인 ");h.input("선택을 하려고 해요");h.awaitMessages("reply");
            assertEquals(1,h.messages.stream().filter(m->m.path("type").asText().equals("guidance")).count());
            var reply=h.messages.stream().filter(m->m.path("type").asText().equals("reply")).findFirst().orElseThrow();
            assertEquals(ResponseGuard.HELP,reply.path("approvedText").asText());
            assertEquals("help",reply.path("kind").asText());
            verify(h.ai).speech(ResponseGuard.HELP);verify(h.socket,never()).close();
            h.output("무조건 109");h.bridge.onError(null,new IllegalStateException());
            assertFalse(h.messages.stream().anyMatch(m->Set.of("error","control","caption").contains(m.path("type").asText())));
        }
    }

    @Test @Timeout(5) void crisisNumberInModelOutputTransitionsToReviewedHelpInsteadOfClosingAudio() throws Exception {
        try(var h=new Harness()){
            h.output("자살예방상담전화 109에서 도움을 받을 수 있어요.");h.awaitMessages("reply");
            verify(h.ai).speech(ResponseGuard.HELP);verify(h.socket,never()).close();
            assertEquals("guidance",h.messages.getFirst().path("type").asText());
            assertFalse(h.messages.stream().anyMatch(m->m.path("type").asText().equals("error")));
        }
    }

    @Test @Timeout(5) void unsupportedRoleplayFactIsNotAllowedToFinishSpeaking() throws Exception {
        try(var h=new Harness()){
            h.output("실제 프로그램에는 3시에 오세요.");h.awaitMessages("reply");
            verify(h.ai).speech(ResponseGuard.GUARDED);
            assertEquals("guard",h.messages.getFirst().path("kind").asText());
            assertFalse(h.messages.toString().contains("3시에"));
        }
    }

    @Test @Timeout(5) void speechFailureRetainsReviewedHelpTextWithoutGenericSafetyError() throws Exception {
        try(var h=new Harness()){
            when(h.ai.speech(anyString())).thenThrow(ApiError.of(502,"TTS_FAILED","unavailable"));
            h.input("극단적인 선택을 하려고 해요");h.awaitMessages("guidanceUnavailable");
            assertEquals(ResponseGuard.HELP,h.messages.getFirst().path("approvedText").asText());
            assertFalse(h.messages.stream().anyMatch(m->m.path("type").asText().equals("error")));
        }
    }

    @Test @Timeout(5) void explicitPauseDuringGuidanceGenerationDiscardsLateAudio() throws Exception {
        var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
        try(var h=new Harness()){
            when(h.ai.speech(anyString())).thenAnswer(a->{entered.countDown();release.await(2,TimeUnit.SECONDS);return new byte[]{'R','I','F','F'};});
            h.input("죽고 싶어요");assertTrue(entered.await(1,TimeUnit.SECONDS));
            assertEquals("guidance",h.messages.getFirst().path("type").asText());
            h.practice.state="paused";h.practice.generation++;release.countDown();h.live.work.close();
            assertFalse(h.messages.stream().anyMatch(m->m.path("type").asText().equals("reply")));
        }finally{release.countDown();}
    }

    @Test void transcriptionDoesNotInterruptIndependentAudioPlayback() throws Exception {
        var live=new LiveVoice(null,null,null,null,null);
        try {
            var socket=mock(WebSocketSession.class);
            when(socket.isOpen()).thenReturn(true);
            var session=new Sessions.Session(new Sessions.Consents(true,true,false));
            var practice=new Sessions.Practice("p","o","v","greeting","short");
            var bridge=live.new Bridge(socket,session,practice,null);
            String originalId=bridge.utteranceId;
            bridge.audio.writeBytes(new byte[]{1,2});

            bridge.incoming(live.json.readTree("{\"serverContent\":{\"inputTranscription\":{\"text\":\"\"}}}"));
            assertEquals(originalId,bridge.utteranceId);
            assertEquals(2,bridge.audio.size());
            verify(socket,never()).sendMessage(any());

            bridge.incoming(live.json.readTree("{\"serverContent\":{\"inputTranscription\":{\"text\":\"안녕하세요\"}}}"));
            assertEquals("안녕하세요",bridge.input.toString());
            verify(socket).sendMessage(argThat(message->message instanceof TextMessage text && text.getPayload().contains("heard")));
            verify(socket,never()).sendMessage(argThat(message->message instanceof TextMessage text && text.getPayload().contains("interrupted")));

            bridge.incoming(live.json.readTree("{\"serverContent\":{\"interrupted\":true}}"));
            assertEquals(0,bridge.audio.size());
            assertTrue(bridge.input.isEmpty());
            verify(socket).sendMessage(argThat(message->message instanceof TextMessage text && text.getPayload().contains("interrupted")));
        } finally {live.dispose();}
    }
}
