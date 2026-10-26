// Run: node tests/verify_v0161.cjs [path/to/plugin.js]
// Hooks are injected in memory only. The shipped plugin has no test exports.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const file=process.argv[2]||require('path').join(__dirname,'..','plugin.js');
const source=fs.readFileSync(file,'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
function setup(options={}) {
 const timers=new Map();let timerId=0,plugin,h,storage={};const calls=[],storageCalls=[],pendingReads=[];
 const mock={multiplier:1,machineState:'idle',workflow:null,profiles:[],fail:null,after:null,...options};
 const host={log(){},emit(){},storage(req){storageCalls.push(copy(req));if(req.type==='write')storage[req.key]=req.data;else pendingReads.push({key:req.key,value:storage[req.key]??null});}};
 let clock=options.now||Date.now();class TestDate extends Date {static now(){return clock;}}
 host.transport={open:async(req)=>{calls.push({transport:'open',req});if(mock.openRaw)return mock.openRaw();return {handle:'raw-test'};},onEvent(handle,fn){mock.rawListener=fn;},send:async(handle,payload)=>{calls.push({transport:'send',handle,payload});if(mock.sendRaw)return mock.sendRaw();},close:async(handle)=>{calls.push({transport:'close',handle});}};
 const context=vm.createContext({console,Date:TestDate,Math,JSON,Map,Promise,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},fetch:async()=>{throw Error('unexpected fetch');}});
 const injection=`globalThis.hooks={state,loadConfig,profileObject,recomputeCalibrationUsability,handleWorkflowUpdated,handleStateUpdate,
 verifyAndRepairSelectedHyperExProfile,syncHyperExProfile,runtimeProfileTruthPayload,adaptiveHistoryFingerprint,adaptiveHistoryFingerprintKey,
 numericLearningFingerprintKey,trustedAdaptiveRun,restoreAdaptiveHistoryFromPersistentFile,previousMatchingAdaptiveEvidence,nextShotAdaptiveSuggestion,rememberAdaptiveEvidence,
 compactPersistentShotRecord,persistHistoryFile,appendPersistentHistoryShot,startPersistentHistoryProbe,setPersistentHistoryUnavailable,
 startDiagnostics,finalizeCalibrationRun,clearAllTimers,stage1StartupMetrics,stage3StabilityDiagnostics,diagnosticSummary,scalarConsensusSuggestion,stage1AdaptiveEvidence,stage2AdaptiveEvidence,stage3AdaptiveEvidence,
 testOverrideBinding,recordNextShotApplied,buildSkinSurfaceAnswer,refreshLearningStage,commandFlowSummary,baselineFeedForwardPayload,buildGhcOverlayHtml,stageActuatorEvidence,adaptiveAuditPayload,autoApplyNextShotIfEligible,testOverrideStatus,resetSequence,startSequence,stage3ShapeOnlyConsensus,applyNextShotAdaptiveSuggestion,extractMachine,profilesEquivalent,profileExecutionEquivalent,profileExecutionDifferences,
 workflowBrewTemperature,adoptWorkflowBrewTemperature,controlRunReview,controlLearningAssessment,initializeLiveTrim,startLiveTrim,liveTrimTick,stopLiveTrim,observeLiveTrimMachine,encodeLiveFlowFrame,liveTrimLearningView,liveTrimRegression,diagnosticCsv,
 beginSoak,beginDirectStartTest,restartPourConfirmed,startRestartPoll,manualRearmSecondStage,directStartTestPayload,advancedSettingsFromCfg,uiStatusPayload,
 enterHyperExScopedMultiplier,restoreHyperExScopedMultiplier,setApi(fn){api=fn;}};\n`;
 const token='  return {\n    id: ID,';assert(source.includes(token));
 vm.runInContext(source.replace(token,injection+token),context);plugin=context.createPlugin(host);h=context.hooks;
 const s=h.state;s.cfg=h.loadConfig({});s.cfg.basketContext='empty';s.scopeMode='off';s.calibrationStorageLoaded=true;s.overrideStorageLoaded=true;s.scopeStorageLoaded=true;s.scopedOriginalStorageLoaded=true;
 s.calibrationMap={schema:3,valid:true,createdAt:'fixture-cal',baseFlowMultiplier:1,algorithm:'test',points:[{actualFlow:1.5,commandFlow:.569},{actualFlow:2,commandFlow:.719},{actualFlow:5,commandFlow:2.507}]};
 s.flowMultiplierCurrent=1;h.recomputeCalibrationUsability();s.workflowTitle=s.cfg.profileTitle;
 const expected=copy(h.profileObject());mock.workflow=mock.workflow||copy(expected);mock.profiles=[{id:'hyperex',profile:copy(expected)}];
 h.setApi(async(path,opt={})=>{
  const method=opt.method||'GET';calls.push({path,method,body:opt.body?JSON.parse(opt.body):null});
  if(mock.fail){const error=await mock.fail(path,method,calls);if(error)throw Error(error);}
  let data;
  if(path==='/machine/info')data={model:mock.model||'DE1XL',groupHeadControllerPresent:mock.ghc===undefined?false:mock.ghc};
  else if(path==='/machine/calibration') {if(method==='POST')mock.multiplier=JSON.parse(opt.body).flowMultiplier;data={flowMultiplier:mock.multiplier};}
  else if(path==='/machine/state')data={state:mock.machineState,substate:'idle'};
  else if(path.startsWith('/profiles?'))data=mock.roundtrip?mock.profiles.map(r=>({...r,profile:decaidRoundTrip(r.profile)})):mock.profiles;
  else if(path==='/profiles'||path.startsWith('/profiles/')){const body=JSON.parse(opt.body);data={id:'hyperex',profile:body.profile};mock.profiles=[data];}
  else if(path==='/workflow'){if(method==='PUT'){mock.workflow=mock.roundtrip?decaidRoundTrip(JSON.parse(opt.body).profile):JSON.parse(opt.body).profile;if(mock.eventOnPut)h.handleWorkflowUpdated({profile:copy(mock.workflow)});}data={profile:mock.roundtrip?decaidRoundTrip(mock.workflow):copy(mock.workflow)};}
  else if(path==='/machine/profile')data={};
  else if(path.startsWith('/machine/state'))data={};
  else throw Error('unhandled '+method+' '+path);
  if(mock.after)await mock.after(path,method,calls);
  return {ok:true,json:async()=>copy(data)};
 });
 function event(key,value){plugin.onEvent({name:'storageRead',payload:{key,value}});}
 function deliverRead(i=0){const r=pendingReads.splice(i,1)[0];assert(r,'no queued storage read');event(r.key,r.value);return r;}
 function flushReads(){let n=0;while(pendingReads.length){assert(++n<100);deliverRead();}}
 function run(id){const t=timers.get(id);assert(t,'missing timer');timers.delete(id);return t.fn();}
 const writes=()=>calls.filter(c=>c.method==='PUT'||c.method==='POST');
 return {h,s,plugin,expected,mock,calls,writes,timers,run,storage,storageCalls,pendingReads,deliverRead,flushReads,event,advance(ms){clock+=ms;},now(){return clock;}};
}
function evidenceRun(e,id='run') {
 return {runId:id,kind:'hyperex',result:'completed at 100 g',config:{basketContext:e.s.cfg.basketContext,profileTruthVerified:true,profileTruthSchema:3,adaptiveFingerprint:copy(e.h.adaptiveHistoryFingerprint())},summary:{},samples:[],rawScaleSamples:[]};
}
function historyRow(e,id='old'){
 const fp=copy(e.h.adaptiveHistoryFingerprint());return {runId:id,profileTruthVerified:true,profileTruthSchema:3,fingerprint:fp,evidence:{runId:id,profileTruthSchema:3,fingerprint:fp,s2:{runId:id,targetGS:5,command:2.507,measured:6.5}}};
}

