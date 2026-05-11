package com.palpay.ussdquicktransfer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ContactPickerPlugin.class);
        registerPlugin(ScreenModePlugin.class);
        registerPlugin(PdfExporterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
