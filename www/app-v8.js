const STORAGE_KEY = 'ussdTransactionRecords';
const WALLET_KEY = 'selectedWallet';
const PENDING_PAYMENT_CONFIRMATION_KEY = 'pendingPaymentConfirmationRecordId';
const PAYMENT_NOTIFICATION_ACTION_TYPE = 'payment_status_actions';
const PAYMENT_NOTIFICATION_PAID_ACTION = 'payment_paid';
const PAYMENT_NOTIFICATION_UNPAID_ACTION = 'payment_unpaid';

const phoneInput = document.getElementById('phone');
const amountInput = document.getElementById('amount');
const movementDetailsInput = document.getElementById('movementDetails');
const phoneError = document.getElementById('phoneError');
const contactSuccess = document.getElementById('contactSuccess');
const amountError = document.getElementById('amountError');
const callButton = document.getElementById('callButton');
const clearFieldsButton = document.getElementById('clearFields');
const pickContactButton = document.getElementById('pickContact');
const palpayWalletButton = document.getElementById('palpayWallet');
const jawwalWalletButton = document.getElementById('jawwalWallet');
const openHistoryButton = document.getElementById('openHistory');
const transferView = document.getElementById('transferView');
const historyView = document.getElementById('historyView');
const backToTransferButton = document.getElementById('backToTransfer');
const toggleFiltersButton = document.getElementById('toggleFilters');
const filtersPanel = document.getElementById('filtersPanel');
const filterFrom = document.getElementById('filterFrom');
const filterTo = document.getElementById('filterTo');
const amountFrom = document.getElementById('amountFrom');
const amountTo = document.getElementById('amountTo');
const walletFilter = document.getElementById('walletFilter');
const statusFilter = document.getElementById('statusFilter');
const clearFiltersButton = document.getElementById('clearFilters');
const recordsBody = document.getElementById('recordsBody');
const emptyState = document.getElementById('emptyState');
const paidTotal = document.getElementById('paidTotal');
const exportPdfButton = document.getElementById('exportPdf');
const toast = document.getElementById('toast');
const paymentConfirmModal = document.getElementById('paymentConfirmModal');
const paymentConfirmYesButton = document.getElementById('paymentConfirmYes');
const paymentConfirmNoButton = document.getElementById('paymentConfirmNo');
const duplicateModal = document.getElementById('duplicateModal');
const confirmDuplicateYesButton = document.getElementById('confirmDuplicateYes');
const confirmDuplicateNoButton = document.getElementById('confirmDuplicateNo');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const confirmDeleteYesButton = document.getElementById('confirmDeleteYes');
const confirmDeleteNoButton = document.getElementById('confirmDeleteNo');

let records = migrateRecords(loadRecords());
let selectedWallet = loadSelectedWallet();
let selectedContactName = '';
let toastTimer;
let pendingDuplicatePayload = null;
let pendingDeleteResolver = null;
let transferValidationAttempted = false;
let pendingPaymentConfirmationRecordId = localStorage.getItem(PENDING_PAYMENT_CONFIRMATION_KEY) || '';

function askDeleteConfirmation() {
  return new Promise(resolve => {
    pendingDeleteResolver = resolve;
    deleteConfirmModal.hidden = false;
  });
}

confirmDeleteYesButton?.addEventListener('click', () => {
  deleteConfirmModal.hidden = true;
  if (pendingDeleteResolver) pendingDeleteResolver(true);
  pendingDeleteResolver = null;
});

confirmDeleteNoButton?.addEventListener('click', () => {
  deleteConfirmModal.hidden = true;
  if (pendingDeleteResolver) pendingDeleteResolver(false);
  pendingDeleteResolver = null;
});

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

function normalizeAmount(value) {
  const normalized = normalizeArabicDigits(value)
    .replace(/[٬,]/g, '.')
    .replace(/[^0-9.]/g, '');
  const firstDot = normalized.indexOf('.');
  if (firstDot === -1) return normalized;
  return normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, '');
}

function validateAmount(amount) {
  if (amount === '') return false;
  const n = Number(normalizeAmount(amount));
  return Number.isFinite(n) && n >= 1 && n <= 1000;
}

function getAmountValue() {
  return Number(normalizeAmount(amountInput.value).trim());
}

