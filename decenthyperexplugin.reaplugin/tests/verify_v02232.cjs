// Run: node tests/verify_v02227.cjs [path/to/plugin.js]
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
 const injection=`globalThis.hooks={stage2CupOnset,phaseRawSamples,diagnosticRawRegression,diagnosticPhaseSummary,validatedS2RefillSettings,currentS2RefillSettings,s3CommandHistoryAudit,projectS3Commands,kickS2Refill,s2RefillFlowEstimate,s2RefillReturnReason,completeS2Startup,stage2LegacyStartupPlan,guardedSingleSkip,scheduleRestartSkip,controlOutputQuality,finalizeDiagnostics,learningAdmission,utf8ByteLength,keepCoffeeQualification,diagnosticRunCommandSnapshot,normalizeLearningLevel,learningPolicy,scalarLearningSuggestion,stage3SingleSuggestion,stage3ReferenceEvidence,stageCommandOrigin,historyPersistenceAudit,compactLiveHistory,s2NearbyEvidence,activeReleaseEnabled,overrideStorageKey,liveTrimPhaseAllowed,beginContinuousStage2,stage1LiveLearning,onScaleSnapshot,beginDump,finishSequence,storageRead,storageWrite,stage2StartupMetrics,stage2StartupPlan,dispatchS2Startup,assessRunLearningIntegrity,historyLearningStatus,learningRunAllowed,historyEvidenceAllowed,learningHistoryPayload,setLearningHistoryReview,matchingAdaptiveEvidenceSearch,sameScalarAdaptiveEvidence,sameStage3Shape,stage3ShapeFamily,startupMetricAllowed,s2ReverseEstimate,curveCommandsForRun,reconcileStageWithCurve,createUiTranslator,translateUiText,UI_LANGUAGE_PAIRS,curveEditorRevision,curveEditorSnapshot,applyCurveEditorDraft,saveS2RefillSettings,manualCurveBlocksRun,state,loadConfig,profileObject,calibrationProfileObject,stripRealFlowText,trimHistoryFullRecords,recomputeCalibrationUsability,handleWorkflowUpdated,handleStateUpdate,
 verifyAndRepairSelectedHyperExProfile,syncHyperExProfile,runtimeProfileTruthPayload,adaptiveHistoryFingerprint,adaptiveHistoryFingerprintKey,gainMemoryQualityGuard,driftShapeSuggestion,s3ShapeStatus,resolvedStageCommandFlow,manualTestCommand,liveTrimControlCenter,boundedRefillCommand,s2LearningWindow,liveTrimChainEvidence,stage2EffectiveCommand,
 numericLearningFingerprintKey,trustedAdaptiveRun,restoreAdaptiveHistoryFromPersistentFile,previousMatchingAdaptiveEvidence,nextShotAdaptiveSuggestion,rememberAdaptiveEvidence,
 compactPersistentShotRecord,persistHistoryFile,appendPersistentHistoryShot,startPersistentHistoryProbe,setPersistentHistoryUnavailable,
 startDiagnostics,finalizeCalibrationRun,clearAllTimers,abortSequence,calibrationStatusPayload,stage1StartupMetrics,stage3StabilityDiagnostics,diagnosticSummary,scalarConsensusSuggestion,stage1AdaptiveEvidence,stage2AdaptiveEvidence,stage3AdaptiveEvidence,
 testOverrideBinding,recordNextShotApplied,buildSkinSurfaceAnswer,refreshLearningStage,commandFlowSummary,baselineFeedForwardPayload,buildGhcOverlayHtml,stageActuatorEvidence,adaptiveAuditPayload,autoApplyNextShotIfEligible,testOverrideStatus,resetSequence,startSequence,s3StepLimit,snapCommandFlow,applyNextShotAdaptiveSuggestion,extractMachine,profilesEquivalent,profileExecutionEquivalent,profileExecutionDifferences,
 workflowBrewTemperature,adoptWorkflowBrewTemperature,controlRunReview,controlLearningAssessment,stageGainEstimate,initializeLiveTrim,startLiveTrim,liveTrimTick,stopLiveTrim,observeLiveTrimMachine,encodeLiveFlowFrame,liveTrimLearningView,liveTrimRegression,commandCeilingFor,computeAngleStats,emptyGainMemory,normalizeGainMemory,gainMemoryState,gainRegimeForRun,selectGainBucket,createGainBucket,gainStageObservation,updateGainMemoryFromRun,gainMemorySuggestion,mergeCalibrationMap,adoptCalibrationMap,qualificationFingerprintKey,applyPendingPreset,presetsPayload,savePresetSlot,rescaleOverridesForTargets,diagnosticCsv,
 beginSoak,beginDirectStartTest,restartPourConfirmed,startRestartPoll,manualRearmSecondStage,directStartTestPayload,advancedSettingsFromCfg,uiStatusPayload,
 enterHyperExScopedMultiplier,restoreHyperExScopedMultiplier,setApi(fn){api=fn;}};\n`;
 const token='  return {\n    id: ID,';assert(source.includes(token));
 vm.runInContext(source.replace(token,injection+token),context);plugin=context.createPlugin(host);h=context.hooks;
 const s=h.state;const initialLanguage=s.uiLanguage;s.uiLanguage=options.uiLanguage||"en";s.cfg=h.loadConfig({AdaptiveLearningLevel:"保守",LiveFlowTrimTest:false,LiveFlowTrimLevel:1});s.cfg.liveTrimDecisionModel=false;s.cfg.s3DriftModel=false;s.cfg.s2RefillBoundedModel=false;s.cfg.basketContext='empty';s.scopeMode='off';s.calibrationStorageLoaded=true;s.overrideStorageLoaded=true;s.scopeStorageLoaded=true;s.scopedOriginalStorageLoaded=true;
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
 return {runId:id,kind:'hyperex',result:'completed at 100 g',config:{basketContext:e.s.cfg.basketContext,profileTruthVerified:true,profileTruthSchema:3,s3DriftModel:e.s.cfg.s3DriftModel===true,adaptiveFingerprint:copy(e.h.adaptiveHistoryFingerprint())},summary:{},samples:[],rawScaleSamples:[]};
}
function historyRow(e,id='old'){
 const fp=copy(e.h.adaptiveHistoryFingerprint());return {runId:id,profileTruthVerified:true,profileTruthSchema:3,fingerprint:fp,evidence:{runId:id,profileTruthSchema:3,fingerprint:fp,s2:{runId:id,targetGS:5,command:2.507,measured:6.5}}};
}

