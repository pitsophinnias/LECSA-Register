async function login() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const message = document.getElementById('loginMessage');
    
    if (!usernameInput || !passwordInput || !message) {
        console.error('Login form elements not found');
        return;
    }
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        message.textContent = 'Please enter both username and password';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            try {
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
            } catch (err) {
                console.error('LocalStorage error:', err);
                message.textContent = 'Error saving session. Please try again.';
                return;
            }
            window.location.href = 'regsys.html';
        } else {
            message.textContent = data.error || 'Login failed';
        }
    } catch (err) {
        message.textContent = 'Network error: ' + err.message;
    }
}

async function register() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const message = document.getElementById('registerMessage');
    
    if (!usernameInput || !passwordInput || !message) {
        console.error('Register form elements not found');
        return;
    }
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        message.textContent = 'Please enter both username and password';
        return;
    }
    
    try {
        const response = await fetch('/api/register/public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            message.textContent = data.message || 'Registration successful';
            setTimeout(() => window.location.href = 'login.html', 2000);
        } else {
            message.textContent = data.error || 'Registration failed';
        }
    } catch (err) {
        message.textContent = 'Network error: ' + err.message;
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    if (sidebar && content) {
        sidebar.classList.toggle('open');
        content.classList.toggle('shift');
    } else {
        console.error('Sidebar or content element not found');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const toggleButton = document.getElementById('toggleSidebar');
    
    if (loginForm && document.getElementById('loginButton')) {
        document.getElementById('loginButton').addEventListener('click', login);
    }
    
    if (registerForm && document.getElementById('registerButton')) {
        document.getElementById('registerButton').addEventListener('click', register);
    }
    
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleSidebar);
    } else {
        console.error('Toggle button not found');
    }
});