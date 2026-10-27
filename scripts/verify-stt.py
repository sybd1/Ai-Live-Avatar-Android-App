"""Bounded synthetic-audio checks against the local STT worker. No microphone input."""
import io
import json
import os
import urllib.error
import urllib.request
import wave

base = 'http://127.0.0.1:8091'
token = os.environ['STT_WORKER_TOKEN']


def call(data, status, authenticated=True, content_type='audio/wav'):
    headers = {'Content-Type': content_type}
    if authenticated:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base + '/transcribe', data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            assert response.status == status
            return json.load(response)
    except urllib.error.HTTPError as error:
        assert error.code == status, (error.code, status)


def silence(seconds):
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(bytes(32000 * seconds))
    return output.getvalue()


call(b'not audio', 401, authenticated=False)
call(b'not audio', 415, content_type='text/plain')
call(b'not audio', 422)
assert call(silence(1), 200)['transcript'] == ''
call(silence(66), 422)
print('PASS STT authentication, MIME, invalid audio, silent input, duration boundary')
