"""Inspect and operate only the dedicated Android MVP emulator for functional checks."""
import argparse
import re
import subprocess
import xml.etree.ElementTree as ET
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ADB=str(Path(__file__).resolve().parent.parent/'.tools/android-sdk/platform-tools/adb.exe')
def adb(*args):
    return subprocess.run([ADB,'-s','emulator-5554',*args],check=True,capture_output=True).stdout.decode('utf-8',errors='replace')
def nodes():
    adb('shell','uiautomator','dump','/sdcard/firststep-ui.xml')
    return list(ET.fromstring(adb('shell','cat','/sdcard/firststep-ui.xml')).iter('node'))
def label(n):return n.get('text') or n.get('content-desc') or ''
parser=argparse.ArgumentParser();parser.add_argument('action',choices=['dump','tap','up','down']);parser.add_argument('text',nargs='?',default='');parser.add_argument('--quiet',action='store_true');args=parser.parse_args()
if args.action=='tap':
    found=[]
    for n in nodes():
        if args.text not in label(n):continue
        box=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
        if len(box)!=4 or box[3]-box[1]<20:continue
        found.append((n.get('clickable')!='true',box))
    if not found:raise SystemExit('Visible target not found; inspect or scroll first.')
    box=sorted(found,key=lambda p:p[0])[0][1];adb('shell','input','tap',str((box[0]+box[2])//2),str((box[1]+box[3])//2))
elif args.action in ('up','down'):
    scroll=next((n for n in nodes() if n.get('scrollable')=='true'),None)
    if scroll is None:raise SystemExit('No scrollable view is visible.')
    x1,y1,x2,y2=map(int,re.findall(r'\d+',scroll.get('bounds')))
    high,low=str(y1+100),str(y2-100)
    start,end=(low,high) if args.action=='up' else (high,low)
    adb('shell','input','swipe',str((x1+x2)//2),start,str((x1+x2)//2),end,'450')
if not args.quiet or args.action=='dump':
    for n in nodes():
        if label(n):print(n.get('class','').split('.')[-1],label(n),n.get('bounds'))
