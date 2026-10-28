// Run: node tests/verify_v0176.cjs [path/to/plugin.js]
// Hooks are injected in memory only. The shipped plugin has no test exports.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const file=process.argv[2]||require('path').join(__dirname,'..','plugin.js');
const source=fs.readFileSync(file,'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
function setup(options={}) {
 const timers=new Map();let timerId=0,plugin,h,storage={};const calls=[],storageCalls=[],pendingReads=[];
 const mock={multiplier:1,machineState:'idle',workflow:null,profiles:[],fail:null,after:null,...options};
 const host={log(){},emit(){},storage(req){if(options.failRefillSave&&req.type==='write'&&req.key==='s2RefillSettingsV1')throw Error('storage unavailable');if(options.failLanguageSave&&req.type==='write'&&req.key==='uiLanguage')throw Error('storage unavailable');storageCalls.push(copy(req));if(req.type==='write')storage[req.key]=req.data;else pendingReads.push({key:req.key,value:storage[req.key]??null});}};
 let clock=options.now||Date.now();class TestDate extends Date {static now(){return clock;}}
 host.transport={open:async(req)=>{calls.push({transport:'open',req});if(mock.openRaw)return mock.openRaw();return {handle:'raw-test'};},onEvent(handle,fn){mock.rawListener=fn;},send:async(handle,payload)=>{calls.push({transport:'send',handle,payload});if(mock.sendRaw)return mock.sendRaw();},close:async(handle)=>{calls.push({transport:'close',handle});}};
 const context=vm.createContext({console,Date:TestDate,Math,JSON,Map,Promise,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},fetch:async()=>{throw Error('unexpected fetch');}});
 const injection=`globalThis.hooks={stage2CupOnset,phaseRawSamples,diagnosticRawRegression,diagnosticPhaseSummary,validatedS2RefillSettings,currentS2RefillSettings,s3CommandHistoryAudit,projectS3Commands,kickS2Refill,s2RefillFlowEstimate,s2RefillReturnReason,completeS2Startup,stage2LegacyStartupPlan,guardedSingleSkip,scheduleRestartSkip,controlOutputQuality,finalizeDiagnostics,learningAdmission,utf8ByteLength,keepCoffeeQualification,diagnosticRunCommandSnapshot,normalizeLearningLevel,learningPolicy,scalarLearningSuggestion,stage3SingleSuggestion,stage3ReferenceEvidence,stageCommandOrigin,historyPersistenceAudit,compactLiveHistory,s2NearbyEvidence,activeReleaseEnabled,overrideStorageKey,liveTrimPhaseAllowed,beginContinuousStage2,stage1LiveLearning,onScaleSnapshot,beginDump,finishSequence,storageRead,storageWrite,stage2StartupMetrics,stage2StartupPlan,dispatchS2Startup,assessRunLearningIntegrity,historyLearningStatus,learningRunAllowed,historyEvidenceAllowed,learningHistoryPayload,setLearningHistoryReview,matchingAdaptiveEvidenceSearch,createUiTranslator,translateUiText,UI_LANGUAGE_PAIRS,curveEditorRevision,curveEditorSnapshot,applyCurveEditorDraft,saveS2RefillSettings,manualCurveBlocksRun,state,loadConfig,profileObject,recomputeCalibrationUsability,handleWorkflowUpdated,handleStateUpdate,
 verifyAndRepairSelectedHyperExProfile,syncHyperExProfile,runtimeProfileTruthPayload,adaptiveHistoryFingerprint,adaptiveHistoryFingerprintKey,
 numericLearningFingerprintKey,trustedAdaptiveRun,restoreAdaptiveHistoryFromPersistentFile,previousMatchingAdaptiveEvidence,nextShotAdaptiveSuggestion,rememberAdaptiveEvidence,
 compactPersistentShotRecord,persistHistoryFile,appendPersistentHistoryShot,startPersistentHistoryProbe,setPersistentHistoryUnavailable,
 startDiagnostics,finalizeCalibrationRun,clearAllTimers,abortSequence,calibrationStatusPayload,stage1StartupMetrics,stage3StabilityDiagnostics,diagnosticSummary,scalarConsensusSuggestion,stage1AdaptiveEvidence,stage2AdaptiveEvidence,stage3AdaptiveEvidence,
 testOverrideBinding,recordNextShotApplied,buildSkinSurfaceAnswer,refreshLearningStage,commandFlowSummary,baselineFeedForwardPayload,buildGhcOverlayHtml,stageActuatorEvidence,adaptiveAuditPayload,autoApplyNextShotIfEligible,testOverrideStatus,resetSequence,startSequence,stage3ShapeOnlyConsensus,applyNextShotAdaptiveSuggestion,extractMachine,profilesEquivalent,profileExecutionEquivalent,profileExecutionDifferences,
 workflowBrewTemperature,adoptWorkflowBrewTemperature,controlRunReview,controlLearningAssessment,stageGainEstimate,initializeLiveTrim,startLiveTrim,liveTrimTick,stopLiveTrim,observeLiveTrimMachine,encodeLiveFlowFrame,liveTrimLearningView,liveTrimRegression,diagnosticCsv,
 beginSoak,beginDirectStartTest,restartPourConfirmed,startRestartPoll,manualRearmSecondStage,directStartTestPayload,advancedSettingsFromCfg,uiStatusPayload,
 enterHyperExScopedMultiplier,restoreHyperExScopedMultiplier,setApi(fn){api=fn;}};\n`;
 const token='  return {\n    id: ID,';assert(source.includes(token));
 vm.runInContext(source.replace(token,injection+token),context);plugin=context.createPlugin(host);h=context.hooks;
 const s=h.state;const initialLanguage=s.uiLanguage;s.uiLanguage=options.uiLanguage||"en";s.cfg=h.loadConfig({AdaptiveLearningLevel:"保守",LiveFlowTrimTest:false,LiveFlowTrimLevel:1});s.cfg.basketContext='empty';s.scopeMode='off';s.calibrationStorageLoaded=true;s.overrideStorageLoaded=true;s.scopeStorageLoaded=true;s.scopedOriginalStorageLoaded=true;
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
 return {initialLanguage,h,s,plugin,expected,mock,calls,writes,timers,run,storage,storageCalls,pendingReads,deliverRead,flushReads,event,advance(ms){clock+=ms;},now(){return clock;}};
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
 assert(m.rejectionReasons.includes('20–80% transit < 0.9 s'));
 assert.equal(e.h.stage1AdaptiveEvidence(r),null);
 assert.match(e.h.nextShotAdaptiveSuggestion(r).s1.reason,/transit < 0.9/);
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
test('micro settings retain qualification and physical LUT changes invalidate the count',()=>{
 const e=setup();readinessPreflight(e);e.s.persistentHistoryFile={shots:[readinessRow(e,'a'),readinessRow(e,'b')]};
 e.s.cfg.stage2Weight+=1;assert.equal(e.h.refreshLearningStage().emptyShots,2);e.s.calibrationMap.createdAt='different-lut';assert.equal(e.h.refreshLearningStage().emptyShots,0);assert.equal(e.s.cfg.basketContext,'empty');
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
 const e=setup();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2StartupAssist=false;e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.s.phase=phase;e.s.lastFrame=phase==='stage2'?1:2;
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
test('explicit live trim OFF preserves original shot-to-shot and profile unchanged',()=>{const e=setup();assert.equal(e.s.cfg.liveFlowTrimTest,false);e.h.startSequence(0);assert.equal(e.s.liveTrim,null);assert.equal(e.s.autoApplyNextShot,true);assert.deepEqual(copy(e.h.profileObject().steps.map(x=>+x.flow)),[.719,2.507,.569]);});
test('live trim has independent setting and freezes 944ms /50 budget at shot start',async()=>{const e=await trimFixture();assert.equal(e.s.liveTrim.report.periodMs,944);assert.equal(e.s.liveTrim.report.maxChecks,2000);assert.equal(e.s.cfg.directDriverStartTest,false);assert.equal(e.h.advancedSettingsFromCfg().liveFlowTrimTest,true);});
test('below-band S2 writes one quantized current A010 frame and no skip/profile/multiplier',async()=>{const e=await trimFixture();await trimTick(e);assert.equal(rawWrites(e).length,1);const msg=JSON.parse(rawWrites(e)[0].payload.data);assert.equal(msg.payload,'01412CB8FF000400');assert.equal(e.s.liveTrimDirty,true);assert.equal(e.s.liveTrim.report.writes,1);assert(!e.calls.some(c=>c.path==='/machine/state/skipStep'||c.path==='/workflow'&&c.method==='PUT'||c.path==='/machine/calibration'));});
test('inside ±2 percent writes nothing but logs a valid check point',async()=>{const e=await trimFixture();trimSamples(e,5.05);await trimTick(e);assert.equal(rawWrites(e).length,0);const row=e.s.liveTrim.report.trace.find(x=>x.kind==='check');assert.equal(row.reason,'inside-2pct-band');assert.equal(row.rawGS,5.05);});
test('above-band S3 lowers one flow quantum without altering limiter frame',async()=>{const e=await trimFixture('stage3');trimSamples(e,1.9);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(JSON.parse(rawWrites(e)[0].payload.data).payload.slice(0,6),'024108');});
test('pressure or actuator limitation prevents upward trim',async()=>{const e=await trimFixture();e.s.lastPressure=5.9;await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'pressure-or-actuator-limited');});
test('stale scale or machine blocks write; duplicate source timestamps fail regression',async()=>{const e=await trimFixture();e.s.latestScaleAtMs-=1000;await trimTick(e);assert.equal(rawWrites(e).length,0);trimSamples(e);e.s.liveTrim.run.rawScaleSamples.forEach(x=>x.scaleTimestampSeconds=1);await trimTick(e);assert.equal(rawWrites(e).length,0);});
test('pending driver write never stacks another correction before feedback',async()=>{const e=await trimFixture();await trimTick(e);e.advance(944);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-write-response');});
test('repeated missing targets stay recoverable without blind accumulation',async()=>{const e=await trimFixture();await trimTick(e);for(let miss=1;miss<=12;miss++){trimAck(e);e.advance(3100);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,miss);assert.equal(e.s.liveTrim.active,true);assert.equal(e.s.liveTrim.report.targetConfirmations,0);}assert.equal(rawWrites(e).length,13);assert(new Set(rawWrites(e).map(x=>JSON.parse(x.payload.data).payload)).size>=2);assert(rawWrites(e).every(x=>{const v=parseInt(JSON.parse(x.payload.data).payload.slice(4,6),16)/16;return v>=2.5&&v<=3;}));assert.equal(e.s.liveTrim.report.retries,12);assert.equal(e.s.liveTrim.report.status,'monitoring-unresponsive-trend');assert.equal(e.s.liveTrim.commands[1],undefined);assert.equal(e.s.phase,'stage2');});
test('missing ACK aborts with Idle rather than accumulating writes',async()=>{const e=await trimFixture();await trimTick(e);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.phase,'aborted');assert(e.calls.some(c=>c.path==='/machine/state/idle'));});
test('target feedback is counted separately; subsequent correction stays inside ±20%',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});assert.equal(e.s.liveTrim.report.targetConfirmations,1);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.trace.filter(x=>x.kind==='write')[1].commandMlS,3.0);e.s.liveTrim.pending=null;e.s.liveTrim.commands[1]=3.0;e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'command-bound-vector');});
test('stage transition cannot write the S2 frame after S3 transition request',async()=>{const e=await trimFixture();e.s.stage2SkipSent=true;await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'stage-transition');});
test('2000 checks is a hard cap across S2/S3, no2001st check or extra send',async()=>{const e=await trimFixture();e.s.liveTrim.report.checks=1999;trimSamples(e,5);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,2000);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,2000);assert.equal(e.s.liveTrim.active,false);assert.equal(rawWrites(e).length,0);});
test('Bengle/v2 model is rejected before any frame write',async()=>{const e=setup({model:'Bengle'});e.s.cfg.liveFlowTrimTest=true;e.h.startSequence(0);e.s.phase='stage2';await e.h.startLiveTrim();assert.equal(e.s.liveTrim.active,false);assert.equal(rawWrites(e).length,0);});
test('late socket open after cancellation cannot write',async()=>{const e=setup();e.s.cfg.liveFlowTrimTest=true;e.h.startSequence(0);e.s.phase='stage2';let done;e.mock.openRaw=()=>new Promise(r=>done=r);const p=e.h.startLiveTrim();for(let i=0;i<8;i++)await Promise.resolve();e.h.stopLiveTrim('cancelled');done({handle:'late-live'});await p;assert.equal(rawWrites(e).length,0);assert(e.calls.some(c=>c.transport==='close'&&c.handle==='late-live'));});
test('frame encoder preserves original metadata and rejects unsupported pressure/exit frames',()=>{const e=setup();const step=e.h.profileObject().steps[1];assert.equal(e.h.encodeLiveFlowFrame(step,1,2.5625),'014129B8FF000400');assert.throws(()=>e.h.encodeLiveFlowFrame({...step,pump:'pressure'},1,2.5));assert.throws(()=>e.h.encodeLiveFlowFrame({...step,exit:{value:2}},1,2.5));assert.throws(()=>e.h.encodeLiveFlowFrame(step,1,99));});
test('reset after a raw write invalidates machine ACK for full original-profile restoration',async()=>{const e=await trimFixture();await e.h.syncHyperExProfile(true).catch(()=>{});await trimTick(e);e.s.runtimeProfileVerified=true;e.s.machineProfileAckKey='old-ack';e.h.resetSequence('test end');assert.equal(e.s.runtimeProfileVerified,false);assert.equal(e.s.machineProfileAckKey,'');assert.equal(e.s.liveTrimDirty,false);assert.equal(e.s.liveTrim.active,false);});
test('live trim keeps trusted shot-to-shot eligibility and skips unverified corrected-stage evidence only',async()=>{const e=await trimFixture();e.s.liveTrim.run.result='completed at 100 g';assert.equal(e.h.trustedAdaptiveRun(e.s.liveTrim.run),true);assert.equal(e.h.liveTrimLearningView(e.s.liveTrim.run,'stage2'),e.s.liveTrim.run);await trimTick(e);assert.equal(e.h.liveTrimLearningView(e.s.liveTrim.run,'stage2'),null);assert.equal(e.h.liveTrimLearningView(e.s.liveTrim.run,'stage1'),e.s.liveTrim.run);});
test('verified stable learning window uses actual changed command, preserving raw run and LUT',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});const start=e.s.liveTrim.report.trace.find(x=>x.kind==='machine-target-response').tMs+2100;const run=e.s.liveTrim.run;run.rawScaleSamples=Array.from({length:40},(_,i)=>({phase:'stage2',profileFrame:1,tMs:start+i*200,weightG:i,scaleTimestampSeconds:100+i*.2}));const view=e.h.liveTrimLearningView(run,'stage2');assert(view);assert.equal(view.config.stage2CommandMlS,2.75);assert.equal(run.config.stage2CommandMlS,2.507);assert.equal(e.s.calibrationMap.points[2].commandFlow,2.507);});
test('experimental trace survives summary/CSV with check, write, ACK and target response separately',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});const run=e.s.liveTrim.run;const summary=e.h.diagnosticSummary(run);assert.equal(summary.liveFlowTrim.writes,1);const csv=e.h.diagnosticCsv(run);assert.match(csv,/driver-ack/);assert.match(csv,/machine-target-response/);assert.match(csv,/live_flow_trim/);});
test('generated chart renders directional arrows, retry marks and separate target squares',()=>{const lines=source.split('\n');const names=['svgPath','renderChart','liveTrimMarkers'];const functions=names.map(n=>lines.find(x=>x.startsWith('function '+n+'('))).join('\n');const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(functions,ctx);const run={liveFlowTrim:{trace:[{kind:'check',tMs:1000,rawGS:4.1},{kind:'write',tMs:1200,commandMlS:2.5625,previousMlS:2.5},{kind:'write',tMs:1300,commandMlS:2.5,previousMlS:2.5625},{kind:'write',tMs:1400,commandMlS:2.5,previousMlS:2.5625,retry:true},{kind:'machine-target-response',tMs:1500,commandMlS:2.5}]}};const markers=ctx.liveTrimMarkers(run);assert.deepEqual(Array.from(markers,x=>x.shape),['circle','up','down','retry','square']);const svg={innerHTML:''};ctx.renderChart(svg,[{points:[[0,0],[2,5]],stroke:'#fff'}],0,6,markers);assert.match(svg.innerHTML,/<circle/);assert.match(svg.innerHTML,/<rect/);assert.match(svg.innerHTML,/上调指令/);assert.match(svg.innerHTML,/下调指令/);assert.match(svg.innerHTML,/同值重试/);});
test('live trim vector arrows carry direction and amplitude length',()=>{const s=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');const NL=String.fromCharCode(10);const r0=s.indexOf('function svgPath('),a=s.indexOf('function renderChart('),b=s.indexOf('function liveTrimMarkers(');const ns=[s.slice(r0,s.indexOf(NL,r0)),s.slice(a,s.indexOf(NL,a)),s.slice(b,s.indexOf(NL,b))].join(NL);const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(ns,ctx);const run={liveFlowTrim:{trace:[{kind:'write',tMs:1000,commandMlS:2.5625,previousMlS:2.5},{kind:'write',tMs:2000,commandMlS:3.0,previousMlS:2.75}]}};const markers=ctx.liveTrimMarkers(run);const m1=markers.find(x=>x.x===1),m2=markers.find(x=>x.x===2);assert.equal(m1.shape,'up');assert.equal(m2.shape,'up');assert(m2.size>m1.size);const svg={innerHTML:''};ctx.renderChart(svg,[{points:[[0,0],[3,6]],stroke:'#fff'}],0,6,markers);const ps=[];let idx=svg.innerHTML.indexOf('<path');while(idx>=0){const dq=svg.innerHTML.indexOf('d="',idx);const d0=dq+3;const d1=svg.innerHTML.indexOf('"',d0);ps.push(svg.innerHTML.slice(d0,d1));idx=svg.innerHTML.indexOf('<path',d1);}assert(ps.length>=2);assert.notEqual(ps[0],ps[1]);});


test('live-trim completed shot still queues the normal next-shot evaluator',async()=>{const e=await trimFixture();const run=e.s.liveTrim.run;e.s.phase='finishing';e.h.resetSequence('completed at 100 g');assert(e.s.autoApplyTimer);assert.equal(e.s.autoApplyLastStatus.status,'scheduled');assert.equal(e.s.autoApplyLastStatus.runId,run.runId);});
test('original profile is actually re-uploaded after raw edits before next shot',async()=>{const e=await trimFixture();await trimTick(e);e.s.lastMachineState='idle';e.h.resetSequence('test restore');e.calls.length=0;await e.h.syncHyperExProfile(true);assert(e.calls.some(c=>c.path==='/machine/profile'&&c.method==='POST'));assert.equal(e.s.runtimeProfileVerified,true);assert.deepEqual(copy(e.mock.workflow.steps.map(x=>+x.flow)),[.719,2.507,.569]);});

test('live trim forces required diagnostics even when regular diagnostic logging is OFF',()=>{const e=setup();e.s.cfg.diagnosticEnabled=false;e.s.cfg.liveFlowTrimTest=true;e.h.startSequence(0);assert(e.s.diagnosticCurrent);assert(e.s.liveTrim);assert(e.s.diagnosticCurrent.samples.length>0);});

test('all four levels freeze cadence and budgets independently of enable switch',()=>{for(const [level,ms,budget] of [[1,944,50],[2,300,150],[3,250,200],[4,200,250]]){const e=setup();e.s.cfg=e.h.loadConfig({LiveFlowTrimTest:true,LiveFlowTrimLevel:level});e.h.startSequence(0);const t=e.s.liveTrim;assert.equal(t.report.periodMs,ms);assert.equal(t.report.maxChecks,2000);assert.equal(t.report.maxWrites,budget);e.s.cfg.liveFlowTrimLevel=1;assert.equal(t.report.level,level);assert.equal(e.s.autoApplyNextShot,true);}});
test('invalid levels fall back to3 and explicit OFF stays off regardless of selected level',()=>{for(const level of [0,5,-1,2.5,'x',Infinity])assert.equal(setup().h.loadConfig({LiveFlowTrimLevel:level}).liveFlowTrimLevel,3);const e=setup();e.s.cfg=e.h.loadConfig({LiveFlowTrimTest:false,LiveFlowTrimLevel:4});e.h.startSequence(0);assert.equal(e.s.liveTrim,null);});
test('fast levels release successful feedback and permit a later level tick',async()=>{const e=await trimFixture();e.s.liveTrim.report.periodMs=200;await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});e.advance(200);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.feedbackReleases,1);});
test('each level stops at its budget and reports dynamic limits in UI',async()=>{for(const budget of [150,200,250]){const e=await trimFixture();e.s.liveTrim.report.maxChecks=budget;e.s.liveTrim.report.checks=budget-1;trimSamples(e,5);await trimTick(e);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,budget);assert.equal(e.s.liveTrim.active,false);assert.equal(rawWrites(e).length,0);}const html=setup().h.buildGhcOverlayHtml();assert.match(html,/adv_liveFlowTrimLevel/);assert.match(html,/type="range" min="1" max="4" step="1"/);});
test('unconfirmed write records observed frame and target for transition diagnosis',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.s.lastFrame=2;e.s.phase='stage3';e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:2,targetFlow:.75});e.advance(2200);await trimTick(e);const row=e.s.liveTrim.report.trace.find(x=>x.kind==='vector-unresponsive');assert.equal(row.frame,1);assert.equal(row.lastObserved.frame,2);assert.equal(row.lastObserved.targetFlowMlS,.75);assert.equal(e.s.liveTrim.report.targetConfirmations,0);});

test('final budget write retains ACK watchdog without creating another check',async()=>{const e=await trimFixture();e.s.liveTrim.report.checks=1999;await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(2200);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,2000);assert.equal(e.s.phase,'aborted');assert.equal(e.s.liveTrim.report.trace.filter(x=>x.kind==='check').length,1);});

test('slider loads current level, updates labels without saving, and saves enum value',async()=>{
 const html=setup().h.buildGhcOverlayHtml();const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);const script=scripts.find(s=>s.includes('function updateTrimLevelLabel'));
 const lines=script.split('\n');const names=['updateTrimLevelLabel','loadAdvancedSettings','saveAdvancedSettings'];const fns=names.map(n=>lines.find(l=>l.startsWith('function '+n+'(')||l.startsWith('async function '+n+'('))).join('\n');
 const slider={value:'1',type:'range',setAttribute(k,v){this[k]=v}},output={textContent:''},meta={innerHTML:''};let saved=null;
 const ctx=vm.createContext({Number,String,Object,setTimeout(){},location:{reload(){}},alert(){},confirm:()=>true,base:'/plugin',coreSettings:'/settings',ADV_FIELDS:['liveFlowTrimLevel'],ADV_SETTING_KEYS:{liveFlowTrimLevel:'LiveFlowTrimLevel'},esc:String,$:id=>({'adv_liveFlowTrimLevel':slider,'adv_liveFlowTrimLevelLabel':output,advancedmeta:meta}[id]),fetch:async(url,opts)=>{if(opts){saved=JSON.parse(opts.body);return{ok:true}}return{ok:true,json:async()=>({canEdit:true,settings:{liveFlowTrimLevel:3}})}}});
 vm.runInContext(fns,ctx);await ctx.loadAdvancedSettings();assert.match(output.textContent,/三档.*250 ms.*200次写入/);assert.equal(saved,null);
 slider.value='4';ctx.updateTrimLevelLabel();assert.match(output.textContent,/四档.*200 ms.*250次写入/);assert.match(slider['aria-valuetext'],/四档/);assert.equal(saved,null);await ctx.saveAdvancedSettings();assert.equal(saved.LiveFlowTrimLevel,'4');
 const manifest=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json'),'utf8'));assert.equal(manifest.settings.LiveFlowTrimLevel.type,'enum');assert.deepEqual(manifest.settings.LiveFlowTrimLevel.values,['1','2','3','4']);for(const value of manifest.settings.LiveFlowTrimLevel.values)assert.equal(setup().h.loadConfig({LiveFlowTrimLevel:value}).liveFlowTrimLevel,Number(value));
});

test('confirmed target after retry clears streak and advances only one command quantum',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,1);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);assert.equal(e.s.liveTrim.commands[1],2.75);e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.pending.command,3.0);});
test('retry still requires fresh data and pressure headroom',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);e.s.lastPressure=5.9;await trimTick(e);assert.equal(rawWrites(e).length,1);assert(e.s.liveTrim.retry);e.s.lastPressure=1;e.s.latestScaleAtMs-=1000;await trimTick(e);assert.equal(rawWrites(e).length,1);});
test('error reversal holds an unresolved target rather than retrying wrong direction',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e,6);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'unconfirmed-target-direction-changed');});
test('late target response during retry hold is accepted and clears streak',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e,5);await trimTick(e);assert(e.s.liveTrim.retry);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});assert.equal(e.s.liveTrim.retry,null);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);assert.equal(e.s.liveTrim.commands[1],2.75);});
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
test('all write caps are independent of2000 checks and never exceeded',async()=>{for(const cap of [50,150,200,250]){const e=await trimFixture();e.s.liveTrim.report.maxWrites=cap;e.s.liveTrim.report.writes=cap-1;await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});e.advance(2200);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.report.writes,cap);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.active,true);assert.equal(e.s.liveTrim.report.maxChecks,2000);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,cap+'-write-budget');}});
test('temperature differences do not exclude prior cup numeric consensus or rewrite original temperature',async()=>{const e=setup(),old=coffeeRun(e,'old92');e.h.rememberAdaptiveEvidence(old);e.s.pendingHistoryWrite=null;e.s.persistentHistoryAvailable=true;e.s.cfg.temperature=94;const current=coffeeRun(e,'new94');e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.persistentHistoryCompatibleCount,1);assert.equal(e.s.adaptiveHistory[0].fingerprint.shotSettings.temperature,92);assert.equal(current.config.adaptiveFingerprint.shotSettings.temperature,94);const q=e.h.nextShotAdaptiveSuggestion(current);assert.equal(q.s2.confidence,'HIGH');assert(q.s3.suggestedShape);const lut=JSON.stringify(e.s.calibrationMap);await e.h.autoApplyNextShotIfEligible(current);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(JSON.stringify(e.s.calibrationMap),lut);});
test('cross-temperature matching retains physical basket LUT multiplier and mode while reusing micro settings',()=>{const e=setup();const a=copy(e.h.adaptiveHistoryFingerprint()),b=copy(a);b.shotSettings.temperature=94;assert.equal(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(b));assert.notEqual(e.h.adaptiveHistoryFingerprintKey(a),e.h.adaptiveHistoryFingerprintKey(b));for(const change of [q=>q.basketContext='coffee',q=>q.mapCreatedAt='other',q=>q.shotSettings.activeRelease=false,q=>q.actualFlowMultiplier=1.2]){const q=copy(b);change(q);assert.notEqual(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(q));}});
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
test('duplicate RAW timestamps cannot satisfy relaxed live-learning windows',()=>{const e=setup(),r=controlledRun(e);for(const x of r.rawScaleSamples)if(x.phase==='stage2')x.scaleTimestampSeconds=100;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert.match(d.reason,/withheld:.*no usable RAW windows|waiting for sustained cup outflow/);});
test('poor RAW regression is not admitted merely because machine targets are known',()=>{const e=setup(),r=controlledRun(e);let i=0;for(const x of r.rawScaleSamples)if(x.phase==='stage2')x.weightG=10+(i++%2?20:0);assert.equal(e.h.controlLearningAssessment(r,'stage2').eligible,false);});
test('original fixed-command evidence path remains unchanged when live trim never writes',()=>{const e=setup(),r=coffeeRun(e);r.config.experimentalLiveTrim=true;r.liveFlowTrim={trace:[]};assert.equal(e.h.controlLearningAssessment(r,'stage2').applicable,false);assert(e.h.stage2AdaptiveEvidence(r));});
test('±2% live band can act where old±6% would hold, without extra command quantum',async()=>{const e=await trimFixture();trimSamples(e,5.2);await trimTick(e);assert.equal(e.s.liveTrim.report.deadbandPct,2);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.pending.command,2.375);});
test('next-shot±8% band adjusts two consistent10% deficits and holds within8%',()=>{const e=setup();const opts={deadbandPct:8,maxVariability:.15,gain:.25,maxFraction:.05,maxAbs:.1,rule:'8%'};const a={targetGS:5,command:2.5,measured:4.5},b={...a};assert.equal(e.h.scalarConsensusSuggestion('S2',a,b,opts).action,'ADJUST');a.measured=b.measured=4.65;assert.equal(e.h.scalarConsensusSuggestion('S2',a,b,opts).action,'HOLD');});
test('learning reports and raw diagnostics remain distinct in exports',()=>{const e=setup(),r=controlledRun(e);const s=e.h.diagnosticSummary(r);assert(s.learningEvidence.stage2.eligible);assert.match(s.nextShotAdaptive.s2.evidenceBasis,/normalized/);assert.notEqual(s.stage2.rawRegressionGS,s.learningEvidence.stage2.evidence.measured);});