function getCode(phone, amount, wallet = selectedWallet) {
  return wallet === 'jawwal'
    ? `*268*1*${phone}*${Number(amount)}#`
    : `*370*1*1*${phone}*${Number(amount)}#`;
}

function walletArabic(wallet) {
  return wallet === 'jawwal' ? 'جوال بى' : 'بال بى';
}

function setFieldError(element, text = '') {
  element.textContent = text;
}

function showToast(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function loadSelectedWallet() {
  const saved = localStorage.getItem(WALLET_KEY);
  return saved === 'jawwal' ? 'jawwal' : 'palpay';
}

function saveSelectedWallet() {
  localStorage.setItem(WALLET_KEY, selectedWallet);
}

function updateWalletButtons() {
  const palpayActive = selectedWallet === 'palpay';
  palpayWalletButton.classList.toggle('active', palpayActive);
  jawwalWalletButton.classList.toggle('active', !palpayActive);
  palpayWalletButton.setAttribute('aria-pressed', String(palpayActive));
  jawwalWalletButton.setAttribute('aria-pressed', String(!palpayActive));
  document.body.classList.toggle('wallet-palpay', palpayActive);
  document.body.classList.toggle('wallet-jawwal', !palpayActive);
}

function selectWallet(wallet) {
  selectedWallet = wallet === 'jawwal' ? 'jawwal' : 'palpay';
  saveSelectedWallet();
  updateWalletButtons();
  generateCode();
}

palpayWalletButton.addEventListener('click', () => selectWallet('palpay'));
jawwalWalletButton.addEventListener('click', () => selectWallet('jawwal'));

function generateCode({ validateForTransfer = false } = {}) {
  const phone = normalizePhone(phoneInput.value);
  const amountRaw = normalizeAmount(amountInput.value).trim();

  if (phoneInput.value !== phone) phoneInput.value = phone;
  if (amountInput.value !== amountRaw) amountInput.value = amountRaw;

  const shouldShowErrors = validateForTransfer === true;

  if (!phone || !amountRaw) {
    if (shouldShowErrors) {
      setFieldError(phoneError, !phone ? 'أدخل رقم الموبايل.' : '');
      setFieldError(amountError, !amountRaw ? 'أدخل المبلغ.' : '');

      if (!phone && !amountRaw) showToast('أدخل رقم الموبايل والمبلغ.');
      else if (!phone) showToast('أدخل رقم الموبايل.');
      else showToast('أدخل المبلغ.');
    } else {
      setFieldError(phoneError, '');
      setFieldError(amountError, '');
    }

    phoneInput.classList.toggle('input-invalid', !phone && shouldShowErrors);
    amountInput.classList.toggle('input-invalid', !amountRaw && shouldShowErrors);
    return false;
  }

  let valid = true;

  if (!validatePhone(phone)) {
    if (shouldShowErrors) {
      setFieldError(phoneError, 'رقم الجوال يجب أن يكون 10 خانات ويبدأ بـ 059 أو 056.');
      phoneInput.classList.add('input-invalid');
    } else {
      setFieldError(phoneError, '');
      phoneInput.classList.remove('input-invalid');
    }
    valid = false;
  } else {
    setFieldError(phoneError, '');
    phoneInput.classList.remove('input-invalid');
  }

  if (!validateAmount(amountRaw)) {
    if (shouldShowErrors) {
      setFieldError(amountError, 'المبلغ يجب أن يكون من 1 إلى 1000، ويمكن أن يحتوي على فاصلة عشرية.');
      amountInput.classList.add('input-invalid');
    } else {
      setFieldError(amountError, '');
      amountInput.classList.remove('input-invalid');
    }
    valid = false;
  } else {
    setFieldError(amountError, '');
    amountInput.classList.remove('input-invalid');
  }

  return valid;
}

phoneInput.addEventListener('input', () => {
  selectedContactName = '';
  contactSuccess.textContent = '';
  phoneInput.classList.remove('input-invalid');
  generateCode();
});
amountInput.addEventListener('input', () => {
  amountInput.classList.remove('input-invalid');
  generateCode();
});

movementDetailsInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    movementDetailsInput.blur();
  }
});

amountInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    amountInput.blur();
  }
});
clearFieldsButton.addEventListener('click', () => {
  phoneInput.value = '';
  amountInput.value = '';
  movementDetailsInput.value = '';
  selectedContactName = '';
  contactSuccess.textContent = '';
  setFieldError(phoneError, '');
  setFieldError(amountError, '');
  phoneInput.blur();
  amountInput.blur();
  movementDetailsInput.blur();
});

async function handlePickedPhone(rawPhone, rawName = '') {
  const normalized = normalizePhone(rawPhone);
  phoneInput.value = normalized;

  if (!validatePhone(normalized)) {
    contactSuccess.textContent = '';
    setFieldError(phoneError, 'الرقم المختار يجب أن يبدأ بـ 059 أو 056 ويتكون من 10 خانات.');
    return;
  }

  setFieldError(phoneError, '');
  selectedContactName = String(rawName || '').trim();
  if (selectedContactName) {
    contactSuccess.innerHTML = `سيتم التحويل إلى <strong>${escapeHtml(selectedContactName)}</strong>`;
  } else {
    contactSuccess.textContent = 'تم الاختيار من جهات الاتصال';
  }
  phoneInput.classList.remove('input-invalid');
  amountInput.classList.remove('input-invalid');
  setFieldError(amountError, '');
  generateCode();
}

pickContactButton.addEventListener('click', async () => {
  try {
    const nativePicker = window.Capacitor?.Plugins?.ContactPicker;

    if (nativePicker?.pickPhoneNumber) {
      const result = await nativePicker.pickPhoneNumber();
      if (!result?.phone) {
        showToast('لم يتم اختيار رقم من جهة الاتصال.');
        return;
      }
      await handlePickedPhone(result.phone, result.name || '');
      return;
    }

    if ('contacts' in navigator && 'ContactsManager' in window) {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      const tel = contacts?.[0]?.tel?.[0];
      if (!tel) {
        showToast('لم يتم اختيار رقم من جهة الاتصال.');
        return;
      }
      await handlePickedPhone(tel, contacts?.[0]?.name?.[0] || '');
      return;
    }

    showToast('اختيار جهات الاتصال غير مدعوم على هذا الجهاز.');
  } catch (error) {
    showToast('تم إلغاء اختيار جهة الاتصال أو لم يتم منح الإذن.');
  }
});



function normalizeMovementDetails(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isConsecutiveDuplicate(phone, amount, wallet, details) {
  const latest = records[0];
  if (!latest) return false;
  return latest.phone === phone
    && Number(latest.amount) === Number(amount)
    && latest.wallet === wallet
    && normalizeMovementDetails(latest.details) === normalizeMovementDetails(details);
}

function completeTransferRecord(payload) {
  const record = createRecord(payload.phone, payload.amount, payload.code, payload.wallet, payload.contactName, payload.details);
  pendingPaymentConfirmationRecordId = record.id;
  localStorage.setItem(PENDING_PAYMENT_CONFIRMATION_KEY, record.id);
  renderRecords();
  window.location.href = `tel:${encodeURIComponent(payload.code)}`;
}


function openPaymentConfirmationIfNeeded() {
  const recordId = pendingPaymentConfirmationRecordId || localStorage.getItem(PENDING_PAYMENT_CONFIRMATION_KEY) || '';
  if (!recordId) return;
  const record = records.find(item => item.id === recordId);
  if (!record) {
    clearPendingPaymentConfirmation();
    return;
  }
  paymentConfirmModal.hidden = false;
}

function clearPendingPaymentConfirmation() {
  pendingPaymentConfirmationRecordId = '';
  localStorage.removeItem(PENDING_PAYMENT_CONFIRMATION_KEY);
  paymentConfirmModal.hidden = true;
}

paymentConfirmYesButton.addEventListener('click', async () => {
  const record = records.find(item => item.id === pendingPaymentConfirmationRecordId);
  if (record) {
    record.status = 'paid';
    record.autoReminder = false;
    await cancelRecordReminder(record);
    saveRecords();
    renderRecords();
    updatePaidTotal(getFilteredRecords());
  }
  clearPendingPaymentConfirmation();
  showToast('تم تسجيل الحركة كمدفوعة.');
});

paymentConfirmNoButton.addEventListener('click', async () => {
  const record = records.find(item => item.id === pendingPaymentConfirmationRecordId);
  if (record) {
    record.status = 'unpaid';
    await scheduleAutomaticHourlyReminder(record);
    saveRecords();
    renderRecords();
    updatePaidTotal(getFilteredRecords());
  }
  clearPendingPaymentConfirmation();
  showToast('بقيت الحركة غير مدفوعة.');
});

function registerReturnFromDialerListener() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (appPlugin?.addListener) {
    appPlugin.addListener('appStateChange', ({ isActive }) => {
      if (isActive) setTimeout(openPaymentConfirmationIfNeeded, 250);
    });
  }
  window.addEventListener('focus', () => {
    setTimeout(openPaymentConfirmationIfNeeded, 250);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(openPaymentConfirmationIfNeeded, 250);
  });
}


