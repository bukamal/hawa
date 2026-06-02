export function exportToCSV(expenses, filename = 'hawaa_report.csv') {
    if (!expenses.length) { alert('لا توجد بيانات لتصديرها'); return; }
    const headers = ['#', 'اسم الشركة', 'المبلغ', 'النوع', 'التاريخ', 'الملاحظات', 'العملة'];
    const rows = expenses.map((exp, idx) => [idx+1, exp.company_name, exp.amount, exp.type==='for_us'?'لنا':'له', exp.date, exp.notes||'', exp.currency||'SAR']);
    const escapeCSV = (cell) => typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n')) ? `"${cell.replace(/"/g, '""')}"` : cell;
    const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

export function exportToJSON(expenses, filename = 'hawaa_backup.json') {
    const data = { exportDate: new Date().toISOString(), version: '1.0', expenses };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

export function setupPrintStyles() {
    const style = document.createElement('style');
    style.textContent = `@media print { .top-bar, .filters-panel, .btn, .modal-overlay, #toast-container, .nav-btn, .icon-btn { display: none !important; } body { background: white; color: black; } .card { box-shadow: none; border: 1px solid #ccc; } }`;
    document.head.appendChild(style);
}
