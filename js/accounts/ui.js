// js/accounts/ui.js - نسخة معدلة لدعم لنا/له
import { getExpenses, addExpense, updateExpense, deleteExpense, groupByCompany, groupRecordsByCurrency } from './api.js';
import { formatNumber, formatDate, ICONS, animateEntry, escapeHtml, showToast, openModal, confirmDialog, toEnglishDigits } from '../utils.js';
import { apiCall, refreshCaches, getCache } from '../db.js';

let allCompanies = [];

function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (typeof html2canvas !== 'undefined') return resolve();
        const script = document.createElement('script');
        script.src = './lib/html2canvas.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('فشل تحميل مكتبة html2canvas محلياً'));
        document.head.appendChild(script);
    });
}

function loadJspdf() {
    return new Promise((resolve, reject) => {
        if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) return resolve();
        const script = document.createElement('script');
        script.src = './lib/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('فشل تحميل مكتبة jsPDF محلياً'));
        document.head.appendChild(script);
    });
}

function generateReportHTML(companyName, records, paperSize = 'A4', orientation = 'portrait') {
    const groupedByCurrency = groupRecordsByCurrency(records);
    const now = new Date();
    const printDate = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const printTime = now.toLocaleTimeString('ar-EG');
    const isThermal = paperSize === 'thermal';

    let bodyRows = '';
    for (const group of groupedByCurrency) {
        const netColor = group.net >= 0 ? '#10b981' : '#ef4444';
        bodyRows += `
            <div class="currency-section">
                <div class="currency-title">💰 العملة: ${group.currency}</div>
                <div class="currency-summary">
                    <span>📥 لنا: ${formatNumber(group.total_for_us)} ${group.currency}</span>
                    <span>📤 له: ${formatNumber(group.total_for_them)} ${group.currency}</span>
                    <span style="color:${netColor};">💰 صافي: ${formatNumber(group.net)} ${group.currency}</span>
                </div>
                <table class="print-table" style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr><th style="border:1px solid #ddd; padding:8px;">التاريخ</th><th style="border:1px solid #ddd; padding:8px;">النوع</th><th style="border:1px solid #ddd; padding:8px;">المبلغ</th><th style="border:1px solid #ddd; padding:8px;">ملاحظات</th></tr>
                    </thead>
                    <tbody>`;
        for (const rec of group.records) {
            const sign = rec.type === 'for_us' ? '+' : '-';
            const typeText = rec.type === 'for_us' ? 'لنا' : 'له';
            bodyRows += `<tr><td style="border:1px solid #ddd; padding:8px;">${formatDate(rec.date)}</td><td style="border:1px solid #ddd; padding:8px;">${typeText}</td><td style="border:1px solid #ddd; padding:8px; text-align:left;" class="${rec.type === 'for_us' ? 'positive' : 'negative'}">${sign} ${formatNumber(rec.amount)}</td><td style="border:1px solid #ddd; padding:8px;">${escapeHtml(rec.notes || '-')}</td></tr>`;
        }
        bodyRows += `</tbody></table></div>`;
    }

    const logoText = 'هوى&nbsp;الشام&nbsp;للسياحة&nbsp;والسفر';
    const subtitleText = 'حسابات&nbsp;الشركات&nbsp;والجهات&nbsp;-&nbsp;تقرير&nbsp;مالي (لنا&nbsp;/&nbsp;له)';
    const companyInfoText = `📋&nbsp;${escapeHtml(companyName)}`;
    const footerText = `تمت&nbsp;الطباعة&nbsp;بتاريخ:&nbsp;${printDate}&nbsp;-&nbsp;${printTime}<br>هوى&nbsp;الشام&nbsp;للسياحة&nbsp;والسفر&nbsp;-&nbsp;جميع&nbsp;الحقوق&nbsp;محفوظة`;

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير حسابات ${companyName}</title><style>
        *{margin:0;padding:0;box-sizing:border-box;} body{font-family:'Segoe UI','Arial',sans-serif;background:white;color:#1f2937;direction:rtl;padding:${isThermal ? '0.2cm' : '1cm'};font-size:${isThermal ? '10px' : '12px'};line-height:1.5;}
        .report-container{max-width:${isThermal ? '100%' : '21cm'};margin:0 auto;} .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #4f46e5;padding-bottom:10px;}
        .logo{font-size:${isThermal ? '16px' : '24px'};font-weight:800;color:#4f46e5;} .subtitle{font-size:${isThermal ? '8px' : '11px'};color:#64748b;}
        .company-info{background:#f8fafc;padding:${isThermal ? '4px 8px' : '8px 12px'};border-radius:8px;margin-bottom:20px;text-align:center;font-weight:700;}
        .currency-section{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid;}
        .currency-title{background:#f1f5f9;padding:${isThermal ? '4px 8px' : '8px 12px'};font-weight:700;}
        .currency-summary{display:flex;gap:16px;padding:${isThermal ? '6px 8px' : '10px 12px'};background:#fff;border-bottom:1px solid #e2e8f0;font-weight:600;flex-wrap:wrap;}
        .print-table{width:100%;border-collapse:collapse;} .print-table th,.print-table td{border:1px solid #e2e8f0;padding:${isThermal ? '3px 4px' : '6px 8px'};text-align:right;}
        .positive{color:#10b981;font-weight:700;} .negative{color:#ef4444;font-weight:700;} .footer{margin-top:30px;text-align:center;font-size:${isThermal ? '7px' : '9px'};color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;}
        @media print{body{margin:0;padding:${isThermal ? '0.1cm' : '0.2cm';}}
    </style></head><body><div class="report-container"><div class="header"><div class="logo">${logoText}</div><div class="subtitle">${subtitleText}</div></div><div class="company-info">${companyInfoText}</div>${bodyRows}<div class="footer">${footerText}</div></div></body></html>`;
}

async function showPrintPreview(companyName, records, action = 'print') {
    const html = generateReportHTML(companyName, records, 'A4', 'portrait');
    if (action === 'print') {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) { showToast('الرجاء السماح بالنوافذ المنبثقة', 'warning'); return; }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    } else if (action === 'image') {
        try {
            await loadHtml2Canvas();
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute'; iframe.style.top = '-9999px'; iframe.style.left = '-9999px'; iframe.style.width = '800px'; iframe.style.height = '600px';
            document.body.appendChild(iframe);
            iframe.contentDocument.write(html);
            iframe.contentDocument.close();
            await new Promise(resolve => setTimeout(resolve, 200));
            const canvas = await html2canvas(iframe.contentDocument.body, { scale: 2, backgroundColor: '#ffffff' });
            document.body.removeChild(iframe);
            const safeName = companyName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            const filename = `hawaa_${safeName}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.png`;
            const link = document.createElement('a'); link.download = filename; link.href = canvas.toDataURL('image/png'); link.click();
            showToast(`✅ تم حفظ الصورة: ${filename}`, 'success');
        } catch (err) { showToast(`❌ فشل إنشاء الصورة: ${err.message}`, 'error'); }
    } else if (action === 'pdf') {
        try {
            await loadHtml2Canvas(); await loadJspdf();
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute'; iframe.style.top = '-9999px'; iframe.style.left = '-9999px'; iframe.style.width = '800px'; iframe.style.height = '600px';
            document.body.appendChild(iframe);
            iframe.contentDocument.write(html);
            iframe.contentDocument.close();
            await new Promise(resolve => setTimeout(resolve, 200));
            const canvas = await html2canvas(iframe.contentDocument.body, { scale: 2, backgroundColor: '#ffffff' });
            document.body.removeChild(iframe);
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; const pageHeight = 297; const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            if (imgHeight > pageHeight) {
                let heightLeft = imgHeight - pageHeight;
                while (heightLeft > 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); heightLeft -= pageHeight; }
            }
            const safeName = companyName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            const filename = `hawaa_${safeName}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.pdf`;
            pdf.save(filename);
            showToast(`✅ تم حفظ PDF: ${filename}`, 'success');
        } catch (err) { showToast(`❌ فشل إنشاء PDF: ${err.message}`, 'error'); }
    }
}

async function fetchAccountingCompanies() {
    await refreshCaches();
    const { companies } = getCache();
    const accountingCompanies = companies.filter(c => c.type === 'accounts');
    const allExpenses = await getExpenses();
    const expensesByCompany = {};
    for (const exp of allExpenses) {
        if (!expensesByCompany[exp.company_name]) expensesByCompany[exp.company_name] = [];
        expensesByCompany[exp.company_name].push(exp);
    }
    const result = [];
    for (const comp of accountingCompanies) {
        const records = expensesByCompany[comp.name] || [];
        result.push({
            company_name: comp.name,
            records: records,
            total_for_us: records.filter(r => r.type === 'for_us').reduce((s, r) => s + r.amount, 0),
            total_for_them: records.filter(r => r.type === 'for_them').reduce((s, r) => s + r.amount, 0)
        });
    }
    for (const expName in expensesByCompany) {
        if (!result.some(c => c.company_name === expName)) {
            const records = expensesByCompany[expName];
            result.push({
                company_name: expName,
                records: records,
                total_for_us: records.filter(r => r.type === 'for_us').reduce((s, r) => s + r.amount, 0),
                total_for_them: records.filter(r => r.type === 'for_them').reduce((s, r) => s + r.amount, 0)
            });
        }
    }
    result.sort((a, b) => a.company_name.localeCompare(b.company_name));
    return result;
}

export function renderAccountsUI() {
    return `
        <div class="card">
            <div class="card-header">
                <div><h3 class="card-title">حسابات هوى الشام</h3><span class="card-subtitle">تسجيل المبالغ المستحقة لنا أو علينا (لنا / له)</span></div>
                <button class="btn btn-primary btn-sm" id="add-transaction-btn">${ICONS.plus} إضافة حركة جديدة</button>
            </div>
            <div class="form-group"><label class="form-label">بحث باسم الشركة</label><input type="text" class="input" id="company-filter" placeholder="اكتب اسم الشركة للبحث..."></div>
            <div class="accounts-table-container" style="border:1px solid var(--border); border-radius:var(--radius); overflow:auto; max-height:400px;">
                <table class="table" style="min-width:600px; width:100%;"><thead style="position:sticky; top:0; background:var(--bg-secondary);"><tr><th style="padding:12px 16px;">اسم الشركة</th><th style="padding:12px 16px;">عدد القيود</th><th style="padding:12px 16px; text-align:left;">إجراءات</th></tr></thead><tbody id="accounts-tbody"></tbody></table>
            </div>
        </div>
    `;
}

async function addNewAccountingCompany(name) {
    if (!name || name.trim() === '') throw new Error('اسم الشركة مطلوب');
    const { companies } = getCache();
    const exists = companies.some(c => c.name === name && c.type === 'accounts');
    if (exists) return;
    await apiCall('/companies', 'POST', { name: name.trim(), type: 'accounts', phone: '', contact_person: '' });
    await refreshCaches();
}

export async function renderCompaniesList(filterText = '') {
    let all = await fetchAccountingCompanies();
    if (filterText) all = all.filter(c => c.company_name.toLowerCase().includes(filterText.toLowerCase()));
    allCompanies = all;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('accounts-tbody');
    if (!tbody) return;
    if (!allCompanies.length) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد شركات، قم بإضافة حركة جديدة</td></tr>'; return; }
    let html = '';
    for (const company of allCompanies) {
        html += `<tr class="company-row" data-company="${escapeHtml(company.company_name)}" style="cursor:pointer;">
            <td style="padding:12px 16px;"><strong>${escapeHtml(company.company_name)}</strong></td>
            <td style="padding:12px 16px;">${company.records.length}</td>
            <td style="padding:12px 16px; text-align:left;"><div class="action-buttons" style="display:inline-flex; gap:8px;"><button class="btn btn-secondary btn-sm edit-company" data-company="${escapeHtml(company.company_name)}">${ICONS.edit} تعديل</button><button class="btn btn-danger btn-sm delete-company" data-company="${escapeHtml(company.company_name)}">${ICONS.trash} حذف</button></div></td>
        </tr>`;
    }
    tbody.innerHTML = html;
    document.querySelectorAll('.company-row').forEach(row => row.addEventListener('click', (e) => { if (e.target.closest('.edit-company') || e.target.closest('.delete-company')) return; showCompanyDetails(row.dataset.company); }));
    document.querySelectorAll('.edit-company').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); const oldName = btn.dataset.company; const modal = openModal({ title: 'تعديل اسم الشركة', bodyHTML: '<div class="form-group"><label>الاسم الحالي</label><input type="text" class="input" value="'+escapeHtml(oldName)+'" disabled></div><div class="form-group"><label>الاسم الجديد</label><input type="text" class="input" id="new-company-name" placeholder="أدخل الاسم الجديد"></div>', footerHTML: '<button class="btn btn-secondary" id="cancel-edit-name">إلغاء</button><button class="btn btn-primary" id="save-edit-name">حفظ</button>' }); modal.element.querySelector('#save-edit-name').onclick = async () => { const newName = modal.element.querySelector('#new-company-name').value.trim(); if(!newName){showToast('الاسم الجديد مطلوب','error');return;} try{ const {companies}=getCache(); const comp=companies.find(c=>c.name===oldName&&c.type==='accounts'); if(comp) await apiCall('/companies','PUT',{id:comp.id,name:newName,type:'accounts',phone:comp.phone,contact_person:comp.contact_person}); const allExpenses=await getExpenses(); for(const exp of allExpenses.filter(e=>e.company_name===oldName)) await updateExpense({...exp,company_name:newName}); await refreshCaches(); showToast('تم تعديل اسم الشركة','success'); modal.close(); await renderCompaniesList(document.getElementById('company-filter')?.value||''); }catch(err){showToast(err.message,'error');} }; modal.element.querySelector('#cancel-edit-name').onclick=()=>modal.close(); }));
    document.querySelectorAll('.delete-company').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); const companyName = btn.dataset.company; if(await confirmDialog(`هل أنت متأكد من حذف جميع قيود شركة "${companyName}"؟`)){ try{ const allExpenses=await getExpenses(); for(const exp of allExpenses.filter(e=>e.company_name===companyName)) await deleteExpense(exp.id); const {companies}=getCache(); const comp=companies.find(c=>c.name===companyName&&c.type==='accounts'); if(comp) await apiCall(`/companies?id=${comp.id}`,'DELETE'); await refreshCaches(); showToast(`تم حذف قيود ${companyName}`,'success'); await renderCompaniesList(document.getElementById('company-filter')?.value||''); }catch(err){showToast(err.message,'error');} } }));
    animateEntry('#accounts-tbody tr', 60);
}

async function buildCompanyDatalist() {
    const companiesData = await fetchAccountingCompanies();
    let options = '';
    for (const c of companiesData) options += `<option value="${escapeHtml(c.company_name)}">`;
    return options;
}

export async function showAddRecordModal(initial = {}) {
    await refreshCaches();
    const datalistId = 'company-datalist-' + Date.now();
    let datalistOptions = await buildCompanyDatalist();
    const modal = openModal({
        title: 'إضافة حركة جديدة',
        bodyHTML: `<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group" style="grid-column:span2;"><label class="form-label">اسم الشركة / الجهة</label><div style="display:flex; gap:8px;"><input type="text" class="input" id="exp-company" list="${datalistId}" placeholder="ابحث عن شركة أو اكتب اسم جديد" style="flex:1;" value="${escapeHtml(initial.company_name || '')}" autocomplete="off"><datalist id="${datalistId}">${datalistOptions}</datalist><button type="button" class="btn btn-secondary" id="quick-add-company-btn">${ICONS.plus} إضافة شركة</button></div></div><div class="form-group"><label class="form-label">المبلغ</label><input type="number" step="0.01" class="input" id="exp-amount" placeholder="0.00"></div><div class="form-group"><label class="form-label">النوع</label><select class="select" id="exp-type"><option value="for_us">💰 لنا (مستحق لصالح هوى الشام)</option><option value="for_them">💳 له (مستحق للشركة)</option></select></div><div class="form-group"><label class="form-label">التاريخ</label><input type="date" class="input" id="exp-date" value="${new Date().toISOString().slice(0,10)}"></div><div class="form-group"><label class="form-label">العملة</label><select class="select" id="exp-currency"><option value="USD">دولار أمريكي (USD)</option><option value="SYP">ليرة سورية (SYP)</option><option value="EUR">يورو (EUR)</option><option value="JOD">دينار أردني (JOD)</option><option value="TRY">ليرة تركية (TRY)</option><option value="SAR" selected>ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option></select></div><div class="form-group"><label class="form-label">ملاحظات</label><textarea class="textarea" id="exp-notes" rows="2">${escapeHtml(initial.notes || '')}</textarea></div></div>`,
        footerHTML: `<button class="btn btn-secondary" id="cancel-expense">إلغاء</button><button class="btn btn-primary" id="save-expense">حفظ</button>`
    });
    const companyInput = modal.element.querySelector('#exp-company');
    const quickAddBtn = modal.element.querySelector('#quick-add-company-btn');
    const saveBtn = modal.element.querySelector('#save-expense');
    quickAddBtn.onclick = async () => {
        try {
            const newCompanyName = await new Promise((resolve, reject) => {
                const addModal = openModal({ title: 'إضافة شركة جديدة', bodyHTML: '<div class="form-group"><label>اسم الشركة</label><input type="text" class="input" id="new-account-company-name" placeholder="مثال: شركة الأفق للسفر" autofocus></div>', footerHTML: '<button class="btn btn-secondary" id="cancel-new-company">إلغاء</button><button class="btn btn-primary" id="confirm-new-company">إضافة</button>' });
                addModal.element.querySelector('#confirm-new-company').onclick = async () => { const name = addModal.element.querySelector('#new-account-company-name').value.trim(); if(!name){ showToast('اسم الشركة مطلوب','error'); return; } try{ await addNewAccountingCompany(name); showToast('تم إضافة الشركة','success'); addModal.close(); resolve(name); }catch(err){ showToast(err.message,'error'); reject(err); } };
                addModal.element.querySelector('#cancel-new-company').onclick = () => { addModal.close(); reject(new Error('ألغى المستخدم')); };
            });
            await refreshCaches();
            const newDatalistOptions = await buildCompanyDatalist();
            const datalistEl = modal.element.querySelector('datalist');
            if (datalistEl) datalistEl.innerHTML = newDatalistOptions;
            companyInput.value = newCompanyName;
            showToast(`تم إضافة "${newCompanyName}" واختياره`, 'success');
            const filterValue = document.getElementById('company-filter')?.value || '';
            await renderCompaniesList(filterValue);
        } catch(err) { if (err.message !== 'ألغى المستخدم') showToast(err.message, 'error'); }
    };
    if (initial.currency) { const currSelect = modal.element.querySelector('#exp-currency'); if (currSelect) currSelect.value = initial.currency; }
    saveBtn.onclick = async () => {
        saveBtn.disabled = true; saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const company = companyInput.value.trim();
            const amount = parseFloat(toEnglishDigits(modal.element.querySelector('#exp-amount').value));
            const type = modal.element.querySelector('#exp-type').value;
            const date = modal.element.querySelector('#exp-date').value;
            const currency = modal.element.querySelector('#exp-currency').value;
            const notes = modal.element.querySelector('#exp-notes').value;
            if (!company) throw new Error('يرجى إدخال اسم الشركة');
            if (isNaN(amount) || amount <= 0) throw new Error('المبلغ مطلوب وأكبر من صفر');
            await addNewAccountingCompany(company);
            await addExpense({ company_name: company, amount, type, date, notes, currency });
            showToast('تم الحفظ', 'success');
            modal.close();
            const searchText = document.getElementById('company-filter')?.value || '';
            await renderCompaniesList(searchText);
        } catch (err) { showToast(err.message, 'error'); saveBtn.disabled = false; saveBtn.innerHTML = 'حفظ'; }
    };
    modal.element.querySelector('#cancel-expense').onclick = () => modal.close();
}

async function showCompanyDetails(companyName) {
    const allExpenses = await getExpenses();
    const companyRecords = allExpenses.filter(e => e.company_name === companyName);
    if (!companyRecords.length) { showToast('لا توجد قيود لهذه الشركة', 'warning'); return; }
    const groupedByCurrency = groupRecordsByCurrency(companyRecords);
    let bodyHTML = `<div style="direction:rtl;text-align:right;">`;
    for (const group of groupedByCurrency) {
        const netColor = group.net >= 0 ? '#10b981' : '#ef4444';
        bodyHTML += `<div style="background:var(--bg-secondary); border-radius:12px; padding:16px; margin-bottom:20px; border:1px solid var(--border);"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:16px; gap:8px;"><h3 style="margin:0;">💰 العملة: ${group.currency}</h3><div style="display:flex; gap:16px; font-weight:600;"><span style="color:#10b981;">📥 لنا: ${formatNumber(group.total_for_us)}</span><span style="color:#ef4444;">📤 له: ${formatNumber(group.total_for_them)}</span><span style="color:${netColor};">⚖️ صافي: ${formatNumber(group.net)}</span></div></div><div style="overflow-x:auto;"><table class="table" style="min-width:500px;"><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظات</th><th style="width:110px;">إجراءات</th></tr></thead><tbody>`;
        for (const rec of group.records) {
            const sign = rec.type === 'for_us' ? '+' : '-';
            const typeText = rec.type === 'for_us' ? 'لنا' : 'له';
            bodyHTML += `<tr><td>${formatDate(rec.date)}</td><td>${typeText}</td><td style="text-align:left;" class="${rec.type === 'for_us' ? 'positive' : 'negative'}">${sign} ${formatNumber(rec.amount)}</td><td>${escapeHtml(rec.notes || '-')}</td><td style="white-space:nowrap;"><button class="btn btn-secondary btn-sm edit-record" data-id="${rec.id}" data-company="${escapeHtml(rec.company_name)}" data-amount="${rec.amount}" data-type="${rec.type}" data-date="${rec.date}" data-notes="${escapeHtml(rec.notes||'')}" data-currency="${rec.currency||'USD'}">${ICONS.edit}</button><button class="btn btn-danger btn-sm delete-record" data-id="${rec.id}">${ICONS.trash}</button></td></tr>`;
        }
        bodyHTML += `</tbody></table></div></div>`;
    }
    bodyHTML += `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:12px; margin-top:20px; padding-top:12px; border-top:1px solid var(--border);"><button class="btn btn-primary btn-sm" id="add-record-to-company">${ICONS.plus} إضافة قيد جديد</button><button class="btn btn-info btn-sm" id="print-details">🖨️ طباعة التقرير</button><button id="export-image-btn" class="btn btn-info btn-sm" style="background-color:#4caf50; color:white;">📷 حفظ كصورة (PNG)</button><button id="export-pdf-btn" class="btn btn-success btn-sm">📄 حفظ كـ PDF</button></div><div style="text-align:center; margin-top:8px; font-size:11px; color:var(--text-muted);">💡 بعد الحفظ، يمكنك إرسال الملف عبر واتساب</div></div>`;
    const modal = openModal({ title: `📋 تفاصيل حسابات شركة: ${escapeHtml(companyName)}`, bodyHTML: bodyHTML, footerHTML: `<button class="btn btn-secondary" id="close-details">إغلاق</button>` });
    const modalElement = modal.element;
    modalElement.querySelector('#add-record-to-company')?.addEventListener('click', () => { modal.close(); showAddRecordModal({ company_name: companyName }); });
    modalElement.querySelector('#print-details')?.addEventListener('click', () => showPrintPreview(companyName, companyRecords, 'print'));
    modalElement.querySelectorAll('.edit-record').forEach(btn => btn.addEventListener('click', () => { const id = parseInt(btn.dataset.id); const record = companyRecords.find(r => r.id === id); if (record) { modal.close(); showEditRecordModal(record); } }));
    modalElement.querySelectorAll('.delete-record').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); if (await confirmDialog('هل أنت متأكد من حذف هذا القيد؟')) { await deleteExpense(parseInt(btn.dataset.id)); showToast('تم الحذف', 'success'); modal.close(); const searchText = document.getElementById('company-filter')?.value || ''; renderCompaniesList(searchText); } }));
    modalElement.querySelector('#close-details')?.addEventListener('click', () => modal.close());
    const exportImageBtn = modalElement.querySelector('#export-image-btn'); const exportPdfBtn = modalElement.querySelector('#export-pdf-btn');
    if (exportImageBtn) exportImageBtn.addEventListener('click', () => showPrintPreview(companyName, companyRecords, 'image'));
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => showPrintPreview(companyName, companyRecords, 'pdf'));
}

