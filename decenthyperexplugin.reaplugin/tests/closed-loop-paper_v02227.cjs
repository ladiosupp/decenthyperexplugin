// Closed-loop paper/kernel checks for 2.2.27 field gains.
// Run: node tests/closed-loop-paper_v02227.cjs

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
function normalEnv(level='正常'){const e=setup();e.s.cfg.adaptiveLearningLevel=level;return e;}
async function refillLoopEnv(r,{cutoffPercent=85,floodMode='fixed',floodMaxMlS=7,paper='low',pumpKernel='fast'}={}){
 const e=normalEnv();e.s.testPaper=paper;e.s.testPumpKernel=pumpKernel;e.s.cfg.liveTrimDecisionModel=true;e.s.cfg.liveFlowTrimTest=true;e.s.cfg.liveFlowTrimLevel=3;e.s.cfg.s2RefillBoundedModel=true;e.s.runtimeProfileVerified=true;
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
async function refillClosedLoop(e,{totalMs=8000,stepMs=50,tickEvery=5,settleMs=4000}={}){
 const t=e.s.liveTrim,target=e.s.cfg.stage2Flow,startMs=t.run.startedAtMs;const paper=e.s.testPaper||'low',pumpKernel=e.s.testPumpKernel||'fast';
 const limiter=Number(t.profile.steps[1].limiter.value),baseCmd=Number(t.profile.steps[1].flow);
 const plan=t.startup.plan,platform=plan.controlBaseMlS,cutoff=target*plan.cutoffFraction;
 const cmds=[];let mach=0,cup=0,weight=0,elapsed=0,step=0,seen=rawWrites(e).length;let pumpTarget=0,rampFrom=0,rampTo=baseCmd,rampStart=0,rampKey=null;
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
  const plantR=paper==='high'?cmd=>cmd<=4?.92:cmd>=4.5?.86:.92-(cmd-4)*.12:cmd=>cmd<=4?1.23:cmd>=7?.8:1.23-(cmd-4)*(.43/3);
  if(pumpKernel==='real'){
   const latest=cmds[cmds.length-1];
   if(latest&&(!rampKey||latest.atMs!==rampKey.atMs||latest.cmd!==rampKey.cmd)){rampFrom=pumpTarget;rampTo=latest.cmd;rampStart=latest.atMs+350;rampKey=latest;}
   const frac=Math.max(0,Math.min(1,(elapsed-rampStart)/850));
   pumpTarget=rampFrom+(rampTo-rampFrom)*frac;
   mach+=(Math.max(0,pumpTarget)-mach)*Math.min(1,stepMs/400);
  }else{
   mach+=(Math.max(0,goal)-mach)*Math.min(1,stepMs/400);
  }
  cup+=(plantR(mach)*mach-cup)*Math.min(1,stepMs/200);
  weight+=cup*stepMs/1000;
  e.advance(stepMs);elapsed+=stepMs;step++;
  const tMs=e.now()-startMs;
  scale.push({phase:'stage2',profileFrame:1,tMs,weightG:weight,scaleTimestampSeconds:100+tMs/1000,tareReset:false});
  curve.push({tMs,goal,mach,cup});
  e.s.lastPressure=Math.min(limiter*0.8,paper==='high'?mach*.53:0.8+mach*.30);
  e.s.lastFlow=mach;e.s.lastMachineTelemetryValid=true;e.s.lastMachineState='espresso';e.s.lastSubstate='pouring';
  e.s.lastFrame=1;e.s.lastMachineAtMs=e.now();e.s.latestScaleAtMs=e.now();
  t.run.rawScaleSamples=scale.slice(-30);
  e.h.observeLiveTrimMachine({machineState:'espresso',telemetryValid:true,profileFrame:1,targetFlow:goal,flow:mach,pressure:e.s.lastPressure,substate:'pouring'});
  if(step%tickEvery===0)await trimTick(e);
  if(t.startup.status==='complete'&&elapsed>settleMs)break;
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

test('2.2.29 high-pressure paper r=0.86 with the real pump kernel reaches a 5 g/s platform',async()=>{
 const e=await refillLoopEnv(0.86,{paper:'high',pumpKernel:'real'});
 const R=await refillClosedLoop(e);
 if(process.env.HX_LOOP_REPORT)console.log('   high real:',JSON.stringify({rise:R.rise2080,peak:+R.peakPct.toFixed(1),plateau:+R.plateauPct.toFixed(1),platform:R.platform,returnCmd:R.returnCmd,status:R.status}));
 assert.equal(R.status,'complete');
 assert.equal(R.returnCmd,R.platform);
 assert(R.maxCmd>=7);
 assert(R.peakPct<=45,'high paper peak +'+R.peakPct.toFixed(1)+'%');
 assert(Math.abs(R.plateauPct)<=15,'high paper plateau '+R.plateauPct.toFixed(1)+'%');
});

test('2.2.29 low paper r=1.29 with the real pump kernel keeps a bounded rise and plateau',async()=>{
 const e=await refillLoopEnv(1.29,{paper:'low',pumpKernel:'real'});
 const R=await refillClosedLoop(e);
 if(process.env.HX_LOOP_REPORT)console.log('   low real:',JSON.stringify({rise:R.rise2080,peak:+R.peakPct.toFixed(1),plateau:+R.plateauPct.toFixed(1),platform:R.platform,returnCmd:R.returnCmd,status:R.status}));
 assert.equal(R.status,'complete');
 assert.equal(R.returnCmd,R.platform);
 assert(R.rise2080!==null&&R.rise2080>=0.4&&R.rise2080<=1.5,'real pump 20-80% rise '+R.rise2080);
 assert(R.peakPct<=45,'low paper peak +'+R.peakPct.toFixed(1)+'%');
 assert(Math.abs(R.plateauPct)<=25,'low paper plateau '+R.plateauPct.toFixed(1)+'%');
});

test('2.2.29 7 s predictive closed loop holds the paper platform',async()=>{
 for(const [paper,r] of [['low',1.29],['high',0.86]]){
  const e=await refillLoopEnv(r,{paper,pumpKernel:'real'});
  const R=await refillClosedLoop(e,{settleMs:7000});
  if(process.env.HX_LOOP_REPORT)console.log('   7s '+paper+':',JSON.stringify({peak:+R.peakPct.toFixed(1),plateau:+R.plateauPct.toFixed(1),platform:R.platform,returnCmd:R.returnCmd,status:R.status}));
  assert.equal(R.status,'complete',paper);
  assert.equal(R.returnCmd,R.platform,paper);
  assert(Math.abs(R.plateauPct)<=15,paper+' 7s plateau '+R.plateauPct.toFixed(1)+'%');
  assert(R.peakPct<=45,paper+' 7s peak +'+R.peakPct.toFixed(1)+'%');
 }
});

(async()=>{let failed=0;for(const [name,fn] of tests){try{await fn();console.log('PASS '+name);}catch(err){failed++;console.error('FAIL '+name+String.fromCharCode(10)+err.stack);}}console.log(String.fromCharCode(10)+(tests.length-failed)+'/'+tests.length+' checks passed');process.exitCode=failed?1:0;})();
