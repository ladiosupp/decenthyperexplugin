# HyperEx0.1.72 handoff — 2026-10-27 Asia/Shanghai

Baseline delivered1.71 commitc02810402aa82f70f48b1720a355104015378cac. Userauthorizedremove+2andS2refill160percentBASEPUMPCOMMANDnotcupflow,hard8;retaincutoff,time,pressure. UsersteeringONLYTHISPARTispumpcommand;allstagegoals/control/learningstillREALcupg/s. Nootherrequestedchanges. CurrentREADMEfirst1.72sectionauthoritativeoverhistoricalnotes.

stage2StartupPlanschema4,strategyrefill-85 retained. requested=quantizedbase*settings.targetPercent/100;floor1/16min(8,1.6base). RemovedLUT-relative/actual-tailmultiplierevaluationONLYhere;LUT/adaptivestillresolvebase. No+2atplan,dispatchorUI. Runtimecheckssettingsratio,commandbasisandexactquantizedboostagainbeforewrite. Default160/range100–160;timings0/85/4000/3000unchanged. sourceRunIds[];refillTargetGSremovedtoavoidunitconfusion. maximumExtraCommandMlremainsnominalplanintegral,NOTactualwaterorcertifiedbound;old8commandmlclaimnolongertrue.

Storagekeyretaineds2RefillSettingsV1butnormalizedsettingsnowincludebasis:pump-command. validatednumericdefaultsobjecthasnobasis,validatoroutputadds;currentfallbackcallsvalidator;curveEditorSnapshot.refillDefaultsalsocallsvalidatorsoResetworkswithstrictapply. Readoldnobasis:validatefirstthenmigrateONLYtargetPercent160;preserveotherparams;visiblewarning. Newtaggedsettingspreservechoice. DoesnotwriteKVjustonread;repeatedoldreadsdeterministicallymigrateuntilnextsuccessfulApplypersiststag. Strictmanualapplywithreffieldrequiresbasis;oldclientsomittingreffieldretaincurrent. Missingstorageusesdefault160. Corrupt/unknownbasisfallbackvisible. NoS3reset,noLUT/historyrewrite. Currentcupfrozen,rollbackunchanged.

UItargetlabelBasepumpflowmultiplier/基础泵流量倍率;previewexactpumpformulaandml/s,cutoffstillg/s. Threenewtranslationpairs. Removedestimatedcup-targettext. Keepdefaultresetandfinecurveinputs. ActiveReleaseOFFkeepslegacyshortpulse,nochange. EnhancedflowstillonlyafterespressoPreInfuse/Pourandconfirmedframe1;pre-flowmachineheating/mixingstatesblocked. Notclaimhardwareproofofstabilizationbasedonlights.

PriorconversationconfirmedofficialbundledTurboBloomfast8ml/s,RaoAllongefast4.5ml/s,BloomingEspressofast4ml/s. ThesearecommanddesignexamplesNOTmeasuredpumpriseorproofoursafety. UserreportsS2nopresentovershoot;doNOTtreatS3earlierhighoutputasS2overshoot. Topwaternear100reportedpreviously,latestphoto95.4idle/redshot89–94;causeunproven,nothermalcodechange. NoextraCSV/screenshotsrequired.

455/455NodechecksPASS.Testsrunfromtests/verify_v0172.cjs,in-memoryhooksonly.GeneratedHTMLsyntax/structure/localechecks.No1.72realdevice/fullbrowserengineexecution. ZIP/receiptwithchecksandhashcreatedaftervalidation;GitHubprotectedheadand9blobschecked,olderfilespreserved. KeepoldZIPsimmutable. Donotreplayscratchpatches. Seehistorical1.71handoffbelowforpriorissues,includingS2missingbaseechoSTILLlimitssteady-learning,notfixedhere.

## Historical1.71handoff — current section supersedes

# HyperEx0.1.71 handoff — 2026-10-27 Asia/Shanghai

Baseline delivered1.70/commit2c38bb2862a00ef990ded2fa2bf967eb9a70fa6f. UseraskedS3restoretooldrampTHENcancelledsourcechange,wouldmanuallysetonmachine. DoNOTauto-resetS3. CurrenttaskS2refillparameterseditableincurrentvisualcurveeditor/defaults1.70/softwarebounds;steeringusercomplaintcurvepointsstep-onlycannotfreelytypevalues. Bothcompleted. CurrentREADMEfirst1.71sectionauthoritativeoveroldnotes. Conversationlong: preservehandoff,donotreplayscratchpatches.

S2_REFILL_DEFAULTS startDelayMs0,targetPercent120,cutoffPercent85,maxDurationMs4000,approachMs3000. Limits0–1500/50ms,100–140/1%,70–90/1%,500–4000/100ms,1000–6000/100ms. validatedS2RefillSettings rejectsbadtype/range/nonfinite/step. currentS2RefillSettings defaultfallback. IndependentKV s2RefillSettingsV1,notinsideauto-overrides;onLoadsetsloadedfalse,readskey;initialprofilearmingandmanualapplywaitrestore. Missingvalueusesdefault;badJSON/invalidvaluesvisiblewarning. onsettingsreadonlyidlenotbusy;loadedflagtrueafterhandled. Runtimeplanstoresclonedsettingsandchecksplanhold/cutoff/approach/startagainstvalidatedsettingsbeforedispatch. DefaultdirectVMfixtureloadedtruewithoutonLoadisintentionallyfortestsetup;realonLoadgatesfalse.

S2plan targetPercentdrivesmodel/LUT/fallback;noextraquantumforcedwhen100%needsnone. startdelayfromfirstconfirmedS2frametime;negativeimpossible;armedwaitingdoesNOTfallthroughtonormalwrites. firstphase2enteredAtstillboundsdispatchwindow=startDelay+4000,confirmationtimestampnotresetonrepeatedupdates. cutoffconfiguredandapproachstartsconfiguredfractioninsteadfixed.85. Allfixedguardsremain:commandmin(8,1.6base,base+2),pressure.9,fresh600ms,ACK2s/returnwatchdog,50msmin/750msapproachup,budgets/weights/noextra skips. Nominalextraflowmax2 times4s=8commandml,NOTactualwaterormassorcertifiedsafephysicalenvelope. Default0/120/85/4/3restores1.70nominal,exceptunnecessarylow-amplitudequantumremovedwhenrequestednotabovebase.

curveEditorRevisionincludesrefill;Snapshotrefill,limits,defaults,preview,active,loadwarning. bodyrefilloptionalforoldclients(omitpreservescurrent). applyCurveEditorDraft validatesallparams,usesidle/freshrevision/profilechecks,writesseparateKVandcurveoverride,syncverified;rollbackrestoresbothsettingsandS3/oldsourceonfailure. Refill-onlyapplypreservesorigins/commands,timesespeciallyuser-manualS3ramp. AutoS1/S2/S3learningdoesnottouchrefillKV;LUTfingerprintunchanged,currentrunfrozen. ItdoesaddmanualcurveSourceaftersave,blockingstaleprior-cupproposalsasexistingmanualeditorintent.

UIwithinexistingcurveeditor5rangecontrols+resetrefillonly+separateml/scommandSVG,estimatedg/starget+ceiling. CommonApplytoNextShot. Controlscreatedonce,soinputdragnotbrokenbyrerender. Dirtycomparesrefill+curve;staledraftpreserved.Disabledwhilebusy/inactiveprofile.ShowactiveonlywhenActiveRelease/live/S2assistON;continuouslegacyunchanged. LocalpreviewapproximatefollowsdraftS2base,target;serverauthoritativeonapply. Maxdurationdiagramnotclaimactualcompletiontime;cutoff/pressuremayreturnearlier;feedbacklatencycanextendactualeffect.

Curvepoints: newnumberinputcurvevalue(decimal,step.0001),curvequantumlabel;curveEnterValuevalidatesboundsandrounds4dec,Enter/changecommits. curveSetValueandpointerdrag4decnot1/16snap. CurveNudgeusesMath.round(v*16)+sign,stopsifnextnativeoutsidehard/shapebounds;then4decpreservesexactnative. Inputinvalidsetsflag/custommessage/disablesapply;reset/nudgevalidclears. Mincommand.10not.125,hardencoderstillnativequant. PreserveS3ordering/adjacentbounds. UIclearlydistinguishesdraftdecimalvsactualquantum;no0.0001physicalprecisionclaim. Existingnumericmanualendpointstillunchanged;noS3resetmigrationwasintroduced.

443/443Nodechecks=408baseline+35new.1032localeentries. TestsincludeS3oldrampdirecttyping(.698/.720/.778),fine.701,invalidandorderguard,native1stepfromnonnativedecimalandlowerstop;refilldefaults/bounds/storage/reload/frozenactiveplan,delay/70/90cutoff/500ms/6sapproach,guardtamper/failure rollback/oldclients/retainedS3/manualorigins/frontendhandlers/i18n. GeneratedHTMLscriptsyntax/structure;NO1.71hardware/fullbrowserengineexecution. ExistingS2missingreturntargetechoSTILLrestrictssteady-learning;notclaimedfixed. Currenthistoryauditstillonlyreaddevicehistoryoninstall;exactcupthatmadeS3.813all3notyetknownfromourworkspace. User1.69photosandearlierspecsretainedbelow.

ZIP9files;originalLICENSE/calJSONandoldZIPimmutable. ReceiptappendedafterGitHubprotectedhead+blobverification/Librarysave. DownloaduserprefersnativeAPI/downloadURL. Noagentsusedorauthorized. No newcalibration/dedicatedcoffeeroundsrequested.

## Historical1.70handoff — currentsection supersedes

# HyperEx0.1.70 handoff — 2026-10-27 Asia/Shanghai

Baseline delivered1.69/commit3ba2e067987d1aab3694ac8910bebd9d5f05df54. README first1.70section authoritative. User supplied4photosrun1793099785070-1. MainissueS2refillstillneeds earlier/higher120%desiredREALg/s then actual85%cutoff; weight-stage exits matter more than ramp cosmetics. User also asksS3latehigh vsolderlow and whetherequal3commandsmeansshapeaccidentallyOFF. Preserve both goals.

