const originalFetch = window.fetch;
window.fetch = async function() {
    const response = await originalFetch.apply(this, arguments);
    if (response.status === 401 && !arguments[0].includes('/api/auth/')) {
        showAuthView();
    }
    return response;
};

function showAuthView() {
    document.getElementById('main-nav').style.display = 'none';
    document.getElementById('view-accounts').style.display = 'none';
    document.getElementById('view-depot').style.display = 'none';
    document.getElementById('view-analysis').style.display = 'none';
    document.getElementById('view-auth').style.display = 'flex';
}

function showMainApp() {
    document.getElementById('view-auth').style.display = 'none';
    document.getElementById('main-nav').style.display = 'block';
    document.getElementById('view-accounts').style.display = 'block';
    window.dispatchEvent(new CustomEvent('reloadAccounts'));
}

document.addEventListener('DOMContentLoaded', async () => {
    const authForm = document.getElementById('auth-form');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authTitle = document.getElementById('auth-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const btnLogout = document.getElementById('btn-logout');

    let isLoginMode = true;

    try {
        const res = await originalFetch('/api/auth/check');
        if (res.ok) {
            showMainApp();
        } else {
            showAuthView();
        }
    } catch (e) {
        showAuthView();
    }

    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authTitle.textContent = isLoginMode ? 'Login' : 'Register';
        authSubmitBtn.textContent = isLoginMode ? 'Login' : 'Register';
        document.getElementById('auth-switch-text').innerHTML = isLoginMode
            ? 'New here? <a href="#" id="auth-switch-link">Register</a>'
            : 'Already have an account? <a href="#" id="auth-switch-link">Login</a>';

        document.getElementById('auth-switch-link').addEventListener('click', arguments.callee);
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;
        const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

        const response = await originalFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            if (isLoginMode) {
                authForm.reset();
                showMainApp();
            } else {
                authSwitchLink.click();
                document.getElementById('auth-username').value = username;
            }
        } else {
            const data = await response.json();
            const notification = document.getElementById('app-notification');
            notification.textContent = data.error || 'Error';
            notification.className = 'notification error';
            notification.classList.remove('hidden');
            setTimeout(() => notification.classList.add('hidden'), 5000);
        }
    });

    btnLogout.addEventListener('click', async () => {
        await originalFetch('/api/auth/logout', { method: 'POST' });
        showAuthView();
    });
});