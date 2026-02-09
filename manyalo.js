// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Weddings page loaded, checking authentication...');
    
    // Check authentication
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    
    if (!token || !user || !role) {
        console.log('No valid authentication found, redirecting to login');
        alert('Please log in to access this page');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        console.log('Authenticated as:', currentUser.username);
        
        // Initialize the page
        initializeWeddingsPage();
        
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        alert('Session expired, please log in again');
        window.location.href = 'login.html';
    }
});

function initializeWeddingsPage() {
    console.log('Initializing Weddings page for user:', currentUser.username);
    
    // Get DOM elements
    const weddingForm = document.getElementById('weddingForm');
    const weddingList = document.getElementById('weddingList');
    const searchInput = document.getElementById('search');
    
    if (!weddingList) {
        console.error('weddingList element not found');
        return;
    }
    
    // Set up form submission
    if (weddingForm && currentUser.role !== 'board_member') {
        weddingForm.addEventListener('submit', handleWeddingSubmit);
    } else if (weddingForm) {
        // Disable form for board members
        weddingForm.querySelectorAll('input, button').forEach(element => {
            element.disabled = true;
        });
        weddingForm.querySelector('button').textContent = 'Record Wedding (Read Only)';
    }
    
    // Set up search
    if (searchInput) {
        handleSearch('search', loadWeddings);
    }
    
    // Initial load of weddings
    loadWeddings();
}

async function handleWeddingSubmit(event) {
    event.preventDefault();
    console.log('=== FRONTEND: Handling wedding form submission ===');
    
    const form = document.getElementById('weddingForm');
    if (!form) {
        console.error('Wedding form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    // Log all form data
    console.log('Form data entries:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }
    
    const weddingData = {
        groom_first_name: formData.get('groom_first_name').trim(),
        groom_middle_name: formData.get('groom_middle_name').trim(),
        groom_surname: formData.get('groom_surname').trim(),
        groom_id_number: formData.get('groom_id_number').trim(),
        bride_first_name: formData.get('bride_first_name').trim(),
        bride_middle_name: formData.get('bride_middle_name').trim(),
        bride_surname: formData.get('bride_surname').trim(),
        bride_id_number: formData.get('bride_id_number').trim(),
        wedding_date: formData.get('wedding_date'),
        pastor: formData.get('pastor').trim(),
        location: formData.get('location').trim()
    };

    console.log('Data to be sent to server:', weddingData);

    // Validate required fields
    const requiredFields = [
        'groom_first_name', 'groom_surname', 
        'bride_first_name', 'bride_surname',
        'wedding_date', 'pastor', 'location'
    ];
    
    const emptyFields = requiredFields.filter(field => !weddingData[field] || weddingData[field].toString().trim() === '');
    if (emptyFields.length > 0) {
        console.log('Validation failed - empty fields:', emptyFields);
        alert(`Please fill in all required fields: ${emptyFields.join(', ')}`);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Session expired, please log in again');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('Sending request to /api/weddings with token:', token.substring(0, 20) + '...');
        
        const response = await fetch('/api/weddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(weddingData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            
            throw new Error(errorData.error || `Failed to add wedding (${response.status})`);
        }
        
        const result = await response.json();
        console.log('Success response:', result);
        
        alert(result.message || 'Wedding recorded successfully!');
        form.reset();
        loadWeddings();
        
    } catch (err) {
        console.error('Wedding submission error:', err);
        alert(`Error: ${err.message}`);
    }
}

async function loadWeddings(search = '') {
    console.log('Loading weddings with search:', search);
    
    const weddingList = document.getElementById('weddingList');
    if (!weddingList) return;
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Please log in to view weddings');
        }
        
        const response = await fetch(`/api/weddings?search=${encodeURIComponent(search)}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Session expired. Please log in again.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch weddings');
        }
        
        const weddings = await response.json();
        console.log('Fetched weddings:', weddings);
        
        if (!Array.isArray(weddings)) {
            throw new Error('Invalid server response format');
        }

        if (weddings.length === 0) {
            weddingList.innerHTML = `
                <tr>
                    <td colspan="4" class="border p-2 text-center">
                        No wedding records found ${search ? 'for your search' : ''}
                    </td>
                </tr>
            `;
            return;
        }

        weddingList.innerHTML = weddings.map(w => {
            const formatDate = (dateStr) => {
                if (!dateStr) return 'N/A';
                try {
                    return new Date(dateStr).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } catch (e) {
                    return 'Invalid date';
                }
            };
            
            const groomName = `${w.groom_first_name || ''} ${w.groom_middle_name || ''} ${w.groom_surname || ''}`.trim();
            const brideName = `${w.bride_first_name || ''} ${w.bride_middle_name || ''} ${w.bride_surname || ''}`.trim();
            
            return `
                <tr>
                    <td class="border p-2">${groomName || 'Unknown'}</td>
                    <td class="border p-2">${brideName || 'Unknown'}</td>
                    <td class="border p-2">${formatDate(w.wedding_date)}</td>
                    <td class="border p-2">
                        <button class="details-btn bg-blue-500 text-white p-1 rounded" 
                                onclick="showWeddingDetails(${JSON.stringify(w).replace(/"/g, '&quot;')})">
                            Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Load weddings error:', err);
        
        if (err.message.includes('Session expired') || err.message.includes('Please log in')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            alert(err.message);
            window.location.href = 'login.html';
            return;
        }
        
        weddingList.innerHTML = `
            <tr>
                <td colspan="4" class="border p-2 text-center text-red-500">
                    Error: ${err.message}
                </td>
            </tr>
        `;
    }
}

function showWeddingDetails(wedding) {
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return 'Invalid date';
        }
    };
    
    const details = `
        <strong>Wedding Details:</strong><br>
        <strong>Groom:</strong> ${wedding.groom_first_name || ''} ${wedding.groom_middle_name || ''} ${wedding.groom_surname || ''}<br>
        <strong>Groom ID:</strong> ${wedding.groom_id_number || 'N/A'}<br>
        <strong>Bride:</strong> ${wedding.bride_first_name || ''} ${wedding.bride_middle_name || ''} ${wedding.bride_surname || ''}<br>
        <strong>Bride ID:</strong> ${wedding.bride_id_number || 'N/A'}<br>
        <strong>Wedding Date:</strong> ${formatDate(wedding.wedding_date)}<br>
        <strong>Pastor:</strong> ${wedding.pastor || 'Unknown'}<br>
        <strong>Location:</strong> ${wedding.location || 'Unknown'}
    `;
    
    alert(details);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function handleSearch(inputId, fetchFunction, debounceTime = 300) {
    const searchInput = document.getElementById(inputId);
    if (!searchInput) {
        console.error(`Search input with ID '${inputId}' not found`);
        return;
    }
    
    const debouncedFetch = debounce(() => {
        const searchTerm = searchInput.value.trim();
        console.log(`Search triggered with value: ${searchTerm}`);
        fetchFunction(searchTerm);
    }, debounceTime);
    
    searchInput.addEventListener('input', debouncedFetch);
    console.log(`Search handler initialized for input '${inputId}'`);
}

// Make functions available globally
window.showWeddingDetails = showWeddingDetails;