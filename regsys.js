async function fetchRecentActivities() {
    const recentMember = document.getElementById('recentMember');
    const recentBaptism = document.getElementById('recentBaptism');
    const recentWedding = document.getElementById('recentWedding');
    if (!recentMember || !recentBaptism || !recentWedding) {
        console.error('Recent activity elements not found', {
            recentMember: !!recentMember,
            recentBaptism: !!recentBaptism,
            recentWedding: !!recentWedding
        });
        return;
    }
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Please log in to continue');

        const memberResponse = await fetch('/api/members?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!memberResponse.ok) {
            const text = await memberResponse.text();
            console.error('Fetch members failed:', { status: memberResponse.status, text });
            throw new Error(`Failed to fetch members: HTTP ${memberResponse.status}`);
        }
        const members = await memberResponse.json();
        recentMember.textContent = members.length > 0
            ? `${members[0].lebitso} ${members[0].fane} (Palo: ${members[0].palo})`
            : 'No members registered';

        const baptismResponse = await fetch('/api/baptisms?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!baptismResponse.ok) {
            const text = await baptismResponse.text();
            console.error('Fetch baptisms failed:', { status: baptismResponse.status, text });
            throw new Error(`Failed to fetch baptisms: HTTP ${baptismResponse.status}`);
        }
        const baptisms = await baptismResponse.json();
        recentBaptism.textContent = baptisms.length > 0
            ? `${baptisms[0].first_name} ${baptisms[0].surname} on ${new Date(baptisms[0].baptism_date).toLocaleDateString()}`
            : 'No baptisms recorded';

        const weddingResponse = await fetch('/api/weddings?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!weddingResponse.ok) {
            const text = await weddingResponse.text();
            console.error('Fetch weddings failed:', { status: weddingResponse.status, text });
            throw new Error(`Failed to fetch weddings: HTTP ${weddingResponse.status}`);
        }
        const weddings = await weddingResponse.json();
        recentWedding.textContent = weddings.length > 0
            ? `${weddings[0].groom_first_name} & ${weddings[0].bride_first_name} on ${new Date(weddings[0].wedding_date).toLocaleDateString()}`
            : 'No weddings recorded';
    } catch (err) {
        console.error('Fetch activities error:', err);
        recentMember.textContent = `Failed to load member data: ${err.message}`;
        recentBaptism.textContent = `Failed to load baptism data: ${err.message}`;
        recentWedding.textContent = `Failed to load wedding data: ${err.message}`;
    }
}

function logout() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = 'login.html';
    } catch (err) {
        console.error('Logout error:', err);
        alert('Error logging out: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    if (['pastor', 'secretary'].includes(localStorage.getItem('role'))) {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'block';
    }
    fetchRecentActivities();
    const toggleButton = document.getElementById('toggleSidebar');
    const logoutLink = document.getElementById('logoutLink');
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
});