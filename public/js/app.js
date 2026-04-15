document.addEventListener('DOMContentLoaded', () => {
    let currentAccountId = null;

    const accountsList = document.getElementById('accounts-list');
    const accountDetails = document.getElementById('account-details');
    const detailAccountName = document.getElementById('detail-account-name');
    const transactionList = document.getElementById('transaction-list');
    const modalAccount = document.getElementById('modal-account');
    const modalTransaction = document.getElementById('modal-transaction');
    const addAccountForm = document.getElementById('add-account-form');
    const addTransactionForm = document.getElementById('add-transaction-form');

    document.getElementById('btn-open-account-modal').addEventListener('click', () => modalAccount.showModal());
    document.getElementById('btn-open-transaction-modal').addEventListener('click', () => modalTransaction.showModal());
    document.getElementById('btn-close-account-modal').addEventListener('click', () => modalAccount.close());
    document.getElementById('btn-close-transaction-modal').addEventListener('click', () => modalTransaction.close());


    async function loadAccounts() {
        try {
            const response = await fetch('/api/accounts');
            const accounts = await response.json();

            accountsList.innerHTML = '';

            accounts.forEach(account => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${account.name}</strong> <span>$${Number(account.balance).toFixed(2)}</span>`;

                if (account.id === currentAccountId) {
                    li.classList.add('active');
                }

                li.addEventListener('click', () => selectAccount(account.id, account.name));

                accountsList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    }

    function selectAccount(id, name) {
        currentAccountId = id;

        detailAccountName.textContent = name + ' Transactions';
        accountDetails.style.display = 'block';

        loadAccounts();

        loadTransactions(id);
    }

    async function loadTransactions(accountId) {
        try {
            const response = await fetch(`/api/transactions/${accountId}`);
            const transactions = await response.json();

            transactionList.innerHTML = '';

            if (transactions.length === 0) {
                transactionList.innerHTML = '<p style="color: var(--text-muted);">No transactions yet.</p>';
                return;
            }

            transactions.forEach(t => {
                const li = document.createElement('li');
                const isIncome = t.type === 'INCOME';
                const sign = isIncome ? '+' : '-';
                const colorClass = isIncome ? 'amount-income' : 'amount-expense';

                const date = new Date(t.transaction_date).toLocaleDateString();

                li.innerHTML = `
                    <div>
                        <strong>${t.category}</strong> <br>
                        <span class="transaction-date">${date} ${t.description ? '- ' + t.description : ''}</span>
                    </div>
                    <div class="${colorClass}">
                        ${sign}$${Number(t.amount).toFixed(2)}
                    </div>
                `;
                transactionList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    addAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('account-name').value;
        const balance = document.getElementById('account-balance').value;

        await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, balance })
        });

        addAccountForm.reset();
        modalAccount.close();
        loadAccounts();
    });

    addTransactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentAccountId) return;

        const data = {
            account_id: currentAccountId,
            type: document.getElementById('trans-type').value,
            amount: document.getElementById('trans-amount').value,
            category: document.getElementById('trans-category').value,
            description: document.getElementById('trans-description').value
        };

        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            addTransactionForm.reset();
            modalTransaction.close();

            loadAccounts();
            loadTransactions(currentAccountId);
        }
    });

    loadAccounts();
});