Photosavailableat upload/01-image-1793099938991.jpg,02-image-1793099957217.jpg,03-image-1793099980928.jpg,04-image-1793100033226.jpg. LatestshotS1=1.115,S2=3.651,S3enabledshape.813/.813/.813;S2RAW3.821vs5,tailerror-12.32/CV2.78,S3RAW1.619vs1.5,tailerror+11.62/CV5.2/overshoot22.2.17writes17ACK3targetresponses11misses/streak8. S2unconfirmedbase-returnexcluded;S3normalizedoverall1.513whileactualhigh,nextproposal.853all3. NoCSV;cannotclaimprecisereplay/rootcause. Userwatertempnearly100duringS3:codeallframesuserc.temperature/sensorcoffee,livewriteretainstemperature;shotphotoactualtemperature89–94,topidle95.4. OfficialDecentmixedwatercompensationispossiblebutmappingofscreenmeasurementsnotverified;notproofactualbrew100orhardwarefault. No further temperaturechange requested.

S2stage2StartupPlanstillrefill-85schema3. Newplan.refillTargetGS=1.2goal,refillTargetFraction1.2,commandBasis/requestedCommandMlS/commandLimited. Preferstate.diagnosticLastonlyiftrusted/currentphysicalfingerprint,cleanstableactualtail. Tailmachineactualflowcorroborateslastissuedcommand±15%,>=8rows/80%,fresh<=600ms,pressure<.9cap;actualtail.5–1.5goal/CV15.6. Modelcommand=lastcommand*(1.2goal)/actualtail. FallbackLUTrelativewhenbothmappedgoal/1.2goalavailable;otherwiselabelboundedlocalproportionalbase*1.2.Nog/s→ml/sdirectfallback. Transientceilingmin(8,base*1.6,base+2),floor1/16. Do notclaimtarget6g/sreachedjustbecauseplanestimatesit. Sourceexclusion/mode/LUTguards;notnumericS2learningadmissionbyitself.

S2prewarmRAWbeginSoak,startLiveTrimclosureallowssoak/restart;liveTrimTickwaitsthosephaseswithoutwrites/checkbudget. kickS2Refilloncehandleready+confirmedframe1armsone0mscheck;subsequentperiodunchanged. scheduleLiveTrimTickclearsprevioustimertopreventduplicates. Noaddedskip/frame,physicalGHC/fullsoakretained. ActualRAW85%cutoffonly,noprediction-onlyearlyreturn;pressure/stale4sdeadlinecanreturnearlier. Predictionretainedforapproach.1.69ACK/return/unknownframeguardsmaintained. Stageweighttargetsunchanged.

S3NOaccidentalshapeOFFpathfound. Equal.813threeframesisflatcommandbutenabled3timedframes,5totalprofileframes. NewcommandModeLabelthirdshapeargshowsFLAT(3timedframes)onbothapplied+snapshot. Do notrestorehistoricalrisingvaluesblindly:actualhydraulicresponsecanchangeandcurrentshapeconstraintcanlegitimatelyprojectflat.

Confirmedcodebias: oldforwardMath.maxmonotonicprojectioncanraiseall3totheearlyincrease,discardinglate-decreasewishes. NewprojectS3CommandsboundedweightedPAVA/minimizesper-framechangesusingseconds,retainsfraction/absolute/hard/nondecreasing/adjacentbounds;fallbackoldcommandsifinfeasible. Usedsingleandnormal2cupLEVEL+SHAPEandfinalprojection;dedicatedstallpathretained. rawProposedCommandspreservedtillfinalactualdirectionguard/projection.

ActualRAWtailoutsidepolicydeadband:liveS3applicableoutputhighcapsrequested<=old,lowcaps>=old;opposite-modeledchangeswithheldwithauditactualDirectionGuard. DoesnotinventcausalityorreplaceRAWwithmodel. Projection<.005deletesproposal/actionHOLD.UIHOLDsayactual/modelconflictorKeepCurrentinsteadfalseinsideband. Sourceevidence/actualremainseparate;newguardisveto,notclaimfullphysicalestimatorfixed.

408/408syntheticchecks,987localeentries.Nohardware/fullbrowservalidation.388previouschecksexpectedupdatednewS2envelope/cutoff;20newtestsincludingS3highactual-lowmodelandreverse,800weightedprojectionbounds,shapeenabledflat5framesupload,fastkickprewarmwithnowrites,120%units/LUT/referenceexclusion. Source/testsnoexportedtesthooks;injectionmemoryonly. ExistingS2returntargetechoabsenceSTILLwithholdssteady-learning:doNOTclaimfixedallmissingfeedbackorACK==target;significantremainingfollowupifuserasks. No sources/docsclaimhardwarefillingimprovedorallS3errorsgone. OriginalLUT/history/temperature/calJSON/LICENSEpreserved,oldZIPsimmutable.

ReleaseZIP9files;GitHubexpectedparent3ba2...;receiptappendedafterupload. UserwantsAndroidnativeAPI/downloadlinknotLibrarylandingpage. Noagentsused/authorized. Conversationlong;thishandoffpluscurrentREADME/sourcecoversdecisions.


UserfollowupaskswhenS3allbecame.819;notcancellation. Literalsearchbaseline1.67/1.68/1.69foundno.819hardcode. NativeA010.819and.813bothquantize.8125;maybesamephysicalstep,notproofactualchangeevent. News3CommandHistoryAudit readsonlycurrentdevicehistorycommands/nextShotApplied. Separateverifiedapplicationsfromproposals,shot-startvsapplication,flat/3timedframes,origin/version/at/runID/excludedforensicdata. Nore-admission/mutation. Knowncontext+verifiedbefore/after+nomissinghistoryrequiredforobservednonflat→flattransition;earliestretainedflatnotfirst-ever. Unknownfingerprintmissingrowsclearpriorcomparison. UIunderLearningHistorywithtimeline. Cannotreaddevicehistoryfromourworkspace;actualcup/timeNOTidentifiedyet.6additionaltestsverifyapplicationsvsproposals/unknownhistory/contextseparation/no mutation/UI/nativequantum.

## Historical1.69handoff — currentsection supersedes

# HyperEx0.1.69 handoff — 2026-10-27 Asia/Shanghai

Baseline delivered1.68/commit753674df92a0704dc9fa2f85eb3d81436b220c6d. User text-only feedback: S2inter-shot reacts more quickly; S3aggressive may be too high, will test. StartupbooststillNO. User hypothesis active release drains basket so S2needs upfrontrefill rather than slow increments. Explicit task: mainlyS2, reduce skipStepimpact, fill early to85%targetcupflow then gradually100%. Do notclaim measured drainvolume or confirmed cause. CurrentREADMEst1.69section authoritative over historical notes.

Implementation stage2StartupPlan schema3 strategyrefill-85 when ActiveReleaseON. Both originalassist/live switches required. No historyclean-cup/persistence prerequisite. SameverifiedS2frame1 only; no newprofileframes, GHCautomation or skips. min(base*1.4,base+1,8), floor native1/16. Maxhold4s, dispatchwindow4sfrom firstphase2tick (not unknownframe0clock). Runtime profiletruth/freshmachine+scale/pressure<90%cap/noexistingS2pending/written/reserved2writes+12checks remain. Removed actualpump>=85%base and exactbaseecho prerequisite only for refill; confirmedframe and verifiedprofile retained. ContinuousOFF uses renamedstage2LegacyStartupPlan witholdhistorypulsecriteria unchanged.

Refill RAW estimate unique source timestamps,6samples,>=.6s,R².90, .75swindow fallback1.3s for lower rate, sourcegaps>.6s/tare/stale rejected; noinstantdWdt. Positiveacceleration capped at targetg/s²; extrapolate.4s. Actualorpredicted>=.85target sends sameframebaseline return onceboostdriverACKexists; max4s/pressure90%/scalestalealso return. boosttargetecho notrequiredfor decrease. Separate2sboostACK/returnACK timers plus hold+2.5sreturnwatchdog. Missingbaseechoalone degraderetrysamebase; no stackedboost. Criticalauditfix unknownframenull doesNOTcleartimers or evadewatchdog; confirmedotherframe/phaseendscancel, nowriteoldframe. Transportfail duringboost existingabort remains.

Confirmedbasereturn completeS2Startup timestamps approachAt=now+1600. Aftersettle, internaltarget85→100%over3s; upwardwrite>=750ms andpositiveforecasthold, downwardoriginalfrequency; after3s100%target and750msupwardspacingretained. This is a controlgoal, not a guaranteedactualtrajectory. Issuedboost/return/completion/cutoff/predictedstatus recorded and displayed.

S2steadycontrolLearningAssessment excludes actualrefilltransient through startup-complete+1600 from RAW/machinedenominators. Requiresconfirmedreturn; nofulldatafabrication. WholeactualRAWvalidation/plots unchanged. Normalizedwindows gainstartMs/endMs diagnostics (S3thresholds/gainunchanged). Baselineprovenance/originandhistorykeys unchanged; physicalLUT/mode/coffeeemptyseparation retained.

GHC restartPourConfirmed preopens RAWtransport in parallel, guardedSingleSkipstillfreshGET/framecheck, restartSkipTimer0ratherthan350ms. Duringrestart_wait transportcanfinish butcontrolwrites/checkbudget doNOTstart. Samephase2firstframetelemetrywaitingdoesnotdisarmplan beforeframe1. Oneconditionalrestartskip andoneS2→S3weight skip maximum; S3subframesnatural. NoHTTPcurveuploadinside shot.

