// Get DOM elements
const baptismForm = document.getElementById('baptismForm');
const baptismList = document.getElementById('baptismList');
const searchInput = document.getElementById('searchInput');

// Format date to mm/dd/yyyy
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// Load baptism records on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded for likolobetso.js at:', new Date().toISOString());
    if (!baptismList) {
        console.error('baptismList element not found');
        const errorEl = document.getElementById('error') || document.createElement('div');
        errorEl.id = 'error';
        document.body.prepend(errorEl);
        errorEl.textContent = 'Error: Baptism table not found. Please refresh.';
        return;
    }
    loadBaptisms();
    if (baptismForm) baptismForm.addEventListener('submit', handleBaptismSubmit);
    if (searchInput) handleSearch('searchInput', loadBaptisms);
});

// Handle baptism form submission
async function handleBaptismSubmit(event) {
    event.preventDefault();
    console.log('Handling baptism form submission at:', new Date().toISOString());
    const formData = new FormData(baptismForm);
    const baptismData = {
        first_name: formData.get('first_name'),
        middle_name: formData.get('middle_name'),
        surname: formData.get('surname'),
        date_of_birth: formData.get('date_of_birth'),
        father_first_name: formData.get('father_first_name'),
        father_middle_name: formData.get('father_middle_name'),
        father_surname: formData.get('father_surname'),
        mother_first_name: formData.get('mother_first_name'),
        mother_middle_name: formData.get('mother_middle_name'),
        mother_surname: formData.get('mother_surname'),
        baptism_date: formData.get('baptism_date'),
        pastor: formData.get('pastor')
    };

    // Validate required fields
    const requiredFields = [
        'first_name', 'surname', 'date_of_birth', 'baptism_date', 'pastor',
        'father_first_name', 'father_surname', 'mother_first_name', 'mother_surname'
    ];
    const emptyFields = requiredFields.filter(field => !baptismData[field] || baptismData[field].trim() === '');
    if (emptyFields.length > 0) {
        console.error('Missing required fields:', emptyFields);
        alert(`Please fill in all required fields: ${emptyFields.join(', ')}`);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            throw new Error('Please log in to add a baptism');
        }
        const response = await fetch('/api/baptisms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ baptism: baptismData })
        });
        console.log('Baptism submission response:', { status: response.status, ok: response.ok });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to add baptism');
        alert(result.message);
        baptismForm.reset();
        loadBaptisms();
    } catch (err) {
        console.error('Baptism submission error:', err);
        alert(`Error: ${err.message}`);
    }
}

// Load and display non-archived baptism records
async function loadBaptisms(search = '') {
    console.log('loadBaptisms called with search:', search);
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            baptismList.innerHTML = `<tr><td colspan="8">Error: Please log in to view baptisms</td></tr>`;
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return;
        }
        const apiUrl = `/api/baptisms?search=${encodeURIComponent(search)}`;
        console.log('Fetching baptisms from:', apiUrl);
        const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('API response status:', response.status, 'OK:', response.ok);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error:', errorData);
            throw new Error(errorData.error || `Failed to fetch baptisms (Status: ${response.status})`);
        }
        const baptisms = await response.json();
        console.log('Fetched baptisms:', baptisms);
        if (!Array.isArray(baptisms)) {
            console.error('Invalid data format:', baptisms);
            baptismList.innerHTML = `<tr><td colspan="8">Error: Invalid server data</td></tr>`;
            return;
        }

        // Filter for non-archived records (in case the server returns all records)
        const nonArchivedBaptisms = baptisms.filter(b => b.archived === false || b.archived === 'f');
        console.log('Non-archived baptisms:', nonArchivedBaptisms);

        if (nonArchivedBaptisms.length === 0) {
            baptismList.innerHTML = `<tr><td colspan="8" class="border p-2 text-center">No active baptism records found</td></tr>`;
            return;
        }

        baptismList.innerHTML = nonArchivedBaptisms.map(b => {
            console.log('Rendering baptism record:', b);
            return `
                <tr>
                    <td class="border p-2">${b.first_name || 'Unknown'}</td>
                    <td class="border p-2">${b.middle_name || ''}</td>
                    <td class="border p-2">${b.surname || 'Unknown'}</td>
                    <td class="border p-2">${b.date_of_birth ? formatDate(b.date_of_birth) : 'N/A'}</td>
                    <td class="border p-2">${b.father_first_name || 'Unknown'} ${b.father_middle_name || ''} ${b.father_surname || 'Unknown'}</td>
                    <td class="border p-2">${b.mother_first_name || 'Unknown'} ${b.mother_middle_name || ''} ${b.mother_surname || 'Unknown'}</td>
                    <td class="border p-2">${b.baptism_date ? formatDate(b.baptism_date) : 'N/A'}</td>
                    <td class="border p-2">${b.pastor || 'Unknown'}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Load baptisms error:', err);
        baptismList.innerHTML = `<tr><td colspan="8">Error: ${err.message}</td></tr>`;
    }
}

// Utility function to debounce search input to prevent excessive API calls
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Handles search functionality for baptisms.
 * Attaches a debounced input event listener to the search input element and triggers
 * the loadBaptisms function with the search input value.
 * 
 * @param {string} inputId - The ID of the search input element ('searchInput').
 * @param {Function} fetchFunction - The function to call to fetch data (loadBaptisms).
 * @param {number} [debounceTime=300] - Time in milliseconds to debounce the input event.
 */
function handleSearch(inputId, fetchFunction, debounceTime = 300) {
    const searchInput = document.getElementById(inputId);
    if (!searchInput) {
        console.error(`Search input with ID '${inputId}' not found`);
        const errorEl = document.getElementById('error') || document.createElement('div');
        errorEl.id = 'error';
        document.body.prepend(errorEl);
        errorEl.textContent = `Error: Search input not found`;
        return;
    }
    const debouncedFetch = debounce(() => {
        const searchTerm = searchInput.value.trim();
        console.log(`Search triggered for input '${inputId}' with value: ${searchTerm}`);
        fetchFunction(searchTerm);
    }, debounceTime);
    searchInput.addEventListener('input', debouncedFetch);
    console.log(`Search handler initialized for input '${inputId}'`);
}