package com.ladios.hxreplay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

// 后台定时抓取 Decaid 导出（HyperEx + recorder 两路），每轮累积合并进持久 buffer
// （最近 60 杯，runId 去重、分量取最长）。App 只是展示层：用户几天不开 App，
// 数据也在服务里攒着不丢；回前台经 HxBridge.takePending 一次性合并进归档。
public class FetchService extends Service {
    private static final String CHANNEL = "hxreplay-fetch";
    private static final String RECORDER_PATH = "/api/v1/plugins/profilerecorder.reaplugin/history-export";
    private static final int BUFFER_MAX_SHOTS = 60;
    private static final String TAG = "HxFetch";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile Runnable tick;
    private volatile boolean screenOn = true;

    // 省电总闸：灭屏不可能有人出杯，停掉抓取定时器（零轮询零网络）；亮屏恢复。
    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                screenOn = false;
                if (tick != null) handler.removeCallbacks(tick);
                Log.d(TAG, "screen off: pause fetch");
            } else if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
                screenOn = true;
                Log.d(TAG, "screen on: resume fetch");
                schedule();
            }
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "ProfileReplayer fetch", NotificationManager.IMPORTANCE_LOW));
        Notification n = new Notification.Builder(this, CHANNEL)
                .setContentTitle("ProfileReplayer")
                .setContentText("后台抓取 Decaid 历史")
                .setSmallIcon(android.R.drawable.ic_popup_sync)
                .setOngoing(true)
                .build();
        startForeground(1, n);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        screenOn = pm == null || pm.isInteractive();
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_ON);
        f.addAction(Intent.ACTION_SCREEN_OFF);
        registerReceiver(screenReceiver, f);
        schedule();
    }

    private void schedule() {
        if (tick != null) handler.removeCallbacks(tick);
        SharedPreferences sp = getSharedPreferences("hx", MODE_PRIVATE);
        final String url = sp.getString("url", "");
        final int sec = sp.getInt("sec", 0);
        if (url.isEmpty() || sec <= 0) { stopSelf(); return; }
        if (!screenOn) return; // 灭屏不排定时器，等 SCREEN_ON 广播再恢复
        tick = new Runnable() {
            @Override
            public void run() {
                new Thread(() -> {
                    fetch(url);
                    // 亮屏期间若 schedule() 已重建 tick（如 SCREEN_ON/设置变更），旧 worker 不再重复排程
                    if (screenOn && tick == this) handler.postDelayed(this, sec * 1000L);
                }).start();
            }
        };
        handler.postDelayed(tick, sec * 1000L);
    }

    private String httpGet(String url) {
        if (url == null) return null;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(5000);
            c.setReadTimeout(15000);
            if (c.getResponseCode() != 200) return null;
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private String recorderUrl(String url) {
        try {
            URL u = new URL(url);
            return new URL(u.getProtocol(), u.getHost(), u.getPort(), RECORDER_PATH).toString();
        } catch (Exception e) {
            return null;
        }
    }

    private File bufferFile() {
        return new File(getFilesDir(), "pending-buffer.json");
    }

    private JSONObject readBuffer() {
        try {
            File f = bufferFile();
            if (!f.exists()) return MergeCore.emptyArchive();
            String s = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
            JSONObject j = new JSONObject(s);
            if (j.optJSONArray("shots") == null) return MergeCore.emptyArchive();
            return j;
        } catch (Exception e) {
            try { return MergeCore.emptyArchive(); } catch (Exception ignored) { return new JSONObject(); }
        }
    }

    private void writeBuffer(JSONObject archive) {
        try {
            File f = bufferFile();
            File tmp = new File(getFilesDir(), "pending-buffer.tmp");
            FileOutputStream fos = new FileOutputStream(tmp);
            fos.write(archive.toString().getBytes(StandardCharsets.UTF_8));
            fos.close();
            if (f.exists()) f.delete();
            tmp.renameTo(f);
        } catch (Exception ignored) {
        }
    }

    private void fetch(String url) {
        // 细闸：DE1 睡眠时没新杯，跳过本轮抓取（状态查询本身很轻）。
        // 查询失败/未知不拦，照旧尝试抓取。
        if ("sleeping".equals(machineState(url))) {
            Log.d(TAG, "DE1 sleeping: skip fetch");
            return;
        }
        String hyperex = httpGet(url);
        String recorder = httpGet(recorderUrl(url));
        if (hyperex == null && recorder == null) return;
        try {
            JSONObject buffer = readBuffer();
            if (hyperex != null) buffer = MergeCore.merge(buffer, new JSONObject(hyperex), BUFFER_MAX_SHOTS);
            if (recorder != null) buffer = MergeCore.merge(buffer, new JSONObject(recorder), BUFFER_MAX_SHOTS);
            writeBuffer(buffer);
            SharedPreferences sp = getSharedPreferences("hx", MODE_PRIVATE);
            sp.edit()
                .putLong("lastFetchAt", System.currentTimeMillis())
                .putInt("bufferCups", buffer.optInt("count", 0))
                .apply();
        } catch (Exception ignored) {
        }
    }

    // 读 DE1 状态并写缓存（前台回前台秒读复用）；失败返回 null。
    private String machineState(String url) {
        try {
            URL u = new URL(url);
            URL api = new URL(u.getProtocol(), u.getHost(), u.getPort(), "/api/v1/machine/state");
            HttpURLConnection c = (HttpURLConnection) api.openConnection();
            c.setConnectTimeout(4000);
            c.setReadTimeout(6000);
            if (c.getResponseCode() != 200) return null;
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            JSONObject p = new JSONObject(sb.toString());
            JSONObject m = p.optJSONObject("machine");
            if (m == null) m = p;
            JSONObject st = m.optJSONObject("state");
            if (st == null) st = p.optJSONObject("state");
            String state = st != null ? st.optString("state") : m.optString("state");
            String substate = st != null ? st.optString("substate") : m.optString("substate");
            getSharedPreferences("hx", MODE_PRIVATE).edit()
                .putString("de1State", state).putString("de1Substate", substate)
                .putLong("de1StateAt", System.currentTimeMillis()).apply();
            return state;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        schedule();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (tick != null) handler.removeCallbacks(tick);
        try { unregisterReceiver(screenReceiver); } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

