// js/metrics.js

let metricsChart = null;

function toggleMetricsInput() {
    const layout = document.getElementById('metricsLayout');
    const panel = document.getElementById('metricsInputPanel');
    
    if (panel.classList.contains('hidden')) {
        // Show it
        panel.classList.remove('hidden');
        layout.classList.remove('expanded-graph');
    } else {
        // Hide it
        panel.classList.add('hidden');
        layout.classList.add('expanded-graph');
    }
    
    // Trigger resize for Chart.js
    if (metricsChart) {
        setTimeout(() => metricsChart.resize(), 310);
    }
}

// 1. LEGACY MANUAL INPUT (Kept for backwards compatibility)
function generateMetricsGraph() {
    const rawInput = document.getElementById('metricsInput').value;
    if (!rawInput) return alert("Please paste your statement data first or use 'Load from Accounts DB'.");

    // ... (Keep existing parsing logic if you want manual override options) ...
    // For now, alerting user to use the new button is safer to avoid confusion
    alert("Use the 'Load Graph from My Accounts' button above for automatic tracking.");
}

// 2. NEW AUTOMATIC DB GRAPHING
async function generateMetricsGraphFromDB() {
    if(!window.currentUser) return alert("Please log in.");

    try {
        // Fetch all accounts owned by user
        const snap = await db.collection('accounts')
            .where('owner', '==', window.currentUser.email)
            .get();

        if (snap.empty) return alert("No accounts found to graph.");

        const accounts = [];
        snap.forEach(doc => accounts.push(doc.data()));

        // We will graph the LAST 12 months + NEXT 6 months
        const now = new Date();
        const labels = [];
        const dataPoints = [];

        // Loop from -12 months to +6 months
        for (let i = -12; i <= 6; i++) {
            // Set date to the 1st of the target month
            const date = new Date(now.getFullYear(), now.getMonth() + i, 1);

            // Format Label: "Nov 25"
            const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            labels.push(label);

            // Calculate active revenue for this specific month
            let monthlyTotal = 0;

            accounts.forEach(acc => {
                if(!acc.startDate) return; // Skip accounts with no start date

                const start = new Date(acc.startDate);
                // If no end date, assume active forever (year 9999)
                const end = acc.endDate ? new Date(acc.endDate) : new Date(9999, 11, 31);

                // Logic: Was the account active on the 1st of this month?
                // Start Date must be <= This Month
                // End Date must be >= This Month
                if (start <= date && end >= date) {
                    monthlyTotal += (acc.revenue || 0);
                }
            });

            dataPoints.push(monthlyTotal);
        }

        renderChart(labels, dataPoints);

        // Automatically expand the graph view for better visibility
        document.getElementById('metricsInputPanel').classList.add('hidden');
        document.getElementById('metricsLayout').classList.add('expanded-graph');

    } catch (e) {
        console.error(e);
        alert("Error generating graph: " + e.message);
    }
}

function renderChart(labels, data) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    if (metricsChart) metricsChart.destroy();

    // Stats Calculation
    const total = data[data.length - 1]; // Use the last projected month as "Total" or current?
                                         // Usually index 12 (current month) is best, but let's show latest projection.
    const max = Math.max(...data);
    const avg = data.reduce((a,b)=>a+b,0) / data.length;

    document.getElementById('metricsStats').style.display = 'flex';
    document.getElementById('statTotal').textContent = '$' + data[12].toLocaleString(); // Show Current Month Value (Index 12 is 'now')
    document.getElementById('statHigh').textContent = '$' + max.toLocaleString();
    document.getElementById('statAvg').textContent = '$' + avg.toLocaleString(undefined,{maximumFractionDigits:0});

    metricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Recurring Revenue ($)',
                data: data,
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13, 148, 136, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#0d9488',
                pointRadius: 5,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' Revenue: ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6' },
                    ticks: { callback: function(value) { return '$' + value.toLocaleString(); } }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function clearMetrics() {
    document.getElementById('metricsInput').value = '';
    // Show input again
    document.getElementById('metricsInputPanel').classList.remove('hidden');
    document.getElementById('metricsLayout').classList.remove('expanded-graph');

    if (metricsChart) metricsChart.destroy();
    document.getElementById('metricsStats').style.display = 'none';
}

// Exports
window.toggleMetricsInput = toggleMetricsInput;
window.generateMetricsGraph = generateMetricsGraph;
window.generateMetricsGraphFromDB = generateMetricsGraphFromDB;
window.clearMetrics = clearMetrics;