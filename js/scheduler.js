// js/scheduler.js

// --- 1. CONFIGURATION ---
const START_HOUR = 6; // Start at 6 AM
const HOURS_TO_RENDER = 24; // Show 18 hours (6 AM to Midnight)
const PIXELS_PER_HOUR = 60;
const SNAP_MINUTES = 15;
const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;
const SNAP_PIXELS = SNAP_MINUTES * PIXELS_PER_MINUTE;

// --- 2. STATE ---
window.currentView = 'day';
window.currentDate = new Date();
window.schedulerData = [];
let alertedJobs = new Set();
const alertSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');

// Globals
let schedulerSettings = {};
let currentEmpFilter = 'ALL';
let currentAccountFilter = 'ALL';
let showEmployeeColors = false;
let employeeColors = {};
let timeLineInterval = null;

// --- 3. NAVIGATION LISTENER ---
document.addEventListener('click', function(e) {
    const navItem = e.target.closest('.nav-item[data-page="scheduler"]');
    if (navItem) {
        window.loadScheduler();
    }
});

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
    // List view behaves like Day view for normalization
    return d;
}

function getLocalYMD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

window.currentDate = normalizeDate(window.currentDate, window.currentView);

// --- 4. MAIN LOAD FUNCTION ---
window.loadScheduler = async function() {
    // Check rolling schedules first
    if(window.checkRollingSchedules) window.checkRollingSchedules();

    console.log(`CleanDash: Loading Schedule (${window.currentView} view)...`);
    const container = document.getElementById('schedulerGrid');

    if (container) {
        // --- UPDATED LAYOUT LOGIC FOR MOBILE OPTIMIZATION ---
        container.style.padding = '0';
        container.style.margin = '0';
        container.style.width = '100%';
        container.style.flex = '1';      // Take remaining space
        container.style.height = 'auto'; // Reset fixed height
        container.style.overflow = 'hidden';

        if(container.parentElement) {
            container.parentElement.style.padding = '0';
            container.parentElement.style.height = 'calc(100vh - 80px)';
            container.parentElement.style.display = 'flex';
            container.parentElement.style.flexDirection = 'column';
            container.parentElement.style.overflow = 'hidden';
        }
    }

    if (!container.innerHTML.trim()) container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:#888;">Loading schedule...</div>';

    // --- AUTH RETRY LOGIC ---
    if (!window.currentUser) {
        console.log("Scheduler: User not ready, retrying in 500ms...");
        setTimeout(window.loadScheduler, 500);
        return;
    }

    try {
        const [userDoc, jobs, accountsSnap, empSnap] = await Promise.all([
            db.collection('users').doc(window.currentUser.uid).get(),
            fetchJobs(),
            db.collection('accounts').where('owner', '==', window.currentUser.email).orderBy('name').get(),
            db.collection('employees').where('owner', '==', window.currentUser.email).orderBy('name').get()
        ]);

        const accountAlarms = {};
        const accountsList = [];
        accountsSnap.forEach(doc => {
            const data = doc.data();
            accountsList.push({ id: doc.id, name: data.name });
            if(data.alarmCode) accountAlarms[doc.id] = data.alarmCode;
        });

        const employees = [];
        employeeColors = {};
        empSnap.forEach(doc => {
            const data = doc.data();
            employees.push({ id: doc.id, name: data.name });
            if (data.color) employeeColors[doc.id] = data.color;
        });

        schedulerSettings = userDoc.exists ? userDoc.data() : {};

        // Ensure "By Job" button exists
        ensureViewToggleButtons();
        updateHeaderUI();
        renderFilterDropdown(employees);
        renderAccountDropdown(accountsList);
        renderColorToggle();

        const alertControls = document.getElementById('alertControls');
        // HIDDEN PER REQUEST
        if(alertControls) alertControls.style.display = 'none';

        // --- FILTERING LOGIC ---
        let filteredJobs = jobs;

        if (currentEmpFilter !== 'ALL') {
            filteredJobs = filteredJobs.filter(job => job.employeeId === currentEmpFilter);
        }

        if (currentAccountFilter !== 'ALL') {
            filteredJobs = filteredJobs.filter(job => job.accountId === currentAccountFilter);
        }

        window.schedulerJobsCache = filteredJobs;

        const alertThreshold = schedulerSettings.alertThreshold || 15;
        const emailDelayMinutes = schedulerSettings.emailDelayMinutes || 60;
        const emailAlertsEnabled = document.getElementById('editEmailEnabled')?.checked ?? true;

        if (window.currentView === 'week') renderWeekView(filteredJobs, alertThreshold, emailDelayMinutes, emailAlertsEnabled, accountAlarms);
        else if (window.currentView === 'day') renderDayView(filteredJobs, alertThreshold, emailDelayMinutes, emailAlertsEnabled, accountAlarms);
        else if (window.currentView === 'month') renderMonthView(filteredJobs, alertThreshold, emailDelayMinutes, emailAlertsEnabled, accountAlarms);
        else if (window.currentView === 'list') renderListView(filteredJobs, alertThreshold, accountAlarms);

        if (window.currentView === 'day' || window.currentView === 'week') {
            setupInteractions();
            startCurrentTimeLine();
        } else {
            stopCurrentTimeLine();
        }

        attachDblClickListeners();
        attachRowHighlighter();

    } catch (err) {
        console.error("Error loading jobs:", err);
        container.innerHTML = '<div style="color:red; padding:2rem; text-align:center;">Error loading schedule.</div>';
    }
};

// --- NEW: INJECT "BY JOB" BUTTON ---
function ensureViewToggleButtons() {
    const container = document.querySelector('.view-toggles');
    if (!container) return;

    // Check if List button exists
    let btn = container.querySelector('[data-view="list"]');
    if (!btn) {
        btn = document.createElement('button');
        btn.className = 'btn-view-toggle';
        btn.dataset.view = 'list';
        btn.onclick = function() { window.changeView('list'); };

        // Insert before the Day button if possible, otherwise just append/prepend
        const dayBtn = container.querySelector('[data-view="day"]');
        if (dayBtn) {
            container.insertBefore(btn, dayBtn);
        } else {
            container.insertBefore(btn, container.firstChild);
        }
    }
    // Set text to 'Shifts'
    btn.textContent = 'Shifts';
}





// --- NEW: RENDER LIST VIEW (BY JOB) ---
function renderListView(jobs, alertThreshold, accountAlarms) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;

    grid.style.overflow = 'auto';
    grid.style.display = 'block';
    // Restore padding for better spacing since sticky header is gone
    grid.style.padding = '12px';
    grid.style.background = '#f9fafb';

    const dateStr = getLocalYMD(window.currentDate);
    // Filter for current date
    const dayJobs = jobs.filter(j => isSameDay(j.start, window.currentDate));
    // Sort by start time
    dayJobs.sort((a,b) => a.start - b.start);

    // Main wrapper
    let html = `<div class="scheduler-list-view" style="max-width:100%; margin:0;">`;

    // Stats calculation
    const totalCount = dayJobs.length;
    const completedCount = dayJobs.filter(j => j.status === 'Completed').length;

    // Add date header similar to mobile view for context
    const displayDate = window.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    let headerHtml = displayDate;
    if (totalCount > 0) {
        if (completedCount === totalCount) {
             headerHtml += ` <span style="font-weight:700; font-size:0.9rem; color:#059669; margin-left:8px;">All Shifts Completed</span>`;
        } else {
             headerHtml += ` <span style="font-weight:400; font-size:0.9rem; color:#6b7280; margin-left:5px;">(${completedCount} of ${totalCount} shifts Completed)</span>`;
        }
    }

    // STATIC HEADER (Not sticky, scrolls with content)
    html += `
    <div style="margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
        <h3 style="margin:0; font-size:1.1rem; color:#1f2937;">${headerHtml}</h3>
    </div>
    `;

    if (dayJobs.length === 0) {
        html += `
        <div style="text-align:center; padding: 40px; color: #9ca3af; background:white; border-radius:8px; border:1px dashed #e5e7eb;">
            <div style="font-size:2rem; margin-bottom:10px;">📅</div>
            No shifts scheduled for this day.
        </div>`;
    } else {
        dayJobs.forEach(job => {
            const startStr = formatTime(job.start);
            const endStr = formatTime(job.end);

            // Determine status/color logic similar to Day View
            const now = new Date();
            let borderCol = '#3b82f6'; // Blue (Scheduled)
            let statusText = '';

            if (job.status === 'Completed') {
                borderCol = '#10b981'; // Green
                const completedAt = job.actEnd ? formatTime(job.actEnd) : endStr;
                statusText = `<span style="color:#047857; font-weight:700;">✓ Completed at ${completedAt}</span>`;
            } else if (job.status === 'Started') {
                borderCol = '#f59e0b'; // Amber
                const startedAt = job.actStart ? formatTime(job.actStart) : startStr;
                statusText = `<span style="color:#b45309; font-weight:700;">▶ In Progress (Started ${startedAt})</span>`;
            } else {
                // Scheduled Check Late
                const lateTime = new Date(job.start.getTime() + (alertThreshold * 60000));
                if (now > lateTime) {
                    borderCol = '#ef4444'; // Red
                    statusText = `<span style="color:#dc2626; font-weight:700;">(LATE)</span>`;
                }
            }

            // Employee info
            const empName = job.employeeName || 'Unassigned';

            // Actual Times display + Duration
            let actualTimeDisplay = '';
            if (job.status === 'Completed' && job.actStart && job.actEnd) {
                const as = formatTime(job.actStart);
                const ae = formatTime(job.actEnd);

                const diff = job.actEnd - job.actStart;
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;

                actualTimeDisplay = ` <span style="font-weight:600; color:#059669; font-size:0.85rem;">(${as} - ${ae}) ${dur}</span>`;
            }

            html += `
            <div class="list-view-card" onclick="window.editJob({id:'${job.id}', accountId:'${job.accountId}', employeeId:'${job.employeeId}'})">
                <div class="list-card-status-bar" style="background-color: ${borderCol};"></div>
                <div class="list-card-content">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="font-weight:800; color:#111827; font-size:1rem;">
                            ${startStr} - ${endStr} ${statusText}
                        </div>
                    </div>

                    <div style="font-size:1rem; color:#4b5563; margin-top:4px; font-weight:600;">
                        ${job.accountName}
                    </div>

                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid #f3f4f6; display:flex; align-items:center; color:#6b7280; font-size:0.9rem;">
                         <span style="margin-right:6px;">👤</span>
                         <span>${empName}${actualTimeDisplay}</span>
                    </div>
                </div>
            </div>`;
        });
    }

    // Create 'Add Shift' button floating or at bottom
    html += `
    <div style="margin-top:10px; margin-bottom: 20px; text-align:center; padding: 0 12px;">
         <button onclick="window.showAssignShiftModal('09:00', '${dateStr}')" class="btn btn-primary" style="width:100%; max-width:400px; padding:12px; font-weight:bold;">
            + Add Shift to ${displayDate}
         </button>
    </div>
    `;

    html += `</div>`; // Close main wrapper

    grid.innerHTML = html;
    // Force scroll to top
    grid.scrollTop = 0;
}

