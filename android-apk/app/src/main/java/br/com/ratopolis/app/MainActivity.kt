package br.com.ratopolis.app

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.Window
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.LinearLayout
import android.view.Gravity
import android.view.ViewGroup
import android.content.Intent
import android.net.Uri

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var root: FrameLayout
    private lateinit var errorPanel: LinearLayout

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(16, 13, 29)
        window.navigationBarColor = Color.rgb(9, 6, 17)

        root = FrameLayout(this)
        root.setBackgroundColor(Color.rgb(9, 6, 17))

        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(9, 6, 17))
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.loadsImagesAutomatically = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val host = uri.host ?: return false
                if (host == "vt12gt.github.io" || host.endsWith(".workers.dev")) return false
                if (uri.scheme == "https" || uri.scheme == "http") {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
                return false
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showError()
            }
        }

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        progress.max = 100
        progress.progressTintList = android.content.res.ColorStateList.valueOf(Color.rgb(189, 105, 255))
        progress.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP
        )
        root.addView(webView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ))
        root.addView(progress)
        buildErrorPanel()
        setContentView(root)

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun buildErrorPanel() {
        errorPanel = LinearLayout(this)
        errorPanel.orientation = LinearLayout.VERTICAL
        errorPanel.gravity = Gravity.CENTER
        errorPanel.setPadding(dp(28), dp(24), dp(28), dp(24))
        errorPanel.setBackgroundColor(Color.rgb(9, 6, 17))
        val title = TextView(this)
        title.text = "Sem conexão com Ratópolis"
        title.setTextColor(Color.WHITE)
        title.textSize = 22f
        title.gravity = Gravity.CENTER
        val detail = TextView(this)
        detail.text = "Confira sua internet e tente novamente."
        detail.setTextColor(Color.LTGRAY)
        detail.textSize = 15f
        detail.gravity = Gravity.CENTER
        detail.setPadding(0, dp(12), 0, dp(20))
        val retry = TextView(this)
        retry.text = "TENTAR NOVAMENTE"
        retry.setTextColor(Color.WHITE)
        retry.textSize = 15f
        retry.gravity = Gravity.CENTER
        retry.setPadding(dp(18), dp(12), dp(18), dp(12))
        retry.setBackgroundColor(Color.rgb(120, 43, 255))
        retry.setOnClickListener {
            errorPanel.visibility = View.GONE
            webView.loadUrl(APP_URL)
        }
        errorPanel.addView(title)
        errorPanel.addView(detail)
        errorPanel.addView(retry)
        errorPanel.visibility = View.GONE
        root.addView(errorPanel, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ))
    }

    private fun showError() {
        runOnUiThread {
            errorPanel.visibility = View.VISIBLE
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val APP_URL = "https://vt12gt.github.io/ratopolis/pwa/"
    }
}
