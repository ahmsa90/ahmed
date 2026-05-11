# خدمة التحويل السريع USSD

مشروع Android APK مبني باستخدام Capacitor من واجهة HTML/CSS/JavaScript.

## ما يحتويه المشروع
- ملفات الواجهة داخل `www/`
- مشروع Android داخل `android/`
- بناء APK تلقائي عبر GitHub Actions
- اختيار رقم واحد من جهات الاتصال على Android
- عمل التطبيق بدون إنترنت لأن ملفات الواجهة مدمجة داخل التطبيق
- حفظ سجل الحركات محلياً على الهاتف

## رفع المشروع إلى GitHub
1. أنشئ مستودعاً جديداً على GitHub.
2. ارفع كل محتويات هذا المجلد إلى المستودع.
3. ادخل إلى تبويب **Actions**.
4. شغّل Workflow باسم **Build Android APK** أو ادفع أي تعديل إلى فرع `main`.
5. بعد اكتمال البناء، حمّل الملف من قسم **Artifacts** باسم `ussd-quick-transfer-apk`.

## أوامر مفيدة محلياً
```bash
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```

ملف APK الناتج محلياً سيكون في:
`android/app/build/outputs/apk/debug/app-debug.apk`
