import { apiCall } from '../db.js';

export async function getExpenses() {
    const result = await apiCall('/expenses', 'GET');
    return result || [];
}

export async function addExpense(data) {
    return await apiCall('/expenses', 'POST', data);
}

export async function updateExpense(data) {
    return await apiCall('/expenses', 'PUT', data);
}

export async function deleteExpense(id) {
    return await apiCall(`/expenses?id=${id}`, 'DELETE');
}

export function groupByCompany(expenses) {
    const map = new Map();
    expenses.forEach(exp => {
        const name = exp.company_name || 'بدون اسم';
        if (!map.has(name)) {
            map.set(name, {
                company_name: name,
                total_for_us: 0,
                total_for_them: 0,
                records: []
            });
        }
        const company = map.get(name);
        if (exp.type === 'for_us') company.total_for_us += exp.amount;
        else company.total_for_them += exp.amount;
        company.records.push(exp);
    });
    const result = Array.from(map.values());
    result.sort((a, b) => a.company_name.localeCompare(b.company_name));
    result.forEach(c => c.net = c.total_for_us - c.total_for_them);
    return result;
}

export function groupRecordsByCurrency(records) {
    const map = new Map();
    records.forEach(rec => {
        const currency = rec.currency || 'SAR';
        if (!map.has(currency)) {
            map.set(currency, {
                currency: currency,
                total_for_us: 0,
                total_for_them: 0,
                records: []
            });
        }
        const group = map.get(currency);
        if (rec.type === 'for_us') group.total_for_us += rec.amount;
        else group.total_for_them += rec.amount;
        group.records.push(rec);
    });
    const result = Array.from(map.values());
    result.forEach(g => g.net = g.total_for_us - g.total_for_them);
    return result;
}