388/388 syntheticNode tests.361oldchecksadaptedfixtures:ordinarytrimcfg.s2StartupAssist=false isolatesregularbehavior; oldplannerunitcallsexplicitstage2LegacyStartupPlan; added27refillcasesincludingunknownframeholddeadline. GeneratedHTMLscriptsyntax/locale977entries checked; noengine/fullbrowserorhardwareexecution. S3aggressivehigh userreportnotyetdiagnosed; do notassertfixed. No newcalibration orspecialcoffeelooprequested. ReleaseZIP9files, previousZIPimmutable;LICENSE/calJSONbyteidenticalbaseline0168. GitHubhead/treeprotectedupdates andZIPblobSHAverified. Receiptwrittenafterupload.

## Historical1.68handoff — currentsection supersedes

# HyperEx0.1.68 handoff — 2026-10-27 Asia/Shanghai

Current release based delivered1.67/commit69eeac4e21d1af99af6d806f51e43afe1d6d399b. User reported3cups, no screenshots/CSV: S2>30%MISS but repeatedonecleanwaiting; executedstartupboostNOall3, thirdrise4.1s. User then explicitly confirmedall3WEREsaved, wants dynamic one-fixed-curve learning acrossmicrochanges, onecup→nextcupreaction. Four requestedpolicies保守/温和/正常/激进,default正常. Aggressivestatisticalqualificationmustbe30%broaderthanNormal; interpretedandexplaineddataadmission,notlooseroutputgoal/harddriverguards. Useraskedrestoringpriorprompt; originalwasquotedandretained. Do notclaimactualdiskfailureorunseenRAWdiagnosis.

CurrentREADMEfirst1.68sectioncontainsprecisepolicycaps/thresholdsandarchitecture; authoritativeoverhistoricalhandoff.361/361synthetictests; no1.68device/fullbrowservalidation. Latestactualscreensremain1.65run1793014454316-1inolderhandoff; latesttext-onlythreecupreportsettings/versionnotindependentlyverified. Userwilltesthistorymanualexclude/restorelater; noresultyet.

Concretecausesconfirmedinsource: oldscalarcommandtolerance.005; eachbaselineupdatecouldhidepriorcups. Oldstartuprequiredplateau±8%,S1exactcommand,S2within1/32andallpressures<85%cap. No pluginVersionhistoryfilter/keychange. Newnumericfingerprintdropsmicrotargets/settingsbutkeepsphysicalLUT/multiplier/basket/mode; qualificationignoresmicrotooandnormalizeslegacyqualificationstrings,sochangingweight/time/goalsdoesnotresetcoffeequalification. Learnedoverridegoalbindingsallowwithin2×whilekeepingphysicalLUT/modeguards. 0.5–2localreferencecommand/targetenvelope,0.2–3×responseplausibility; extreme/faultrecordsnotdeletedbutnotnumericreference.

Policy normalizeLearningLevel/learningPolicy/learningAdmission: nativeAdaptiveLearningLevelenum中文fourvalues,default正常;quickeditorselectsavesstringandisindependentofLiveFlowTrimLevel. Conservative2cups/gain.18/band8;Gentlelargeerrorsingleotherwise2/gain.25/band8;Normalclean1/gain.35/band8;Aggclean1/gain.55/band5. S1caps[.04,.04],[.05,.04],[.10,.08],[.15,.12];S2[.05,.10],[.08,.20],[.12,.35],[.20,.60];S3[.04,.04],[.05,.05],[.08,.075],[.12,.125]. Capsfraction+absoluteBOTH. Normal/Aggcurrentdominates,agreeinghistory20%reference,conflicthalfstepnotveto. NearbyS1/S2andS3per-frame/timingreferenceexplicitlocalmodels;nevercherrypickolderagreeingcupovernewercomparableconflict. NormalS3singleboundedLEVEL/SHAPEretainsmonotonic/adjacentlimits. Dedicatedstallrecoveryremainstwo-cup/conservative. S2fixedlevelpreferssettledtail60%RAWfit4sR².97;actualwholephasevalidation/plotsunchanged.

Aggadmissionfactor1.3: R²fitresidualwidth*.1.3(.90→.87,.97→.961),minimumwindows/coverage/samples÷1.3(samplesceil),normalizedwindowspread25→32.5%,historyagreement35→45.5%;S2steady/startupCV12→15.6%. S1originalminimumqualitygatesnormalunchanged,aggressiveappliessamefactor; nochangeRAWdriverliveTrimRegressionR².90/frame-settle/freshness600ms/ACK/pressure/sourcegap/mode/fault/budgets. Outputgoalbandnotbroadened;AdmissionwidthexplicitUI.

Startupmetrics schema2 recordsabsoluteandplateau-relativerises,displaybasis. No mandatorytailHIT:Normal.5–1.08target,CV12,overshoot8withvalidonset/continuousRAW/freshmachine/headroom;Aggstatisticalwidth1.3. Normal/Aggoneslowclean(>1.2/>1s)onequantum400ms;GentleverySlow>=2.5s/CV8single,Conservative2. Canreuselegacybaseline-offreasononlybecauseoldheadroomgateprecededit. NofabricationofmissingRAW. S1/S2commandsoftmatches±50%;S1write-signatureexactnessnotrequiredNormal/Agg. Runtimeactualbaseecho,freshscale+machine,sameframe1,noexistingpending/priorS2write,reservedbudget,pressure<90%cap,flow>=85%base;window2s,skiplateifRAWalready>=80%target. Amplitudeone1/16≤8%unchanged;timedreturn/earlypressure/writtenACKwatchdog2.5s/target-onlydegradationandallbudgetsretain. reportsstartupExecutionstates/reason. Continuedbenefitcomparisonbasisconsistent;notcausalityproof.

OriginstageCommandOrigin: perstageq.originandshape.originoriginal/adaptive/manual;legacyunattributedretainedunknown,legacyglobaladaptiveSourceaggregateadaptive. Executionmodeauto/manual/shapeSTAYSinternal,originseparate. startconfigcapturesorigins,shot snapshotfrozen;currentappliedandlatestshotUIuseorigin. Auto changesstampchangedstagesonly;visual/manualnumericKeep preservesuntouchedoriginsandshapes;editsaremanual;rollback/reloadpreserve. OriginalLUTuntouched. No actor inferencejustfromexecutionmanualflag.

Persistenceuserconfirmedhealthy. NewhistoryPersistenceAuditrequirescurrentrunIDinverifiedreadbackIDs,UTF8bytecounter. RoutinecheckrowscompactedONLYinnewhistoryrecords,allactionsretained,currentfulltrace/CSVunchanged,oldrecordsnotrewritten. Twoidletransientstorageproberetriesmax;wholefileechoverifies,retrytimerunload/shutdownclear. CSVaddedfulllivetracesbeyond300eventring,S2proposal,origin/policy/historymetadata. FlatS3shapeCfgNumber(null)dereferencefoundbysynthetic3reloadtestandfixedindependently;notblamedforuserreport.

Validation361/361includesoldregressionConservativeplusexplicitdefaultNormal/4policies/3cupdiskreloadwithverifiedprofileuploadsandimprovingsyntheticplant/S1S2S3onecup/mixedhistory/originmixedmanual+adaptive/oldversionreuse/microqualification/quantization/pressureACKfreshguards/exact1.3qualificationandRAWwaveformcase/flatS3/fullCSV/recovery/monotonicstrengthcaps.955translations.9fileZIP,originalLICENSEandcalibrationJSONidenticaltobaseline0167. ReceiptgeneratedafterpackagingandGitHub/Libraryuploads. PreserveoldZIPs;GitHubexpectedparent69ee..andallhistoricalfiles.

Conversationlong: currenthandoffcoversalllatestdecisions. Userdoesnotwantdedicatedempty/coffeetestloopsorrepeatedscreenshotsneededfordailyuse;normalconsumedcoffeessupplyevidence. OptionalCSVonlyexceptional. Respectstoprequests. No agentsusedorauthorized. Sourcefilesandtestsareauthoritative;scratchpatchscriptsnotreplayableasonepipeline.

## Historical handoff — current section supersedes

# HyperEx0.1.67 handoff — 2026-10-26 Asia/Shanghai

User asked active-release switch: defaultON; prominent insettings; diagnosticstopbarstate. OFFmustbeonecontinuousS1→S2→S3shot, allthreestageslearnandlivecontrol, numericconsensusseparatefromON. Implemented on delivered1.66; currentREADMEfirstsectionauthoritative.

NewActiveReleasesettingafterEnabled/defaulttrue, cfg.activeRelease; advancedsettingsfirsthighlightedcheckbox usesexistingnativecoreSettingsPOST+idlepreflight/reload. Diagnosticmodebanner anddashboardtext; runningphase no longerlooksIDLE. Nativehostsettingsoutsidepluginpagearehostcontrolled; tellusertochangemodebetweencups. ONoriginalS1Idle/release/soak/GHCrestartremains. OFFbeginsnormalEspressoonce; S1weight4g callsbeginContinuousStage2 guardedskip0→1; S2weight40gskip1→2;final100gIdle. NointermediateIdle/soak/secondEspresso/GHC. Weightcontinuitypreserved. FinalweightguardincludespendingS1transition.

NewactiveReleaseEnabled,overrideStorageKey,liveTrimPhaseAllowed,beginContinuousStage2,stage1LiveLearning. ContinuousS1rawframe0enabled; allthreephasesuseSAMEbudget/onepending/controller. ActiveONonlyS2/S3liveasbefore. S1skipinflightblocksS1writes. stage1LiveLearningnormalizesONLYoriginalquality-passing20–80%trajectoryusingfreshactualtargetexposure/nativebase; validatesRAWtimestamps/pressure/actuatoranddoesnotrewriteweights. FixedS1usesexistingstartupmetrics. Repeatednumericgatesunchanged. S2startupplancomparesS1controlsignatureandchecksactualsignatureatdispatch,soS1livewritescannotunpredictablyreuseoldS2boost. Reservedstartupreturnwritesstillwithinwholecupbudget.

