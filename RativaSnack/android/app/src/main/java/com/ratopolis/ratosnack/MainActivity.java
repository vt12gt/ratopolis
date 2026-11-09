package com.ratopolis.ratosnack;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.Uri;

public class MainActivity extends Activity {
    private WebView gameView;

    private void immersive() {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        immersive();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        gameView = new WebView(this);
        gameView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = gameView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        gameView.setWebChromeClient(new WebChromeClient());
        gameView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("file".equals(scheme)) {
                    return uri.getPath() == null || !uri.getPath().startsWith("/android_asset/");
                }
                // Keep HTTPS/WSS-backed game services inside the packaged game.
                return !"https".equals(scheme) && !"http".equals(scheme);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !(url.startsWith("file:///android_asset/")
                        || url.startsWith("https://") || url.startsWith("http://"));
            }
        });
        setContentView(gameView);
        if (savedInstanceState == null) {
            gameView.loadUrl("file:///android_asset/www/index.html");
        } else {
            gameView.restoreState(savedInstanceState);
        }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        if (gameView != null) gameView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override public void onBackPressed() {
        super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (gameView != null) { gameView.destroy(); gameView = null; }
        super.onDestroy();
    }
}
