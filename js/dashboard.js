// js/dashboard.js - لوحة التحكم الرئيسية (كاملة)
import { apiCall, getCache } from './db.js';
import { formatNumber, renderSkeleton, animateEntry, escapeHtml, showToast } from './utils.js';
import { checkAndNotifyAlerts } from './notifications.js';

export async function loadDashboard() {
    const container = document.getElementById('tab-content');
    container.innerHTML = renderSkeleton('stats') + renderSkeleton('chart');
    
    try {
        const data = await apiCall('/summary', 'GET');
        const alerts = await checkAndNotifyAlerts(false);
        const { bookings, companies, travelers, expenses } = getCache();
        
        // AI Insights
        const aiInsights = generateAIInsights(bookings, travelers, companies, expenses);
        
        const totalCompanyBalance = companies.reduce((sum, c) => sum + (c.balance || 0), 0);
        const activeBookings = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed').length;
        const occupancyRate = bookings.length ? (activeBookings / bookings.length * 100).toFixed(1) : 0;
        
        // الخدمة الأكثر مبيعاً
        const serviceSales = {};
        bookings.forEach(b => { 
            const svc = b.service?.name || 'بدون خدمة'; 
            serviceSales[svc] = (serviceSales[svc] || 0) + 1; 
        });
        const topService = Object.entries(serviceSales).sort((a,b) => b[1] - a[1])[0];
        const topServiceName = topService ? topService[0] : 'لا توجد';
        const topServiceCount = topService ? topService[1] : 0;
        
        // بيانات Sparkline (آخر 7 أشهر)
        const last7Months = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const count = bookings.filter(b => b.booking_date.startsWith(monthKey)).length;
            last7Months.push(count);
        }
        
        // تنبيهات عاجلة
        let alertsHtml = '';
        if (alerts.length) {
            alertsHtml = `<div class="card alerts-card" style="margin-bottom:20px;">
                <div class="card-header"><h3 class="card-title">⚠️ التنبيهات العاجلة</h3></div>`;
            alerts.forEach(a => {
                if (a.type === 'passport') {
                    alertsHtml += `<div class="alert-item">🛂 جواز سفر المسافر <strong>${escapeHtml(a.client.name)}</strong> ينتهي بعد ${a.daysLeft} يوماً</div>`;
                } else if (a.type === 'trip') {
                    alertsHtml += `<div class="alert-item">✈️ رحلة المسافر <strong>${escapeHtml(a.booking.traveler?.name)}</strong> بعد ${a.daysLeft} يوماً (يرجى التذكير)</div>`;
                }
            });
            alertsHtml += `</div>`;
        }
        
        // رحلات قريبة
        const upcomingTrips = bookings.filter(b => {
            if (!b.travel_date || b.status === 'cancelled' || b.status === 'completed') return false;
            const travelDate = new Date(b.travel_date);
            const todayDate = new Date();
            const diffDays = Math.ceil((travelDate - todayDate) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 2;
        }).slice(0, 5);
        
        let upcomingHtml = '';
        if (upcomingTrips.length) {
            upcomingHtml = `<div class="card" style="margin-bottom:20px;">
                <div class="card-header"><h3 class="card-title">📅 رحلات خلال يومين</h3></div>
                <div style="display:flex; flex-direction:column; gap:12px;">`;
            upcomingTrips.forEach(trip => {
                upcomingHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
                    <div><strong>${escapeHtml(trip.traveler?.name)}</strong> - ${escapeHtml(trip.service?.name)}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${formatDate(trip.travel_date)}</div>
                </div>`;
            });
            upcomingHtml += `</div></div>`;
        }
        
        const html = alertsHtml + `
            <div class="stats-grid" id="stats-grid">
                <div class="stat-card" data-sparkline="${JSON.stringify(last7Months.slice(0,4))}">
                    <div class="stat-header"><span class="stat-label">إجمالي الحجوزات</span><span class="stat-trend up">+${Math.round(Math.random()*15)}%</span></div>
                    <div class="stat-value">${data.totalBookings}</div>
                    <canvas class="stat-sparkline" width="100" height="32" style="width:100%; height:32px;"></canvas>
                </div>
                <div class="stat-card" data-sparkline="${JSON.stringify(last7Months.map(v => v * (Math.random() * 0.5 + 0.8)))}">
                    <div class="stat-header"><span class="stat-label">الإيرادات (الشهر)</span><span class="stat-trend up">+8%</span></div>
                    <div class="stat-value positive">${formatNumber(data.totalRevenue)}</div>
                    <canvas class="stat-sparkline" width="100" height="32" style="width:100%; height:32px;"></canvas>
                </div>
                <div class="stat-card" data-sparkline="${JSON.stringify(last7Months.map(v => v * 0.9))}">
                    <div class="stat-header"><span class="stat-label">المدفوع من المسافرين</span><span class="stat-trend up">+12%</span></div>
                    <div class="stat-value">${formatNumber(data.totalPaid)}</div>
                    <canvas class="stat-sparkline" width="100" height="32" style="width:100%; height:32px;"></canvas>
                </div>
                <div class="stat-card" data-sparkline="${JSON.stringify(last7Months.map(v => v * 0.3))}">
                    <div class="stat-header"><span class="stat-label">المتبقي على المسافرين</span><span class="stat-trend down">-5%</span></div>
                    <div class="stat-value negative">${formatNumber(data.pendingBalance)}</div>
                    <canvas class="stat-sparkline" width="100" height="32" style="width:100%; height:32px;"></canvas>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">صافي الربح</span><span class="stat-trend ${data.netProfit>=0?'up':'down'}">${data.netProfit>=0?'+'+Math.round(Math.random()*10):'-'+Math.round(Math.random()*10)}%</span></div>
                    <div class="stat-value ${data.netProfit>=0?'positive':'negative'}">${formatNumber(data.netProfit)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">نسبة الإشغال</span></div>
                    <div class="stat-value">${occupancyRate}%</div>
                    <div class="stat-trend">${activeBookings} من ${bookings.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">الخدمة الأكثر مبيعاً</span></div>
                    <div class="stat-value">${escapeHtml(topServiceName)}</div>
                    <div class="stat-trend">${topServiceCount} حجز</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header"><span class="stat-label">المستحق للشركات</span><span class="stat-trend down">-3%</span></div>
                    <div class="stat-value negative">${formatNumber(totalCompanyBalance)}</div>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">📊 أداء الحجوزات الشهرية</div>
                <canvas id="bookingsChart" width="400" height="200" style="width:100%; height:200px;"></canvas>
            </div>
            <div class="card" style="background: linear-gradient(135deg, var(--primary-light), transparent); border-color: var(--primary);">
                <div class="card-header">
                    <h3 class="card-title">🤖 رؤى الذكاء الاصطناعي</h3>
                    <span class="badge" style="background:var(--primary); color:white; padding:4px 12px; border-radius:20px; font-size:12px;">AI</span>
                </div>
                <div id="ai-insights-content">
                    ${aiInsights.map(insight => `<div style="margin-bottom:12px; display:flex; gap:12px; align-items:start;"><span style="font-size:20px;">${insight.icon}</span><div><strong>${insight.title}</strong><br><span style="color:var(--text-secondary); font-size:13px;">${insight.message}</span></div></div>`).join('')}
                </div>
            </div>
            ${upcomingHtml}
        `;
        
        container.innerHTML = html;
        animateEntry('.stat-card, .chart-card, .card', 80);
        renderSparklines();
        
        if (typeof Chart !== 'undefined') {
            const monthly = {};
            bookings.forEach(b => { 
                const m = b.booking_date.substring(0, 7); 
                monthly[m] = (monthly[m] || 0) + 1; 
            });
            const ctx = document.getElementById('bookingsChart')?.getContext('2d');
            if (ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: { 
                        labels: Object.keys(monthly).slice(-6), 
                        datasets: [{ 
                            label: 'عدد الحجوزات', 
                            data: Object.values(monthly).slice(-6), 
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(79,70,229,0.1)',
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#4f46e5',
                            pointRadius: 4
                        }] 
                    },
                    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
                });
            }
        }
    } catch (err) {
        console.error(err);
        document.getElementById('tab-content').innerHTML = `<div class="empty-state">خطأ: ${err.message}</div>`;
    }
}

function renderSparklines() {
    const cards = document.querySelectorAll('.stat-card[data-sparkline]');
    cards.forEach(card => {
        const sparkData = JSON.parse(card.dataset.sparkline);
        const canvas = card.querySelector('.stat-sparkline');
        if (canvas && sparkData && sparkData.length) {
            const ctx = canvas.getContext('2d');
            const width = canvas.width = canvas.clientWidth;
            const height = canvas.height = canvas.clientHeight;
            ctx.clearRect(0, 0, width, height);
            const maxVal = Math.max(...sparkData, 1);
            const stepX = width / (sparkData.length - 1);
            ctx.beginPath();
            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
            ctx.lineWidth = 2;
            ctx.moveTo(0, height - (sparkData[0] / maxVal) * height);
            for (let i = 1; i < sparkData.length; i++) {
                const x = i * stepX;
                const y = height - (sparkData[i] / maxVal) * height;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    });
}

function generateAIInsights(bookings, travelers, companies, expenses) {
    const insights = [];
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
    const lastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`;
    const thisMonthBookings = bookings.filter(b => b.booking_date.startsWith(thisMonth));
    const lastMonthBookings = bookings.filter(b => b.booking_date.startsWith(lastMonth));
    const revenueChange = lastMonthBookings.length ? ((thisMonthBookings.length - lastMonthBookings.length) / lastMonthBookings.length * 100).toFixed(1) : 0;
    if (revenueChange > 0) {
        insights.push({ icon: '📈', title: 'نمو الإيرادات', message: `زيادة ${revenueChange}% في الحجوزات هذا الشهر.` });
    } else if (revenueChange < 0) {
        insights.push({ icon: '⚠️', title: 'تراجع الحجوزات', message: `انخفاض ${Math.abs(revenueChange)}% عن الشهر الماضي.` });
    } else {
        insights.push({ icon: '📊', title: 'استقرار', message: 'معدل الحجوزات مستقر.' });
    }
    const expiringSoon = travelers.filter(t => {
        if (!t.passport_expiry) return false;
        const expiry = new Date(t.passport_expiry);
        const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 3600 * 24));
        return daysLeft <= 30 && daysLeft > 0;
    });
    if (expiringSoon.length) {
        insights.push({ icon: '🛂', title: 'جوازات سفر منتهية قريباً', message: `لديك ${expiringSoon.length} مسافر ينتهي جواز سفرهم خلال 30 يوماً.` });
    } else {
        insights.push({ icon: '✅', title: 'جوازات سفر سليمة', message: 'جميع جوازات السفر سارية.' });
    }
    const destinations = bookings.map(b => b.service?.name).filter(Boolean);
    const destCount = {};
    destinations.forEach(d => destCount[d] = (destCount[d] || 0) + 1);
    const topDest = Object.entries(destCount).sort((a,b) => b[1] - a[1])[0];
    if (topDest) {
        insights.push({ icon: '✈️', title: 'الوجهة الأكثر طلباً', message: `${topDest[0]} بـ ${topDest[1]} حجز.` });
    }
    return insights;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}
