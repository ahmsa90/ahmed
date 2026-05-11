const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const codeOutput = document.getElementById('codeOutput');
const message = document.getElementById('message');
const callButton = document.getElementById('callButton');
const copyCodeButton = document.getElementById('copyCode');
const pickContactButton = document.getElementById('pickContact');
const openHistoryButton = document.getElementById('openHistory');
const backToTransferButton = document.getElementById('backToTransfer');
const transferView = document.getElementById('transferView');
const historyView = document.getElementById('historyView');
const recordsBody = document.getElementById('recordsBody');
const emptyState = document.getElementById('emptyState');
const completedTotal = document.getElementById('completedTotal');
const toggleFiltersButton = document.getElementById('toggleFilters');
const filtersPanel = document.getElementById('filtersPanel');
const exportExcelButton = document.getElementById('exportExcel');
const clearFiltersButton = document.getElementById('clearFilters');

const filterFrom = document.getElementById('filterFrom');
const filterTo = document.getElementById('filterTo');
const amountFrom = document.getElementById('amountFrom');
const amountTo = document.getElementById('amountTo');
const statusFilter = document.getElementById('statusFilter');

const STORAGE_KEY = 'ussd_quick_transfer_records_v1';
let records = loadRecords();

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function normalizeArabicDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

function normalizePhone(value) {
  let v = normalizeArabicDigits(value).replace(/[^0-9+]/g, '');

  if (v.startsWith('+970')) v = '0' + v.slice(4);
  else if (v.startsWith('+972')) v = '0' + v.slice(4);
  else if (v.startsWith('00970')) v = '0' + v.slice(5);
  else if (v.startsWith('00972')) v = '0' + v.slice(5);
  else if (v.startsWith('970')) v = '0' + v.slice(3);
  else if (v.startsWith('972')) v = '0' + v.slice(3);

  v = v.replace(/\D/g, '');

  if (v.length > 10) {
    const match = v.match(/(05[69][0-9]{7})$/);
    if (match) v = match[1];
  }

  return v.slice(0, 10);
}

function validatePhone(phone) {
  return /^(059|056)\d{7}$/.test(phone);
}

function validateAmount(amount) {
  if (amount === '') return false;
  const n = Number(normalizeArabicDigits(amount));
  return Number.isInteger(n) && n >= 1 && n <= 1000;
}

function getAmountValue() {
  return Number(normalizeArabicDigits(amountInput.value).trim());
}

function getCode(phone, amount) {
  return `*370*1*1*${phone}*${Number(amount)}#`;
}

function generateCode({ showErrors = true } = {}) {
  const phone = normalizePhone(phoneInput.value);
  const amountRaw = normalizeArabicDigits(amountInput.value).trim();

  if (phoneInput.value !== phone) phoneInput.value = phone;
  if (amountInput.value !== amountRaw) amountInput.value = amountRaw;

  if (!phone || !amountRaw) {
    codeOutput.value = '';
    setMessage('');
    return false;
  }

  if (!validatePhone(phone)) {
    codeOutput.value = '';
    if (showErrors) setMessage('رقم الجوال يجب أن يكون 10 خانات ويبدأ بـ 059 أو 056.', 'error');
    return false;
  }

  if (!validateAmount(amountRaw)) {
    codeOutput.value = '';
    if (showErrors) setMessage('المبلغ يجب أن يكون رقماً صحيحاً من 1 إلى 1000.', 'error');
    return false;
  }

  codeOutput.value = getCode(phone, amountRaw);
  setMessage('الكود جاهز.');
  message.className = 'message ok';
  return true;
}

phoneInput.addEventListener('input', () => generateCode({ showErrors: false }));
amountInput.addEventListener('input', () => generateCode({ showErrors: false }));
phoneInput.addEventListener('blur', () => generateCode({ showErrors: true }));
amountInput.addEventListener('blur', () => generateCode({ showErrors: true }));