test('LUT translates real targets to .719 / 2.507 / .569',()=>{const e=setup();assert.deepEqual(e.expected.steps.map(x=>+x.flow),[.719,2.507,.569]);});
test('matching workflow event cannot arm without GET and upload',async()=>{const e=setup();e.h.handleWorkflowUpdated({profile:e.expected});assert.equal(e.s.runtimeProfileVerified,false);assert.equal(e.s.armed,false);await e.s.profileSyncQueue;assert.equal(e.s.runtimeProfileVerified,true);assert.equal(e.s.armed,true);assert.equal(e.calls.filter(c=>c.path==='/workflow'&&c.method==='GET').length,2);assert.equal(e.writes().filter(c=>c.path==='/workflow').length,0);assert.equal(e.writes().filter(c=>c.path==='/machine/profile').length,1);});
test('old literal profile repaired, uploaded and read back',async()=>{const e=setup({eventOnPut:true});e.mock.workflow.steps.forEach((x,i)=>x.flow=['2','5','1.5'][i]);await e.h.verifyAndRepairSelectedHyperExProfile('test');assert.equal(e.s.runtimeProfileVerified,true);assert.deepEqual(e.mock.workflow.steps.map(x=>+x.flow),[.719,2.507,.569]);assert.deepEqual(e.writes().map(c=>c.path),['/workflow','/machine/profile']);});
test('unchanged repeated verification skips every PUT and POST',async()=>{const e=setup();await e.h.syncHyperExProfile(true);e.calls.length=0;await e.h.syncHyperExProfile(true);assert.equal(e.writes().length,0);assert.equal(e.calls.filter(c=>c.path==='/workflow').length,2);});
test('parallel requests are serialized and do not duplicate uploads',async()=>{const e=setup();await Promise.all([e.h.syncHyperExProfile(true),e.h.syncHyperExProfile(true),e.h.syncHyperExProfile(true)]);assert.equal(e.writes().length,1);});
test('GET failure cannot use cached matching profile',async()=>{const e=setup();e.s.workflowProfile=e.expected;e.mock.fail=(p,m)=>p==='/workflow'&&m==='GET'?'offline':null;await assert.rejects(e.h.syncHyperExProfile(true),/offline/);assert.equal(e.s.armed,false);assert.equal(e.s.runtimeProfileVerified,false);});
test('machine upload failure is fatal to verification',async()=>{const e=setup();e.mock.fail=p=>p==='/machine/profile'?'upload failed':null;await assert.rejects(e.h.syncHyperExProfile(true),/upload failed/);assert.equal(e.s.runtimeProfileVerified,false);assert.equal(e.s.machineProfileAckKey,'');});
test('workflow PUT failure stays unarmed',async()=>{const e=setup();e.mock.workflow.steps[0].flow='2';e.mock.fail=(p,m)=>p==='/workflow'&&m==='PUT'?'put failed':null;await assert.rejects(e.h.syncHyperExProfile(true),/put failed/);assert.equal(e.s.armed,false);assert.equal(e.calls.some(c=>c.path==='/machine/profile'),false);});
test('final readback mismatch fails after upload',async()=>{const e=setup();e.mock.after=(p,m)=>{if(p==='/machine/profile')e.mock.workflow.steps[1].flow='5';};await assert.rejects(e.h.syncHyperExProfile(true),/Final GET/);assert.equal(e.s.runtimeProfileVerified,false);});
test('null workflow does not produce fabricated actual commands',async()=>{const e=setup();e.mock.workflow=null;await assert.rejects(e.h.syncHyperExProfile(true),/no longer selects/);assert.equal(e.h.runtimeProfileTruthPayload().actual,null);assert.equal(e.s.armed,false);});
test('final readback failure clears old acknowledgement',async()=>{const e=setup();let reads=0;e.mock.fail=(p,m)=>p==='/workflow'&&m==='GET'&&++reads===2?'readback failed':null;await assert.rejects(e.h.syncHyperExProfile(true),/readback failed/);assert.equal(e.s.machineProfileAckKey,'');});
test('active phase rejects all profile writes',async()=>{const e=setup();e.s.phase='stage3';await assert.rejects(e.h.syncHyperExProfile(true),/active shot/);assert.equal(e.calls.length,0);});
test('machine espresso blocks even if plugin phase is idle',async()=>{const e=setup({machineState:'espresso'});await assert.rejects(e.h.syncHyperExProfile(true),/Machine is busy/);assert.equal(e.writes().length,0);});
test('shot starting during verification blocks subsequent uploads',async()=>{const e=setup();e.mock.after=p=>{if(p.startsWith('/profiles?'))e.s.phase='stage1';};await assert.rejects(e.h.syncHyperExProfile(true),/active/);assert.equal(e.writes().length,0);assert.equal(e.s.armed,false);});
test('switching workflows mid-verification never arms new workflow',async()=>{const e=setup();e.mock.after=p=>{if(p==='/machine/profile'){e.s.workflowTitle='other';e.s.workflowSelectionRevision++;}};await assert.rejects(e.h.syncHyperExProfile(true),/selection changed/);assert.equal(e.s.armed,false);});
test('away-and-back selection revision invalidates in-flight verification',async()=>{const e=setup();e.mock.after=p=>{if(p==='/machine/profile')e.s.workflowSelectionRevision+=2;};await assert.rejects(e.h.syncHyperExProfile(true),/selection changed/);});
test('expected profile changing mid-flight cannot arm stale commands',async()=>{const e=setup();e.mock.after=p=>{if(p==='/machine/profile')e.s.cfg.stage2Flow=4.8;};await assert.rejects(e.h.syncHyperExProfile(true),/Expected profile changed/);assert.equal(e.s.armed,false);});
test('strict multiplier GET cannot fall back to cached multiplier',async()=>{const e=setup();e.mock.fail=p=>p==='/machine/calibration'?'mult offline':null;await assert.rejects(e.h.syncHyperExProfile(true),/mult offline/);assert.equal(e.writes().length,0);});
test('mismatched actual multiplier blocks arming',async()=>{const e=setup({multiplier:1.2});await assert.rejects(e.h.syncHyperExProfile(true),/matching actual multiplier/);assert.equal(e.writes().length,0);assert.equal(e.h.adaptiveHistoryFingerprint(),null);});
test('missing stored override read blocks premature arming',async()=>{const e=setup();e.s.overrideStorageLoaded=false;await assert.rejects(e.h.syncHyperExProfile(true),/Waiting for stored/);assert.equal(e.s.armed,false);});
test('profile truth reports acknowledgement, not hardware memory readback',async()=>{const e=setup();await e.h.syncHyperExProfile(true);const t=e.h.runtimeProfileTruthPayload();assert.equal(t.verified,true);assert.equal(t.machineUploadAcknowledged,true);assert.equal(t.machineProfileIndependentlyReadBack,false);assert(t.readbackAt);});
test('LUT point change invalidates fingerprint even with same creation date',()=>{const e=setup();const before=e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint());e.s.calibrationMap.points[1].commandFlow=.8;assert.notEqual(before,e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint()));});
test('actual multiplier and real target changes invalidate fingerprint',()=>{const e=setup();const before=e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint());e.s.flowMultiplierCurrent=1.001;assert.notEqual(before,e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint()));e.s.flowMultiplierCurrent=1;e.s.cfg.stage2Flow=4.9;assert.notEqual(before,e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint()));});
test('snapshot fingerprint is not recomputed at shot completion',()=>{const e=setup();const run=evidenceRun(e);const fp=copy(run.config.adaptiveFingerprint);e.s.calibrationMap.points[0].commandFlow=.6;assert.deepEqual(copy(e.h.compactPersistentShotRecord(run,null).fingerprint),fp);assert.equal(e.h.trustedAdaptiveRun(run),false);});
test('old 1.48 truth and interrupted shots cannot suggest numeric changes',()=>{const e=setup();const run=evidenceRun(e);run.config.profileTruthSchema=undefined;assert.equal(e.h.nextShotAdaptiveSuggestion(run),null);run.config.profileTruthSchema=3;run.result='manual stop';assert.equal(e.h.nextShotAdaptiveSuggestion(run),null);});
test('incompatible and legacy rows excluded from persistent restore',()=>{const e=setup();e.s.persistentHistoryAvailable=true;const valid=historyRow(e);const legacy=copy(valid);legacy.runId='legacy';legacy.profileTruthSchema=undefined;const other=copy(valid);other.runId='other';other.fingerprint.actualFlowMultiplier=1.1;e.s.persistentHistoryFile={shots:[legacy,other,valid]};e.h.restoreAdaptiveHistoryFromPersistentFile();assert.deepEqual(copy(e.s.adaptiveHistory.map(x=>x.runId)),['old']);});
test('SESSION ONLY never restores disk evidence and preserves session evidence',()=>{const e=setup();const row=historyRow(e);e.s.persistentHistoryAvailable=false;e.s.persistentHistoryFile={shots:[row]};const session=copy(row.evidence);session.runId='session';e.s.adaptiveHistory=[session];e.h.restoreAdaptiveHistoryFromPersistentFile();assert.deepEqual(copy(e.s.adaptiveHistory.map(x=>x.runId)),['session']);});
test('storage failure removes restored evidence but keeps session rows',()=>{const e=setup();const row=historyRow(e);e.s.persistentHistoryAvailable=true;e.s.persistentHistoryFile={shots:[row]};e.h.restoreAdaptiveHistoryFromPersistentFile();const session=copy(row.evidence);session.runId='session';e.s.adaptiveHistory.push(session);e.h.setPersistentHistoryUnavailable('test failure');assert.deepEqual(copy(e.s.adaptiveHistory.map(x=>x.runId)),['session']);});
test('probe arriving before initial history read cannot overwrite disk',()=>{const e=setup();e.h.startPersistentHistoryProbe();e.deliverRead();assert.equal(e.s.storageProbeVerified,true);assert.equal(e.s.persistentHistoryAvailable,null);assert.equal(e.storageCalls.filter(x=>x.type==='write'&&x.key==='adaptiveHistoryFileV2').length,0);const row=historyRow(e);e.event('adaptiveHistoryFileV2',JSON.stringify({schema:2,shots:[row]}));assert.equal(e.s.persistentHistoryAvailable,null);e.flushReads();assert.equal(e.s.persistentHistoryAvailable,true);assert.equal(e.s.persistentHistoryFile.shots[0].runId,'old');});
test('initial history read arriving before probe is also safe',()=>{const e=setup();e.event('adaptiveHistoryFileV2',JSON.stringify({schema:2,shots:[historyRow(e)]}));assert.equal(e.storageCalls.filter(x=>x.type==='write'&&x.key==='adaptiveHistoryFileV2').length,0);e.h.startPersistentHistoryProbe();e.flushReads();assert.equal(e.s.persistentHistoryAvailable,true);});
test('history file mismatch reports SESSION ONLY despite successful probe',()=>{const e=setup();e.event('adaptiveHistoryFileV2',null);e.h.startPersistentHistoryProbe();e.deliverRead();e.pendingReads[0].value='{}';e.deliverRead();assert.equal(e.s.persistentHistoryAvailable,false);assert.match(e.s.persistentHistoryStatus,/readback mismatch/);});
test('history file timeout reports SESSION ONLY',()=>{const e=setup();e.event('adaptiveHistoryFileV2',null);e.h.startPersistentHistoryProbe();e.deliverRead();e.run(e.s.historyWriteTimer);assert.equal(e.s.persistentHistoryAvailable,false);assert.match(e.s.persistentHistoryStatus,/timed out/);});
test('starting a shot cannot cancel storage verification timeout',()=>{const e=setup();e.h.startPersistentHistoryProbe();const id=e.s.storageProbeTimer;e.h.clearAllTimers();assert(e.timers.has(id));});
test('concurrent history updates serialize and persist newest file',()=>{const e=setup();e.event('adaptiveHistoryFileV2',null);e.h.startPersistentHistoryProbe();e.deliverRead();e.s.persistentHistoryFile.shots.push(historyRow(e,'later'));e.h.persistHistoryFile();assert.equal(e.s.historyWriteDirty,true);e.flushReads();assert.equal(e.s.persistentHistoryAvailable,true);assert.equal(JSON.parse(e.storage.adaptiveHistoryFileV2).shots[0].runId,'later');assert.equal(e.s.pendingHistoryWrite,null);});
test('late initial history read merges new session record without loss',()=>{const e=setup();const old=historyRow(e),fresh=historyRow(e,'fresh');e.s.persistentHistoryFile={schema:2,shots:[fresh]};e.event('adaptiveHistoryFileV2',JSON.stringify({schema:2,shots:[old]}));assert.deepEqual(e.s.persistentHistoryFile.shots.map(x=>x.runId),['old','fresh']);});
test('confirmed next-shot application is stored separately from source evidence',()=>{const e=setup();const row=historyRow(e);e.s.persistentHistoryFile={shots:[row]};e.h.recordNextShotApplied({runId:'old'},{stage2CommandMlS:2.4});assert.equal(row.nextShotApplied.commandFlows.stage2CommandMlS,2.4);assert.equal(row.evidence.s2.command,2.507);});
test('S2 two high-quality HIT measurements HOLD the existing command',()=>{const e=setup();const current={targetGS:5,command:2.507,measured:5.033};const previous={targetGS:5,command:2.507,measured:5.068};const r=e.h.scalarConsensusSuggestion('S2',current,previous,{deadbandPct:12,maxVariability:.15,gain:.25,maxFraction:.05,maxAbs:.1,rule:'test'});assert.equal(r.action,'HOLD');});
test('S2 repeated high flow correction stays within both bounds',()=>{const e=setup();const a={targetGS:5,command:2.507,measured:7.1},b={...a,measured:7.2};const r=e.h.scalarConsensusSuggestion('S2',a,b,{deadbandPct:12,maxVariability:.15,gain:.25,maxFraction:.05,maxAbs:.1,rule:'test'});assert.equal(r.action,'ADJUST');assert(Math.abs(r.suggestedCommandMlS-2.507)<=.1001);assert(Math.abs(r.suggestedCommandMlS/2.507-1)<=.0501);});

function rawSample(phase,t,w,frame=null){return {phase,tMs:t*1000,scaleTimestampSeconds:t,weightG:w,machineFlowMlS:.72,profileFrame:frame};}
function syntheticRun(e,id='synthetic',s3Rates=[1.5,1.5,1.5]) {
 const run=evidenceRun(e,id);
 Object.assign(run.config,{stage1Flow:2,stage1CommandMlS:.719,stage2Flow:5,stage2CommandMlS:2.507,stage3Flow:1.5,stage3CommandMlS:.72,
  stage3Shape:{enabled:true,earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778}});
 for(let i=0;i<=40;i++){const t=i*.2;run.rawScaleSamples.push(rawSample('stage1',t,t<3?0:Math.min((t-3)*2,8)));}
 for(let i=0;i<=50;i++){const t=10+i*.2;run.rawScaleSamples.push(rawSample('stage2',t,(t-10)*5));}
 let w=50;for(let i=0;i<=200;i++){const dt=i*.2,t=25+dt;const rate=dt<10?s3Rates[0]:dt<30?s3Rates[1]:s3Rates[2];if(i)w+=rate*.2;run.rawScaleSamples.push(rawSample('stage3',t,w));}
 for(const r of run.rawScaleSamples)run.samples.push({phase:r.phase,tMs:r.tMs,machineFlowMlS:.72,scaleFlowGS:99,targetFlowMlS:.72,rawScaleDwDtGS:99});
 return run;
}
test('unverified pouring sends Idle only once and never starts diagnostics',async()=>{const e=setup();e.h.handleStateUpdate({state:{state:'espresso',substate:'pouring'}});e.h.handleStateUpdate({state:{state:'espresso',substate:'pouring'}});assert.equal(e.s.phase,'idle');assert.equal(e.s.diagnosticCurrent,null);assert.equal(e.calls.filter(c=>c.path==='/machine/state/idle'&&c.method==='PUT').length,1);});
test('S1 insufficient startup data yields REPEAT without numeric trim',()=>{const e=setup();const r=syntheticRun(e);r.rawScaleSamples=r.rawScaleSamples.filter(x=>x.phase!=='stage1');assert.equal(e.h.stage1AdaptiveEvidence(r),null);const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s1.action,'REPEAT');assert.equal(q.s1.suggestedCommandMlS,undefined);});
test('S1 delay is separate from active flow',()=>{const e=setup();const r=syntheticRun(e);const q=e.h.stage1StartupMetrics(r);assert(q.firstRiseDelayS>=3);assert(Math.abs(q.midFlowGS-2)<.05);assert.equal(q.confidence,'MEDIUM');});
test('S2 uses timestamp regression despite misleading instantaneous derivatives',()=>{const e=setup();const r=syntheticRun(e);const q=e.h.stage2AdaptiveEvidence(r);assert.equal(q.measured,5);assert.equal(q.r2,1);});
test('S3 fallback retains actual .698 / .720 / .778 commands',()=>{const e=setup();const r=syntheticRun(e);const q=e.h.stage3AdaptiveEvidence(r);assert(q);assert.equal(q.measurementBasis,'stability 25/50/25 fallback');assert.deepEqual(copy(q.source.map(x=>x.command)),[.698,.72,.778]);});
test('two matching clean S3 shots produce bounded next-shot LEVEL and SHAPE',()=>{const e=setup();const a=syntheticRun(e,'a',[2.1,1.8,1.5]),b=syntheticRun(e,'b',[2.1,1.8,1.5]);e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b).s3;assert.equal(q.action,'LEVEL + SHAPE');const old=[.698,.72,.778],now=[q.suggestedShape.earlyCommand,q.suggestedShape.midCommand,q.suggestedShape.lateCommand];now.forEach((v,i)=>{assert(Math.abs(v-old[i])<=.0505);assert(Math.abs(v/old[i]-1)<=.071);});assert.equal(e.writes().length,0);});
test('shape factors are normalized independently from S3 level factor',()=>{const e=setup();const a=syntheticRun(e,'a',[2.1,1.8,1.5]),b=syntheticRun(e,'b',[2.1,1.8,1.5]);e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b).s3;const weights=q.sourceFrames.map(x=>x.windowS);const avg=q.shapeFactors.reduce((sum,x,i)=>sum+x*weights[i],0)/weights.reduce((a,b)=>a+b,0);assert(Math.abs(avg-1)<.0002);assert(q.levelFactor<1);});
test('invalid empty calibration retains previous LUT and history',async()=>{const e=setup();const before=JSON.stringify(e.s.calibrationMap);const ev=historyRow(e).evidence;e.s.adaptiveHistory=[ev];e.h.startDiagnostics('calibration');e.s.calibrationActive=true;await e.h.finalizeCalibrationRun('test invalid');assert.equal(JSON.stringify(e.s.calibrationMap),before);assert.equal(e.s.calibrationLast.valid,false);assert.equal(e.s.adaptiveHistory.length,1);});
test('compact history keeps real diagnostic field values',()=>{const e=setup();const r=evidenceRun(e);r.summary.stage2={desiredRealFlowGS:5,rawRegressionGS:5.033,rawRegressionR2:.999,rawRegressionSeconds:8,machineFlowAvg:2.507,gflowAvg:4.9,validationStatus:'HIT',rawErrorPct:.7};const row=e.h.compactPersistentShotRecord(r,null);assert.equal(row.s2.de1Flow,2.507);assert.equal(row.s2.decaidWeightFlow,4.9);assert.equal(row.s2.status,'HIT');assert.equal(row.s2.errorPct,.7);});
test('pressure and phase weight changes isolate old adaptive evidence',()=>{const e=setup();const key=e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint());e.s.cfg.stage2Weight+=1;assert.notEqual(key,e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint()));e.s.cfg.stage2Weight-=1;e.s.cfg.stage3PressureLimit+=.1;assert.notEqual(key,e.h.adaptiveHistoryFingerprintKey(e.h.adaptiveHistoryFingerprint()));});


test('HyperEx-only scope restores calibrated multiplier before verification',async()=>{const e=setup({multiplier:1.2});e.s.scopeMode='hyperex';await e.h.syncHyperExProfile(true);assert.equal(e.mock.multiplier,1);assert.equal(e.s.scopedOriginalMultiplier,1.2);assert.equal(e.s.armed,true);});
test('GLOBAL scope never writes multiplier automatically',async()=>{const e=setup({multiplier:1.2});e.s.scopeMode='global';await assert.rejects(e.h.syncHyperExProfile(true));assert.equal(e.calls.some(x=>x.path==='/machine/calibration'&&x.method==='POST'),false);});
test('selection switch before scoped multiplier write cancels it',async()=>{const e=setup({multiplier:1.2});e.s.scopeMode='hyperex';e.mock.after=p=>{if(p==='/machine/calibration'){e.s.workflowTitle='other';e.s.workflowSelectionRevision++;}};await assert.rejects(e.h.syncHyperExProfile(true),/selection changed/);assert.equal(e.calls.some(x=>x.path==='/machine/calibration'&&x.method==='POST'),false);});
test('leaving scope during multiplier upload restores original multiplier',async()=>{const e=setup({multiplier:1.2});e.s.scopeMode='hyperex';e.mock.after=(p,m)=>{if(p==='/machine/calibration'&&m==='POST'&&e.mock.multiplier===1){e.s.workflowTitle='other';e.s.workflowSelectionRevision++;}};await assert.rejects(e.h.syncHyperExProfile(true),/selection changed/);assert.equal(e.mock.multiplier,1.2);assert.equal(e.s.scopedOriginalMultiplier,null);});
test('failed scoped restore retains saved original multiplier for retry',async()=>{const e=setup();e.s.scopedOriginalMultiplier=1.2;e.mock.fail=(p,m)=>p==='/machine/calibration'&&m==='POST'?'restore failed':null;await e.h.restoreHyperExScopedMultiplier('test');assert.equal(e.s.scopedOriginalMultiplier,1.2);assert.equal(e.s.scopeChangeBusy,false);});

