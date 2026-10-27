package kr.ongi.firststep;

import org.springframework.stereotype.Component;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import tools.jackson.databind.json.JsonMapper;

@Component
public class SttClient {
    private final Settings config;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    public SttClient(Settings config){this.config=config;}
    String transcribe(byte[] bytes,String mime) {
        if(config.text("STT_WORKER_TOKEN","").isBlank()) throw ApiError.of(503,"STT_FAILED","음성 인식 연결이 필요해요.");
        if(!java.util.Set.of("audio/mp4","audio/m4a","audio/x-m4a","audio/wav","audio/x-wav","audio/mpeg").contains(mime))
            throw ApiError.of(422,"AUDIO_UNSUPPORTED","이 녹음 형식은 아직 지원하지 않아요.");
        if(bytes.length==0 || bytes.length>10_000_000) throw ApiError.of(422,"AUDIO_TOO_LARGE","녹음 길이와 크기를 확인해 주세요.");
        try {
            var req=HttpRequest.newBuilder(URI.create(config.text("STT_WORKER_URL","http://127.0.0.1:8090")+"/transcribe"))
                .timeout(Duration.ofSeconds(20)).header("Content-Type",mime)
                .header("Authorization","Bearer "+config.text("STT_WORKER_TOKEN",""))
                .POST(HttpRequest.BodyPublishers.ofByteArray(bytes)).build();
            var response=http.send(req,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200) throw ApiError.of(502,"STT_FAILED","녹음을 인식하지 못했어요. 다시 녹음하거나 문장을 입력할 수 있어요.");
            String transcript=JsonMapper.builder().build().readTree(response.body()).path("transcript").asText();
            if(transcript.length()>1000) throw ApiError.of(422,"INVALID_INPUT","짧게 나누어 말하거나 인식 문장을 수정해 주세요.");
            return transcript;
        }catch(ApiError e){throw e;}catch(Exception e){throw ApiError.of(502,"STT_FAILED","음성 인식 연결이 필요해요. 텍스트로 계속할 수 있어요.");}
    }
}