async function handlePickedPhone(rawPhone) {
  const normalized = normalizePhone(rawPhone);
  phoneInput.value = normalized;

  if (!validatePhone(normalized)) {
    codeOutput.value = '';
    setMessage('الرقم المختار يجب أن يبدأ بـ 059 أو 056 ويتكون من 10 خانات.', 'error');
    return;
  }

  generateCode({ showErrors: true });
  setMessage('تم اختيار الرقم وتجهيزه.', 'ok');
}

pickContactButton.addEventListener('click', async () => {
  try {
    const nativePicker = window.Capacitor?.Plugins?.ContactPicker;

    if (nativePicker?.pickPhoneNumber) {
      const result = await nativePicker.pickPhoneNumber();
      if (!result?.phone) {
        setMessage('لم يتم اختيار رقم من جهة الاتصال.', 'error');
        return;
      }
      await handlePickedPhone(result.phone);
      return;
    }

    if ('contacts' in navigator && 'ContactsManager' in window) {
      const contacts = await navigator.contacts.select(['tel'], { multiple: false });
      const tel = contacts?.[0]?.tel?.[0];
      if (!tel) {
        setMessage('لم يتم اختيار رقم من جهة الاتصال.', 'error');
        return;
      }
      await handlePickedPhone(tel);
      return;
    }

    setMessage('اختيار جهات الاتصال غير مدعوم على هذا الجهاز.', 'error');
  } catch (error) {
    setMessage('تم إلغاء اختيار جهة الاتصال أو لم يتم منح الإذن.', 'error');
  }
});

copyCodeButton.addEventListener('click', async () => {
  if (!generateCode({ showErrors: true })) return;
  await copyToClipboard(codeOutput.value);
  setMessage('تم نسخ الكود.', 'ok');
});

callButton.addEventListener('click', () => {
  if (!generateCode({ showErrors: true })) return;
  const phone = normalizePhone(phoneInput.value);
  const amount = getAmountValue();
  const code = getCode(phone, amount);
  createRecord(phone, amount, code);
  renderRecords();
  window.location.href = `tel:${encodeURIComponent(code)}`;
});

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
  }
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createRecord(phone, amount, code) {
  const now = new Date();
  records.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    phone,
    amount: Number(amount),
    code,
    createdAt: now.toISOString(),
    details: '',
    status: 'incomplete'
  });
  saveRecords();
}

function formatDateParts(iso) {
  const date = new Date(iso);
  const dateText = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const timeText = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return { dateText, timeText };
}

function amountText(amount) {
  return `₪ ${Number(amount).toLocaleString('en-US')}`;
}

function showView(viewName) {
  const showHistory = viewName === 'history';
  transferView.classList.toggle('active-view', !showHistory);
  historyView.classList.toggle('active-view', showHistory);
  document.querySelector('.app-shell').style.width = showHistory ? 'min(1180px, 100%)' : 'min(480px, 100%)';
  if (showHistory) renderRecords();
}

openHistoryButton.addEventListener('click', () => showView('history'));
backToTransferButton.addEventListener('click', () => showView('transfer'));

toggleFiltersButton.addEventListener('click', () => {
  filtersPanel.hidden = !filtersPanel.hidden;
});

[filterFrom, filterTo, amountFrom, amountTo, statusFilter].forEach(el => {
  el.addEventListener('input', renderRecords);
  el.addEventListener('change', renderRecords);
});

clearFiltersButton.addEventListener('click', () => {
  filterFrom.value = '';
  filterTo.value = '';
  amountFrom.value = '';
  amountTo.value = '';
  statusFilter.value = 'all';
  renderRecords();
});

