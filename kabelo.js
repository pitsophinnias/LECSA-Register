async function addMember(e) {
    e.preventDefault();
    const form = document.getElementById('memberForm');
    const errorEl = document.getElementById('error');
    if (!form || !errorEl) {
        console.error('Form or error element not found');
        errorEl.textContent = 'Form error: Please refresh the page';
        return;
    }
    const formData = new FormData(form);
    const lebitso = formData.get('lebitso').trim();
    const fane = formData.get('fane').trim();
    if (!lebitso || !fane) {
        console.error('Missing required fields:', { lebitso, fane });
        errorEl.textContent = 'Please fill all required fields';
        return;
    }
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Please log in to continue');
        if (localStorage.getItem('role') === 'board_member') {
            console.error('Insufficient permissions for role:', localStorage.getItem('role'));
            errorEl.textContent = 'Insufficient permissions';
            return;
        }
        console.log('Sending POST /api/members with:', { lebitso, fane });
        const response = await fetch('/api/members', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ lebitso, fane })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('POST /api/members failed:', { status: response.status, data });
            throw new Error(data.error || `Failed to register member: HTTP ${response.status}`);
        }
        console.log('Member registered:', data);
        await fetchMembers();
        form.reset();
        errorEl.textContent = 'Member registered successfully';
        setTimeout(() => errorEl.textContent = '', 3000);
    } catch (err) {
        console.error('Registration error:', err);
        errorEl.textContent = `Error: ${err.message}`;
    }
}

async function updateReceipt(palo, year, value, doneButton) {
    const errorEl = document.getElementById('error');
    if (!doneButton || !errorEl) {
        console.error('Done button or error element not found');
        return;
    }
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Please log in to continue');
        if (localStorage.getItem('role') === 'board_member') {
            console.error('Insufficient permissions for role:', localStorage.getItem('role'));
            errorEl.textContent = 'Insufficient permissions';
            return;
        }
        console.log('Sending PUT /api/members/', palo, '/receipt with:', { year, value });
        const response = await fetch(`/api/members/${palo}/receipt`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ year, receipt: value.trim() })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('PUT /api/members/', palo, '/receipt failed:', { status: response.status, data });
            throw new Error(data.error || `Failed to update receipt: HTTP ${response.status}`);
        }
        console.log('Receipt updated:', data);
        doneButton.style.display = 'none';
        errorEl.textContent = 'Receipt updated successfully';
        setTimeout(() => errorEl.textContent = '', 3000);
    } catch (err) {
        console.error('Update receipt error:', err);
        errorEl.textContent = `Error: ${err.message}`;
    }
}

async function archiveMember(palo, status, id = null) {
    const errorEl = document.getElementById('error');
    if (!errorEl) {
        console.error('Error element not found');
        return;
    }
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Please log in to continue');
        if (localStorage.getItem('role') === 'board_member') {
            console.error('Insufficient permissions for role:', localStorage.getItem('role'));
            errorEl.textContent = 'Insufficient permissions';
            return;
        }
        const payload = { status };
        if (id) payload.id = id;
        console.log('Sending PUT /api/members/', palo, '/archive with:', { palo, id, status });
        const response = await fetch(`/api/members/${palo}/archive`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('PUT /api/members/', palo, '/archive failed:', { status: response.status, data });
            throw new Error(data.error || `Failed to mark member as ${status}: HTTP ${response.status}`);
        }
        console.log('Member archived:', data);
        await fetchMembers();
        errorEl.textContent = `Member marked as ${status}`;
        setTimeout(() => errorEl.textContent = '', 3000);
    } catch (err) {
        console.error('Archive error:', err);
        errorEl.textContent = `Error: ${err.message}`;
    }
}