function registerSystemBackButtonListener() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;

  appPlugin.addListener('backButton', async () => {
    if (historyView.classList.contains('active-view')) {
      await showView('transfer');
      return;
    }

    if (!paymentConfirmModal.hidden) {
      return;
    }

    if (!duplicateModal.hidden) {
      closeDuplicateDialog();
      pendingDuplicatePayload = null;
      return;
    }

    if (!deleteConfirmModal.hidden) {
      deleteConfirmModal.hidden = true;
      if (pendingDeleteResolver) pendingDeleteResolver(false);
      pendingDeleteResolver = null;
      return;
    }

    if (appPlugin.minimizeApp) {
      await appPlugin.minimizeApp();
    }
  });
}

function openDuplicateDialog(payload) {
  pendingDuplicatePayload = payload;
  duplicateModal.hidden = false;
}

function closeDuplicateDialog() {
  duplicateModal.hidden = true;
}

confirmDuplicateYesButton.addEventListener('click', () => {
  pendingDuplicatePayload = null;
  closeDuplicateDialog();
  showToast('لم تتم إضافة الحركة المكررة.');
});

confirmDuplicateNoButton.addEventListener('click', () => {
  if (pendingDuplicatePayload) completeTransferRecord(pendingDuplicatePayload);
  pendingDuplicatePayload = null;
  closeDuplicateDialog();
});

duplicateModal.addEventListener('click', event => {
  if (event.target === duplicateModal) {
    closeDuplicateDialog();
    pendingDuplicatePayload = null;
  }
});

