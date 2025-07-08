document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) {
        console.error('Register form not found');
        return;
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorElement = document.getElementById('error');

        if (!usernameInput || !passwordInput || !errorElement) {
            console.error('Register form elements not found');
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            errorElement.textContent = 'Please enter both username and password';
            errorElement.style.display = 'block';
            return;
        }

        try {
            const response = await fetch('/api/register/public', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) {
                errorElement.textContent = data.error || 'Registration failed';
                errorElement.style.display = 'block';
                return;
            }
            alert('Registration successful! Please login.');
            window.location.href = 'login.html';
        } catch (err) {
            errorElement.textContent = 'Network error: ' + err.message;
            errorElement.style.display = 'block';
        }
    });
});