function getFilteredRecords() {
  const fromDate = filterFrom.value ? new Date(`${filterFrom.value}T00:00:00`) : null;
  const toDate = filterTo.value ? new Date(`${filterTo.value}T23:59:59`) : null;
  const minAmount = amountFrom.value ? Number(amountFrom.value) : null;
  const maxAmount = amountTo.value ? Number(amountTo.value) : null;
  const status = statusFilter.value;

  return records.filter(record => {
    const date = new Date(record.createdAt);
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    if (minAmount !== null && record.amount < minAmount) return false;
    if (maxAmount !== null && record.amount > maxAmount) return false;
    if (status !== 'all' && record.status !== status) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderRecords() {
  const filtered = getFilteredRecords();
  recordsBody.innerHTML = '';
  emptyState.classList.toggle('show', filtered.length === 0);

  filtered.forEach((record, index) => {
    const { dateText, timeText } = formatDateParts(record.createdAt);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="serial-cell">${index + 1}</td>
      <td class="phone-cell">${record.phone}</td>
      <td><span class="amount-badge">${amountText(record.amount)}</span></td>
      <td><span class="date-time"><span class="date">${dateText}</span><span class="time">${timeText}</span></span></td>
      <td><input class="details-input" type="text" value="${escapeHtml(record.details || '')}" placeholder="اكتب ماذا اشتريت..." data-id="${record.id}" /></td>
      <td>
        <select class="status-select ${record.status === 'completed' ? 'completed' : 'incomplete'}" data-id="${record.id}">
          <option value="completed" ${record.status === 'completed' ? 'selected' : ''}>مكتملة</option>
          <option value="incomplete" ${record.status === 'incomplete' ? 'selected' : ''}>غير مكتملة</option>
        </select>
      </td>
      <td><button class="delete-btn" type="button" data-id="${record.id}" title="حذف">×</button></td>
    `;
    recordsBody.appendChild(tr);
  });

  bindRecordEvents();
  updateCompletedTotal();
}

function bindRecordEvents() {
  document.querySelectorAll('.details-input').forEach(input => {
    input.addEventListener('input', e => {
      const record = records.find(r => r.id === e.target.dataset.id);
      if (!record) return;
      record.details = e.target.value;
      saveRecords();
    });
  });

  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', e => {
      const record = records.find(r => r.id === e.target.dataset.id);
      if (!record) return;
      record.status = e.target.value;
      e.target.classList.toggle('completed', record.status === 'completed');
      e.target.classList.toggle('incomplete', record.status === 'incomplete');
      saveRecords();
      updateCompletedTotal();
    });
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      records = records.filter(record => record.id !== id);
      saveRecords();
      renderRecords();
    });
  });
}

function updateCompletedTotal() {
  const total = records
    .filter(record => record.status === 'completed')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  completedTotal.textContent = amountText(total);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusArabic(status) {
  return status === 'completed' ? 'مكتملة' : 'غير مكتملة';
}

function exportToExcel() {
  const exportRows = getFilteredRecords();
  const totalCompleted = records
    .filter(record => record.status === 'completed')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  const rowsHtml = exportRows.map((record, index) => {
    const { dateText, timeText } = formatDateParts(record.createdAt);
    return `
      <tr>
        <td>${index + 1}</td>
        <td style="mso-number-format:'\\@';">${record.phone}</td>
        <td>${amountText(record.amount)}</td>
        <td>${dateText}<br>${timeText}</td>
        <td>${escapeHtml(record.details || '')}</td>
        <td>${statusArabic(record.status)}</td>
      </tr>`;
  }).join('');

  const html = `
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Tahoma, Arial, sans-serif; direction: rtl; }
        th { background: #0f766e; color: white; font-weight: bold; }
        td, th { border: 1px solid #94a3b8; padding: 9px; text-align: center; }
        .total { background: #dcfce7; color: #14532d; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th>م</th>
            <th>رقم الموبايل</th>
            <th>المبلغ</th>
            <th>التاريخ والوقت</th>
            <th>تفاصيل العملية</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr class="total"><td colspan="2">مجموع النفقات المكتملة</td><td colspan="4">${amountText(totalCompleted)}</td></tr>
        </tfoot>
      </table>
    </body>
    </html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ussd_transactions_${stamp}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

exportExcelButton.addEventListener('click', exportToExcel);

renderRecords();
generateCode({ showErrors: false });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}
