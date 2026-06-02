// js/accounts/dashboard.js - لوحة تحكم حسابات هوى الشام (لنا/له) - نسخة محسنة
import { getCache, refreshCaches } from '../db.js';
import { formatNumber, showToast, escapeHtml } from '../utils.js';

const professionalStyles = `
<style>
.dashboard-layout{display:flex;flex-direction:column;gap:2rem;}
.filter-card{background:var(--surface-solid);border-radius:1.5rem;padding:1.5rem;box-shadow:0 8px 20px rgba(0,0,0,0.03);border:1px solid var(--border);}
.filter-bar-modern{display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;margin-bottom:0.5rem;}
.filter-pill-modern{background:var(--bg-secondary);border:1px solid var(--border);border-radius:2rem;padding:0.6rem 1.4rem;font-size:0.85rem;font-weight:600;cursor:pointer;transition:all 0.2s;color:var(--text-secondary);}
.filter-pill-modern:hover{background:var(--primary-light);border-color:var(--primary);color:var(--primary);transform:translateY(-1px);}
.filter-pill-modern.active{background:var(--primary);color:white;border-color:var(--primary);box-shadow:0 2px 8px var(--primary-glow);}
.custom-range{display:flex;gap:0.5rem;align-items:center;background:var(--bg-secondary);padding:0.3rem 0.8rem;border-radius:2rem;}
.custom-range input{border:1px solid var(--border);border-radius:2rem;padding:0.4rem 0.8rem;background:var(--surface-solid);font-size:0.8rem;}
.select-modern{background:var(--bg-secondary);border:1px solid var(--border);border-radius:2rem;padding:0.5rem 1rem;font-size:0.85rem;font-weight:500;color:var(--text-primary);cursor:pointer;}
.btn-modern{border-radius:2rem;padding:0.5rem 1.2rem;font-weight:600;border:none;cursor:pointer;}
.btn-primary-modern{background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;box-shadow:0 2px 6px var(--primary-glow);}
.btn-primary-modern:hover{transform:translateY(-1px);}
.btn-secondary-modern{background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);}
.chart-card-modern{background:var(--surface-solid);border-radius:1.5rem;padding:1.2rem;box-shadow:0 8px 20px rgba(0,0,0,0.03);border:1px solid var(--border);transition:transform 0.2s;}
.chart-card-modern:hover{transform:translateY(-2px);}
.chart-title{font-size:1.1rem;font-weight:700;background:linear-gradient(135deg,var(--text-primary),var(--text-secondary));-webkit-background-clip:text;background-clip:text;color:transparent;}
.table-professional{width:100%;border-collapse:separate;border-spacing:0;font-size:0.85rem;}
.table-professional th{background:var(--bg-secondary);padding:1rem;font-weight:700;color:var(--text-secondary);border-bottom:2px solid var(--border);text-align:right;}
.table-professional td{padding:0.9rem 1rem;border-bottom:1px solid var(--border);}
.positive{color:#10b981;font-weight:700;}
.negative{color:#ef4444;font-weight:700;}
.action-buttons-modern{display:flex;gap:1rem;justify-content:flex-end;margin-top:0.5rem;}
.fullscreen-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:10000;align-items:center;justify-content:center;}
.fullscreen-modal canvas{max-width:90%;max-height:90%;background:white;border-radius:1.5rem;}
.close-fullscreen{position:absolute;top:20px;left:20px;background:white;border:none;border-radius:50%;width:44px;height:44px;font-size:1.5rem;cursor:pointer;}
</style>
`;

let currentChart = null, currentComparisonChart = null;
let userPreferences = { period: 'this-month', customStart: '', customEnd: '', selectedCompany: 'all', chartType: 'line', hiddenColumns: [] };

function loadPreferences() {
    const saved = localStorage.getItem('accountsDashboardPrefs');
    if (saved) try { Object.assign(userPreferences, JSON.parse(saved)); } catch(e) {}
}
function savePreferences() { localStorage.setItem('accountsDashboardPrefs', JSON.stringify(userPreferences)); }