// --- NEW: AUTO-SHORTEN DROPDOWNS ON MOBILE ---
window.optimizeMobileHeader = function() {
    const selects = document.querySelectorAll('#scheduler select');
    selects.forEach(s => {
        Array.from(s.options).forEach(o => {
            // Remove 'All ' from the beginning of text to save space
            o.text = o.text.replace(/^All\s+/, '');
        });
    });
};

// --- NEW: AUTO-SCROLL TO 4 PM (16:00) ---
window.initSchedulerScroll = function() {
    const container = document.querySelector('.scheduler-container');
    const grid = document.getElementById('schedulerGrid');

    if (!container || !grid) return;

    // Only scroll if we are in the Time Grid view (not List View)
    // We look for .time-slot or .calendar-view in the grid
    const hasTimeSlots = grid.querySelector('.time-slot') || grid.querySelector('.calendar-view');

    if (hasTimeSlots) {
        // The scheduler starts at 6 AM. 4 PM is 10 hours later.
        // 10 hours * 60px/hour = 600px.
        // We use a small timeout to ensure layout is done, but we check if we already scrolled
        setTimeout(() => {
             // Only scroll if scrollTop is near 0 (initial state)
             // This check prevents "fighting" the user if they have already scrolled manually
             if (container.scrollTop < 20) {
                 container.scrollTop = 600;
             }
        }, 100);
    }
};

window.setupSchedulerObserver = function() {
    const grid = document.getElementById('schedulerGrid');
    if (!grid) return;

    // Prevent multiple observers (Clean up previous instance)
    if (window._schedObs) {
        window._schedObs.disconnect();
        window._schedObs = null;
    }

    let debounceTimer;

    window._schedObs = new MutationObserver((mutations) => {
        // PERFORMANCE FIX: Debounce the scroll check.
        // This prevents the heavy scroll logic from running hundreds of times
        // if the DOM is being updated rapidly (e.g. during loading or drag-and-drop).
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            window.initSchedulerScroll();
        }, 300);
    });

    window._schedObs.observe(grid, { childList: true, subtree: true });
};


// --- INITIALIZATION & CLEANUP ---
// We use a flag to ensure we do not attach duplicate Event Listeners
// if this script is re-executed (e.g. by a React component re-mount or God Mode toggle).

if (!window._schedulerEventsAttached) {
    window.addEventListener('resize', window.optimizeMobileHeader);

    // Only attach 'load' if the document isn't ready yet.
    // If we are already loaded, we run the functions directly below.
    if (document.readyState === 'loading') {
        window.addEventListener('load', () => {
            window.optimizeMobileHeader();
            window.setupSchedulerObserver();
            window.initSchedulerScroll();
        });
    }

    window._schedulerEventsAttached = true;
}

// ALWAYS run these immediately when the script executes,
// because the DOM might be fresh (re-rendered).
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.optimizeMobileHeader();
    window.setupSchedulerObserver();
    window.initSchedulerScroll();
}



// Listen for load and resize to apply optimization
window.addEventListener('load', () => {
    window.optimizeMobileHeader();
    window.setupSchedulerObserver();
    window.initSchedulerScroll();
});
window.addEventListener('resize', window.optimizeMobileHeader);

// Also try to run immediately in case DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.optimizeMobileHeader();
    window.setupSchedulerObserver();
    window.initSchedulerScroll();
}


// --- NEW: AUTO-SHORTEN DROPDOWNS ON MOBILE ---
window.optimizeMobileHeader = function() {
    const selects = document.querySelectorAll('#scheduler select');
    selects.forEach(s => {
        Array.from(s.options).forEach(o => {
            // Remove 'All ' from the beginning of text to save space
            o.text = o.text.replace(/^All\s+/, '');
        });
    });
};

// --- NEW: AUTO-SCROLL TO 4 PM (16:00) ---
window.initSchedulerScroll = function() {
    const container = document.querySelector('.scheduler-container');
    const grid = document.getElementById('schedulerGrid');

    if (!container || !grid) return;

    // Only scroll if we are in the Time Grid view (not List View)
    // We look for .time-slot or .calendar-view in the grid
    const hasTimeSlots = grid.querySelector('.time-slot') || grid.querySelector('.calendar-view');

    if (hasTimeSlots) {
        // The scheduler starts at 6 AM. 4 PM is 10 hours later.
        // 10 hours * 60px/hour = 600px.
        setTimeout(() => {
             // Only scroll if scrollTop is near 0 (initial state)
             if (container.scrollTop < 20) {
                 container.scrollTop = 600;
             }
        }, 100);
    }
};

window.setupSchedulerObserver = function() {
    const grid = document.getElementById('schedulerGrid');
    if (!grid) return;

    // Prevent multiple observers
    if (window._schedObs) window._schedObs.disconnect();

    window._schedObs = new MutationObserver((mutations) => {
        // If content changed (e.g. view switch), try to scroll
        window.initSchedulerScroll();
    });

    window._schedObs.observe(grid, { childList: true, subtree: true });
};


// Listen for load and resize to apply optimization
window.addEventListener('load', () => {
    window.optimizeMobileHeader();
    window.setupSchedulerObserver();
    window.initSchedulerScroll();
});
window.addEventListener('resize', window.optimizeMobileHeader);

// Also try to run immediately in case DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.optimizeMobileHeader();
    window.setupSchedulerObserver();
    window.initSchedulerScroll();
}


// --- NEW HELPER: CREATE SHARED FILTER ROW ---
function ensureFilterRow() {
    let row = document.getElementById('schedulerFiltersRow');
    if (!row) {
        const header = document.querySelector('#scheduler .card-header');
        const viewToggles = document.querySelector('#scheduler .view-toggles');

        if (header) {
            row = document.createElement('div');
            row.id = 'schedulerFiltersRow';
            // CSS for side-by-side layout
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.style.width = '100%';
            row.style.marginBottom = '10px';

            // Clean up old individual containers if they exist (prevents duplicates)
            const old1 = document.getElementById('schedulerFilterContainer');
            const old2 = document.getElementById('schedulerAccountFilterContainer');
            if(old1) old1.remove();
            if(old2) old2.remove();

            if (viewToggles) {
                header.insertBefore(row, viewToggles);
            } else {
                header.appendChild(row);
            }
        }
    }
    return row;
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

// --- RENDER EMPLOYEE FILTER ---
function renderFilterDropdown(employees) {
    // 1. Use the new shared row
    const row = ensureFilterRow();
    if (!row) return;

    let select = document.getElementById('schedulerEmpFilterSelect');
    if (!select) {
        select = document.createElement('select');
        select.id = 'schedulerEmpFilterSelect';
        select.className = 'form-control';
        // 2. Add Flex styling
        select.style.flex = '1';
        select.style.minWidth = '0';
        select.style.padding = '6px';
        select.style.borderRadius = '6px';
        select.style.border = '1px solid #d1d5db';
        select.style.fontSize = '0.85rem';
        select.style.fontWeight = '600';

        select.onchange = function() { currentEmpFilter = this.value; window.loadScheduler(); };
        // 3. Append to ROW, not header
        row.appendChild(select);
    }

    // (Population logic remains the same)
    const currentSelection = select.value || currentEmpFilter;
    select.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'ALL'; allOpt.textContent = 'All Staff';
    select.appendChild(allOpt);
    employees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id; opt.textContent = `👤 ${emp.name}`;
        select.appendChild(opt);
    });
    select.value = currentSelection;
}

// --- RENDER ACCOUNT FILTER ---
function renderAccountDropdown(accounts) {
    // 1. Use the new shared row
    const row = ensureFilterRow();
    if (!row) return;

    let select = document.getElementById('schedulerAccFilterSelect');
    if (!select) {
        select = document.createElement('select');
        select.id = 'schedulerAccFilterSelect';
        select.className = 'form-control';
        // 2. Add Flex styling
        select.style.flex = '1';
        select.style.minWidth = '0';
        select.style.padding = '6px';
        select.style.borderRadius = '6px';
        select.style.border = '1px solid #d1d5db';
        select.style.fontSize = '0.85rem';
        select.style.fontWeight = '600';

        select.onchange = function() {
            currentAccountFilter = this.value;
            window.loadScheduler();
        };
        // 3. Append to ROW
        row.appendChild(select);
    }

    // (Population logic remains the same)
    const currentSelection = select.value || currentAccountFilter;
    select.innerHTML = '';

    const allOpt = document.createElement('option');
    allOpt.value = 'ALL';
    allOpt.textContent = 'All Locations';
    select.appendChild(allOpt);

    accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = acc.name;
        select.appendChild(opt);
    });

    select.value = currentSelection;
}

// --- 5. RENDERERS ---