test('verification deferred during espresso retries after machine returns idle',async()=>{const e=setup();e.s.lastMachineState='espresso';e.h.handleWorkflowUpdated({profile:e.expected});assert.equal(e.s.armed,false);assert.equal(e.calls.length,0);e.h.handleStateUpdate({state:'idle',substate:'idle'});await e.s.profileSyncQueue;assert.equal(e.s.armed,true);});

test('late stored scope cannot trigger default HyperEx multiplier writes',async()=>{const e=setup({multiplier:1.2});e.s.scopeMode='hyperex';e.s.scopeStorageLoaded=false;await assert.rejects(e.h.syncHyperExProfile(true),/Waiting for stored/);assert.equal(e.calls.some(x=>x.path==='/machine/calibration'&&x.method==='POST'),false);});
test('late saved-original read cannot overwrite a newly captured multiplier',async()=>{const e=setup({multiplier:1.2});e.s.scopeMode='hyperex';e.s.scopedOriginalStorageLoaded=false;await assert.rejects(e.h.syncHyperExProfile(true),/Waiting for stored/);assert.equal(e.s.scopedOriginalMultiplier,null);assert.equal(e.calls.some(x=>x.path==='/machine/calibration'&&x.method==='POST'),false);});

// Projection of the official Dart Profile.fromJson/toJson and flow/pressure-step
// serializers. Independent of plugin normalization; no legacy import-only keys.
// Reference: https://github.com/decentespresso/decaid/blob/main/lib/src/models/data/profile.dart
function decaidRoundTrip(p) {
 if(!p)return null;
 const optional=v=>v===null||v===undefined||v===''?null:Number(v);
 return {version:p.version==null?null:String(p.version),title:p.title,notes:p.notes||'',author:p.author||'',beverage_type:p.beverage_type||'espresso',
  steps:p.steps.map(s=>({name:s.name,pump:s.pump,transition:s.transition,exit:s.exit?{type:s.exit.type,condition:s.exit.condition,value:Number(s.exit.value)}:null,
   volume:Number(s.volume),seconds:Number(s.seconds),weight:optional(s.weight),temperature:Number(s.temperature),sensor:s.sensor,
   ...(s.pump==='flow'?{flow:Number(s.flow)}:{pressure:Number(s.pressure)}),
   limiter:s.limiter?{value:Number(s.limiter.value),range:Number(s.limiter.range)}:null})),
  target_volume:optional(p.target_volume),target_weight:optional(p.target_weight),target_volume_count_start:Number(p.target_volume_count_start),tank_temperature:Number(p.tank_temperature)};
}
test('real Decaid serialization roundtrip preserves equivalent execution',()=>{const e=setup();const actual=decaidRoundTrip(e.expected);assert.equal(actual.type,undefined);assert.equal(actual.legacy_profile_type,undefined);assert.equal(actual.steps[0].pressure,undefined);assert.equal(e.h.profileExecutionEquivalent(actual,e.expected),true);});
test('matching real DTO workflow arms without unnecessary PUT',async()=>{const e=setup({roundtrip:true});await e.h.syncHyperExProfile(true);assert.equal(e.s.armed,true);assert.equal(e.writes().filter(c=>c.path==='/workflow').length,0);});
test('old literal machine-flow workflow repairs through actual DTO serialization',async()=>{const e=setup({roundtrip:true,eventOnPut:true});e.mock.workflow.steps.forEach((s,i)=>s.flow=['2','5','1.5'][i]);await e.h.syncHyperExProfile(true);assert.equal(e.s.armed,true);assert.deepEqual(e.mock.workflow.steps.map(x=>+x.flow),[.719,2.507,.569]);});
test('repeated DTO roundtrips skip library, workflow and machine rewrites',async()=>{const e=setup({roundtrip:true});await e.h.syncHyperExProfile(true);e.calls.length=0;await e.h.syncHyperExProfile(true);assert.equal(e.writes().length,0);});
test('real DTO S3 seed shape survives readback verification',async()=>{const e=setup({roundtrip:true,eventOnPut:true});e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),s3Shape:{enabled:true,earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778},stages:{}};await e.h.syncHyperExProfile(true);assert.equal(e.s.armed,true);assert.deepEqual(e.mock.workflow.steps.slice(2).map(s=>+s.flow),[.698,.72,.778]);});
test('changed actual flow is never hidden by DTO normalization',()=>{const e=setup();const a=decaidRoundTrip(e.expected);a.steps[0].flow=2;assert.equal(e.h.profileExecutionEquivalent(a,e.expected),false);const d=e.h.profileExecutionDifferences(a,e.expected);assert.equal(d[0].field,'steps[0].flow');assert.equal(d[0].expected,.719);assert.equal(d[0].actual,2);});
test('unexpected step exit condition blocks verification',()=>{const e=setup();const a=decaidRoundTrip(e.expected);a.steps[0].exit={type:'flow',condition:'over',value:1};assert.equal(e.h.profileExecutionEquivalent(a,e.expected),false);});
test('changed limiter, duration, temperature, weight or target blocks equivalence',()=>{const e=setup();for(const mutate of [a=>a.steps[0].limiter.value+=1,a=>a.steps[0].seconds-=1,a=>a.steps[0].temperature+=1,a=>a.steps[0].weight=4,a=>a.target_weight=40,a=>a.steps[0].pump='pressure']){const a=decaidRoundTrip(e.expected);mutate(a);assert.equal(e.h.profileExecutionEquivalent(a,e.expected),false);}});
test('missing required numeric command is not equivalent to zero',()=>{const e=setup();const a=decaidRoundTrip(e.expected);const b=copy(a);a.steps[0].flow=0;delete b.steps[0].flow;assert.equal(e.h.profileExecutionEquivalent(a,b),false);});
test('null and omitted no-exit condition are equivalent',()=>{const e=setup();const a=decaidRoundTrip(e.expected);delete a.steps[0].exit;assert.equal(e.h.profileExecutionEquivalent(a,e.expected),true);});
test('pressure step compares pressure and ignores unused flow',()=>{const e=setup();const p=copy(e.expected);p.steps[0].pump='pressure';p.steps[0].pressure='3';p.steps[0].flow='';const a=decaidRoundTrip(p);assert.equal(e.h.profileExecutionEquivalent(a,p),true);a.steps[0].pressure=4;assert.equal(e.h.profileExecutionEquivalent(a,p),false);});
test('stored-profile equivalence ignores dropped import metadata but preserves author and notes',()=>{const e=setup();const a=decaidRoundTrip(e.expected);assert.equal(e.h.profilesEquivalent(a,e.expected),true);a.notes+='changed';assert.equal(e.h.profilesEquivalent(a,e.expected),false);});
test('mismatch error names the actual field and preserves the guard',async()=>{const e=setup({roundtrip:true});e.mock.after=p=>{if(p==='/machine/profile')e.mock.workflow.steps[1].flow=5;};await assert.rejects(e.h.syncHyperExProfile(true),/steps\[1\]\.flow: expected 2\.507, actual 5/);assert.equal(e.s.armed,false);});
test('truth schema 2 evidence from 1.49 is excluded from new consensus',()=>{const e=setup();const r=evidenceRun(e);r.config.profileTruthSchema=2;assert.equal(e.h.nextShotAdaptiveSuggestion(r),null);});

function photographedS3(which) {
 const data=which===2?{overall:1.790,ratio:.711,rates:[2.06,1.843,1.546],seconds:[5.07,13.41,6.39]}:
 {overall:1.48,ratio:.660,rates:[1.734,1.558,1.182],seconds:[5.02,13.31,12.72]};
 return {targetGS:1.5,status:'LATE DECAY',stall:false,stallQualitative:false,
  overallGS:data.overall,overallR2:.996,lateToEarlyRatio:data.ratio,earlySeconds:8,midSeconds:14,
  measurementBasis:'profile-frame regression',
  source:data.rates.map((measured,i)=>({name:['S3 EARLY','S3 MID','S3 LATE'][i],
   command:[.698,.72,.778][i],measured,r2:.968,seconds:data.seconds[i],quality:'clean'}))};
}
test('photographed shots 2/3 allow SHAPE ONLY while LEVEL stays held',()=>{
 const e=setup(),a=photographedS3(2),b=photographedS3(3),q=e.h.stage3ShapeOnlyConsensus(b,a);
 assert(q);assert.equal(q.action,'SHAPE ONLY / LEVEL HOLD');assert.equal(q.levelFactor,1);
 assert(q.normalizedShapeVariabilityPct<=15);assert(Math.abs(q.weightedCommandChangePct)<=.2);
 const c=[q.suggestedShape.earlyCommand,q.suggestedShape.midCommand,q.suggestedShape.lateCommand];
 assert(c[0]<.698);assert(c[2]>.778);
 c.forEach((x,i)=>{assert(Math.abs(x/[.698,.72,.778][i]-1)<=.04);assert(Math.abs(x-[.698,.72,.778][i])<=.05);});
 assert(c[0]<=c[1]&&c[1]<=c[2]);assert.equal(e.writes().length,0);
});
test('shape-only rejects opposite frame trend even if status says decay',()=>{
 const e=setup(),a=photographedS3(2),b=photographedS3(3);b.source[2].measured=2.3;
 assert.equal(e.h.stage3ShapeOnlyConsensus(b,a),null);
});
test('shape-only rejects different measurement basis and command provenance',()=>{
 const e=setup(),a=photographedS3(2),b=photographedS3(3);
 b.measurementBasis='stability 25/50/25 fallback';assert.equal(e.h.stage3ShapeOnlyConsensus(b,a),null);
 b.measurementBasis=a.measurementBasis;b.source[0].command+=.01;assert.equal(e.h.stage3ShapeOnlyConsensus(b,a),null);
});
test('shape-only rejects weak regressions, short windows and stall evidence',()=>{
 const e=setup(),a=photographedS3(2);
 for(const change of [b=>b.source[0].r2=.94,b=>b.source[1].seconds=2.9,b=>b.stall=true,b=>b.stallQualitative=true,b=>b.overallR2=.94]){
  const b=photographedS3(3);change(b);assert.equal(e.h.stage3ShapeOnlyConsensus(b,a),null);
 }
});
test('shape-only rejects inconsistent normalized shape and excessive level variability',()=>{
 const e=setup(),a=photographedS3(2);
 let b=photographedS3(3);b.source[1].measured=2.4;assert.equal(e.h.stage3ShapeOnlyConsensus(b,a),null);
 b=photographedS3(3);b.overallGS=1;assert.equal(e.h.stage3ShapeOnlyConsensus(b,a),null);
});
test('S1 short clean startup explains rejection without relaxing 0.90 s gate',()=>{
 const e=setup(),r=syntheticRun(e);r.rawScaleSamples=r.rawScaleSamples.filter(x=>x.phase!=='stage1');
 for(let i=0;i<=100;i++){const t=i*.05;r.rawScaleSamples.push(rawSample('stage1',t,t<2.9?0:Math.min(3.3,(t-2.9)*2.834)));}
 const m=e.h.stage1StartupMetrics(r);
 assert(m.transit20to80S<.9);assert.equal(m.confidence,'INSUFFICIENT');
 assert(m.rejectionReasons.includes('20–80% transit < 0.90 s'));
 assert.equal(e.h.stage1AdaptiveEvidence(r),null);
 assert.match(e.h.nextShotAdaptiveSuggestion(r).s1.reason,/transit < 0.90/);
});
test('S1 clean sufficient window reports passed gates and retains MEDIUM evidence',()=>{
 const e=setup(),r=syntheticRun(e),m=e.h.stage1StartupMetrics(r);
 assert.equal(m.rejectionReasons.length,0);assert.equal(m.confidence,'MEDIUM');assert(e.h.stage1AdaptiveEvidence(r));
});
test('varying level with repeated decay reaches shape-only through full RAW evidence pipeline',()=>{
 const e=setup(),a=syntheticRun(e,'a',[2.1,1.843,1.50]),b=syntheticRun(e,'b',[1.734,1.558,1.182]);
 e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b);
 assert.equal(q.s3.action,'SHAPE ONLY / LEVEL HOLD');assert.equal(q.actionable,true);
 assert.equal(q.s2.action,'HOLD');assert.equal(e.writes().length,0);
});
test('shape-only applies only while idle, verifies DTO readback and leaves LUT untouched',async()=>{
 const e=setup({roundtrip:true}),a=syntheticRun(e,'a',[2.1,1.843,1.50]),b=syntheticRun(e,'b',[1.734,1.558,1.182]);
 e.h.rememberAdaptiveEvidence(a);const lut=JSON.stringify(e.s.calibrationMap),snapshot=JSON.stringify(b.config);
 e.s.phase='stage3';await assert.rejects(e.h.applyNextShotAdaptiveSuggestion(b,'auto'),/idle/);
 assert.equal(e.writes().length,0);e.s.phase='idle';
 await e.h.applyNextShotAdaptiveSuggestion(b,'auto');
 assert.equal(e.s.armed,true);assert.equal(e.s.testOverrides.adaptiveSource.mode,'auto');
 assert.equal(JSON.stringify(e.s.calibrationMap),lut);assert.equal(JSON.stringify(b.config),snapshot);
 assert.equal(e.s.testOverrides.stages.stage2.mode,'auto');
 assert.equal(e.mock.workflow.steps[2].flow,e.s.testOverrides.s3Shape.earlyCommand);
});
test('shape-only upload failure preserves previous overrides and cannot arm',async()=>{
 const e=setup({roundtrip:true}),a=syntheticRun(e,'a',[2.1,1.843,1.50]),b=syntheticRun(e,'b',[1.734,1.558,1.182]);
 e.h.rememberAdaptiveEvidence(a);const old=JSON.stringify(e.s.testOverrides);
 e.mock.fail=(p)=>p==='/machine/profile'?'upload failed':null;
 await assert.rejects(e.h.applyNextShotAdaptiveSuggestion(b,'auto'),/upload failed/);
 assert.equal(JSON.stringify(e.s.testOverrides),old);assert.equal(e.s.armed,false);
});

