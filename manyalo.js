console.log('manyalo.js loaded at:', new Date().toISOString());

async function fetchWeddingArchives(search = '') {
    console.log('fetchWeddingArchives called with search:', search);
    const errorEl = document.getElementById('error') || document.createElement('div');
    errorEl.id = 'error';
    document.body.prepend(errorEl);
    
    const weddingList = document.getElementById('weddingList');
    if (!weddingList) {
        console.error('Missing weddingList table element');
        errorEl.textContent = 'Error: Page structure broken. Please refresh.';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            errorEl.textContent = 'Error: Please log in to view wedding archives.';
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            throw new Error('No token');
        }
        const apiUrl = `/api/weddings?search=${encodeURIComponent(search)}`;
        console.log('Fetching weddings from:', apiUrl);
        const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('API response status:', response.status, 'OK:', response.ok);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error:', errorData);
            errorEl.textContent = `Error: ${errorData.error || 'Failed to fetch wedding archives (Status: ' + response.status + ')'}`;
            if (response.status === 401) setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        const weddings = await response.json();
        console.log('Fetched weddings:', weddings);
        if (!Array.isArray(weddings)) {
            console.error('Invalid data:', weddings);
            errorEl.textContent = 'Error: Invalid server data.';
            throw new Error('Invalid data');
        }

        weddingList.innerHTML = weddings
            .map(w => {
                const groomComponents = [w.groom_first_name, w.groom_middle_name, w.groom_surname]
                    .map(c => c && typeof c === 'string' && c.trim() ? c.trim() : null)
                    .filter(Boolean);
                const brideComponents = [w.bride_first_name, w.bride_middle_name, w.bride_surname]
                    .map(c => c && typeof c === 'string' && c.trim() ? c.trim() : null)
                    .filter(Boolean);
                const groomName = groomComponents.length ? groomComponents.join(' ') : 'Unknown';
                const brideName = brideComponents.length ? brideComponents.join(' ') : 'Unknown';
                const weddingDate = w.wedding_date && typeof w.wedding_date === 'string' ? w.wedding_date : null;
                const pastor = w.pastor && typeof w.pastor === 'string' ? w.pastor.trim() : 'Unknown';
                const location = w.location && typeof w.location === 'string' ? w.location.trim() : 'Unknown';

                const recordData = {
                    groom_name: groomName,
                    bride_name: brideName,
                    groom_id_number: w.groom_id_number || 'N/A',
                    bride_id_number: w.bride_id_number || 'N/A',
                    wedding_date: weddingDate,
                    pastor: pastor,
                    location: location
                };
                const recordStr = btoa(JSON.stringify(recordData));
                console.log('Generated record for wedding ID:', w.id || 'unknown', 'data:', recordData);
                return `<tr data-id="${w.id || 'unknown'}">
                    <td class="border p-2">${groomName}</td>
                    <td class="border p-2">${brideName}</td>
                    <td class="border p-2">${weddingDate ? new Date(weddingDate).toLocaleDateString() : 'N/A'}</td>
                    <td class="border p-2"><button class="detailsBtn bg-blue-500 text-white p-1 rounded" data-record='${recordStr}' data-open="false">Details</button></td>
                </tr>`;
            })
            .filter(row => row)
            .join('') || '<tr><td colspan="4" class="border p-2 text-center">No recorded weddings found</td></tr>';

        document.querySelectorAll('.detailsBtn').forEach(btn => btn.addEventListener('click', () => toggleDetails(btn)));
    } catch (err) {
        console.error('Fetch error:', err);
        errorEl.textContent = `Error: ${err.message}`;
        weddingList.innerHTML = `<tr><td colspan="4" class="border p-2 text-center">Failed to load wedding archives</td></tr>`;
    }
}

function toggleDetails(btn) {
    console.log('Toggling details for button:', btn);
    const isOpen = btn.dataset.open === 'true';
    let record;
    try {
        const encoded = btn.dataset.record;
        const decoded = JSON.parse(atob(encoded));
        record = decoded;
        console.log('Parsed record:', record);
    } catch (e) {
        console.error('Invalid JSON in data-record:', btn.dataset.record, e);
        document.getElementById('error').textContent = 'Error: Invalid record data. Please contact support.';
        return;
    }
    const parentRow = btn.closest('tr');
    const detailsRow = document.querySelector(`tr[data-details-id="${parentRow.dataset.id}"]`);
    if (isOpen) {
        if (detailsRow) detailsRow.remove();
        btn.dataset.open = 'false';
        btn.textContent = 'Details';
    } else {
        if (detailsRow) detailsRow.remove();
        const newRow = document.createElement('tr');
        newRow.dataset.detailsId = parentRow.dataset.id || 'unknown';
        const detailsHtml = `
            <td colspan="4" class="border p-2">
                <table class="w-full border-collapse">
                    <tr><td class="border p-2 font-semibold">Groom</td><td class="border p-2">${record.groom_name || 'Unknown'}</td></tr>
                    <tr><td class="border p-2 font-semibold">Bride</td><td class="border p-2">${record.bride_name || 'Unknown'}</td></tr>
                    <tr><td class="border p-2 font-semibold">Groom ID Number</td><td class="border p-2">${record.groom_id_number || 'N/A'}</td></tr>
                    <tr><td class="border p-2 font-semibold">Bride ID Number</td><td class="border p-2">${record.bride_id_number || 'N/A'}</td></tr>
                    <tr><td class="border p-2 font-semibold">Wedding Date</td><td class="border p-2">${record.wedding_date ? new Date(record.wedding_date).toLocaleDateString() : 'N/A'}</td></tr>
                    <tr><td class="border p-2 font-semibold">Pastor</td><td class="border p-2">${record.pastor || 'Unknown'}</td></tr>
                    <tr><td class="border p-2 font-semibold">Location</td><td class="border p-2">${record.location || 'Unknown'}</td></tr>
                </table>
            </td>`;
        newRow.innerHTML = detailsHtml;
        parentRow.parentNode.insertBefore(newRow, parentRow.nextSibling);
        btn.dataset.open = 'true';
        btn.textContent = 'Hide Details';
    }
}

