// ProfileReplayer App：归档存 IndexedDB，取数三路（URL 抓取 / 自动抓取 / 本地文件），
// 合并用 archive-core.js（与 PC 归档同口径）。回放引擎移植自 sim/public/replay.js。
const $ = (id) => document.getElementById(id);
const PHASE_LABEL = { stage1: 'S1', stage2: 'S2', stage3: 'S3', dumping: '泄压', soak: '浸泡', restart_wait: '等 GHC', finishing: '收尾', idle: 'IDLE', aborted: '中止' };
const PHASE_PILL = { stage1: ['#20304d', '#9cc0ff'], stage2: ['#3d2c17', '#f5c078'], stage3: ['#173a2a', '#8fe0b0'], dumping: ['#3d1d22', '#f2a0aa'], soak: ['#322040', '#d5a8f5'], restart_wait: ['#2a2f37', '#cfd5de'], finishing: ['#2a2f37', '#cfd5de'], idle: ['#2a2f37', '#cfd5de'], aborted: ['#3d1d22', '#f2a0aa'] };
const STAGE_COLOR = { stage1: 'rgba(110,168,254,.10)', stage2: 'rgba(245,164,66,.10)', stage3: 'rgba(99,216,155,.10)', dumping: 'rgba(242,144,154,.08)', soak: 'rgba(199,125,255,.08)', restart_wait: 'rgba(139,147,161,.08)', finishing: 'rgba(139,147,161,.06)', aborted: 'rgba(242,144,154,.12)' };
// 归档不设杯数上限：体积由 150MB 门槛管（到点提示压缩备份/清理）。
// 200 杯 × 平均 367KB ≈ 74MB，旧上限会让体积门槛永远到不了。
const MAX_SHOTS = 0;
const ARCHIVE_WARN_BYTES = 150 * 1024 * 1024;
const RECORDER_PATH = '/api/v1/plugins/profilerecorder.reaplugin/history-export';

// ---- 中英文 ----
let lang = 'zh';
const EN = {
  'ProfileReplayer': 'ProfileReplayer', '数据源 · Decaid 地址': 'Source · Decaid URL', '抓取并合并': 'Fetch & merge',
  '自动抓取': 'Auto fetch', '间隔': 'Interval', '30 秒': '30 s', '1 分钟': '1 min', '2 分钟': '2 min', '5 分钟': '5 min', '10 分钟': '10 min',
  '默认 2 分钟抓一次，赶在插件裁剪全点（最新 4 杯）之前补全；装 APK 后后台也照抓。': 'Fetches every 2 min by default, before the plugin trims full data (latest 4 shots). Keeps fetching in background with the APK.',
  '本地导入': 'Local import', '选择已下载的 JSON': 'Pick downloaded JSON',
  '兼容浏览器下载到 Download 的 hyperex-history.json，也兼容归档文件。': 'Accepts hyperex-history.json downloaded to Download, and archive files.',
  '归档': 'Archive', '导出归档 JSON': 'Export archive JSON', '清空归档': 'Clear archive', '选择杯': 'Shot', '循环': 'Loop',
  '杯流 (g/s)': 'Cup flow (g/s)', '秤重 (g)': 'Weight (g)', '压力 (bar) · 流量 (ml/s)': 'Pressure (bar) · Flow (ml/s)',
  '顺放 ▶': 'Play ▶', '◀ 倒放': '◀ Rev', '暂停 ⏸': 'Pause ⏸',
  '时刻': 'Time', '相位': 'Phase', '秤重': 'Weight', 'decaid 杯流': 'decaid flow', '压力': 'Pressure', '机器流量': 'Machine flow',
  '帧': 'frame', '逻辑帧': 'logic', '物理帧': 'phys', '插件累计': 'plugin cum.', '目标': 'target', '本杯': 'This shot',
  '无逐帧数据': 'No frame data', '条事件/轨迹在下方，点击行看详情。': 'events/trace below; tap a row for details.',
  'S1': 'S1', 'S2': 'S2', 'S3': 'S3', '泄压': 'Release', '浸泡': 'Soak', '等 GHC': 'GHC wait', '收尾': 'Finish', 'IDLE': 'IDLE', '中止': 'Abort',
  'decaid 杯流': 'decaid flow', 'RAW dW/dt': 'RAW dW/dt', '插件累计': 'plugin cum.', '机器流量': 'machine flow', '目标指令': 'target cmd', '▲ 写入': '▲ write',
  '无帧数据（仅事件/轨迹）': 'No frames (events/trace only)', '调流·': 'trim·', '调流轨迹': 'trim trace', '事件': 'event', '名称': 'Name',
  '载入中…': 'Loading…', '空': 'empty', '杯': 'shots', '杯有全点': 'with full data', '更新': 'updated',
  '帧': 'frames', '采样': 'samples', '结果': 'Result', '插件': 'plugin',
  '失败：请填 Decaid 导出地址': 'Failed: enter the Decaid export URL', '抓取中…': 'Fetching…',
  '自动抓取失败：': 'Auto fetch failed: ', '失败：': 'Failed: ', '新增': 'new', '补全': 'backfilled',
  '就绪': 'Ready', '归档为空，先抓取或导入': 'archive empty; fetch or import first',
  '读取': 'Reading', '导入': 'Imported', '归档已清空': 'Archive cleared',
  '清空本机归档？（不影响插件与 Decaid 上的数据）': 'Clear the local archive? (Plugin and Decaid data are untouched.)',
  '后台抓取已合并 · 新增': 'Background fetch merged · new', '初始化失败：': 'Init failed: ',
  '每': 'Every', '抓一次，赶在插件裁剪全点（最新 4 杯）之前补全。': 'fetch, before the plugin trims full data (latest 4 shots).',
  'tare/reset': 'tare/reset',
  'recorder 未装': 'recorder not installed', '压缩备份并分享': 'Compress & share', '清理最旧一半': 'Trim oldest half',
  '归档已达': 'Archive reached', '，建议压缩备份后清理。': '; compress a backup, then trim.',
  '压缩中…': 'Compressing…', '已导出': 'Exported', '已清理最旧': 'Trimmed oldest', '杯': 'shots',
  '分享不可用（浏览器环境请用导出）': 'Share unavailable (use export in browser)',
  '后台抓取未在白名单': 'Background fetch not whitelisted',
  '可能被系统杀掉，后台抓取会停。': 'may be killed by the system; background fetch will stop.',
  '去设置白名单': 'Open whitelist settings',
  '后台已攒': 'Background buffered',
  '杯 · 上次抓取': 'shots · last fetch',
  '从未': 'never',
  '完成': 'completed', '中止': 'aborted',
  '检测到': 'Detected', '支插件未安装': 'plugin(s) not installed',
  '两支都装上，才能记全每一杯曲线。': 'Install both plugins to capture every shot curve.',
  '已安装': 'Installed', '未安装': 'Not installed', '未检测到': 'Not detected',
  '记录 HyperEx 控制的萃取杯': 'Records HyperEx-controlled shots',
  '记录其余曲线（非 HyperEx 杯）': 'Records all other curves (non-HyperEx shots)',
  '去 GitHub 安装': 'Install from GitHub',
  '稍后': 'Later', '重新检测': 'Re-check', '检测中…': 'Checking…',
  '插件检测失败：无法连接 Decaid': 'Plugin check failed: cannot reach Decaid',
};
function t(s) { return lang === 'en' && EN[s] != null ? EN[s] : s; }
function applyLang() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  updatePlayButtons();
  if (cup) { renderCupInfo(); buildLog(); buildCharts(); paint(); }
  renderArchiveInfo();
  rebuildCupListLabels();
  refreshAutoNote();
  renderStatus();
}

