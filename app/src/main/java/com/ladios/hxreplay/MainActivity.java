package com.ladios.hxreplay;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new HxBridge(this), "HxBridge");
        web.loadUrl("file:///android_asset/www/index.html");
        setContentView(web);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 回前台通知网页合并后台 buffer（网页另监听 visibilitychange 双保险）。
        if (web != null) {
            web.evaluateJavascript("window.dispatchEvent(new Event('hxresume'));", null);
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    // 桥接层子线程回调网页用：切回主线程执行 evaluateJavascript。
    public void runOnWeb(final String js) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }
}

