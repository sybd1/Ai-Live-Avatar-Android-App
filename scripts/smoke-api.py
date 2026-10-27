"""Local smoke test. --live-ai explicitly enables Gemini calls with synthetic utterances only."""
import argparse
import concurrent.futures
import json
import time
import urllib.request
import urllib.error

parser=argparse.ArgumentParser()
parser.add_argument('--live-ai',action='store_true')
args=parser.parse_args()
base='http://127.0.0.1:8080/api/v1'
def call(path,method='GET',data=None,token=None,expected=200):
    body=json.dumps(data,ensure_ascii=False).encode() if data is not None else None
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    request=urllib.request.Request(base+path,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=85) as response:
            assert response.status==expected,(path,response.status)
            return json.load(response) if expected!=204 else None
    except urllib.error.HTTPError as error:
        if error.code!=expected:raise
        return json.load(error)
def session():
    return call('/sessions','POST',{'consentFlags':{'syntheticOnly':True,'voiceProcessing':True,'preferenceAnalysis':True}})['sessionToken']

caps=call('/capabilities');assert caps['syntheticOnly'] and not caps['demoMode']
token=session();other=session()
try:
    listing=call('/programs',token=token)
    assert listing['items'] and all(not x['program']['synthetic'] for x in listing['items'])
    p=listing['items'][0]['program'];o=p['occurrences'][0]
    assert p['title']=='따뜻한 집'
    setup={'programId':p['id'],'occurrenceId':o['id'],'expectedVersionId':p['versionId'],'sceneTemplateId':'greeting','difficulty':'short','aiConsent':False}
    call('/practices','POST',setup,token,403)
    setup['aiConsent']=True;practice=call('/practices','POST',setup,token);pid=practice['practiceId']
    call('/practices/'+pid+'/context',token=other,expected=404)
    first=call('/practices/'+pid+'/pause','POST',{'requestId':'pause-once'},token)
    second=call('/practices/'+pid+'/pause','POST',{'requestId':'pause-once'},token)
    assert first['generation']==second['generation']
    state=call('/practices/'+pid+'/resume','POST',{'requestId':'resume-once'},token)
    print('PASS official catalogue, AI consent, ownership, idempotent pause/resume')
    if args.live_ai:
        for i,text in enumerate(['활동 날짜가 언제예요?','준비물은 무엇을 가져가야 하나요?']):
            started=time.monotonic()
            data={'requestId':'live-fact-'+str(i),'generation':state['generation'],'expectedTurn':i,'confirmedText':text}
            output=call('/practices/'+pid+'/turns','POST',data,token)
            if i==0:assert output['kind']=='fact' and output['factRefs']
            else:assert output['kind']=='unknown' and not output['factRefs']
            if output.get('audioToken'):
                req=urllib.request.Request(base+'/practices/'+pid+'/audio/'+output['audioToken'],headers={'Authorization':'Bearer '+token})
                with urllib.request.urlopen(req,timeout=10) as res:
                    assert res.read(4)==b'RIFF' and res.headers.get('Cache-Control')=='no-store'
            duplicate=call('/practices/'+pid+'/turns','POST',data,token)
            assert duplicate['turnId']==output['turnId']
            print('PASS',output['kind'],'source boundary, audio',bool(output.get('audioToken')),'seconds',round(time.monotonic()-started,2))
        # Stop while a genuine provider request is in flight. No delayed audio may be committed.
        data={'requestId':'live-cancel','generation':state['generation'],'expectedTurn':2,'confirmedText':'안녕하세요. 인사 한마디를 연습하고 싶어요.'}
        with concurrent.futures.ThreadPoolExecutor() as pool:
            task=pool.submit(call,'/practices/'+pid+'/turns','POST',data,token,409)
            time.sleep(0.2)
            call('/practices/'+pid+'/pause','POST',{'requestId':'pause-in-flight'},token)
            result=task.result(timeout=85)
            assert result['error']['code']=='PRACTICE_PAUSED'
        print('PASS live cancellation discards delayed generation')
        state=call('/practices/'+pid+'/resume','POST',{'requestId':'resume-for-preference'},token)
        statement='저는 요리 활동에 관심이 있고 오프라인으로 참여하고 싶어요.'
        call('/practices/'+pid+'/turns','POST',{'requestId':'explicit-preference','generation':state['generation'],'expectedTurn':state['expectedTurn'],'confirmedText':statement},token)
        call('/practices/'+pid+'/end','POST',{'requestId':'end-for-preference'},token)
        candidates=call('/practices/'+pid+'/preference-candidates','POST',{},token)['candidates']
        assert any(x['field']=='interests' and x['value']=='요리' for x in candidates)
        assert all(x['evidence'] and x['evidence'] in statement for x in candidates)
        before=call('/profile',token=token)
        assert before['interests']==[] and before['modes']==[]
        confirmed={**before,'interests':['요리'],'modes':['오프라인']}
        saved=call('/profile','PUT',confirmed,token)
        assert saved['interests']==['요리'] and saved['modes']==['오프라인']
        print('PASS explicit preference evidence, no automatic profile write, confirmed-only profile update')
    call('/practices/'+pid+'/end','POST',{'requestId':'end'},token)
finally:
    call('/sessions/current','DELETE',token=token,expected=204)
    call('/sessions/current','DELETE',token=other,expected=204)
call('/profile',token=token,expected=401)
print('PASS deleted session cannot access profile')