test('rendered diagnostics browser scripts compile and show quality/shape action labels',()=>{
 const e=setup(),html=e.h.buildGhcOverlayHtml();
 const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
 assert(scripts.length>0);scripts.forEach(x=>new vm.Script(x[1]));
 assert.match(html,/Quality:/);assert.match(html,/normalized shape var/);
});

test('Idle burst completes once, preserves pending apply, and automatically verifies the new shape',async()=>{
 const e=setup({roundtrip:true}),a=syntheticRun(e,'before',[2.1,1.8,1.5]),b=syntheticRun(e,'finished',[2.1,1.8,1.5]);
 e.h.rememberAdaptiveEvidence(a);e.s.diagnosticCurrent=b;e.s.phase='finishing';e.s.cumulativeWeight=100;e.s.autoApplyNextShot=true;
 for(let i=0;i<12;i++)e.h.handleStateUpdate({state:'idle',substate:'idle'});
 const completions=[...e.timers].filter(([id,t])=>t.ms===500);
 assert.equal(completions.length,1);
 e.run(completions[0][0]);const timer=e.s.autoApplyTimer;
 assert.equal(e.s.autoApplyLastStatus.status,'scheduled');assert(e.timers.has(timer));
 for(let i=0;i<12;i++)e.h.handleStateUpdate({state:'idle',substate:'idle'});
 assert(e.timers.has(timer));await e.run(timer);
 assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(e.s.autoApplyLastStatus.runId,'finished');
 assert.equal(e.s.testOverrides.adaptiveSource.runId,'finished');assert.equal(e.s.armed,true);
 const writes=e.writes().length;await e.h.autoApplyNextShotIfEligible(b);assert.equal(e.writes().length,writes);
 assert.equal(e.s.persistentHistoryFile.shots.filter(x=>x.runId==='finished').length,1);
});
test('stale completion callback cannot reset a later sequence',()=>{
 const e=setup();e.s.phase='finishing';e.s.sequenceStartedAtMs=1;e.s.diagnosticCurrent=syntheticRun(e,'old');
 e.h.handleStateUpdate({state:'idle',substate:'idle'});const fn=e.timers.get(e.s.completionTimer).fn;
 e.h.startSequence(0);const run=e.s.diagnosticCurrent;fn();
 assert.equal(e.s.phase,'stage1');assert.equal(e.s.diagnosticCurrent,run);assert.equal(e.s.autoApplyTimer,null);
});
test('starting a new shot explicitly cancels pending adaptation without rewriting its commands',()=>{
 const e=setup();e.s.autoApplyNextShot=true;e.s.phase='finishing';e.s.diagnosticCurrent=syntheticRun(e,'done');
 e.h.handleStateUpdate({state:'idle',substate:'idle'});e.run(e.s.completionTimer);
 const id=e.s.autoApplyTimer;assert(e.timers.has(id));e.h.startSequence(0);
 assert(!e.timers.has(id));assert.equal(e.s.autoApplyLastStatus.status,'cancelled');assert.equal(e.writes().length,0);
});
test('auto OFF finalization saves shot without scheduling application',()=>{
 const e=setup();e.s.autoApplyNextShot=false;e.s.phase='finishing';e.s.diagnosticCurrent=syntheticRun(e,'manual');
 e.h.handleStateUpdate({state:'idle',substate:'idle'});e.run(e.s.completionTimer);
 assert.equal(e.s.autoApplyTimer,null);assert.equal(e.s.diagnosticLast.runId,'manual');assert.equal(e.writes().length,0);
});
test('automatic upload failure is an explicit error and never APPLIED',async()=>{
 const e=setup({roundtrip:true}),a=syntheticRun(e,'a',[2.1,1.8,1.5]),b=syntheticRun(e,'b',[2.1,1.8,1.5]);
 e.h.rememberAdaptiveEvidence(a);e.mock.fail=p=>p==='/machine/profile'?'machine offline':null;
 await e.h.autoApplyNextShotIfEligible(b);
 assert.equal(e.s.autoApplyLastStatus.status,'error');assert.match(e.s.autoApplyLastStatus.message,/machine offline/);
 assert.equal(e.s.armed,false);
});
function seedOverride(e,context){
 return {schema:3,writerVersion:'0.1.52',...copy(e.h.testOverrideBinding()),
  ...(context===undefined?{}:{basketContext:context}),stages:{stage1:{mode:'manual',command:.8}},
  s3Shape:{enabled:true,earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778}};
}
test('normal coffee learning is automatic after upgrade without a user mode switch',()=>{
 const e=setup();assert.equal(e.h.loadConfig({}).basketContext,'empty');
 assert.equal(e.h.loadConfig({BasketContext:'Coffee'}).basketContext,'empty');
});
test('coffee preserves empty/legacy commands as baseline priors without losing LUT or records',()=>{
 const e=setup(),lut=JSON.stringify(e.s.calibrationMap);
 const old=seedOverride(e,'empty');e.s.testOverrides=old;
 const records=[historyRow(e)];e.s.persistentHistoryFile={shots:records};e.s.cfg.basketContext='coffee';
 assert.equal(e.h.testOverrideStatus().valid,true);assert.equal(e.h.testOverrideStatus().baselinePrior,true);assert.deepEqual(copy(e.h.profileObject().steps.map(x=>+x.flow)),[.8,2.507,.698,.72,.778]);
 delete old.basketContext;assert.equal(e.h.testOverrideStatus().valid,true);assert.equal(e.h.testOverrideStatus().baselinePrior,true);
 assert.equal(JSON.stringify(e.s.calibrationMap),lut);assert.equal(e.s.persistentHistoryFile.shots,records);
 old.basketContext='coffee';assert.equal(e.h.testOverrideStatus().valid,true);
});
test('coffee overrides cannot leak back into empty-basket commands',()=>{
 const e=setup();e.s.testOverrides=seedOverride(e,'coffee');assert.equal(e.h.testOverrideStatus().valid,false);
});
test('context freezes at shot start and mismatched context invalidates completed-run evidence',()=>{
 const e=setup();e.h.startDiagnostics('hyperex');const r=e.s.diagnosticCurrent;
 assert.equal(r.config.basketContext,'empty');assert.equal(r.config.adaptiveFingerprint.basketContext,'empty');
 e.s.cfg.basketContext='coffee';assert.equal(r.config.basketContext,'empty');
 r.result='completed at 100 g';assert.equal(e.h.trustedAdaptiveRun(r),false);
});
test('old empty and unknown history remain saved but cannot restore into coffee consensus',()=>{
 const e=setup(),a=historyRow(e,'empty'),b=copy(a);b.runId='unknown';delete b.fingerprint.basketContext;
 e.s.persistentHistoryFile={shots:[a,b]};e.s.persistentHistoryAvailable=true;e.s.cfg.basketContext='coffee';
 e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.adaptiveHistory.length,0);
 assert.equal(e.s.persistentHistoryFile.shots.length,2);
});
function coffeeRun(e,id='coffee',rates=[2.1,1.8,1.5]){
 e.s.cfg.basketContext='coffee';const r=syntheticRun(e,id,rates);
 Object.assign(r.config,{basketContext:'coffee',stage1PressureLimit:3,stage2PressureLimit:6,stage3PressureLimit:3});
 for(const x of r.samples){
  Object.assign(x,{pressureBar:.5,machineTelemetryValid:true,machineAgeMs:0});
  if(x.phase==='stage1')x.machineFlowMlS=.719;
  if(x.phase==='stage2')x.machineFlowMlS=2.507;
  if(x.phase==='stage3'){const dt=x.tMs/1000-25;x.profileFrame=dt<8?2:dt<22?3:4;x.machineFlowMlS=[.698,.72,.778][x.profileFrame-2];}
 }
 return r;
}
test('ordinary complete coffee shots can form bounded next-shot evidence without rewriting calibration',async()=>{
 const e=setup({roundtrip:true}),a=coffeeRun(e,'a'),b=coffeeRun(e,'b'),lut=JSON.stringify(e.s.calibrationMap);
 assert(e.h.stage2AdaptiveEvidence(b));assert(e.h.stage3AdaptiveEvidence(b));
 e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b);assert(q.s3.suggestedShape);
 await e.h.autoApplyNextShotIfEligible(b);assert.equal(e.s.autoApplyLastStatus.status,'applied');
 assert.equal(e.s.testOverrides.basketContext,'coffee');assert.equal(JSON.stringify(e.s.calibrationMap),lut);
});
test('persisted coffee context restores only into matching coffee settings',()=>{
 const e=setup(),r=coffeeRun(e,'coffee-saved');r.summary=e.h.diagnosticSummary(r);
 e.h.rememberAdaptiveEvidence(r);const row=e.s.persistentHistoryFile.shots[0];
 assert.equal(row.basketContext,'coffee');assert.equal(row.fingerprint.basketContext,'coffee');
 e.s.adaptiveHistory=[];e.s.persistentHistoryAvailable=true;e.h.restoreAdaptiveHistoryFromPersistentFile();
 assert.equal(e.s.adaptiveHistory.length,1);
 e.s.cfg.basketContext='empty';e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.cfg.basketContext,'coffee');assert.equal(e.s.adaptiveHistory.length,1);
});
test('coffee pressure-limited stage yields LIMITED/HOLD and no numeric evidence',()=>{
 const e=setup(),r=coffeeRun(e);r.samples.filter(x=>x.phase==='stage2').forEach(x=>x.pressureBar=5.9);
 assert.equal(e.h.stage2AdaptiveEvidence(r),null);const q=e.h.nextShotAdaptiveSuggestion(r);
 assert.equal(q.s2.action,'LIMITED / HOLD');assert.match(q.s2.reason,/Pressure limiter/);
 assert.equal(e.s.cfg.stage2PressureLimit,6);
});
test('coffee actuator mismatch or stale/missing telemetry blocks numeric adaptation',()=>{
 for(const change of [x=>x.machineFlowMlS=.1,x=>x.machineTelemetryValid=false,x=>x.machineAgeMs=2000,x=>x.pressureBar=null]){
  const e=setup(),r=coffeeRun(e);r.samples.filter(x=>x.phase==='stage2').forEach(change);
  assert.equal(e.h.stage2AdaptiveEvidence(r),null);assert.equal(e.h.nextShotAdaptiveSuggestion(r).s2.action,'LIMITED / HOLD');
 }
});
test('coffee S3 without actual frame identity cannot use assumed shape actuator commands',()=>{
 const e=setup(),r=coffeeRun(e);r.samples.filter(x=>x.phase==='stage3').forEach(x=>x.profileFrame=null);
 assert.equal(e.h.stage3AdaptiveEvidence(r),null);assert.match(e.h.nextShotAdaptiveSuggestion(r).s3.reason,/coverage insufficient/);
});
test('missing telemetry cannot masquerade as zero pressure with valid actuator evidence',()=>{
 const e=setup();assert.equal(e.h.extractMachine({state:'espresso'}).telemetryValid,false);
 assert.equal(e.h.extractMachine({pressure:0,flow:.7}).telemetryValid,true);
 assert.equal(e.h.extractMachine({pressure:null,flow:.7}).telemetryValid,false);
});
test('fresh audit exposes actual JSON separately from cached UI and proposal, without writes',async()=>{
 const e=setup(),a=syntheticRun(e,'a',[2.1,1.8,1.5]),b=syntheticRun(e,'b',[2.1,1.8,1.5]);
 e.h.rememberAdaptiveEvidence(a);e.s.diagnosticLast=b;e.s.testOverrides=seedOverride(e,'empty');
 e.mock.workflow=copy(e.h.profileObject());e.s.workflowProfile=copy(e.mock.workflow);
 let audit=await e.h.adaptiveAuditPayload();assert.equal(audit.proposalMatchesWorkflow,false);
 const sh=audit.proposal.s3.suggestedShape;
 Object.assign(e.mock.workflow.steps[2],{flow:sh.earlyCommand,seconds:sh.earlySeconds});
 Object.assign(e.mock.workflow.steps[3],{flow:sh.midCommand,seconds:sh.midSeconds});
 e.mock.workflow.steps[4].flow=sh.lateCommand;
 audit=await e.h.adaptiveAuditPayload();assert.equal(audit.proposalMatchesWorkflow,true);
 assert.equal(audit.workflowMatchesExpected,false);
 assert.notEqual(audit.actualCommands.s3Shape.earlyCommand,+e.s.workflowProfile.steps[2].flow);
 assert.equal(e.writes().length,0);assert.equal(audit.machineProfileIndependentlyReadBack,false);
});
test('failed raw audit cannot fabricate readback, repair or upload',async()=>{
 const e=setup();e.mock.fail=p=>p==='/workflow'?'offline':null;
 await assert.rejects(e.h.adaptiveAuditPayload(),/offline/);assert.equal(e.writes().length,0);
});
test('audit refuses to mark matching when selection changes during read',async()=>{
 const e=setup();e.mock.after=p=>{if(p==='/workflow')e.s.workflowSelectionRevision++;};
 const a=await e.h.adaptiveAuditPayload();assert.equal(a.contextStable,false);assert.equal(a.workflowMatchesExpected,false);
});


test('unknown-context run cannot masquerade as current coffee evidence',()=>{
 const e=setup(),r=coffeeRun(e);delete r.config.basketContext;
 assert.equal(e.h.trustedAdaptiveRun(r),false);assert.equal(e.h.nextShotAdaptiveSuggestion(r),null);
});
test('read-only audit detects a basket context switch even if execution fields stay equal',async()=>{
 const e=setup();e.mock.after=p=>{if(p==='/workflow')e.s.cfg.basketContext='coffee';};
 const a=await e.h.adaptiveAuditPayload();assert.equal(a.contextStable,false);assert.equal(a.workflowMatchesExpected,false);
});
test('coffee telemetry coverage below 80 percent cannot pass from a handful of valid samples',()=>{
 const e=setup(),r=coffeeRun(e);let i=0;
 r.samples.filter(x=>x.phase==='stage2').forEach(x=>{if(i++%2)x.machineTelemetryValid=false;});
 assert.equal(e.h.stage2AdaptiveEvidence(r),null);
});
test('pressure-limited old coffee shot cannot supply the second clean consensus measurement',()=>{
 const e=setup(),a=coffeeRun(e,'limited'),b=coffeeRun(e,'clean');
 a.samples.filter(x=>x.phase==='stage2').forEach(x=>x.pressureBar=5.9);
 e.h.rememberAdaptiveEvidence(a);assert.equal(e.h.nextShotAdaptiveSuggestion(b).s2.repeatCount,1);
});
test('raw audit reports null actual commands when no workflow profile exists',async()=>{
 const e=setup();e.mock.workflow=null;
 const a=await e.h.adaptiveAuditPayload();assert.equal(a.actualCommands,null);assert.equal(a.workflowMatchesExpected,false);
 assert.equal(e.writes().length,0);
});
test('coffee manual/auto override is stamped with context when applied',async()=>{
 const e=setup({roundtrip:true}),a=coffeeRun(e,'a'),b=coffeeRun(e,'b');
 e.h.rememberAdaptiveEvidence(a);await e.h.applyNextShotAdaptiveSuggestion(b,'manual');
 assert.equal(e.s.testOverrides.basketContext,'coffee');assert.equal(e.h.testOverrideStatus().valid,true);
 e.s.cfg.basketContext='empty';assert.equal(e.h.testOverrideStatus().valid,false);
});

