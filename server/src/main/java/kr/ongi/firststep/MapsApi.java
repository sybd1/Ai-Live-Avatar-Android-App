package kr.ongi.firststep;

import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class MapsApi {
    final Settings config;final Sessions sessions;final Api api;
    final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    final JsonMapper json=JsonMapper.builder().build();
    public MapsApi(Settings config,Sessions sessions,Api api){this.config=config;this.sessions=sessions;this.api=api;}
    JsonNode request(String path) {
        if(!config.flag("MAP_ROUTING_ENABLED")||config.text("KAKAO_REST_API_KEY","").isBlank())throw ApiError.of(503,"MAP_UNAVAILABLE","지도 연결이 필요해요. 공식 주소로 지도에서 찾을 수 있어요.");
        try {
            var req=HttpRequest.newBuilder(URI.create("https://dapi.kakao.com"+path)).timeout(Duration.ofSeconds(12))
                .header("Authorization","KakaoAK "+config.text("KAKAO_REST_API_KEY","")).GET().build();
            var res=http.send(req,HttpResponse.BodyHandlers.ofString());
            if(res.statusCode()!=200||res.body().length()>3_000_000)throw ApiError.of(503,"MAP_UNAVAILABLE","지도 정보를 받지 못했어요.");
            return json.readTree(res.body());
        }catch(ApiError e){throw e;}catch(Exception e){throw ApiError.of(503,"MAP_UNAVAILABLE","지도 연결에 문제가 있어요.");}
    }
    @PostMapping("/locations/search") public Map<String,Object> search(@RequestHeader("Authorization") String auth,@RequestBody Map<String,String> body) {
        sessions.require(auth);String query=body.getOrDefault("query","").trim();
        if(query.isBlank()||query.length()>100)throw ApiError.of(422,"INVALID_INPUT","출발 주소를 입력해 주세요.");
        var data=request("/v2/local/search/address.json?query="+URLEncoder.encode(query,java.nio.charset.StandardCharsets.UTF_8));
        var candidates=new ArrayList<Map<String,Object>>();
        for(var doc:data.path("documents")){if(candidates.size()>=10)break;candidates.add(Map.of("label",doc.path("address_name").asText(),"longitude",doc.path("x").asDouble(),"latitude",doc.path("y").asDouble()));}
        return Map.of("items",candidates);
    }
    public record Coordinates(double longitude,double latitude){}
    public record RouteRequest(String occurrenceId,String expectedVersionId,Coordinates originCoordinates,String mode,boolean locationConsent){}
    @PostMapping("/programs/{id}/routes") public Map<String,Object> route(@RequestHeader("Authorization") String auth,@PathVariable String id,@RequestBody RouteRequest body) {
        sessions.require(auth);if(!body.locationConsent)throw ApiError.of(403,"CONSENT_REQUIRED","출발지를 지도 제공자에게 전송하는 안내를 확인해 주세요.");
        var p=api.visible(id);Api.checkVersion(p,body.expectedVersionId);var dest=p.occurrence(body.occurrenceId);
        if(dest.longitude()==null||dest.latitude()==null||dest.placeFactIds().isEmpty())throw ApiError.of(422,"DESTINATION_UNVERIFIED","활동 장소 좌표를 먼저 확인해야 해요.");
        var from=body.originCoordinates;
        if(from==null||!Double.isFinite(from.longitude)||!Double.isFinite(from.latitude)||Math.abs(from.longitude)>180||Math.abs(from.latitude)>90)throw ApiError.of(422,"INVALID_INPUT","선택한 출발지를 확인해 주세요.");
        if(!Set.of("walk","publicTransit").contains(body.mode))throw ApiError.of(422,"INVALID_INPUT","이동 방식을 선택해 주세요.");
        String path="/v2/routing/"+(body.mode.equals("walk")?"walk":"publictraffic")+"?start_x="+from.longitude+"&start_y="+from.latitude+"&end_x="+dest.longitude()+"&end_y="+dest.latitude();
        var result=request(path);var route=body.mode.equals("walk")?result.path("route"):result.path("routes").path(0);
        if(route.isMissingNode())throw ApiError.of(422,"ROUTE_NOT_FOUND","경로 확인이 필요해요. 공식 지도에서 다시 확인할 수 있어요.");
        var steps=new ArrayList<String>();
        if(body.mode.equals("walk")){for(var leg:route.path("legs"))addSteps(leg.path("steps"),steps);}else addSteps(route.path("steps"),steps);
        var out=new LinkedHashMap<String,Object>();out.put("steps",steps);out.put("estimatedSeconds",route.path("properties").path("totalTime").isNumber()?route.path("properties").path("totalTime").asInt():null);
        out.put("fetchedAt",Instant.now().toString());out.put("destination",dest.address());out.put("accessibility","무장애 경로 확인 필요");
        // Origin coordinates are not persisted, logged, or passed to an LLM.
        return out;
    }
    void addSteps(JsonNode nodes,List<String> steps){for(var node:nodes){String text=node.path("properties").path("guidance").asText();if(!text.isBlank()&&steps.size()<50)steps.add(text);}}
}