// ---- IndexedDB ----
let db = null;
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hx-replay', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('kv'); };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}
function dbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly').objectStore('kv').get(key);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}
function dbSet(key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let archive = null;
let cups = [];
let cup = null;
let frames = [], frameTimes = [], logTimes = [], isRaw = true;
let idx = 0, playing = 0, speed = 1, lastTick = 0, rafId = 0, acc = 0;
let chartsReady = false, chartGeo = [], chartBase = [], sampleTimes = [], logRows = [], lastLogHi = -1;
let autoTimer = 0;

const fmtT = (ms) => (ms / 1000).toFixed(2) + 's';
const num = (v, d) => (v == null || !Number.isFinite(Number(v))) ? (d == null ? '—' : d) : Number(v);
const f2 = (v) => Number.isFinite(v) ? v.toFixed(2) : '—';
const f3 = (v) => Number.isFinite(v) ? v.toFixed(3) : '—';
let lastStatus = null;
function setStatus(msg, busy) { lastStatus = { fn: typeof msg === 'function' ? msg : () => msg, busy: !!busy }; renderStatus(); }
function renderStatus() { if (!lastStatus) return; $('status').textContent = lastStatus.fn(); $('status').classList.toggle('busy', lastStatus.busy); }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// 选杯列表标签：时间 · 曲线标题 · 状态。HyperEx 杯统一 "HyperEx Pulse Filter (mode)"，
// mode 取 releaseMode（auto/on/off），老数据没有该字段就按标题的 auto 后缀认，再老默认 on；
// recorder 杯（runId pr- 前缀）显示它记录的真实曲线名 profileTitle。
function cupTitle(s) {
  if (String(s.runId || '').startsWith('pr-')) return s.profileTitle || 'Profile Recorder';
  const mode = s.releaseMode || (/ auto$/i.test(String((s.workflowProfileCommands || {}).title || '')) ? 'auto' : 'on');
  return 'HyperEx Pulse Filter (' + mode + ')';
}
function cupStatusLabel(result) {
  const r = String(result || '');
  if (/aborted|abort/i.test(r)) return t('中止');
  if (/completed/i.test(r)) return t('完成');
  return r;
}
function cupOptionLabel(c) {
  const d = new Date(c.startedAt);
  const when = Number.isFinite(d.getTime()) ? (d.getMonth() + 1) + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '';
  const parts = [when, c.title, cupStatusLabel(c.result)].filter(Boolean);
  return escapeHtml(parts.join(' · '));
}

// ---- 归档与取数 ----
async function saveArchive() { await dbSet('archive', archive); renderArchiveInfo(); }
function renderArchiveInfo() {
  if (!archive) { $('archiveInfo').textContent = t('空'); return; }
  let line = archive.count + ' ' + t('杯') + ' · ' + archive.fullRecordCount + ' ' + t('杯有全点') + ' · ' + t('更新') + ' ' + (archive.updatedAt || '').replace('T', ' ').slice(0, 19);
  if (window.HxBridge && window.HxBridge.fetchStatus) {
    try {
      const fs = JSON.parse(window.HxBridge.fetchStatus());
      const when = fs.lastFetchAt ? new Date(fs.lastFetchAt).toLocaleString() : t('从未');
      line += '\n' + t('后台已攒') + ' ' + fs.bufferCups + ' ' + t('杯 · 上次抓取') + ' ' + when;
    } catch (e) {}
  }
  $('archiveInfo').textContent = line;
}
async function mergeIncoming(json, label) {
  const res = HxArchive.merge(archive || HxArchive.emptyArchive(), json, MAX_SHOTS);
  archive = res.archive;
  await saveArchive();
  rebuildCupList();
  return res.stats;
}
async function fetchUrl(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function doFetch(silent) {
  const url = $('srcUrl').value.trim();
  if (!url) { if (!silent) setStatus(() => t('失败：请填 Decaid 导出地址')); return; }
  if (!silent) setStatus(() => t('抓取中…'), true);
  try {
    const json = await fetchUrl(url);
    const st = await mergeIncoming(json, url);
    await dbSet('srcUrl', url);
    const rec = await fetchRecorder(url, silent);
    setStatus(() => (silent ? t('自动抓取') + ' · ' : '') + t('新增') + ' ' + (st.newShots + rec.newShots) + ' ' + t('杯') + ' · ' + t('补全') + ' ' + (st.fullUpdated + rec.fullUpdated) + ' ' + t('杯') + (rec.note ? ' · ' + rec.note : ''));
    await checkArchiveSize();
  } catch (e) {
    setStatus(() => (silent ? t('自动抓取失败：') : t('失败：')) + (e.message || e));
  }
}
// recorder 导出地址由 HyperEx 导出地址推导（同机同端口）；404 = 未装，静默跳过。
function recorderUrl(url) {
  try { return new URL(RECORDER_PATH, url).href; } catch (_) { return null; }
}
async function fetchRecorder(url, silent) {
  const recUrl = recorderUrl(url);
  if (!recUrl || recUrl === url) return { newShots: 0, fullUpdated: 0, note: '' };
  try {
    const json = await fetchUrl(recUrl);
    const st = await mergeIncoming(json, recUrl);
    return { newShots: st.newShots, fullUpdated: st.fullUpdated, note: '' };
  } catch (e) {
    return { newShots: 0, fullUpdated: 0, note: /404/.test(String(e && e.message)) ? t('recorder 未装') : '' };
  }
}
// ---- 体积门槛：150MB 提示压缩备份 / 清理 ----
let sizeWarned = false;
function archiveBytes() {
  try { return new Blob([JSON.stringify(archive)]).size; } catch (_) { return 0; }
}
async function checkArchiveSize() {
  if (!archive || sizeWarned) return;
  const bytes = archiveBytes();
  if (bytes < ARCHIVE_WARN_BYTES) return;
  sizeWarned = true;
  const mb = (bytes / 1048576).toFixed(0);
  const doCompress = confirm(t('归档已达') + ' ' + mb + 'MB' + t('，建议压缩备份后清理。') + '\n\n[OK] ' + t('压缩备份并分享') + '\n[Cancel] ' + t('清理最旧一半'));
  if (doCompress) await compressAndShare();
  else await trimOldestHalf();
}
async function trimOldestHalf() {
  if (!archive || !archive.shots.length) return;
  const keep = Math.ceil(archive.shots.length / 2);
  archive.shots = archive.shots.slice(-keep);
  archive.count = archive.shots.length;
  archive.fullRecordCount = archive.shots.filter(s => s.fullRecord && ((s.fullRecord.samples || []).length || (s.fullRecord.rawScaleSamples || []).length)).length;
  archive.updatedAt = new Date().toISOString();
  await saveArchive();
  rebuildCupList();
  sizeWarned = false;
  setStatus(() => t('已清理最旧') + ' · ' + t('归档') + ' ' + archive.count + ' ' + t('杯'));
}
async function gzipBytes(str) {
  const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
async function compressAndShare() {
  if (!archive) return;
  setStatus(() => t('压缩中…'), true);
  try {
    const gz = await gzipBytes(JSON.stringify(archive));
    const name = 'hyperex-history-all-' + new Date().toISOString().slice(0, 10) + '.json.gz';
    if (window.HxBridge && window.HxBridge.shareFile) {
      window.HxBridge.shareFile(name, 'application/gzip', bytesToBase64(gz));
      setStatus(() => t('已导出') + ' ' + name + ' · ' + (gz.length / 1048576).toFixed(1) + 'MB');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([gz], { type: 'application/gzip' }));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setStatus(() => t('已导出') + ' ' + name);
    }
  } catch (e) {
    setStatus(() => t('失败：') + (e.message || e));
  }
}
function startAuto() {
  stopAuto();
  const sec = Math.max(5, Number($('autoSec').value) || 30);
  autoTimer = setInterval(() => doFetch(true), sec * 1000);
  refreshAutoNote();
  if (window.HxBridge) window.HxBridge.setAutoFetch($('srcUrl').value.trim(), sec);
}
function stopAuto() { if (autoTimer) clearInterval(autoTimer); autoTimer = 0; if (window.HxBridge) window.HxBridge.setAutoFetch('', 0); }
function refreshAutoNote() {
  const sec = Math.max(5, Number($('autoSec').value) || 120);
  const label = $('autoSec').selectedOptions[0] ? $('autoSec').selectedOptions[0].textContent : sec + 's';
  $('autoNote').textContent = t('每') + ' ' + label + ' ' + t('抓一次，赶在插件裁剪全点（最新 4 杯）之前补全。');
}

function rebuildCupList() {
  cups = (archive ? archive.shots : []).map((s, i) => {
    const fr = s.fullRecord || {};
    const raw = (fr.rawScaleSamples || []).length;
    const sm = (fr.samples || []).length;
    const ev = (fr.events || []).length;
    const tr = fr.liveFlowTrim && (fr.liveFlowTrim.trace || []).length || 0;
    return { index: i, runId: s.runId, startedAt: s.startedAt, result: s.result, title: cupTitle(s), raw, samples: sm, events: ev, trace: tr, playable: raw + sm > 0 };
  }).filter((c) => c.playable || c.events + c.trace > 0)
    .sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0));
  const sel = $('cup');
  const prev = sel.value;
  sel.innerHTML = cups.map((c) => '<option value="' + c.index + '">' + cupOptionLabel(c) + '</option>').join('');
  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  else if (cups.length) {
    const newestPlayable = cups.find((c) => c.playable);
    sel.value = String((newestPlayable || cups[0]).index);
  }
  if (cups.length) loadCup(Number(sel.value));
  syncCupDrop();
}

