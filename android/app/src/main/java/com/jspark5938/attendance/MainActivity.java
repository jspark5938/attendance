package com.jspark5938.attendance;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private volatile int bannerHeightPx = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WebView webView = getBridge().getWebView();

        // JS에서 AdMob 배너 높이를 전달받아 WebView 패딩 재계산
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setBannerHeight(int heightPx) {
                bannerHeightPx = heightPx;
                webView.post(() -> webView.requestApplyInsets());
            }
        }, "AndroidBridge");

        // 시스템 바(네비게이션 바) + 배너 높이만큼 WebView 하단 패딩 적용
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets navInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            v.setPadding(
                v.getPaddingLeft(),
                v.getPaddingTop(),
                v.getPaddingRight(),
                navInsets.bottom + bannerHeightPx
            );
            return insets;
        });
    }
}
