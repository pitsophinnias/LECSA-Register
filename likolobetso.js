// Global variables
let currentUser = null;
let currentBaptisms = [];

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Baptisms page loaded, checking authentication...');
    
    // Check authentication
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    
    if (!token || !user || !role) {
        console.log('No valid authentication found, redirecting to login');
        showNotification('Please log in to access this page', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        console.log('Authenticated as:', currentUser.username);
        
        // Initialize the page
        initializeBaptismsPage();
        
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        showNotification('Session expired, please log in again', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
});

function initializeBaptismsPage() {
    console.log('Initializing Baptisms page for user:', currentUser.username);
    
    // Get DOM elements
    const baptismForm = document.getElementById('baptismForm');
    const searchInput = document.getElementById('searchInput');
    
    // Set up form submission
    if (baptismForm && currentUser.role !== 'board_member') {
        baptismForm.addEventListener('submit', handleBaptismSubmit);
    } else if (baptismForm) {
        // Disable form for board members
        baptismForm.querySelectorAll('input, button').forEach(element => {
            element.disabled = true;
        });
        baptismForm.querySelector('button').textContent = 'Add Baptism (Read Only)';
    }
    
    // Set up search
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            const searchTerm = searchInput.value.trim();
            loadBaptisms(searchTerm);
        }, 300));
    }
    
    // Setup sidebar
    setupSidebar();
    
    // Initial load of baptisms
    loadBaptisms();
}