async function recordWedding(event) {
    event.preventDefault();
    console.log('Recording wedding at:', new Date().toISOString());
    const errorEl = document.getElementById('error') || document.createElement('div');
    errorEl.id = 'error';
    document.body.prepend(errorEl);

    const form = document.getElementById('weddingForm');
    if (!form) {
        console.error('Wedding form not found');
        errorEl.textContent = 'Error: Form not found. Please refresh.';
        return;
    }

    const formData = new FormData(form);
    console.log('Form Data:', Object.fromEntries(formData));
    const weddingData = {
        groom_first_name: formData.get('groomLebitso')?.trim(),
        groom_middle_name: formData.get('groomLaKereke')?.trim() || null,
        groom_surname: formData.get('groomFane')?.trim(),
        groom_id_number: formData.get('groomIdNumber')?.trim() || null,
        bride_first_name: formData.get('brideLebitso')?.trim(),
        bride_middle_name: formData.get('brideLaKereke')?.trim() || null,
        bride_surname: formData.get('brideFane')?.trim(),
        bride_id_number: formData.get('brideIdNumber')?.trim() || null,
        wedding_date: formData.get('weddingDate')?.trim(),
        pastor: formData.get('moruti')?.trim(),
        location: formData.get('location')?.trim()
    };

    const missingFields = [];
    if (!weddingData.groom_first_name) missingFields.push('Groom Lebitso');
    if (!weddingData.groom_surname) missingFields.push('Groom Fane');
    if (!weddingData.bride_first_name) missingFields.push('Bride Lebitso');
    if (!weddingData.bride_surname) missingFields.push('Bride Fane');
    if (!weddingData.wedding_date) missingFields.push('Wedding Date');
    if (!weddingData.pastor) missingFields.push('Moruti');
    if (!weddingData.location) missingFields.push('Location');

    if (missingFields.length > 0) {
        console.error('Missing required fields:', weddingData);
        errorEl.textContent = `Error: The following required fields must be filled: ${missingFields.join(', ')}.`;
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            errorEl.textContent = 'Error: Please log in to record a wedding.';
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            throw new Error('No token');
        }

        const response = await fetch('/api/weddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(weddingData)
        });

        console.log('API response:', { status: response.status, ok: response.ok });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error:', errorData);
            errorEl.textContent = `Error: ${errorData.error || 'Failed to record wedding (Status: ' + response.status + ')'}`;
            if (response.status === 401) setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        errorEl.textContent = 'Wedding recorded successfully';
        form.reset();
        await fetchWeddingArchives();
        setTimeout(() => { errorEl.textContent = ''; }, 3000);
    } catch (err) {
        console.error('Record wedding error:', err);
        errorEl.textContent = `Error: ${err.message}`;
    }
}

function logout() {
    console.log('Logging out');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = 'login.html';
}

function toggleSidebar() {
    console.log('Toggling sidebar at:', new Date().toISOString());
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const errorEl = document.getElementById('error') || document.createElement('div');
    if (!sidebar || !content) {
        console.error('Sidebar missing:', { sidebar: !!sidebar, content: !!content });
        errorEl.textContent = 'Error: Sidebar elements missing.';
        return;
    }
    sidebar.classList.toggle('open');
    content.classList.toggle('shift');
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded at:', new Date().toISOString());
    const errorEl = document.getElementById('error') || document.createElement('div');
    errorEl.id = 'error';
    document.body.prepend(errorEl);
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No token, redirecting');
        errorEl.textContent = 'Error: Please log in.';
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }
    const toggleButton = document.getElementById('toggleSidebar');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleSidebar);
        console.log('Toggle button listener added');
    } else {
        console.error('Toggle button not found');
        errorEl.textContent = 'Error: Menu button not found.';
    }
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) logoutLink.addEventListener('click', logout);
    else console.error('Logout link not found');
    const weddingForm = document.getElementById('weddingForm');
    if (weddingForm) weddingForm.addEventListener('submit', recordWedding);
    else console.error('Wedding form not found');
    fetchWeddingArchives();
    handleSearch('search', fetchWeddingArchives);
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
 * Handles search functionality for weddings.
 * Attaches a debounced input event listener to the search input element and triggers
 * the fetchWeddingArchives function with the search input value.
 * 
 * @param {string} inputId - The ID of the search input element ('search').
 * @param {Function} fetchFunction - The function to call to fetch data (fetchWeddingArchives).
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
        const searchTerm = searchInput.value.trim();
        console.log(`Search triggered for input '${inputId}' with value: ${searchTerm}`);
        fetchFunction(searchTerm);
    }, debounceTime);
    searchInput.addEventListener('input', debouncedFetch);
    console.log(`Search handler initialized for input '${inputId}'`);
}