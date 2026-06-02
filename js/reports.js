// js/reports.js - تقارير مالية وإدارية (نسخة كاملة)
import { refreshCaches, getCache, apiCall } from './db.js';
import { formatNumber, ICONS, showToast, getCurrencySettings, escapeHtml, openModal, formatDate, confirmDialog, emptyState } from './utils.js';

function formatDateYMD(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMonthRange(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { start: formatDateYMD(firstDay), end: formatDateYMD(lastDay) };
}
function getYearRange(year) { return { start: `${year}-01-01`, end: `${year}-12-31` }; }

function showImprovedPeriodSelector(callback) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 1; y++) years.push(y);
    const modal = openModal({
        title: 'اختر الفترة الزمنية',
        bodyHTML: `
            <div class="form-group"><label>نوع الفترة</label><select class="select" id="period-type"><option value="month">شهر محدد</option><option value="year">سنة محددة</option><option value="custom">فترة مخصصة</option></select></div>
            <div class="form-group" id="year-group"><label>السنة</label><select class="select" id="period-year">${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
            <div class="form-group" id="month-group"><label>الشهر</label><select class="select" id="period-month">${Array(12).fill().map((_, i) => `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
            <div class="form-group" id="custom-start-group" style="display:none;"><label>من تاريخ</label><input type="date" class="input" id="custom-start" value="${formatDateYMD(new Date(currentYear, currentMonth, 1))}"></div>
            <div class="form-group" id="custom-end-group" style="display:none;"><label>إلى تاريخ</label><input type="date" class="input" id="custom-end" value="${formatDateYMD(now)}"></div>
            <div class="form-group"><button class="btn btn-secondary btn-sm" id="quick-this-month">هذا الشهر</button><button class="btn btn-secondary btn-sm" id="quick-last-month">الشهر الماضي</button><button class="btn btn-secondary btn-sm" id="quick-this-year">هذه السنة</button></div>
        `,
        footerHTML: `<button class="btn btn-secondary" id="cancel-period">إلغاء</button><button class="btn btn-primary" id="apply-period">تطبيق</button>`
    });
    const typeSelect = modal.element.querySelector('#period-type');
    const yearGroup = modal.element.querySelector('#year-group');
    const monthGroup = modal.element.querySelector('#month-group');
    const customStartGroup = modal.element.querySelector('#custom-start-group');
    const customEndGroup = modal.element.querySelector('#custom-end-group');
    typeSelect.addEventListener('change', () => {
        const val = typeSelect.value;
        yearGroup.style.display = val === 'custom' ? 'none' : 'block';
        monthGroup.style.display = val === 'month' ? 'block' : 'none';
        customStartGroup.style.display = val === 'custom' ? 'block' : 'none';
        customEndGroup.style.display = val === 'custom' ? 'block' : 'none';
    });
    const setQuick = (start, end) => { callback({ start, end }); modal.close(); };
    modal.element.querySelector('#quick-this-month').onclick = () => { const start = formatDateYMD(new Date(currentYear, currentMonth, 1)); const end = formatDateYMD(new Date(currentYear, currentMonth + 1, 0)); setQuick(start, end); };
    modal.element.querySelector('#quick-last-month').onclick = () => { const start = formatDateYMD(new Date(currentYear, currentMonth - 1, 1)); const end = formatDateYMD(new Date(currentYear, currentMonth, 0)); setQuick(start, end); };
    modal.element.querySelector('#quick-this-year').onclick = () => { const start = `${currentYear}-01-01`; const end = `${currentYear}-12-31`; setQuick(start, end); };
    modal.element.querySelector('#apply-period').onclick = () => {
        const type = typeSelect.value;
        let start, end;
        if (type === 'month') { const year = parseInt(modal.element.querySelector('#period-year').value); const month = parseInt(modal.element.querySelector('#period-month').value); const range = getMonthRange(year, month); start = range.start; end = range.end; }
        else if (type === 'year') { const year = parseInt(modal.element.querySelector('#period-year').value); const range = getYearRange(year); start = range.start; end = range.end; }
        else { start = modal.element.querySelector('#custom-start').value; end = modal.element.querySelector('#custom-end').value; if (!start || !end) { showToast('يرجى إدخال تاريخ البداية والنهاية', 'error'); return; } }
        callback({ start, end }); modal.close();
    };
    modal.element.querySelector('#cancel-period').onclick = () => modal.close();
}

function printReportImproved(title, contentHtml) {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { showToast('الرجاء السماح بالنوافذ المنبثقة', 'warning'); return; }
    const now = new Date().toLocaleString('ar-EG');
    const style = `<style>body{font-family:'Tajawal',sans-serif;margin:1.5cm;background:white;color:black;direction:rtl;} .header{text-align:center;margin-bottom:20px;} .title{font-size:24px;font-weight:bold;color:#4f46e5;} .subtitle{font-size:14px;color:#666;} table{width:100%;border-collapse:collapse;margin:20px 0;} th,td{border:1px solid #ddd;padding:8px;text-align:right;} th{background:#f2f2f2;} .footer{text-align:center;font-size:12px;color:#999;margin-top:30px;} @media print{body{margin:0;} .no-print{display:none;}}</style>`;
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title>${style}</head><body><div class="header"><div class="title">هوى الشام للسياحة والسفر</div><div class="subtitle">${title}</div><div class="subtitle">تاريخ الطباعة: ${now}</div></div><div>${contentHtml}</div><div class="footer">هوى الشام للسياحة والسفر - جميع الحقوق محفوظة</div></body></html>`;
    printWindow.document.write(html); printWindow.document.close(); printWindow.focus(); printWindow.print();
}

export async function loadReports() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `<div class="card"><h3 class="card-title">التقارير المالية والإدارية</h3><p class="card-subtitle">اختر التقرير الذي تريد عرضه</p></div>
    <div class="report-card" data-report="income_statement"><div class="report-icon">${ICONS.chart}</div><div class="report-info"><h4>قائمة الدخل</h4><p>الإيرادات والمصروفات وصافي الربح (مع اختيار الفترة)</p></div></div>
    <div class="report-card" data-report="trial_balance"><div class="report-icon">${ICONS.scale}</div><div class="report-info"><h4>ميزان المراجعة</h4><p>نظرة شاملة على أرصدة الحسابات</p></div></div>
    <div class="report-card" data-report="balance_sheet"><div class="report-icon">${ICONS.wallet}</div><div class="report-info"><h4>الميزانية العمومية</h4><p>الأصول والخصوم وحقوق الملكية</p></div></div>
    <div class="report-card" data-report="bookings_summary"><div class="report-icon">${ICONS.fileText}</div><div class="report-info"><h4>ملخص الحجوزات</h4><p>تحليل الحجوزات حسب النوع والشهر</p></div></div>
    <div class="report-card" data-report="commission_by_service"><div class="report-icon">${ICONS.dollar}</div><div class="report-info"><h4>العمولات حسب الخدمة</h4><p>توزيع أرباح هوى الشام حسب نوع الخدمة</p></div></div>
    <div class="report-card" data-report="company_payments"><div class="report-icon">${ICONS.factory}</div><div class="report-info"><h4>المدفوعات للشركات</h4><p>سجل تسديد مستحقات الشركات المقدمة للخدمات</p></div></div>
    <div class="report-card" data-report="customer_balances"><div class="report-icon">${ICONS.users}</div><div class="report-info"><h4>أرصدة العملاء</h4><p>المستحق على المسافرين (مدينون)</p></div></div>`;
    document.querySelectorAll('.report-card').forEach(el => el.addEventListener('click', () => {
        const r = el.dataset.report;
        if (r === 'income_statement') showIncomeStatementWithPeriod();
        else if (r === 'trial_balance') loadTrialBalance();
        else if (r === 'balance_sheet') loadBalanceSheet();
        else if (r === 'bookings_summary') showBookingsSummaryWithPeriod();
        else if (r === 'commission_by_service') loadCommissionByService();
        else if (r === 'company_payments') loadCompanyPayments();
        else if (r === 'customer_balances') loadCustomerBalances();
    }));
}

function renderReportWithBack(contentHtml, title) {
    return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 class="card-title">${title}</h3><button class="btn btn-secondary btn-sm" id="back-to-reports">↩️ العودة إلى التقارير</button></div>${contentHtml}</div>`;
}
function attachBackHandler() { document.getElementById('back-to-reports')?.addEventListener('click', () => loadReports()); }

async function showIncomeStatementWithPeriod() { showImprovedPeriodSelector(async ({ start, end }) => await loadIncomeStatement(start, end)); }
export async function loadIncomeStatement(startDate, endDate) {
    await refreshCaches();
    const { bookings, vouchers } = getCache();
    const start = startDate || formatDateYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const end = endDate || formatDateYMD(new Date());
    const bookingsInPeriod = bookings.filter(b => b.booking_date >= start && b.booking_date <= end);
    const commissionsEarned = bookingsInPeriod.reduce((sum, b) => sum + (b.commission_amount || 0), 0);
    const expensesInPeriod = vouchers.filter(v => v.type === 'expense' && v.date >= start && v.date <= end).reduce((sum, v) => sum + v.amount, 0);
    const netProfit = commissionsEarned - expensesInPeriod;
    const tableHtml = `<div class="table-wrap"><table class="table"><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody><tr><td>إيرادات العمولات</td><td class="positive">${formatNumber(commissionsEarned)}</td></tr><tr><td>المصاريف التشغيلية</td><td class="negative">${formatNumber(expensesInPeriod)}</td></tr><tr style="font-weight:900;border-top:2px solid var(--border);"><td>صافي الربح</td><td style="color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatNumber(netProfit)}</td></tr></tbody></table></div><div style="display:flex;gap:12px;margin-top:20px;justify-content:center;"><button class="btn btn-primary" id="print-income">🖨️ طباعة</button><button class="btn btn-secondary" id="change-period-income">📅 تغيير الفترة</button></div>`;
    const fullHtml = renderReportWithBack(tableHtml, `قائمة الدخل (${formatDate(start)} - ${formatDate(end)})`);
    document.getElementById('tab-content').innerHTML = fullHtml;
    attachBackHandler();
    document.getElementById('print-income')?.addEventListener('click', () => printReportImproved('قائمة الدخل', document.querySelector('.table-wrap').cloneNode(true).outerHTML));
    document.getElementById('change-period-income')?.addEventListener('click', showIncomeStatementWithPeriod);
}

export async function loadTrialBalance() {
    await refreshCaches();
    const { travelers, companies, vouchers, bookings } = getCache();
    const travelerBalances = travelers.map(t => { const totalDue = bookings.filter(b => b.traveler_id === t.id).reduce((s,b)=>s+b.total_amount,0); const totalPaid = vouchers.filter(v=>v.type==='receipt'&&v.traveler_id===t.id).reduce((s,v)=>s+v.amount,0); return totalDue-totalPaid; });
    const travelerDebit = travelerBalances.filter(b=>b>0).reduce((a,b)=>a+b,0);
    const travelerCredit = travelerBalances.filter(b=>b<0).reduce((a,b)=>a+Math.abs(b),0);
    const companyBalances = companies.map(c => { const airlineDue = bookings.filter(b=>b.company_id===c.id).reduce((s,b)=>s+(b.total_amount-(b.commission_amount||0)),0); const paidToCompany = vouchers.filter(v=>v.type==='payment'&&v.company_id===c.id).reduce((s,v)=>s+v.amount,0); return airlineDue-paidToCompany; });
    const companyDebit = companyBalances.filter(b=>b<0).reduce((a,b)=>a+Math.abs(b),0);
    const companyCredit = companyBalances.filter(b=>b>0).reduce((a,b)=>a+b,0);
    const totalReceipts = vouchers.filter(v=>v.type==='receipt').reduce((s,v)=>s+v.amount,0);
    const totalPayments = vouchers.filter(v=>v.type==='payment').reduce((s,v)=>s+v.amount,0);
    const totalExpenses = vouchers.filter(v=>v.type==='expense').reduce((s,v)=>s+v.amount,0);
    const cashBalance = totalReceipts - totalPayments - totalExpenses;
    const totalCommissions = bookings.reduce((s,b)=>s+(b.commission_amount||0),0);
    const equity = totalCommissions - totalExpenses;
    const totalDebit = travelerDebit + companyDebit + totalExpenses + (cashBalance < 0 ? -cashBalance : 0);
    const totalCredit = travelerCredit + companyCredit + equity + (cashBalance > 0 ? cashBalance : 0);
    const tableHtml = `<div class="table-wrap"><table class="table"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead><tbody><tr><td>المسافرون (المستحق عليهم)</td><td>${formatNumber(travelerDebit)}</td><td>${formatNumber(travelerCredit)}</td></tr><tr><td>الشركات (المستحق لهم)</td><td>${formatNumber(companyDebit)}</td><td>${formatNumber(companyCredit)}</td></tr><tr><td>الصندوق (النقدية)</td><td>${formatNumber(cashBalance > 0 ? cashBalance : 0)}</td><td>${formatNumber(cashBalance < 0 ? -cashBalance : 0)}</td></tr><tr><td>المصاريف التراكمية</td><td>${formatNumber(totalExpenses)}</td><td>-</td></tr><tr><td>حقوق الملكية (الأرباح المحتجزة)</td><td>-</td><td>${formatNumber(equity)}</td></tr></tbody><tfoot style="border-top:2px solid var(--border);"><tr><td><strong>المجموع</strong></td><td><strong>${formatNumber(totalDebit)}</strong></td><td><strong>${formatNumber(totalCredit)}</strong></td></tr></tfoot></table></div><div style="text-align:center;margin-top:20px;"><button class="btn btn-primary" id="print-trial">🖨️ طباعة</button></div>`;
    const fullHtml = renderReportWithBack(tableHtml, 'ميزان المراجعة');
    document.getElementById('tab-content').innerHTML = fullHtml;
    attachBackHandler();
    document.getElementById('print-trial')?.addEventListener('click', () => printReportImproved('ميزان المراجعة', document.querySelector('.table-wrap').cloneNode(true).outerHTML));
}

export async function loadBalanceSheet() {
    await refreshCaches();
    const { travelers, companies, vouchers, bookings } = getCache();
    const travelerReceivables = travelers.reduce((sum,t)=>{ const totalDue = bookings.filter(b=>b.traveler_id===t.id).reduce((s,b)=>s+b.total_amount,0); const totalPaid = vouchers.filter(v=>v.type==='receipt'&&v.traveler_id===t.id).reduce((s,v)=>s+v.amount,0); return sum+Math.max(0,totalDue-totalPaid); },0);
    const totalReceipts = vouchers.filter(v=>v.type==='receipt').reduce((s,v)=>s+v.amount,0);
    const totalPayments = vouchers.filter(v=>v.type==='payment').reduce((s,v)=>s+v.amount,0);
    const totalExpenses = vouchers.filter(v=>v.type==='expense').reduce((s,v)=>s+v.amount,0);
    const cashBalance = totalReceipts - totalPayments - totalExpenses;
    const liabilities = companies.reduce((sum,c)=>{ const airlineDue = bookings.filter(b=>b.company_id===c.id).reduce((s,b)=>s+(b.total_amount-(b.commission_amount||0)),0); const paidToCompany = vouchers.filter(v=>v.type==='payment'&&v.company_id===c.id).reduce((s,v)=>s+v.amount,0); return sum+Math.max(0,airlineDue-paidToCompany); },0);
    const totalCommissions = bookings.reduce((s,b)=>s+(b.commission_amount||0),0);
    const equity = totalCommissions - totalExpenses;
    const assets = travelerReceivables + (cashBalance > 0 ? cashBalance : 0);
    const liabilitiesEquity = liabilities + equity;
    const tableHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;"><div><h4>الأصول</h4><div class="table-wrap"><table class="table"><tr><td>المستحق على المسافرين</td><td>${formatNumber(travelerReceivables)}</td></tr><tr><td>رصيد الصندوق (النقدية)</td><td>${formatNumber(cashBalance > 0 ? cashBalance : 0)}</td></tr><tr style="border-top:2px solid var(--border);"><td><strong>إجمالي الأصول</strong></td><td><strong>${formatNumber(assets)}</strong></td></tr></table></div></div><div><h4>الخصوم وحقوق الملكية</h4><div class="table-wrap"><table class="table"><tr><td>المستحق للشركات</td><td>${formatNumber(liabilities)}</td></tr><tr><td>حقوق الملكية (الأرباح المحتجزة)</td><td>${formatNumber(equity)}</td></tr><tr style="border-top:2px solid var(--border);"><td><strong>إجمالي الخصوم وحقوق الملكية</strong></td><td><strong>${formatNumber(liabilitiesEquity)}</strong></td></tr></table></div></div></div>${Math.abs(assets - liabilitiesEquity) > 1 ? `<div class="alert-item" style="margin-top:16px;">⚠️ عدم توازن: الأصول (${formatNumber(assets)}) ≠ الخصوم + حقوق الملكية (${formatNumber(liabilitiesEquity)})</div>` : ''}<div style="text-align:center;margin-top:20px;"><button class="btn btn-primary" id="print-balance">🖨️ طباعة</button></div>`;
    const fullHtml = renderReportWithBack(tableHtml, 'الميزانية العمومية');
    document.getElementById('tab-content').innerHTML = fullHtml;
    attachBackHandler();
    document.getElementById('print-balance')?.addEventListener('click', () => printReportImproved('الميزانية العمومية', document.querySelector('.table-wrap').parentElement.outerHTML));
}

async function showBookingsSummaryWithPeriod() { showImprovedPeriodSelector(async ({ start, end }) => await loadBookingsSummary(start, end)); }
export async function loadBookingsSummary(startDate, endDate) {
    await refreshCaches();
    const { bookings, services } = getCache();
    const start = startDate || '2000-01-01';
    const end = endDate || '2099-12-31';
    const filteredBookings = bookings.filter(b => b.booking_date >= start && b.booking_date <= end);
    if (filteredBookings.length === 0) { const fullHtml = renderReportWithBack(emptyState('لا توجد حجوزات في هذه الفترة', 'جرب فترة زمنية أخرى'), 'ملخص الحجوزات'); document.getElementById('tab-content').innerHTML = fullHtml; attachBackHandler(); return; }
    const serviceStats = {};
    filteredBookings.forEach(b => { const type = b.service?.type || 'unknown'; if (!serviceStats[type]) serviceStats[type] = { count:0, revenue:0, commission:0 }; serviceStats[type].count++; serviceStats[type].revenue += b.total_amount; serviceStats[type].commission += b.commission_amount || 0; });
    const monthlyStats = {};
    filteredBookings.forEach(b => { const month = b.booking_date.substring(0,7); if (!monthlyStats[month]) monthlyStats[month] = { count:0, revenue:0 }; monthlyStats[month].count++; monthlyStats[month].revenue += b.total_amount; });
    const months = Object.keys(monthlyStats).sort();
    let statsHtml = '<h4>حسب نوع الخدمة</h4><div class="table-wrap"><table class="table"><thead><tr><th>نوع الخدمة</th><th>عدد الحجوزات</th><th>الإيرادات</th><th>عمولة هوى الشام</th></tr></thead><tbody>';
    for (const [type, data] of Object.entries(serviceStats)) { const typeName = { ticket:'تذكرة', visa:'فيزا', accommodation:'إقامة', tour:'رحلة', package:'باقة', unknown:'أخرى' }[type] || type; statsHtml += `<tr><td>${typeName}</td><td>${data.count}</td><td>${formatNumber(data.revenue)}</td><td>${formatNumber(data.commission)}</td></tr>`; }
    statsHtml += '</tbody></table></div><h4 style="margin-top:24px;">حسب الشهر</h4><div class="table-wrap"><table class="table"><thead><tr><th>الشهر</th><th>عدد الحجوزات</th><th>الإيرادات</th></tr></thead><tbody>';
    for (const m of months) { const data = monthlyStats[m]; statsHtml += `<tr><td>${m}</td><td>${data.count}</td><td>${formatNumber(data.revenue)}</td></tr>`; }
    statsHtml += '</tbody></table></div>';
    const actionsHtml = `<div style="display:flex;gap:12px;margin-top:20px;justify-content:center;"><button class="btn btn-primary" id="print-summary">🖨️ طباعة</button><button class="btn btn-secondary" id="change-period-summary">📅 تغيير الفترة</button></div>`;
    const fullHtml = renderReportWithBack(statsHtml + actionsHtml, `ملخص الحجوزات (${formatDate(start)} - ${formatDate(end)})`);
    document.getElementById('tab-content').innerHTML = fullHtml;
    attachBackHandler();
    document.getElementById('print-summary')?.addEventListener('click', () => printReportImproved('ملخص الحجوزات', document.querySelector('.table-wrap').outerHTML));
    document.getElementById('change-period-summary')?.addEventListener('click', showBookingsSummaryWithPeriod);
}

export async function loadCommissionByService() {
    await refreshCaches();
    const { bookings, services } = getCache();
    const commissionByService = {};
    bookings.forEach(b => { const serviceName = b.service?.name || 'خدمة غير معروفة'; if (!commissionByService[serviceName]) commissionByService[serviceName] = { count:0, commission:0 }; commissionByService[serviceName].count++; commissionByService[serviceName].commission += b.commission_amount || 0; });
    const sorted = Object.entries(commissionByService).sort((a,b) => b[1].commission - a[1].commission);
    let tableHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>الخدمة</th><th>عدد الحجوزات</th><th>إجمالي العمولة</th><th>متوسط العمولة</th></tr></thead><tbody>';
    for (const [name, data] of sorted) { const avg = data.commission / data.count; tableHtml += `<tr><td>${escapeHtml(name)}</td><td>${data.count}</td><td>${formatNumber(data.commission)}</td><td>${formatNumber(avg)}</td></tr>`; }
    tableHtml += '</tbody></table></div><div style="text-align:center;margin-top:20px;"><button class="btn btn-primary" id="print-commission">🖨️ طباعة</button></div>';
    const fullHtml = renderReportWithBack(tableHtml, 'العمولات حسب الخدمة');
    document.getElementById('tab-content').innerHTML = fullHtml;
    attachBackHandler();
    document.getElementById('print-commission')?.addEventListener('click', () => printReportImproved('العمولات حسب الخدمة', document.querySelector('.table-wrap').outerHTML));
}

export async function loadCompanyPayments() {
    await refreshCaches();
    const { vouchers, companies, bookings } = getCache();
    const payments = vouchers.filter(v => v.type === 'payment');
    const companyMap = new Map(companies.map(c => [c.id, c]));
    if (payments.length === 0) { const fullHtml = renderReportWithBack(emptyState('لا توجد مدفوعات مسجلة للشركات', ''), 'المدفوعات للشركات'); document.getElementById('tab-content').innerHTML = fullHtml; attachBackHandler(); return; }
    let tableHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الشركة</th><th>المبلغ</th><th>الحجز المرتبط</th><th>الوصف</th></tr></thead><tbody>';
    for (const p of payments.sort((a,b) => (b.date || '').localeCompare(a.date || ''))) { const company = companyMap.get(p.company_id); const booking = bookings.find(b => b.id == p.booking_id); tableHtml += `<tr><td>${formatDate(p.date)}</td><td>${company ? escapeHtml(company.name) : '-'}</td><td class="negative">${formatNumber(p.amount)}</td><td>${booking ? `#${booking.id} - ${escapeHtml(booking.traveler?.name || '')}` : 'بدون حجز'}</td><td>${escapeHtml(p.description || '')}</td></tr>`; }
    tableHtml += '</tbody></table></div>';
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const summaryHtml = `<div style="margin-bottom:16px;"><strong>إجمالي المدفوع:</strong> ${formatNumber(totalPaid)}</div>`;
    const actionsHtml = `<div style="text-align:center;margin-top:20px;"><button class="btn btn-primary" id="print-payments">🖨️ طباعة</button></div>`;
    const fullHtml = renderReportWithBack(summaryHtml + tableHtml + actionsHtml, 'المدفوعات للشركات');
    document.getElementById('tab-content').innerHTML = fullHtml;
    attachBackHandler();
    document.getElementById('print-payments')?.addEventListener('click', () => printReportImproved('المدفوعات للشركات', document.querySelector('.table-wrap').outerHTML));
}

export async function loadCustomerBalances() {
    await refreshCaches();
    const { travelers, bookings, vouchers } = getCache();
    const customerData = travelers.map(t => { const totalBookings = bookings.filter(b => b.traveler_id === t.id).reduce((sum,b) => sum + b.total_amount, 0); const paid = vouchers.filter(v => v.type === 'receipt' && v.traveler_id === t.id).reduce((sum,v) => sum + v.amount, 0); const balance = totalBookings - paid; return { ...t, totalBookings, paid, balance }; }).filter(c => c.balance !== 0).sort((a,b) => b.balance - a.balance);
    if (customerData.length === 0) { const fullHtml = renderReportWithBack(emptyState('لا توجد أرصدة مستحقة على المسافرين', ''), 'أرصدة العملاء'); document.getElementById('tab-content').innerHTML = fullHtml; attachBackHandler(); return; }
    let tableHtml = '<div class="table-wrap"><table class="table"><thead><tr><th>المسافر</th><th>إجمالي المشتريات</th><th>المدفوع</th><th>المتبقي عليه</th><th>الجوال</th></tr></thead><tbody>';
    for (const c of customerData) { tableHtml += `<tr><td>${escapeHtml(c.name)}</td><td>${formatNumber(c.totalBookings)}</td><td>${formatNumber(c.paid)}</td><td class="${c.balance > 0 ? 'negative' : 'positive'}">${formatNumber(c.balance > 0 ? c.balance : 0)}</td><td>${escapeHtml(c.phone || '-')}</td></tr>`; }
    tableHtml += '</tbody></table></div>';
    const totalDue = customerData.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
    const summaryHtml = `<div style="margin-bottom:16px;"><strong>إجمالي المستحق:</strong> ${formatNumber(totalDue)}</div>`;
    const actionsHtml = `<div style="text-align:center;margin-top:20px;"><button class="btn btn-primary" id="print-customers">🖨️ طباعة</button></div>`;
    const fullHtml = renderReportWithBack(summaryHtml + tableHtml + actionsHtml, 'أرصدة العملاء');
    document.getElementById('tab-content').innerHTML = fullHtml;
    attachBackHandler();
    document.getElementById('print-customers')?.addEventListener('click', () => printReportImproved('أرصدة العملاء', document.querySelector('.table-wrap').outerHTML));
}