function getCachedData(key, ttl=60000) {
    const cached = localStorage.getItem(`cache_${key}`);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < ttl) return data;
    }
    return null;
}
function setCachedData(key, data) { localStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp: Date.now() })); }

function calculateStatsByCurrency(expenses) {
    const cacheKey = `stats_${expenses.length}_${expenses.reduce((s,e)=>s+e.id+e.amount,'')}`;
    const cached = getCachedData(cacheKey, 30000);
    if (cached) return cached;
    const map = new Map();
    for (const e of expenses) {
        const cur = e.currency || 'SAR';
        if (!map.has(cur)) map.set(cur, { for_us: 0, for_them: 0, companies: new Set(), count: 0 });
        const stats = map.get(cur);
        if (e.type === 'for_us') stats.for_us += e.amount;
        else stats.for_them += e.amount;
        stats.companies.add(e.company_name);
        stats.count++;
    }
    const result = {};
    for (const [cur, vals] of map.entries()) {
        result[cur] = {
            for_us: vals.for_us,
            for_them: vals.for_them,
            net: vals.for_us - vals.for_them,
            companiesCount: vals.companies.size,
            recordsCount: vals.count
        };
    }
    setCachedData(cacheKey, result);
    return result;
}

function getMonthlyDataByCurrency(expenses) {
    const cacheKey = `monthly_${expenses.length}_${expenses.reduce((s,e)=>s+e.id+e.date,'')}`;
    const cached = getCachedData(cacheKey, 30000);
    if (cached) return cached;
    const currencyMap = new Map();
    for (const e of expenses) {
        const cur = e.currency || 'SAR';
        const month = e.date.substring(0,7);
        if (!currencyMap.has(cur)) currencyMap.set(cur, new Map());
        const monthMap = currencyMap.get(cur);
        if (!monthMap.has(month)) monthMap.set(month, { for_us: 0, for_them: 0 });
        const data = monthMap.get(month);
        if (e.type === 'for_us') data.for_us += e.amount;
        else data.for_them += e.amount;
    }
    const result = {};
    for (const [cur, monthMap] of currencyMap.entries()) {
        const months = Array.from(monthMap.keys()).sort();
        result[cur] = { months, for_us: months.map(m=>monthMap.get(m).for_us), for_them: months.map(m=>monthMap.get(m).for_them) };
    }
    setCachedData(cacheKey, result);
    return result;
}

function filterExpensesByPeriod(expenses, period, customStart, customEnd) {
    if (period === 'custom' && customStart && customEnd) return expenses.filter(e => e.date >= customStart && e.date <= customEnd);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (period === 'this-month') return expenses.filter(e => e.date >= `${year}-${String(month+1).padStart(2,'0')}-01`);
    if (period === 'last-month') {
        const lastMonth = new Date(year, month-1, 1);
        const start = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth()+1).padStart(2,'0')}-01`;
        const end = `${year}-${String(month+1).padStart(2,'0')}-01`;
        return expenses.filter(e => e.date >= start && e.date < end);
    }
    if (period === 'this-year') return expenses.filter(e => e.date.startsWith(`${year}-`));
    return expenses;
}
function filterByCompany(expenses, companyName) { return (companyName && companyName !== 'all') ? expenses.filter(e=>e.company_name===companyName) : expenses; }

function calculateTrendLine(data) {
    const n = data.length; if (n < 2) return data.map(()=>0);
    let sumX=0, sumY=0, sumXY=0, sumX2=0;
    for (let i=0; i<n; i++) { sumX+=i; sumY+=data[i]; sumXY+=i*data[i]; sumX2+=i*i; }
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;
    return data.map((_,i)=>slope*i + intercept);
}

function renderMonthlyChart(monthlyDataByCurrency, selectedCurrency, chartType='line') {
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;
    if (currentChart) currentChart.destroy();
    const data = monthlyDataByCurrency[selectedCurrency];
    if (!data || !data.months.length) { ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.fillText('لا توجد بيانات',10,50); return; }
    const datasets = [
        { label: `لنا (${selectedCurrency})`, data: data.for_us, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
        { label: `له (${selectedCurrency})`, data: data.for_them, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', fill: true, tension: 0.3 }
    ];
    if (chartType === 'line') {
        datasets.push({ label: 'اتجاه لنا', data: calculateTrendLine(data.for_us), borderColor: '#10b981', borderDash: [5,5], fill: false, pointRadius: 0 });
        datasets.push({ label: 'اتجاه له', data: calculateTrendLine(data.for_them), borderColor: '#f43f5e', borderDash: [5,5], fill: false, pointRadius: 0 });
    }
    currentChart = new Chart(ctx, { type: chartType==='bar'?'bar':'line', data: { labels: data.months, datasets }, options: { responsive: true, maintainAspectRatio: true, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.raw)}` } } } } });
}