callButton.addEventListener('click', () => {
  if (!generateCode({ validateForTransfer: true })) return;
  const phone = normalizePhone(phoneInput.value);
  const amount = getAmountValue();
  const code = getCode(phone, amount);
  const details = movementDetailsInput.value.trim();
  const payload = {
    phone,
    amount,
    code,
    wallet: selectedWallet,
    contactName: selectedContactName,
    details
  };

  if (isConsecutiveDuplicate(phone, amount, selectedWallet, details)) {
    openDuplicateDialog(payload);
    return;
  }

  completeTransferRecord(payload);
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

function migrateRecords(list) {
  const migrated = Array.isArray(list) ? list.map(record => ({
    ...record,
    wallet: record.wallet === 'jawwal' ? 'jawwal' : 'palpay',
    contactName: String(record.contactName || ''),
    reminderId: record.reminderId || null,
    reminderIds: Array.isArray(record.reminderIds) ? record.reminderIds : (record.reminderId ? [record.reminderId] : []),
    reminderAt: record.reminderAt || '',
    autoReminder: Boolean(record.autoReminder),
    status: record.status === 'paid' ? 'paid' : record.status === 'incomplete' ? 'unpaid' : (record.status === 'paid' ? 'paid' : 'unpaid')
  })) : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createRecord(phone, amount, code, wallet, contactName = '', details = '') {
  const now = new Date();
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    phone,
    amount: Number(amount),
    code,
    wallet,
    contactName: String(contactName || '').trim(),
    createdAt: now.toISOString(),
    details: String(details || '').trim(),
    status: 'unpaid'
  };
  records.unshift(record);
  saveRecords();
  return record;
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

function formatReminderDisplay(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatNextReminderDisplay(iso) {
  if (!iso) return '';
  const base = new Date(iso);
  const now = new Date();
  while (base <= now) base.setHours(base.getHours() + 1);
  return base.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

async function lockOrientation(mode) {
  try {
    const screenMode = window.Capacitor?.Plugins?.ScreenMode;
    if (mode === 'landscape' && screenMode?.lockLandscape) await screenMode.lockLandscape();
    if (mode === 'portrait' && screenMode?.lockPortrait) await screenMode.lockPortrait();
  } catch (error) {
    // Fallback: responsive layout still adapts.
  }
}

async function showView(viewName) {
  const showHistory = viewName === 'history';
  transferView.classList.toggle('active-view', !showHistory);
  historyView.classList.toggle('active-view', showHistory);
  document.body.classList.toggle('history-open', showHistory);
  if (showHistory) {
    await lockOrientation('landscape');
    renderRecords();
  } else {
    await lockOrientation('portrait');
  }
}

openHistoryButton.addEventListener('click', () => showView('history'));
backToTransferButton.addEventListener('click', () => showView('transfer'));

toggleFiltersButton.addEventListener('click', () => {
  filtersPanel.hidden = !filtersPanel.hidden;
  toggleFiltersButton.classList.toggle('active', !filtersPanel.hidden);
});

[filterFrom, filterTo, amountFrom, amountTo, walletFilter, statusFilter].forEach(el => {
  el.addEventListener('input', renderRecords);
  el.addEventListener('change', renderRecords);
});

clearFiltersButton.addEventListener('click', () => {
  filterFrom.value = '';
  filterTo.value = '';
  amountFrom.value = '';
  amountTo.value = '';
  walletFilter.value = 'all';
  statusFilter.value = 'all';
  renderRecords();
});

function getFilteredRecords() {
  const fromDate = filterFrom.value ? new Date(`${filterFrom.value}T00:00:00`) : null;
  const toDate = filterTo.value ? new Date(`${filterTo.value}T23:59:59`) : null;
  const minAmount = amountFrom.value ? Number(amountFrom.value) : null;
  const maxAmount = amountTo.value ? Number(amountTo.value) : null;
  const wallet = walletFilter.value;
  const status = statusFilter.value;

  return records.filter(record => {
    const date = new Date(record.createdAt);
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    if (minAmount !== null && record.amount < minAmount) return false;
    if (maxAmount !== null && record.amount > maxAmount) return false;
    if (wallet !== 'all' && record.wallet !== wallet) return false;
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
      <td class="serial-cell"><span class="serial-badge">${index + 1}</span></td>
      <td class="phone-cell">
        <span class="phone-number">${record.phone}</span>
        ${record.contactName ? `<span class="contact-name">${escapeHtml(record.contactName)}</span>` : ''}
      </td>
      <td><span class="amount-badge">${amountText(record.amount)}</span></td>
      <td><span class="date-time"><span class="date">${dateText}</span><span class="time">${timeText}</span></span></td>
      <td><span class="wallet-badge ${record.wallet}">${walletArabic(record.wallet)}</span></td>
      <td><textarea class="details-input" dir="rtl" lang="ar" inputmode="text" rows="1" enterkeyhint="done" data-id="${record.id}" placeholder="اكتب ماذا اشتريت...">${escapeHtml(record.details || '')}</textarea></td>
      <td>
        <div class="status-stack">
          <select class="status-select ${record.status === 'paid' ? 'paid' : 'unpaid'}" data-id="${record.id}">
            <option value="paid" ${record.status === 'paid' ? 'selected' : ''}>مدفوعة</option>
            <option value="unpaid" ${record.status === 'unpaid' ? 'selected' : ''}>غير مدفوعة</option>
          </select>
          ${record.status === 'unpaid' ? `
            <button class="reminder-btn ${record.reminderAt ? 'scheduled' : ''}" type="button" data-id="${record.id}" title="تذكير" aria-label="تذكير">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7v3.59L3.29 14.3A1 1 0 0 0 4 16h16a1 1 0 0 0 .71-1.7L19 12.59V9a7 7 0 0 0-7-7Zm0 20a3 3 0 0 0 2.82-2H9.18A3 3 0 0 0 12 22Zm1-12.41 2.7 2.7-1.41 1.42L11 10.41V6h2v3.59Z"/></svg>
            </button>
            ${record.reminderAt ? `<span class="reminder-time-label"><span>التالي</span><b dir="ltr">${formatNextReminderDisplay(record.reminderAt)}</b></span>` : ''}
            <input class="reminder-time-input" type="time" data-id="${record.id}" />
          ` : ''}
        </div>
      </td>
      <td><button class="delete-btn" type="button" data-id="${record.id}" title="حذف">×</button></td>
    `;
    recordsBody.appendChild(tr);
  });

  bindRecordEvents();
  updatePaidTotal(filtered);
}

function resizeDetailsInput(textarea) {
  const isEmpty = textarea.value.trim() === '';
  textarea.classList.toggle('empty', isEmpty);
  if (isEmpty) {
    textarea.style.height = '34px';
    return;
  }
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 34)}px`;
}

function bindRecordEvents() {
  document.querySelectorAll('.details-input').forEach(input => {
    resizeDetailsInput(input);
    input.addEventListener('input', e => {
      const record = records.find(r => r.id === e.target.dataset.id);
      if (!record) return;
      record.details = e.target.value;
      resizeDetailsInput(e.target);
      saveRecords();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.target.blur();
      }
    });
  });

  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async e => {
      const record = records.find(r => r.id === e.target.dataset.id);
      if (!record) return;
      record.status = e.target.value;
      if (record.status === 'paid') await cancelRecordReminder(record);
      saveRecords();
      renderRecords();
      updatePaidTotal(getFilteredRecords());
    });
  });

  document.querySelectorAll('.reminder-btn').forEach(button => {
    button.addEventListener('click', e => {
      const row = e.currentTarget.closest('td');
      const timeInput = row?.querySelector('.reminder-time-input');
      if (!timeInput) return;
      if (typeof timeInput.showPicker === 'function') timeInput.showPicker();
      else timeInput.click();
    });
  });

  document.querySelectorAll('.reminder-time-input').forEach(input => {
    input.addEventListener('change', async e => {
      const record = records.find(r => r.id === e.target.dataset.id);
      if (!record || !e.target.value) return;
      await scheduleRecordReminder(record, e.target.value);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', async e => {
      const id = e.currentTarget.dataset.id;
      const record = records.find(item => item.id === id);
      if (!record) return;
      if (record.status !== 'paid') {
        window.alert('لا يمكن حذف السجل إلا عند دفع الحركة');
        return;
      }
      if (!(await askDeleteConfirmation())) return;
      await cancelRecordReminder(record);
      records = records.filter(record => record.id !== id);
      saveRecords();
      renderRecords();
    });
  });
}

async function ensureNotificationPermission() {
  const notifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!notifications) {
    showToast('التذكير متاح داخل تطبيق Android فقط.');
    return false;
  }
  const current = await notifications.checkPermissions();
  if (current.display === 'granted') return true;
  const requested = await notifications.requestPermissions();
  return requested.display === 'granted';
}


async function registerPaymentNotificationActions() {
  const notifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!notifications?.registerActionTypes) return;
  try {
    await notifications.registerActionTypes({
      types: [{
        id: PAYMENT_NOTIFICATION_ACTION_TYPE,
        actions: [
          { id: PAYMENT_NOTIFICATION_PAID_ACTION, title: 'تم الدفع' },
          { id: PAYMENT_NOTIFICATION_UNPAID_ACTION, title: 'لم يتم الدفع' }
        ]
      }]
    });
  } catch (error) {
    // Actions are optional; tapping the notification still opens the confirmation dialog.
  }
}

function oneHourFromNow() {
  return new Date(Date.now() + 60 * 60 * 1000);
}

async function scheduleAutomaticHourlyReminder(record) {
  try {
    const allowed = await ensureNotificationPermission();
    if (!allowed) {
      showToast('يجب السماح بالإشعارات لتفعيل التذكير.');
      return;
    }
    await registerPaymentNotificationActions();
    await cancelRecordReminder(record);

    const notifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!notifications) return;

    const reminderId = reminderNumericId(record);
    const nextAt = oneHourFromNow();

    await notifications.schedule({
      notifications: [{
        id: reminderId,
        title: 'عملية غير مدفوعة',
        body: `عملية غير مدفوعة للرقم ${record.phone} بقيمة ${Number(record.amount)} شيكل`,
        schedule: { every: 'hour', allowWhileIdle: true },
        actionTypeId: PAYMENT_NOTIFICATION_ACTION_TYPE,
        extra: { recordId: record.id, kind: 'payment-reminder' }
      }]
    });

    record.reminderId = reminderId;
    record.reminderIds = [reminderId];
    record.reminderAt = nextAt.toISOString();
    record.autoReminder = true;
    saveRecords();
    renderRecords();
  } catch (error) {
    showToast('تعذر تفعيل التذكير التلقائي.');
  }
}