test('ACK alone cannot release feedback wait early',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(300);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.feedbackReleases,0);});
test('target alone cannot release feedback wait without driver ACK',async()=>{const e=await trimFixture();await trimTick(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});e.advance(300);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);});
test('confirmed feedback still respects minimum50ms and needs a new scale source sample',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});e.advance(40);await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(20);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-new-scale-sample');e.advance(240);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,2);});
test('wrong-frame target cannot release a pending write',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:2,targetFlow:2.5625});e.advance(300);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,1);});
test('rapid confirmed command changes use dynamic exposure instead of needing long fixed epochs',()=>{const e=setup(),r=controlledRun(e);r.liveFlowTrim.trace=r.liveFlowTrim.trace.filter(x=>x.frame!==1);for(const row of r.samples.filter(x=>x.phase==='stage2')){const n=Math.floor((row.tMs-8000)/300),cmd=2.5+(n%3)*.0625;row.targetFlowMlS=cmd;row.machineFlowMlS=cmd;r.liveFlowTrim.trace.push({kind:'write',frame:1,tMs:row.tMs,commandMlS:cmd});}const d=e.h.controlLearningAssessment(r,'stage2');assert(d.eligible,d.reason);assert(d.frames[0].windows.some(x=>x.dynamicExposure));assert(e.h.stage2AdaptiveEvidence(r));});
test('observed RAW output quality stays available when driver command attribution is missing',()=>{const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2')delete x.targetFlowMlS;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert(d.outputQuality.available);assert(d.outputQuality.tailMeanGS>0);assert.equal(d.outputQuality.targetGS,5);assert.match(d.outputQuality.basis,/actual RAW/);});


test('plugin self-review reports stage outcome and learning without requiring external exports',()=>{const e=setup(),r=controlledRun(e,'review',true);const q=e.h.controlRunReview(r);assert(q);assert.equal(q.phases.length,2);assert(q.phases[0].status.includes('偏离'));assert.match(q.phases[0].learningStatus,/已纳入/);assert.match(q.note,/无需日常上传/);assert(q.phases[0].actionGroups.some(x=>x.writes>1));});
test('review never turns overlapping actions into individual causal success claims',()=>{const e=setup(),r=controlledRun(e);const q=e.h.controlRunReview(r);const g=q.phases[0].actionGroups.find(x=>x.writes>1);assert(g);assert.match(g.attribution,/组合/);assert.match(g.status,/窗口不足|组后|组前后/);});
test('self-review panel is present in final generated script and summary export',()=>{const e=setup(),r=controlledRun(e);const s=e.h.diagnosticSummary(r);assert(s.controlReview);const html=e.h.buildGhcOverlayHtml();assert.match(html,/本杯控制诊断/);assert.match(html,/actionGroups/);});

async function degradedTrim(){const e=await trimFixture();await trimTick(e);for(let i=0;i<4;i++){trimAck(e);e.advance(2200);trimSamples(e);await trimTick(e);}assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,4);assert.equal(e.s.liveTrim.commands[1],undefined);return e;}
test('unresponsive trend keeps redispatching a bounded vector while checks continue',async()=>{const e=await degradedTrim(),n=rawWrites(e).length,checks=e.s.liveTrim.report.checks;trimAck(e);e.advance(2100);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,n+1);assert(e.s.liveTrim.pending);assert(e.s.liveTrim.pending.command>2.6&&e.s.liveTrim.pending.command<=3);assert.equal(e.s.liveTrim.report.checks,checks+1);assert.equal(e.s.liveTrim.active,true);});
test('fresh trend feedback during unresponsive resumes normal control',async()=>{const e=await degradedTrim();e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});trimAck(e);assert.equal(e.s.liveTrim.retry,null);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);assert.equal(e.s.liveTrim.report.status,'monitoring');assert(e.s.liveTrim.commands[1]>2.6&&e.s.liveTrim.commands[1]<=3);e.advance(250);trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.pending.command,3.0);});
test('degraded target retry holds after cup error reverses',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;trimAck(e);e.advance(2100);trimSamples(e,6);await trimTick(e);assert.equal(rawWrites(e).length,n);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'unconfirmed-target-direction-changed');assert(e.s.liveTrim.active);});
test('degraded target retries require fresh scale and machine telemetry',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;trimAck(e);e.advance(2100);trimSamples(e);e.s.lastMachineAtMs-=1000;await trimTick(e);assert.equal(rawWrites(e).length,n);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'settling-or-stale-telemetry');});
test('degraded retry cannot spend beyond write cap; checks and late recovery remain active',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;e.s.liveTrim.report.maxWrites=e.s.liveTrim.report.writes;trimAck(e);e.advance(2100);trimSamples(e);await trimTick(e);assert.equal(rawWrites(e).length,n);assert(e.s.liveTrim.active);assert.match(e.s.liveTrim.report.trace.slice(-1)[0].reason,/write-budget/);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});trimAck(e);assert.equal(e.s.liveTrim.report.consecutiveTargetMisses,0);});
test('new S3 frame drops degraded S2 retry and can control its own bounded target',async()=>{const e=await degradedTrim(),n=rawWrites(e).length;e.s.phase='stage3';e.s.lastFrame=2;e.h.observeLiveTrimMachine({profileFrame:2});trimAck(e);e.advance(2200);trimSamples(e,1.2);await trimTick(e);assert.equal(rawWrites(e).length,n+1);assert.equal(e.s.liveTrim.pending.frame,2);assert.equal(e.s.liveTrim.pending.command,.625);assert(e.s.liveTrim.report.trace.some(x=>x.kind==='unconfirmed-frame-ended'));});
test('target retries cannot reuse the last written scale source endpoint',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2200);trimSamples(e);const r=e.h.liveTrimRegression(e.s.liveTrim);e.s.liveTrim.lastDecisionStamp[1]=r.sourceEndStamp;await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-new-scale-sample');});
test('recoverable feedback still ends at check budget and never resets budgets on recovery',async()=>{const e=await degradedTrim();const writes=e.s.liveTrim.report.writes;trimAck(e);e.advance(2100);e.s.liveTrim.report.checks=2000;trimSamples(e);await trimTick(e);assert.equal(e.s.liveTrim.active,false);assert.equal(e.s.liveTrim.report.status,'2000-check-budget-complete');assert.equal(e.s.liveTrim.report.writes,writes);});

async function curveFixture(){const e=setup();await e.h.syncHyperExProfile(true);const snapshot=e.h.curveEditorSnapshot();return {e,snapshot,body:{revision:snapshot.revision,values:copy(snapshot.values),shaped:snapshot.shaped}};}
test('curve editor applies S2 draft into verified NEXT SHOT without changing other seeds or LUT',async()=>{const {e,body}=await curveFixture(),lut=JSON.stringify(e.s.calibrationMap);body.values.stage2=2.6875;const r=await e.h.applyCurveEditorDraft(body);assert(r.verified);assert.equal(e.h.commandFlowSummary().stage2CommandMlS,2.688);assert.equal(e.mock.workflow.steps[1].flow,'2.688');assert.equal(e.h.commandFlowSummary().stage1CommandMlS,.719);assert.equal(e.h.commandFlowSummary().stage1Mode,'auto');assert.equal(JSON.stringify(e.s.calibrationMap),lut);assert(e.h.runtimeProfileTruthPayload().verified);assert.equal(e.s.autoApplyLastStatus.status,'curve-applied');assert(e.h.commandFlowSummary().manualCurveSource);});
test('curve editor S3 three controls generate natural timed frames and verified shape',async()=>{const {e,body}=await curveFixture();body.shaped=true;body.values.early=.625;body.values.mid=.6875;body.values.late=.75;body.values.earlySeconds=9;body.values.midSeconds=13;await e.h.applyCurveEditorDraft(body);const p=e.h.profileObject();assert.equal(p.steps.length,5);assert.equal(Number(p.steps[2].seconds),9);assert.equal(Number(p.steps[3].seconds),13);assert.equal(e.h.commandFlowSummary().stage3Mode,'shape');assert(!e.calls.some(x=>x.path==='/machine/state/skipStep'));});
test('curve draft stale after another command, temperature or target change is rejected without mutation',async()=>{for(const change of [e=>e.s.cfg.temperature=94,e=>e.s.cfg.stage2Flow=4.5,e=>e.s.workflowSelectionRevision++]){const {e,body}=await curveFixture();body.values.stage2=2.6875;change(e);const before=JSON.stringify(e.s.testOverrides);await assert.rejects(e.h.applyCurveEditorDraft(body),/已改变/);assert.equal(JSON.stringify(e.s.testOverrides),before);}});
test('curve application detects unseen homepage profile edits on fresh GET',async()=>{const {e,body}=await curveFixture();body.values.stage2=2.6875;e.mock.workflow.steps[0].temperature='94';await assert.rejects(e.h.applyCurveEditorDraft(body),/已改变/);assert.equal(e.s.testOverrides,null);});
test('curve rejects busy shot, missing verification and concurrent edits',async()=>{for(const change of [e=>e.s.phase='stage2',e=>e.s.runtimeProfileVerified=false,e=>e.s.curveApplyBusy=true]){const {e,body}=await curveFixture();body.values.stage2=2.6875;change(e);const before=e.writes().length;await assert.rejects(e.h.applyCurveEditorDraft(body));assert.equal(e.writes().length,before);}});
test('curve editor rejects invalid shapes, bounds and nonnumeric payloads before storage',async()=>{for(const modify of [b=>b.values.stage2=NaN,b=>b.values.stage1=9,b=>b.values.mid='0.7',b=>{b.shaped=true;b.values.early=1;b.values.mid=.5},b=>b.values.earlySeconds=31,b=>b.values.late=.75]){const {e,body}=await curveFixture();modify(body);await assert.rejects(e.h.applyCurveEditorDraft(body));assert.equal(e.s.testOverrides,null);}});
test('manual curve overrides old-run auto suggestions but allows a new completed run to learn',async()=>{const {e,body}=await curveFixture();const run=evidenceRun(e,'old');e.s.diagnosticLast=run;body.values.stage2=2.6875;const timer=e.s.autoApplyTimer=12345;e.timers.set(timer,{fn(){throw Error('stale timer')},ms:250});await e.h.applyCurveEditorDraft(body);assert.equal(e.s.autoApplyTimer,null);assert(e.h.manualCurveBlocksRun(run));assert(!e.h.manualCurveBlocksRun({...run,runId:'new'}));await assert.rejects(e.h.applyNextShotAdaptiveSuggestion(run,'auto'),/手动曲线/);const count=e.writes().length;await e.h.autoApplyNextShotIfEligible(run);assert.equal(e.writes().length,count);const stored=copy(e.s.testOverrides);e.s.testOverrides=copy(stored);assert(e.h.manualCurveBlocksRun(run));});
test('failed curve upload rolls back overrides and retains LUT',async()=>{const {e,body}=await curveFixture();body.values.stage2=2.6875;let failed=false;e.mock.fail=p=>p==='/machine/profile'&&!failed?(failed=true,'upload denied'):null;await assert.rejects(e.h.applyCurveEditorDraft(body),/upload denied/);assert.equal(e.s.testOverrides,null);assert.equal(e.h.commandFlowSummary().stage2CommandMlS,2.507);assert.equal(e.mock.workflow.steps[1].flow,'2.507');assert.equal(e.s.curveApplyBusy,false);assert(e.s.calibrationMap.valid);});
function curveUi(){const e=setup(),html=e.h.buildGhcOverlayHtml(),script=html.slice(html.indexOf('let curveLatest='),html.indexOf('function paint(x)'));const ids=['curveeditorchart','curvepoints','curveparams','curvestatus','curveshowcurrent','curveshowdraft','curveshape','curveselected','curvetimes','curveapply','curveup','curvedown','curvereset'];const els={};for(const id of ids)els[id]={innerHTML:'',checked:true,textContent:'',disabled:false,querySelectorAll(){return []},setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){},getBoundingClientRect(){return {top:0,height:232}}};const ctx=vm.createContext({Number,Math,JSON,$:id=>els[id]||null,post:async()=>{throw Error('no UI writes in preview')},loadDiag:async()=>{}});vm.runInContext(script+"\nglobalThis.ui={applyCurveDraft,renderCurveEditor,curveNudge,curveSetValue,curveReset,curveTime,curveShapeToggle,get:()=>({draft:curveDraft,dirty:curveDirty}),select:i=>curveSelected=i};",ctx);const snap=copy(e.h.curveEditorSnapshot());snap.canApply=true;ctx.ui.renderCurveEditor(snap);return {e,ctx,ui:ctx.ui,els,snap};}
test('curve controls nudge one native quantum and preserve dirty draft across refresh',()=>{const {ui,els,snap}=curveUi();ui.select(1);ui.curveNudge(1);assert.equal(ui.get().draft.values.stage2,2.5625);assert(ui.get().dirty);assert.equal(els.curveapply.disabled,false);ui.renderCurveEditor(snap);assert.equal(ui.get().draft.values.stage2,2.5625);assert.match(els.curveparams.innerHTML,/2.5625/);assert.match(els.curveeditorchart.innerHTML,/data-curve-point="4"/);});
test('curve draft retains edits but disables apply when actual parameters change',()=>{const {ui,els,snap}=curveUi();ui.curveNudge(1);ui.renderCurveEditor({...snap,revision:'changed'});assert(ui.get().dirty);assert.equal(els.curveapply.disabled,true);assert.match(els.curvestatus.textContent,/已保留/);ui.curveReset();assert.equal(ui.get().dirty,false);assert.equal(ui.get().draft.revision,'changed');});
test('curve S3 adjustment respects monotonic adjacent bounds and timing',()=>{const {ui}=curveUi();ui.select(4);ui.curveNudge(1);assert(ui.get().draft.shaped);const v=ui.get().draft.values;assert(v.early<=v.mid&&v.mid<=v.late);ui.curveSetValue(8);assert(v.late<=Math.max(v.mid+.25,v.mid*1.35));for(let i=0;i<40;i++)ui.curveTime('earlySeconds',-1);assert.equal(v.earlySeconds,3);ui.curveShapeToggle(false);assert.equal(v.early,v.mid);assert.equal(v.mid,v.late);});
test('actual pointer drag updates preview parameters without any server write',()=>{const {ui,els}=curveUi();els.curveeditorchart.onpointerdown({target:{closest:()=>({dataset:{curvePoint:'1'}})},pointerId:1,preventDefault(){}});els.curveeditorchart.onpointermove({clientY:75,pointerId:1,preventDefault(){}});els.curveeditorchart.onpointerup({pointerId:1});assert(ui.get().dirty);assert.notEqual(ui.get().draft.values.stage2,2.507);});
test('curve keyboard arrow selects control point and nudges quantized command',()=>{const {ui,els}=curveUi();els.curveeditorchart.onkeydown({target:{closest:()=>({dataset:{curvePoint:'0'}})},key:'ArrowDown',preventDefault(){}});assert.equal(ui.get().draft.values.stage1,.6875);});
test('unknown historical write direction never invents an up/down arrow',()=>{const e=setup(),line=source.split('\n').find(x=>x.startsWith('function liveTrimMarkers(')),ctx=vm.createContext({Number});vm.runInContext(line,ctx);const m=ctx.liveTrimMarkers({liveFlowTrim:{trace:[{kind:'write',tMs:1000,commandMlS:2.5}]}});assert.equal(m[0].shape,'unknown');});
test('S2 rejected learning provides explicit numeric gate failures rather than ambiguous minimum text',()=>{const e=setup(),r=controlledRun(e);r.rawScaleSamples=r.rawScaleSamples.filter(x=>x.phase!=='stage2'||x.tMs<10400);const q=e.h.controlLearningAssessment(r,'stage2');assert.equal(q.eligible,false);assert.match(q.reason,/withheld:|fewer|coverage/);if(q.frames.length){assert(q.frames[0].admission);assert(q.frames[0].admission.failures.length);assert.equal(q.frames[0].admission.minimumTemporalCoveragePct,25);}});

test('dynamic exposure fallback runs when fixed seconds pass minimum but fail temporal coverage',()=>{const e=setup(),r=controlledRun(e);r.liveFlowTrim.trace=r.liveFlowTrim.trace.filter(x=>x.frame!==1);let w=0,prev=2.5;for(const x of r.samples.filter(x=>x.phase==='stage2')){const dt=x.tMs/1000-8,cmd=dt>=10?2.5625:2.5+(Math.floor(dt/1.6)%2)*.0625;x.targetFlowMlS=cmd;x.machineFlowMlS=cmd;w+=cmd*1.4*.1;const row=r.rawScaleSamples.find(q=>q.phase==='stage2'&&q.tMs===x.tMs);row.weightG=w;if(cmd!==prev){r.liveFlowTrim.trace.push({kind:'write',frame:1,tMs:x.tMs,commandMlS:cmd,previousMlS:prev});prev=cmd;}}const q=e.h.controlLearningAssessment(r,'stage2');assert(q.eligible,q.reason);assert(q.frames[0].windows.some(x=>x.dynamicExposure));assert(q.frames[0].admission.temporalCoveragePct>=25);});
test('next-shot decision UI states automatic failure and manual supersession beside MISS result',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml(),fn=html.split('\n').find(x=>x.startsWith('function renderNextDecision(')),el={innerHTML:''};const ctx=vm.createContext({String,$:()=>el,esc:x=>String(x),latestManualCurveSource:null,latestAutoApplyStatus:{runId:'r',status:'error'},latestAutoApplyEnabled:true});vm.runInContext(fn,ctx);const summary={stage2:{validationStatus:'MISS',rawErrorPct:-40},nextShotAdaptive:{runId:'r',s2:{action:'ADJUST',reason:'two matching cups'}}};ctx.renderNextDecision(summary);assert.match(el.innerHTML,/应用失败/);assert.match(el.innerHTML,/MISS -40%/);ctx.latestManualCurveSource={afterRunId:'r'};ctx.renderNextDecision(summary);assert.match(el.innerHTML,/手动曲线已替代/);});

test('manual numeric endpoint verifies NEXT SHOT and marks prior-run suggestion superseded',async()=>{const {e}=await curveFixture();e.s.diagnosticLast=evidenceRun(e,'old');const r=await e.plugin.__httpRequestHandler({requestId:'manual',endpoint:'test-command-set',body:{stages:{stage2:{mode:'manual',command:2.6}},s3Shape:{enabled:false},revision:e.h.curveEditorRevision()}});const j=JSON.parse(r.body);assert.equal(r.status,200,j.error);assert(j.verified);assert(j.profileTruth.verified);assert(j.curveEditor.canApply);assert(e.h.manualCurveBlocksRun(e.s.diagnosticLast));assert.equal(e.s.curveApplyBusy,false);});
test('manual numeric upload failure restores prior settings instead of reporting applied',async()=>{const {e}=await curveFixture();let failed=false;e.mock.fail=p=>p==='/machine/profile'&&!failed?(failed=true,'no upload'):null;const r=await e.plugin.__httpRequestHandler({endpoint:'test-command-set',body:{stages:{stage2:{mode:'manual',command:2.6}}}});assert.equal(r.status,409);assert.equal(e.s.testOverrides,null);assert.equal(e.s.curveApplyBusy,false);assert.equal(e.h.commandFlowSummary().stage2CommandMlS,2.507);});
test('return to LUT is verified and prevents stale old-run auto suggestion from restoring overrides',async()=>{const {e,body}=await curveFixture();e.s.diagnosticLast=evidenceRun(e,'old');body.values.stage2=2.6875;await e.h.applyCurveEditorDraft(body);const r=await e.plugin.__httpRequestHandler({endpoint:'test-command-clear',body:{}}),j=JSON.parse(r.body);assert.equal(r.status,200,j.error);assert(j.verified);assert.equal(j.commandFlows.stage2Mode,'auto');assert.equal(j.commandFlows.stage2CommandMlS,2.507);assert(e.h.manualCurveBlocksRun(e.s.diagnosticLast));});
test('curve HTTP endpoint returns verified truth and fresh revision after applying',async()=>{const {e,body}=await curveFixture();body.values.stage2=2.6875;const r=await e.plugin.__httpRequestHandler({endpoint:'curve-edit-apply',body}),j=JSON.parse(r.body);assert.equal(r.status,200,j.error);assert(j.verified);assert(j.profileTruth.verified);assert.notEqual(j.curveEditor.revision,body.revision);});
test('failed manual application preserves a queued automatic evaluation',async()=>{const {e,body}=await curveFixture();const run=evidenceRun(e,'queued');e.s.diagnosticLast=run;e.s.autoApplyLastStatus={runId:'queued',status:'scheduled'};e.s.autoApplyTimer=999;e.timers.set(999,{fn(){},ms:250});body.values.stage2=2.6875;let failed=false;e.mock.fail=p=>p==='/machine/profile'&&!failed?(failed=true,'no upload'):null;await assert.rejects(e.h.applyCurveEditorDraft(body),/no upload/);assert(e.s.autoApplyTimer);assert.notEqual(e.s.autoApplyTimer,999);assert.equal(e.s.autoApplyLastStatus.status,'scheduled');});

test('successful curve apply followed by UI refresh failure remains labelled applied',async()=>{const {ui,ctx,els,snap}=curveUi();ui.curveNudge(1);ctx.post=async()=>({verified:true,profileTruth:{verified:true},curveEditor:{...snap,revision:'new'},commandFlows:{manualCurveSource:{mode:'curve-editor'}}});ctx.loadDiag=async()=>{throw Error('refresh offline')};await ui.applyCurveDraft();assert.match(els.curvestatus.textContent,/已校验应用到下一杯.*刷新失败/);assert.equal(ui.get().dirty,false);});
test('failed curve application keeps preview draft and explicitly says not applied',async()=>{const {ui,ctx,els}=curveUi();ui.curveNudge(1);ctx.post=async()=>{throw Error('upload denied')};await ui.applyCurveDraft();assert.match(els.curvestatus.textContent,/未应用.*草稿已保留/);assert(ui.get().dirty);});

test('UI language defaults to Chinese and restores English from plugin storage',async()=>{const e=setup();assert.equal(e.initialLanguage,'zh');e.event('uiLanguage','en');const r=await e.plugin.__httpRequestHandler({endpoint:'language',method:'GET'});assert.equal(JSON.parse(r.body).language,'en');});
test('language endpoint persists preference without changing curve, LUT, history or making machine writes',async()=>{const e=setup(),before=JSON.stringify({profile:e.h.profileObject(),lut:e.s.calibrationMap,history:e.s.adaptiveHistory}),count=e.writes().length;const r=await e.plugin.__httpRequestHandler({endpoint:'language',method:'POST',body:{language:'zh'}});assert.equal(r.status,200);assert.equal(e.storage.uiLanguage,'zh');assert.equal(e.writes().length,count);assert.equal(JSON.stringify({profile:e.h.profileObject(),lut:e.s.calibrationMap,history:e.s.adaptiveHistory}),before);e.event('uiLanguage','en');assert.equal(e.s.uiLanguage,'zh');});
test('invalid language and failed preference storage retain the previous language',async()=>{for(const fail of [false,true]){const e=setup({failLanguageSave:fail}),r=await e.plugin.__httpRequestHandler({endpoint:'language',method:'POST',body:{language:fail?'zh':'xx'}});assert.equal(r.status,fail?503:400);assert.equal(e.s.uiLanguage,'en');}});
test('dashboard flow, soak and GHC surfaces follow selected language without changing actions',()=>{const e=setup();for(const phase of ['idle','soak','restart_wait','dumping']){e.s.phase=phase;e.s.uiLanguage='en';const en=copy(e.h.buildSkinSurfaceAnswer());e.s.uiLanguage='zh';const zh=copy(e.h.buildSkinSurfaceAnswer());assert.equal(zh.surfaces.length,en.surfaces.length);for(let i=0;i<en.surfaces.length;i++)assert.deepEqual(zh.surfaces[i].action,en.surfaces[i].action);assert(zh.surfaces.some((x,i)=>x.label!==en.surfaces[i].label));}});
test('translator covers key static pages, curve editor and exact learning gate values in both languages',()=>{const e=setup(),tr=e.h.translateUiText;assert.equal(tr('NEXT SHOT · APPLIED PROFILE','zh'),'下一杯 · 已应用曲线');assert.equal(tr('下一杯 · 曲线编辑','en'),'Next shot · Curve editor');const x=tr('Live learning: S2 withheld: usable 2.84s; temporal coverage 23.7% < 25%; consistent-window share 54.2% < 60%.','zh');assert.match(x,/时间覆盖率 23.7%/);assert.match(x,/一致窗口占比 54.2%/);assert.match(x,/2.84s/);assert.equal(tr('同值重试 ↻','en'),'Same-target retry ↻');assert.equal(tr('monitoring-unresponsive-trend','zh'),'趋势未响应，重新决策中');});
function localeFixture(options={}){
 const e=setup({uiLanguage:'zh'}),html=e.h.buildGhcOverlayHtml(),script=Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g),x=>x[1])[0],byId={},requests=[],dialogs=[];let callback;
 function element(tag,id){const n={nodeType:1,tagName:tag.toUpperCase(),childNodes:[],attrs:{},parentElement:null,dataset:{},disabled:false,style:{},getAttribute(k){return this.attrs[k]??null},setAttribute(k,v){this.attrs[k]=String(v)},hasAttribute(k){return k in this.attrs},querySelectorAll(){return this===bar?buttons:[]},closest(){let p=this;while(p){if(['SCRIPT','STYLE','TEXTAREA','INPUT','PRE','CODE'].includes(p.tagName)||p.hasAttribute('data-no-i18n'))return p;p=p.parentElement}return null}};if(id)byId[id]=n;return n;}
 function append(parent,node){node.parentElement=parent;parent.childNodes.push(node);return node;}
 function text(value){return {nodeType:3,nodeValue:value,parentElement:null};}
 const body=element('body'),bar=append(body,element('div','hx-language'));bar.setAttribute('data-no-i18n','');const buttons=['zh','en'].map(code=>{const b=append(bar,element('button'));b.dataset.language=code;return b});const status=append(bar,element('span','hx-language-status'));
 const label=append(body,text('NEXT SHOT · APPLIED PROFILE')),dynamic=append(body,text('当前参数已更新；草稿已保留，请先重新载入当前曲线再编辑。'));
 const textarea=append(body,element('textarea'));textarea.value='runId,phase,weightG\nraw,stage2,2.84';append(textarea,text('HIT,2000/200'));const input=append(body,element('input'));input.value='2.5625';const code=append(body,element('code'));append(code,text('{"status":"HIT","frame":1}'));
 const document={body,documentElement:element('html'),getElementById:id=>byId[id]||null};const window={alert:s=>dialogs.push(s),confirm:s=>(dialogs.push(s),true)};
 const context=vm.createContext({document,window,MutationObserver:class{constructor(fn){callback=fn}observe(){}disconnect(){}},fetch:async(url,opt={})=>{requests.push({url,opt});if(opt.method==='POST'&&options.failSave)return {ok:false,json:async()=>({error:'failed'})};return {ok:true,json:async()=>({language:opt.body?JSON.parse(opt.body).language:'zh'})};}});
 vm.runInContext(script,context);return {e,window,document,requests,dialogs,buttons,status,label,dynamic,textarea,input,code,callback,append,text};
}
test('language switch reversibly translates existing and newly authored nodes without changing input/CSV/JSON values',async()=>{const f=localeFixture();await Promise.resolve();assert.equal(f.label.nodeValue,'下一杯 · 已应用曲线');f.window.HXLang.set('en');assert.equal(f.label.nodeValue,'NEXT SHOT · APPLIED PROFILE');assert.match(f.dynamic.nodeValue,/Current parameters changed/);f.dynamic.nodeValue='手动曲线已应用到下一杯；新杯完成后继续自动学习。';f.callback([{type:'characterData',target:f.dynamic}]);assert.match(f.dynamic.nodeValue,/Manual curve applied/);f.window.HXLang.set('zh');assert.equal(f.dynamic.nodeValue,'手动曲线已应用到下一杯；新杯完成后继续自动学习。');assert.equal(f.input.value,'2.5625');assert.equal(f.textarea.value,'runId,phase,weightG\nraw,stage2,2.84');assert.equal(f.code.childNodes[0].nodeValue,'{"status":"HIT","frame":1}');});
test('native confirm/alert dialogs and dynamic tooltips use active language',()=>{const f=localeFixture();f.window.confirm('Apply the bounded NEXT SHOT adaptive suggestion?');assert.match(f.dialogs[0],/应用已限幅/);f.window.HXLang.set('en');f.window.alert('下一杯曲线未校验');assert.equal(f.dialogs[1],'Next-shot curve not verified');const node=f.append(f.document.body,{nodeType:3,nodeValue:'S3 前段',parentElement:null});f.callback([{type:'childList',addedNodes:[node]}]);assert.match(node.nodeValue,/S3 early/i);});
test('language button persists without reloading and failed save rolls back visibly',async()=>{for(const failSave of [false,true]){const f=localeFixture({failSave});await f.buttons[1].onclick();assert.equal(f.requests.filter(x=>x.opt.method==='POST').length,1);assert.equal(f.window.HXLang.get(),failSave?'zh':'en');assert(f.buttons.every(x=>!x.disabled));if(failSave)assert.match(f.status.textContent,/保存失败/);}});
test('rapid language clicks are serialized and do not race preference saves',async()=>{const f=localeFixture();const p=f.buttons[1].onclick();assert(f.buttons.every(x=>x.disabled));await f.buttons[0].onclick();await p;assert.equal(f.requests.filter(x=>x.opt.method==='POST').length,1);assert.equal(f.window.HXLang.get(),'en');});
test('every registered Chinese phrase has a complete English translation',()=>{const e=setup();for(const [en,zh]of e.h.UI_LANGUAGE_PAIRS){assert(!/[\u4e00-\u9fff]/.test(e.h.translateUiText(zh,'en')),zh);assert(en.length>0);}});

