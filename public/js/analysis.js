document.addEventListener('DOMContentLoaded', () => {
    const startInput = document.getElementById('analysis-start');
    const endInput = document.getElementById('analysis-end');
    const btnRun = document.getElementById('btn-run-analysis');
    const analysisList = document.getElementById('analysis-list');
    const accountSelect = document.getElementById('analysis-account');
    let analysisChart = null;

    const currentYear = new Date().getFullYear();
    startInput.value = `${currentYear}-01-01`;
    endInput.value = `${currentYear}-12-31`;

    async function loadAnalysisAccounts() {
        try {
            const response = await fetch('/api/accounts');
            const accounts = await response.json();

            accountSelect.innerHTML = '<option value="all">All Accounts</option>';

            accounts.forEach(acc => {
                const option = document.createElement('option');
                option.value = acc.id;
                option.textContent = acc.name;
                accountSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading accounts for analysis:', error);
        }
    }

    async function runAnalysis() {
        const start = startInput.value;
        const end = endInput.value;
        const accountId = accountSelect.value;

        if (!start || !end) return;

        try {
            const response = await fetch(`/api/transactions/stats/analysis/${start}/${end}?accountId=${accountId}`);
            const data = await response.json();

            renderList(data);
            renderChart(data);
        } catch (error) {
            console.error(error);
        }
    }

    function renderList(data) {
        analysisList.innerHTML = '';
        const totalSum = data.reduce((sum, item) => sum + Number(item.total), 0);

        data.forEach(item => {
            const percentage = ((item.total / totalSum) * 100).toFixed(1);

            const li = document.createElement('li');
            li.className = 'interactive-list-item group-item';
            li.style.flexDirection = 'column';
            li.style.alignItems = 'stretch';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'group-header';
            headerDiv.style.display = 'flex';
            headerDiv.style.justifyContent = 'space-between';
            headerDiv.style.alignItems = 'center';
            headerDiv.style.width = '100%';

            headerDiv.innerHTML = `
                <div style="cursor: pointer; flex-grow: 1;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <strong lang="de" style="hyphens: auto; overflow-wrap: break-word;">${item.category}</strong> 
                        <span class="toggle-icon" style="font-size: 0.8rem; color: var(--text-muted); flex-shrink: 0;">▼</span>
                    </div>
                    <span class="transaction-date">${percentage}% of total</span>
                </div>
                <span class="amount-expense">${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(item.total)}</span>
            `;

            const subList = document.createElement('ul');
            subList.className = 'sub-positions-list';
            subList.style.display = 'none';

            if (item.details && Array.isArray(item.details)) {
                item.details.sort((a, b) => new Date(b.date) - new Date(a.date));

                item.details.forEach(detail => {
                    const subLi = document.createElement('li');
                    subLi.className = 'sub-item';
                    const dateStr = new Date(detail.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    subLi.innerHTML = `
                        <div class="transaction-date">${dateStr} - ${detail.description || 'No description'}</div>
                        <div class="amount-expense" style="font-size: 0.9rem;">${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(detail.amount)}</div>
                    `;
                    subList.appendChild(subLi);
                });
            }

            headerDiv.addEventListener('click', () => {
                const isHidden = subList.style.display === 'none';
                subList.style.display = isHidden ? 'block' : 'none';
                headerDiv.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
            });

            li.appendChild(headerDiv);
            li.appendChild(subList);
            analysisList.appendChild(li);
        });
    }

    function renderChart(data) {
        const ctx = document.getElementById('expense-chart').getContext('2d');

        if (analysisChart) {
            analysisChart.destroy();
        }

        analysisChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(item => item.category),
                datasets: [{
                    data: data.map(item => item.total),
                    backgroundColor: [
                        '#0A2540', '#10B981', '#EF4444', '#F59E0B', '#6366F1', '#8B5CF6', '#EC4899'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, padding: 15 }
                    }
                }
            }
        });
    }

    btnRun.addEventListener('click', runAnalysis);
    loadAnalysisAccounts();
    window.addEventListener('reloadAccounts', loadAnalysisAccounts);
});