document.addEventListener('DOMContentLoaded', () => {
    // DOM Elemente
    const accountsList = document.getElementById('accounts-list');
    const accountSelect = document.getElementById('trans-account-id');
    const addAccountForm = document.getElementById('add-account-form');
    const addTransactionForm = document.getElementById('add-transaction-form');
    const transactionsList = document.getElementById('global-transactions-list');

    async function loadAccounts() {
        try {
            const response = await fetch('/api/accounts');
            const accounts = await response.json();

            accountsList.innerHTML = '';
            accountSelect.innerHTML = '<option value="" disabled selected>Select Account</option>';

            accounts.forEach(account => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${account.name}</strong> ${Number(account.balance).toFixed(2)}€`;
                accountsList.appendChild(li);

                const option = document.createElement('option');
                option.value = account.id;
                option.textContent = account.name;
                accountSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading accounts:', error);
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
        loadAccounts();
    });

    addTransactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            account_id: document.getElementById('trans-account-id').value,
            type: document.getElementById('trans-type').value,
            amount: document.getElementById('trans-amount').value,
            category: document.getElementById('trans-category').value,
            description: document.getElementById('trans-description').value
        };

        try {
            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                addTransactionForm.reset();
                loadAccounts();
                alert('Transaction saved!');
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
        }
    });

    loadAccounts();
});