function renderColorToggle() {
    let toggleContainer = document.getElementById('schedulerColorToggleContainer');
    if (!toggleContainer) {
        const header = document.querySelector('#scheduler .card-header');
        const viewToggles = document.querySelector('#scheduler .view-toggles');

        if (header && viewToggles) {
            toggleContainer = document.createElement('div');
            toggleContainer.id = 'schedulerColorToggleContainer';
            toggleContainer.style.marginRight = '15px';
            toggleContainer.style.display = 'flex';
            toggleContainer.style.alignItems = 'center';

            header.insertBefore(toggleContainer, viewToggles);
        }
    }
    const chk = document.getElementById('chkEmployeeColors');
    if(chk) chk.checked = showEmployeeColors;
}

window.toggleColorMode = function(checkbox) {
    showEmployeeColors = checkbox.checked;
    window.loadScheduler();
};

function scrollToNow() {
    const grid = document.getElementById('schedulerGrid');
    if (!grid) return;

    // Determine current hour
    const now = new Date();
    const currentHourDecimal = now.getHours() + (now.getMinutes() / 60);

    // Subtract START_HOUR to get relative position, then subtract 1 hour for context
    const scrollHour = Math.max(0, currentHourDecimal - START_HOUR - 0.5);

    grid.scrollTop = scrollHour * PIXELS_PER_HOUR;
}

function renderWeekView(jobs, alertThreshold, emailDelay, emailEnabled, accountAlarms) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;

    grid.style.overflow = 'auto';
    grid.style.display = 'block';
    grid.style.background = 'white'; // Reset background from list view
    grid.style.padding = '0';

    let html = '<div class="calendar-view" style="min-width: 1000px;">';
    html += generateTimeColumn();
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(window.currentDate);
        dayDate.setDate(window.currentDate.getDate() + i);
        html += renderDayColumn(dayDate, jobs, alertThreshold, emailDelay, emailEnabled, false, accountAlarms);
    }
    html += '</div>';
    grid.innerHTML = html;

    // Auto Scroll to Current Time
    scrollToNow();
}

function renderDayView(jobs, alertThreshold, emailDelay, emailEnabled, accountAlarms) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;

    grid.style.overflow = 'auto';
    grid.style.display = 'block';
    grid.style.background = 'white'; // Reset
    grid.style.padding = '0';

    let html = '<div class="calendar-view">';
    html += generateTimeColumn();
    html += renderDayColumn(window.currentDate, jobs, alertThreshold, emailDelay, emailEnabled, true, accountAlarms);
    html += '</div>';
    grid.innerHTML = html;

    // Auto Scroll to Current Time
    scrollToNow();
}

// --- 6. MONTH VIEW ---
function renderMonthView(jobs, alertThreshold, emailDelay, emailEnabled, accountAlarms) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;

    grid.style.overflow = 'hidden';
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.background = 'white';
    grid.style.padding = '0';

    const year = window.currentDate.getFullYear();
    const month = window.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const now = new Date();

    let iterator = new Date(firstDay);
    iterator.setDate(iterator.getDate() - iterator.getDay());

    let html = `
    <div style="
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        grid-template-rows: 30px repeat(6, 1fr);
        height: 100%;
        width: 100%;
        border-top: 1px solid #e5e7eb;
        border-left: 1px solid #e5e7eb;
        box-sizing: border-box;">
    `;

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    days.forEach(day => {
        html += `<div style="
            background: #f9fafb;
            color: #6b7280;
            font-size: 0.75rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            letter-spacing: 0.05em;
        ">${day}</div>`;
    });

    for(let i=0; i<42; i++) {
        const isCurrMonth = iterator.getMonth() === month;
        const dateStr = getLocalYMD(iterator);
        const isToday = isSameDay(iterator, now);

        const bg = isCurrMonth ? 'white' : '#fcfcfc';
        const opacity = isCurrMonth ? '1' : '0.4';

        let dateBubble = `<span style="font-size:0.85rem; font-weight:600; color:#374151; padding:4px;">${iterator.getDate()}</span>`;
        if (isToday) {
            dateBubble = `<span style="background: #2563eb; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; margin: 2px;">${iterator.getDate()}</span>`;
        }

        const dayJobs = jobs.filter(j => isSameDay(j.start, iterator));
        const groups = {};

        dayJobs.forEach(job => {
            const timeKey = formatTime(job.start);
            const key = `${job.accountId}_${timeKey}`;
            if(!groups[key]) {
                groups[key] = {
                    accId: job.accountId,
                    accName: job.accountName,
                    time: timeKey,
                    start: job.start,
                    status: 'Scheduled',
                    staff: []
                };
            }
            groups[key].staff.push(job);
            if(job.status === 'Started') groups[key].status = 'Started';
        });

        const groupArr = Object.values(groups).sort((a,b) => a.start - b.start);

        html += `
        <div class="month-cell"
             onclick="window.showAssignShiftModal('17:00', '${dateStr}')"
             style="background: ${bg}; opacity: ${opacity}; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; display: flex; flex-direction: column; overflow: hidden; position: relative; cursor: pointer; transition: background 0.1s;"
             onmouseover="this.style.background='#f3f4f6'"
             onmouseout="this.style.background='${bg}'">

             <div style="display:flex; justify-content:space-between; align-items:start;">
                ${dateBubble}
             </div>

             <div style="flex:1; padding:2px; display:flex; flex-direction:column; gap:2px; overflow:hidden; padding-bottom: 20px;">`;

        groupArr.forEach(g => {
            let border = '3b82f6'; let bgCol = 'e0f2fe'; let textCol = '1e40af';
            const allDone = g.staff.every(s => s.status === 'Completed');
            const anyActive = g.staff.some(s => s.status === 'Started');

            if(allDone) { border='10b981'; bgCol='dcfce7'; textCol='166534'; }
            else if(anyActive) { border='f59e0b'; bgCol='fffbeb'; textCol='b45309'; }
            else {
                const lateTime = new Date(g.start.getTime() + (alertThreshold * 60000));
                if (now > lateTime) {
                    border='ef4444'; bgCol='fee2e2'; textCol='991b1b';
                }
            }

            const countBadge = g.staff.length > 1 ? `<span style="background:rgba(255,255,255,0.5); padding:0 3px; border-radius:3px; font-size:0.65rem; margin-left:auto;">${g.staff.length}👥</span>` : '';

            html += `
            <div onclick="event.stopPropagation(); window.openGroupDetails('${dateStr}', '${g.accId}', '${g.time}')"
                 title="${g.accName} (${g.staff.length} Staff)"
                 style="background: #${bgCol}; color: #${textCol}; border-left: 3px solid #${border}; border-radius: 2px; padding: 2px 4px; font-size: 0.7rem; display: flex; flex-direction: column; line-height: 1.2; box-shadow: 0 1px 1px rgba(0,0,0,0.05);">
                 <div style="display:flex; align-items:center; font-weight:700; font-size:0.65rem; margin-bottom:1px;">
                    ${g.time} ${countBadge}
                 </div>
                 <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${g.accName}
                 </div>
            </div>`;
        });

        html += `</div>`;

        if (dayJobs.length > 0) {
            html += `
            <div style="position: absolute; bottom: 2px; right: 2px; font-size: 1.2rem; font-weight: bold; color: #6b7280; cursor: pointer; z-index: 10; width: 24px; height: 24px; display:flex; align-items:center; justify-content:center; border-radius:4px;"
                 onclick="event.stopPropagation(); window.showMobileDayDetails('${dateStr}')"
                 title="View Day Details"
                 onmouseover="this.style.background='#e5e7eb'; this.style.color='#374151'"
                 onmouseout="this.style.background='transparent'; this.style.color='#6b7280'">
                 +
            </div>`;
        }

        html += `</div>`;
        iterator.setDate(iterator.getDate() + 1);
    }

    html += `</div>`;
    grid.innerHTML = html;
}

// --- 7. HELPER: DAY DETAILS POPUP ---
window.showMobileDayDetails = function(dateStr) {
    const existing = document.getElementById('mobileDayPopup');
    if(existing) existing.remove();

    const targetDate = new Date(dateStr + 'T00:00:00');
    const allJobs = window.schedulerJobsCache || [];

    const dayJobs = allJobs.filter(j => {
        const d = j.start;
        return d.getDate() === targetDate.getDate() &&
               d.getMonth() === targetDate.getMonth() &&
               d.getFullYear() === targetDate.getFullYear();
    });

    const groups = {};
    dayJobs.forEach(job => {
        const timeKey = formatTime(job.start);
        const groupKey = `${job.accountId}_${timeKey}`;

        if(!groups[groupKey]) {
            groups[groupKey] = {
                accId: job.accountId,
                accName: job.accountName,
                time: timeKey,
                start: job.start,
                status: 'Scheduled',
                staff: []
            };
        }
        groups[groupKey].staff.push(job);
        if(job.status === 'Started') groups[groupKey].status = 'Started';
    });

    const groupArr = Object.values(groups).sort((a,b) => a.start - b.start);
    const displayDate = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    let content = `
    <div style="padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center;">
        <div>
            <h3 style="margin:0; color:#1e293b; font-size:1.1rem;">${displayDate}</h3>
            <div style="color:#64748b; font-size:0.85rem; margin-top:2px;">${groupArr.length} Locations Scheduled</div>
        </div>
        <button onclick="document.getElementById('mobileDayPopup').remove()" style="border:none; background:none; font-size:1.5rem; color:#94a3b8; cursor:pointer;">&times;</button>
    </div>
    <div style="padding:10px; max-height:60vh; overflow-y:auto; background:white;">`;

    if (groupArr.length === 0) {
        content += `<div style="text-align:center; padding:30px; color:#94a3b8;">No shifts scheduled for this day.</div>`;
    } else {
        groupArr.forEach(g => {
            let border = '4px solid #3b82f6';
            let badge = `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:600;">Scheduled</span>`;

            const allDone = g.staff.every(s => s.status === 'Completed');
            const anyActive = g.staff.some(s => s.status === 'Started');

            if(allDone) {
                border = '4px solid #10b981';
                badge = `<span style="background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:600;">Completed</span>`;
            } else if(anyActive) {
                border = '4px solid #f59e0b';
                badge = `<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:600;">In Progress</span>`;
            }

            const names = g.staff.map(s => s.employeeName.split(' ')[0]).join(', ');

            content += `
            <div style="margin-bottom:10px; border:1px solid #e2e8f0; border-left:${border}; border-radius:4px; overflow:hidden; background:white; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.03);"
                 onclick="window.openGroupDetails('${dateStr}', '${g.accId}', '${g.time}'); document.getElementById('mobileDayPopup').remove();">

                <div style="padding:10px; display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <div style="font-weight:700; color:#1e293b; font-size:0.95rem;">${g.accName}</div>
                        <div style="color:#64748b; font-size:0.85rem; margin-top:2px;">
                            ⏰ ${g.time}
                        </div>
                    </div>
                    ${badge}
                </div>

                <div style="background:#f8fafc; padding:6px 10px; border-top:1px solid #f1f5f9; font-size:0.8rem; color:#475569; display:flex; align-items:center; gap:5px;">
                    <span style="font-size:0.9rem;">👥</span> ${names}
                </div>
            </div>`;
        });
    }

    content += `</div>
    <div style="padding:15px; background:#f8fafc; border-top:1px solid #e2e8f0; border-radius:0 0 8px 8px;">
        <button onclick="window.showAssignShiftModal('09:00', '${dateStr}'); document.getElementById('mobileDayPopup').remove();"
                style="width:100%; padding:10px; background:#3b82f6; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer;">
            + Add New Shift
        </button>
    </div>`;

    const overlay = document.createElement('div');
    overlay.id = 'mobileDayPopup';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 99999;
        display: flex; justify-content: center; align-items: center;
        backdrop-filter: blur(1px);
    `;

    overlay.innerHTML = `
        <div style="background:white; width:90%; max-width:450px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.15s ease-out; display:flex; flex-direction:column; max-height:85vh;">
            ${content}
        </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `@keyframes popIn { from { transform: scale(0.98); opacity: 0; } to { transform: scale(1); opacity: 1; } }`;
    overlay.appendChild(style);

    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); }
    document.body.appendChild(overlay);
};

