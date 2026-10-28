package br.com.ratopolis.app

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.animation.ObjectAnimator
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
    private lateinit var splashPanel: FrameLayout
    private lateinit var splashProgress: ProgressBar

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
                if (::splashProgress.isInitialized) splashProgress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
                if (newProgress >= 100) hideSplash()
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
        buildSplashPanel()
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
            splashPanel.visibility = View.VISIBLE
            splashPanel.alpha = 1f
            progress.visibility = View.VISIBLE
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

    private fun buildSplashPanel() {
        splashPanel = FrameLayout(this)
        splashPanel.background = GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.rgb(66, 27, 100), Color.rgb(25, 13, 42), Color.rgb(9, 6, 17))
        )

        val content = LinearLayout(this)
        content.orientation = LinearLayout.VERTICAL
        content.gravity = Gravity.CENTER
        content.setPadding(dp(28), dp(24), dp(28), dp(24))

        val mascot = TextView(this)
        mascot.text = "🐭"
        mascot.textSize = 76f
        mascot.gravity = Gravity.CENTER
        mascot.setShadowLayer(dp(18).toFloat(), 0f, 0f, Color.rgb(189, 105, 255))
        content.addView(mascot, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(8) })
        ObjectAnimator.ofFloat(mascot, "translationY", 0f, -dp(9).toFloat(), 0f).apply {
            duration = 1450
            repeatCount = ObjectAnimator.INFINITE
            start()
        }

        val title = TextView(this)
        title.text = "RATÓPOLIS"
        title.setTextColor(Color.rgb(255, 224, 122))
        title.textSize = 30f
        title.typeface = android.graphics.Typeface.DEFAULT_BOLD
        title.letterSpacing = 0.12f
        title.gravity = Gravity.CENTER
        content.addView(title)

        val subtitle = TextView(this)
        subtitle.text = "SUA PRÓXIMA AVENTURA COMEÇA AQUI"
        subtitle.setTextColor(Color.rgb(218, 197, 239))
        subtitle.textSize = 10f
        subtitle.letterSpacing = 0.08f
        subtitle.gravity = Gravity.CENTER
        subtitle.setPadding(0, dp(5), 0, dp(28))
        content.addView(subtitle)

        val loading = TextView(this)
        loading.text = "Preparando a toca..."
        loading.setTextColor(Color.WHITE)
        loading.textSize = 13f
        loading.gravity = Gravity.CENTER
        content.addView(loading)

        splashProgress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        splashProgress.max = 100
        splashProgress.progressTintList = android.content.res.ColorStateList.valueOf(Color.rgb(255, 214, 91))
        splashProgress.progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(76, 52, 96))
        content.addView(splashProgress, LinearLayout.LayoutParams(
            dp(230), dp(4)
        ).apply { topMargin = dp(12) })

        splashPanel.addView(content, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER
        ))
        root.addView(splashPanel, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ))
    }

    private fun hideSplash() {
        if (!::splashPanel.isInitialized || splashPanel.visibility != View.VISIBLE) return
        splashPanel.animate().alpha(0f).setDuration(320).withEndAction {
            splashPanel.visibility = View.GONE
            splashPanel.alpha = 1f
        }.start()
    }

    private fun showError() {
        runOnUiThread {
            if (::splashPanel.isInitialized) splashPanel.visibility = View.GONE
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