function disableGainMemory(e){if(e&&e.s&&e.s.persistentHistoryFile)delete e.s.persistentHistoryFile.gainMemory;if(e&&e.storage&&e.storage.adaptiveHistoryFileV2){try{const raw=e.storage.adaptiveHistoryFileV2,file=typeof raw==='string'?JSON.parse(raw):raw;if(file&&typeof file==='object'){delete file.gainMemory;e.storage.adaptiveHistoryFileV2=JSON.stringify(file);}}catch(_){}}}
test('LUT translates real targets to .719 / 2.507 / .569',()=>{const e=setup();assert.deepEqual(e.expected.steps.map(x=>+x.flow),[.75,2.5,.5625]);});
test('matching workflow event cannot arm without GET and upload',async()=>{const e=setup();e.h.handleWorkflowUpdated({profile:e.expected});assert.equal(e.s.runtimeProfileVerified,false);assert.equal(e.s.armed,false);await e.s.profileSyncQueue;assert.equal(e.s.runtimeProfileVerified,true);assert.equal(e.s.armed,true);assert.equal(e.calls.filter(c=>c.path==='/workflow'&&c.method==='GET').length,2);assert.equal(e.writes().filter(c=>c.path==='/workflow').length,0);assert.equal(e.writes().filter(c=>c.path==='/machine/profile').length,1);});
test('old literal profile repaired, uploaded and read back',async()=>{const e=setup({eventOnPut:true});e.mock.workflow.steps.forEach((x,i)=>x.flow=['2','5','1.5'][i]);await e.h.verifyAndRepairSelectedHyperExProfile('test');assert.equal(e.s.runtimeProfileVerified,true);assert.deepEqual(e.mock.workflow.steps.map(x=>+x.flow),[.75,2.5,.5625]);assert.deepEqual(e.writes().map(c=>c.path),['/workflow','/machine/profile']);});
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
test('snapshot fingerprint is not recomputed at shot completion',()=>{const e=setup();const run=evidenceRun(e);const fp=copy(run.config.adaptiveFingerprint);e.s.calibrationMap.points[0].commandFlow=.6;assert.deepEqual(copy(e.h.compactPersistentShotRecord(run,null).fingerprint),fp);assert.equal(e.h.trustedAdaptiveRun(run),true);e.s.calibrationMap.createdAt='other';assert.equal(e.h.trustedAdaptiveRun(run),false);});
test('old 1.48 truth and interrupted shots cannot suggest numeric changes',()=>{const e=setup();const run=evidenceRun(e);run.config.profileTruthSchema=undefined;assert.equal(e.h.nextShotAdaptiveSuggestion(run),null);run.config.profileTruthSchema=3;run.result='manual stop';assert.equal(e.h.nextShotAdaptiveSuggestion(run),null);});
test('incompatible and legacy rows excluded from persistent restore',()=>{const e=setup();e.s.persistentHistoryAvailable=true;const valid=historyRow(e);const legacy=copy(valid);legacy.runId='legacy';legacy.profileTruthSchema=undefined;const other=copy(valid);other.runId='other';other.fingerprint.actualFlowMultiplier=1.1;e.s.persistentHistoryFile={shots:[legacy,other,valid]};e.h.restoreAdaptiveHistoryFromPersistentFile();assert.deepEqual(copy(e.s.adaptiveHistory.map(x=>x.runId)),['old']);});
test('SESSION ONLY never restores disk evidence and preserves session evidence',()=>{const e=setup();const row=historyRow(e);e.s.persistentHistoryAvailable=false;e.s.persistentHistoryFile={shots:[row]};const session=copy(row.evidence);session.runId='session';e.s.adaptiveHistory=[session];e.h.restoreAdaptiveHistoryFromPersistentFile();assert.deepEqual(copy(e.s.adaptiveHistory.map(x=>x.runId)),['session']);});
test('storage failure removes restored evidence but keeps session rows',()=>{const e=setup();const row=historyRow(e);e.s.persistentHistoryAvailable=true;e.s.persistentHistoryFile={shots:[row]};e.h.restoreAdaptiveHistoryFromPersistentFile();const session=copy(row.evidence);session.runId='session';e.s.adaptiveHistory.push(session);e.h.setPersistentHistoryUnavailable('test failure');assert.deepEqual(copy(e.s.adaptiveHistory.map(x=>x.runId)),['session']);});
test('probe arriving before initial history read cannot overwrite disk',()=>{const e=setup();e.h.startPersistentHistoryProbe();e.deliverRead();assert.equal(e.s.storageProbeVerified,true);assert.equal(e.s.persistentHistoryAvailable,null);assert.equal(e.storageCalls.filter(x=>x.type==='write'&&x.key==='adaptiveHistoryFileV2').length,0);const row=historyRow(e);e.event('adaptiveHistoryFileV2',JSON.stringify({schema:2,shots:[row]}));assert.equal(e.s.persistentHistoryAvailable,null);assert(e.s.historyTrimWriteTimer,'first write deferred to idle');e.s.phase='idle';e.run(e.s.historyTrimWriteTimer);e.flushReads();assert.equal(e.s.persistentHistoryAvailable,true);assert.equal(e.s.persistentHistoryFile.shots[0].runId,'old');});
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
  stage3Shape:{enabled:true,earlyCommand:.6875,earlySeconds:8,midCommand:.75,midSeconds:14,lateCommand:.8125}});
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
test('S3 fallback retains the actual .6875 / .75 / .8125 commands',()=>{const e=setup();const r=syntheticRun(e);const q=e.h.stage3AdaptiveEvidence(r);assert(q);assert.equal(q.measurementBasis,'stability 25/50/25 fallback');assert.deepEqual(copy(q.source.map(x=>x.command)),[.688,.75,.813]);});
test('two matching clean S3 shots produce bounded next-shot LEVEL and SHAPE',()=>{const e=setup();const a=syntheticRun(e,'a',[2.1,1.8,1.5]),b=syntheticRun(e,'b',[2.1,1.8,1.5]);e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b).s3;assert.equal(q.action,'LEVEL + SHAPE');const old=[.6875,.75,.8125],now=[q.suggestedShape.earlyCommand,q.suggestedShape.midCommand,q.suggestedShape.lateCommand],lim=Math.max(e.h.learningPolicy('保守').s3[1],1/16);now.forEach((v,i)=>{assert(Math.abs(v-old[i])<=lim+.001);});assert.equal(e.writes().length,0);});
test('shape factors are normalized independently from S3 level factor',()=>{const e=setup();const a=syntheticRun(e,'a',[2.1,1.8,1.5]),b=syntheticRun(e,'b',[2.1,1.8,1.5]);e.h.rememberAdaptiveEvidence(a);const q=e.h.nextShotAdaptiveSuggestion(b).s3;const weights=q.sourceFrames.map(x=>x.windowS);const avg=q.shapeFactors.reduce((sum,x,i)=>sum+x*weights[i],0)/weights.reduce((a,b)=>a+b,0);assert(Math.abs(avg-1)<.0002);const cmd=q.sourceFrames[1].commandMlS,span=Math.max(.05,(1/16)/cmd);assert(q.levelFactor<=1+1e-9);assert(q.levelFactor>=1-span-.0001);});
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
test('old literal machine-flow workflow repairs through actual DTO serialization',async()=>{const e=setup({roundtrip:true,eventOnPut:true});e.mock.workflow.steps.forEach((s,i)=>s.flow=['2','5','1.5'][i]);await e.h.syncHyperExProfile(true);assert.equal(e.s.armed,true);assert.deepEqual(e.mock.workflow.steps.map(x=>+x.flow),[.75,2.5,.5625]);});
test('repeated DTO roundtrips skip library, workflow and machine rewrites',async()=>{const e=setup({roundtrip:true});await e.h.syncHyperExProfile(true);e.calls.length=0;await e.h.syncHyperExProfile(true);assert.equal(e.writes().length,0);});
test('real DTO S3 seed shape survives readback verification',async()=>{const e=setup({roundtrip:true,eventOnPut:true});e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),s3Shape:{enabled:true,earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778},stages:{}};await e.h.syncHyperExProfile(true);assert.equal(e.s.armed,true);assert.deepEqual(e.mock.workflow.steps.slice(2).map(s=>+s.flow),[.6875,.75,.75]);});
test('changed actual flow is never hidden by DTO normalization',()=>{const e=setup();const a=decaidRoundTrip(e.expected);a.steps[0].flow=2;assert.equal(e.h.profileExecutionEquivalent(a,e.expected),false);const d=e.h.profileExecutionDifferences(a,e.expected);assert.equal(d[0].field,'steps[0].flow');assert.equal(d[0].expected,.75);assert.equal(d[0].actual,2);});
test('unexpected step exit condition blocks verification',()=>{const e=setup();const a=decaidRoundTrip(e.expected);a.steps[0].exit={type:'flow',condition:'over',value:1};assert.equal(e.h.profileExecutionEquivalent(a,e.expected),false);});
test('changed limiter, duration, temperature, weight or target blocks equivalence',()=>{const e=setup();for(const mutate of [a=>a.steps[0].limiter.value+=1,a=>a.steps[0].seconds-=1,a=>a.steps[0].temperature+=1,a=>a.steps[0].weight=4,a=>a.target_weight=40,a=>a.steps[0].pump='pressure']){const a=decaidRoundTrip(e.expected);mutate(a);assert.equal(e.h.profileExecutionEquivalent(a,e.expected),false);}});
test('missing required numeric command is not equivalent to zero',()=>{const e=setup();const a=decaidRoundTrip(e.expected);const b=copy(a);a.steps[0].flow=0;delete b.steps[0].flow;assert.equal(e.h.profileExecutionEquivalent(a,b),false);});
test('null and omitted no-exit condition are equivalent',()=>{const e=setup();const a=decaidRoundTrip(e.expected);delete a.steps[0].exit;assert.equal(e.h.profileExecutionEquivalent(a,e.expected),true);});
test('pressure step compares pressure and ignores unused flow',()=>{const e=setup();const p=copy(e.expected);p.steps[0].pump='pressure';p.steps[0].pressure='3';p.steps[0].flow='';const a=decaidRoundTrip(p);assert.equal(e.h.profileExecutionEquivalent(a,p),true);a.steps[0].pressure=4;assert.equal(e.h.profileExecutionEquivalent(a,p),false);});
test('stored-profile equivalence ignores dropped import metadata but preserves author and notes',()=>{const e=setup();const a=decaidRoundTrip(e.expected);assert.equal(e.h.profilesEquivalent(a,e.expected),true);a.notes+='changed';assert.equal(e.h.profilesEquivalent(a,e.expected),false);});
test('mismatch error names the actual field and preserves the guard',async()=>{const e=setup({roundtrip:true});e.mock.after=p=>{if(p==='/machine/profile')e.mock.workflow.steps[1].flow=5;};await assert.rejects(e.h.syncHyperExProfile(true),/steps\[1\]\.flow: expected 2\.5, actual 5/);assert.equal(e.s.armed,false);});
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
// cut 7 / L-5: the 15-gate shape-only chain is deleted. S3 shape has one
// writer (the drift model); the storage object is no longer validated twice.
test('S3 shape-only consensus chain is deleted; drift is the only shape writer',()=>{
 assert(!source.includes('stage3ShapeOnlyConsensus'));
 const e=setup();
 assert.equal(e.h.stage3ShapeOnlyConsensus,undefined);
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
test('two variable S3 shots no longer write a shape-only override',()=>{
 const e=setup(),a=syntheticRun(e,'a',[2.1,1.843,1.50]),b=syntheticRun(e,'b',[1.734,1.558,1.182]);
 e.h.rememberAdaptiveEvidence(a);disableGainMemory(e);const q=e.h.nextShotAdaptiveSuggestion(b);
 assert(!/SHAPE ONLY/.test(String(q.s3.action)));
 assert.equal(e.writes().length,0);
});
test('drift shape applies only while idle, verifies DTO readback and leaves LUT untouched',async()=>{
 const e=setup({roundtrip:true});e.s.cfg.adaptiveLearningLevel='正常';
 const b=syntheticRun(e,'b',[1.4,1.8,2.4]);b.config.s3DriftModel=true;
 const lut=JSON.stringify(e.s.calibrationMap),snapshot=JSON.stringify(b.config);
 e.s.phase='stage3';await assert.rejects(e.h.applyNextShotAdaptiveSuggestion(b,'auto'),/idle/);
 assert.equal(e.writes().length,0);e.s.phase='idle';
 await e.h.applyNextShotAdaptiveSuggestion(b,'auto');
 assert.equal(e.s.armed,true);assert.equal(e.s.testOverrides.adaptiveSource.mode,'auto');
 assert.equal(e.s.testOverrides.s3Shape.model,'drift');
 assert.equal(JSON.stringify(e.s.calibrationMap),lut);assert.equal(JSON.stringify(b.config),snapshot);
 assert.equal(e.s.testOverrides.stages.stage2.mode,'auto');
 assert.equal(+e.mock.workflow.steps[2].flow,Math.round(e.s.testOverrides.s3Shape.earlyCommand*16)/16);
});
test('drift shape upload failure preserves previous overrides and cannot arm',async()=>{
 const e=setup({roundtrip:true});e.s.cfg.adaptiveLearningLevel='正常';
 const b=syntheticRun(e,'b',[1.4,1.8,2.4]);b.config.s3DriftModel=true;const old=JSON.stringify(e.s.testOverrides);
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
 const e=setup({roundtrip:true});e.s.cfg.adaptiveLearningLevel='正常';
 const b=syntheticRun(e,'finished',[1.4,1.8,2.4]);b.config.s3DriftModel=true;
 e.s.diagnosticCurrent=b;e.s.phase='finishing';e.s.cumulativeWeight=100;e.s.autoApplyNextShot=true;
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
 const e=setup({roundtrip:true});e.s.cfg.adaptiveLearningLevel='正常';
 const b=syntheticRun(e,'b',[1.4,1.8,2.4]);b.config.s3DriftModel=true;
 e.mock.fail=p=>p==='/machine/profile'?'machine offline':null;
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
 assert.equal(e.h.testOverrideStatus().valid,true);assert.equal(e.h.testOverrideStatus().baselinePrior,true);assert.deepEqual(copy(e.h.profileObject().steps.map(x=>+x.flow)),[.8125,2.5,.6875,.75,.75]);
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
 e.h.rememberAdaptiveEvidence(a);disableGainMemory(e);const q=e.h.nextShotAdaptiveSuggestion(b);assert(q.s3.suggestedShape);
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
 assert.equal(e.s.armed,true);assert.equal(+e.mock.workflow.steps[0].flow,.8125);assert.equal(+e.mock.workflow.steps[2].flow,.6875);
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
test('restart pour poll+stateUpdate double trigger issues exactly one skipStep',async()=>{const e=setup();e.s.phase='restart_wait';const pour={machineState:'espresso',substate:'pouring'};e.h.restartPourConfirmed('poll',pour);const t1=e.s.restartSkipTimer;e.run(t1);e.h.restartPourConfirmed('stateUpdate',pour);if(e.s.restartSkipTimer!==null&&e.s.restartSkipTimer!==t1){e.run(e.s.restartSkipTimer);}for(let i=0;i<30;i++)await Promise.resolve();const skips=e.calls.filter(c=>c.path==='/machine/state/skipStep'&&c.method==='PUT');assert.equal(skips.length,1);assert.equal(e.s.restartSkipTimer,null);});

async function trimFixture(phase='stage2'){
 const e=setup();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2StartupAssist=false;e.s.runtimeProfileVerified=true;e.h.startSequence(0);e.s.phase=phase;e.s.lastFrame=phase==='stage2'?1:2;
 await e.h.startLiveTrim();e.h.observeLiveTrimMachine({profileFrame:e.s.lastFrame});e.advance(2200);trimSamples(e,phase==='stage2'?4:1.2);return e;
}
async function predictiveTrimFixture(phase='stage2'){
 const e=await trimFixture(phase);e.s.cfg.liveTrimDecisionModel=true;
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,seq:1,lastBucketId:'g1',buckets:[{id:'g1',center:.2,radius:.12,stages:{s2:{r:1.2,n:3,lastDeviation:0,lastObservedR:1.2},s3:{r:2,n:3,lastDeviation:0,lastObservedR:2}}}]}};
 const t=e.s.liveTrim;Object.assign(t.run.config,{stage2Flow:5,stage2CommandMlS:2.507,stage2LutCommandMlS:2.507,stage3Flow:1.5,stage3CommandMlS:.569,stage3LutCommandMlS:.569});t.run.samples=Array.from({length:20},(_,i)=>({phase:'stage2',tMs:i*100,pressureBar:.5,machineFlowMlS:2.5,machineTelemetryValid:true,machineAgeMs:0}));
 return e;
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
test('explicit live trim OFF preserves original shot-to-shot and profile unchanged',()=>{const e=setup();assert.equal(e.s.cfg.liveFlowTrimTest,false);e.h.startSequence(0);assert.equal(e.s.liveTrim,null);assert.equal(e.s.autoApplyNextShot,true);assert.deepEqual(copy(e.h.profileObject().steps.map(x=>+x.flow)),[.75,2.5,.5625]);});
test('live trim has independent setting and freezes 944ms /50 budget at shot start',async()=>{const e=await trimFixture();assert.equal(e.s.liveTrim.report.periodMs,944);assert.equal(e.s.liveTrim.report.maxChecks,2000);assert.equal(e.s.cfg.directDriverStartTest,false);assert.equal(e.h.advancedSettingsFromCfg().liveFlowTrimTest,true);});
test('below-band S2 writes one quantized current A010 frame and no skip/profile/multiplier',async()=>{const e=await trimFixture();await trimTick(e);assert.equal(rawWrites(e).length,1);const msg=JSON.parse(rawWrites(e)[0].payload.data);assert.equal(msg.payload,'01412CB8FF000400');assert.equal(e.s.liveTrimDirty,true);assert.equal(e.s.liveTrim.report.writes,1);assert(!e.calls.some(c=>c.path==='/machine/state/skipStep'||c.path==='/workflow'&&c.method==='PUT'||c.path==='/machine/calibration'));});
test('inside ±4 percent writes nothing but logs a valid check point',async()=>{const e=await trimFixture();trimSamples(e,5.05);await trimTick(e);assert.equal(rawWrites(e).length,0);const row=e.s.liveTrim.report.trace.find(x=>x.kind==='check');assert.equal(row.reason,'inside-4pct-band');assert.equal(row.rawGS,5.05);});
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
test('verified stable learning window uses actual changed command, preserving raw run and LUT',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});const start=e.s.liveTrim.report.trace.find(x=>x.kind==='machine-target-response').tMs+2100;const run=e.s.liveTrim.run;run.rawScaleSamples=Array.from({length:40},(_,i)=>({phase:'stage2',profileFrame:1,tMs:start+i*200,weightG:i,scaleTimestampSeconds:100+i*.2}));const view=e.h.liveTrimLearningView(run,'stage2');assert(view);assert.equal(view.config.stage2CommandMlS,2.75);assert.equal(run.config.stage2CommandMlS,2.5);assert.equal(e.s.calibrationMap.points[2].commandFlow,2.507);});
test('experimental trace survives summary/CSV with check, write, ACK and target response separately',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});const run=e.s.liveTrim.run;const summary=e.h.diagnosticSummary(run);assert.equal(summary.liveFlowTrim.writes,1);const csv=e.h.diagnosticCsv(run);assert.match(csv,/driver-ack/);assert.match(csv,/machine-target-response/);assert.match(csv,/live_flow_trim/);});
test('generated chart renders directional arrows, retry marks and separate target squares',()=>{const lines=source.split('\n');const names=['svgPath','renderChart','liveTrimMarkers'];const functions=names.map(n=>lines.find(x=>x.startsWith('function '+n+'('))).join('\n');const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(functions,ctx);const run={liveFlowTrim:{trace:[{kind:'check',tMs:1000,rawGS:4.1},{kind:'write',tMs:1200,commandMlS:2.5625,previousMlS:2.5},{kind:'write',tMs:1300,commandMlS:2.5,previousMlS:2.5625},{kind:'write',tMs:1400,commandMlS:2.5,previousMlS:2.5625,retry:true},{kind:'machine-target-response',tMs:1500,commandMlS:2.5}]}};const markers=ctx.liveTrimMarkers(run);assert.deepEqual(Array.from(markers,x=>x.shape),['circle','up','down','retry','square']);const svg={innerHTML:''};ctx.renderChart(svg,[{points:[[0,0],[2,5]],stroke:'#fff'}],0,6,markers);assert.match(svg.innerHTML,/<circle/);assert.match(svg.innerHTML,/<rect/);assert.match(svg.innerHTML,/上调指令/);assert.match(svg.innerHTML,/下调指令/);assert.match(svg.innerHTML,/同值重试/);});
test('live trim vector arrows carry direction and amplitude length',()=>{const s=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');const NL=String.fromCharCode(10);const r0=s.indexOf('function svgPath('),a=s.indexOf('function renderChart('),b=s.indexOf('function liveTrimMarkers(');const ns=[s.slice(r0,s.indexOf(NL,r0)),s.slice(a,s.indexOf(NL,a)),s.slice(b,s.indexOf(NL,b))].join(NL);const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(ns,ctx);const run={liveFlowTrim:{trace:[{kind:'write',tMs:1000,commandMlS:2.5625,previousMlS:2.5},{kind:'write',tMs:2000,commandMlS:3.0,previousMlS:2.75}]}};const markers=ctx.liveTrimMarkers(run);const m1=markers.find(x=>x.x===1),m2=markers.find(x=>x.x===2);assert.equal(m1.shape,'up');assert.equal(m2.shape,'up');assert(m2.size>m1.size);const svg={innerHTML:''};ctx.renderChart(svg,[{points:[[0,0],[3,6]],stroke:'#fff'}],0,6,markers);const ps=[];let idx=svg.innerHTML.indexOf('<path');while(idx>=0){const dq=svg.innerHTML.indexOf('d="',idx);const d0=dq+3;const d1=svg.innerHTML.indexOf('"',d0);ps.push(svg.innerHTML.slice(d0,d1));idx=svg.innerHTML.indexOf('<path',d1);}assert(ps.length>=2);assert.notEqual(ps[0],ps[1]);});
test('vector arrow direction is absolute command increase/decrease even when it diverges from the target',()=>{const s=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');const NL=String.fromCharCode(10);const a=s.indexOf('function liveTrimMarkers(');const ns=s.slice(a,s.indexOf(NL,a));const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(ns,ctx);const run={liveFlowTrim:{trace:[{kind:'write',tMs:1000,commandMlS:3.0,previousMlS:2.75,rawGS:6,targetGS:5},{kind:'write',tMs:2000,commandMlS:2.75,previousMlS:3.0,rawGS:4,targetGS:5}]}};const ms=ctx.liveTrimMarkers(run);assert.equal(ms[0].shape,'up');assert.equal(ms[1].shape,'down');});


test('live-trim completed shot still queues the normal next-shot evaluator',async()=>{const e=await trimFixture();const run=e.s.liveTrim.run;e.s.phase='finishing';e.h.resetSequence('completed at 100 g');assert(e.s.autoApplyTimer);assert.equal(e.s.autoApplyLastStatus.status,'scheduled');assert.equal(e.s.autoApplyLastStatus.runId,run.runId);});
test('original profile is actually re-uploaded after raw edits before next shot',async()=>{const e=await trimFixture();await trimTick(e);e.s.lastMachineState='idle';e.h.resetSequence('test restore');e.calls.length=0;await e.h.syncHyperExProfile(true);assert(e.calls.some(c=>c.path==='/machine/profile'&&c.method==='POST'));assert.equal(e.s.runtimeProfileVerified,true);assert.deepEqual(copy(e.mock.workflow.steps.map(x=>+x.flow)),[.75,2.5,.5625]);});

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
test('non-temperature profile tampering is still repaired while valid home temperature is kept',async()=>{const e=setup();e.mock.workflow.steps.forEach(x=>x.temperature=94);e.mock.workflow.steps[1].flow='7';await e.h.syncHyperExProfile(true);assert.equal(+e.mock.workflow.steps[1].flow,2.5);assert(e.mock.workflow.steps.every(x=>+x.temperature===94));});
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
test('controlled S2 evidence forms bounded next-shot adjustment rather than INSUFFICIENT',async()=>{const e=setup(),a=controlledRun(e,'a'),b=controlledRun(e,'b');e.h.rememberAdaptiveEvidence(a);disableGainMemory(e);const q=e.h.nextShotAdaptiveSuggestion(b);assert.equal(q.s2.action,'ADJUST',q.s2.reason);assert(q.s2.suggestedCommandMlS>2.5);assert(q.s2.suggestedCommandMlS-2.5<=0.12*2.5+1e-6);assert(q.s2.suggestedCommandMlS/2.507<=1.05001);const lut=JSON.stringify(e.s.calibrationMap);await e.h.autoApplyNextShotIfEligible(b);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(JSON.stringify(e.s.calibrationMap),lut);});
test('firmware-ramped in-envelope target echo still counts as known coverage',()=>{const e=setup(),r=controlledRun(e,'ramp');let k=0;for(const x of r.samples.filter(s=>s.phase==='stage2')){const v=2.5+((k++*2)%8)/16;x.targetFlowMlS=v;x.machineFlowMlS=v;}const d=e.h.controlLearningAssessment(r,'stage2');assert(d.applicable);assert(d.actuator,d.reason);assert(d.actuator.eligible,d.reason);assert(d.actuator.samples>=4);assert(d.actuator.samples/d.actuator.total>=.7,d.actuator.samples+'/'+d.actuator.total);});
test('S2 single-shot chain supplies LUT COMPENSATE and auto-applies to next shot',async()=>{const e=setup({roundtrip:true}),r=coffeeRun(e,'chain-ok');r.liveFlowTrim={trace:[{kind:'check',frame:1,tMs:20000,rawGS:4.0},{kind:'write',frame:1,tMs:21000,commandMlS:2.5625,previousMlS:2.5},{kind:'write',frame:1,tMs:23000,commandMlS:2.75,previousMlS:2.5625},{kind:'check',frame:1,tMs:25000,rawGS:4.4}]};const ev=e.h.stage2AdaptiveEvidence(r);assert(ev&&ev.liveTrimChain,ev&&ev.reason);assert.equal(ev.liveTrimChain.usable,true);const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s2.action,'LUT COMPENSATE',q.s2.reason);assert(q.s2.usable);assert(q.s2.suggestedCommandMlS>2.75);assert(q.actionable);const lut=JSON.stringify(e.s.calibrationMap);await e.h.autoApplyNextShotIfEligible(r);assert.equal(e.s.autoApplyLastStatus.status,'applied',e.s.autoApplyLastStatus.message);assert.equal(e.s.testOverrides.stages.stage2.mode,'manual');assert.equal(e.s.testOverrides.stages.stage2.origin,'adaptive');assert(Math.abs(Number(e.s.testOverrides.stages.stage2.command)-Number(q.s2.suggestedCommandMlS))<=.001);assert.equal(JSON.stringify(e.s.calibrationMap),lut);});
test('saturated chain holds next-shot S2 command and is not actionable',()=>{const e=setup(),r=coffeeRun(e,'chain-sat');r.liveFlowTrim={trace:[{kind:'check',frame:1,tMs:20000,rawGS:4.0},{kind:'write',frame:1,tMs:21000,commandMlS:2.5625,previousMlS:2.5},{kind:'write',frame:1,tMs:23000,commandMlS:2.75,previousMlS:2.5625},{kind:'check',frame:1,tMs:25000,rawGS:4.05}]};const ev=e.h.stage2AdaptiveEvidence(r);assert(ev&&ev.liveTrimChain);assert.equal(ev.liveTrimChain.usable,false);const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s2.action,'SATURATED / HOLD');assert.equal(q.s2.usable,false);assert.equal(q.actionable,false);});
test('corrected S3 frames contribute independent known-target windows to consensus',()=>{const e=setup(),r=controlledRun(e,'shape',true);const d=e.h.controlLearningAssessment(r,'stage3');assert(d.eligible,d.reason);assert.equal(d.frames.length,3);const ev=e.h.stage3AdaptiveEvidence(r);assert(ev);assert.equal(ev.measurementBasis,'live target-normalized frame windows');assert(ev.source.every(x=>Math.abs(x.measured-1.5)<.03));});
test('ACK or local writes without observed fresh machine target cannot supply numeric data',()=>{const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2')delete x.targetFlowMlS;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert.match(d.reason,/coverage/);assert.equal(e.h.stage2AdaptiveEvidence(r),null);assert.match(e.h.nextShotAdaptiveSuggestion(r).s2.reason,/coverage/);});
test('live learning retains pressure and actuator gates using observed command',()=>{for(const kind of ['pressure','flow','stale']){const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2'){if(kind==='pressure')x.pressureBar=5.9;if(kind==='flow')x.machineFlowMlS=.1;if(kind==='stale')x.machineAgeMs=1200;}const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false,kind);assert.equal(e.h.stage2AdaptiveEvidence(r),null);}});
test('unknown target outside bounded written trajectory is excluded',()=>{const e=setup(),r=controlledRun(e);for(const x of r.samples)if(x.phase==='stage2')x.targetFlowMlS=7;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert.match(d.reason,/coverage/);});
test('duplicate RAW timestamps cannot satisfy relaxed live-learning windows',()=>{const e=setup(),r=controlledRun(e);for(const x of r.rawScaleSamples)if(x.phase==='stage2')x.scaleTimestampSeconds=100;const d=e.h.controlLearningAssessment(r,'stage2');assert.equal(d.eligible,false);assert.match(d.reason,/withheld:.*no usable RAW windows|waiting for sustained cup outflow/);});
test('poor RAW regression is not admitted merely because machine targets are known',()=>{const e=setup(),r=controlledRun(e);let i=0;for(const x of r.rawScaleSamples)if(x.phase==='stage2')x.weightG=10+(i++%2?20:0);assert.equal(e.h.controlLearningAssessment(r,'stage2').eligible,false);});
test('original fixed-command evidence path remains unchanged when live trim never writes',()=>{const e=setup(),r=coffeeRun(e);r.config.experimentalLiveTrim=true;r.liveFlowTrim={trace:[]};assert.equal(e.h.controlLearningAssessment(r,'stage2').applicable,false);assert(e.h.stage2AdaptiveEvidence(r));});
test('±4% live band acts beyond the deadband without extra command quantum',async()=>{const e=await trimFixture();trimSamples(e,5.3);await trimTick(e);assert.equal(e.s.liveTrim.report.deadbandPct,4);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.pending.command,2.4375);});
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
test('curve editor applies S2 draft into verified NEXT SHOT without changing other seeds or LUT',async()=>{const {e,body}=await curveFixture(),lut=JSON.stringify(e.s.calibrationMap);body.values.stage2=2.6875;const r=await e.h.applyCurveEditorDraft(body);assert(r.verified);assert.equal(e.h.commandFlowSummary().stage2CommandMlS,2.688);assert.equal(e.mock.workflow.steps[1].flow,'2.6875');assert.equal(e.h.commandFlowSummary().stage1CommandMlS,.719);assert.equal(e.h.commandFlowSummary().stage1Mode,'auto');assert.equal(JSON.stringify(e.s.calibrationMap),lut);assert(e.h.runtimeProfileTruthPayload().verified);assert.equal(e.s.autoApplyLastStatus.status,'curve-applied');assert(e.h.commandFlowSummary().manualCurveSource);});
test('curve editor S3 three controls generate natural timed frames and verified shape',async()=>{const {e,body}=await curveFixture();body.shaped=true;body.values.early=.625;body.values.mid=.6875;body.values.late=.75;body.values.earlySeconds=9;body.values.midSeconds=13;await e.h.applyCurveEditorDraft(body);const p=e.h.profileObject();assert.equal(p.steps.length,5);assert.equal(Number(p.steps[2].seconds),9);assert.equal(Number(p.steps[3].seconds),13);assert.equal(e.h.commandFlowSummary().stage3Mode,'shape');assert(!e.calls.some(x=>x.path==='/machine/state/skipStep'));});
test('curve draft stale after another command, temperature or target change is rejected without mutation',async()=>{for(const change of [e=>e.s.cfg.temperature=94,e=>e.s.cfg.stage2Flow=4.5,e=>e.s.workflowSelectionRevision++]){const {e,body}=await curveFixture();body.values.stage2=2.6875;change(e);const before=JSON.stringify(e.s.testOverrides);await assert.rejects(e.h.applyCurveEditorDraft(body),/已改变/);assert.equal(JSON.stringify(e.s.testOverrides),before);}});
test('curve application detects unseen homepage profile edits on fresh GET',async()=>{const {e,body}=await curveFixture();body.values.stage2=2.6875;e.mock.workflow.steps[0].temperature='94';await assert.rejects(e.h.applyCurveEditorDraft(body),/已改变/);assert.equal(e.s.testOverrides,null);});
test('curve rejects busy shot, missing verification and concurrent edits',async()=>{for(const change of [e=>e.s.phase='stage2',e=>e.s.runtimeProfileVerified=false,e=>e.s.curveApplyBusy=true]){const {e,body}=await curveFixture();body.values.stage2=2.6875;change(e);const before=e.writes().length;await assert.rejects(e.h.applyCurveEditorDraft(body));assert.equal(e.writes().length,before);}});
test('curve editor rejects invalid shapes, bounds and nonnumeric payloads before storage',async()=>{for(const modify of [b=>b.values.stage2=NaN,b=>b.values.stage1=9,b=>b.values.mid='0.7',b=>{b.shaped=true;b.values.early=.10;b.values.mid=.75},b=>b.values.earlySeconds=31,b=>b.values.late=.75]){const {e,body}=await curveFixture();modify(body);await assert.rejects(e.h.applyCurveEditorDraft(body));assert.equal(e.s.testOverrides,null);}});
test('manual curve overrides old-run auto suggestions but allows a new completed run to learn',async()=>{const {e,body}=await curveFixture();const run=evidenceRun(e,'old');e.s.diagnosticLast=run;body.values.stage2=2.6875;const timer=e.s.autoApplyTimer=12345;e.timers.set(timer,{fn(){throw Error('stale timer')},ms:250});await e.h.applyCurveEditorDraft(body);assert.equal(e.s.autoApplyTimer,null);assert(e.h.manualCurveBlocksRun(run));assert(!e.h.manualCurveBlocksRun({...run,runId:'new'}));await assert.rejects(e.h.applyNextShotAdaptiveSuggestion(run,'auto'),/手动曲线/);const count=e.writes().length;await e.h.autoApplyNextShotIfEligible(run);assert.equal(e.writes().length,count);const stored=copy(e.s.testOverrides);e.s.testOverrides=copy(stored);assert(e.h.manualCurveBlocksRun(run));});
test('failed curve upload rolls back overrides and retains LUT',async()=>{const {e,body}=await curveFixture();body.values.stage2=2.6875;let failed=false;e.mock.fail=p=>p==='/machine/profile'&&!failed?(failed=true,'upload denied'):null;await assert.rejects(e.h.applyCurveEditorDraft(body),/upload denied/);assert.equal(e.s.testOverrides,null);assert.equal(e.h.commandFlowSummary().stage2CommandMlS,2.507);assert.equal(e.mock.workflow.steps[1].flow,'2.5');assert.equal(e.s.curveApplyBusy,false);assert(e.s.calibrationMap.valid);});
function curveUi(){const e=setup(),html=e.h.buildGhcOverlayHtml(),script=html.slice(html.indexOf('let curveLatest='),html.indexOf('function paint(x)'));const ids=['curveeditorchart','curvepoints','curveparams','curvestatus','curveshowcurrent','curveshowdraft','curveshape','curveselected','curvetimes','curveapply','curveup','curvedown','curvereset'];const els={};for(const id of ids)els[id]={innerHTML:'',checked:true,textContent:'',disabled:false,querySelectorAll(){return []},setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){},getBoundingClientRect(){return {top:0,height:232}}};const ctx=vm.createContext({Number,Math,JSON,$:id=>els[id]||null,post:async()=>{throw Error('no UI writes in preview')},loadDiag:async()=>{}});vm.runInContext(script+"\nglobalThis.ui={applyCurveDraft,renderCurveEditor,curveNudge,curveSetValue,curveReset,curveTime,curveShapeToggle,get:()=>({draft:curveDraft,dirty:curveDirty}),select:i=>curveSelected=i};",ctx);const snap=copy(e.h.curveEditorSnapshot());snap.canApply=true;ctx.ui.renderCurveEditor(snap);return {e,ctx,ui:ctx.ui,els,snap};}
test('curve controls nudge one native quantum and preserve dirty draft across refresh',()=>{const {ui,els,snap}=curveUi();ui.select(1);ui.curveNudge(1);assert.equal(ui.get().draft.values.stage2,2.5625);assert(ui.get().dirty);assert.equal(els.curveapply.disabled,false);ui.renderCurveEditor(snap);assert.equal(ui.get().draft.values.stage2,2.5625);assert.match(els.curveparams.innerHTML,/2.5625/);assert.match(els.curvepoints.innerHTML,/S3 后/);});
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
test('Chinese static page labels have no untranslated English prose outside technical names and units',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml().replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<div id="hx-language"[\s\S]*?<\/div>/,'');for(const m of html.matchAll(/>([^<>]+)</g)){const text=e.h.translateUiText(m[1].trim(),'zh'),rest=text.replace(/HyperEx Pulse Filter|HyperEx|HYPEREX|Decaid|DE1|RAW|LUT|ACK|CSV|CANVAS|SVG|JSON|GHC|A0[0-9A-F]+|S[123]|g\/s|ml\/s|dW\/dt|weightFlow|skipStep|GET|workflow|bar|ms|ml|mm|CV|R²|v0\.1\.\d+|°C/g,'');assert(!/[A-Za-z]{3,}/.test(rest),text);}});

test('missing S2 in a newer valid history row does not hide an earlier matching S2 cup',()=>{const e=setup(),a=controlledRun(e,'older'),b=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(a);disableGainMemory(e);const gap=copy(e.s.adaptiveHistory[0]);gap.runId='gap';gap.s2=null;e.s.adaptiveHistory.push(gap);const q=e.h.nextShotAdaptiveSuggestion(b);assert.equal(q.s2.action,'ADJUST',q.s2.reason);assert.equal(q.s2.historySearch.matchedRunId,'older');assert.equal(q.s2.historySearch.missingStage,1);assert(q.s2.suggestedCommandMlS>2.5);assert(q.s2.suggestedCommandMlS-2.5<=0.12*2.5+1e-6);});
test('history lookup skips incompatible context, command and unverified disk rows to find valid session evidence',()=>{const e=setup(),r=controlledRun(e,'older'),current=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(r);const base=copy(e.s.adaptiveHistory[0]);const command=copy(base);command.runId='other-command';command.s2.command=3;const context=copy(base);context.runId='other-lut';context.fingerprint.actualFlowMultiplier=1.1;const disk=copy(base);disk.runId='unverified-disk';disk.restoredFromDisk=true;e.s.persistentHistoryAvailable=false;e.s.adaptiveHistory.push(command,context,disk);const result=e.h.matchingAdaptiveEvidenceSearch(e.h.stage2AdaptiveEvidence(current),'s2');assert.equal(result.matchedRunId,'other-command');assert.equal(result.checked,3);assert.equal(result.skippedStorage,1);assert.equal(result.skippedContext,1);assert.equal(result.nearbyCommandComparisons,1);assert.equal(result.evidence.originalCommandMlS,3);});
test('S3 also finds earlier same-shape evidence across a row lacking S3',()=>{const e=setup(),a=controlledRun(e,'older',true),b=controlledRun(e,'current',true);e.h.rememberAdaptiveEvidence(a);const gap=copy(e.s.adaptiveHistory[0]);gap.runId='gap';gap.s3=null;e.s.adaptiveHistory.push(gap);const q=e.h.nextShotAdaptiveSuggestion(b);assert.equal(q.s3.historySearch.matchedRunId,'older');assert.equal(q.s3.historySearch.missingStage,1);assert(q.s3.repeatCount===2);});
test('no comparable S2 falls back to the physical steady-tail gain instead of waiting',()=>{const e=setup(),r=controlledRun(e,'current');e.s.adaptiveHistory=[{runId:'empty',profileTruthSchema:3,fingerprint:copy(e.h.adaptiveHistoryFingerprint()),s1:{}}];const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s2.action,'LUT COMPENSATE');assert.equal(q.s2.historySearch.matchedRunId,null);assert.equal(q.s2.historySearch.missingStage,1);assert(q.s2.suggestedCommandMlS>2.507);assert(q.s2.suggestedCommandMlS-2.507<=.35);});

test('earlier valid S2 evidence survives a missing-stage row through automatic upload and final workflow verification',async()=>{const e=setup(),a=controlledRun(e,'older'),b=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(a);disableGainMemory(e);const gap=copy(e.s.adaptiveHistory[0]);gap.runId='gap';gap.s2=null;e.s.adaptiveHistory.push(gap);const lut=JSON.stringify(e.s.calibrationMap);await e.h.autoApplyNextShotIfEligible(b);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(e.h.commandFlowSummary().stage2CommandMlS,2.625);assert.equal(e.mock.workflow.steps[1].flow,'2.625');assert(e.h.runtimeProfileTruthPayload().verified);assert.equal(JSON.stringify(e.s.calibrationMap),lut);});

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
test('history exclusion preserves coffee mode across reload and LUT point edits, but not across a new LUT identity',()=>{const {e,r,row}=storedReviewFixture();e.s.cfg.basketContext='coffee';e.h.setLearningHistoryReview({runId:r.runId,excluded:true,reason:'other'});assert.equal(e.s.cfg.basketContext,'coffee');e.s.cfg.basketContext='empty';e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'coffee');e.s.calibrationMap.points[0].commandFlow+=.01;e.s.pendingHistoryWrite=null;e.s.runtimeProfileVerified=true;e.s.machineProfileAckKey='verified';e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'coffee');e.s.calibrationMap.createdAt='changed-lut-identity';e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'empty');});
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
test('S2 startup boost and return keep the ordinary trim baseline in sync',async()=>{const e=await pulseFixture();await trimTick(e);assert.equal(e.s.liveTrim.commands[1],2.5625);trimAck(e);e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);assert.equal(e.s.liveTrim.commands[1],2.5);});
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
test('§22.11 a sub-quantum S1 correction holds the command instead of faking a step',()=>{const e=continuousSetup(),a=correctedS1(e,'a'),b=correctedS1(e,'b');for(const r of [a,b])r.rawScaleSamples.filter(x=>x.phase==='stage1').forEach(x=>x.weightG*=.8);e.h.rememberAdaptiveEvidence(a);disableGainMemory(e);const q=e.h.nextShotAdaptiveSuggestion(b);assert(q);assert.equal(q.s1.action,'HOLD');assert.equal(q.s1.suggestedCommandMlS,q.s1.currentCommandMlS);assert.equal(Math.round(q.s1.currentCommandMlS*16),q.s1.currentCommandMlS*16);});
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
test('one clean Normal S2 miss immediately produces bounded verified NEXT SHOT adaptation',async()=>{const e=normalEnv(),r=fixedOutcome(e);e.s.runtimeProfileVerified=true;e.mock.workflow=copy(e.h.profileObject());const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s2.action,'ADJUST');assert.equal(q.s2.repeatCount,1);assert(q.s2.suggestedCommandMlS>2.5);assert(q.s2.suggestedCommandMlS<=2.8125+1e-6);await e.h.autoApplyNextShotIfEligible(r);assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(e.h.commandFlowSummary().stage2Origin,'adaptive');assert(e.s.runtimeProfileVerified);});
test('three cups remain on disk across reloads and dynamically improve a fixed synthetic process',async()=>{let e=normalEnv();e.s.cfg.basketContext='coffee';prepareDisk(e);e.h.persistHistoryFile();e.flushReads();await e.h.syncHyperExProfile(true);const flows=[],commands=[];for(let cup=0;cup<3;cup++){
 e.advance(1000);e.s.cfg.adaptiveLearningLevel='正常';const c=e.h.commandFlowSummary(),plant=Math.round(c.stage2CommandMlS*16)/16*1.4;flows.push(plant);commands.push(c.stage2CommandMlS);e.h.startDiagnostics('hyperex');const active=e.s.diagnosticCurrent,r=fixedOutcome(e,'fixture',plant);active.rawScaleSamples=copy(r.rawScaleSamples);active.samples=copy(r.samples);Object.assign(active.config,{stage3Shape:copy(c.s3Shape),stage3CommandMlS:c.stage3CommandMlS});active.rawScaleSamples.filter(x=>x.phase==='stage3').forEach(x=>x.profileFrame=2);active.samples.forEach(x=>{x.targetFlowMlS=x.phase==='stage1'?c.stage1CommandMlS:x.phase==='stage2'?c.stage2CommandMlS:c.stage3CommandMlS;x.machineFlowMlS=x.targetFlowMlS;x.machineAgeMs=0;x.machineTelemetryValid=true});e.h.finalizeDiagnostics('completed at 100 g');disableGainMemory(e);const done=e.s.diagnosticLast,id=done.runId;e.flushReads();assert.equal(e.h.historyPersistenceAudit(id).currentRunReadbackVerified,true);assert.equal(JSON.parse(e.storage.adaptiveHistoryFileV2).shots.length,cup+1);const q=e.h.nextShotAdaptiveSuggestion(done);assert.equal(q.s2.action,'ADJUST');assert(q.s2.suggestedCommandMlS>c.stage2CommandMlS);await e.h.autoApplyNextShotIfEligible(done);e.flushReads();assert.equal(e.s.autoApplyLastStatus.status,'applied');assert.equal(e.h.commandFlowSummary().stage2Origin,'adaptive');if(cup<2){e=await reloadDisk(e);assert.equal(e.s.persistentHistoryAvailable,true);assert.equal(e.s.persistentHistoryFile.shots.length,cup+1);assert(e.s.adaptiveHistory.some(x=>x.s2));}}
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
test('S3 policy keeps each frame inside the one-step floor and the adjacent-rise cap',()=>{const e=normalEnv();for(const level of ['保守','温和','正常','激进']){e.s.cfg.adaptiveLearningLevel=level;const r=syntheticRun(e,'shape',[2.4,1.8,1.1]);r.config.adaptiveLearningLevel=level;const a=e.h.stage3AdaptiveEvidence(r);if(level==='保守')e.h.rememberAdaptiveEvidence({...r,runId:'prior'});const q=e.h.nextShotAdaptiveSuggestion(r).s3;if(!q.suggestedShape)continue;const p=e.h.learningPolicy(level),values=[q.suggestedShape.earlyCommand,q.suggestedShape.midCommand,q.suggestedShape.lateCommand];values.forEach((x,i)=>{assert(Math.abs(x-a.source[i].command)<=Math.max(p.s3[1],1/16)+.001);if(i)assert(x<=Math.max(values[i-1]+.25,values[i-1]*1.35)+.001);});}});
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
// The raw window rises at `flow` g/s. §22.11 cutoff semantics: the return needs the
// LEAD-COMPENSATED cup flow to reach the cup target; cutoffPercent only sets the
// observed noise floor (0.6 x). A steady-rate witness therefore predicts its own
// rate and can never end a refill on its own.
function refillRamp(e,flow){refillSamples(e,flow);}
async function confirmRefillReturn(e,cmd){
 const t=e.s.liveTrim;
 if(!Number.isFinite(Number(cmd)))cmd=t.pending?Number(t.pending.command):Number(e.s.cfg.stage2Flow);
 // The return write completes on its driver ACK (the target echo is optional
 // corroboration, not the handoff condition). Advance first so the fixture ends
 // exactly 50 ms before the handover opens, like the real ACK path.
 e.advance(900);e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();
 pulseTarget(e,cmd);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:cmd,flow:cmd,pressure:1,substate:'pouring'});
 trimAck(e);
 assert.equal(t.startup.status,'complete','refill return must complete on its driver ACK');
}
async function returnedRefill(e,flow=4.3,floodSlope=6){
 const t=e.s.liveTrim;
 // The 1 s raw window is clipped at frameAt, so the fixture has to sit past the
 // first second before a ramp can produce a usable fit.
 await trimTick(e);trimAck(e);e.advance(1500);
 refillRamp(e,floodSlope);await trimTick(e);
 if(t.startup.plan.boundedModel===true){
  assert.equal(t.startup.status,'bleeding','a bounded refill bleeds before writing the platform');
  assert.equal(t.pending.startupAction,'bleed');
  trimAck(e);e.advance(700);e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();
  await trimTick(e);
 }
 assert.equal(t.pending&&t.pending.startupAction,'return','the refill must hand over to the platform');
 await confirmRefillReturn(e,t.pending.command);
 refillSamples(e,flow);
}
// §22.11 two-step handoff fixtures on the BOUNDED path: boost ACKed and the cup
// flow climbing, so the next tick must bleed before any platform write.
async function boostingFixture(r=1.29){
 const e=await refillLoopEnv(r),t=e.s.liveTrim;
 e.s.lastMachineTelemetryValid=true;e.s.lastMachineState='espresso';e.s.lastSubstate='pouring';
 e.s.lastPressure=1;e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();e.s.lastFlow=.1;
 await trimTick(e);trimAck(e);e.advance(1500);
 assert.equal(t.startup.status,'boosting','bounded refill must issue its flood write');
 return {e,t};
}
async function bleedFixture(r=1.29){
 const {e,t}=await boostingFixture(r);
 refillRamp(e,6);await trimTick(e);
 assert.equal(t.startup.status,'bleeding','a bounded refill must bleed before the platform write');
 assert.equal(t.pending.startupAction,'bleed');
 return {e,t};
}
test('active-release refill arms without clean prior cups or disk consensus',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.persistentHistoryLoaded=false;e.s.storageProbeVerified=false;
 const p=e.h.stage2StartupPlan();assert(p.enabled);assert.equal(p.strategy,'refill-85');assert.equal(p.cutoffFraction,.85);assert.equal(p.holdMs,4000);assert.equal(p.predictionSeconds,1.5);assert(p.boostCommandMlS>p.baseCommandMlS);assert.equal(p.sourceRunIds.length,0);
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
// Replaces the old "returns when the measured flow reaches 85%" handover test,
// which encoded the superseded cutoff semantics. cutoffPercent is now the
// observed noise floor; the return needs the lead-compensated flow at target.
test('refill cutoff needs the lead-compensated cup flow to reach the target',async()=>{
 const e=await refillFixture(),t=e.s.liveTrim;
 await trimTick(e);trimAck(e);e.advance(1500);
 refillSamples(e,4.3);await trimTick(e);
 assert.equal(t.startup.status,'boosting','a steady 4.3 g/s window clears the noise floor but predicts only 86%, not 100%');
 assert.equal(rawWrites(e).length,1);
 refillRamp(e,6);await trimTick(e);
 const c=t.report.startupExecution.cutoff;
 assert.equal(c.thresholdGS,5*t.startup.plan.cutoffFraction,'cutoffPercent still records the cup-flow noise floor');
 assert(c.rawGS>=c.thresholdGS*.6);
 assert(c.decisionGS>=t.run.config.stage2Flow);
 assert.equal(t.startup.status,'returning');
 assert.equal(rawWrites(e).length,2);
});
test('refill forecast uses 2s predicted cup flow and can return before measured85 percent',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(1300);refillSamples(e,3.4);await trimTick(e);assert.equal(rawWrites(e).length,1);
 e.advance(300);refillSamples(e,4.1);await trimTick(e);assert.equal(rawWrites(e).length,2);const c=e.s.liveTrim.report.startupExecution.cutoff;assert(c.rawGS<4.25);assert(c.predictedGS>=4.25);assert(c.decisionGS>=4.25);
});
// The wild-extrapolation guard survives, but the threshold it guards moved from
// "observed >= 85%" to the cutoff noise floor (0.6 x 85%).
test('refill refuses a wild prediction while observed cup flow is below the cutoff noise floor',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(1500);refillSamples(e,2.0);const t=e.s.liveTrim,end=e.now()-t.run.startedAtMs;
 t.startup.lastEstimate={slope:0,stamp:100+end/1000-1.1};const before=rawWrites(e).length;const reason=e.h.s2RefillReturnReason(t);
 assert.equal(reason,null,'observed 2.0 g/s is below 0.6 x 4.25 even though the extrapolation is wild');assert.equal(rawWrites(e).length,before);
});
// §22.11 invariant: the platform is target/r with the LEARNED r (r may be > 1),
// and the flood is the safety envelope. Neither may be derived from the other.
test('§22.11 bounded refill platform is target/r and the flood is the safety envelope',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:140,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
 e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:5.5,desiredGS:5,origin:'manual'}}};
 const prior=evidenceRun(e,'plat-prior');prior.config.stage2Flow=5;prior.config.stage2LutCommandMlS=2.507;prior.samples=[];
 e.s.diagnosticLast=prior;
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,buckets:[{id:'g1',center:.3,radius:.12,stages:{s2:{r:1.29,n:4,lastRunId:'plat-prior'}}}],lastBucketId:'g1'}};
 const p=e.h.stage2StartupPlan();
 assert(p.enabled,p.reason);assert.equal(p.boundedModel,true);assert.equal(p.baseCommandMlS,5.5);
 assert.equal(p.controlSource,'gain-memory');
 assert.equal(p.controlBaseMlS,3.875);
 assert.equal(p.refillPumpBaseMlS,3.875);
 assert.equal(p.returnCommandMlS,3.875);
 assert(p.returnCommandMlS<5,'r>1 must place the platform below the numeric target');
 assert.equal(p.floodCommandMlS,7);
 assert.equal(p.boostCommandMlS,7);
 assert(p.boostCommandMlS>=7,'the measured 0.7 s rise floor needs >=7.0 ml/s');
 assert.equal(p.flowCutoffGS,4.25);
 assert.equal(p.returnCommandMlS*16,Math.round(p.returnCommandMlS*16));
});
test('bounded S2 refill is default and legacy refill remains selectable',()=>{
 const e=setup();assert.equal(e.h.loadConfig({}).s2RefillBoundedModel,true);assert.equal(e.h.loadConfig({S2RefillBoundedModel:false}).s2RefillBoundedModel,false);
});
test('bounded S2 refill lowers its command as predicted cup flow approaches the cutoff',async()=>{
 const e=await refillFixture();e.s.cfg.s2RefillBoundedModel=true;e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:140,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
 const p=e.h.stage2StartupPlan();e.s.liveTrim.startup={status:'boosting',plan:p};refillSamples(e,1.5);const low=e.h.boundedRefillCommand(e.s.liveTrim);
 refillSamples(e,5.0);const high=e.h.boundedRefillCommand(e.s.liveTrim);
 assert(low>=p.controlBaseMlS&&low<=p.refillMaxCommandMlS);assert(high>=p.controlBaseMlS);assert(high<=low);assert(high<=8);
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
// Safety gate, unchanged in force: the return write is not exempt from the 2 s
// driver-ACK deadline just because the cutoff fired early on the prediction.
test('refill return driver ACK has its own2second deadline after early cutoff',async()=>{
 const e=await refillFixture();await trimTick(e);trimAck(e);e.advance(1500);refillRamp(e,6);await trimTick(e);
 assert.equal(e.s.liveTrim.pending.startupAction,'return');e.advance(2000);await e.run(e.s.liveTrim.startupAckTimer);assert.equal(e.s.phase,'aborted');
});
test('refill return ACK completes the refill and never stacks another boost',async()=>{
 const e=await refillFixture();await returnedRefill(e);const t=e.s.liveTrim;
 assert.equal(t.startup.status,'complete');
 const boosts=()=>t.report.trace.filter(x=>x.kind==='write'&&x.startupAction==='boost').length;
 assert.equal(boosts(),1);
 e.advance(5000);e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();await trimTick(e);
 assert.equal(boosts(),1,'a completed refill never stacks a second boost');
});
// §22.11 bleeding state: the first half of the two-step handoff. These are the
// safety paths that the mirror-style tests never covered.
test('§22.11 a bleed write without a driver ACK is failed by the refill watchdog',async()=>{
 const {e,t}=await bleedFixture();const n=rawWrites(e).length;
 e.advance(t.startup.plan.holdMs+2500);e.run(t.startupWatchdog);
 assert.equal(e.s.phase,'aborted');
 assert(e.calls.some(x=>x.path==='/machine/state/idle'),'a stuck bleed must idle the machine');
 assert.equal(rawWrites(e).length,n,'the stuck bleed must not be followed by a platform write');
});
test('§22.11 a frame change during bleed ends the refill without writing the platform',async()=>{
 const {e,t}=await bleedFixture();const n=rawWrites(e).length;
 e.s.lastFrame=2;e.h.observeLiveTrimMachine({profileFrame:2});await trimTick(e);
 assert.equal(t.startup.status,'frame-ended');
 assert.equal(t.report.startupExecution.status,'frame-ended');
 assert.equal(rawWrites(e).length,n,'no write may target the previous frame');
});
test('§22.11 the watchdog renews an ACKed bleed twice then fails the platform return',async()=>{
 const {e,t}=await bleedFixture();trimAck(e);
 for(let i=1;i<=2;i++){
  e.advance(1500);e.run(t.startupWatchdog);
  assert.equal(e.s.phase,'stage2','renewal '+i+' must not abort a recovering shot');
  assert.equal(t.startup.watchdogExtensions,i);
  assert(t.startupWatchdog,'renewal '+i+' must reschedule the watchdog');
 }
 e.advance(1500);e.run(t.startupWatchdog);
 assert.equal(e.s.phase,'aborted','the third expiry fails the platform return');
 assert.equal(t.startup.watchdogExtensions,2);
});
test('§22.11 a protective return (pressure or stale scale) still bleeds and hands back the lower platform',async()=>{
 for(const kind of ['pressure','stale']){
  const {e,t}=await boostingFixture();
  refillRamp(e,4);e.s.lastMachineAtMs=e.now();
  if(kind==='pressure'){e.s.lastPressure=5.5;e.s.latestScaleAtMs=e.now();}else{e.s.latestScaleAtMs=e.now()-5000;}
  await trimTick(e);
  assert.match(t.startup.returnReason,kind==='pressure'?/pressure/:/scale became stale/,kind);
  assert.equal(t.startup.status,'bleeding','even a protective return stops the flood first: '+kind);
  assert.equal(t.pending.command,t.startup.plan.bleedCommandMlS,kind);
  trimAck(e);e.advance(700);e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();
  await trimTick(e);
  assert.equal(t.pending.startupAction,'return',kind);
  assert.equal(t.pending.command,Math.min(t.startup.plan.controlBaseMlS,t.startup.plan.baseCommandMlS),'a protective return never raises the pump above the running profile: '+kind);
 }
});
test('§22.11 a stale scale during bleed still returns on the bleed timer',async()=>{
 const {e,t}=await bleedFixture();trimAck(e);
 e.advance(700);e.s.latestScaleAtMs=e.now()-5000;e.s.lastMachineAtMs=e.now();
 await trimTick(e);
 assert.equal(t.pending.startupAction,'return','the 700 ms bleed must not wait for a fresh scale window');
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
 let row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(row.handoverActive,false,'the default handover window has elapsed');assert.equal(row.targetGS,5);assert.equal(row.finalTargetGS,5);
 if(e.s.liveTrim.pending){trimAck(e);pulseTarget(e,e.s.liveTrim.pending.command);e.advance(60);await trimTick(e);}
 e.advance(4000);trimSamples(e,4.4);await trimTick(e);row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(row.targetGS,5,'the cup target never drops after the cutoff');
});
// Replaces the old "200 ms approach" test, whose only assertion
// (row.approachFraction === 1) is a constant in the current code. The real
// handover state is handoverProgress inside approachMs, with the cup target held.
test('refill handover stays active for approachMs and keeps the full cup target',async()=>{
 const e=await configurableRefill({approachMs:6000});await returnedRefill(e);e.advance(400);trimSamples(e,3.9);await trimTick(e);
 const row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];
 assert.equal(row.handoverActive,true,'400 ms into a 6 s handover is still active');
 assert(row.handoverProgress>0&&row.handoverProgress<1,row.handoverProgress);
 assert.equal(row.targetGS,5,'the handover never ramps the cup target down to the cutoff percentage');
});
test('S2 refill transient does not enter steady-level machine coverage or normalization',()=>{
 const e=normalEnv(),r=startupRun(e,'refill-learning',.5,2,4);r.config.experimentalLiveTrim=true;r.config.adaptiveLearningLevel='正常';r.config.s2StartupPlan={strategy:'refill-85'};
 r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'},{kind:'write',frame:1,tMs:2500,commandMlS:2.5,startupAction:'return'},{kind:'startup-complete',frame:1,tMs:2700,strategy:'refill-85'}]};
 r.samples.forEach(x=>{x.targetFlowMlS=x.tMs<2500?3.5:2.5;x.machineFlowMlS=x.targetFlowMlS;});
 const q=e.h.controlLearningAssessment(r,'stage2');assert.equal(q.refillExcludedUntilMs,3500);assert(q.eligible,q.reason);assert(q.frames.every(x=>x.windows.every(w=>w.startMs>=3500)));
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


// P1-3 test helper: stageGainEstimate reads the filtered adaptive history,
// not the raw persistent shot list. Rows may carry evidence.{s2,s3} or s2/s3.
function gainHist(e,rows){e.s.adaptiveHistory=(rows||[]).map(s=>({runId:s.runId,profileTruthSchema:3,fingerprint:copy(e.h.adaptiveHistoryFingerprint()),s2:s.s2||(s.evidence&&s.evidence.s2),s3:s.s3||(s.evidence&&s.evidence.s3)}));}

test('steady-gain estimate uses median cup/command from recent S2 evidence',()=>{
 const e=setup();gainHist(e,[
  {runId:'ga',evidence:{s2:{runId:'ga',targetGS:5,command:3.6,measured:4.0}}},
  {runId:'gb',evidence:{s2:{runId:'gb',targetGS:5,command:3.7,measured:4.1}}},
  {runId:'gc',evidence:{s2:{runId:'gc',targetGS:5,command:3.8,measured:4.2}}}
 ]);
 const g=e.h.stageGainEstimate('s2',null,null);assert(g);assert.equal(g.samples,3);assert(Math.abs(g.k-1.111)<.01);assert(g.spread<.02);assert.deepEqual(copy(g.sources),['ga','gb','gc']);
});
test('steady-gain estimate uses duration-weighted S3 frames and acts from two shots',()=>{
 const rows=[];for(let i=0;i<3;i++)rows.push({runId:'s'+i,evidence:{s3:{runId:'s'+i,targetGS:1.5,overallGS:1.6,source:[{command:.6,measured:1.6,seconds:10},{command:.72,measured:1.7,seconds:14},{command:.78,measured:1.8,seconds:12}]}}});
 const e=setup();gainHist(e,rows);const g=e.h.stageGainEstimate('s3',null,null);assert(g);assert.equal(g.samples,3);assert(Math.abs(g.k-1.6/.7)<.15);assert(g.command>.65&&g.command<.75);
 const e2=setup();gainHist(e2,rows.slice(0,2));const g2=e2.h.stageGainEstimate('s3',null,null);assert(g2);assert.equal(g2.samples,2);
});
test('steady-gain UI exposes S2 and S3 feed-forward values',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml();assert.match(html,/稳态增益 k/);assert.match(html,/targetCommandMlS/);});
test('steady-gain feed-forward rewrites the S2 suggestion only with three agreeing shots',()=>{
 const e=setup(),run=controlledRun(e,'ff-apply');run.config.adaptiveLearningLevel='正常';
 const row=(id)=>({runId:id,evidence:{s2:{runId:id,targetGS:5,command:2.5,measured:3.5}}});
 gainHist(e,[row('g1'),row('g2'),row('g3')]);
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert(q.s2.gainFeedForward);assert.equal(q.s2.gainFeedForward.applied,true);assert(q.s2.suggestedCommandMlS>run.config.stage2CommandMlS);
 assert.match(q.s2.reason,/steady-gain feed-forward/);
});
test('steady-gain feed-forward stays inactive when recent ratios disagree',()=>{
 const e=setup(),run=controlledRun(e,'ff-noisy');
 const row=(id,m)=>({runId:id,evidence:{s2:{runId:id,targetGS:5,command:2.5,measured:m}}});
 gainHist(e,[row('n1',2.5),row('n2',4.5),row('n3',3.0)]);
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert(q.s2.gainFeedForward);assert.equal(q.s2.gainFeedForward.applied,false);
});
test('steady-gain feed-forward can act on two agreeing shots',()=>{
 const e=setup(),run=controlledRun(e,'ff-two');run.config.adaptiveLearningLevel='正常';
 gainHist(e,[{runId:'t1',evidence:{s2:{runId:'t1',targetGS:5,command:2.5,measured:3.5}}}]);
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert.equal(q.s2.gainFeedForward.samples,2);assert.equal(q.s2.gainFeedForward.applied,true);
});
test('two disagreeing shots keep feed-forward off',()=>{
 const e=setup(),run=controlledRun(e,'ff-two-bad');run.config.adaptiveLearningLevel='正常';
 gainHist(e,[{runId:'t1',evidence:{s2:{runId:'t1',targetGS:5,command:2.5,measured:3.0}}}]);
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
test('S3 projection keeps a drift wish instead of dragging frames into a monotonic line',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常'),old=[.813,.813,.813],q=e.h.projectS3Commands([.878,.8,.77],old,p,[8,14,18]);
 assert.deepEqual(copy(q),[.878,.8,.77]);
});
test('S3 single-shot publishes the raw non-monotonic wish on the step grid',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常'),c={targetGS:1.5,overallGS:1.6,status:'STABLE',earlySeconds:8,midSeconds:14,source:[1.1,1.65,1.8].map((measured,i)=>({name:['EARLY','MID','LATE'][i],command:.813,measured,r2:.999,seconds:[8,14,18][i]}))};
 const q=e.h.stage3SingleSuggestion(c,null,p);assert(q.rawProposedCommands[0]>.813);assert(q.rawProposedCommands[2]<.813);const sh=q.suggestedShape;assert(sh);
 assert(sh.earlyCommand>sh.midCommand);assert(sh.midCommand>=sh.lateCommand);
 assert(Math.abs(sh.earlyCommand-.888)<=.001);assert(Math.abs(sh.lateCommand-.738)<=.001);
});
test('S3 projection floors every step at one 1/16 ml/s unit and only caps adjacent rises',()=>{
 const e=normalEnv();for(const level of ['保守','温和','正常','激进']){const p=e.h.learningPolicy(level);for(let k=0;k<200;k++){
  const old=[.698,.72,.778],want=old.map((v,i)=>v+.2*Math.sin(k*1.7+i*2.1)),q=e.h.projectS3Commands(want,old,p,[5,13,12]);
  q.forEach((v,i)=>{assert(Math.abs(v-old[i])<=Math.max(p.s3[1],1/16)+.001);if(i)assert(v<=Math.max(q[i-1]+.25,q[i-1]*1.35)+.001);});
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
 assert(e.h.s3ShapeStatus?e.h.s3ShapeStatus().enabled:e.h.commandFlowSummary().s3Shape.enabled);assert.equal(e.h.profileObject().steps.length,5);assert.deepEqual(copy(e.h.profileObject().steps.slice(2).map(x=>+x.flow)),[.8125,.8125,.8125]);const html=e.h.buildGhcOverlayHtml();assert.match(html,/FLAT \(3 timed frames\)/);assert.match(html,/commandModeLabel\(s3.mode,s3.origin,s3.shape\)/);
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
const refillDefaults={basis:"pump-command",startDelayMs:0,targetPercent:160,cutoffPercent:85,maxDurationMs:4000,approachMs:800,floodMaxMlS:7,floodMode:"fixed"};
async function editorReady(){const e=normalEnv();await e.h.syncHyperExProfile(true);return e;}
function editedRefill(e,patch){const d=copy(e.h.curveEditorSnapshot());d.refill={...d.refill,...patch};return d;}
async function configurableRefill(patch){const e=await refillFixture();e.s.s2RefillSettings={...refillDefaults,...patch};const t=e.s.liveTrim,plan=e.h.stage2StartupPlan();t.startup={status:'armed',plan};t.run.config.s2StartupPlan=copy(plan);pulseTarget(e,plan.baseCommandMlS);return e;}
test('S2 editable defaults use160percent pump with unchanged timing and cutoff',()=>{const e=normalEnv();assert.deepEqual(copy(e.h.currentS2RefillSettings()),refillDefaults);e.s.cfg.liveFlowTrimTest=true;const p=e.h.stage2StartupPlan();assert.deepEqual(copy(p.settings),refillDefaults);assert.equal(p.startDelayMs,0);assert.equal(p.refillTargetFraction,1.6);assert.equal(p.cutoffFraction,.85);assert.equal(p.holdMs,4000);assert.equal(p.approachMs,800);});
test('S2 refill timeline reports frame, onset, return and the S2 overlap',()=>{
 const e=normalEnv(),r=startupRun(e,'timeline',1,2,4);r.events=[{name:'stage2_start',tMs:0}];r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:600,startupAction:'boost',commandMlS:2.507},{kind:'startup-boost-ended',frame:1,tMs:4000}]};
 e.s.cfg.liveFlowTrimTest=true;const tl=e.h.diagnosticSummary(r).s2RefillTimeline;
 assert(tl.onsetMs>500);assert.equal(tl.relative.onsetS,Math.round(tl.onsetMs/10)/100);assert.equal(tl.relative.returnS,4);assert(tl.overlap&&Math.abs(tl.overlap.seconds-(4000-tl.onsetMs)/1000)<.01);
});
test('cup-flow cutoff accepts30to99percent bounds',()=>{
 const e=normalEnv();assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:30}).cutoffPercent,30);assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:99}).cutoffPercent,99);assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:29}),/allowed range/);assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,cutoffPercent:100}),/allowed range/);
});
test('refill UI lists the S2/refill node timeline and overlap',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/S2 补水节点/);assert.match(html,/S2 与补水重叠/);assert.match(html,/id="refillnodes"/);assert.match(html,/data-refill-basis/);
});
test('all S2 editor boundaries and steps are validated on server',()=>{const e=normalEnv(),ranges={startDelayMs:[0,1500,50],targetPercent:[100,160,1],cutoffPercent:[30,99,1],maxDurationMs:[500,4000,100],approachMs:[200,6000,100]};for(const [key,[lo,hi,step]]of Object.entries(ranges)){for(const value of [lo,hi])assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,[key]:value})[key],value);for(const value of [lo-step,hi+step,lo+step/2,NaN,Infinity,null,'120'])assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,[key]:value}),/allowed range/,key+':'+value);}assert.throws(()=>e.h.validatedS2RefillSettings([]));});
test('configured target changes estimated refill command but retains hard limits',()=>{const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,targetPercent:140};const p=e.h.stage2StartupPlan();assert.equal(p.refillTargetGS,undefined);assert.equal(p.boostCommandMlS,3.5);assert(p.boostCommandMlS<=Math.min(8,p.baseCommandMlS*1.6));assert(p.maximumExtraCommandMl<=8);});
test('100percent refill target does not force an unnecessary extra flow quantum',()=>{const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.s2RefillSettings={...refillDefaults,targetPercent:100};const p=e.h.stage2StartupPlan();assert.equal(p.enabled,false);assert.match(p.reason,/no extra command/);});
test('configurable start delay is relative to confirmed S2 frame and sends no earlier write',async()=>{const e=await configurableRefill({startDelayMs:1000}),t=e.s.liveTrim;await trimTick(e);assert.equal(rawWrites(e).length,0);e.advance(750);refillSamples(e,1);await trimTick(e);assert.equal(rawWrites(e).length,0);e.advance(250);refillSamples(e,1);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(t.startup.status,'boosting');});
test('stale/missing S2 frame cannot be treated as configured early start permission',async()=>{const e=await configurableRefill({startDelayMs:0});e.s.lastFrame=0;await trimTick(e);assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.startup.status,'armed');});
test('configured70percent cutoff lowers the noise floor but not the5gpersecond return target',async()=>{
 const e=await configurableRefill({cutoffPercent:70});await trimTick(e);trimAck(e);e.advance(1500);
 refillSamples(e,3.6);await trimTick(e);
 assert.equal(rawWrites(e).length,1,'observed 3.6 clears the 2.1 floor but the lead-compensated flow is below 5');
 refillRamp(e,6);await trimTick(e);
 const c=e.s.liveTrim.report.startupExecution.cutoff;
 assert.equal(c.thresholdGS,5*e.s.liveTrim.startup.plan.cutoffFraction);assert(c.decisionGS>=5);assert.equal(rawWrites(e).length,2);
});
test('configured90percent cutoff does not return at the old85percent boundary',async()=>{const e=await configurableRefill({cutoffPercent:90});await trimTick(e);trimAck(e);e.advance(1500);refillSamples(e,4.3);await trimTick(e);assert.equal(rawWrites(e).length,1);e.advance(250);refillSamples(e,4.6);await trimTick(e);assert.equal(rawWrites(e).length,2);assert.equal(e.s.liveTrim.report.startupExecution.cutoff.thresholdGS,4.5);});
test('configured500ms duration has independent return timer while checks continue',async()=>{const e=await configurableRefill({maxDurationMs:500});await trimTick(e);trimAck(e);assert.equal(e.timers.get(e.s.liveTrim.startupReturnTimer).ms,500);e.advance(500);e.s.lastMachineAtMs=e.now();await e.run(e.s.liveTrim.startupReturnTimer);assert.equal(rawWrites(e).length,2);});
test('runtime rejects a modified frozen refill duration beyond its validated setting',async()=>{const e=await configurableRefill({});e.s.liveTrim.startup.plan.holdMs=100000;assert.equal(await e.h.dispatchS2Startup(e.s.liveTrim,'boost'),false);assert.equal(rawWrites(e).length,0);assert.match(e.s.liveTrim.startup.blockReason,/settings invalid/);});
test('configured cutoff does not reduce actual cup target during handover',async()=>{const e=await configurableRefill({cutoffPercent:70,approachMs:6000});await returnedRefill(e,3.6);e.advance(1700);trimSamples(e,3.5);await trimTick(e);const r=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];assert.equal(r.handoverActive,true);assert.equal(r.targetGS,5);assert(r.handoverProgress>0&&r.handoverProgress<1);assert.equal(r.finalTargetGS,5);});
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
test('refill slider labels translate consistently in both UI languages',()=>{const e=normalEnv();for(const [zh,en] of [['S2 补水','S2 early refill'],['启动延时','Start delay'],['基础泵流量倍率','Base pump flow multiplier'],['收回 / 收口起点','Cutoff / taper start'],['最长补水','Maximum refill duration'],['渐进至100%时间','Approach100% duration']]){assert.equal(e.h.translateUiText(zh,'en'),en);assert.equal(e.h.translateUiText(en,'zh'),zh);}});
function numericCurveUi(){
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function curveLimits('),b=html.indexOf('const refillControlFields',a),elements={};
 const values={stage1:.719,stage2:2.507,early:.813,mid:.813,late:.813,earlySeconds:8,midSeconds:14};
 const scope={curveDraft:{shaped:true,values:copy(values)},curveLatest:{shaped:true,values:copy(values)},curveSelected:2,curveKeys:['stage1','stage2','early','mid','late'],curveBusy:false,curveDirty:false,curveInputInvalid:false,Number,Math,JSON,curveSame(a,b){return JSON.stringify(a)===JSON.stringify(b);},renderCurveEditor(){},$(id){return elements[id]||(elements[id]={textContent:'',disabled:false,setCustomValidity(s){this.validityMessage=s;}});}};
 vm.createContext(scope);vm.runInContext(html.slice(a,b),scope);return {scope,elements,run:code=>vm.runInContext(code,scope)};
}
test('§22.11 curve numeric entry snaps typed values to the 1/16 ml/s driver grid',()=>{const x=numericCurveUi();x.run('curveSelected=2;curveEnterValue("0.698");curveSelected=3;curveEnterValue("0.720");curveSelected=4;curveEnterValue("0.778");');const v=copy(x.scope.curveDraft.values);assert.equal(v.early,.6875);assert.equal(v.mid,.75);assert.equal(v.late,.75);[v.early,v.mid,v.late].forEach(q=>assert.equal(Math.round(q*16),q*16));assert.equal(x.scope.curveInputInvalid,false);assert.equal(x.scope.curveDirty,true);});
test('§22.11 dragging snaps the draft to the driver grid instead of keeping a nonnative decimal',()=>{const x=numericCurveUi();x.run('curveSelected=2;curveSetValue(.701);');assert.equal(x.scope.curveDraft.values.early,.6875);assert.equal(Math.round(x.scope.curveDraft.values.early*16),11);});
test('numeric curve out-of-range or invalid entry is rejected without mutating draft',()=>{
 for(const raw of ['8.1','-1','','NaN']){const x=numericCurveUi(),before=JSON.stringify(x.scope.curveDraft);x.scope.raw=raw;x.run('curveSelected=1;curveEnterValue(raw);');assert.equal(JSON.stringify(x.scope.curveDraft),before);assert.equal(x.scope.curveInputInvalid,true);assert.equal(x.elements.curveapply.disabled,true);}
});
test('numeric curve entry lets EARLY sit above MID and still rejects an out-of-bound value',()=>{
 const x=numericCurveUi();x.run('curveSelected=2;curveEnterValue("0.900");');assert.equal(x.scope.curveDraft.values.early,.875);assert.equal(x.scope.curveInputInvalid,false);
 x.run('curveEnterValue("8.1");');assert.equal(x.scope.curveInputInvalid,true);
});
test('one-step nudge moves one actual quantum after the draft is snapped',()=>{const x=numericCurveUi();x.run('curveSelected=0;curveDraft.values.stage1=.698;curveNudge(-1);');assert.equal(Math.round(x.scope.curveDraft.values.stage1*16),10);x.run('curveNudge(1);');assert.equal(Math.round(x.scope.curveDraft.values.stage1*16),11);});
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
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();assert.match(html,/request=bounded\?upper:refillBase\*r\.targetPercent\/100/);assert.match(html,/基础泵流量倍率/);assert.doesNotMatch(html,/baseCommand\+2|goal\*r.targetPercent\/100/);assert.equal(e.h.translateUiText('基础泵流量倍率','en'),'Base pump flow multiplier');assert.equal(e.h.curveEditorSnapshot().refillLimits.targetPercent[1],160);
});