numericLearningFingerprintKey injectsactiveRelease(defaulttrueifmissinglegacy),keepstemperatureignore; currentfingerprintcontainsmode. NoON/OFFnumericmix. Persistedcommands:originalmanualTestOverridesforON,newmanualTestOverridesContinuousV3forOFF; read/write routingatstoragehelpers,selected-key-onlyreadhandler;modeboundinoverridesincludingmanual/auto/rollback/clear. LegacyoverridesmissingmodebelongON. PhysicalLUTunchangedandcoffeequalificationignoringswitchpreservedwithoutnewcalibration; qualification/baselinereferencesmaybesharedbutnumericconsensus/commandsoverridesarenot. HistoryrowactiveReleaselabelsactualshot;exclude/restorestillglobalreversibleannotations.

Additionalpreflightsafetyfix:guardedSingleSkipfiniteOrNull(frame)ratherthanNumber(null)=0; optionalisCurrentcallbackcheckedafterGETbeforeanyskip. ContinuousS1,originalrestartS2,andbothmodesS2→S3supplyphase+sequencetokens. PreventslateskipafterIdle/abort/finalweightwhileGETpending. Unknownframefallbackremainsexistingoneboundedskip,explicitwrongframerejects. Testfullsequencefoundthiscase;fixedwithoutchangingtwo-skipbusinessinvariant.

328/328syntheticNodechecks,generatedscriptsandHTMLchecks;880translationentries. No1.67hardware/fullbrowserresults. PreservepriorZIPs. Package9files/newZIP,originalLICENSE/calibJSONbyteidentical,hash/library/GitHubIDsinfollowingreceipt. Useraskedwatchconversationlength; thishandoffcontainscurrentmodearchitectureandpendingdevicechecks. No1.66hardwareevidencehasarrived. Latesthardwareis1.65below; userwilllatertesthistorymanualexclude/restoreandreport. Do notdemanddedicatedempty/coffee cups orresetLUT. Stopifuserasksstop.

## Prior handoff — historicalwherecurrentsectiondiffers

# HyperEx0.1.66 handoff — 2026-10-26 Asia/Shanghai

User authorized1.66 after discussing S2 delayed steep-step response. Implemented from delivered1.65, with no LUT/profile frame/skip topology change. Read the current README S2section for exact architecture/thresholds and all retainedguards.

Latest hardware evidence is1.65 run1793014454316-1, five photos /upload/01-image-1793014587183.jpg through05-image-1793014649266.jpg. Persistent14saved/8compatible/5emptyrefs. S2 actualwhole RAW≈3.306g/s(-33.88%), tail3.888g/s(-22.24%),CV6.85%,overshoot0. CurrentnormalizedS2evidence3.492 vsolder3.143,mean3.318,var10.5%,matched1793007958123-1. NEXTS2was automaticallyapplied2.507→2.607ml/s,workflowGET+uploadACKverified. These are NEXTcommands, not thisshot'sexecutedbaseline. S1held.809 because7olderS1commandsmismatched. S3whole1.593(+6.2%),tail1.519(+1.25%),CV4.36%,overshoot13.47%,nostall;currentquarters1.598/1.556/1.453,frames1.466/1.609/1.492. S3modelmean1.678/maxbetween-cupvar20.7% exceeded20%gate, so no basestructurechange.17livewrites(8S2,9S3),statusshot-finished; missingtargetdidnotprematurelystop. No observedconfirmedfault. Userwilltesthistoryexclude/restorelater; untestedhardware feature. Userdoesnotneednewdedicatedcoffeetests.

1.66 new functions stage2StartupMetrics,stage2StartupPlan,clearS2StartupTimers,dispatchS2Startup. New cfg/manifestS2StartupAssistdefaulttrue, explicitly liveOFFblocksassist. run.config.s2StartupPlan frozenatshotstart; compacthistoryrow.s2Startup storesdata. Nextshotpanel showsmetrics/currentplanandactualpulseUsed. Legacyrecords retainLEVELlearning but lackstartupmetrics. Originalfingerprint unchanged; temperature ignoredonlyasexisting numericpolicy. SameS1command nowrequiredforshapematching. All exclusions affectstartupplan.

Pulse usesexistingrawA010frame1 only, originalFASTbaseline remainsinprofile. Onequantum bounded8%,400–800ms,requirestwoaccuratesteadybutslowriseswithheadroom. Ifplateaulow,continueexistingLEVELlearningratherthanboost. Earlyguard1.2s/actualbaseecho/freshtelemetry/pressure/actuator/budgets; may skipstartupifdriveropeninglate. Independenttimer returnsbase withboostACKevenwithouttargetecho. Pressurecapreturnearly. 2.5stotalwatchdog onlyabortsformissingbasereturnDRIVERACK; missingbaseTARGETechoalonecontinuesdegradedmonitor/samebaseretries≥3s,noadditionalupwardcommands. Delayedmatchingechorecovers. Clearsontansition/reset/stop. Regulartrimresumesafter1.6sresponsewait. Boostreturnretryallconsumeordinarywritebudget. Faileddriverconnection/sendretainsIdleabortguard. No extra20sweightwatchdog reinstated.

Continuedassistrequireseligibleresponse≥10%fasterthanstoredunassistedreference,otherwisebaseline. Noescalationorclaimofsingle-actioncausality.305/305syntheticchecks; no1.66hardware/fullbrowservalidation. OriginalcalibrationJSON/LICENSEbyteidentical.859translationentries. Package9files andfreshZIP,donotoverwriteolderdeliveries. GitHubreceiptandSHAwrittenafterpackaging.

Conversationlong: keepthishandoffand1.65hardwarefacts; do notguesscontext/tokenremaining. Usercanrequeststopatanytime. Do notsilentlydeleteshothistoryorrequestrecalibration/dedicatedtestcups. Historicaltextbelowonlyapplieswherecurrentsectiondoesnotsupersedeit.

## Prior handoff

# HyperEx 0.1.65 handoff — 2026-10-26 (Asia/Shanghai)

Current1.65 based1.64. User requested excluding clearly mistaken/buggy cups to avoid history pollution. Implemented automatic hard-fault eligibility plus reversible manual history annotation, without discarding genuine off-target response.

## Current integrity pipeline
assessRunLearningIntegrity(run):schema1,eligible/status,reasons,rawChecked/eventsChecked. Incomplete result or initial truth not verified/schema3 excluded. learning_fault events (recorded in abortSequence) or sticky learningExecutionFaults excluded. More than2accepted skipStep commands excluded, using max(stickycount,eventcount) so event truncation cannot hide it. Store assessment in each compact history row and evidence; original numerical data retained.
RAW checks onlywithin S1/S2/S3. Afterphase2s and priorgain≥2g:drop≥3g excluded; positivejump>max(12g,30*dt) for0<dt≤.6s excluded. Baseline resets on initialtare(first2s or priorgain<2g), allowing delayedpre-outputtare; intendeddump/restart phases ignored. These heuristics detectgross scale discontinuity, not prove user intent. No hardware validation ofthresholds yet. Knownfault aftergoodlasttare is not hidden by laterregression. OrdinaryMISS,lowflow,noise,realstall/decay and missing target alone are retained underexistingstage gates. No fault inference from error magnitude or version alone.

historyLearningStatus(row) respects manual learningReview.excluded, persisted integrity, known unfinished result/unverifiedmetadata; otherwise legacy-limited-audit. Legacy missingraw/events not fabricated/reanalysed. learningRunAllowed consults latest persistedreview and raw assessment; trustedAdaptiveRun calls it before suggestions/remember. historyEvidenceAllowed checksboth envelope and linkedrecord; restore and lookup consultit to preventsession/disk reentry. Invalid records excluded frombaseline/reference/qualificationcounts. Allprior quality/context/temperature/command/two-cup safeguards remain.

## Manual history UI/API
Step2 expandable history panel: selecttime/runID/version,reasonenum(operator-mistake/plugin-fault/scale-or-cup-disturbance/other),Exclude fromlearning,Restore automaticeligibility. Showsallretainedrows withstatus/reasons/S1/S2/S3 evidencepresence. Exclusion is an annotation, not delete. Existing30record/20activeevidence retentionlimits unchanged. Originalrow.evidence remains; manual restore recovers valid retained evidence but cannot overrideauto integrity. Last20annotationchanges retainedinlearningReviewLog.
HTTP history-review requiresidle,no activeapply,verifiedloadedhistorystorage; validatesid/boolean/reason. Samepersistent historyfile andexistingwrite/readbackqueue;savePending UI statusuntilACK. Errorpersistsvisiblythroughpassiverefresh; originalselection retained. NoLUT/profile writes orautomaticrollback ofpreviouslyappliedcommands. Already-appliedsettings remain andgraph editor canadjustthem. Pendingautomaticapplication forthatcup cancelled; otherqueuedanalyses reevaluatefreshfilteredhistory. Persistencefailure leavesexplicit session-only exclusion/error, notfalse durable-success.

Preserve alreadyestablishedcoffeemode via persistentHistoryFile.coffeeQualification fingerprint(keyignoresnormaltemperature/basketbut includesphysicalLUT/settings). Excludinga learning sample doesnot resetvalidcoffeeseedtoempty. Markercreatedfromeligiblecoffee/qualificationorcurrentestablishedcoffeemode beforemanualexclusion; physicalLUTkeychangeinvalidatesit. OriginalLUTunchanged.