window.openGroupDetails = function(dateStr, accountId, timeStr) {
    const existing = document.getElementById('groupDetailPopup');
    if(existing) existing.remove();

    const allJobs = window.schedulerJobsCache || [];
    const targetDate = new Date(dateStr + 'T00:00:00');

    const groupJobs = allJobs.filter(j => {
        return isSameDay(j.start, targetDate) &&
               j.accountId === accountId &&
               formatTime(j.start) === timeStr.split(' - ')[0];
    });

    if (groupJobs.length === 0) return;

    const firstJob = groupJobs[0];
    const accName = firstJob.accountName;
    const niceDate = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const preAccId = firstJob.accountId;
    const preStartTime = get24hTime(firstJob.start);
    const preEndTime = get24hTime(firstJob.end);
    const existingEmpIds = groupJobs.map(j => j.employeeId).join(',');

    let content = `
    <div style="padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0; border-radius:8px 8px 0 0;">
        <h3 style="margin:0; color:#1e293b; font-size:1.1rem;">${accName}</h3>
        <div style="color:#64748b; font-size:0.9rem; margin-top:2px;">${niceDate} @ ${timeStr}</div>
        <button onclick="document.getElementById('groupDetailPopup').remove()" style="position:absolute; top:15px; right:15px; border:none; background:none; font-size:1.5rem; color:#94a3b8; cursor:pointer;">&times;</button>
    </div>
    <div style="padding:10px; max-height:400px; overflow-y:auto;">
        <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; margin-bottom:8px; padding-left:5px;">Staff Assigned (${groupJobs.length})</div>
    `;

    groupJobs.forEach(job => {
        let statusColor = '#3b82f6';
        let timeInfo = '';

        if (job.status === 'Completed') {
            statusColor = '#10b981';
            if (job.actStart && job.actEnd) {
                const s = job.actStart.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
                const e = job.actEnd.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});

                const diff = (job.actEnd - job.actStart) / 1000 / 60; // minutes
                const h = Math.floor(diff / 60);
                const m = Math.round(diff % 60);
                const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;

                timeInfo = `<div style="font-size:0.7rem; color:#047857; margin-top:2px; font-family:monospace;">${s} - ${e} (${dur})</div>`;
            }
        } else if (job.status === 'Started') {
            statusColor = '#f59e0b';
             if(job.actStart) {
                const s = job.actStart.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
                timeInfo = `<div style="font-size:0.7rem; color:#b45309; margin-top:2px;">In: ${s}</div>`;
             }
        }

        content += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:white; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:10px; height:10px; border-radius:50%; background:${statusColor}; flex-shrink:0;" title="${job.status}"></div>
                <div>
                    <div style="font-weight:600; color:#334155;">${job.employeeName}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${job.status}</div>
                    ${timeInfo}
                </div>
            </div>

            <div style="display:flex; gap:5px;">
                <button onclick="window.quickOverride('${job.id}')"
                        class="btn-xs"
                        title="Mark Completed"
                        style="background:#dcfce7; border:1px solid #86efac; color:#166534; padding:5px 8px; font-weight:600; cursor:pointer; border-radius:4px; font-size:0.7rem;">
                    Override
                </button>

                <button onclick="window.editJob({id:'${job.id}', accountId:'${job.accountId}', employeeId:'${job.employeeId}'}); document.getElementById('groupDetailPopup').remove();"
                        class="btn-xs"
                        title="Edit Details"
                        style="background:white; border:1px solid #cbd5e1; color:#475569; padding:5px 8px; cursor:pointer; border-radius:4px; font-size:0.7rem;">
                    Edit
                </button>
            </div>
        </div>`;
    });

    content += `
    </div>
    <div style="padding:10px; background:#f8fafc; border-top:1px solid #e2e8f0; border-radius:0 0 8px 8px; text-align:center;">
        <button onclick="window.showAssignShiftModal('${preStartTime}', '${dateStr}', '${preAccId}', '${preEndTime}', '${existingEmpIds}'); document.getElementById('groupDetailPopup').remove();"
                style="background:#3b82f6; color:white; border:none; padding:8px 15px; border-radius:4px; font-weight:600; cursor:pointer; width:100%;">
            + Manage Roster
        </button>
    </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'groupDetailPopup';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(1px);`;
    overlay.innerHTML = `<div style="background:white; width:90%; max-width:400px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.2); position:relative;">${content}</div>`;
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); }
    document.body.appendChild(overlay);
};

function renderDayColumn(dateObj, jobs, alertThreshold, emailDelay, emailEnabled, isSingleDay = false, accountAlarms = {}) {
    const dateStr = getLocalYMD(dateObj);
    const displayDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    const now = new Date();
    const isToday = isSameDay(dateObj, now);
    const activeClass = (isToday && !isSingleDay) ? ' today-active' : '';

    const dayJobs = jobs.filter(j => isSameDay(j.start, dateObj));

    // --- Grouping Logic ---
    const groups = {};
    dayJobs.forEach(job => {
        const startStr = formatTime(job.start);
        const endStr = formatTime(job.end);
        const groupKey = `${job.accountId}_${startStr}_${endStr}`;

        if (!groups[groupKey]) {
            groups[groupKey] = {
                accId: job.accountId,
                accName: job.accountName || "Unknown Account",
                start: job.start,
                end: job.end,
                timeStr: `${startStr} - ${endStr}`,
                simpleTime: startStr,
                staff: [],
                status: 'Scheduled',
                hasAlarm: !!accountAlarms[job.accountId]
            };
        }
        groups[groupKey].staff.push(job);
        if (job.status === 'Started') groups[groupKey].status = 'Started';
    });

    const groupArr = Object.values(groups).sort((a, b) => a.start - b.start);

    // --- Collision Logic ---
    const columns = [];
    groupArr.forEach(group => {
        let placed = false;
        for(let i = 0; i < columns.length; i++) {
            const lastInCol = columns[i][columns[i].length - 1];
            if (group.start >= lastInCol.end) {
                columns[i].push(group);
                group.colIndex = i;
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([group]);
            group.colIndex = columns.length - 1;
        }
    });

    const totalCols = columns.length || 1;
    const colWidth = 94 / totalCols;

    // --- RENDER HTML ---
    let html = `<div class="calendar-day-col${activeClass}" style="${isSingleDay ? 'flex:1;' : ''}" data-date="${dateStr}">`;
    html += `<div class="cal-header">${displayDate}</div>`;

    // FIX: Force height using backticks for the string
    const slotHeight = HOURS_TO_RENDER * PIXELS_PER_HOUR;
    html += `<div class="day-slots" style="height:${slotHeight}px; position:relative; min-height:100%;">`;

    groupArr.forEach(group => {
        const startHour = group.start.getHours() + (group.start.getMinutes() / 60);
        let endHour = group.end.getHours() + (group.end.getMinutes() / 60);
        if (group.end.getDate() !== group.start.getDate()) endHour += 24;

        let duration = endHour - startHour;
        if(duration < 0.25) duration = 0.25; // Min 15 mins visual

        const topPx = (startHour - START_HOUR) * PIXELS_PER_HOUR;
        const heightPx = Math.max(duration * PIXELS_PER_HOUR, 30); // Min height visual
        const leftPos = 3 + (group.colIndex * colWidth);

        let bgCol = 'e0f2fe'; let borderCol = '3b82f6'; let textCol = '1e40af';
        const allDone = group.staff.every(s => s.status === 'Completed');
        const anyActive = group.staff.some(s => s.status === 'Started');

        if (allDone) { bgCol = 'dcfce7'; borderCol = '10b981'; textCol = '166534'; }
        else if (anyActive) { bgCol = 'fffbeb'; borderCol = 'f59e0b'; textCol = 'b45309'; }
        else if (now > new Date(group.start.getTime() + alertThreshold * 60000)) {
            bgCol = 'fee2e2'; borderCol = 'ef4444'; textCol = '991b1b';
        }

        const alarmIcon = group.hasAlarm ? '🔒' : '';
        const staffCount = group.staff.length;
        const staffBadge = staffCount > 1
            ? `<span style="background:rgba(255,255,255,0.6); padding:1px 5px; border-radius:4px; font-weight:bold; margin-left:auto;">${staffCount} Staff</span>`
            : `<div style="font-size:0.75rem; opacity:0.9; margin-left:auto;">👤 ${group.staff[0].employeeName.split(' ')[0]}</div>`;

        html += `
        <div class="day-event"
             style="top:${topPx}px; height:${heightPx}px; width:${colWidth}%; left:${leftPos}%;
                    background-color:#${bgCol}; border-left:4px solid #${borderCol}; color:#${textCol};
                    z-index: ${20 + group.colIndex};"
             onclick="event.stopPropagation(); window.openGroupDetails('${dateStr}', '${group.accId}', '${group.simpleTime}')"
             title="${group.accName}">

            <div class="event-time">
                <span>${group.simpleTime}</span>
                <span>${alarmIcon}</span>
            </div>
            <div class="event-title">
                ${group.accName}
            </div>
            <div style="display:flex; align-items:center; margin-top:auto;">${staffBadge}</div>

            <div class="resize-handle"></div>
        </div>`;
    });

    html += `</div></div>`;
    return html;
}

function generateTimeColumn() {
    let html = '<div class="calendar-time-col">';
    html += '<div class="cal-header" style="background:#f9fafb; border-bottom:1px solid #e5e7eb;"></div>';
    for (let h = 0; h < HOURS_TO_RENDER; h++) {
        let actualHour = h + START_HOUR;
        let displayH = actualHour % 24;
        let label = (displayH === 0) ? '12 AM' : (displayH < 12 ? `${displayH} AM` : (displayH === 12 ? '12 PM' : `${displayH - 12} PM`));
        if (actualHour >= 24) label += ' <span style="font-size:0.6rem; display:block; opacity:0.6;">(+1)</span>';
        html += `<div class="time-slot" data-hour-index="${h}">${label}</div>`;
    }
    html += '</div>';
    return html;
}

// --- CURRENT TIME LINE INDICATOR ---
function startCurrentTimeLine() {
    // 1. Initial Render
    renderCurrentTimeLine();

    // 2. Setup Interval (Update every 60s)
    if(timeLineInterval) clearInterval(timeLineInterval);
    timeLineInterval = setInterval(renderCurrentTimeLine, 60000);
}

function stopCurrentTimeLine() {
    if(timeLineInterval) clearInterval(timeLineInterval);
}

function renderCurrentTimeLine() {
    // Clean up old lines
    document.querySelectorAll('.current-time-line').forEach(el => el.remove());

    // Only render on Today's column if visible
    const today = new Date();
    const dateStr = getLocalYMD(today);

    const dayCol = document.querySelector(`.calendar-day-col[data-date="${dateStr}"]`);
    if(!dayCol) return;

    const slotContainer = dayCol.querySelector('.day-slots');
    if(!slotContainer) return;

    // Calculate Position
    const currentHour = today.getHours() + (today.getMinutes() / 60);

    // If before start hour (e.g. 4am when start is 6am), don't show
    if (currentHour < START_HOUR) return;

    const topPx = (currentHour - START_HOUR) * PIXELS_PER_HOUR;

    const line = document.createElement('div');
    line.className = 'current-time-line';
    line.style.top = `${topPx}px`;

    slotContainer.appendChild(line);
}

window.quickOverride = async function(jobId) {
    if(!confirm("Mark this shift as COMPLETED now?")) return;

    try {
        const docRef = db.collection('jobs').doc(jobId);
        const doc = await docRef.get();
        const data = doc.data();

        const updateData = { status: 'Completed' };

        if(!data.actualStartTime) updateData.actualStartTime = data.startTime;
        if(!data.actualEndTime) updateData.actualEndTime = data.endTime;

        await docRef.update(updateData);

        window.showToast("Shift Overridden: Completed ✅");

        const popup = document.getElementById('groupDetailPopup');
        if(popup) popup.remove();
        window.loadScheduler();

    } catch(e) {
        alert("Error: " + e.message);
    }
};

function setupInteractions() {
    const grid = document.getElementById('schedulerGrid');
    if(grid._mouseDownHandler) grid.removeEventListener('mousedown', grid._mouseDownHandler);

    let activeEl = null;
    let mode = null;
    let startY = 0;
    let startX = 0;
    let initialTop = 0;
    let initialHeight = 0;
    let draggedColDate = null;

    // Create Drag State
    let ghostEl = null;
    let createStartPixel = 0;

    const onMouseDown = (e) => {
        // A. Existing Shift Move/Resize
        const handle = e.target.closest('.resize-handle');
        const eventEl = e.target.closest('.day-event');

        if (eventEl && !eventEl.classList.contains('done')) {
            if(e.button !== 0) return;

            activeEl = eventEl;
            startY = e.clientY;
            initialTop = activeEl.offsetTop;
            initialHeight = activeEl.offsetHeight;

            if (handle) {
                mode = 'resize';
                document.body.style.cursor = 'ns-resize';
                e.preventDefault(); e.stopPropagation();
            } else {
                mode = 'potential_drag';
            }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            return;
        }

        // B. Drag-to-Create (Create Shift)
        const daySlots = e.target.closest('.day-slots');
        if (daySlots) {
            // Check if we clicked on an empty area
            const dayCol = daySlots.closest('.calendar-day-col');
            if (!dayCol) return;

            draggedColDate = dayCol.getAttribute('data-date');
            const rect = daySlots.getBoundingClientRect();
            createStartPixel = e.clientY - rect.top; // Relative Y

            // Snap to grid (15 mins)
            createStartPixel = Math.round(createStartPixel / SNAP_PIXELS) * SNAP_PIXELS;

            mode = 'create_drag';
            startY = e.clientY;
            startX = e.clientX;

            // Create Ghost Element
            ghostEl = document.createElement('div');
            ghostEl.className = 'preview-event';
            ghostEl.style.top = `${createStartPixel}px`;
            ghostEl.style.height = `${SNAP_PIXELS}px`; // Default to 15m
            ghostEl.style.left = '5%';
            ghostEl.style.width = '90%';
            ghostEl.textContent = 'New Shift';

            daySlots.appendChild(ghostEl);

            e.preventDefault();
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    };

    const onMouseMove = (e) => {
        const deltaY = e.clientY - startY;

        // 1. Existing Move/Resize Logic
        if (activeEl) {
            if (mode === 'potential_drag' && Math.abs(deltaY) > 5) {
                mode = 'drag';
                activeEl.classList.add('dragging');
                activeEl.style.zIndex = '1000';
                activeEl.style.width = activeEl.getBoundingClientRect().width + 'px';
                document.body.style.cursor = 'grabbing';
            }

            if (mode === 'resize') {
                const snappedDelta = Math.round(deltaY / SNAP_PIXELS) * SNAP_PIXELS;
                const newHeight = Math.max(30, initialHeight + snappedDelta);
                activeEl.style.height = `${newHeight}px`;
            } else if (mode === 'drag') {
                const snappedDeltaY = Math.round(deltaY / SNAP_PIXELS) * SNAP_PIXELS;
                const newTop = Math.max(0, initialTop + snappedDeltaY);
                activeEl.style.top = `${newTop}px`;
            }
        }

        // 2. Drag-to-Create Logic
        else if (mode === 'create_drag' && ghostEl) {
            const snappedDelta = Math.round(deltaY / SNAP_PIXELS) * SNAP_PIXELS;

            // Allow dragging down (increase height)
            if (snappedDelta >= 0) {
                const newHeight = Math.max(SNAP_PIXELS, SNAP_PIXELS + snappedDelta);
                ghostEl.style.height = `${newHeight}px`;
                ghostEl.style.top = `${createStartPixel}px`;
            } else {
                // Dragging up (inverted)
                const newTop = createStartPixel + snappedDelta;
                const newHeight = Math.abs(snappedDelta);
                ghostEl.style.top = `${newTop}px`;
                ghostEl.style.height = `${newHeight}px`;
            }

            // Calculate text preview
            const topPx = parseInt(ghostEl.style.top);
            const heightPx = parseInt(ghostEl.style.height);

            const startHourVal = START_HOUR + (topPx / PIXELS_PER_HOUR);
            const endHourVal = startHourVal + (heightPx / PIXELS_PER_HOUR);

            const formatH = (dec) => {
                const h = Math.floor(dec);
                const m = Math.round((dec - h) * 60);
                return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            };

            ghostEl.textContent = `${formatH(startHourVal)} - ${formatH(endHourVal)}`;
        }
    };

    const onMouseUp = async (e) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';

        // 1. Finish Create Drag
        if (mode === 'create_drag' && ghostEl) {
            // Calculate Times based on pixel values
            const topPx = parseInt(ghostEl.style.top);
            const heightPx = parseInt(ghostEl.style.height);

            // Min duration check (e.g. accidental click)
            if (heightPx < 10) {
                ghostEl.remove();
                ghostEl = null; mode = null; return;
            }

            const startHourVal = START_HOUR + (topPx / PIXELS_PER_HOUR);
            const endHourVal = startHourVal + (heightPx / PIXELS_PER_HOUR);

            // Helper to format HH:MM
            const formatH = (dec) => {
                let h = Math.floor(dec);
                let m = Math.round((dec - h) * 60);
                if (m === 60) { m = 0; h += 1; }
                return `${String(h % 24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            };

            const sTime = formatH(startHourVal);
            const eTime = formatH(endHourVal);

            // Cleanup ghost
            ghostEl.remove();
            ghostEl = null;
            mode = null;

            // Open Modal
            window.showAssignShiftModal(sTime, draggedColDate, null, eTime);
            return;
        }

        // 2. Finish existing Drag/Resize
        if (!activeEl) return;
        if (mode === 'potential_drag') { activeEl = null; mode = null; return; }

        const jobId = activeEl.dataset.id;
        // In this implementation, we just reload to snap back because full drag logic is complex without ID tracking in the DOM elements
        // Ideally, you would calculate the new time here and save to DB

        // For now, since we improved creation, let's just reset the view
        window.loadScheduler();

        activeEl = null; mode = null;
    };

    grid._mouseDownHandler = onMouseDown;
    grid.addEventListener('mousedown', onMouseDown);
}