test('driver dispatch accepts greater-than-plus2 pump boost and returns original base',async()=>{
 const e=await refillFixture();e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:4,desiredGS:5,origin:'manual'}}};const t=e.s.liveTrim;t.profile.steps[1].flow='4.000';t.commands[1]=4;t.startup={status:'armed',plan:e.h.stage2StartupPlan()};assert.equal(await e.h.dispatchS2Startup(t,'boost'),true);assert.equal(t.pending.command,6.375);const payload=JSON.parse(rawWrites(e)[0].payload.data).payload;assert.equal(parseInt(payload.slice(4,6),16)/16,6.375);trimAck(e);e.advance(1500);refillSamples(e,4.3);assert.equal(await e.h.dispatchS2Startup(t,'return'),true);assert.equal(t.pending.command,4);
});
test('rendered pump preview matches server command while the cutoff shows the noise floor',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function renderRefillEditor()'),b=html.indexOf('function renderCurveEditor(',a),elements={},inputs={};
 const get=id=>elements[id]||(elements[id]={textContent:'',innerHTML:'',disabled:false});
 const box=get('curverefill');box.querySelector=q=>inputs[q]||(inputs[q]={});box.querySelectorAll=q=>[];
 const scope={esc:String,$:get,curveDraft:{refill:copy(refillDefaults),values:{stage2:4}},curveLatest:{targetGS:{stage2:5},refillLimits:{targetPercent:[100,160,1]},canApply:true,refillActive:true},curveBusy:false,renderRefillHistory(){},refillControlFields:[['startDelayMs','启动延时','s'],['targetPercent','基础泵流量倍率','%'],['cutoffPercent','收回 / 收口起点','%'],['maxDurationMs','最长补水','s'],['approachMs','渐进至100%时间','s']],Math,Number};
const derivedText='派生：实测 ≥ 51% 目标（≈ 2.55 g/s）+ 预测 ≥ 目标（5.00 g/s）才收回；下调会同时提前离开满灌（可能拖慢 90° 上升）、降低补水跳过阈值、降低实测噪声底';
 vm.runInNewContext(html.slice(a,b)+';renderRefillEditor();',scope);assert.equal(get('refillvalue-targetPercent').textContent,'160% · 6.3750 ml/s');assert.equal(get('refillvalue-cutoffPercent').textContent,'85 %');assert.equal(get('refillderived').textContent,derivedText);assert.match(get('refillpreviewlabels').innerHTML,/6.3750 ml\/s · 160% 基础泵流量/);assert.doesNotMatch(get('refillpreviewlabels').innerHTML,/估算补水目标/);assert.match(get('refillpreviewlabels').innerHTML,/同时决定收口起点、跳过阈值、实测噪声底/);
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
 const e=await editorReady(),d=editedRefill(e,{approachMs:1500});await assert.rejects(e.h.saveS2RefillSettings({...d,revision:'stale'}));await assert.rejects(e.h.saveS2RefillSettings({...d,refill:{...d.refill,approachMs:1234}}));e.s.phase='stage2';await assert.rejects(e.h.saveS2RefillSettings(d));assert.equal(e.h.currentS2RefillSettings().approachMs,800);
});
test('independent refill write failure keeps current settings and history',async()=>{
 const e=setup({failRefillSave:true});await e.h.syncHyperExProfile(true);const d=editedRefill(e,{approachMs:1500}),before=JSON.stringify(e.s.s2RefillPrevious);await assert.rejects(e.h.saveS2RefillSettings(d));assert.equal(e.h.currentS2RefillSettings().approachMs,800);assert.equal(JSON.stringify(e.s.s2RefillPrevious),before);assert.equal(e.s.curveApplyBusy,false);
});
test('S3 rising tail forecast precedes slower full-window regression',()=>{
 const e=normalEnv(),now=Date.now(),r={startedAtMs:now-3000,rawScaleSamples:[]};e.s.phase='stage3';
 for(let i=0;i<=30;i++){const t=i*.1;r.rawScaleSamples.push({phase:'stage3',profileFrame:2,tMs:100+i*100,scaleTimestampSeconds:t,weightG:.8*t+.35*t*t});}
 const reg=e.h.liveTrimRegression({run:r,frame:2,frameAt:now-3000});assert(reg);assert(reg.fastSlope>reg.slope);assert(reg.predicted>reg.fastSlope);
});
test('S3 upward writes wait for the previous trend response, not a fixed interval',async()=>{const e=await trimFixture('stage3');trimSamples(e,1.2);await trimTick(e);assert.equal(rawWrites(e).length,1);assert(e.s.liveTrim.pending);e.advance(300);trimSamples(e,1.2);await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'waiting-for-write-response');});
test('live trim angle stats: zero-degree share and mean angle follow RAW check rows',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2100);trimSamples(e);e.s.liveTrim.report.checks=2000;await trimTick(e);assert.equal(e.s.liveTrim.active,false);assert.equal(e.s.liveTrim.report.zeroDegreeShare,null);assert.equal(e.s.liveTrim.report.meanAngleDeg,null);assert.equal(e.s.liveTrim.report.status,'2000-check-budget-complete');});
test('live trim angle stats: learning assessment exposes the check-to-check trend angle per stage',async()=>{const e=await trimFixture();e.s.liveTrim.run.config.experimentalLiveTrim=true;e.s.liveTrim.run.liveFlowTrim={trace:[{kind:'check',tMs:1000,rawGS:5,targetGS:5},{kind:'check',tMs:1300,rawGS:5,targetGS:5},{kind:'check',tMs:1600,rawGS:5,targetGS:5}],deadbandPct:2};const a=e.h.controlLearningAssessment(e.s.liveTrim.run,'stage2');assert(a.angleStats);assert.equal(a.angleStats.zeroDegreeShare,1);assert(a.angleStats.meanAngleDeg<2);e.s.liveTrim.run.liveFlowTrim={trace:[{kind:'check',tMs:1000,rawGS:4,targetGS:5},{kind:'check',tMs:1300,rawGS:4,targetGS:5}],deadbandPct:2};const b=e.h.controlLearningAssessment(e.s.liveTrim.run,'stage2');assert.equal(b.angleStats.zeroDegreeShare,0);assert(b.angleStats.meanAngleDeg>89&&b.angleStats.meanAngleDeg<91);});
test('sustained same-direction angles raise the vector step ceiling',async()=>{const f=await trimFixture();await trimTick(f);for(let i=0;i<3;i++){trimAck(f);f.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});f.advance(300);trimSamples(f,4);await trimTick(f);}assert(f.s.liveTrim.report.sameSignStreak>=3);assert(f.s.liveTrim.report.bigAngleStreak>=3);const w=f.s.liveTrim.report.trace.filter(x=>x.kind==='write');assert(w.slice(-1)[0].commandMlS>2.6);assert(w.every(x=>x.commandMlS<=3));});
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
test('2.2.32 version is consistent across manifest runtime and generated page',()=>{
 const e=setup(),m=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','manifest.json')));
  assert.equal(m.version,'2.2.32');assert.equal(e.plugin.version,'2.2.32');
  assert.equal(e.h.calibrationStatusPayload().pluginVersion,'2.2.32');
  assert.match(e.h.buildGhcOverlayHtml(),/HYPEREX v2\.2\.32/);
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

function setStage2CupSlope(r,flow,start=8,base=10){
 const rows=r.rawScaleSamples.filter(x=>x.phase==='stage2').sort((a,b)=>Number(a.tMs)-Number(b.tMs));
 for(const x of rows)x.weightG=base+(Number(x.tMs)/1000-start)*flow;
}
function setStage2Targets(r,value){
 for(const x of r.samples)if(x.phase==='stage2')x.targetFlowMlS=value;
}
function setStage2Regime(r,pressure,flow){
 for(const x of r.samples.filter(x=>x.phase==='stage2')){x.pressureBar=pressure;x.machineFlowMlS=flow;}
}
test('gain memory creates a bucket from S2 late resistance and maps the next-shot base',()=>{
 const e=setup(),r=controlledRun(e,'gm-low');e.s.cfg.basketContext='coffee';
 const gm=e.h.updateGainMemoryFromRun(r,{});assert(gm);assert.equal(gm.status,'updated');assert.equal(gm.bucketCreated,true);
 const mem=e.h.gainMemoryState(false);assert.equal(mem.buckets.length,1);assert(Math.abs(mem.buckets[0].center-.2)<.02);
 const stage=gm.stages.s2;assert.equal(stage.status,'updated');assert(stage.observedR>1.2&&stage.observedR<1.6,stage.observedR);assert.equal(stage.confidence,'LOW');
 const q=e.h.gainMemorySuggestion(r,'s2');assert(q);assert.equal(q.bucketId,mem.buckets[0].id);assert.equal(q.confidence,'LOW');
 assert(q.commandMlS>2.5&&q.commandMlS<4);assert.equal(q.applied,false);
});
test('gain memory keeps low and high resistance in separate buckets with hysteresis',()=>{
 const e=setup(),low=controlledRun(e,'gm-a');const first=e.h.updateGainMemoryFromRun(low,{});assert.equal(first.bucketCreated,true);
 const high=controlledRun(e,'gm-b');setStage2Regime(high,3.2,5);const second=e.h.updateGainMemoryFromRun(high,{});assert.equal(second.bucketCreated,true);
 assert.notEqual(first.bucketId,second.bucketId);assert.equal(e.h.gainMemoryState(false).buckets.length,2);
 const low2=controlledRun(e,'gm-c');setStage2Regime(low2,.55,2.507);const third=e.h.updateGainMemoryFromRun(low2,{});assert.equal(third.bucketCreated,false);assert.equal(third.bucketId,first.bucketId);
});
test('gain memory uses cup flow per actual command so a wrong base does not pollute r',()=>{
 const e=setup(),r=controlledRun(e,'gm-wrong');r.config.stage2CommandMlS=5.88;setStage2CupSlope(r,7.2);setStage2Targets(r,3);
 const gm=e.h.updateGainMemoryFromRun(r,{});assert.equal(gm.stages.s2.status,'updated');assert(Math.abs(gm.stages.s2.observedR-7.2/3)<.1);
 const q=e.h.gainMemorySuggestion(r,'s2');assert(q);assert(q.commandMlS<5.88);assert(Math.abs(q.commandMlS-5/(7.2/3))<.2);
});
test('a large gain deviation lowers confidence and uses the current-shot local estimate',()=>{
 const e=setup(),a=controlledRun(e,'gm-d1');e.h.updateGainMemoryFromRun(a,{});
 const b=controlledRun(e,'gm-d2');setStage2CupSlope(b,6.0);setStage2Targets(b,2.507);const gm=e.h.updateGainMemoryFromRun(b,{});
 assert(gm.stages.s2.deviationPct>15);assert.equal(gm.stages.s2.alpha,.55);
 const q=e.h.gainMemorySuggestion(b,'s2');assert(q);assert.equal(q.local,true);assert(Math.abs(q.r-6/2.507)<.05);assert(q.commandMlS<2.6);
});
test('gain-memory backfill is slow for normal live-trim cups and fast after rescue',()=>{
 const e=setup(),a=controlledRun(e,'gm-bf-a');e.h.updateGainMemoryFromRun(a,{});
 const b=controlledRun(e,'gm-bf-b');b.liveFlowTrim={trace:[],normalWrites:2,rescueWrites:0};
 const normal=e.h.updateGainMemoryFromRun(b,{});assert.equal(normal.stages.s2.alpha,.12);
 const c=controlledRun(e,'gm-bf-c');c.liveFlowTrim={trace:[],normalWrites:2,rescueWrites:1};
 const rescue=e.h.updateGainMemoryFromRun(c,{});assert.equal(rescue.stages.s2.alpha,.5);
});
test('S3 drift shape accepts early above MID and late below MID and derives profile commands',()=>{
 const e=setup(),o=seedOverride(e,'empty');o.s3Shape={enabled:true,model:'drift',midCommand:.72,earlyFactor:1.4,drift:.9,earlySeconds:8,midSeconds:14};e.s.testOverrides=o;
 const st=e.h.s3ShapeStatus();assert(st.enabled);assert.equal(st.model,'drift');assert.equal(st.earlyCommand,1.008);assert.equal(st.midCommand,.72);assert.equal(st.lateCommand,.648);assert.equal(st.earlyFactor,1.4);assert.equal(st.drift,.9);
 assert.deepEqual(copy(e.h.profileObject().steps.slice(2).map(x=>+x.flow)),[1,.75,.625]);
});
test('S3 drift model is the default and legacy three-command shape remains selectable',()=>{
 const e=setup();assert.equal(e.h.loadConfig({}).s3DriftModel,true);assert.equal(e.h.loadConfig({S3DriftModel:false}).s3DriftModel,false);
});
test('S3 drift learner turns per-frame gain ratios into earlyFactor and late drift',()=>{
 const e=setup(),r=syntheticRun(e,'drift',[1.0,1.8,1.5]);r.config.s3DriftModel=true;
 const ev=e.h.stage3AdaptiveEvidence(r),d=e.h.driftShapeSuggestion(r,ev,null,e.h.learningPolicy('正常'));
 assert(d);assert.equal(d.model,'drift');assert(d.earlyFactor>1);assert(d.drift>1);assert.equal(d.midCommand,.6875);assert.equal(d.earlyCommand,Math.round(d.midCommand*d.earlyFactor*16)/16);
});
test('next-shot drift proposal is attached and auto-applies a drift-model profile',async()=>{
 const e=setup({roundtrip:true});e.s.cfg.s3DriftModel=true;e.s.runtimeProfileVerified=true;e.s.workflowTitle=e.s.cfg.profileTitle;e.mock.workflow=copy(e.h.profileObject());
 const r=syntheticRun(e,'drift-apply',[1.0,1.8,1.5]);r.config.s3DriftModel=true;r.config.adaptiveLearningLevel='正常';const ev=e.h.stage3AdaptiveEvidence(r);const direct=e.h.driftShapeSuggestion(r,ev,null,e.h.learningPolicy('正常'));assert(direct);const q=e.h.nextShotAdaptiveSuggestion(r);
 assert(q.s3.driftShape,JSON.stringify({direct:!!direct,s3:q.s3}));assert.equal(q.s3.action,'DRIFT + LEVEL');
 await e.h.autoApplyNextShotIfEligible(r);assert.equal(e.s.autoApplyLastStatus.status,'applied');
 assert.equal(e.s.testOverrides.s3Shape.model,'drift');assert(e.s.testOverrides.s3Shape.drift>1);
});
test('S3 drift model measures EARLY after its transition half instead of the whole frame',()=>{
 const e=setup(),r=controlledRun(e,'drift-early',true);r.config.stage3Shape={...r.config.stage3Shape,model:'drift'};
 r.config.s3DriftModel=false;const legacy=e.h.stage3StabilityDiagnostics(r).shapeFrames[0].samples;
 r.config.s3DriftModel=true;const drift=e.h.stage3StabilityDiagnostics(r).shapeFrames[0].samples;
 assert(drift<legacy);assert(drift>=6);
});
test('manual S3 drift endpoint stores factors, derives commands and verifies the profile',async()=>{
 const {e}=await curveFixture();const r=await e.plugin.__httpRequestHandler({endpoint:'test-command-set',body:{stages:{stage2:{mode:'keep',command:e.h.commandFlowSummary().stage2CommandMlS}},s3Shape:{enabled:true,model:'drift',midCommand:.72,earlyFactor:1.4,drift:.9,earlySeconds:8,midSeconds:14},revision:e.h.curveEditorRevision()}});
 const j=JSON.parse(r.body);assert.equal(r.status,200,j.error);assert(j.verified);
 const st=e.h.s3ShapeStatus();assert.equal(st.model,'drift');assert.equal(st.earlyCommand,1.008);assert.equal(st.lateCommand,.648);
 assert.deepEqual(copy(e.h.profileObject().steps.slice(2).map(x=>+x.flow)),[1,.75,.625]);
});
test('S3 manual tilt endpoint recomputes factors from the slider and marks the shape manual',async()=>{
 const {e}=await curveFixture();const r=await e.plugin.__httpRequestHandler({endpoint:'test-command-set',body:{stages:{stage2:{mode:'keep',command:e.h.commandFlowSummary().stage2CommandMlS}},s3Shape:{enabled:true,model:'drift',manual:true,manualTilt:1,midCommand:.72,earlyFactor:9,drift:9,earlySeconds:8,midSeconds:14},revision:e.h.curveEditorRevision()}});
 const j=JSON.parse(r.body);assert.equal(r.status,200,j.error);const st=e.h.s3ShapeStatus();
 assert.equal(st.manual,true);assert.equal(st.manualTilt,1);assert.equal(st.earlyFactor,1.45);assert.equal(st.drift,.8);assert.equal(st.earlyCommand,1.044);assert.equal(st.lateCommand,.576);
});
test('diagnostics expose the read-only-by-default S3 manual tilt control',()=>{
 const e=setup(),html=e.h.buildGhcOverlayHtml();
 assert.match(html,/id="s3manual"/);assert.match(html,/id="s3tilt"/);assert.match(html,/min="-1" max="1" step="0.05"/);assert.match(html,/id="s3tilt"[^>]*disabled/);
});
test('automatic application preserves a manual S3 drift lock while S2 still learns',async()=>{
 const e=setup({roundtrip:true});e.s.runtimeProfileVerified=true;e.s.cfg.s3DriftModel=true;e.s.cfg.adaptiveLearningLevel='正常';const o=seedOverride(e,'empty');o.s3Shape={enabled:true,model:'drift',manual:true,manualTilt:1,midCommand:.72,earlyFactor:1.45,drift:.8,earlySeconds:8,midSeconds:14,earlyCommand:1.044,lateCommand:.576};e.s.testOverrides=o;e.mock.workflow=copy(e.h.profileObject());
 const r=fixedOutcome(e,'manual-lock');r.config.adaptiveLearningLevel='正常';r.config.stage3Shape=copy(e.s.testOverrides.s3Shape);const q=e.h.nextShotAdaptiveSuggestion(r);assert.equal(q.s3.action,'MANUAL DRIFT LOCK');assert.equal(q.s3.manualLocked,true);assert(q.s2.action==='ADJUST'||q.s2.action==='LUT COMPENSATE',q.s2.action);
 await e.h.autoApplyNextShotIfEligible(r);assert.equal(e.s.autoApplyLastStatus.status,'applied');
 assert.equal(e.s.testOverrides.s3Shape.manual,true);assert.equal(e.s.testOverrides.s3Shape.manualTilt,1);assert.equal(e.s.testOverrides.s3Shape.midCommand,.72);
});
test('a third resistance regime creates a new bucket instead of folding into either paper',()=>{
 const e=setup(),low=controlledRun(e,'gm-third-a');const a=e.h.updateGainMemoryFromRun(low,{});assert.equal(a.bucketCreated,true);
 const high=controlledRun(e,'gm-third-b');setStage2Regime(high,3.2,5);const b=e.h.updateGainMemoryFromRun(high,{});assert.equal(b.bucketCreated,true);
 const middle=controlledRun(e,'gm-third-c');setStage2Regime(middle,2.25,5);const c=e.h.updateGainMemoryFromRun(middle,{});
 assert.equal(c.bucketCreated,true);assert.notEqual(c.bucketId,a.bucketId);assert.notEqual(c.bucketId,b.bucketId);assert.equal(e.h.gainMemoryState(false).buckets.length,3);
});
test('gain memory survives LUT identity changes because it stores gain ratios',()=>{
 const e=setup(),r=controlledRun(e,'gm-recal');e.h.updateGainMemoryFromRun(r,{});const before=e.h.gainMemoryState(false).buckets[0].stages.s2.r;
 e.s.calibrationMap.createdAt='new-lut-identity';e.h.recomputeCalibrationUsability();const after=e.h.gainMemoryState(false).buckets[0].stages.s2.r;
 assert.equal(after,before);
});
test('gain memory serializes inside the persistent history file and normalizes on reload',()=>{
 const e=setup(),r=controlledRun(e,'gm-persist');e.s.persistentHistoryFile={schema:2,shots:[]};e.h.updateGainMemoryFromRun(r,{});
 const raw=JSON.stringify(e.s.persistentHistoryFile);assert.match(raw,/gainMemory/);
 const parsed=JSON.parse(raw),m=e.h.normalizeGainMemory(parsed.gainMemory);assert.equal(m.buckets.length,1);assert(m.buckets[0].stages.s2.r>1);
});
test('gain memory falls back cleanly when the S2 pressure signature is unavailable',()=>{
 const e=setup(),r=controlledRun(e,'gm-nosig');r.samples=r.samples.filter(x=>x.phase!=='stage2');
 const gm=e.h.updateGainMemoryFromRun(r,{});assert.equal(gm.status,'no-regime');assert.equal(e.h.gainMemorySuggestion(r,'s2'),null);
});
// ---- cut 5 (2.2.12): gain-memory structure (L-4 / L-9 / L-10) -----------------
// Fixture copied from the 2026-11-01 08:30 export (hyperex-history (4).json):
// g2 centre 0.4715 with s2 r=1.2874 n=3 and no s3; g3 centre 0.2997 with s2
// r=1.6304 n=2 and s3 r=1.9421 n=2, drift 0.913. The two 0.12 bands overlap at
// 0.35-0.45, which is the real-data half of L-4.
const REAL_GAIN_MEMORY={schema:1,buckets:[
 {id:'g2',center:.4715,radius:.12,stages:{s2:{r:1.2874,n:3,lastDeviation:.1032,lastObservedR:1.2174,drift:0,lastRunId:'1793492759538-1',updatedAt:'2026-11-01T00:27:10.802Z'}},createdAt:'2026-10-31T16:04:19.330Z',updatedAt:'2026-11-01T00:27:10.802Z'},
 {id:'g3',center:.2997,radius:.12,stages:{s2:{r:1.6304,n:2,lastDeviation:.018,lastObservedR:1.6449,drift:0,lastRunId:'1793490122135-1',updatedAt:'2026-10-31T23:43:16.381Z'},s3:{r:1.9421,n:2,lastDeviation:.0675,lastObservedR:2.0056,drift:.913,lastRunId:'1793490122135-1',updatedAt:'2026-10-31T23:43:16.381Z'}},createdAt:'2026-10-31T23:33:40.088Z',updatedAt:'2026-10-31T23:43:16.381Z'}],
 seq:3,lastBucketId:'g2',updatedAt:'2026-11-01T00:27:10.802Z'};
function realGainMemory(e){e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:copy(REAL_GAIN_MEMORY)};}
test('L-4 membership is nearest-neighbour so one signature never depends on lastBucketId',()=>{
 const e=setup(),mem=e.h.normalizeGainMemory(copy(REAL_GAIN_MEMORY));
 mem.lastBucketId='g3';const a=e.h.selectGainBucket(mem,.40).bucket;
 mem.lastBucketId='g2';const b=e.h.selectGainBucket(mem,.40).bucket;
 assert(a&&b);assert.equal(a.id,b.id,'0.40 must resolve the same way regardless of history');
 assert.equal(a.id,'g2','0.40 is nearer 0.4715 than 0.2997');
 // The two bands meet at the midpoint (0.3856); either side is a clean partition.
 assert.equal(e.h.selectGainBucket(mem,.3831).bucket.id,'g3');
 assert.equal(e.h.selectGainBucket(mem,.3881).bucket.id,'g2');
});
test('L-4 a stage missing from the active bucket is borrowed cross-bucket and marked stale',()=>{
 const e=setup(),r=controlledRun(e,'gm-cross');realGainMemory(e);
 setStage2Regime(r,1.179,2.5); // pressure/flow = 0.4716 -> g2, which has no s3
 const q=e.h.gainMemorySuggestion(r,'s3');
 assert(q,'s3 memory must not fall back to the LUT');
 assert.equal(q.activeBucketId,'g2');assert.equal(q.bucketId,'g3');
 assert.equal(q.fallback,'cross-bucket');assert.equal(q.stale,true);
 assert.equal(q.r,1.9421);assert.equal(q.drift,.913);
 const s2=e.h.gainMemorySuggestion(r,'s2');
 assert.equal(s2.bucketId,'g2');assert.equal(s2.fallback,null,'a stage present in the active bucket is never borrowed');
});
test('L-4 the bucket centre is the sliding median of the signatures it has seen',()=>{
 const e=setup(),ids=[];
 for(const [p,id] of [[.5,'gm-med-a'],[.55,'gm-med-b'],[.6,'gm-med-c']]){
  const r=controlledRun(e,id);setStage2Regime(r,p,2.5);ids.push(e.h.updateGainMemoryFromRun(r,{}));
 }
 const mem=e.h.gainMemoryState(false);assert.equal(mem.buckets.length,1);
 assert.equal(mem.buckets[0].center,.22,'median(0.20,0.22,0.24) is 0.22, not the mean or the last; got '+mem.buckets[0].center+' samples='+JSON.stringify(mem.buckets[0].samples)+' ids='+JSON.stringify(ids.map(x=>[x.bucketId,x.bucketCreated,x.absorbed,x.signature])));
 assert.equal(mem.buckets[0].samples.length,3);assert.equal(ids[2].signatureSamples,3);
 assert.equal(mem.buckets[0].radius,.08,'the radius follows the measured spread');
});
test('L-4 eviction is LRU by updatedAt and never drops the active bucket',()=>{
 const e=setup(),buckets=[];
 for(let i=0;i<12;i++)buckets.push({id:'g'+(i+1),center:+(0.2+i*0.13).toFixed(4),radius:.12,stages:{s2:{r:1.3,n:3,lastObservedR:1.3,lastDeviation:0}},createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-'+String(i+1).padStart(2,'0')+'T00:00:00.000Z'});
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,buckets,seq:12,lastBucketId:'g5',updatedAt:'2026-10-12T00:00:00.000Z'}};
 const r=controlledRun(e,'gm-lru');setStage2Regime(r,5,2.5); // signature 2.0 -> new regime
 const gm=e.h.updateGainMemoryFromRun(r,{});assert.equal(gm.bucketCreated,true);
 const mem=e.h.gainMemoryState(false);assert.equal(mem.buckets.length,12);
 assert(!mem.buckets.some(x=>x.id==='g1'),'g1 has the oldest updatedAt');
 assert(mem.buckets.some(x=>x.id===gm.bucketId));assert(mem.buckets.some(x=>x.id==='g5'));
});
test('L-9 r outside [0.2,3] is dropped on load with a reason and never applied',()=>{
 const e=setup();
 const mem=e.h.normalizeGainMemory({buckets:[{id:'g1',center:.3,radius:.12,stages:{s2:{r:4.2,n:3},s3:{r:.1,n:2}}}]});
 assert.equal(mem.buckets.length,0);assert.equal(mem.dropped.length,2);
 assert.match(mem.dropped[0].reason,/0\.2/);assert.match(mem.dropped[1].reason,/3/);
 const edge=e.h.normalizeGainMemory({buckets:[{id:'g1',center:.3,stages:{s2:{r:.2,n:1},s3:{r:3,n:1}}}]});
 assert.equal(edge.buckets.length,1);assert.equal(edge.buckets[0].stages.s2.r,.2);assert.equal(edge.buckets[0].stages.s3.r,3);
 const src=fs.readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert.equal((src.match(/r>=\.2&&r<=3/g)||[]).length,0,'no second literal copy of the r range');
 assert.equal((src.match(/GAIN_R_MIN=\.2/g)||[]).length,1);
 assert.equal((src.match(/GAIN_R_MAX=3;/g)||[]).length,1);
});
test('L-10 the gain numerator and denominator share the final 60 percent window',()=>{
 const e=setup(),r=controlledRun(e,'gm-window');
 for(const x of r.samples.filter(s=>s.phase==='stage2')){const v=Number(x.tMs)<19000?5:3;x.targetFlowMlS=v;x.machineFlowMlS=v;}
 const gm=e.h.updateGainMemoryFromRun(r,{});assert.equal(gm.stages.s2.status,'updated');
 const rows=r.samples.filter(x=>x.phase==='stage2');const t0=Number(rows[0].tMs),t1=Number(rows[rows.length-1].tMs);
 const pick=(from)=>rows.filter(x=>Number(x.tMs)>=t0+(t1-t0)*from).map(x=>Number(x.targetFlowMlS)).sort((a,b)=>a-b);
 const at=(list)=>list[Math.floor((list.length-1)/2)];
 const tail=e.h.controlOutputQuality(r,'stage2').tailMeanGS;
 const expected60=at(pick(.4)),expected40=at(pick(.6));
 assert.equal(expected60,5);assert.equal(expected40,3);
 const observed=gm.stages.s2.observedR;
 assert(Math.abs(observed-tail/expected60)<.002,'r must divide by the 60% median: '+observed+' vs '+(tail/expected60));
 assert(Math.abs(observed-tail/expected40)>.05,'the old 40% denominator would give a different r');
 assert.equal(gm.stages.s2.window.startPct,40);
});
test('r records the command band it was measured in and flags a cross-band reuse',()=>{
 const e=setup(),r=controlledRun(e,'gm-band');
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,buckets:[{id:'g1',center:.2,radius:.12,stages:{s3:{r:1,n:4,lastObservedR:1,lastDeviation:0,commandBand:'3.0-4.0'}}}],lastBucketId:'g1'}};
 const wide=e.h.gainMemorySuggestion(r,'s3');
 assert.equal(wide.commandBand,'3.0-4.0');assert.equal(wide.currentBand,'1.0-2.0');assert.equal(wide.crossBand,true);
 e.s.persistentHistoryFile.gainMemory.buckets[0].stages.s3.r=.4;
 const same=e.h.gainMemorySuggestion(r,'s3');
 assert.equal(same.currentBand,'3.0-4.0');assert.equal(same.crossBand,false);
});

