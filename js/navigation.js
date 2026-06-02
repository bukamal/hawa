// js/navigation.js - جميع التبويبات مع حسابات هوى الشام في الأعلى
import { ICONS, unlockScroll, lockScroll } from './utils.js';

export let currentTab = 'dashboard';

export const tabsConfig = {
    accounts: { title: 'حسابات هوى الشام', subtitle: 'لنا وله - إدارة القيود', icon: ICONS.wallet },
    'accounts-dashboard': { title: 'لوحة حسابات هوى الشام', subtitle: 'تحليلات متعددة العملات (لنا / له)', icon: ICONS.chart },
    dashboard: { title: 'لوحة التحكم', subtitle: 'نظرة عامة على أداء الوكالة', icon: ICONS.home },
    services: { title: 'الخدمات', subtitle: 'تذاكر، فيزا، إقامات، باقات', icon: ICONS.box },
    travelers: { title: 'المسافرون', subtitle: 'إدارة بيانات المسافرين والعملاء', icon: ICONS.users },
    companies: { title: 'الشركات', subtitle: 'شركات الطيران والفنادق ومقدمو الخدمات', icon: ICONS.factory },
    bookings: { title: 'الحجوزات', subtitle: 'سجل جميع الحجوزات', icon: ICONS.fileText },
    'new-booking': { title: 'حجز جديد', subtitle: 'إنشاء حجز سفر جديد', icon: ICONS.cart },
    vouchers: { title: 'السندات', subtitle: 'سندات القبض والدفع والمصاريف', icon: ICONS.fileText },
    reports: { title: 'التقارير', subtitle: 'تقارير مالية وإدارية', icon: ICONS.chart },
    settings: { title: 'الإعدادات', subtitle: 'نسخ احتياطي وترخيص', icon: ICONS.settings }
};

const bottomNavTabs = ['dashboard', 'services', 'new-booking', 'bookings', 'more'];
const moreMenuTabs = ['accounts', 'accounts-dashboard', 'travelers', 'companies', 'vouchers', 'reports', 'settings'];

function setActiveTab(tabName) {
    document.querySelectorAll('.nav-item, .bottom-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabName);
    });
    const cfg = tabsConfig[tabName];
    if (cfg) {
        document.getElementById('page-title').textContent = cfg.title;
        document.getElementById('page-subtitle').textContent = cfg.subtitle;
    }
}

export function navigateTo(tabName) {
    if (tabName === 'more') {
        const moreMenu = document.getElementById('more-menu');
        if (moreMenu) {
            moreMenu.style.display = 'flex';
            moreMenu.style.visibility = 'visible';
            moreMenu.style.opacity = '1';
            setTimeout(() => { lockScroll(); }, 10);
        }
        return;
    }
    
    currentTab = tabName;
    localStorage.setItem('lastActiveTab', tabName);
    setActiveTab(tabName);
    
    const moreMenu = document.getElementById('more-menu');
    if (moreMenu && moreMenu.style.display === 'flex') {
        moreMenu.style.display = 'none';
        unlockScroll();
    }
    
    document.getElementById('sidebar').classList.remove('open');
    unlockScroll();
    
    const content = document.getElementById('tab-content');
    content.style.opacity = '0';
    content.style.transform = 'translateY(12px)';
    
    setTimeout(async () => {
        try {
            switch (tabName) {
                case 'dashboard': const db = await import('./dashboard.js'); db.loadDashboard(); break;
                case 'services': const sv = await import('./services.js'); sv.loadServices(); break;
                case 'travelers': const tr = await import('./travelers.js'); tr.loadTravelers(); break;
                case 'companies': const co = await import('./companies.js'); co.loadCompanies(); break;
                case 'bookings': const bk = await import('./bookings.js'); bk.loadBookings(); break;
                case 'new-booking': const nb = await import('./bookings.js'); nb.showBookingModal(); break;
                case 'vouchers': const vc = await import('./vouchers.js'); vc.loadVouchers(); break;
                case 'accounts': const acc = await import('./accounts/index.js'); acc.loadAccounts(); break;
                case 'accounts-dashboard': const { loadAccountsDashboardPanel } = await import('./accounts/dashboard.js'); loadAccountsDashboardPanel(); break;
                case 'reports': const rp = await import('./reports.js'); rp.loadReports(); break;
                case 'settings': const st = await import('./settings.js'); st.loadSettings(); break;
                default: break;
            }
        } catch (e) {
            console.error(e);
            const { showToast } = await import('./utils.js');
            showToast(e.message, 'error');
        }
        content.style.transition = 'all 0.4s';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    }, 60);
}

