package com.palpay.ussdquicktransfer;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import androidx.activity.result.ActivityResult;

@CapacitorPlugin(
    name = "ContactPicker",
    permissions = {
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS })
    }
)
public class ContactPickerPlugin extends Plugin {


    @PluginMethod
    public void pickPhoneNumber(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contactsPermissionCallback");
            return;
        }
        launchPicker(call);
    }

    @PermissionCallback
    private void contactsPermissionCallback(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            launchPicker(call);
        } else {
            call.reject("تم رفض إذن الوصول إلى جهات الاتصال.");
        }
    }

    private void launchPicker(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
        startActivityForResult(call, intent, "handlePickedContact");
    }

    @ActivityCallback
    private void handlePickedContact(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("تم إلغاء اختيار جهة الاتصال.");
            return;
        }

        Uri contactUri = result.getData().getData();
        if (contactUri == null) {
            call.reject("لم يتم العثور على رقم جهة الاتصال.");
            return;
        }

        String[] projection = new String[] {
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME
        };

        try (Cursor cursor = getContext().getContentResolver().query(contactUri, projection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                int nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                String number = numberIndex >= 0 ? cursor.getString(numberIndex) : null;
                String name = nameIndex >= 0 ? cursor.getString(nameIndex) : "";
                if (number != null && !number.isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("phone", number);
                    ret.put("name", name == null ? "" : name);
                    call.resolve(ret);
                    return;
                }
            }
        } catch (Exception error) {
            call.reject("تعذر قراءة رقم جهة الاتصال.", error);
            return;
        }

        call.reject("لم يتم العثور على رقم صالح في جهة الاتصال.");
    }
}