function loadCup(index) {
  stop();
  const s = archive.shots[index];
  if (!s) return;
  const fr = s.fullRecord || {};
  cup = s;
  isRaw = (fr.rawScaleSamples || []).length > 0;
  frames = isRaw ? fr.rawScaleSamples : (fr.samples || []);
  frameTimes = frames.map((f) => Number(f.tMs) || 0);
  const events = fr.events || [];
  const trace = fr.liveFlowTrim && fr.liveFlowTrim.trace || [];
  const log = events.filter((e) => trace.length === 0 || e.name !== 'live_flow_trim')
    .map((e) => ({ tMs: Number(e.tMs) || 0, src: 'event', name: e.name || '', phase: e.phase || '', data: e.data }))
    .concat(trace.map((t) => ({ tMs: Number(t.tMs) || 0, src: 'trace', name: t.kind || '', phase: t.phase || '', data: t })))
    .sort((a, b) => a.tMs - b.tMs);
  cup = Object.assign({}, s, { log });
  logTimes = log.map((e) => e.tMs);
  idx = 0; acc = 0;
  $('scrub').disabled = frames.length === 0;
  $('scrub').max = String(Math.max(0, frames.length - 1));
  setTransportEnabled(frames.length > 0);
  renderCupInfo();
  buildLog();
  buildCharts();
  paint();
  setStatus(() => t('就绪') + ' · ' + (isRaw ? frames.length + ' ' + t('帧') : frames.length + ' ' + t('采样')) + ' · ' + log.length + ' ' + t('事件'));
}

// 语言切换后重画杯列表标签（不重载当前杯）
function rebuildCupListLabels() {
  const sel = $('cup');
  const cur = sel.value;
  sel.innerHTML = cups.map((c) => '<option value="' + c.index + '">' + cupOptionLabel(c) + '</option>').join('');
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  syncCupDrop();
}

// ---- 自定义选杯下拉：点外部 / 再点触发都可关闭；带清晰滚动条并定位当前杯 ----
// 底层保留隐藏原生 select（现有 change 逻辑与回归脚本兼容），这里只做展示与交互。
function syncCupDrop() {
  const sel = $('cup');
  const label = $('cupDropLabel');
  const panel = $('cupDropPanel');
  if (!label || !panel) return;
  const cur = sel.value;
  const curOpt = [...sel.options].find((o) => o.value === cur);
  label.textContent = curOpt ? curOpt.textContent : '—';
  panel.innerHTML = cups.map((c) => '<div class="cupdrop-item' + (String(c.index) === cur ? ' sel' : '') + '" role="option" data-index="' + c.index + '" aria-selected="' + (String(c.index) === cur) + '">' + cupOptionLabel(c) + '</div>').join('');
  panel.querySelectorAll('.cupdrop-item').forEach((el) => {
    el.addEventListener('click', () => {
      sel.value = el.dataset.index;
      sel.dispatchEvent(new Event('change'));
      closeCupDrop();
      syncCupDrop();
    });
  });
  if (!$('cupDrop').classList.contains('open')) return;
  const selEl = panel.querySelector('.cupdrop-item.sel');
  if (selEl) selEl.scrollIntoView({ block: 'nearest' });
}
function openCupDrop() {
  const drop = $('cupDrop'), panel = $('cupDropPanel'), btn = $('cupDropBtn');
  syncCupDrop();
  drop.classList.add('open');
  panel.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  const selEl = panel.querySelector('.cupdrop-item.sel');
  if (selEl) selEl.scrollIntoView({ block: 'center' });
}
function closeCupDrop() {
  const drop = $('cupDrop'), panel = $('cupDropPanel'), btn = $('cupDropBtn');
  if (!drop) return;
  drop.classList.remove('open');
  panel.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}
function initCupDrop() {
  const btn = $('cupDropBtn'), drop = $('cupDrop');
  if (!btn || !drop) return;
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (drop.classList.contains('open')) closeCupDrop(); else openCupDrop();
  });
  document.addEventListener('click', (ev) => {
    if (drop.classList.contains('open') && !drop.contains(ev.target)) closeCupDrop();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && drop.classList.contains('open')) closeCupDrop();
  });
}

function renderCupInfo() {
  const c = cup;
  const stageLine = (name, s) => (!s || s.rawRegressionGS == null) ? name + ' —' : name + ' ' + f2(s.rawRegressionGS) + ' g/s (' + t('目标') + ' ' + s.targetGS + ' · ' + (s.status || '') + ')';
  $('cupInfo').innerHTML =
    '<div>runId ' + (c.runId || '—') + '</div>' +
    '<div>' + t('插件') + ' ' + (c.pluginVersion || '—') + ' · ' + (c.startedAt || '') + '</div>' +
    '<div>' + t('结果') + ' ' + (c.result || '—') + '</div>' +
    '<div style="margin-top:6px">' + stageLine('S1', c.s1) + '</div><div>' + stageLine('S2', c.s2) + '</div><div>' + stageLine('S3', c.s3) + '</div>';
}
function setTransportEnabled(on) {
  for (const id of ['btnStart', 'btnPrevEv', 'btnBack10', 'btnBack1', 'btnRev', 'btnPlay', 'btnFwd1', 'btnFwd10', 'btnNextEv', 'btnEnd']) $(id).disabled = !on;
}

