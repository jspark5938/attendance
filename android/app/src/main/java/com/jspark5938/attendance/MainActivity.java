package com.jspark5938.attendance;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge-to-edge: WebView가 상태바/내비게이션바 뒤까지 그려지도록 설정
        // env(safe-area-inset-top/bottom) 값을 CSS에서 올바르게 사용할 수 있게 됨
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