test('live trim defaults ON at level3 and preserves explicit saved enable/level settings',()=>{const e=setup(),c=e.h.loadConfig({});assert.equal(c.liveFlowTrimTest,true);assert.equal(c.liveFlowTrimLevel,3);const saved=e.h.loadConfig({LiveFlowTrimTest:false,LiveFlowTrimLevel:'1'});assert.equal(saved.liveFlowTrimTest,false);assert.equal(saved.liveFlowTrimLevel,1);e.s.cfg=c;e.h.startSequence(0);assert.equal(e.s.liveTrim.report.periodMs,250);assert.equal(e.s.liveTrim.report.maxChecks,2000);assert.equal(e.s.liveTrim.report.maxWrites,200);const m=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json'),'utf8'));assert.equal(m.settings.LiveFlowTrimTest.default,true);assert.equal(m.settings.LiveFlowTrimLevel.default,'3');});
test('language POST body works when host omits the optional HTTP method field',async()=>{const e=setup();const r=await e.plugin.__httpRequestHandler({endpoint:'language',body:{language:'zh'}});assert.equal(r.status,200);assert.equal(e.s.uiLanguage,'zh');});

test('English mode translates every Chinese static page text outside the language selector',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml().replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<div id="hx-language"[\s\S]*?<\/div>/,'');for(const m of html.matchAll(/>([^<>]+)</g)){const text=m[1].trim();if(/[\u4e00-\u9fff]/.test(text))assert(!/[\u4e00-\u9fff]/.test(e.h.translateUiText(text,'en')),text);}});
test('Chinese static page labels have no untranslated English prose outside technical names and units',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml().replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<div id="hx-language"[\s\S]*?<\/div>/,'');for(const m of html.matchAll(/>([^<>]+)</g)){const text=e.h.translateUiText(m[1].trim(),'zh'),rest=text.replace(/HyperEx Pulse Filter|HyperEx|HYPEREX|Decaid|DE1|RAW|LUT|ACK|CSV|JSON|GHC|A0[0-9A-F]+|S[123]|g\/s|ml\/s|dW\/dt|weightFlow|skipStep|GET|workflow|bar|ms|ml|mm|CV|R²|v0\.1\.\d+|°C/g,'');assert(!/[A-Za-z]{3,}/.test(rest),text);}});

test('missing S2 in a newer valid history row does not hide an earlier matching S2 cup',()=>{const e=setup(),a=controlledRun(e,'older'),b=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(a);const gap=copy(e.s.adaptiveHistory[0]);gap.runId='gap';gap.s2=null;e.s.adaptiveHistory.push(gap);const q=e.h.nextShotAdaptiveSuggestion(b);assert.equal(q.s2.action,'ADJUST',q.s2.reason);assert.equal(q.s2.historySearch.matchedRunId,'older');assert.equal(q.s2.historySearch.missingStage,1);assert(q.s2.suggestedCommandMlS>2.507);assert(q.s2.suggestedCommandMlS-2.507<=.10001);});
test('history lookup skips incompatible context, command and unverified disk rows to find valid session evidence',()=>{const e=setup(),r=controlledRun(e,'older'),current=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(r);const base=copy(e.s.adaptiveHistory[0]);const command=copy(base);command.runId='other-command';command.s2.command=3;const context=copy(base);context.runId='other-lut';context.fingerprint.actualFlowMultiplier=1.1;const disk=copy(base);disk.runId='unverified-disk';disk.restoredFromDisk=true;e.s.persistentHistoryAvailable=false;e.s.adaptiveHistory.push(command,context,disk);const result=e.h.matchingAdaptiveEvidenceSearch(e.h.stage2AdaptiveEvidence(current),'s2');assert.equal(result.matchedRunId,'other-command');assert.equal(result.checked,3);assert.equal(result.skippedStorage,1);assert.equal(result.skippedContext,1);assert.equal(result.nearbyCommandComparisons,1);assert.equal(result.evidence.originalCommandMlS,3);});
test('newest comparable contradictory cup cannot be skipped to cherry-pick an older agreeing miss',()=>{const e=setup(),r=controlledRun(e,'older'),current=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(r);const conflict=copy(e.s.adaptiveHistory[0]);conflict.runId='newest-comparable';conflict.s2.measured=6.5;e.s.adaptiveHistory.push(conflict);const q=e.h.nextShotAdaptiveSuggestion(current);assert.equal(q.s2.historySearch.matchedRunId,'newest-comparable');assert.notEqual(q.s2.action,'ADJUST');assert.equal(e.h.previousMatchingAdaptiveEvidence(e.h.stage2AdaptiveEvidence(current),'s2').measured,6.5);});
test('S3 also finds earlier same-shape evidence across a row lacking S3',()=>{const e=setup(),a=controlledRun(e,'older',true),b=controlledRun(e,'current',true);e.h.rememberAdaptiveEvidence(a);const gap=copy(e.s.adaptiveHistory[0]);gap.runId='gap';gap.s3=null;e.s.adaptiveHistory.push(gap);const q=e.h.nextShotAdaptiveSuggestion(b);assert.equal(q.s3.historySearch.matchedRunId,'older');assert.equal(q.s3.historySearch.missingStage,1);assert(q.s3.repeatCount===2);});
test('no comparable S2 still waits and reports lookup counters without fabricating evidence',()=>{const e=setup(),r=controlledRun(e,'current');e.s.adaptiveHistory=[{runId:'empty',profileTruthSchema:3,fingerprint:copy(e.h.adaptiveHistoryFingerprint()),s1:{}}];const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s2.action,'REPEAT SAME COMMAND');assert.equal(q.s2.historySearch.matchedRunId,null);assert.equal(q.s2.historySearch.missingStage,1);});

test('earlier valid S2 evidence survives a missing-stage row through automatic upload and final workflow verification',async()=>{const e=setup(),a=controlledRun(e,'older'),b=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(a);const gap=copy(e.s.adaptiveHistory[0]);gap.runId='gap';gap.s2=null;e.s.adaptiveHistory.push(gap);const lut=JSON.stringify(e.s.calibrationMap);await e.h.autoApplyNextShotIfEligible(b);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(e.h.commandFlowSummary().stage2CommandMlS,2.607);assert.equal(e.mock.workflow.steps[1].flow,'2.607');assert(e.h.runtimeProfileTruthPayload().verified);assert.equal(JSON.stringify(e.s.calibrationMap),lut);});

test('large steady MISS remains valid learning evidence and is never excluded just for error',()=>{const e=setup(),r=controlledRun(e);assert(e.h.assessRunLearningIntegrity(r).eligible);assert(e.h.trustedAdaptiveRun(r));assert(e.h.nextShotAdaptiveSuggestion(r).s2.measuredGS<5);});
test('completed-looking run with recorded abort fault or excess skips is excluded',()=>{for(const fault of ['abort','skips']){const e=setup(),r=controlledRun(e);r.events=fault==='abort'?[{name:'learning_fault',phase:'stage2',data:{reason:'driver failure'}}]:Array.from({length:3},()=>({name:'command_accepted',data:{machineState:'skipStep'}}));assert.equal(e.h.trustedAdaptiveRun(r),false);assert.equal(e.h.nextShotAdaptiveSuggestion(r),null);e.h.rememberAdaptiveEvidence(r);const row=e.s.persistentHistoryFile.shots.find(x=>x.runId===r.runId);assert(row);assert.equal(row.learningIntegrity.eligible,false);assert.equal(row.evidence,null);}});
test('intentional dump/restart tare and normal GHC re-arm do not invalidate a completed coffee',()=>{const e=setup(),r=controlledRun(e);r.events=[{name:'manual_rearm',phase:'restart_wait',data:{}},...Array.from({length:2},()=>({name:'command_accepted',data:{machineState:'skipStep'}}))];r.rawScaleSamples.push({phase:'dumping',tMs:7000,weightG:-20,scaleTimestampSeconds:55,tareReset:true},{phase:'restart_wait',tMs:7100,weightG:0,scaleTimestampSeconds:55.1,tareReset:true});assert(e.h.assessRunLearningIntegrity(r).eligible);});
test('initial extraction tare is allowed but a later large cup-weight drop is excluded',()=>{const e=setup(),r=controlledRun(e);const rows=r.rawScaleSamples.filter(x=>x.phase==='stage2');rows[1].weightG=0;rows[1].tareReset=true;assert(e.h.assessRunLearningIntegrity(r).eligible);rows[80].weightG=rows[79].weightG-10;rows[80].tareReset=true;const q=e.h.assessRunLearningIntegrity(r);assert.equal(q.eligible,false);assert(q.reasons.some(x=>x.code==='scale-drop-during-extraction'));});
test('large in-extraction scale jump cannot masquerade as a completed target-weight cup',()=>{const e=setup(),r=controlledRun(e);const rows=r.rawScaleSamples.filter(x=>x.phase==='stage2');rows[80].weightG+=25;const q=e.h.assessRunLearningIntegrity(r);assert.equal(q.eligible,false);assert(q.reasons.some(x=>x.code==='scale-jump-during-extraction'));});
test('explicit failure, unverified profile and missing result block persisted learning',()=>{const e=setup();for(const row of [{result:'manual stop'},{result:null},{profileTruthVerified:false},{profileTruthSchema:2}])assert.equal(e.h.historyLearningStatus(row).eligible,false);assert.equal(e.h.historyLearningStatus({runId:'legacy',profileTruthSchema:3}).eligible,true);});
function storedReviewFixture(){const e=setup(),r=controlledRun(e,'stored');e.s.diagnosticLast=r;e.h.rememberAdaptiveEvidence(r);e.s.persistentHistoryLoaded=true;e.s.storageProbeVerified=true;e.s.persistentHistoryAvailable=true;e.s.pendingHistoryWrite=null;e.s.historyWriteDirty=false;return {e,r,row:e.s.persistentHistoryFile.shots.find(x=>x.runId==='stored')};}
test('manual exclusion preserves original history/evidence/LUT and removes the cup from consensus',()=>{const {e,r,row}=storedReviewFixture(),original=JSON.stringify(row.evidence),lut=JSON.stringify(e.s.calibrationMap),profile=JSON.stringify(e.h.profileObject());e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'operator-mistake'});assert.equal(row.learningReview.excluded,true);assert.equal(JSON.stringify(row.evidence),original);assert.equal(JSON.stringify(e.s.calibrationMap),lut);assert.equal(JSON.stringify(e.h.profileObject()),profile);assert(!e.s.adaptiveHistory.some(x=>x.runId===r.runId));assert.equal(e.h.nextShotAdaptiveSuggestion(r),null);assert(e.s.persistentHistoryFile.shots.includes(row));assert(e.s.pendingHistoryWrite);});
test('manual restore can re-admit retained valid evidence but never overrides automatic fault exclusion',()=>{const {e,r,row}=storedReviewFixture();e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'other'});e.h.setLearningHistoryReview({runId:r.runId,excluded:false});assert(e.s.adaptiveHistory.some(x=>x.runId===r.runId));assert(e.h.historyLearningStatus(row).eligible);row.learningIntegrity={schema:1,eligible:false,reasons:[{code:'execution-fault'}]};e.h.setLearningHistoryReview({runId:r.runId,excluded:false});assert.equal(e.h.historyLearningStatus(row).eligible,false);assert(!e.s.adaptiveHistory.some(x=>x.runId===r.runId));});
test('excluded historical evidence cannot re-enter through session merge or persisted restore',()=>{const {e,r,row}=storedReviewFixture(),original=copy(row.evidence);row.learningReview={excluded:true,reason:'plugin-fault'};e.s.adaptiveHistory.push(original);e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.adaptiveHistory.some(x=>x.runId===r.runId),false);e.s.adaptiveHistory.push(original);const q=e.h.matchingAdaptiveEvidenceSearch(e.h.stage2AdaptiveEvidence(controlledRun(e,'current')),'s2');assert.equal(q.evidence,null);assert(q.skippedExcluded>0);});
test('history exclusion preserves established coffee mode across reload but cannot preserve it across a changed LUT',()=>{const {e,r,row}=storedReviewFixture();e.s.cfg.basketContext='coffee';e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'other'});assert.equal(e.s.cfg.basketContext,'coffee');e.s.cfg.basketContext='empty';e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'coffee');e.s.calibrationMap.points[0].commandFlow+=.01;e.s.pendingHistoryWrite=null;e.s.runtimeProfileVerified=true;e.s.machineProfileAckKey='verified';e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'empty');});
test('manual exclusion cancels a pending proposal for that cup and does not undo already applied profile',()=>{const {e,r}=storedReviewFixture(),profile=JSON.stringify(e.h.profileObject());e.s.autoApplyLastStatus={runId:r.runId,status:'scheduled'};e.s.autoApplyTimer=999;e.timers.set(999,{fn(){},ms:250});e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'other'});assert.equal(e.s.autoApplyTimer,null);assert.equal(e.s.autoApplyLastStatus.status,'excluded');assert.equal(JSON.stringify(e.h.profileObject()),profile);});
test('history review rejects active shot, unverified storage, missing ID and unknown reasons',()=>{for(const modify of [e=>e.s.phase='stage2',e=>e.s.storageProbeVerified=false,e=>e.s.persistentHistoryAvailable=false]){const {e,r}=storedReviewFixture();modify(e);assert.throws(()=>e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'other'}));}const {e}=storedReviewFixture();assert.throws(()=>e.h.setLearningHistoryReview({runId:'missing',excluded:true,reason:'other'}));assert.throws(()=>e.h.setLearningHistoryReview({runId:'stored',excluded:true,reason:'invented'}));});
test('persisted excluded cup reload remains excluded with original evidence retained',()=>{const {e,r}=storedReviewFixture();e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'scale-or-cup-disturbance'});const saved=copy(e.s.persistentHistoryFile),reload=setup();reload.s.persistentHistoryFile=saved;reload.s.persistentHistoryAvailable=true;reload.h.restoreAdaptiveHistoryFromPersistentFile();assert(!reload.s.adaptiveHistory.some(x=>x.runId===r.runId));assert(saved.shots[0].evidence);assert.equal(reload.h.learningHistoryPayload().records[0].integrity.status,'manual-excluded');});
test('history review HTTP endpoint changes only learning annotations, never uploads a machine profile',async()=>{const {e,r}=storedReviewFixture(),writes=e.writes().length;const response=await e.plugin.__httpRequestHandler({endpoint:'history-review',body:{runId:r.runId,excluded:true,reason:'operator-mistake'}}),body=JSON.parse(response.body);assert.equal(response.status,200,body.error);assert.equal(e.writes().length,writes);assert.equal(body.learningHistory.records[0].integrity.status,'manual-excluded');assert(body.learningHistory.savePending);});
test('bad historical cups do not count as valid empty-basket references',()=>{const {e,row}=storedReviewFixture();row.basketContext='empty';row.learningIntegrity={schema:1,eligible:false,reasons:[{code:'execution-fault'}]};assert.equal(e.h.baselineFeedForwardPayload().sourceRunIds.includes(row.runId),false);});

test('fault evidence survives rolling diagnostic event truncation',()=>{const e=setup(),r=controlledRun(e);e.s.diagnosticCurrent=r;e.s.phase='stage2';e.h.state.diagnosticCurrent.events=[];e.s.diagnosticCurrent.learningExecutionFaults=[{phase:'stage2',reason:'stored execution fault'}];assert.equal(e.h.assessRunLearningIntegrity(r).eligible,false);r.learningExecutionFaults=[];r.learningSkipCount=3;assert(e.h.assessRunLearningIntegrity(r).reasons.some(x=>x.code==='extra-skip-commands'));});
test('excluded run cannot still advertise admitted learning in built-in control review',()=>{const {e,r}=storedReviewFixture();e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'plugin-fault'});const review=e.h.controlRunReview(r);assert(review.phases.every(x=>x.learningStatus==='Shot excluded from learning'));});

test('delayed initial tare before meaningful cup gain remains valid',()=>{const e=setup(),r=controlledRun(e);r.rawScaleSamples=Array.from({length:70},(_,i)=>({phase:'stage2',profileFrame:1,tMs:i*100,scaleTimestampSeconds:i*.1,weightG:i<30?100:(i-30)*.4,tareReset:i===30}));assert(e.h.assessRunLearningIntegrity(r).eligible);r.rawScaleSamples[60].weightG=r.rawScaleSamples[59].weightG-8;assert.equal(e.h.assessRunLearningIntegrity(r).eligible,false);});
test('history table retains selected run and review error across passive refresh',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml(),script=html.slice(html.indexOf('let learningHistoryData='),html.indexOf('function paint(x)'));const elements={};for(const id of ['learninghistorytable','historyrun','historysavestatus','historyexclude','historyrestore','historyreason'])elements[id]={innerHTML:'',value:id==='historyrun'?'chosen':'other',textContent:'',disabled:false};const ctx=vm.createContext({Number,String,JSON,esc:x=>String(x),$:id=>elements[id]||null,post:async()=>{throw Error('read failed')},loadDiag:async()=>{}});vm.runInContext(script+'\nglobalThis.historyUI={renderLearningHistory,reviewHistory};',ctx);const data={editable:true,savePending:false,records:[{runId:'chosen',version:'0.1.62',integrity:{status:'legacy-limited-audit',reasons:[]},stageEvidence:{s2:true}}]};ctx.historyUI.renderLearningHistory(data);assert.equal(elements.historyrun.value,'chosen');assert.match(elements.learninghistorytable.innerHTML,/0.1.62/);return ctx.historyUI.reviewHistory(true).then(()=>{ctx.historyUI.renderLearningHistory(data);assert.match(elements.historysavestatus.textContent,/History review failed/);assert.equal(elements.historyexclude.disabled,false);});});

function startupRun(e,id='rise',delay=1,rise=2,plateau=5){
 const r=evidenceRun(e,id);r.startedAtMs=e.now();r.config={...r.config,stage1CommandMlS:.719,stage2Flow:5,stage2CommandMlS:2.507,stage2PressureLimit:6};
 for(let i=0;i<=120;i++){const t=i*.1,u=Math.max(0,t-delay),w=u<rise?plateau*u*u/(2*rise):plateau*(u-rise/2);r.rawScaleSamples.push({phase:'stage2',profileFrame:1,tMs:t*1000,scaleTimestampSeconds:100+t,weightG:w});r.samples.push({phase:'stage2',profileFrame:1,tMs:t*1000,machineTelemetryValid:true,machineAgeMs:0,pressureBar:1,machineFlowMlS:2.5,targetFlowMlS:2.5});}
 return r;
}
function startupHistory(e,metrics){e.s.persistentHistoryLoaded=true;e.s.persistentHistoryAvailable=true;e.s.storageProbeVerified=true;e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2StartupAssist=true;e.s.persistentHistoryFile={shots:metrics.map((m,i)=>({...historyRow(e,'rise-'+i),result:'completed at 100 g',s2Startup:copy(m)}))};}
async function pulseFixture(){const e=setup();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.liveFlowTrimLevel=3;e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.s.phase='stage2';e.s.lastFrame=1;await e.h.startLiveTrim();e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5});trimSamples(e,0);const t=e.s.liveTrim;t.startup={status:'armed',plan:{enabled:true,holdMs:500,baseCommandMlS:2.5,referenceRiseS:2}};t.run.config.s2StartupPlan=t.startup.plan;return e;}
function pulseTarget(e,target){e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:target});}
test('S2 startup source regression separates delay from ramp, ignoring instantaneous derivatives',()=>{const e=setup(),a=startupRun(e,'a',1,2),b=startupRun(e,'b',3,2);a.rawScaleSamples.forEach(x=>x.rawDwDtGS=999);const x=e.h.stage2StartupMetrics(a),y=e.h.stage2StartupMetrics(b);assert(x.eligible);assert(y.eligible);assert(Math.abs(x.rise20to80S-y.rise20to80S)<.11);assert(Math.abs(y.firstResponseDelayS-x.firstResponseDelayS-2)<.11);assert(Math.abs(x.tailMeanGS-5)<.001);});
test('S2 low plateau can supply slow-rise evidence without first reaching a target HIT',()=>{const e=setup(),m=e.h.stage2StartupMetrics(startupRun(e,'low',1,4,3.8));assert(m.eligible);assert(m.plateauRise20to80S>1.2);assert.equal(m.riseBasis,'observed plateau');startupHistory(e,[m,m]);assert(e.h.stage2LegacyStartupPlan().enabled);});
test('two comparable slow but accurate low ripple S2 curves arm one bounded quantum',()=>{const e=setup(),m=e.h.stage2StartupMetrics(startupRun(e,'a',1,3));assert(m.eligible);startupHistory(e,[m,m]);const p=e.h.stage2LegacyStartupPlan();assert(p.enabled);assert.equal(p.boostQuanta,1);assert(p.holdMs>=400&&p.holdMs<=800);assert.equal(p.sourceRunIds.length,2);assert.equal(e.writes().length,0);});
test('S2 startup plan needs verified disk and obeys both switches',()=>{const e=setup(),m=e.h.stage2StartupMetrics(startupRun(e,'a',1,3));startupHistory(e,[m,m]);e.s.cfg.s2StartupAssist=false;assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);e.s.cfg.s2StartupAssist=true;e.s.cfg.liveFlowTrimTest=false;assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);e.s.cfg.liveFlowTrimTest=true;e.s.storageProbeVerified=false;assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);});
test('S2 startup latest bad response cannot be skipped for older agreeing curves',()=>{const e=setup(),m=e.h.stage2StartupMetrics(startupRun(e,'a',1,3));startupHistory(e,[m,m,{...m,eligible:false}]);assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);});
test('S2 startup preserves temperature compatibility but rejects changed LUT/command and excluded cups',()=>{const e=setup(),m=e.h.stage2StartupMetrics(startupRun(e,'a',1,3));startupHistory(e,[m,m]);e.s.persistentHistoryFile.shots[0].fingerprint.shotSettings.temperature=94;assert(e.h.stage2LegacyStartupPlan().enabled);e.s.persistentHistoryFile.shots[0].learningReview={excluded:true};assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);delete e.s.persistentHistoryFile.shots[0].learningReview;e.s.persistentHistoryFile.shots[0].s2Startup.baseCommandMlS=2.607;assert(e.h.stage2LegacyStartupPlan().enabled);e.s.persistentHistoryFile.shots[0].s2Startup.baseCommandMlS=8;assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);});
test('fast delayed S2 step does not request boost solely because delay is long',()=>{const e=setup(),m=e.h.stage2StartupMetrics(startupRun(e,'a',3,.2));assert(m.eligible);startupHistory(e,[m,m]);assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);});
test('S2 startup metrics reject pressure headroom, actuator lag, RAW gaps and sustained tare',()=>{for(const kind of ['pressure','actuator','gap','tare']){const e=setup(),r=startupRun(e);if(kind==='pressure')r.samples.forEach(x=>x.pressureBar=5.9);if(kind==='actuator')r.samples.forEach(x=>x.machineFlowMlS=1);if(kind==='gap')r.rawScaleSamples=r.rawScaleSamples.filter(x=>x.tMs<2000||x.tMs>4000);if(kind==='tare')r.rawScaleSamples[70].tareReset=true;assert.equal(e.h.stage2StartupMetrics(r).eligible,false,kind);}});
test('beneficial S2 pulse is retained bounded; ineffective pulse returns to baseline',()=>{const e=setup(),m=e.h.stage2StartupMetrics(startupRun(e,'a',1,3));startupHistory(e,[m,{...m,pulseUsed:true,referenceRiseS:2,referenceRiseBasis:"target",targetRise20to80S:1.5,rise20to80S:1.5}]);assert(e.h.stage2LegacyStartupPlan().enabled);e.s.persistentHistoryFile.shots[1].s2Startup.rise20to80S=1.95;e.s.persistentHistoryFile.shots[1].s2Startup.targetRise20to80S=1.95;assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);});
test('S2 pulse uses fast same frame one quantum and no skip, profile or LUT changes',async()=>{const e=await pulseFixture(),lut=JSON.stringify(e.s.calibrationMap);await trimTick(e);assert.equal(rawWrites(e).length,1);const w=e.s.liveTrim.report.trace.find(x=>x.kind==='write');assert.equal(w.startupAction,'boost');assert.equal(w.commandMlS,2.5625);assert.equal(e.s.liveTrim.report.maxWrites,200);assert.equal(e.s.liveTrim.startup.status,'boosting');assert.equal(JSON.stringify(e.s.calibrationMap),lut);assert.equal(e.writes().length,0);assert.equal(e.h.profileObject().steps.length,3);});
test('S2 pulse returns on independent deadline with ACK but no target echo or usable regression',async()=>{const e=await pulseFixture();await trimTick(e);trimAck(e);e.s.liveTrim.run.rawScaleSamples=[];e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);assert.equal(rawWrites(e).length,2);const w=e.s.liveTrim.report.trace.filter(x=>x.kind==='write')[1];assert.equal(w.commandMlS,2.5);assert.equal(w.startupAction,'return');assert.equal(e.s.liveTrim.pending.targetSeen,false);});
test('S2 base return confirmation resumes regular trim only after response settle',async()=>{const e=await pulseFixture();await trimTick(e);trimAck(e);pulseTarget(e,2.5625);e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);trimAck(e);pulseTarget(e,2.5);e.advance(60);await trimTick(e);assert.equal(e.s.liveTrim.startup.status,'complete');assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.startupWatchdog,null);e.advance(1700);trimSamples(e,4);await trimTick(e);assert.equal(rawWrites(e).length,3);});
test('S2 return driver ACK completes the refill immediately without waiting for base echo',async()=>{const e=await pulseFixture();await trimTick(e);trimAck(e);e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);trimAck(e);assert.equal(e.s.liveTrim.startup.status,'complete');assert.equal(e.s.liveTrim.report.startupExecution.confirmation,'driver-ack');assert.equal(e.s.phase,'stage2');});
test('S2 return ACK clears the watchdog so no degraded retry follows',async()=>{const e=await pulseFixture();await trimTick(e);trimAck(e);e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);trimAck(e);assert.equal(e.s.liveTrim.startupWatchdog,null);assert.equal(e.s.liveTrim.startup.status,'complete');pulseTarget(e,2.5);e.advance(60);await trimTick(e);assert.equal(e.s.liveTrim.startup.status,'complete');});
test('S2 missing driver ACK keeps existing safety stop rather than leaving boost active',async()=>{const e=await pulseFixture();await trimTick(e);e.advance(2500);e.run(e.s.liveTrim.startupWatchdog);assert.equal(e.s.phase,'aborted');assert(e.calls.some(x=>x.path==='/machine/state/idle'));});
test('S2 transition cancels pulse timers and cannot return into the old frame',async()=>{const e=await pulseFixture();await trimTick(e);trimAck(e);const timer=e.s.liveTrim.startupReturnTimer;e.s.phase='stage3';e.s.lastFrame=2;e.h.observeLiveTrimMachine({profileFrame:2});assert(!e.timers.has(timer));assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'return'),false);assert.equal(rawWrites(e).length,1);});
test('S2 startup never launches with pressure cap, stale telemetry, unresolved write or late frame',async()=>{for(const kind of ['pressure','stale','pending','late','target','budget','truth']){const e=await pulseFixture();if(kind==='pressure')e.s.lastPressure=5.5;if(kind==='stale')e.advance(1300);if(kind==='pending')e.s.liveTrim.pending={};if(kind==='late')e.s.liveTrim.frameAt=e.now()-2200;if(kind==='target')e.s.liveTrim.observedTarget=2.0;if(kind==='budget')e.s.liveTrim.report.maxWrites=1;if(kind==='truth')e.s.runtimeProfileVerified=false;assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false,kind);assert.equal(rawWrites(e).length,0);}});
test('S2 pulse scale shape survives compact history serialization; old records remain usable for level only',()=>{const e=setup(),r=startupRun(e);const row=e.h.compactPersistentShotRecord(r,null);assert.equal(row.s2Startup.schema,2);assert(row.s2Startup.eligible);startupHistory(e,[row.s2Startup,row.s2Startup]);delete e.s.persistentHistoryFile.shots[0].s2Startup;assert.equal(e.h.stage2LegacyStartupPlan().enabled,false);assert(e.h.historyLearningStatus(e.s.persistentHistoryFile.shots[0]).eligible);});
test('S2 startup native settings default ON and live OFF preserves fixed profile behavior',()=>{const e=setup();assert.equal(e.h.loadConfig({}).s2StartupAssist,true);assert.equal(e.h.loadConfig({S2StartupAssist:false}).s2StartupAssist,false);e.h.startSequence(0);assert.equal(e.s.liveTrim,null);assert.deepEqual(copy(e.h.profileObject().steps.map(x=>x.transition)),['fast','fast','fast']);});
test('S2 startup diagnostics distinguish delay rise tail plan and actual issued boost',()=>{const e=setup(),r=startupRun(e),q=e.h.diagnosticSummary(r);assert(q.stage2Startup);assert(q.stage2StartupNext);const html=e.h.buildGhcOverlayHtml();assert.match(html,/S2 startup response/);assert.match(html,/Executed startup boost/);});

