// js/payroll.js

let payrollStart = new Date();
payrollStart.setDate(1);
payrollStart.setHours(0,0,0,0);

let payrollEnd = new Date();
payrollEnd.setHours(23,59,59,999);

// Store data for export
let currentPayrollExport = [];

async function loadPayroll() {
    console.log("CleanDash: Loading Payroll...");
    const container = document.getElementById('payrollTableContainer');
    const totalDisplay = document.getElementById('totalPayrollCost');

    container.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">Calculating hours and wages...</div>';

    document.getElementById('payStart').valueAsDate = payrollStart;
    document.getElementById('payEnd').valueAsDate = payrollEnd;

    if (!window.currentUser) return;

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
            const jobEnd = job.actualEndTime.toDate();

            if (jobEnd >= payrollStart && jobEnd <= payrollEnd) {
                const empId = job.employeeId;
                if (employees[empId]) {
                    const start = job.actualStartTime.toDate();
                    const end = job.actualEndTime.toDate();

                    const durationHrs = (end - start) / (1000 * 60 * 60);
                    const wage = employees[empId].wage || 0;
                    const pay = durationHrs * wage;

                    employees[empId].hours += durationHrs;
                    employees[empId].shifts += 1;
                    employees[empId].totalPay += pay;
                    grandTotal += pay;

                    employees[empId].jobList.push({
                        date: start.toLocaleDateString(),
                        time: `${formatTime(start)} - ${formatTime(end)}`,
                        account: job.accountName,
                        hours: durationHrs,
                        pay: pay
                    });
                }
            }
        });

        // 3. Render Table
        let html = `<table class="data-table">
            <thead>
                <tr>
                    <th style="width:40px;"></th>
                    <th>Employee</th>
                    <th style="text-align:center;">Shifts</th>
                    <th style="text-align:right;">Total Hours</th>
                    <th style="text-align:right;">Gross Pay</th>
                </tr>
            </thead>
            <tbody>`;

        const sortedIds = Object.keys(employees).sort((a,b) => employees[a].name.localeCompare(employees[b].name));

        sortedIds.forEach(id => {
            const e = employees[id];

            if (e.shifts > 0 || e.status === 'Active') {
                // Add to export list
                currentPayrollExport.push({
                    name: e.name,
                    role: e.role,
                    shifts: e.shifts,
                    hours: e.hours.toFixed(2),
                    wage: e.wage.toFixed(2),
                    total: e.totalPay.toFixed(2)
                });

                const rowStyle = e.shifts === 0 ? 'color:#6b7280;' : 'font-weight:600; color:#111827;';
                const payStyle = e.shifts === 0 ? 'color:#9ca3af;' : 'color:#0d9488; font-weight:700;';
                const cursorStyle = e.shifts > 0 ? 'cursor:pointer;' : 'cursor:default;';
                const onclick = e.shifts > 0 ? `onclick="togglePayrollRow('${id}')"` : '';
                const arrow = e.shifts > 0 ? `<span class="payroll-arrow" id="arrow-${id}">▶</span>` : '';

                html += `<tr class="payroll-row" id="row-${id}" ${onclick} style="${cursorStyle} ${rowStyle}">
                    <td style="text-align:center;">${arrow}</td>
                    <td>
                        <div>${e.name}</div>
                        <div style="font-size:0.8rem; opacity:0.8;">${e.role}</div>
                    </td>
                    <td style="text-align:center;">${e.shifts}</td>
                    <td style="text-align:right;">${e.hours.toFixed(2)} hrs</td>
                    <td style="text-align:right; ${payStyle}">$${e.totalPay.toFixed(2)}</td>
                </tr>`;

                if (e.shifts > 0) {
                    e.jobList.sort((a, b) => new Date(a.date) - new Date(b.date));

                    let detailHtml = `<tr id="detail-${id}" class="detail-row"><td colspan="5" style="padding:0;">
                        <div style="padding:10px 20px;">
                            <h5 style="margin:0 0 5px 0; color:#0f766e;">Shift Breakdown</h5>
                            <table class="detail-table">
                                <thead><tr><th>Date</th><th>Location</th><th>Time</th><th style="text-align:right;">Hours</th><th style="text-align:right;">Cost</th></tr></thead>
                                <tbody>`;

                    e.jobList.forEach(job => {
                        detailHtml += `<tr>
                            <td>${job.date}</td>
                            <td>${job.account}</td>
                            <td>${job.time}</td>
                            <td style="text-align:right;">${job.hours.toFixed(2)}</td>
                            <td style="text-align:right;">$${job.pay.toFixed(2)}</td>
                        </tr>`;
                    });

                    detailHtml += `</tbody></table></div></td></tr>`;
                    html += detailHtml;
                }
            }
        });

        html += '</tbody></table>';
        container.innerHTML = html;
        totalDisplay.textContent = '$' + grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

    } catch (err) {
        console.error("Error loading payroll:", err);
        container.innerHTML = '<div style="color:red; text-align:center;">Error loading payroll data.</div>';
    }
}

// --- CSV EXPORT LOGIC ---
window.exportPayrollCSV = function() {
    if (currentPayrollExport.length === 0) {
        return alert("No data to export for this date range.");
    }

    // 1. Define Headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Employee Name,Role,Total Shifts,Total Hours,Hourly Wage,Gross Pay\n";

    // 2. Add Data Rows
    currentPayrollExport.forEach(row => {
        csvContent += `"${row.name}","${row.role}",${row.shifts},${row.hours},${row.wage},${row.total}\n`;
    });

    // 3. Trigger Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);

    // Filename: Payroll_Start_End.csv
    const s = payrollStart.toISOString().split('T')[0];
    const e = payrollEnd.toISOString().split('T')[0];
    link.setAttribute("download", `Payroll_${s}_to_${e}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.togglePayrollRow = function(id) {
    const detailRow = document.getElementById(`detail-${id}`);
    const mainRow = document.getElementById(`row-${id}`);

    if (detailRow.classList.contains('show')) {
        detailRow.classList.remove('show');
        mainRow.classList.remove('expanded');
    } else {
        detailRow.classList.add('show');
        mainRow.classList.add('expanded');
    }
};

window.updatePayrollDates = function() {
    const startVal = document.getElementById('payStart').value;
    const endVal = document.getElementById('payEnd').value;
    if(startVal) payrollStart = new Date(startVal);
    if(endVal) {
        payrollEnd = new Date(endVal);
        payrollEnd.setHours(23,59,59,999);
    }
    loadPayroll();
};

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.loadPayroll = loadPayroll;