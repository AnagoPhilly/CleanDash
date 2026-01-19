// js/accounts.js

let editMap = null;
let editMarker = null;
let editCircle = null;

// --- 1. HELPER: TOGGLE DAY CHIP VISUALS ---
window.toggleDayChip = function(el) {
    el.classList.toggle('selected');
};

// --- 2. HELPER: DRAW/UPDATE GEOFENCE CIRCLE ---
function updateGeofenceCircle(lat, lng, radius) {
    if (!editMap) return;
    const safeRadius = Math.max(5, parseFloat(radius) || 200);

    if (editCircle) {
        if (editMap.hasLayer(editCircle)) editMap.removeLayer(editCircle);
    }

    editCircle = L.circle([lat, lng], {
        color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.2, weight: 2, radius: safeRadius
    }).addTo(editMap);
}

function handleGeofenceInputChange() {
    const radius = this.value;
    if (editMarker) {
        const latLng = editMarker.getLatLng();
        updateGeofenceCircle(latLng.lat, latLng.lng, radius);
    }
}

// --- 3. MAIN LIST LOADER (UPDATED) ---
window.loadAccountsList = function() {
  if (!window.currentUser) return;

  const activeDiv = document.getElementById('accountsList');
  const inactiveDiv = document.getElementById('inactiveAccountsList');

  if(activeDiv) activeDiv.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">Loading Accounts...</div>';

  const q = db.collection('accounts').where('owner', '==', window.currentUser.email);

  q.orderBy('createdAt', 'desc').get()
  .then(snap => {
    if (snap.empty) {
      if(activeDiv) activeDiv.innerHTML = '<div style="text-align:center; padding:3rem; color:#6b7280;">No accounts yet — click "+ Add Account"</div>';
      if(inactiveDiv) inactiveDiv.innerHTML = '';
      return;
    }

    const tableHead = `<table class="data-table"><thead><tr><th>Name / Contact</th><th>Address / Alarm</th><th style="text-align:right;">Revenue</th><th style="text-align:center;">Quick Actions</th></tr></thead><tbody>`;
    const inactiveHead = `<table class="data-table" style="opacity:0.7;"><thead><tr><th>Name</th><th>Reason</th><th style="text-align:right;">End Date</th><th style="text-align:center;">Actions</th></tr></thead><tbody>`;

    let activeRows = '', inactiveRows = '', hasActive = false, hasInactive = false;
    const today = new Date().toISOString().split('T')[0];

    snap.forEach(doc => {
      const a = doc.data();
      const safeName = (a.name || '').replace(/'/g, "\\'");
      const safeAlarm = (a.alarmCode || '').replace(/'/g, "\\'");
      const isInactive = a.endDate && a.endDate <= today;
      const serviceDays = (a.serviceDays || []).join(',');

      if (!isInactive) {
          hasActive = true;
          const lat = a.lat || 0;
          const lng = a.lng || 0;
          const geofence = a.geofenceRadius || 50;

          // Scheduler Button Style
          const isScheduled = a.autoSchedule && a.autoSchedule.active;
          const schedBtnStyle = isScheduled ? "background:#8b5cf6; color:white; border:none;" : "background:white; color:#8b5cf6; border:1px solid #5c73f6ff;";
          const schedIcon = isScheduled ? "" : "";

          activeRows += `<tr>
            <td><div style="font-weight:600; color:#111827;">${a.name}</div><div style="font-size:0.8rem; color:#6b7280;">${a.contactName || ''}</div></td>
            <td><div style="color:#4b5563; font-size:0.9rem;">${a.address}</div>${a.alarmCode ? `<div style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">🚨 ${a.alarmCode}</div>` : ''}</td>
            <td class="col-revenue">$${(a.revenue || 0).toLocaleString()}</td>
            <td style="text-align:center;">
                <div class="action-buttons" style="display:flex; justify-content:center; gap:5px;">
                    <button onclick="openScheduleSettings('${doc.id}', '${safeName}', '${serviceDays}')" class="btn-xs" style="${schedBtnStyle} display:flex; align-items:center; gap:3px;">${schedIcon} Scheduler</button>
                    <button onclick="showEditAccount('${doc.id}', '${safeName}', '${safeAlarm}', ${geofence}, ${lat}, ${lng})" class="btn-xs btn-edit">Edit</button>
                    <button onclick="openSpecsModal('${doc.id}', '${safeName}', 'view')" class="btn-xs btn-specs-view">Specs</button>
                </div>
            </td>
          </tr>`;
      } else {
          hasInactive = true;
          inactiveRows += `<tr>
            <td><div style="font-weight:600; color:#4b5563;">${a.name}</div><div style="font-size:0.8rem;">${a.address}</div></td>
            <td style="color:#ef4444; font-weight:500;">${a.cancelReason || a.inactiveReason || 'Unknown'}</td>
            <td style="text-align:right; font-family:monospace;">${a.endDate}</td>
            <td style="text-align:center;">
                <button onclick="reactivateAccount('${doc.id}')" class="btn-xs" style="border:1px solid #10b981; color:#10b981;">Reactivate</button>
                <button onclick="deleteAccount('${doc.id}', '${safeName}', true)" class="btn-xs btn-delete">Delete</button>
            </td>
          </tr>`;
      }
    });

    if(activeDiv) activeDiv.innerHTML = hasActive ? tableHead + activeRows + '</tbody></table>' : '<div style="padding:2rem; text-align:center; color:#ccc;">No active accounts.</div>';
    if(inactiveDiv) inactiveDiv.innerHTML = hasInactive ? inactiveHead + inactiveRows + '</tbody></table>' : '<div style="padding:1rem; text-align:center; color:#eee;">No canceled/inactive accounts.</div>';

    if (typeof loadMap === 'function') setTimeout(loadMap, 50);
  })
  .catch(err => {
      console.error(err);
      if(activeDiv) activeDiv.innerHTML = `<div style="color:red; text-align:center; padding:2rem;">Error loading accounts: ${err.message}<br><small>(Check console for Index link if this is your first time)</small></div>`;
  });
};

// --- 4A. SHOW PHYSICAL EDIT MODAL ---
window.showEditAccount = function(id, name, alarm, geofence, lat, lng) {
    document.getElementById('editAccountId').value = id;
    const titleEl = document.getElementById('editAccountModalTitle');
    if(titleEl) titleEl.textContent = `Edit: ${name}`;

    const alarmEl = document.getElementById('editAccountAlarm');
    const geoEl = document.getElementById('editAccountGeofence');

    if(alarmEl) alarmEl.value = alarm || '';
    if(geoEl) geoEl.value = geofence || 200;

    document.getElementById('editAccountModal').style.display = 'flex';

    // Map Logic
    setTimeout(() => {
        const startLat = lat || 39.9526;
        const startLng = lng || -75.1652;
        const zoom = lat ? 18 : 10;

        if (!editMap) {
            const mapEl = document.getElementById('editAccountMap');
            if(mapEl) {
                editMap = L.map('editAccountMap').setView([startLat, startLng], zoom);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21 }).addTo(editMap);
                editMarker = L.marker([startLat, startLng], { draggable: true }).addTo(editMap);

                editMarker.on('dragend', function(e) {
                    const newLatLng = e.target.getLatLng();
                    const currentRadius = parseInt(document.getElementById('editAccountGeofence').value);
                    updateGeofenceCircle(newLatLng.lat, newLatLng.lng, currentRadius);
                });
            }
        } else {
            editMap.setView([startLat, startLng], zoom);
            editMarker.setLatLng([startLat, startLng]);
        }

        if (editMap) {
            editMap.invalidateSize();
            updateGeofenceCircle(startLat, startLng, geofence);
        }
    }, 400);

    const geoInput = document.getElementById('editAccountGeofence');
    if (geoInput) {
        geoInput.removeEventListener('input', handleGeofenceInputChange);
        geoInput.addEventListener('input', handleGeofenceInputChange);
    }
};

// --- 4B. SAVE PHYSICAL EDIT ---
window.saveEditedAccount = async (event) => {
    const btn = event.target;
    btn.disabled = true; btn.textContent = 'Saving...';
    const id = document.getElementById('editAccountId').value;

    try {
        const finalLatLng = editMarker ? editMarker.getLatLng() : { lat: 0, lng: 0 };
        const newGeofence = parseInt(document.getElementById('editAccountGeofence').value) || 200;
        const newAlarm = document.getElementById('editAccountAlarm').value.trim();

        await db.collection('accounts').doc(id).set({
            alarmCode: newAlarm,
            geofenceRadius: newGeofence,
            lat: finalLatLng.lat,
            lng: finalLatLng.lng
        }, { merge: true });

        window.showToast('Location Details Saved!');
        loadAccountsList();

        // Hide Modal Helper
        if(window.hideEditAccount) window.hideEditAccount();
        else document.getElementById('editAccountModal').style.display = 'none';

        if (typeof loadMap === 'function') loadMap();

    } catch (e) { alert('Error: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = 'Save Location Details'; }
};

// --- 4C. OPEN SCHEDULER SETTINGS (New) ---
window.openScheduleSettings = async function(id, name, daysStr) {
    document.getElementById('scheduleAccountId').value = id;
    document.getElementById('schedModalTitle').textContent = `Schedule: ${name}`;

    // 1. Populate Day Chips
    const days = daysStr ? daysStr.split(',') : [];
    const chips = document.querySelectorAll('#scheduleServiceDaysContainer .day-chip');
    chips.forEach(chip => {
        const dayText = chip.textContent.trim();
        if (days.includes(dayText)) chip.classList.add('selected');
        else chip.classList.remove('selected');
    });

    // 2. Fetch Data
    const schedulePanel = document.getElementById('scheduleControlPanel');
    const setupContainer = document.getElementById('scheduleSetupContainer');
    const empContainer = document.getElementById('sc_employeeContainer');

    schedulePanel.style.display = 'none';
    setupContainer.style.display = 'none';
    empContainer.innerHTML = '<div style="color:#888; text-align:center;">Loading team...</div>';

    try {
        const [accDoc, empSnap] = await Promise.all([
            db.collection('accounts').doc(id).get(),
            db.collection('employees').where('owner', '==', window.currentUser.email).where('status', '==', 'Active').orderBy('name').get()
        ]);

        const data = accDoc.data();
        const activeIds = (data.autoSchedule && data.autoSchedule.employeeIds) ? data.autoSchedule.employeeIds :
                          (data.autoSchedule && data.autoSchedule.employeeId) ? [data.autoSchedule.employeeId] : [];

        // Build Checkboxes
        empContainer.innerHTML = '';
        empSnap.forEach(doc => {
            const emp = doc.data();
            const isChecked = activeIds.includes(doc.id) ? 'checked' : '';
            const item = document.createElement('div');
            item.className = 'multi-select-item';
            item.innerHTML = `
                <label style="display:flex; align-items:center; width:100%; cursor:pointer; margin:0;">
                    <input type="checkbox" value="${doc.id}" data-name="${emp.name}" ${isChecked}>
                    <span style="font-weight:500;">${emp.name}</span>
                </label>
            `;
            empContainer.appendChild(item);
        });

        // Toggle UI
        if (data.autoSchedule && data.autoSchedule.active) {
            schedulePanel.style.display = 'block';
            document.getElementById('sc_startTime').value = data.autoSchedule.startTime || "17:00";
            document.getElementById('sc_endTime').value = data.autoSchedule.endTime || "21:00";
        } else {
            setupContainer.style.display = 'block';
        }
    } catch (e) { console.error(e); }

    document.getElementById('scheduleSettingsModal').style.display = 'flex';
};

// --- 5. OTHER FUNCTIONS (Standard) ---
window.setPinToUserLocation = function() {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "Locating...";
    btn.disabled = true;

    if (!navigator.geolocation) {
        alert("Geolocation is not supported.");
        btn.textContent = originalText; btn.disabled = false; return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if (editMarker && editMap) {
                const newLatLng = new L.LatLng(lat, lng);
                editMarker.setLatLng(newLatLng);
                editMap.setView(newLatLng, 18);
                const currentRadius = parseInt(document.getElementById('editAccountGeofence').value);
                updateGeofenceCircle(lat, lng, currentRadius);
            }
            window.showToast("Pin moved to your location!");
            btn.textContent = originalText; btn.disabled = false;
        },
        (error) => {
            alert("Could not get location.");
            btn.textContent = originalText; btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

window.openInactiveReasonModal = function(accountId, type, currentName) {
    document.getElementById('inactiveReasonModal').style.display = 'flex';
    document.getElementById('inactiveAccountId').value = accountId;
    document.getElementById('actionType').value = type;
    document.getElementById('otherReasonInput').style.display = 'none';
    document.getElementById('inactiveReasonTitle').textContent = `Mark ${currentName} Inactive`;
};

window.closeInactiveReasonModal = function() {
    document.getElementById('inactiveReasonModal').style.display = 'none';
};

window.confirmInactiveAction = async function() {
    const accountId = document.getElementById('inactiveAccountId').value;
    const selectedReason = document.querySelector('input[name="inactiveReason"]:checked')?.value;
    const otherReason = document.getElementById('otherReasonInput').value.trim();
    if (!selectedReason) return alert("Please select a reason.");
    const finalReason = selectedReason === 'Other' ? `Other: ${otherReason}` : selectedReason;

    try {
        await db.collection('accounts').doc(accountId).update({
            endDate: new Date().toISOString().split('T')[0],
            inactiveReason: finalReason
        });
        window.showToast("Account moved to Inactive.");
        closeInactiveReasonModal(); loadAccountsList();
    } catch (e) { alert("Error: " + e.message); }
};

window.deleteAccount = async (id, name, isAlreadyInactive) => {
    if (isAlreadyInactive) {
        if(confirm(`PERMANENTLY DELETE ${name}?`)) await performHardDelete(id);
    } else {
        const choice = confirm(`Mark ${name} as Inactive?\n\nOK = Inactive (Safe)\nCancel = Delete (Permanent)`);
        if (choice) openInactiveReasonModal(id, 'soft_delete', name);
        else if(confirm(`Permanently delete ${name}?`)) await performHardDelete(id);
    }
};

async function performHardDelete(id) {
    try { await db.collection('accounts').doc(id).delete(); window.showToast("Deleted"); loadAccountsList(); } catch(e) { alert(e.message); }
}

window.openSpecsModal = function(id, name, mode) {
    document.getElementById('specsModal').style.display = 'flex';
    document.getElementById('specsModalTitle').textContent = `Specs: ${name}`;
    document.getElementById('currentSpecAccountId').value = id;
    loadRealSpecs(id);
};

window.closeSpecsModal = function() { document.getElementById('specsModal').style.display = 'none'; };

window.saveSpecLink = async function() {
    const accountId = document.getElementById('currentSpecAccountId').value;
    const name = document.getElementById('newSpecName').value.trim();
    let url = document.getElementById('newSpecUrl').value.trim();
    if (!name || !url) return alert("Enter name and URL.");
    if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
    try {
        await db.collection('accounts').doc(accountId).collection('specs').add({
            name, url, type: 'link', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast(`Saved: ${name}`);
        document.getElementById('newSpecName').value = ''; document.getElementById('newSpecUrl').value = '';
        loadRealSpecs(accountId);
    } catch (error) { alert(error.message); }
};

async function loadRealSpecs(accountId) {
    const listDiv = document.getElementById('specsList');
    listDiv.innerHTML = 'Loading...';
    try {
        const snap = await db.collection('accounts').doc(accountId).collection('specs').orderBy('createdAt', 'desc').get();
        if (snap.empty) { listDiv.innerHTML = '<div class="empty-specs">No specs found.</div>'; return; }
        let html = '';
        snap.forEach(doc => {
            const s = doc.data();
            html += `<div class="spec-item"><a href="${s.url}" target="_blank">${s.name}</a> <span onclick="deleteSpec('${accountId}','${doc.id}')" style="cursor:pointer;color:red;margin-left:10px;">&times;</span></div>`;
        });
        listDiv.innerHTML = html;
    } catch (e) { listDiv.innerHTML = 'Error loading specs.'; }
}

window.deleteSpec = async function(accId, specId) {
    if(!confirm("Delete this link?")) return;
    await db.collection('accounts').doc(accId).collection('specs').doc(specId).delete();
    loadRealSpecs(accId);
};

window.reactivateAccount = async function(id) {
    if(!confirm("Reactivate?")) return;
    await db.collection('accounts').doc(id).update({ endDate: null, cancelReason: null, inactiveReason: null });
    loadAccountsList();
};

window.showAddAccount = function() { document.getElementById('addAccountModal').style.display = 'flex'; }
window.saveNewAccount = async () => {
    const name = document.getElementById('accountName').value.trim();
    const street = document.getElementById('accountStreet').value.trim();
    const startDate = document.getElementById('accountStartDate').value;
    if (!name || !street || !startDate) return alert('Name, Street, and Start Date required');

    try {
        const fullAddress = `${street}, ${document.getElementById('accountCity').value}, ${document.getElementById('accountState').value} ${document.getElementById('accountZip').value}`;
        await db.collection('accounts').add({
            name, address: fullAddress, street, startDate,
            revenue: Number(document.getElementById('accountRevenue').value),
            owner: window.currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        window.showToast('Account added!');
        window.hideAddAccount();
        loadAccountsList();
    } catch (e) { alert(e.message); }
};

// PID Auto Fill
async function runPidAutoFill() {
    const pid = document.getElementById('accountPID').value.trim();
    if (!pid) return alert("Enter PID");
    const btn = document.getElementById('btnPidAutoFill');
    btn.disabled = true; btn.textContent = "Searching...";
    try {
        const snap = await db.collection('master_client_list').where('pid', '==', pid).limit(1).get();
        if(!snap.empty) fillForm(snap.docs[0].data());
        else {
            const doc = await db.collection('master_client_list').doc(pid).get();
            if(doc.exists) fillForm(doc.data());
            else alert("PID Not Found");
        }
    } catch(e) { console.error(e); }
    finally { btn.disabled = false; btn.textContent = "✨ PID Auto Fill"; }
}

function fillForm(data) {
    if(data.name) document.getElementById('accountName').value = data.name;
    if(data.street) document.getElementById('accountStreet').value = data.street;
    if(data.city) document.getElementById('accountCity').value = data.city;
    if(data.zip) document.getElementById('accountZip').value = data.zip;
    window.showToast("Data Found!");
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnPidAutoFill');
    if(btn) btn.addEventListener('click', runPidAutoFill);
});