test('S2 startup tolerates initial reset marker but rejects later reset',()=>{const e=setup(),r=startupRun(e);r.rawScaleSamples[0].tareReset=true;assert(e.h.stage2StartupMetrics(r).eligible);r.rawScaleSamples[50].tareReset=true;assert.equal(e.h.stage2StartupMetrics(r).eligible,false);});
test('S2 pulse returns early when pressure headroom disappears',async()=>{const e=await pulseFixture();await trimTick(e);trimAck(e);e.advance(250);e.s.lastPressure=5.9;e.s.lastMachineAtMs=e.now();await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.pending.command,2.5);assert.equal(e.s.phase,'stage2');});
test('S2 return ACK completes with exactly two writes and leaves the shot armed',async()=>{const e=await pulseFixture();await trimTick(e);trimAck(e);e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);trimAck(e);assert.equal(e.s.liveTrim.report.writes,2);assert.equal(e.s.liveTrim.startup.status,'complete');assert.equal(e.s.phase,'stage2');});
function continuousSetup(live=false){const e=setup();e.s.cfg.activeRelease=false;e.s.cfg.liveFlowTrimTest=live;e.s.cfg.liveFlowTrimLevel=3;e.s.runtimeProfileVerified=true;e.mock.workflow=copy(e.h.profileObject());e.s.workflowProfile=copy(e.mock.workflow);return e;}
async function continuousPour(live=false){const e=continuousSetup(live);e.h.startSequence(0);for(let i=0;i<12;i++)await Promise.resolve();e.s.lastFrame=0;return e;}
async function settlePromises(){for(let i=0;i<25;i++)await Promise.resolve();}
function correctedS1(e,id='corrected-s1'){const r=syntheticRun(e,id);r.config.activeRelease=false;r.config.experimentalLiveTrim=true;r.config.stage1PressureLimit=3;r.config.stage1CommandMlS=.719;r.config.adaptiveFingerprint=copy(e.h.adaptiveHistoryFingerprint());r.rawScaleSamples.filter(x=>x.phase==='stage1').forEach(x=>x.profileFrame=0);r.samples.filter(x=>x.phase==='stage1').forEach(x=>Object.assign(x,{profileFrame:0,machineTelemetryValid:true,machineAgeMs:0,pressureBar:1,machineFlowMlS:x.tMs>=4000?.8125:.75,targetFlowMlS:x.tMs>=4000?.8125:.75}));r.liveFlowTrim={trace:[{kind:'write',frame:0,tMs:4000,commandMlS:.8125}]};return r;}
test('active release defaults ON in cfg manifest and visible settings order',()=>{const e=setup();assert.equal(e.h.loadConfig({}).activeRelease,true);assert.equal(e.h.loadConfig({ActiveRelease:false}).activeRelease,false);const m=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json')));assert.equal(m.settings.ActiveRelease.default,true);assert.equal(Object.keys(m.settings)[1],'ActiveRelease');const html=e.h.buildGhcOverlayHtml();assert.match(html,/id="adv_activeRelease" type="checkbox" checked/);assert.match(html,/id="brewingmode"/);assert.match(html,/Active release: ON/);});
test('continuous mode skips S1 directly to S2 exactly once with no intermediate Idle Espresso soak or GHC',async()=>{const e=await continuousPour(false);e.h.onScaleSnapshot({weight:4.2,timestamp:1});e.h.onScaleSnapshot({weight:4.3,timestamp:1.1});await settlePromises();assert.equal(e.s.phase,'stage2');assert.equal(e.calls.filter(x=>x.path==='/machine/state/skipStep').length,1);assert(!e.calls.some(x=>x.path==='/machine/state/idle'||x.path==='/machine/state/espresso'));assert.equal(e.s.soakTimer,null);assert.equal(e.s.restartTimeoutTimer,null);assert.equal(e.s.rawBaseline,0);assert.equal(e.s.cumulativeWeight,4.3);});
test('continuous full sequence has two skips, one final Idle and preserves cumulative weight',async()=>{const e=await continuousPour(false);e.h.onScaleSnapshot({weight:4.1,timestamp:1});await settlePromises();e.h.onScaleSnapshot({weight:40.2,timestamp:2});await settlePromises();assert.equal(e.s.phase,'stage3');e.h.onScaleSnapshot({weight:100.1,timestamp:3});await settlePromises();assert.equal(e.s.phase,'finishing');assert.equal(e.calls.filter(x=>x.path==='/machine/state/skipStep').length,2);assert.equal(e.calls.filter(x=>x.path==='/machine/state/idle').length,1);assert(!e.calls.some(x=>x.path==='/machine/state/espresso'));assert(e.s.cumulativeWeight>=100);});
test('original active-release mode still requests Idle at S1 threshold',async()=>{const e=setup();e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.h.onScaleSnapshot({weight:4.1,timestamp:1});await settlePromises();assert.equal(e.s.phase,'dumping');assert(e.calls.some(x=>x.path==='/machine/state/idle'));assert(!e.calls.some(x=>x.path==='/machine/state/skipStep'));});
test('continuous final weight can stop even while S1 transition is awaiting a read',async()=>{const e=await continuousPour(false);let release;e.mock.after=p=>p==='/machine/state'?new Promise(r=>release=r):undefined;e.h.onScaleSnapshot({weight:4,timestamp:1});await settlePromises();e.h.onScaleSnapshot({weight:101,timestamp:2});assert.equal(e.s.phase,'finishing');release();await settlePromises();assert.equal(e.s.phase,'finishing');assert.equal(e.calls.filter(x=>x.path==='/machine/state/idle').length,1);assert.equal(e.calls.filter(x=>x.path==='/machine/state/skipStep').length,0);});
test('continuous transition failure uses safety Idle and cannot fall into release/soak',async()=>{const e=await continuousPour(false);e.mock.fail=p=>p==='/machine/state/skipStep'?'rejected':null;e.h.onScaleSnapshot({weight:4,timestamp:1});await settlePromises();assert.equal(e.s.phase,'aborted');assert.equal(e.s.soakTimer,null);assert(e.calls.some(x=>x.path==='/machine/state/idle'));});
test('continuous live trim can write S1 native frame0 inside the original budget',async()=>{const e=await continuousPour(true);assert(e.s.liveTrim.started);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:0,targetFlow:.75});e.advance(2200);trimSamples(e,1);await trimTick(e);assert.equal(rawWrites(e).length,1);const w=e.s.liveTrim.report.trace.find(x=>x.kind==='write');assert.equal(w.frame,0);assert.equal(w.commandMlS,.875);assert.equal(e.s.liveTrim.report.maxChecks,2000);assert.equal(e.s.liveTrim.report.maxWrites,200);assert.equal(e.s.liveTrim.report.writes,1);});
test('continuous live OFF still preserves complete fixed-profile execution and S1 learning path',async()=>{const e=await continuousPour(false);assert.equal(e.s.liveTrim,null);const r=syntheticRun(e);r.config.activeRelease=false;assert(e.h.stage1AdaptiveEvidence(r));assert(e.h.stage2AdaptiveEvidence(r));assert(e.h.stage3AdaptiveEvidence(r));assert.equal(e.h.profileObject().steps.length,3);});
test('corrected continuous S1 learns normalized observed-target exposure without relabelling RAW',()=>{const e=continuousSetup(),r=correctedS1(e),raw=JSON.stringify(r.rawScaleSamples);const a=e.h.stage1LiveLearning(r),ev=e.h.stage1AdaptiveEvidence(r);assert(a.applicable);assert(a.eligible,a.reason);assert(ev);assert.match(ev.measurementBasis,/observed-target/);assert(ev.measured<2);assert.equal(JSON.stringify(r.rawScaleSamples),raw);});
test('corrected S1 refuses missing target pressure-limited and insufficient startup trajectories',()=>{for(const kind of ['target','pressure','startup']){const e=continuousSetup(),r=correctedS1(e);if(kind==='target')r.samples.filter(x=>x.phase==='stage1').forEach(x=>delete x.targetFlowMlS);if(kind==='pressure')r.samples.filter(x=>x.phase==='stage1').forEach(x=>x.pressureBar=3);if(kind==='startup')r.rawScaleSamples=r.rawScaleSamples.filter(x=>x.phase!=='stage1'||x.tMs<4000);assert.equal(e.h.stage1AdaptiveEvidence(r),null,kind);assert.equal(e.h.stageActuatorEvidence(r,'stage1').eligible,false,kind);}});
test('two continuous S1 corrected cups can produce bounded next-shot learning',()=>{const e=continuousSetup(),a=correctedS1(e,'a'),b=correctedS1(e,'b');for(const r of [a,b])r.rawScaleSamples.filter(x=>x.phase==='stage1').forEach(x=>x.weightG*=.8);e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b);assert(q);assert.equal(q.s1.action,'ADJUST');assert(q.s1.suggestedCommandMlS>.719);assert(q.s1.suggestedCommandMlS<=.719*1.04+.001);});
test('modes isolate numeric history while missing legacy mode maps to active-release ON',()=>{const e=setup(),legacy=historyRow(e);delete legacy.fingerprint.shotSettings.activeRelease;e.s.persistentHistoryAvailable=true;e.s.persistentHistoryFile={shots:[legacy]};e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.adaptiveHistory.length,1);const oldKey=e.h.numericLearningFingerprintKey(legacy.fingerprint);e.s.cfg.activeRelease=false;assert.notEqual(e.h.numericLearningFingerprintKey(e.h.adaptiveHistoryFingerprint()),oldKey);e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.adaptiveHistory.length,0);e.s.cfg.activeRelease=true;e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.adaptiveHistory.length,1);});
test('mode-specific override storage neither overwrites nor reads the other mode',()=>{const e=setup(),old=seedOverride(e,'empty');e.s.testOverrides=old;e.h.storageWrite('manualTestOverrides',old);const before=JSON.stringify(e.storage.manualTestOverrides);e.s.cfg.activeRelease=false;assert.equal(e.h.testOverrideStatus().valid,false);const fresh={...copy(old),activeRelease:false};e.s.testOverrides=fresh;assert.equal(e.h.testOverrideStatus().valid,true);e.h.storageWrite('manualTestOverrides',fresh);assert.equal(JSON.stringify(e.storage.manualTestOverrides),before);assert(e.storage.manualTestOverridesContinuousV3);e.h.storageRead('manualTestOverrides');assert.equal(e.pendingReads.at(-1).key,'manualTestOverridesContinuousV3');e.s.cfg.activeRelease=true;assert.equal(e.h.testOverrideStatus().valid,false);e.s.testOverrides=old;assert.equal(e.h.testOverrideStatus().valid,true);});
test('mode switch preserves valid physical LUT and coffee readiness without numeric cross-mode consensus',()=>{const e=setup();e.s.cfg.basketContext='coffee';const row=readinessRow(e,'coffee');row.basketContext='coffee';e.s.persistentHistoryAvailable=true;e.s.persistentHistoryFile={shots:[row]};const lut=JSON.stringify(e.s.calibrationMap);e.s.cfg.activeRelease=false;e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'coffee');assert.equal(JSON.stringify(e.s.calibrationMap),lut);e.h.restoreAdaptiveHistoryFromPersistentFile();assert.equal(e.s.adaptiveHistory.length,0);});
test('continuous next-shot automatic override is stamped with mode and verified normally',async()=>{const e=continuousSetup();const a=syntheticRun(e,'a',[2.1,1.8,1.5]),b=syntheticRun(e,'b',[2.1,1.8,1.5]);a.config.activeRelease=b.config.activeRelease=false;e.h.rememberAdaptiveEvidence(a);await e.h.applyNextShotAdaptiveSuggestion(b,'auto');assert.equal(e.s.testOverrides.activeRelease,false);assert.equal(e.h.testOverrideStatus().valid,true);assert(e.storage.manualTestOverridesContinuousV3);assert(!e.storage.manualTestOverrides);assert(e.s.runtimeProfileVerified);});
test('diagnostics mode banner and saved history identify actual per-shot mode',()=>{const e=continuousSetup(),r=syntheticRun(e);r.config.activeRelease=false;const row=e.h.compactPersistentShotRecord(r,null);e.s.persistentHistoryFile={shots:[row]};const payload=e.h.learningHistoryPayload();assert.equal(payload.records[0].activeRelease,false);assert.equal(e.h.uiStatusPayload().activeRelease,false);assert.match(e.h.buildGhcOverlayHtml(),/Active release: OFF · Continuous/);assert.equal(e.h.diagnosticSummary(r).activeRelease,false);assert(e.h.controlRunReview(r).phases.some(x=>x.phase==='stage1'));});
test('continuous S2 startup dispatch permits prior S1 writes only with matching learned trajectory',async()=>{const e=await pulseFixture();e.s.liveTrim.report.trace.push({kind:'write',frame:0,commandMlS:.8125});e.s.liveTrim.report.writes=1;assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false);e.s.liveTrim.startup.plan.s1ControlSignature=JSON.stringify([.8125]);assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),true);assert.equal(e.s.liveTrim.report.writes,2);});
test('continuous mode retains independent hard-pressure stop',async()=>{const e=await continuousPour(false);for(let i=0;i<3;i++)e.h.handleStateUpdate({state:{state:'espresso',substate:'pouring'},pressure:9,profileFrame:0});assert.equal(e.s.phase,'aborted');assert(e.calls.some(x=>x.path==='/machine/state/idle'));});