// ---- cut 5 第二轮（2.2.20）P2-3：没有观测的杯子不能改桶几何 --------------------
function seedGainBucket(e,opts={}){
  const bucket={id:'g1',center:opts.center==null?0.3:opts.center,radius:opts.radius==null?0.12:opts.radius,samples:opts.samples||[.29,.3,.31],
    stages:{s2:{r:1.3,n:3,lastObservedR:1.3,lastDeviation:0,commandMlS:2.5,commandBand:'2.0-3.0',lastRunId:'seed',updatedAt:'2026-10-01T00:00:00.000Z'}},
    createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'};
  e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,buckets:[bucket],seq:1,lastBucketId:'g1',updatedAt:'2026-10-01T00:00:00.000Z'}};
  e.h.gainMemoryState(false); // legacy stages normalize null->0 on the first pass
  return e.h.gainMemoryState(false); // second pass is the byte-stable fixture form
}
test('P2-3 a completed cup with no S2/S3 observation leaves the existing bucket byte-identical',()=>{
  const e=setup(),r=controlledRun(e,'gm-r2-noobs');
  const mem=seedGainBucket(e);const before=JSON.stringify(mem.buckets[0]);const lastBucketId=mem.lastBucketId,memoryUpdatedAt=mem.updatedAt;
  r.config.stage2CommandOrigin='manual'; // S2 observation refused; evidence {} has no S3 source
  const gm=e.h.updateGainMemoryFromRun(r,{});
  assert.equal(gm.status,'no-observation',JSON.stringify(gm.stages));
  const after=e.h.gainMemoryState(false);
  assert.equal(after.buckets.length,1);
  assert.equal(JSON.stringify(after.buckets[0]),before,'samples/center/radius/updatedAt must not move');
  assert.equal(after.lastBucketId,lastBucketId);assert.equal(after.updatedAt,memoryUpdatedAt);
  assert.equal(r.gainMemoryBucketId,undefined,'a no-observation cup must not claim a bucket');
});
test('P2-3 a no-observation cup never leaves a new scratch bucket behind',()=>{
  const e=setup(),r=controlledRun(e,'gm-r2-new');seedGainBucket(e);
  setStage2Regime(r,5,2.5); // signature 2.0, far from g1 at 0.3
  r.config.stage2CommandOrigin='manual';
  const gm=e.h.updateGainMemoryFromRun(r,{});
  assert.equal(gm.status,'no-observation');
  const mem=e.h.gainMemoryState(false);
  assert.equal(mem.buckets.length,1);assert.equal(mem.buckets[0].id,'g1');
  assert.equal(mem.lastBucketId,'g1');
});
test('P2-3 a cup with a valid observation still commits its signature into the bucket',()=>{
  const e=setup(),r=controlledRun(e,'gm-r2-ok');setStage2Regime(r,.5,2.5); // signature exactly 0.2
  const mem=seedGainBucket(e,{center:.3,samples:[.3]});const before=JSON.stringify(mem.buckets[0]);
  const gm=e.h.updateGainMemoryFromRun(r,{});
  assert.equal(gm.status,'updated');assert.equal(gm.stages.s2.status,'updated');
  const after=e.h.gainMemoryState(false),b=after.buckets[0];
  assert.equal(b.samples.length,2);assert(b.samples.includes(.2),JSON.stringify(b.samples));
  assert(Math.abs(b.center-.25)<.0002,'median(0.3,0.2) = 0.25');
  assert.notEqual(JSON.stringify(b),before);
  assert.equal(after.lastBucketId,'g1');assert(b.updatedAt&&b.updatedAt!=='2026-10-01T00:00:00.000Z');
});
test('S3 gain memory records MID r and late/mid drift without changing the shape yet',()=>{
 const e=setup(),r=controlledRun(e,'gm-s3',true);const ev=e.h.stage3AdaptiveEvidence(r);assert(ev);
 const gm=e.h.updateGainMemoryFromRun(r,{s3:ev});assert.equal(gm.stages.s3.status,'updated');assert(gm.stages.s3.drift>0);
 const q=e.h.gainMemorySuggestion(r,'s3');assert(q);assert(q.drift>0);assert.equal(q.applied,false);
});
test('2.2.28 next-shot adaptive uses the gain-memory base when it is local/cross-band/high-confidence',async()=>{
 const e=setup({roundtrip:true}),a=controlledRun(e,'gm-apply-a');e.h.rememberAdaptiveEvidence(a);
 const b=controlledRun(e,'gm-apply-b'),q=e.h.nextShotAdaptiveSuggestion(b);
 // 2.2.28: a local/cross-band/high-confidence memory is the base; the reverse
 // stays a bounded correction. The old prior-only path let a stale k override.
 assert(q.s2.gainMemory);assert.equal(q.s2.gainMemory.role,'base');assert.equal(q.s2.gainMemory.applied,true);
 assert.equal(q.s2.action,'ADJUST');assert(Number.isFinite(q.s2.suggestedCommandMlS));
 assert.equal(q.s2.gainMemory.band,q.s2.gainMemory.commandBand);
 await e.h.autoApplyNextShotIfEligible(b);
 assert.equal(e.s.autoApplyLastStatus.status,'applied');
 assert.equal(Number(e.s.testOverrides.stages.stage2.command),q.s2.suggestedCommandMlS);
});
test('gain memory is written with the persistent history file and survives reload normalization',()=>{
 const e=setup();e.s.persistentHistoryLoaded=true;e.s.storageProbeVerified=true;e.s.persistentHistoryAvailable=true;e.s.persistentHistoryFile={schema:2,shots:[]};
 const r=controlledRun(e,'gm-disk');e.h.rememberAdaptiveEvidence(r);e.flushReads();
 const stored=JSON.parse(e.storage.adaptiveHistoryFileV2);assert(stored.gainMemory);assert.equal(stored.gainMemory.buckets.length,1);
 const memory=e.h.normalizeGainMemory(stored.gainMemory);assert.equal(memory.buckets.length,1);assert(memory.buckets[0].stages.s2.r>1);
});
test('predictive S2 respects the 1.2s physical write silence',async()=>{
 const e=await predictiveTrimFixture();
 await trimTick(e);assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.normalWrites,1);
 trimAck(e);e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,flow:2.6});
 e.advance(944);trimSamples(e);await trimTick(e);
 assert.equal(rawWrites(e).length,1);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'predictive-write-silence');
 e.advance(300);trimSamples(e);await trimTick(e);
 assert(rawWrites(e).length>=2);assert(e.s.liveTrim.report.silenceHolds>=1);
});
test('predictive live trim is the default and legacy remains selectable for rollback',()=>{
 const e=setup();assert.equal(e.h.loadConfig({}).liveTrimDecisionModel,true);assert.equal(e.h.loadConfig({LiveTrimDecisionModel:false}).liveTrimDecisionModel,false);
});
test('predictive regression uses S2 1.5s and S3 1.2s forecast horizons with the S3 robust window',async()=>{
 const s2=await predictiveTrimFixture('stage2'),r2=s2.h.liveTrimRegression(s2.s.liveTrim);
 assert(r2);assert.equal(r2.predictive,true);assert.equal(r2.windowMs,1600);assert.equal(r2.horizon,1.5);
 const s3=await predictiveTrimFixture('stage3'),r3=s3.h.liveTrimRegression(s3.s.liveTrim);
 assert(r3);assert.equal(r3.predictive,true);assert.equal(r3.windowMs,3000);assert.equal(r3.horizon,1.2);
});
function setTrimWeights(e,weights,dt=.2){
 const frame=Number(e.s.lastFrame),phase=e.s.phase,t=e.s.liveTrim;
 e.s.latestScaleAtMs=e.now();e.s.lastMachineAtMs=e.now();e.s.lastMachineTelemetryValid=true;
 e.s.lastMachineState='espresso';e.s.lastSubstate='pouring';e.s.lastPressure=1;e.s.lastFlow=2.5;
 const end=e.now()-t.run.startedAtMs;
 t.run.rawScaleSamples=weights.map((w,i)=>({phase,profileFrame:frame,tMs:end-(weights.length-1-i)*dt*1000,weightG:w,scaleTimestampSeconds:100+end/1000-(weights.length-1-i)*dt,tareReset:false}));
}
test('§22.4 T-1 a missing tail fit falls back to the regression slope, never 0 g/s',async()=>{
 const e=await predictiveTrimFixture('stage2');
 setTrimWeights(e,[0,.5,1,1.5,2,2.4,2.3,2.5]);
 const reg=e.h.liveTrimRegression(e.s.liveTrim);
 assert(reg,'the overall fit still passes on a ramp that flattens');
 assert.equal(reg.fastSlope,null,'the flat tail has no positive fast slope');
 assert.equal(reg.predicted,null,'no extrapolation without a fast fit');
 await trimTick(e);
 const row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];
 assert.equal(row.predictedGS,row.rawGS,'decisionGS must fall back to reg.slope, not Number(null)=0');
 assert(row.predictedErrorPct<99,'a missing forecast must not read as a 100% error');
});
test('§22.4 T-2 the forecast extrapolates both directions and is capped at 0.6x target',async()=>{
 const e=await predictiveTrimFixture('stage2'),target=Number(e.s.cfg.stage2Flow);
 setTrimWeights(e,[0,.15,.35,.7,1.2,1.9,2.8,3.8]);
 const up=e.h.liveTrimRegression(e.s.liveTrim);
 assert(up&&up.fastSlope>up.slope,'the accelerating fixture keeps a fast slope');
 assert(up.predicted>up.fastSlope,'a rising trend still forecasts upward');
 assert(Math.abs(up.predicted-up.fastSlope)<=.6*target+1e-9,'rising move capped at 0.6x target, got '+(up.predicted-up.fastSlope));
 setTrimWeights(e,[0,1.2,2.2,3.0,3.6,4.0,4.2,4.3]);
 const down=e.h.liveTrimRegression(e.s.liveTrim);
 assert(down&&down.fastSlope!==null,'the decelerating fixture still has a fast slope');
 assert(down.predicted<down.fastSlope,'a falling trend must be extrapolated downward too');
 assert(Math.abs(down.predicted-down.fastSlope)<=.6*target+1e-9,'falling move capped at 0.6x target');
});
async function innerLoopEnv(){
 const e=await predictiveTrimFixture('stage2'),t=e.s.liveTrim;
 t.commands={};t.pending=null;t.retry=null;t.lastWriteAt=null;t.report.trace.length=0;t.report.writes=0;
 e.s.liveTrimTimer=null;
 return e;
}
async function innerClosedLoop(e,{totalMs=9000,stepMs=50,tickEvery=5,dipAt=3500,dip=1.2}={}){
 const t=e.s.liveTrim,target=Number(e.s.cfg.stage2Flow),startMs=t.run.startedAtMs;
 const cmds=[];let mach=2.4,cup=.6,weight=0,elapsed=0,step=0,seen=rawWrites(e).length,lastCmd=2.4;
 const scale=[],curve=[];
 while(elapsed<totalMs){
  const all=rawWrites(e);
  for(let i=seen;i<all.length;i++){const cmd=parseInt(JSON.parse(all[i].payload.data).payload.slice(4,6),16)/16;cmds.push({atMs:elapsed,cmd,cup,prevCmd:lastCmd});lastCmd=cmd;trimAck(e);}
  seen=all.length;
  let goal=2.4;for(const w of cmds)if(elapsed-w.atMs>=350)goal=w.cmd;
  // 2026-11-03 / 2.2.27+ ledger: same low-paper power law as sim/harness.js.
  const plantCup=c=>2.177*Math.pow(Math.max(0,c),0.524);
  mach+=(Math.max(0,goal)-mach)*Math.min(1,stepMs/400);
  cup+=(plantCup(mach)-cup)*Math.min(1,stepMs/200);
  if(dipAt!==null&&elapsed>=dipAt&&elapsed-stepMs<dipAt)cup=Math.max(0,cup-dip);
  weight+=cup*stepMs/1000;
  e.advance(stepMs);elapsed+=stepMs;step++;
  const tMs=e.now()-startMs;
  scale.push({phase:'stage2',profileFrame:1,tMs,weightG:weight,scaleTimestampSeconds:100+tMs/1000,tareReset:false});
  curve.push({tMs,goal,mach,cup});
  e.s.lastPressure=1;e.s.lastFlow=mach;e.s.lastMachineTelemetryValid=true;e.s.lastMachineState='espresso';e.s.lastSubstate='pouring';
  e.s.lastFrame=1;e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();e.s.cumulativeWeight=weight;
  t.run.rawScaleSamples=scale.slice(-30);
  e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:goal,flow:mach,pressure:1,substate:'pouring'});
  if(step%tickEvery===0)await trimTick(e);
 }
 const cut=curve[curve.length-1].tMs,tail=curve.filter(x=>x.tMs>=cut-2000);
 const plateau=tail.reduce((a,x)=>a+x.cup,0)/Math.max(1,tail.length);
 const downWhileLow=cmds.filter(c=>c.cmd<c.prevCmd&&c.cup<target*.96).length;
 return {curve,plateau,plateauPct:(plateau/target-1)*100,cmds,downWhileLow,writes:t.report.trace.filter(x=>x.kind==='write').length,status:t.report.status,checks:t.report.trace.filter(x=>x.kind==='check').map(x=>({r:x.rawGS,p:x.predictedGS,reason:x.reason}))};
}
test('§22.4 T-2 closed loop: the S2 platform settles without down-writes while the cup is low',async()=>{
 // 2026-11-03 / 2.2.27+ plant: with the low-paper power law the normal-write
 // cap (4 quanta = 0.25 ml/s every 1.2 s) needs the full S2 duration; 9 s
 // stopped at -12.3% before convergence. Real S2 runs 10-20 s.
 const e=await innerLoopEnv(),R=await innerClosedLoop(e,{totalMs:13000,dipAt:Number(process.env.HX_DIPAT||3500),dip:Number(process.env.HX_DIP||1.2)});
 if(process.env.HX_LOOP_REPORT)console.log('   inner loop:',JSON.stringify({plateauPct:+R.plateauPct.toFixed(1),downWhileLow:R.downWhileLow,writes:R.writes,status:R.status,checks:R.checks}));
 assert(Math.abs(R.plateauPct)<=7.5,'S2 plateau within 7.5% (the uncapped 2 s forecast lands at -8.2%), got '+R.plateauPct.toFixed(1)+'%');
 assert.equal(R.downWhileLow,0,'no down-write while the cup flow is still below target, got '+R.downWhileLow);
 assert(R.curve.some(x=>x.cup>4.5),'the plant must actually reach the band');
});


test('predictive S3 uses at least 3 quanta for a visible early miss',async()=>{
 const e=await predictiveTrimFixture('stage3');e.s.stage3StartedAtMs=e.now()-2000;e.s.stage3PlannedMs=40000;
 trimSamples(e,1);await trimTick(e);
 const w=e.s.liveTrim.report.trace.filter(x=>x.kind==='write').slice(-1)[0];
 assert(w);assert(w.steps>=3);assert.equal(w.rescue,false);
});
test('predictive envelope is centered on gain-memory target/r instead of the current profile base',async()=>{
 const e=await predictiveTrimFixture();const gm=e.h.gainMemorySuggestion(e.s.liveTrim.run,'s2');assert(gm,JSON.stringify({cfg:e.s.liveTrim.run.config,mem:e.s.persistentHistoryFile.gainMemory,samples:e.s.liveTrim.run.samples}));await trimTick(e);
 const w=e.s.liveTrim.report.trace.filter(x=>x.kind==='write').slice(-1)[0];
 assert(Math.abs(w.controlCenterMlS-4.1875)<=0.001,JSON.stringify(w));assert.equal(w.steps>=1,true);
});
test('predictive control center follows the LUT target command when no gain memory exists',async()=>{
 const e=await predictiveTrimFixture();e.s.persistentHistoryFile=null;e.s.liveTrim.commands[1]=5.5;e.s.liveTrim.profile.steps[1].flow='5.500';
 const c=e.h.liveTrimControlCenter('stage2',5.5,e.s.liveTrim.run);assert.equal(c.commandMlS,2.5);assert.equal(c.source,'lut');
});
test('predictive pressure limit blocks upward writes but still allows a downward correction',async()=>{
 const e=await predictiveTrimFixture();trimSamples(e,4);e.s.lastPressure=5.9;await trimTick(e);
 assert.equal(rawWrites(e).length,0);assert.equal(e.s.liveTrim.report.trace.slice(-1)[0].reason,'pressure-limited-upward-blocked');
 e.s.liveTrim.commands[1]=4;trimSamples(e,6);await trimTick(e);assert.equal(rawWrites(e).length,1);
});
test('predictive S3 actuator-low path never reads rescueActive before initialization',async()=>{
 const e=await predictiveTrimFixture('stage3');e.s.stage3StartedAtMs=e.now()-2000;e.s.stage3PlannedMs=40000;
 trimSamples(e,1);e.s.lastFlow=.1;const before=rawWrites(e).length;await trimTick(e);
 assert.equal(rawWrites(e).length,before);assert.equal(e.s.liveTrim.active,true);
 const row=e.s.liveTrim.report.trace.slice(-1)[0];assert(!/rescueActive is not initialized/.test(String(row.reason||'')));
});
test('§22.4 T-5/T-6/L-8 the envelope always contains the live command and rescue never narrows it',()=>{
 const e=setup();
 const normal=e.h.commandCeilingFor('stage2','normal',{center:7.236,mapped:5,command:7});
 assert(normal.lo<=7&&normal.hi>=7,'the live command must stay reachable');
 assert(normal.hi<=8+1e-9,'normal hi is clamped to the driver ceiling, got '+normal.hi);
 const rescue=e.h.commandCeilingFor('stage2','rescue',{center:7.236,mapped:2.5,command:7});
 assert(rescue.hi>=normal.hi-1e-9,'rescue must not shrink the reachable set: '+rescue.hi+' < '+normal.hi);
 assert(rescue.hi<=8+1e-9&&rescue.lo>=.1-1e-9);
 const s3n=e.h.commandCeilingFor('stage3','normal',{center:.752,mapped:.72,command:.8125});
 assert(s3n.lo<=.8125+1e-9&&s3n.hi>=.8125-1e-9,'an out-of-band live command is still reachable');
 const s3r=e.h.commandCeilingFor('stage3','rescue',{center:.752,mapped:.72,command:.8125});
 assert(s3r.hi>=s3n.hi-1e-9,'S3 rescue ceiling >= normal ceiling');
});
test('§22.4 T-5 every write records intended and actual quanta inside the driver range',async()=>{
 const e=await predictiveTrimFixture('stage3');
 e.s.liveTrim.commands[2]=.8125;
 trimSamples(e,2.2);await trimTick(e);
 const w=e.s.liveTrim.report.trace.filter(x=>x.kind==='write').slice(-1)[0];
 assert(w,'a downward write must happen from an out-of-band command');
 assert.equal(w.intendedQuanta,w.steps);
 assert.equal(w.actualQuanta,Math.round(Math.abs(w.commandMlS-w.previousMlS)*16));
 assert(w.actualQuanta>0,'the write must actually move');
 assert(w.commandMlS>=.1-1e-9&&w.commandMlS<=8+1e-9);
});
test('§22.4 T-5 an out-of-band live S2 command takes one bounded step, not an envelope jump',async()=>{
 const e=await predictiveTrimFixture('stage2');
 e.s.liveTrim.commands[1]=.8125;
 trimSamples(e,1.2);await trimTick(e);
 const w=e.s.liveTrim.report.trace.filter(x=>x.kind==='write').slice(-1)[0];
 assert(w,'the controller must be able to move from a live command outside the old envelope');
 assert(w.actualQuanta<=4,'one bounded step from the live command, got '+w.actualQuanta+' quanta');
 assert(Math.abs(w.commandMlS-.8125)<.5,'the write starts from where the pump actually is');
});
async function s3LoopEnv(){
 const e=await predictiveTrimFixture('stage3'),t=e.s.liveTrim;
 t.commands={};t.pending=null;t.retry=null;t.lastWriteAt=null;t.report.trace.length=0;t.report.writes=0;
 e.s.liveTrimTimer=null;return e;
}
// Decision-level loop: each tick sees a fresh 1.4 s RAW window whose slope is the
// plant's cup flow; a write moves the pump and the plant follows with a first-order
// response. Pending/ACK feedback is cleared here on purpose -- this test is about
// step size and the envelope, not about the driver handshake.
async function s3DecisionLoop(e,{ticks=22}={}){
 const t=e.s.liveTrim,target=Number(e.s.cfg.stage3Flow);
 let cup=2.2,mach=.5625;const cmds=[];let rev=0,dir=0;
 for(let i=0;i<ticks;i++){
  e.advance(250);
  trimSamples(e,cup);await trimTick(e);
  const ws=t.report.trace.filter(x=>x.kind==='write');
  if(ws.length>cmds.length){
   const c=Number(ws[ws.length-1].commandMlS),d=Math.sign(c-mach);
   if(d&&dir&&d!==dir)rev++;if(d)dir=d;
   cmds.push(c);mach=c;
   t.commands[t.pending?t.pending.frame:2]=c;t.pending=null;t.retry=null;
  }
  cup+=(2.15*mach-cup)*.45;
 }
 return {cup,plateauPct:(cup/target-1)*100,cmds,reversals:rev,writes:cmds.length,
  reasons:t.report.trace.filter(x=>x.kind==='check').map(x=>x.reason)};
}
test('§22.4 T-7 closed loop: S3 converges without the 2-3 quantum limit cycle',async()=>{
 const e=await s3LoopEnv(),R=await s3DecisionLoop(e);
 if(process.env.HX_LOOP_REPORT)console.log('   s3 loop:',JSON.stringify({plateauPct:+R.plateauPct.toFixed(1),reversals:R.reversals,cmds:R.cmds}));
 assert(R.writes>=2,'the S3 shot must actually correct');
 assert(R.reversals<=1,'S3 must not oscillate: '+R.reversals+' reversals, cmds '+JSON.stringify(R.cmds));
 assert(Math.abs(R.plateauPct)<=8,'S3 plateau within 8%, got '+R.plateauPct.toFixed(1)+'%');
});