test('legacy verified history is retained as baseline response after automatic coffee transition',()=>{
 const e=setup(),row=historyRow(e,'old-empty');row.result='completed at 100 g';delete row.fingerprint.basketContext;
 row.s2={rawRegressionGS:4.512,rawRegressionR2:.999,windowS:6.78};row.commands={stage2:{commandMlS:2.507}};
 e.s.persistentHistoryFile={shots:[row]};e.s.testOverrides=seedOverride(e,'empty');e.s.cfg.basketContext='coffee';
 const b=e.h.baselineFeedForwardPayload();
 assert.equal(b.referenceShots,1);assert.equal(b.commandSeedRetained,true);assert.equal(b.priorCupResponse.stage2.rawRegressionGS,4.512);
 e.s.persistentHistoryAvailable=true;e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.adaptiveHistory.length,0);
 e.h.startDiagnostics('hyperex');assert.equal(e.s.diagnosticCurrent.config.baselinePrior.referenceShots,1);
 assert.equal(e.s.diagnosticCurrent.config.stage3Shape.earlyCommand,.698);
});
test('baseline history with changed calibration or targets cannot become a transferable reference',()=>{
 const e=setup(),row=historyRow(e);row.fingerprint.targets.stage2=6;e.s.persistentHistoryFile={shots:[row]};
 e.s.cfg.basketContext='coffee';assert.equal(e.h.baselineFeedForwardPayload().referenceShots,0);
});
test('legacy empty adaptive seed is labelled as prior rather than coffee auto-apply success',()=>{
 const e=setup();e.s.testOverrides=seedOverride(e,'empty');e.s.testOverrides.adaptiveSource={runId:'empty',mode:'auto'};
 e.s.cfg.basketContext='coffee';const c=e.h.commandFlowSummary();
 assert.equal(c.adaptiveSource,null);assert.match(c.manualTestStatus,/baseline seed/);
 assert.equal(c.s3Shape.earlyCommand,.698);
});
test('dedicated calibration remains empty-basket while normal HyperEx uses automatic coffee context',()=>{
 const e=setup();e.s.cfg=e.h.loadConfig({});e.h.startDiagnostics('calibration');
 assert.equal(e.s.diagnosticCurrent.config.basketContext,'empty');
 e.h.startDiagnostics('hyperex');assert.equal(e.s.diagnosticCurrent.config.basketContext,'empty');
});
test('baseline seed never bypasses existing invalid calibration binding and legacy corruption guards',()=>{
 const e=setup();e.s.cfg.basketContext='coffee';e.s.testOverrides=seedOverride(e,'empty');
 e.s.testOverrides.mapCreatedAt='other';assert.equal(e.h.testOverrideStatus().valid,false);
 e.s.testOverrides=seedOverride(e,'empty');delete e.s.testOverrides.writerVersion;e.s.testOverrides.adaptiveSource={mode:'auto'};
 assert.equal(e.h.testOverrideStatus().valid,false);
});
test('manual basket mode selection is absent from the new normal-use UI',()=>{
 const e=setup(),html=e.h.buildGhcOverlayHtml();
 assert.match(html,/Starting LUT and bounded commands are kept/);assert(!html.includes('id="changebasket"'));
 assert(!html.includes('START NORMAL COFFEE USE'));
});


function readinessRow(e,id,s2=5,s3=1.5){
 const r=historyRow(e,id);r.result='completed at 100 g';r.basketContext='empty';
 r.s2={targetGS:5,rawRegressionGS:s2,rawRegressionR2:.999,windowS:6};
 r.s3={targetGS:1.5,rawRegressionGS:s3,rawRegressionR2:.99,windowS:25};
 r.s3Stability={status:'LATE DECAY',lateToEarlyRatio:.7,stall:{suspected:false}};
 return r;
}
function readinessPreflight(e){
 e.s.runtimeProfileVerified=true;e.s.machineProfileAckKey='verified-upload';e.s.persistentHistoryAvailable=true;
}
test('new-user path begins with empty-basket Step 1 when no usable LUT exists',()=>{
 const e=setup();e.s.calibrationMapUsable=false;
 assert.equal(e.h.refreshLearningStage().stage,'STEP 1 · EMPTY CALIBRATION');assert.equal(e.s.cfg.basketContext,'empty');
});
test('after calibration, zero or one empty Step 2 shot cannot skip qualification',()=>{
 const e=setup();readinessPreflight(e);e.s.persistentHistoryFile={shots:[]};
 assert.equal(e.h.refreshLearningStage().stage,'STEP 2 · EMPTY BASELINE');
 e.s.persistentHistoryFile.shots.push(readinessRow(e,'one'));
 const q=e.h.refreshLearningStage();assert.equal(q.emptyShots,1);assert.equal(e.s.cfg.basketContext,'empty');
});
test('two stable qualified empty shots automatically prompt coffee and preserve the baseline',()=>{
 const e=setup();readinessPreflight(e);e.s.testOverrides=seedOverride(e,'empty');
 e.s.persistentHistoryFile={shots:[readinessRow(e,'one',5.075,1.50),readinessRow(e,'two',4.908,1.48)]};
 const q=e.h.refreshLearningStage();assert.equal(q.stage,'READY FOR COFFEE · AUTO');
 assert.equal(q.transitionBasis,'two stable shots');assert.equal(e.s.cfg.basketContext,'coffee');
 assert.equal(e.h.commandFlowSummary().s3Shape.earlyCommand,.698);assert.equal(e.h.baselineFeedForwardPayload().referenceShots,2);
});
test('three usable but imperfect empty shots end empty tuning and recommend at most one coffee acceptance',()=>{
 const e=setup();readinessPreflight(e);
 e.s.persistentHistoryFile={shots:[readinessRow(e,'one',4,1.2),readinessRow(e,'two',4.2,1.1),readinessRow(e,'three',4.1,1.15)]};
 const q=e.h.refreshLearningStage();assert.equal(q.stage,'READY FOR COFFEE · AUTO');assert.equal(q.limitedEmptyImprovement,true);
 assert.match(q.message,/at most one/);assert.equal(e.s.cfg.basketContext,'coffee');
});
test('existing four pre-upgrade empty records qualify without restarting the test count',()=>{
 const e=setup();readinessPreflight(e);
 e.s.persistentHistoryFile={shots:[1,2,3,4].map(i=>{const r=readinessRow(e,'legacy'+i,4.1,1.1);delete r.basketContext;delete r.fingerprint.basketContext;return r;})};
 const q=e.h.refreshLearningStage();assert.equal(q.emptyShots,4);assert.equal(e.s.cfg.basketContext,'coffee');
});
test('completion waits for automatic apply and storage readback before changing the interpretation',()=>{
 const e=setup();readinessPreflight(e);
 e.s.persistentHistoryFile={shots:[readinessRow(e,'a'),readinessRow(e,'b')]};
 e.s.autoApplyLastStatus={status:'applying'};assert.equal(e.h.refreshLearningStage().stage,'STEP 2 · APPLYING');assert.equal(e.s.cfg.basketContext,'empty');
 e.s.autoApplyLastStatus={status:'applied'};e.s.pendingHistoryWrite='pending';
 assert.equal(e.h.refreshLearningStage().stage,'STEP 2 · CHECKING');assert.equal(e.s.cfg.basketContext,'empty');
 e.s.pendingHistoryWrite=null;assert.equal(e.h.refreshLearningStage().stage,'READY FOR COFFEE · AUTO');
});
test('three runs never override invalid data, stall, workflow or application failure gates',()=>{
 const e=setup();readinessPreflight(e);const rows=[1,2,3].map(i=>readinessRow(e,'r'+i));
 e.s.persistentHistoryFile={shots:rows};rows[2].s3.rawRegressionGS=null;
 assert.equal(e.h.refreshLearningStage().stage,'STEP 2 · BLOCKED');assert.equal(e.s.cfg.basketContext,'empty');
 rows[2].s3.rawRegressionGS=1.5;rows[2].s3Stability.stall.suspected=true;
 assert.equal(e.h.refreshLearningStage().stage,'STEP 2 · BLOCKED');
 rows[2].s3Stability.stall.suspected=false;e.s.autoApplyLastStatus={status:'error'};
 assert.equal(e.h.refreshLearningStage().stage,'STEP 2 · BLOCKED');
 e.s.autoApplyLastStatus=null;e.s.runtimeProfileVerified=false;
 assert.equal(e.h.refreshLearningStage().stage,'STEP 2 · CHECKING');
});
test('changing physical LUT/settings invalidates old qualification count',()=>{
 const e=setup();readinessPreflight(e);e.s.persistentHistoryFile={shots:[readinessRow(e,'a'),readinessRow(e,'b')]};
 e.s.cfg.stage2Weight+=1;assert.equal(e.h.refreshLearningStage().emptyShots,0);assert.equal(e.s.cfg.basketContext,'empty');
});
test('active shot context never flips midway through a pour',()=>{
 const e=setup();readinessPreflight(e);e.s.persistentHistoryFile={shots:[readinessRow(e,'a'),readinessRow(e,'b')]};
 e.s.phase='stage3';e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'empty');
 e.s.phase='idle';e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'coffee');
});
test('qualified coffee start freezes coffee context while retaining empty baseline references',()=>{
 const e=setup();readinessPreflight(e);e.s.persistentHistoryFile={shots:[readinessRow(e,'a'),readinessRow(e,'b')]};
 e.h.startSequence(0);assert.equal(e.s.diagnosticCurrent.config.basketContext,'coffee');
 assert.equal(e.s.diagnosticCurrent.config.baselinePrior.referenceShots,2);
});


test('qualified readiness uses the existing cooperative dashboard shortcut to prompt coffee',()=>{
 const e=setup();readinessPreflight(e);e.s.persistentHistoryFile={shots:[readinessRow(e,'a'),readinessRow(e,'b')]};
 e.h.refreshLearningStage();const h=e.h.buildSkinSurfaceAnswer().surfaces.find(x=>x.id==='hyperex-diag-header');
 assert.equal(h.label,'READY · ADD COFFEE');assert.equal(h.action.view,'diag-dashboard');
});


test('history-context initial read blocks premature profile uploads after reload',async()=>{
 const e=setup();e.s.learningContextLoaded=false;
 await assert.rejects(e.h.syncHyperExProfile(true),/history context/);assert.equal(e.writes().length,0);assert.equal(e.s.armed,false);
});
test('initial saved coffee history restores context before verified profile uploads',async()=>{
 const e=setup({roundtrip:true}),r=coffeeRun(e,'saved-coffee');r.summary=e.h.diagnosticSummary(r);
 const record=e.h.compactPersistentShotRecord(r,{runId:r.runId,profileTruthSchema:3,fingerprint:r.config.adaptiveFingerprint});
 e.s.testOverrides=seedOverride(e,'coffee');e.s.cfg.basketContext='empty';e.s.learningContextLoaded=false;
 e.event('adaptiveHistoryFileV2',JSON.stringify({schema:2,shots:[record]}));
 await e.s.profileSyncQueue;assert.equal(e.s.learningContextLoaded,true);assert.equal(e.s.cfg.basketContext,'coffee');
 assert.equal(e.s.armed,true);assert.equal(+e.mock.workflow.steps[0].flow,.8);assert.equal(+e.mock.workflow.steps[2].flow,.698);
});


