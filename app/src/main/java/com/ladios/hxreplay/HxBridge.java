package com.ladios.hxreplay;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public class HxBridge {
    private final Context ctx;

    public HxBridge(Context ctx) {
        this.ctx = ctx;
    }

    @JavascriptInterface
    public void setAutoFetch(String url, int sec) {
        SharedPreferences sp = ctx.getSharedPreferences("hx", Context.MODE_PRIVATE);
        sp.edit().putString("url", url == null ? "" : url).putInt("sec", sec).apply();
        Intent i = new Intent(ctx, FetchService.class);
        if (sec > 0 && url != null && !url.isEmpty()) ctx.startForegroundService(i);
        else ctx.stopService(i);
    }

    // 读后台服务累积的 buffer（最近 60 杯归档形状），读后清空。
    // 兼容旧 pending 键（单份导出 JSON）。
    @JavascriptInterface
    public String takePending() {
        try {
            File f = new File(ctx.getFilesDir(), "pending-buffer.json");
            if (f.exists()) {
                String s = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
                f.delete();
                SharedPreferences sp = ctx.getSharedPreferences("hx", Context.MODE_PRIVATE);
                sp.edit().remove("pending").apply();
                return s;
            }
        } catch (Exception ignored) {
        }
        SharedPreferences sp = ctx.getSharedPreferences("hx", Context.MODE_PRIVATE);
        String p = sp.getString("pending", null);
        if (p != null) sp.edit().remove("pending").apply();
        return p;
    }

    // 后台抓取状态：上次抓取时间、buffer 杯数、服务是否被系统允许后台运行。
    @JavascriptInterface
    public String fetchStatus() {
        SharedPreferences sp = ctx.getSharedPreferences("hx", Context.MODE_PRIVATE);
        long last = sp.getLong("lastFetchAt", 0);
        int cups = sp.getInt("bufferCups", 0);
        boolean whitelisted = isIgnoringBatteryOptimizations();
        return "{\"lastFetchAt\":" + last + ",\"bufferCups\":" + cups + ",\"whitelisted\":" + whitelisted + "}";
    }

    @JavascriptInterface
    public boolean isIgnoringBatteryOptimizations() {
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            return pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    // 跳系统「忽略电池优化」设置页，让用户把本 App 加进白名单。
    @JavascriptInterface
    public void openBatterySettings() {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception ignored) {
            }
        }
    }

    // 把 JS 传来的 base64 文件写进 cacheDir，经 FileProvider 调系统分享面板。
    @JavascriptInterface
    public void shareFile(String name, String mime, String base64) {
        try {
            File dir = new File(ctx.getCacheDir(), "share");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, name == null ? "archive.json.gz" : name.replaceAll("[\\\\/:*?\"<>|]", "_"));
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            FileOutputStream fos = new FileOutputStream(out);
            fos.write(bytes);
            fos.close();
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", out);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime == null ? "application/octet-stream" : mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, name);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(chooser);
        } catch (Exception ignored) {
        }
    }
}