// ---- 播放引擎 ----
function play(dir) {
  if (!frames.length) return;
  if (playing === dir) { stop(); return; }
  if (dir > 0 && idx >= frames.length - 1) seek(0);
  if (dir < 0 && idx <= 0) seek(frames.length - 1);
  playing = dir; acc = 0; lastTick = performance.now();
  updatePlayButtons();
  rafId = requestAnimationFrame(tick);
}
function stop() { playing = 0; if (rafId) cancelAnimationFrame(rafId); rafId = 0; updatePlayButtons(); }
function updatePlayButtons() {
  $('btnPlay').textContent = playing === 1 ? t('暂停 ⏸') : t('顺放 ▶');
  $('btnRev').textContent = playing === -1 ? t('暂停 ⏸') : t('◀ 倒放');
  $('btnPlay').classList.toggle('active', playing === 1);
  $('btnRev').classList.toggle('active', playing === -1);
}
function tick(now) {
  if (!playing) return;
  const dt = Math.min(200, now - lastTick); lastTick = now; acc += dt * speed;
  let moved = false;
  if (playing > 0) {
    while (idx < frames.length - 1 && acc >= frameTimes[idx + 1] - frameTimes[idx]) { acc -= frameTimes[idx + 1] - frameTimes[idx]; idx++; moved = true; }
    if (idx >= frames.length - 1) { if ($('loop').checked) { seek(0); acc = 0; } else { stop(); moved = true; } }
  } else {
    while (idx > 0 && acc >= frameTimes[idx] - frameTimes[idx - 1]) { acc -= frameTimes[idx] - frameTimes[idx - 1]; idx--; moved = true; }
    if (idx <= 0) { if ($('loop').checked) { seek(frames.length - 1); acc = 0; } else { stop(); moved = true; } }
  }
  if (moved) paint();
  if (playing) rafId = requestAnimationFrame(tick);
}
function seek(i) { if (!frames.length) return; idx = Math.max(0, Math.min(frames.length - 1, i)); acc = 0; paint(); }
function step(n) { stop(); seek(idx + n); }
function jumpEvent(dir) {
  if (!logTimes.length) return;
  stop();
  const t = frameTimes[idx] || 0;
  let target = null;
  if (dir > 0) { for (const lt of logTimes) { if (lt > t + 1) { target = lt; break; } } }
  else { for (let i = logTimes.length - 1; i >= 0; i--) { if (logTimes[i] < t - 1) { target = logTimes[i]; break; } } }
  if (target == null) { seek(dir > 0 ? frames.length - 1 : 0); return; }
  seek(dir > 0 ? frameAtOrAfter(target) : frameAtOrBefore(target));
}
function nearestFrame(tMs) {
  if (!frameTimes.length) return 0;
  let lo = 0, hi = frameTimes.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (frameTimes[mid] <= tMs) lo = mid; else hi = mid; }
  return (tMs - frameTimes[lo] <= frameTimes[hi] - tMs) ? lo : hi;
}
function frameAtOrAfter(tMs) {
  let lo = 0, hi = frameTimes.length - 1;
  if (tMs > frameTimes[hi]) return hi;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (frameTimes[mid] < tMs) lo = mid + 1; else hi = mid; }
  return lo;
}
function frameAtOrBefore(tMs) {
  let lo = 0, hi = frameTimes.length - 1;
  if (tMs < frameTimes[0]) return 0;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frameTimes[mid] > tMs) hi = mid - 1; else lo = mid; }
  return lo;
}

// ---- 每帧刷新 ----
function paint() {
  $('scrub').value = String(idx);
  const f = frames[idx];
  const tMs = frames.length ? (frameTimes[idx] || 0) : -1;
  $('pos').textContent = frames.length ? (idx + 1) + ' / ' + frames.length + ' · ' + fmtT(tMs) : '— / —';
  renderCards(f, tMs);
  drawCursor();
  highlightLog(tMs);
}
function renderCards(f, tMs) {
  if (!f) {
    $('cards').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="k">' + t('本杯') + '</div><div class="v">' + t('无逐帧数据') + '</div><div class="s">' + ((cup && cup.log) || []).length + ' ' + t('条事件/轨迹在下方，点击行看详情。') + '</div></div>';
    return;
  }
  const phase = f.phase || '';
  const card = (k, v, s, cls) => '<div class="card"><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + v + '</div><div class="s">' + (s || '') + '</div></div>';
  const sm = isRaw ? nearestSample(tMs) : f;
  const weight = isRaw ? num(f.weightG) : num(sm && sm.scaleWeightG);
  const cum = sm ? num(sm.cumulativeWeightG) : null;
  const decaid = num(f.decaidWeightFlowGS);
  const rawDw = num(isRaw ? f.rawDwDtGS : f.rawScaleDwDtGS);
  const press = num(f.pressureBar);
  const mflow = num(f.machineFlowMlS);
  const target = num(f.targetFlowMlS);
  const pill = PHASE_PILL[phase] || ['#2a2f37', '#cfd5de'];
  let html = '';
  html += card(t('时刻'), fmtT(tMs), t('帧') + ' ' + (idx + 1) + ' / ' + frames.length + (isRaw && f.tareReset ? ' · tare/reset' : ''));
  html += card(t('相位'), '<span class="phasepill" style="background:' + pill[0] + ';color:' + pill[1] + '">' + t(PHASE_LABEL[phase] || phase || '—') + '</span>', t('逻辑帧') + ' ' + (f.profileFrame == null ? '—' : f.profileFrame) + ' · ' + t('物理帧') + ' ' + (f.physicalProfileFrame == null ? '—' : f.physicalProfileFrame));
  html += card(t('秤重'), f2(weight) + ' g', cum != null && Number.isFinite(cum) ? t('插件累计') + ' ' + f2(cum) + ' g' : '');
  html += card(t('decaid 杯流'), f2(decaid) + ' g/s', 'RAW dW/dt ' + f2(rawDw) + ' g/s');
  html += card(t('压力'), f2(press) + ' bar', '', press > 8 ? 'bad' : press > 6 ? 'warn' : '');
  html += card(t('机器流量'), f2(mflow) + ' ml/s', t('目标') + ' ' + f3(target) + ' ml/s');
  $('cards').innerHTML = html;
}
function nearestSample(tMs) {
  const sm = cup && cup.fullRecord && cup.fullRecord.samples;
  if (!sm || !sm.length) return null;
  if (sampleTimes.length !== sm.length) sampleTimes = sm.map((s) => Number(s.tMs) || 0);
  let lo = 0, hi = sm.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (sampleTimes[mid] <= tMs) lo = mid; else hi = mid; }
  return (tMs - sampleTimes[lo] <= sampleTimes[hi] - tMs) ? sm[lo] : sm[hi];
}

