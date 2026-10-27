export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
let token: string | null = null;
let voiceConsent=false;
export const hasVoiceConsent=()=>voiceConsent;
let baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
export const getBaseUrl = () => baseUrl;
export const clearSession = () => { token = null; voiceConsent=false; };
export function configureServer(url: string) {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('서버 주소를 확인해 주세요.');
  const next = url.replace(/\/$/, '');
  if (baseUrl !== next) token = null;
  baseUrl = next;
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!baseUrl) throw new ApiError('SERVER_REQUIRED', '시연 서버 주소를 입력해 주세요.');
  const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 85000);
  const original = options.signal; const cancel = () => abort.abort();
  original?.addEventListener('abort', cancel, { once: true }); if (original?.aborted) abort.abort();
  try {
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const res = await fetch(`${baseUrl}/api/v1${path}`, { ...options, headers, signal: abort.signal });
    if (!res.ok) { const data = await res.json().catch(() => ({})); if (res.status === 401) token = null; throw new ApiError(data.error?.code ?? 'CONNECTION_FAILED', data.error?.message ?? '연결을 확인해 주세요.'); }
    return res.status === 204 ? undefined as T : res.json();
  } catch (e) { if (e instanceof ApiError) throw e; if(e instanceof Error && e.name==='AbortError') throw new ApiError(original?.aborted?'CANCELLED':'UPSTREAM_TIMEOUT',original?.aborted?'연습을 멈췄어요.':'응답 대기가 길어졌어요. 다시 시도하거나 잠깐 쉴 수 있어요.'); throw new ApiError('CONNECTION_FAILED', '서버 연결을 확인하고 다시 시도해 주세요.'); }
  finally { clearTimeout(timeout); original?.removeEventListener('abort', cancel); }
}
export const post = <T>(path: string, body: unknown, signal?: AbortSignal) => request<T>(path, { method: 'POST', body: JSON.stringify(body), signal });
export async function startSession(voice: boolean, preference: boolean) {
  if (token) await request('/sessions/current', { method: 'DELETE' });
  const data = await post<{ sessionToken: string }>('/sessions', { consentFlags: { syntheticOnly: true, voiceProcessing: voice, preferenceAnalysis: preference } });
  token = data.sessionToken;
  voiceConsent=voice;
}
export async function audioBase64(path: string, signal?: AbortSignal): Promise<string> {
  if (!token) throw new ApiError('SESSION_EXPIRED', '새 세션을 시작해 주세요.');
  const res = await fetch(`${baseUrl}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!res.ok) throw new ApiError('AUDIO_EXPIRED', '음성을 다시 준비해야 해요.');
  const blob = await res.blob(); if (blob.size > 5_000_000) throw new Error('음성 크기 제한을 넘었어요.');
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onloadend = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });
}
export const requestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function createLiveSocket(practiceId:string):WebSocket{
 if(!token)throw new ApiError('SESSION_EXPIRED','새 시연 세션을 시작해 주세요.');
 // React Native's native WebSocket supports handshake headers; browser sockets do not.
 const NativeSocket=WebSocket as unknown as {new(url:string,protocols:string[],options:{headers:Record<string,string>}):WebSocket};
 return new NativeSocket(baseUrl.replace(/^http/,'ws')+`/api/v1/practices/${encodeURIComponent(practiceId)}/live`,[],{headers:{Authorization:`Bearer ${token}`}});
}