async function handlePaymentNotificationAction(action) {
  const actionId = action?.actionId || '';
  const recordId = action?.notification?.extra?.recordId || '';
  const record = records.find(item => item.id === recordId);
  if (!record) return;

  if (actionId === PAYMENT_NOTIFICATION_PAID_ACTION) {
    record.status = 'paid';
    record.autoReminder = false;
    await cancelRecordReminder(record);
    saveRecords();
    renderRecords();
    updatePaidTotal(getFilteredRecords());
    showToast('تم تسجيل الحركة كمدفوعة.');
    return;
  }

  if (actionId === PAYMENT_NOTIFICATION_UNPAID_ACTION) {
    record.status = 'unpaid';
    await scheduleAutomaticHourlyReminder(record);
    saveRecords();
    renderRecords();
    updatePaidTotal(getFilteredRecords());
    showToast('بقيت الحركة غير مدفوعة.');
    return;
  }

  pendingPaymentConfirmationRecordId = record.id;
  localStorage.setItem(PENDING_PAYMENT_CONFIRMATION_KEY, record.id);
  paymentConfirmModal.hidden = false;
}

async function registerPaymentNotificationListeners() {
  const notifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!notifications) return;
  await registerPaymentNotificationActions();
  notifications.addListener('localNotificationActionPerformed', handlePaymentNotificationAction);
}