function setupSidebar() {
    const toggleButton = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const menuClose = document.getElementById('menuClose');
    const logoutLink = document.getElementById('logoutLink');

    if (toggleButton && sidebar && content) {
        toggleButton.addEventListener('click', function() {
            sidebar.classList.toggle('open');
            content.classList.toggle('shift');
        });
    }

    if (menuClose) {
        menuClose.addEventListener('click', function() {
            sidebar.classList.remove('open');
            content.classList.remove('shift');
        });
    }

    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    showNotification('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
}

async function handleBaptismSubmit(event) {
    event.preventDefault();
    console.log('Handling baptism form submission');
    
    const form = document.getElementById('baptismForm');
    if (!form) {
        console.error('Baptism form not found');
        return;
    }
    
    const formData = new FormData(form);
    const baptismData = {
        first_name: formData.get('first_name').trim(),
        middle_name: formData.get('middle_name').trim(),
        surname: formData.get('surname').trim(),
        date_of_birth: formData.get('date_of_birth'),
        father_first_name: formData.get('father_first_name').trim(),
        father_middle_name: formData.get('father_middle_name').trim(),
        father_surname: formData.get('father_surname').trim(),
        mother_first_name: formData.get('mother_first_name').trim(),
        mother_middle_name: formData.get('mother_middle_name').trim(),
        mother_surname: formData.get('mother_surname').trim(),
        baptism_date: formData.get('baptism_date'),
        pastor: formData.get('pastor').trim()
    };

    // Validate required fields
    const requiredFields = [
        'first_name', 'surname', 'date_of_birth', 'baptism_date', 'pastor',
        'father_first_name', 'father_surname', 'mother_first_name', 'mother_surname'
    ];
    
    const emptyFields = requiredFields.filter(field => !baptismData[field] || baptismData[field].toString().trim() === '');
    if (emptyFields.length > 0) {
        showNotification(`Please fill in all required fields: ${emptyFields.join(', ')}`, 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Session expired, please log in again', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }
        
        const response = await fetch('/api/baptisms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(baptismData)
        });
        
        console.log('Baptism submission response:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to add baptism: ${response.statusText}`);
        }
        
        const result = await response.json();
        showNotification(result.message || 'Baptism recorded successfully!', 'success');
        form.reset();
        loadBaptisms();
        
    } catch (err) {
        console.error('Baptism submission error:', err);
        showNotification(`Error: ${err.message}`, 'error');
    }
}

async function loadBaptisms(search = '') {
    console.log('Loading baptisms with search:', search);
    
    const baptismList = document.getElementById('baptismList');
    if (!baptismList) return;
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Please log in to view baptisms');
        }
        
        const url = search ? `/api/baptisms?search=${encodeURIComponent(search)}` : '/api/baptisms';
        const response = await fetch(url, {
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
            throw new Error(errorData.error || 'Failed to fetch baptisms');
        }
        
        const baptisms = await response.json();
        console.log('Fetched baptisms:', baptisms.length);
        currentBaptisms = baptisms; // Store for click events
        
        if (!Array.isArray(baptisms)) {
            throw new Error('Invalid server response format');
        }

        if (baptisms.length === 0) {
            baptismList.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 20px; color: #666;">
                        No baptism records found ${search ? 'for your search' : ''}
                    </td>
                </tr>
            `;
            return;
        }

        baptismList.innerHTML = baptisms.map((b, index) => {
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
            
            // Create a unique ID for each row
            const rowId = `baptism-row-${b.id || index}`;
            
            return `
                <tr id="${rowId}" data-baptism-id="${b.id}" 
                    style="cursor: pointer; transition: background-color 0.2s;"
                    onmouseover="this.style.backgroundColor='#f5f5f5'" 
                    onmouseout="this.style.backgroundColor='transparent'"
                    onclick="showBaptismDetails(${JSON.stringify(b).replace(/"/g, '&quot;')})">
                    <td>${b.first_name || 'Unknown'}</td>
                    <td>${b.middle_name || ''}</td>
                    <td>${b.surname || 'Unknown'}</td>
                    <td>${formatDate(b.date_of_birth)}</td>
                    <td>${b.father_first_name || ''} ${b.father_middle_name || ''} ${b.father_surname || ''}</td>
                    <td>${b.mother_first_name || ''} ${b.mother_middle_name || ''} ${b.mother_surname || ''}</td>
                    <td>${formatDate(b.baptism_date)}</td>
                    <td>${b.pastor || 'Unknown'}</td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Load baptisms error:', err);
        
        if (err.message.includes('Session expired') || err.message.includes('Please log in')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            showNotification(err.message, 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }
        
        baptismList.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 20px; color: #dc3545;">
                    Error: ${err.message}
                </td>
            </tr>
        `;
    }
}

// Show baptism details modal
function showBaptismDetails(baptism) {
    // Remove any existing modals
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    };
    
    // Calculate age at baptism
    const calculateAge = () => {
        if (!baptism.date_of_birth || !baptism.baptism_date) return 'N/A';
        try {
            const birthDate = new Date(baptism.date_of_birth);
            const baptismDate = new Date(baptism.baptism_date);
            const ageInMs = baptismDate - birthDate;
            const ageInYears = Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365.25));
            const ageInMonths = Math.floor((ageInMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
            return `${ageInYears} years, ${ageInMonths} months`;
        } catch (e) {
            return 'Unknown';
        }
    };
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.3s ease-out;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.3s ease-out;
    `;
    
    modal.innerHTML = `
        <h2 style="color: #333; margin-top: 0; padding-bottom: 15px; border-bottom: 2px solid #c19a6b;">
            <i class="fas fa-water" style="margin-right: 10px;"></i>
            Baptism Details
        </h2>
        
        <div style="margin-bottom: 20px;">
            <h3 style="color: #2c3e50; margin-bottom: 15px;">
                ${baptism.first_name || ''} ${baptism.middle_name || ''} ${baptism.surname || ''}
            </h3>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 25px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3498db;">
                <h4 style="color: #3498db; margin-top: 0; margin-bottom: 10px;">
                    <i class="fas fa-user" style="margin-right: 8px;"></i>Child Information
                </h4>
                <p style="margin: 5px 0;"><strong>Full Name:</strong> ${baptism.first_name || ''} ${baptism.middle_name || ''} ${baptism.surname || ''}</p>
                <p style="margin: 5px 0;"><strong>Date of Birth:</strong> ${formatDate(baptism.date_of_birth)}</p>
                <p style="margin: 5px 0;"><strong>Baptism Date:</strong> ${formatDate(baptism.baptism_date)}</p>
                <p style="margin: 5px 0;"><strong>Age at Baptism:</strong> ${calculateAge()}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #2ecc71;">
                <h4 style="color: #2ecc71; margin-top: 0; margin-bottom: 10px;">
                    <i class="fas fa-male" style="margin-right: 8px;"></i>Father's Information
                </h4>
                <p style="margin: 5px 0;"><strong>Full Name:</strong> ${baptism.father_first_name || ''} ${baptism.father_middle_name || ''} ${baptism.father_surname || ''}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #9b59b6;">
                <h4 style="color: #9b59b6; margin-top: 0; margin-bottom: 10px;">
                    <i class="fas fa-female" style="margin-right: 8px;"></i>Mother's Information
                </h4>
                <p style="margin: 5px 0;"><strong>Full Name:</strong> ${baptism.mother_first_name || ''} ${baptism.mother_middle_name || ''} ${baptism.mother_surname || ''}</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #e74c3c;">
                <h4 style="color: #e74c3c; margin-top: 0; margin-bottom: 10px;">
                    <i class="fas fa-church" style="margin-right: 8px;"></i>Baptism Details
                </h4>
                <p style="margin: 5px 0;"><strong>Officiating Pastor:</strong> ${baptism.pastor || 'Unknown'}</p>
                <p style="margin: 5px 0;"><strong>Baptism Record ID:</strong> ${baptism.id || 'N/A'}</p>
                ${baptism.archived ? '<p style="margin: 5px 0; color: #f39c12;"><strong>Status:</strong> Archived</p>' : ''}
            </div>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <button id="printDetails" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-print" style="margin-right: 8px;"></i>Print
            </button>
            <button id="closeDetails" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-times" style="margin-right: 8px;"></i>Close
            </button>
        </div>
    `;
    
    // Add animation styles
    if (!document.querySelector('#modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideDown {
                from { transform: translateY(-50px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Append to document
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('#closeDetails').addEventListener('click', () => {
        modal.remove();
        overlay.remove();
    });
    
    // Print functionality
    modal.querySelector('#printDetails').addEventListener('click', () => {
        const printContent = `
            <html>
                <head>
                    <title>Baptism Certificate - ${baptism.first_name} ${baptism.surname}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .certificate { border: 2px solid #000; padding: 30px; max-width: 800px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .header h1 { color: #2c3e50; }
                        .content { margin: 20px 0; }
                        .section { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
                        .footer { margin-top: 40px; text-align: center; font-style: italic; color: #666; }
                        .signature { margin-top: 50px; text-align: right; }
                        @media print {
                            body { margin: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="certificate">
                        <div class="header">
                            <h1>BAPTISM CERTIFICATE</h1>
                            <h3>LECSA Church</h3>
                        </div>
                        <div class="content">
                            <div class="section">
                                <h3>Child's Information</h3>
                                <p><strong>Full Name:</strong> ${baptism.first_name} ${baptism.middle_name || ''} ${baptism.surname}</p>
                                <p><strong>Date of Birth:</strong> ${formatDate(baptism.date_of_birth)}</p>
                                <p><strong>Baptism Date:</strong> ${formatDate(baptism.baptism_date)}</p>
                                <p><strong>Age at Baptism:</strong> ${calculateAge()}</p>
                            </div>
                            <div class="section">
                                <h3>Parents' Information</h3>
                                <p><strong>Father:</strong> ${baptism.father_first_name} ${baptism.father_middle_name || ''} ${baptism.father_surname}</p>
                                <p><strong>Mother:</strong> ${baptism.mother_first_name} ${baptism.mother_middle_name || ''} ${baptism.mother_surname}</p>
                            </div>
                            <div class="section">
                                <h3>Baptism Details</h3>
                                <p><strong>Officiating Pastor:</strong> ${baptism.pastor}</p>
                                <p><strong>Record ID:</strong> ${baptism.id}</p>
                            </div>
                        </div>
                        <div class="signature">
                            <p>_________________________</p>
                            <p><strong>Pastor:</strong> ${baptism.pastor}</p>
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                        <div class="footer">
                            <p>This certifies that the above baptism was recorded in the LECSA Church Registry</p>
                        </div>
                    </div>
                    <div class="no-print" style="text-align: center; margin-top: 20px;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Print Certificate
                        </button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                            Close
                        </button>
                    </div>
                </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
    });
    
    // Close when clicking overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            modal.remove();
            overlay.remove();
        }
    });
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        z-index: 1000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set color based on type
    if (type === 'success') {
        notification.style.background = '#2ecc71';
    } else if (type === 'error') {
        notification.style.background = '#e74c3c';
    } else if (type === 'warning') {
        notification.style.background = '#f39c12';
    } else {
        notification.style.background = '#3498db';
    }
    
    notification.innerHTML = `
        ${message}
        <span style="margin-left: 10px; cursor: pointer; font-weight: bold;" 
              onclick="this.parentElement.remove()">&times;</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
    
    // Add CSS animation for notifications if not exists
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}