function directFixture(options={}){const e=setup(options);e.s.phase='restart_wait';e.s.directStartTestEnabledForRun=true;return e;}
test('direct setting defaults OFF and shares normal settings source',()=>{const e=setup();assert.equal(e.s.cfg.directDriverStartTest,false);assert.equal(e.h.loadConfig({DirectDriverStartTest:true}).directDriverStartTest,true);});
test('optional raw attempt keeps original GHC timeout and both retries',async()=>{const e=directFixture();await e.h.beginDirectStartTest();assert(e.s.restartTimeoutTimer);assert(e.s.armReinforceTimer);assert(e.s.armReinforceTimer2);assert.equal(e.timers.get(e.s.directStartTestTimer).ms,5000);const calls=e.calls.filter(c=>c.path==='/machine/state/espresso'||c.transport==='send');assert.equal(calls.length,2);assert.equal(calls[0].path,'/machine/state/espresso');assert.equal(JSON.parse(calls[1].payload.data).payload,'04');});
test('GHC machine skips redundant raw attempt and keeps original guard',async()=>{const e=directFixture({ghc:true});await e.h.beginDirectStartTest();assert(!e.calls.some(c=>c.transport==='send'));assert.match(e.s.directStartTest.status,/GHC-confirmation-required/);assert(e.s.restartTimeoutTimer);assert.equal(e.s.directStartTestTimer,null);});
test('unknown GHC capability skips raw, leaves normal confirmation active',async()=>{const e=directFixture({ghc:null});await e.h.beginDirectStartTest();assert(!e.calls.some(c=>c.transport==='send'));assert.match(e.s.directStartTest.status,/capability-unknown/);assert(e.s.restartTimeoutTimer);});
test('raw ACK clears transport timer, never clears original GHC guard',async()=>{const e=directFixture();await e.h.beginDirectStartTest();e.mock.rawListener({type:'data',data:JSON.stringify({type:'response',operation:'write',characteristicUUID:'A002'})});assert.equal(e.s.directStartTest.rawWriteAcknowledged,true);assert.equal(e.s.directStartTestTimer,null);assert(e.s.restartTimeoutTimer);assert(!('sustainedWeightConfirmed' in e.h.directStartTestPayload()));});
test('original GHC deadline sends Idle when no pour confirmed',async()=>{const e=directFixture();await e.h.beginDirectStartTest();e.run(e.s.restartTimeoutTimer);assert(e.calls.some(c=>c.path==='/machine/state/idle'));assert.equal(e.s.phase,'idle');});
test('pour cancels raw timer and original GHC guard; no later cup-gain timer',async()=>{const e=directFixture();await e.h.beginDirectStartTest();e.h.restartPourConfirmed('test',{machineState:'espresso',substate:'pouring'});assert.equal(e.s.restartTimeoutTimer,null);assert.equal(e.s.directStartTestTimer,null);assert.equal(e.s.directStartTest.active,false);assert(e.s.restartSkipTimer);});
test('raw failure retains original GHC wait without second abort owner',async()=>{const e=directFixture();e.mock.sendRaw=async()=>{throw Error('denied')};await e.h.beginDirectStartTest();assert.equal(e.s.phase,'restart_wait');assert(e.s.restartTimeoutTimer);assert(!e.calls.some(c=>c.path==='/machine/state/idle'));});
test('late raw socket after cleanup cannot send and is closed',async()=>{const e=directFixture();let done;e.mock.openRaw=()=>new Promise(r=>done=r);const p=e.h.beginDirectStartTest();for(let i=0;i<20;i++)await Promise.resolve();e.run(e.s.directStartTestTimer);assert(e.s.restartTimeoutTimer);done({handle:'late'});await p;assert(!e.calls.some(c=>c.transport==='send'));assert(e.calls.some(c=>c.transport==='close'&&c.handle==='late'));});
test('manual re-arm cancels optional pending raw setup and preserves original deadline',async()=>{const e=directFixture();let done;e.mock.openRaw=()=>new Promise(r=>done=r);const p=e.h.beginDirectStartTest();for(let i=0;i<20;i++)await Promise.resolve();const deadline=e.s.restartTimeoutTimer;await e.h.manualRearmSecondStage();done({handle:'late'});await p;assert.equal(e.s.restartTimeoutTimer,deadline);assert(!e.calls.some(c=>c.transport==='send'));});
test('soak still completes before any REST/raw startup request',async()=>{const e=setup({ghc:true});e.s.cfg.directDriverStartTest=true;e.h.startSequence(0);e.s.phase='dumping';e.h.beginSoak('test');assert(!e.calls.some(c=>c.path==='/machine/state/espresso'));e.run(e.s.soakTimer);for(let i=0;i<25;i++)await Promise.resolve();assert(e.calls.some(c=>c.path==='/machine/state/espresso'));assert(e.s.restartTimeoutTimer);assert(!e.calls.some(c=>c.transport==='send'));});
test('REST failure retains normal restart failure handling without raw write',async()=>{const e=directFixture();e.mock.fail=p=>p==='/machine/state/espresso'?'denied':null;await e.h.beginDirectStartTest();assert.equal(e.s.phase,'aborted');assert(!e.calls.some(c=>c.transport==='send'));});

async function trimFixture(phase='stage2'){
 const e=setup();e.s.cfg.liveFlowTrimTest=true;e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.s.phase=phase;e.s.lastFrame=phase==='stage2'?1:2;
 await e.h.startLiveTrim();e.h.observeLiveTrimMachine({profileFrame:e.s.lastFrame});e.advance(2200);trimSamples(e,phase==='stage2'?4:1.2);return e;
}
function trimSamples(e,flow=4){
 const frame=Number(e.s.lastFrame),phase=e.s.phase;
 const t=e.s.liveTrim;e.s.latestScaleAtMs=e.now();e.s.lastMachineAtMs=e.now();e.s.lastMachineTelemetryValid=true;
 e.s.lastMachineState='espresso';e.s.lastSubstate='pouring';e.s.lastPressure=1;e.s.lastFlow=phase==='stage2'?2.5:.75;
 const end=e.now()-t.run.startedAtMs;
 t.run.rawScaleSamples=Array.from({length:8},(_,i)=>({phase,profileFrame:frame,tMs:end-1400+i*200,weightG:i*.2*flow,scaleTimestampSeconds:100+end/1000-1.4+i*.2,tareReset:false}));
}
async function trimTick(e){if(e.s.liveTrimTimer){e.timers.delete(e.s.liveTrimTimer);e.s.liveTrimTimer=null;}await e.h.liveTrimTick(e.s.liveTrim);}
function rawWrites(e){return e.calls.filter(c=>c.transport==='send'&&JSON.parse(c.payload.data).characteristicUUID==='A010');}
function trimAck(e){e.mock.rawListener({type:'data',data:JSON.stringify({type:'response',operation:'write',characteristicUUID:'A010',payload:''})});}
test('live trim default OFF; original shot-to-shot and profile unchanged',()=>{const e=setup();assert.equal(e.s.cfg.liveFlowTrimTest,false);e.h.startSequence(0);assert.equal(e.s.liveTrim,null);assert.equal(e.s.autoApplyNextShot,true);assert.deepEqual(copy(e.h.profileObject().steps.map(x=>+x.flow)),[.719,2.507,.569]);});
test('live trim has independent setting and freezes 944ms /50 budget at shot start',async()=>{const e=await trimFixture();assert.equal(e.s.liveTrim.report.periodMs,944);assert.equal(e.s.liveTrim.report.maxChecks,2000);assert.equal(e.s.cfg.directDriverStartTest,false);assert.equal(e.h.advancedSettingsFromCfg().liveFlowTrimTest,true);});
test('below-band S2 writes one quantized current A010 frame and no skip/profile/multiplier',async()=>{const e=await trimFixture();await trimTick(e);assert.equal(rawWrites(e).length,1);const msg=JSON.parse(rawWrites(e)[0].payload.data);assert.equal(msg.payload,'014129B8FF000400');assert.equal(e.s.liveTrimDirty,true);assert.equal(e.s.liveTrim.report.writes,1);assert(!e.calls.some(c=>c.path==='/machine/state/skipStep'||c.path==='/workflow'&&c.method==='PUT'||c.path==='/machine/calibration'));});
test('inside ±2 percent writes nothing but logs a valid check point',async()=>{const e=await trimFixture();trimSamples(e,5.05);await trimTick(e);assert.equal(rawWrites(e).length,0);const row=e.s.liveTrim.report.trace.find(x=>x.kind==='check');assert.equal(row.reason,'inside-2pct-band');assert.equal(row.rawGS,5.05);});
test('above-band S3 lowers one flow quantum without altering limiter frame',async()=>{const e=await trimFixture('stage3');trimSamples(e,1.9);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(JSON.parse(rawWrites(e)[0].payload.data).payload.slice(0,6),'024108');});
test('pressure or actuator limitation prevents upward trim',async()=>{const e=await trimFixture();e.s.lastPressure=5.9;await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'pressure-or-actuator-limited');});
test('stale scale or machine blocks write; duplicate source timestamps fail regression',async()=>{const e=await trimFixture();e.s.latestScaleAtMs-=1000;await trimTick(e);assert.equal(rawWrites(e).length,0);trimSamples(e);e.s.liveTrim.run.rawScaleSamples.forEach(x=>x.scaleTimestampSeconds=1);await trimTick(e);assert.equal(rawWrites(e).length,0);});
test('pending driver write never stacks another correction before feedback',async()=>{const e=await trimFixture();await trimTick(e);e.advance(944);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-write-response');});
test('repeated missing targets stay recoverable without blind accumulation',async()=>{const e=await trimFixture();await trimTick(e);for(let miss=1;miss<=12;miss++){trimAck(e);e.advance(3100);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,miss);assert.equal(e.s.liveTrim.active,true);assert.equal(e.s.liveTrim.report.targetConfirmations,0);}assert.equal(rawWrites(e).length,13);assert.equal(new Set(rawWrites(e).map(x=>JSON.parse(x.payload.data).payload)).size,1);assert.equal(e.s.liveTrim.report.retries,12);assert.equal(e.s.liveTrim.report.status,'monitoring-degraded-target-feedback');assert.equal(e.s.liveTrim.commands[1],undefined);assert.equal(e.s.phase,'stage2');});
test('missing ACK aborts with Idle rather than accumulating writes',async()=>{const e=await trimFixture();await trimTick(e);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.phase,'aborted');assert(e.calls.some(c=>c.path==='/machine/state/idle'));});
test('target feedback is counted separately; subsequent correction stays inside ±20%',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});assert.equal(e.s.liveTrim.report.targetConfirmations,1);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.trace.filter(x=>x.kind==='write')[1].commandMlS,2.625);e.s.liveTrim.pending=null;e.s.liveTrim.commands[1]=3.0;e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'command-bound');});
test('stage transition cannot write the S2 frame after S3 transition request',async()=>{const e=await trimFixture();e.s.stage2SkipSent=true;await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'stage-transition');});
test('2000 checks is a hard cap across S2/S3, no2001st check or extra send',async()=>{const e=await trimFixture();e.s.liveTrim.report.checks=1999;trimSamples(e,5);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,2000);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,2000);assert.equal(e.s.liveTrim.active,false);assert.equal(rawWrites(e).length,0);});
test('Bengle/v2 model is rejected before any frame write',async()=>{const e=setup({model:'Bengle'});e.s.cfg.liveFlowTrimTest=true;e.h.startSequence(0);e.s.phase='stage2';await e.h.startLiveTrim();assert.equal(e.s.liveTrim.active,false);assert.equal(rawWrites(e).length,0);});
test('late socket open after cancellation cannot write',async()=>{const e=setup();e.s.cfg.liveFlowTrimTest=true;e.h.startSequence(0);e.s.phase='stage2';let done;e.mock.openRaw=()=>new Promise(r=>done=r);const p=e.h.startLiveTrim();for(let i=0;i<8;i++)await Promise.resolve();e.h.stopLiveTrim('cancelled');done({handle:'late-live'});await p;assert.equal(rawWrites(e).length,0);assert(e.calls.some(c=>c.transport==='close'&&c.handle==='late-live'));});
test('frame encoder preserves original metadata and rejects unsupported pressure/exit frames',()=>{const e=setup();const step=e.h.profileObject().steps[1];assert.equal(e.h.encodeLiveFlowFrame(step,1,2.5625),'014129B8FF000400');assert.throws(()=>e.h.encodeLiveFlowFrame({...step,pump:'pressure'},1,2.5));assert.throws(()=>e.h.encodeLiveFlowFrame({...step,exit:{value:2}},1,2.5));assert.throws(()=>e.h.encodeLiveFlowFrame(step,1,99));});
test('reset after a raw write invalidates machine ACK for full original-profile restoration',async()=>{const e=await trimFixture();await e.h.syncHyperExProfile(true).catch(()=>{});await trimTick(e);e.s.runtimeProfileVerified=true;e.s.machineProfileAckKey='old-ack';e.h.resetSequence('test end');assert.equal(e.s.runtimeProfileVerified,false);assert.equal(e.s.machineProfileAckKey,'');assert.equal(e.s.liveTrimDirty,false);assert.equal(e.s.liveTrim.active,false);});
test('live trim keeps trusted shot-to-shot eligibility and skips unverified corrected-stage evidence only',async()=>{const e=await trimFixture();e.s.liveTrim.run.result='completed at 100 g';assert.equal(e.h.trustedAdaptiveRun(e.s.liveTrim.run),true);assert.equal(e.h.liveTrimLearningView(e.s.liveTrim.run,'stage2'),e.s.liveTrim.run);await trimTick(e);assert.equal(e.h.liveTrimLearningView(e.s.liveTrim.run,'stage2'),null);assert.equal(e.h.liveTrimLearningView(e.s.liveTrim.run,'stage1'),e.s.liveTrim.run);});
test('verified stable learning window uses actual changed command, preserving raw run and LUT',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});const start=e.s.liveTrim.report.trace.find(x=>x.kind==='machine-target-response').tMs+2100;const run=e.s.liveTrim.run;run.rawScaleSamples=Array.from({length:40},(_,i)=>({phase:'stage2',profileFrame:1,tMs:start+i*200,weightG:i,scaleTimestampSeconds:100+i*.2}));const view=e.h.liveTrimLearningView(run,'stage2');assert(view);assert.equal(view.config.stage2CommandMlS,2.5625);assert.equal(run.config.stage2CommandMlS,2.507);assert.equal(e.s.calibrationMap.points[2].commandFlow,2.507);});
test('experimental trace survives summary/CSV with check, write, ACK and target response separately',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});const run=e.s.liveTrim.run;const summary=e.h.diagnosticSummary(run);assert.equal(summary.liveFlowTrim.writes,1);const csv=e.h.diagnosticCsv(run);assert.match(csv,/driver-ack/);assert.match(csv,/machine-target-response/);assert.match(csv,/live_flow_trim/);});
test('generated chart renders circles, write diamonds and target feedback squares',()=>{const lines=source.split('\n');const names=['svgPath','renderChart','liveTrimMarkers'];const functions=names.map(n=>lines.find(x=>x.startsWith('function '+n+'('))).join('\n');const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(functions,ctx);const run={liveFlowTrim:{trace:[{kind:'check',tMs:1000,rawGS:4.1},{kind:'check',tMs:1100,reason:'stale'},{kind:'write',tMs:1200,commandMlS:2.5625},{kind:'machine-target-response',tMs:1300,commandMlS:2.5625}]}};const markers=ctx.liveTrimMarkers(run);assert.equal(markers.length,4);const svg={innerHTML:''};ctx.renderChart(svg,[{points:[[0,0],[2,5]],stroke:'#fff'}],0,6,markers);assert.match(svg.innerHTML,/<circle/);assert.match(svg.innerHTML,/<rect/);assert.match(svg.innerHTML,/l 4 4 l -4 4/);assert.match(svg.innerHTML,/no valid RAW regression/);});


test('live-trim completed shot still queues the normal next-shot evaluator',async()=>{const e=await trimFixture();const run=e.s.liveTrim.run;e.s.phase='finishing';e.h.resetSequence('completed at 100 g');assert(e.s.autoApplyTimer);assert.equal(e.s.autoApplyLastStatus.status,'scheduled');assert.equal(e.s.autoApplyLastStatus.runId,run.runId);});
test('original profile is actually re-uploaded after raw edits before next shot',async()=>{const e=await trimFixture();await trimTick(e);e.s.lastMachineState='idle';e.h.resetSequence('test restore');e.calls.length=0;await e.h.syncHyperExProfile(true);assert(e.calls.some(c=>c.path==='/machine/profile'&&c.method==='POST'));assert.equal(e.s.runtimeProfileVerified,true);assert.deepEqual(copy(e.mock.workflow.steps.map(x=>+x.flow)),[.719,2.507,.569]);});

