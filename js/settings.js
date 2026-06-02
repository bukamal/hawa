// js/settings.js - إعدادات النظام
import { refreshCaches, recalcAllBalances, exportFullDatabase, importFullDatabase, resetDatabase } from './db.js';
import { showToast, confirmDialog, getCurrencySettings, ICONS } from './utils.js';
import { checkActivation, onlineActivate } from './activation.js';

export async function loadSettings() {
    const currency = getCurrencySettings();
    const bgEnabled = localStorage.getItem('bgNotifications') !== 'false';
    const numberFormat = localStorage.getItem('numberFormat') || 'western';
    const allowNegativeBalance = localStorage.getItem('allowNegativeBalance') === 'true';
    const html = `<div class="settings-container"><div class="card"><div class="card-header"><div class="card-title">💾 النسخ الاحتياطي</div></div><div class="card-body"><div style="display:flex;flex-wrap:wrap;gap:12px;"><button class="btn btn-primary btn-sm" id="export-full-db">📤 تصدير JSON</button><button class="btn btn-secondary btn-sm" id="import-full-db">📥 استيراد JSON</button><button class="btn btn-info btn-sm" id="manual-backup-btn">💾 نسخ احتياطي يدوي</button><button class="btn btn-warning btn-sm" id="restore-backup-btn">🔄 استعادة نسخة</button></div></div></div><div class="card"><div class="card-header"><div class="card-title">💰 العملة والتنسيق</div></div><div class="card-body"><div class="form-group"><label>رمز العملة</label><input class="input" id="currency-symbol" value="${currency.symbol}"></div><div class="form-group"><label>الخانات العشرية</label><select class="select" id="currency-decimals"><option value="0" ${currency.decimals===0?'selected':''}>0</option><option value="1" ${currency.decimals===1?'selected':''}>1</option><option value="2" ${currency.decimals===2?'selected':''}>2</option></select></div><div class="form-group"><label>تنسيق الأرقام</label><select class="select" id="number-format"><option value="western" ${numberFormat==='western'?'selected':''}>غربية</option><option value="arabic" ${numberFormat==='arabic'?'selected':''}>شرقية</option></select></div><div style="display:flex;gap:12px;"><button class="btn btn-primary btn-sm" id="save-currency">حفظ العملة</button><button class="btn btn-secondary btn-sm" id="save-format">حفظ التنسيق</button></div></div></div><div class="card"><div class="card-header"><div class="card-title">⚙️ إعدادات متقدمة</div></div><div class="card-body"><label><input type="checkbox" id="bg-notifications-toggle" ${bgEnabled?'checked':''}> تفعيل الإشعارات</label><br><label><input type="checkbox" id="allow-negative-balance" ${allowNegativeBalance?'checked':''}> السماح بالأرصدة السالبة</label></div></div><div class="card"><div class="card-header"><div class="card-title">🗄️ أدوات قاعدة البيانات</div></div><div class="card-body"><div style="display:flex;gap:12px;"><button class="btn btn-secondary btn-sm" id="recalc-balances">⟳ إعادة حساب الأرصدة</button><button class="btn btn-danger btn-sm" id="reset-db">⚠️ إعادة تعيين قاعدة البيانات</button></div></div></div><div class="card"><div class="card-header"><div class="card-title">🔐 إدارة الترخيص</div></div><div class="card-body"><div id="license-status"></div><div style="display:flex;gap:12px;"><button class="btn btn-primary btn-sm" id="renew-online-btn">تجديد الترخيص</button><button class="btn btn-danger btn-sm" id="clear-license-btn">مسح الترخيص والبيانات</button></div></div></div></div>`;
    document.getElementById('tab-content').innerHTML = html;
    applyEventListeners();
    await addLicenseManagement();
}
function applyEventListeners() {
    document.getElementById('save-currency')?.addEventListener('click',()=>{ localStorage.setItem('currencySettings',JSON.stringify({ symbol:document.getElementById('currency-symbol').value.trim()||'$', decimals:parseInt(document.getElementById('currency-decimals').value) })); showToast('تم تحديث العملة','success'); location.reload(); });
    document.getElementById('save-format')?.addEventListener('click',()=>{ localStorage.setItem('numberFormat',document.getElementById('number-format').value); showToast('تم تحديث التنسيق','success'); location.reload(); });
    document.getElementById('recalc-balances')?.addEventListener('click',async()=>{ if(await confirmDialog('إعادة حساب الأرصدة؟')){ await recalcAllBalances(); showToast('تم','success'); } });
    document.getElementById('reset-db')?.addEventListener('click',async()=>{ if(await confirmDialog('⚠️ سيتم حذف كل البيانات!')){ await resetDatabase(); showToast('تم المسح، سيتم إعادة التحميل','success'); setTimeout(()=>location.reload(),1500); } });
    document.getElementById('bg-notifications-toggle')?.addEventListener('change',e=>localStorage.setItem('bgNotifications',e.target.checked));
    document.getElementById('allow-negative-balance')?.addEventListener('change',e=>localStorage.setItem('allowNegativeBalance',e.target.checked));
    const exportBtn = document.getElementById('export-full-db');
    const importBtn = document.getElementById('import-full-db');
    exportBtn?.addEventListener('click',async()=>{ const json=await exportFullDatabase(); const blob=new Blob([json],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`hawaa_backup_${new Date().toISOString().slice(0,19)}.json`; a.click(); URL.revokeObjectURL(a.href); showToast('تم التصدير','success'); });
    importBtn?.addEventListener('click',()=>{ const input=document.createElement('input'); input.type='file'; input.accept='application/json'; input.onchange=async e=>{ const file=e.target.files[0]; if(!file) return; const text=await file.text(); if(await confirmDialog('استعادة النسخة ستحذف البيانات الحالية؟')){ await importFullDatabase(text); showToast('تمت الاستعادة، سيتم إعادة التحميل','success'); setTimeout(()=>location.reload(),1500); } }; input.click(); });
    document.getElementById('manual-backup-btn')?.addEventListener('click',()=>exportBtn?.click());
    document.getElementById('restore-backup-btn')?.addEventListener('click',()=>importBtn?.click());
}
async function addLicenseManagement() {
    const status = await checkActivation();
    const div = document.getElementById('license-status');
    if(div) div.innerHTML = status.valid ? '<span style="color:var(--success);">✓ مرخص</span>' : '<span style="color:var(--danger);">✗ غير مرخص</span>';
    document.getElementById('renew-online-btn')?.addEventListener('click',async()=>{ const key=prompt('أدخل كود التفعيل الجديد'); if(key){ try{ await onlineActivate(key); showToast('تم التفعيل، سيتم إعادة التشغيل','success'); setTimeout(()=>location.reload(),1500); }catch(e){ showToast(e.message,'error'); } } });
    document.getElementById('clear-license-btn')?.addEventListener('click',async()=>{ if(await confirmDialog('مسح الترخيص وجميع البيانات؟')){ localStorage.clear(); await resetDatabase(); showToast('تم المسح، سيتم إعادة التحميل','success'); setTimeout(()=>location.reload(),1500); } });
}
export function scheduleAutoBackup() { console.log('Auto backup handled by main process'); }
