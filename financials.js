// Wait for the DOM to be fully loaded before executing
document.addEventListener('DOMContentLoaded', function() {
    // Select DOM elements for form, tables, and tab buttons
    const financialForm = document.getElementById('financialForm');
    const tables = {
        weekly: document.getElementById('weeklyTable')?.querySelector('tbody'),
        monthly: document.getElementById('monthlyTable')?.querySelector('tbody'),
        quarterly: document.getElementById('quarterlyTable')?.querySelector('tbody'),
        yearly: document.getElementById('yearlyTable')?.querySelector('tbody')
    };
    const tabButtons = document.querySelectorAll('.tab-button');

    // Validate DOM elements
    if (!financialForm) {
        console.error('Missing financialForm element');
        alert('Error: Form not found on the page');
        return;
    }
    for (const [period, table] of Object.entries(tables)) {
        if (!table) {
            console.error(`Missing ${period}Table tbody element`);
            return;
        }
    }

    // Handle form submission for recording transactions
    financialForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to continue');
            window.location.href = 'login.html';
            return;
        }

        // Build transaction object from form inputs
        const transaction = {
            date: document.getElementById('transactionDate').value,
            description: document.getElementById('description').value,
            category: document.getElementById('category').value,
            amount: parseFloat(document.getElementById('amount').value)
        };

        // Validate form inputs
        if (!transaction.date || !transaction.description || !transaction.category || isNaN(transaction.amount)) {
            console.error('Invalid form data:', transaction);
            alert('Please fill all fields with valid data');
            return;
        }

        try {
            // Send POST request to record transaction
            const response = await fetch('/api/financials', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transaction)
            });

            // Check for HTTP errors
            if (!response.ok) {
                const text = await response.text();
                console.error('Failed to record transaction:', { status: response.status, text: text });
                throw new Error('HTTP ' + response.status + ': ' + text);
            }

            console.log('Transaction recorded:', transaction);
            alert('Transaction recorded successfully');
            financialForm.reset();
            // Refresh relevant tables based on transaction date
            const transactionDate = new Date(transaction.date);
            const currentDate = new Date();
            const intervals = {
                weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
                monthly: 30 * 24 * 60 * 60 * 1000, // 30 days
                quarterly: 90 * 24 * 60 * 60 * 1000, // 90 days
                yearly: 365 * 24 * 60 * 60 * 1000 // 365 days
            };
            for (const period of Object.keys(tables)) {
                if (currentDate - transactionDate <= intervals[period]) {
                    fetchTransactions(period);
                }
            }
        } catch (error) {
            console.error('Error recording transaction:', error);
            alert('Failed to record transaction: ' + error.message);
        }
    });

    // Initialize tab-switching functionality
    function initializeTabSwitching() {
        // Set up tab-switching event listeners
        tabButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                // Remove active class from all tabs and content
                tabButtons.forEach(function(btn) { btn.classList.remove('active'); });
                document.querySelectorAll('.report-content').forEach(function(content) { content.classList.remove('active'); });

                // Activate the clicked tab and its content
                button.classList.add('active');
                const reportId = button.dataset.tab + 'Report';
                const reportElement = document.getElementById(reportId);
                if (reportElement) {
                    reportElement.classList.add('active');
                    fetchTransactions(button.dataset.tab);
                } else {
                    console.error('Report element not found: ' + reportId);
                }
            });
        });
    }

    // Fetch and display transactions for a given period
    async function fetchTransactions(period) {
        const tableBody = tables[period];
        if (!tableBody) {
            console.error(`No table body for period: ${period}`);
            return;
        }

        try {
            // Retrieve JWT token from localStorage
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No token found, please log in');
            }

            // Make API request to fetch transactions for the period
            const response = await fetch(`/api/financials?period=${period}`, {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            // Check for HTTP errors
            if (!response.ok) {
                const text = await response.text();
                console.error(`Failed to fetch ${period} transactions:`, { status: response.status, text: text });
                throw new Error('HTTP ' + response.status + ': ' + text);
            }

            // Parse transactions or aggregates
            const data = await response.json();
            console.log(`${period} transactions fetched:`, data);
            tableBody.innerHTML = ''; // Clear existing table content

            // Handle empty data
            if (data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="${period === 'weekly' ? 4 : 4}">No ${period} data found</td></tr>`;
                return;
            }

            // Check if data is individual transactions (weekly) or aggregates (monthly, quarterly, yearly)
            if (period === 'weekly') {
                // Populate weekly table with individual transactions
                data.forEach(function(transaction) {
                    const amount = parseFloat(transaction.amount);
                    if (isNaN(amount)) {
                        console.warn(`Invalid amount in ${period} transaction:`, transaction);
                        return;
                    }
                    const row = document.createElement('tr');
                    row.innerHTML = '<td>' + new Date(transaction.date).toLocaleDateString() + '</td>' +
                                    '<td>' + transaction.description + '</td>' +
                                    '<td>' + transaction.category + '</td>' +
                                    '<td>LSL ' + amount.toFixed(2) + '</td>';
                    tableBody.appendChild(row);
                });
            } else {
                // Populate monthly, quarterly, yearly tables with aggregated data
                data.forEach(function(aggregate) {
                    const income = parseFloat(aggregate.income);
                    const expenses = parseFloat(aggregate.expenses);
                    const balance = parseFloat(aggregate.balance);
                    if (isNaN(income) || isNaN(expenses) || isNaN(balance)) {
                        console.warn(`Invalid values in ${period} aggregate:`, aggregate);
                        return;
                    }
                    const periodLabel = period === 'monthly' ? aggregate.month :
                                       period === 'quarterly' ? aggregate.quarter :
                                       aggregate.year;
                    const row = document.createElement('tr');
                    row.innerHTML = '<td>' + periodLabel + '</td>' +
                                    '<td>LSL ' + income.toFixed(2) + '</td>' +
                                    '<td>LSL ' + expenses.toFixed(2) + '</td>' +
                                    '<td>LSL ' + balance.toFixed(2) + '</td>';
                    tableBody.appendChild(row);
                });
            }
        } catch (error) {
            console.error(`Error fetching ${period} transactions:`, error);
            tableBody.innerHTML = `<tr><td colspan="${period === 'weekly' ? 4 : 4}">Failed to load ${period} data: ${error.message}</td></tr>`;
        }
    }

    // Initialize tab switching and fetch weekly transactions
    initializeTabSwitching();
    fetchTransactions('weekly');
});