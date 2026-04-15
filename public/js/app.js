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
    const modalConfirm = document.getElementById('modal-confirm');
    const confirmMessage = document.getElementById('confirm-message');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    const btnOkConfirm = document.getElementById('btn-ok-confirm');
    const btnCloseConfirm = document.getElementById('btn-close-confirm-modal');

    document.getElementById('btn-open-account-modal').addEventListener('click', () => modalAccount.showModal());
    document.getElementById('btn-open-transaction-modal').addEventListener('click', () => modalTransaction.showModal());
    document.getElementById('btn-close-account-modal').addEventListener('click', () => modalAccount.close());
    document.getElementById('btn-close-transaction-modal').addEventListener('click', () => modalTransaction.close());


    const formatEur = (amount) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    };

    async function loadAccounts() {
        try {
            const response = await fetch('/api/accounts');
            const accounts = await response.json();

            accountsList.innerHTML = '';
            let totalBalance = 0;

            accounts.forEach(account => {
                totalBalance += Number(account.balance);

                const li = document.createElement('li');
                li.className = 'account-item';

                li.innerHTML = `
                    <div class="account-info">
                        <strong>${account.name}</strong> 
                        <br><span>${formatEur(account.balance)}</span>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-icon edit-btn">✏️</button>
                        <button class="btn-icon delete-btn">🗑️</button>
                    </div>
                `;

                if (account.id === currentAccountId) li.classList.add('active');

                li.querySelector('.account-info').addEventListener('click', () => selectAccount(account.id, account.name));

                li.querySelector('.delete-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const isConfirmed = await customConfirm(`Delete account "${account.name}" and all its transactions?`);
                    if(isConfirmed) {
                        await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
                        if(currentAccountId === account.id) {
                            currentAccountId = null;
                            accountDetails.style.display = 'none';
                        }
                        loadAccounts();
                    }
                });

                li.querySelector('.edit-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.getElementById('edit-account-id').value = account.id;
                    document.getElementById('account-name').value = account.name;
                    document.getElementById('account-balance').value = account.balance;
                    document.getElementById('account-modal-title').textContent = 'Edit Account';
                    document.getElementById('account-submit-btn').textContent = 'Save Changes';
                    modalAccount.showModal();
                });

                accountsList.appendChild(li);
            });

            document.getElementById('total-balance').textContent = formatEur(totalBalance);

        } catch (error) {
            console.error(error);
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
                li.className = 'transaction-item';

                const isIncome = t.type === 'INCOME';
                const sign = isIncome ? '+' : '-';
                const colorClass = isIncome ? 'amount-income' : 'amount-expense';
                const date = new Date(t.transaction_date).toLocaleDateString('de-DE');

                // In der forEach-Schleife von loadTransactions:
                li.innerHTML = `
                    <div class="transaction-info">
                        <strong>${t.category}</strong> <br>
                        <span class="transaction-date">${date} ${t.description ? '- ' + t.description : ''}</span>
                    </div>
                    <div class="transaction-actions">
                        <span class="${colorClass} amount-display">${sign} ${formatEur(t.amount)}</span>
                        <button class="btn-icon edit-trans-btn">✏️</button>
                        <button class="btn-icon delete-trans-btn">🗑️</button>
                    </div>
                `;

                li.querySelector('.edit-trans-btn').addEventListener('click', () => {
                    document.getElementById('edit-transaction-id').value = t.id;
                    document.getElementById('trans-type').value = t.type;
                    document.getElementById('trans-amount').value = t.amount;
                    document.getElementById('trans-category').value = t.category;
                    document.getElementById('trans-description').value = t.description || '';

                    document.getElementById('trans-modal-title').textContent = 'Edit Transaction';
                    document.getElementById('trans-submit-btn').textContent = 'Update Transaction';
                    modalTransaction.showModal();
                });

                li.querySelector('.delete-trans-btn').addEventListener('click', async () => {
                    const isConfirmed = await customConfirm('Are you sure you want to delete this transaction?');
                    if(isConfirmed) {
                        try {
                            const response = await fetch(`/api/transactions/${t.id}`, { method: 'DELETE' });
                            if (response.ok) {
                                loadAccounts();
                                loadTransactions(accountId);
                            }
                        } catch (error) {
                            console.error(error);
                        }
                    }
                });

                transactionList.appendChild(li);
            });
        } catch (error) {
            console.error(error);
        }
    }

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

            const onOk = () => {
                cleanup();
                resolve(true);
            };

            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            btnOkConfirm.addEventListener('click', onOk);
            btnCancelConfirm.addEventListener('click', onCancel);
            btnCloseConfirm.addEventListener('click', onCancel);
        });
    }

    addAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-account-id').value;
        const name = document.getElementById('account-name').value;
        const balance = document.getElementById('account-balance').value;

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/accounts/${id}` : '/api/accounts';

        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, balance })
        });

        addAccountForm.reset();
        document.getElementById('edit-account-id').value = '';
        modalAccount.close();
        loadAccounts();
    });

    document.getElementById('btn-open-account-modal').addEventListener('click', () => {
        addAccountForm.reset();
        document.getElementById('edit-account-id').value = '';
        document.getElementById('account-modal-title').textContent = 'Create New Account';
        document.getElementById('account-submit-btn').textContent = 'Create Account';
        modalAccount.showModal();
    });

    addTransactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('edit-transaction-id').value;
        const data = {
            type: document.getElementById('trans-type').value,
            amount: document.getElementById('trans-amount').value,
            category: document.getElementById('trans-category').value,
            description: document.getElementById('trans-description').value
        };

        if (!id) {
            data.account_id = currentAccountId;
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/transactions/${id}` : '/api/transactions';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            addTransactionForm.reset();
            document.getElementById('edit-transaction-id').value = '';
            modalTransaction.close();
            loadAccounts();
            loadTransactions(currentAccountId);
        }
    });

    document.getElementById('btn-open-transaction-modal').addEventListener('click', () => {
        addTransactionForm.reset();
        document.getElementById('edit-transaction-id').value = '';
        document.getElementById('trans-modal-title').textContent = 'Add Transaction';
        document.getElementById('trans-submit-btn').textContent = 'Save Transaction';
        modalTransaction.showModal();
    });

    loadAccounts();
});