## Latest received hardware screenshot review (1.62, not1.65)
Files /upload/01-1000067541.jpg,/02-1000067540.jpg,/03-1000067539.jpg. Run1793007958123-1;13saved/7compatible/5emptyrefs. Live trim OFF (bottom says未开启调流). S2fixedcmd2.507,actualRAW3.143g/s(-37.1%),R².97036,11.99s;tail error-25.95%,CV3.46%. S2CURRENT EVIDENCEADMITTED,actionREPEAT SAME COMMAND/PENDING,reasonone cleanS2no matchingprevious. Thisdiffersfromearlier insufficientcurrentdata.1.64historyscanfixrelevantbutexactoldereligibilitynotprovedfromscreenshots;7compatible!=7qualifiedS2.
S1startup1.384→1.221,mean1.303,var12.5%;automatic.778→.809applied+freshreadbackverified. GlobalAPPLIEDmeanssomephases,notallthree. S3thiscupRAW1.832target1.5(+22.1%),R².99913,29.69s;frame1.664/1.870/1.672g/s on.698/.720/.778;quarters1.720/1.845/1.665;nostall. S3consensusmean1.622,maxbetween-cupvariation38.7%,VARIABLE/REPEAT;38.7isnotwithin-cupripple. Userwasinformed1.64couldsearcholderdataandnospecialrecalibrationneeded.

## Retained features/validation
Bilingualpage/dialog/dashboardlanguageChinese defaultpersisted,823phrases includinghistory; nativeDecaidsettingshost-controlled,rawCSV/JSON/numbers/IDsunchanged. Live trimdefaultsON/level3(250ms/2000checks/200writes),explicitsavedchoicesretained;directstartOFF;physicalGHC,two-skip topology,pressure/ACK/sourceguards,recoverablemissingtarget,andprofilerecoveryunchanged. VisualcurveeditingandS2dynamic/historylookupfixesretained.
282/282syntheticNodechecks,plugin/generatedscriptsyntax,generatedHTMLbalanced/uniqueIDs.19newintegrity/reviewtests coverhardfaults,steadyMISSretention,tare/rearmallowances,manualrestore/autoexclusion,evidenceimmutable,persisted/sessionreentry,coffeereadinessretention/changeLUT,queuecancellation/APIguards,no-machinewrites,stickyfaults,excludedreviewstatus,andUIrefresh/errorselection. No1.65hardware/fullChromium/WebViewvisualvalidation.

Package9files:plugin.js,manifest.json,README.md,HANDOFF_v0165.md,LICENSE,2originalcalibrationJSON,tests/verify_v0165.cjs,tests/RESULTS_v0165.txt. ZIPHyperExPulseFilter_v0165_fresh.zip. SHA/LibraryID/GitHubcommitrecordedinrelease receipt. Expectedmainparentf1b68fd0830009fa297edaacb1def41803de1ef5. KeepoldZIPsimmutable/remotehistorypreserved. Thisconversationislong; handoffupdatedtokeepcontinuity. Userpreviouslyaskedstop; stopwasrespectedthenuserresumedwithscreenshotsandnewhistoryfilterinstruction. Noactiveworkshouldcontinueafteranewstoprequest.

## Prior handoff (historical; above supersedes)

# HyperEx 0.1.64 handoff — 2026-10-26 (Asia/Shanghai)

Current1.64 based published1.63. User reported a new1.62 shot still shows S2 MISS above and REPEAT below while1.63 localization/default work was finishing.1.63 was saved/pushed but not yet handed over in final before steering; latest1.64 includes all its features. User then asked whether screenshot needed; answered yes in commentary: preserve1.62page, capture S2 next-shot decision/reason/confidence and validation with regression/R²/window/live controller state. Awaiting those new screenshots; do not invent cause/data.

## Concrete additional defect and fix
previousMatchingAdaptiveEvidence stopped searching on the first prior row with missing stage evidence, wrong fingerprint/command/shape or unavailable restored storage. Newer S1-only/S3-only rows could hide earlier valid S2 evidence. Reproduced using synthetic same history on untouchedbaseline0163 and1.64: old REPEAT SAME COMMAND with one-clean-shot explanation; fixed ADJUST2.507→2.607ml/s, matched older source after skipping missingS2 row. End-to-end automatic upload/finalworkflowverification passes and LUT stays unchanged. Reproduction is not actual user's RAW replay.

matchingAdaptiveEvidenceSearch now scans retained history newest→oldest, skips unavailable disk/schema/fingerprint/missing-stage/command mismatch/malformed rows, and selects the FIRST comparable verified stage evidence. previousMatchingAdaptiveEvidence wrapper preserves existing API. Current fingerprint must exist. Keep numeric temperature compatibility, stage command/target/shape checks and profile truth. Do not skip a newest comparable contradictory/outlier cup to cherry-pick agreement. Existing variation,direction,pressure/actuator,two-cup and bounded-step protections still run. If current S2 inadmissible or no comparable older evidence, still wait. Does not guarantee the newly photographed MISS qualifies; need screenshotreason.

S1,S2,S3 decisions now carry historySearch counters/matchedRunId (without duplicating raw evidence). renderNextDecision displays checked/missingStage/contextMismatch/commandMismatch/unverifiedDisk and matched source, with6new translationpairs. Embedded catalog777entries. Version1.64 source/manifest/doc/tests consistent.

## Retained latest defaults and language
Live trim missing settings defaultON,level3=250ms,2000checks/200writes including retries. Saved explicit OFF/other valid level retained. Direct driver start remainsOFF. PhysicalGHC,originaltwo businessskips,pressure/source/ACK safeguards,2%target aim,recoverable missing-target retry,profile restoration unchanged.
Chinese default with 中文/English page buttons,pluginStorage uiLanguage persisted; immediate reversible DOM text/accessible label/dialog translation; dashboard surfaces too. Native Decaid settings screen host-controlled; CSV/JSON/IDs/numbers remain original. Language switch does not reload page or alter curve draft/profile/LUT/history. Prior1.62 curve editor + stale draft guard,verified next-shot application/rollback,prior-run proposal suppression and1.62 dynamic-exposure fallback remain.

## Validation/release
263/263 synthetic Node tests plus syntax/generated browser-script compilation;6new history tests covermissingS2 skip,combined exclusions,newest contradictory row held,S3lookup,no matching evidence,end-to-endautoapply/upload/readback. All prior257controller,localization/default,curve/manualapplication tests retained. No real1.64 hardware/fullbrowser validation.1.62 new real-shot specifics not yet supplied. No request for additional dedicated calibration/coffee series; screenshots are voluntary normal-use support.

Package9files: plugin.js,manifest.json,README.md,HANDOFF_v0164.md,LICENSE,2originalcalibrationJSON,tests/verify_v0164.cjs,tests/RESULTS_v0164.txt. ZIP HyperExPulseFilter_v0164_fresh.zip; exactSHA/LibraryID/GitHubcommit in conversationreceipt afterpublication. Expected mainparent8ee85c43c093bfc84c10e78ebb8e973494a3436c. Preserve oldZIPs/remotehistory. Detailed1.63handoff below documents localizationscope anddefaults. Update handoff beforecontext-risk; user expects screenshot-friendlysupport and internaldiagnosis.

## Previous detailed handoff (historical; above supersedes)

# HyperEx 0.1.63 handoff — 2026-10-26 (Asia/Shanghai)

Current release based1.62. User asked for a unified Chinese/English switch after1.62 became mixed-language. During implementation user explicitly requested next release live trim default ON and default level3; implemented in this1.63 before delivery. Old delivered ZIPs stay immutable.

## Localization
- Header 中文 / English buttons; Chinese default. Existing pluginStorage uiLanguage persists selection; language endpoint reads/saves and accepts language body even if optional request.method omitted. Invalid choice returns400; dispatch failure503, no state change. Saves serialized/disabled while pending. Late initial storageRead ignored after explicit edit. No profile sync, machine write, settings reload or page reload.
- createUiTranslator + embedded UI_LANGUAGE_PAIRS(771aliases/phrases). Exact match first; longest one-pass phrase substitution with ASCII-boundary checks protects technical identifiers. Both original mixed-language Chinese and normalized Chinese aliases support English reversal. Source strings never mutated in algorithms. Dynamic gate numbers/units retained.
- Independent bootstrap before close/bootstrap/main script: MutationObserver handles new text nodes and title/aria-label/aria-valuetext/placeholder. WeakMaps track original+rendered text for reversible switches and authored updates. No innerHTML replacement for localization; existing buttons/listeners/curve draft remain. Skip scripts/styles,input,textarea,pre,code,data-no-i18n. Language bar intentionally bilingual. Dialog wrappers translate confirm/alert text. Main-script failure still leaves CLOSE/HOME.
- buildSkinSurfaceAnswer translates only supplied label/text fields after constructing surfaces; actions,IDs,colors,columns unchanged. Preference events emit refresh, not new machine action.
- UI scope: all plugin-generated pages,markers,dialogs,statuses/dashboard/shot strips. Native Decaid Plugins/settings labels/descriptions are host-rendered manifest metadata, outside this page switch; no invented support for host-wide locale. Raw CSV/JSON/schema keys/numeric values/IDs are unchanged. Uncatalogued external system errors remain original diagnostic details, not fabricated translation.

## New defaults
loadConfig missing values: liveFlowTrimTest=true,level=3; manifest true and string'3'. Invalid level fallback3. initializeLiveTrim invalid cfg fallback3. Native dropdown values unchanged1..4. UI initial slider3,checkbox checked,heading DEFAULT ON / LEVEL3; Step2 description corrected to avoid implying live trim is OFF by default. Saved false and saved valid other level remain authoritative. L3=250ms/2000checks/200writes; retries count. Missing-target recovery,ACK abort,pressure/source/command safeguards,two-skip topology and physicalGHC unchanged. Direct-driver-start test remains OFF. No migration forces old OFF to ON.

## Validation and continuity
257/257 synthetic Node simulations plus plugin syntax/generated script compilation. Original243tests retained with explicit OFF/level1 fixture where testing historic behavior; new tests separately exercise real new defaults and explicit saved choice compatibility. Added language default/storage/late-read,invalid/failed-save behavior,no machine/profile/LUT/history mutation,dashboard text/actions,gate numerics,reversible authored text,CSV/JSON/input preservation,dialogs,new nodes,save serialization,all registered Chinese phrases toEnglish and entire generated static-page language coverage (excluding language bar and technical names/units). Generated HTML balanced and IDs unique; no full Chromium/Firefox visual or realWebView/hardware test available. Latest device evidence remains1.60 screenshots, not proof of1.63 performance.