test('§22.4 T-4 the angle deadband is 2 degrees and does not follow deadbandPct',()=>{
 const e=setup();
 const trace=[{kind:'check',tMs:0,rawGS:3.90,targetGS:4},{kind:'check',tMs:1000,rawGS:3.9524,targetGS:4}];
 assert.equal(e.h.computeAngleStats({deadbandPct:12},trace).zeroDegreeShare,0,'12% must not turn a 3 degree trend into a zero-degree share');
 const slow=[{kind:'check',tMs:0,rawGS:3.90,targetGS:4},{kind:'check',tMs:1000,rawGS:3.926,targetGS:4}];
 assert.equal(e.h.computeAngleStats({deadbandPct:12},slow).zeroDegreeShare,1,'1.5 degrees stays inside the 2 degree band');
});
test('§22.4 T-10 rescue needs the remaining time to be genuinely insufficient',async()=>{
 const a=await predictiveTrimFixture();a.s.cumulativeWeight=10;a.s.liveTrim.lastCheckGS=4;a.s.liveTrim.lastCheckAtMs=a.now()-1200;a.s.liveTrim.rescueAngleStreak=1;
 trimSamples(a,2);await trimTick(a);
 assert.equal(a.s.liveTrim.report.rescueWrites,0,'plenty of time left must not rescue');
 const b=await predictiveTrimFixture();b.s.cumulativeWeight=b.s.cfg.finalWeight-4;b.s.liveTrim.lastCheckGS=4;b.s.liveTrim.lastCheckAtMs=b.now()-1200;b.s.liveTrim.rescueAngleStreak=1;
 trimSamples(b,2);await trimTick(b);
 assert.equal(b.s.liveTrim.report.rescueWrites,1);
 const row=b.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];
 assert(row.timeToReturnS>row.remainingS,'rescue only when the steps cannot fit: '+row.timeToReturnS+'s > '+row.remainingS+'s');
});
test('§22.4 T-9 S3 spends a cumulative quantum budget and a big-angle streak releases it',async()=>{
 const e=await predictiveTrimFixture('stage3');const t=e.s.liveTrim;
 t.commands[2]=.9;
 t.phaseQuanta.stage3.normal=24;
 e.advance(400);setTrimWeights(e,[0,.44,.88,1.32,1.76,2.20,2.64,3.08]);await trimTick(e);
 e.advance(400);setTrimWeights(e,[0,.45,.90,1.35,1.80,2.25,2.70,3.15]);await trimTick(e);
 assert.equal(t.report.trace.slice(-1)[0].reason,'S3 normal quantum budget');
 e.advance(400);setTrimWeights(e,[0,.46,.92,1.38,1.84,2.30,2.76,3.22]);await trimTick(e);
 e.advance(400);setTrimWeights(e,[0,.47,.94,1.41,1.88,2.35,2.82,3.29]);await trimTick(e);
 assert((t.rescueAngleStreak||0)>=3,'three diverging checks must build the release streak');
 const w=t.report.trace.filter(x=>x.kind==='write').slice(-1)[0];
 const last=t.report.trace.slice(-1)[0];
 assert.equal(last.decision,'write','the release must let the budget-exhausted S3 write');
 assert(last.bigAngleRelease===true,'the check row must record the big-angle release');
 assert(w,'the write must be recorded');
 assert(w.intendedQuanta>=5,'the sustained-angle ceiling lifts normal max above 4, got '+w.intendedQuanta);
 assert(w.actualQuanta>0,'the released write must actually move the pump');
});






test('§22.4 T-13 the rescue silence follows the measured driver ACK latency (F3)',async()=>{
 const e=await predictiveTrimFixture('stage3');const t=e.s.liveTrim;
 t.lastResponseMs=1235;t.lastWriteAt=e.now()-1000;t.rescueAngleStreak=2;t.rescueMode=true;
 trimSamples(e,1.0);await trimTick(e);
 const held=t.report.trace.slice(-1)[0];
 if(process.env.HX_DBG)console.log('DBG13',JSON.stringify(held));
 assert.equal(held.reason,'predictive-write-silence');
 assert.equal(held.silenceMs,1235);assert.equal(held.silenceBasis,'measured');
 t.lastResponseMs=300;t.lastWriteAt=e.now()-700;
 trimSamples(e,1.0);await trimTick(e);
 const floorRow=t.report.trace.slice(-1)[0];
 assert.equal(floorRow.silenceMs,800);assert.equal(floorRow.silenceBasis,'floor-800');
});


test('L-1 inadmissible scalar evidence applies gain memory at reduced confidence',()=>{
 const e=setup(),a=controlledRun(e,'gm-hold-a');e.h.updateGainMemoryFromRun(a,{});
 const b=controlledRun(e,'gm-hold-b');b.liveFlowTrim={trace:[{kind:'check',frame:1,tMs:20000,rawGS:4.0},{kind:'write',frame:1,tMs:21000,commandMlS:2.5625,previousMlS:2.5},{kind:'write',frame:1,tMs:23000,commandMlS:2.75,previousMlS:2.5625},{kind:'check',frame:1,tMs:25000,rawGS:4.05}]};
 const q=e.h.nextShotAdaptiveSuggestion(b);
 assert(q.s2.gainMemory&&q.s2.gainMemory.applied===true,'target/r from memory must still apply');
 assert.equal(q.s2.gainMemory.damped,true);
 assert.notEqual(q.s2.gainMemory.confidence,'HIGH','a damped memory must not stay HIGH');
 assert.equal(q.s2.usable,true);
});
test('L-1 the contradictory newest cup no longer skips the memory application',()=>{
 const e=setup(),r=controlledRun(e,'older'),current=controlledRun(e,'current');e.h.rememberAdaptiveEvidence(r);
 const conflict=copy(e.s.adaptiveHistory[0]);conflict.runId='newest-comparable';conflict.s2.measured=6.5;e.s.adaptiveHistory.push(conflict);
 const q=e.h.nextShotAdaptiveSuggestion(current);
 assert.equal(q.s2.historySearch.matchedRunId,'newest-comparable','the newest comparable cup is still the one inspected');
 assert(q.s2.gainMemory,'memory is attached');
 assert.equal(e.h.previousMatchingAdaptiveEvidence(e.h.stage2AdaptiveEvidence(current),'s2').measured,6.5,'no cherry-picking an older agreeing row');
});
test('§6.2 gain memory and actuator evidence share one gate set (0.60/0.35/0.40)',()=>{
 const e=setup(),r=coffeeRun(e,'gm-one-gate'),rows=r.samples.filter(x=>x.phase==='stage2');
 rows.forEach((x,i)=>{if(i%4===0)x.machineTelemetryValid=false;});
 const hard=e.h.stageActuatorEvidence(r,'stage2'),soft=e.h.gainMemoryQualityGuard(r,'stage2');
 assert.equal(hard.eligible,soft.eligible,'same physical gate, same verdict');
 assert.equal(hard.eligible,true);
 rows.forEach(x=>x.pressureBar=5.9);
 assert.equal(e.h.gainMemoryQualityGuard(r,'stage2').eligible,false);
 assert.equal(e.h.stageActuatorEvidence(r,'stage2').eligible,false,'the pressure limiter stays a hard gate');
});
test('L-2 a saturated chain yields a current-shot local estimate at alpha 0.55',()=>{
 const e=setup(),a=controlledRun(e,'sat-a');e.h.updateGainMemoryFromRun(a,{});
 const b=controlledRun(e,'sat-b');b.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:20000,commandMlS:2.5625,previousMlS:2.5}],normalWrites:1,rescueWrites:0};
 setStage2CupSlope(b,6.0);setStage2Targets(b,2.507);
 const ev=e.h.stage2AdaptiveEvidence(b);
 const gm=e.h.updateGainMemoryFromRun(b,ev);
 assert.equal(gm.stages.s2.status,'updated','the saturated chain must not block the observation');
 assert.equal(gm.stages.s2.alpha,.55);
 const q=e.h.gainMemorySuggestion(b,'s2');
 assert(q&&q.local===true);assert.equal(q.confidence,'LOW');
 assert(Math.abs(q.r-6/2.507)<.05,'the local estimate is this shot, not the previous cup');
});


// ---- cut 8 / v2.2.16 · consistency gates and the three S2 estimates ----
test('cut 8 / L-13 command equality is half a driver quantum in both consensus paths',()=>{
 const e=setup();
 const a={command:2.507,targetGS:5},b={...a,command:2.507+1/64};
 assert.equal(e.h.sameScalarAdaptiveEvidence(a,b),true);
 assert.equal(e.h.sameScalarAdaptiveEvidence(a,{...a,command:2.507+1/16+1e-9}),false);
 const shape=x=>({targetGS:5,earlySeconds:8,midSeconds:14,measurementBasis:'live target-normalized frame windows',source:[{command:x},{command:x},{command:x}]});
 assert.equal(e.h.sameStage3Shape(shape(.75),shape(.75+1/64)),true);
 assert.equal(e.h.sameStage3Shape(shape(.75),shape(.75+1/16+1e-9)),false);
});
test('cut 8 / L-13 a half-quantum command drift still finds the history row',()=>{
 const e=setup(),fp=copy(e.h.adaptiveHistoryFingerprint());
 const current={runId:'current',targetGS:5,command:2.507,measured:4.3};
 const row={runId:'older',profileTruthSchema:3,fingerprint:fp,s2:{runId:'older',targetGS:5,command:2.507+1/64,measured:4.4}};
 e.s.adaptiveHistory=[row];
 const r=e.h.matchingAdaptiveEvidenceSearch(current,'s2');
 assert.equal(r.matchedRunId,'older');
 assert.equal(r.incompatibleCommands,0);
 assert.equal(r.nearbyCommandComparisons,undefined);
});
test('cut 8 / L-7 the real 00:25 chain resolves to the steady command, not the late-write affine',()=>{
 const e=setup();
 const run={runId:'real-chain',config:{stage2Flow:5,stage2CommandMlS:3.067,adaptiveLearningLevel:'正常'}};
 const chain={usable:true,startCommandMlS:2.25,commandMlS:4.3125,startGS:3.856,endGS:4.794,gain:.45};
 const rev=e.h.s2ReverseEstimate(run,{liveTrimChain:chain},chain,null,3.9375);
 assert(Math.abs(rev.rObserved-1.2174)<.002,rev.rObserved);
 assert(Math.abs(rev.ratioNeedMlS-4.107)<.012,rev.ratioNeedMlS);
 assert(rev.affine&&Math.abs(rev.affine.intercept-2.606)<.02,JSON.stringify(rev.affine));
 assert.equal(rev.affineNeedMlS,null);
 assert.match(rev.affineRejected,/had not settled/);
 assert(rev.suggestedCommandMlS>=4&&rev.suggestedCommandMlS<=4.25,rev.suggestedCommandMlS);
 assert.equal(Math.round(rev.suggestedCommandMlS*16),rev.suggestedCommandMlS*16);
 assert(Math.abs(rev.suggestedCommandMlS-4.107)/4.107<.03);
});
test('cut 8 / L-7 a settled chain uses the affine when the intercept is significant',()=>{
 const e=setup();
 const run={config:{stage2Flow:5,stage2CommandMlS:3.5,adaptiveLearningLevel:'正常'}};
 const chain={usable:true,startCommandMlS:2,commandMlS:3.5,startGS:2,endGS:4.5,gain:5/3};
 const rev=e.h.s2ReverseEstimate(run,{liveTrimChain:chain},chain,null,3.5);
 assert(rev.affine,JSON.stringify(rev));
 assert(rev.affine.intercept<0,JSON.stringify(rev.affine));
 assert(Math.abs(rev.affineNeedMlS-3.8)<.02,rev.affineNeedMlS);
 assert.equal(rev.affineRejected,null);
 assert(Math.abs(rev.needMlS-(rev.affineNeedMlS+rev.ratioNeedMlS)/2)<.01,rev.needMlS);
});
test('cut 8 / L-7 the chain branch is bounded by policy.s2 at every learning level',()=>{
 const e=setup();
 for(const level of ['保守','温和','正常','激进']){
  const run={config:{stage2Flow:5,stage2CommandMlS:2.507,adaptiveLearningLevel:level}};
  const chain={usable:true,startCommandMlS:2,commandMlS:2.5,startGS:2,endGS:2.6,gain:1.2};
  const rev=e.h.s2ReverseEstimate(run,{liveTrimChain:chain},chain,null,2.5);
  const [fraction,absolute]=e.h.learningPolicy(level).s2,span=Math.max(2.5*fraction,absolute);
  assert(rev.suggestedCommandMlS<=2.5+span+1/32+1e-9,level+' upper '+rev.suggestedCommandMlS);
  assert(rev.suggestedCommandMlS>=2.5-span-1/32-1e-9,level+' lower '+rev.suggestedCommandMlS);
 }
});
test('cut 8 / L-7 an ineligible steady-gain feed-forward never participates',()=>{
 const e=setup(),run=controlledRun(e,'ff-wide');run.config.adaptiveLearningLevel='正常';
 const row=(id,m)=>({runId:id,evidence:{s2:{runId:id,targetGS:5,command:2.5,measured:m}}});
 gainHist(e,[row('a',2.5),row('b',4.5),row('c',3.0)]);
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert(q.s2.gainFeedForward);
 assert.equal(q.s2.gainFeedForward.eligible,false);
 assert.equal(q.s2.gainFeedForward.applied,false);
 assert(q.s2.gainFeedForward.spread>.10);
 assert.notEqual(q.s2.suggestedCommandMlS,q.s2.gainFeedForward.boundedCommandMlS);
});
test('cut 8 / L-15 startup assist allows a +25% plateau but not +26%',()=>{
 const e=setup();
 const m={schema:2,eligible:false,headroomPassed:true,reason:'S2 plateau outside startup-assist range',targetGS:5,tailMeanGS:5.9,tailCvPct:8,overshootPct:4};
 assert.equal(e.h.startupMetricAllowed({...m}),true);
 assert.equal(e.h.startupMetricAllowed({...m,tailMeanGS:6.3}),false);
 assert.equal(e.h.startupMetricAllowed({...m,tailMeanGS:2.4}),false);
});
test('cut 8 / L-16 a target change is a one-step rescale, not a discarded override',()=>{
 const e=setup();
 e.s.testOverrides={schema:3,writerVersion:'2.2.16',savedAt:'x',mapCreatedAt:e.s.calibrationMap.createdAt,activeRelease:true,basketContext:e.s.cfg.basketContext,targets:{stage1:2,stage2:4,stage3:1.5},stages:{stage1:{mode:'manual',origin:'adaptive',command:1.4},stage2:{mode:'manual',origin:'adaptive',command:3},stage3:{mode:'auto',command:null}},s3Shape:{enabled:false}};
 let os=e.h.testOverrideStatus();
 assert.equal(os.valid,true);assert.equal(os.targetTransition,true);
 assert.equal(e.h.manualTestCommand('stage2'),3.75);
 assert.equal(e.h.commandFlowSummary().stage2CommandMlS,3.75);
 assert.equal(e.h.rescaleOverridesForTargets(),true);
 os=e.h.testOverrideStatus();
 assert.equal(os.valid,true);assert.equal(os.targetTransition,false);
 assert.equal(e.s.testOverrides.stages.stage2.command,3.75);
 assert.equal(e.s.testOverrides.targets.stage2,5);
 e.s.testOverrides.targets.stage2=15;
 assert.equal(e.h.testOverrideStatus().valid,false);
});
test('cut 8 / L-14 HOLD compares with the curve command and all-HOLD means no rewrite',()=>{
 const e=setup();coffeeRun(e,'base');const fp=copy(e.h.adaptiveHistoryFingerprint());
 const samples=[],raw=[];
 for(let i=0;i<=40;i++){const t=8000+i*100,w=10+(t-8000)*.0044;
  samples.push({phase:'stage2',tMs:t,profileFrame:1,targetFlowMlS:2.75,machineFlowMlS:2.75,machineTelemetryValid:true,machineAgeMs:0,pressureBar:1});
  raw.push({phase:'stage2',tMs:t,profileFrame:1,weightG:w,scaleTimestampSeconds:t/1000,tareReset:false});
 }
 const run={runId:'hold-only',kind:'hyperex',result:'completed at 100 g',config:{basketContext:'coffee',profileTruthVerified:true,profileTruthSchema:3,stage1Flow:2,stage1CommandMlS:.719,stage2Flow:5,stage2CommandMlS:3.0625,stage2LutCommandMlS:2.507,stage2PressureLimit:3,stage3Flow:1.5,stage3CommandMlS:.569,stage3Shape:{enabled:false},adaptiveLearningLevel:'正常',experimentalLiveTrim:true,adaptiveFingerprint:fp},samples,rawScaleSamples:raw,events:[],liveFlowTrim:{trace:[{kind:'check',frame:1,tMs:20000,rawGS:4.0},{kind:'write',frame:1,tMs:21000,commandMlS:2.5625,previousMlS:2.5},{kind:'write',frame:1,tMs:23000,commandMlS:2.75,previousMlS:2.5625},{kind:'check',frame:1,tMs:25000,rawGS:4.4}]},summary:{}};
 const q=e.h.nextShotAdaptiveSuggestion(run);
 assert.equal(q.hold.s2,true,q.s2.reason);
 assert.equal(q.s2.action,'HOLD');
 assert.equal(q.s2.suggestedCommandMlS,undefined);
 assert.equal(q.actionable,false);
 assert.equal(q.hold.all,true);
 const s1={usable:true,action:'ADJUST',suggestedCommandMlS:.719};
 assert.equal(e.h.reconcileStageWithCurve(s1,.719,'S1'),true);
 assert.equal(s1.action,'HOLD');assert.equal(s1.suggestedCommandMlS,undefined);
});
test('cut 8 / §6.3 a cross-basis S3 shape is accepted with reduced confidence',()=>{
 const e=setup();
 const a=controlledRun(e,'basis-a',true);e.h.rememberAdaptiveEvidence(a);e.s.adaptiveHistory[0].s3.measurementBasis='stability 25/50/25 fallback';
 const b=controlledRun(e,'basis-b',true);
 const q=e.h.nextShotAdaptiveSuggestion(b);
 assert.equal(q.s3.crossBasis,true,JSON.stringify(q.s3.historySearch)+' / '+String(q.s3.reason));
 assert.notEqual(q.s3.confidence,'HIGH');
});

test('cut 8 / L-7 closed loop on a plant with the real 00:25 intercept converges without the 4.72 jump',()=>{
 const e=setup();
 // cup = 0.556 * command + 2.606 (the two-point chain anchored on the
 // effective 3.938 ml/s, not the late 4.3125 write).
 let command=3.0675;const commands=[],measured=[];
 for(let i=0;i<5;i++){
  const cup=0.556*command+2.606;measured.push(cup);commands.push(command);
  const run={config:{stage2Flow:5,stage2CommandMlS:command,adaptiveLearningLevel:'正常'}};
  const rev=e.h.s2ReverseEstimate(run,{measured:cup},null,null,command);
  assert(rev,JSON.stringify({command,cup}));
  assert(rev.suggestedCommandMlS<=4.5,'no late-write jump: '+rev.suggestedCommandMlS);
  if(i)assert(rev.suggestedCommandMlS>=command-1e-9,'monotone convergence: '+JSON.stringify(commands));
  command=rev.suggestedCommandMlS;
 }
 assert(command>=4.0&&command<=4.25,'final '+command+' from '+JSON.stringify(commands));
 assert(0.556*command+2.606>=4.9,'final cup flow '+Math.round((0.556*command+2.606)*1000)/1000);
});

test('P1-1 boost ACK clears the refill ACK timer so a later trim cannot abort',async()=>{
 const e=await refillFixture();
 await trimTick(e);
 const t=e.s.liveTrim;
 assert(t.startupAckTimer,'boost ACK timer should be armed');
 trimAck(e);
 assert.equal(t.startupAckTimer,null,'boost ACK must clear the timer');
 t.pending={frame:1,command:4.4,at:e.now()-100,ack:false,targetSeen:false,startupAction:'trim'};
 t.startup.status='boosting';
 e.advance(2000);
 assert.notEqual(e.s.phase,'aborted','a later trim must not be killed by the boost ACK timer');
});

test('P1-2 bounded refill default is cup-target while an explicit saved basis is preserved',()=>{
 const e=normalEnv();
 e.s.cfg.s2RefillBoundedModel=true;e.s.s2RefillSettings=null;
 assert.equal(e.h.currentS2RefillSettings().basis,'cup-target');
 assert.equal(e.h.curveEditorSnapshot().refillDefaults.basis,'cup-target');
 e.s.s2RefillSettings={...refillDefaults,basis:'pump-command'};
 assert.equal(e.h.currentS2RefillSettings().basis,'pump-command','explicit saved pump-command must survive');
 e.s.cfg.s2RefillBoundedModel=false;e.s.s2RefillSettings=null;
 assert.equal(e.h.currentS2RefillSettings().basis,'pump-command','legacy default stays pump-command');
});

test('P1-2 missing basis migrates to cup-target in bounded mode',()=>{
 const e=normalEnv();
 e.s.cfg.s2RefillBoundedModel=true;
 e.event('s2RefillSettingsV1',JSON.stringify({startDelayMs:0,targetPercent:135,cutoffPercent:85,maxDurationMs:4000,approachMs:800}));
 assert.equal(e.h.currentS2RefillSettings().basis,'cup-target');
});

test('P1-3 steady-gain estimate skips the current run in history',()=>{
 const e=setup();
 const cur={runId:'cur',command:2.5,measured:4.0};
 const prev={runId:'prev',command:2.5,measured:3.8};
 gainHist(e,[{runId:'prev',evidence:{s2:prev}},{runId:'cur',evidence:{s2:cur}}]);
 const g=e.h.stageGainEstimate('s2',{runId:'cur'},cur);
 assert.equal(g.samples,2);
});
test('P1-3 steady-gain uses only the filtered history and skips the current run',()=>{
 const e=setup(),fp=copy(e.h.adaptiveHistoryFingerprint());
 e.s.adaptiveHistory=[
  {runId:'cof1',profileTruthSchema:3,fingerprint:fp,basketContext:'coffee',s2:{runId:'cof1',targetGS:5,command:3.6,measured:4.0}},
  {runId:'cof2',profileTruthSchema:3,fingerprint:fp,basketContext:'coffee',s2:{runId:'cof2',targetGS:5,command:3.7,measured:4.1}}
 ];
 e.s.persistentHistoryFile={shots:[
  {runId:'empty1',evidence:{s2:{runId:'empty1',targetGS:5,command:3.6,measured:2.0}}},
  {runId:'unverified',evidence:{s2:{runId:'unverified',targetGS:5,command:3.6,measured:5.0}}}
 ]};
 const g=e.h.stageGainEstimate('s2',{runId:'cur'},{runId:'cur',command:3.7,measured:4.1});
 assert.equal(g.samples,3,'two coffee rows + the current cup');
 assert(Math.abs(g.k-4.1/3.7)<.05,'the empty-basket 2.0 g/s row must not enter k');
 assert.equal(g.sources.includes('empty1'),false);
 assert.equal(g.sources.includes('unverified'),false);
 const e2=setup();gainHist(e2,[{runId:'prev',evidence:{s2:{runId:'prev',command:2.5,measured:3.8}}},{runId:'cur',evidence:{s2:{runId:'cur',command:2.5,measured:4.0}}}]);
 const g2=e2.h.stageGainEstimate('s2',{runId:'cur'},{runId:'cur',command:2.5,measured:4.0});
 assert.equal(g2.samples,2,'the current run is skipped once, not counted twice');
});
test('P2-6 gain alpha reads rescue writes per stage, not the whole shot',()=>{
 const e=setup(),r=controlledRun(e,'alpha-stage');
 r.liveFlowTrim={trace:[{kind:'write',frame:1,rescue:false},{kind:'write',frame:2,rescue:true},{kind:'write',frame:2,rescue:true}],normalWrites:1,rescueWrites:2};
 r.config.stage3CommandOrigin='auto';
 const ev={source:[{command:.7,measured:1.5,seconds:10},{command:.7,measured:1.5,seconds:10},{command:.7,measured:1.5,seconds:10}]};
 e.h.updateGainMemoryFromRun(r,ev);
 const gm=e.h.updateGainMemoryFromRun(r,ev);
 assert.equal(gm.stages.s2.alpha,.12,'S2 had only normal writes; an S3 rescue must not raise it');
 assert.equal(gm.stages.s3.alpha,.5);
});
test('§22.8 the coverage reason uses the same 0.60 floor as eligibility',()=>{
 const e=setup(),r=coffeeRun(e,'cov65'),rows=r.samples.filter(x=>x.phase==='stage2');
 rows.forEach((x,i)=>{if(i%3===0)x.machineTelemetryValid=false;});
 rows.filter(x=>x.machineTelemetryValid===true).forEach(x=>{x.pressureBar=5.9;});
 const g=e.h.stageActuatorEvidence(r,'stage2');
 assert.equal(g.eligible,false);
 assert.match(g.reason,/Pressure limiter/,'65% coverage passes the 0.60 floor; the reason must be the pressure gate');
});

test('2.2.28 S3 control prefers the current run S2 bucket over the previous shot',()=>{
 const e=setup(),prev=controlledRun(e,'s3-prev'),cur=controlledRun(e,'s3-cur');
 for(const x of cur.samples.filter(x=>x.phase==='stage2')){x.pressureBar=1.2;x.machineFlowMlS=2.55;x.machineTelemetryValid=true;x.machineAgeMs=0;}
 for(const x of prev.samples.filter(x=>x.phase==='stage2')){x.pressureBar=.69;x.machineFlowMlS=2.55;x.machineTelemetryValid=true;x.machineAgeMs=0;}
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,seq:2,lastBucketId:'g3',buckets:[
  {id:'g2',center:.4715,radius:.0962,samples:[.4715],stages:{s3:{r:1.2651,n:1,lastObservedR:1.2651}}},
  {id:'g3',center:.2724,radius:.136,samples:[.2724],stages:{s3:{r:2.3269,n:4,lastObservedR:2.3269}}}
 ]}};
 e.s.diagnosticLast=prev;e.s.diagnosticCurrent=cur;
 const c=e.h.liveTrimControlCenter('stage3',.569,cur);
 assert.equal(c.source,'gain-memory');assert.equal(c.bucketId,'g2');assert.equal(c.r,1.2651);
 assert(Math.abs(c.commandMlS-1.5/1.2651)<.02,JSON.stringify(c));
});

test('2.2.28 S3 drift level jumps to the same-shot target/r on a bucket change',()=>{
 const e=setup(),run=controlledRun(e,'s3-jump');
 for(const x of run.samples.filter(x=>x.phase==='stage2')){x.pressureBar=1.2;x.machineFlowMlS=2.55;x.machineTelemetryValid=true;x.machineAgeMs=0;}
 run.config.s3DriftModel=true;run.config.stage3Flow=2;
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,seq:1,lastBucketId:'g2',buckets:[{id:'g2',center:.4715,radius:.0962,samples:[.4715],stages:{s3:{r:1.2651,n:1,lastObservedR:1.2651}}}]}};
 const current={targetGS:2,earlySeconds:8,midSeconds:14,overallGS:1.29,status:'STABLE',lateToEarlyRatio:1.069,source:[
  {name:'EARLY',command:.9375,measured:1.256,r2:.999,seconds:10},
  {name:'MID',command:.875,measured:1.278,r2:.999,seconds:20},
  {name:'LATE',command:1.0625,measured:1.343,r2:.999,seconds:10}
 ]};
 const q=e.h.driftShapeSuggestion(run,current,null,e.h.learningPolicy('正常'));
 assert(q);assert(q.midCommand>=1.25,JSON.stringify(q));assert(q.midCommand<=1.55,JSON.stringify(q));
 assert(q.earlyCommand>0.1&&q.lateCommand<=Math.max(q.midCommand+.25,q.midCommand*1.35)+1e-6);
});

test('2.2.28 S2 refill control base uses the running profile command, never the empty-basket LUT',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;
 e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:4.1875,desiredGS:5,origin:'manual'}}};
 disableGainMemory(e);e.s.diagnosticLast=null;
 const p=e.h.stage2StartupPlan();
 assert.equal(p.baseCommandMlS,4.1875);assert.equal(p.controlSource,'profile-base');
 assert.equal(p.controlBaseMlS,4.1875);assert.equal(p.returnCommandMlS,4.1875);
 assert.notEqual(p.controlBaseMlS,2.5);
});

test('2.2.28 S2 plateau window starts after the cup-flow peak, not at the old final 60%',()=>{
 const e=normalEnv(),r=startupRun(e,'plateau',1,3,5);
 let w=0;
 for(const x of r.rawScaleSamples){const t=x.tMs/1000;const f=t<4?5.6*t/4:Math.max(3.9,5.6-(t-4)*.4);w+=f*.1;x.weightG=w;x.decaidWeightFlowGS=f;}
 const q=e.h.controlOutputQuality(r,'stage2');
 assert.equal(q.tailFraction,1);assert.match(String(q.basisDetail),/peak \+ 1.5 s/);
 assert(q.available);assert(q.tailMeanGS>4.0,JSON.stringify(q));
 const late=startupRun(e,'late-peak',1,3,5);
 for(const x of late.rawScaleSamples){const t=x.tMs/1000;x.decaidWeightFlowGS=t<11.5?5.6*t/11.5:5.6;}
 const q2=e.h.controlOutputQuality(late,'stage2');
 assert.equal(q2.available,false,JSON.stringify(q2));
});

test('2.2.28 S2 startup headroom ignores the boost transient and judges the refill plateau',()=>{
 const e=normalEnv(),r=startupRun(e,'headroom',1,2,5);
 r.config.experimentalLiveTrim=true;r.config.s2StartupPlan={strategy:'refill-85'};
 r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:7,startupAction:'boost'},{kind:'startup-complete',frame:1,tMs:2500}]};
 for(const s of r.samples){s.machineFlowMlS=s.tMs<2500?4.5:2.5;s.targetFlowMlS=2.5;s.pressureBar=.5;s.machineTelemetryValid=true;s.machineAgeMs=0;}
 const m=e.h.stage2StartupMetrics(r);
 assert.equal(m.headroomPassed,true);assert(m.eligible,m.reason);
});

test('2.2.30 S3 ordinary writes cap at 2 quanta and hold 2400 ms',async()=>{
 const e=await predictiveTrimFixture('stage3');e.s.stage3StartedAtMs=e.now()-4000;e.s.stage3PlannedMs=40000;
 trimSamples(e,1.2);await trimTick(e);
 const w=e.s.liveTrim.report.trace.filter(x=>x.kind==='write').slice(-1)[0];
 assert(w);assert(w.steps<=2,JSON.stringify(w));
 trimAck(e);e.s.liveTrim.pending=null;e.s.liveTrim.retry=null;e.advance(1300);trimSamples(e,1.2);await trimTick(e);
 const last=e.s.liveTrim.report.trace.slice(-1)[0];
 assert.equal(last.reason,'predictive-write-silence');assert.equal(last.silenceBasis,'normal-2400');assert.equal(last.silenceMs,2400);
});

test('2.2.28 refill bleed is prediction-first with a 250 ms observed fallback',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert.match(src,/const bflow=best&&Number\.isFinite\(Number\(best\.predicted\)\)\?Number\(best\.predicted\):best&&Number\(best\.slope\)/);
 assert.match(src,/bleedElapsed>=250/);
});

test('2.2.30 a flat S3 inside 10% coasts instead of writing',async()=>{
 const e=await predictiveTrimFixture('stage3');
 e.s.stage3StartedAtMs=e.now()-5000;e.s.stage3PlannedMs=40000;
 const t=e.s.liveTrim;
 t.lastCheckGS=1.6;t.lastCheckAtMs=e.now()-1000;
 trimSamples(e,1.6);await trimTick(e);
 const last=t.report.trace.slice(-1)[0];
 assert.equal(last.reason,'coast-trend-stable');assert.equal(last.trimMode,'coast');
 assert.equal(rawWrites(e).length,0);
});

test('2.2.30 S3 entry coast removes writes while the S2 decay is still falling',async()=>{
 const e=await predictiveTrimFixture('stage3');
 e.s.stage3StartedAtMs=e.now()-1000;e.s.stage3PlannedMs=40000;
 trimSamples(e,2.5);await trimTick(e);
 const last=e.s.liveTrim.report.trace.slice(-1)[0];
 assert.equal(last.reason,'coast-trend-stable');assert.equal(last.coastEntry,true);
 assert.equal(rawWrites(e).length,0);
 e.s.stage3StartedAtMs=e.now()-4000;e.advance(100);trimSamples(e,1.2);await trimTick(e);
 assert(rawWrites(e).length>=1,JSON.stringify(e.s.liveTrim.report.trace.slice(-1)));
});

test('2.2.30 a 14% S3 miss does not reach the 6-quantum big-angle path',async()=>{
 const e=await predictiveTrimFixture('stage3');e.s.stage3StartedAtMs=e.now()-4000;e.s.stage3PlannedMs=40000;
 trimSamples(e,1.28);await trimTick(e);
 const w=e.s.liveTrim.report.trace.filter(x=>x.kind==='write').slice(-1)[0];
 assert(w);assert(w.steps<=2,JSON.stringify(w));
});

test('2.2.30 big-angle escalation needs 90 degrees and a >15% predicted error',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert.match(src,/angleDeg>=90/);
 assert.match(src,/bigAngleConfirmed=predictedRel>0\.15/);
 assert.match(src,/bigAngleStreak\|\|0\)>=3&&bigAngleConfirmed\?6/);
});


