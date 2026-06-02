import { renderAccountsUI, renderCompaniesList, showAddRecordModal } from './ui.js';

export async function loadAccounts() {
    const container = document.getElementById('tab-content');
    container.innerHTML = renderAccountsUI();

    document.getElementById('add-transaction-btn')?.addEventListener('click', () => showAddRecordModal());

    const filterInput = document.getElementById('company-filter');
    if (filterInput) {
        filterInput.addEventListener('input', (e) => {
            renderCompaniesList(e.target.value);
        });
    }

    await renderCompaniesList('');
}
