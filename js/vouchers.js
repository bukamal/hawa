import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, formatDate, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, confirmDialog, openModal, smartSelect } from './utils.js';

export async function loadVouchers() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `<div class="card"><div class="card-header"><div><h3>السندات</h3><span>سندات القبض والدفع</span></div><button class="btn btn-primary btn-sm" id="btn-add-voucher">${ICONS.plus} إضافة سند</button></div><div class="filter-bar"><button class="filter-pill active" data-filter="all">الكل</button><button class="filter-pill" data-filter="receipt">قبض</button><button class="filter-pill" data-filter="payment">دفع</button><button class="filter-pill" data-filter="expense">مصروف</button></div><div class="form-group"><input type="text" class="input" id="voucher-search" placeholder="🔍 بحث"></div><div id="vouchers-summary"></div></div><div id="vouchers-list"></div>`;
    document.getElementById('btn-add-voucher').addEventListener('click',()=>showAddVoucherModal());
    document.getElementById('voucher-search').addEventListener('input',()=>renderVouchers());
    document.querySelectorAll('.filter-pill').forEach(p=>p.addEventListener('click',()=>{ document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active')); p.classList.add('active'); renderVouchers(); }));
    await refreshCaches(); renderVouchers();
}
function renderVouchers() {
    const { vouchers, travelers, companies, bookings } = getCache();
    const filter = document.querySelector('.filter-pill.active')?.dataset.filter||'all';
    const search = document.getElementById('voucher-search')?.value.toLowerCase()||'';
    let filtered = vouchers.filter(v=>filter==='all'||v.type===filter);
    filtered = filtered.filter(v=> (v.reference||'').toLowerCase().includes(search) || (v.description||'').toLowerCase().includes(search) || (travelers.find(t=>t.id===v.traveler_id)?.name||'').toLowerCase().includes(search) || (companies.find(c=>c.id===v.company_id)?.name||'').toLowerCase().includes(search));
    let totalReceipt=0, totalPayment=0, totalExpense=0;
    filtered.forEach(v=>{ if(v.type==='receipt') totalReceipt+=v.amount; else if(v.type==='payment') totalPayment+=v.amount; else totalExpense+=v.amount; });
    document.getElementById('vouchers-summary').innerHTML = `<div style="display:flex;gap:20px;margin:16px 0;"><span style="color:var(--success);">📥 قبض: ${formatNumber(totalReceipt)}</span><span style="color:var(--danger);">📤 دفع: ${formatNumber(totalPayment)}</span><span style="color:var(--warning);">💸 مصاريف: ${formatNumber(totalExpense)}</span></div>`;
    const listContainer = document.getElementById('vouchers-list');
    if(!filtered.length){ listContainer.innerHTML=emptyState('لا توجد سندات','أضف سنداً'); return; }
    let html='';
    filtered.forEach(v=>{
        const typeLabel = v.type==='receipt'?'قبض':v.type==='payment'?'دفع':'مصروف';
        const bgColor = v.type==='receipt'?'var(--success)':v.type==='payment'?'var(--danger)':'var(--warning)';
        const travelerName = travelers.find(t=>t.id===v.traveler_id)?.name;
        const companyName = companies.find(c=>c.id===v.company_id)?.name;
        html+=`<div class="card card-hover" data-id="${v.id}" style="border-right:4px solid ${bgColor};margin-bottom:14px;"><div><div style="font-weight:900;font-size:22px;color:${bgColor};">${v.type==='receipt'?'+':'-'} ${formatNumber(v.amount)}</div><div>${formatDate(v.date)} · ${typeLabel}</div><div>${travelerName?`👤 ${escapeHtml(travelerName)}`:''} ${companyName?`🏢 ${escapeHtml(companyName)}`:''} ${v.booking_id?`📋 حجز #${v.booking_id}`:''}</div>${v.reference?`<div>المرجع: ${escapeHtml(v.reference)}</div>`:''}${v.description?`<div>${escapeHtml(v.description)}</div>`:''}</div></div>`;
    });
    listContainer.innerHTML=html;
    animateEntry('.card',60);
    document.querySelectorAll('.card[data-id]').forEach(card=>card.onclick=()=>showVoucherDetail(card.dataset.id));
}
async function showAddVoucherModal(initial={}) {
    await refreshCaches();
    const { travelers, companies, bookings } = getCache();
    const travelerOptions = travelers.map(t=>({value:t.id, label:t.name, detail:t.phone?`📞 ${t.phone}`:''}));
    const companyOptions = companies.map(c=>({value:c.id, label:c.name, detail:c.type?` (${c.type})`:''}));
    const bookingOptions = bookings.map(b=>({value:b.id, label:`#${b.id} - ${b.traveler?.name||''}`, detail:formatNumber(b.total_amount)}));
    const modal = openModal({ title:'إضافة سند جديد', bodyHTML:`<div class="form-group"><label>النوع</label><select class="select" id="v-type"><option value="receipt">📥 قبض (من مسافر)</option><option value="payment">📤 دفع (لشركة)</option><option value="expense">💸 مصروف</option></select></div><div class="form-group" id="v-traveler-group"><label>المسافر</label><select class="select" id="v-traveler"><option value="">اختر</option>${travelers.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select></div><div class="form-group" id="v-company-group" style="display:none;"><label>الشركة</label><select class="select" id="v-company"><option value="">اختر</option>${companies.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="v-amount"></div><div class="form-group"><label>التاريخ</label><input type="date" class="input" id="v-date" value="${new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label>الوصف</label><textarea class="textarea" id="v-desc"></textarea></div><div class="form-group"><label>المرجع</label><input class="input" id="v-ref"></div><div class="form-group"><label>ربط بحجز</label><select class="select" id="v-booking"><option value="">بدون</option>${bookings.map(b=>`<option value="${b.id}">#${b.id} - ${escapeHtml(b.traveler?.name)}</option>`).join('')}</select></div><div class="form-group"><label><input type="checkbox" id="allow-negative"> السماح بالرصيد السالب</label></div>`, footerHTML:`<button class="btn btn-secondary" id="v-cancel">إلغاء</button><button class="btn btn-primary" id="v-save">حفظ</button>` });
    const typeSel=modal.element.querySelector('#v-type');
    const travelerGroup=modal.element.querySelector('#v-traveler-group');
    const companyGroup=modal.element.querySelector('#v-company-group');
    const travelerSelect=modal.element.querySelector('#v-traveler');
    const companySelect=modal.element.querySelector('#v-company');
    const bookingSelect=modal.element.querySelector('#v-booking');
    smartSelect(travelerSelect,travelerOptions,{placeholder:'ابحث عن مسافر...'});
    smartSelect(companySelect,companyOptions,{placeholder:'ابحث عن شركة...'});
    smartSelect(bookingSelect,bookingOptions,{placeholder:'ابحث عن حجز...'});
    typeSel.addEventListener('change',()=>{ const val=typeSel.value; travelerGroup.style.display=val==='receipt'?'block':'none'; companyGroup.style.display=val==='payment'?'block':'none'; });
    modal.element.querySelector('#v-save').onclick = async () => {
        const type=typeSel.value, amount=parseFloat(toEnglishDigits(modal.element.querySelector('#v-amount').value));
        const travelerId=travelerSelect.value, companyId=companySelect.value;
        if(isNaN(amount)||amount<=0) return showToast('المبلغ مطلوب','error');
        if(type==='receipt' && !travelerId) return showToast('اختر المسافر','error');
        if(type==='payment' && !companyId) return showToast('اختر الشركة','error');
        await apiCall('/vouchers','POST',{ type, amount, date:modal.element.querySelector('#v-date').value, description:modal.element.querySelector('#v-desc').value, reference:modal.element.querySelector('#v-ref').value, traveler_id:type==='receipt'?travelerId:null, company_id:type==='payment'?companyId:null, booking_id:bookingSelect.value||null }, { allowNegative:modal.element.querySelector('#allow-negative').checked });
        await refreshCaches(); modal.close(); showToast('تم الحفظ','success'); renderVouchers();
    };
    modal.element.querySelector('#v-cancel').onclick=()=>modal.close();
}
async function showVoucherDetail(id){
    await refreshCaches();
    const { vouchers, travelers, companies } = getCache();
    const v = vouchers.find(v=>v.id==id); if(!v) return;
    const typeLabel = v.type==='receipt'?'سند قبض':v.type==='payment'?'سند دفع':'سند مصروف';
    const modal = openModal({ title:`${typeLabel} #${v.id}`, bodyHTML:`<div><div><strong>المبلغ:</strong> ${formatNumber(v.amount)}</div><div><strong>التاريخ:</strong> ${formatDate(v.date)}</div><div><strong>النوع:</strong> ${typeLabel}</div>${v.traveler_id?`<div><strong>المسافر:</strong> ${escapeHtml(travelers.find(t=>t.id===v.traveler_id)?.name)}</div>`:''}${v.company_id?`<div><strong>الشركة:</strong> ${escapeHtml(companies.find(c=>c.id===v.company_id)?.name)}</div>`:''}${v.reference?`<div><strong>المرجع:</strong> ${escapeHtml(v.reference)}</div>`:''}${v.description?`<div><strong>الوصف:</strong> ${escapeHtml(v.description)}</div>`:''}</div>`, footerHTML:`<button class="btn btn-danger" id="delete-voucher">🗑️ حذف</button>` });
    modal.element.querySelector('#delete-voucher').onclick = async () => { if(await confirmDialog('حذف السند؟')){ await apiCall(`/vouchers?id=${id}`,'DELETE',{}, { allowNegative:localStorage.getItem('allowNegativeBalance')==='true' }); await refreshCaches(); modal.close(); renderVouchers(); showToast('تم الحذف','success'); } };
}