test('2.2.31 a forecast-only overshoot does not rescue while the measured cup is at target',async()=>{
 const e=await predictiveTrimFixture('stage2');
 e.s.cumulativeWeight=e.s.cfg.finalWeight-4;
 e.s.liveTrim.lastCheckGS=4;e.s.liveTrim.lastCheckAtMs=e.now()-1200;e.s.liveTrim.rescueAngleStreak=1;
 setTrimWeights(e,[0,.5,1.1,1.9,3.0,4.3,5.8,7.4]);
 await trimTick(e);
 const row=e.s.liveTrim.report.trace.filter(x=>x.kind==='check').slice(-1)[0];
 console.log('   forecast-only row',JSON.stringify({raw:row.rawGS,pred:row.predictedGS,err:row.errorPct,predErr:row.predictedErrorPct,angle:row.trendAngleDeg,streak:row.rescueAngleStreak}));
 assert(row.predictedErrorPct>25,'forecast must be >25%');
 assert(Math.abs(row.errorPct)<12,'measured error must be inside the actual floor');
 assert.equal(e.s.liveTrim.report.rescueWrites,0,'forecast-only overshoot must not rescue');
});
test('2.2.32 an S3 drift shape above the LUT x2 cap is clamped, not dropped',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常');
 const run={config:{s3DriftModel:true,stage3Flow:1.5,stage3LutCommandMlS:.569,stage3CommandMlS:.563},
  samples:Array.from({length:20},(_,i)=>({phase:'stage2',tMs:i*100,pressureBar:1.5,machineFlowMlS:2.5,machineTelemetryValid:true,machineAgeMs:0}))};
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,seq:1,lastBucketId:'g4',buckets:[{id:'g4',center:.6,radius:.12,stages:{s3:{r:1.3126,n:1,lastDeviation:0,lastObservedR:1.3126,commandMlS:1.125,commandBand:'<1.0'}}}]}};
 const ev={targetGS:1.5,overallGS:.865,status:'STABLE',stall:false,stallQualitative:false,earlySeconds:8,midSeconds:14,measurementBasis:'test',
  source:[{command:1,measured:1.237,r2:.999,seconds:4},{command:.563,measured:.739,r2:.999,seconds:10},{command:.687,measured:.851,r2:.999,seconds:8}]};
 const q=e.h.driftShapeSuggestion(run,ev,null,p);
 assert(q,'an over-cap S3 shape must clamp, not disappear');
 assert.equal(q.midCommand,1.125);
 assert(q.earlyCommand<=1.125+1e-9&&q.lateCommand<=1.125+1e-9);
 assert(q.midCommand<=.569*2+1e-9);
});
(async()=>{let failed=0;for(const [name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(err){failed++;console.error('FAIL '+name+'\n'+err.stack);}}console.log(`\n${tests.length-failed}/${tests.length} checks passed`);process.exitCode=failed?1:0;})();

test('write vector arrow sits on the check-to-write trend line while the head follows the command direction',()=>{const s=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');const NL=String.fromCharCode(10);const a=s.indexOf('function liveTrimMarkers(');const ns=s.slice(a,s.indexOf(NL,a));const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(ns,ctx);const run={liveFlowTrim:{trace:[{kind:'check',tMs:1000,rawGS:4,targetGS:5},{kind:'write',tMs:1500,commandMlS:2.5,previousMlS:2.4375,rawGS:4.5,targetGS:5}]}};const ms=ctx.liveTrimMarkers(run);assert.equal(ms[1].shape,'up');assert.equal(ms[1].y,4.5);assert(ms[1].label.indexOf('2.5 ml/s')>=0);});
test('write vector arrow without a RAW regression keeps the command position',()=>{const s=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');const NL=String.fromCharCode(10);const a=s.indexOf('function liveTrimMarkers(');const ns=s.slice(a,s.indexOf(NL,a));const ctx=vm.createContext({Math,Number,esc:v=>String(v??'')});vm.runInContext(ns,ctx);const run={liveFlowTrim:{trace:[{kind:'write',tMs:1500,commandMlS:2.5,previousMlS:2.4375}]}};const ms=ctx.liveTrimMarkers(run);assert.equal(ms[0].shape,'up');assert.equal(ms[0].y,2.5);});
test('steady-gain k row stays visible with a sample counter when history is short',()=>{const e=setup(),run=controlledRun(e,'ff-short');const q=e.h.nextShotAdaptiveSuggestion(run);assert(q.s2.gainFeedForward);assert.equal(q.s2.gainFeedForward.k,null);assert(q.s2.gainFeedForward.samples<2);});
test('diagnostic chart exposes a smoothed trend trajectory series',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml();assert.match(html,/trendSmooth/);assert.match(html,/趋势轨迹 g\/s/);});
test('control law curve renders per-check trend angles on its own chart',()=>{const {scope,elements}=chartUiFixture();const run=chartReleaseRun();run.liveFlowTrim={trace:[{kind:'check',tMs:5000,rawGS:4.2,targetGS:5,trendAngleDeg:12.3},{kind:'check',tMs:6000,rawGS:4.4,targetGS:5,trendAngleDeg:4.5}]};scope.renderCharts(run);assert(elements.anglechart&&elements.anglechart.innerHTML.indexOf('<path')>=0);});
test('live trim check rows carry the trend angle for the control law curve',async()=>{const e=await trimFixture();await trimTick(e);trimAck(e);e.advance(2100);trimSamples(e);await trimTick(e);const rows=e.s.liveTrim.report.trace.filter(x=>x.kind==='check'&&Number.isFinite(x.trendAngleDeg));assert(rows.length>=1);assert(rows.every(x=>x.trendAngleDeg>=0&&x.trendAngleDeg<=180));});
test('new history records keep the full per-shot trace for JSON export',()=>{const e=setup(),r=controlledRun(e,'full-rec');r.samples=[{tMs:1,weightG:1}];r.rawScaleSamples=[{tMs:2,weightG:2}];r.liveFlowTrim={trace:[{kind:'check',tMs:3,rawGS:4},{kind:'write',tMs:4,commandMlS:2.5}],writes:1};const rec=e.h.compactPersistentShotRecord(r,null);assert(rec.fullRecord);assert.equal(rec.fullRecord.samples.length,1);assert.equal(rec.fullRecord.rawScaleSamples.length,1);assert.equal(rec.fullRecord.liveFlowTrim.trace.length,2);});
test('history export endpoint returns every persisted shot including its full record',async()=>{const e=setup();e.s.persistentHistoryFile={schema:2,kind:'HyperExAdaptiveHistory',writerVersion:'1.92ds',shots:[{runId:'h1',fullRecord:{samples:[{tMs:1}],liveFlowTrim:{trace:[{kind:'check',tMs:1}]}}},{runId:'h2'}]};const resp=await e.plugin.__httpRequestHandler({endpoint:'history-export',method:'GET'});assert.equal(resp.status,200);const body=JSON.parse(resp.body);assert.equal(body.kind,'HyperExHistoryExport');assert.equal(body.count,2);assert.equal(body.shots[0].fullRecord.liveFlowTrim.trace.length,1);});

test('recalibration merges LUT points instead of replacing the covered range',()=>{const e=setup();e.s.calibrationMap.revision=1;const createdAt=e.s.calibrationMap.createdAt;const next={schema:3,valid:true,createdAt:'2026-11-01T00:00:00.000Z',algorithm:'v0.1.38-full-staircase',baseFlowMultiplier:1,points:[{actualFlow:2,commandFlow:.73,machineFlow:.74},{actualFlow:5,commandFlow:2.6,machineFlow:2.61},{actualFlow:7,commandFlow:3.4,machineFlow:3.42},{actualFlow:9,commandFlow:4.4,machineFlow:4.45}],actualRange:[2,9],targetAnchors:[]};const m=e.h.mergeCalibrationMap(e.s.calibrationMap,next);assert.equal(m.createdAt,createdAt);assert.equal(m.revision,2);assert.equal(m.points.map(p=>Number(p.actualFlow).toFixed(2)).join(','),'1.50,2.00,5.00,7.00,9.00');assert.equal(m.actualRange.join(','),'1.5,9');assert.equal(m.merge.retained,1);assert.equal(m.merge.added,2);assert.equal(m.merge.replaced,2);assert.equal(m.points.find(p=>Number(p.actualFlow)===2).commandFlow,.73);assert.equal(m.points.find(p=>Number(p.actualFlow)===2).source,'new');assert.equal(m.points.find(p=>Number(p.actualFlow)===1.5).source,'retained');});
test('merging keeps overrides and adaptive history while a new LUT identity clears them',()=>{const e=setup();e.s.testOverrides={schema:3,writerVersion:'1.92ds',mapCreatedAt:e.s.calibrationMap.createdAt,activeRelease:true,basketContext:e.s.cfg.basketContext,targets:{stage1:2,stage2:5,stage3:1.5},stages:{stage1:{mode:'manual',origin:'adaptive',command:1.4},stage2:{mode:'manual',origin:'adaptive',command:4},stage3:{mode:'auto',command:null}},s3Shape:{enabled:false}};e.s.adaptiveHistory=[{runId:'kept'}];const next={schema:3,valid:true,createdAt:'2026-11-01T00:00:00.000Z',points:[{actualFlow:7,commandFlow:3.4},{actualFlow:9,commandFlow:4.4}],actualRange:[7,9]};const merged=e.h.adoptCalibrationMap(next);assert.equal(merged.createdAt,e.s.testOverrides.mapCreatedAt);assert(e.s.testOverrides);assert.equal(e.s.adaptiveHistory.length,1);e.s.calibrationMap=null;e.h.adoptCalibrationMap({...next,createdAt:'2026-11-02T00:00:00.000Z'});assert.equal(e.s.testOverrides,null);assert.equal(e.s.adaptiveHistory.length,0);});
test('learning fingerprint ignores LUT point edits but follows identity, multiplier and basket',()=>{const e=setup();const a=copy(e.h.adaptiveHistoryFingerprint());const b=copy(a);b.lutPoints=[{actualFlow:7,commandFlow:3.4}];assert.equal(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(b));assert.notEqual(e.h.adaptiveHistoryFingerprintKey(a),e.h.adaptiveHistoryFingerprintKey(b));for(const change of [q=>{q.mapCreatedAt='other';},q=>{q.actualFlowMultiplier=1.1;},q=>{q.basketContext='coffee';}]){const q=copy(a);change(q);assert.notEqual(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey(q));}assert.equal(e.h.numericLearningFingerprintKey(a),e.h.numericLearningFingerprintKey({...a,lutPoints:[{actualFlow:9,commandFlow:4.4}]}));});
test('a merged LUT covers the extended target instead of falling back to 1:1',()=>{const e=setup();e.s.calibrationMap.revision=1;e.h.adoptCalibrationMap({schema:3,valid:true,createdAt:'2026-11-01T00:00:00.000Z',baseFlowMultiplier:1,points:[{actualFlow:7,commandFlow:3.4},{actualFlow:9,commandFlow:4.4}],actualRange:[7,9]});e.s.cfg.stage2Flow=6;e.h.recomputeCalibrationUsability();assert.equal(e.s.calibrationMapUsable,true);const s2=Number(e.h.profileObject().steps[1].flow);assert(s2>2.9&&s2<3.05);});

test('operating qualification survives LUT point edits but follows identity and multiplier',()=>{const e=setup();const a=copy(e.h.adaptiveHistoryFingerprint());const b=copy(a);b.lutPoints=[{actualFlow:7,commandFlow:3.4}];b.targetAnchors=[];assert.equal(e.h.qualificationFingerprintKey(a),e.h.qualificationFingerprintKey(b));assert.notEqual(e.h.adaptiveHistoryFingerprintKey(a),e.h.adaptiveHistoryFingerprintKey(b));for(const change of [q=>{q.mapCreatedAt='other';},q=>{q.actualFlowMultiplier=1.1;}]){const q=copy(a);change(q);assert.notEqual(e.h.qualificationFingerprintKey(a),e.h.qualificationFingerprintKey(q));}});
test('a Full-range merge keeps the coffee context and learning stage',()=>{const e=setup();e.s.cfg.basketContext='coffee';e.s.phase='idle';e.s.runtimeProfileVerified=true;e.s.machineProfileAckKey='ack';e.s.persistentHistoryAvailable=true;e.s.pendingHistoryWrite=null;const fp=copy(e.h.adaptiveHistoryFingerprint());e.s.persistentHistoryFile={shots:[{runId:'coffee-1',result:'completed at 50 g',profileTruthSchema:3,profileTruthVerified:true,basketContext:'coffee',fingerprint:fp}]};assert.equal(e.h.refreshLearningStage().stage,'NORMAL COFFEE · AUTO');e.s.calibrationMap.revision=1;e.h.adoptCalibrationMap({schema:3,valid:true,createdAt:'2026-11-01T00:00:00.000Z',baseFlowMultiplier:1,points:[{actualFlow:7,commandFlow:3.4},{actualFlow:9,commandFlow:4.4}],actualRange:[7,9]});const stage=e.h.refreshLearningStage();assert.equal(e.s.cfg.basketContext,'coffee');assert.equal(stage.stage,'NORMAL COFFEE · AUTO');});
test('history import merges exported shots by runId',async()=>{const e=setup();e.s.persistentHistoryLoaded=true;e.s.storageProbeVerified=true;e.s.persistentHistoryAvailable=true;e.s.phase='idle';e.s.persistentHistoryFile={schema:2,kind:'HyperExAdaptiveHistory',writerVersion:'1.85ds',createdAt:'x',shots:[{runId:'a',result:'completed at 10 g',profileTruthSchema:3,profileTruthVerified:true,fingerprint:null}]};const res=await e.plugin.__httpRequestHandler({endpoint:'history-import',method:'POST',body:JSON.stringify({kind:'HyperExHistoryExport',schema:1,shots:[{runId:'a',result:'completed at 11 g'},{runId:'b',result:'completed at 20 g'}]})});const body=JSON.parse(res.body);assert.equal(res.status,200);assert.equal(body.imported,1);assert.equal(body.replaced,1);assert.equal(body.total,2);assert.equal(e.s.persistentHistoryFile.shots.find(r=>r.runId==='a').result,'completed at 11 g');});
test('history import caps the store at the newest 80 shots',async()=>{const e=setup();e.s.persistentHistoryLoaded=true;e.s.storageProbeVerified=true;e.s.persistentHistoryAvailable=true;e.s.phase='idle';const shots=[];for(let i=0;i<100;i++)shots.push({runId:'r'+i,result:'completed at '+i+' g',startedAt:new Date(2026,0,1,0,0,i).toISOString()});const res=await e.plugin.__httpRequestHandler({endpoint:'history-import',method:'POST',body:JSON.stringify({kind:'HyperExHistoryExport',shots})});const body=JSON.parse(res.body);assert.equal(res.status,200);assert.equal(body.total,80);assert.equal(e.s.persistentHistoryFile.shots[0].runId,'r20');assert.equal(e.s.persistentHistoryFile.shots[79].runId,'r99');});
test('calibration import rebuilds the LUT from an exported fingerprint',async()=>{const e=setup();e.s.phase='idle';const fp={schema:3,basketContext:'coffee',mapCreatedAt:'2026-10-24T09:21:39.693Z',lutSchema:3,lutAlgorithm:'v0.1.27-target-lut',lutPoints:[{actualFlow:1.5,commandFlow:0.569},{actualFlow:2,commandFlow:0.7189},{actualFlow:5,commandFlow:2.5071}],baseFlowMultiplier:1,actualFlowMultiplier:1};const res=await e.plugin.__httpRequestHandler({endpoint:'calibration-import',method:'POST',body:JSON.stringify({kind:'HyperExHistoryExport',shots:[{runId:'x',fingerprint:fp}]})});const body=JSON.parse(res.body);assert.equal(res.status,200);assert.equal(body.usable,true);assert(body.points>=3);assert.equal(body.range.join(','),'1.5,5');});
test('import endpoints reject active shots and malformed calibration points',async()=>{const e=setup();e.s.phase='stage2';let r=await e.plugin.__httpRequestHandler({endpoint:'history-import',method:'POST',body:'{}'});assert.equal(r.status,409);r=await e.plugin.__httpRequestHandler({endpoint:'calibration-import',method:'POST',body:'{}'});assert.equal(r.status,409);e.s.phase='idle';r=await e.plugin.__httpRequestHandler({endpoint:'calibration-import',method:'POST',body:JSON.stringify({points:[{actualFlow:1,commandFlow:0.5}]})});assert.equal(r.status,400);r=await e.plugin.__httpRequestHandler({endpoint:'calibration-import',method:'POST',body:JSON.stringify({points:[{actualFlow:1,commandFlow:0.9},{actualFlow:2,commandFlow:0.8},{actualFlow:3,commandFlow:0.7}]})});assert.equal(r.status,400);});
test('diagnostic page exposes both import controls and manifest declares the endpoints',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml();for(const id of ['importhistory','importhistoryfile','importlut','importlutfile','historyimportstatus','lutimportstatus'])assert(html.indexOf('id="'+id+'"')>=0,id);assert(html.indexOf('history-import')>=0);assert(html.indexOf('calibration-import')>=0);const m=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'..','manifest.json')));for(const id of ['history-import','calibration-import'])assert(m.api.some(x=>x.id===id),id);});
test('diagnostic page ships a URL import prefilled with the export endpoint',()=>{const html=setup().h.buildGhcOverlayHtml();for(const id of ['importurl','importurlbtn','importurlstatus'])assert(html.indexOf('id="'+id+'"')>=0,id);assert(html.indexOf("base+'/history-export'")>=0);assert(html.indexOf('history-import')>=0);assert(html.indexOf('calibration-import')>=0);});
test('preset save captures the current targets and effective commands',async()=>{const e=setup();const r=await e.plugin.__httpRequestHandler({endpoint:'presets-save',method:'POST',body:JSON.stringify({slot:1})});const body=JSON.parse(r.body);assert.equal(r.status,200);assert.equal(body.slots[0].targets.stage2,5);assert.equal(body.slots[0].commands.stage2,2.507);assert.equal(body.slots[0].targets.stage1,2);});
test('preset save clamps values and rejects invalid slots',async()=>{const e=setup();let r=await e.plugin.__httpRequestHandler({endpoint:'presets-save',method:'POST',body:JSON.stringify({slot:6})});assert.equal(r.status,400);r=await e.plugin.__httpRequestHandler({endpoint:'presets-save',method:'POST',body:JSON.stringify({slot:2,targets:{stage1:99,stage2:99,stage3:99},commands:{stage1:99,stage2:99,stage3:99}})});const body=JSON.parse(r.body);assert.equal(r.status,200);assert.equal(body.slots[1].targets.stage1,6.5);assert.equal(body.slots[1].commands.stage1,8);});
test('preset apply stores a pending marker and writes targets to plugin settings',async()=>{const e=setup();const calls=[];e.h.setApi(async(p,o)=>{calls.push({p,o});return {ok:true,json:async()=>({})}});await e.plugin.__httpRequestHandler({endpoint:'presets-save',method:'POST',body:JSON.stringify({slot:2})});const r=await e.plugin.__httpRequestHandler({endpoint:'presets-apply',method:'POST',body:JSON.stringify({slot:2})});assert.equal(r.status,200);assert(e.s.pendingPreset);const call=calls.find(c=>c.p.indexOf('/settings')>=0);assert(call,'settings call');assert.equal(JSON.parse(call.o.body).Stage2Flow,5);assert(e.storageCalls.some(c=>c.type==='write'&&c.key==='hyperExPresetPendingV1'));});
test('pending preset applies its stored commands as the next-shot override',()=>{const e=setup();e.s.pendingPreset={slot:1,name:'',targets:{stage1:2,stage2:5,stage3:1.5},commands:{stage1:0.72,stage2:2.51,stage3:0.57},at:'x'};assert.equal(e.h.applyPendingPreset(),true);const prof=e.h.profileObject();assert.equal(prof.steps[0].flow,'0.75');assert.equal(prof.steps[1].flow,'2.5');assert.equal(prof.steps[2].flow,'0.5625');assert.equal(e.s.pendingPreset,null);});
test('diagnostic page ships preset controls and manifest declares preset endpoints',()=>{const html=setup().h.buildGhcOverlayHtml();assert(html.indexOf('id="presets"')>=0);assert(html.indexOf('id="presetstatus"')>=0);assert(html.indexOf('presets-apply')>=0);const m=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'..','manifest.json')));for(const id of ['presets','presets-save','presets-apply','presets-clear'])assert(m.api.some(x=>x.id===id),id);});
test('changing targets rescales stored commands proportionally',()=>{const e=setup();e.s.testOverrides={schema:3,writerVersion:'1.92ds',savedAt:'x',mapCreatedAt:e.s.calibrationMap.createdAt,activeRelease:true,basketContext:e.s.cfg.basketContext,targets:{stage1:2,stage2:5,stage3:1.5},stages:{stage1:{mode:'manual',origin:'adaptive',command:1.4},stage2:{mode:'manual',origin:'adaptive',command:4},stage3:{mode:'auto',command:null}},s3Shape:{enabled:true,origin:'adaptive',earlyCommand:0.688,earlySeconds:8,midCommand:0.744,midSeconds:6,lateCommand:0.761,lateSeconds:8}};e.s.cfg.stage2Flow=6;e.s.cfg.stage3Flow=2;assert.equal(e.h.rescaleOverridesForTargets(),true);const o=e.s.testOverrides;assert.equal(o.stages.stage2.command,4.8125);assert.equal(o.targets.stage1,2);assert.equal(o.targets.stage2,6);assert.equal(o.targets.stage3,2);assert.equal(o.s3Shape.earlyCommand,0.9375);assert.equal(o.s3Shape.midCommand,1);assert.equal(o.s3Shape.lateCommand,1);assert.equal(e.h.testOverrideStatus().valid,true);assert.equal(e.h.rescaleOverridesForTargets(),false);});
test('rescale is skipped without a valid LUT and leaves commands untouched',()=>{const e=setup();e.s.testOverrides={schema:3,writerVersion:'1.92ds',savedAt:'x',mapCreatedAt:'x',activeRelease:true,basketContext:'coffee',targets:{stage1:2,stage2:5,stage3:1.5},stages:{stage1:{mode:'manual',command:1.4},stage2:{mode:'manual',command:4},stage3:{mode:'auto',command:null}}};e.s.calibrationMap=null;e.s.cfg.stage2Flow=6;assert.equal(e.h.rescaleOverridesForTargets(),false);assert.equal(e.s.testOverrides.stages.stage2.command,4);});
test('diagnostic top bar ships five preset buttons with saved and empty states',()=>{const e=setup(),html=e.h.buildGhcOverlayHtml();assert(html.indexOf('id="presetbar"')>=0);assert(html.indexOf('presetslot--on')>=0);assert(html.indexOf('presetslot--off')>=0);assert(html.indexOf('renderPresetBar')>=0);assert(html.indexOf('if(!diagView){bar.style.display=')>=0);});
test('diagnostics page hides its title block and collapses STEP 2 symmetrically',()=>{const html=setup().h.buildGhcOverlayHtml();assert(html.indexOf('body.diagview #title,body.diagview #detail{display:none}')>=0);assert(html.indexOf('<details class="manualPanel" id="step2"><summary class="stepHead">')>=0);assert(html.indexOf('id="step2badge"')>=0);});
test('next-shot curve editor is a numbered fold with the editor intact',()=>{const html=setup().h.buildGhcOverlayHtml();const i=html.indexOf('id="curveEditor"');assert(i>=0);const seg=html.slice(i,i+300);assert(seg.includes('05'));assert(seg.includes('下一杯 · 曲线编辑'));assert(html.indexOf('id="curveeditorchart"')>=0);assert(html.indexOf('id="curveapply"')>=0);});
test('step2 gathers the daily blocks and step3 gathers the engineering blocks',()=>{const html=setup().h.buildGhcOverlayHtml();const at=id=>html.indexOf('id="'+id+'"');for(const id of ['curveEditor','presets','validation','stability','adaptive','stats'])assert(at('step2')<at(id),id+' after step2');for(const id of ['curveEditor','presets','validation','stability','adaptive','stats'])assert(at(id)<at('weight-curves'),id+' before weight-curves');assert(at('weight-curves')<at('step3'));assert(at('step3')<at('advisory'));assert(at('advisory')<at('advancedsettings'));assert(at('advancedsettings')<html.indexOf('stepBadge">EXPORT'));assert.equal((html.match(/<details/g)||[]).length,(html.match(/<\/details>/g)||[]).length);assert(html.indexOf('background-color:#171514')>=0);});

