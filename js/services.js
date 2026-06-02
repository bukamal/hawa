// js/services.js - إدارة الخدمات السياحية
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog } from './utils.js';

let currentPage=1, pageSize=20, allFilteredServices=[];
export async function loadServices() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `<div class="card"><div class="card-header"><div><h3 class="card-title">الخدمات</h3><span class="card-subtitle">تذاكر، فيزا، إقامات، رحلات</span></div><button class="btn btn-primary btn-sm" id="btn-add-service">${ICONS.plus} إضافة خدمة</button></div><div class="form-group"><input type="text" class="input" id="services-search" placeholder="🔍 بحث"></div><div><select class="select" id="service-type-filter"><option value="all">كل الأنواع</option><option value="ticket">تذكرة</option><option value="visa">فيزا</option><option value="accommodation">إقامة</option><option value="tour">رحلة</option><option value="package">باقة</option></select></div></div><div id="services-list"></div>`;
    document.getElementById('btn-add-service').addEventListener('click', showAddServiceModal);
    document.getElementById('services-search').addEventListener('input', ()=>{ currentPage=1; renderFilteredServices(); });
    document.getElementById('service-type-filter').addEventListener('change', ()=>{ currentPage=1; renderFilteredServices(); });
    await refreshCaches(); renderFilteredServices();
}
function renderFilteredServices() {
    const { services } = getCache();
    const q = document.getElementById('services-search')?.value.toLowerCase()||'';
    const type = document.getElementById('service-type-filter')?.value||'all';
    let filtered = services.filter(s=>s.name.toLowerCase().includes(q));
    if(type!=='all') filtered = filtered.filter(s=>s.type===type);
    allFilteredServices = filtered; currentPage=1; renderServicesPaginated();
}
function renderServicesPaginated() {
    const paginated = allFilteredServices.slice((currentPage-1)*pageSize, currentPage*pageSize);
    const container = document.getElementById('services-list');
    if(!paginated.length && currentPage===1){ container.innerHTML=emptyState('لا توجد خدمات','أضف خدمة'); return; }
    let html='<div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));">';
    paginated.forEach(s=>{
        const typeLabel = { ticket:'✈️ تذكرة', visa:'🛂 فيزا', accommodation:'🏨 إقامة', tour:'🚌 رحلة', package:'🕋 باقة' }[s.type]||'خدمة';
        const commissionText = s.commission_value ? (s.commission_type==='percent'?`${s.commission_value}%`:formatNumber(s.commission_value)) : 'بدون عمولة';
        html+=`<div class="card card-hover" data-id="${s.id}"><div style="display:flex;justify-content:space-between;"><div><div style="font-weight:900;">${escapeHtml(s.name)}</div><div style="font-size:12px;">${typeLabel}</div><div style="font-size:11px;">عمولة: ${commissionText}</div></div><div style="font-weight:900;font-size:20px;">${formatNumber(s.price)}</div></div>${s.company?`<div style="margin-top:12px;font-size:12px;">الشركة: ${escapeHtml(s.company.name)}</div>`:'<div style="margin-top:12px;font-size:12px;color:var(--danger);">⚠️ بدون شركة</div>'}<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-secondary btn-sm edit-service" data-id="${s.id}">${ICONS.edit}</button><button class="btn btn-danger btn-sm delete-service" data-id="${s.id}">${ICONS.trash}</button></div></div>`;
    });
    html+='</div>';
    if(allFilteredServices.length > currentPage*pageSize) html+=`<div class="load-more-container"><button class="btn btn-secondary" id="load-more-services">تحميل المزيد</button></div>`;
    container.innerHTML=html;
    animateEntry('.card',60);
    document.querySelectorAll('.edit-service').forEach(btn=>btn.onclick=e=>{e.stopPropagation(); showEditServiceModal(btn.dataset.id);});
    document.querySelectorAll('.delete-service').forEach(btn=>btn.onclick=async e=>{e.stopPropagation(); if(await confirmDialog('حذف الخدمة؟')){ await apiCall(`/services?id=${btn.dataset.id}`,'DELETE'); await refreshCaches(); renderFilteredServices(); showToast('تم الحذف','success'); } });
    document.getElementById('load-more-services')?.addEventListener('click',()=>{ currentPage++; renderServicesPaginated(); });
}
async function showAddServiceModal() {
    const { companies } = getCache();
    const modal = openModal({ title:'إضافة خدمة', bodyHTML:`<div class="form-group"><label>اسم الخدمة</label><input class="input" id="s-name"></div><div class="form-group"><label>النوع</label><select class="select" id="s-type"><option value="ticket">تذكرة</option><option value="visa">فيزا</option><option value="accommodation">إقامة</option><option value="tour">رحلة</option><option value="package">باقة</option></select></div><div class="form-group"><label>السعر</label><input type="number" step="0.01" class="input" id="s-price"></div><div class="form-group"><label>الشركة المقدمة</label><select class="select" id="s-company"><option value="">-- اختر شركة --</option>${companies.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>نوع العمولة</label><select class="select" id="comm-type"><option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت</option></select></div><div class="form-group"><label>قيمة العمولة</label><input type="number" step="0.01" class="input" id="comm-value"></div><div class="form-group"><label>تفاصيل</label><textarea class="textarea" id="s-details"></textarea></div>`, footerHTML:`<button class="btn btn-secondary" id="cancel-srv">إلغاء</button><button class="btn btn-primary" id="save-srv">حفظ</button>` });
    modal.element.querySelector('#save-srv').onclick = async () => {
        const name = modal.element.querySelector('#s-name').value.trim();
        const type = modal.element.querySelector('#s-type').value;
        const price = parseFloat(modal.element.querySelector('#s-price').value)||0;
        const companyId = modal.element.querySelector('#s-company').value;
        const commType = modal.element.querySelector('#comm-type').value;
        const commValue = parseFloat(modal.element.querySelector('#comm-value').value)||0;
        const details = modal.element.querySelector('#s-details').value;
        if(!name) return showToast('اسم الخدمة مطلوب','error');
        if(!companyId) return showToast('الشركة المقدمة مطلوبة','error');
        await apiCall('/services','POST',{ name, type, price, company_id:parseInt(companyId), commission_type:commType, commission_value:commValue, details });
        await refreshCaches(); modal.close(); showToast('تمت الإضافة','success'); renderFilteredServices();
    };
    modal.element.querySelector('#cancel-srv').onclick = () => modal.close();
}
async function showEditServiceModal(id) {
    const { services, companies } = getCache();
    const s = services.find(s=>s.id==id); if(!s) return;
    const modal = openModal({ title:'تعديل خدمة', bodyHTML:`<div class="form-group"><label>الاسم</label><input class="input" id="s-name" value="${escapeHtml(s.name)}"></div><div class="form-group"><label>النوع</label><select class="select" id="s-type"><option value="ticket" ${s.type==='ticket'?'selected':''}>تذكرة</option><option value="visa" ${s.type==='visa'?'selected':''}>فيزا</option><option value="accommodation" ${s.type==='accommodation'?'selected':''}>إقامة</option><option value="tour" ${s.type==='tour'?'selected':''}>رحلة</option><option value="package" ${s.type==='package'?'selected':''}>باقة</option></select></div><div class="form-group"><label>السعر</label><input type="number" step="0.01" class="input" id="s-price" value="${s.price}"></div><div class="form-group"><label>الشركة</label><select class="select" id="s-company">${companies.map(c=>`<option value="${c.id}" ${s.company_id==c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></div><div class="form-group"><label>نوع العمولة</label><select class="select" id="comm-type"><option value="percent" ${s.commission_type==='percent'?'selected':''}>نسبة</option><option value="fixed" ${s.commission_type==='fixed'?'selected':''}>ثابت</option></select></div><div class="form-group"><label>قيمة العمولة</label><input type="number" step="0.01" class="input" id="comm-value" value="${s.commission_value}"></div><div class="form-group"><label>تفاصيل</label><textarea class="textarea" id="s-details">${escapeHtml(s.details||'')}</textarea></div>`, footerHTML:`<button class="btn btn-secondary" id="cancel-srv">إلغاء</button><button class="btn btn-primary" id="save-srv">حفظ</button>` });
    modal.element.querySelector('#save-srv').onclick = async () => {
        const name = modal.element.querySelector('#s-name').value.trim();
        const type = modal.element.querySelector('#s-type').value;
        const price = parseFloat(modal.element.querySelector('#s-price').value)||0;
        const companyId = modal.element.querySelector('#s-company').value;
        const commType = modal.element.querySelector('#comm-type').value;
        const commValue = parseFloat(modal.element.querySelector('#comm-value').value)||0;
        const details = modal.element.querySelector('#s-details').value;
        if(!name) return showToast('الاسم مطلوب','error');
        if(!companyId) return showToast('الشركة مطلوبة','error');
        await apiCall('/services','PUT',{ id, name, type, price, company_id:parseInt(companyId), commission_type:commType, commission_value:commValue, details });
        await refreshCaches(); modal.close(); showToast('تم التعديل','success'); renderFilteredServices();
    };
    modal.element.querySelector('#cancel-srv').onclick = () => modal.close();
}
