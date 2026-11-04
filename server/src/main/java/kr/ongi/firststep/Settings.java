package kr.ongi.firststep;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class Settings {
    private final Environment env;
    public Settings(Environment env) { this.env=env; }
    String text(String key,String fallback) { String s=env.getProperty(key);return s==null||s.isBlank()?fallback:s; }
    boolean flag(String key) { return "true".equalsIgnoreCase(text(key,"false")); }
    int number(String key,int fallback) { try{return Integer.parseInt(text(key,""+fallback));}catch(NumberFormatException e){return fallback;} }
    boolean aiReady() { return flag("AI_ENABLED") && !text("GEMINI_API_KEY","").isBlank() && "synthetic".equals(text("AI_DATA_MODE","synthetic")); }
}
