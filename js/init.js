// js/init.js - نسخة معدلة مع تحويل وارد/صادر إلى لنا/له
import { checkActivation, onlineActivate } from './activation.js';
import { initNavigation, navigateTo, getLastTab, tabsConfig } from './navigation.js';
import { refreshCaches, ensureDatabase } from './db.js';
import { showToast } from './utils.js';
import { scheduleAutoBackup } from './settings.js';
import { requestNotificationPermission, scheduleAlertChecks } from './notifications.js';

async function initApp() {
    try {
        await ensureDatabase();
        
        const status = await checkActivation();
        if (!status.valid) {
            document.getElementById('loading-screen').style.display = 'none';
            const activationScreen = document.getElementById('activation-screen');
            activationScreen.style.display = 'flex';
            const activateBtn = document.getElementById('btn-activate');
            const licenseInput = document.getElementById('license-input');
            const msgEl = document.getElementById('activation-msg');
            const newBtn = activateBtn.cloneNode(true);
            activateBtn.parentNode.replaceChild(newBtn, activateBtn);
            newBtn.addEventListener('click', async () => {
                const key = licenseInput.value.trim();
                if (!key) {
                    msgEl.textContent = 'أدخل كود التفعيل';
                    msgEl.style.color = 'var(--danger)';
                    return;
                }
                try {
                    msgEl.textContent = 'جارٍ التفعيل...';
                    msgEl.style.color = 'var(--info)';
                    newBtn.disabled = true;
                    await onlineActivate(key);
                    msgEl.textContent = 'تم التفعيل! جاري تجهيز النظام...';
                    msgEl.style.color = 'var(--success)';
                    activationScreen.style.display = 'none';
                    const loadingScreen = document.getElementById('loading-screen');
                    loadingScreen.style.display = 'flex';
                    loadingScreen.classList.remove('hidden');
                    setTimeout(() => { location.reload(); }, 4000);
                } catch (err) {
                    msgEl.textContent = err.message || 'فشل التفعيل';
                    msgEl.style.color = 'var(--danger)';
                    newBtn.disabled = false;
                }
            });
            return;
        }
        document.getElementById('activation-screen').style.display = 'none';
        await refreshCaches();
        await requestNotificationPermission().catch(console.warn);
        initNavigation();
        
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('hidden');
        
        const lastTab = getLastTab();
        if (lastTab && tabsConfig[lastTab]) {
            navigateTo(lastTab);
        } else {
            navigateTo('accounts-dashboard');
        }
        
        scheduleAutoBackup();
        scheduleAlertChecks();
        
        if (window.electronAPI) {
            window.electronAPI.onToggleTheme(() => {
                const btn = document.getElementById('btn-theme-toggle');
                if (btn && typeof window.toggleTheme === 'function') btn.click();
                else if (typeof window.toggleTheme === 'function') window.toggleTheme();
            });
            window.electronAPI.onNavigate((tabName, reportType) => {
                if (reportType) {
                    import('./reports.js').then(m => {
                        const fn = `load${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`;
                        if (m[fn]) m[fn]();
                        else navigateTo(tabName);
                    });
                } else navigateTo(tabName);
            });
            window.electronAPI.onTriggerExport(() => {
                const exportBtn = document.getElementById('export-full-db');
                if (exportBtn) exportBtn.click();
                else showToast('زر التصدير غير موجود', 'error');
            });
            window.electronAPI.onTriggerImport(() => {
                const importBtn = document.getElementById('import-full-db');
                if (importBtn) importBtn.click();
                else showToast('زر الاستيراد غير موجود', 'error');
            });
            window.electronAPI.onManualBackup(() => {
                const manualBackupBtn = document.getElementById('manual-backup-btn');
                if (manualBackupBtn) manualBackupBtn.click();
                else showToast('زر النسخ الاحتياطي غير موجود', 'error');
            });
            window.electronAPI.onRestoreBackup(() => {
                const restoreBtn = document.getElementById('restore-backup-btn');
                if (restoreBtn) restoreBtn.click();
                else showToast('زر استعادة النسخة غير موجود', 'error');
            });
            window.electronAPI.onShowHelp(() => {
                const btn = document.getElementById('btn-help');
                if (btn) btn.click();
            });
        }
    } catch (e) {
        console.error('خطأ جسيم:', e);
        const errorMessage = e.message || String(e);
        if (errorMessage.includes('قاعدة البيانات') || 
            errorMessage.includes('SQL') || 
            errorMessage.includes('init') ||
            errorMessage.includes('database')) {
            const errorScreen = document.getElementById('error-screen');
            const errorDetails = document.getElementById('error-details');
            if (errorScreen && errorDetails) {
                errorDetails.textContent = e.stack || errorMessage;
                errorScreen.style.display = 'flex';
            } else {
                showToast('خطأ جسيم: ' + errorMessage, 'error');
            }
        } else {
            showToast('خطأ: ' + errorMessage, 'error');
        }
        document.getElementById('loading-screen').style.display = 'none';
    }
}
initApp();
