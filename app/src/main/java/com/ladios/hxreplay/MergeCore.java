package com.ladios.hxreplay;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 合并内核的 Java 移植，与 sim/archive-core.js 同口径：
// 按 runId 去重，全点分量（samples/rawScaleSamples/events/liveFlowTrim.trace）各取最长。
// 后台服务用它把每轮抓到的导出累积进持久 buffer，App 不开也不丢杯。
public class MergeCore {
    private static final String[] ARRAY_KEYS = {"samples", "rawScaleSamples", "events"};

    public static JSONObject emptyArchive() throws Exception {
        JSONObject a = new JSONObject();
        a.put("kind", "HyperExHistoryArchive");
        a.put("schema", 1);
        a.put("updatedAt", JSONObject.NULL);
        a.put("count", 0);
        a.put("fullRecordCount", 0);
        a.put("shots", new JSONArray());
        return a;
    }

    private static boolean hasAnyFull(JSONObject fr) {
        if (fr == null) return false;
        for (String k : ARRAY_KEYS) {
            JSONArray v = fr.optJSONArray(k);
            if (v != null && v.length() > 0) return true;
        }
        JSONObject trim = fr.optJSONObject("liveFlowTrim");
        if (trim != null) {
            JSONArray tr = trim.optJSONArray("trace");
            if (tr != null && tr.length() > 0) return true;
        }
        return false;
    }

