package com.ladios.hxreplay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

// 后台定时抓取 Decaid 导出（HyperEx + recorder 两路），原始 JSON 落盘；
// App 打开时经 HxBridge.takePending 合并。recorder 404（未装）静默跳过。
public class FetchService extends Service {
    private static final String CHANNEL = "hxreplay-fetch";
    private static final String RECORDER_PATH = "/api/v1/plugins/profilerecorder.reaplugin/history-export";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable tick;

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
        schedule();
    }

    private void schedule() {
        if (tick != null) handler.removeCallbacks(tick);
        SharedPreferences sp = getSharedPreferences("hx", MODE_PRIVATE);
        final String url = sp.getString("url", "");
        final int sec = sp.getInt("sec", 0);
        if (url.isEmpty() || sec <= 0) { stopSelf(); return; }
        tick = new Runnable() {
            @Override
            public void run() {
                new Thread(() -> {
                    fetch(url);
                    handler.postDelayed(this, sec * 1000L);
                }).start();
            }
        };
        handler.postDelayed(tick, sec * 1000L);
    }

    private String httpGet(String url) {
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

    private void fetch(String url) {
        String hyperex = httpGet(url);
        if (hyperex == null) return;
        String recorder = httpGet(recorderUrl(url));
        try {
            JSONObject pending = new JSONObject();
            pending.put("hyperex", new JSONObject(hyperex));
            if (recorder != null) pending.put("recorder", new JSONObject(recorder));
            getSharedPreferences("hx", MODE_PRIVATE).edit().putString("pending", pending.toString()).apply();
        } catch (Exception ignored) {
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
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

