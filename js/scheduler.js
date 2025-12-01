// js/scheduler.js

// --- CALENDAR STATE & CONFIGURATION ---
let currentView = 'week';
let currentDate = new Date();
let alertedJobs = new Set();
const alertSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
const HOURS_TO_RENDER = 30;

// GLOBAL SETTINGS CACHE
let schedulerSettings = {};

function normalizeDate(date, view) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (view === 'week') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
    } else if (view === 'month') {
        d.setDate(1);
    }
    return d;
}

currentDate = normalizeDate(currentDate, currentView);

// --- MAIN LOAD FUNCTION ---

async function loadScheduler() {
    console.log(`CleanDash: Loading Schedule (${currentView} view)...`);
    const container = document.getElementById('schedulerGrid');

    if (!container.innerHTML.trim()) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:#888;">Loading schedule...</div>';
    }

    if (!window.currentUser) return;

    try {
        const [userDoc, jobs, accountsSnap] = await Promise.all([
            db.collection('users').doc(window.currentUser.uid).get(),
            fetchJobs(),
            db.collection('accounts').where('owner', '==', window.currentUser.email).get()
        ]);

        const accountAlarms = {};
        accountsSnap.forEach(doc => {
            const data = doc.data();
            if(data.alarmCode) accountAlarms[doc.id] = data.alarmCode;
        });

        // LOAD & CACHE SETTINGS (Including SMS Email)
        schedulerSettings = userDoc.exists ? userDoc.data() : {};

        const alertThreshold = schedulerSettings.alertThreshold || 15;
        const emailDelayMinutes = schedulerSettings.emailDelayMinutes || 60;
        const emailAlertsEnabled = (schedulerSettings.emailAlertsEnabled === undefined) ? true : schedulerSettings.emailAlertsEnabled;

        updateHeaderUI();

        const alertControls = document.getElementById('alertControls');
        if(alertControls) alertControls.style.display = 'flex';

        const delayInput = document.getElementById('editEmailDelay');
        if(delayInput) delayInput.value = emailDelayMinutes;

        const enabledInput = document.getElementById('editEmailEnabled');
        if(enabledInput) enabledInput.checked = emailAlertsEnabled;

        if (currentView === 'week') {
            renderWeekView(jobs, alertThreshold, emailDelayMinutes, emailAlertsEnabled, accountAlarms);
        } else if (currentView === 'day') {
            renderDayView(jobs, alertThreshold, emailDelayMinutes, emailAlertsEnabled, accountAlarms);
        } else if (currentView === 'month') {
            renderMonthView(jobs, alertThreshold, emailDelayMinutes, emailAlertsEnabled, accountAlarms);
        }

        if (currentView !== 'month') {
             setTimeout(() => {
                 if(container) container.scrollTop = 1020;
             }, 100);
        }

    } catch (err) {
        console.error("Error loading jobs:", err);
        container.innerHTML = '<div style="color:red; padding:2rem; text-align:center;">Error loading schedule.</div>';
    }
}

async function fetchJobs() {
    const q = window.currentUser.email === 'admin@cleandash.com'
        ? db.collection('jobs')
        : db.collection('jobs').where('owner', '==', window.currentUser.email);

    const snap = await q.get();
    const jobs = [];
    snap.forEach(doc => {
        const j = doc.data();
        j.id = doc.id;
        j.start = j.startTime.toDate();
        j.end = j.endTime.toDate();
        j.actStart = j.actualStartTime ? j.actualStartTime.toDate() : null;
        j.actEnd = j.actualEndTime ? j.actualEndTime.toDate() : null;
        jobs.push(j);
    });
    return jobs;
}

// --- RENDERERS ---

function renderWeekView(jobs, alertThreshold, emailDelay, emailEnabled, accountAlarms) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;
    let html = '<div class="calendar-view">';
    html += generateTimeColumn();
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentDate);
        dayDate.setDate(currentDate.getDate() + i);
        html += renderDayColumn(dayDate, jobs, alertThreshold, emailDelay, emailEnabled, false, accountAlarms);
    }
    html += '</div>';
    grid.innerHTML = html;
}

function renderDayView(jobs, alertThreshold, emailDelay, emailEnabled, accountAlarms) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;
    let html = '<div class="calendar-view">';
    html += generateTimeColumn();
    html += renderDayColumn(currentDate, jobs, alertThreshold, emailDelay, emailEnabled, true, accountAlarms);
    html += '</div>';
    grid.innerHTML = html;
}

