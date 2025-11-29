// js/employee_portal.js

let currentWeekStart = new Date();
const day = currentWeekStart.getDay();
const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
currentWeekStart.setDate(diff);
currentWeekStart.setHours(0,0,0,0);

const MAX_DISTANCE_KM = 0.5; // 500 meters allow radius

auth.onAuthStateChanged(async user => {
    if (user) {
        // 1. Verify Identity in Employee Database
        const empSnap = await db.collection('employees').where('email', '==', user.email).get();

        if (empSnap.empty) {
            alert("Account not found in Employee Roster. Please contact your manager.");
            auth.signOut();
            return;
        }

        const employee = empSnap.docs[0].data();
        employee.id = empSnap.docs[0].id;

        // Update UI
        document.getElementById('appLoading').style.display = 'none';
        document.getElementById('app').style.display = 'flex';

        const welcomeEl = document.getElementById('welcomeMsg');
        if(welcomeEl) welcomeEl.textContent = `Hi, ${employee.name.split(' ')[0]}`;

        // 2. Load My Shifts
        loadMyShifts(employee.id);
    } else {
        // If not logged in, go back to main index
        window.location.href = 'index.html';
    }
});

async function loadMyShifts(employeeId) {
    const container = document.getElementById('schedulerGrid');
    const hoursDisplay = document.getElementById('totalHoursDisplay');

    // Date Header
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const dateEl = document.getElementById('weekRangeDisplay');
    if(dateEl) dateEl.textContent = `${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

    try {
        // Fetch Jobs
        const snap = await db.collection('jobs')
            .where('employeeId', '==', employeeId)
            .get();

        const jobs = [];
        let totalHours = 0;

        snap.forEach(doc => {
            const j = doc.data();
            j.id = doc.id;
            j.start = j.startTime.toDate();
            j.end = j.endTime.toDate();
            jobs.push(j);

            // Calculate Hours if Completed
            if (j.status === 'Completed' && j.actualStartTime && j.actualEndTime) {
                const diffMs = j.actualEndTime.toDate() - j.actualStartTime.toDate();
                const hrs = diffMs / (1000 * 60 * 60);
                totalHours += hrs;
            }
        });

        if(hoursDisplay) hoursDisplay.textContent = totalHours.toFixed(2);

        renderReadCalendar(jobs);

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="text-align:center; padding:1rem;">Error loading schedule.</p>';
    }
}

function renderReadCalendar(jobs) {
    const grid = document.getElementById('schedulerGrid');
    if(!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const colDate = new Date(currentWeekStart);
        colDate.setDate(colDate.getDate() + i);
        const dateString = colDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

        const col = document.createElement('div');
        col.className = 'calendar-col';
        col.innerHTML = `<div class="cal-header">${dateString}</div>`;

        const dayJobs = jobs.filter(j =>
            j.start.getDate() === colDate.getDate() &&
            j.start.getMonth() === colDate.getMonth()
        );

        dayJobs.sort((a, b) => a.start - b.start);

        dayJobs.forEach(job => {
            const timeStr = job.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Determine Button State
            let actionBtn = '';

            if (job.status === 'Completed') {
                const actualEnd = job.actualEndTime ? new Date(job.actualEndTime.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Done';
                actionBtn = `<div class="status-badge completed">🏁 Ended: ${actualEnd}</div>`;

            } else if (job.status === 'Started') {
                const actualStart = job.actualStartTime ? new Date(job.actualStartTime.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
                actionBtn = `
                    <div style="font-size:0.75rem; color:green; margin-bottom:4px;">Started: ${actualStart}</div>
                    <button class="btn-clockout" onclick="attemptClockOut('${job.id}', '${job.accountId}')">🛑 Clock Out</button>
                `;

            } else {
                actionBtn = `<button class="btn-checkin" onclick="attemptCheckIn('${job.id}', '${job.accountId}')">📍 Check In</button>`;
            }

            const card = document.createElement('div');
            card.className = 'shift-card';
            card.innerHTML = `
                <div class="shift-time">${timeStr}</div>
                <div class="shift-loc">${job.accountName}</div>
                ${actionBtn}
            `;
            col.appendChild(card);
        });

        grid.appendChild(col);
    }
}

// --- GEOFENCING & ACTIONS ---

function runGeofencedAction(jobId, accountId, actionType) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Locating...";

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        btn.disabled = false;
        btn.textContent = originalText;
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        try {
            const accDoc = await db.collection('accounts').doc(accountId).get();
            if (!accDoc.exists) throw new Error("Account not found");

            const accData = accDoc.data();

            if (!accData.lat || !accData.lng) {
                alert("Warning: No GPS pin for this building. Checking you in anyway.");
                if (actionType === 'in') await processCheckIn(jobId);
                else await processClockOut(jobId);
                return;
            }

            const distanceKm = getDistanceFromLatLonInKm(userLat, userLng, accData.lat, accData.lng);
            console.log(`Distance: ${distanceKm.toFixed(3)} km`);

            if (distanceKm <= MAX_DISTANCE_KM) {
                if (actionType === 'in') await processCheckIn(jobId);
                else await processClockOut(jobId);
            } else {
                alert(`You are too far away (${distanceKm.toFixed(2)}km). Please arrive at the site.`);
                btn.disabled = false;
                btn.textContent = originalText;
            }

        } catch (error) {
            console.error(error);
            alert("Action failed: " + error.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }, (err) => {
        alert("Unable to retrieve location. Please allow GPS access.");
        btn.disabled = false;
        btn.textContent = originalText;
    }, { enableHighAccuracy: true });
}

window.attemptCheckIn = function(jobId, accountId) {
    runGeofencedAction(jobId, accountId, 'in');
};

window.attemptClockOut = function(jobId, accountId) {
    if(!confirm("Are you sure you are done for the day?")) return;
    runGeofencedAction(jobId, accountId, 'out');
};

async function processCheckIn(jobId) {
    await db.collection('jobs').doc(jobId).update({
        status: 'Started',
        actualStartTime: firebase.firestore.FieldValue.serverTimestamp()
    });
    window.showToast("Checked In!");
    location.reload(); // Refresh to show new state
}

async function processClockOut(jobId) {
    await db.collection('jobs').doc(jobId).update({
        status: 'Completed',
        actualEndTime: firebase.firestore.FieldValue.serverTimestamp()
    });
    window.showToast("Clocked Out!");
    location.reload(); // Refresh to show new state
}

// Haversine Formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

window.changeWeek = function(offset) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7));
    location.reload();
};