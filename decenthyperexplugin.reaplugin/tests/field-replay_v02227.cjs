// Field replay for 2.2.27 (hyperex-history (5).json).
// Run: node tests/field-replay_v02227.cjs
// Optional data: set HX_FIELD_JSON to another history export.

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
function seedOverride(e,context){
 return {schema:3,writerVersion:'0.1.52',...copy(e.h.testOverrideBinding()),
  ...(context===undefined?{}:{basketContext:context}),stages:{stage1:{mode:'manual',command:.8}},
  s3Shape:{enabled:true,earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778}};
}
function normalEnv(level='正常'){const e=setup();e.s.cfg.adaptiveLearningLevel=level;return e;}

const refillDefaults={basis:"pump-command",startDelayMs:0,targetPercent:160,cutoffPercent:85,maxDurationMs:4000,approachMs:800,floodMaxMlS:7,floodMode:"fixed"};
const dataFile=process.env.HX_FIELD_JSON||'C:/Users/ladios/Downloads/hyperex-history (5).json';
const field=JSON.parse(fs.readFileSync(dataFile,'utf8'));
const shot2247=field.shots.find(x=>String(x.startedAt||'').includes('2026-11-01T22:47'));
const shot2306=field.shots.find(x=>String(x.startedAt||'').includes('2026-11-01T23:06'));
assert(shot2247&&shot2306,'2.2.27 field shots missing from '+dataFile);

test('field 2.2.27 22:47 S2 return uses the running profile base, not the empty-basket LUT',()=>{
 const e=normalEnv();
 e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;e.s.cfg.stage2Flow=5;
 e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage1:{mode:'manual',command:.8},stage2:{mode:'manual',command:4.1875,desiredGS:5,origin:'manual'}},s3Shape:{enabled:true,earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778}};
 e.s.s2RefillSettings={...refillDefaults,basis:'cup-target'};
 e.s.diagnosticLast=null;
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,seq:2,lastBucketId:'g2',buckets:[{id:'g2',center:.453,radius:.12,samples:[.453],stages:{s3:{r:1.2874,n:1}}}]}};
 const p=e.h.stage2StartupPlan();
 assert.equal(p.baseCommandMlS,4.1875,JSON.stringify(p));
 assert.equal(p.controlSource,'profile-base',JSON.stringify(p));
 assert.equal(p.refillPumpBaseMlS,4.1875,JSON.stringify(p));
 assert.equal(p.returnCommandMlS,4.1875,JSON.stringify(p));
 assert.notEqual(p.controlBaseMlS,2.5);
});

test('field 2.2.27 23:06 high-pressure S2 memory returns the high platform, not 4.06',()=>{
 const e=normalEnv();
 e.s.cfg.liveFlowTrimTest=true;e.s.cfg.s2RefillBoundedModel=true;e.s.cfg.stage2Flow=5;
 e.s.testOverrides={...seedOverride(e,'empty'),stages:{stage1:{mode:'manual',command:.8},stage2:{mode:'manual',command:4.8125,desiredGS:5,origin:'manual'}},s3Shape:{enabled:true,earlyCommand:.698,earlySeconds:8,midCommand:.72,midSeconds:14,lateCommand:.778}};
 e.s.s2RefillSettings={...refillDefaults,basis:'cup-target'};
 e.s.diagnosticLast={runId:'field-2306-prior',config:{stage2Flow:5,stage2CommandMlS:4.8125},samples:[],rawScaleSamples:[]};
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,seq:2,lastBucketId:'g2',buckets:[{id:'g2',center:.4715,radius:.0962,samples:[.4715],stages:{s2:{r:.9174,n:1,lastObservedR:.9174}}}]}};
 const p=e.h.stage2StartupPlan();
 assert.equal(p.controlSource,'gain-memory',JSON.stringify(p));
 assert(Math.abs(p.refillPumpBaseMlS-5.4375)<=.02,JSON.stringify(p));
 assert(Math.abs(p.returnCommandMlS-5.4375)<=.02,JSON.stringify(p));
 assert(p.returnCommandMlS>5,'high paper r<1 must place the platform above the numeric target');
});

test('field 2.2.27 23:06 S3 control uses the current g2 bucket, not the previous g3',()=>{
 const e=normalEnv();
 e.s.cfg.stage3Flow=2;
 e.s.persistentHistoryFile={schema:2,shots:[],gainMemory:{schema:1,seq:3,lastBucketId:'g3',buckets:[
  {id:'g2',center:.4715,radius:.0962,samples:[.4715],stages:{s3:{r:1.2651,n:1,lastObservedR:1.2651}}},
  {id:'g3',center:.2724,radius:.136,samples:[.2724],stages:{s3:{r:2.3269,n:4,lastObservedR:2.3269}}}
 ]}};
 const cur={runId:'field-2306-cur',config:{stage2Flow:5,stage3Flow:2,stage3LutCommandMlS:.719,stage3CommandMlS:.875},samples:[],rawScaleSamples:[]};
 for(let i=0;i<20;i++)cur.samples.push({phase:'stage2',profileFrame:1,tMs:i*100,pressureBar:2.55,machineFlowMlS:4.5,targetFlowMlS:4.5,machineTelemetryValid:true,machineAgeMs:0});
 const prev={runId:'field-2306-prev',config:cur.config,samples:cur.samples.map(x=>({...x,pressureBar:1.2,machineFlowMlS:4.4}))};
 e.s.diagnosticLast=prev;e.s.diagnosticCurrent=cur;
 const c=e.h.liveTrimControlCenter('stage3',.569,cur);
 assert.equal(c.source,'gain-memory');assert.equal(c.bucketId,'g2');assert.equal(c.r,1.2651);
 assert(Math.abs(c.commandMlS-2/1.2651)<.03,JSON.stringify(c));
});

test('field 2.2.27 22:47 S2 plateau uses the post-peak window and the effective command',()=>{
 const e=normalEnv();
 const run={runId:'field-2247-plateau',config:{stage2Flow:5,stage2CommandMlS:4.1875,experimentalLiveTrim:true,s2StartupPlan:{strategy:'refill-85'}},
  samples:shot2247.fullRecord.samples.filter(x=>x.phase==='stage2'),
  rawScaleSamples:shot2247.fullRecord.rawScaleSamples.filter(x=>x.phase==='stage2'),
  liveFlowTrim:{trace:shot2247.fullRecord.liveFlowTrim.trace}};
 const q=e.h.controlOutputQuality(run,'stage2');
 assert(q.available,JSON.stringify(q));
 assert.equal(q.tailFraction,1,JSON.stringify(q));
 assert.match(String(q.basisDetail),/peak/);
 const cmd=e.h.stage2EffectiveCommand(run);
 assert(cmd>3.0&&cmd<3.4,JSON.stringify({cmd,q}));
});

(async()=>{let failed=0;for(const [name,fn] of tests){try{await fn();console.log('PASS '+name);}catch(err){failed++;console.error('FAIL '+name+String.fromCharCode(10)+err.stack);}}console.log(String.fromCharCode(10)+(tests.length-failed)+'/'+tests.length+' checks passed');process.exitCode=failed?1:0;})();