S2 correction from1.62 remains: dynamic-exposure fallback on ANY fixed-window admission failure,not only seconds; exact gate values reported. Does not relax thresholds or guarantee all MISS auto-adjust. Curve editor source remains ml/s preview,not a measured g/s prediction; manual prior-run suppression and next-coffee learning retained. No new calibration/dedicated coffee testing needed. User can continue sending screenshots voluntarily.

Package9files: plugin.js,manifest.json,README.md,HANDOFF_v0163.md,LICENSE,2unchanged calibration JSONs,tests/verify_v0163.cjs,tests/RESULTS_v0163.txt. ZIP HyperExPulseFilter_v0163_fresh.zip. SHA/LibraryID/GitHubcommit recorded after publication. Expected main parenta828275d826900b02aefd788870a6581dfe260ed. Preserve all historic remote blobs with base-tree and expected-head guard. Latest release receipt in scratch records exact delivered identities.

Maintain translations by extracting the UI_LANGUAGE_PAIRS JSON constant in plugin.js; keep aliases for old authored Chinese plus normalized Chinese. Native manifest metadata is deliberately not rewritten into runtime localization. Do not claim system-wide translation. No new external dependency in shipped runtime/tests.

## Previous detailed handoff (historical; current defaults/locale facts above supersede)

# HyperEx 0.1.62 handoff — 2026-10-26 (Asia/Shanghai)

Current source1.62 based1.61. User asked for visible curve editing instead of numeric-only manual inputs, shared Step2 NEXT SHOT application, directional write markers, and audit of UI/output logic so repeated S2 MISS is not unexplained.

## Current implementation
- Step2 visual editor:5handles (S1,S2,S3 EARLY/MID/LATE), vertical pointer drag, one-native-level buttons, keyboard arrows, generated command table, current/draft toggles, S3 durations±1s. ml/s command preview explicitly distinct from actual g/s. Phase diagram not falsely represented as exact whole-shot time: S1/S2 weight-exit, release/soak omitted, S3 real start offsets labelled. Shape has existing non-decreasing/adjacent bounds.
- Dirty drafts survive periodic loadCal; stale revision disables apply. curveEditorRevision binds normalized profile,LUT/target fingerprint,context and selection revision. applyCurveEditorDraft validates values/times/shape and idle/selected/verified context, fresh machine idle and workflow GET, detects unseen home edits, then stores same schema3override, syncs with upload+readback, returns verified. Failed writes roll back overrides and original profile where possible; never claim success after failure. No LUT/global multiplier changes.
- manualCurveSource persists afterRunId/appliedAt/mode in existing override store; no new KV store. Old-run auto/manual adaptive application blocked; fresh next coffee learning permitted. Existing command-matching consensus keeps unlike seed data separate. AUTO APPLY toggle unchanged. Cancel stale queued timer after successful manual intention; failed application restores queued evaluation. Existing numeric apply and RETURN ALL TO LUT now also verify, roll back, serialize against curve changes and suppress obsolete old-run proposals. Restore-LUT stores all-auto schema3 with provenance so prior proposal cannot immediately undo it.
- Separate source statuses in APPLIED PROFILE, automatic proposal and historical shot snapshots. Old analysis marked superseded after manual curve. Validation's nextdecision panel gives each stage actual error vs adjustment eligibility, blocker and applied/error/waiting distinction.
- Real flow chart6series toggles. Write markers up/down from command vs previous confirmed command; retries↻never another up/down increment. Missing historical prior command unknown-dot. Matching machine target remainssquare and localwrite not labelled measured cup success.

## S2 analysis/UI correction
In1.60 screenshot usable2.84s exceeds2.4s but rejected; source grouped time,25%temporal coverage and60%cohort share in one vague reason. Exact original failed gate unknown without original trace.1.62 reports structured actual values and exact failures separately. More importantly, dynamic-exposure fallback formerly ran ONLY when fixed-window duration<2.4s (S2); now tried when ANY fixed-path admission gate fails. Select eligible alternative even if shorter than fixed candidate. Synthetic case with >=2.4s fixed data but <25%coverage now learns through dynamic exposure. All thresholds, regression/source/pressure gates, two-cup agreement and numeric correction bounds retained. Do NOT claim actual photographed S2 fixed/adjusted without device evidence. UI explains HOLD vs insufficient vs pressure-limited vs failed-upload vs pending vs manual-superseded.

## Validation/release
243/243 synthetic Node checks, plugin syntax, final generated scripts compilation. HTTP endpoint tests and simulated DOM pointer/keyboard, stale/dirty state, shape bounds, rollback, prior/new-run, pending-timer recovery, direction markers, numeric learning gates and fallback. HTML balanced/uniqueIDs; SVG XML valid. Success followed by UI refresh failure remains labelled applied; failed uploads retain dirty draft and show not applied. No Chromium/Firefox. ImageMagick available but SVG raster requires absent rsvg-convert; attempted raster unavailable. Do not claim full-browser or real-tablet visual validation. No1.62 hardware result. No new dedicated coffee test/calibration required; existing screenshots optional.

Current files: plugin.js,manifest.json,README.md,HANDOFF_v0162.md,LICENSE,2original calibration JSONs,tests/verify_v0162.cjs,tests/RESULTS_v0162.txt. ZIP HyperExPulseFilter_v0162_fresh.zip. All old delivered ZIPs preserved. New ZIP hash/LibraryID/GitHubcommit in conversation release receipt after completion. GitHub main expected1.61head7fd010beeb563c74b3f1318389b979c0e634909a; preserve history using base tree and expected-head lease.

## Outstanding boundaries
No arbitrary descending S3 shape; existing DECAY COMP constraints retained intentionally. Editor is vertical flow manipulation with duration buttons, not arbitrary frame insertion. Actual cup prediction not invented; chart is commanded ml/s and actual RAWg/s remains visible separately. A missing driver ACK remains hard fault; missing machine target alone remains recoverable from1.61. User still sends screenshots voluntarily. Warn and update handoff before context risk; do not request repeated dedicated coffee series.

## Previous detailed handoff (historical; current facts above supersede)

# HyperEx 0.1.61 handoff — 2026-10-26

Current source is1.60 plus recoverable target-feedback loss. User authorized relaxing missing-target protection to avoid premature cessation; prior ongoing GitHub upload authorization retained. Current changes do not change S2 learning admission or fake hardware confirmation.

## Current change
- Remove terminal fourth-consecutive-target-miss stop. First3 retries use existing path; fourth and later enter monitoring-degraded-target-feedback.
- Level checks continue. SAME unresolved target retries only at least3000ms after its last dispatch. One pending request, ACK required, no unconfirmed quantum accumulation.
- Exact fresh observed machine frame/target resets miss streak and monitoring status; normal control then needs the existing source/time/pressure gates. Reset no budgets.
- Every send including retries now requires a new source-scale endpoint compared with the last send. Fresh data, valid regression, same frame and output direction remain mandatory. Inside target band sends nothing; reversed error holds.
- Frame transition discards previous frame retry before another send. Check/write caps unchanged:2000 checks, L3 200writes; retries consume write cap. Missing ACK/transport/pressure/global brew protection unchanged.
- Diagnostics explicitly labels recoverable policy and slower retry after3 misses. Report fields feedbackPolicy=recoverable-same-target-retry,degradedRetryIntervalMs=3000.
-219/219 Node simulations pass plus node syntax and generated script compilation in the suite. New cases cover12 consecutive missing responses,3s cooldown while checks continue,late recovery,reversed direction,stale telemetry,write cap,new frame,new scale endpoint and check cap. These are synthetic; no1.61 hardware test yet. Browser visual rendering unavailable.

## Latest 1.60 hardware evidence (screenshots only)
Four distinct screenshots visible out of user's stated5. No original RAW trace; do not invent missing fifth content.
Run1792973999887-1: L3 250ms,target-feedback-missing-4-consecutive,153/2000checks,17/200writes,17ACK,10target responses,7misses/streak4,retries4. Exact cause of trim stop is old target policy, not budgets/skipStep.
S2 overall2.974g/s(-40.5%),R².94991,12s; tail60% mean3.73(-25.41%),CV10.35%,overshoot0%. Found2.84s usable learning windows but admission fails. Current reason conflates2.4s minimum,25% temporal coverage and60% cohort-duration check. Screenshot alone cannot identify which additional gate failed. Source fallback runs only when fixed total<2.4s; coverage rejection after that is a follow-up design issue. Do not claim resolved in1.61.
S3 actual overall1.472g/s(-1.9%),R².99897,35.79s; tail1.423(-5.14%),CV6.84%,overshoot7.93%.27.46s across3confirmed regions admitted to learning,normalized overall1.412,ratio.755STABLE; waiting for matching second cup. Actual quarter ratio.798. Normalized response and actual measured cup output differ by design; label honestly.
S1 startup1.384 vs previous1.074,mean1.229,variation25.2%,hold same .778 command. Original LUT untouched.

## Release
ZIP HyperExPulseFilter_v0161_fresh.zip, root decenthyperexplugin.reaplugin/. LICENSE/calibration JSON byte-identical to1.60. Do not overwrite old delivered ZIPs. README current; tests/verify_v0161.cjs and RESULTS_v0161.txt are the current validation. GitHub commit hash recorded in conversation after upload. Preserve all old remote files via base tree and expected-head protection.

## Earlier detailed handoff (historical; current facts above supersede)

# HyperEx1.60 handoff ·2026-10-26 Asia/Shanghai

Current source based on GitHub1.59 commit52d1934fa4d38b5cf0fcfb76124316115a37ef0b. Read current README.md/tests/RESULTS_v0160.txt. Package frozen before GitHub synchronization; final release commit records completion. Prior ZIPs immutable.211/211 simulated checks; no1.60 hardware validation. Browser rendering unavailable (no Chromium).

## User requirements

