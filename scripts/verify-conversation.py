"""One real Gemini turn with a synthetic greeting, through the local API limits."""
import json
import urllib.request
import urllib.error

base = 'http://127.0.0.1:8080/api/v1'
token = None


def call(path, data=None, method=None):
    body = json.dumps(data, ensure_ascii=False).encode() if data is not None else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(base + path, body, headers, method=method or ('POST' if data is not None else 'GET'))
    try:
        with urllib.request.urlopen(request, timeout=85) as response:
            return None if response.status == 204 else json.load(response)
    except urllib.error.HTTPError as error:
        payload = json.load(error)
        raise RuntimeError(f"HTTP {error.code}: {payload.get('error', {}).get('code', 'unknown')}") from None


token = call('/sessions', {'consentFlags': {'syntheticOnly': True, 'voiceProcessing': True, 'preferenceAnalysis': False}})['sessionToken']
try:
    program = call('/programs')['items'][0]['program']
    practice = call('/practices', {'programId': program['id'], 'occurrenceId': program['occurrences'][0]['id'],
                                 'expectedVersionId': program['versionId'], 'sceneTemplateId': 'greeting',
                                 'difficulty': 'short', 'aiConsent': True})
    reply = call('/practices/' + practice['practiceId'] + '/turns',
                 {'requestId': 'synthetic-greeting', 'generation': practice['generation'],
                  'expectedTurn': practice['expectedTurn'], 'confirmedText': '안녕하세요.'})
    assert reply['kind'] == 'roleplay' and reply['approvedText'] and not reply['factRefs']
    print('PASS synthetic greeting roleplay; validated caption; audio:', bool(reply.get('audioToken')))
finally:
    call('/sessions/current', method='DELETE')
