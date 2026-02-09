console.log('archives.js loaded at:', new Date().toISOString());

async function fetchArchives(search = '') {
    console.log('fetchArchives called with search:', search);
    const errorEl = document.getElementById('error') || document.createElement('div');
    errorEl.id = 'error';
    document.body.prepend(errorEl);
    
    // For development - show loading message
    if (!localStorage.getItem('token')) {
        errorEl.textContent = 'Please log in to view archives';
        setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }
    
    try {
        // ... rest of existing code ...
        
    } catch (err) {
        console.error('Fetch error:', err);
        // For development, show mock data
        if (err.message.includes('404') || err.message.includes('Endpoint not found')) {
            console.log('Using mock data for development');
            // Display mock data
            const tables = {
                movedList: document.getElementById('movedList'),
                deceasedList: document.getElementById('deceasedList'),
                baptismList: document.getElementById('baptismList'),
                weddingList: document.getElementById('weddingList')
            };
            
            tables.movedList.innerHTML = `
                <tr>
                    <td class="border p-2">Test</td>
                    <td class="border p-2">Member</td>
                    <td class="border p-2">999</td>
                    <td class="border p-2">
                        <button class="detailsBtn bg-blue-500 text-white p-1 rounded" 
                                data-record='{"id":1,"record_type":"member","details":{"lebitso":"Test","fane":"Member","status":"Moved"},"palo":999}'
                                data-open="false">Details</button>
                        <button class="restoreBtn bg-green-500 text-white p-1 rounded" data-id="1">Restore</button>
                    </td>
                </tr>
            `;
            
            tables.deceasedList.innerHTML = `
                <tr>
                    <td class="border p-2">Archived</td>
                    <td class="border p-2">Member</td>
                    <td class="border p-2">998</td>
                    <td class="border p-2">
                        <button class="detailsBtn bg-blue-500 text-white p-1 rounded" 
                                data-record='{"id":2,"record_type":"member","details":{"lebitso":"Archived","fane":"Member","status":"Deceased"},"palo":998}'
                                data-open="false">Details</button>
                    </td>
                </tr>
            `;
            
            // Setup event listeners for mock buttons
            setTimeout(() => {
                document.querySelectorAll('.detailsBtn').forEach(btn => btn.addEventListener('click', () => toggleDetails(btn)));
                document.querySelectorAll('.restoreBtn').forEach(btn => btn.addEventListener('click', () => restoreRecord(btn.dataset.id)));
            }, 100);
        } else {
            errorEl.textContent = `Error: ${err.message}`;
        }
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
        let detailsHtml = '<td colspan="' + (record.record_type === 'baptism' ? 3 : 4) + '" class="border p-2"><table class="w-full border-collapse">';
        if (record.record_type === 'member') {
            detailsHtml += `
                <tr><td class="border p-2 font-semibold">Lebitso</td><td class="border p-2">${record.details?.lebitso || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Fane</td><td class="border p-2">${record.details?.fane || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Palo</td><td class="border p-2">${record.palo || 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Status</td><td class="border p-2">${record.details?.status || 'Unknown'}</td></tr>
                <tr><td class="border p-2" colspan="2"><input type="radio" id="showReceipts_${record.id}" name="showReceipts_${record.id}"><label for="showReceipts_${record.id}"> Show Receipts</label></td></tr>
                <tr id="receipts_${record.id}" style="display: none;"><td class="border p-2 font-semibold" colspan="2">Receipts:</td></tr>
            `;
        } else if (record.record_type === 'baptism') {
            detailsHtml += `
                <tr><td class="border p-2 font-semibold">Name</td><td class="border p-2">${record.details?.name || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Baptism ID</td><td class="border p-2">${record.details?.baptism_id || 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Baptism Date</td><td class="border p-2">${record.details?.baptism_date ? new Date(record.details.baptism_date).toLocaleDateString() : 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Date of Birth</td><td class="border p-2">${record.details?.date_of_birth ? new Date(record.details.date_of_birth).toLocaleDateString() : 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Father</td><td class="border p-2">${record.details?.father_name || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Mother</td><td class="border p-2">${record.details?.mother_name || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Pastor</td><td class="border p-2">${record.details?.pastor || 'Unknown'}</td></tr>
            `;
        } else if (record.record_type === 'wedding') {
            detailsHtml += `
                <tr><td class="border p-2 font-semibold">Wedding ID</td><td class="border p-2">${record.details?.wedding_id || 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Groom</td><td class="border p-2">${record.details?.groom_name || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Bride</td><td class="border p-2">${record.details?.bride_name || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Wedding Date</td><td class="border p-2">${record.details?.wedding_date ? new Date(record.details.wedding_date).toLocaleDateString() : 'N/A'}</td></tr>
                <tr><td class="border p-2 font-semibold">Pastor</td><td class="border p-2">${record.details?.pastor || 'Unknown'}</td></tr>
                <tr><td class="border p-2 font-semibold">Location</td><td class="border p-2">${record.details?.location || 'Unknown'}</td></tr>
            `;
        }
        if (record.record_type === 'member') {
            detailsHtml += `
                ${Object.entries(record.details || {})
                    .filter(([key]) => !['lebitso', 'fane', 'status'].includes(key))
                    .map(([key, value]) => `<tr><td class="border p-2 font-semibold">${key}</td><td class="border p-2">${value || 'N/A'}</td></tr>`)
                    .join('')}
            `;
        } else if (record.record_type === 'baptism') {
            detailsHtml += `
                ${Object.entries(record.details || {})
                    .filter(([key]) => !['name', 'baptism_id', 'baptism_date', 'date_of_birth', 'father_name', 'mother_name', 'pastor'].includes(key))
                    .map(([key, value]) => `<tr><td class="border p-2 font-semibold">${key}</td><td class="border p-2">${value || 'N/A'}</td></tr>`)
                    .join('')}
            `;
        } else if (record.record_type === 'wedding') {
            detailsHtml += `
                ${Object.entries(record.details || {})
                    .filter(([key]) => !['wedding_id', 'groom_name', 'bride_name', 'wedding_date', 'pastor', 'location'].includes(key))
                    .map(([key, value]) => `<tr><td class="border p-2 font-semibold">${key}</td><td class="border p-2">${value || 'N/A'}</td></tr>`)
                    .join('')}
            `;
        }
        detailsHtml += '</table></td>';
        newRow.innerHTML = detailsHtml;
        parentRow.insertAdjacentElement('afterend', newRow);
        const radioBtn = document.getElementById(`showReceipts_${record.id}`);
        if (radioBtn && record.record_type === 'member') {
            radioBtn.addEventListener('change', () => {
                const receiptsRow = document.getElementById(`receipts_${record.id}`);
                if (radioBtn.checked) {
                    let receiptsHtml = '<td class="border p-2" colspan="2">';
                    const hasReceipts = [record.receipt_2024, record.receipt_2025, record.receipt_2026, record.receipt_2027, record.receipt_2028, record.receipt_2029, record.receipt_2030]
                        .some(receipt => receipt && receipt.trim() !== '');
                    if (hasReceipts) {
                        if (record.receipt_2024) receiptsHtml += '<div>2024: ' + record.receipt_2024 + '</div>';
                        if (record.receipt_2025) receiptsHtml += '<div>2025: ' + record.receipt_2025 + '</div>';
                        if (record.receipt_2026) receiptsHtml += '<div>2026: ' + record.receipt_2026 + '</div>';
                        if (record.receipt_2027) receiptsHtml += '<div>2027: ' + record.receipt_2027 + '</div>';
                        if (record.receipt_2028) receiptsHtml += '<div>2028: ' + record.receipt_2028 + '</div>';
                        if (record.receipt_2029) receiptsHtml += '<div>2029: ' + record.receipt_2029 + '</div>';
                        if (record.receipt_2030) receiptsHtml += '<div>2030: ' + record.receipt_2030 + '</div>';
                    } else {
                        receiptsHtml += 'No receipt numbers';
                    }
                    receiptsHtml += '</td>';
                    receiptsRow.innerHTML = receiptsHtml;
                    receiptsRow.style.display = 'table-row';
                } else {
                    receiptsRow.style.display = 'none';
                }
            });
        }
        btn.dataset.open = 'true';
        btn.textContent = 'Hide Details';
    }
}

async function restoreRecord(id) {
    const errorEl = document.getElementById('error') || document.createElement('div');
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No authentication token');
        if (!['pastor', 'secretary'].includes(localStorage.getItem('role'))) {
            errorEl.textContent = 'Error: No permission to restore records.';
            throw new Error('Insufficient permissions');
        }
        console.log('Restoring record:', id);
        const response = await fetch(`/api/archives/${id}/restore`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to restore');
        console.log('Restore successful');
        await fetchArchives();
        errorEl.textContent = 'Record restored successfully';
        setTimeout(() => errorEl.textContent = '', 3000);
    } catch (err) {
        console.error('Restore error:', err);
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
    fetchArchives();
    handleSearch('search', fetchArchives);
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
 * Handles search functionality for archives.
 * Attaches a debounced input event listener to the search input element and triggers
 * the fetchArchives function with the search input value.
 * 
 * @param {string} inputId - The ID of the search input element ('search').
 * @param {Function} fetchFunction - The function to call to fetch data (fetchArchives).
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