document.addEventListener('DOMContentLoaded', () => {
    const accountsList = document.getElementById('accounts-list');
    const addAccountForm = document.getElementById('add-account-form');

    async function loadAccounts() {
        try {
            const response = await fetch('/api/accounts');
            const accounts = await response.json();

            accountsList.innerHTML = ''; // Liste leeren

            accounts.forEach(account => {
                const li = document.createElement('li');
                const balance = Number(account.balance).toFixed(2);
                li.textContent = `${account.name}: €${balance}`;
                accountsList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    }

    addAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('account-name').value;
        const balance = document.getElementById('account-balance').value;

        try {
            const response = await fetch('/api/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, balance })
            });

            if (response.ok) {
                addAccountForm.reset();
                loadAccounts();
            }
        } catch (error) {
            console.error('Error adding account:', error);
        }
    });

    loadAccounts();
});