function reminderDateFromTime(timeValue) {
  const [hours, minutes] = timeValue.split(':').map(Number);
  const now = new Date();
  const when = new Date(now);
  when.setHours(hours, minutes, 0, 0);
  if (when <= now) when.setDate(when.getDate() + 1);
  return when;
}

function reminderNumericId(record) {
  const digits = String(record.id).replace(/\D/g, '').slice(-8);
  return Number(digits || Date.now() % 2147483647);
}

async function scheduleRecordReminder(record, timeValue) {
  try {
    const allowed = await ensureNotificationPermission();
    if (!allowed) {
      showToast('يجب السماح بالإشعارات لتفعيل التذكير.');
      return;
    }
    await registerPaymentNotificationActions();
    await cancelRecordReminder(record);
    const notifications = window.Capacitor.Plugins.LocalNotifications;
    const at = reminderDateFromTime(timeValue);
    const baseReminderId = reminderNumericId(record);
    const notificationsToSchedule = Array.from({ length: 24 }, (_, index) => {
      const nextAt = new Date(at);
      nextAt.setHours(nextAt.getHours() + index);
      return {
        id: baseReminderId + index,
        title: 'عملية غير مدفوعة',
        body: `عملية غير مدفوعة للرقم ${record.phone} بقيمة ${Number(record.amount)} شيكل`,
        schedule: { at: nextAt },
        actionTypeId: PAYMENT_NOTIFICATION_ACTION_TYPE,
        extra: { recordId: record.id, kind: 'payment-reminder' }
      };
    });
    await notifications.schedule({ notifications: notificationsToSchedule });
    record.reminderId = baseReminderId;
    record.reminderIds = notificationsToSchedule.map(item => item.id);
    record.reminderAt = at.toISOString();
    saveRecords();
    renderRecords();
    showToast('تم ضبط التذكير.');
  } catch (error) {
    showToast('تعذر ضبط التذكير.');
  }
}

async function cancelRecordReminder(record) {
  try {
    const ids = Array.isArray(record?.reminderIds) && record.reminderIds.length
      ? record.reminderIds
      : (record?.reminderId ? [record.reminderId] : []);
    if (!ids.length) return;
    const notifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (notifications) await notifications.cancel({ notifications: ids.map(id => ({ id })) });
  } catch (error) {
    // ignore cancellation failures
  }
  if (record) {
    record.reminderId = null;
    record.reminderIds = [];
    record.reminderAt = '';
  }
}

function updatePaidTotal(list = getFilteredRecords()) {
  const total = list
    .filter(record => record.status === 'paid')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  paidTotal.textContent = amountText(total);
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
  return status === 'paid' ? 'مدفوعة' : 'غير مدفوعة';
}

