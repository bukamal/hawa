// js/companies.js - إدارة الشركات (مختصر)
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, ICONS, animateEntry, emptyState, toEnglishDigits, escapeHtml, showToast, confirmDialog, showFormModal } from './utils.js';

let currentPage=1, pageSize=20, allFilteredCompanies=[];
export async function loadCompanies() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `<div class="card"><div class="card-header"><div><h3 class="card-title">الشركات</h3><span class="card-subtitle">شركات الطيران والفنادق ومقدمو الخدمات</span></div><button class="btn btn-primary btn-sm" id="btn-add-company">${ICONS.plus} إضافة شركة</button></div><div class="form-group"><input type="text" class="input" id="companies-search" placeholder="🔍 بحث..."></div></div><div id="companies-list"></div>`;
    document.getElementById('btn-add-company').addEventListener('click', showAddCompanyModal);
    document.getElementById('companies-search').addEventListener('input', () => { currentPage=1; renderFilteredCompanies(); });
    await refreshCaches();
    renderFilteredCompanies();
}
function renderFilteredCompanies() {
    const { companies } = getCache();
    const q = document.getElementById('companies-search')?.value.toLowerCase() || '';
    allFilteredCompanies = companies.filter(c=>c.name.toLowerCase().includes(q));
    currentPage=1; renderCompaniesPaginated();
}
function renderCompaniesPaginated() {
    const paginated = allFilteredCompanies.slice((currentPage-1)*pageSize, currentPage*pageSize);
    const container = document.getElementById('companies-list');
    if(!paginated.length && currentPage===1){ container.innerHTML=emptyState('لا توجد شركات','أضف شركة'); return; }
    let html='';
    paginated.forEach(c=>{
        const typeLabel = { airline:'✈️ طيران', hotel:'🏨 فندق', visa:'🛂 فيزا', tour:'🚌 رحلات' }[c.type]||'شركة';
        html+=`<div class="card card-hover" data-id="${c.id}" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;"><div><div style="font-weight:900;">${escapeHtml(c.name)}</div><div style="font-size:12px;">${typeLabel} | 📞 ${escapeHtml(c.phone||'-')}</div><div style="font-size:12px;">💰 المستحق: ${formatNumber(c.balance||0)}</div></div><div><button class="btn btn-secondary btn-sm edit-company" data-id="${c.id}">${ICONS.edit}</button><button class="btn btn-danger btn-sm delete-company" data-id="${c.id}">${ICONS.trash}</button></div></div></div>`;
    });
    if(allFilteredCompanies.length > currentPage*pageSize) html+=`<div class="load-more-container"><button class="btn btn-secondary" id="load-more-companies">تحميل المزيد (${allFilteredCompanies.length - currentPage*pageSize})</button></div>`;
    container.innerHTML=html;
    animateEntry('.card',60);
    document.querySelectorAll('.edit-company').forEach(btn=>btn.onclick=async(e)=>{e.stopPropagation(); await showEditCompanyModal(btn.dataset.id);});
    document.querySelectorAll('.delete-company').forEach(btn=>btn.onclick=async(e)=>{e.stopPropagation(); if(await confirmDialog('حذف الشركة؟')){ await apiCall(`/companies?id=${btn.dataset.id}`,'DELETE'); showToast('تم الحذف','success'); await refreshCaches(); renderFilteredCompanies(); } });
    document.getElementById('load-more-companies')?.addEventListener('click',()=>{ currentPage++; renderCompaniesPaginated(); });
}
async function showAddCompanyModal() {
    showFormModal({ title:'إضافة شركة', fields:[ {id:'name',label:'اسم الشركة'}, {id:'type',label:'النوع',type:'select',options:'<option value="airline">طيران</option><option value="hotel">فندق</option><option value="visa">فيزا</option><option value="tour">رحلات</option>'}, {id:'phone',label:'رقم الاتصال'}, {id:'contact_person',label:'جهة الاتصال'} ], onSave: async(v)=>{ if(!v.name) throw new Error('الاسم مطلوب'); v.phone=toEnglishDigits(v.phone); await apiCall('/companies','POST',v); await refreshCaches(); renderFilteredCompanies(); return v; } });
}
async function showEditCompanyModal(id) {
    const { companies } = getCache();
    const c = companies.find(c=>c.id==id);
    if(!c) return;
    showFormModal({ title:'تعديل شركة', fields:[ {id:'name',label:'الاسم'}, {id:'type',label:'النوع',type:'select',options:`<option value="airline" ${c.type==='airline'?'selected':''}>طيران</option><option value="hotel" ${c.type==='hotel'?'selected':''}>فندق</option><option value="visa" ${c.type==='visa'?'selected':''}>فيزا</option><option value="tour" ${c.type==='tour'?'selected':''}>رحلات</option>`}, {id:'phone',label:'رقم الاتصال'}, {id:'contact_person',label:'جهة الاتصال'} ], initialValues:{ name:c.name, phone:c.phone||'', contact_person:c.contact_person||'' }, onSave: async(v)=>{ v.phone=toEnglishDigits(v.phone); await apiCall('/companies','PUT',{id,...v}); await refreshCaches(); renderFilteredCompanies(); return v; } });
}