function renderMonthView(jobs, alertThreshold, emailDelay, emailEnabled, accountAlarms) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;
    let html = `
    <div class="month-header">
        <div class="month-day-label">Sun</div><div class="month-day-label">Mon</div>
        <div class="month-day-label">Tue</div><div class="month-day-label">Wed</div>
        <div class="month-day-label">Thu</div><div class="month-day-label">Fri</div>
        <div class="month-day-label">Sat</div>
    </div>
    <div class="calendar-month-view">`;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let iterator = new Date(firstDay);
    iterator.setDate(iterator.getDate() - iterator.getDay());

    for(let i=0; i<42; i++) {
        const isCurrMonth = iterator.getMonth() === month;
        const dateStr = iterator.toISOString().split('T')[0];
        const dayJobs = jobs.filter(j => isSameDay(j.start, iterator));

        if (!isCurrMonth && iterator > lastDay && iterator.getDay() === 0) break;

        html += `<div class="month-day ${isCurrMonth ? '' : 'other-month'}" onclick="openShiftModal(new Date('${dateStr}T09:00'))">
            <div class="month-date-num">${iterator.getDate()}</div>
            <div class="month-events">`;

        dayJobs.forEach(job => {
            let statusClass = 'month-event';
            if(job.status === 'Completed') statusClass += ' done';
            else if(job.status === 'Started') statusClass += ' active';
            else {
                 if (new Date() > new Date(job.start.getTime() + alertThreshold*60000)) statusClass += ' late';
            }

            const alarmIndicator = accountAlarms[job.accountId] ? '🔒' : '';

            html += `<div class="${statusClass}" onclick="event.stopPropagation(); editJob({id:'${job.id}'})">
                ${alarmIndicator} ${formatTime(job.start)} ${job.accountName}
            </div>`;
        });

        html += `</div>
            <button class="month-add-btn" onclick="event.stopPropagation(); openShiftModal(new Date('${dateStr}T09:00'))">+</button>
        </div>`;

        iterator.setDate(iterator.getDate() + 1);
    }

    html += `</div>`;
    grid.innerHTML = html;
}

function generateTimeColumn() {
    let html = '<div class="calendar-time-col">';
    html += '<div class="cal-header" style="background:#f9fafb; border-bottom:1px solid #e5e7eb;"></div>';

    for (let h = 0; h < HOURS_TO_RENDER; h++) {
        let displayH = h % 24;
        let label = '';

        if (displayH === 0) label = '12 AM';
        else if (displayH < 12) label = `${displayH} AM`;
        else if (displayH === 12) label = '12 PM';
        else label = `${displayH - 12} PM`;

        if (h >= 24) label += ' <span style="font-size:0.6rem; display:block; opacity:0.6;">(+1)</span>';

        html += `<div class="time-slot">${label}</div>`;
    }
    html += '</div>';
    return html;
}

