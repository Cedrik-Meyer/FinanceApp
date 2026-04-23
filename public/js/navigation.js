document.addEventListener('DOMContentLoaded', () => {
    const btnAccounts = document.getElementById('nav-accounts');
    const btnDepot = document.getElementById('nav-depot');
    const btnAnalysis = document.getElementById('nav-analysis');

    const views = {
        accounts: document.getElementById('view-accounts'),
        depot: document.getElementById('view-depot'),
        analysis: document.getElementById('view-analysis')
    };

    function switchView(target) {
        [btnAccounts, btnDepot, btnAnalysis].forEach(btn => btn.classList.remove('active'));
        Object.values(views).forEach(view => view.style.display = 'none');

        if (target === 'accounts') {
            btnAccounts.classList.add('active');
            views.accounts.style.display = 'block';
            window.dispatchEvent(new CustomEvent('reloadAccounts'));
        } else if (target === 'depot') {
            btnDepot.classList.add('active');
            views.depot.style.display = 'block';
            window.dispatchEvent(new CustomEvent('reloadDepot'));
        } else if (target === 'analysis') {
            btnAnalysis.classList.add('active');
            views.analysis.style.display = 'block';
        }
    }

    btnAccounts.addEventListener('click', () => switchView('accounts'));
    btnDepot.addEventListener('click', () => switchView('depot'));
    btnAnalysis.addEventListener('click', () => switchView('analysis'));
});