function presetBarFixture(){
 const e=setup(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function renderPresetBar('),b=html.indexOf('async function presetAction(',a);
 assert(a>=0&&b>a,'preset bar script block');
 const els={};const el=id=>els[id]||(els[id]={innerHTML:'',style:{},querySelectorAll:()=>[]});
 const scope={diagView:true,$:el,confirm:()=>true};
 vm.runInNewContext(html.slice(a,b),scope);
 return {e,els,scope,el};
}
function presetPayload(filled){
 const slots=[];for(let n=1;n<=5;n++)slots.push(filled.includes(n)?{slot:n,name:'',targets:{stage1:2,stage2:5,stage3:1.5},commands:{stage1:0.72,stage2:2.51,stage3:0.57},savedAt:'x'}:{slot:n,empty:true});
 return {slots,current:{targets:{stage1:2,stage2:5,stage3:1.5},commands:{stage1:0.72,stage2:2.51,stage3:0.57}}};
}
test('top-bar preset bar renders from the presets payload instead of staying empty',()=>{
 const {scope,els}=presetBarFixture();scope.renderPresets(presetPayload([1,3]));
 const bar=els.presetbar;assert(bar,'presetbar touched');assert.equal((bar.innerHTML.match(/class="b presetslot /g)||[]).length,5);
 assert.equal((bar.innerHTML.match(/presetslot--on/g)||[]).length,2);assert.equal((bar.innerHTML.match(/presetslot--off/g)||[]).length,3);
 assert(bar.innerHTML.indexOf('>1</button>')>=0,'slot 1 button');assert.equal(els.presets.innerHTML.indexOf('CURRENT')>=0,true);
});
test('top-bar preset bar keeps five disabled slots when the payload is missing',()=>{
 const {scope,els}=presetBarFixture();scope.renderPresetBar(null);
 assert.equal((els.presetbar.innerHTML.match(/presetslot--off/g)||[]).length,5);assert.equal((els.presetbar.innerHTML.match(/ disabled/g)||[]).length,5);
});
test('preset rendering never calls renderPresetBar at top level with the page detail element',()=>{
 const s=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert(s.indexOf('}renderPresetBar(d)')<0,'stray top-level renderPresetBar(d)');
 assert(s.indexOf(';renderPresetBar(d)}')>=0,'renderPresetBar called inside renderPresets');
 assert(s.indexOf('if(diagView){renderPresetBar(null);loadDiag()}')>=0,'preset bar rendered before the first load');
});

test('STEP 4 copy CSV is a collapsed details block after step 3',()=>{
 const html=setup().h.buildGhcOverlayHtml(),at=id=>html.indexOf('id="'+id+'"');
 assert(html.indexOf('<details class="manualPanel" id="step4"><summary class="stepHead">')>=0,'step4 details');
 assert(at('step4')>at('advancedsettings'));assert(at('step4')<at('csv'));
 assert.equal((html.match(/<details/g)||[]).length,(html.match(/<\/details>/g)||[]).length);
 assert.equal((html.match(/<details class="manualPanel" id="step4">/g)||[]).length,1);
});
test('diagnostics defers the CSV fetch until STEP 4 is opened',()=>{
 const html=setup().h.buildGhcOverlayHtml(),a=html.indexOf('async function loadDiag('),b=html.indexOf('\n',a);
 assert(a>=0&&b>a,'loadDiag line');
 const body=html.slice(a,b);
 assert(body.indexOf('/diagnostics-csv')<0,'loadDiag must not fetch the CSV');
 assert(html.indexOf('async function ensureCsv()')>=0,'ensureCsv defined');
 assert(html.indexOf('step4.addEventListener("toggle",function(){if(step4.open)ensureCsv()})')>=0,'toggle wiring');
 assert(html.indexOf('copy.onclick=async()=>{await ensureCsv();')>=0,'copy awaits the CSV');
});

test('STEP 4 keeps the CSV and history sections inside the details body',()=>{
 const html=setup().h.buildGhcOverlayHtml(),a=html.indexOf('<details class="manualPanel" id="step4">');
 assert(a>=0,'step4 details');
 const re=/<details\b|<\/details>/g;re.lastIndex=a;let depth=0,m,b=-1;
 while((m=re.exec(html))){if(m[0]==='</details>'){depth--;if(depth===0){b=m.index;break}}else depth++}
 assert(b>a,'step4 close');
 const block=html.slice(a,b);
 assert(block.indexOf('<summary class="stepHead">')>=0);
 assert(block.indexOf('id="csv"')>=0,'CSV section inside the fold');
 assert(block.indexOf('id="historyurl"')>=0,'history section inside the fold');
 assert(block.indexOf('<h3>LAST RUN CSV</h3>')>=0);
});

function chartFns(){
 const html=setup().h.buildGhcOverlayHtml(),lines=html.split('\n');
 const pick=n=>lines.find(l=>l.startsWith('function '+n+'('));
 const svg=pick('svgPath'),chart=pick('renderChart');
 assert(svg&&chart,'chart functions present');
 const ctx=vm.createContext({Math,Number,String,Array,isFinite,esc:v=>String(v==null?'':v)});
 vm.runInContext(svg+'\n'+chart,ctx);
 return ctx;
}
test('presets saved as JSON text are restored on reload',()=>{
 const e=setup(),list=[{name:'',targets:{stage1:2,stage2:5,stage3:1.5},commands:{stage1:.72,stage2:2.51,stage3:.57},savedAt:'x'},null,null,null,null];
 e.event('hyperExPresetsV1',JSON.stringify(list));
 assert.equal(e.s.presets.length,5);assert.equal(e.s.presets[0].targets.stage2,5);assert.equal(e.s.presets[0].commands.stage3,.57);
});
test('a stored pending preset survives a reload as JSON text',()=>{
 const e=setup(),p={slot:2,targets:{stage1:2,stage2:5,stage3:1.5},commands:{stage1:.7,stage2:2.5,stage3:.6}};
 e.event('hyperExPresetPendingV1',JSON.stringify(p));
 assert(e.s.pendingPreset);assert.equal(e.s.pendingPreset.slot,2);
});
test('dense chart series are decimated while keeping the peak',()=>{
 const c=chartFns(),pts=[];for(let i=0;i<900;i++)pts.push([i,i===450?9:1+Math.sin(i/10)*0.2]);
 const d=c.svgPath(pts,0,899,0,9);assert((d.match(/ L /g)||[]).length<420,'vertices '+((d.match(/ L /g)||[]).length));
 assert(d.indexOf(' 18.0')>=0,'peak drawn at the top edge');
});
test('marker overlays are capped and keep the newest marker',()=>{
 const c=chartFns(),svg={innerHTML:''},ms=[];for(let i=0;i<400;i++)ms.push({x:i,y:1,color:'#fff',shape:'circle',label:'c'+i});
 c.renderChart(svg,[{points:[[0,1],[399,1]],stroke:'#fff'}],0,2,ms,[]);
 assert((svg.innerHTML.match(/<circle /g)||[]).length<=161,'circles '+((svg.innerHTML.match(/<circle /g)||[]).length));
 assert(svg.innerHTML.indexOf('c399')>=0,'newest marker kept');
});
test('diagnostics surface the last abort reason from the captured run',()=>{
 const html=setup().h.buildGhcOverlayHtml();
 assert(html.indexOf('learningExecutionFaults')>=0);assert(html.indexOf('ABORT · ')>=0);assert(html.indexOf('["ABORT","中止"]')>=0);
});

test('charts default to Canvas 2D and expose a switch button',()=>{
 const html=setup().h.buildGhcOverlayHtml();
 assert(html.indexOf('chartEngine="canvas"')>=0,'default engine');
 assert(html.indexOf('id="chartengine"')>=0,'switch button');
 assert(html.indexOf('>CANVAS 2D</button>')>=0,'initial label');
 assert(html.indexOf('chartEngine=chartEngine==="canvas"?"svg":"canvas"')>=0,'toggle wiring');
});
test('chart rendering dispatches to Canvas or SVG by element type',()=>{
 const html=setup().h.buildGhcOverlayHtml();
 assert(html.indexOf('function renderChartAny(')>=0);
 assert(html.indexOf("renderChartAny($('flowchart')")>=0);
 assert(html.indexOf("renderChartAny($('anglechart')")>=0);
 assert(html.indexOf("renderChartAny($('weightchart')")>=0);
 assert(html.indexOf('tagName.toLowerCase()==="canvas"')>=0);
});
test('canvas renderer draws axes, series and hit-testable markers',()=>{
 const html=setup().h.buildGhcOverlayHtml();
 const a=html.indexOf('function drawChartCanvas('),b=html.indexOf('function clearChartEl(',a);
 assert(a>=0&&b>a,'canvas renderer block');
 const blk=html.slice(a,b);
 assert(blk.indexOf('getContext("2d")')>=0);
 assert(blk.indexOf('moveTo(18,187)')>=0,'axes');
 assert(blk.indexOf('cv._markers.push')>=0,'marker cache for hit testing');
 assert(blk.indexOf('flowpointdetail')>=0,'detail line');
 assert(blk.indexOf('devicePixelRatio')>=0,'dpr scaling');
});
test('switching engines rebuilds the chart elements in place',()=>{
 const html=setup().h.buildGhcOverlayHtml();
 const a=html.indexOf('function syncChartEngine('),b=html.indexOf('const engineBtn=',a);
 assert(a>=0&&b>a,'syncChartEngine block');
 const blk=html.slice(a,b);
 assert(blk.indexOf('createElement("canvas")')>=0);
 assert(blk.indexOf('createElementNS')>=0);
 assert(blk.indexOf('el.replaceWith(n)')>=0);
});
test('opening diagnostics still verifies the selected profile',async()=>{
 const e=setup();
 e.s.phase='idle';
 const resp=await e.plugin.__httpRequestHandler({endpoint:'calibration-status',method:'GET'});
 assert.equal(resp.status,200);
 assert(e.calls.some(c=>c.path==='/workflow'),'workflow readback still happens');
});
test('startup profile maintenance shares one list and is not deferred',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert(src.indexOf('let startupProfileRecords = null;')>=0,'startup list');
 assert(src.indexOf('await ensureProfileInstalled(startupProfileRecords)')>=0);
 assert(src.indexOf('await ensureCalibrationProfilesInstalled(startupProfileRecords)')>=0);
 assert(src.indexOf('startupProfileMaintenanceTimer')<0,'no deferred timer');
 assert(src.indexOf('PROFILE_REPAIR_COOLDOWN_MS')<0,'no repair cooldown');
});
test('upsert accepts a shared profile list and keeps it current',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert(src.indexOf('async function upsertProfile(profile, recordsArg)')>=0);
 assert(src.indexOf('const at = records.findIndex(r => r && r.id === chosen.id)')>=0);
 assert(src.indexOf('if (created) records.push(created);')>=0);
});
test('legacy calibration profile migration is remembered across reloads',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert(src.indexOf('if (state.legacyProfileHiddenTitle === legacyTitle) return;')>=0);
 assert(src.indexOf('storageWrite(STORAGE_LEGACY_PROFILE, legacyTitle);')>=0);
 assert(src.indexOf('state.legacyProfileHiddenTitle = typeof value === "string" ? value : "";')>=0);
});

test('bounded S2 refill return command stays on the 1/16 driver grid and is writable',async()=>{
 const e=await refillFixture();
 e.s.cfg.s2RefillBoundedModel=true;
 e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:140,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
 const t=e.s.liveTrim,p=e.h.stage2StartupPlan();
 t.startup={status:'armed',plan:p};t.run.config.s2StartupPlan=copy(p);
 assert.equal(p.returnCommandMlS*16,Math.round(p.returnCommandMlS*16),'return command must be a native driver step');
 assert.equal(p.returnCommandMlS,p.baseCommandMlS);
 await trimTick(e);trimAck(e);
 assert.equal(await e.h.dispatchS2Startup(t,'return'),true);
 assert.equal(rawWrites(e).length,2);
 assert.equal(t.pending.startupAction,'return');
 assert.equal(t.pending.command,p.baseCommandMlS);
});
test('an off-grid refill return command falls back to the control base instead of aborting',async()=>{
 const e=await refillFixture();
 e.s.cfg.s2RefillBoundedModel=true;
 e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:140,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
 const t=e.s.liveTrim,p=e.h.stage2StartupPlan();
 t.startup={status:'armed',plan:p};t.run.config.s2StartupPlan=copy(p);
 await trimTick(e);trimAck(e);
 t.startup.plan.returnCommandMlS=2.507;t.startup.returnReason='cutoff';
 assert.equal(await e.h.dispatchS2Startup(t,'return'),true);
 assert.equal(t.pending.command,p.baseCommandMlS);
});

test('every flow written to the machine sits on the 1/16 ml/s driver grid',()=>{
 const e=setup(),step=e.h.profileObject().steps[1];
 for(const cmd of [.1,.33,.569,1.008,2.507,3.9872,5.555,8]){
  const payload=e.h.encodeLiveFlowFrame(step,1,cmd);
  assert.equal(parseInt(payload.slice(4,6),16),Math.round(cmd*16),'A010 '+cmd);
 }
 for(const prof of [e.h.profileObject(),e.h.calibrationProfileObject('low'),e.h.calibrationProfileObject('full')]){
  for(const s of prof.steps){const v=Number(s.flow);assert.equal(v*16,Math.round(v*16),s.name+' '+s.flow);}
 }
});

test('strip real flow falls back to the raw scale when the trim value is stale',()=>{
 const e=setup();e.s.phase='stage2';const t0=e.now();
 e.s.diagnosticCurrent={runId:'x',startedAtMs:t0-10000,rawScaleSamples:Array.from({length:12},(_,i)=>({phase:'stage2',tMs:8000+i*100,weightG:i*0.5,scaleTimestampSeconds:100+i*0.1}))};
 e.s.liveTrim={lastCheckGS:4.5,lastCheckAtMs:t0-5000};
 assert.equal(e.h.stripRealFlowText(),'5.00 g/s');
 e.s.liveTrim={lastCheckGS:3.21,lastCheckAtMs:t0-100};
 assert.equal(e.h.stripRealFlowText(),'3.21 g/s');
});
test('flow strip pushes the skin twice a second while S2 and S3 run',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert(src.includes('state.flowStripTimer = setTimeout(tick, 500);'));
 assert(!src.includes('state.flowStripTimer = setTimeout(tick, 1000);'));
});

test('history keeps full sampling only for the newest shots',()=>{
 const e=setup();
 const mk=id=>({runId:id,fullRecord:{samples:[{a:1}],rawScaleSamples:[{b:1}],events:[{c:1}],liveFlowTrim:{trace:[{d:1}]}}});
 const file={schema:2,shots:Array.from({length:14},(_,i)=>mk('r'+i))};
 e.h.trimHistoryFullRecords(file);
 assert.equal(file.shots[13].fullRecord.samples.length,1,'newest keeps samples');
 assert.equal(file.shots[13].fullRecord.events.length,1,'newest keeps events');
 assert.equal(file.shots[9].fullRecord.samples,null,'fifth oldest drops samples');
 assert.equal(file.shots[9].fullRecord.events.length,1,'fifth keeps events');
 assert.equal(file.shots[0].fullRecord.events,null,'oldest drops events');
 assert.equal(file.shots[0].fullRecord.liveFlowTrim.trace.length,0,'oldest drops trace');
});
test('history readback compares the stored write token instead of canonicalising the file',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','plugin.js'),'utf8');
 assert(src.includes('parsed.writeToken !== state.pendingHistoryWriteToken'));
 assert(!src.includes('adaptiveHistoryFingerprintKey(JSON.parse(state.pendingHistoryWrite))'),'no second full parse');
});

// §22.11 invariant: the 0.7 s rise-time floor is a MACHINE property reached only
// at >=7.0 ml/s, so the flood ceiling may not depend on the dialled cup target.
// 2.2.6 gave 6.0 at target 4.0 and 6.75 at 4.5, both below the floor.
test('§22.11 the flood ceiling reaches the rise-time floor for every cup target',()=>{
 for(const target of [3,3.5,4,4.5,5,5.5,6,6.5]){
  const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;e.s.cfg.stage2Flow=target;
  e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
  const p=e.h.stage2StartupPlan();
  assert(p.enabled,'target '+target+': '+p.reason);
  assert(p.floodCommandMlS>=7,'target '+target+' flood '+p.floodCommandMlS);
  assert.equal(p.boostCommandMlS,7,'target '+target);
  assert(p.boostCommandMlS<=8);
  assert.equal(p.flowCutoffGS,Math.round(target*0.85*1000)/1000,'target '+target);
 }
});
// §22.11 invariant: r may be greater than 1. It moves the PLATFORM only; the
// flood stays at the envelope. Pinning r=1 (2.2.6 high-flow-direct) got both
// wrong at once: it tied the ceiling to the target and raised the platform to
// the numeric target instead of target/r.
test('§22.11 r greater than 1 lowers the platform and never moves the flood',()=>{
 for(const r of [1.05,1.19,1.29,1.39,1.6]){
  const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;
  e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
  const prior=evidenceRun(e,'r'+r);prior.config.stage2Flow=5;prior.config.stage2LutCommandMlS=2.507;prior.samples=[];
  e.s.diagnosticLast=prior;
  e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,buckets:[{id:'g1',center:.3,radius:.12,stages:{s2:{r,n:4,lastRunId:'r'+r}}}],lastBucketId:'g1'}};
  const p=e.h.stage2StartupPlan();
  assert.equal(p.controlSource,'gain-memory','r='+r);
  assert.equal(p.controlBaseMlS,Math.round(5/r*16)/16,'r='+r);
  assert.equal(p.returnCommandMlS,p.controlBaseMlS,'r='+r);
  assert(p.controlBaseMlS<5,'r>1 must place the platform below the target, r='+r);
  assert.equal(p.floodCommandMlS,7,'the flood must not follow r, r='+r);
  assert.equal(p.returnCommandMlS*16,Math.round(p.returnCommandMlS*16),'grid, r='+r);
 }
});
// §22.11 invariant: the refill law must span the WHOLE driver range. Upward to
// the envelope, downward below the platform (bleed) to commandFlowMin. The old
// floor at controlBaseMlS made an overshoot uncorrectable.
test('§22.11 the refill law spans the full driver range and only ever steps the flood down',async()=>{
 const e=await refillFixture();e.s.cfg.s2RefillBoundedModel=true;
 e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
 const p=e.h.stage2StartupPlan();const t=e.s.liveTrim;t.startup={status:'boosting',plan:p};
 assert.equal(e.h.boundedRefillCommand(t),p.floodCommandMlS,'no cup flow yet: charge at the envelope');
 assert(p.floodCommandMlS>=7);
 t.startup.lastBoostCommandMlS=p.floodCommandMlS;
 e.advance(1500);refillSamples(e,9);const bleed=e.h.boundedRefillCommand(t);
 assert(bleed<p.controlBaseMlS,'overshoot must command below the platform, got '+bleed+' vs '+p.controlBaseMlS);
 assert(bleed>=0.10);
 let previous=bleed;
 for(let i=0;i<8;i++){
   t.startup.lastBoostCommandMlS=previous;e.advance(120);refillSamples(e,9);
   const next=e.h.boundedRefillCommand(t);
   assert(next<=previous+1e-9,'flood must not re-increase: '+previous+' -> '+next);
   assert(next>=0.10&&next<=p.floodCommandMlS);
   previous=next;
 }
 assert(previous<p.controlBaseMlS&&previous>=0.10,'sustained overshoot keeps bleeding below the platform, got '+previous);
 t.startup.lastBoostCommandMlS=previous;e.advance(200);refillSamples(e,20);
 const floorBleed=e.h.boundedRefillCommand(t);
 assert.equal(floorBleed,0.125,'full bleed reaches the first writable quantum, got '+floorBleed);
 assert(floorBleed>=0.10,'never below the driver minimum');
});
test('bounded refill preview shows the envelope flood, the r-derived platform and targetPercent as an upper bound only',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function renderRefillEditor()'),b=html.indexOf('function renderCurveEditor(',a),elements={},inputs={};
 const get=id=>elements[id]||(elements[id]={textContent:'',innerHTML:'',disabled:false});
 const box=get('curverefill');box.querySelector=q=>inputs[q]||(inputs[q]={});box.querySelectorAll=q=>[];
 const fields=[['startDelayMs','启动延时','s'],['targetPercent','补水指令上限','%'],['cutoffPercent','收回 / 收口起点','%'],['maxDurationMs','最长补水','s'],['approachMs','接管渐进时间','s']];
 const scope={esc:String,$:get,curveDraft:{refill:{...copy(refillDefaults),basis:'cup-target',targetPercent:100},values:{stage2:3.875}},curveLatest:{targetGS:{stage2:5},refillLimits:{targetPercent:[100,160,1]},canApply:true,refillActive:true,refillBoundedModel:true,refillPreview:{settings:{basis:'cup-target'},refillPumpBaseMlS:3.875,controlGain:1.29,controlSource:'gain-memory',floodCommandMlS:8,baseCommandMlS:3.875,returnCommandMlS:3.875}},curveBusy:false,renderRefillHistory(){},refillControlFields:fields,Math,Number,String};
 vm.runInNewContext(html.slice(a,b)+';renderRefillEditor();',scope);
 const basis=get('refillvalue-basis').textContent;
 assert.match(basis,/灌水 8\.0000 ml\/s/);
 assert.match(basis,/平台收回 3\.8750 ml\/s/);
 assert.match(basis,/r 1\.29/);
 assert.doesNotMatch(basis,/另一基准/);
 assert.doesNotMatch(basis,/高流量区直给/);
 assert.equal(get('refillvalue-targetPercent').textContent,'100% · 仅上限');
 assert.match(get('refillpreviewlabels').innerHTML,/≤ 8\.0000 ml\/s/);
 assert.match(get('refillpreviewlabels').innerHTML,/灌水上限/);
});
// §22.11: the cutoff handoff lands on the PLATFORM (target/r), which may sit
// above the running profile command; a pressure/stale protective return takes
// the lower of the two so it can never raise the pump during a pressure event.
// The old two-value pin (handoffOk) is gone.
test('2.2.28 refill handoff uses the running profile base when no gain memory exists; a protective return never raises the pump',async()=>{
 for(const protective of [false,true]){
  const e=await refillFixture();disableGainMemory(e);e.s.cfg.s2RefillBoundedModel=true;
  e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent:85,maxDurationMs:2500,approachMs:800};
  e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage2:{mode:'manual',command:2,desiredGS:5,origin:'manual'}}};
  const t=e.s.liveTrim;t.profile.steps[1].flow='2.000';t.commands[1]=2;
  const plan=e.h.stage2StartupPlan();
  assert.equal(plan.baseCommandMlS,2,'profile command');
  assert.equal(plan.controlBaseMlS,2,'running profile base, not the empty-basket LUT');
  assert.equal(plan.controlSource,'profile-base');
  assert.equal(plan.returnCommandMlS,2);
  t.startup={status:'armed',plan};
  assert.equal(await e.h.dispatchS2Startup(t,'boost'),true,String(t.startup.blockReason));
  assert.equal(t.pending.command,7,'first flood write is the configured cap (default 7)');
  trimAck(e);e.advance(1500);refillSamples(e,4.3);
  t.startup.returnReason=protective?'S2 refill pressure margin reached':'S2 refill reached configured cup-flow cutoff';
  assert.equal(await e.h.dispatchS2Startup(t,'return'),true);
  assert.equal(t.pending.command,2,protective?'protective must not raise the pump':'cutoff lands on the running profile base');
 }
});
test('S2 learning window is a hard settle after the confirmed refill return',()=>{
 const e=normalEnv(),r=startupRun(e,'lw',.5,2,4);
 r.config.experimentalLiveTrim=true;r.config.s2StartupPlan={strategy:'refill-85'};
 r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'},{kind:'startup-complete',frame:1,tMs:2700}]};
 const w=e.h.s2LearningWindow(r);
 assert.equal(w.refill,true);assert.equal(w.confirmed,true);
 // F2 (user 2026-11-01): measurement windows settle 800 ms; the chain evidence
 // keeps the full 1500 ms pump settle because it integrates the recovery ramp.
 assert.equal(w.settleMs,800);assert.equal(w.startMs,3500);
 assert.equal(w.chainSettleMs,1500);
 const wc=e.h.s2LearningWindow(r,"chain");
 assert.equal(wc.settleMs,1500);assert.equal(wc.startMs,4200);
 r.liveFlowTrim.trace=r.liveFlowTrim.trace.filter(x=>x.kind!=='startup-complete');
 const u=e.h.s2LearningWindow(r);
 assert.equal(u.refill,true);assert.equal(u.confirmed,false);assert.equal(u.startMs,null);
});
test('single-shot chain never measures the refill recovery before the learning window',()=>{
 const e=normalEnv(),r=startupRun(e,'chain-win',.5,2,4);
 r.config.experimentalLiveTrim=true;r.config.s2StartupPlan={strategy:'refill-85'};
 const head=[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'},{kind:'startup-complete',frame:1,tMs:2700}];
 const tail=[{kind:'write',frame:1,tMs:4400,commandMlS:3.5,previousMlS:2.5},{kind:'write',frame:1,tMs:5600,commandMlS:4.5,previousMlS:3.5},{kind:'check',frame:1,tMs:4400,rawGS:3.5},{kind:'check',frame:1,tMs:8000,rawGS:4.6}];
 r.liveFlowTrim={trace:[...head,{kind:'write',frame:1,tMs:3000,commandMlS:2.5,previousMlS:3.5},...tail]};
 assert.equal(e.h.liveTrimChainEvidence(r),null,'baseline carried over from the refill recovery');
 r.liveFlowTrim={trace:[...head,{kind:'write',frame:1,tMs:4300,commandMlS:2.5,previousMlS:3.5},...tail]};
 const ev=e.h.liveTrimChainEvidence(r);
 assert(ev);assert.equal(ev.usable,true);
});
test('refill panel shows the S2 learning window and its exclusion',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function refillLearningLine('),b=html.indexOf('function renderCurveEditor(',a),elements={},inputs={};
 const get=id=>elements[id]||(elements[id]={textContent:'',innerHTML:'',disabled:false});
 const box=get('curverefill');box.querySelector=q=>inputs[q]||(inputs[q]={});box.querySelectorAll=q=>[];
 const fields=[['startDelayMs','启动延时','s'],['targetPercent','补水指令上限','%'],['cutoffPercent','收回 / 收口起点','%'],['maxDurationMs','最长补水','s'],['approachMs','接管渐进时间','s']];
 const scope={esc:String,$:get,curveDraft:{refill:{...copy(refillDefaults),targetPercent:100},values:{stage2:3.875}},curveLatest:{targetGS:{stage2:5},refillLimits:{targetPercent:[100,160,1]},canApply:true,refillActive:true,refillBoundedModel:true,refillPreview:{settings:{basis:'cup-target'},refillPumpBaseMlS:5,controlGain:1,controlSource:'high-flow-direct',baseCommandMlS:3.0625,returnCommandMlS:3.0625},refillLastShot:{timeline:{stage2StartMs:1000,onsetMs:1000,relative:{onsetS:0,returnS:5.2,completeS:5.3},overlap:{seconds:5.2},learning:{refill:true,confirmed:true,startMs:6700,settleMs:800,chainSettleMs:1500}}}},curveBusy:false,renderRefillHistory(){},refillControlFields:fields,Math,Number};
 vm.runInNewContext(html.slice(a,b)+';renderRefillEditor();',scope);
 assert.match(get('refillnodes').innerHTML,/学习窗口：5\.70 s 起/);
 assert.match(get('refillnodes').innerHTML,/排除补水 800 ms（链路 1500 ms）后 · 末 60% 回归/);
});

// R-5 invariant (cut 9): an unconfirmed refill return must NOT degrade into
// "no window". Before this the three measurement consumers fell back to the
// unwindowed data, so the flood and its recovery went straight into r, the
// chain evidence and the output-quality tail.
test('§R-5 unconfirmed refill return withholds every S2 measurement consumer',()=>{
 const e=normalEnv(),r=startupRun(e,'r5',.5,2,4);
 r.config.experimentalLiveTrim=true;r.config.s2StartupPlan={strategy:'refill-85'};
 r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'}]};
 const w=e.h.s2LearningWindow(r);
 assert.equal(w.refill,true);assert.equal(w.confirmed,false);assert.equal(w.startMs,null);
 const q0=e.h.controlOutputQuality(r,'stage2');
 assert.equal(q0.available,false);assert.equal(q0.reason,'refill-return-unconfirmed');
 assert.equal(e.h.stage2EffectiveCommand(r),null);
 assert.equal(e.h.liveTrimChainEvidence(r),null);
 r.liveFlowTrim.trace.push({kind:'startup-complete',frame:1,tMs:2700});
 const ok=e.h.s2LearningWindow(r);
 assert.equal(ok.confirmed,true);assert.equal(ok.startMs,3500);
 assert.notEqual(e.h.controlOutputQuality(r,'stage2').reason,'refill-return-unconfirmed');
});
// F2 invariant: a settle window that empties a short S2 must say so instead of
// reporting the same "not enough data" as a genuinely sparse phase.
test('§F2 a learning window that empties S2 reports learning-window-too-short',()=>{
 const e=normalEnv(),r=startupRun(e,'f2',.5,2,4);
 r.config.experimentalLiveTrim=true;r.config.s2StartupPlan={strategy:'refill-85'};
 const last=r.rawScaleSamples.filter(x=>x.phase==='stage2').slice(-1)[0];
 r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'},
  {kind:'startup-complete',frame:1,tMs:Number(last.tMs)-200}]};
 const q=e.h.controlOutputQuality(r,'stage2');
 assert.equal(q.available,false);
 assert.equal(q.reason,'learning-window-too-short');
 assert(q.rawSamples>=6&&q.windowSamples<6,'window '+q.windowSamples+' of '+q.rawSamples);
 const assess=e.h.controlLearningAssessment(r,'stage2');
 assert.match(String(assess.outputQualityReason||''),/learning-window-too-short/);
});

// §22.11 CLOSED-LOOP ACCEPTANCE. This is the test the refill never had: it drives
// the real dispatch/tick path against a synthetic plant built from the measured
// machine dynamics (SKILL §22.5: 0.35 s dead time + first-order tau 0.4 s; cup
// flow = r(command) x pump, r 1.23 below 4 ml/s and tending to 1 above 4.5, no
// artificial puck ceiling) and asserts on the SCALE-FLOW CURVE, not on
// plan constants. 2.2.2 (+52% overshoot), 2.2.3 (cutoff never reached) and 2.2.5
// (S2 stuck at -24%) all passed a fully green mirror suite; this one fails them.
async function refillLoopEnv(r,{cutoffPercent=85,floodMode='fixed',floodMaxMlS=7}={}){
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.liveFlowTrimLevel=3;e.s.cfg.s2RefillBoundedModel=true;e.s.runtimeProfileVerified=true;
 e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent,maxDurationMs:4000,approachMs:800,floodMode,floodMaxMlS};
 const prior=evidenceRun(e,'loop-prior');prior.config.stage2Flow=5;prior.config.stage2LutCommandMlS=2.507;prior.samples=[];
 e.s.diagnosticLast=prior;
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,buckets:[{id:'g1',center:.3,radius:.12,stages:{s2:{r,n:4,lastRunId:'loop-prior'}}}],lastBucketId:'g1'}};
 e.h.startSequence(0);e.s.phase='stage2';e.s.lastFrame=1;await e.h.startLiveTrim();
 e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:2.5});
 const t=e.s.liveTrim,p=e.h.stage2StartupPlan();
 t.startup={status:'armed',plan:p};t.run.config.s2StartupPlan=copy(p);t.report.s2StartupPlan=copy(p);
 t.report.startupExecution={status:'armed',reason:p.reason};e.s.lastFlow=.1;
 return e;
}
async function refillClosedLoop(e,{totalMs=8000,stepMs=50,tickEvery=5}={}){
 const t=e.s.liveTrim,target=e.s.cfg.stage2Flow,startMs=t.run.startedAtMs;
 const limiter=Number(t.profile.steps[1].limiter.value),baseCmd=Number(t.profile.steps[1].flow);
 const plan=t.startup.plan,platform=plan.controlBaseMlS,cutoff=target*plan.cutoffFraction;
 const cmds=[];let mach=0,cup=0,weight=0,elapsed=0,step=0,seen=rawWrites(e).length;
 const scale=[],curve=[];
 while(elapsed<totalMs){
  const all=rawWrites(e);
  for(let i=seen;i<all.length;i++){cmds.push({atMs:elapsed,cmd:parseInt(JSON.parse(all[i].payload.data).payload.slice(4,6),16)/16});trimAck(e);}
  seen=all.length;
  let goal=baseCmd;for(const w of cmds)if(elapsed-w.atMs>=350)goal=w.cmd;
  // §22.11 plant calibration (2026-11-01 real-machine ledger): r is a function of
  // the command, not a constant. 1-4 ml/s sits at ~1.23 and the high-flow region
  // asymptote equals the pump command (r -> 1), so a flood at 8 ml/s lifts the cup
  // toward 8 g/s. The old plant pinned the basket at 5.5 ml/s and applied the
  // learned r everywhere; both made the reported overshoot optimistic.
  const plantR=cmd=>cmd<=4?1.23:cmd>=4.5?1:1.23-(cmd-4)*.46;
  mach+=(Math.max(0,goal)-mach)*Math.min(1,stepMs/400);
  cup+=(plantR(mach)*mach-cup)*Math.min(1,stepMs/200);
  weight+=cup*stepMs/1000;
  e.advance(stepMs);elapsed+=stepMs;step++;
  const tMs=e.now()-startMs;
  scale.push({phase:'stage2',profileFrame:1,tMs,weightG:weight,scaleTimestampSeconds:100+tMs/1000,tareReset:false});
  curve.push({tMs,goal,mach,cup});
  e.s.lastPressure=Math.min(limiter*0.8,0.8+mach*0.30);
  e.s.lastFlow=mach;e.s.lastMachineTelemetryValid=true;e.s.lastMachineState='espresso';e.s.lastSubstate='pouring';
  e.s.lastFrame=1;e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();
  t.run.rawScaleSamples=scale.slice(-30);
  e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:goal,flow:mach,pressure:e.s.lastPressure,substate:'pouring'});
  if(step%tickEvery===0)await trimTick(e);
  if(t.startup.status==='complete'&&elapsed>4000)break;
 }
 const rise=(lo,hi)=>{const a=curve.find(x=>x.cup>=lo*target),b=curve.find(x=>x.cup>=hi*target);return a&&b?(b.tMs-a.tMs)/1000:null;};
 const peak=Math.max(...curve.map(x=>x.cup));
 const tail=curve.filter(x=>x.tMs>=curve[curve.length-1].tMs-2000);
 const plateau=tail.reduce((s,x)=>s+x.cup,0)/Math.max(1,tail.length);
 const refillWrites=t.report.trace.filter(x=>x.kind==='write'&&x.startupAction);
 const refillCmds=refillWrites.map(x=>({a:x.startupAction,c:Number(x.commandMlS)}));
 return {curve,cmds,refillCmds,target,platform,cutoff,rise2080:rise(.2,.8),peak,peakPct:(peak/target-1)*100,plateau,plateauPct:(plateau/target-1)*100,
  maxCmd:Math.max(...cmds.map(x=>x.cmd),0),minCmd:cmds.length?Math.min(...cmds.map(x=>x.cmd)):null,
  refillWrites,status:t.startup.status,returnCmd:(refillWrites.filter(x=>x.startupAction==='return').slice(-1)[0]||{}).commandMlS,
  trims:refillWrites.filter(x=>x.startupAction==='trim').map(x=>x.commandMlS)};
}
test('§22.11 closed loop: max flood then bleed reaches a steep rise with bounded scale-flow overshoot',async()=>{
 const e=await refillLoopEnv(1.29);
 const R=await refillClosedLoop(e);
 if(process.env.HX_LOOP_REPORT)console.log('   loop:',JSON.stringify({rise2080:R.rise2080,peakPct:+R.peakPct.toFixed(1),plateauPct:+R.plateauPct.toFixed(1),maxCmd:R.maxCmd,minCmd:R.minCmd,trims:R.trims,status:R.status,returnCmd:R.returnCmd,platform:R.platform,writes:R.refillWrites.length}));
 // The pump command is a VECTOR: it must exceed the numeric cup target while
 // charging (this single assertion kills every "pump = setpoint" regression,
 // including targetPercent x base and the r=1 high-flow-direct base).
 assert(R.maxCmd>R.target,'pump must exceed the cup target while flooding, max '+R.maxCmd);
 assert(R.maxCmd>=7,'the 0.7 s rise floor needs >=7.0 ml/s, max '+R.maxCmd);
 // ...and it must go BELOW the platform to arrest the rise (bleed). The old
 // controlBaseMlS floor and the two-value handoffOk pin both forbade this.
 assert(R.refillCmds.every(x=>x.c>=0.10&&x.c<=8),'refill writes stay inside the driver range');
 // §22.11 handoff: both halves must actually happen in the path this test drives.
 // A single-step return (2.2.3 style) produces no bleed write at all. A cutoff
 // that never fires and falls back to holdMs still bleeds, but it keeps flooding
 // until the timer; that class is caught by the +40% peak tripwire below.
 const actions=R.refillCmds.map(x=>x.a);
 assert(actions.includes('bleed'),'the two-step handoff must bleed before the platform; got '+JSON.stringify(R.refillCmds));
 assert(actions.includes('return'),'the two-step handoff must end on the platform; got '+JSON.stringify(R.refillCmds));
 if(process.env.HX_LOOP_REPORT)console.log('   refill writes:',JSON.stringify(R.refillCmds));
 // Curve shape: steep rise, bounded overshoot measured on SCALE flow (§22.1).
 assert(R.rise2080!==null&&R.rise2080<=1.5,'20-80% rise must be steep, got '+R.rise2080);
 // §22.11 calibrated baseline (2026-11-01): with the puck ceiling removed and
 // r(command), the same two-step handoff measures +33.2% peak instead of the
 // +21.4% the capped plant reported. That number is the baseline the later
 // cuts must beat. The tripwire sits at +40%: this plant's physical asymptote
 // (8 ml/s flood, r->1) is +60%, so a "cutoff never fires, holdMs recovers"
 // regression peaks near +59% and would slip past a +60 bound. +40% keeps 6.8
 // points over the deterministic baseline and still fails that regression.
 assert(R.peakPct<=40,'scale-flow overshoot regressed past the calibrated baseline, got +'+R.peakPct.toFixed(1)+'%');
 assert.equal(R.status,'complete','refill must complete, got '+R.status);
 assert.equal(R.returnCmd,R.platform,'the handoff lands on target/r');
 assert(R.refillWrites.length<=10,'refill writes must stay few, got '+R.refillWrites.length);
});
test('§22.11 closed loop still converges when the learned gain is off by 20 percent',async()=>{
 for(const r of [1.05,1.6]){
  const e=await refillLoopEnv(r);
  const R=await refillClosedLoop(e);
  if(process.env.HX_LOOP_REPORT)console.log('   loop r='+r+':',JSON.stringify({rise2080:R.rise2080,peakPct:+R.peakPct.toFixed(1),plateauPct:+R.plateauPct.toFixed(1),platform:R.platform,maxCmd:R.maxCmd,minCmd:R.minCmd,status:R.status}));
  assert(R.maxCmd>R.target,'r='+r);
  const actions=R.refillCmds.map(x=>x.a);
  assert(actions.includes('bleed')&&actions.includes('return'),'r='+r+' must run both handoff halves; got '+JSON.stringify(R.refillCmds));
  assert.equal(R.status,'complete','r='+r+' status '+R.status);
  assert.equal(R.returnCmd,R.platform,'r='+r);
  assert(R.peakPct<=40,'r='+r+' overshoot regressed past the calibrated baseline: +'+R.peakPct.toFixed(1)+'%');
  assert(Math.abs(R.plateauPct)<=25,'r='+r+' plateau '+R.plateauPct.toFixed(1)+'%');
 }
});





// ---- cut 6 (2.2.13): command quantization (Q-1 / L-14) ---------------------
function onGrid(v){return Number.isFinite(Number(v))&&Math.round(Number(v)*16)===Number(v)*16;}
test('§22.11/Q-1 every published command sits on the 1/16 ml/s driver grid',()=>{
 const e=setup();
 for(const flow of [2,3,4,5,6,6.5,7])for(const stage of ['stage1','stage2','stage3']){
  const c=e.h.resolvedStageCommandFlow(stage,flow);
  assert(onGrid(c),stage+' resolved '+flow+' -> '+c);
 }
 e.s.cfg.stage2Flow=5;
 for(const base of [2.507,3.067,5.5]){
  const c=e.h.liveTrimControlCenter('stage2',base,null);
  assert(onGrid(c.commandMlS),'live centre '+base+' -> '+c.commandMlS);
 }
 const s2={targetGS:5,command:2.5,measured:5.033},prev2={targetGS:5,command:2.5,measured:5.0};
 const scal=e.h.scalarLearningSuggestion('S2','s2',s2,prev2,e.h.learningPolicy('正常'),false);
 if(scal.suggestedCommandMlS!=null)assert(onGrid(scal.suggestedCommandMlS),'scalar '+scal.suggestedCommandMlS);
 const cur=e.h.scalarConsensusSuggestion('S2',{targetGS:5,command:2.5,measured:6.2},{targetGS:5,command:2.5,measured:6.0},{deadbandPct:8,maxVariability:.25,gain:.35,maxFraction:.12,maxAbs:.35,rule:'x'});
 if(cur.suggestedCommandMlS!=null)assert(onGrid(cur.suggestedCommandMlS),'consensus '+cur.suggestedCommandMlS);
});
test('§22.11/Q-1 the learned command equals what the profile runs, so HOLD is reachable',()=>{
 const e=setup();
 for(const target of [3,4,5,6,6.5])for(const r of [1.05,1.19,1.29,1.39,1.6]){
  const cmd=Math.round(target/r*16)/16;
  assert.equal(Math.round(cmd*16),cmd*16,'target '+target+' r '+r+' -> '+cmd);
  // formatCommandFlow writes a String of the grid value and never re-rounds it
  assert.equal(Number(String(cmd)),cmd);
 }
 // 2.2.12 wrote round(target/r,3): 3.876. The driver actually runs 3.875, so the
 // old comparison saw a 0.001-0.03 gap on every shot and never took the HOLD branch.
 assert.equal(Math.round(5/1.29*16)/16,3.875);
 assert.equal(Math.round(5/1.29*1000)/1000,3.876);
});
test('§22.11/Q-1 real applied cup: r=1.2874 now compares equal to the 3.875 curve',()=>{
 // REVIEW 2026-11-01 §1.4 / §0.1: the 00:25 cup ran a 3.875 ml/s curve with a
 // 3.884 ml/s gain-memory suggestion, so every shot rewrote the profile.
 const r=1.2874,applied=3.875;
 assert.equal(Math.round(5/r*1000)/1000,3.884);
 assert(Math.abs(Math.round(5/r*1000)/1000-applied)>0.005);
 assert.equal(Math.round(5/r*16)/16,applied);
});

