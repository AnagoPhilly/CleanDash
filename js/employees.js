// js/employees.js

// --- 1. CONFIGURATION ---
const EMPLOYEE_COLOR_PALETTE = [
    '#2dd4bf', '#34d399', '#60a5fa', '#a78bfa', '#f87171',
    '#fb7185', '#facc15', '#fb923c', '#4ade80', '#a3e635',
    '#818cf8', '#e879f9', '#c084fc', '#f472b6', '#67e8f9',
    '#94a3b8', '#a1a1aa', '#fcd34d', '#be185d', '#0ea5e9'
];

let selectedColor = '#2dd4bf'; // Default

// --- 2. COLOR PICKER LOGIC ---
function renderColorPalette(currentColor) {
    const paletteDiv = document.getElementById('colorPaletteGrid');
    if (!paletteDiv) return;

    paletteDiv.innerHTML = '';

    // Ensure we have a valid color selected
    selectedColor = currentColor || EMPLOYEE_COLOR_PALETTE[0];

    EMPLOYEE_COLOR_PALETTE.forEach(color => {
        const dot = document.createElement('div');
        dot.className = 'color-dot';
        dot.style.backgroundColor = color;
        dot.style.width = '24px';
        dot.style.height = '24px';
        dot.style.borderRadius = '50%';
        dot.style.cursor = 'pointer';
        dot.style.border = '2px solid white';
        dot.style.boxShadow = '0 0 0 1px #ddd';

        if (color === selectedColor) {
            dot.classList.add('selected');
            dot.style.boxShadow = '0 0 0 2px #3b82f6';
        }

        dot.onclick = () => {
            document.querySelectorAll('.color-dot').forEach(d => {
                d.classList.remove('selected');
                d.style.boxShadow = '0 0 0 1px #ddd';
            });
            dot.classList.add('selected');
            dot.style.boxShadow = '0 0 0 2px #3b82f6';
            selectedColor = color;
        };

        paletteDiv.appendChild(dot);
    });
}

// --- 3. LOAD EMPLOYEES LIST ---
window.loadEmployees = async function() {
    const activeDiv = document.getElementById('employeeListActive');
    const waitingDiv = document.getElementById('employeeListWaiting');
    const inactiveDiv = document.getElementById('employeeListInactive');

    // Clear previous lists
    if(activeDiv) activeDiv.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    if(waitingDiv) waitingDiv.innerHTML = '';
    if(inactiveDiv) inactiveDiv.innerHTML = '';

    if (!window.currentUser) return;

    try {
        const snap = await db.collection('employees')
            .where('owner', '==', window.currentUser.email)
            .orderBy('name')
            .get();

        let activeRows = '', waitingRows = '', inactiveRows = '';
        let hasActive = false, hasWaiting = false, hasInactive = false;

        // REMOVED STATUS COLUMN HEADER
        const tableHead = `
            <table class="data-table" style="width:100%; border-collapse:collapse; background:white;">
            <thead>
                <tr style="background:#f9fafb; border-bottom:2px solid #e5e7eb; text-align:left;">
                    <th style="padding:12px;">Name / Role</th>
                    <th style="padding:12px;">Address</th>
                    <th style="padding:12px;">Contact</th>
                    <th style="padding:12px;">Wage</th>
                    <th style="padding:12px; text-align:center;">Action</th>
                </tr>
            </thead>
            <tbody>`;

        snap.forEach(doc => {
            const e = doc.data();
            e.id = doc.id;

            const addressDisplay = e.address
                ? `<div>${e.address}</div>`
                : `<span style="color:#999; font-style:italic;">--</span>`;

            // REMOVED STATUS COLUMN CELL
            const row = `
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:12px;">
                    <div style="font-weight:700; color:#1f2937; display:flex; align-items:center; gap:8px;">
                        <div style="width:12px; height:12px; border-radius:50%; background-color:${e.color || '#ccc'};"></div>
                        ${e.name}
                    </div>
                    <div style="font-size:0.8rem; color:#6b7280; margin-left:20px;">${e.role}</div>
                </td>
                <td style="padding:12px; font-size:0.9rem;">${addressDisplay}</td>
                <td style="padding:12px;">
                    <div style="font-size:0.9rem;">${e.phone||'--'}</div>
                    <div style="font-size:0.8rem; color:#6b7280;">${e.email}</div>
                </td>
                <td style="padding:12px; font-family:monospace; font-weight:600;">$${(e.wage||0).toFixed(2)}/hr</td>
                <td style="padding:12px; text-align:center;">
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="editEmployee('${e.id}')">Edit</button>
                </td>
            </tr>`;

            if (e.status === 'Active') { activeRows += row; hasActive = true; }
            else if (e.status === 'Waiting') { waitingRows += row; hasWaiting = true; }
            else { inactiveRows += row; hasInactive = true; }
        });

        if(activeDiv) activeDiv.innerHTML = hasActive ? tableHead + activeRows + '</tbody></table>' : '<div style="padding:2rem; text-align:center; color:#ccc;">No active team members.</div>';
        if(waitingDiv) waitingDiv.innerHTML = hasWaiting ? tableHead + waitingRows + '</tbody></table>' : '<div style="padding:1rem; text-align:center; color:#eee;">No applicants.</div>';
        if(inactiveDiv) inactiveDiv.innerHTML = hasInactive ? tableHead + inactiveRows + '</tbody></table>' : '<div style="padding:1rem; text-align:center; color:#eee;">No inactive records.</div>';

    } catch (err) {
        console.error("Error loading employees:", err);
        if(activeDiv) activeDiv.innerHTML = '<div style="color:red; text-align:center;">Error loading list.</div>';
    }
};