test('continuous transition flag blocks S1 raw writes during async skip',async()=>{const e=await continuousPour(true);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:0,targetFlow:.75});e.advance(2200);trimSamples(e,1);e.s.stage1DumpSent=true;await trimTick(e);assert.equal(rawWrites(e).length,0);});
test('settings save preflight blocks active-shot mode changes without POST',async()=>{const html=setup().h.buildGhcOverlayHtml(),line=html.split('\n').find(x=>x.startsWith('async function saveAdvancedSettings'));let posts=0,warning='';const ctx=vm.createContext({base:'/p',coreSettings:'/settings',ADV_FIELDS:[],ADV_SETTING_KEYS:{},alert:x=>warning=x,confirm:()=>true,fetch:async(url,opts)=>{if(opts)posts++;return {ok:true,json:async()=>({canEdit:false})}}});vm.runInContext(line,ctx);await ctx.saveAdvancedSettings();assert.equal(posts,0);assert.match(warning,/idle/);});
test('continuous advanced settings persist one shared native ActiveRelease boolean',async()=>{const e=continuousSetup(),data=await e.plugin.__httpRequestHandler({endpoint:'advanced-settings'});const body=JSON.parse(data.body);assert.equal(body.settings.activeRelease,false);assert.equal(body.canEdit,true);e.s.phase='stage1';const busy=JSON.parse((await e.plugin.__httpRequestHandler({endpoint:'advanced-settings'})).body);assert.equal(busy.canEdit,false);});
test('both mode overrides survive independent save clear and asynchronous storage reads',()=>{const e=setup(),on=seedOverride(e,'empty');e.h.storageWrite('manualTestOverrides',on);e.s.cfg.activeRelease=false;const off={...copy(on),activeRelease:false};e.h.storageWrite('manualTestOverrides',off);e.s.calibrationStorageLoaded=false;e.event('manualTestOverrides',on);assert.notEqual(e.s.testOverrides,on);e.event('manualTestOverridesContinuousV3',off);assert.equal(e.h.testOverrideStatus().valid,true);e.h.storageWrite('manualTestOverrides','');assert(e.storage.manualTestOverrides);e.s.cfg.activeRelease=true;e.event('manualTestOverrides',on);assert.equal(e.h.testOverrideStatus().valid,true);});
test('continuous S1 normalization does not invent error from native starting quantization',()=>{const e=continuousSetup(),r=correctedS1(e);r.samples.filter(x=>x.phase==='stage1').forEach(x=>{x.targetFlowMlS=.75;x.machineFlowMlS=.75});r.liveFlowTrim.trace[0].commandMlS=.75;const ev=e.h.stage1AdaptiveEvidence(r);assert(ev);assert(Math.abs(ev.measured-2)<.01);});
function normalEnv(level='正常'){const e=setup();e.s.cfg.adaptiveLearningLevel=level;return e;}
function fixedOutcome(e,id='outcome',flow=3.5){const r=coffeeRun(e,id,[1.5,1.5,1.5]);r.config.adaptiveLearningLevel=e.s.cfg.adaptiveLearningLevel;for(const x of r.rawScaleSamples.filter(x=>x.phase==='stage2'))x.weightG=(x.tMs/1000-10)*flow;return r;}
function prepareDisk(e){e.s.persistentHistoryLoaded=true;e.s.storageProbeVerified=true;e.s.persistentHistoryAvailable=true;e.s.persistentHistoryFile={schema:2,shots:[]};e.h.keepCoffeeQualification();}
async function reloadDisk(prior){const e=normalEnv();Object.assign(e.storage,copy(prior.storage));e.mock.workflow=copy(prior.mock.workflow);e.mock.profiles=copy(prior.mock.profiles);e.s.calibrationStorageLoaded=false;e.s.overrideStorageLoaded=false;e.s.persistentHistoryLoaded=false;e.s.persistentHistoryAvailable=null;e.s.storageProbeVerified=false;e.s.learningContextLoaded=false;e.event('flowCalibration',JSON.stringify(prior.s.calibrationMap));e.event('manualTestOverrides',e.storage.manualTestOverrides||null);e.event('adaptiveHistoryFileV2',e.storage.adaptiveHistoryFileV2);e.h.startPersistentHistoryProbe();e.flushReads();await e.s.profileSyncQueue;return e;}
test('learning policies default Normal and accept all four persisted native choices',()=>{const e=setup();assert.equal(e.h.loadConfig({}).adaptiveLearningLevel,'正常');for(const v of ['保守','温和','正常','激进'])assert.equal(e.h.loadConfig({AdaptiveLearningLevel:v}).adaptiveLearningLevel,v);assert.equal(e.h.loadConfig({AdaptiveLearningLevel:'Aggressive'}).adaptiveLearningLevel,'激进');const m=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json')));assert.equal(m.settings.AdaptiveLearningLevel.default,'正常');assert.deepEqual(m.settings.AdaptiveLearningLevel.values,['保守','温和','正常','激进']);});
test('one clean Normal S2 miss immediately produces bounded verified NEXT SHOT adaptation',async()=>{const e=normalEnv(),r=fixedOutcome(e);e.s.runtimeProfileVerified=true;e.mock.workflow=copy(e.h.profileObject());const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s2.action,'ADJUST');assert.equal(q.s2.repeatCount,1);assert(q.s2.suggestedCommandMlS>2.507);assert(q.s2.suggestedCommandMlS<=2.507*1.12+.001);await e.h.autoApplyNextShotIfEligible(r);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(e.h.commandFlowSummary().stage2Origin,'adaptive');assert(e.s.runtimeProfileVerified);});
test('three cups remain on disk across reloads and dynamically improve a fixed synthetic process',async()=>{let e=normalEnv();e.s.cfg.basketContext='coffee';prepareDisk(e);e.h.persistHistoryFile();e.flushReads();await e.h.syncHyperExProfile(true);const flows=[],commands=[];for(let cup=0;cup<3;cup++){
 e.advance(1000);e.s.cfg.adaptiveLearningLevel='正常';const c=e.h.commandFlowSummary(),plant=Math.round(c.stage2CommandMlS*16)/16*1.4;flows.push(plant);commands.push(c.stage2CommandMlS);e.h.startDiagnostics('hyperex');const active=e.s.diagnosticCurrent,r=fixedOutcome(e,'fixture',plant);active.rawScaleSamples=copy(r.rawScaleSamples);active.samples=copy(r.samples);Object.assign(active.config,{stage3Shape:copy(c.s3Shape),stage3CommandMlS:c.stage3CommandMlS});active.rawScaleSamples.filter(x=>x.phase==='stage3').forEach(x=>x.profileFrame=2);active.samples.forEach(x=>{x.targetFlowMlS=x.phase==='stage1'?c.stage1CommandMlS:x.phase==='stage2'?c.stage2CommandMlS:c.stage3CommandMlS;x.machineFlowMlS=x.targetFlowMlS;x.machineAgeMs=0;x.machineTelemetryValid=true});e.h.finalizeDiagnostics('completed at 100 g');const done=e.s.diagnosticLast,id=done.runId;e.flushReads();assert.equal(e.h.historyPersistenceAudit(id).currentRunReadbackVerified,true);assert.equal(JSON.parse(e.storage.adaptiveHistoryFileV2).shots.length,cup+1);const q=e.h.nextShotAdaptiveSuggestion(done);assert.equal(q.s2.action,'ADJUST');assert(q.s2.suggestedCommandMlS>c.stage2CommandMlS);await e.h.autoApplyNextShotIfEligible(done);e.flushReads();assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(e.h.commandFlowSummary().stage2Origin,'adaptive');if(cup<2){e=await reloadDisk(e);assert.equal(e.s.persistentHistoryAvailable,true);assert.equal(e.s.persistentHistoryFile.shots.length,cup+1);assert(e.s.adaptiveHistory.some(x=>x.s2));}}
 assert(flows[1]>flows[0]&&flows[2]>flows[1]);assert(Math.abs(flows[2]-5)<Math.abs(flows[0]-5));assert(commands[2]>commands[1]);assert.equal(e.s.persistentHistoryFile.shots.length,3);
});
test('Normal reacts to current S1 and S3 errors without mandatory second cups',()=>{const e=normalEnv(),r=coffeeRun(e,'single',[2.1,1.8,1.5]);r.config.adaptiveLearningLevel='正常';r.rawScaleSamples.filter(x=>x.phase==='stage1').forEach(x=>x.weightG*=.7);const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s1.action,'ADJUST');assert(q.s1.suggestedCommandMlS>.719);assert(q.s3.suggestedShape);assert.equal(q.s3.repeatCount,1);assert.equal(q.s1.learningLevel,'正常');});
test('Normal contradictory history damps a current correction instead of blocking it',()=>{const e=normalEnv(),current={targetGS:5,command:2.5,measured:3.5,r2:1,seconds:6},previous={...current,measured:6};const p=e.h.learningPolicy('正常'),a=e.h.scalarLearningSuggestion('S2','s2',current,null,p,true),b=e.h.scalarLearningSuggestion('S2','s2',current,previous,p,true);assert.equal(b.action,'ADJUST');assert.equal(b.confidence,'LOW');assert(b.suggestedCommandMlS>2.5);assert(b.suggestedCommandMlS<a.suggestedCommandMlS);assert.match(b.reason,/reduces the step/);});
test('Conservative requires repeated evidence, Gentle admits a large stable miss, Aggressive increases gain',()=>{const a=normalEnv('保守'),r=fixedOutcome(a);assert.equal(a.h.nextShotAdaptiveSuggestion(r).s2.action,'REPEAT SAME COMMAND');const b=normalEnv('温和'),g=fixedOutcome(b);assert.equal(b.h.nextShotAdaptiveSuggestion(g).s2.action,'ADJUST');const n=normalEnv('正常'),nr=fixedOutcome(n),x=normalEnv('激进'),xr=fixedOutcome(x);assert(x.h.nextShotAdaptiveSuggestion(xr).s2.suggestedCommandMlS>n.h.nextShotAdaptiveSuggestion(nr).s2.suggestedCommandMlS);});
test('same physical curve reuses target weight time pressure and temperature micro-adjustments',()=>{const e=normalEnv(),a=copy(e.h.adaptiveHistoryFingerprint()),b=copy(a);b.targets.stage2=5.3;b.shotSettings.stage1Weight=5;b.shotSettings.stage2Weight=43;b.shotSettings.soakSeconds=12;b.shotSettings.finalWeight=105;b.shotSettings.stage2PressureLimit=5.5;b.shotSettings.temperature=94;assert.equal(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(b));b.shotSettings.activeRelease=false;assert.notEqual(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(b));});
test('nearby S1 S2 and S3 command histories become labeled model references',()=>{const e=normalEnv(),current={targetGS:5,command:2.8,measured:4,r2:.99,seconds:5},previous={...current,command:2.5,measured:3.5};const q=e.h.s2NearbyEvidence(current,previous,'s2');assert(q);assert(Math.abs(q.measured-3.92)<.001);assert.equal(q.originalCommandMlS,2.5);const a=syntheticRun(e),ev=e.h.stage3AdaptiveEvidence(a),old=copy(ev);old.source.forEach(x=>x.command*=.9);old.earlySeconds=9;old.midSeconds=16;const p=e.h.stage3ReferenceEvidence(ev,old);assert(p);assert.equal(p.earlySeconds,ev.earlySeconds);assert.match(p.comparisonModel,/timing/);});
test('Normal does not numerically learn excluded cups, extreme responses or pressure limits',()=>{for(const kind of ['excluded','extreme','pressure']){const e=normalEnv(),r=fixedOutcome(e,'bad',kind==='extreme'?.5:3.5);if(kind==='excluded')r.learningReview={excluded:true};if(kind==='pressure')r.samples.filter(x=>x.phase==='stage2').forEach(x=>x.pressureBar=5.99);const q=e.h.nextShotAdaptiveSuggestion(r);if(kind==='excluded')assert.equal(q,null);else assert.notEqual(q.s2.action,'ADJUST',kind);}});
test('fixed S2 level learning uses settled tail without treating an initial delay as a level deficit',()=>{const e=normalEnv(),r=startupRun(e,'delayed',3,2,5);r.config.adaptiveLearningLevel='正常';const ev=e.h.stage2AdaptiveEvidence(r);assert(ev);assert(Math.abs(ev.measured-5)<.01);assert.match(ev.measurementBasis,/settled-tail/);});
test('Normal one slow low plateau can arm startup assist after changing both S1 and S2 commands',()=>{const e=normalEnv(),r=startupRun(e,'slow',1,6,3.8);r.config.adaptiveLearningLevel='正常';const m=e.h.stage2StartupMetrics(r);startupHistory(e,[{...m,s1CommandMlS:.78,baseCommandMlS:2.7}]);e.s.cfg.adaptiveLearningLevel='正常';const plan=e.h.stage2LegacyStartupPlan();assert(plan.enabled,plan.reason);assert.equal(plan.holdMs,400);assert.equal(plan.boostQuanta,1);assert.equal(plan.sourceRunIds.length,1);assert.equal(plan.referenceRiseBasis,'observed plateau');});
test('legacy schema1 baseline-off metrics with a 4.1 second rise are reusable without fabricated RAW',()=>{const e=normalEnv(),m={schema:1,eligible:false,reason:'S2 baseline off target; learn level before startup boost',targetGS:5,baseCommandMlS:2.507,s1CommandMlS:.719,rise20to80S:4.1,tailMeanGS:3.8,tailCvPct:5,overshootPct:0,pulseUsed:false};startupHistory(e,[m]);e.s.cfg.adaptiveLearningLevel='正常';const p=e.h.stage2LegacyStartupPlan();assert(p.enabled,p.reason);assert.equal(p.referenceRiseS,4.1);assert.equal(p.referenceRiseBasis,'target');});
test('startup OFF explains this-shot planning independently of current next-shot eligibility',()=>{const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2StartupAssist=false;e.s.runtimeProfileVerified=true;e.h.startSequence(0);assert.equal(e.s.liveTrim.report.startupExecution.status,'not-planned');assert.match(e.s.liveTrim.report.startupExecution.reason,/disabled/);const h=e.h.buildGhcOverlayHtml();assert.match(h,/execution.reason/);assert.match(h,/Rise basis:/);});
test('Aggressive admission width is precisely 1.3 times Normal statistical width',()=>{const e=normalEnv(),n=e.h.learningAdmission({config:{adaptiveLearningLevel:'正常'}}),a=e.h.learningAdmission({config:{adaptiveLearningLevel:'激进'}});assert.equal(a.factor,1.3);assert(Math.abs(a.spread(.12)-.156)<1e-12);assert.equal(a.r2(.9),.87);assert(Math.abs(a.spread(.25)/n.spread(.25)-1.3)<1e-12);assert(Math.abs(a.seconds(2.4)*1.3-n.seconds(2.4))<1e-12);assert.equal(a.samples(6),5);});
test('same noisy S1 trajectory can fail Normal fit and pass Aggressive fit without changing RAW',()=>{const e=normalEnv();let selected=null;for(let amplitude=.4;amplitude<=1.2;amplitude+=.025){const r=syntheticRun(e,'noise');r.config.adaptiveLearningLevel='正常';for(let i=0;i<r.rawScaleSamples.length;i++){const x=r.rawScaleSamples[i];if(x.phase==='stage1'&&x.tMs>=3400&&x.tMs<=6600)x.weightG+=amplitude*Math.sin(i*1.3);}const m=e.h.stage1StartupMetrics(r);if(m&&m.midR2>=.87&&m.midR2<.9&&m.midSampleCount>=8&&m.transit20to80S>=.9){selected=r;break;}}assert(selected,'fixture must cover widened fit range');const raw=JSON.stringify(selected.rawScaleSamples);assert.equal(e.h.stage1AdaptiveEvidence(selected),null);selected.config.adaptiveLearningLevel='激进';assert(e.h.stage1AdaptiveEvidence(selected));assert.equal(JSON.stringify(selected.rawScaleSamples),raw);});
test('Aggressive wider learning does not widen driver pressure stale-data ACK or write caps',async()=>{const e=await trimFixture();e.s.cfg.adaptiveLearningLevel='激进';e.s.liveTrim.run.config.adaptiveLearningLevel='激进';const cap=e.s.liveTrim.report.maxWrites;e.s.lastPressure=5.99;await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.maxWrites,cap);e.s.lastPressure=1;e.advance(1000);await trimTick(e);assert.equal(rawWrites(e).length,0);trimSamples(e,4);await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(2200);trimSamples(e,4);await trimTick(e);assert.equal(e.s.phase,'aborted');});
test('Normal S3 policy keeps each frame inside relative absolute and original shape limits',()=>{const e=normalEnv();for(const level of ['保守','温和','正常','激进']){e.s.cfg.adaptiveLearningLevel=level;const r=syntheticRun(e,'shape',[2.4,1.8,1.1]);r.config.adaptiveLearningLevel=level;const a=e.h.stage3AdaptiveEvidence(r);if(level==='保守')e.h.rememberAdaptiveEvidence({...r,runId:'prior'});const q=e.h.nextShotAdaptiveSuggestion(r).s3;if(!q.suggestedShape)continue;const p=e.h.learningPolicy(level),values=[q.suggestedShape.earlyCommand,q.suggestedShape.midCommand,q.suggestedShape.lateCommand];values.forEach((x,i)=>{assert(Math.abs(x-a.source[i].command)<=p.s3[1]+.001);assert(Math.abs(x/a.source[i].command-1)<=p.s3[0]+.002)});assert(values[0]<=values[1]&&values[1]<=values[2]);}});
test('current and shot-start tables distinguish Original Adaptive Manual and retain frozen origin',async()=>{const e=normalEnv();e.s.runtimeProfileVerified=true;e.h.startDiagnostics('hyperex');const run=e.s.diagnosticCurrent;assert.equal(e.h.diagnosticRunCommandSnapshot(run).stage2.origin,'original');const r=fixedOutcome(e,'learn');await e.h.applyNextShotAdaptiveSuggestion(r,'auto');assert.equal(e.h.commandFlowSummary().appliedProfile.stage2.origin,'adaptive');assert.equal(e.h.diagnosticRunCommandSnapshot(run).stage2.origin,'original');e.h.startDiagnostics('hyperex');assert.equal(e.h.diagnosticRunCommandSnapshot(e.s.diagnosticCurrent).stage2.origin,'adaptive');});
test('editing S1 manually preserves adaptive S2 provenance and later auto updates preserve manual S1',async()=>{const e=normalEnv();e.s.runtimeProfileVerified=true;await e.h.applyNextShotAdaptiveSuggestion(fixedOutcome(e,'learn'),'auto');const c=e.h.commandFlowSummary(),body={stages:{stage1:{mode:'manual',command:.8},stage2:{mode:'keep',command:c.stage2CommandMlS},stage3:{mode:'auto'}},s3Shape:{enabled:false}};const response=await e.plugin.__httpRequestHandler({endpoint:'test-command-set',body});assert.equal(response.status,200);assert.equal(e.h.commandFlowSummary().stage1Origin,'manual');assert.equal(e.h.commandFlowSummary().stage2Origin,'adaptive');const before=e.h.commandFlowSummary(),r=fixedOutcome(e,'again');r.config.stage1CommandMode='manual';r.config.stage1CommandOrigin='manual';r.config.stage1CommandMlS=.8;r.config.stage2CommandMode='manual';r.config.stage2CommandOrigin='adaptive';r.config.stage2CommandMlS=before.stage2CommandMlS;r.rawScaleSamples=r.rawScaleSamples.filter(x=>x.phase!=='stage1');r.samples=r.samples.filter(x=>x.phase!=='stage1');await e.h.applyNextShotAdaptiveSuggestion(r,'auto');assert.equal(e.h.commandFlowSummary().stage1Origin,'manual');assert.equal(e.h.commandFlowSummary().stage2Origin,'adaptive');});
test('visual S2 edit does not relabel unchanged adaptive S1 or S3 shape as manual',async()=>{const e=normalEnv();e.s.testOverrides={...seedOverride(e,'empty'),adaptiveSource:{runId:'old',mode:'auto'}};e.s.testOverrides.stages.stage1.origin='adaptive';e.s.testOverrides.s3Shape.origin='adaptive';await e.h.syncHyperExProfile(true);const d=e.h.curveEditorSnapshot();d.values.stage2+=.0625;await e.h.applyCurveEditorDraft(d);assert.equal(e.h.commandFlowSummary().stage1Origin,'adaptive');assert.equal(e.h.commandFlowSummary().stage2Origin,'manual');assert.equal(e.h.commandFlowSummary().stage3Origin,'adaptive');});
test('legacy learned overrides are Adaptive and unattributed legacy overrides are never called manual',()=>{const e=setup();e.s.testOverrides=seedOverride(e,'empty');assert.equal(e.h.commandFlowSummary().stage1Origin,'retained');e.s.testOverrides.adaptiveSource={runId:'legacy',mode:'auto'};assert.equal(e.h.commandFlowSummary().stage1Origin,'adaptive');});
test('rendered command mode labels show actor independently of flat or shape storage',()=>{const html=setup().h.buildGhcOverlayHtml(),line=html.split('\n').find(x=>x.startsWith('function commandModeLabel'));const ctx=vm.createContext({String});vm.runInContext(line,ctx);assert.equal(ctx.commandModeLabel('manual','adaptive'),'ADAPTIVE');assert.equal(ctx.commandModeLabel('auto','original'),'ORIGINAL / LUT');assert.equal(ctx.commandModeLabel('shape','manual'),'MANUAL · SHAPE');assert.equal(ctx.commandModeLabel('manual',null),'RETAINED / UNKNOWN');});
test('learning dropdown saves a native enum string rather than parsing it as a number',async()=>{const html=setup().h.buildGhcOverlayHtml(),line=html.split('\n').find(x=>x.startsWith('async function saveAdvancedSettings'));let saved;const ctx=vm.createContext({base:'/p',coreSettings:'/s',ADV_FIELDS:['adaptiveLearningLevel'],ADV_SETTING_KEYS:{adaptiveLearningLevel:'AdaptiveLearningLevel'},$:()=>({type:'select-one',value:'激进'}),alert(){},confirm:()=>true,setTimeout(){},Number,JSON,location:{reload(){}},fetch:async(url,opts)=>opts?(saved=JSON.parse(opts.body),{ok:true}):{ok:true,json:async()=>({canEdit:true})}});vm.runInContext(line,ctx);await ctx.saveAdvancedSettings();assert.equal(saved.AdaptiveLearningLevel,'激进');});
test('history compaction preserves every action and numeric evidence while full current CSV stays intact',()=>{const e=setup(),r=controlledRun(e,'compact');r.liveFlowTrim.trace.unshift(...Array.from({length:1000},(_,i)=>({kind:'check',tMs:i,reason:'inside-band'})));const full=JSON.stringify(r.liveFlowTrim.trace),record=e.h.compactPersistentShotRecord(r,{runId:r.runId,s2:e.h.stage2AdaptiveEvidence(r)});assert.equal(JSON.stringify(r.liveFlowTrim.trace),full);assert.equal(record.liveFlowTrim.trace.filter(x=>x.kind==='check').length,0);assert.deepEqual(copy(record.liveFlowTrim.trace.filter(x=>x.kind==='write')),copy(r.liveFlowTrim.trace.filter(x=>x.kind==='write')));assert.equal(record.liveFlowTrim.checkReasons['inside-band'],1000);assert(record.evidence.s2);assert(e.h.diagnosticCsv(r).includes('inside-band'));assert(JSON.stringify(record.liveFlowTrim).length<full.length/2);});
test('per-run persistence audit never reports success before readback and counts UTF8 bytes correctly',()=>{const e=normalEnv();e.s.cfg.basketContext='coffee';prepareDisk(e);e.h.rememberAdaptiveEvidence(fixedOutcome(e,'保存'));const pending=e.h.historyPersistenceAudit('保存');assert.equal(pending.currentRecordPresent,true);assert.equal(pending.currentRunReadbackVerified,false);assert.equal(e.s.historyWriteBytes,Buffer.byteLength(e.s.pendingHistoryWrite,'utf8'));e.flushReads();assert.equal(e.h.historyPersistenceAudit('保存').currentRunReadbackVerified,true);assert.equal(e.h.utf8ByteLength('汉字☕😀'),Buffer.byteLength('汉字☕😀','utf8'));});
test('transient history failure retries only while idle and re-verifies the whole file',()=>{const e=normalEnv();e.s.persistentHistoryLoaded=true;e.s.persistentHistoryFile={schema:2,shots:[historyRow(e)]};e.h.setPersistentHistoryUnavailable('temporary');assert.equal(e.s.persistentHistoryAvailable,false);assert(e.s.historyRecoveryTimer);e.s.phase='stage2';e.run(e.s.historyRecoveryTimer);assert.equal(e.s.historyRecoveryAttempts,0);e.s.phase='idle';e.run(e.s.historyRecoveryTimer);assert.equal(e.s.historyRecoveryAttempts,1);e.flushReads();assert.equal(e.s.persistentHistoryAvailable,true);assert(e.s.historyVerifiedRunIds.includes('old'));});
test('micro goal changes preserve valid learned seeds and coffee readiness without losing physical guards',()=>{const e=normalEnv();e.s.testOverrides=seedOverride(e,'empty');e.s.cfg.basketContext='coffee';prepareDisk(e);const old=e.h.testOverrideStatus().valid;e.s.cfg.stage2Flow=5.3;e.s.cfg.stage2Weight=42;e.s.cfg.soakSeconds=11;e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'coffee');assert.equal(e.h.testOverrideStatus().valid,old);e.s.calibrationMap.createdAt='different';assert.equal(e.h.testOverrideStatus().valid,false);});

test('Aggressive admits the same stable S2 waveform at a 30 percent wider CV limit',()=>{const e=normalEnv(),r=fixedOutcome(e,'ripple');for(const x of r.rawScaleSamples.filter(x=>x.phase==='stage2')){const t=x.tMs/1000-10,w=2*Math.PI/3;x.weightG=3.5*t+1.1*(1-Math.cos(w*t))/w;}const q=e.h.controlOutputQuality(r,'stage2');assert(q.available);assert(q.tailRippleCVPct>12&&q.tailRippleCVPct<15.6,String(q.tailRippleCVPct));r.config.adaptiveLearningLevel='正常';assert.equal(e.h.stage2AdaptiveEvidence(r),null);r.config.adaptiveLearningLevel='激进';assert(e.h.stage2AdaptiveEvidence(r));});
test('flat S3 can finish and persist learning without a missing-shape dereference',()=>{const e=normalEnv(),r=syntheticRun(e);r.config.stage3Shape={enabled:false};r.config.adaptiveLearningLevel='正常';const x=e.h.stage3AdaptiveEvidence(r);assert(x);assert.equal(x.earlySeconds,8);assert.equal(x.midSeconds,14);e.h.rememberAdaptiveEvidence(r);assert(e.s.persistentHistoryFile.shots.some(x=>x.runId===r.runId));});
test('full live trace and S2 proposal export survive the rolling event ring',()=>{const e=normalEnv(),r=controlledRun(e,'csv');r.config.adaptiveLearningLevel='正常';r.events=[];r.liveFlowTrim.trace.unshift({kind:'check',tMs:10,frame:1,reason:'early-retained-check'});const csv=e.h.diagnosticCsv(r);assert(csv.includes('live_trim_tMs'));assert(csv.includes('early-retained-check'));assert(csv.includes('next_shot_stage'));assert(csv.includes('S2,1,'));assert(csv.includes('shot_command_stage,origin,internal_mode'));});
test('browser live status uses the frozen policy band without an undefined summary variable',()=>{const html=setup().h.buildGhcOverlayHtml(),line=html.split('\n').find(x=>x.startsWith('function renderLiveTrim'));const label={textContent:''};const ctx=vm.createContext({$:()=>label,esc:String});vm.runInContext(line,ctx);ctx.renderLiveTrim({liveFlowTrim:{learningBand:5,level:3,status:'shot-finished',checks:100,maxChecks:2000,writes:10,maxWrites:200}});assert.match(label.textContent,/next-shot band ±5%/);});
test('older release records keep their evidence across a 1.68 version read and micro changes',()=>{const e=normalEnv(),r=fixedOutcome(e,'old-version');e.h.rememberAdaptiveEvidence(r);const saved=copy(e.s.persistentHistoryFile);saved.writerVersion='0.1.65';saved.shots[0].pluginVersion='0.1.65';delete saved.shots[0].fingerprint.shotSettings.activeRelease;delete saved.shots[0].evidence.fingerprint.shotSettings.activeRelease;e.s.cfg.stage2Flow=5.2;e.s.cfg.stage2Weight=42;e.s.persistentHistoryLoaded=false;e.s.persistentHistoryFile=null;e.s.persistentHistoryAvailable=true;e.s.adaptiveHistory=[];e.event('adaptiveHistoryFileV2',JSON.stringify(saved));e.h.restoreAdaptiveHistoryFromPersistentFile();assert(e.s.adaptiveHistory.some(x=>x.runId==='old-version'&&x.s2));assert.equal(e.s.persistentHistoryFile.shots[0].pluginVersion,'0.1.65');});
test('four learning levels have monotonically increasing gains and per-stage bounds',()=>{const e=setup(),p=['保守','温和','正常','激进'].map(x=>e.h.learningPolicy(x));for(let i=1;i<p.length;i++){assert(p[i].gain>=p[i-1].gain);for(const k of ['s1','s2','s3'])for(let j=0;j<2;j++)assert(p[i][k][j]>=p[i-1][k][j]);}});
// Active-release refill tests are separate from the retained continuous pulse tests.
async function refillFixture(){
 const e=await pulseFixture();const p=e.h.stage2StartupPlan();assert.equal(p.strategy,'refill-85');
 const t=e.s.liveTrim;t.startup={status:'armed',plan:p};t.run.config.s2StartupPlan=copy(p);t.report.s2StartupPlan=copy(p);
 t.report.startupExecution={status:'armed',reason:p.reason};e.s.lastFlow=.1;return e;
}
function refillSamples(e,flow){
 const t=e.s.liveTrim,end=e.now()-t.run.startedAtMs;e.s.latestScaleAtMs=e.now();e.s.lastMachineAtMs=e.now();
 t.run.rawScaleSamples=Array.from({length:11},(_,i)=>({phase:'stage2',profileFrame:1,tMs:end-1000+i*100,weightG:i*.1*flow,scaleTimestampSeconds:100+end/1000-1+i*.1}));
}
async function returnedRefill(e,flow=4.3){
 await trimTick(e);trimAck(e);e.advance(1500);refillSamples(e,flow);await trimTick(e);assert.equal(e.s.liveTrim.pending.startupAction,'return');
 trimAck(e);pulseTarget(e,e.s.liveTrim.startup.plan.baseCommandMlS);assert.equal(e.s.liveTrim.startup.status,'complete');
}
test('active-release refill arms without clean prior cups or disk consensus',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.persistentHistoryLoaded=false;e.s.storageProbeVerified=false;
 const p=e.h.stage2StartupPlan();assert(p.enabled);assert.equal(p.strategy,'refill-85');assert.equal(p.cutoffFraction,.85);assert.equal(p.holdMs,4000);assert(p.boostCommandMlS>p.baseCommandMlS);assert.equal(p.sourceRunIds.length,0);
});
test('refill obeys both switches and continuous mode retains its original pulse strategy',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;assert(e.h.stage2StartupPlan().enabled);e.s.cfg.s2StartupAssist=false;assert(!e.h.stage2StartupPlan().enabled);
 e.s.cfg.s2StartupAssist=true;e.s.cfg.liveFlowTrimTest=false;assert(!e.h.stage2StartupPlan().enabled);e.s.cfg.liveFlowTrimTest=true;e.s.cfg.activeRelease=false;assert.notEqual(e.h.stage2StartupPlan().strategy,'refill-85');
});
test('refill amplitude stays within native quantization60percent and hard8 without plus2 across commands',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;
 for(const base of [.1,.3,.75,2.5,4,7.8,8]){
  e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:base,desiredGS:5,origin:'manual'}}};
  const p=e.h.stage2StartupPlan();if(!p.enabled){assert(p.baseCommandMlS>=7.9||p.baseCommandMlS<=.125);continue;}
  assert(p.boostCommandMlS<=8);assert(p.boostCommandMlS<=p.baseCommandMlS*1.6+1e-9);assert.equal(p.boostCommandMlS*16,Math.round(p.boostCommandMlS*16));
 }
});
test('refill launches despite actuator still far below baseline and lagging old target echo',async()=>{
 const e=await refillFixture();e.s.liveTrim.observedTarget=.75;await trimTick(e);
 const w=e.s.liveTrim.report.trace.find(x=>x.kind==='write');assert.equal(w.commandMlS,4);assert.equal(w.startupAction,'boost');assert.equal(rawWrites(e).length,1);
 assert(!e.calls.some(x=>x.path==='/machine/state/skipStep'));assert.equal(e.h.profileObject().steps.length,3);
});
test('refill waits for confirmed frame1 without disarming on old frame0',async()=>{
 const e=await refillFixture();e.s.lastFrame=0;await trimTick(e);assert.equal(e.s.liveTrim.startup.status,'armed');assert.equal(rawWrites(e).length,0);
 e.s.lastFrame=1;pulseTarget(e,2.5);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.startup.status,'boosting');
});
test('refill does not spend its dispatch window before first frame telemetry',async()=>{
 const e=await refillFixture();e.s.liveTrim.frameAt=0;e.s.lastFrame=0;await trimTick(e);assert.equal(e.s.liveTrim.startup.status,'armed');
 e.advance(500);e.s.lastFrame=1;e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();pulseTarget(e,2.5);await trimTick(e);assert.equal(rawWrites(e).length,1);
});
test('refill never writes before confirmed frame even if its planned window expires',async()=>{
 const e=await refillFixture();e.s.lastFrame=0;await trimTick(e);e.advance(4100);await trimTick(e);assert.equal(e.s.liveTrim.startup.status,'skipped');assert.equal(rawWrites(e).length,0);
});
test('refill returns baseline when raw cup flow reaches85 percent not100',async()=>{
 const e=await refillFixture();await returnedRefill(e);const t=e.s.liveTrim;
 assert.equal(rawWrites(e).length,2);assert.equal(t.report.startupExecution.cutoff.thresholdGS,4.25);assert.equal(t.report.startupExecution.cutoff.rawGS,4.3);assert.match(t.report.startupExecution.reason,/configured/);
 assert(t.startup.approachAt>e.now());assert.equal(t.startupAckTimer,null);
});
test('refill forecast does not return until measured cup flow reaches85 percent',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(1300);refillSamples(e,3.4);await trimTick(e);assert.equal(rawWrites(e).length,1);
 e.advance(300);refillSamples(e,4.1);await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(250);refillSamples(e,4.3);await trimTick(e);assert.equal(rawWrites(e).length,2);const c=e.s.liveTrim.report.startupExecution.cutoff;assert(c.rawGS>=4.25);
});
test('refill skips a late enhancement when cup flow is already85 percent',async()=>{
 const e=await refillFixture();e.advance(1500);refillSamples(e,4.3);await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.startup.status,'skipped');assert.match(e.s.liveTrim.report.startupExecution.reason,/unnecessary/);
});
test('refill uses unique scale times and rejects gaps tare spikes and stale raw windows',async()=>{
 for(const kind of ['duplicates','gap','tare','stale']){
  const e=await refillFixture();e.advance(1600);refillSamples(e,4.5);const rows=e.s.liveTrim.run.rawScaleSamples;
  if(kind==='duplicates')rows.forEach(x=>x.scaleTimestampSeconds=100);
  if(kind==='gap')rows.forEach((x,i)=>{if(i>=5)x.scaleTimestampSeconds+=1;});
  if(kind==='tare')rows[8].tareReset=true;
  if(kind==='stale')rows.forEach(x=>x.tMs-=1000);
  assert.equal(e.h.s2RefillFlowEstimate(e.s.liveTrim),null,kind);
 }
});
test('refill returns at90 percent of pressure cap and does not wait for cup regression',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(250);e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();e.s.lastPressure=5.4;e.s.liveTrim.run.rawScaleSamples=[];
 await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.pending.command,2.5);assert.match(e.s.liveTrim.report.startupExecution.reason,/pressure/);
});
test('refill stale scale triggers baseline return rather than continuing blind filling',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(700);e.s.lastMachineAtMs=e.now();await trimTick(e);
 assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.pending.command,2.5);assert.match(e.s.liveTrim.report.startupExecution.reason,/scale became stale/);
});
test('refill independent4second return works with missing boost echo and no raw curve',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(4000);e.s.lastMachineAtMs=e.now();e.s.liveTrim.run.rawScaleSamples=[];
 await e.run(e.s.liveTrim.startupReturnTimer);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.pending.command,2.5);assert.equal(e.s.liveTrim.pending.targetSeen,false);
});
test('refill missing boost driver ACK stops within2seconds',async()=>{
 const e=await refillFixture();await trimTick(e);e.advance(2000);await e.run(e.s.liveTrim.startupAckTimer);assert.equal(e.s.phase,'aborted');assert(e.calls.some(x=>x.path==='/machine/state/idle'));
});
test('refill return driver ACK has its own2second deadline after early cutoff',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(1300);refillSamples(e,4.3);await trimTick(e);e.advance(2000);await e.run(e.s.liveTrim.startupAckTimer);assert.equal(e.s.phase,'aborted');
});
test('refill return ACK completes the refill and never stacks another boost',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(1500);refillSamples(e,4.3);await trimTick(e);trimAck(e);
 assert.equal(e.s.liveTrim.startup.status,'complete');
 e.advance(5000);e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();await trimTick(e);
 assert.equal(rawWrites(e).length,2);
});
test('refill S3 transition clears all deadlines and cannot write the former frame',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);const t=e.s.liveTrim,ids=[t.startupReturnTimer,t.startupWatchdog,t.startupAckTimer];
 e.s.phase='stage3';e.s.lastFrame=2;e.h.observeLiveTrimMachine({profileFrame:2});ids.forEach(id=>assert(!e.timers.has(id)));assert.equal(await e.h.dispatchS2Startup(t,'return'),false);assert.equal(rawWrites(e).length,1);
});
test('refill cannot launch without pressure freshness truth or reserved return budget',async()=>{
 for(const kind of ['pressure','scale','machine','truth','pending','budget']){
  const e=await refillFixture();if(kind==='pressure')e.s.lastPressure=5.5;if(kind==='scale')e.s.latestScaleAtMs-=1000;if(kind==='machine')e.s.lastMachineAtMs-=1000;if(kind==='truth')e.s.runtimeProfileVerified=false;if(kind==='pending')e.s.liveTrim.pending={};if(kind==='budget')e.s.liveTrim.report.maxWrites=1;
  assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false,kind);assert.equal(rawWrites(e).length,0);
 }
});
test('after85percent cutoff cup target stays100percent while handover pacing ramps',async()=>{
 const e=await refillFixture();await returnedRefill(e);e.advance(1700);trimSamples(e,4.4);await trimTick(e);
 let row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(row.approachFraction,1);assert.equal(row.handoverProgress,1);assert.equal(row.targetGS,5);assert.equal(row.finalTargetGS,5);
 if(e.s.liveTrim.pending){trimAck(e);pulseTarget(e,e.s.liveTrim.pending.command);e.advance(60);await trimTick(e);}
 e.advance(4000);trimSamples(e,4.4);await trimTick(e);row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(row.approachFraction,1);
});
test('200ms approach hands control back before the next trim write',async()=>{
 const e=await refillFixture();await returnedRefill(e);trimAck(e);e.advance(400);trimSamples(e,3.9);await trimTick(e);
 const row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(row.approachFraction,1);
});
test('S2 refill transient does not enter steady-level machine coverage or normalization',()=>{
 const e=normalEnv(),r=startupRun(e,'refill-learning',.5,2,4);r.config.experimentalLiveTrim=true;r.config.adaptiveLearningLevel='正常';r.config.s2StartupPlan={strategy:'refill-85'};
 r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'},{kind:'write',frame:1,tMs:2500,commandMlS:2.5,startupAction:'return'},{kind:'startup-complete',frame:1,tMs:2700,strategy:'refill-85'}]};
 r.samples.forEach(x=>{x.targetFlowMlS=x.tMs<2500?3.5:2.5;x.machineFlowMlS=x.targetFlowMlS;});
 const q=e.h.controlLearningAssessment(r,'stage2');assert.equal(q.refillExcludedUntilMs,2900);assert(q.eligible,q.reason);assert(q.frames.every(x=>x.windows.every(w=>w.startMs>=4300)));
 r.liveFlowTrim.trace=r.liveFlowTrim.trace.filter(x=>x.kind!=='startup-complete');const bad=e.h.controlLearningAssessment(r,'stage2');assert.equal(bad.eligible,false);assert.match(bad.reason,/return unconfirmed/);
});
test('GHC pouring schedules a zero-delay single guarded transition and preopens raw transport',async()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.s.phase='restart_wait';
 e.h.restartPourConfirmed('test',{machineState:'espresso',substate:'pouring'});assert.equal(e.timers.get(e.s.restartSkipTimer).ms,0);await settlePromises();assert(e.calls.some(x=>x.transport==='open'));assert.equal(rawWrites(e).length,0);
 const count=e.s.liveTrim.report.checks;await trimTick(e);assert.equal(e.s.liveTrim.report.checks,count);assert.equal(rawWrites(e).length,0);
 e.h.setApi(async(path,opt={})=>{e.calls.push({path,method:opt.method||'GET'});return {ok:true,json:async()=>({machineState:'espresso',substate:'pouring',profileFrame:0})};});
 await e.run(e.s.restartSkipTimer);assert.equal(e.s.phase,'stage2');assert.equal(e.calls.filter(x=>x.path==='/machine/state/skipStep').length,1);assert.equal(e.s.liveTrim.started,true);
});
test('already-at-S2 restart sends no redundant skip and unexpected frame never skips',async()=>{
 for(const frame of [1,2]){
  const e=normalEnv();e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.s.phase='restart_wait';
  e.h.setApi(async(path,opt={})=>{e.calls.push({path,method:opt.method||'GET'});return {ok:true,json:async()=>({machineState:'espresso',substate:'pouring',profileFrame:frame})};});
  e.h.restartPourConfirmed('test',{machineState:'espresso',substate:'pouring'});await e.run(e.s.restartSkipTimer);assert.equal(e.calls.filter(x=>x.path==='/machine/state/skipStep').length,0);assert.equal(e.s.phase,frame===1?'stage2':'aborted');
 }
});
test('refill UI includes actual bounded commands85percent cutoff and executed reason',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/85% cutoff/);assert.match(html,/plan.boostCommandMlS/);assert.match(html,/execution.reason/);
});