    private static String startedAt(JSONObject shot, String runId) {
        String s = shot.optString("startedAt", "");
        if (!s.isEmpty()) return s;
        try {
            long n = Long.parseLong(runId.split("-")[0]);
            if (n > 1000000000000L) return new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date(n));
        } catch (Exception ignored) {}
        return "";
    }

    // 把一份 fullRecord 的各分量按最长回填进 rec.fullRecord
    private static void applyFull(JSONObject recFull, JSONObject fr) {
        if (fr == null) return;
        for (String k : ARRAY_KEYS) {
            JSONArray v = fr.optJSONArray(k);
            JSONArray cur = recFull.optJSONArray(k);
            if (v != null && v.length() > (cur == null ? 0 : cur.length())) {
                try { recFull.put(k, v); } catch (Exception ignored) {}
            }
        }
        JSONObject trim = fr.optJSONObject("liveFlowTrim");
        if (trim != null) {
            JSONObject curT = recFull.optJSONObject("liveFlowTrim");
            int curLen = curT == null ? 0 : (curT.optJSONArray("trace") == null ? 0 : curT.optJSONArray("trace").length());
            JSONArray tr = trim.optJSONArray("trace");
            int nextLen = tr == null ? 0 : tr.length();
            if (curT == null || nextLen > curLen) {
                try { recFull.put("liveFlowTrim", trim); } catch (Exception ignored) {}
            }
        }
    }

    private static JSONObject cleanSummary(JSONObject shot) throws Exception {
        JSONObject s = new JSONObject(shot.toString());
        s.remove("fullRecord"); s.remove("rawDetail");
        s.remove("samples"); s.remove("rawScaleSamples"); s.remove("events");
        return s;
    }

    private static JSONObject newRec(String runId, JSONObject summary, String started) throws Exception {
        JSONObject rec = new JSONObject();
        rec.put("runId", runId);
        rec.put("summary", summary);
        rec.put("startedAt", started);
        JSONObject full = new JSONObject();
        full.put("samples", JSONObject.NULL);
        full.put("rawScaleSamples", JSONObject.NULL);
        full.put("events", JSONObject.NULL);
        full.put("liveFlowTrim", JSONObject.NULL);
        rec.put("fullRecord", full);
        return rec;
    }

    // 合并一份导出（{shots:[...]} 或归档 {kind:HyperExHistoryArchive,shots}）进 records。
    public static void mergeExport(Map<String, JSONObject> records, JSONObject exportJson) throws Exception {
        JSONArray shots = exportJson.optJSONArray("shots");
        if (shots == null) return;
        for (int i = 0; i < shots.length(); i++) {
            JSONObject shot = shots.optJSONObject(i);
            if (shot == null) continue;
            String runId = shot.optString("runId", "");
            if (runId.isEmpty()) continue;
            String started = startedAt(shot, runId);
            JSONObject summary = cleanSummary(shot);
            JSONObject rec = records.get(runId);
            if (rec == null) {
                rec = newRec(runId, summary, started);
                records.put(runId, rec);
            } else {
                JSONObject oldSum = rec.optJSONObject("summary");
                if (oldSum == null) oldSum = new JSONObject();
                Iterator<String> keys = summary.keys();
                while (keys.hasNext()) { String k = keys.next(); oldSum.put(k, summary.get(k)); }
                rec.put("summary", oldSum);
                if (rec.optString("startedAt", "").isEmpty() && !started.isEmpty()) rec.put("startedAt", started);
            }
            JSONObject full = rec.optJSONObject("fullRecord");
            JSONObject fr = shot.optJSONObject("fullRecord");
            if (fr != null) applyFull(full, fr);
            // 旧导出形状：分量直接挂在 shot 上
            JSONObject own = new JSONObject();
            for (String k : ARRAY_KEYS) { JSONArray v = shot.optJSONArray(k); if (v != null) own.put(k, v); }
            JSONObject trim = shot.optJSONObject("liveFlowTrim");
            if (trim != null) own.put("liveFlowTrim", trim);
            if (hasAnyFull(own)) applyFull(full, own);
        }
    }

    public static JSONObject buildArchive(Map<String, JSONObject> records, int maxShots) throws Exception {
        List<JSONObject> rows = new ArrayList<>(records.values());
        rows.sort((a, b) -> {
            int c = a.optString("startedAt", "").compareTo(b.optString("startedAt", ""));
            return c != 0 ? c : a.optString("runId", "").compareTo(b.optString("runId", ""));
        });
        if (maxShots > 0 && rows.size() > maxShots) rows = rows.subList(rows.size() - maxShots, rows.size());
        JSONArray shots = new JSONArray();
        int fullCount = 0;
        for (JSONObject rec : rows) {
            JSONObject summary = rec.optJSONObject("summary");
            JSONObject shot = summary == null ? new JSONObject() : new JSONObject(summary.toString());
            shot.put("runId", rec.optString("runId", ""));
            shot.put("startedAt", rec.optString("startedAt", ""));
            JSONObject full = rec.optJSONObject("fullRecord");
            shot.put("fullRecord", full == null ? new JSONObject() : full);
            if (hasAnyFull(full)) fullCount++;
            shots.put(shot);
        }
        JSONObject a = new JSONObject();
        a.put("kind", "HyperExHistoryArchive");
        a.put("schema", 1);
        a.put("updatedAt", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date()));
        a.put("count", shots.length());
        a.put("fullRecordCount", fullCount);
        a.put("shots", shots);
        return a;
    }

    public static Map<String, JSONObject> loadRecords(JSONObject archive) throws Exception {
        Map<String, JSONObject> map = new LinkedHashMap<>();
        JSONArray shots = archive == null ? null : archive.optJSONArray("shots");
        if (shots == null) return map;
        for (int i = 0; i < shots.length(); i++) {
            JSONObject shot = shots.optJSONObject(i);
            if (shot == null) continue;
            String runId = shot.optString("runId", "");
            if (runId.isEmpty()) continue;
            JSONObject rec = newRec(runId, cleanSummary(shot), startedAt(shot, runId));
            JSONObject fr = shot.optJSONObject("fullRecord");
            if (fr != null) rec.put("fullRecord", fr);
            map.put(runId, rec);
        }
        return map;
    }

    // 一步合并：archive + 导出 → 新 archive
    public static JSONObject merge(JSONObject archive, JSONObject exportJson, int maxShots) throws Exception {
        Map<String, JSONObject> records = loadRecords(archive == null ? emptyArchive() : archive);
        mergeExport(records, exportJson);
        return buildArchive(records, maxShots);
    }
}

