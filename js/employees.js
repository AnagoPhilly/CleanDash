// js/employees.js

function loadEmployees() {
    console.log("CleanDash: Loading Team...");
    const listDiv = document.getElementById('employeeList');
    listDiv.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">Loading team data...</div>';

    if (!window.currentUser) return;

    // Multi-tenant check: Only load employees owned by this user
    const q = window.currentUser.email === 'admin@cleandash.com'
        ? db.collection('employees')
        : db.collection('employees').where('owner', '==', window.currentUser.email);

    q.orderBy('name').get().then(snap => {
        if (snap.empty) {
            listDiv.innerHTML = '<div style="text-align:center; padding:3rem; color:#6b7280;">No employees found. Click "+ Add Member" to build your team.</div>';
            return;
        }

        let html = `<table class="data-table">
      <thead>
        <tr>
          <th>Name / Role</th>
          <th>Location</th>
          <th>Contact</th>
          <th>Wage</th>
          <th style="text-align:center;">Status</th>
          <th style="text-align:center;">Actions</th>
        </tr>
      </thead>
      <tbody>`;

        snap.forEach(doc => {
            const e = doc.data();
            // Escape special chars to prevent JS errors
            const safeName = (e.name || '').replace(/'/g, "\\'");
            const safeAddr = (e.address || '').replace(/'/g, "\\'");

            // Status Badge Logic
            const statusBadge = e.status === 'Active'
                ? `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">Active</span>`
                : `<span style="background:#f3f4f6; color:#6b7280; padding:2px 8px; border-radius:12px; font-size:0.75rem;">Inactive</span>`;

            // Display Address or "Not set"
            const addressDisplay = e.address ? `<span style="font-size:0.8rem; color:#4b5563;">📍 ${e.address}</span>` : '<span style="color:#9ca3af; font-size:0.8rem; font-style:italic;">No address</span>';

            html += `<tr>
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
        <td style="text-align:center;">
            <div class="action-buttons">
                <button onclick="editEmployee('${doc.id}', '${safeName}', '${e.role}', '${e.email}', '${e.phone}', ${e.wage}, '${e.status}', '${safeAddr}')"
                        class="btn-xs btn-edit">Edit</button>
                <button onclick="deleteEmployee('${doc.id}', '${safeName}')"
                        class="btn-xs btn-delete">Delete</button>
            </div>
        </td>
      </tr>`;
        });
        listDiv.innerHTML = html + '</tbody></table>';
    }).catch(err => {
        console.error("Error loading employees:", err);
        listDiv.innerHTML = '<div style="color:red; text-align:center;">Error loading data.</div>';
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

    // Hide Reset Password button (Only needed for editing)
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

    // IMPORTANT: Grab the address from the input
    const address = document.getElementById('empAddress').value.trim();
    const password = document.getElementById('empPassword').value.trim();

    if (!name || !email) return alert("Name and Email are required.");

    const btn = document.querySelector('#employeeModal .btn-primary');
    btn.disabled = true;
    btn.textContent = "Processing...";

    // Data object to save to Firestore
    const data = {
        name, role, email, phone, wage, status, address, // Added 'address' here
        owner: window.currentUser.email
    };

    try {
        // 1. Geocode Address if provided
        if (address) {
            try {
                // Using LocationIQ to get lat/lng
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

        // 2. Create Login Account if Password provided (Owner-Managed Credentials)
        if (password) {
            if (password.length < 6) {
                throw new Error("Password must be at least 6 characters.");
            }

            // SECURITY TRICK: Create a secondary app to create user WITHOUT logging out the admin
            if (typeof window.firebaseConfig !== 'undefined') {
                let secondaryApp;
                try {
                    secondaryApp = firebase.initializeApp(window.firebaseConfig, "Secondary");
                    await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
                    console.log("CleanDash: Auth account created for", email);
                    window.showToast("Login Credentials Created!");
                } catch (authErr) {
                    // If error is "email-already-in-use", assume we are updating an existing profile
                    if (authErr.code !== 'auth/email-already-in-use') {
                        throw authErr;
                    } else {
                        console.log("Auth exists, assuming update.");
                    }
                } finally {
                    // Clean up the secondary app so it doesn't hog memory
                    if (secondaryApp) secondaryApp.delete();
                }
            } else {
                console.error("firebaseConfig not found. Cannot create auth user.");
            }
        }

        // 3. Save Profile to Database (Firestore)
        if (id) {
            // Update existing
            await db.collection('employees').doc(id).update(data);
            window.showToast("Employee updated");
        } else {
            // Create new
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('employees').add(data);
            window.showToast("Team member added");
        }

        closeEmployeeModal();
        loadEmployees();

        // Refresh map if the function is available
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
    document.getElementById('empAddress').value = address || ''; // Populate address field
    document.getElementById('empPassword').value = '';

    // Show Reset Password button
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

window.deleteEmployee = async function(id, name) {
    if (!confirm(`Delete ${name}? \n\nNote: It is better to set status to 'Inactive' to preserve historical records.`)) return;

    try {
        await db.collection('employees').doc(id).delete();
        window.showToast("Employee deleted");
        loadEmployees();
        if(typeof loadMap === 'function') setTimeout(loadMap, 500);
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// Export for main.js
window.loadEmployees = loadEmployees;