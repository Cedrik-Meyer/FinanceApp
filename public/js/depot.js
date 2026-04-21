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

    document.getElementById('btn-open-depot-modal').addEventListener('click', async () => {
        addDepotForm.reset();
        document.getElementById('edit-depot-id').value = '';
        document.getElementById('depot-modal-title').textContent = 'Add Position';
        document.getElementById('depot-submit-btn').textContent = 'Save Position';

        const accountSelect = document.getElementById('depot-account');
        accountSelect.innerHTML = '<option value="" disabled selected>Select Account</option>';
        accountSelect.style.display = 'block';
        accountSelect.required = true;

        try {
            const response = await fetch('/api/accounts');
            const accounts = await response.json();
            accounts.forEach(acc => {
                const option = document.createElement('option');
                option.value = acc.id;
                option.textContent = `${acc.name} (${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(acc.balance)})`;
                accountSelect.appendChild(option);
            });
        } catch (error) {
            console.error(error);
        }

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

            const groupedPositions = {};

            positions.forEach(pos => {
                if (!groupedPositions[pos.ticker_symbol]) {
                    groupedPositions[pos.ticker_symbol] = {
                        ticker_symbol: pos.ticker_symbol,
                        name: pos.name,
                        currentPrice: pos.currentPrice,
                        totalQuantity: 0,
                        totalInvested: 0,
                        currentValue: 0,
                        positions: []
                    };
                }
                groupedPositions[pos.ticker_symbol].totalQuantity += Number(pos.quantity);
                groupedPositions[pos.ticker_symbol].totalInvested += (Number(pos.buy_price) * Number(pos.quantity));
                groupedPositions[pos.ticker_symbol].currentValue += Number(pos.currentValue);
                groupedPositions[pos.ticker_symbol].positions.push(pos);

                totalValue += pos.currentValue;
                totalInvested += (pos.buy_price * pos.quantity);
            });

            for (const ticker in groupedPositions) {
                const group = groupedPositions[ticker];
                const avgBuyPrice = group.totalInvested / group.totalQuantity;
                const performanceAbs = group.currentValue - group.totalInvested;
                const performanceRel = group.totalInvested > 0 ? (performanceAbs / group.totalInvested) * 100 : 0;

                const perfClass = performanceAbs >= 0 ? 'amount-income' : 'amount-expense';
                const sign = performanceAbs >= 0 ? '+' : '';

                const li = document.createElement('li');
                li.className = 'depot-item interactive-list-item group-item';
                li.style.flexDirection = 'column';
                li.style.alignItems = 'stretch';

                const headerDiv = document.createElement('div');
                headerDiv.className = 'group-header';
                headerDiv.style.display = 'flex';
                headerDiv.style.justifyContent = 'space-between';
                headerDiv.style.alignItems = 'center';
                headerDiv.style.width = '100%';

                headerDiv.innerHTML = `
                    <div class="depot-info" style="cursor: pointer; flex-grow: 1;">
                        <strong>${group.name}</strong> <span>(${group.ticker_symbol})</span> 
                        <span class="toggle-icon" style="font-size: 0.8rem; margin-left: 0.5rem; color: var(--text-muted);">▼</span><br>
                        <span class="transaction-date">${group.totalQuantity.toFixed(4)} Shares @ ${formatEur(group.currentPrice)} / share</span><br>
                        <span class="transaction-date">Avg Buy: ${formatEur(avgBuyPrice)}</span>
                    </div>
                    <div class="depot-actions text-right">
                        <div class="amount-display">${formatEur(group.currentValue)}</div>
                        <div class="${perfClass} transaction-date" style="margin-bottom: 0.5rem;">
                            ${sign}${formatEur(performanceAbs)} (${sign}${formatPercent(performanceRel)})
                        </div>
                        <div class="action-buttons">
                            <button class="btn-icon chart-depot-btn">📈</button>
                        </div>
                    </div>
                `;

                const subList = document.createElement('ul');
                subList.className = 'sub-positions-list';
                subList.style.display = 'none';

                group.positions.forEach(pos => {
                    const posPerfAbs = pos.currentValue - (pos.buy_price * pos.quantity);
                    const posPerfRel = (pos.buy_price * pos.quantity) > 0 ? (posPerfAbs / (pos.buy_price * pos.quantity)) * 100 : 0;
                    const pPerfClass = posPerfAbs >= 0 ? 'amount-income' : 'amount-expense';
                    const pSign = posPerfAbs >= 0 ? '+' : '';

                    const subLi = document.createElement('li');
                    subLi.className = 'depot-item sub-item';
                    subLi.innerHTML = `
                        <div class="depot-info">
                            <span class="transaction-date">${Number(pos.quantity).toFixed(4)} Shares</span><br>
                            <span class="transaction-date">Buy: ${formatEur(pos.buy_price)} (${new Date(pos.buy_date).toLocaleDateString('en-US')})</span>
                        </div>
                        <div class="depot-actions text-right">
                            <div class="amount-display" style="font-size: 1rem;">${formatEur(pos.currentValue)}</div>
                            <div class="${pPerfClass} transaction-date" style="margin-bottom: 0.5rem;">
                                ${pSign}${formatEur(posPerfAbs)} (${pSign}${formatPercent(posPerfRel)})
                            </div>
                            <div class="action-buttons">
                                <button class="btn-icon edit-depot-btn">✏️</button>
                                <button class="btn-icon delete-depot-btn">🗑️</button>
                            </div>
                        </div>
                    `;

                    subLi.querySelector('.delete-depot-btn').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const isConfirmed = await customConfirm(`Delete position "${pos.name}"?`);
                        if(isConfirmed) {
                            await fetch(`/api/depot/${pos.id}`, { method: 'DELETE' });
                            loadDepot();
                        }
                    });

                    subLi.querySelector('.edit-depot-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.getElementById('edit-depot-id').value = pos.id;
                        document.getElementById('depot-name').value = pos.name;
                        document.getElementById('depot-isin').value = pos.isin || '';
                        document.getElementById('depot-ticker').value = pos.ticker_symbol;
                        document.getElementById('depot-quantity').value = pos.quantity;
                        document.getElementById('depot-buy-price').value = pos.buy_price;
                        document.getElementById('depot-buy-date').value = pos.buy_date.split('T')[0];
                        document.getElementById('depot-fee').value = pos.fee || '';

                        const accountSelect = document.getElementById('depot-account');
                        accountSelect.style.display = 'none';
                        accountSelect.required = false;

                        document.getElementById('depot-modal-title').textContent = 'Edit Position';
                        document.getElementById('depot-submit-btn').textContent = 'Update Position';
                        modalDepot.showModal();
                    });

                    subList.appendChild(subLi);
                });

                headerDiv.querySelector('.depot-info').addEventListener('click', () => {
                    const isHidden = subList.style.display === 'none';
                    subList.style.display = isHidden ? 'block' : 'none';
                    headerDiv.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
                });

                headerDiv.querySelector('.chart-depot-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    showChart(group.ticker_symbol, group.name);
                });

                li.appendChild(headerDiv);
                li.appendChild(subList);
                depotList.appendChild(li);
            }

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
            buy_date: document.getElementById('depot-buy-date').value,
            account_id: document.getElementById('depot-account').value,
            fee: document.getElementById('depot-fee').value
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
    window.addEventListener('reloadDepot', loadDepot);
});