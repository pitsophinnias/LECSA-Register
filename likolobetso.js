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
    loadBaptisms();
    if (baptismForm) baptismForm.addEventListener('submit', handleBaptismSubmit);
});

// Handle baptism form submission
async function handleBaptismSubmit(event) {
    event.preventDefault();
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
        alert(`Please fill in all required fields: ${emptyFields.join(', ')}`);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/baptisms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ baptism: baptismData })
        });
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
async function loadBaptisms() {
    try {
        const token = localStorage.getItem('token');
        const search = searchInput ? searchInput.value : '';
        const response = await fetch(`/api/baptisms?search=${encodeURIComponent(search)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const baptisms = await response.json();
        if (!response.ok) throw new Error(baptisms.error || 'Failed to fetch baptisms');
        if (baptismList) {
            baptismList.innerHTML = baptisms.map(b => `
                <tr>
                    <td class="border p-2">${b.first_name}</td>
                    <td class="border p-2">${b.middle_name || ''}</td>
                    <td class="border p-2">${b.surname}</td>
                    <td class="border p-2">${formatDate(b.date_of_birth)}</td>
                    <td class="border p-2">${b.father_first_name} ${b.father_middle_name || ''} ${b.father_surname}</td>
                    <td class="border p-2">${b.mother_first_name} ${b.mother_middle_name || ''} ${b.mother_surname}</td>
                    <td class="border p-2">${formatDate(b.baptism_date)}</td>
                    <td class="border p-2">${b.pastor}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Load baptisms error:', err);
        if (baptismList) baptismList.innerHTML = `<tr><td colspan="8">Error: ${err.message}</td></tr>`;
    }
}

// Handle search input
if (searchInput) {
    searchInput.addEventListener('input', () => loadBaptisms());
}