// Run: node tests/verify_v0152.cjs [path/to/plugin.js]
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
 const context=vm.createContext({console,Date,Math,JSON,Map,Promise,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},fetch:async()=>{throw Error('unexpected fetch');}});
 const injection=`globalThis.hooks={state,loadConfig,profileObject,recomputeCalibrationUsability,handleWorkflowUpdated,handleStateUpdate,
 verifyAndRepairSelectedHyperExProfile,syncHyperExProfile,runtimeProfileTruthPayload,adaptiveHistoryFingerprint,adaptiveHistoryFingerprintKey,
 trustedAdaptiveRun,restoreAdaptiveHistoryFromPersistentFile,previousMatchingAdaptiveEvidence,nextShotAdaptiveSuggestion,rememberAdaptiveEvidence,
 compactPersistentShotRecord,persistHistoryFile,appendPersistentHistoryShot,startPersistentHistoryProbe,setPersistentHistoryUnavailable,
 startDiagnostics,finalizeCalibrationRun,clearAllTimers,stage1StartupMetrics,stage3StabilityDiagnostics,diagnosticSummary,scalarConsensusSuggestion,stage1AdaptiveEvidence,stage2AdaptiveEvidence,stage3AdaptiveEvidence,
 testOverrideBinding,recordNextShotApplied,buildSkinSurfaceAnswer,refreshLearningStage,commandFlowSummary,baselineFeedForwardPayload,buildGhcOverlayHtml,stageActuatorEvidence,adaptiveAuditPayload,autoApplyNextShotIfEligible,testOverrideStatus,resetSequence,startSequence,stage3ShapeOnlyConsensus,applyNextShotAdaptiveSuggestion,extractMachine,profilesEquivalent,profileExecutionEquivalent,profileExecutionDifferences,
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
  if(path==='/machine/calibration') {if(method==='POST')mock.multiplier=JSON.parse(opt.body).flowMultiplier;data={flowMultiplier:mock.multiplier};}
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
 return {h,s,plugin,expected,mock,calls,writes,timers,run,storage,storageCalls,pendingReads,deliverRead,flushReads,event};
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

(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(err){failed++;console.error('FAIL '+name+'\n'+err.stack);}}console.log(`\n${tests.length-failed}/${tests.length} checks passed`);process.exitCode=failed?1:0;})();