S2 remains MISS without numeric adjustment. User wants relaxed evidence admission because live-control output is trustworthy, narrower live±2%/next-shot±8%, no fixed2s pause after successful feedback, and ordinary users should get analysis within the plugin rather than repeatedly sending screenshots/CSV. User notes hydraulic inertia could smooth discrete switching; model estimates are NOT measured machine latency. Fixed-frequency open-loop dithering was not requested/implemented. Keep high-frequency checks and feedback-gated corrections, not mandatory writes each sample.

##1.59 device observations

User screenshots:11saved/5compatible/5empty-or-upgrade references; coffee context and shaped seed restored. Starting S1.778,S2 2.507,S3.698×8s→.720×14s→.778. Live level3,250ms,shot-finished,checks203/2000,writes15/200,ACK15,target responses9,misses5/streak1,retries3. Thus budget no longer stops at200 and feedback tolerance operates across shot. Raw end94.9g,completed cumulative101.90g,576combined/869RAW. No exact cause assigned to raw/cumulative difference.

Clear final photo: S1first-rise10.29s,20–80%1.074g/s,R².97033,transit2.18s,22samples,active3.73s,MEDIUM; pending same-command consensus. S3actual quarters1.520/1.460/1.531g/s,late/early1.007 STABLE,no stall;frame regressions1.641/1.414/1.472 at nominalseed.698/.720/.778. S2 and S3 numeric evidence absent (—,INSUFFICIENT), not unapplied suggestions. Original1.59 learning path used only final write's confirmed command+2s settle+≥5s stable data, conflicting with frequent correction in short S2. Original exported trace not supplied, so precise failed gate for that device cup is not proven.

##1.60 implementation

- New controlLearningAssessment uses actual observed target/frame/pressure/flow against bounded initial/written command catalogue. All good constant epochs can contribute; short-window pooling or dynamic target-exposure normalization handles rapid correction. Original RAW untouched. Phase evidence is normalized to starting seed using a labelled local proportional model, so output after live trim is never falsely assigned directly to starting command.
- Constant windows750ms settling,≥1.2s/6unique/R².90; S2≥2.4s total, S3≥1.2/frame and5s total,≥25% region temporal coverage, robust cohort within25% median containing≥60% candidate-window duration. Dynamic fallback integrates observed targets over source-scale intervals; RAW and model fits both≥.90. No unsupported fixed latency or exact gain claim.
- Actual dynamic actuator coverage/pressure gates replace shot-start-command assumptions for corrected stages. Still≥80% fresh/4 samples,20% pressure-limit and25% actuator-under-command gates. Missing target attribution yields explicit reason; RAW outcome can still be reviewed. Known S3 stall withholds normalized evidence. Two-cup matching and bounded correction retained; compatible profile-frame vs normalized-frame evidence can match, incompatible quarter/frame bases remain isolated.
- Next-shot tolerances8% (S1/S2 and ordinary S3 LEVEL); live2%. Empty qualification/calibration search thresholds remain separate. Quantum1/16 unchanged;2% not guaranteed. No forced dither/static one-quantum veto.
- Both ACK and matching target can release pending wait after50ms; next level tick and new source endpoint required. Missing-response fault timeout stays max(2s,2periods),three-miss tolerance/fourth stop,missing-ACK Idle abort. No accumulating unconfirmed commands. Per-frame±20%,write/check budgets and original protections unchanged.
- controlRunReview rendered directly in diagnostics: RAW goal tracking/smoothness,phase-wide vs final60% metrics,learning reasons,action-group before/after error changes.3s grouping and clean pre/post windows; insufficient overlap labelled, no per-write causal claims. Good-output labels are heuristics(abs tail error≤8%,CV≤10%),not standards. Exports optional for exceptions; no routine screenshot/CSV requirement. Diagnostic learning values clearly distinguished from actual RAW.

## Validation and next work

211/211 Node tests, generated scripts compile, ZIP/source comparisons. Tests include late-unconfirmed yet earlier-valid S2, bounded next-shot application,3S3frames,rapid commands/dynamic fallback,pressure/coverage/raw integrity,±2/8%,fast release requiring BOTH feedbacks/new scale/min50ms,missing-response fault behavior,and self-review grouping. Fixtures synthetic,not true user replay. New model/time gates require hardware observation through ordinary coffees, not extra dedicated tests. Do not call a flat curve proof of every isolated action's physical response. No promise of perfect automatic diagnosis.

User previously asked early conversation-length warning/handoff; this conversation is long. Current handoff carries state. Keep historical LUT and all records; no reclassification/deletion or extra calibration. Native GHC confirmation preserved. Latest GitHub synchronization is authorized in this session; preserve LICENSE/history and use expected-head ref update. Commit submitter OpenAI Codex(GPT-6).

Historical handoff follows; older budget/temperature/exact-last-window statements are superseded by current section.

# HyperEx1.59 handoff ·2026-10-26 Asia/Shanghai

Read current README.md and tests/RESULTS_v0159.txt. User explicitly requested final update uploaded to GitHub ladiosupp/decenthyperexplugin, with submitter/model in commit. Baseline remote main15d8bc0dac78762720475c6bdba10c980dee9e56 (1.54). Package finalized before upload; completion SHA is in release commit/final response. Preserve root LICENSE and all historical files. Earlier ZIPs immutable.

## Latest scope implemented

- All live levels maxChecks2000; maxWrites50/150/200/250 by levels1–4. Cadences remain original(default944)/300/250/200ms. Actual retries consume writes. Keep response waits,quality/pressure/bounds,one pending write,3missing-target tolerance,missing-ACK abort,profile restoration and normal learning. No automatic enable.2000 is plugin software cap, not firmware/Decaid maximum. Max-run and natural termination still end the shot sooner.
- New numericLearningFingerprintKey strips only shotSettings.temperature for trusted completed run/history restore/previous-evidence matching. Stored full fingerprints retain temperature; exact storage validation/audit/profile equivalence are not weakened. Cross-temperature records can form numeric consensus under all original quality/pressure/command/variability/bounds checks. Basket context,physical LUT,targets,multiplier,other settings still match.
-1.58 home-temperature adoption and qualification/seed-preservation remain. Temperature default setting only seeds new profiles; existing profile/home value authoritative. No separate temperature store. No resetting empty qualification for routine temperature adjustment. Keep original LUT/history.

190/190 simulated checks pass, generated HTML scripts compile. New cases: >200checks continues,2000 cap,all independent write caps;92°C prior plus94°C new forms consensus and applies bounded correction with LUT unchanged; old-temperature metadata preserved;other-context bindings and pressure gates still reject evidence. Browser visual rendering unavailable (Chromium missing). No1.59 hardware evidence.

Potential S3 issue remains: unresolved target whose cup error reverses is held rather than blindly accumulated. Need existing JSON trace to determine if1.57 entered unconfirmed-target-direction-changed. Do not guess skipStep root cause or request additional dedicated coffee tests.1.57 budget exhausted at200, not necessarily this hold. Existing three missing-target allowance unchanged.

Prior engineering/hardware handoff follows as historical evidence; any older temperature exclusion,version/test count or budget statements are superseded above.

# HyperEx1.58 handoff ·2026-10-26 Asia/Shanghai

Read current README.md and tests/RESULTS_v0158.txt.1.58 is based on delivered1.57, no1.58 hardware validation and not uploaded GitHub. Current count185/185 simulation checks; older counts/policies below are historical. Latest verified GitHub1.54 commit15d8bc0dac78762720475c6bdba10c980dee9e56. Prior delivered ZIPs immutable.

## New user report and1.57 evidence

Home brew-temperature increase is overwritten to92°C. User then supplied1.57 test, explicitly corrected version from1.56 to1.57 and said this cup was94°C. Screenshots: level3,250ms,200-check-budget-complete,checks200/200,writes8,ACK8,target confirmations5,target misses3/streak3(tolerate3),retries2. Thus tolerance worked and checks continued through S3 to budget; not a first-miss stop. No raw export yet.

Shot-start .719/2.507/.569 flat AUTO/LUT. Source says basket context changed; previous overrides ignored; using LUT baseline. UI says EMPTY BASELINE,1/3 and1baseline reference; do NOT ask user to restart empty calibration. Prior1.55 had9saved/4compatible and coffee state with appliedS1.778 and shapedS3.698/.720/.778. A simulation on exact1.57 reproduces92→94 causing NORMAL COFFEE→EMPTY BASELINE and invalid coffee seed despite retained history. This is strong code-path evidence matching screenshots, not proof there were no other concurrent setting/storage changes.

S2RAW3.141g/s vs5(-37.2%),R².97356,window11.9s. S3RAW1.110 vs1.5(-26%),R².99545,46.41s; late/early.639 LATE DECAY,EARLY1.466/MID1.105/LATE.937,no stall. S1wholeRAW.311,R².42858,10.87s; startup20–80%1.603g/s,R².92931,transit1.2s,11samples,MEDIUM;first-rise.13s may involve initial noise, do not use whole-S1 deficit as command correction. Completed101.20g,RAW94.3g,620combined/935raw. Do not invent cause of cumulative/RAW difference.

User asks whether cup-to-cup learning is diverging and whether S3 stops due skipStep. Distinguish: starting trajectory changed, so not a controlled comparison of cadence/bypass. Final status is budget exhausted, not skipStep stop.3missing targets and2retries may leave unresolved-target error reversal hold; source1.57 holds when direction flips. This branch is unchanged in1.58. Need existing JSON trace to establish frame/command/target/check reasons; no extra dedicated coffee run requested.

##1.58 implementation