// ---- 事件日志 ----
function logLine(e) {
  const d = e.data || {};
  let detail = '';
  if (e.src === 'trace') {
    if (e.name === 'write') detail = f3(d.commandMlS) + ' ml/s' + (d.previousMlS != null ? ' ← ' + f3(d.previousMlS) : '') + (d.startupAction ? ' · ' + d.startupAction : '') + (d.retry ? ' · retry' : '');
    else if (e.name === 'check') detail = (d.decision || '') + (d.reason ? ' · ' + d.reason : '');
    else if (e.name === 'driver-ack') detail = 'f' + d.frame + ' · ' + d.latencyMs + 'ms';
    else if (e.name === 'machine-target-response') detail = f3(d.commandMlS) + ' ml/s · ' + d.latencyMs + 'ms';
    else detail = Object.keys(d).filter((k) => k !== 'kind' && k !== 'tMs').slice(0, 3).map((k) => k + '=' + (typeof d[k] === 'object' ? '…' : d[k])).join(' ');
  } else {
    detail = Object.keys(d).slice(0, 4).map((k) => k + '=' + (typeof d[k] === 'object' ? '…' : d[k])).join(' ');
  }
  return { t: e.tMs, tag: (e.src === 'trace' ? t('调流·') : '') + e.name, detail, phase: e.phase };
}
function buildLog() {
  const box = $('log');
  box.innerHTML = '';
  logRows = [];
  const frag = document.createDocumentFragment();
  (cup.log || []).forEach((e, i) => {
    const L = logLine(e);
    const row = document.createElement('div');
    row.className = 'row' + (e.src === 'trace' ? ' trace' : '');
    row.innerHTML = '<span class="t">' + fmtT(L.t) + '</span><span class="tag" title="' + L.tag + '">' + L.tag + '</span><span class="d" title="' + escapeHtml(L.detail) + '">' + (L.phase ? '[' + t(PHASE_LABEL[L.phase] || L.phase) + '] ' : '') + L.detail + '</span>';
    row.addEventListener('click', () => { stop(); if (frames.length) seek(nearestFrame(L.t)); else showEvent(i); });
    frag.appendChild(row);
    logRows.push(row);
  });
  box.appendChild(frag);
}
function showEvent(i) {
  const e = cup.log[i];
  if (!e) return;
  if (lastLogHi >= 0 && logRows[lastLogHi]) logRows[lastLogHi].classList.remove('now');
  lastLogHi = i;
  logRows[i].classList.add('now');
  $('cards').innerHTML =
    '<div class="card"><div class="k">' + t('时刻') + '</div><div class="v">' + fmtT(e.tMs) + '</div><div class="s">' + (e.src === 'trace' ? t('调流轨迹') : t('事件')) + '</div></div>' +
    '<div class="card"><div class="k">' + t('名称') + '</div><div class="v" style="font-size:14px">' + escapeHtml(e.name) + '</div><div class="s">' + t(PHASE_LABEL[e.phase] || e.phase || '') + '</div></div>' +
    '<div class="card" style="grid-column:1/-1"><div class="k">data</div><pre class="evdata">' + escapeHtml(JSON.stringify(e.data == null ? {} : e.data, null, 1)) + '</pre></div>';
}
function highlightLog(tMs) {
  let hi = -1;
  for (let i = 0; i < logTimes.length; i++) { if (logTimes[i] <= tMs) hi = i; else break; }
  if (hi === lastLogHi) return;
  if (lastLogHi >= 0 && logRows[lastLogHi]) logRows[lastLogHi].classList.remove('now');
  if (hi >= 0 && logRows[hi]) {
    logRows[hi].classList.add('now');
    const box = $('log'), row = logRows[hi];
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 24) box.scrollTop = top - box.clientHeight / 2;
  }
  lastLogHi = hi;
}