test('missing frame telemetry cannot cancel refill return deadline or ACK protection',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);const t=e.s.liveTrim,deadline=t.startupReturnTimer,watch=t.startupWatchdog;
 e.s.lastFrame=null;e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:false,profileFrame:null});
 assert(e.timers.has(deadline));assert(e.timers.has(watch));assert.equal(t.startup.status,'boosting');
 e.advance(4000);await e.run(deadline);assert.equal(rawWrites(e).length,1);assert(e.timers.has(watch));
 e.advance(2500);e.run(watch);assert.equal(e.s.phase,'aborted');assert(e.calls.some(x=>x.path==='/machine/state/idle'));
});
test('return deadline survives unknown frame and writes baseline once same S2 frame is recovered',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);const t=e.s.liveTrim;e.s.lastFrame=null;e.h.observeLiveTrimMachine({profileFrame:null});
 e.advance(4000);await e.run(t.startupReturnTimer);assert.equal(t.startup.status,'boosting');assert.equal(rawWrites(e).length,1);
 e.s.lastFrame=1;e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();pulseTarget(e,3.5);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(t.pending.command,2.5);
});
test('S2 refill uses160percent pump command and keeps cup cutoff in gpersecond',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;const p=e.h.stage2StartupPlan();assert.equal(p.refillTargetGS,undefined);assert.equal(p.cutoffFraction,.85);assert.equal(p.boostCommandMlS,4);assert.equal(p.refillTargetFraction,1.6);assert.equal(e.s.cfg.stage2Flow,5);assert.match(p.commandBasis,/base-pump-command/);
});

test('cup-target basis estimates the refill base from the last clean S2 tail',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,basis:'cup-target'};
 const r=startupRun(e,'cup-tail',1,2,3.9);r.config.adaptiveFingerprint=copy(e.h.adaptiveHistoryFingerprint());e.s.diagnosticLast=r;
 const p=e.h.stage2StartupPlan();
 assert.equal(p.commandBasis,'target-cup-flow observed-tail local model');
 assert(Math.abs(p.refillPumpBaseMlS-2.507*5/3.9)<.02);
 assert(p.refillPumpBaseMlS>p.baseCommandMlS);
 assert.equal(p.refillTargetGS,5);
 assert.deepEqual(copy(p.sourceRunIds),[r.runId]);
 assert(p.referenceTailGS>3.8&&p.referenceTailGS<4);
 assert.equal(p.boostCommandMlS,5.125);
 assert(p.boostCommandMlS>p.baseCommandMlS*1.6);
});

test('cup-target basis without a clean observed tail falls back to the profile base command',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,basis:'cup-target'};
 const p=e.h.stage2StartupPlan();
 assert.equal(p.commandBasis,'target-cup-flow base fallback (no observed tail)');
 assert.equal(p.refillPumpBaseMlS,p.baseCommandMlS);
 assert.equal(p.boostCommandMlS,4);
 assert.equal(p.refillTargetGS,5);
 assert.deepEqual(copy(p.sourceRunIds),[]);
});

test('cup-target basis dispatches a boost above the base-pump 1.6 ceiling',async()=>{
 const e=await refillFixture();
 e.s.s2RefillSettings={...refillDefaults,basis:'cup-target'};
 const r=startupRun(e,'cup-tail',1,2,3.9);r.config.adaptiveFingerprint=copy(e.h.adaptiveHistoryFingerprint());e.s.diagnosticLast=r;
 const p=e.h.stage2StartupPlan(),t=e.s.liveTrim;
 assert(p.boostCommandMlS>p.baseCommandMlS*1.6+1e-6);assert(p.boostCommandMlS<=8);
 t.startup={status:'armed',plan:p};t.run.config.s2StartupPlan=copy(p);pulseTarget(e,p.baseCommandMlS);
 await trimTick(e);assert.equal(rawWrites(e).length,1);const w=e.s.liveTrim.report.trace.find(x=>x.kind==='write'&&x.startupAction==='boost');assert.equal(w.commandMlS,p.boostCommandMlS);
});

test('steady-gain estimate uses median cup/command from recent S2 evidence',()=>{
 const e=setup();e.s.persistentHistoryFile={shots:[
  {runId:'ga',evidence:{s2:{runId:'ga',targetGS:5,command:3.6,measured:4.0}}},
  {runId:'gb',evidence:{s2:{runId:'gb',targetGS:5,command:3.7,measured:4.1}}},
  {runId:'gc',evidence:{s2:{runId:'gc',targetGS:5,command:3.8,measured:4.2}}}
 ]};
 const g=e.h.stageGainEstimate('s2',null,null);assert(g);assert.equal(g.samples,3);assert(Math.abs(g.k-1.111)<.01);assert(g.spread<.02);assert.deepEqual(copy(g.sources),['ga','gb','gc']);
});
test('steady-gain estimate uses duration-weighted S3 frames and acts from two shots',()=>{
 const rows=[];for(let i=0;i<3;i++)rows.push({runId:'s'+i,evidence:{s3:{runId:'s'+i,targetGS:1.5,overallGS:1.6,source:[{command:.6,measured:1.6,seconds:10},{command:.72,measured:1.7,seconds:14},{command:.78,measured:1.8,seconds:12}]}}});
 const e=setup();e.s.persistentHistoryFile={shots:rows};const g=e.h.stageGainEstimate('s3',null,null);assert(g);assert.equal(g.samples,3);assert(Math.abs(g.k-1.6/.7)<.15);assert(g.command>.65&&g.command<.75);
 const e2=setup();e2.s.persistentHistoryFile={shots:rows.slice(0,2)};const g2=e2.h.stageGainEstimate('s3',null,null);assert(g2);assert.equal(g2.samples,2);
});
test('steady-gain UI exposes S2 and S3 feed-forward values',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml();assert.match(html,/增益前馈/);assert.match(html,/targetCommandMlS/);});
test('steady-gain feed-forward rewrites the S2 suggestion only with three agreeing shots',()=>{
 const e=setup(),run=controlledRun(e,'ff-apply');run.config.adaptiveLearningLevel='正常';
 const row=(id)=>({runId:id,evidence:{s2:{runId:id,targetGS:5,command:2.5,measured:3.5}}});
 e.s.persistentHistoryFile={shots:[row('g1'),row('g2'),row('g3')]};
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert(q.s2.gainFeedForward);assert.equal(q.s2.gainFeedForward.applied,true);assert(q.s2.suggestedCommandMlS>run.config.stage2CommandMlS);
 assert.match(q.s2.reason,/steady-gain feed-forward/);
});
test('steady-gain feed-forward stays inactive when recent ratios disagree',()=>{
 const e=setup(),run=controlledRun(e,'ff-noisy');
 const row=(id,m)=>({runId:id,evidence:{s2:{runId:id,targetGS:5,command:2.5,measured:m}}});
 e.s.persistentHistoryFile={shots:[row('n1',2.5),row('n2',4.5),row('n3',3.0)]};
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert(q.s2.gainFeedForward);assert.equal(q.s2.gainFeedForward.applied,false);
});
test('steady-gain feed-forward can act on two agreeing shots',()=>{
 const e=setup(),run=controlledRun(e,'ff-two');run.config.adaptiveLearningLevel='正常';
 e.s.persistentHistoryFile={shots:[{runId:'t1',evidence:{s2:{runId:'t1',targetGS:5,command:2.5,measured:3.5}}}]};
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert.equal(q.s2.gainFeedForward.samples,2);assert.equal(q.s2.gainFeedForward.applied,true);
});
test('two disagreeing shots keep feed-forward off',()=>{
 const e=setup(),run=controlledRun(e,'ff-two-bad');run.config.adaptiveLearningLevel='正常';
 e.s.persistentHistoryFile={shots:[{runId:'t1',evidence:{s2:{runId:'t1',targetGS:5,command:2.5,measured:3.0}}}]};
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert.equal(q.s2.gainFeedForward.samples,2);assert.equal(q.s2.gainFeedForward.applied,false);
});
test('refill basis slider edits the draft and persists cup-target across apply',async()=>{
 const e=await editorReady(),draft=editedRefill(e,{basis:'cup-target'});await e.h.applyCurveEditorDraft(draft);
 assert.equal(e.h.currentS2RefillSettings().basis,'cup-target');assert.equal(JSON.parse(e.storage.s2RefillSettingsV1).basis,'cup-target');
 const html=e.h.buildGhcOverlayHtml();assert.match(html,/data-refill-basis/);assert.match(html,/curveRefillBasisChange/);
});
test('S2 refill multiplier is independent of upper LUT interpolation',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.calibrationMap.points.push({actualFlow:6,commandFlow:3.5});e.h.recomputeCalibrationUsability();const p=e.h.stage2StartupPlan();assert.equal(p.boostCommandMlS,4);assert.match(p.commandBasis,/base-pump-command/);
});
test('S2 refill multiplier is independent of historical cup-tail models',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;const r=startupRun(e,'reference',1,2,4);r.config.adaptiveFingerprint=copy(e.h.adaptiveHistoryFingerprint());r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:500,commandMlS:2.5,startupAction:'return'}]};e.s.diagnosticLast=r;
 const p=e.h.stage2StartupPlan();assert.match(p.commandBasis,/base-pump-command/);assert.equal(p.referenceTailGS,undefined);assert.equal(p.boostCommandMlS,4);assert.deepEqual(copy(p.sourceRunIds),[]);
});
test('S2 refuses excluded or uncorroborated actual-tail models and keeps bounded fallback',()=>{
 for(const kind of ['excluded','flow','mode']){const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;const r=startupRun(e,'bad-reference',1,2,4);r.config.adaptiveFingerprint=copy(e.h.adaptiveHistoryFingerprint());if(kind==='excluded')r.learningReview={excluded:true};if(kind==='flow')r.samples.forEach(x=>x.machineFlowMlS=.2);if(kind==='mode')r.config.adaptiveFingerprint.shotSettings.activeRelease=false;e.s.diagnosticLast=r;assert.doesNotMatch(e.h.stage2StartupPlan().commandBasis,/actual-tail/,kind);}
});
test('soak prewarms raw channel without pumping checks or skips and preserves full soak',async()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.s.phase='dumping';e.h.beginSoak('test');const timer=e.s.soakTimer,ms=e.timers.get(timer).ms;
 await settlePromises();assert.equal(e.s.phase,'soak');assert(e.s.liveTrim.handle);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.checks,0);await trimTick(e);assert.equal(e.s.liveTrim.report.checks,0);assert.equal(e.timers.get(timer).ms,ms);assert(!e.calls.some(x=>x.path==='/machine/state/skipStep'));
});
test('confirmed S2 frame gets one immediate control kick without an extra period wait',async()=>{
 const e=await refillFixture(),t=e.s.liveTrim;t.startup.kickQueued=false;e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5});const timer=e.s.liveTrimTimer;assert.equal(e.timers.get(timer).ms,0);
 e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5});assert.equal(e.s.liveTrimTimer,timer);await e.run(timer);assert.equal(rawWrites(e).length,1);
});
test('immediate S2 kick does not permit writes before frame1 or bypass freshness',async()=>{
 const e=await refillFixture(),t=e.s.liveTrim;t.startup.kickQueued=false;e.s.lastFrame=0;e.h.observeLiveTrimMachine({profileFrame:0});assert(!t.startup.kickQueued);e.s.lastFrame=1;e.s.latestScaleAtMs-=2000;e.h.observeLiveTrimMachine({profileFrame:1});await e.run(e.s.liveTrimTimer);assert.equal(rawWrites(e).length,0);assert.equal(t.startup.status,'armed');
});
test('S3 weighted projection does not drag every frame up to the early proposed rise',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常'),old=[.813,.813,.813],q=e.h.projectS3Commands([.878,.8,.77],old,p,[8,14,18]);assert(q.every(x=>x<.813));assert(Math.max(...q)-Math.min(...q)<.001);assert(Math.abs(q[0]-.803)<.002);
});
test('S3 single-shot retains raw per-frame wishes before unbiased shape projection',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常'),c={targetGS:1.5,overallGS:1.6,status:'STABLE',earlySeconds:8,midSeconds:14,source:[1.1,1.65,1.8].map((measured,i)=>({name:['EARLY','MID','LATE'][i],command:.813,measured,r2:.999,seconds:[8,14,18][i]}))};
 const q=e.h.stage3SingleSuggestion(c,null,p);assert(q.rawProposedCommands[0]>.813);assert(q.rawProposedCommands[2]<.813);const sh=q.suggestedShape;assert(sh);assert(Math.max(sh.earlyCommand,sh.midCommand,sh.lateCommand)<=.813);
});
test('S3 projection retains all four strength caps monotonicity and adjacent bounds over mixed requests',()=>{
 const e=normalEnv();for(const level of ['保守','温和','正常','激进']){const p=e.h.learningPolicy(level);for(let k=0;k<200;k++){
  const old=[.698,.72,.778],want=old.map((v,i)=>v+.2*Math.sin(k*1.7+i*2.1)),q=e.h.projectS3Commands(want,old,p,[5,13,12]);
  q.forEach((v,i)=>{assert(Math.abs(v-old[i])<=p.s3[1]+.001);assert(Math.abs(v/old[i]-1)<=p.s3[0]+.002);if(i){assert(v>=q[i-1]-.001);assert(v<=Math.max(q[i-1]+.25,q[i-1]*1.35)+.001);}});
 }}
});
function actualModeledConflict(e,flow,command){
 const r=controlledRun(e,'model-conflict',true);r.config.adaptiveLearningLevel='激进';r.config.stage3CommandMlS=.813;Object.assign(r.config.stage3Shape,{earlyCommand:.813,midCommand:.813,lateCommand:.813});
 r.liveFlowTrim.trace=r.liveFlowTrim.trace.filter(x=>Number(x.frame)<2);let weight=50;
 for(const x of r.rawScaleSamples.filter(x=>x.phase==='stage3')){weight+=flow*.1;x.weightG=weight;}
 for(const frame of [2,3,4]){const rows=r.samples.filter(x=>x.phase==='stage3'&&x.profileFrame===frame);r.liveFlowTrim.trace.push({kind:'write',frame,tMs:rows[0].tMs,commandMlS:command});for(const x of rows){x.targetFlowMlS=command;x.machineFlowMlS=command;}}
 return r;
}
test('S3 actual high tail vetoes modeled upward suggestion rather than making next cup higher',()=>{
 const e=normalEnv('激进'),r=actualModeledConflict(e,1.64,.9375),a=e.h.controlLearningAssessment(r,'stage3');assert(a.eligible,a.reason);assert(a.outputQuality.tailErrorPct>5);assert(a.evidence.overallGS<1.5*.95);
 const q=e.h.nextShotAdaptiveSuggestion(r).s3;assert(q.actualDirectionGuard.blocked);assert.equal(q.actualDirectionGuard.direction,'no-increase');if(q.suggestedShape)assert([q.suggestedShape.earlyCommand,q.suggestedShape.midCommand,q.suggestedShape.lateCommand].every(x=>x<=.813));assert.match(q.reason,/Actual RAW/);
});
test('S3 actual low tail also vetoes a modeled downward correction',()=>{
 const e=normalEnv('激进'),r=actualModeledConflict(e,1.34,.6875),a=e.h.controlLearningAssessment(r,'stage3');assert(a.eligible,a.reason);assert(a.evidence.overallGS>1.5*1.05);const q=e.h.nextShotAdaptiveSuggestion(r).s3;assert(q.actualDirectionGuard.blocked);assert.equal(q.actualDirectionGuard.direction,'no-decrease');if(q.suggestedShape)assert([q.suggestedShape.earlyCommand,q.suggestedShape.midCommand,q.suggestedShape.lateCommand].every(x=>x>=.813));
});
test('equal S3 commands retain enabled3timed frames across upload instead of toggling shape off',async()=>{
 const e=normalEnv();e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),stages:{},s3Shape:{enabled:true,origin:'adaptive',earlyCommand:.813,earlySeconds:8,midCommand:.813,midSeconds:14,lateCommand:.813}};await e.h.syncHyperExProfile(true);
 assert(e.h.s3ShapeStatus?e.h.s3ShapeStatus().enabled:e.h.commandFlowSummary().s3Shape.enabled);assert.equal(e.h.profileObject().steps.length,5);assert.deepEqual(copy(e.h.profileObject().steps.slice(2).map(x=>+x.flow)),[.813,.813,.813]);const html=e.h.buildGhcOverlayHtml();assert.match(html,/FLAT \(3 timed frames\)/);assert.match(html,/commandModeLabel\(s3.mode,s3.origin,s3.shape\)/);
});

test('next-shot UI distinguishes actual-model conflict from an inside-band hold',()=>{const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/actualDirectionGuard/);assert.match(html,/实测与模型方向冲突，保持/);assert(!html.includes("x.action==='HOLD'?'在算法容差内，保持'"));});
function auditShape(values){return {stage3:{mode:'shape',origin:'adaptive',shape:{enabled:true,earlyCommand:values[0],midCommand:values[1],lateCommand:values[2]}}};}
test('S3 audit identifies verified application that first made three commands equal',()=>{
 const e=normalEnv(),r=historyRow(e,'change');Object.assign(r,{startedAt:'2026-10-27T10:00:00Z',commands:auditShape([.698,.72,.778]),pluginVersion:'0.1.68',nextShotApplied:{at:'2026-10-27T10:01:00Z',profileTruth:{verified:true},commandFlows:auditShape([.819,.819,.819])}});e.s.persistentHistoryFile={shots:[r]};const q=e.h.s3CommandHistoryAudit();assert.equal(q.flatTransitions.length,1);assert.equal(q.flatTransitions[0].after.runId,'change');assert.equal(q.flatTransitions[0].after.kind,'applied');assert.equal(q.earliestRetainedFlat.values[0],.819);
});
test('S3 proposals and failed applications cannot be mistaken for a historical change',()=>{
 const e=normalEnv(),r=historyRow(e,'proposal');r.commands=auditShape([.698,.72,.778]);r.adaptiveDecision={s3:{suggestedShape:auditShape([.819,.819,.819]).stage3.shape}};r.nextShotApplied={profileTruth:{verified:false},commandFlows:auditShape([.819,.819,.819])};e.s.persistentHistoryFile={shots:[r]};const q=e.h.s3CommandHistoryAudit();assert.equal(q.events.length,1);assert.equal(q.earliestRetainedFlat,null);assert.equal(q.flatTransitions.length,0);
});
test('S3 missing old snapshots reports earliest retained evidence without inventing transition',()=>{
 const e=normalEnv(),a=historyRow(e,'older'),b=historyRow(e,'missing'),c=historyRow(e,'flat');a.commands=auditShape([.698,.72,.778]);c.commands=auditShape([.813,.813,.813]);e.s.persistentHistoryFile={shots:[a,b,c]};const q=e.h.s3CommandHistoryAudit();assert.equal(q.flatTransitions.length,0);assert.equal(q.earliestRetainedFlat.runId,'flat');assert.match(q.note,/first-ever/);
});
test('S3 audit separates physical modes and retains excluded runs as forensic evidence',()=>{
 const e=normalEnv(),a=historyRow(e,'release'),b=historyRow(e,'continuous');a.commands=auditShape([.698,.72,.778]);b.commands=auditShape([.819,.819,.819]);b.fingerprint.shotSettings.activeRelease=false;b.learningReview={excluded:true};e.s.persistentHistoryFile={shots:[a,b]};const before=JSON.stringify(e.s.persistentHistoryFile),q=e.h.s3CommandHistoryAudit();assert.equal(q.flatTransitions.length,0);assert.equal(q.events[1].learningExcluded,true);assert.equal(JSON.stringify(e.s.persistentHistoryFile),before);
});
test('S3 history UI exposes saved shot snapshots and verified applications separately',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/S3 command timeline/);assert.match(html,/Verified next-shot application/);assert.match(html,/earliestRetainedFlat/);
});
test('0.819 and0.813 are the same native1over16 driver flow quantum',()=>{const e=normalEnv(),step=e.h.profileObject().steps[2];assert.equal(e.h.encodeLiveFlowFrame(step,2,.819),e.h.encodeLiveFlowFrame(step,2,.813));assert.equal(e.h.encodeLiveFlowFrame(step,2,.819),e.h.encodeLiveFlowFrame(step,2,.8125));});
const refillDefaults={basis:"pump-command",startDelayMs:0,targetPercent:160,cutoffPercent:85,maxDurationMs:4000,approachMs:200};
async function editorReady(){const e=normalEnv();await e.h.syncHyperExProfile(true);return e;}
function editedRefill(e,patch){const d=copy(e.h.curveEditorSnapshot());d.refill={...d.refill,...patch};return d;}
async function configurableRefill(patch){const e=await refillFixture();e.s.s2RefillSettings={...refillDefaults,...patch};const t=e.s.liveTrim,plan=e.h.stage2StartupPlan();t.startup={status:'armed',plan};t.run.config.s2StartupPlan=copy(plan);pulseTarget(e,plan.baseCommandMlS);return e;}
test('S2 editable defaults use160percent pump with unchanged timing and cutoff',()=>{const e=normalEnv();assert.deepEqual(copy(e.h.currentS2RefillSettings()),refillDefaults);e.s.cfg.liveFlowTrimTest=true;const p=e.h.stage2StartupPlan();assert.deepEqual(copy(p.settings),refillDefaults);assert.equal(p.startDelayMs,0);assert.equal(p.refillTargetFraction,1.6);assert.equal(p.cutoffFraction,.85);assert.equal(p.holdMs,4000);assert.equal(p.approachMs,200);});
test('S2 refill timeline reports frame, onset, return and the S2 overlap',()=>{
 const e=normalEnv(),r=startupRun(e,'timeline',1,2,4);r.events=[{name:'stage2_start',tMs:0}];r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:600,startupAction:'boost',commandMlS:2.507},{kind:'startup-boost-ended',frame:1,tMs:4000}]};
 e.s.cfg.liveFlowTrimTest=true;const tl=e.h.diagnosticSummary(r).s2RefillTimeline;
 assert(tl.onsetMs>500);assert.equal(tl.relative.onsetS,Math.round(tl.onsetMs/10)/100);assert.equal(tl.relative.returnS,4);assert(tl.overlap&&Math.abs(tl.overlap.seconds-(4000-tl.onsetMs)/1000)<.01);
});
test('cup-flow cutoff accepts50to99percent bounds',()=>{
 const e=normalEnv();assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:50}).cutoffPercent,50);assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:99}).cutoffPercent,99);assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:49}),/allowed range/);assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:100}),/allowed range/);
});
test('refill UI lists the S2/refill node timeline and overlap',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/S2 补水节点/);assert.match(html,/S2 与补水重叠/);assert.match(html,/id="refillnodes"/);assert.match(html,/data-refill-basis/);
});
test('all S2 editor boundaries and steps are validated on server',()=>{const e=normalEnv(),ranges={startDelayMs:[0,1500,50],targetPercent:[100,160,1],cutoffPercent:[50,99,1],maxDurationMs:[500,4000,100],approachMs:[200,6000,100]};for(const [key,[lo,hi,step]]of Object.entries(ranges)){for(const value of [lo,hi])assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,[key]:value})[key],value);for(const value of [lo-step,hi+step,lo+step/2,NaN,Infinity,null,'120'])assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,[key]:value}),/allowed range/,key+':'+value);}assert.throws(()=>e.h.validatedS2RefillSettings([]));});
test('configured target changes estimated refill command but retains hard limits',()=>{const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,targetPercent:140};const p=e.h.stage2StartupPlan();assert.equal(p.refillTargetGS,undefined);assert.equal(p.boostCommandMlS,3.5);assert(p.boostCommandMlS<=Math.min(8,p.baseCommandMlS*1.6));assert(p.maximumExtraCommandMl<=8);});
test('100percent refill target does not force an unnecessary extra flow quantum',()=>{const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,targetPercent:100};const p=e.h.stage2StartupPlan();assert.equal(p.enabled,false);assert.match(p.reason,/no extra command/);});
test('configurable start delay is relative to confirmed S2 frame and sends no earlier write',async()=>{const e=await configurableRefill({startDelayMs:1000}),t=e.s.liveTrim;await trimTick(e);assert.equal(rawWrites(e).length,0);e.advance(750);refillSamples(e,1);await trimTick(e);assert.equal(rawWrites(e).length,0);e.advance(250);refillSamples(e,1);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(t.startup.status,'boosting');});
test('stale/missing S2 frame cannot be treated as configured early start permission',async()=>{const e=await configurableRefill({startDelayMs:0});e.s.lastFrame=0;await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.startup.status,'armed');});
test('configured70percent cutoff returns at3.5gpersecond for5goal',async()=>{const e=await configurableRefill({cutoffPercent:70});await trimTick(e);trimAck(e);e.advance(1500);refillSamples(e,3.6);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.startupExecution.cutoff.thresholdGS,3.5);});
test('configured90percent cutoff does not return at the old85percent boundary',async()=>{const e=await configurableRefill({cutoffPercent:90});await trimTick(e);trimAck(e);e.advance(1500);refillSamples(e,4.3);await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(250);refillSamples(e,4.6);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.startupExecution.cutoff.thresholdGS,4.5);});
test('configured500ms duration has independent return timer while checks continue',async()=>{const e=await configurableRefill({maxDurationMs:500});await trimTick(e);trimAck(e);assert.equal(e.timers.get(e.s.liveTrim.startupReturnTimer).ms,500);e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);assert.equal(rawWrites(e).length,2);});
test('runtime rejects a modified frozen refill duration beyond its validated setting',async()=>{const e=await configurableRefill({});e.s.liveTrim.startup.plan.holdMs=100000;assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false);assert.equal(rawWrites(e).length,0);assert.match(e.s.liveTrim.startup.blockReason,/settings invalid/);});
test('configured cutoff does not reduce actual cup target during handover',async()=>{const e=await configurableRefill({cutoffPercent:70,approachMs:6000});await returnedRefill(e,3.6);e.advance(1700);trimSamples(e,3.5);await trimTick(e);const r=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(r.approachFraction,1);assert.equal(r.targetGS,5);assert(r.handoverProgress>0&&r.handoverProgress<1);assert.equal(r.finalTargetGS,5);});
test('changing refill controls alone saves without replacing S3 shape or changing S1 S2 origin',async()=>{const e=await editorReady(),old=copy(e.h.commandFlowSummary()),draft=editedRefill(e,{targetPercent:130,startDelayMs:250});await e.h.applyCurveEditorDraft(draft);const q=e.h.commandFlowSummary();assert.equal(q.stage1Origin,old.stage1Origin);assert.equal(q.stage2Origin,old.stage2Origin);assert.equal(q.s3Shape.enabled,old.s3Shape.enabled);for(const k of ['earlyCommand','midCommand','lateCommand','earlySeconds','midSeconds'])assert.equal(q.s3Shape[k],old.s3Shape[k]);assert.equal(e.h.currentS2RefillSettings().targetPercent,130);assert.equal(e.h.currentS2RefillSettings().startDelayMs,250);assert.equal(JSON.parse(e.storage.s2RefillSettingsV1).targetPercent,130);assert.equal(e.h.runtimeProfileTruthPayload().verified,true);});
test('user manually restored rising S3 survives refill-only apply unchanged',async()=>{const e=await editorReady();e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),stages:{},s3Shape:{enabled:true,origin:'manual',earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778}};await e.h.syncHyperExProfile(true);const before=copy(e.h.commandFlowSummary());await e.h.applyCurveEditorDraft(editedRefill(e,{targetPercent:125}));assert.deepEqual(copy(e.h.commandFlowSummary().s3Shape),before.s3Shape);assert.equal(e.h.commandFlowSummary().stage3Origin,'manual');});
test('refill settings persist across restored local state and are not part of LUT identity',async()=>{const e=await editorReady(),key=e.h.numericLearningFingerprintKey(e.h.adaptiveHistoryFingerprint());await e.h.applyCurveEditorDraft(editedRefill(e,{cutoffPercent:80,maxDurationMs:2500}));const stored=e.storage.s2RefillSettingsV1,other=normalEnv();other.event('s2RefillSettingsV1',stored);assert.equal(other.h.currentS2RefillSettings().cutoffPercent,80);assert.equal(other.h.currentS2RefillSettings().maxDurationMs,2500);assert.equal(e.h.numericLearningFingerprintKey(e.h.adaptiveHistoryFingerprint()),key);});
test('invalid or corrupt persisted refill data falls back visibly to defaults',()=>{for(const stored of ['bad-json',JSON.stringify({...refillDefaults,cutoffPercent:200}),JSON.stringify([])]){const e=normalEnv();e.event('s2RefillSettingsV1',stored);assert.deepEqual(copy(e.h.currentS2RefillSettings()),refillDefaults);assert.match(e.s.s2RefillLoadWarning,/Invalid saved/);assert.equal(e.s.s2RefillStorageLoaded,true);}});
test('old editor clients without a refill field retain current refill settings',async()=>{const e=await editorReady();e.s.s2RefillSettings={...refillDefaults,cutoffPercent:75};const d=copy(e.h.curveEditorSnapshot());delete d.refill;d.values.stage2+=.0625;await e.h.applyCurveEditorDraft(d);assert.equal(e.h.currentS2RefillSettings().cutoffPercent,75);});
test('refill-only changes participate in revision and stale drafts are rejected',async()=>{const e=await editorReady(),draft=editedRefill(e,{targetPercent:130});e.s.s2RefillSettings={...refillDefaults,startDelayMs:500};await assert.rejects(e.h.applyCurveEditorDraft(draft),/重新载入/);assert.equal(e.h.currentS2RefillSettings().targetPercent,160);});
test('refill controls cannot save during extraction or before stored settings are restored',async()=>{const e=await editorReady(),draft=editedRefill(e,{targetPercent:130});e.s.phase='stage2';await assert.rejects(e.h.applyCurveEditorDraft(draft),/空闲/);e.s.phase='idle';e.s.s2RefillStorageLoaded=false;assert.equal(e.h.curveEditorSnapshot().canApply,false);await assert.rejects(e.h.syncHyperExProfile(true),/Waiting for stored/);});
test('refill save failure rolls back curve and settings and does not claim success',async()=>{const e=setup({failRefillSave:true});e.s.cfg.adaptiveLearningLevel='正常';await e.h.syncHyperExProfile(true);const before=copy(e.h.commandFlowSummary());await assert.rejects(e.h.applyCurveEditorDraft(editedRefill(e,{targetPercent:130})),/could not be saved/);assert.deepEqual(copy(e.h.currentS2RefillSettings()),refillDefaults);assert.deepEqual(copy(e.h.commandFlowSummary().s3Shape),before.s3Shape);assert.equal(e.s.curveApplyBusy,false);});
test('profile sync failure rolls refill setting storage back to prior saved values',async()=>{const e=await editorReady();e.s.s2RefillSettings={...refillDefaults,targetPercent:125};e.storage.s2RefillSettingsV1=JSON.stringify(e.s.s2RefillSettings);const d=editedRefill(e,{targetPercent:135});d.values.stage2+=.125;e.mock.fail=(p,m)=>p==='/machine/profile'?'upload failure':null;await assert.rejects(e.h.applyCurveEditorDraft(d),/upload failure/);assert.equal(e.h.currentS2RefillSettings().targetPercent,125);assert.equal(JSON.parse(e.storage.s2RefillSettingsV1).targetPercent,125);});
test('all valid refill extremes retain pressure ACK hard command and budget guards',async()=>{const e=await configurableRefill({targetPercent:140,cutoffPercent:90,maxDurationMs:4000,approachMs:1000});e.s.lastPressure=5.5;assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false);assert.equal(rawWrites(e).length,0);e.s.lastPressure=1;await trimTick(e);assert.equal(e.s.liveTrim.report.maxWrites,200);assert.equal(e.s.liveTrim.report.maxChecks,2000);e.advance(2000);e.run(e.s.liveTrim.startupAckTimer);assert.equal(e.s.phase,'aborted');});
test('continuous mode keeps the legacy startup policy while allowing saved future refill draft',()=>{const e=normalEnv();e.s.cfg.activeRelease=false;e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,targetPercent:140};assert.notEqual(e.h.stage2StartupPlan().strategy,'refill-85');assert.equal(e.h.curveEditorSnapshot().refillActive,false);});
test('refill editor contains sliders a command preview and common apply payload',()=>{const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/id="curverefill"/);assert.match(html,/type="range"/);assert.match(html,/data-refill-key/);assert.match(html,/refillpreview/);assert.match(html,/refill:JSON.parse\(JSON.stringify\(curveDraft.refill\)\)/);assert.match(html,/JSON.stringify\(a.refill\)===JSON.stringify\(b.refill\)/);});

