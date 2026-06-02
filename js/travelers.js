// js/travelers.js - إدارة المسافرين
import { apiCall, refreshCaches, getCache } from './db.js';
import { formatNumber, ICONS, animateEntry, emptyState, formatDate, toEnglishDigits, escapeHtml, showToast, openModal, confirmDialog, showFormModal } from './utils.js';

let currentPage=1, pageSize=20, allFilteredTravelers=[];
export async function loadTravelers() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `<div class="card"><div class="card-header"><div><h3 class="card-title">المسافرون</h3><span class="card-subtitle">إدارة بيانات المسافرين</span></div><button class="btn btn-primary btn-sm" id="btn-add-traveler">${ICONS.plus} إضافة مسافر</button></div><div class="form-group"><input type="text" class="input" id="travelers-search" placeholder="🔍 بحث بالاسم أو الجوال"></div></div><div id="travelers-list"></div>`;
    document.getElementById('btn-add-traveler').addEventListener('click', showAddTravelerModal);
    document.getElementById('travelers-search').addEventListener('input', ()=>{ currentPage=1; renderFilteredTravelers(); });
    await refreshCaches(); renderFilteredTravelers();
}
function renderFilteredTravelers() {
    const { travelers } = getCache();
    const q = document.getElementById('travelers-search')?.value.toLowerCase()||'';
    allFilteredTravelers = travelers.filter(t=>t.name.toLowerCase().includes(q)||(t.phone||'').includes(q));
    currentPage=1; renderTravelersPaginated();
}
function renderTravelersPaginated() {
    const paginated = allFilteredTravelers.slice((currentPage-1)*pageSize, currentPage*pageSize);
    const container = document.getElementById('travelers-list');
    if(!paginated.length && currentPage===1){ container.innerHTML=emptyState('لا يوجد مسافرون','أضف مسافراً'); return; }
    let html='';
    paginated.forEach(t=>{
        html+=`<div class="card card-hover" data-id="${t.id}" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;"><div><div style="font-weight:900;">${escapeHtml(t.name)}</div><div style="font-size:13px;">📞 ${escapeHtml(t.phone||'-')} ${t.email?`✉️ ${escapeHtml(t.email)}`:''}</div><div>الرصيد: ${formatNumber(t.balance)}</div>${t.passport?`<div>🛂 ${escapeHtml(t.passport)} ${t.passport_expiry?`(حتى ${formatDate(t.passport_expiry)})`:''}</div>`:''}</div><div><button class="btn btn-secondary btn-sm edit-traveler" data-id="${t.id}">${ICONS.edit}</button><button class="btn btn-danger btn-sm delete-traveler" data-id="${t.id}">${ICONS.trash}</button></div></div></div>`;
    });
    if(allFilteredTravelers.length > currentPage*pageSize) html+=`<div class="load-more-container"><button class="btn btn-secondary" id="load-more-travelers">تحميل المزيد</button></div>`;
    container.innerHTML=html;
    animateEntry('.card',60);
    document.querySelectorAll('.edit-traveler').forEach(btn=>btn.onclick=async e=>{e.stopPropagation(); await showEditTravelerModal(btn.dataset.id);});
    document.querySelectorAll('.delete-traveler').forEach(btn=>btn.onclick=async e=>{e.stopPropagation(); if(await confirmDialog('حذف المسافر؟')){ await apiCall(`/travelers?id=${btn.dataset.id}`,'DELETE'); showToast('تم الحذف','success'); await refreshCaches(); renderFilteredTravelers(); } });
    document.getElementById('load-more-travelers')?.addEventListener('click',()=>{ currentPage++; renderTravelersPaginated(); });
}
async function showAddTravelerModal() {
    showFormModal({ title:'إضافة مسافر', fields:[ {id:'name',label:'الاسم الكامل'}, {id:'phone',label:'رقم الجوال'}, {id:'email',label:'البريد'}, {id:'passport',label:'رقم الجواز'}, {id:'passport_expiry',label:'تاريخ انتهاء الجواز',type:'date'}, {id:'nationality',label:'الجنسية'}, {id:'address',label:'العنوان'} ], onSave: async(v)=>{ if(!v.name) throw new Error('الاسم مطلوب'); v.phone=toEnglishDigits(v.phone); await apiCall('/travelers','POST',v); await refreshCaches(); renderFilteredTravelers(); return v; } });
}
async function showEditTravelerModal(id) {
    const { travelers } = getCache();
    const t = travelers.find(t=>t.id==id); if(!t) return;
    showFormModal({ title:'تعديل مسافر', fields:[ {id:'name',label:'الاسم'}, {id:'phone',label:'الجوال'}, {id:'email',label:'البريد'}, {id:'passport',label:'رقم الجواز'}, {id:'passport_expiry',label:'تاريخ انتهاء الجواز',type:'date'}, {id:'nationality',label:'الجنسية'}, {id:'address',label:'العنوان'} ], initialValues:{ name:t.name, phone:t.phone||'', email:t.email||'', passport:t.passport||'', passport_expiry:t.passport_expiry||'', nationality:t.nationality||'', address:t.address||'' }, onSave: async(v)=>{ v.phone=toEnglishDigits(v.phone); await apiCall('/travelers','PUT',{id,...v}); await refreshCaches(); renderFilteredTravelers(); return v; } });
}
