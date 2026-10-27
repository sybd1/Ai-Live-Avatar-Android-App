package kr.ongi.firststep;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import java.util.*;

@RestControllerAdvice
public class ErrorAdvice {
    @ExceptionHandler(ApiError.class) ResponseEntity<?> api(ApiError e){return response(e.status,e.code,e.getMessage());}
    @ExceptionHandler({MethodArgumentNotValidException.class,org.springframework.http.converter.HttpMessageNotReadableException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class,org.springframework.web.bind.MissingRequestHeaderException.class})
    ResponseEntity<?> invalid(Exception ignored){return response(422,"INVALID_INPUT","입력 내용을 확인해 주세요.");}
    @ExceptionHandler(MaxUploadSizeExceededException.class) ResponseEntity<?> large(Exception ignored){return response(422,"AUDIO_TOO_LARGE","녹음 파일이 너무 커요.");}
    @ExceptionHandler(Exception.class) ResponseEntity<?> error(Exception ignored){return response(500,"INTERNAL_ERROR","처리 중 문제가 생겼어요. 다시 시도하거나 잠시 쉴 수 있어요.");}
    private ResponseEntity<?> response(int status,String code,String message){return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(Map.of("error",Map.of("code",code,"message",message,"retryable",status>=500,"requestId",UUID.randomUUID().toString())));}
}
