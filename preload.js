const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    onToggleTheme: (callback) => ipcRenderer.on('toggle-theme', callback),
    themeChanged: (theme) => ipcRenderer.send('theme-changed', theme),
    focusWindow: () => ipcRenderer.send('focus-window'),
    showBackgroundNotification: (title, body, options) => ipcRenderer.send('show-notification', { title, body, requireInteraction: options?.requireInteraction }),
    reloadApp: () => ipcRenderer.send('reload-app'),
    onTriggerExport: (callback) => ipcRenderer.on('trigger-export', callback),
    onTriggerImport: (callback) => ipcRenderer.on('trigger-import', callback),
    onManualBackup: (callback) => ipcRenderer.on('manual-backup', callback),
    onRestoreBackup: (callback) => ipcRenderer.on('restore-backup', (event, path) => callback(path)),
    onShowHelp: (callback) => ipcRenderer.on('show-help', callback),
    openSettings: () => ipcRenderer.send('open-settings'),
    onQuickAddRecord: (callback) => ipcRenderer.on('quick-add-record', callback),
    onQuickPrintReport: (callback) => ipcRenderer.on('quick-print-report', callback),
    onIncreaseFont: (callback) => ipcRenderer.on('increase-font', callback),
    onDecreaseFont: (callback) => ipcRenderer.on('decrease-font', callback)
});

window.addEventListener('dragenter', (e) => e.preventDefault());
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.path) {
        ipcRenderer.send('drop-file', file.path);
    }
});
