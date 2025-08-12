async function login(e) {
    e.preventDefault(); // Prevent default form submission
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
        message.style.color = '#e74c3c';
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
                message.style.color = '#e74c3c';
                return;
            }
            window.location.href = 'regsys.html';
        } else {
            message.textContent = data.error || 'Login failed';
            message.style.color = '#e74c3c';
        }
    } catch (err) {
        message.textContent = 'Network error: ' + err.message;
        message.style.color = '#e74c3c';
    }
}

async function register(e) {
    e.preventDefault(); // Prevent default form submission
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
        message.style.color = '#e74c3c';
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
            message.style.color = '#4CAF50';
            setTimeout(() => window.location.href = 'login.html', 2000);
        } else {
            message.textContent = data.error || 'Registration failed';
            message.style.color = '#e74c3c';
        }
    } catch (err) {
        message.textContent = 'Network error: ' + err.message;
        message.style.color = '#e74c3c';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuClose = document.querySelector('.menu-close');
    
    if (loginForm) {
        loginForm.addEventListener('submit', login);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', register);
    }
    
    if (menuToggle && menuClose) {
        menuToggle.addEventListener('click', () => {
            document.querySelector('.side-menu').classList.toggle('active');
            document.querySelector('.header-wrapper').classList.toggle('menu-active');
        });
        
        menuClose.addEventListener('click', () => {
            document.querySelector('.side-menu').classList.remove('active');
            document.querySelector('.header-wrapper').classList.remove('menu-active');
        });
    } else {
        console.error('Menu toggle or close elements not found');
    }
});