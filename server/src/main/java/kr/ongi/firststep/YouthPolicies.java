package kr.ongi.firststep;

import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// Read-only lookup of 온통청년 youth policies. Results are shown as provider data with the official link;
// they are never imported into the reviewed program catalogue or used as practice facts.
@RestController
@RequestMapping("/api/v1")
public class YouthPolicies {
    static final String DEFAULT_URL="https://www.youthcenter.go.kr/go/ythip/getPlcy";
    static final String DETAIL_URL="https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/";
    record Cached(Map<String,Object> value,Instant expires){}
    final Settings config;final Sessions sessions;
    final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    final JsonMapper json=JsonMapper.builder().build();
    final Map<String,Cached> cache=new ConcurrentHashMap<>();
    static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(YouthPolicies.class);
    public YouthPolicies(Settings config,Sessions sessions){this.config=config;this.sessions=sessions;}
    boolean ready(){return !config.text("YOUTH_POLICY_API_KEY","").isBlank();}

    JsonNode request(Map<String,String> params) {
        if(!ready())throw ApiError.of(503,"POLICY_UNAVAILABLE","청년정책 연결이 아직 설정되지 않았어요. 온통청년에서 직접 찾아볼 수 있어요.");
        var query=new StringBuilder("apiKeyNm=").append(URLEncoder.encode(config.text("YOUTH_POLICY_API_KEY",""),StandardCharsets.UTF_8)).append("&rtnType=json");
        params.forEach((k,v)->query.append('&').append(k).append('=').append(URLEncoder.encode(v,StandardCharsets.UTF_8)));
        try {
            var req=HttpRequest.newBuilder(URI.create(config.text("POLICY_PROVIDER_BASE_URL",DEFAULT_URL)+"?"+query)).timeout(Duration.ofSeconds(12)).GET().build();
            var res=http.send(req,HttpResponse.BodyHandlers.ofString());
            if(res.body().length()>5_000_000)throw ApiError.of(503,"POLICY_UNAVAILABLE","청년정책 정보를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
            JsonNode body;try{body=json.readTree(res.body());}catch(Exception e){body=json.createObjectNode();}
            // The provider answers an invalid key with HTTP 403 and errorCode e001; other 403s are usually network blocks.
            if(body.has("errorCode")){log.warn("youth policy provider error {} (HTTP {})",body.path("errorCode").asText(),res.statusCode());throw ApiError.of(503,"POLICY_UNAVAILABLE","청년정책 인증키를 확인해야 해요.");}
            if(res.statusCode()!=200||body.path("resultCode").asInt()!=200){log.warn("youth policy provider HTTP {}",res.statusCode());throw ApiError.of(503,"POLICY_UNAVAILABLE","청년정책 정보를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.");}
            return body.path("result");
        }catch(ApiError e){throw e;}catch(Exception e){throw ApiError.of(503,"POLICY_UNAVAILABLE","청년정책 연결에 문제가 있어요.");}
    }
    Map<String,Object> cached(String key,java.util.function.Supplier<Map<String,Object>> load) {
        var now=Instant.now();var hit=cache.get(key);
        if(hit!=null&&hit.expires.isAfter(now))return hit.value;
        var value=load.get();
        if(cache.size()>200)cache.entrySet().removeIf(e->e.getValue().expires.isBefore(now));
        if(cache.size()<=200)cache.put(key,new Cached(value,now.plusSeconds(600)));
        return value;
    }

    @GetMapping("/youth-policies") public Map<String,Object> list(@RequestHeader("Authorization") String auth,
        @RequestParam(defaultValue="") String search,@RequestParam(defaultValue="1") int page) {
        sessions.require(auth);String q=search.trim();
        if(q.length()>50||page<1||page>100)throw ApiError.of(422,"INVALID_INPUT","검색어와 페이지를 확인해 주세요.");
        return cached("list:"+page+":"+q,()->{
            var params=new LinkedHashMap<String,String>();params.put("pageNum",""+page);params.put("pageSize","10");
            if(!q.isBlank())params.put("plcyNm",q);
            var result=request(params);var items=new ArrayList<Map<String,Object>>();
            for(var n:result.path("youthPolicyList"))items.add(summary(n));
            int total=result.path("pagging").path("totCount").asInt(items.size());
            var out=new LinkedHashMap<String,Object>();out.put("items",items);out.put("total",total);
            out.put("nextPage",page*10<total&&page<100?page+1:null);out.put("fetchedAt",Instant.now().toString());out.put("source","온통청년");
            return out;
        });
    }
    @GetMapping("/youth-policies/{id}") public Map<String,Object> detail(@RequestHeader("Authorization") String auth,@PathVariable String id) {
        sessions.require(auth);
        if(!id.matches("[A-Za-z0-9]{1,40}"))throw ApiError.of(404,"NOT_FOUND","정책을 찾을 수 없어요.");
        return cached("detail:"+id,()->{
            var list=request(Map.of("pageNum","1","pageSize","1","plcyNo",id)).path("youthPolicyList");
            if(list.isEmpty()||!id.equals(list.path(0).path("plcyNo").asText()))throw ApiError.of(404,"NOT_FOUND","정책을 찾을 수 없어요.");
            var n=list.path(0);var out=new LinkedHashMap<>(summary(n));
            out.put("support",text(n,"plcySprtCn"));out.put("applyMethod",text(n,"plcyAplyMthdCn"));out.put("screening",text(n,"srngMthdCn"));
            out.put("documents",text(n,"sbmsnDcmntCn"));out.put("conditions",text(n,"addAplyQlfcCndCn"));out.put("excluded",text(n,"ptcpPrpTrgtCn"));
            out.put("etc",text(n,"etcMttrCn"));out.put("businessPeriod",period(text(n,"bizPrdBgngYmd"),text(n,"bizPrdEndYmd")));
            out.put("applyUrl",link(text(n,"aplyUrlAddr")));out.put("referenceUrl",link(text(n,"refUrlAddr1")));
            out.put("updatedAt",text(n,"lastMdfcnDt"));out.put("fetchedAt",Instant.now().toString());out.put("source","온통청년");
            return out;
        });
    }
    static Map<String,Object> summary(JsonNode n) {
        var out=new LinkedHashMap<String,Object>();String id=text(n,"plcyNo");
        out.put("id",id);out.put("title",text(n,"plcyNm"));out.put("summary",text(n,"plcyExplnCn"));
        out.put("category",String.join(" · ",java.util.stream.Stream.of(text(n,"lclsfNm"),text(n,"mclsfNm")).filter(Objects::nonNull).toList()));
        String organizer=text(n,"sprvsnInstCdNm");out.put("organizer",organizer!=null?organizer:text(n,"rgtrInstCdNm"));
        out.put("region",text(n,"rgtrHghrkInstCdNm"));out.put("applyPeriod",text(n,"aplyYmd"));
        // sprtTrgtAgeLmtYn=Y means the provider states there is no age limit.
        boolean noLimit="Y".equals(text(n,"sprtTrgtAgeLmtYn"));
        out.put("minAge",noLimit?null:age(text(n,"sprtTrgtMinAge")));out.put("maxAge",noLimit?null:age(text(n,"sprtTrgtMaxAge")));out.put("ageUnlimited",noLimit);
        out.put("officialUrl",DETAIL_URL+URLEncoder.encode(id==null?"":id,StandardCharsets.UTF_8));
        return out;
    }
    static String text(JsonNode n,String field){String s=n.path(field).asText("").trim();return s.isEmpty()?null:s;}
    static Integer age(String s){try{int v=Integer.parseInt(s);return v>0&&v<120?v:null;}catch(Exception e){return null;}}
    static String period(String start,String end){return start==null&&end==null?null:Objects.requireNonNullElse(start,"확인 필요")+" ~ "+Objects.requireNonNullElse(end,"확인 필요");}
    // Provider links are often schemeless ("www.example.kr"); only HTTPS links are passed to the app.
    static String link(String raw) {
        if(raw==null)return null;String s=raw.startsWith("http://")||raw.startsWith("https://")?raw:"https://"+raw;
        try{var u=URI.create(s);return "https".equals(u.getScheme())&&u.getHost()!=null&&u.getUserInfo()==null&&u.getHost().contains(".")?s:null;}catch(Exception e){return null;}
    }
}