// ---- 图表 ----
const chartDefs = [
  { id: 'cFlow', lines: [
    { get: (f) => num(f.decaidWeightFlowGS, null), color: '#c77dff', width: 1.6, label: 'decaid 杯流' },
    { get: (f) => num(isRaw ? f.rawDwDtGS : f.rawScaleDwDtGS, null), color: '#63d89b', width: 1, dash: [2, 3], label: 'RAW dW/dt' },
  ] },
  { id: 'cWeight', lines: [
    { get: (f) => num(isRaw ? f.weightG : f.scaleWeightG, null), color: '#6ea8fe', width: 2, label: '秤重' },
    { get: (f) => { const s = isRaw ? nearestSample(Number(f.tMs) || 0) : f; return s ? num(s.cumulativeWeightG, null) : null; }, color: '#f5a442', width: 1.2, dash: [4, 3], label: '插件累计' },
  ] },
  { id: 'cPress', lines: [
    { get: (f) => num(f.pressureBar, null), color: '#63d89b', width: 1.6, label: '压力' },
    { get: (f) => num(f.machineFlowMlS, null), color: '#6ea8fe', width: 1.2, label: '机器流量' },
    { get: (f) => num(f.targetFlowMlS, null), color: '#f5a442', width: 1.2, dash: [5, 4], label: '目标指令' },
  ] },
];
function buildCharts() {
  sampleTimes = []; chartGeo = []; chartBase = [];
  for (const def of chartDefs) {
    const lines = def.id === 'cFlow' && !$('rawToggle').checked ? def.lines.filter((l) => l.label !== 'RAW dW/dt') : def.lines;
    const view = { id: def.id, lines };
    const canvas = $(def.id);
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 150;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 42, r: 10, t: 8, b: 20 };
    const xMax = Math.max(0.001, (frameTimes[frameTimes.length - 1] || 0) / 1000);
    let yMin = Infinity, yMax = -Infinity;
    for (const ln of lines) for (const f of frames) {
      const v = ln.get(f);
      if (v == null || !Number.isFinite(v)) continue;
      yMin = Math.min(yMin, v); yMax = Math.max(yMax, v);
    }
    if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
    // RAW 差分有孤立尖峰（秤时间戳量化）：只约束 RAW 线——轴按其 p99 定，画时跳过突变值
    let rawCap = Infinity;
    const rawLine = lines.find((l) => l.label === 'RAW dW/dt');
    if (rawLine) {
      const rv = [];
      for (const f of frames) { const v = rawLine.get(f); if (v != null && Number.isFinite(v)) rv.push(v); }
      if (rv.length > 20) {
        rv.sort((a, b) => a - b);
        rawCap = rv[Math.floor((rv.length - 1) * 0.99)];
        yMax = -Infinity;
        for (const ln of lines) for (const f of frames) {
          let v = ln.get(f);
          if (v == null || !Number.isFinite(v)) continue;
          if (ln === rawLine) v = Math.min(v, rawCap);
          yMax = Math.max(yMax, v);
        }
      }
    }
    if (!frames.length) { ctx.fillStyle = '#7d8592'; ctx.font = '12px sans-serif'; ctx.fillText(t('无帧数据（仅事件/轨迹）'), w / 2 - 78, h / 2); }
    if (yMin > 0) yMin = 0;
    const span = Math.max(0.5, yMax - yMin);
    yMax = yMin + span * 1.1;
    const x = (t) => pad.l + (w - pad.l - pad.r) * (t / xMax);
    const y = (v) => h - pad.b - (h - pad.t - pad.b) * ((v - yMin) / (yMax - yMin));
    let start = 0;
    for (let i = 1; i <= frames.length; i++) {
      if (i === frames.length || frames[i].phase !== frames[start].phase) {
        const color = STAGE_COLOR[frames[start].phase];
        if (color && i > start) { ctx.fillStyle = color; ctx.fillRect(x(frameTimes[start] / 1000), pad.t, x(frameTimes[i - 1] / 1000) - x(frameTimes[start] / 1000), h - pad.b - pad.t); }
        start = i;
      }
    }
    ctx.strokeStyle = '#2b3038'; ctx.fillStyle = '#7d8592'; ctx.font = '10px ui-monospace,monospace'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (yMax - yMin) * i / 4, yy = y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
      ctx.fillText(v.toFixed(1), 6, yy + 3);
    }
    for (let t = 0; t <= xMax; t += Math.max(5, Math.round(xMax / 6))) ctx.fillText(t + 's', x(t) - 6, h - 5);
    for (const ln of lines) {
      ctx.strokeStyle = ln.color; ctx.lineWidth = ln.width || 1.5;
      ctx.setLineDash(ln.dash || []);
      ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b); ctx.clip();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < frames.length; i++) {
        const v = ln.get(frames[i]);
        if (v == null || !Number.isFinite(v) || (ln === rawLine && v > rawCap)) { started = false; continue; }
        const px = x(frameTimes[i] / 1000), py = y(v);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.font = '10px sans-serif';
    let lx = pad.l + 4;
    for (const ln of lines) { const lbl = t(ln.label); ctx.fillStyle = ln.color; ctx.fillText('■ ' + lbl, lx, pad.t + 9); lx += ctx.measureText('■ ' + lbl).width + 14; }
    if (def.id === 'cPress' && cup && cup.log) {
      ctx.fillStyle = '#e8833a';
      for (const e of cup.log) {
        if (e.src !== 'trace' || e.name !== 'write') continue;
        const px = x(e.tMs / 1000);
        ctx.beginPath(); ctx.moveTo(px - 4, pad.t + 12); ctx.lineTo(px + 4, pad.t + 12); ctx.lineTo(px, pad.t + 19); ctx.closePath(); ctx.fill();
      }
      ctx.fillText(t('▲ 写入'), lx, pad.t + 9);
    }
    chartGeo.push({ canvas, ctx, def: view, x, y, w, h, pad, dpr, yMin, yMax });
  }
  chartsReady = true;
  for (const g of chartGeo) {
    const locate = (clientX) => {
      if (!frames.length) return;
      const rect = g.canvas.getBoundingClientRect();
      const xMax = Math.max(0.001, (frameTimes[frameTimes.length - 1] || 0) / 1000);
      const t = Math.max(0, Math.min(xMax, (clientX - rect.left - g.pad.l) / (g.w - g.pad.l - g.pad.r) * xMax));
      stop(); seek(nearestFrame(t * 1000));
    };
    g.canvas.onclick = (ev) => locate(ev.clientX);
    // 触屏：竖向滑动交给页面原生滚动（canvas touch-action:pan-y），
    // 只有点按（位移<10px）或横向拖动才移动时间轴；横拖时阻止默认避免误滚。
    let ts = null;
    g.canvas.addEventListener('touchstart', (ev) => {
      if (ev.touches.length !== 1) { ts = null; return; }
      const t0 = ev.touches[0];
      ts = { x: t0.clientX, y: t0.clientY, mode: null };
    }, { passive: true });
    g.canvas.addEventListener('touchmove', (ev) => {
      if (!ts || ev.touches.length !== 1) return;
      const t0 = ev.touches[0];
      const dx = t0.clientX - ts.x, dy = t0.clientY - ts.y;
      if (!ts.mode) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        ts.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (ts.mode === 'h') { ev.preventDefault(); locate(t0.clientX); }
    }, { passive: false });
    g.canvas.addEventListener('touchend', (ev) => {
      if (ts && !ts.mode) {
        const t0 = ev.changedTouches[0];
        if (t0 && Math.abs(t0.clientX - ts.x) < 10 && Math.abs(t0.clientY - ts.y) < 10) locate(t0.clientX);
      }
      ts = null;
    }, { passive: true });
    g.canvas.addEventListener('touchcancel', () => { ts = null; }, { passive: true });
  }
}
function drawCursor() {
  if (!chartsReady || !frames.length) return;
  if (chartBase.length !== chartGeo.length) {
    chartBase = chartGeo.map((g) => {
      const off = document.createElement('canvas');
      off.width = g.canvas.width; off.height = g.canvas.height;
      off.getContext('2d').drawImage(g.canvas, 0, 0);
      return off;
    });
  }
  const t = (frameTimes[idx] || 0) / 1000;
  chartGeo.forEach((g, i) => {
    g.ctx.setTransform(1, 0, 0, 1, 0, 0);
    g.ctx.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.drawImage(chartBase[i], 0, 0);
    g.ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    const px = g.x(t);
    g.ctx.strokeStyle = '#e8833a'; g.ctx.lineWidth = 1.5;
    g.ctx.beginPath(); g.ctx.moveTo(px, g.pad.t); g.ctx.lineTo(px, g.h - g.pad.b); g.ctx.stroke();
    g.ctx.fillStyle = '#e8833a'; g.ctx.font = '10px ui-monospace,monospace';
    const label = fmtT(frameTimes[idx] || 0);
    const lw = g.ctx.measureText(label).width;
    g.ctx.fillText(label, Math.min(px + 4, g.w - g.pad.r - lw), g.pad.t + 20);
    for (const ln of g.def.lines) {
      const v = ln.get(frames[idx]);
      if (v == null || !Number.isFinite(v)) continue;
      g.ctx.fillStyle = ln.color;
      g.ctx.beginPath(); g.ctx.arc(px, g.y(v), 3, 0, Math.PI * 2); g.ctx.fill();
    }
  });
}