function attachRowHighlighter() {
    const grid = document.getElementById('schedulerGrid');
    if (grid._highlightHandler) {
        grid.removeEventListener('mousemove', grid._highlightHandler);
        grid.removeEventListener('mouseleave', grid._clearHighlightHandler);
    }
    const moveHandler = function(e) {
        const firstSlot = document.querySelector('.time-slot[data-hour-index="0"]');
        if (!firstSlot) return;
        const rect = firstSlot.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        if (offsetY < 0) { clearHighlights(); return; }
        const index = Math.floor(offsetY / 60);
        if (grid._lastHighlightIndex === index) return;
        grid._lastHighlightIndex = index;
        clearHighlights();
        const target = document.querySelector(`.time-slot[data-hour-index="${index}"]`);
        if (target) { target.classList.add('active-time'); }
    };
    const clearHighlights = function() {
        document.querySelectorAll('.time-slot.active-time').forEach(el => { el.classList.remove('active-time'); });
        grid._lastHighlightIndex = -1;
    };
    grid._highlightHandler = moveHandler;
    grid._clearHighlightHandler = clearHighlights;
    grid.addEventListener('mousemove', moveHandler);
    grid.addEventListener('mouseleave', clearHighlights);
}

function attachDblClickListeners() {
    // We use "click" instead of "dblclick" for better mobile support
    document.querySelectorAll('.calendar-day-col').forEach(dayCol => {
        dayCol.removeEventListener('click', dblClickHandler); // Clean up
        dayCol.addEventListener('click', dblClickHandler);    // Attach new
    });

    // (Optional: Month view double click remains)
    const monthView = document.querySelector('.calendar-month-view');
    if (monthView) {
        monthView.removeEventListener('dblclick', dblClickHandler);
        monthView.addEventListener('dblclick', dblClickHandler);
    }
}