async function fetchMembers() {
    const memberList = document.getElementById('memberList');
    const searchInput = document.getElementById('search');
    const errorEl = document.getElementById('error');
    if (!memberList || !searchInput || !errorEl) {
        console.error('Member list, search input, or error element not found');
        errorEl.textContent = 'Error: Page elements not found';
        return;
    }
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Please log in to continue');
        const search = searchInput.value.trim();
        console.log('Sending GET /api/members with search:', search);
        const response = await fetch(`/api/members?search=${encodeURIComponent(search)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const members = await response.json();
        if (!response.ok) {
            console.error('GET /api/members failed:', { status: response.status, members });
            throw new Error(members.error || `Failed to fetch members: HTTP ${response.status}`);
        }
        console.log('Members fetched:', members);
        memberList.innerHTML = '';
        const isBoardMember = localStorage.getItem('role') === 'board_member';
        members.forEach(member => {
            const row = document.createElement('tr');
            row.dataset.id = member.id || ''; // Store member id if available
            row.innerHTML = `
                <td class="border p-2">${member.palo}</td>
                <td class="border p-2">${member.lebitso}</td>
                <td class="border p-2">${member.fane}</td>
                ${[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(year => `
                    <td class="border p-2">
                        ${isBoardMember ? (member[`receipt_${year}`] || '-') : `
                            <input type="text" value="${member[`receipt_${year}`] || ''}" data-palo="${member.palo}" data-year="${year}" class="receipt-input w-full p-1 border">
                            <button class="done-button action-button" style="display: none;">Done</button>
                        `}
                    </td>
                `).join('')}
                <td class="border p-2">
                    ${isBoardMember ? '' : `
                        <button class="action-button moved-button" data-id="${member.id || ''}">Moved</button>
                        <button class="action-button deceased-button" data-id="${member.id || ''}">Deceased</button>
                    `}
                </td>
            `;
            memberList.appendChild(row);
        });
    } catch (err) {
        console.error('Fetch members error:', err);
        memberList.innerHTML = '<tr><td colspan="10">Failed to load members</td></tr>';
        errorEl.textContent = `Error: ${err.message}`;
    }
}

function logout() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
    } catch (err) {
        console.error('Logout error:', err);
        alert('Error logging out: ' + err.message);
    }
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    const role = localStorage.getItem('role');
    if (['pastor', 'secretary'].includes(role)) {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'block';
    }
    if (role === 'board_member') {
        const memberForm = document.getElementById('memberForm');
        if (memberForm) memberForm.style.display = 'none';
    }
    const urlParams = new URLSearchParams(window.location.search);
    const lebitsoInput = document.getElementById('lebitso');
    const faneInput = document.getElementById('fane');
    if (lebitsoInput && urlParams.get('lebitso')) lebitsoInput.value = urlParams.get('lebitso');
    if (faneInput && urlParams.get('fane')) faneInput.value = urlParams.get('fane');
    fetchMembers();
    const memberForm = document.getElementById('memberForm');
    const searchInput = document.getElementById('search');
    const toggleButton = document.getElementById('toggleSidebar');
    const logoutLink = document.getElementById('logoutLink');
    if (memberForm) memberForm.addEventListener('submit', addMember);
    if (searchInput) {
        handleSearch('search', fetchMembers);
    }
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const content = document.getElementById('content');
            if (sidebar && content) {
                sidebar.classList.toggle('open');
                content.classList.toggle('shift');
            } else {
                console.error('Sidebar or content not found');
            }
        });
    }
    if (logoutLink) logoutLink.addEventListener('click', logout);
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('receipt-input')) {
            const doneButton = e.target.nextElementSibling;
            if (doneButton && doneButton.classList.contains('done-button')) {
                doneButton.style.display = e.target.value.trim() !== (e.target.defaultValue || '') ? 'inline-block' : 'none';
            }
        }
    });
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('done-button')) {
            const input = e.target.previousElementSibling;
            if (input && input.classList.contains('receipt-input')) {
                const palo = input.dataset.palo;
                const year = input.dataset.year;
                const value = input.value;
                updateReceipt(palo, year, value, e.target);
            }
        } else if (e.target.classList.contains('moved-button')) {
            const row = e.target.closest('tr');
            const palo = row.cells[0].textContent;
            const id = e.target.dataset.id;
            archiveMember(palo, 'Moved', id);
        } else if (e.target.classList.contains('deceased-button')) {
            const row = e.target.closest('tr');
            const palo = row.cells[0].textContent;
            const id = e.target.dataset.id;
            archiveMember(palo, 'Deceased', id);
        }
    });
});

// Utility function to debounce search input to prevent excessive API calls
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Handles search functionality for members.
 * Attaches a debounced input event listener to the search input element and triggers
 * the fetchMembers function when the input changes.
 * 
 * @param {string} inputId - The ID of the search input element ('search').
 * @param {Function} fetchFunction - The function to call to fetch data (fetchMembers).
 * @param {number} [debounceTime=300] - Time in milliseconds to debounce the input event.
 */
function handleSearch(inputId, fetchFunction, debounceTime = 300) {
    const searchInput = document.getElementById(inputId);
    if (!searchInput) {
        console.error(`Search input with ID '${inputId}' not found`);
        const errorEl = document.getElementById('error');
        if (errorEl) errorEl.textContent = `Error: Search input not found`;
        return;
    }
    const debouncedFetch = debounce(() => {
        console.log(`Search triggered with value: ${searchInput.value}`);
        fetchFunction();
    }, debounceTime);
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    newInput.addEventListener('input', debouncedFetch);
    console.log(`Search handler initialized for input '${inputId}'`);
}