// --- 4. MODAL ACTIONS (Add / Edit) ---

// Open Modal for NEW Employee
window.showAddEmployeeModal = function() {
    document.getElementById('empModalTitle').textContent = "Add Team Member";
    document.getElementById('empId').value = ""; // Clear ID -> New Mode

    // Clear Inputs
    document.getElementById('empName').value = "";
    document.getElementById('empEmail').value = "";
    document.getElementById('empPhone').value = "";
    document.getElementById('empAddress').value = "";
    document.getElementById('empWage').value = "";
    document.getElementById('empRole').value = "General Cleaner";
    document.getElementById('empStatus').value = "Active";

    // Setup Color Picker
    renderColorPalette('#2dd4bf');

    // Show Modal
    const modal = document.getElementById('employeeModal');
    modal.style.display = 'flex';
};

// Open Modal for EDIT Employee
window.editEmployee = async function(id) {
    try {
        const doc = await db.collection('employees').doc(id).get();
        if(!doc.exists) return alert("Employee not found!");

        const data = doc.data();

        document.getElementById('empModalTitle').textContent = "Edit Team Member";
        document.getElementById('empId').value = id; // Set ID -> Edit Mode

        // Populate Fields (Checking IDs from employee.html)
        document.getElementById('empName').value = data.name || '';
        document.getElementById('empEmail').value = data.email || '';
        document.getElementById('empPhone').value = data.phone || '';
        document.getElementById('empAddress').value = data.address || '';
        document.getElementById('empWage').value = data.wage || '';
        document.getElementById('empRole').value = data.role || 'General Cleaner';
        document.getElementById('empStatus').value = data.status || 'Active';

        // Set Color
        renderColorPalette(data.color || '#2dd4bf');

        // Show Modal
        document.getElementById('employeeModal').style.display = 'flex';

    } catch(e) {
        console.error(e);
        alert("Error opening editor: " + e.message);
    }
};

window.closeEmployeeModal = function() {
    document.getElementById('employeeModal').style.display = 'none';
};

// --- 5. SAVE FUNCTION ---
window.saveEmployee = async function() {
    const id = document.getElementById('empId').value;
    const name = document.getElementById('empName').value.trim();
    const email = document.getElementById('empEmail').value.trim().toLowerCase();
    const phone = document.getElementById('empPhone').value.trim();
    const role = document.getElementById('empRole').value;
    const status = document.getElementById('empStatus').value;
    const address = document.getElementById('empAddress').value.trim();
    const wage = parseFloat(document.getElementById('empWage').value) || 0;

    if (!name || !email) return alert("Name and Email are required.");

    const btn = document.querySelector('#employeeModal .btn-primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving...";

    const employeeData = {
        name, email, phone, role, status, address, wage,
        color: selectedColor,
        owner: window.currentUser.email,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (id) {
            // Update Existing
            await db.collection('employees').doc(id).update(employeeData);
            window.showToast("Employee updated!");
        } else {
            // Create New
            // 1. Create Auth Credential (Secondary App)
            const tempPass = "password";
            const secondaryApp = firebase.initializeApp(window.firebaseConfig, "Secondary");
            const userCred = await secondaryApp.auth().createUserWithEmailAndPassword(email, tempPass);

            // 2. Save to Firestore using the new UID
            await db.collection('employees').doc(userCred.user.uid).set({
                ...employeeData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Cleanup
            await secondaryApp.auth().signOut();
            secondaryApp.delete();

            window.showToast(`Employee Created! Login: ${email} / ${tempPass}`);
        }

        closeEmployeeModal();
        loadEmployees(); // Refresh List

    } catch (e) {
        console.error("Save Error:", e);
        if(e.code === 'auth/email-already-in-use') {
            alert("Error: This email is already registered in the system.");
        } else {
            alert("Error saving: " + e.message);
        }
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// Ensure functions are global
window.loadEmployees = loadEmployees;
window.saveEmployee = saveEmployee;
window.editEmployee = editEmployee;