async function showEditRecordModal(record) {
    const modal = openModal({
        title: 'تعديل القيد',
        bodyHTML: `<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>اسم الشركة</label><input type="text" class="input" id="edit-company" value="${escapeHtml(record.company_name)}"></div><div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="edit-amount" value="${record.amount}"></div><div class="form-group"><label>النوع</label><select class="select" id="edit-type"><option value="for_us" ${record.type==='for_us'?'selected':''}>لنا</option><option value="for_them" ${record.type==='for_them'?'selected':''}>له</option></select></div><div class="form-group"><label>التاريخ</label><input type="date" class="input" id="edit-date" value="${record.date}"></div><div class="form-group"><label>العملة</label><select class="select" id="edit-currency"><option value="USD" ${record.currency==='USD'?'selected':''}>دولار أمريكي</option><option value="SYP">ليرة سورية</option><option value="EUR">يورو</option><option value="JOD">دينار أردني</option><option value="TRY">ليرة تركية</option><option value="SAR">ريال سعودي</option><option value="AED">درهم إماراتي</option></select></div><div class="form-group"><label>ملاحظات</label><textarea class="textarea" id="edit-notes" rows="2">${escapeHtml(record.notes||'')}</textarea></div></div>`,
        footerHTML: `<button class="btn btn-secondary" id="cancel-edit">إلغاء</button><button class="btn btn-primary" id="save-edit">حفظ</button>`
    });
    const saveBtn = modal.element.querySelector('#save-edit');
    saveBtn.onclick = async () => {
        saveBtn.disabled = true; saveBtn.innerHTML = '<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const company = modal.element.querySelector('#edit-company').value.trim();
            const amount = parseFloat(toEnglishDigits(modal.element.querySelector('#edit-amount').value));
            const type = modal.element.querySelector('#edit-type').value;
            const date = modal.element.querySelector('#edit-date').value;
            const currency = modal.element.querySelector('#edit-currency').value;
            const notes = modal.element.querySelector('#edit-notes').value;
            if (!company) throw new Error('اسم الشركة مطلوب');
            if (isNaN(amount) || amount <= 0) throw new Error('المبلغ مطلوب وأكبر من صفر');
            await updateExpense({ id: record.id, company_name: company, amount, type, date, notes, currency });
            showToast('تم التعديل', 'success');
            modal.close();
            const searchText = document.getElementById('company-filter')?.value || '';
            renderCompaniesList(searchText);
        } catch (err) { showToast(err.message, 'error'); saveBtn.disabled = false; saveBtn.innerHTML = 'حفظ'; }
    };
    modal.element.querySelector('#cancel-edit').onclick = () => modal.close();
}

export async function loadAccounts() {
    const container = document.getElementById('tab-content');
    container.innerHTML = renderAccountsUI();
    const addTransactionBtn = document.getElementById('add-transaction-btn');
    if (addTransactionBtn) addTransactionBtn.addEventListener('click', (e) => { e.preventDefault(); showAddRecordModal(); });
    const filterInput = document.getElementById('company-filter');
    if (filterInput) filterInput.addEventListener('input', (e) => renderCompaniesList(e.target.value));
    await refreshCaches();
    await renderCompaniesList('');
}
