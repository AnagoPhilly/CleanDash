// js/payroll.js

// --- GLOBALS ---
let payrollStart = new Date();
let payrollEnd = new Date();
let currentPayrollExport = [];

// --- MAIN LOAD FUNCTION ---
async function loadPayroll() {
    console.log("CleanDash: Loading Payroll...");
    const container = document.getElementById('payrollTableContainer');
    const totalDisplay = document.getElementById('totalPayrollCost');

    if (container) container.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">Calculating hours and wages...</div>';

    // Sync Date Inputs (In case they were empty)
    const startInput = document.getElementById('payStart');
    const endInput = document.getElementById('payEnd');

    if (startInput && !startInput.value) startInput.valueAsDate = payrollStart;
    if (endInput && !endInput.value) endInput.valueAsDate = payrollEnd;

    // Ensure globals match inputs exactly
    if (startInput) payrollStart = new Date(startInput.value + 'T00:00:00');
    if (endInput) payrollEnd = new Date(endInput.value + 'T23:59:59');

    if (!window.currentUser) {
        console.log("CleanDash: Waiting for user login...");
        return;
    }

    try {
        const ownerEmail = window.currentUser.email;
        currentPayrollExport = []; // Reset export data

        // 1. Fetch Employees
        const empSnap = await db.collection('employees').where('owner', '==', ownerEmail).get();
        const employees = {};
        empSnap.forEach(doc => {
            employees[doc.id] = { ...doc.data(), hours: 0, shifts: 0, totalPay: 0, jobList: [] };
        });

        // 2. Fetch Completed Jobs
        const jobsSnap = await db.collection('jobs')
            .where('owner', '==', ownerEmail)
            .where('status', '==', 'Completed')
            .get();

        let grandTotal = 0;

        jobsSnap.forEach(doc => {
            const job = doc.data();

            // Fallback Logic: Actual vs Scheduled
            let start = job.actualStartTime ? job.actualStartTime.toDate() : (job.startTime ? job.startTime.toDate() : null);
            let end = job.actualEndTime ? job.actualEndTime.toDate() : (job.endTime ? job.endTime.toDate() : null);

            const isEstimated = (!job.actualStartTime || !job.actualEndTime);

            // Filter by Date Range
            if (start && end && start >= payrollStart && end <= payrollEnd) {
                if (employees[job.employeeId]) {
                    const diffMs = end - start;
                    const hours = diffMs / (1000 * 60 * 60);

                    if (hours > 0) {
                        employees[job.employeeId].shifts++;
                        employees[job.employeeId].hours += hours;

                        const wage = employees[job.employeeId].wage || 0;
                        employees[job.employeeId].totalPay += (hours * wage);

                        employees[job.employeeId].jobList.push({
                            date: start.toLocaleDateString(),
                            site: job.accountName || 'Unknown Site',
                            hours: hours.toFixed(2),
                            isEst: isEstimated
                        });

                        grandTotal += (hours * wage);
                    }
                }
            }
        });

        if (totalDisplay) totalDisplay.textContent = window.formatMoney(grandTotal);

        // 3. Build Table Rows
        const empIds = Object.keys(employees).sort();
        let html = '';

        empIds.forEach(id => {
            const e = employees[id];

            const rowId = `row-${id}`;
            const detailId = `detail-${id}`;
            const wage = e.wage || 0;

            if (e.shifts > 0) {
                currentPayrollExport.push({
                    name: e.name,
                    role: e.role,
                    shifts: e.shifts,
                    hours: e.hours.toFixed(2),
                    wage: wage.toFixed(2),
                    total: e.totalPay.toFixed(2)
                });
            }

            html += `
            <div class="payroll-row" id="${rowId}" onclick="togglePayrollRow('${id}')" style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding:15px; align-items:center;">
                <div style="font-weight:600; display:flex; align-items:center;">
                    <span class="payroll-arrow">▶</span>
                    <div>
                        <div>${e.name}</div>
                        <div style="font-size:0.8rem; color:#6b7280; font-weight:400;">${e.role}</div>
                    </div>
                </div>
                <div style="text-align:center;">
                    <div style="font-weight:bold;">${e.shifts}</div>
                    <div style="font-size:0.75rem; color:#9ca3af;">Shifts</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-weight:bold;">${e.hours.toFixed(2)}</div>
                    <div style="font-size:0.75rem; color:#9ca3af;">Hours</div>
                </div>
                <div style="text-align:right; color:#0d9488; font-weight:700;">
                    ${window.formatMoney(e.totalPay)}
                </div>
            </div>

            <div class="detail-row" id="${detailId}" style="display:none; background:#f8fafc; border-bottom:1px solid #e5e7eb;">
                <div style="padding:15px 15px 15px 40px; grid-column: 1 / -1;">
                    <table class="detail-table" style="width:100%; font-size:0.85rem; border:1px solid #e2e8f0; background:white; border-radius:6px;">
                        <thead style="background:#f1f5f9;">
                            <tr>
                                <th style="padding:8px; text-align:left;">Date</th>
                                <th style="padding:8px; text-align:left;">Location</th>
                                <th style="padding:8px; text-align:right;">Hours</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${e.jobList.length === 0 ? '<tr><td colspan="3" style="padding:10px; text-align:center; color:#999;">No completed shifts in this range.</td></tr>' : ''}
                            ${e.jobList.map(j => `
                                <tr>
                                    <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${j.date}</td>
                                    <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${j.site}</td>
                                    <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right;">
                                        ${j.hours}
                                        ${j.isEst ? '<span title="Estimated (Not clocked in)" style="color:#f59e0b; cursor:help;">⚠</span>' : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            `;
        });

        if (container) container.innerHTML = html || '<div style="text-align:center; padding:3rem; color:#6b7280;">No employees found.</div>';

    } catch (e) {
        console.error("Payroll Error:", e);
        if (container) container.innerHTML = '<div style="color:red; text-align:center;">Error loading payroll data.</div>';
    }
}

// --- CSV EXPORT ---
window.exportPayrollCSV = function() {
    if (currentPayrollExport.length === 0) return alert("No data to export.");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Employee Name,Role,Shifts,Total Hours,Hourly Wage,Total Pay\n";

    currentPayrollExport.forEach(row => {
        csvContent += `"${row.name}","${row.role}",${row.shifts},${row.hours},${row.wage},${row.total}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);

    const s = payrollStart.toISOString().split('T')[0];
    const e = payrollEnd.toISOString().split('T')[0];
    link.setAttribute("download", `Payroll_${s}_to_${e}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- UI TOGGLE ---
window.togglePayrollRow = function(id) {
    const detailRow = document.getElementById(`detail-${id}`);
    const arrow = document.querySelector(`#row-${id} .payroll-arrow`);

    if (detailRow.style.display === 'none') {
        detailRow.style.display = 'block';
        if(arrow) arrow.style.transform = 'rotate(90deg)';
    } else {
        detailRow.style.display = 'none';
        if(arrow) arrow.style.transform = 'rotate(0deg)';
    }
};

// --- MANUAL DATE UPDATE ---
window.updatePayrollDates = function() {
    const startVal = document.getElementById('payStart').value;
    const endVal = document.getElementById('payEnd').value;

    if(startVal) payrollStart = new Date(startVal + 'T00:00:00');
    if(endVal) payrollEnd = new Date(endVal + 'T23:59:59');

    updateActiveButton('custom'); // Highlight that we are in custom mode
    loadPayroll();
};

// --- [NEW] ARROW NAVIGATION LOGIC ---
window.changePayrollWeek = function(direction) {
    // direction: -1 (Previous) or 1 (Next)

    // 1. Get current start date
    let currentStart = new Date(payrollStart);

    // 2. Add/Subtract 7 Days
    currentStart.setDate(currentStart.getDate() + (7 * direction));

    // 3. Set the new End Date (Start + 6 days)
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + 6);

    // 4. Update Globals
    payrollStart = currentStart;
    payrollEnd = currentEnd;

    // 5. Update DOM Inputs
    const sInput = document.getElementById('payStart');
    const eInput = document.getElementById('payEnd');

    if (sInput) sInput.value = currentStart.toISOString().split('T')[0];
    if (eInput) eInput.value = currentEnd.toISOString().split('T')[0];

    // 6. Refresh Data
    // We clear the active button because we are manually moving away from "Current Week"
    updateActiveButton('');
    loadPayroll();
};

// --- DATE RANGE CALCULATOR (Monday Start) ---
window.setPayrollRange = function(rangeType) {
    const today = new Date();
    today.setHours(0,0,0,0);

    let start = new Date(today);
    let end = new Date(today);

    if (rangeType === 'currentWeek') {
        // Monday (1) to Sunday (0) Logic
        const currentDay = today.getDay(); // 0=Sun, 1=Mon...
        // Calculate distance back to Monday
        const distToMonday = currentDay === 0 ? 6 : currentDay - 1;

        start.setDate(today.getDate() - distToMonday);
        end = new Date(start);
        end.setDate(start.getDate() + 6); // End is start + 6 days

    } else if (rangeType === 'previousWeek') {
        const currentDay = today.getDay();
        const distToMonday = currentDay === 0 ? 6 : currentDay - 1;

        // Go to this week's Monday, then back 7 more days
        start.setDate(today.getDate() - distToMonday - 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);

    } else if (rangeType === 'previousMonth') {
        // 1st of previous month
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        // Last day of previous month
        end.setDate(0);
    }

    // Update Globals
    payrollStart = start;
    payrollEnd = end;

    // Update DOM Inputs
    const sInput = document.getElementById('payStart');
    const eInput = document.getElementById('payEnd');

    if (sInput) sInput.value = start.toISOString().split('T')[0];
    if (eInput) eInput.value = end.toISOString().split('T')[0];

    // Visual Feedback
    updateActiveButton(rangeType);

    // Refresh Data
    loadPayroll();
};

// Helper: Highlight the active filter button
function updateActiveButton(activeId) {
    // Reset all buttons (add class 'range-btn' to your HTML buttons)
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.style.background = 'white';
        btn.style.color = '#374151';
        btn.style.borderColor = '#d1d5db';
    });

    // Highlight active
    const activeBtn = document.getElementById(`btn-${activeId}`);
    if (activeBtn) {
        activeBtn.style.background = '#e0f2fe'; // Light blue highlight
        activeBtn.style.color = '#0284c7';
        activeBtn.style.borderColor = '#0284c7';
    }
}

// --- INIT ON LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    // Default to Current Week
    setPayrollRange('currentWeek');
});

// Expose globally
window.loadPayroll = loadPayroll;