// ---- 事件绑定 ----
$('fetchNow').addEventListener('click', () => doFetch(false));
$('autoOn').addEventListener('change', () => { if ($('autoOn').checked) { startAuto(); doFetch(true); } else stopAuto(); dbSet('autoOn', $('autoOn').checked); });
$('autoSec').addEventListener('change', () => { dbSet('autoSec', $('autoSec').value); if ($('autoOn').checked) startAuto(); else if (window.HxBridge) window.HxBridge.setAutoFetch($('srcUrl').value.trim(), Number($('autoSec').value)); });
$('pickFile').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', async () => {
  const f = $('fileInput').files[0];
  if (!f) return;
  setStatus(() => t('读取') + ' ' + f.name + '…', true);
  try {
    const json = JSON.parse(await f.text());
    const st = await mergeIncoming(json, f.name);
    setStatus(() => t('导入') + ' ' + f.name + ' · ' + t('新增') + ' ' + st.newShots + ' ' + t('杯') + ' · ' + t('补全') + ' ' + st.fullUpdated + ' ' + t('杯'));
  } catch (e) { setStatus(() => t('失败：') + (e.message || e)); }
  $('fileInput').value = '';
});
$('exportArchive').addEventListener('click', () => {
  if (!archive) return;
  // APK 里 blob 下载没有 DownloadListener 会静默失败；有分享桥就走分享（顺带 gzip）。
  if (window.HxBridge && window.HxBridge.shareFile) { compressAndShare(); return; }
  const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hyperex-history-all.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('clearArchive').addEventListener('click', async () => {
  if (!confirm(t('清空本机归档？（不影响插件与 Decaid 上的数据）'))) return;
  archive = HxArchive.emptyArchive();
  await saveArchive();
  rebuildCupList();
  setStatus(() => t('归档已清空'));
});
$('lang').addEventListener('change', () => { lang = $('lang').value; dbSet('lang', lang); applyLang(); });
$('cup').addEventListener('change', () => loadCup(Number($('cup').value)));
$('btnPlay').addEventListener('click', () => play(1));
$('btnRev').addEventListener('click', () => play(-1));
$('btnBack1').addEventListener('click', () => step(-1));
$('btnFwd1').addEventListener('click', () => step(1));
$('btnBack10').addEventListener('click', () => step(-10));
$('btnFwd10').addEventListener('click', () => step(10));
$('btnStart').addEventListener('click', () => { stop(); seek(0); });
$('btnEnd').addEventListener('click', () => { stop(); seek(frames.length - 1); });
$('btnPrevEv').addEventListener('click', () => jumpEvent(-1));
$('btnNextEv').addEventListener('click', () => jumpEvent(1));
$('speed').addEventListener('change', () => { speed = Number($('speed').value) || 1; });
$('scrub').addEventListener('input', () => { stop(); seek(Number($('scrub').value)); });
$('rawToggle').addEventListener('change', () => { if (cup) { buildCharts(); paint(); } });
document.addEventListener('keydown', (ev) => {
  const tag = (ev.target && ev.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
  if (ev.code === 'Space') { ev.preventDefault(); if (playing) stop(); else play(1); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); step(ev.shiftKey ? -10 : -1); }
  else if (ev.key === 'ArrowRight') { ev.preventDefault(); step(ev.shiftKey ? 10 : 1); }
  else if (ev.key === 'Home') { ev.preventDefault(); stop(); seek(0); }
  else if (ev.key === 'End') { ev.preventDefault(); stop(); seek(frames.length - 1); }
  else if (ev.key === 'PageUp') { ev.preventDefault(); jumpEvent(-1); }
  else if (ev.key === 'PageDown') { ev.preventDefault(); jumpEvent(1); }
});
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (cup) { buildCharts(); chartBase = []; paint(); } }, 150); });

// ---- 图表卡长按拖动排序（⠿ 把手；顺序持久化）----
const CHART_IDS = ['cFlow', 'cWeight', 'cPress'];
function chartBoxes() { return CHART_IDS.map((id) => document.querySelector('.chartbox[data-chart="' + id + '"]')).filter(Boolean); }
function applyChartOrder(order) {
  const view = document.querySelector('section.view');
  const log = $('log');
  const boxes = chartBoxes();
  const byId = {};
  boxes.forEach((b) => { byId[b.dataset.chart] = b; });
  const seq = (Array.isArray(order) ? order : []).filter((id) => byId[id]);
  CHART_IDS.forEach((id) => { if (!seq.includes(id)) seq.push(id); });
  seq.forEach((id) => view.insertBefore(byId[id], log));
}
function saveChartOrder() {
  const order = [...document.querySelectorAll('section.view .chartbox[data-chart]')].map((b) => b.dataset.chart);
  dbSet('chartOrder', order);
}
function initChartDrag() {
  const view = document.querySelector('section.view');
  let drag = null;
  const arm = (handle, ev) => {
    if (drag || (ev.button != null && ev.button !== 0)) return;
    const box = handle.closest('.chartbox');
    const x0 = ev.clientX, y0 = ev.clientY;
    const timer = setTimeout(() => begin(box, handle, x0, y0), 350);
    const cancel = () => { clearTimeout(timer); handle.removeEventListener('pointermove', preMove); handle.removeEventListener('pointerup', cancel); handle.removeEventListener('pointercancel', cancel); };
    const preMove = (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancel(); };
    handle.addEventListener('pointermove', preMove);
    handle.addEventListener('pointerup', cancel);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('pointerdown', (e) => { if (drag) e.preventDefault(); }, { once: true });
  };
  const begin = (box, handle, x0, y0) => {
    const rect = box.getBoundingClientRect();
    const ghost = box.cloneNode(true);
    ghost.classList.add('chartghost');
    ghost.style.width = rect.width + 'px';
    document.body.appendChild(ghost);
    box.classList.add('dragging');
    document.body.classList.add('chart-dragging');
    drag = { box, ghost, dx: x0 - rect.left, dy: y0 - rect.top, target: null };
    moveGhost(x0, y0);
    if (navigator.vibrate) navigator.vibrate(10);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  const moveGhost = (x, y) => { drag.ghost.style.transform = 'translate(' + (x - drag.dx) + 'px,' + (y - drag.dy) + 'px)'; };
  const onMove = (e) => {
    if (!drag) return;
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
    const boxes = chartBoxes().filter((b) => b !== drag.box);
    let target = null;
    for (const b of boxes) {
      const r = b.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) { target = { el: b, before: e.clientY < r.top + r.height / 2 }; break; }
    }
    if (!target && boxes.length) {
      const first = boxes[0].getBoundingClientRect(), last = boxes[boxes.length - 1].getBoundingClientRect();
      if (e.clientY < first.top) target = { el: boxes[0], before: true };
      else if (e.clientY > last.bottom) target = { el: boxes[boxes.length - 1], before: false };
    }
    chartBoxes().forEach((b) => b.classList.remove('drop-target'));
    if (target) {
      target.el.classList.add('drop-target');
      view.insertBefore(drag.box, target.before ? target.el : target.el.nextSibling);
    }
    drag.target = target;
    const vr = view.getBoundingClientRect();
    if (e.clientY < vr.top + 40) view.scrollTop -= 8;
    else if (e.clientY > vr.bottom - 40) view.scrollTop += 8;
  };
  const onUp = () => {
    if (!drag) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    drag.ghost.remove();
    drag.box.classList.remove('dragging');
    document.body.classList.remove('chart-dragging');
    chartBoxes().forEach((b) => b.classList.remove('drop-target'));
    drag = null;
    saveChartOrder();
    if (cup) { buildCharts(); chartBase = []; paint(); }
  };
  document.querySelectorAll('.charthandle').forEach((h) => {
    h.addEventListener('pointerdown', (ev) => arm(h, ev));
    h.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });
}

// ---- 后台 buffer 合并（冷启动 / 回前台都走这里）----
let mergingPending = false;
async function mergePending() {
  if (!window.HxBridge || mergingPending) return;
  mergingPending = true;
  try {
    const pending = window.HxBridge.takePending();
    if (pending) {
      // buffer 是归档形状 {kind:HyperExHistoryArchive,shots}；兼容旧 {hyperex,recorder} 与单份导出。
      let st = { newShots: 0, fullUpdated: 0 };
      const parsed = JSON.parse(pending);
      if (parsed && (parsed.hyperex || parsed.recorder)) {
        if (parsed.hyperex) { const r = await mergeIncoming(parsed.hyperex, 'background'); st.newShots += r.newShots; st.fullUpdated += r.fullUpdated; }
        if (parsed.recorder) { const r = await mergeIncoming(parsed.recorder, 'background-recorder'); st.newShots += r.newShots; st.fullUpdated += r.fullUpdated; }
      } else {
        st = await mergeIncoming(parsed, 'background');
      }
      if (st.newShots || st.fullUpdated) {
        setStatus(() => t('后台抓取已合并 · 新增') + ' ' + st.newShots + ' ' + t('杯') + ' · ' + t('补全') + ' ' + st.fullUpdated + ' ' + t('杯'));
      }
      await checkArchiveSize();
    }
  } catch (e) { /* 后台数据坏了就跳过，不影响手动抓取 */ }
  mergingPending = false;
  renderWhitelistWarning();
}