function renderComparisonChart(period1Data, period2Data) {
    const ctx = document.getElementById('comparisonChart')?.getContext('2d');
    if (!ctx) return;
    if (currentComparisonChart) currentComparisonChart.destroy();
    if (!period1Data || !period2Data) return;
    currentComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['الفترة الأولى', 'الفترة الثانية'], datasets: [
            { label: 'لنا', data: [period1Data.for_usTotal, period2Data.for_usTotal], backgroundColor: '#10b981' },
            { label: 'له', data: [period1Data.for_themTotal, period2Data.for_themTotal], backgroundColor: '#f43f5e' }
        ] },
        options: { responsive: true, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.raw)}` } } } }
    });
}

function renderCurrencySummaryTable(statsByCurrency, hiddenColumns=[]) {
    const tbody = document.getElementById('currency-summary-table');
    if (!tbody) return;
    const showCompanies = !hiddenColumns.includes('companiesCount');
    const showRecords = !hiddenColumns.includes('recordsCount');
    let rows = '';
    for (const [cur, vals] of Object.entries(statsByCurrency)) {
        rows += `<tr><td><strong>${escapeHtml(cur)}</strong></td><td class="positive">${formatNumber(vals.for_us)}</td><td class="negative">${formatNumber(vals.for_them)}</td><td class="${vals.net>=0?'positive':'negative'}">${formatNumber(vals.net)}</td>${showCompanies?`<td>${vals.companiesCount}</td>`:''}${showRecords?`<td>${vals.recordsCount}</td>`:''}</tr>`;
    }
    tbody.innerHTML = rows;
}

function loadXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
        script.onload = resolve; script.onerror = () => reject(new Error('فشل تحميل Excel'));
        document.head.appendChild(script);
    });
}

async function exportToExcel(expenses, statsByCurrency) {
    try {
        await loadXLSX();
        const wsData = [['العملة', 'لنا (مستحق لنا)', 'له (مستحق عليهم)', 'صافي الرصيد', 'عدد الشركات', 'عدد القيود']];
        for (const [cur, vals] of Object.entries(statsByCurrency)) wsData.push([cur, vals.for_us, vals.for_them, vals.net, vals.companiesCount, vals.recordsCount]);
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'حسابات هوى الشام');
        XLSX.writeFile(wb, `hawaa_accounts_${new Date().toISOString().slice(0,19)}.xlsx`);
        showToast('تم التصدير إلى Excel بنجاح', 'success');
    } catch(e) { showToast('فشل التصدير: '+e.message, 'error'); }
}

async function printFullReport(expenses, statsByCurrency, monthlyData, selectedCurrency, filterPeriod, filterCompanyName) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showToast('الرجاء السماح بالنوافذ المنبثقة', 'warning'); return; }
    let tableRows = '';
    for (const [cur, vals] of Object.entries(statsByCurrency)) {
        tableRows += `<tr><td style="padding:10px;border:1px solid #e5e7eb;"><strong>${escapeHtml(cur)}</strong></td><td style="padding:10px;border:1px solid #e5e7eb;text-align:left;color:#10b981;font-weight:600;">${formatNumber(vals.for_us)}</td><td style="padding:10px;border:1px solid #e5e7eb;text-align:left;color:#ef4444;font-weight:600;">${formatNumber(vals.for_them)}</td><td style="padding:10px;border:1px solid #e5e7eb;text-align:left;color:${vals.net>=0?'#10b981':'#ef4444'};">${formatNumber(vals.net)}</td><td>${vals.companiesCount}</td><td>${vals.recordsCount}</td></tr>`;
    }
    let chartImage = '';
    const chartCanvas = document.getElementById('monthlyChart');
    if (chartCanvas && typeof Chart !== 'undefined') {
        try { chartImage = `<img src="${chartCanvas.toDataURL('image/png')}" style="width:100%;max-width:600px;margin:20px auto;display:block;border:1px solid #ddd;border-radius:8px;" />`; } catch(e) { chartImage = '<p>⚠️ تعذر تضمين المخطط</p>'; }
    }
    const periodText = { 'this-month':'هذا الشهر', 'last-month':'الشهر الماضي', 'this-year':'هذه السنة', 'all':'كل الوقت', 'custom':`فترة مخصصة` }[filterPeriod] || filterPeriod;
    const companyText = filterCompanyName === 'all' ? 'كل الشركات' : filterCompanyName;
    const now = new Date();
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير حسابات هوى الشام</title><style>body{font-family:'Tajawal',sans-serif;padding:1.5cm;direction:rtl;} .header{text-align:center;border-bottom:3px solid #4f46e5;margin-bottom:20px;} .logo{font-size:28px;font-weight:800;color:#4f46e5;} .filters-info{background:#f8fafc;padding:12px;border-radius:12px;margin-bottom:20px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #e2e8f0;padding:8px;text-align:right;} th{background:#f1f5f9;} .positive{color:#10b981;} .negative{color:#ef4444;} .footer{margin-top:35px;text-align:center;font-size:11px;} .note{background:#fef9c3;padding:8px;border-radius:8px;text-align:center;margin-top:15px;}</style></head><body><div class="header"><div class="logo">هوى الشام للسياحة والسفر</div><div class="subtitle">تقرير حسابات (لنا / له)</div></div><div class="filters-info"><strong>فترة التقرير:</strong> ${periodText}<br><strong>الشركة:</strong> ${escapeHtml(companyText)}<br><strong>تاريخ الطباعة:</strong> ${now.toLocaleDateString('ar-EG')}</div><h3>📋 إجماليات كل عملة</h3><table><thead><tr><th>العملة</th><th>لنا</th><th>له</th><th>صافي</th><th>عدد الشركات</th><th>عدد القيود</th></tr></thead><tbody>${tableRows}</tbody></table><div class="note">⚠️ ملاحظة: الإجماليات معروضة لكل عملة على حدة. لا يمكن جمع العملات المختلفة.</div><h3>📈 تطور لنا وله (${selectedCurrency})</h3>${chartImage}<div class="footer">هوى الشام للسياحة والسفر - جميع الحقوق محفوظة © ${now.getFullYear()}</div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

export async function loadAccountsDashboardPanel() {
    await refreshCaches();
    loadPreferences();
    const { expenses } = getCache();
    let filtered = filterExpensesByPeriod(expenses, userPreferences.period, userPreferences.customStart, userPreferences.customEnd);
    filtered = filterByCompany(filtered, userPreferences.selectedCompany);
    const stats = calculateStatsByCurrency(filtered);
    const monthlyData = getMonthlyDataByCurrency(filtered);
    const currencies = Object.keys(stats).sort();
    const defaultCurrency = currencies[0] || 'SAR';
    const companiesList = [...new Set(expenses.map(e=>e.company_name))].sort();

    const container = document.getElementById('tab-content');
    container.innerHTML = professionalStyles + `
    <div class="dashboard-layout">
        <div class="filter-card"><div class="filter-bar-modern">
            <div class="filter-pill-modern ${userPreferences.period==='this-month'?'active':''}" data-period="this-month">هذا الشهر</div>
            <div class="filter-pill-modern ${userPreferences.period==='last-month'?'active':''}" data-period="last-month">الشهر الماضي</div>
            <div class="filter-pill-modern ${userPreferences.period==='this-year'?'active':''}" data-period="this-year">هذه السنة</div>
            <div class="filter-pill-modern ${userPreferences.period==='all'?'active':''}" data-period="all">كل الوقت</div>
            <div class="filter-pill-modern ${userPreferences.period==='custom'?'active':''}" data-period="custom">مخصص</div>
            <div id="custom-date-range" class="custom-range" style="display:${userPreferences.period==='custom'?'flex':'none'};"><input type="date" id="custom-start" value="${userPreferences.customStart}"><span>إلى</span><input type="date" id="custom-end" value="${userPreferences.customEnd}"><button class="btn-modern btn-primary-modern" id="apply-custom">تطبيق</button></div>
            <select id="company-filter-select" class="select-modern"><option value="all">كل الشركات</option>${companiesList.map(c=>`<option value="${escapeHtml(c)}" ${userPreferences.selectedCompany===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
            <select id="chart-type-select" class="select-modern"><option value="line" ${userPreferences.chartType==='line'?'selected':''}>📈 خطي</option><option value="bar" ${userPreferences.chartType==='bar'?'selected':''}>📊 شريطي</option></select>
            <button id="toggle-columns-btn" class="btn-modern btn-secondary-modern">🔘 إخفاء/إظهار الأعمدة</button>
        </div></div>
        <div style="display:flex;flex-wrap:wrap;gap:1.5rem;"><div class="chart-card-modern" style="flex:2;"><div class="chart-header"><span class="chart-title">📈 تطور لنا واله</span><button id="fullscreen-chart-btn" class="btn-modern btn-secondary-modern">⛶ ملء الشاشة</button></div><canvas id="monthlyChart" height="220"></canvas><div style="margin-top:0.8rem;"><select id="chart-currency-select" class="select-modern">${currencies.map(cur=>`<option value="${cur}" ${cur===defaultCurrency?'selected':''}>العملة: ${cur}</option>`).join('')}</select></div></div>
        <div class="chart-card-modern" style="flex:1;"><div class="chart-header"><span class="chart-title">📊 مقارنة فترتين</span></div><select id="compare-period1" class="select-modern"><option value="this-month">هذا الشهر</option><option value="last-month">الشهر الماضي</option><option value="this-year">هذه السنة</option><option value="all">كل الوقت</option></select><select id="compare-period2" class="select-modern"><option value="last-month">الشهر الماضي</option><option value="this-month">هذا الشهر</option><option value="this-year">هذه السنة</option><option value="all">كل الوقت</option></select><canvas id="comparisonChart" height="150"></canvas></div></div>
        <div class="chart-card-modern"><div class="chart-header"><span class="chart-title">📋 إجماليات كل عملة (لنا/له)</span></div><div class="table-wrap"><table class="table-professional"><thead><tr><th>العملة</th><th>لنا</th><th>له</th><th>صافي</th>${!userPreferences.hiddenColumns.includes('companiesCount')?'<th>عدد الشركات</th>':''}${!userPreferences.hiddenColumns.includes('recordsCount')?'<th>عدد القيود</th>':''}</tr></thead><tbody id="currency-summary-table"></tbody></table></div></div>
        <div class="action-buttons-modern"><button class="btn-modern btn-primary-modern" id="export-excel-btn">📊 تصدير Excel</button><button class="btn-modern btn-secondary-modern" id="print-report-btn">🖨️ طباعة التقرير</button></div>
    </div>
    <div id="fullscreen-modal" class="fullscreen-modal"><canvas id="fullscreenChart"></canvas><button id="close-fullscreen" class="close-fullscreen">✖</button></div>`;

    renderCurrencySummaryTable(stats, userPreferences.hiddenColumns);

    document.querySelectorAll('.filter-pill-modern').forEach(btn=>{
        btn.addEventListener('click',()=>{
            const period = btn.dataset.period;
            userPreferences.period = period;
            if (period !== 'custom') { savePreferences(); loadAccountsDashboardPanel(); }
            else document.getElementById('custom-date-range').style.display = 'flex';
        });
    });
    document.getElementById('apply-custom')?.addEventListener('click',()=>{
        userPreferences.customStart = document.getElementById('custom-start').value;
        userPreferences.customEnd = document.getElementById('custom-end').value;
        if (userPreferences.customStart && userPreferences.customEnd) { userPreferences.period='custom'; savePreferences(); loadAccountsDashboardPanel(); }
        else showToast('يرجى إدخال تاريخ البداية والنهاية','warning');
    });
    document.getElementById('company-filter-select')?.addEventListener('change',(e)=>{ userPreferences.selectedCompany=e.target.value; savePreferences(); loadAccountsDashboardPanel(); });
    document.getElementById('chart-type-select')?.addEventListener('change',(e)=>{ userPreferences.chartType=e.target.value; savePreferences(); loadAccountsDashboardPanel(); });
    document.getElementById('toggle-columns-btn')?.addEventListener('click',()=>{
        if(userPreferences.hiddenColumns.includes('companiesCount')) userPreferences.hiddenColumns = userPreferences.hiddenColumns.filter(c=>c!=='companiesCount');
        else userPreferences.hiddenColumns.push('companiesCount');
        savePreferences(); loadAccountsDashboardPanel();
    });
    document.getElementById('export-excel-btn')?.addEventListener('click',()=>exportToExcel(filtered, stats));
    document.getElementById('print-report-btn')?.addEventListener('click',()=>{
        const selectedCurrency = document.getElementById('chart-currency-select')?.value || 'SAR';
        printFullReport(filtered, stats, monthlyData, selectedCurrency, userPreferences.period, userPreferences.selectedCompany);
    });
    const chartCurrencySelect = document.getElementById('chart-currency-select');
    const renderMonthly = () => renderMonthlyChart(monthlyData, chartCurrencySelect.value, userPreferences.chartType);
    chartCurrencySelect.addEventListener('change', renderMonthly);
    renderMonthly();

    async function updateComparison() {
        const p1 = document.getElementById('compare-period1').value, p2 = document.getElementById('compare-period2').value;
        const f1 = filterExpensesByPeriod(expenses, p1, '', ''), f2 = filterExpensesByPeriod(expenses, p2, '', '');
        const s1 = calculateStatsByCurrency(f1), s2 = calculateStatsByCurrency(f2);
        const for_us1 = Object.values(s1).reduce((a,b)=>a+b.for_us,0), for_them1 = Object.values(s1).reduce((a,b)=>a+b.for_them,0);
        const for_us2 = Object.values(s2).reduce((a,b)=>a+b.for_us,0), for_them2 = Object.values(s2).reduce((a,b)=>a+b.for_them,0);
        renderComparisonChart({ for_usTotal: for_us1, for_themTotal: for_them1 }, { for_usTotal: for_us2, for_themTotal: for_them2 });
    }
    document.getElementById('compare-period1')?.addEventListener('change', updateComparison);
    document.getElementById('compare-period2')?.addEventListener('change', updateComparison);
    updateComparison();

    const modal = document.getElementById('fullscreen-modal'), closeBtn = document.getElementById('close-fullscreen'), fullBtn = document.getElementById('fullscreen-chart-btn');
    let fullChart = null;
    fullBtn?.addEventListener('click',()=>{
        const canvas = document.getElementById('fullscreenChart'), ctx = canvas.getContext('2d');
        const selected = chartCurrencySelect.value, data = monthlyData[selected];
        if (data && data.months.length) {
            canvas.width=800; canvas.height=400;
            if (fullChart) fullChart.destroy();
            fullChart = new Chart(ctx, { type: userPreferences.chartType==='bar'?'bar':'line', data: { labels: data.months, datasets: [{ label: `لنا (${selected})`, data: data.for_us, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)' }, { label: `له (${selected})`, data: data.for_them, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.2)' }] }, options: { responsive: true } });
            modal.style.display = 'flex';
        }
    });
    closeBtn?.addEventListener('click',()=>{ if(fullChart) fullChart.destroy(); modal.style.display='none'; });
}
