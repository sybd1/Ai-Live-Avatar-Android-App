package kr.ongi.firststep;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;

@Component
public class Gemini {
    private final Settings config;
    private final JdbcTemplate jdbc;
    private final JsonMapper json=JsonMapper.builder().build();
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    public Gemini(Settings config,JdbcTemplate jdbc) { this.config=config;this.jdbc=jdbc; }
    private synchronized void reserve(int chars) {
        if(!config.aiReady()) throw ApiError.of(503,"AI_UNAVAILABLE","가상 사용자 시연용 AI 연결이 필요해요.");
        LocalDate today=LocalDate.now(ZoneOffset.UTC);
        consume("requests:"+today,1,config.number("AI_DAILY_REQUEST_LIMIT",100));
        if(chars>0)consume("tts-characters:"+today.toString().substring(0,7),chars,config.number("TTS_MONTHLY_CHAR_LIMIT",10000));
    }
    synchronized void reserveLive(){reserve(0);}
    synchronized void reserveLiveAudio(int seconds){consume("live-audio-seconds:"+LocalDate.now(ZoneOffset.UTC),seconds,config.number("LIVE_DAILY_AUDIO_SECONDS",600));}
    private void consume(String key,int amount,int limit){
        jdbc.update("insert into ai_usage_counters(period_key,used) values (?,0) on conflict do nothing",key);
        if(jdbc.update("update ai_usage_counters set used=used+? where period_key=? and used+?<=?",amount,key,amount,limit)!=1)
            throw ApiError.of(429,"RATE_LIMITED","설정한 AI 사용 한도에 도달했어요.");
    }
    JsonNode interact(Map<String,Object> body,int chars) {
        long deadline=System.nanoTime()+Duration.ofSeconds(20).toNanos();
        try {
          for(int attempt=0;attempt<2;attempt++) {
            reserve(chars);
            var req=HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/interactions"))
                .timeout(Duration.ofNanos(Math.max(1,deadline-System.nanoTime()))).header("Content-Type","application/json")
                .header("x-goog-api-key",config.text("GEMINI_API_KEY",""))
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
            var res=http.send(req,HttpResponse.BodyHandlers.ofByteArray());
            if(res.statusCode()==429) throw ApiError.of(429,"RATE_LIMITED","AI 제공자의 호출 한도에 도달했어요.");
            if(res.statusCode()==503) {
                System.getLogger(Gemini.class.getName()).log(System.Logger.Level.WARNING,"Gemini temporarily unavailable: HTTP 503, attempt {0}",attempt+1);
                if(attempt==0&&deadline-System.nanoTime()>Duration.ofSeconds(1).toNanos()){Thread.sleep(500);continue;}
                throw ApiError.of(503,"AI_UPSTREAM_BUSY","AI 연결이 붐비고 있어요. 잠시 뒤 다시 시도하거나 예시를 살펴볼 수 있어요.");
            }
            if(res.statusCode()!=200 || res.body().length>8_000_000) {
                System.getLogger(Gemini.class.getName()).log(System.Logger.Level.WARNING,"Gemini response rejected: HTTP {0}, bytes {1}",res.statusCode(),res.body().length);
                throw ApiError.of(502,"AI_UNAVAILABLE","AI 응답을 받지 못했어요. 다시 시도할 수 있어요.");
            }
            return json.readTree(res.body());
          }
          throw ApiError.of(503,"AI_UPSTREAM_BUSY","AI 연결을 잠시 기다려 주세요.");
        }catch(ApiError e){throw e;}catch(Exception e){throw ApiError.of(502,"AI_UNAVAILABLE","AI 연결에 문제가 있어요. 입력 내용은 오류 기록에 남기지 않아요.");}
    }
    JsonNode structured(String instruction,Object input,Map<String,Object> schema) {
        var payload=new LinkedHashMap<String,Object>();
        payload.put("model",config.text("TEXT_MODEL","gemini-3.5-flash-lite"));
        payload.put("store",false);
        payload.put("system_instruction",instruction);
        payload.put("generation_config",Map.of("thinking_level","low","max_output_tokens",1024));
        payload.put("input",json.writeValueAsString(input));
        payload.put("response_format",Map.of("type","text","mime_type","application/json","schema",schema));
        var root=interact(payload,0);StringBuilder text=new StringBuilder();
        for(var step:root.path("steps")) if("model_output".equals(step.path("type").asText()))
            for(var part:step.path("content")) if("text".equals(part.path("type").asText())) text.append(part.path("text").asText());
        if(text.isEmpty() || text.length()>20000) throw ApiError.of(502,"AI_UNAVAILABLE","AI 응답 형식을 확인하지 못했어요.");
        try{return json.readTree(text.toString());}catch(Exception e){throw ApiError.of(502,"AI_UNAVAILABLE","AI 응답을 확인하지 못했어요.");}
    }
    byte[] speech(String approved) {
        var root=interact(Map.of("model",config.text("TTS_MODEL","gemini-3.8-flash-lite-tts"),"store",false,
            "input",List.of(Map.of("type","user_input","content",List.of(Map.of("type","text","text",approved,
                "annotations",List.of(Map.of("type","speech_metadata","style","차분하고 부드러운 한국어. 재촉하지 않고 또박또박 읽기")))))),
            "response_format",Map.of("type","audio","mime_type","audio/wav"),
            "generation_config",Map.of("speech_config",List.of(Map.of("voice",config.text("TTS_VOICE","Kore"))))),approved.length());
        for(var step:root.path("steps")) if("model_output".equals(step.path("type").asText()))
            for(var part:step.path("content")) if("audio".equals(part.path("type").asText())) {
                try {
                    byte[] audio=Base64.getDecoder().decode(part.path("data").asText());
                    if(audio.length<44 || audio.length>5_000_000 || audio[0]!='R'||audio[1]!='I'||audio[2]!='F'||audio[3]!='F') break;
                    return audio;
                }catch(IllegalArgumentException ignored) { break; }
            }
        throw ApiError.of(502,"TTS_FAILED","음성 응답을 확인하지 못했어요.");
    }
    static Map<String,Object> object(Map<String,Object> properties,String... required) {
        return Map.of("type","object","properties",properties,"required",List.of(required),"additionalProperties",false);
    }
    static Map<String,Object> str() {return Map.of("type","string");}
    static Map<String,Object> strings() {return Map.of("type","array","items",str());}
}