function buildPrintableHtml(exportRows) {
  const totalPaid = exportRows
    .filter(record => record.status === 'paid')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  const rowsHtml = exportRows.map((record, index) => {
    const { dateText, timeText } = formatDateParts(record.createdAt);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${record.phone}</td>
        <td>${amountText(record.amount)}</td>
        <td>${dateText}<br>${timeText}</td>
        <td>${walletArabic(record.wallet)}</td>
        <td>${escapeHtml(record.details || '')}</td>
        <td>${statusArabic(record.status)}</td>
      </tr>`;
  }).join('');

  return `
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>سجل الحركات</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: Tahoma, Arial, sans-serif; color: #0f172a; direction: rtl; }
        h1 { margin: 0 0 6px; color: #0f766e; }
        p { margin: 0 0 16px; color: #475569; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #0f766e; color: white; font-weight: bold; }
        td, th { border: 1px solid #94a3b8; padding: 9px; text-align: center; }
        tfoot td { background: #dcfce7; color: #14532d; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>سجل الحركات</h1>
      <p>البيانات الظاهرة وقت التصدير</p>
      <table>
        <thead>
          <tr>
            <th>م</th>
            <th>رقم الموبايل</th>
            <th>المبلغ</th>
            <th>التاريخ والوقت</th>
            <th>نوع المحفظة</th>
            <th>تفاصيل العملية</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr><td colspan="2">مجموع النفقات المدفوعة</td><td colspan="5">${amountText(totalPaid)}</td></tr>
        </tfoot>
      </table>
    </body>
    </html>`;
}

async function exportVisibleRowsToPdf() {
  const exportRows = getFilteredRecords();
  if (!exportRows.length) {
    showToast('لا توجد بيانات ظاهرة للتصدير.');
    return;
  }

  const rows = exportRows.map((record, index) => {
    const { dateText, timeText } = formatDateParts(record.createdAt);
    return {
      serial: index + 1,
      phone: record.contactName ? `${record.phone}\n${record.contactName}` : record.phone,
      amount: amountText(record.amount),
      date: dateText,
      time: timeText,
      wallet: walletArabic(record.wallet),
      details: record.details || '',
      status: statusArabic(record.status)
    };
  });

  const total = exportRows
    .filter(record => record.status === 'paid')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  try {
    const nativeExporter = window.Capacitor?.Plugins?.PdfExporter;
    if (!nativeExporter?.exportRecords) {
      showToast('تصدير PDF متاح داخل تطبيق Android فقط.');
      return;
    }
    await ensureNotificationPermission();
    await nativeExporter.exportRecords({
      title: 'سجل الحركات',
      totalPaid: amountText(total),
      rows
    });
    showToast('تم الحفظ بصيغة PDF');
  } catch (error) {
    showToast('تعذر التصدير. اختر مكان الحفظ ثم أعد المحاولة.');
  }
}

exportPdfButton.addEventListener('click', exportVisibleRowsToPdf);


/* Keyboard-safe handling without changing the normal layout */
const initialViewportHeight = window.visualViewport?.height || window.innerHeight;
let keyboardScrollTimer;

function updateKeyboardState() {
  const currentHeight = window.visualViewport?.height || window.innerHeight;
  const keyboardOpen = initialViewportHeight - currentHeight > 120;
  document.body.classList.toggle('keyboard-open', keyboardOpen);
}

function keepMovementDetailsVisible() {
  clearTimeout(keyboardScrollTimer);
  keyboardScrollTimer = setTimeout(() => {
    if (document.activeElement === movementDetailsInput) {
      movementDetailsInput.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, 180);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    updateKeyboardState();
    if (document.body.classList.contains('keyboard-open')) keepMovementDetailsVisible();
  });
}

movementDetailsInput.addEventListener('focus', keepMovementDetailsVisible);
movementDetailsInput.addEventListener('blur', () => {
  setTimeout(updateKeyboardState, 120);
});

registerReturnFromDialerListener();
registerPaymentNotificationListeners();
updateWalletButtons();
renderRecords();
generateCode();

// APK assets are already bundled offline; disable old service-worker caches to prevent stale files after updates.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    .catch(() => {});
}
if ('caches' in window) {
  caches.keys()
    .then(keys => Promise.all(keys.map(key => caches.delete(key))))
    .catch(() => {});
}
