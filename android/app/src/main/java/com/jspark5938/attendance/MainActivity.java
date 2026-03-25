package com.jspark5938.attendance;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private volatile int navBarHeightPx = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // WebView 리스너는 건드리지 않음 (Capacitor 내부 리스너 유지 → env() CSS 정상 동작)
        // 루트 콘텐츠뷰에서 네비게이션 바 높이만 캐시하고 인셋을 소비하지 않고 전파
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (v, insets) -> {
            navBarHeightPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            return insets; // 소비하지 않음 → 자식(WebView)에 전파되어 env() 유지
        });

        // JS에서 네비게이션 바 높이를 조회 (AdMob 배너 margin 계산용)
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public int getNavBarHeight() {
                return navBarHeightPx;
            }
        }, "AndroidBridge");
    }
}