test('invalid refill HTTP payload cannot mutate either curve or stored settings',async()=>{
 const e=await editorReady(),d=editedRefill(e,{cutoffPercent:100}),before=JSON.stringify(e.s.testOverrides);await assert.rejects(e.h.applyCurveEditorDraft(d),/allowed range/);assert.equal(JSON.stringify(e.s.testOverrides),before);assert.equal(e.storage.s2RefillSettingsV1,undefined);
});
test('active shot keeps the frozen refill plan when next-shot local configuration changes',async()=>{
 const e=await configurableRefill({targetPercent:120}),frozen=e.s.liveTrim.startup.plan;e.s.s2RefillSettings={...refillDefaults,targetPercent:140,cutoffPercent:70};await trimTick(e);assert.equal(frozen.refillTargetFraction,1.2);assert.equal(frozen.cutoffFraction,.85);assert.equal(e.s.liveTrim.pending.command,3);
});
test('slider handler clamps and quantizes only refill draft without touching S3 points',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function curveRefillChange('),b=html.indexOf('function renderRefillEditor()',a),scope={curveDraft:{refill:copy(refillDefaults),values:{early:.698,mid:.72,late:.778}},curveLatest:{refillLimits:{targetPercent:[100,160,1],startDelayMs:[0,1500,50]}},curveBusy:false,curveDirty:false,Number,Math,curveSame(){return false;},renderCurveEditor(){}};
 vm.runInNewContext(html.slice(a,b)+';curveRefillChange("targetPercent",999);curveRefillChange("startDelayMs",123);',scope);assert.equal(scope.curveDraft.refill.targetPercent,160);assert.equal(scope.curveDraft.refill.startDelayMs,100);assert.deepEqual(scope.curveDraft.values,{early:.698,mid:.72,late:.778});assert.equal(scope.curveDirty,true);
});
test('restoring refill defaults does not reset current S3 or learning levels',async()=>{
 const e=await editorReady();e.s.s2RefillSettings={...refillDefaults,targetPercent:140};const d=editedRefill(e,refillDefaults),level=e.s.cfg.adaptiveLearningLevel,before=copy(d.values);await e.h.applyCurveEditorDraft(d);assert.deepEqual(copy(e.h.currentS2RefillSettings()),refillDefaults);assert.deepEqual(copy(e.h.curveEditorSnapshot().values),before);assert.equal(e.s.cfg.adaptiveLearningLevel,level);
});
test('refill slider labels translate consistently in both UI languages',()=>{const e=normalEnv();for(const [zh,en] of [['S2 提前补水','S2 early refill'],['启动延时','Start delay'],['基础泵流量倍率','Base pump flow multiplier'],['称流速收回阈值','Cup-flow cutoff'],['最长补水','Maximum refill duration'],['渐进至100%时间','Approach100% duration']]){assert.equal(e.h.translateUiText(zh,'en'),en);assert.equal(e.h.translateUiText(en,'zh'),zh);}});
function numericCurveUi(){
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function curveLimits('),b=html.indexOf('const refillControlFields',a),elements={};
 const values={stage1:.719,stage2:2.507,early:.813,mid:.813,late:.813,earlySeconds:8,midSeconds:14};
 const scope={curveDraft:{shaped:true,values:copy(values)},curveLatest:{shaped:true,values:copy(values)},curveSelected:2,curveKeys:['stage1','stage2','early','mid','late'],curveBusy:false,curveDirty:false,curveInputInvalid:false,Number,Math,JSON,curveSame(a,b){return JSON.stringify(a)===JSON.stringify(b);},renderCurveEditor(){},$(id){return elements[id]||(elements[id]={textContent:'',disabled:false,setCustomValidity(s){this.validityMessage=s;}});}};
 vm.createContext(scope);vm.runInContext(html.slice(a,b),scope);return {scope,elements,run:code=>vm.runInContext(code,scope)};
}
test('curve numeric entry can restore exact0.6980.7200.778 ramp without snapping to native steps',()=>{
 const x=numericCurveUi();x.run('curveSelected=2;curveEnterValue("0.698");curveSelected=3;curveEnterValue("0.720");curveSelected=4;curveEnterValue("0.778");');assert.deepEqual(copy(x.scope.curveDraft.values),{stage1:.719,stage2:2.507,early:.698,mid:.72,late:.778,earlySeconds:8,midSeconds:14});assert.equal(x.scope.curveInputInvalid,false);assert.equal(x.scope.curveDirty,true);
});
test('fine dragging keeps0.701 draft while actual driver remains native1over16',()=>{
 const x=numericCurveUi();x.run('curveSelected=2;curveSetValue(.701);');assert.equal(x.scope.curveDraft.values.early,.701);assert.equal(Math.round(x.scope.curveDraft.values.early*16)/16,.6875);
});
test('numeric curve out-of-range or invalid entry is rejected without mutating draft',()=>{
 for(const raw of ['8.1','-1','','NaN']){const x=numericCurveUi(),before=JSON.stringify(x.scope.curveDraft);x.scope.raw=raw;x.run('curveSelected=1;curveEnterValue(raw);');assert.equal(JSON.stringify(x.scope.curveDraft),before);assert.equal(x.scope.curveInputInvalid,true);assert.equal(x.elements.curveapply.disabled,true);}
});
test('numeric curve entry retains S3 ordering and rejects an early point above middle',()=>{
 const x=numericCurveUi();x.run('curveSelected=2;curveEnterValue("0.900");');assert.equal(x.scope.curveDraft.values.early,.813);assert.equal(x.scope.curveInputInvalid,true);x.run('curveEnterValue("0.698");');assert.equal(x.scope.curveInputInvalid,false);
});
test('one-step nudge moves one actual quantum even when draft is a nonnative decimal',()=>{
 const x=numericCurveUi();x.run('curveSelected=0;curveDraft.values.stage1=.698;curveNudge(-1);');assert.equal(Math.round(x.scope.curveDraft.values.stage1*16),10);x.run('curveNudge(1);');assert.equal(Math.round(x.scope.curveDraft.values.stage1*16),11);
});
test('native nudge stops at hard lower boundary rather than appearing to change same driver step',()=>{
 const x=numericCurveUi();x.run('curveSelected=0;curveDraft.values.stage1=.125;curveNudge(-1);');assert.equal(x.scope.curveDraft.values.stage1,.125);
});
test('numeric curve input and driver-quantum readout are available alongside step buttons',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/id="curvevalue" type="number"/);assert.match(html,/inputmode="decimal"/);assert.match(html,/id="curvequantum"/);assert.match(html,/curveInput.onchange/);assert.match(html,/curveInputInvalid\|\|curveBusy/);
});
test('large base pump refill exceeds former plus2 ceiling while respecting160percent',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:4,desiredGS:5,origin:'manual'}}};const p=e.h.stage2StartupPlan();assert.equal(p.baseCommandMlS,4);assert.equal(p.boostCommandMlS,6.375);assert(p.boostCommandMlS>p.baseCommandMlS+2);assert.equal(p.maximumExtraCommandMl,9.5);
});
test('high base pump refill clamps to hard8 rather than adding2 or assigning cup units',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:6,desiredGS:5,origin:'manual'}}};const p=e.h.stage2StartupPlan();assert.equal(p.requestedCommandMlS,9.6);assert.equal(p.boostCommandMlS,8);assert.equal(p.commandLimited,true);
});
test('legacy cup-percent settings migrate only multiplier retaining cutoff and time',()=>{
 const e=normalEnv(),old={startDelayMs:350,targetPercent:125,cutoffPercent:80,maxDurationMs:2500,approachMs:5000};e.event('s2RefillSettingsV1',JSON.stringify(old));const r=e.h.currentS2RefillSettings();assert.equal(r.basis,'pump-command');assert.equal(r.targetPercent,160);for(const k of ['startDelayMs','cutoffPercent','maxDurationMs','approachMs'])assert.equal(r[k],old[k]);assert.match(e.s.s2RefillLoadWarning,/migrated/);
});
test('new pump-percent settings retain user choice across reload rather than remigrate',()=>{
 const e=normalEnv();e.event('s2RefillSettingsV1',JSON.stringify({...refillDefaults,targetPercent:135}));assert.equal(e.h.currentS2RefillSettings().targetPercent,135);assert.equal(e.s.s2RefillLoadWarning,null);assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,basis:'cup-target'}).basis,'cup-target');assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,basis:'legacy-cup-target'}),/basis invalid/);
});
test('old editor refill with no basis cannot silently apply old cup-percent semantics',async()=>{
 const e=await editorReady(),d=editedRefill(e,{targetPercent:130});delete d.refill.basis;await assert.rejects(e.h.applyCurveEditorDraft(d),/basis changed/);assert.equal(e.h.currentS2RefillSettings().targetPercent,160);
});
test('reset-to-default refill snapshot remains valid for new pump-basis server',async()=>{
 const e=await editorReady();e.s.s2RefillSettings={...refillDefaults,targetPercent:130};const d=copy(e.h.curveEditorSnapshot());d.refill=copy(d.refillDefaults);await e.h.applyCurveEditorDraft(d);assert.equal(e.h.currentS2RefillSettings().targetPercent,160);assert.equal(JSON.parse(e.storage.s2RefillSettingsV1).basis,'pump-command');
});
test('dispatch enforces configured pump multiplier even below global160percent cap',async()=>{
 const e=await configurableRefill({targetPercent:120});e.s.liveTrim.startup.plan.boostCommandMlS=3.5;assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false);assert.equal(rawWrites(e).length,0);assert.match(e.s.liveTrim.startup.blockReason,/settings invalid/);
});
test('pump refill cannot run during machine heating or mixing stabilization',async()=>{
 for(const substate of ['heating','final heating','stabilising','StabilizeMixTemp']){const e=await configurableRefill({});e.s.lastSubstate=substate;assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false);assert.equal(rawWrites(e).length,0);assert.match(e.s.liveTrim.startup.blockReason,/fresh machine feedback/);}
});
test('only refill amplitude uses pump ratio and original phase cup targets and temperatures remain',()=>{
 const e=normalEnv(),before=copy(e.h.profileObject());e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,targetPercent:160};const after=copy(e.h.profileObject());assert.deepEqual(after,before);assert.deepEqual([e.s.cfg.stage1Flow,e.s.cfg.stage2Flow,e.s.cfg.stage3Flow],[2,5,1.5]);const p=e.h.stage2StartupPlan();assert.equal(p.cutoffFraction,.85);assert.equal(p.holdMs,4000);
});
test('refill frontend uses pump multiplier preview and labels gpersecond only for cup cutoff',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/request=refillBase\*r.targetPercent\/100/);assert.match(html,/基础泵流量倍率/);assert.doesNotMatch(html,/baseCommand\+2|goal\*r.targetPercent\/100/);assert.equal(e.h.translateUiText('基础泵流量倍率','en'),'Base pump flow multiplier');assert.equal(e.h.curveEditorSnapshot().refillLimits.targetPercent[1],160);
});

test('driver dispatch accepts greater-than-plus2 pump boost and returns original base',async()=>{
 const e=await refillFixture();e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:4,desiredGS:5,origin:'manual'}}};const t=e.s.liveTrim;t.profile.steps[1].flow='4.000';t.commands[1]=4;t.startup={status:'armed',plan:e.h.stage2StartupPlan()};assert.equal(await e.h.dispatchS2Startup(t,'boost'),true);assert.equal(t.pending.command,6.375);const payload=JSON.parse(rawWrites(e)[0].payload.data).payload;assert.equal(parseInt(payload.slice(4,6),16)/16,6.375);trimAck(e);e.advance(1500);refillSamples(e,4.3);assert.equal(await e.h.dispatchS2Startup(t,'return'),true);assert.equal(t.pending.command,4);
});
test('rendered pump preview matches server command while cutoff stays4point25gpersecond',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function renderRefillEditor()'),b=html.indexOf('function renderCurveEditor(',a),elements={},inputs={};
 const get=id=>elements[id]||(elements[id]={textContent:'',innerHTML:'',disabled:false});
 const box=get('curverefill');box.querySelector=q=>inputs[q]||(inputs[q]={});
 const scope={$:get,curveDraft:{refill:copy(refillDefaults),values:{stage2:4}},curveLatest:{targetGS:{stage2:5},refillLimits:{targetPercent:[100,160,1]},canApply:true,refillActive:true},curveBusy:false,renderRefillHistory(){},refillControlFields:[['startDelayMs','启动延时','s'],['targetPercent','基础泵流量倍率','%'],['cutoffPercent','称流速收回阈值','%'],['maxDurationMs','最长补水','s'],['approachMs','渐进至100%时间','s']],Math,Number};
 vm.runInNewContext(html.slice(a,b)+';renderRefillEditor();',scope);assert.equal(get('refillvalue-targetPercent').textContent,'160% · 6.3750 ml/s');assert.equal(get('refillvalue-cutoffPercent').textContent,'85% · 4.25 g/s');assert.match(get('refillpreview').innerHTML,/6.3750 ml\/s · 160% 基础泵流量/);assert.doesNotMatch(get('refillpreview').innerHTML,/估算补水目标/);
});

function chartUiFixture(){
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function extractionChartRows('),b=html.indexOf('\nfunction renderNextDecision(',a),elements={};
 const scope={Math,Number,NaN,String,esc:String,lastChartRun:null,flowSeriesVisible:{cup:true,target:true,machine:true,decaid:true,raw:true,writes:true},$:id=>elements[id]||(elements[id]={innerHTML:''})};
 vm.runInNewContext(html.slice(a,b),scope);return {e,html,scope,elements};
}
function chartReleaseRun(){
 const rows=[['stage1',0,1],['stage1',1000,1],['dumping',2000,4],['soak',3000,0],['restart_wait',4000,0],['stage2',5000,4],['stage2',6000,4],['stage3',7000,.8],['stage3',8000,.8],['finishing',9000,4],['finishing',10000,0]];
 const samples=rows.map(([phase,tMs,flow])=>({phase,tMs,machineState:['stage1','stage2','stage3'].includes(phase)?'espresso':'idle',substate:['stage1','stage2','stage3'].includes(phase)?'pouring':'flush',targetFlowMlS:flow,machineFlowMlS:flow,decaidWeightFlowGS:1.5,desiredRealFlowGS:phase==='stage1'?2:phase==='stage2'?5:1.5}));
 const rawScaleSamples=rows.map(([phase,tMs])=>({phase,tMs,weightG:tMs/1000,scaleTimestampSeconds:tMs/1000}));
 return {kind:'hyperex',config:{activeRelease:true},samples,rawScaleSamples,events:[{name:'stage1_weight_trigger',tMs:1100},{name:'stage2_start',tMs:5000},{name:'final_weight_trigger',tMs:8500}],liveFlowTrim:{trace:[{kind:'write',frame:0,tMs:500,previousMlS:.7,commandMlS:.8},{kind:'machine-target-response',frame:0,tMs:2000,commandMlS:4},{kind:'write',frame:1,tMs:5500,previousMlS:2.5,commandMlS:4},{kind:'write',frame:2,tMs:7500,previousMlS:.8,commandMlS:.75},{kind:'machine-target-response',frame:2,tMs:9000,commandMlS:4}]}};
}
test('extraction chart removes both release spikes and finalization tail while retaining active data',()=>{
 const {scope}=chartUiFixture(),run=chartReleaseRun(),view=scope.extractionChartData(run);assert.deepEqual(copy(view.combined).map(x=>x.tMs),[0,1000,5000,6000,7000,8000]);assert.deepEqual(copy(view.raw).map(x=>x.tMs),[0,1000,5000,6000,7000,8000]);assert.deepEqual(copy(view.trace).map(x=>x.tMs),[500,5500,7500]);assert.equal(Math.max(...view.combined.map(x=>x.machineFlowMlS)),4);
});
test('chart stop events clip late mislabelled active-phase samples without deleting records',()=>{
 const {scope}=chartUiFixture(),run=chartReleaseRun();run.samples[2].phase='stage1';run.samples[2].machineState='espresso';run.samples[2].substate='pouring';run.samples[9].phase='stage3';run.samples[9].machineState='espresso';run.samples[9].substate='pouring';run.rawScaleSamples[2].phase='stage1';run.rawScaleSamples[9].phase='stage3';const original=JSON.stringify(run);const view=scope.extractionChartData(run);assert(!view.combined.some(x=>[2000,9000].includes(x.tMs)));assert(!view.raw.some(x=>[2000,9000].includes(x.tMs)));assert.equal(JSON.stringify(run),original);
});
test('SVG paths break across release and restart instead of bridging unrelated runs',()=>{
 const {scope}=chartUiFixture(),view=scope.extractionChartData(chartReleaseRun()),points=scope.extractionChartPoints(view.combined,'machineFlowMlS'),path=scope.svgPath(points,0,8,0,6);assert.equal((path.match(/M /g)||[]).length,1);assert.equal(points.filter(x=>Number.isNaN(x[1])).length,0);assert(points.some(p=>p[0]===1&&p[1]===0));assert(points.some(p=>p[0]===5&&p[1]===0));
});
test('continuous mode retains one connected S1-S2-S3 chart without a false release gap',()=>{
 const {scope}=chartUiFixture(),run=chartReleaseRun();run.config.activeRelease=false;run.samples=run.samples.filter(x=>['stage1','stage2','stage3'].includes(x.phase));run.rawScaleSamples=run.rawScaleSamples.filter(x=>['stage1','stage2','stage3'].includes(x.phase));run.events=run.events.filter(x=>x.name!=='stage1_weight_trigger');const data=scope.extractionChartData(run),path=scope.svgPath(scope.extractionChartPoints(data.combined,'machineFlowMlS'),0,8,0,6);assert.equal((path.match(/M /g)||[]).length,1);assert.equal(data.combined.length,6);
});
test('old saved shots without stop events still hide inactive phases and keep RAW originals',()=>{
 const {scope}=chartUiFixture(),run=chartReleaseRun();delete run.events;const view=scope.extractionChartData(run);assert.equal(view.combined.length,6);assert.equal(view.raw.length,6);assert.equal(run.samples.length,11);assert.equal(run.rawScaleSamples.length,11);
});
test('calibration charts keep their full original phases without espresso clipping',()=>{
 const {scope}=chartUiFixture(),run=chartReleaseRun();run.kind='calibration';run.events=[];const view=scope.extractionChartData(run);assert.equal(view.combined.length,11);assert.equal(view.raw.length,11);
});
test('pre-flow heating and release telemetry cannot masquerade as brewing despite active phase tag',()=>{
 const {scope}=chartUiFixture(),run=chartReleaseRun();run.samples[0].substate='stabilising';run.samples[7].substate='flush';const view=scope.extractionChartData(run);assert(!view.combined.some(x=>[0,7000].includes(x.tMs)));assert(view.combined.some(x=>x.tMs===8000));
});
test('daily render excludes release geometry and does not regress raw slope across restart',()=>{
 const {scope}=chartUiFixture(),run=chartReleaseRun(),charts=[];scope.renderChart=(svg,series,min,max,markers)=>charts.push({series,min,max,markers});scope.renderCharts(run);assert.equal(charts.length,2);const flow=charts[0];assert(flow.series.every(s=>s.points.every(p=>p[0]<=8)));assert(flow.markers.every(x=>x.x<=8));const slopes=flow.series.find(s=>s.key==='raw').points;assert(slopes.some(p=>p[0]===5&&p[1]===0));assert(slopes.filter(p=>Number.isFinite(p[1])).every(p=>p[1]===1||p[1]===0));assert.equal(scope.lastChartRun,run);
});
test('invalid chart values never become zero-flow samples and all-invalid SVG clears safely',()=>{
 const {scope,elements}=chartUiFixture();const points=scope.extractionChartPoints([{tMs:0,_chartSegment:0,machineFlowMlS:null}],'machineFlowMlS');assert(Number.isNaN(points[0][1]));const svg={innerHTML:'old'};scope.renderChart(svg,[{points}],0,6,[]);assert.equal(svg.innerHTML,'');
});
test('empty extraction after prior render clears weight chart instead of showing previous cup',()=>{
 const {scope,elements}=chartUiFixture();scope.renderCharts(chartReleaseRun());assert(elements.weightchart.innerHTML);scope.renderCharts({kind:'hyperex',samples:[{phase:'finishing',tMs:9000}],rawScaleSamples:[{phase:'finishing',tMs:9000,weightG:100}]});assert.equal(elements.weightchart.innerHTML,'');assert.equal(elements.flowchart.innerHTML,'');
});
test('display filtering leaves complete CSV and all source data unchanged for diagnosis',()=>{
 const {e,scope}=chartUiFixture(),run=chartReleaseRun(),before=e.h.diagnosticCsv(run),json=JSON.stringify(run);scope.renderCharts(run);assert.equal(e.h.diagnosticCsv(run),before);assert.equal(JSON.stringify(run),json);assert.match(before,/dumping/);assert.match(before,/finishing/);
});
test('S2 return marker records actual duration cause rather than assuming85percent cutoff',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(4000);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);const write=e.s.liveTrim.report.trace.filter(x=>x.kind==='write').slice(-1)[0];assert.equal(write.startupAction,'return');assert.match(write.startupReason,/maximum duration/);const {scope}=chartUiFixture(),markers=scope.liveTrimMarkers(e.s.liveTrim.run);assert(markers.some(x=>/maximum duration/.test(x.label)&&/补水收回/.test(x.label)));
});
test('next-shot S2 startup UI labels pump ratio without inventing an estimated cup target',()=>{
 const {html}=chartUiFixture();assert.doesNotMatch(html,/g\/s estimated fill target/);assert.match(html,/base pump flow/);assert.match(html,/萃取图在停止萃取处结束/);
});

