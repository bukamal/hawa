// js/bookings.js - إدارة الحجوزات (نسخة محسنة)
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, formatDate, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog, getCurrencySettings, smartSelect } from './utils.js';

let currentPage = 1, pageSize = 20, allFilteredBookings = [];

export async function loadBookings() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `<div class="card"><div class="card-header"><div><h3 class="card-title">الحجوزات</h3><span class="card-subtitle">سجل جميع حجوزات المسافرين</span></div><button class="btn btn-primary btn-sm" id="btn-new-booking">${ICONS.plus} حجز جديد</button></div><div class="filter-bar"><button class="filter-pill active" data-status="all">الكل</button><button class="filter-pill" data-status="pending">قيد الانتظار</button><button class="filter-pill" data-status="confirmed">مؤكد</button><button class="filter-pill" data-status="completed">منتهي</button><button class="filter-pill" data-status="cancelled">ملغي</button></div><div class="form-group"><input type="text" class="input" id="booking-search" placeholder="🔍 بحث بالمسافر أو الخدمة..."></div></div><div id="bookings-list"></div>`;
    document.getElementById('btn-new-booking').addEventListener('click', () => showBookingModal());
    document.getElementById('booking-search').addEventListener('input', () => { currentPage = 1; renderBookings(); });
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', function() { document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active')); this.classList.add('active'); currentPage=1; renderBookings(); });
    });
    await refreshCaches();
    renderBookings();
}

function renderBookings() {
    const { bookings } = getCache();
    const status = document.querySelector('.filter-pill.active')?.dataset.status || 'all';
    const search = document.getElementById('booking-search')?.value.toLowerCase() || '';
    let filtered = bookings.filter(b => (status === 'all' || b.status === status));
    filtered = filtered.filter(b => (b.traveler?.name || '').toLowerCase().includes(search) || (b.service?.name || '').toLowerCase().includes(search));
    allFilteredBookings = filtered;
    currentPage = 1;
    renderBookingsPaginated();
}

function renderBookingsPaginated() {
    const start = (currentPage-1)*pageSize;
    const paginated = allFilteredBookings.slice(start, start+pageSize);
    const container = document.getElementById('bookings-list');
    if (!paginated.length && currentPage===1) { container.innerHTML = emptyState('لا توجد حجوزات', 'أنشئ حجزاً جديداً'); return; }
    let html = '';
    paginated.forEach(b => {
        const statusColor = { pending:'var(--warning)', confirmed:'var(--success)', completed:'var(--info)', cancelled:'var(--danger)' }[b.status] || 'var(--text-muted)';
        html += `<div class="card card-hover" data-id="${b.id}" style="cursor:pointer;margin-bottom:14px;"><div style="display:flex;justify-content:space-between;"><div><div style="font-weight:900;">${escapeHtml(b.traveler?.name)||'بدون مسافر'}</div><div style="font-size:13px;">${escapeHtml(b.service?.name)||'خدمة'}</div><div style="font-size:12px;">📅 ${formatDate(b.booking_date)} ${b.travel_date?`→ ${formatDate(b.travel_date)}`:''}</div>${b.flight_number?`<div style="font-size:12px;">✈️ رقم الرحلة: ${escapeHtml(b.flight_number)}</div>`:''}${b.company?`<div style="font-size:12px;">🏢 ${escapeHtml(b.company.name)}</div>`:''}</div><div style="text-align:left;"><div style="font-size:20px;font-weight:900;">${formatNumber(b.total_amount)}</div><div style="font-size:12px;">مدفوع: ${formatNumber(b.paid)}</div><div style="font-size:12px;color:${statusColor};">${b.status==='pending'?'قيد الانتظار':b.status==='confirmed'?'مؤكد':b.status==='completed'?'منتهي':'ملغي'}</div></div></div></div>`;
    });
    if (allFilteredBookings.length > start+pageSize) html += `<div class="load-more-container" style="text-align:center;margin-top:20px;"><button class="btn btn-secondary" id="load-more-bookings">تحميل المزيد (${allFilteredBookings.length - (start+pageSize)} متبقي)</button></div>`;
    container.innerHTML = html;
    animateEntry('.card', 60);
    container.querySelectorAll('.card[data-id]').forEach(card => card.onclick = (e) => { if(!e.target.closest('.edit-booking-btn') && !e.target.closest('.delete-booking-btn')) showBookingDetail(card.dataset.id); });
    document.getElementById('load-more-bookings')?.addEventListener('click', () => { currentPage++; renderBookingsPaginated(); });
}

