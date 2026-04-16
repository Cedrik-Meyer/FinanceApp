document.addEventListener('DOMContentLoaded', () => {
    const depotList = document.getElementById('depot-list');
    const totalDepotValue = document.getElementById('total-depot-value');
    const totalDepotPerformance = document.getElementById('total-depot-performance');
    const modalDepot = document.getElementById('modal-depot');
    const addDepotForm = document.getElementById('add-depot-form');
    const modalConfirm = document.getElementById('modal-confirm');
    const confirmMessage = document.getElementById('confirm-message');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    const btnOkConfirm = document.getElementById('btn-ok-confirm');
    const btnCloseConfirm = document.getElementById('btn-close-confirm-modal');

    const modalChart = document.getElementById('modal-chart');
    let stockChartInstance = null;

    document.getElementById('btn-open-depot-modal').addEventListener('click', () => {
        addDepotForm.reset();
        document.getElementById('edit-depot-id').value = '';
        document.getElementById('depot-modal-title').textContent = 'Add Position';
        document.getElementById('depot-submit-btn').textContent = 'Save Position';
        modalDepot.showModal();
    });

    document.getElementById('btn-close-depot-modal').addEventListener('click', () => modalDepot.close());
    document.getElementById('btn-close-chart-modal').addEventListener('click', () => modalChart.close());

    const formatEur = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    };

    const formatPercent = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount / 100);
    };

    function customConfirm(message) {
        return new Promise((resolve) => {
            confirmMessage.textContent = message;
            modalConfirm.showModal();
            const cleanup = () => {
                btnOkConfirm.removeEventListener('click', onOk);
                btnCancelConfirm.removeEventListener('click', onCancel);
                btnCloseConfirm.removeEventListener('click', onCancel);
                modalConfirm.close();
            };
            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };
            btnOkConfirm.addEventListener('click', onOk);
            btnCancelConfirm.addEventListener('click', onCancel);
            btnCloseConfirm.addEventListener('click', onCancel);
        });
    }

    let currentChartTicker = '';
    let currentChartName = '';

    async function showChart(ticker, name, range = '1y') {
        currentChartTicker = ticker;
        currentChartName = name;

        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.range === range);
        });

        document.getElementById('chart-modal-title').textContent = `${name} (${ticker})`;
        modalChart.showModal();

        try {
            const response = await fetch(`/api/depot/history/${ticker}/${range}`);
            const data = await response.json();

            const labels = data.map(d => {
                const date = new Date(d.date);
                return range === '1d' || range === '5d'
                    ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : date.toLocaleDateString('en-US');
            });

            const prices = data.map(d => d.close);
            const ctx = document.getElementById('stock-chart').getContext('2d');

            if (stockChartInstance) {
                stockChartInstance.destroy();
            }

            stockChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Price',
                        data: prices,
                        borderColor: '#0A2540',
                        backgroundColor: 'rgba(10, 37, 64, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        pointRadius: range === '1d' ? 1 : 0,
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    scales: {
                        x: {
                            ticks: {
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 8
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error(error);
        }
    }

    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.dataset.range;
            showChart(currentChartTicker, currentChartName, range);
        });
    });

    async function loadDepot() {
        try {
            const response = await fetch('/api/depot');
            const positions = await response.json();

            depotList.innerHTML = '';
            let totalValue = 0;
            let totalInvested = 0;

            positions.forEach(pos => {
                totalValue += pos.currentValue;
                totalInvested += (pos.buy_price * pos.quantity);

                const li = document.createElement('li');
                li.className = 'depot-item interactive-list-item';

                const perfClass = pos.performanceAbs >= 0 ? 'amount-income' : 'amount-expense';
                const sign = pos.performanceAbs >= 0 ? '+' : '';

                li.innerHTML = `
                    <div class="depot-info" style="cursor: pointer;">
                        <strong>${pos.name}</strong> <span>(${pos.ticker_symbol})</span><br>
                        <span class="transaction-date">${pos.quantity} Shares @ ${formatEur(pos.currentPrice)} / share</span><br>
                        <span class="transaction-date">Buy: ${formatEur(pos.buy_price)}</span>
                    </div>
                    <div class="depot-actions text-right">
                        <div class="amount-display">${formatEur(pos.currentValue)}</div>
                        <div class="${perfClass} transaction-date" style="margin-bottom: 0.5rem;">
                            ${sign}${formatEur(pos.performanceAbs)} (${sign}${formatPercent(pos.performanceRel)})
                        </div>
                        <div class="action-buttons">
                            <button class="btn-icon edit-depot-btn">✏️</button>
                            <button class="btn-icon delete-depot-btn">🗑️</button>
                        </div>
                    </div>
                `;

                li.querySelector('.depot-info').addEventListener('click', () => showChart(pos.ticker_symbol, pos.name));

                li.querySelector('.delete-depot-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const isConfirmed = await customConfirm(`Delete position "${pos.name}"?`);
                    if(isConfirmed) {
                        await fetch(`/api/depot/${pos.id}`, { method: 'DELETE' });
                        loadDepot();
                    }
                });

                li.querySelector('.edit-depot-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.getElementById('edit-depot-id').value = pos.id;
                    document.getElementById('depot-name').value = pos.name;
                    document.getElementById('depot-isin').value = pos.isin || '';
                    document.getElementById('depot-ticker').value = pos.ticker_symbol;
                    document.getElementById('depot-quantity').value = pos.quantity;
                    document.getElementById('depot-buy-price').value = pos.buy_price;
                    document.getElementById('depot-buy-date').value = pos.buy_date.split('T')[0];

                    document.getElementById('depot-modal-title').textContent = 'Edit Position';
                    document.getElementById('depot-submit-btn').textContent = 'Update Position';
                    modalDepot.showModal();
                });

                depotList.appendChild(li);
            });

            totalDepotValue.textContent = formatEur(totalValue);
            const overallPerfAbs = totalValue - totalInvested;
            const overallPerfRel = totalInvested > 0 ? (overallPerfAbs / totalInvested) * 100 : 0;
            const overallPerfClass = overallPerfAbs >= 0 ? 'amount-income' : 'amount-expense';
            const overallSign = overallPerfAbs >= 0 ? '+' : '';

            totalDepotPerformance.className = overallPerfClass;
            totalDepotPerformance.textContent = `${overallSign}${formatEur(overallPerfAbs)} (${overallSign}${formatPercent(overallPerfRel)})`;

        } catch (error) {
            console.error(error);
        }
    }

    addDepotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-depot-id').value;
        const data = {
            name: document.getElementById('depot-name').value,
            isin: document.getElementById('depot-isin').value,
            ticker_symbol: document.getElementById('depot-ticker').value,
            quantity: document.getElementById('depot-quantity').value,
            buy_price: document.getElementById('depot-buy-price').value,
            buy_date: document.getElementById('depot-buy-date').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/depot/${id}` : '/api/depot';

        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        addDepotForm.reset();
        modalDepot.close();
        loadDepot();
    });

    loadDepot();
});