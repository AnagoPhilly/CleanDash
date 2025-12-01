// js/employees.js

function loadEmployees() {
    console.log("CleanDash: Loading Team...");

    const activeDiv = document.getElementById('employeeListActive');
    const waitingDiv = document.getElementById('employeeListWaiting');
    const inactiveDiv = document.getElementById('employeeListInactive');

    // Set loading states
    if(activeDiv) activeDiv.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">Loading...</div>';

    if (!window.currentUser) return;

    const q = window.currentUser.email === 'admin@cleandash.com'
        ? db.collection('employees')
        : db.collection('employees').where('owner', '==', window.currentUser.email);

    q.orderBy('name').get().then(snap => {
        if (snap.empty) {
            activeDiv.innerHTML = '<div style="text-align:center; padding:3rem; color:#6b7280;">No employees found. Click "+ Add Member" to build your team.</div>';
            if(waitingDiv) waitingDiv.innerHTML = '';
            if(inactiveDiv) inactiveDiv.innerHTML = '';
            return;
        }

        // Templates
        const tableHead = `<table class="data-table"><thead><tr><th>Name / Role</th><th>Location</th><th>Contact</th><th>Wage</th><th style="text-align:center;">Status</th><th style="text-align:center;">Actions</th></tr></thead><tbody>`;

        let activeRows = '';
        let waitingRows = '';
        let inactiveRows = '';

        let hasActive = false;
        let hasWaiting = false;
        let hasInactive = false;

        snap.forEach(doc => {
            const e = doc.data();
            const safeName = (e.name || '').replace(/'/g, "\\'");
            const safeAddr = (e.address || '').replace(/'/g, "\\'");

            // Status Badges
            let statusBadge = '';
            if (e.status === 'Active') {
                statusBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">Active</span>`;
            } else if (e.status === 'Waiting') {
                statusBadge = `<span style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">Waiting List</span>`;
            } else {
                statusBadge = `<span style="background:#f3f4f6; color:#6b7280; padding:2px 8px; border-radius:12px; font-size:0.75rem;">Inactive</span>`;
            }

            const addressDisplay = e.address ? `<span style="font-size:0.8rem; color:#4b5563;">📍 ${e.address}</span>` : '<span style="color:#9ca3af; font-size:0.8rem; font-style:italic;">No address</span>';

            // Actions HTML
            const actions = `
                <div class="action-buttons">
                    <button onclick="editEmployee('${doc.id}', '${safeName}', '${e.role}', '${e.email}', '${e.phone}', ${e.wage}, '${e.status}', '${safeAddr}')"
                            class="btn-xs btn-edit">Edit</button>
                    <button onclick="deleteEmployee('${doc.id}', '${safeName}', '${e.status}')"
                            class="btn-xs btn-delete">Delete</button>
                </div>`;

            const row = `<tr>
                <td>
                    <div style="font-weight:600; color:#111827;">${e.name}</div>
                    <div style="font-size:0.8rem; color:#6b7280;">${e.role || 'General Cleaner'}</div>
                </td>
                <td>${addressDisplay}</td>
                <td>
                    <div style="font-size:0.9rem;">${e.phone || '--'}</div>
                    <div style="font-size:0.8rem; color:#6b7280;">${e.email}</div>
                </td>
                <td style="font-family:monospace; font-weight:600;">$${(e.wage || 0).toFixed(2)}/hr</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center;">${actions}</td>
            </tr>`;

            // Sort into buckets
            if (e.status === 'Active') {
                activeRows += row;
                hasActive = true;
            } else if (e.status === 'Waiting') {
                waitingRows += row;
                hasWaiting = true;
            } else {
                inactiveRows += row;
                hasInactive = true;
            }
        });

        // Render to Containers
        activeDiv.innerHTML = hasActive ? tableHead + activeRows + '</tbody></table>' : '<div style="padding:2rem; text-align:center; color:#ccc;">No active team members.</div>';
        waitingDiv.innerHTML = hasWaiting ? tableHead + waitingRows + '</tbody></table>' : '<div style="padding:1rem; text-align:center; color:#eee;">No applicants.</div>';
        inactiveDiv.innerHTML = hasInactive ? tableHead + inactiveRows + '</tbody></table>' : '<div style="padding:1rem; text-align:center; color:#eee;">No inactive records.</div>';

    }).catch(err => {
        console.error("Error loading employees:", err);
        activeDiv.innerHTML = '<div style="color:red; text-align:center;">Error loading data.</div>';
    });
}

// --- CRUD OPERATIONS ---

window.showAddEmployee = function() {
    document.getElementById('employeeModal').style.display = 'flex';
    document.getElementById('empModalTitle').textContent = 'Add Team Member';
    document.getElementById('empId').value = '';

    // Reset form fields
    ['empName', 'empRole', 'empEmail', 'empPhone', 'empWage', 'empPassword', 'empAddress'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    document.getElementById('empStatus').value = 'Active';

    const resetContainer = document.getElementById('resetPasswordContainer');
    if(resetContainer) resetContainer.style.display = 'none';
};

window.closeEmployeeModal = function() {
    document.getElementById('employeeModal').style.display = 'none';
};

window.saveEmployee = async function() {
    const id = document.getElementById('empId').value;
    const name = document.getElementById('empName').value.trim();
    const role = document.getElementById('empRole').value;
    const email = document.getElementById('empEmail').value.trim();
    const phone = document.getElementById('empPhone').value.trim();
    const wage = parseFloat(document.getElementById('empWage').value) || 0;
    const status = document.getElementById('empStatus').value;
    const address = document.getElementById('empAddress').value.trim();
    const password = document.getElementById('empPassword').value.trim();

    if (!name || !email) return alert("Name and Email are required.");

    const btn = document.querySelector('#employeeModal .btn-primary');
    btn.disabled = true;
    btn.textContent = "Processing...";

    const data = {
        name, role, email, phone, wage, status, address,
        owner: window.currentUser.email
    };

    try {
        // Geocode Address if provided
        if (address) {
            try {
                const url = `https://us1.locationiq.com/v1/search.php?key=${window.LOCATIONIQ_KEY}&q=${encodeURIComponent(address)}&format=json&limit=1`;
                const res = await fetch(url);
                const geoData = await res.json();
                if (geoData && geoData[0]) {
                    data.lat = parseFloat(geoData[0].lat);
                    data.lng = parseFloat(geoData[0].lon);
                }
            } catch (geoErr) {
                console.warn("Geocoding failed, saving without map pin:", geoErr);
            }
        }

        // Create Auth User
        if (password) {
            if (password.length < 6) throw new Error("Password must be at least 6 characters.");
            if (typeof window.firebaseConfig !== 'undefined') {
                let secondaryApp;
                try {
                    secondaryApp = firebase.initializeApp(window.firebaseConfig, "Secondary");
                    await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
                    console.log("CleanDash: Auth account created for", email);
                    window.showToast("Login Credentials Created!");
                } catch (authErr) {
                    if (authErr.code !== 'auth/email-already-in-use') throw authErr;
                } finally {
                    if (secondaryApp) secondaryApp.delete();
                }
            }
        }

        // Save to DB
        if (id) {
            await db.collection('employees').doc(id).update(data);
            window.showToast("Employee updated");
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('employees').add(data);
            window.showToast("Team member added");
        }

        closeEmployeeModal();
        loadEmployees();
        if(typeof loadMap === 'function') setTimeout(loadMap, 500);

    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Member";
    }
};

window.editEmployee = function(id, name, role, email, phone, wage, status, address) {
    document.getElementById('employeeModal').style.display = 'flex';
    document.getElementById('empModalTitle').textContent = 'Edit Team Member';
    document.getElementById('empId').value = id;

    document.getElementById('empName').value = name;
    document.getElementById('empRole').value = role;
    document.getElementById('empEmail').value = email;
    document.getElementById('empPhone').value = phone;
    document.getElementById('empWage').value = wage;
    document.getElementById('empStatus').value = status;
    document.getElementById('empAddress').value = address || '';
    document.getElementById('empPassword').value = '';

    const resetContainer = document.getElementById('resetPasswordContainer');
    if(resetContainer) resetContainer.style.display = 'block';
};

window.sendResetEmail = function() {
    const email = document.getElementById('empEmail').value;
    if (!email) return alert("No email address found.");

    if(confirm(`Send a password reset link to ${email}?`)) {
        auth.sendPasswordResetEmail(email)
            .then(() => alert("Reset email sent!"))
            .catch(e => alert("Error: " + e.message));
    }
};

// --- SMART DELETE / DEACTIVATE ---
window.deleteEmployee = async function(id, name, currentStatus) {
    // If already Inactive or Waiting, allow hard delete
    if (currentStatus === 'Inactive' || currentStatus === 'Waiting') {
        if (confirm(`PERMANENTLY DELETE ${name}?\n\nThis cannot be undone. All shift history for this employee will remain, but their profile will be gone.`)) {
            await performDelete(id);
        }
    } else {
        // If Active, ask what to do
        // Options: Cancel, Mark Inactive, Mark Waiting, Delete
        const choice = prompt(
            `You are removing active employee ${name}.\n\n` +
            `Type "inactive" to move to Inactive list (Keeps history).\n` +
            `Type "waiting" to move to Waiting List.\n` +
            `Type "delete" to Permanently Delete.`
        );

        if (!choice) return;

        const action = choice.toLowerCase().trim();

        if (action === 'inactive') {
            await updateStatus(id, 'Inactive');
        } else if (action === 'waiting') {
            await updateStatus(id, 'Waiting');
        } else if (action === 'delete') {
            if(confirm("Are you sure? This deletes the profile permanently.")) await performDelete(id);
        } else {
            alert("Invalid choice. Please type 'inactive', 'waiting', or 'delete'.");
        }
    }
};

async function updateStatus(id, status) {
    try {
        await db.collection('employees').doc(id).update({ status: status });
        window.showToast(`Marked as ${status}`);
        loadEmployees();
        if(typeof loadMap === 'function') setTimeout(loadMap, 500);
    } catch (e) { alert(e.message); }
}

async function performDelete(id) {
    try {
        await db.collection('employees').doc(id).delete();
        window.showToast("Employee deleted");
        loadEmployees();
        if(typeof loadMap === 'function') setTimeout(loadMap, 500);
    } catch (e) { alert(e.message); }
}

window.loadEmployees = loadEmployees;