export function getLastTab() {
    return localStorage.getItem('lastActiveTab');
}

export function initNavigation() {
    const sidebarNav = document.getElementById('sidebar-nav');
    const sheetGrid = document.getElementById('sheet-grid');
    const allTabs = Object.keys(tabsConfig);
    
    if (sidebarNav) sidebarNav.innerHTML = '';
    if (sheetGrid) sheetGrid.innerHTML = '';
    
    allTabs.forEach(key => {
        const cfg = tabsConfig[key];
        if (!cfg) return;
        const btn = document.createElement('button');
        btn.className = 'nav-item' + (key === 'dashboard' ? ' active' : '');
        btn.dataset.tab = key;
        btn.innerHTML = `${cfg.icon}<span>${cfg.title}</span>`;
        btn.onclick = () => navigateTo(key);
        if (sidebarNav) sidebarNav.appendChild(btn);
    });
    
    moreMenuTabs.forEach(key => {
        const cfg = tabsConfig[key];
        if (!cfg) return;
        const sheetBtn = document.createElement('button');
        sheetBtn.className = 'sheet-item';
        sheetBtn.dataset.tab = key;
        sheetBtn.innerHTML = `${cfg.icon}<span>${cfg.title}</span>`;
        sheetBtn.onclick = () => navigateTo(key);
        if (sheetGrid) sheetGrid.appendChild(sheetBtn);
    });
    
    const bottomItems = document.querySelectorAll('.bottom-item');
    if (bottomItems.length) {
        bottomItems.forEach(btn => {
            const tabName = btn.dataset.tab;
            if (tabName && bottomNavTabs.includes(tabName)) {
                btn.onclick = (e) => { e.preventDefault(); navigateTo(tabName); };
            } else if (tabName === 'more') {
                btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); navigateTo('more'); };
            }
        });
    }
    
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }
    
    const sheetBackdrop = document.querySelector('.sheet-backdrop');
    if (sheetBackdrop) {
        sheetBackdrop.addEventListener('click', () => {
            const moreMenu = document.getElementById('more-menu');
            if (moreMenu) {
                moreMenu.style.display = 'none';
                unlockScroll();
            }
        });
    }
    
    const helpBtn = document.getElementById('btn-help');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            import('./utils.js').then(m => m.openModal({
                title: 'ℹ️ مركز المساعدة',
                bodyHTML: `
                    <div style="text-align: center; line-height: 1.6;">
                        <strong style="font-size: 1.2rem;">نظام هوى الشام للسياحة والسفر</strong>
                        <p style="margin: 12px 0;">إدارة الحجوزات السياحية، تذاكر، فيزا، إقامات، رحلات، حج وعمرة.<br>
                        إصدار 1.0 | جميع الحقوق محفوظة © 2025</p>
                        <hr style="margin: 12px 0;">
                        <p>📞 للإبلاغ عن مشكلة أو استفسار:</p>
                        <a href="tel:0931664107" style="font-size: 1.3rem; font-weight: bold; color: var(--primary); text-decoration: none;">0931664107</a>
                        <p style="font-size: 0.8rem; margin-top: 12px;">يمكنك الاتصال أو واتساب على هذا الرقم</p>
                    </div>
                `,
                footerHTML: `<button class="btn btn-primary" id="close-help-modal">إغلاق</button>`
            })).then(modal => {
                if (modal && modal.element) {
                    const closeBtn = modal.element.querySelector('#close-help-modal');
                    if (closeBtn) closeBtn.onclick = () => modal.close();
                }
            });
        });
    }
}
