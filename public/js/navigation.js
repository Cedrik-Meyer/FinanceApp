document.addEventListener('DOMContentLoaded', () => {
    const btnAccounts = document.getElementById('nav-accounts');
    const btnDepot = document.getElementById('nav-depot');
    const viewAccounts = document.getElementById('view-accounts');
    const viewDepot = document.getElementById('view-depot');

    btnAccounts.addEventListener('click', () => {
        btnAccounts.classList.add('active');
        btnDepot.classList.remove('active');
        viewAccounts.style.display = 'block';
        viewDepot.style.display = 'none';
        window.dispatchEvent(new CustomEvent('reloadAccounts'));
    });

    btnDepot.addEventListener('click', () => {
        btnDepot.classList.add('active');
        btnAccounts.classList.remove('active');
        viewDepot.style.display = 'block';
        viewAccounts.style.display = 'none';
        window.dispatchEvent(new CustomEvent('reloadDepot'));
    });
});