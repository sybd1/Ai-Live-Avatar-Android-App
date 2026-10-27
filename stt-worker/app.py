import asyncio
import hmac
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from faster_whisper import WhisperModel
import av
import numpy as np

model = None
lock = asyncio.Lock()
token = os.getenv("STT_WORKER_TOKEN", "")


@asynccontextmanager
async def lifespan(app):
    global model
    folder = os.getenv("STT_MODEL_PATH", "")
    if not token or not Path(folder).is_dir() or not folder:
        raise RuntimeError("STT_WORKER_TOKEN과 승인된 로컬 STT_MODEL_PATH가 필요합니다.")
    model = WhisperModel(folder, device=os.getenv("STT_DEVICE", "cpu"),
                         compute_type=os.getenv("STT_COMPUTE_TYPE", "int8"), local_files_only=True)
    yield
    model = None


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
async def health():
    return {"ready": model is not None}


def recognize(path):
    chunks, samples = [], 0
    with av.open(path) as container:
        resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
        for frame in container.decode(audio=0):
            for output in resampler.resample(frame):
                values = output.to_ndarray().reshape(-1)
                samples += values.size
                if samples > 1_040_000:
                    raise ValueError("duration")
                chunks.append(values.copy())
    if not chunks:
        return ""
    audio = np.concatenate(chunks).astype(np.float32) / 32768.0
    segments, info = model.transcribe(audio, language="ko", beam_size=5, vad_filter=True,
                                      condition_on_previous_text=False)
    if info.duration > 65:
        raise ValueError("duration")
    text = " ".join(s.text.strip() for s in segments if s.no_speech_prob < 0.6).strip()
    if len(text) > 1000:
        raise ValueError("length")
    return text


@app.post("/transcribe")
async def transcribe(request: Request):
    if not token or not hmac.compare_digest(request.headers.get("authorization", ""), "Bearer " + token):
        raise HTTPException(401, "unauthorized")
    allowed = {"audio/mp4": ".m4a", "audio/m4a": ".m4a", "audio/x-m4a": ".m4a",
               "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mpeg": ".mp3"}
    suffix = allowed.get(request.headers.get("content-type", ""))
    if not suffix:
        raise HTTPException(415, "unsupported")
    if lock.locked():
        raise HTTPException(429, "busy")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 10_000_000:
            raise HTTPException(413, "too_large")
    async with lock:
        fd, name = tempfile.mkstemp(suffix=suffix)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
            data.clear()
            # Keep the lock until inference finishes even if the HTTP client disconnects.
            task = asyncio.create_task(asyncio.to_thread(recognize, name))
            try:
                text = await asyncio.shield(task)
            except asyncio.CancelledError:
                await task
                raise
            return {"transcript": text}
        except Exception:
            raise HTTPException(422, "unrecognized")
        finally:
            data.clear()
            Path(name).unlink(missing_ok=True)