// ---- 白名单警示：不在电池优化白名单就提示，一键跳设置 ----
function renderWhitelistWarning() {
  let bar = $('whitelistBar');
  if (!window.HxBridge || !window.HxBridge.isIgnoringBatteryOptimizations) { if (bar) bar.remove(); return; }
  const ok = window.HxBridge.isIgnoringBatteryOptimizations();
  if (ok) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'whitelistBar';
    bar.style.cssText = 'flex:none;background:#3d2c17;color:#f5c078;padding:8px 16px;font-size:13px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #5a4326';
    const msg = document.createElement('span');
    msg.style.flex = '1';
    msg.textContent = t('后台抓取未在白名单') + '，' + t('可能被系统杀掉，后台抓取会停。');
    const btn = document.createElement('button');
    btn.textContent = t('去设置白名单');
    btn.style.cssText = 'background:#e8833a;color:#1a1208;padding:6px 12px;font-size:13px;width:auto;margin:0';
    btn.addEventListener('click', () => window.HxBridge.openBatterySettings());
    bar.appendChild(msg); bar.appendChild(btn);
    const main = document.querySelector('main');
    document.body.insertBefore(bar, main);
  }
}

// ---- 启动 ----
(async () => {
  await openDb();
  archive = (await dbGet('archive')) || HxArchive.emptyArchive();
  const savedUrl = await dbGet('srcUrl');
  if (savedUrl) $('srcUrl').value = savedUrl;
  const savedSec = await dbGet('autoSec');
  if (savedSec) $('autoSec').value = savedSec;
  const savedLang = await dbGet('lang');
  if (savedLang === 'en' || savedLang === 'zh') { lang = savedLang; $('lang').value = lang; }
  applyChartOrder(await dbGet('chartOrder'));
  initChartDrag();
  initCupDrop();
  if (window.HxBridge) {
    await mergePending();
    window.HxBridge.setAutoFetch($('srcUrl').value.trim(), $('autoOn').checked ? Number($('autoSec').value) : 0);
    // 回前台自动合并：MainActivity.onResume 发 hxresume，visibilitychange 双保险。
    window.addEventListener('hxresume', () => { mergePending(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) mergePending(); });
  }
  renderArchiveInfo();
  rebuildCupList();
  if (await dbGet('autoOn')) { $('autoOn').checked = true; startAuto(); }
  applyLang();
  renderWhitelistWarning();
  renderReadyStatus();
  checkPluginsOnStartup();
})().catch((e) => setStatus(() => t('初始化失败：') + (e.message || e)));

// ---- 插件安装检测：启动静默查一次，缺任一支弹窗引导去 GitHub 安装 ----
const PLUGIN_DEFS = [
  { id: 'decenthyperexplugin.reaplugin', name: 'HyperEx Pulse Filter', cls: 'hx', ico: 'H', repo: 'ladiosupp/decenthyperexplugin', desc: '记录 HyperEx 控制的萃取杯' },
  { id: 'profilerecorder.reaplugin', name: 'Profile Recorder', cls: 'rc', ico: 'R', repo: 'ladiosupp/profilerecorder', desc: '记录其余曲线（非 HyperEx 杯）' },
];
let pluginCheckBusy = false;
window.__hxPluginCheck = function (payload) {
  pluginCheckBusy = false;
  let res;
  try { res = JSON.parse(payload); } catch (_) { res = { ok: false, error: 'bad payload' }; }
  if (!res.ok) {
    closePluginModal();
    setStatus(() => t('插件检测失败：无法连接 Decaid'), true);
    return;
  }
  const found = {};
  for (const p of res.plugins || []) found[p.id] = p;
  const missing = PLUGIN_DEFS.filter((d) => !found[d.id] || found[d.id].loaded === false);
  if (!missing.length) { closePluginModal(); renderReadyStatus(); return; }
  showPluginModal(found, missing);
};
function renderReadyStatus() {
  setStatus(() => archive && archive.count ? t('就绪') + ' · ' + t('归档') + ' ' + archive.count + ' ' + t('杯') : t('就绪') + ' · ' + t('归档为空，先抓取或导入'));
}
function checkPluginsOnStartup() {
  const url = $('srcUrl').value.trim();
  if (!url || pluginCheckBusy) return;
  pluginCheckBusy = true;
  setStatus(() => t('检测中…'), true);
  if (window.HxBridge && window.HxBridge.checkPlugins) {
    window.HxBridge.checkPlugins(url, '__hxPluginCheck');
  } else {
    // 浏览器环境没有 Java 桥：直接 fetch（Decaid 无 CORS 头，跨域会失败，按不可达处理）。
    fetch(new URL('/api/v1/plugins', url).href, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((plugins) => window.__hxPluginCheck(JSON.stringify({ ok: true, plugins })))
      .catch((e) => window.__hxPluginCheck(JSON.stringify({ ok: false, error: String(e && e.message || e) })));
  }
}
function closePluginModal() {
  const m = $('pluginModal');
  if (m) m.remove();
}
function showPluginModal(found, missing) {
  closePluginModal();
  const dim = document.createElement('div');
  dim.id = 'pluginModal';
  dim.className = 'modal-dim';
  const rows = PLUGIN_DEFS.map((d) => {
    const p = found[d.id];
    const ok = p && p.loaded !== false;
    const ver = ok ? 'v' + (p.version || '?') + ' · ' + t('已安装') : t('未检测到');
    return '<div class="plug ' + d.cls + '"><span class="ico">' + d.ico + '</span><span><span class="nm">' + d.name + '</span><div class="ver">' + ver + '</div><div class="desc">' + t(d.desc) + '</div></span><span class="badge ' + (ok ? 'ok' : 'no') + '">' + t(ok ? '已安装' : '未安装') + '</span></div>';
  }).join('');
  const ghBtns = missing.map((d) => '<button class="ghbtn" data-repo="' + d.repo + '">' + t('去 GitHub 安装') + ' ' + d.name + '<small>' + d.repo + '</small></button>').join('');
  dim.innerHTML = '<div class="modal"><h3>' + t('检测到') + ' ' + missing.length + ' ' + t('支插件未安装') + '</h3><p class="why">' + t('两支都装上，才能记全每一杯曲线。') + '</p>' + rows + ghBtns +
    '<div class="modal-actions"><button class="ghost" id="pluginLater">' + t('稍后') + '</button><button class="primary" id="pluginRecheck">' + t('重新检测') + '</button></div>' +
    '<div class="modal-foot">Decaid → Plugins → Install plugin → GitHub Release</div></div>';
  document.body.appendChild(dim);
  dim.querySelectorAll('.ghbtn').forEach((b) => b.addEventListener('click', () => {
    if (window.HxBridge && window.HxBridge.openUrl) window.HxBridge.openUrl('https://github.com/' + b.dataset.repo + '/releases');
  }));
  $('pluginLater').addEventListener('click', closePluginModal);
  $('pluginRecheck').addEventListener('click', () => { closePluginModal(); checkPluginsOnStartup(); });
}

