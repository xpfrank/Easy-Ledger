package com.ledger.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 强制 WebView 让出系统状态栏区域，避免部分 MIUI/ColorOS 出现沉浸式
        // 配合 capacitor.config.ts 的 overlaysWebView:false 双重保险
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