test('refill edit keeps prior and applied settings persisted across restart',async()=>{
 const e=await editorReady();await e.h.applyCurveEditorDraft(editedRefill(e,{targetPercent:140,startDelayMs:200,maxDurationMs:3000,approachMs:2000}));const snapshot=e.h.curveEditorSnapshot(),record=snapshot.refillPrevious;assert.equal(record.before.targetPercent,160);assert.equal(record.after.targetPercent,140);assert.equal(record.after.startDelayMs,200);const stored=JSON.parse(e.storage.s2RefillSettingsV1);assert.deepEqual(copy(stored.previousChange),copy(record));const other=normalEnv();other.event('s2RefillSettingsV1',e.storage.s2RefillSettingsV1);assert.deepEqual(copy(other.h.curveEditorSnapshot().refillPrevious),copy(record));assert.equal(other.h.currentS2RefillSettings().approachMs,2000);
});
test('next refill edit advances previous values while a curve-only edit preserves refill history',async()=>{
 const e=await editorReady();await e.h.applyCurveEditorDraft(editedRefill(e,{targetPercent:140}));e.advance(1000);await e.h.applyCurveEditorDraft(editedRefill(e,{targetPercent:150,cutoffPercent:80}));const record=copy(e.h.curveEditorSnapshot().refillPrevious);assert.equal(record.before.targetPercent,140);assert.equal(record.after.targetPercent,150);const draft=copy(e.h.curveEditorSnapshot());draft.values.stage2+=.0625;await e.h.applyCurveEditorDraft(draft);assert.deepEqual(copy(e.h.curveEditorSnapshot().refillPrevious),record);
});
test('failed curve upload rolls both refill settings and prior-change record back',async()=>{
 const e=await editorReady();await e.h.applyCurveEditorDraft(editedRefill(e,{targetPercent:140}));const before=copy(e.h.curveEditorSnapshot().refillPrevious),d=editedRefill(e,{targetPercent:150});d.values.stage2+=.0625;e.mock.fail=(p,m)=>p==='/machine/profile'?'upload failure':null;await assert.rejects(e.h.applyCurveEditorDraft(d),/upload failure/);assert.deepEqual(copy(e.h.curveEditorSnapshot().refillPrevious),before);assert.deepEqual(copy(JSON.parse(e.storage.s2RefillSettingsV1).previousChange),before);assert.equal(e.h.currentS2RefillSettings().targetPercent,140);
});
test('corrupt prior-change metadata does not discard valid current refill settings',()=>{
 const e=normalEnv();e.event('s2RefillSettingsV1',JSON.stringify({...refillDefaults,targetPercent:140,previousChange:{at:'not-a-date',before:{},after:{}}}));assert.equal(e.h.currentS2RefillSettings().targetPercent,140);assert.equal(e.h.curveEditorSnapshot().refillPrevious,null);assert.equal(e.s.s2RefillLoadWarning,null);
});
test('last-shot window uses frozen executed settings instead of current sliders',()=>{
 const e=normalEnv(),settings={...refillDefaults,targetPercent:130,cutoffPercent:80};e.s.diagnosticLast={kind:'hyperex',runId:'old-cup',config:{s2StartupPlan:{settings,baseCommandMlS:4,boostCommandMlS:5.1875}},liveFlowTrim:{trace:[{kind:'write',startupAction:'boost',commandMlS:5.1875}],startupExecution:{status:'complete',reason:'maximum duration'}}};e.s.s2RefillSettings={...refillDefaults,targetPercent:160};const last=e.h.curveEditorSnapshot().refillLastShot;assert.equal(last.settings.targetPercent,130);assert.equal(last.settings.cutoffPercent,80);assert.equal(last.executedBoostMlS,5.1875);assert.equal(last.basis,'pump-command');assert.equal(e.h.curveEditorSnapshot().refill.targetPercent,160);
});
test('last-shot refill survives persisted shot history without inventing an executed boost',()=>{
 const e=normalEnv();e.s.persistentHistoryFile={shots:[{runId:'saved-cup',liveFlowTrim:{s2StartupPlan:{settings:{...refillDefaults,targetPercent:145},baseCommandMlS:4,boostCommandMlS:5.75},trace:[],startupExecution:{status:'skipped'}}}]};const last=e.h.curveEditorSnapshot().refillLastShot;assert.equal(last.runId,'saved-cup');assert.equal(last.settings.targetPercent,145);assert.equal(last.executedBoostMlS,null);assert.equal(last.plannedBoostMlS,5.75);
});
test('old cup-percent plans are labelled legacy rather than recast as pump percentages',()=>{
 const e=normalEnv();e.s.diagnosticLast={kind:'hyperex',runId:'1.71',config:{s2StartupPlan:{settings:{targetPercent:140,startDelayMs:0,cutoffPercent:85,maxDurationMs:4000,approachMs:2000},baseCommandMlS:3.8,boostCommandMlS:5.5}}};const last=e.h.curveEditorSnapshot().refillLastShot;assert.equal(last.basis,'legacy-cup-target');assert.equal(last.settings.targetPercent,140);assert.equal(last.executedBoostMlS,null);
});
test('refill history UI separates draft saved previous edit and prior cup while retaining sliders',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function refillSettingsText('),b=html.indexOf('function renderRefillEditor()',a),box={innerHTML:''};const scope={esc:String,$:()=>box,curveLatest:{refill:{...refillDefaults,targetPercent:150},refillPrevious:{at:'2026-10-28T00:00:00Z',before:{...refillDefaults,targetPercent:140},after:{...refillDefaults,targetPercent:150}},refillLastShot:{available:true,runId:'previous-cup',settings:{...refillDefaults,targetPercent:130},basis:'pump-command',baseCommandMlS:4,plannedBoostMlS:5.1875,executedBoostMlS:5.1875}},curveDraft:{refill:{...refillDefaults,targetPercent:160}}};vm.runInNewContext(html.slice(a,b)+';renderRefillHistory();',scope);assert.match(box.innerHTML,/当前已保存/);assert.match(box.innerHTML,/上次修改前 → 修改后/);assert.match(box.innerHTML,/140%/);assert.match(box.innerHTML,/150%/);assert.match(box.innerHTML,/130%/);assert.doesNotMatch(box.innerHTML,/160%/);assert.match(html,/data-refill-key/);assert.match(html,/id="refillprevious"/);
});

function delayedCupRun(e,delay=10,flow=5,duration=12){
 const r=evidenceRun(e,'delayed');r.config={...r.config,stage2Flow:5,stage2CommandMlS:2.507,stage2PressureLimit:6};r.events=[{name:'stage2_start',tMs:0}];
 for(let i=0;i<=Math.round((delay+duration)*10);i++){const t=i/10,w=Math.max(0,t-delay)*flow;r.rawScaleSamples.push({phase:'stage2',profileFrame:1,tMs:i*100,scaleTimestampSeconds:100+t,weightG:w});r.samples.push({phase:'stage2',profileFrame:1,tMs:i*100,machineTelemetryValid:true,machineAgeMs:0,pressureBar:1,machineFlowMlS:2.5,targetFlowMlS:2.5,scaleFlowGS:t<delay?0:flow});}
 return r;
}
test('S2 delayed outflow validates5gpersecond without counting10seconds of dry wait',()=>{
 const e=normalEnv(),r=delayedCupRun(e),before=JSON.stringify(r.rawScaleSamples),onset=e.h.stage2CupOnset(r),p=e.h.diagnosticPhaseSummary(r,'stage2');assert(onset.detected);assert(Math.abs(onset.startMs-10000)<=100);assert.equal(p.validationStatus,'HIT');assert.equal(p.rawRegressionGS,5);assert(p.rawRegressionSeconds<=12.1);assert.equal(JSON.stringify(r.rawScaleSamples),before);
});
test('S2 outflow confidence and error are invariant to dry-start delay length',()=>{
 const e=normalEnv(),a=e.h.diagnosticPhaseSummary(delayedCupRun(e,2,4.5),'stage2'),b=e.h.diagnosticPhaseSummary(delayedCupRun(e,20,4.5),'stage2');assert.equal(a.rawRegressionGS,b.rawRegressionGS);assert.equal(a.rawRegressionR2,b.rawRegressionR2);assert.equal(a.rawErrorPct,b.rawErrorPct);assert(Math.abs(a.rawRegressionSeconds-b.rawRegressionSeconds)<.11);
});
test('no cup outflow produces no S2 acceptance or learning even when pump flow exists',()=>{
 const e=normalEnv(),r=delayedCupRun(e,30,0);assert.equal(e.h.stage2CupOnset(r).detected,false);assert.equal(e.h.diagnosticRawRegression(r,'stage2'),null);assert.equal(e.h.stage2AdaptiveEvidence(r),null);assert.equal(e.h.diagnosticPhaseSummary(r,'stage2'),null);
});
test('single weight glitch duplicate times or bounded idle jitter cannot start S2 confidence window',()=>{
 const e=normalEnv();for(const kind of ['glitch','duplicate','jitter']){const r=delayedCupRun(e,20,0);r.rawScaleSamples.forEach((x,i)=>{x.weightG=kind==='glitch'?(i===50?.5:0):kind==='jitter'?.08*Math.sin(i*1.7):i*.5;if(kind==='duplicate')x.scaleTimestampSeconds=100;});assert.equal(e.h.stage2CupOnset(r).detected,false,kind);}
});
test('real slow cup outflow is still evaluated as a miss rather than waiting for target-level flow',()=>{
 const e=normalEnv(),r=delayedCupRun(e,5,.2,20),onset=e.h.stage2CupOnset(r),p=e.h.diagnosticPhaseSummary(r,'stage2');assert(onset.detected);assert(onset.startMs>=4900&&onset.startMs<=5100);assert.equal(p.rawRegressionGS,.2);assert.equal(p.validationStatus,'MISS');
});
test('tare reset restarts S2 outflow admission and cannot reuse an earlier rise',()=>{
 const e=normalEnv(),r=delayedCupRun(e,0,5,5);for(let i=51;i<=100;i++)r.rawScaleSamples.push({phase:'stage2',profileFrame:1,tMs:i*100,scaleTimestampSeconds:100+i/10,weightG:0,tareReset:i===51});assert.equal(e.h.stage2CupOnset(r).detected,false);assert.equal(e.h.phaseRawSamples(r,'stage2').length,0);
});
test('S2 live-learning temporal coverage excludes dry prefix rather than diluting confidence',()=>{
 const e=normalEnv(),r=controlledRun(e,'wet-coverage');const originals=r.rawScaleSamples.filter(x=>x.phase==='stage2'),start=originals[0].tMs,shift=15000;r.rawScaleSamples.forEach(x=>{if(x.phase==='stage2'){x.tMs+=shift;x.scaleTimestampSeconds+=15;}});r.samples.forEach(x=>{if(x.phase==='stage2')x.tMs+=shift;});r.liveFlowTrim.trace.forEach(x=>{if(Number(x.frame)===1)x.tMs+=shift;});const baseWeight=originals[0].weightG,baseStamp=originals[0].scaleTimestampSeconds-15;for(let i=0;i<150;i++)r.rawScaleSamples.push({phase:'stage2',profileFrame:1,tMs:start+i*100,scaleTimestampSeconds:baseStamp+i*.1,weightG:baseWeight});r.rawScaleSamples.sort((a,b)=>a.tMs-b.tMs);const q=e.h.controlLearningAssessment(r,'stage2');assert(q.cupFlowOnset&&q.cupFlowOnset.startMs>=start+shift-100);assert(q.actuator.eligible,q.reason);assert(q.eligible,q.reason);
});
test('refill target echo hands control over after50ms rather than another1600ms blind wait',async()=>{
 const e=await refillFixture();await returnedRefill(e);assert.equal(e.s.liveTrim.startup.resumeAt-e.now(),50);assert.equal(e.s.liveTrim.startup.approachAt,e.s.liveTrim.startup.resumeAt);
});
test('S2 handover below5gpersecond never lowers pump command merely because flow exceeds85percent',async()=>{
 const e=await refillFixture();await returnedRefill(e);e.advance(800);trimSamples(e,4.6);await trimTick(e);const row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(row.targetGS,5);assert(e.s.liveTrim.pending);assert(e.s.liveTrim.pending.command>2.5);
});
test('falling delayed RAW estimate does not trigger an extra down-write during handover',async()=>{
 const e=await refillFixture();await returnedRefill(e);trimAck(e);e.advance(100);trimSamples(e,5.4);const t=e.s.liveTrim;t.startup.lastEstimate={slope:6,stamp:100+ (e.now()-t.run.startedAtMs)/1000-.2};const before=rawWrites(e).length;await trimTick(e);const row=t.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(rawWrites(e).length,before);assert.match(row.reason,/falling response/);
});
test('handover pacing expires so750ms upward spacing does not restrict the rest of S2',async()=>{
 const e=await refillFixture();await returnedRefill(e);e.advance(4000);trimSamples(e,4.4);await trimTick(e);assert(e.s.liveTrim.pending);const cmd=e.s.liveTrim.pending.command;trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.8});e.advance(250);trimSamples(e,4.4);await trimTick(e);const row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(row.handoverActive,false);assert.notEqual(row.reason,'S2 approach upward-write spacing');
});
test('settled reliable prior cup can seed a bounded holding command without rescaling160percent boost',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;const r=startupRun(e,'holding-reference',1,2,4);e.s.diagnosticLast=r;const p=e.h.stage2StartupPlan();assert.equal(p.boostCommandMlS,4);assert(p.returnCommandMlS>p.baseCommandMlS);assert(p.returnCommandMlS<=p.baseCommandMlS*1.2);assert.equal(p.holdingReference.sourceRunId,'holding-reference');
});
test('excluded bad-pressure or stale priors never raise the S2 holding command',()=>{
 for(const kind of ['excluded','pressure','stale']){const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;const r=startupRun(e,'bad-hold',1,2,4);if(kind==='excluded')r.learningReview={excluded:true};if(kind==='pressure')r.samples.forEach(x=>x.pressureBar=5.8);if(kind==='stale')r.samples.forEach(x=>x.machineAgeMs=10000);e.s.diagnosticLast=r;const p=e.h.stage2StartupPlan();assert.equal(p.returnCommandMlS,p.baseCommandMlS,kind);}
});
test('holding return is within normal trim envelope while pressure protection returns original base',async()=>{
 for(const protective of [false,true]){const e=await refillFixture(),t=e.s.liveTrim;t.startup.plan.returnCommandMlS=2.75;await trimTick(e);trimAck(e);t.startup.returnReason=protective?'S2 refill pressure margin reached':'S2 refill reached configured cup-flow cutoff';assert.equal(await e.h.dispatchS2Startup(t,'return'),true);assert.equal(t.pending.command,protective?2.5:2.75);}
});
test('tampered holding value cannot exceed normal20percent command envelope on return',async()=>{
 const e=await refillFixture(),t=e.s.liveTrim;t.startup.plan.returnCommandMlS=3.5;await trimTick(e);trimAck(e);t.startup.returnReason='cutoff';assert.equal(await e.h.dispatchS2Startup(t,'return'),false);assert.equal(rawWrites(e).length,1);
});

test('after onset later low flow or stall remains in S2 evaluation instead of cherry-picking good flow',()=>{
 const e=normalEnv(),r=delayedCupRun(e,2,5,14);r.rawScaleSamples.forEach(x=>{if(x.tMs>8000)x.weightG=30;});const onset=e.h.stage2CupOnset(r),p=e.h.diagnosticPhaseSummary(r,'stage2');assert(onset.detected);assert.equal(e.h.phaseRawSamples(r,'stage2').slice(-1)[0].tMs,16000);assert(p.rawRegressionGS<3);assert.equal(p.validationStatus,'MISS');
});
test('genuinely sustained oversupply can still down-trim during handover with no falling trend',async()=>{
 const e=await refillFixture();await returnedRefill(e);e.advance(800);trimSamples(e,5.8);e.s.liveTrim.startup.lastEstimate={slope:5.8,stamp:100+(e.now()-e.s.liveTrim.run.startedAtMs)/1000-.2};await trimTick(e);assert(e.s.liveTrim.pending);assert(e.s.liveTrim.pending.command<2.5);
});
test('partial holding reference never increases by more than20percent or exceeds the boost command',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;for(const plateau of [2.6,3,4,5,6]){e.s.diagnosticLast=startupRun(e,'reference-'+plateau,1,2,plateau);const p=e.h.stage2StartupPlan();assert(p.returnCommandMlS>=p.baseCommandMlS);assert(p.returnCommandMlS<=p.baseCommandMlS*1.2+1e-9);assert(p.returnCommandMlS<=p.boostCommandMlS);assert.equal(p.returnCommandMlS*16,Math.round(p.returnCommandMlS*16));}
});

test('S2 UI exposes effective outflow origin and full-target handover instead of an85percent target ramp',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/S2有效称流起点/);assert.match(html,/出液前等待/);assert.match(html,/接管渐进时间/);assert.equal(e.h.translateUiText('接管渐进时间','en'),'Control handover duration');
});

test('brief6gpersecond startup peak followed by steady5 remains valid S2 learning evidence',()=>{
 const e=normalEnv(),r=delayedCupRun(e,2,5,18);r.rawScaleSamples.forEach(x=>{const t=x.tMs/1000;x.weightG=t<=2?0:t<=3?(t-2)*6:6+(t-3)*5;});const p=e.h.diagnosticPhaseSummary(r,'stage2'),evidence=e.h.stage2AdaptiveEvidence(r);assert.equal(p.validationStatus,'HIT');assert(evidence);assert.equal(evidence.measured,5);
});


test('independent refill save persists 1.5s and preserves profile overrides and LUT',async()=>{
 const e=await editorReady(),before=JSON.stringify(e.s.testOverrides),lut=JSON.stringify(e.s.calibrationMap),d=editedRefill(e,{approachMs:1500});
 const pending=e.h.saveS2RefillSettings(d);
 for(let i=0;i<25&&!e.pendingReads.some(x=>x.key==='s2RefillSettingsV1');i++)await settlePromises();
 e.flushReads();
 const r=await pending;assert.equal(r.saved,true);assert.equal(e.h.currentS2RefillSettings().approachMs,1500);assert.equal(JSON.parse(e.storage.s2RefillSettingsV1).approachMs,1500);assert.equal(JSON.stringify(e.s.testOverrides),before);assert.equal(JSON.stringify(e.s.calibrationMap),lut);
 const reload=normalEnv();reload.event('s2RefillSettingsV1',e.storage.s2RefillSettingsV1);assert.equal(reload.h.currentS2RefillSettings().approachMs,1500);assert.equal(reload.s.s2RefillPrevious.after.approachMs,1500);
});
test('independent refill save rejects stale revision running and invalid settings',async()=>{
 const e=await editorReady(),d=editedRefill(e,{approachMs:1500});await assert.rejects(e.h.saveS2RefillSettings({...d,revision:'stale'}));await assert.rejects(e.h.saveS2RefillSettings({...d,refill:{...d.refill,approachMs:1234}}));e.s.phase='stage2';await assert.rejects(e.h.saveS2RefillSettings(d));assert.equal(e.h.currentS2RefillSettings().approachMs,200);
});
test('independent refill write failure keeps current settings and history',async()=>{
 const e=setup({failRefillSave:true});await e.h.syncHyperExProfile(true);const d=editedRefill(e,{approachMs:1500}),before=JSON.stringify(e.s.s2RefillPrevious);await assert.rejects(e.h.saveS2RefillSettings(d));assert.equal(e.h.currentS2RefillSettings().approachMs,200);assert.equal(JSON.stringify(e.s.s2RefillPrevious),before);assert.equal(e.s.curveApplyBusy,false);
});
test('S3 rising tail forecast precedes slower full-window regression',()=>{
 const e=normalEnv(),now=Date.now(),r={startedAtMs:now-3000,rawScaleSamples:[]};e.s.phase='stage3';
 for(let i=0;i<=16;i++){const t=i*.1;r.rawScaleSamples.push({phase:'stage3',profileFrame:2,tMs:1400+i*100,scaleTimestampSeconds:t,weightG:.8*t+.35*t*t});}
 const reg=e.h.liveTrimRegression({run:r,frame:2,frameAt:now-3000});assert(reg);assert(reg.fastSlope>reg.slope);assert(reg.predicted>reg.fastSlope);
});
test('S3 upward writes wait for the previous trend response, not a fixed interval',async()=>{const e=await trimFixture('stage3');trimSamples(e,1.2);await trimTick(e);assert.equal(rawWrites(e).length,1);assert(e.s.liveTrim.pending);e.advance(300);trimSamples(e,1.2);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-write-response');});
test('live trim angle stats: zero-degree share and mean angle follow RAW check rows',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2100);trimSamples(e);e.s.liveTrim.report.checks=2000;await trimTick(e);assert.equal(e.s.liveTrim.active,false);assert.equal(e.s.liveTrim.report.zeroDegreeShare,0);assert(e.s.liveTrim.report.meanAngleDeg>10&&e.s.liveTrim.report.meanAngleDeg<13);assert.equal(e.s.liveTrim.report.status,'2000-check-budget-complete');const f=await trimFixture();await trimTick(f);trimAck(f);f.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});f.advance(300);trimSamples(f,5);await trimTick(f);assert.equal(f.s.liveTrim.report.trace.filter(x=>x.kind==='check'&&x.errorPct===0).length,1);f.s.liveTrim.report.checks=2000;await trimTick(f);assert.equal(f.s.liveTrim.active,false);assert.equal(f.s.liveTrim.report.zeroDegreeShare,0.5);assert(f.s.liveTrim.report.meanAngleDeg!==null);});
test('live trim angle stats: learning assessment exposes angle quality per stage',async()=>{const e=await trimFixture();const checks=Array.from({length:8},(_,i)=>({kind:'check',tMs:1000+i*250,rawGS:i%2?4:5,targetGS:5,errorPct:i%2?-20:0}));e.s.liveTrim.run.liveFlowTrim={trace:checks,deadbandPct:2};e.s.liveTrim.run.config.experimentalLiveTrim=true;const r=e.h.controlLearningAssessment(e.s.liveTrim.run,'stage2');assert(r.angleStats);assert(r.angleStats.zeroDegreeShare===0.5);assert(r.angleStats.meanAngleDeg>5&&r.angleStats.meanAngleDeg<6);});
test('sustained same-direction angles raise the vector step ceiling',async()=>{const f=await trimFixture();await trimTick(f);for(let i=0;i<3;i++){trimAck(f);f.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});f.advance(300);trimSamples(f,4);await trimTick(f);}assert(f.s.liveTrim.report.sameSignStreak>=3);const w=f.s.liveTrim.report.trace.filter(x=>x.kind==='write');assert(w.slice(-1)[0].commandMlS>2.6);assert(w.every(x=>x.commandMlS<=3));});
test('S3 low stable flow can still receive bounded upward correction',async()=>{const e=await trimFixture('stage3');trimSamples(e,1.2);await trimTick(e);assert.equal(rawWrites(e).length,1);});

test('save refill endpoint is registered in host manifest and persists after readback',async()=>{
 const manifest=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json'))),entries=Object.values(manifest).filter(Array.isArray).flat(),id='refill-settings-save';
 assert.equal(entries.filter(x=>x.id===id&&x.type==='http').length,1,'host must expose endpoint before UI can call it');
 const e=await editorReady(),d=editedRefill(e,{approachMs:1500,cutoffPercent:80});
 const pending=e.plugin.__httpRequestHandler({requestId:'refill-save',endpoint:id,method:'POST',body:{revision:d.revision,refill:d.refill}});
 for(let i=0;i<25&&!e.pendingReads.some(r=>r.key==='s2RefillSettingsV1');i++)await settlePromises();
 assert(e.pendingReads.some(r=>r.key==='s2RefillSettingsV1'),'save must verify storage by reading it back');
 e.flushReads();
 const response=await pending,body=JSON.parse(response.body);
 assert.equal(response.status,200,body.error);assert.equal(body.saved,true);assert.equal(body.curveEditor.refill.approachMs,1500);assert.equal(JSON.parse(e.storage.s2RefillSettingsV1).cutoffPercent,80);
 const reload=normalEnv();reload.event('s2RefillSettingsV1',e.storage.s2RefillSettingsV1);assert.equal(reload.h.currentS2RefillSettings().approachMs,1500);
});
test('refill save refuses success when the storage readback differs',async()=>{
 const e=await editorReady(),d=editedRefill(e,{approachMs:1500}),before=e.h.currentS2RefillSettings();
 const pending=e.plugin.__httpRequestHandler({requestId:'refill-bad',endpoint:'refill-settings-save',method:'POST',body:{revision:d.revision,refill:d.refill}});
 for(let i=0;i<25&&!e.pendingReads.some(r=>r.key==='s2RefillSettingsV1');i++)await settlePromises();
 const idx=e.pendingReads.findIndex(r=>r.key==='s2RefillSettingsV1');assert(idx>=0);
 const read=e.pendingReads.splice(idx,1)[0];
 e.event(read.key,JSON.stringify({...before,approachMs:3000}));
 const response=await pending,body=JSON.parse(response.body);
 assert.equal(response.status,409);assert.match(String(body.error),/回读/);
 assert.equal(e.h.currentS2RefillSettings().approachMs,before.approachMs);
});
test('manifest http endpoints match handlers and UI calls in both directions',()=>{
 const m=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json'))),all=Object.values(m).filter(Array.isArray).flat();
 const http=new Set(all.filter(x=>x.type==='http').map(x=>x.id)),ws=new Set(all.filter(x=>x.type==='websocket').map(x=>x.id));
 const handlers=new Set([...source.matchAll(/request\.endpoint\s*===\s*["']([^"']+)["']/g)].map(x=>x[1]));
 const ui=new Set([...source.matchAll(/post\('([a-z0-9-]+)'/g),...source.matchAll(/base\+'\/([a-z0-9-]+)/g)].map(x=>x[1]));
 assert.deepEqual([...handlers].filter(x=>!http.has(x)),[]);
 assert.deepEqual([...ui].filter(x=>!http.has(x)),[]);
 assert.deepEqual([...http].filter(x=>!handlers.has(x)),[]);
 assert.deepEqual([...ws].filter(x=>handlers.has(x)),[]);
});
test('1.78ds version is consistent across manifest runtime and generated page',()=>{
 const e=setup(),m=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json')));
 assert.equal(m.version,'1.78ds');assert.equal(e.plugin.version,'1.78ds');
 assert.equal(e.h.calibrationStatusPayload().pluginVersion,'1.78ds');
 assert.match(e.h.buildGhcOverlayHtml(),/HYPEREX v1\.78ds/);
});
test('abort reset timer is tracked and cleared by a new sequence',()=>{
 const e=normalEnv();e.s.runtimeProfileVerified=true;e.s.armed=true;
 e.h.startSequence(0);assert.equal(e.s.phase,'stage1');
 e.h.abortSequence('unit abort',false);assert.equal(e.s.phase,'aborted');assert(e.s.abortResetTimer);
 e.h.startSequence(0);assert.equal(e.s.abortResetTimer,null);assert.equal(e.s.phase,'stage1');
});
test('generated UI escaping covers attribute quotes',()=>{
 const html=normalEnv().h.buildGhcOverlayHtml();
 assert.match(html,/"':'&quot;/);
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(err){failed++;console.error('FAIL '+name+'\n'+err.stack);}}console.log(`\n${tests.length-failed}/${tests.length} checks passed`);process.exitCode=failed?1:0;})();

