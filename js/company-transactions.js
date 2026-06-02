import { getTransactions, deleteTransaction, getCompanies } from './db.js';
import { formatNumber, formatDate, escapeHtml, showToast, openModal, confirmDialog, getCurrencyIcon, getBaseCurrency, isConversionEnabled } from './utils.js';

export async function loadCompanyTransactions(companyId) {
    const companies = await getCompanies();
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const transactions = await getTransactions(companyId);
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
            <div class="card-header">
                <div style="display:flex;align-items:center;gap:1rem;">
                    <button class="btn btn-secondary btn-sm" id="back-to-companies"><span>↩️</span> العودة للشركات</button>
                    <h2><span>📋</span> سندات الشركة: ${escapeHtml(company.name)}</h2>
                </div>
                <button class="btn btn-primary" id="add-transaction"><span>➕</span> إضافة سند جديد</button>
            </div>
            <div class="card-body"><div class="company-meta" style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem;">${company.phone ? `<div class="company-meta-item"><span>📞</span><span>${escapeHtml(company.phone)}</span></div>` : ''}${company.notes ? `<div class="company-meta-item"><span>📝</span><span>${escapeHtml(company.notes)}</span></div>` : ''}</div></div>
        </div>
        <div class="card"><div class="card-body" style="padding:0;"><div class="table-wrap"><table class="table" id="transactions-table"><thead><tr><th style="width:60px;">#</th><th>التاريخ</th><th style="text-align:center;">النوع</th><th>المبلغ</th><th style="text-align:center;">العملة</th><th>ملاحظات</th><th style="text-align:center;width:140px;">الإجراءات</th></tr></thead><tbody id="transactions-tbody"></tbody></table></div></div></div>
    `;
    document.getElementById('back-to-companies').onclick = () => import('./companies.js').then(m => m.loadCompanies());
    document.getElementById('add-transaction').onclick = () => import('./companies.js').then(m => m.showTransactionModal(companyId));
    renderTransactions(transactions, companyId);
}

async function renderTransactions(transactions, companyId) {
    const tbody = document.getElementById('transactions-tbody');
    const conversionEnabled = isConversionEnabled();
    const baseCurrency = getBaseCurrency();
    if (!transactions.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:3rem;"><div class="empty-state-icon">📋</div><h3>لا توجد سندات</h3><p>أضف سنداً جديداً للبدء</p></div></td></tr>`; return; }
    let html = '';
    for (const t of transactions) {
        const typeBadge = t.type === 'incoming' ? '<span class="badge badge-success">📥 وارد</span>' : '<span class="badge badge-danger">📤 صادر</span>';
        let amountDisplay = `<strong>${formatNumber(t.amount)}</strong> ${getCurrencyIcon(t.currency)} ${t.currency}`;
        if (conversionEnabled && t.currency !== baseCurrency) {
            const { convertAmount } = await import('./utils.js');
            const converted = await convertAmount(t.amount, t.currency, baseCurrency);
            amountDisplay += `<br><span style="color:var(--text-muted);font-size:0.8125rem;">≈ ${formatNumber(converted)} ${getCurrencyIcon(baseCurrency)} ${baseCurrency}</span>`;
        }
        html += `<tr data-id="${t.id}"><td style="text-align:center;font-family:monospace;font-weight:600;">${t.id}</td><td>${formatDate(t.date)}</td><td style="text-align:center;">${typeBadge}</td><td class="${t.type === 'incoming' ? 'positive' : 'negative'}">${amountDisplay}</td><td style="text-align:center;">${getCurrencyIcon(t.currency)} ${t.currency}</td><td style="color:var(--text-secondary);font-size:0.875rem;">${escapeHtml(t.notes || '-')}</td><td style="text-align:center;"><div class="action-buttons" style="justify-content:center;"><button class="action-btn action-btn-edit edit-transaction" data-id="${t.id}" data-company="${companyId}" title="تعديل"><span>✏️</span></button><button class="action-btn action-btn-delete delete-transaction" data-id="${t.id}" title="حذف"><span>🗑️</span></button></div></td></tr>`;
    }
    tbody.innerHTML = html;
    document.querySelectorAll('.edit-transaction').forEach(btn => { btn.onclick = async (e) => { const id = parseInt(btn.dataset.id); const companyId = parseInt(btn.dataset.company); const all = await getTransactions(companyId); const transaction = all.find(t => t.id === id); if (transaction) { const { showTransactionModal } = await import('./companies.js'); showTransactionModal(companyId, transaction); } }; });
    document.querySelectorAll('.delete-transaction').forEach(btn => { btn.onclick = async (e) => { const id = parseInt(btn.dataset.id); if (await confirmDialog('هل أنت متأكد من حذف هذا السند؟')) { await deleteTransaction(id); showToast('تم حذف السند بنجاح', 'success'); loadCompanyTransactions(companyId); } }; });
}
