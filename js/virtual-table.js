export class VirtualTable {
    constructor(container, options = {}) {
        this.container = container;
        this.options = { rowHeight: options.rowHeight || 48, visibleRows: options.visibleRows || 20, ...options };
        this.data = [];
        this.renderRow = null;
        this.startIndex = 0;
        this.scrollTop = 0;
        this.init();
    }
    init() {
        this.container.innerHTML = `
            <div class="virtual-table-wrapper" style="position: relative; overflow-y: auto; height: ${this.options.visibleRows * this.options.rowHeight}px; border: 1px solid var(--border); border-radius: var(--radius-lg);">
                <div class="virtual-table-viewport" style="position: relative;">
                    <table class="table virtual-table" style="width: 100%; border-collapse: collapse;">
                        <thead class="virtual-table-header">${this.renderHeader()}</thead>
                        <tbody class="virtual-table-body" style="position: relative;"></tbody>
                    </table>
                </div>
            </div>
        `;
        this.tableWrapper = this.container.querySelector('.virtual-table-wrapper');
        this.tbody = this.container.querySelector('.virtual-table-body');
        this.tableWrapper.addEventListener('scroll', () => this.onScroll());
    }
    renderHeader() {
        if (!this.options.columns) return '';
        return `<tr>${this.options.columns.map(col => `<th style="width: ${col.width || 'auto'}; padding: 12px; position: sticky; top: 0; background: var(--bg-secondary);">${col.label}</th>`).join('')}</tr>`;
    }
    setData(data, renderRowFn) {
        this.data = data;
        this.renderRow = renderRowFn;
        this.totalHeight = this.data.length * this.options.rowHeight;
        this.viewport = this.container.querySelector('.virtual-table-viewport');
        this.viewport.style.height = `${this.totalHeight}px`;
        this.renderVisibleRows();
    }
    onScroll() {
        const scrollTop = this.tableWrapper.scrollTop;
        if (Math.abs(scrollTop - this.scrollTop) < 10) return;
        this.scrollTop = scrollTop;
        this.startIndex = Math.floor(scrollTop / this.options.rowHeight);
        this.renderVisibleRows();
    }
    renderVisibleRows() {
        if (!this.renderRow) return;
        const start = Math.max(0, this.startIndex - 5);
        const end = Math.min(this.data.length, start + this.options.visibleRows + 10);
        const offsetY = start * this.options.rowHeight;
        const fragment = document.createDocumentFragment();
        for (let i = start; i < end; i++) {
            const row = this.renderRow(this.data[i], i);
            if (row) {
                row.style.position = 'absolute';
                row.style.top = `${i * this.options.rowHeight}px`;
                row.style.left = '0';
                row.style.right = '0';
                row.style.width = '100%';
                fragment.appendChild(row);
            }
        }
        while (this.tbody.firstChild) this.tbody.removeChild(this.tbody.firstChild);
        this.tbody.appendChild(fragment);
        if (this.options.onRowBind) {
            Array.from(this.tbody.children).forEach(row => this.options.onRowBind(row));
        }
    }
    destroy() {
        this.tableWrapper?.removeEventListener('scroll', this.onScroll);
        this.container.innerHTML = '';
    }
}