test('live trim forces required diagnostics even when regular diagnostic logging is OFF',()=>{const e=setup();e.s.cfg.diagnosticEnabled=false;e.s.cfg.liveFlowTrimTest=true;e.h.startSequence(0);assert(e.s.diagnosticCurrent);assert(e.s.liveTrim);assert(e.s.diagnosticCurrent.samples.length>0);});

test('all four levels freeze cadence and budgets independently of enable switch',()=>{for(const [level,ms,budget] of [[1,944,50],[2,300,150],[3,250,200],[4,200,250]]){const e=setup();e.s.cfg=e.h.loadConfig({LiveFlowTrimTest:true,LiveFlowTrimLevel:level});e.h.startSequence(0);const t=e.s.liveTrim;assert.equal(t.report.periodMs,ms);assert.equal(t.report.maxChecks,2000);assert.equal(t.report.maxWrites,budget);e.s.cfg.liveFlowTrimLevel=1;assert.equal(t.report.level,level);assert.equal(e.s.autoApplyNextShot,true);}});
test('invalid levels fall back to1 and selecting a level does not enable trim',()=>{for(const level of [0,5,-1,2.5,'x',Infinity])assert.equal(setup().h.loadConfig({LiveFlowTrimLevel:level}).liveFlowTrimLevel,1);const e=setup();e.s.cfg=e.h.loadConfig({LiveFlowTrimLevel:4});e.h.startSequence(0);assert.equal(e.s.liveTrim,null);});
test('fast levels release successful feedback and permit a later level tick',async()=>{const e=await trimFixture();e.s.liveTrim.report.periodMs=200;await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});e.advance(200);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.feedbackReleases,1);});
test('each level stops at its budget and reports dynamic limits in UI',async()=>{for(const budget of [150,200,250]){const e=await trimFixture();e.s.liveTrim.report.maxChecks=budget;e.s.liveTrim.report.checks=budget-1;trimSamples(e,5);await trimTick(e);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,budget);assert.equal(e.s.liveTrim.active,false);assert.equal(rawWrites(e).length,0);}const html=setup().h.buildGhcOverlayHtml();assert.match(html,/adv_liveFlowTrimLevel/);assert.match(html,/type="range" min="1" max="4" step="1"/);});
test('unconfirmed write records observed frame and target for transition diagnosis',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.s.lastFrame=2;e.s.phase='stage3';e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:2,targetFlow:.75});e.advance(2200);await trimTick(e);const row=e.s.liveTrim.report.trace.find(x=>x.kind==='target-response-timeout');assert.equal(row.frame,1);assert.equal(row.lastObserved.frame,2);assert.equal(row.lastObserved.targetFlowMlS,.75);assert.equal(e.s.liveTrim.report.targetConfirmations,0);});

test('final budget write retains ACK watchdog without creating another check',async()=>{const e=await trimFixture();e.s.liveTrim.report.checks=1999;await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(2200);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,2000);assert.equal(e.s.phase,'aborted');assert.equal(e.s.liveTrim.report.trace.filter(x=>x.kind==='check').length,1);});

test('slider loads current level, updates labels without saving, and saves enum value',async()=>{
 const html=setup().h.buildGhcOverlayHtml();const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);const script=scripts.find(s=>s.includes('function updateTrimLevelLabel'));
 const lines=script.split('\n');const names=['updateTrimLevelLabel','loadAdvancedSettings','saveAdvancedSettings'];const fns=names.map(n=>lines.find(l=>l.startsWith('function '+n+'(')||l.startsWith('async function '+n+'('))).join('\n');
 const slider={value:'1',type:'range',setAttribute(k,v){this[k]=v}},output={textContent:''},meta={innerHTML:''};let saved=null;
 const ctx=vm.createContext({Number,String,Object,setTimeout(){},location:{reload(){}},alert(){},confirm:()=>true,base:'/plugin',coreSettings:'/settings',ADV_FIELDS:['liveFlowTrimLevel'],ADV_SETTING_KEYS:{liveFlowTrimLevel:'LiveFlowTrimLevel'},esc:String,$:id=>({'adv_liveFlowTrimLevel':slider,'adv_liveFlowTrimLevelLabel':output,advancedmeta:meta}[id]),fetch:async(url,opts)=>{if(opts){saved=JSON.parse(opts.body);return{ok:true}}return{ok:true,json:async()=>({settings:{liveFlowTrimLevel:3}})}}});
 vm.runInContext(fns,ctx);await ctx.loadAdvancedSettings();assert.match(output.textContent,/三档.*250 ms.*200次写入/);assert.equal(saved,null);
 slider.value='4';ctx.updateTrimLevelLabel();assert.match(output.textContent,/四档.*200 ms.*250次写入/);assert.match(slider['aria-valuetext'],/四档/);assert.equal(saved,null);await ctx.saveAdvancedSettings();assert.equal(saved.LiveFlowTrimLevel,'4');
 const manifest=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json'),'utf8'));assert.equal(manifest.settings.LiveFlowTrimLevel.type,'enum');assert.deepEqual(manifest.settings.LiveFlowTrimLevel.values,['1','2','3','4']);for(const value of manifest.settings.LiveFlowTrimLevel.values)assert.equal(setup().h.loadConfig({LiveFlowTrimLevel:value}).liveFlowTrimLevel,Number(value));
});

test('confirmed target after retry clears streak and advances only one command quantum',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,1);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);assert.equal(e.s.liveTrim.commands[1],2.5625);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.pending.command,2.625);});
test('retry still requires fresh data and pressure headroom',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);e.s.lastPressure=5.9;await trimTick(e);assert.equal(rawWrites(e).length,1);assert(e.s.liveTrim.retry);e.s.lastPressure=1;e.s.latestScaleAtMs-=1000;await trimTick(e);assert.equal(rawWrites(e).length,1);});
test('error reversal holds an unresolved target rather than retrying wrong direction',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e,6);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'unconfirmed-target-direction-changed');});
test('late target response during retry hold is accepted and clears streak',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e,5);await trimTick(e);assert(e.s.liveTrim.retry);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});assert.equal(e.s.liveTrim.retry,null);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);assert.equal(e.s.liveTrim.commands[1],2.5625);});
test('after frame transition retry never writes old frame and S3 monitoring continues',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.s.phase='stage3';e.s.lastFrame=2;e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:2,targetFlow:.5625});e.advance(2200);trimSamples(e,1.2);await trimTick(e);assert.equal(e.s.liveTrim.active,true);assert.equal(rawWrites(e).length,2);assert.equal(JSON.parse(rawWrites(e)[1].payload.data).payload.slice(0,2),'02');assert(e.s.liveTrim.report.trace.some(x=>x.kind==='unconfirmed-frame-ended'));});
test('missing ACK on a retry still aborts normally',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);await trimTick(e);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.phase,'aborted');assert.equal(e.s.liveTrim.report.status,'driver-ack-timeout');});
test('exhausted check budget does not permit a retry beyond cap',async()=>{const e=await trimFixture();e.s.liveTrim.report.checks=1999;await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.checks,2000);assert.equal(e.s.liveTrim.active,false);assert.equal(e.s.phase,'stage2');});

test('home temperature94 is preserved by fresh workflow verification and reload',async()=>{const e=setup();e.mock.workflow.steps.forEach(x=>x.temperature='94.0');await e.h.syncHyperExProfile(true);assert.equal(e.s.cfg.temperature,94);assert(e.mock.workflow.steps.every(x=>+x.temperature===94));assert(!e.calls.some(c=>c.path==='/workflow'&&c.method==='PUT'));assert(e.calls.filter(c=>c.path==='/machine/profile').every(c=>c.body.steps.every(x=>+x.temperature===94)));const next=setup({workflow:copy(e.mock.workflow)});await next.h.syncHyperExProfile(true);assert.equal(next.s.cfg.temperature,94);assert.equal(next.s.runtimeProfileVerified,true);});
test('home event invalidates old temperature and verifies every frame including shaped S3',async()=>{const e=setup();e.s.testOverrides=seedOverride(e,'empty');e.mock.workflow=copy(e.h.profileObject());await e.h.syncHyperExProfile(true);e.calls.length=0;e.mock.workflow.steps.forEach(x=>x.temperature=95.5);e.h.handleWorkflowUpdated({profile:copy(e.mock.workflow)});await e.s.profileSyncQueue;assert.equal(e.s.cfg.temperature,95.5);assert.equal(e.s.runtimeProfileVerified,true);assert(e.h.profileObject().steps.every(x=>+x.temperature===95.5));assert.equal(e.s.calibrationMap.points[2].commandFlow,2.507);});
test('non-temperature profile tampering is still repaired while valid home temperature is kept',async()=>{const e=setup();e.mock.workflow.steps.forEach(x=>x.temperature=94);e.mock.workflow.steps[1].flow='7';await e.h.syncHyperExProfile(true);assert.equal(+e.mock.workflow.steps[1].flow,2.507);assert(e.mock.workflow.steps.every(x=>+x.temperature===94));});
test('invalid or nonuniform temperatures cannot be adopted as a home setting',()=>{for(const value of [-1,69,101,Infinity,NaN,'',null]){const e=setup(),p=copy(e.h.profileObject());p.steps.forEach(x=>x.temperature=value);assert.equal(e.h.workflowBrewTemperature(p),null);}const e=setup(),p=copy(e.h.profileObject());p.steps[1].temperature=94;assert.equal(e.h.workflowBrewTemperature(p),null);p.steps.forEach(x=>x.temperature=94);p.title='other';assert.equal(e.h.workflowBrewTemperature(p),null);});
test('home edits during a shot do not change frozen active temperature or send profile writes',()=>{const e=setup();e.s.cfg.liveFlowTrimTest=true;e.h.startSequence(0);const initial=e.s.diagnosticCurrent.config.temperature;e.s.phase='stage2';const p=copy(e.h.profileObject());p.steps.forEach(x=>x.temperature=96);e.calls.length=0;e.h.handleWorkflowUpdated({profile:p});assert.equal(e.s.cfg.temperature,92);assert.equal(e.s.diagnosticCurrent.config.temperature,initial);assert.equal(e.calls.length,0);});
test('temperature change keeps LUT and seeds and preserves original temperature metadata',async()=>{const e=setup();e.s.testOverrides=seedOverride(e,'empty');const lut=copy(e.s.calibrationMap),commands=copy(e.h.profileObject().steps.map(x=>x.flow)),fp=copy(e.h.adaptiveHistoryFingerprint());e.mock.workflow=copy(e.h.profileObject());e.mock.workflow.steps.forEach(x=>x.temperature=94);await e.h.syncHyperExProfile(true);assert.deepEqual(copy(e.s.calibrationMap),lut);assert.deepEqual(copy(e.h.profileObject().steps.map(x=>x.flow)),commands);assert.notDeepEqual(copy(e.h.adaptiveHistoryFingerprint()),fp);});
test('advanced temperature is a home-controlled readout, no conflicting Temperature save key',()=>{const html=setup().h.buildGhcOverlayHtml();assert.match(html,/<output id="adv_temperature">/);const line=html.split('\n').find(x=>x.startsWith('const ADV_SETTING_KEYS='));assert(!line.includes("temperature:'Temperature'"));assert.match(html,/在首页调整/);});

test('temperature-only change keeps existing coffee qualification and shaped command seed',async()=>{const e=setup();readinessPreflight(e);const run=coffeeRun(e,'old92');e.h.rememberAdaptiveEvidence(run);e.s.pendingHistoryWrite=null;e.s.persistentHistoryAvailable=true;e.s.testOverrides=seedOverride(e,'coffee');const commands=copy(e.h.profileObject().steps.map(x=>x.flow));e.mock.workflow=copy(e.h.profileObject());e.mock.workflow.steps.forEach(x=>x.temperature=94);await e.h.syncHyperExProfile(true);assert.equal(e.s.cfg.temperature,94);assert.equal(e.s.cfg.basketContext,'coffee');assert.equal(e.h.refreshLearningStage().stage,'NORMAL COFFEE · AUTO');assert.deepEqual(copy(e.h.profileObject().steps.map(x=>x.flow)),commands);assert.equal(e.s.persistentHistoryFile.shots.length,1);assert.equal(e.s.persistentHistoryCompatibleCount,1);assert.equal(e.s.adaptiveHistory.length,1);});
test('temperature-only change retains prior empty qualification and baseline references',()=>{const e=setup();readinessPreflight(e);e.s.persistentHistoryFile={shots:[readinessRow(e,'a'),readinessRow(e,'b')]};e.s.cfg.temperature=94;const q=e.h.refreshLearningStage();assert.equal(q.emptyShots,2);assert.equal(e.s.cfg.basketContext,'coffee');assert.equal(e.h.baselineFeedForwardPayload().referenceShots,2);});
test('home change while initial GET is in flight prevents old-temperature upload and retries',async()=>{const e=setup();let changed=false;e.mock.after=(p,m)=>{if(p==='/workflow'&&m==='GET'&&!changed){changed=true;e.mock.workflow.steps.forEach(x=>x.temperature=95);e.h.handleWorkflowUpdated({profile:copy(e.mock.workflow)});}};await e.h.syncHyperExProfile(true).catch(()=>{});for(let i=0;i<8;i++){await e.s.profileSyncQueue;await Promise.resolve();}const uploads=e.calls.filter(c=>c.path==='/machine/profile');assert(uploads.length);assert(uploads.every(c=>c.body.steps.every(x=>+x.temperature===95)));assert.equal(e.s.cfg.temperature,95);assert.equal(e.s.runtimeProfileVerified,true);});