export async function showBookingModal(initial = {}) {
    await refreshCaches();
    const { travelers, services, companies, vouchers } = getCache();
    if (!travelers || !services) { showToast('خطأ: البيانات غير متوفرة', 'error'); return; }
    const airlines = companies.filter(c => c.type === 'airline');
    let existingPaid = 0;
    if (initial.id) existingPaid = vouchers.filter(v => v.type === 'receipt' && v.booking_id == initial.id).reduce((s,v)=>s+v.amount,0);
    const travelerOptions = travelers.map(t=>({value:t.id, label:t.name, detail:t.phone?`📞 ${t.phone}`:''}));
    const serviceOptions = services.map(s=>({value:s.id, label:s.name, detail:`${formatNumber(s.price)} | عمولة: ${s.commission_type==='percent'?s.commission_value+'%':formatNumber(s.commission_value)}`}));
    const airlineOptions = airlines.map(c=>({value:c.id, label:c.name, detail:c.phone?`📞 ${c.phone}`:''}));
    const modal = openModal({
        title: initial.id ? '✏️ تعديل الحجز' : '➕ حجز جديد',
        bodyHTML: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div class="form-group"><label>المسافر</label><select class="select" id="booking-traveler">${travelers.map(t=>`<option value="${t.id}" ${initial.traveler_id==t.id?'selected':''}>${escapeHtml(t.name)} ${t.phone?`(${t.phone})`:''}</option>`).join('')}</select></div><div class="form-group"><label>الخدمة</label><select class="select" id="booking-service">${services.map(s=>`<option value="${s.id}" data-price="${s.price}" data-commission-type="${s.commission_type}" data-commission-value="${s.commission_value}" data-company-id="${s.company_id||''}" ${initial.service_id==s.id?'selected':''}>${escapeHtml(s.name)} (${formatNumber(s.price)})</option>`).join('')}</select></div><div class="form-group"><label>شركة الطيران</label><select class="select" id="booking-airline"><option value="">اختر شركة الطيران</option>${airlines.map(c=>`<option value="${c.id}" ${initial.airline==c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>رقم الرحلة</label><input type="text" class="input" id="flight-number" value="${initial.flight_number||''}"></div><div class="form-group"><label>تاريخ الحجز</label><input type="date" class="input" id="booking-date" value="${initial.booking_date||new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label>تاريخ السفر</label><input type="date" class="input" id="travel-date" value="${initial.travel_date||''}"></div><div class="form-group"><label>المبلغ الإجمالي</label><input type="number" step="0.01" class="input" id="total-amount" value="${initial.total_amount||''}"></div><div class="form-group"><label>المدفوع مقدماً</label><input type="number" step="0.01" class="input" id="paid-amount" value="${existingPaid||''}"></div><div class="form-group"><label>عمولة هوى الشام</label><input type="text" class="input" id="commission-amount" readonly></div><div class="form-group"><label>الحالة</label><select class="select" id="booking-status"><option value="pending" ${initial.status==='pending'?'selected':''}>قيد الانتظار</option><option value="confirmed" ${initial.status==='confirmed'?'selected':''}>مؤكد</option><option value="completed" ${initial.status==='completed'?'selected':''}>منتهي</option><option value="cancelled" ${initial.status==='cancelled'?'selected':''}>ملغي</option></select></div></div><div class="form-group"><label>ملاحظات</label><textarea class="textarea" id="booking-notes" rows="3">${initial.notes||''}</textarea></div>`,
        footerHTML: `<button class="btn btn-secondary" id="cancel-booking">إلغاء</button><button class="btn btn-primary" id="save-booking">${ICONS.check} حفظ</button>`
    });
    const travelerSelect = modal.element.querySelector('#booking-traveler');
    const serviceSelect = modal.element.querySelector('#booking-service');
    const airlineSelect = modal.element.querySelector('#booking-airline');
    smartSelect(travelerSelect, travelerOptions, { placeholder: 'ابحث عن مسافر...', limit: 30 });
    smartSelect(serviceSelect, serviceOptions, { placeholder: 'ابحث عن خدمة...', limit: 30 });
    smartSelect(airlineSelect, airlineOptions, { placeholder: 'ابحث عن شركة طيران...', limit: 30 });
    const totalInput = modal.element.querySelector('#total-amount');
    const paidInput = modal.element.querySelector('#paid-amount');
    const commissionInput = modal.element.querySelector('#commission-amount');
    function updateServiceDetails() {
        const opt = serviceSelect.selectedOptions[0];
        if (!opt) return;
        const price = opt.dataset.price;
        const companyId = opt.dataset.companyId;
        if (price) totalInput.value = price;
        updateCommission();
        if (companyId && companyId !== '') {
            airlineSelect.value = companyId;
            airlineSelect.disabled = true;
            let help = document.getElementById('airline-help');
            if(!help){ const span=document.createElement('small'); span.id='airline-help'; span.style.display='block'; span.innerText='✓ تم تحديد الشركة تلقائياً'; airlineSelect.parentNode.appendChild(span); }
        } else { airlineSelect.disabled = false; const help=document.getElementById('airline-help'); if(help) help.remove(); }
    }
    function updateCommission() {
        const opt = serviceSelect.selectedOptions[0];
        if(!opt){ commissionInput.value=''; return; }
        const total = parseFloat(toEnglishDigits(totalInput.value))||0;
        const type = opt.dataset.commissionType;
        const val = parseFloat(opt.dataset.commissionValue)||0;
        let comm = 0;
        if(type==='percent') comm = total*val/100;
        else if(type==='fixed') comm = val;
        commissionInput.value = formatNumber(comm);
    }
    serviceSelect.addEventListener('change', updateServiceDetails);
    totalInput.addEventListener('input', updateCommission);
    if(serviceSelect.selectedOptions[0]) updateServiceDetails();
    travelerSelect.addEventListener('change', () => {
        const travelerId = travelerSelect.value;
        if(travelerId){ const traveler = getCache().travelers.find(t=>t.id==travelerId); if(traveler && traveler.balance>0) paidInput.value = traveler.balance; else paidInput.value=''; }
        else paidInput.value='';
    });
    const handleKeydown = (e) => { if(e.key==='Escape') { modal.close(); document.removeEventListener('keydown',handleKeydown); } else if(e.ctrlKey && e.key==='Enter') { e.preventDefault(); modal.element.querySelector('#save-booking')?.click(); } };
    document.addEventListener('keydown', handleKeydown);
    modal.element.addEventListener('modal-closed', () => document.removeEventListener('keydown',handleKeydown));
    modal.element.querySelector('#save-booking').onclick = async () => {
        const saveBtn = modal.element.querySelector('#save-booking');
        if(saveBtn.disabled) return;
        saveBtn.disabled=true; saveBtn.innerHTML='<span class="loader-inline"></span> جاري الحفظ...';
        try {
            const commission = parseFloat(toEnglishDigits(commissionInput.value))||0;
            const total = parseFloat(toEnglishDigits(totalInput.value));
            const paidAmount = parseFloat(toEnglishDigits(paidInput.value))||0;
            if(isNaN(total)||total<=0) throw new Error('المبلغ الإجمالي مطلوب');
            const payload = {
                traveler_id: travelerSelect.value, service_id: serviceSelect.value, airline: airlineSelect.value||null,
                flight_number: modal.element.querySelector('#flight-number').value||null, booking_date: modal.element.querySelector('#booking-date').value,
                travel_date: modal.element.querySelector('#travel-date').value, total_amount: total, status: modal.element.querySelector('#booking-status').value,
                notes: modal.element.querySelector('#booking-notes').value, commission_amount: commission
            };
            if(initial.id) await apiCall('/bookings','PUT',{id:initial.id,...payload});
            else await apiCall('/bookings','POST',{...payload,paid_amount:paidAmount});
            showToast('تم حفظ الحجز', 'success');
            modal.close();
            await refreshCaches();
            renderBookings();
        } catch(e) { showToast(e.message, 'error'); saveBtn.disabled=false; saveBtn.innerHTML=`${ICONS.check} حفظ`; }
    };
    modal.element.querySelector('#cancel-booking').onclick = () => modal.close();
}

async function showBookingDetail(id) {
    await refreshCaches();
    const { bookings, vouchers, companies } = getCache();
    const booking = bookings.find(b=>b.id==id);
    if(!booking) return;
    const payments = vouchers.filter(v=>v.type==='receipt' && v.booking_id==id);
    const commissionPayments = vouchers.filter(v=>v.type==='payment' && v.booking_id==id);
    const hawaaCommission = booking.commission_amount||0;
    const airlineAmount = (booking.total_amount||0)-hawaaCommission;
    const airlinePaid = commissionPayments.reduce((s,cp)=>s+cp.amount,0);
    const airlineRemaining = airlineAmount-airlinePaid;
    let paymentsHtml = '<h4>دفعات المسافر</h4><ul>'; payments.forEach(p=>{ paymentsHtml+=`<li>${formatDate(p.date)}: ${formatNumber(p.amount)} - ${escapeHtml(p.description||'')}</li>`; }); paymentsHtml+='</ul>';
    let commissionHtml = '<h4>دفعات تسديد مستحقات الشركة</h4><ul>';
    if(commissionPayments.length===0) commissionHtml+='<li>لا توجد دفعات مسجلة</li>';
    else commissionPayments.forEach(cp=>{ const company = companies.find(c=>c.id==cp.company_id); commissionHtml+=`<li>${formatDate(cp.date)}: ${formatNumber(cp.amount)} - ${escapeHtml(company?.name||'')} - ${escapeHtml(cp.description||'')}</li>`; });
    commissionHtml+='</ul>';
    const footerButtons = `<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;"><button class="btn btn-primary" id="edit-booking">${ICONS.edit} تعديل الحجز</button><button class="btn btn-danger" id="cancel-booking">${ICONS.trash} إلغاء الحجز</button><button class="btn btn-info" id="print-booking">🖨️ طباعة</button><button class="btn btn-success" id="add-receipt">${ICONS.plus} إضافة دفعة للمسافر</button><button class="btn btn-warning" id="pay-company">💰 تسديد للشركة</button></div>`;
    const modal = openModal({ title: `حجز رقم ${booking.id}`, bodyHTML: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><strong>المسافر:</strong> ${escapeHtml(booking.traveler?.name)}</div><div><strong>الخدمة:</strong> ${escapeHtml(booking.service?.name)}</div>${booking.flight_number?`<div><strong>رقم الرحلة:</strong> ${escapeHtml(booking.flight_number)}</div>`:''}${booking.company?`<div><strong>شركة الطيران:</strong> ${escapeHtml(booking.company.name)}</div>`:''}<div><strong>تاريخ الحجز:</strong> ${formatDate(booking.booking_date)}</div>${booking.travel_date?`<div><strong>تاريخ السفر:</strong> ${formatDate(booking.travel_date)}</div>`:''}</div><hr><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div><strong>المبلغ الإجمالي:</strong> ${formatNumber(booking.total_amount)}</div><div><strong>المدفوع من المسافر:</strong> ${formatNumber(booking.paid)}</div><div><strong>المتبقي على المسافر:</strong> ${formatNumber(booking.balance)}</div></div><hr><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;"><div><strong>عمولة هوى الشام:</strong> ${formatNumber(hawaaCommission)}</div><div><strong>المبلغ المستحق للشركة:</strong> ${formatNumber(airlineAmount)}</div><div><strong>المدفوع للشركة:</strong> ${formatNumber(airlinePaid)}</div><div><strong>المتبقي للشركة:</strong> ${formatNumber(airlineRemaining)}</div></div><hr>${paymentsHtml}${commissionHtml}${booking.notes?`<div><strong>ملاحظات:</strong> ${escapeHtml(booking.notes)}</div>`:''}`, footerHTML: footerButtons });
    modal.element.querySelector('#edit-booking').onclick = () => { modal.close(); showBookingModal({...booking, id:booking.id}); };
    modal.element.querySelector('#cancel-booking').onclick = async () => { if(await confirmDialog('إلغاء الحجز؟')){ await apiCall(`/bookings?id=${booking.id}`,'DELETE'); showToast('تم الإلغاء','success'); modal.close(); await refreshCaches(); renderBookings(); } };
    modal.element.querySelector('#print-booking').onclick = () => { modal.close(); printBooking(booking); };
    modal.element.querySelector('#add-receipt').onclick = async () => {
        const rModal = openModal({ title: `إضافة دفعة للحجز #${booking.id}`, bodyHTML: `<div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="receipt-amount"></div><div class="form-group"><label>التاريخ</label><input type="date" class="input" id="receipt-date" value="${new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label>الوصف</label><textarea class="textarea" id="receipt-desc"></textarea></div>`, footerHTML: `<button class="btn btn-secondary" id="cancel-receipt">إلغاء</button><button class="btn btn-primary" id="save-receipt">حفظ</button>` });
        rModal.element.querySelector('#save-receipt').onclick = async () => {
            const amount = parseFloat(toEnglishDigits(rModal.element.querySelector('#receipt-amount').value));
            if(isNaN(amount)||amount<=0){ showToast('المبلغ مطلوب','error'); return; }
            await apiCall('/vouchers','POST',{ type:'receipt', amount, date: rModal.element.querySelector('#receipt-date').value, description: rModal.element.querySelector('#receipt-desc').value||'دفعة جديدة', traveler_id: booking.traveler_id, booking_id: booking.id });
            await refreshCaches(); showToast('تمت الإضافة','success'); rModal.close(); modal.close(); showBookingDetail(booking.id);
        };
        rModal.element.querySelector('#cancel-receipt').onclick = () => rModal.close();
    };
    modal.element.querySelector('#pay-company').onclick = async () => {
        const remaining = airlineAmount - airlinePaid;
        if(remaining<=0){ showToast('لا توجد مستحقات متبقية','info'); return; }
        const cModal = openModal({ title: `تسديد مستحقات الشركة`, bodyHTML: `<div class="form-group"><label>المبلغ</label><input type="number" step="0.01" class="input" id="company-pay-amount" value="${remaining}"></div><div class="form-group"><label>التاريخ</label><input type="date" class="input" id="company-pay-date" value="${new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label>ملاحظات</label><textarea class="textarea" id="company-pay-notes"></textarea></div>`, footerHTML: `<button class="btn btn-secondary" id="cancel-company-pay">إلغاء</button><button class="btn btn-primary" id="confirm-company-pay">تسديد</button>` });
        cModal.element.querySelector('#confirm-company-pay').onclick = async () => {
            const amount = parseFloat(toEnglishDigits(cModal.element.querySelector('#company-pay-amount').value));
            if(isNaN(amount)||amount<=0||amount>remaining){ showToast('مبلغ غير صالح','error'); return; }
            await apiCall('/vouchers','POST',{ type:'payment', company_id: booking.company_id, booking_id: booking.id, amount, date: cModal.element.querySelector('#company-pay-date').value, description: cModal.element.querySelector('#company-pay-notes').value||`تسديد حجز #${booking.id}` });
            await refreshCaches(); showToast('تم التسديد','success'); cModal.close(); modal.close(); showBookingDetail(booking.id);
        };
        cModal.element.querySelector('#cancel-company-pay').onclick = () => cModal.close();
    };
}

function printBooking(booking) {
    const win = window.open('', '_blank');
    if(!win){ showToast('الرجاء السماح بالنوافذ المنبثقة','warning'); return; }
    const currency = getCurrencySettings().symbol;
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>فاتورة حجز - ${booking.id}</title><style>body{font-family:'Tajawal',sans-serif;padding:1.5cm;} .invoice-container{max-width:21cm;margin:0 auto;} .header{text-align:center;margin-bottom:20px;} .logo{font-size:32px;font-weight:800;color:#4f46e5;} .info-box{background:#f8fafc;padding:12px;border-radius:12px;margin-bottom:16px;} .amounts{background:#f8fafc;padding:20px;border-radius:16px;} .amount-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;} .status-badge{padding:4px 12px;border-radius:30px;display:inline-block;} .confirmed{background:#d1fae5;color:#065f46;} .pending{background:#fed7aa;color:#9a3412;} .footer{margin-top:30px;text-align:center;font-size:12px;}</style></head><body><div class="invoice-container"><div class="header"><div class="logo">هوى الشام</div><div>للسياحة والسفر</div></div><div class="info-box"><strong>رقم الحجز:</strong> ${booking.id}<br><strong>التاريخ:</strong> ${formatDate(booking.booking_date)}<br><strong>الحالة:</strong> <span class="status-badge ${booking.status}">${booking.status==='pending'?'قيد الانتظار':booking.status==='confirmed'?'مؤكد':booking.status==='completed'?'منتهي':'ملغي'}</span></div><table width="100%" style="margin:16px 0;"><tr><th>البيان</th><th>التفاصيل</th></tr><tr><td>المسافر</td><td>${escapeHtml(booking.traveler?.name)}</td></tr><tr><td>الخدمة</td><td>${escapeHtml(booking.service?.name)}</td></tr><tr><td>شركة الطيران</td><td>${escapeHtml(booking.company?.name)}</td></tr><tr><td>رقم الرحلة</td><td>${escapeHtml(booking.flight_number||'-')}</td></tr></table><div class="amounts"><div class="amount-row"><span>المبلغ الإجمالي</span><span>${formatNumber(booking.total_amount)} ${currency}</span></div><div class="amount-row"><span>المدفوع</span><span>${formatNumber(booking.paid)} ${currency}</span></div><div class="amount-row"><span>المتبقي</span><span>${formatNumber(booking.balance)} ${currency}</span></div></div><div class="footer">شكراً لثقتكم بنا<br>هوى الشام للسياحة والسفر<br>تمت الطباعة: ${new Date().toLocaleString('ar-EG')}</div></div></body></html>`;
    win.document.write(html); win.document.close(); win.focus(); win.print();
}