function renderDayColumn(dateObj, jobs, alertThreshold, emailDelay, emailEnabled, isSingleDay = false, accountAlarms = {}) {
    const dateStr = dateObj.toISOString().split('T')[0];
    const displayDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

    const dayJobs = jobs.filter(j => isSameDay(j.start, dateObj));
    dayJobs.sort((a, b) => a.start - b.start);

    const columns = [];
    dayJobs.forEach(job => {
        let placed = false;
        for(let i = 0; i < columns.length; i++) {
            const lastJobInColumn = columns[i][columns[i].length - 1];
            if (job.start >= lastJobInColumn.end) {
                columns[i].push(job);
                job.colIndex = i;
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([job]);
            job.colIndex = columns.length - 1;
        }
    });

    const totalCols = columns.length || 1;
    const colWidth = 94 / totalCols;

    let html = `<div class="calendar-day-col" style="${isSingleDay ? 'flex:1;' : ''}" data-date="${dateStr}">`;
    html += `<div class="cal-header">${displayDate}</div>`;
    html += `<div class="day-slots" ondblclick="openShiftModal(new Date('${dateStr}T09:00:00'))">`;

    const now = new Date();

    dayJobs.forEach(job => {
        const startHour = job.start.getHours() + (job.start.getMinutes() / 60);
        let endHour = job.end.getHours() + (job.end.getMinutes() / 60);

        if (job.end.getDate() !== job.start.getDate()) {
            endHour += 24;
        }

        let duration = endHour - startHour;
        if(duration < 0.5) duration = 0.5;

        const topPx = startHour * 60;
        const heightPx = Math.max(duration * 60, 25);

        const leftPos = 3 + (job.colIndex * colWidth);

        let statusClass = 'day-event';
        let statusIcon = '';

        if (job.status === 'Completed') {
            statusClass += ' done';
            statusIcon = '✅';
        } else if (job.status === 'Started') {
            statusClass += ' active';
            statusIcon = '🔄';
        } else {
            const lateTime = new Date(job.start.getTime() + alertThreshold * 60000);
            if (now > lateTime) {
                statusClass += ' late';
                statusIcon = '⚠️';
                if (emailEnabled && job.status === 'Scheduled') {
                     const emailTriggerTime = new Date(job.start.getTime() + emailDelay * 60000);
                     if (now > emailTriggerTime && !alertedJobs.has(job.id)) {
                         triggerLateAlert(job);
                         alertedJobs.add(job.id);
                     }
                }
            } else {
                statusClass += ' scheduled';
            }
        }

        const alarmCode = accountAlarms[job.accountId];
        const alarmHtml = alarmCode ? `<div class="event-meta" style="color:#ef4444; font-weight:bold;">🚨 ${alarmCode}</div>` : '';

        html += `
        <div class="${statusClass}"
             style="top:${topPx}px; height:${heightPx}px; width:${colWidth}%; left:${leftPos}%;"
             onclick="event.stopPropagation(); editJob({ id: '${job.id}' })"
             title="${job.accountName} - ${job.employeeName}">
            <div class="event-time">${formatTime(job.start)} - ${formatTime(job.end)}</div>
            <div class="event-title">${statusIcon} ${job.accountName}</div>
            <div class="event-meta">👤 ${job.employeeName.split(' ')[0]}</div>
            ${alarmHtml}
        </div>`;
    });

    html += `</div></div>`;
    return html;
}

// --- UTILS ---

function updateHeaderUI() {
    const label = document.getElementById('weekRangeDisplay');
    if(!label) return;
    if (currentView === 'day') {
        label.textContent = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    } else if (currentView === 'month') {
        label.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
        const endOfWeek = new Date(currentDate);
        endOfWeek.setDate(currentDate.getDate() + 6);
        label.textContent = `${currentDate.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
    }
    document.querySelectorAll('.btn-view-toggle').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
    });
}

window.changeView = function(view) {
    currentView = view;
    currentDate = normalizeDate(currentDate, currentView);
    loadScheduler();
};

window.changePeriod = function(direction) {
    if (currentView === 'day') {
        currentDate.setDate(currentDate.getDate() + direction);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + direction);
    }
    loadScheduler();
};

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toIsoString(date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// --- ALERTING ---

function triggerLateAlert(job) {
    console.log(`ALARM: ${job.employeeName} is late for ${job.accountName}`);
    alertSound.play().catch(e => console.warn("Audio play blocked:", e));
    if (Notification.permission === "granted") {
        new Notification("MISSED CHECK-IN!", { body: `${job.employeeName} late.` });
    }
    sendEmailAlert(job);
}

function sendEmailAlert(job) {
    if (typeof emailjs === 'undefined') return console.error("EmailJS not loaded in index.html");

    // Use SMS Email if available in settings, otherwise default to Owner's main email
    const recipient = (schedulerSettings && schedulerSettings.smsEmail)
        ? schedulerSettings.smsEmail
        : job.owner;

    console.log(`Sending alert to: ${recipient}`);

    const templateParams = {
        employee: job.employeeName,
        location: job.accountName,
        time: job.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        to_email: recipient
    };

    emailjs.send('service_k7z8j0n', 'template_abc2jjm', templateParams)
        .then(function(response) {
            console.log('SUCCESS!', response.status, response.text);
            window.showToast(`Alert sent to ${recipient}`);
        }, function(error) {
            console.log('FAILED...', error);
            window.showToast("Failed to send alert.");
        });
}

window.saveScheduleSettings = async function() {
    if (!window.currentUser) return;
    const emailDelayMinutes = parseInt(document.getElementById('editEmailDelay').value) || 60;
    const emailAlertsEnabled = document.getElementById('editEmailEnabled').checked;
    await db.collection('users').doc(window.currentUser.uid).set({ emailDelayMinutes, emailAlertsEnabled }, { merge: true });
    window.showToast("Settings updated!");
    loadScheduler();
};

// --- RECURRENCE UI TOGGLES ---

window.toggleRecurrenceOptions = function() {
    const isChecked = document.getElementById('shiftRepeat').checked;
    const container = document.getElementById('recurrenceOptions');
    container.style.display = isChecked ? 'block' : 'none';
};

window.toggleRecurrenceDay = function(btn) {
    btn.classList.toggle('selected');
};

// --- MODAL & CRUD FUNCTIONS ---

async function populateDropdowns() {
    const accSelect = document.getElementById('shiftAccount');
    const empSelect = document.getElementById('shiftEmployee');
    const startSelect = document.getElementById('shiftStartTime');
    const endSelect = document.getElementById('shiftEndTime');

    if (!accSelect || !empSelect || !startSelect || !endSelect) return;

    // Populate Time Selects
    if (startSelect.options.length === 0) {
        const times = [];
        for(let i=0; i<24; i++) {
            for(let m=0; m<60; m+=15) {
                const h = i.toString().padStart(2,'0');
                const min = m.toString().padStart(2,'0');
                const displayH = i === 0 ? 12 : (i > 12 ? i-12 : i);
                const ampm = i < 12 ? 'AM' : 'PM';
                times.push({ val: `${h}:${min}`, text: `${displayH}:${min} ${ampm}` });
            }
        }
        times.forEach(t => {
            startSelect.add(new Option(t.text, t.val));
            endSelect.add(new Option(t.text, t.val));
        });

        // Auto-set End Time +1hr logic
        startSelect.addEventListener('change', function() {
             const val = this.value;
             if(!val) return;
             let [h, m] = val.split(':').map(Number);
             h = (h + 1) % 24;
             const nextVal = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
             if(endSelect) endSelect.value = nextVal;
        });
    }

    // Populate Accounts/Employees
    if (accSelect.options.length <= 1) {
        accSelect.innerHTML = '<option value="">Select Account...</option>';
        empSelect.innerHTML = '<option value="">Select Employee...</option>';
        if (!window.currentUser) return;
        try {
            const accSnap = await db.collection('accounts').where('owner', '==', window.currentUser.email).orderBy('name').get();
            accSnap.forEach(doc => accSelect.appendChild(new Option(doc.data().name, doc.id)));
            const empSnap = await db.collection('employees').where('owner', '==', window.currentUser.email).orderBy('name').get();
            empSnap.forEach(doc => empSelect.appendChild(new Option(doc.data().name, doc.id)));
        } catch (e) { console.error("Dropdown load error:", e); }
    }
}

window.openShiftModal = async function(dateObj) {
    document.getElementById('shiftModal').style.display = 'flex';
    document.getElementById('shiftModalTitle').textContent = "Assign Shift";
    document.getElementById('shiftId').value = "";
    document.getElementById('btnDeleteShift').style.display = 'none';
    document.getElementById('manualTimeSection').style.display = 'none';

    // Reset recurrence UI
    document.getElementById('shiftRepeat').checked = false;
    document.getElementById('recurrenceOptions').style.display = 'none';
    document.querySelectorAll('.day-btn-circle').forEach(b => b.classList.remove('selected'));
    document.getElementById('shiftRepeatEnd').value = "";

    await populateDropdowns();

    const dateStr = dateObj.toISOString().split('T')[0];
    document.getElementById('shiftStartDate').value = dateStr;

    // DEFAULT TIMES: 5 PM - 6 PM
    document.getElementById('shiftStartTime').value = "17:00";
    document.getElementById('shiftEndTime').value = "18:00";
};

window.editJob = async function(job) {
    if(!job.start) {
        const doc = await db.collection('jobs').doc(job.id).get();
        const data = doc.data();
        job = { id: doc.id, ...data, start: data.startTime.toDate(), end: data.endTime.toDate() };
        job.actStart = data.actualStartTime ? data.actualStartTime.toDate() : null;
        job.actEnd = data.actualEndTime ? data.actualEndTime.toDate() : null;
    }

    document.getElementById('shiftModal').style.display = 'flex';
    document.getElementById('shiftModalTitle').textContent = "Edit Shift";
    document.getElementById('shiftId').value = job.id;
    document.getElementById('btnDeleteShift').style.display = 'inline-block';
    document.getElementById('manualTimeSection').style.display = 'block';

    document.getElementById('shiftRepeat').checked = false;
    document.getElementById('recurrenceOptions').style.display = 'none';

    await populateDropdowns();

    document.getElementById('shiftAccount').value = job.accountId;
    document.getElementById('shiftEmployee').value = job.employeeId;
    document.getElementById('shiftStatus').value = job.status || 'Scheduled';

    const sDate = job.start.toISOString().split('T')[0];
    const sH = String(job.start.getHours()).padStart(2,'0');
    const sM = Math.round(job.start.getMinutes() / 15) * 15;
    const sMin = (sM===60 ? 0 : sM).toString().padStart(2,'0');
    document.getElementById('shiftStartDate').value = sDate;
    document.getElementById('shiftStartTime').value = `${sH}:${sMin}`;

    const eH = String(job.end.getHours()).padStart(2,'0');
    const eM = Math.round(job.end.getMinutes() / 15) * 15;
    const eMin = (eM===60 ? 0 : eM).toString().padStart(2,'0');
    document.getElementById('shiftEndTime').value = `${eH}:${eMin}`;

    document.getElementById('actualStart').value = job.actStart ? toIsoString(job.actStart) : '';
    document.getElementById('actualEnd').value = job.actEnd ? toIsoString(job.actEnd) : '';
};

window.saveShift = async function() {
    const id = document.getElementById('shiftId').value;
    const accSelect = document.getElementById('shiftAccount');
    const empSelect = document.getElementById('shiftEmployee');
    const sDate = document.getElementById('shiftStartDate').value;
    const sTime = document.getElementById('shiftStartTime').value;
    const eTime = document.getElementById('shiftEndTime').value;
    const status = document.getElementById('shiftStatus').value;

    const isRepeat = document.getElementById('shiftRepeat').checked;

    if (!accSelect.value || !empSelect.value || !sDate || !sTime || !eTime) {
        return alert("Required fields missing.");
    }

    const btn = document.querySelector('#shiftModal .btn-primary');
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        const batch = db.batch();
        const baseStart = new Date(`${sDate}T${sTime}:00`);
        let baseEnd = new Date(`${sDate}T${eTime}:00`);

        // AUTO-CORRECT OVERNIGHT SHIFT
        if (baseEnd <= baseStart) {
            baseEnd.setDate(baseEnd.getDate() + 1);
        }

        const durationMs = baseEnd - baseStart;

        if (!isRepeat || id) {
            const data = {
                accountId: accSelect.value,
                accountName: accSelect.options[accSelect.selectedIndex].text,
                employeeId: empSelect.value,
                employeeName: empSelect.options[empSelect.selectedIndex].text,
                startTime: firebase.firestore.Timestamp.fromDate(baseStart),
                endTime: firebase.firestore.Timestamp.fromDate(baseEnd),
                status: status,
                owner: window.currentUser.email
            };

            const actS = document.getElementById('actualStart').value;
            const actE = document.getElementById('actualEnd').value;
            if(actS) data.actualStartTime = firebase.firestore.Timestamp.fromDate(new Date(actS));
            if(actE) data.actualEndTime = firebase.firestore.Timestamp.fromDate(new Date(actE));

            if (id) {
                await db.collection('jobs').doc(id).update(data);
                window.showToast("Shift Updated");
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('jobs').add(data);
                window.showToast("Shift Created");
            }

        } else {
            const repeatUntilVal = document.getElementById('shiftRepeatEnd').value;
            if (!repeatUntilVal) throw new Error("Please select a 'Repeat Until' date.");

            const repeatUntil = new Date(repeatUntilVal);
            repeatUntil.setHours(23, 59, 59);

            const selectedDays = [];
            document.querySelectorAll('.day-btn-circle.selected').forEach(btn => {
                selectedDays.push(parseInt(btn.dataset.day));
            });

            if (selectedDays.length === 0) throw new Error("Select at least one day for repetition.");

            let cursor = new Date(baseStart);
            let createdCount = 0;

            while (cursor <= repeatUntil) {
                if (selectedDays.includes(cursor.getDay())) {
                    const shiftStart = new Date(cursor);
                    const shiftEnd = new Date(cursor.getTime() + durationMs);

                    const newRef = db.collection('jobs').doc();
                    batch.set(newRef, {
                        accountId: accSelect.value,
                        accountName: accSelect.options[accSelect.selectedIndex].text,
                        employeeId: empSelect.value,
                        employeeName: empSelect.options[empSelect.selectedIndex].text,
                        startTime: firebase.firestore.Timestamp.fromDate(shiftStart),
                        endTime: firebase.firestore.Timestamp.fromDate(shiftEnd),
                        status: 'Scheduled',
                        owner: window.currentUser.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    createdCount++;
                }
                cursor.setDate(cursor.getDate() + 1);
            }

            if (createdCount === 0) throw new Error("No shifts created. Check dates and selected days.");

            await batch.commit();
            window.showToast(`${createdCount} Shifts Created!`);
        }

        closeShiftModal();
        loadScheduler();

    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Shift";
    }
};

window.deleteJobFromModal = async function() {
    const id = document.getElementById('shiftId').value;
    if(!confirm("Cancel this shift?")) return;
    await db.collection('jobs').doc(id).delete();
    closeShiftModal();
    loadScheduler();
};

window.closeShiftModal = function() { document.getElementById('shiftModal').style.display = 'none'; };

if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
}

window.loadScheduler = loadScheduler;