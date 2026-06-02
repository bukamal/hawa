// js/expenses.js - حسابات هوى الشام (صادر/وارد) مع دعم العملة وزر تصدير PDF - معدل لـ لنا/له
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, formatDate, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog, getCurrencySettings } from './utils.js';

let currentPage = 1;
const pageSize = 20;
let allFilteredCompanies = [];
let currentCompanyFilter = '';

export async function loadExpenses() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div><h3 class="card-title">حسابات هوى الشام</h3><span class="card-subtitle">سجل المصاريف والإيرادات الداخلية (لنا/له) - مجمع حسب الشركة</span></div>
                <button class="btn btn-primary btn-sm" id="btn-add-company">${ICONS.plus} إضافة شركة</button>
            </div>
            <div id="expenses-summary" style="margin-top: 12px; margin-bottom: 16px;"></div>
            <div class="form-group">
                <label class="form-label">بحث باسم الشركة</label>
                <input type="text" class="input" id="company-filter" placeholder="اكتب اسم الشركة للبحث...">
            </div>
        </div>
        <div id="expenses-list"></div>
        <div style="margin-top: 20px; text-align: center;">
            <button class="btn btn-primary" id="print-all-companies-report">🖨️ طباعة تقرير شامل لجميع الشركات</button>
        </div>`;

    document.getElementById('btn-add-company').addEventListener('click', () => showAddRecordModal());
    document.getElementById('company-filter').addEventListener('input', (e) => {
        currentCompanyFilter = e.target.value.trim();
        currentPage = 1;
        renderCompaniesSummary();
    });
    document.getElementById('print-all-companies-report').addEventListener('click', () => {
        printAllCompaniesReport();
    });

    await refreshExpensesCache();
    renderCompaniesSummary();
}

async function refreshExpensesCache() { await refreshCaches(); }
async function getExpenses() { const result = await apiCall('/expenses', 'GET'); return result || []; }
async function addExpense(data) { return await apiCall('/expenses', 'POST', data); }
async function updateExpense(data) { return await apiCall('/expenses', 'PUT', data); }
async function deleteExpense(id) { return await apiCall(`/expenses?id=${id}`, 'DELETE'); }

function groupByCompany(expenses) {
    const map = new Map();
    expenses.forEach(exp => {
        const name = exp.company_name || 'بدون اسم';
        if (!map.has(name)) {
            map.set(name, {
                company_name: name,
                total_for_us: 0,
                total_for_them: 0,
                records: [],
                currency: exp.currency || 'SAR'
            });
        }
        const company = map.get(name);
        if (exp.type === 'for_us') company.total_for_us += exp.amount;
        else company.total_for_them += exp.amount;
        company.records.push(exp);
    });
    const result = Array.from(map.values());
    result.sort((a, b) => a.company_name.localeCompare(b.company_name));
    result.forEach(c => c.net = c.total_for_us - c.total_for_them);
    return result;
}

function renderCompaniesSummary() {
    getExpenses().then(allExpenses => {
        let grouped = groupByCompany(allExpenses);
        if (currentCompanyFilter) grouped = grouped.filter(c => c.company_name.toLowerCase().includes(currentCompanyFilter.toLowerCase()));
        allFilteredCompanies = grouped;
        currentPage = 1;
        renderCompaniesPaginated();
        updateOverallSummary(allExpenses);
    }).catch(err => { console.error(err); showToast('خطأ في تحميل البيانات', 'error'); });
}

function renderCompaniesPaginated() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = allFilteredCompanies.slice(start, end);
    const container = document.getElementById('expenses-list');
    if (!paginated.length && currentPage === 1) { container.innerHTML = emptyState('لا توجد حسابات', 'أضف شركة جديدة'); return; }
    let html = '';
    paginated.forEach(company => {
        const netColor = company.net >= 0 ? 'var(--success)' : 'var(--danger)';
        const borderStyle = company.net >= 0 ? '2px solid var(--success)' : '2px solid var(--danger)';
        html += `<div class="card card-hover company-card" data-company="${escapeHtml(company.company_name)}" style="margin-bottom:16px; cursor:pointer; border-right: ${borderStyle};">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:900; font-size:18px;">${escapeHtml(company.company_name)}</div>
                    <div style="font-size:13px; margin-top:6px;">
                        <span style="color:var(--success);">📥 لنا: ${formatNumber(company.total_for_us)}</span> &nbsp;|&nbsp;
                        <span style="color:var(--danger);">📤 له: ${formatNumber(company.total_for_them)}</span> &nbsp;|&nbsp;
                        <span style="color:${netColor};">💰 صافي: ${formatNumber(company.net)}</span> &nbsp;|&nbsp;
                        <span>📋 عدد القيود: ${company.records.length}</span>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="btn btn-secondary btn-sm edit-company" data-company="${escapeHtml(company.company_name)}">${ICONS.plus} إضافة قيد</button>
                    <button class="btn btn-danger btn-sm delete-company" data-company="${escapeHtml(company.company_name)}">${ICONS.trash} حذف الكل</button>
                </div>
            </div>
        </div>`;
    });
    if (allFilteredCompanies.length > end) {
        html += `<div class="load-more-container" style="text-align:center; margin-top:20px;"><button class="btn btn-secondary" id="load-more-companies">تحميل المزيد (${allFilteredCompanies.length - end} متبقي)</button></div>`;
    }
    container.innerHTML = html;
    animateEntry('.company-card', 60);

    document.querySelectorAll('.company-card').forEach(card => {
        card.addEventListener('click', (e) => { if (e.target.closest('.edit-company') || e.target.closest('.delete-company')) return; const companyName = card.dataset.company; showCompanyDetails(companyName); });
    });
    document.querySelectorAll('.edit-company').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const companyName = btn.dataset.company; showAddRecordModal({ company_name: companyName }); }); });
    document.querySelectorAll('.delete-company').forEach(btn => { btn.addEventListener('click', async (e) => { e.stopPropagation(); const companyName = btn.dataset.company; if (await confirmDialog(`هل أنت متأكد من حذف جميع قيود شركة "${companyName}"؟ لا يمكن التراجع.`)) { try { const allExpenses = await getExpenses(); const toDelete = allExpenses.filter(e => e.company_name === companyName); for (const exp of toDelete) await deleteExpense(exp.id); showToast(`تم حذف جميع قيود شركة ${companyName}`, 'success'); renderCompaniesSummary(); } catch(err) { showToast(err.message, 'error'); } } }); });
    document.getElementById('load-more-companies')?.addEventListener('click', () => { currentPage++; renderCompaniesPaginated(); });
}

function updateOverallSummary(allExpenses) {
    let totalForUs = 0, totalForThem = 0;
    allExpenses.forEach(e => { if (e.type === 'for_us') totalForUs += e.amount; else totalForThem += e.amount; });
    const net = totalForUs - totalForThem;
    const summaryHtml = `<div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:8px; padding:8px 0; border-bottom:1px solid var(--border);">
        <span style="color:var(--success); font-weight:700;">📥 إجمالي لنا: ${formatNumber(totalForUs)}</span>
        <span style="color:var(--danger); font-weight:700;">📤 إجمالي له: ${formatNumber(totalForThem)}</span>
        <span style="color:var(--info); font-weight:700;">💰 صافي الرصيد: ${formatNumber(net)}</span>
    </div>`;
    const summaryDiv = document.getElementById('expenses-summary');
    if (summaryDiv) summaryDiv.innerHTML = summaryHtml;
}

function showAddRecordModal(initial = {}) {
    const modal = openModal({
        title: 'إضافة قيد جديد',
        bodyHTML: `<div class="form-group"><label>اسم الشركة / الجهة</label><input type="text" class="input" id="exp-company" value="${escapeHtml(initial.company_name || '')}" placeholder="مثال: الخطوط القطرية"></div>
            <div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="exp-amount" placeholder="0.00"></div>
            <div class="form-group"><label>النوع</label><select class="select" id="exp-type"><option value="for_us">💰 لنا (مستحق لصالح هوى الشام)</option><option value="for_them">💳 له (مستحق للشركة)</option></select></div>
            <div class="form-group"><label>التاريخ</label><input type="date" class="input" id="exp-date" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label>العملة</label><input type="text" class="input" id="exp-currency" value="${initial.currency || 'SAR'}" placeholder="SAR, USD, EUR..."></div>
            <div class="form-group"><label>ملاحظات</label><textarea class="textarea" id="exp-notes" placeholder="تفاصيل إضافية">${escapeHtml(initial.notes || '')}</textarea></div>`,
        footerHTML: `<button class="btn btn-secondary" id="cancel-expense">إلغاء</button><button class="btn btn-primary" id="save-expense">حفظ</button>`
    });
    const saveBtn = modal.element.querySelector('#save-expense');
    saveBtn.onclick = async () => {
        if (saveBtn.disabled) return;
        saveBtn.disabled = true; saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const company = modal.element.querySelector('#exp-company').value.trim();
            const amount = parseFloat(toEnglishDigits(modal.element.querySelector('#exp-amount').value));
            const type = modal.element.querySelector('#exp-type').value;
            const date = modal.element.querySelector('#exp-date').value;
            const currency = modal.element.querySelector('#exp-currency').value.trim() || 'SAR';
            const notes = modal.element.querySelector('#exp-notes').value;
            if (!company) throw new Error('اسم الشركة مطلوب');
            if (isNaN(amount) || amount <= 0) throw new Error('المبلغ مطلوب وأكبر من صفر');
            await addExpense({ company_name: company, amount, type, date, notes, currency });
            showToast('تم الحفظ', 'success');
            modal.close();
            renderCompaniesSummary();
        } catch (err) { showToast(err.message, 'error'); saveBtn.disabled = false; saveBtn.innerHTML = 'حفظ'; }
    };
    modal.element.querySelector('#cancel-expense').onclick = () => modal.close();
}

async function showCompanyDetails(companyName) {
    const allExpenses = await getExpenses();
    const companyRecords = allExpenses.filter(e => e.company_name === companyName);
    if (companyRecords.length === 0) { showToast('لا توجد قيود لهذه الشركة', 'warning'); return; }
    let totalForUs = 0, totalForThem = 0;
    companyRecords.forEach(r => { if (r.type === 'for_us') totalForUs += r.amount; else totalForThem += r.amount; });
    const net = totalForUs - totalForThem;
    const currency = companyRecords[0]?.currency || 'SAR';

    let tableRows = '';
    companyRecords.forEach(rec => {
        const sign = rec.type === 'for_us' ? '+' : '-';
        const typeText = rec.type === 'for_us' ? 'لنا' : 'له';
        tableRows += `<tr data-id="${rec.id}"><td>${rec.id}</td><td>${formatDate(rec.date)}</td><td>${typeText}</td><td class="${rec.type === 'for_us' ? 'positive' : 'negative'}">${sign} ${formatNumber(rec.amount)} ${rec.currency || 'SAR'}</td><td>${escapeHtml(rec.notes || '-')}</td><td style="white-space:nowrap;"><button class="btn btn-secondary btn-sm edit-record" data-id="${rec.id}" data-company="${escapeHtml(rec.company_name)}" data-amount="${rec.amount}" data-type="${rec.type}" data-date="${rec.date}" data-notes="${escapeHtml(rec.notes || '')}" data-currency="${rec.currency || 'SAR'}">${ICONS.edit}</button><button class="btn btn-danger btn-sm delete-record" data-id="${rec.id}" style="margin-right:4px;">${ICONS.trash}</button></td></tr>`;
    });

    const modal = openModal({
        title: `تفاصيل حسابات شركة: ${escapeHtml(companyName)}`,
        bodyHTML: `<div style="margin-bottom:16px; display:flex; gap:20px; flex-wrap:wrap; justify-content:space-between; align-items:center;"><div><span style="color:var(--success);">📥 لنا: ${formatNumber(totalForUs)} ${currency}</span> &nbsp;|&nbsp;<span style="color:var(--danger);">📤 له: ${formatNumber(totalForThem)} ${currency}</span> &nbsp;|&nbsp;<span style="color:${net >= 0 ? 'var(--success)' : 'var(--danger)'};">💰 صافي: ${formatNumber(net)} ${currency}</span></div><div><button class="btn btn-primary btn-sm" id="add-record-to-company">${ICONS.plus} إضافة قيد</button><button class="btn btn-info btn-sm" id="print-table">🖨️ طباعة الجدول</button><button class="btn btn-secondary btn-sm" id="export-table-pdf">📄 تصدير PDF</button></div></div><div class="table-wrap" style="max-height:400px; overflow-y:auto;"><table class="table"><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظات</th><th>إجراءات</th></tr></thead><tbody>${tableRows}</tbody></table></div>`,
        footerHTML: `<button class="btn btn-secondary" id="close-details">إغلاق</button>`
    });

    const modalElement = modal.element;
    modalElement.querySelector('#add-record-to-company').onclick = () => { modal.close(); showAddRecordModal({ company_name: companyName }); };
    modalElement.querySelector('#print-table').onclick = () => { printCompanyRecordsTable(companyName, companyRecords); };
    modalElement.querySelector('#export-table-pdf').onclick = () => { exportCompanyRecordsToPDF(companyName, companyRecords); };
    modalElement.querySelectorAll('.edit-record').forEach(btn => { btn.onclick = () => { const id = parseInt(btn.dataset.id); const record = companyRecords.find(r => r.id === id); if (record) { modal.close(); showEditRecordModal(record); } }; });
    modalElement.querySelectorAll('.delete-record').forEach(btn => { btn.onclick = async (e) => { e.stopPropagation(); const id = parseInt(btn.dataset.id); if (await confirmDialog('هل أنت متأكد من حذف هذا القيد؟')) { await deleteExpense(id); showToast('تم الحذف', 'success'); modal.close(); showCompanyDetails(companyName); renderCompaniesSummary(); } }; });
    modalElement.querySelector('#close-details').onclick = () => modal.close();
}

function showEditRecordModal(record) {
    const modal = openModal({
        title: 'تعديل القيد',
        bodyHTML: `<div class="form-group"><label>اسم الشركة</label><input type="text" class="input" id="edit-company" value="${escapeHtml(record.company_name)}"></div><div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="edit-amount" value="${record.amount}"></div><div class="form-group"><label>النوع</label><select class="select" id="edit-type"><option value="for_us" ${record.type === 'for_us' ? 'selected' : ''}>لنا</option><option value="for_them" ${record.type === 'for_them' ? 'selected' : ''}>له</option></select></div><div class="form-group"><label>التاريخ</label><input type="date" class="input" id="edit-date" value="${record.date}"></div><div class="form-group"><label>العملة</label><input type="text" class="input" id="edit-currency" value="${record.currency || 'SAR'}"></div><div class="form-group"><label>ملاحظات</label><textarea class="textarea" id="edit-notes">${escapeHtml(record.notes || '')}</textarea></div>`,
        footerHTML: `<button class="btn btn-secondary" id="cancel-edit">إلغاء</button><button class="btn btn-primary" id="save-edit">حفظ</button>`
    });
    const saveBtn = modal.element.querySelector('#save-edit');
    saveBtn.onclick = async () => {
        if (saveBtn.disabled) return;
        saveBtn.disabled = true; saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const company = modal.element.querySelector('#edit-company').value.trim();
            const amount = parseFloat(toEnglishDigits(modal.element.querySelector('#edit-amount').value));
            const type = modal.element.querySelector('#edit-type').value;
            const date = modal.element.querySelector('#edit-date').value;
            const currency = modal.element.querySelector('#edit-currency').value.trim() || 'SAR';
            const notes = modal.element.querySelector('#edit-notes').value;
            if (!company) throw new Error('اسم الشركة مطلوب');
            if (isNaN(amount) || amount <= 0) throw new Error('المبلغ مطلوب وأكبر من صفر');
            await updateExpense({ id: record.id, company_name: company, amount, type, date, notes, currency });
            showToast('تم التعديل', 'success');
            modal.close();
            renderCompaniesSummary();
            showCompanyDetails(company);
        } catch (err) { showToast(err.message, 'error'); saveBtn.disabled = false; saveBtn.innerHTML = 'حفظ'; }
    };
    modal.element.querySelector('#cancel-edit').onclick = () => modal.close();
}

function printAllCompaniesReport() {
    const grouped = allFilteredCompanies;
    if (!grouped.length) { showToast('لا توجد بيانات للطباعة', 'warning'); return; }
    let rows = '';
    grouped.forEach(c => { rows += `<tr><td>${escapeHtml(c.company_name)}</td><td>${formatNumber(c.total_for_us)}</td><td>${formatNumber(c.total_for_them)}</td><td class="${c.net >= 0 ? 'positive' : 'negative'}">${formatNumber(c.net)}</td><td>${c.records.length}</td></tr>`; });
    const totalIn = grouped.reduce((s,c)=>s+c.total_for_us,0);
    const totalOut = grouped.reduce((s,c)=>s+c.total_for_them,0);
    const netTotal = totalIn - totalOut;
    const currency = grouped[0]?.currency || 'SAR';
    const now = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'medium' });
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير شامل حسابات هوى الشام</title><style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'); *{margin:0;padding:0;box-sizing:border-box;} body{font-family:'Tajawal',sans-serif;padding:1.5cm;background:white;color:#1f2937;direction:rtl;} .header{text-align:center;margin-bottom:30px;border-bottom:3px solid #4f46e5;padding-bottom:15px;} .logo{font-size:32px;font-weight:800;color:#4f46e5;} .subtitle{font-size:14px;color:#64748b;} h2{font-size:20px;font-weight:700;margin:20px 0 10px;border-right:5px solid #4f46e5;padding-right:12px;} table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;} th{background:#f1f5f9;padding:10px 8px;border:1px solid #e2e8f0;font-weight:700;} td{padding:8px;border:1px solid #e2e8f0;} .summary{background:#f8fafc;padding:16px;border-radius:12px;margin-top:25px;display:flex;gap:30px;flex-wrap:wrap;justify-content:space-between;} .footer{margin-top:35px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:15px;} .positive{color:#10b981;font-weight:700;} .negative{color:#ef4444;font-weight:700;} @media print{body{margin:0;padding:0.7cm;}}</style></head><body><div class="header"><div class="logo">هوى الشام للسياحة والسفر</div><div class="subtitle">تقرير شامل للحسابات الداخلية (لنا / له)</div></div><h2>ملخص حسابات الشركات</h2><table><thead><tr><th>اسم الشركة</th><th>إجمالي لنا</th><th>إجمالي له</th><th>صافي الرصيد</th><th>عدد القيود</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><p>📥 إجمالي لنا الكلي: <strong>${formatNumber(totalIn)} ${currency}</strong></p><p>📤 إجمالي له الكلي: <strong>${formatNumber(totalOut)} ${currency}</strong></p><p>💰 صافي الرصيد الكلي: <strong class="${netTotal >= 0 ? 'positive' : 'negative'}">${formatNumber(netTotal)} ${currency}</strong></p></div><div class="footer">تمت الطباعة: ${now}<br>هذا التقرير تلقائي من نظام هوى الشام</div></body></html>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.focus(); win.print();
}

function printCompanyRecordsTable(companyName, records) {
    let totalForUs = 0, totalForThem = 0;
    records.forEach(r => { if (r.type === 'for_us') totalForUs += r.amount; else totalForThem += r.amount; });
    const net = totalForUs - totalForThem;
    const currency = records[0]?.currency || 'SAR';
    const now = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'medium' });
    let rows = '';
    records.forEach(r => { const sign = r.type === 'for_us' ? '+' : '-'; rows += `<tr><td>${r.id}</td><td>${formatDate(r.date)}</td><td>${r.type === 'for_us' ? 'لنا' : 'له'}</td><td class="${r.type === 'for_us' ? 'positive' : 'negative'}">${sign} ${formatNumber(r.amount)} ${r.currency || 'SAR'}</td><td>${escapeHtml(r.notes || '-')}</td></tr>`; });
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>كشف حساب ${companyName}</title><style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'); *{margin:0;padding:0;box-sizing:border-box;} body{font-family:'Tajawal',sans-serif;padding:1.5cm;background:white;color:#1f2937;direction:rtl;} .header{text-align:center;margin-bottom:25px;border-bottom:2px solid #4f46e5;padding-bottom:12px;} .logo{font-size:28px;font-weight:800;color:#4f46e5;} .company-name{font-size:20px;font-weight:700;margin:15px 0 10px;background:#f1f5f9;padding:8px 15px;border-radius:10px;display:inline-block;} table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;} th{background:#f1f5f9;padding:10px 8px;border:1px solid #e2e8f0;} td{padding:8px;border:1px solid #e2e8f0;} .summary{background:#f8fafc;padding:16px;border-radius:12px;margin-top:20px;display:flex;gap:20px;flex-wrap:wrap;justify-content:space-between;} .footer{margin-top:30px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px;} .positive{color:#10b981;font-weight:700;} .negative{color:#ef4444;font-weight:700;} @media print{body{margin:0;padding:0.5cm;}}</style></head><body><div class="header"><div class="logo">هوى الشام للسياحة والسفر</div></div><div class="company-name">📋 كشف حساب: ${escapeHtml(companyName)}</div><table><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><p>📥 إجمالي لنا: <strong>${formatNumber(totalForUs)} ${currency}</strong></p><p>📤 إجمالي له: <strong>${formatNumber(totalForThem)} ${currency}</strong></p><p>💰 صافي الرصيد: <strong class="${net >= 0 ? 'positive' : 'negative'}">${formatNumber(net)} ${currency}</strong></p></div><div class="footer">تمت الطباعة: ${now}<br>نظام هوى الشام - حسابات داخلية</div></body></html>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.focus(); win.print();
}

function exportCompanyRecordsToPDF(companyName, records) { printCompanyRecordsTable(companyName, records); }
