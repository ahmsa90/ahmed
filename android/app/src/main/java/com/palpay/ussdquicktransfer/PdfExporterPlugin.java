package com.palpay.ussdquicktransfer;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.os.Build;
import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "PdfExporter")
public class PdfExporterPlugin extends Plugin {
    private static final int PAGE_WIDTH = 842;
    private static final int PAGE_HEIGHT = 595;
    private static final int MARGIN = 28;
    private byte[] pendingPdfBytes;
    private String pendingFileName;
    private Uri pendingUri;

    @PluginMethod
    public void exportRecords(PluginCall call) {
        try {
            JSArray rows = call.getArray("rows", new JSArray());
            String totalPaid = call.getString("totalPaid", "₪ 0");
            String title = call.getString("title", "سجل الحركات");

            PdfDocument document = createPdfDocument(rows, totalPaid, title);
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            document.writeTo(buffer);
            document.close();

            pendingPdfBytes = buffer.toByteArray();
            pendingFileName = "ussd_transactions_" +
                new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) +
                ".pdf";

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_TITLE, pendingFileName);
            startActivityForResult(call, intent, "handleCreatePdfDocumentResult");
        } catch (Exception error) {
            call.reject("تعذر إنشاء ملف PDF.", error);
        }
    }

    @ActivityCallback
    private void handleCreatePdfDocumentResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            clearPendingPdf();
            call.reject("تم إلغاء حفظ ملف PDF.");
            return;
        }

        Uri uri = result.getData().getData();
        try (OutputStream outputStream = getContext().getContentResolver().openOutputStream(uri)) {
            if (outputStream == null || pendingPdfBytes == null) {
                throw new Exception("تعذر فتح ملف PDF.");
            }
            outputStream.write(pendingPdfBytes);
            outputStream.flush();
            pendingUri = uri;
            showExportNotification(uri, pendingFileName);

            JSObject resultObject = new JSObject();
            resultObject.put("fileName", pendingFileName);
            resultObject.put("uri", uri.toString());
            clearPendingPdf();
            call.resolve(resultObject);
        } catch (Exception error) {
            clearPendingPdf();
            call.reject("تعذر حفظ ملف PDF.", error);
        }
    }

    private void clearPendingPdf() {
        pendingPdfBytes = null;
        pendingFileName = null;
        pendingUri = null;
    }

    private void showExportNotification(Uri uri, String fileName) {
        try {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            String channelId = "pdf_exports";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "PDF Exports",
                    NotificationManager.IMPORTANCE_DEFAULT
                );
                manager.createNotificationChannel(channel);
            }

            Intent openIntent = new Intent(Intent.ACTION_VIEW);
            openIntent.setDataAndType(uri, "application/pdf");
            openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                getContext(),
                9821,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new android.app.Notification.Builder(getContext(), channelId)
                : new android.app.Notification.Builder(getContext());

            builder
                .setSmallIcon(getContext().getApplicationInfo().icon)
                .setContentTitle("تم تصدير ملف سجل الحركات PDF")
                .setContentText(fileName)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

            manager.notify(9821, builder.build());
        } catch (Exception ignored) {
            // Export succeeded even if notification failed.
        }
    }

    private PdfDocument createPdfDocument(JSArray rows, String totalPaid, String title) throws Exception {
        PdfDocument document = new PdfDocument();
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        paint.setTextAlign(Paint.Align.CENTER);

        TextPaint textPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        textPaint.setTextAlign(Paint.Align.LEFT);

        int pageNumber = 1;
        PdfDocument.Page page = startPage(document, pageNumber);
        Canvas canvas = page.getCanvas();
        int y = drawHeader(canvas, paint, title);
        y = drawTableHeader(canvas, paint, y);

        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.getJSONObject(i);
            String details = row.optString("details", "");
            int rowHeight = Math.max(38, calculateDetailsHeight(details, 150, textPaint) + 14);

            if (y + rowHeight + 48 > PAGE_HEIGHT - MARGIN) {
                document.finishPage(page);
                pageNumber++;
                page = startPage(document, pageNumber);
                canvas = page.getCanvas();
                y = drawHeader(canvas, paint, title);
                y = drawTableHeader(canvas, paint, y);
            }

            drawRow(canvas, paint, textPaint, row, y, rowHeight);
            y += rowHeight;
        }

        drawFooter(canvas, paint, totalPaid, y + 10);
        document.finishPage(page);
        return document;
    }

    private PdfDocument.Page startPage(PdfDocument document, int pageNumber) {
        PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
        return document.startPage(pageInfo);
    }

    private int drawHeader(Canvas canvas, Paint paint, String title) {
        paint.setColor(Color.rgb(15, 118, 110));
        paint.setStyle(Paint.Style.FILL);
        paint.setTextSize(24);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        canvas.drawText(title, PAGE_WIDTH / 2f, 40, paint);

        paint.setColor(Color.rgb(71, 85, 105));
        paint.setTextSize(12);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        canvas.drawText("البيانات الظاهرة وقت التصدير", PAGE_WIDTH / 2f, 60, paint);
        return 78;
    }

    private int drawTableHeader(Canvas canvas, Paint paint, int y) {
        int[] widths = {42, 120, 90, 130, 95, 199, 110};
        String[] headers = {"م", "رقم الموبايل", "المبلغ", "التاريخ والوقت", "نوع المحفظة", "تفاصيل العملية", "الحالة"};
        int x = PAGE_WIDTH - MARGIN;

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.rgb(15, 118, 110));
        canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + 28, paint);

        paint.setTextSize(11);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        paint.setColor(Color.WHITE);

        for (int i = 0; i < headers.length; i++) {
            int width = widths[i];
            float center = x - width / 2f;
            canvas.drawText(headers[i], center, y + 18, paint);
            x -= width;
        }
        return y + 28;
    }

    private void drawRow(Canvas canvas, Paint paint, TextPaint textPaint, JSONObject row, int y, int rowHeight) {
        int[] widths = {42, 120, 90, 130, 95, 199, 110};
        String[] values = {
            String.valueOf(row.optInt("serial")),
            row.optString("phone"),
            row.optString("amount"),
            row.optString("date") + "\n" + row.optString("time"),
            row.optString("wallet"),
            row.optString("details"),
            row.optString("status")
        };

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1);
        paint.setColor(Color.rgb(203, 213, 225));
        canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + rowHeight, paint);

        int x = PAGE_WIDTH - MARGIN;
        for (int i = 0; i < values.length; i++) {
            int width = widths[i];
            int left = x - width;
            int right = x;
            canvas.drawRect(left, y, right, y + rowHeight, paint);

            textPaint.setColor(Color.rgb(15, 23, 42));
            textPaint.setTextSize(i == 2 ? 13 : 11);
            textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, i == 2 ? Typeface.BOLD : Typeface.NORMAL));
            drawMultilineText(canvas, values[i], left + 4, y, width - 8, rowHeight, textPaint);
            x -= width;
        }
    }

    private int calculateDetailsHeight(String text, int width, TextPaint paint) {
        textPaintSetup(paint, 11, false);
        StaticLayout layout = buildLayout(text == null ? "" : text, width, paint);
        return layout.getHeight();
    }

    private void drawMultilineText(Canvas canvas, String text, int left, int top, int width, int height, TextPaint paint) {
        StaticLayout layout = buildLayout(text == null ? "" : text, width, paint);
        canvas.save();
        float translateY = top + Math.max(0, (height - layout.getHeight()) / 2f);
        canvas.translate(left, translateY);
        layout.draw(canvas);
        canvas.restore();
    }

    private StaticLayout buildLayout(String text, int width, TextPaint paint) {
        return StaticLayout.Builder.obtain(text, 0, text.length(), paint, width)
            .setAlignment(Layout.Alignment.ALIGN_CENTER)
            .setIncludePad(false)
            .setTextDirection(TextDirectionHeuristics.RTL)
            .build();
    }

    private void textPaintSetup(TextPaint paint, int size, boolean bold) {
        paint.setTextSize(size);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, bold ? Typeface.BOLD : Typeface.NORMAL));
        paint.setTextAlign(Paint.Align.LEFT);
    }

    private void drawFooter(Canvas canvas, Paint paint, String totalPaid, int y) {
        int footerY = Math.min(y, PAGE_HEIGHT - 34);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.rgb(220, 252, 231));
        canvas.drawRoundRect(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY + 28, 10, 10, paint);
        paint.setTextSize(13);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        paint.setColor(Color.rgb(20, 83, 45));
        canvas.drawText("مجموع النفقات المدفوعة: " + totalPaid, PAGE_WIDTH / 2f, footerY + 19, paint);
    }
}
