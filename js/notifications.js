import { showToast } from './utils.js';
import { refreshCaches, getCache } from './db.js';

let notificationPermission = false;
const isElectron = !!window.electronAPI;
export async function requestNotificationPermission() {
    if(isElectron) { notificationPermission=true; return true; }
    if(!('Notification' in window)) return false;
    if(Notification.permission==='granted') { notificationPermission=true; return true; }
    if(Notification.permission!=='denied') { const perm = await Notification.requestPermission(); notificationPermission = (perm==='granted'); return notificationPermission; }
    return false;
}
function showDesktopNotification(title, body) {
    if(!notificationPermission && !isElectron) return;
    if(isElectron) window.electronAPI.showBackgroundNotification(title, body, {});
    else new Notification(title, { body, icon:'/icons/icon-512.png' });
}
export async function checkAndNotifyAlerts(showDesktop=true) {
    await refreshCaches();
    const { travelers, bookings } = getCache();
    const today = new Date(); today.setHours(0,0,0,0);
    const alerts=[];
    for(const t of travelers){
        if(t.passport_expiry){
            const expiry = new Date(t.passport_expiry);
            const daysLeft = Math.ceil((expiry-today)/(1000*3600*24));
            if(daysLeft===30||daysLeft===7||daysLeft===1){
                const msg = daysLeft===30?'ينتهي بعد شهر':daysLeft===7?'ينتهي بعد أسبوع':'ينتهي غداً';
                showToast(`⚠️ جواز ${t.name} ${msg}`,'warning');
                alerts.push({type:'passport',client:t,daysLeft});
                if(showDesktop) showDesktopNotification(`جواز ${t.name}`,msg);
            }
        }
    }
    for(const b of bookings){
        if(b.travel_date && b.status!=='cancelled' && b.status!=='completed'){
            const travel = new Date(b.travel_date);
            const daysLeft = Math.ceil((travel-today)/(1000*3600*24));
            if(daysLeft===2||daysLeft===1||daysLeft===0){
                const msg = daysLeft===2?'بعد يومين':daysLeft===1?'غداً':'اليوم';
                showToast(`✈️ رحلة ${b.traveler?.name} ${msg}`,'info');
                alerts.push({type:'trip',booking:b,daysLeft});
                if(showDesktop) showDesktopNotification(`تذكير برحلة`, `${b.traveler?.name} - ${msg}`);
            }
        }
    }
    return alerts;
}
export function scheduleAlertChecks() {
    setTimeout(()=>checkAndNotifyAlerts(true),5000);
    setInterval(()=>checkAndNotifyAlerts(true),60*60*1000);
}
