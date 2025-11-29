// js/scheduler.js

let currentWeekStart = new Date(); // Defaults to "now"
// Set to beginning of the week (Monday)
const day = currentWeekStart.getDay();
const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
currentWeekStart.setDate(diff);
currentWeekStart.setHours(0,0,0,0);

async function loadScheduler() {
    console.log("CleanDash: Loading Schedule...");
    const container = document.getElementById('schedulerGrid');
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:#888;">Loading schedule...</div>';

    // 1. Update Date Header
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    document.getElementById('weekRangeDisplay').textContent =
        `${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

    // 2. Fetch Jobs for this Owner (In a real app, we'd filter by Date too)
    const q = window.currentUser.email === 'admin@cleandash.com'
        ? db.collection('jobs')
        : db.collection('jobs').where('owner', '==', window.currentUser.email);

    try {
        const snap = await q.get();
        const jobs = [];
        snap.forEach(doc => {
            const j = doc.data();
            j.id = doc.id;
            // Convert timestamps to JS Dates
            j.start = j.startTime.toDate();
            j.end = j.endTime.toDate();
            jobs.push(j);
        });

        renderCalendar(jobs);

    } catch (err) {
        console.error("Error loading jobs:", err);
        container.innerHTML = '<div style="color:red">Error loading schedule.</div>';
    }
}

function renderCalendar(jobs) {
    const grid = document.getElementById('schedulerGrid');
    grid.innerHTML = ''; // Clear

    // Create 7 Columns for Mon-Sun
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
        // Calculate date for this column
        const colDate = new Date(currentWeekStart);
        colDate.setDate(colDate.getDate() + i);
        const dateString = colDate.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

        // Column Wrapper
        const col = document.createElement('div');
        col.className = 'calendar-col';
        col.innerHTML = `<div class="cal-header">${dateString}</div>`;

        // Find jobs for this day
        const dayJobs = jobs.filter(j => isSameDay(j.start, colDate));

        // Sort by time
        dayJobs.sort((a, b) => a.start - b.start);

        dayJobs.forEach(job => {
            const timeStr = formatTime(job.start) + ' - ' + formatTime(job.end);

            const card = document.createElement('div');
            card.className = 'shift-card';
            card.innerHTML = `
                <div class="shift-time">${timeStr}</div>
                <div class="shift-loc">${job.accountName}</div>
                <div class="shift-emp">👤 ${job.employeeName}</div>
                <div class="shift-actions">
                    <span onclick="deleteJob('${job.id}')" title="Delete">&times;</span>
                </div>
            `;
            col.appendChild(card);
        });

        // Add "New Shift" button at bottom of column
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add-shift';
        addBtn.textContent = '+ Shift';
        addBtn.onclick = () => openShiftModal(colDate);
        col.appendChild(addBtn);

        grid.appendChild(col);
    }
}

// --- UTILS ---
function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.changeWeek = function(offset) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7));
    loadScheduler();
};

// --- MODAL LOGIC ---

window.openShiftModal = async function(dateObj) {
    document.getElementById('shiftModal').style.display = 'flex';

    // Set default date in input
    // Note: Input type="datetime-local" needs YYYY-MM-DDTHH:MM format
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');

    document.getElementById('shiftStart').value = `${yyyy}-${mm}-${dd}T17:00`; // Default 5 PM
    document.getElementById('shiftEnd').value = `${yyyy}-${mm}-${dd}T21:00`;   // Default 9 PM

    // Populate Dropdowns (Accounts & Employees)
    await populateDropdowns();
};

window.closeShiftModal = function() {
    document.getElementById('shiftModal').style.display = 'none';
};

async function populateDropdowns() {
    const accSelect = document.getElementById('shiftAccount');
    const empSelect = document.getElementById('shiftEmployee');

    // Only fetch if empty to save reads (Basic Cache)
    if (accSelect.options.length > 1) return;

    // 1. Get Accounts
    const accSnap = await db.collection('accounts').where('owner', '==', window.currentUser.email).orderBy('name').get();
    accSelect.innerHTML = '<option value="">Select Account...</option>';
    accSnap.forEach(doc => {
        const op = document.createElement('option');
        op.value = doc.id;
        op.text = doc.data().name;
        accSelect.appendChild(op);
    });

    // 2. Get Employees (Active Only)
    const empSnap = await db.collection('employees')
        .where('owner', '==', window.currentUser.email)
        .where('status', '==', 'Active') // Only show active staff
        .orderBy('name').get();

    empSelect.innerHTML = '<option value="">Select Employee...</option>';
    empSnap.forEach(doc => {
        const op = document.createElement('option');
        op.value = doc.id;
        op.text = doc.data().name;
        empSelect.appendChild(op);
    });
}

// --- CONFLICT DETECTION LOGIC ---

async function checkScheduleConflict(employeeId, newStart, newEnd) {
    // 1. Query constraints:
    // We look for shifts for this employee that end AFTER our new start time.
    const q = db.collection('jobs')
        .where('employeeId', '==', employeeId)
        .where('endTime', '>', firebase.firestore.Timestamp.fromDate(newStart));

    const snap = await q.get();

    // 2. Client-side Filter:
    // Now check if those shifts actually start BEFORE our new end time.
    for (let doc of snap.docs) {
        const job = doc.data();
        const jobStart = job.startTime.toDate();

        // The Overlap Formula: (StartA < EndB) and (EndA > StartB)
        if (jobStart < newEnd) {
            return {
                conflict: true,
                existingJob: job
            };
        }
    }

    return { conflict: false };
}

// --- SAVE SHIFT WITH CONFLICT CHECK ---

window.saveShift = async function() {
    const accSelect = document.getElementById('shiftAccount');
    const empSelect = document.getElementById('shiftEmployee');
    const startVal = document.getElementById('shiftStart').value;
    const endVal = document.getElementById('shiftEnd').value;

    if (!accSelect.value || !empSelect.value || !startVal || !endVal) {
        return alert("All fields required.");
    }

    const startTime = new Date(startVal);
    const endTime = new Date(endVal);

    if (endTime <= startTime) {
        return alert("End time must be after start time.");
    }

    const btn = document.querySelector('#shiftModal .btn-primary');
    btn.disabled = true;
    btn.textContent = "Checking Availability...";

    try {
        // 1. RUN CONFLICT CHECK BEFORE SAVING
        const check = await checkScheduleConflict(empSelect.value, startTime, endTime);

        if (check.conflict) {
            const conflictStart = check.existingJob.startTime.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const conflictEnd = check.existingJob.endTime.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

            alert(`CONFLICT DETECTED!\n\n${check.existingJob.employeeName} is already working at:\n${check.existingJob.accountName}\n(${conflictStart} - ${conflictEnd})\n\nPlease choose a different time or employee.`);

            btn.disabled = false;
            btn.textContent = "Save Shift";
            return; // Stop execution here
        }

        // 2. If no conflict, proceed to save
        btn.textContent = "Scheduling...";

        await db.collection('jobs').add({
            accountId: accSelect.value,
            accountName: accSelect.options[accSelect.selectedIndex].text,
            employeeId: empSelect.value,
            employeeName: empSelect.options[empSelect.selectedIndex].text,
            startTime: firebase.firestore.Timestamp.fromDate(startTime),
            endTime: firebase.firestore.Timestamp.fromDate(endTime),
            owner: window.currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast("Shift Assigned!");
        closeShiftModal();
        loadScheduler();

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Shift";
    }
};

window.deleteJob = async function(id) {
    if(!confirm("Cancel this shift?")) return;
    await db.collection('jobs').doc(id).delete();
    loadScheduler();
};

window.loadScheduler = loadScheduler;