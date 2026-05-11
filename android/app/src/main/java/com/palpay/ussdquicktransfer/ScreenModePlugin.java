package com.palpay.ussdquicktransfer;

import android.content.pm.ActivityInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenMode")
public class ScreenModePlugin extends Plugin {
    @PluginMethod
    public void lockLandscape(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void lockPortrait(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        call.resolve(new JSObject());
    }
}