- Fresh selected workflow GET moved before expected-profile creation/upsert. Uniform valid70–100°C selected HyperEx stage temperature is adopted; all other flow/pressure/timing validation and normal profile repair remain.
- Notification temperature adoption while idle increments context revision to invalidate old in-flight sync; deferred fresh verification handles races. Do not adopt active-shot temperature into the frozen run or live A010 profile.
- Workflow itself persists home temperature across reload; no second KV temperature or self-reloading settings POST. Native Temperature setting renamed INITIAL DEFAULT for new curves. Advanced field is effective-temperature readout directing home adjustment, removed from settings save map.
- New qualificationFingerprintKey ignores basket-context and temperature only for qualification/baseline references. Routine temperature adjustment retains coffee context, empty qualification, original LUT/history and bounded command seed. Physical LUT/targets/other-settings changes still invalidate unrelated qualification.
- Numeric learning/trusted-run fingerprints still include temperature: old-temperature evidence stored but incompatible for current numeric consensus. No relabelling/deleting old records.1.57 bypass logic unchanged.

185/185 Node checks pass, generated scripts compile. Tests cover temperature reload, shaped frames, other-field repair,bounds,active-shot freeze,LUT/seed preservation,coffee qualification vs full numeric fingerprint,baseline refs,in-flightGET race, and all prior bypass/startup/slider checks. Browser rendering unavailable because no Chromium. Hardware feedback pending.

Previous handoff follows for historical details, superseded by this section.

# HyperEx1.57 handoff ·2026-10-26 Asia/Shanghai

Read README.md and tests/RESULTS_v0157.txt first.1.57 is based on delivered1.56; not uploaded GitHub and no1.57 hardware validation. Prior released ZIPs immutable. Current simulation count175/175; older counts below are historical.

## New1.55 hardware evidence from five screenshots

Level2:300ms,checks53/150,writes6/150,driver ACK6,target responses5,stopped driver-ack-but-no-machine-target-response. Confirms higher cadence setting active but still early stop on final missing target. No raw exported trace supplied; do not claim transition root cause.

S1 wholeRAW.187g/s,R².45382,11.8s. Startup first rise9.16s,20–80%1.410g/s,R².988,transit1.55s,16samples,active2.91s,MEDIUM; do not use wholeRAW deficit for startup command. Two startup evidence values1.418→1.410,mean1.414,var.6%,HIGH consensus. This shot started S1.748ml/s; next-shot actual workflow .778ml/s,applied+verified+machine upload acknowledged. This is actual automatic application evidence, not just proposal. Native MANUAL TEST label is an existing override representation, not proof user manually made this adjustment.

S2RAW3.282 vs5g/s(-34.4%),R².9837,10.93s. Main white-flow curve has slow ramp AND platform around3.7–3.9g/s, lower than prior roughly4.5; cannot attribute all deficit to ramp. S3RAW1.447 vs1.5(-3.5%),R².99959,36.17s,HIT,late/early.886 STABLE,no stall. Quarters1.653/1.423/1.465; timed-frame regressions1.759/1.406/1.454. S2/S3 next-shot REPEAT/INSUFFICIENT; exact failed gate needs exported trace. History9saved,4compatible,4empty/pre-upgrade baseline refs retained. Completed cumulative101.50g vsRAW94.2g; retain difference without inventing cause.

## User-authorized change

User requested tolerating e.g.3 missing targets instead of stopping on first, or sending each sample. Implemented limited tolerance, NOT unchecked sample-rate actuation:
- Acknowledged write without matching target after max(2s,2periods) increments total/streak; first3 tolerated, fourth stops live trim, normal brew continues.
- Matching target resets consecutive streak. Missing driver ACK still aborts with Idle.
- Unconfirmed write does not advance known command. Same-frame retries repeat exactly the same target, only with fresh regression/pressure/actuator/bounds checks. No quantum accumulation before target confirmation.
- Error enters band -> hold; reverses -> hold unresolved target. Late target during retry hold can confirm. New frame drops old-frame retry; normal new-frame checks continue. Retries consume budget; final-budget watchdog remains.
- UI/JSON/CSV counters include total/streak/retries and timeout/bypass/write events. Normal next-shot learning remains; unconfirmed corrected-frame windows ineligible. Raw LUT never rewritten.

175/175 Node tests pass including all retained control/profile/history/UI tests plus first3/fourthstop,same-payload retry,no blind commands,success reset,late target,pressure/stale/error reversal,frame transition,budget cap and missing-ACK abort. Generated scripts compile. Browser visual QA unavailable: no Chromium. No new dedicated coffee tests requested; use existing logs/normal consumed coffees.1.56 changes were slider only;1.57 changes tolerance and command bookkeeping.

Previous1.56/1.55 handoff follows; those statements describe their versions, especially prior stop-on-first policy, now superseded.

# HyperEx1.56 handoff ·2026-10-26 Asia/Shanghai

Based on delivered1.55. User requested slider instead of typing trim level. Advanced Settings now has range min1 max4 step1 plus live Chinese label displaying cadence/budget; native Plugins settings changed number to enum strings1–4 because host only supports standard widgets, no slider. Old numeric level is still accepted by loadConfig; diagnostics reads effective numeric level and saves the corresponding enum string. Selection does not enable live trim and dragging alone does not save/reload. Existing save button applies through shared settings.

168/168 Node checks pass, including final generated scripts compiling and DOM-stub settings load/label/save test. No browser visual rendering (Chromium unavailable) or1.56 hardware validation. No control/startup/safety changes vs1.55; prior default-OFF and original GHC guards remain.1.56 not uploaded GitHub. Prior ZIPs remain immutable.

Video subsequently supplied: mmexport1792968517491.mp4, official attachment libfile_70d2fd7d88608191a476f536d0f09401. Approx33s screen confirm,37s physical GHC touch,38s UI switches cancel-wait to pause,55s still preheating,55.5–56s blue/green lights and output-counting UI,60s accumulated weight begins to rise. Supports physical confirmation followed by preparation delay. Pink light alone cannot classify awaiting-confirmation; do not derive exact machine substates/pump timing from video. This is flow-calibration startup, not proof of HyperEx restart timing. New20s cup-gain watchdog removal remains warranted as avoiding false timeouts.

Earlier1.55 handoff follows for retained engineering evidence; its version/test/upload statements describe that earlier release.

# HyperEx1.55 handoff ·2026-10-26 Asia/Shanghai

Read README.md and tests/RESULTS_v0155.txt. Baseline1.54 is uploaded at15d8bc0dac78762720475c6bdba10c980dee9e56.1.55 not uploaded; no1.55 hardware evidence. Delivered ZIPs immutable. Earlier HANDOFF_v0154.md is historical and its not-uploaded statement is stale.

## Latest user requests and evidence

Remove new20s cup-weight startup insurance; keep original safeguards. Four levels: current,300ms/150,250ms,calculate upper tier. User reports startup failed, physical GHC still required, cup flow flatter. Clear screenshot: checks17/50,writes4/50,ACK4,target responses3,interval944ms,stopped driver-ack-but-no-machine-target-response. Do not claim sustained S3 closed loop or fourth-write root cause. New diagnostic event makes future frame/target mismatch inspectable; stop policy unchanged.

S2 RAW3.611 vs5g/s(-27.8%),R².97547,10.09s. S3 RAW1.542 vs1.5(+2.8%),R².99927,32.38s,late/early.885 STABLE,no stall; quarters1.767/1.530/1.564. S1 first rise4.63s,20–80%1.418g/s,R².9828,transit1.52s,15samples,active2.82s,MEDIUM. Whole S1.451 includes onset delay. Shot-start S3 commands .698/.720/.778 are snapshots.

Additional chart: white cup flow starts around3s, reaches roughly4.5g/s around8s, transition near12s; visual estimates, not source regression. User correctly notes S2 slow ramp. Separate onset/ramp/plateau analysis is future work, NOT implemented; do not boost steady commands by whole-stage27.8%.

## Startup investigation

Official Decaid commit f2248a756f80639c5f96e1fbdd4c426c956fbca4:
- doc/device-notes/de1.md#group-head-controller-start-restriction explicitly describes firmware GHC physical-start restriction.
- de1handler.dart REST -> controller.requestMachineState -> UnifiedDe1.requestState -> Endpoint.requestedState(A002), espresso04.
- unified_de1.raw.dart uses same transport.writeWithResponse for raw writes.
- de1.models.dart stateInfo A00E is a separate notification path; receiving a state change is not an exposed writable button.
- Official de1app machine.tcl ghc_message/start_espresso reinforces physical confirmation and UL limit. No supported writable GHC press endpoint was found in inspected code; firmware internals not inspected. Do not assert impossible in all firmware, or spoof interlock/GHC flags.

Added code restores original GHC timeout/retries after REST even when startup switch enabled; GHC/unknown skips raw; no-GHC DE1 may retain legacy raw.5s optional setup cleanup is transport-only, no Idle. New20s sustained-weight observer removed entirely. Manual rearm/pour/cancel invalidate late raw work. Existing other safety code unchanged.

## Controller changes and limits

Four levels in README. Fourth200ms/250 is chosen experimental software ceiling, not proven machine maximum. Default47.2s supports157/188/236 fixed-period ticks; level2 capped150. Underlying scale sampling unchanged. Keep ≥2s write response spacing, regression quality and bounds; opportunities are not executed writes. Finite hardware max requires scale/ACK/target/cup-response latency measurements unavailable here.

LUT, seed, history, normal next-shot learning/stable-command evidence and idle full-profile restoration retained. Corrected-frame evidence cannot be attributed to starting command. Final-budget pending write remains monitored before stop; no51st/151st/etc check.

## Verification and next work

167/167 updated Node simulations pass (different test set from1.54's167): retained learning/profile/pressure/data tests, all levels, frozen settings, bounds, feedback waiting, budget caps/final-write timeout, startup guards/cancellation, generated browser-script compile. Browser visual rendering not run: installed Playwright lacks Chromium executable. No claim of new hardware validation.

Keep user's4empty baselines and filled-basket acceptance already used on1.52. Observe ordinary consumed coffees only; no repeat calibration/dedicated coffee campaign. Low Water/CLOSE-HOME remain separate. Warn before context grows too long, not fake precise token tracking. Upload1.55 to GitHub only if user requests. Preserve LICENSE. Use real file IDs for Android downloads.
