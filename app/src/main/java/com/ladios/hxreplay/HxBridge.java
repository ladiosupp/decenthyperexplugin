package com.ladios.hxreplay;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;

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

    @JavascriptInterface
    public String takePending() {
        SharedPreferences sp = ctx.getSharedPreferences("hx", Context.MODE_PRIVATE);
        String p = sp.getString("pending", null);
        if (p != null) sp.edit().remove("pending").apply();
        return p;
    }

    // 把 JS 传来的 base64 文件写进 cacheDir，经 FileProvider 调系统分享面板
    //（夸克等网盘 App 会出现在面板里）。导出归档 / 压缩备份共用。
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