test('three hundred checks can continue past old level3 cap without writes',async()=>{const e=await trimFixture();e.s.liveTrim.report.checks=199;trimSamples(e,5);for(let i=0;i<110;i++){e.advance(250);trimSamples(e,5);await trimTick(e);}assert.equal(e.s.liveTrim.report.checks,309);assert.equal(e.s.liveTrim.active,true);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.maxWrites,50);});
test('all write caps are independent of2000 checks and never exceeded',async()=>{for(const cap of [50,150,200,250]){const e=await trimFixture();e.s.liveTrim.report.maxWrites=cap;e.s.liveTrim.report.writes=cap-1;await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.report.writes,cap);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.active,true);assert.equal(e.s.liveTrim.report.maxChecks,2000);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,cap+'-write-budget');}});
test('temperature differences do not exclude prior cup numeric consensus or rewrite original temperature',async()=>{const e=setup(),old=coffeeRun(e,'old92');e.h.rememberAdaptiveEvidence(old);e.s.pendingHistoryWrite=null;e.s.persistentHistoryAvailable=true;e.s.cfg.temperature=94;const current=coffeeRun(e,'new94');e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.persistentHistoryCompatibleCount,1);assert.equal(e.s.adaptiveHistory[0].fingerprint.shotSettings.temperature,92);assert.equal(current.config.adaptiveFingerprint.shotSettings.temperature,94);const q=e.h.nextShotAdaptiveSuggestion(current);assert.equal(q.s2.confidence,'HIGH');assert(q.s3.suggestedShape);const lut=JSON.stringify(e.s.calibrationMap);await e.h.autoApplyNextShotIfEligible(current);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(JSON.stringify(e.s.calibrationMap),lut);});
test('cross-temperature matching retains basket/LUT/targets/pressure bindings and exact storage keys',()=>{const e=setup();const a=copy(e.h.adaptiveHistoryFingerprint()),b=copy(a);b.shotSettings.temperature=94;assert.equal(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(b));assert.notEqual(e.h.adaptiveHistoryFingerprintKey(a),e.h.adaptiveHistoryFingerprintKey(b));for(const change of [q=>q.basketContext='coffee',q=>q.mapCreatedAt='other',q=>q.targets.stage2=6,q=>q.shotSettings.stage2PressureLimit=5,q=>q.actualFlowMultiplier=1.2]){const q=copy(b);change(q);assert.notEqual(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(q));}});
test('cross-temperature evidence still fails pressure quality and same-command gates',()=>{const e=setup(),old=coffeeRun(e,'old92');for(const x of old.samples){if(x.phase==='stage2')x.pressureBar=5.9;}e.h.rememberAdaptiveEvidence(old);e.s.cfg.temperature=94;const current=coffeeRun(e,'new94');assert.equal(e.h.nextShotAdaptiveSuggestion(current).s2.action,'REPEAT SAME COMMAND');});


function controlledRun(e,id='controlled',both=false){
 const r=coffeeRun(e,id);r.config.experimentalLiveTrim=true;r.liveFlowTrim={trace:[]};
 function replace(phase,specs){
  r.samples=r.samples.filter(x=>x.phase!==phase);r.rawScaleSamples=r.rawScaleSamples.filter(x=>x.phase!==phase);
  let weight=10,stamp=100;
  for(const spec of specs){const base=Math.floor(spec.seed*16+.5)/16;let previous=base;
   for(let i=0;i<=Math.round(spec.duration*10);i++){
    const dt=i/10,tMs=Math.round((spec.start+dt)*1000),part=Math.floor(dt/2.4);
    const command=base+Math.min(2,part)*.0625;
    if(command!==previous){r.liveFlowTrim.trace.push({kind:'write',frame:spec.frame,tMs,commandMlS:command});r.liveFlowTrim.trace.push({kind:'machine-target-response',frame:spec.frame,tMs:tMs+1,commandMlS:command});previous=command;}
    const cup=phase==='stage2'?command*1.4:command/spec.seed*1.5;weight+=cup*.1;stamp+=.1;
    r.samples.push({phase,tMs,profileFrame:spec.frame,targetFlowMlS:command,machineFlowMlS:command,machineTelemetryValid:true,machineAgeMs:0,pressureBar:.5,scaleFlowGS:cup});
    r.rawScaleSamples.push({phase,tMs,profileFrame:spec.frame,weightG:weight,scaleTimestampSeconds:stamp,tareReset:false,machineFlowMlS:command});
   }
  }
 }
 replace('stage2',[{frame:1,start:8,duration:14,seed:r.config.stage2CommandMlS}]);
 if(both)replace('stage3',[{frame:2,start:25,duration:8,seed:r.config.stage3Shape.earlyCommand},{frame:3,start:33.1,duration:14,seed:r.config.stage3Shape.midCommand},{frame:4,start:47.2,duration:16,seed:r.config.stage3Shape.lateCommand}]);
 r.liveFlowTrim.trace.sort((a,b)=>a.tMs-b.tMs);
 return r;
}
test('all known S2 target epochs supply learning even when final write lacks feedback',()=>{const e=setup(),r=controlledRun(e);r.liveFlowTrim.trace.push({kind:'write',frame:1,tMs:21800,commandMlS:2.6875});const before=JSON.stringify(r.rawScaleSamples);const d=e.h.controlLearningAssessment(r,'stage2');assert(d.eligible,d.reason);assert(d.frames[0].windowCount>=2);const ev=e.h.stage2AdaptiveEvidence(r);assert(ev);assert.equal(ev.command,2.507);assert(Math.abs(ev.measured-2.507*1.4)<.02);assert.match(ev.measurementBasis,/local model/);assert.equal(JSON.stringify(r.rawScaleSamples),before);});
test('controlled S2 evidence forms bounded next-shot adjustment rather than INSUFFICIENT',async()=>{const e=setup(),a=controlledRun(e,'a'),b=controlledRun(e,'b');e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b);assert.equal(q.s2.action,'ADJUST',q.s2.reason);assert(q.s2.suggestedCommandMlS>2.507);assert(q.s2.suggestedCommandMlS-2.507<=.10001);assert(q.s2.suggestedCommandMlS/2.507<=1.05001);const lut=JSON.stringify(e.s.calibrationMap);await e.h.autoApplyNextShotIfEligible(b);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(JSON.stringify(e.s.calibrationMap),lut);});
test('corrected S3 frames contribute independent known-target windows to consensus',()=>{const e=setup(),r=controlledRun(e,'shape',true);const d=e.h.controlLearningAssessment(r,'stage3');assert(d.eligible,d.reason);assert.equal(d.frames.length,3);const ev=e.h.stage3AdaptiveEvidence(r);assert(ev);assert.equal(ev.measurementBasis,'live target-normalized frame windows');assert(ev.source.every(x=>Math.abs(x.measured-1.5)<.03));});
test('ACK or local writes without observed fresh machine target cannot supply numeric data',()=>{const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2')delete x.targetFlowMlS;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert.match(d.reason,/coverage/);assert.equal(e.h.stage2AdaptiveEvidence(r),null);assert.match(e.h.nextShotAdaptiveSuggestion(r).s2.reason,/coverage/);});
test('live learning retains pressure and actuator gates using observed command',()=>{for(const kind of ['pressure','flow','stale']){const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2'){if(kind==='pressure')x.pressureBar=5.9;if(kind==='flow')x.machineFlowMlS=.1;if(kind==='stale')x.machineAgeMs=1200;}const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false,kind);assert.equal(e.h.stage2AdaptiveEvidence(r),null);}});
test('unknown target outside bounded written trajectory is excluded',()=>{const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2')x.targetFlowMlS=7;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert.match(d.reason,/coverage/);});
test('duplicate RAW timestamps cannot satisfy relaxed live-learning windows',()=>{const e=setup(),r=controlledRun(e);for(const x of r.rawScaleSamples)if(x.phase==='stage2')x.scaleTimestampSeconds=100;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert.match(d.reason,/usable confirmed-target windows/);});
test('poor RAW regression is not admitted merely because machine targets are known',()=>{const e=setup(),r=controlledRun(e);let i=0;for(const x of r.rawScaleSamples)if(x.phase==='stage2')x.weightG=10+(i++%2?20:0);assert.equal(e.h.controlLearningAssessment(r,'stage2').eligible,false);});
test('original fixed-command evidence path remains unchanged when live trim never writes',()=>{const e=setup(),r=coffeeRun(e);r.config.experimentalLiveTrim=true;r.liveFlowTrim={trace:[]};assert.equal(e.h.controlLearningAssessment(r,'stage2').applicable,false);assert(e.h.stage2AdaptiveEvidence(r));});
test('±2% live band can act where old±6% would hold, without extra command quantum',async()=>{const e=await trimFixture();trimSamples(e,5.2);await trimTick(e);assert.equal(e.s.liveTrim.report.deadbandPct,2);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.pending.command,2.4375);});
test('next-shot±8% band adjusts two consistent10% deficits and holds within8%',()=>{const e=setup();const opts={deadbandPct:8,maxVariability:.15,gain:.25,maxFraction:.05,maxAbs:.1,rule:'8%'};const a={targetGS:5,command:2.5,measured:4.5},b={...a};assert.equal(e.h.scalarConsensusSuggestion('S2',a,b,opts).action,'ADJUST');a.measured=b.measured=4.65;assert.equal(e.h.scalarConsensusSuggestion('S2',a,b,opts).action,'HOLD');});
test('learning reports and raw diagnostics remain distinct in exports',()=>{const e=setup(),r=controlledRun(e);const s=e.h.diagnosticSummary(r);assert(s.learningEvidence.stage2.eligible);assert.match(s.nextShotAdaptive.s2.evidenceBasis,/normalized/);assert.notEqual(s.stage2.rawRegressionGS,s.learningEvidence.stage2.evidence.measured);});


test('ACK alone cannot release feedback wait early',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(300);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.feedbackReleases,0);});
test('target alone cannot release feedback wait without driver ACK',async()=>{const e=await trimFixture();await trimTick(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});e.advance(300);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);});
test('confirmed feedback still respects minimum50ms and needs a new scale source sample',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});e.advance(40);await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(20);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-new-scale-sample');e.advance(240);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);});
test('wrong-frame target cannot release a pending write',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:2,targetFlow:2.5625});e.advance(300);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);});
test('rapid confirmed command changes use dynamic exposure instead of needing long fixed epochs',()=>{const e=setup(),r=controlledRun(e);r.liveFlowTrim.trace=r.liveFlowTrim.trace.filter(x=>x.frame!==1);for(const row of r.samples.filter(x=>x.phase==='stage2')){const n=Math.floor((row.tMs-8000)/300),cmd=2.5+(n%3)*.0625;row.targetFlowMlS=cmd;row.machineFlowMlS=cmd;r.liveFlowTrim.trace.push({kind:'write',frame:1,tMs:row.tMs,commandMlS:cmd});}const d=e.h.controlLearningAssessment(r,'stage2');assert(d.eligible,d.reason);assert(d.frames[0].windows.some(x=>x.dynamicExposure));assert(e.h.stage2AdaptiveEvidence(r));});
test('observed RAW output quality stays available when driver command attribution is missing',()=>{const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2')delete x.targetFlowMlS;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert(d.outputQuality.available);assert(d.outputQuality.tailMeanGS>0);assert.equal(d.outputQuality.targetGS,5);assert.match(d.outputQuality.basis,/actual RAW/);});


test('plugin self-review reports stage outcome and learning without requiring external exports',()=>{const e=setup(),r=controlledRun(e,'review',true);const q=e.h.controlRunReview(r);assert(q);assert.equal(q.phases.length,2);assert(q.phases[0].status.includes('偏离'));assert.match(q.phases[0].learningStatus,/已纳入/);assert.match(q.note,/无需日常上传/);assert(q.phases[0].actionGroups.some(x=>x.writes>1));});
test('review never turns overlapping actions into individual causal success claims',()=>{const e=setup(),r=controlledRun(e);const q=e.h.controlRunReview(r);const g=q.phases[0].actionGroups.find(x=>x.writes>1);assert(g);assert.match(g.attribution,/组合/);assert.match(g.status,/窗口不足|组后|组前后/);});
test('self-review panel is present in final generated script and summary export',()=>{const e=setup(),r=controlledRun(e);const s=e.h.diagnosticSummary(r);assert(s.controlReview);const html=e.h.buildGhcOverlayHtml();assert.match(html,/本杯控制诊断/);assert.match(html,/actionGroups/);});

async function degradedTrim(){const e=await trimFixture();await trimTick(e);for(let i=0;i<4;i++){trimAck(e);e.advance(2200);trimSamples(e);await trimTick(e);}assert(e.s.liveTrim.retry);assert.equal(e.s.liveTrim.pending,null);return e;}
test('fourth target miss enters recoverable cooldown while checks continue',async()=>{const e=await degradedTrim(),n=rawWrites(e).length,checks=e.s.liveTrim.report.checks;e.advance(250);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,n);assert.equal(e.s.liveTrim.report.checks,checks+1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'degraded-target-feedback-cooldown');e.advance(600);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,n+1);assert(e.s.liveTrim.pending);assert.equal(e.s.liveTrim.active,true);});
test('late exact target during degraded cooldown automatically recovers normal control',async()=>{const e=await degradedTrim();e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});assert.equal(e.s.liveTrim.retry,null);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);assert.equal(e.s.liveTrim.report.status,'monitoring');e.advance(250);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.pending.command,2.625);});
test('degraded target retry holds after cup error reverses',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;e.advance(1000);trimSamples(e,6);await trimTick(e);assert.equal(rawWrites(e).length,n);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'unconfirmed-target-direction-changed');assert(e.s.liveTrim.active);});
test('degraded target retries require fresh scale and machine telemetry',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;e.advance(1000);trimSamples(e);e.s.lastMachineAtMs-=1000;await trimTick(e);assert.equal(rawWrites(e).length,n);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'settling-or-stale-telemetry');});
test('degraded retry cannot spend beyond write cap; checks and late recovery remain active',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;e.s.liveTrim.report.maxWrites=e.s.liveTrim.report.writes;e.advance(1000);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,n);assert(e.s.liveTrim.active);assert.match(e.s.liveTrim.report.trace.slice(-1)[0].reason,/write-budget/);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5625});assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);});
test('new S3 frame drops degraded S2 retry and can control its own bounded target',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;e.s.phase='stage3';e.s.lastFrame=2;e.h.observeLiveTrimMachine({profileFrame:2});e.advance(2200);trimSamples(e,1.2);await trimTick(e);assert.equal(rawWrites(e).length,n+1);assert.equal(e.s.liveTrim.pending.frame,2);assert.equal(e.s.liveTrim.pending.command,.625);assert(e.s.liveTrim.report.trace.some(x=>x.kind==='unconfirmed-frame-ended'));});
test('target retries cannot reuse the last written scale source endpoint',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);const r=e.h.liveTrimRegression(e.s.liveTrim);e.s.liveTrim.lastDecisionStamp[1]=r.sourceEndStamp;await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-new-scale-sample');});
test('recoverable feedback still ends at check budget and never resets budgets on recovery',async()=>{const e=await degradedTrim();const writes=e.s.liveTrim.report.writes;e.s.liveTrim.report.checks=2000;await trimTick(e);assert.equal(e.s.liveTrim.active,false);assert.equal(e.s.liveTrim.report.status,'2000-check-budget-complete');assert.equal(e.s.liveTrim.report.writes,writes);});

(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(err){failed++;console.error('FAIL '+name+'\n'+err.stack);}}console.log(`\n${tests.length-failed}/${tests.length} checks passed`);process.exitCode=failed?1:0;})();