// ---- cut 7 / v2.2.14 · S3 shape (L-5 / L-6 + per-step gates) ----
test('S3 step limit floors 4% and 0.05 ml/s at one 1/16 driver step',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('保守');
 assert.equal(e.h.s3StepLimit(.75,p.s3[0],p.s3[1]),1/16);
 assert.equal(e.h.s3StepLimit(.75,.04,.05),1/16);
 assert.equal(e.h.s3StepLimit(2,.12,.125),.24);
});
test('diagnostic run carries the S3 drift-model switch into its learning snapshot',()=>{
 const e=setup();e.s.cfg.s3DriftModel=true;e.h.startDiagnostics('hyperex');
 assert.equal(e.s.diagnosticCurrent.config.s3DriftModel,true);
 const f=setup();f.s.cfg.s3DriftModel=false;f.h.startDiagnostics('hyperex');
 assert.equal(f.s.diagnosticCurrent.config.s3DriftModel,false);
});
test('S3 learning gate expresses a one-step correction at 0.75 ml/s',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常');
 const ev=f=>[f,f*.995,f*.99].map((m,i)=>({name:['S3 EARLY','S3 MID','S3 LATE'][i],command:.75,measured:m,r2:.999,seconds:[8,14,18][i],quality:'clean'}));
 const base={targetGS:.75,overallGS:.72,status:'LATE DECAY',stall:false,stallQualitative:false,earlySeconds:8,midSeconds:14,measurementBasis:'profile-frame regression'};
 const q=e.h.stage3SingleSuggestion({...base,source:ev(.70)},null,p);
 assert(q&&q.suggestedShape,q&&q.reason);
 assert.equal(e.h.snapCommandFlow(q.suggestedShape.earlyCommand)-.75,1/16);
 const hold=e.h.stage3SingleSuggestion({...base,source:ev(.74)},null,p);
 assert.equal(hold.suggestedShape,undefined);
});
test('S3 projection keeps a drift wish instead of dragging frames into a monotonic line',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常'),old=[.813,.813,.813],q=e.h.projectS3Commands([.878,.8,.77],old,p,[8,14,18]);
 assert.deepEqual(copy(q),[.878,.8,.77]);
});
test('clean S3 decay with EARLY>MID and LATE<MID is learned as drift and written to the profile',async()=>{
 const e=normalEnv();
 const run=syntheticRun(e,'drift-learn',[1.4,1.8,2.4]);run.config.s3DriftModel=true;
 const q=e.h.nextShotAdaptiveSuggestion(run).s3;
 assert(q.driftShape,q.reason);
 assert.equal(q.driftShape.model,'drift');
 assert(q.driftShape.earlyCommand>q.driftShape.midCommand);
 assert(q.driftShape.lateCommand<q.driftShape.midCommand);
 await e.h.applyNextShotAdaptiveSuggestion(run,'test');
 const st=e.h.s3ShapeStatus();
 assert.equal(st.enabled,true);assert.equal(st.model,'drift');
 assert(st.earlyCommand>st.midCommand);assert(st.lateCommand<st.midCommand);
 const steps=e.h.profileObject().steps.slice(2).map(x=>Number(x.flow));
 assert(steps[0]>steps[1]);assert(steps[2]<steps[1]);
});
test('curve editor saves EARLY>MID / LATE<MID as drift without downgrading it',async()=>{
 const {e,body}=await curveFixture();
 body.shaped=true;body.values.early=.9375;body.values.mid=.75;body.values.late=.6875;
 await e.h.applyCurveEditorDraft(body);
 const q=e.s.testOverrides.s3Shape;
 assert.equal(q.model,'drift');
 assert(Math.abs(q.earlyFactor-1.25)<1e-9);assert(Math.abs(q.drift-.9167)<1e-4);
 const st=e.h.s3ShapeStatus();assert.equal(st.model,'drift');
 assert(st.earlyCommand>st.midCommand);assert(st.lateCommand<st.midCommand);
 assert.deepEqual(copy(e.h.profileObject().steps.slice(2).map(x=>Number(x.flow))),[.9375,.75,.6875]);
});
test('a later curve save keeps the learned drift model and its factors',async()=>{
 const {e}=await curveFixture();
 e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),stages:{},s3Shape:{enabled:true,model:'drift',origin:'adaptive',midCommand:.75,earlyFactor:1.25,drift:.9167,earlyCommand:.9375,lateCommand:.6875,earlySeconds:8,midSeconds:14}};
 await e.h.syncHyperExProfile(true);
 const d=e.h.curveEditorSnapshot();d.values.stage2+=.0625;
 await e.h.applyCurveEditorDraft(d);
 assert.equal(e.s.testOverrides.s3Shape.model,'drift');
 assert(Math.abs(e.s.testOverrides.s3Shape.earlyFactor-1.25)<1e-9);
 assert(e.h.s3ShapeStatus().earlyCommand>e.h.s3ShapeStatus().midCommand);
});
test('curve editor rejects a drift factor outside 0.50-2.00',async()=>{
 const {e,body}=await curveFixture();
 body.shaped=true;body.values.early=.10;body.values.mid=.75;body.values.late=.6875;
 await assert.rejects(e.h.applyCurveEditorDraft(body),/0\.50–2\.00/);
 assert.equal(e.s.testOverrides,null);
});
test('drift learns a non-flat shape from the real 2.2.4 S3 evidence',()=>{
 // hyperex-history (4).json, shot 1793489532447-2 and 1793490122135-1:
 // flat commands with a decaying MID/LATE response. Under 2.2.5 these stayed
 // flat; the drift model must move the level by at least one driver step.
 const e=normalEnv(),p=e.h.learningPolicy('正常');
 const run={config:{s3DriftModel:true,stage3Flow:1.5,stage3LutCommandMlS:0.75}};
 const real=(target,overall,frames)=>({targetGS:target,overallGS:overall,status:'STABLE',stall:false,stallQualitative:false,earlySeconds:8,midSeconds:14,measurementBasis:'live target-normalized stability windows',
  source:frames.map(f=>({command:f[0],measured:f[1],r2:f[2],seconds:f[3]}))});
 for(const ev of [real(1.5,1.1,[[.569,1.357,.99,4.63],[.569,1.069,.999,17.99],[.569,1.023,.999,8.09]]),
                  real(2,1.374,[[.719,1.446,.996,2.08],[.719,1.442,.999,11.31],[.719,1.253,.999,7.51]])]){
  const q=e.h.driftShapeSuggestion(run,ev,null,p);
  assert(q,'real 2.2.4 evidence must produce a drift shape');
  const oldQ=e.h.snapCommandFlow(Number(ev.source[1].command));
  assert(Math.abs(q.midCommand-oldQ)>=1/16-1e-9);
  assert(Math.round(q.midCommand*16)===q.midCommand*16);
  assert(q.earlyFactor>=.5&&q.earlyFactor<=2&&q.drift>=.5&&q.drift<=2);
 }
});

test('S2 refill is its own fold directly below the curve editor',()=>{
 const e=setup(),html=e.h.buildGhcOverlayHtml();
 const i=html.indexOf('id="curveEditor"'),j=html.indexOf('</details>',i);
 assert(i>=0&&j>i);assert(!html.slice(i,j).includes('curverefill'),'refill body must not sit inside the curve editor');
 assert(html.includes('id="refill-settings"'));
 const refill=html.indexOf('id="refill-settings"'),presets=html.indexOf('id="fold-presets"');
 assert(refill>i&&refill<presets);
 assert(!html.includes('称流速收回阈值'));
});

test('refill fold header and slider expose the noise floor and the derived trigger',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),a=html.indexOf('function renderRefillEditor()'),b=html.indexOf('function renderCurveEditor(',a),elements={},inputs={};
 const get=id=>elements[id]||(elements[id]={textContent:'',innerHTML:'',disabled:false});
 const box=get('curverefill');box.querySelector=q=>inputs[q]||(inputs[q]={});box.querySelectorAll=q=>[];
 const scope={esc:String,$:get,curveDraft:{refill:copy(refillDefaults),values:{stage2:4}},curveLatest:{targetGS:{stage2:5},refillLimits:{targetPercent:[100,160,1]},canApply:true,refillActive:true},curveBusy:false,renderRefillHistory(){},refillControlFields:[['startDelayMs','启动延时','s'],['targetPercent','补水指令上限','%'],['cutoffPercent','收回 / 收口起点','%'],['maxDurationMs','最长补水','s'],['approachMs','接管渐进时间','s']],Math,Number};
 vm.runInNewContext(html.slice(a,b)+';renderRefillEditor();',scope);
 assert.equal(get('refillstatus').textContent,'灌水上限 7.00 · 收回 / 收口起点 85% · 实测门槛 ≈ 51% 目标 · 启动 0 s');
 assert.equal(get('refillderived').textContent,'派生：实测 ≥ 51% 目标（≈ 2.55 g/s）+ 预测 ≥ 目标（5.00 g/s）才收回；下调会同时提前离开满灌（可能拖慢 90° 上升）、降低补水跳过阈值、降低实测噪声底');
});

test('controlOutputQuality exports the refill settle window and tail basis',()=>{
 const e=normalEnv(),r=startupRun(e,'cut11',.5,2,4);
 r.config.experimentalLiveTrim=true;r.config.s2StartupPlan={strategy:'refill-85'};
 r.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'},{kind:'startup-complete',frame:1,tMs:2700}]};
 const q=e.h.controlOutputQuality(r,'stage2');
 assert.equal(q.windowSettleMs,800);assert.equal(q.chainSettleMs,1500);assert.equal(q.tailFraction,.6);
 assert.match(String(q.basisDetail),/refill settle 800 ms; final 60% regression/);
 const r2=startupRun(e,'cut11b',.5,2,4);
 r2.config.experimentalLiveTrim=true;r2.config.s2StartupPlan={strategy:'refill-85'};
 r2.liveFlowTrim={trace:[{kind:'write',frame:1,tMs:0,commandMlS:3.5,startupAction:'boost'}]};
 const q2=e.h.controlOutputQuality(r2,'stage2');
 assert.equal(q2.reason,'refill-return-unconfirmed');assert.equal(q2.windowSettleMs,800);assert.equal(q2.chainSettleMs,1500);
});

// ---- v2.2.21: P2-4 / P3-6 / P2-5 (refill triad) ---------------------------
test('P2-4 the refill trace records the command that was actually running before each write',async()=>{
 const e=await refillLoopEnv(1.29);
 const R=await refillClosedLoop(e);
 const writes=R.refillWrites.filter(x=>x.kind==='write');
 const boost=writes.filter(x=>x.startupAction==='boost');
 const bleed=writes.filter(x=>x.startupAction==='bleed');
 const ret=writes.filter(x=>x.startupAction==='return');
 assert.equal(boost.length,1,'one flood write');
 assert(bleed.length>=1,'a bleed must precede the platform write');
 assert.equal(ret.length,1,'one platform write');
 assert.equal(boost[0].previousMlS,e.s.liveTrim.run.config.s2StartupPlan.baseCommandMlS,'the flood moves away from the profile command');
 assert.equal(ret[0].previousMlS,bleed[bleed.length-1].commandMlS,'return previousMlS must be the bleed that was running');
 assert.notEqual(ret[0].previousMlS,ret[0].commandMlS,'the platform write is a real move');
 assert(Number.isFinite(ret[0].plannedMlS),'the law value is kept separately as plannedMlS');
 assert.notEqual(ret[0].previousMlS,8,'previousMlS must not fall back to the flood envelope');
});
test('P3-6 a bounded flood reports the safety envelope instead of a clipped command',()=>{
 const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;e.s.runtimeProfileVerified=true;
 e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent:85,maxDurationMs:4000,approachMs:800};
 const prior=evidenceRun(e,'p36-prior');prior.config.stage2Flow=5;prior.config.stage2LutCommandMlS=2.507;prior.samples=[];
 e.s.diagnosticLast=prior;
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,buckets:[{id:'g1',center:.3,radius:.12,stages:{s2:{r:1.29,n:4,lastRunId:'p36-prior'}}}],lastBucketId:'g1'}};
 const p=e.h.stage2StartupPlan();
 assert.equal(p.boundedModel,true);assert.equal(p.boostCommandMlS,7,'the default fixed cap is 7');
 assert.equal(p.floodAtSafetyEnvelope,false,'a fixed 7 ml/s cap is not the safety envelope');
 assert.equal(p.commandLimited,false,'the flood is not a clipped demand');
 // An explicit 8 ml/s cap still reports the envelope state.
 e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent:85,maxDurationMs:4000,approachMs:800,floodMaxMlS:8};
 const p8=e.h.stage2StartupPlan();
 assert.equal(p8.boostCommandMlS,8);assert.equal(p8.floodAtSafetyEnvelope,true);
 // The legacy (non-bounded) path keeps the old meaning: requested > ceiling.
 const l=normalEnv();l.s.cfg.liveFlowTrimTest=true;l.s.testOverrides={...seedOverride(l,'empty'),stages:{stage2:{mode:'manual',command:6,desiredGS:5,origin:'manual'}}};
 const lp=l.h.stage2StartupPlan();
 assert.equal(lp.requestedCommandMlS,9.6);assert.equal(lp.boostCommandMlS,8);
 assert.equal(lp.commandLimited,true);assert.equal(lp.floodAtSafetyEnvelope,false);
});
// P2-5 / option C (2026-11-01, user choice): cutoffPercent stays ONE knob with
// THREE consumers - the bounded shaping start, the boost skip threshold and the
// return noise floor. The law is unchanged; the copy now says so. These tests
// pin the coupling and print the 70/85/99 closed-loop numbers as evidence.
async function cutoffRefill(cutoffPercent){
 const e=await refillFixture();
 e.s.s2RefillSettings={...refillDefaults,cutoffPercent};
 const t=e.s.liveTrim,plan=e.h.stage2StartupPlan();
 t.startup={status:'armed',plan};t.run.config.s2StartupPlan=copy(plan);
 pulseTarget(e,plan.baseCommandMlS);
 return e;
}
test('P2-5 cutoff still sets the observed noise floor of the refill return',async()=>{
 const rows=[];
 for(const cutoff of [70,85,99]){
  const e=await cutoffRefill(cutoff),t=e.s.liveTrim;
  await trimTick(e);trimAck(e);e.advance(1500);
  // observed 2.4 g/s, wild enough to predict >= target (2.4 + 2.18 x 1.5 s).
  refillSamples(e,2.4);
  const end=e.now()-t.run.startedAtMs;
  t.startup.lastEstimate={slope:0,stamp:100+end/1000-1.1};
  const reason=e.h.s2RefillReturnReason(t);
  rows.push({cutoff,threshold:t.run.config.stage2Flow*t.startup.plan.cutoffFraction,reason});
 }
 // 0.6 x threshold = 2.10 / 2.55 / 2.97 g/s at a 5 g/s target.
 assert(rows[0].reason,'cutoff 70: observed 2.4 clears the 2.10 floor while the prediction is at target');
 assert.equal(rows[1].reason,null,'cutoff 85: observed 2.4 is below the 2.55 floor');
 assert.equal(rows[2].reason,null,'cutoff 99: observed 2.4 is below the 2.97 floor');
 assert(Math.abs(rows[0].threshold-3.5)<1e-9&&Math.abs(rows[1].threshold-4.25)<1e-9&&Math.abs(rows[2].threshold-4.95)<1e-9);
});
test('P2-5 cutoff sweep: same plant and same r, measure rise, overshoot and platform',async()=>{
 const rows=[];
 for(const cutoff of [30,50,70,85,99]){
  const e=await refillLoopEnv(1.29,{cutoffPercent:cutoff});
  const R=await refillClosedLoop(e);
  const row={cutoff,riseMs:R.rise2080==null?null:Math.round(R.rise2080*1000),peakPct:Number(R.peakPct.toFixed(1)),plateauPct:Number(R.plateauPct.toFixed(1)),platform:R.platform,returnCmd:R.returnCmd,writes:R.refillWrites.length,status:R.status,cmds:R.refillCmds.map(x=>x.a+':'+x.c).join('>')};
  rows.push(row);
  console.log('   P2-5 cutoff '+cutoff+': rise20-80 '+(row.riseMs==null?'—':row.riseMs+' ms')+' · peak +'+row.peakPct+'% · plateau '+row.plateauPct+'% · platform '+row.platform+' · status '+row.status+' · writes '+row.cmds);
  // Invariants that must hold at every cutoff in this version.
  assert.equal(R.status,'complete','cutoff '+cutoff+' must complete, got '+R.status);
  assert.equal(R.returnCmd,R.platform,'cutoff '+cutoff+' must still hand over to target/r');
  assert(R.maxCmd>=7,'cutoff '+cutoff+' still needs a >=7 ml/s flood, got '+R.maxCmd);
  assert(R.rise2080!==null&&R.rise2080<=1.5,'cutoff '+cutoff+' rise '+R.rise2080);
  assert(R.peakPct<60,'cutoff '+cutoff+' peak +'+R.peakPct.toFixed(1)+'% must stay under the plant asymptote');
 }
 assert.equal(rows.length,5);
});
test('P2-5/C refill copy states all three cutoff couplings and the real close criterion',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();
 assert(!html.includes('称流速可提前收回'),'the old preview claimed the cutoff ends the refill early');
 assert(html.includes('收回判据：预测 ≥ '),'the preview states the real close criterion');
 assert(html.includes('同时决定收口起点、跳过阈值、实测噪声底'),'the preview names all three couplings');
 assert(html.includes("['cutoffPercent','收回 / 收口起点','%']"),'the slider is no longer named only as a noise floor');
 assert(html.includes('提前离开满灌'),'the derived line warns that lowering it slows the 90-degree rise');
 assert(html.includes('降低补水跳过阈值')&&html.includes('降低实测噪声底'),'the derived line names the other two couplings');
 assert(html.includes('灌水在安全包线'),'the bounded safety line reports the envelope as the design state');
 assert.equal(e.h.translateUiText('收回 / 收口起点','en'),'Cutoff / taper start');
});
test('P2-5/C one cutoff value moves the shaping start, the boost skip and the noise floor',async()=>{
 // (a) shaping start: at a 3.8 g/s prediction, 70% has already left the flood
 // while 85% is still flooding the envelope.
 const shape=[];
 for(const cutoff of [70,85]){
  const e=await refillLoopEnv(1.29,{cutoffPercent:cutoff}),t=e.s.liveTrim;
  e.advance(1600);refillSamples(e,3.8);
  const end=e.now()-t.run.startedAtMs;
  t.startup.lastEstimate={slope:3.8,stamp:100+end/1000};
  shape.push({cutoff,cmd:e.h.boundedRefillCommand(t)});
 }
 assert(shape[0].cmd<8,'cutoff 70 must have left the flood at 3.8 g/s, got '+shape[0].cmd);
 assert.equal(shape[1].cmd,7,'cutoff 85 must still be flooding at 3.8 g/s (cap 7)');
 assert(shape[0].cmd<shape[1].cmd);
 // (b) boost skip: 3.8 g/s clears 70% x 5 = 3.5 g/s but not 85% x 5 = 4.25 g/s.
 const skip=[];
 for(const cutoff of [70,85]){
  const e=await cutoffRefill(cutoff),t=e.s.liveTrim;
  e.advance(1500);refillSamples(e,3.8);
  await trimTick(e);
  skip.push({cutoff,status:t.startup.status,writes:rawWrites(e).length});
 }
 assert.equal(skip[0].status,'skipped','cutoff 70 skips a late boost at 3.8 g/s');
 assert.equal(skip[0].writes,0);
 assert.equal(skip[1].status,'boosting','cutoff 85 still boosts at 3.8 g/s');
 assert.equal(skip[1].writes,1);
});

// ---- P2-1 (2.2.22) · drift LATE edge must obey the adjacent-rise cap --------
// Minimal scope: only the LATE side is gated. EARLY above MID is a deliberate
// drift shape (0.50-2.00 factor) and stays legal, matching the curve editor
// and the UI copy "S3 may place EARLY above MID or LATE below MID".
function lateCap(mid){return Math.max(Number(mid)+.25,Number(mid)*1.35)+1e-9}
test('P2-1 a stored drift shape whose LATE exceeds the rise cap is rejected, not applied',()=>{
 const e=setup();
 e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),stages:{},
  s3Shape:{enabled:true,model:'drift',origin:'manual',midCommand:.75,earlyFactor:1,drift:1.583,earlySeconds:8,midSeconds:14}};
 const st=e.h.s3ShapeStatus();
 assert.equal(st.enabled,false);
 assert.match(String(st.reason),/adjacent rise|相邻增幅/);
 assert.notEqual(e.h.commandFlowSummary().stage3Mode,'shape');
 assert.equal(e.h.profileObject().steps.length,3);
});
test('P2-1 EARLY above MID stays legal with the LATE-only gate',()=>{
 const e=setup();
 e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),stages:{},
  s3Shape:{enabled:true,model:'drift',origin:'manual',midCommand:.75,earlyFactor:1.45,drift:1,earlySeconds:8,midSeconds:14}};
 const st=e.h.s3ShapeStatus();
 assert.equal(st.enabled,true,st.reason);
 assert.equal(st.model,'drift');
 assert.equal(st.earlyCommand,1.088);
 assert.equal(e.h.profileObject().steps.length,5);
});
test('P2-1 the curve editor saves the same EARLY-above-MID shape',async()=>{
 const {e,body}=await curveFixture();
 body.shaped=true;body.values.early=1.0875;body.values.mid=.75;body.values.late=.75;
 await e.h.applyCurveEditorDraft(body);
 assert.equal(e.s.testOverrides.s3Shape.model,'drift');
 assert(e.s.testOverrides.s3Shape.earlyFactor>1.35);
 assert(e.s.testOverrides.s3Shape.earlyCommand>e.s.testOverrides.s3Shape.midCommand);
 assert.equal(e.h.commandFlowSummary().stage3Mode,'shape');
});
test('P2-1 a stored drift shape with a legal LATE is still accepted',()=>{
 const e=setup();
 e.s.testOverrides={schema:3,...copy(e.h.testOverrideBinding()),stages:{},
  s3Shape:{enabled:true,model:'drift',origin:'manual',midCommand:.75,earlyFactor:1.2,drift:1.1667,earlySeconds:8,midSeconds:14}};
 const st=e.h.s3ShapeStatus();
 assert.equal(st.enabled,true,st.reason);
 assert.equal(st.lateCommand,.875);
 assert(st.lateCommand<=lateCap(st.midCommand));
});
test('P2-1 manual tilt +1 (LATE .6) is still accepted',async()=>{
 const {e}=await curveFixture();
 const r=await e.plugin.__httpRequestHandler({endpoint:'test-command-set',body:{stages:{stage1:{mode:'auto'},stage2:{mode:'auto'},stage3:{mode:'auto'}},
  s3Shape:{enabled:true,model:'drift',manual:true,manualTilt:1,midCommand:.75,earlyFactor:1.45,drift:.8,earlySeconds:8,midSeconds:14}}});
 assert.equal(r.status,200,r.body);
 assert.equal(e.s.testOverrides.s3Shape.model,'drift');
 assert.equal(e.s.testOverrides.s3Shape.lateCommand,.6);
});
test('P2-1 a direct over-cap drift write never becomes an applied shape',async()=>{
 const {e}=await curveFixture();
 const r=await e.plugin.__httpRequestHandler({endpoint:'test-command-set',body:{stages:{stage1:{mode:'auto'},stage2:{mode:'auto'},stage3:{mode:'auto'}},
  s3Shape:{enabled:true,model:'drift',manual:false,midCommand:.75,earlyFactor:1,drift:1.583,earlySeconds:8,midSeconds:14}}});
 if(r.status===409){assert.match(String(JSON.parse(r.body).error),/adjacent rise|相邻增幅/);return;}
 const st=e.h.s3ShapeStatus();
 assert.equal(st.enabled,false,'over-cap drift must not be applied');
 assert.match(String(st.reason),/adjacent rise|相邻增幅/);
});
test('P2-1 an automatic drift step whose LATE exceeds the cap is clamped or held',()=>{
 const e=normalEnv(),p=e.h.learningPolicy('正常');
 const run={config:{s3DriftModel:true,stage3Flow:1.5,stage3LutCommandMlS:.75}};
 const ev={targetGS:1.5,overallGS:1.5,status:'STABLE',stall:false,stallQualitative:false,earlySeconds:8,midSeconds:14,measurementBasis:'profile-frame regression',
  source:[{command:.75,measured:1.5,r2:.999,seconds:8},{command:.75,measured:1.5,r2:.999,seconds:14},{command:1.0125,measured:1.0,r2:.999,seconds:14}]};
 const q=e.h.driftShapeSuggestion(run,ev,null,p);
 if(q)assert(q.lateCommand<=lateCap(q.midCommand),'late '+q.lateCommand+' mid '+q.midCommand);
 // Same request from a lower legal LATE: the clamp must land on the largest
 // driver step inside the cap and still publish a real change.
 const ev2={...ev,source:[{command:.75,measured:1.5,r2:.999,seconds:8},{command:.75,measured:1.5,r2:.999,seconds:14},{command:.9375,measured:.95,r2:.999,seconds:14}]};
 const q2=e.h.driftShapeSuggestion(run,ev2,null,p);
 assert(q2,'an over-cap LATE must clamp, not silently disappear');
 assert.equal(q2.lateCommand,1);
 assert(q2.lateCommand<=lateCap(q2.midCommand));
});
test('P2-1 the applied next-shot override never carries an over-cap LATE',async()=>{
 const e=normalEnv();
 const run=syntheticRun(e,'p21-apply',[1.5,1.5,1.0]);
 run.config.s3DriftModel=true;
 run.config.stage3CommandMlS=.75;
 run.config.stage3Shape={enabled:true,earlyCommand:.75,earlySeconds:8,midCommand:.75,midSeconds:14,lateCommand:1.0125};
 let applied=null;
 try{await e.h.applyNextShotAdaptiveSuggestion(run,'test');applied=e.s.testOverrides&&e.s.testOverrides.s3Shape;}
 catch(err){assert.match(String(err.message),/No actionable|adjacent rise|相邻增幅/);}
 if(applied&&applied.enabled){
  const mid=Number(applied.midCommand);
  assert(Number(applied.lateCommand)<=lateCap(mid),'late '+applied.lateCommand+' mid '+mid);
 }
});

// v2.2.24: the refill cutoff floor moved from 50 to 30 so the taper can start
// below 70% of the cup target. These two tests pin the acceptance floor and the
// behaviour that motivated it.
test('P2-5/C the 30 percent floor starts the taper at 30 percent of target',async()=>{
 const at=async(cutoff,slope)=>{
  const e=await refillLoopEnv(1.29,{cutoffPercent:cutoff}),t=e.s.liveTrim;
  e.advance(1600);refillSamples(e,slope);
  const end=e.now()-t.run.startedAtMs;
  t.startup.lastEstimate={slope,stamp:100+end/1000};
  return {e,t,cmd:e.h.boundedRefillCommand(t)};
 };
 const floor=await at(30,2.0);
 assert.equal(floor.t.startup.plan.cutoffFraction,0.3,'cutoff 30 must survive validation');
 assert(floor.cmd<8,'cutoff 30 must leave the flood at 2.0 g/s (30% x 5 = 1.5), got '+floor.cmd);
 const oldFloor=await at(50,2.0);
 assert.equal(oldFloor.cmd,7,'the old 50% floor was still flooding at 2.0 g/s (cap 7)');
 const belowStart=await at(30,1.0);
 assert.equal(belowStart.cmd,7,'below 30% x target the law still floods (cap 7)');
});

// ---- v2.2.27: bounded flood cap (fixed / adaptive) -------------------------
test('2.2.27 the flood cap defaults to fixed 7 and validates its mode and range',()=>{
 const e=normalEnv();
 assert.equal(e.h.currentS2RefillSettings().floodMode,'fixed');
 assert.equal(e.h.currentS2RefillSettings().floodMaxMlS,7);
 assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,floodMaxMlS:8}).floodMaxMlS,8);
 assert.equal(e.h.validatedS2RefillSettings({...refillDefaults,floodMode:'adaptive'}).floodMode,'adaptive');
 assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,floodMaxMlS:9}),/allowed range/);
 assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,floodMaxMlS:0.03}),/allowed range/);
 assert.throws(()=>e.h.validatedS2RefillSettings({...refillDefaults,floodMode:'turbo'}),/allowed range/);
});
test('2.2.27 a stored flood cap below the curve target is clamped up to that target',()=>{
 const e=normalEnv();e.s.cfg.stage2Flow=5.5;
 e.s.s2RefillSettings={...refillDefaults,floodMaxMlS:5};
 assert.equal(e.h.currentS2RefillSettings().floodMaxMlS,5.5);
 e.s.s2RefillSettings={...refillDefaults,floodMaxMlS:7};
 assert.equal(e.h.currentS2RefillSettings().floodMaxMlS,7);
});
test('2.2.27 the plan carries the fixed cap or the adaptive envelope',()=>{
 const mk=(patch)=>{
  const e=normalEnv();e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;e.s.runtimeProfileVerified=true;
  e.s.s2RefillSettings={basis:'cup-target',startDelayMs:0,targetPercent:100,cutoffPercent:85,maxDurationMs:4000,approachMs:800,...patch};
  return e.h.stage2StartupPlan();
 };
 const fixed=mk({floodMode:'fixed',floodMaxMlS:6.5});
 assert.equal(fixed.floodMode,'fixed');assert.equal(fixed.floodMaxMlS,6.5);
 assert.equal(fixed.floodCommandMlS,6.5);assert.equal(fixed.floodPlanMlS,6.5);assert.equal(fixed.boostCommandMlS,6.5);
 const adaptive=mk({floodMode:'adaptive'});
 assert.equal(adaptive.floodMode,'adaptive');assert.equal(adaptive.floodMaxMlS,null);
 // No gain memory here: platform = LUT 2.5, r = 2, so the cold cap is 2 x 2.5.
 assert.equal(adaptive.floodCommandMlS,5);assert.equal(adaptive.floodPlanMlS,5);
});
test('2.2.27 adaptive mode brakes continuously and never re-floods',async()=>{
 const e=await refillLoopEnv(2.0,{floodMode:'adaptive',floodMaxMlS:8}),t=e.s.liveTrim;
 e.advance(1600);refillSamples(e,4.0);
 const end=e.now()-t.run.startedAtMs;
 t.startup.lastEstimate={slope:4.0,stamp:100+end/1000};
 const cap=e.h.boundedRefillCommand(t);
 assert.equal(cap,3.0,'platform 2.5 + (5-4)/2 = 3.0, got '+cap);
 // The estimate only recomputes when the scale stamp moves, so advance first.
 e.advance(100);refillSamples(e,5.5);
 const end2=e.now()-t.run.startedAtMs;
 t.startup.lastEstimate={slope:4.0,stamp:100+end2/1000-0.2};
 const low=e.h.boundedRefillCommand(t);
 assert.equal(low,2.5,'above target the cap sits on the platform, got '+low);
});
test('2.2.27 closed loop: adaptive cap vs fixed 7 on the same plant',async()=>{
 const rows=[];
 for(const r of [1.29,2.0])for(const cfg of [{floodMode:'fixed',floodMaxMlS:7,label:'fixed 7'},{floodMode:'fixed',floodMaxMlS:8,label:'fixed 8'},{floodMode:'adaptive',floodMaxMlS:7,label:'adaptive'}]){
  const e=await refillLoopEnv(r,{floodMode:cfg.floodMode,floodMaxMlS:cfg.floodMaxMlS});
  const R=await refillClosedLoop(e);
  const row={label:'r='+r+' '+cfg.label,rise:R.rise2080,peak:+R.peakPct.toFixed(1),plateau:+R.plateauPct.toFixed(1),cmds:R.refillCmds.map(x=>x.a+':'+x.c).join('>')};
  rows.push(row);
  console.log('   2.2.27 '+row.label+': rise '+(R.rise2080==null?'—':Math.round(R.rise2080*1000))+' ms · peak +'+row.peak+'% · plateau '+row.plateau+'% · '+row.cmds);
  assert.equal(R.status,'complete',row.label);
  assert(R.peakPct<45,row.label+' peak +'+R.peakPct.toFixed(1)+'%');
 }
 assert.equal(rows.length,6);
});
test('2.2.27 the refill fold shows the flood cap selector and its labels',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml();
 assert.match(html,/灌水上限/);
 assert.match(html,/data-refill-flood-mode/);
 assert.match(html,/data-refill-key="floodMaxMlS"/);
 assert.equal(e.h.translateUiText('灌水上限','en'),'Flood cap');
 assert.equal(e.h.translateUiText('固定','en'),'Fixed');
 assert.equal(e.h.translateUiText('自适应','en'),'Adaptive');
});
// 2.2.26 shipped a selector with doubled quotes:
// box.querySelector('[data-refill-key=""floodMaxMlS""]'). The test mocks ignored
// the selector string, so this only showed up on the real page as a SyntaxError
// that killed loadCal and left STEP 1/2 "waiting". Scan every literal selector.
test('2.2.27 every literal DOM selector in the page script is well formed',()=>{
 const e=normalEnv(),html=e.h.buildGhcOverlayHtml(),bad=[];
 for(const m of html.matchAll(/(querySelector|querySelectorAll)\('([^']*)'\)/g)){
  const sel=m[2];
  if(sel.includes('""')||sel.includes("''"))bad.push(sel);
 }
 assert.deepEqual(bad,[],'malformed selector(s): '+bad.join(' | '));
 assert(html.includes("box.querySelector('[data-refill-key=\"floodMaxMlS\"]')"),'the flood cap slider lookup uses a valid selector');
});

// 2.2.30: STEP 3 拆成七折后保存按钮只在 06 折，改 04 的目标/限压找不到入口。
// 现在每个含可编辑字段的折叠都带同一个保存动作，且共用 saveAdvancedSettings。
test('2.2.30 every STEP 3 settings fold carries the shared save action',()=>{
 const html=setup().h.buildGhcOverlayHtml(),head=/class="manualPanel hxfold" id="(fold-[a-z]+)"/g,spans=[];
 let m;while((m=head.exec(html))){
  const start=html.lastIndexOf('<details',m.index),re=/<details\b|<\/details>/g;re.lastIndex=start;
  let depth=0,x,end=html.length;
  while((x=re.exec(html))){if(x[0]==='</details>'){depth--;if(depth===0){end=x.index;break}}else depth++}
  spans.push({id:m[1],start,end,body:html.slice(start,end)});
 }
 const need=['fold-modecards','fold-targets','fold-livetrim','fold-releaseparams','fold-directstart'];
 for(const id of need)assert(spans.some(s=>s.id===id),id+' exists');
 for(const id of need)assert(/data-save-advanced|id="saveadvanced"/.test(spans.find(s=>s.id===id).body),id+' has a save control');
 assert.equal((html.match(/data-save-advanced>/g)||[]).length,4,'four extra save buttons');
 assert.equal((html.match(/id="saveadvanced"/g)||[]).length,1,'the original save button is kept');
 assert(html.includes("querySelectorAll('#saveadvanced,[data-save-advanced]')"),'all save buttons share saveAdvancedSettings');
 const orphans=[...new Set([...html.matchAll(/id="(adv_[A-Za-z0-9]+)" type="(?:checkbox|range|number)"/g)].map(x=>x[1]))].filter(id=>{
  const at=html.indexOf('id="'+id+'"'),owner=spans.find(s=>at>s.start&&at<s.end);
  return !owner||!/data-save-advanced|id="saveadvanced"/.test(owner.body);
 });
 assert.deepEqual(orphans,[],'editable fields without a save button: '+orphans.join(' | '));
});