function dblClickHandler(event) {
    // Safety: If they clicked a shift/event, ignore (handled by the event's onclick)
    if (event.target.closest('.day-event')) return;

    // Double Click is now legacy, but we keep it for accessibility if Drag fails
    // However, the single-click listener interferes with drag.
    // Let's rely on Drag-to-Create as primary.
}

function updateHeaderUI() {
    const label = document.getElementById('weekRangeDisplay');
    if(!label) return;
    if (window.currentView === 'day' || window.currentView === 'list') {
        label.textContent = window.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    } else if (window.currentView === 'month') {
        label.textContent = window.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
        const endOfWeek = new Date(window.currentDate);
        endOfWeek.setDate(window.currentDate.getDate() + 6);
        label.textContent = `${window.currentDate.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
    }
    document.querySelectorAll('.btn-view-toggle').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === window.currentView);
    });
}

// Make sure this starts with "window."
window.changeView = function(viewName) {
    window.currentView = viewName;

    // Update Button Styling (Active State)
    document.querySelectorAll('.btn-view-toggle').forEach(btn => {
        btn.classList.remove('active');
        if(btn.dataset.view === viewName) btn.classList.add('active');
    });

    window.loadScheduler();
};

// Make sure this starts with "window."
window.changePeriod = function(direction) {
    const d = window.currentDate;

    if (window.currentView === 'day' || window.currentView === 'list') {
        d.setDate(d.getDate() + direction);
    } else if (window.currentView === 'week') {
        d.setDate(d.getDate() + (direction * 7));
    } else if (window.currentView === 'month') {
        d.setMonth(d.getMonth() + direction);
    }

    window.currentDate = new Date(d); // Force update
    window.loadScheduler();
};

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

function formatTime(date) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

window.saveScheduleSettings = async function() {
    if (!window.currentUser) return;
    const emailDelayMinutes = parseInt(document.getElementById('editEmailDelay').value) || 60;
    const emailAlertsEnabled = document.getElementById('editEmailEnabled').checked;
    await db.collection('users').doc(window.currentUser.uid).set({ emailDelayMinutes, emailAlertsEnabled }, { merge: true });
    window.showToast("Settings updated!");
    window.loadScheduler();
};

window.toggleRecurrenceOptions = function() {
    const isChecked = document.getElementById('shiftRepeat').checked;
    document.getElementById('recurrenceOptions').style.display = isChecked ? 'block' : 'none';
};
window.toggleRecurrenceDay = function(btn) { btn.classList.toggle('selected'); };

// --- MANUAL SHIFT & DROPDOWN LOGIC ---

async function renderEmployeeCheckboxes(containerId, selectedIds = [], busyMap = {}) {
    const container = document.getElementById(containerId);
    if(!container) return;

    if (container.innerHTML === '') container.innerHTML = '<div style="padding:10px; color:#999;">Loading team...</div>';

    try {
        const snap = await db.collection('employees')
            .where('owner', '==', window.currentUser.email)
            .where('status', '==', 'Active')
            .orderBy('name').get();

        container.innerHTML = '';
        if (snap.empty) {
            container.innerHTML = '<div style="padding:10px; color:#666; font-style:italic;">No active employees found.</div>';
            return;
        }

        snap.forEach(doc => {
            const e = doc.data();
            const isChecked = selectedIds.includes(doc.id) ? 'checked' : '';

            const isBusy = busyMap.hasOwnProperty(doc.id);
            const busyLocation = isBusy ? busyMap[doc.id] : '';

            const disabledClass = isBusy ? 'disabled' : '';
            const disabledAttr = isBusy ? 'disabled' : '';

            const busyHtml = isBusy ? `<span class="busy-tag">🔴 Busy at ${busyLocation}</span>` : '';

            const div = document.createElement('div');
            div.className = `multi-select-item ${disabledClass}`;
            div.innerHTML = `
                <label>
                    <input type="checkbox" value="${doc.id}" data-name="${e.name}" ${isChecked} ${disabledAttr}>
                    <span>${e.name}</span>
                    ${busyHtml}
                </label>`;
            container.appendChild(div);
        });
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div style="padding:10px; color:red;">Error loading list.</div>';
    }
}

async function updateAvailabilityUI() {
    const sDate = document.getElementById('shiftStartDate').value;
    const sTime = document.getElementById('shiftStartTime').value;
    const eTime = document.getElementById('shiftEndTime').value;
    const currentShiftId = document.getElementById('shiftId').value;
    const container = document.getElementById('shiftEmployeeContainer');

    if (!sDate || !sTime || !eTime) return;

    let selectedIds = [];
    const currentCheckboxes = document.querySelectorAll('#shiftEmployeeContainer input:checked');
    if (currentCheckboxes.length > 0) {
        selectedIds = Array.from(currentCheckboxes).map(c => c.value);
    } else if (container.dataset.preselected) {
        try {
            selectedIds = JSON.parse(container.dataset.preselected);
            delete container.dataset.preselected;
        } catch(e) {}
    }

    const start = new Date(`${sDate}T${sTime}:00`);
    let end = new Date(`${sDate}T${eTime}:00`);
    if (end <= start) end.setDate(end.getDate() + 1);

    try {
        const dayStart = new Date(start); dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(start); dayEnd.setDate(dayEnd.getDate()+2);

        const snap = await db.collection('jobs')
            .where('owner', '==', window.currentUser.email)
            .where('startTime', '>=', firebase.firestore.Timestamp.fromDate(dayStart))
            .where('startTime', '<=', firebase.firestore.Timestamp.fromDate(dayEnd))
            .get();

        const busyMap = {};

        snap.forEach(doc => {
            if (doc.id === currentShiftId) return;
            const job = doc.data();
            if (job.status === 'Completed') return;

            const jobStart = job.startTime.toDate();
            const jobEnd = job.endTime.toDate();

            if (start < jobEnd && end > jobStart) {
                busyMap[job.employeeId] = job.accountName;
            }
        });

        await renderEmployeeCheckboxes('shiftEmployeeContainer', selectedIds, busyMap);

    } catch (e) {
        console.error("Conflict check failed:", e);
    }
}

async function populateDropdowns() {
    const accSelect = document.getElementById('shiftAccount');
    const empContainer = document.getElementById('shiftEmployeeContainer');
    const startSelect = document.getElementById('shiftStartTime');
    const endSelect = document.getElementById('shiftEndTime');
    const actStartSelect = document.getElementById('actStartTime');
    const actEndSelect = document.getElementById('actEndTime');

    if (!accSelect || !startSelect || !endSelect) return;

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
        const fill = (sel) => {
            if(!sel) return;
            sel.innerHTML = '<option value="">-- Select --</option>';
            times.forEach(t => sel.add(new Option(t.text, t.val)));
        };
        fill(startSelect); fill(endSelect); fill(actStartSelect); fill(actEndSelect);

        const autoInc = (source, target) => {
             const val = source.value; if(!val) return;
             let [h, m] = val.split(':').map(Number);
             h = (h + 1) % 24;
             if(target) target.value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        };
        startSelect.addEventListener('change', () => autoInc(startSelect, endSelect));
        if(actStartSelect) actStartSelect.addEventListener('change', () => autoInc(actStartSelect, actEndSelect));
    }

    if (accSelect.options.length <= 1 && window.currentUser) {
        accSelect.innerHTML = '<option value="">Select Account...</option>';
        try {
            const accSnap = await db.collection('accounts').where('owner', '==', window.currentUser.email).orderBy('name').get();
            accSnap.forEach(doc => accSelect.appendChild(new Option(doc.data().name, doc.id)));
        } catch (e) { console.error("Dropdown load error:", e); }
    }

    if (empContainer && empContainer.innerHTML === '') {
        await renderEmployeeCheckboxes('shiftEmployeeContainer');
    }
}

// --- 9. MANUAL SHIFT: CREATE MODE ---
window.showAssignShiftModal = async function(startTime = "17:00", dateStr = null, preAccountId = null, preEndTime = null, preEmpIds = null) {
    document.getElementById('shiftModal').style.display = 'flex';
    document.getElementById('shiftModalTitle').textContent = "Assign Shift";
    document.getElementById('shiftId').value = "";
    document.getElementById('btnDeleteShift').style.display = 'none';
    document.getElementById('manualTimeSection').style.display = 'none';

    document.getElementById('actDate').value = '';
    document.getElementById('actStartTime').value = '';
    document.getElementById('actEndTime').value = '';

    document.getElementById('shiftEmployeeContainer').style.display = 'block';
    document.getElementById('shiftEmployeeReadOnly').style.display = 'none';

    const container = document.getElementById('shiftEmployeeContainer');
    let initialIds = [];
    if (preEmpIds) initialIds = preEmpIds.split(',');
    container.dataset.preselected = JSON.stringify(initialIds);

    await populateDropdowns();

    if (dateStr) document.getElementById('shiftStartDate').value = dateStr;
    else document.getElementById('shiftStartDate').value = getLocalYMD(new Date());

    document.getElementById('shiftStartTime').value = startTime;

    if (preEndTime) {
        document.getElementById('shiftEndTime').value = preEndTime;
    } else {
        let [h, m] = startTime.split(':').map(Number);
        h = (h + 1) % 24;
        document.getElementById('shiftEndTime').value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    if (preAccountId) document.getElementById('shiftAccount').value = preAccountId;
    else document.getElementById('shiftAccount').value = "";

    const inputs = ['shiftStartDate', 'shiftStartTime', 'shiftEndTime'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.removeEventListener('change', updateAvailabilityUI);
        el.addEventListener('change', updateAvailabilityUI);
    });

    await updateAvailabilityUI();
};

window.openShiftModal = function(dateObj) {
    window.showAssignShiftModal("17:00", getLocalYMD(dateObj));
};

window.editJob = async function(job) {
    if(!job.start) {
        const doc = await db.collection('jobs').doc(job.id).get();
        const data = doc.data();
        job = {
            id: doc.id, ...data,
            start: data.startTime.toDate(), end: data.endTime.toDate(),
            actStart: data.actualStartTime ? data.actualStartTime.toDate() : null,
            actEnd: data.actualEndTime ? data.actualEndTime.toDate() : null
        };
    }
    document.getElementById('shiftModal').style.display = 'flex';
    document.getElementById('shiftModalTitle').textContent = "Edit Shift";
    document.getElementById('shiftId').value = job.id;
    document.getElementById('btnDeleteShift').style.display = 'inline-block';
    document.getElementById('manualTimeSection').style.display = 'block';

    document.getElementById('shiftEmployeeContainer').style.display = 'none';
    const ro = document.getElementById('shiftEmployeeReadOnly');
    ro.style.display = 'block';
    ro.value = job.employeeName || 'Unknown';

    await populateDropdowns();

    document.getElementById('shiftAccount').value = job.accountId;
    document.getElementById('shiftStatus').value = job.status || 'Scheduled';

    const getHM = (d) => {
        const h = String(d.getHours()).padStart(2,'0');
        const m = String(Math.round(d.getMinutes()/15)*15).padStart(2,'0');
        return `${h}:${m === '60' ? '00' : m}`;
    };

    document.getElementById('shiftStartDate').value = getLocalYMD(job.start);
    document.getElementById('shiftStartTime').value = getHM(job.start);
    document.getElementById('shiftEndTime').value = getHM(job.end);

    if(job.actStart) {
        document.getElementById('actDate').value = getLocalYMD(job.actStart);
        document.getElementById('actStartTime').value = getHM(job.actStart);
    } else { document.getElementById('actDate').value = ''; document.getElementById('actStartTime').value = ''; }

    if(job.actEnd) { document.getElementById('actEndTime').value = getHM(job.actEnd); }
    else { document.getElementById('actEndTime').value = ''; }
};

window.autoFillCompleted = function() {
    const sDate = document.getElementById('shiftStartDate').value;
    const sTime = document.getElementById('shiftStartTime').value;
    const eTime = document.getElementById('shiftEndTime').value;

    if (!sDate || !sTime || !eTime) {
        return alert("Please ensure the Scheduled Date and Times are set first.");
    }
    document.getElementById('actDate').value = sDate;
    document.getElementById('actStartTime').value = sTime;
    document.getElementById('actEndTime').value = eTime;
    document.getElementById('shiftStatus').value = 'Completed';
    window.showToast("Times matched to schedule. Click 'Save Shift' to finish.");
};

// --- SAVE SHIFT ---
window.saveShift = async function() {
    const id = document.getElementById('shiftId').value;
    const accSelect = document.getElementById('shiftAccount');
    const sDate = document.getElementById('shiftStartDate').value;
    const sTime = document.getElementById('shiftStartTime').value;
    const eTime = document.getElementById('shiftEndTime').value;
    const status = document.getElementById('shiftStatus').value;

    const checkboxes = document.querySelectorAll('#shiftEmployeeContainer input:checked');
    const selectedEmps = Array.from(checkboxes).map(c => ({id: c.value, name: c.getAttribute('data-name')}));

    if (!accSelect.value || !sDate || !sTime || !eTime) return alert("Required fields missing.");
    if (!id && selectedEmps.length === 0) return alert("Please select at least one employee.");

    const btn = document.querySelector('#shiftModal .btn-primary');
    btn.disabled = true; btn.textContent = "Saving...";

    try {
        const batch = db.batch();
        const baseStart = new Date(`${sDate}T${sTime}:00`);
        let baseEnd = new Date(`${sDate}T${eTime}:00`);
        if (baseEnd <= baseStart) baseEnd.setDate(baseEnd.getDate() + 1);

        if (id) {
            const data = {
                accountId: accSelect.value,
                accountName: accSelect.options[accSelect.selectedIndex].text,
                startTime: firebase.firestore.Timestamp.fromDate(baseStart),
                endTime: firebase.firestore.Timestamp.fromDate(baseEnd),
                status: status
            };

            const actSDate = document.getElementById('actDate').value;
            const actSTime = document.getElementById('actStartTime').value;
            const actETime = document.getElementById('actEndTime').value;

            if(actSDate && actSTime) {
                const manualStart = new Date(`${actSDate}T${actSTime}:00`);
                data.actualStartTime = firebase.firestore.Timestamp.fromDate(manualStart);
                if(actETime) {
                    let manualEnd = new Date(`${actSDate}T${actETime}:00`);
                    if (manualEnd <= manualStart) manualEnd.setDate(manualEnd.getDate() + 1);
                    data.actualEndTime = firebase.firestore.Timestamp.fromDate(manualEnd);
                }
            }
            await db.collection('jobs').doc(id).update(data);
            window.showToast("Shift Updated");
        }
        else {
            const accId = accSelect.value;
            const overlapSnap = await db.collection('jobs')
                .where('accountId', '==', accId)
                .where('startTime', '==', firebase.firestore.Timestamp.fromDate(baseStart))
                .where('endTime', '==', firebase.firestore.Timestamp.fromDate(baseEnd))
                .get();

            overlapSnap.forEach(doc => {
                if(doc.data().status === 'Scheduled') batch.delete(doc.ref);
            });

            selectedEmps.forEach(emp => {
                const newRef = db.collection('jobs').doc();
                batch.set(newRef, {
                    accountId: accId,
                    accountName: accSelect.options[accSelect.selectedIndex].text,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    startTime: firebase.firestore.Timestamp.fromDate(baseStart),
                    endTime: firebase.firestore.Timestamp.fromDate(baseEnd),
                    status: status,
                    owner: window.currentUser.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            window.showToast("Roster Updated!");
        }

        closeShiftModal();
        window.loadScheduler();

    } catch (e) { alert("Error: " + e.message); }
    finally { btn.disabled = false; btn.textContent = "Save Shift"; }
};

window.deleteJobFromModal = async function() {
    const id = document.getElementById('shiftId').value;
    if(!confirm("Cancel this shift?")) return;
    await db.collection('jobs').doc(id).delete();
    closeShiftModal(); window.loadScheduler();
};

window.closeShiftModal = function() { document.getElementById('shiftModal').style.display = 'none'; };

if (Notification.permission !== "granted" && Notification.permission !== "denied") Notification.requestPermission();

// Export loadScheduler globally one last time to be safe
window.loadScheduler = loadScheduler;

// --- AUTO-SCHEDULER LOGIC (RESTORED) ---
// ==========================================

// 1. OPEN WIZARD
window.openAutoScheduleWizard = async function() {
    const accId = document.getElementById('scheduleAccountId').value;
    const accName = document.getElementById('schedModalTitle').textContent.replace('Schedule: ', '');

    // Grab selected days (Green Chips) from the settings modal
    const selectedChips = document.querySelectorAll('#scheduleServiceDaysContainer .day-chip.selected');
    const selectedDays = Array.from(selectedChips).map(c => c.textContent.trim());

    if (selectedDays.length === 0) return alert("Please select Service Days first.");

    document.getElementById('as_accountName').textContent = accName;
    document.getElementById('as_daysDisplay').textContent = selectedDays.join(', ');

    // Load checkboxes (empty initially)
    await renderEmployeeCheckboxes('as_employeeContainer', []);

    // Hide Settings, Show Wizard
    document.getElementById('scheduleSettingsModal').style.display = 'none';
    document.getElementById('autoScheduleModal').style.display = 'flex';
};

// 2. GENERATE SHIFTS (Wizard Confirm)
window.confirmAutoSchedule = async function() {
    const accId = document.getElementById('scheduleAccountId').value;
    const accName = document.getElementById('as_accountName').textContent;
    const startTimeVal = document.getElementById('as_startTime').value;
    const endTimeVal = document.getElementById('as_endTime').value;

    // Get selected employees
    const empCheckboxes = document.querySelectorAll('#as_employeeContainer input:checked');
    const selectedEmps = Array.from(empCheckboxes).map(cb => ({ id: cb.value, name: cb.getAttribute('data-name') }));

    if (!startTimeVal || !endTimeVal) return alert("Select Start/End times.");

    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const targetDaysText = document.getElementById('as_daysDisplay').textContent.split(', ');
    const targetDayInts = targetDaysText.map(d => dayMap[d.trim()]);

    const btn = document.querySelector('#autoScheduleModal button');
    const originalText = btn.textContent;
    btn.textContent = "Generating...";
    btn.disabled = true;

    try {
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setDate(end.getDate() + 60); end.setHours(23, 59, 59, 999);

        // Save Array of Employees
        await db.collection('accounts').doc(accId).update({
            serviceDays: targetDaysText,
            autoSchedule: {
                active: true,
                days: targetDayInts,
                startTime: startTimeVal,
                endTime: endTimeVal,
                employeeIds: selectedEmps.map(e => e.id),
                employeeNames: selectedEmps.map(e => e.name)
            }
        });

        // Cleanup Old
        const batch = db.batch();
        const existingSnap = await db.collection('jobs')
            .where('accountId', '==', accId)
            .where('startTime', '>=', firebase.firestore.Timestamp.fromDate(start))
            .where('startTime', '<=', firebase.firestore.Timestamp.fromDate(end))
            .get();
        existingSnap.forEach(doc => { if (doc.data().status !== 'Completed') batch.delete(doc.ref); });

        // Generate New
        let current = new Date(start);
        let createdCount = 0;

        while (current <= end) {
            if (targetDayInts.includes(current.getDay())) {
                const sDate = new Date(current);
                const [sH, sM] = startTimeVal.split(':');
                sDate.setHours(parseInt(sH), parseInt(sM), 0);

                const eDate = new Date(current);
                const [eH, eM] = endTimeVal.split(':');
                eDate.setHours(parseInt(eH), parseInt(eM), 0);
                if (eDate <= sDate) eDate.setDate(eDate.getDate() + 1);

                // Create a job for EACH selected employee
                const empsToSchedule = selectedEmps.length > 0 ? selectedEmps : [{id: 'UNASSIGNED', name: 'Unassigned'}];

                empsToSchedule.forEach(emp => {
                    const newRef = db.collection('jobs').doc();
                    batch.set(newRef, {
                        accountId: accId,
                        accountName: accName,
                        employeeId: emp.id,
                        employeeName: emp.name,
                        startTime: firebase.firestore.Timestamp.fromDate(sDate),
                        endTime: firebase.firestore.Timestamp.fromDate(eDate),
                        status: 'Scheduled',
                        owner: window.currentUser.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    createdCount++;
                });
            }
            current.setDate(current.getDate() + 1);
        }

        await batch.commit();
        window.showToast(`Generated ${createdCount} shifts!`);
        document.getElementById('autoScheduleModal').style.display = 'none';

        if (typeof window.loadScheduler === 'function') window.loadScheduler();
        if (typeof window.loadAccountsList === 'function') window.loadAccountsList();

    } catch (e) { console.error(e); alert(e.message); }
    finally { btn.textContent = originalText; btn.disabled = false; }
};

// 3. AUTOMATOR (Multi-Employee Support)
window.checkRollingSchedules = async function() {
    if (!window.currentUser) return;
    try {
        const activeSnap = await db.collection('accounts').where('owner', '==', window.currentUser.email).get();
        const batch = db.batch();
        let totalAdded = 0;
        const horizon = new Date(); horizon.setDate(horizon.getDate() + 60);

        for (const doc of activeSnap.docs) {
            const acc = doc.data();
            if (!acc.autoSchedule || !acc.autoSchedule.active) continue;

            const s = acc.autoSchedule;
            // Handle legacy single ID vs new Array
            let empList = [];
            if (s.employeeIds && s.employeeIds.length > 0) {
                empList = s.employeeIds;
            } else if (s.employeeId) {
                empList = [s.employeeId];
            } else {
                empList = ['UNASSIGNED'];
            }

            const lastJobSnap = await db.collection('jobs').where('accountId', '==', doc.id).orderBy('startTime', 'desc').limit(1).get();
            let nextRun = new Date();
            if(!lastJobSnap.empty) {
                nextRun = lastJobSnap.docs[0].data().startTime.toDate();
                nextRun.setDate(nextRun.getDate() + 1);
            } else { nextRun.setDate(nextRun.getDate() + 1); }

            if (nextRun < horizon) {
                console.log(`Extending ${acc.name}...`);
                const allEmps = await db.collection('employees').where('owner','==',window.currentUser.email).get();
                const empMap = {};
                allEmps.forEach(e => empMap[e.id] = e.data().name);

                while (nextRun <= horizon) {
                    if (s.days.includes(nextRun.getDay())) {
                        const sDate = new Date(nextRun);
                        const [sH, sM] = s.startTime.split(':');
                        sDate.setHours(parseInt(sH), parseInt(sM), 0);
                        const eDate = new Date(nextRun);
                        const [eH, eM] = s.endTime.split(':');
                        eDate.setHours(parseInt(eH), parseInt(eM), 0);
                        if (eDate <= sDate) eDate.setDate(eDate.getDate() + 1);

                        empList.forEach(empId => {
                            const name = empMap[empId] || 'Unassigned';
                            const ref = db.collection('jobs').doc();
                            batch.set(ref, {
                                accountId: doc.id, accountName: acc.name,
                                employeeId: empId, employeeName: name,
                                startTime: firebase.firestore.Timestamp.fromDate(sDate),
                                endTime: firebase.firestore.Timestamp.fromDate(eDate),
                                status: 'Scheduled', owner: window.currentUser.email,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            totalAdded++;
                        });
                    }
                    nextRun.setDate(nextRun.getDate() + 1);
                }
            }
        }
        if(totalAdded > 0) { await batch.commit(); window.showToast(`Extended schedule (+${totalAdded})`); if(window.loadScheduler) window.loadScheduler(); }
    } catch(e) {}
};

// 4. CONTROL CENTER UPDATE (Sync Multi)
window.updateScheduleSettings = async function() {
    const accId = document.getElementById('scheduleAccountId').value;
    const startTime = document.getElementById('sc_startTime').value;
    const endTime = document.getElementById('sc_endTime').value;

    const checkboxes = document.querySelectorAll('#sc_employeeContainer input:checked');
    const selectedEmps = Array.from(checkboxes).map(cb => ({ id: cb.value, name: cb.getAttribute('data-name') }));

    const btn = document.querySelector('#scheduleControlPanel button');
    btn.disabled = true; btn.textContent = "Syncing...";

    try {
        const batch = db.batch();
        const now = new Date();

        // 1. Delete ALL future scheduled shifts for this account
        const jobsSnap = await db.collection('jobs')
            .where('accountId', '==', accId)
            .where('status', '==', 'Scheduled')
            .where('startTime', '>=', firebase.firestore.Timestamp.fromDate(now))
            .get();

        jobsSnap.forEach(doc => batch.delete(doc.ref));

        // 2. Refill 60 days
        const targetDaysText = Array.from(document.querySelectorAll('#scheduleServiceDaysContainer .day-chip.selected')).map(c => c.textContent.trim());
        const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
        const targetDayInts = targetDaysText.map(d => dayMap[d]);

        await db.collection('accounts').doc(accId).update({
            serviceDays: targetDaysText,
            autoSchedule: {
                active: true, days: targetDayInts,
                startTime: startTime, endTime: endTime,
                employeeIds: selectedEmps.map(e => e.id),
                employeeNames: selectedEmps.map(e => e.name)
            }
        });

        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setDate(end.getDate() + 60);
        let current = new Date(start);

        const emps = selectedEmps.length > 0 ? selectedEmps : [{id: 'UNASSIGNED', name: 'Unassigned'}];

        while(current <= end) {
            if(targetDayInts.includes(current.getDay())) {
                const sDate = new Date(current);
                const [sH, sM] = startTime.split(':');
                sDate.setHours(parseInt(sH), parseInt(sM), 0);
                const eDate = new Date(current);
                const [eH, eM] = endTime.split(':');
                eDate.setHours(parseInt(eH), parseInt(eM), 0);
                if(eDate <= sDate) eDate.setDate(eDate.getDate() + 1);

                emps.forEach(emp => {
                    const ref = db.collection('jobs').doc();
                    batch.set(ref, {
                        accountId: accId,
                        accountName: document.getElementById('schedModalTitle').textContent.replace('Schedule: ', ''),
                        employeeId: emp.id, employeeName: emp.name,
                        startTime: firebase.firestore.Timestamp.fromDate(sDate),
                        endTime: firebase.firestore.Timestamp.fromDate(eDate),
                        status: 'Scheduled', owner: window.currentUser.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
            }
            current.setDate(current.getDate() + 1);
        }

        await batch.commit();
        window.showToast("Schedule Synced!");
        document.getElementById('scheduleSettingsModal').style.display = 'none';
        if(window.loadScheduler) window.loadScheduler();
        if(window.loadAccountsList) loadAccountsList();

    } catch(e) { alert(e.message); }
    finally { btn.disabled = false; btn.textContent = "Update & Sync"; }
};

window.toggleAutoSchedule = async function(isActive) {
    if(!confirm("Turn off Auto-Scheduling?")) return;
    const accId = document.getElementById('scheduleAccountId').value;
    try {
        await db.collection('accounts').doc(accId).update({ 'autoSchedule.active': isActive });
        window.showToast("Auto-Schedule OFF");
        document.getElementById('scheduleSettingsModal').style.display = 'none';
        if (typeof loadAccountsList === 'function') loadAccountsList();
    } catch(e) { alert(e.message); }
};

// --- HELPER: TIME FORMATTER FOR POPUP ---
function get24hTime(dateObj) {
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}