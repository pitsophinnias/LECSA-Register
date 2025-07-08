console.log('manyalo.js loaded at:', new Date().toISOString());

async function fetchWeddingArchives() {
    console.log('fetchWeddingArchives started at:', new Date().toISOString());
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
        console.log('Fetching with token:', token.substring(0, 10) + '...');
        const response = await fetch('/api/archives', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('API response:', { status: response.status, ok: response.ok });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error:', errorData);
            errorEl.textContent = `Error: ${errorData.error || 'Failed to fetch wedding archives (Status: ' + response.status + ')'}`;
            if (response.status === 401) setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        const archives = await response.json();
        console.log('Fetched archives:', archives);
        if (!Array.isArray(archives)) {
            console.error('Invalid data:', archives);
            errorEl.textContent = 'Error: Invalid server data.';
            throw new Error('Invalid data');
        }

        // Filter only wedding records
        const weddingRecords = archives.filter(r => r.record_type === 'wedding');
        console.log('Wedding records:', weddingRecords.length);

        weddingList.innerHTML = weddingRecords
            .map(r => `<tr data-id="${r.id}">
                <td class="border p-2">${r.details?.groom_name || 'Unknown'}</td>
                <td class="border p-2">${r.details?.bride_name || 'Unknown'}</td>
                <td class="border p-2">${r.details?.wedding_date ? new Date(r.details.wedding_date).toLocaleDateString() : 'N/A'}</td>
                <td class="border p-2"><button class="detailsBtn bg-blue-500 text-white p-1 rounded" data-record='${JSON.stringify(r).replace(/'/g, "\\'")}' data-open="false">Details</button></td>
            </tr>`)
            .join('') || '<tr><td colspan="4" class="border p-2 text-center">No archived weddings found</td></tr>';

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
        record = JSON.parse(btn.dataset.record);
        console.log('Parsed record:', record);
    } catch (e) {
        console.error('Invalid JSON in data-record:', btn.dataset.record, e);
        document.getElementById('error').textContent = 'Error: Invalid record data. Please contact support.';
        return;
    }
    const parentRow = btn.closest('tr');
    const detailsRow = document.querySelector(`tr[data-details-id="${record.id}"]`);
    if (isOpen) {
        if (detailsRow) detailsRow.remove();
        btn.dataset.open = 'false';
        btn.textContent = 'Details';
    } else {
        if (detailsRow) detailsRow.remove();
        const newRow = document.createElement('tr');
        newRow.dataset.detailsId = record.id;
        let detailsHtml = '<td colspan="4" class="border p-2"><table class="w-full border-collapse">';
        if (record.record_type === 'wedding') {
            detailsHtml += `
                <tr><td class="border p-2 font-semibold">Wedding ID</td><td class="border p-2">${record.details?.wedding_id || 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Groom</td><td class="border p-2">${record.details?.groom_name || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Bride</td><td class="border p-2">${record.details?.bride_name || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Wedding Date</td><td class="border p-2">${record.details?.wedding_date ? new Date(record.details.wedding_date).toLocaleDateString() : 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Pastor</td><td class="border p-2">${record.details?.pastor || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Location</td><td class="border p-2">${record.details?.location || 'Unknown'}</td></tr>
                ${Object.entries(record.details || {})
                    .filter(([key]) => !['wedding_id', 'groom_name', 'bride_name', 'wedding_date', 'pastor', 'location'].includes(key))
                    .map(([key, value]) => {
                        if (Array.isArray(value) && (!value.length || value.every(item => !Object.keys(item).length))) return `<tr><td class="border p-2 font-semibold">${key}</td><td class="border p-2">No ${key} recorded</td></tr>`;
                        return `<tr><td class="border p-2 font-semibold">${key}</td><td class="border p-2">${value || 'N/A'}</td></tr>`;
                    })
                    .join('')}
            `;
        }
        detailsHtml += '</table></td>';
        newRow.innerHTML = detailsHtml;
        parentRow.insertAdjacentElement('afterend', newRow);
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
    const weddingData = {
        groom_first_name: formData.get('groomLebitso')?.trim(),
        groom_middle_name: formData.get('groomLaKereke')?.trim() || null,
        groom_surname: formData.get('groomFane')?.trim(),
        bride_first_name: formData.get('brideLebitso')?.trim(),
        bride_middle_name: formData.get('brideLaKereke')?.trim() || null,
        bride_surname: formData.get('brideFane')?.trim(),
        wedding_date: formData.get('weddingDate')?.trim(),
        pastor: formData.get('moruti')?.trim(),
        location: formData.get('location')?.trim()
    };

    // Validate required fields
    if (!weddingData.groom_first_name || !weddingData.groom_surname ||
        !weddingData.bride_first_name || !weddingData.bride_surname ||
        !weddingData.wedding_date || !weddingData.pastor || !weddingData.location) {
        console.error('Missing required fields:', weddingData);
        errorEl.textContent = 'Error: All required fields must be filled.';
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
        await fetchWeddingArchives(); // Refresh the wedding list
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
});