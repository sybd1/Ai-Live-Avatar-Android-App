package kr.ongi.firststep;

public class ApiError extends RuntimeException {
    final int status;
    final String code;
    ApiError(int status, String code, String message) { super(message); this.status=status; this.code=code; }
    static ApiError of(int status, String code, String message) { return new ApiError(status,code,message); }
}
