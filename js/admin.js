// js/admin.js

const ADMIN_EMAIL = 'nate@anagophilly.com';
let allMasterAccounts = []; // Cache for search
let allOwners = [];
let allAdmins = [];

// Add global function to create a user document
window.createOwnerDocument = async function(uid, email, name) {
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
        email: email,
        name: name,
        role: 'owner',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isAdmin: false // Default to false
    }, { merge: true });
}

auth.onAuthStateChanged(async user => {
    // 1. SECURITY GATE
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Fetch the user's profile to check for "isAdmin" flag
    let isAuthorized = false;

    // Hardcoded Super Admin (You)
    if (user.email.toLowerCase() === ADMIN_EMAIL) {
        isAuthorized = true;
    } else {
        // Check Database Permission for others
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().isAdmin === true) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        alert("⛔ ACCESS DENIED: Authorized Personnel Only.");
        window.location.href = 'index.html';
        return;
    }

    // 2. Access Granted
    document.getElementById('appLoading').style.display = 'none';
    document.getElementById('adminApp').style.display = 'flex';

    console.log("God Mode: Access Granted to", user.email);

    // --- SHOW EXIT BUTTON ONLY FOR SUPER ADMIN ---
    if (user.email.toLowerCase() === ADMIN_EMAIL) {
        const exitBtn = document.getElementById('navExitDashboard');
        if (exitBtn) exitBtn.style.display = 'block';
    }

    // Default Load (Fetches data)
    loadGodModeData();

    // FORCE DASHBOARD VIEW (Fixes the overlapping page issue)
    switchAdminTab('dashboard');

    document.getElementById('addOwnerModal').style.display = 'none';
});

// --- NAVIGATION ---
// --- TAB SWITCHING LOGIC ---
window.switchAdminTab = function(tab) {
    // 1. DEFINE ALL TABS (Must match HTML IDs exactly)
    const allTabs = ['dashboard', 'users', 'admins', 'accounts', 'import'];

    // 2. HIDE EVERYTHING FIRST
    allTabs.forEach(t => {
        const navEl = document.getElementById(`nav-${t}`);
        const viewEl = document.getElementById(`view-${t}`);

        if (navEl) navEl.classList.remove('active'); // Turn off highlight
        if (viewEl) viewEl.style.display = 'none';   // Hide the page content
    });

    // 3. SHOW THE SELECTED TAB
    const activeNav = document.getElementById(`nav-${tab}`);
    const activeView = document.getElementById(`view-${tab}`);

    if (activeNav) activeNav.classList.add('active'); // Highlight button
    if (activeView) activeView.style.display = 'block'; // Show page

    // 4. TRIGGER DATA LOADS (Lazy Loading)
    if (tab === 'dashboard') loadAdminDashboard();
    if (tab === 'accounts') loadMasterAccounts();
};

// --- VIEW 1: FRANCHISE OWNERS & DATA LOADER ---

// 1. GLOBAL FLAG (Put this outside the function)
let godModeDataLoaded = false;

async function loadGodModeData(forceRefresh = false) {
    const ownerListEl = document.getElementById('userList');

    // 2. CACHE CHECK: If data exists & we aren't forcing refresh, STOP here.
    if (godModeDataLoaded && !forceRefresh && allOwners.length > 0) {
        console.log("⚡ CleanDash: Using cached data (Saved you money!)");
        return;
    }

    // Set loading state
    ownerListEl.innerHTML = '<div style="padding:20px;">Scanning...</div>';

    try {
        console.log("🔥 CleanDash: Downloading Database..."); // Log so we know when it happens

        // Fetch all necessary collections in parallel
        const [usersSnap, accountsSnap, empSnap] = await Promise.all([
            db.collection('users').get(),
            db.collection('accounts').get(),
            db.collection('employees').get()
        ]);

        // Reset Arrays
        allOwners = [];
        allAdmins = [];
        let totalRev = 0;
        let ownerCount = 0;

        // --- A. SORT USERS INTO LISTS ---
        usersSnap.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;

            // 1. Identify Owners (Role check)
            if (data.role === 'owner') {
                allOwners.push({ id: uid, ...data, accountCount: 0, revenue: 0 });
                ownerCount++;
            }
            // 2. Identify Admins (Role check OR legacy isAdmin flag)
            else if (data.role === 'admin' || data.isAdmin === true) {
                allAdmins.push({ id: uid, ...data });
            }
        });

        // --- B. CALCULATE OWNER REVENUE ---
        const today = new Date();
        today.setHours(0,0,0,0);

        accountsSnap.forEach(doc => {
            const acc = doc.data();
            const end = acc.endDate ? new Date(acc.endDate) : null;
            const isExplicitlyInactive = (acc.status === 'Inactive');
            const isExpired = (end && end < today);

            // Only count Active accounts
            if (!isExplicitlyInactive && !isExpired) {
                const rev = parseFloat(acc.revenue) || 0;
                const owner = allOwners.find(o => o.email === acc.owner);
                if (owner) {
                    owner.accountCount++;
                    owner.revenue += rev;
                    totalRev += rev;
                }
            }
        });

        // --- C. CALCULATE ACTIVE EMPLOYEES PER OWNER ---
        const empCounts = {};
        empSnap.forEach(doc => {
            const e = doc.data();
            if (e.status === 'Active' && e.owner) {
                empCounts[e.owner] = (empCounts[e.owner] || 0) + 1;
            }
        });

        // --- 3. IMPORTANT: MARK DATA AS LOADED ---
        godModeDataLoaded = true;

        // --- D. UPDATE KPI CARDS ---
        if(document.getElementById('statOwners')) document.getElementById('statOwners').textContent = ownerCount;

        const totalActiveAccounts = allOwners.reduce((sum, owner) => sum + owner.accountCount, 0);
        if(document.getElementById('statAccounts')) document.getElementById('statAccounts').textContent = totalActiveAccounts;

        if(document.getElementById('statRevenue')) document.getElementById('statRevenue').textContent = '$' + totalRev.toLocaleString();
        if(document.getElementById('statEmployees')) document.getElementById('statEmployees').textContent = empSnap.size;

        // --- E. RENDER FRANCHISE OWNERS LIST ---
        let ownerHtml = '';
        allOwners.sort((a,b) => b.revenue - a.revenue); // Sort by highest revenue

        allOwners.forEach(u => {
            const activeEmps = empCounts[u.email] || 0;
            ownerHtml += `
            <div class="user-row">
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 1.1rem; color: #111;">${u.name}</div>
                    <div style="font-size: 0.85rem; color: #666;">${u.email}</div>
                    <div style="font-size: 0.75rem; color: #0d9488; font-weight:600;">Fran ID: ${u.franId || 'N/A'}</div>
                </div>

                <div style="text-align: center; width: 120px; margin-right: 20px;">
                    <div style="font-weight: 700; font-size: 1.2rem; color: #4b5563;">${activeEmps}</div>
                    <div style="font-size: 0.75rem; color: #9ca3af; text-transform:uppercase; font-weight:600;">Active Staff</div>
                </div>

                <div style="text-align: right; padding-right: 20px;">
                    <div style="font-weight: 700; color: #0d9488;">${u.accountCount} Accounts</div>
                    <div style="font-size: 0.9rem; color: #444;">$${u.revenue.toLocaleString()}/mo</div>
                </div>
                <div>
                    <button class="btn btn-secondary" onclick="impersonateUser('${u.email}', '${u.id}')"> View Dashboard</button>
                    <button class="btn btn-danger" style="margin-left:5px;" onclick="nukeUser('${u.id}', '${u.name}')">🗑️</button>
                </div>
            </div>`;
        });
        ownerListEl.innerHTML = ownerHtml || '<div style="padding:20px;">No Franchise Owners found.</div>';

        // --- F. RENDER ADMIN LIST ---
        renderAdmins();

        // --- NEW: AUTO-LOAD ACCOUNTS IF TAB IS OPEN ---
        if (document.getElementById('view-accounts').style.display !== 'none') {
            loadMasterAccounts();
        }

    } catch (e) {
        console.error(e);
        ownerListEl.innerHTML = `<div style="color:red; padding:20px;">Error: ${e.message}</div>`;
    }
}

window.renderMasterTable = function(data) {
    const tbody = document.getElementById('masterAccountList');
    let html = '';

    if (data.length === 0) {
        html = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#888;">No records found.</td></tr>';
    } else {
        data.forEach(acc => {
            const isActive = acc.status === 'Active';
            const statusBadge = isActive
                ? `<span class="badge badge-active">Active</span>`
                : `<span class="badge badge-inactive">${acc.status || 'Inactive'}</span>`;

            const revenue = typeof acc.revenue === 'number' ? acc.revenue : 0;

            // Use JSON.stringify and then replace single quotes to handle data object passing
            const safeAcc = JSON.stringify(acc).replace(/'/g, "\\'");

            html += `
            <tr>
                <td><span style="font-family:monospace; background:#f3f4f6; padding:2px 6px; border-radius:4px;">${acc.pid}</span></td>
                <td style="font-weight:600; color:#111;">${acc.name}</td>
                <td style="font-size:0.9rem; color:#4b5563;">${acc.address || acc.street || ''}</td>
                <td style="font-weight:600; color:#0d9488;">${acc.franId || '-'}</td>
                <td style="text-align:right; font-family:monospace;">$${revenue.toLocaleString()}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center;">
                    <button class="btn-xs btn-edit" onclick='showEditMasterAccount(${safeAcc})'>Edit</button>
                </td>
            </tr>`;
        });
    }
    tbody.innerHTML = html;
};

window.filterMasterAccounts = function() {
    const term = document.getElementById('masterSearch').value.toLowerCase();

    // Get Toggle States
    const showInactiveOnly = document.getElementById('toggleInactive').checked;
    const showOrphansOnly = document.getElementById('toggleOrphans') ? document.getElementById('toggleOrphans').checked : false;

    const filtered = allMasterAccounts.filter(acc => {
        // 1. Search Filter
        const matchesSearch = (acc.pid && String(acc.pid).toLowerCase().includes(term)) ||
               (acc.name && acc.name.toLowerCase().includes(term)) ||
               (acc.address && acc.address.toLowerCase().includes(term)) ||
               (acc.franId && acc.franId.toLowerCase().includes(term));

        // 2. Status Filter (Active vs Inactive)
        const isActive = acc.status === 'Active';
        const matchesStatus = showInactiveOnly ? !isActive : isActive;

        // 3. Orphan Filter (New)
        // If "Orphans Only" is checked, HIDE anything that is NOT an orphan
        if (showOrphansOnly && !acc.isOrphan) return false;

        return matchesSearch && matchesStatus;
    });

    renderMasterTable(filtered);
};

// --- EXPOSED MASTER ACCOUNT CRUD FUNCTIONS ---

window.showEditMasterAccount = function(acc) {
    document.getElementById('editMasterId').value = acc.id;
    document.getElementById('editMasterPidDisplay').textContent = acc.pid;
    document.getElementById('editMasterName').value = acc.name || '';
    document.getElementById('editMasterFranId').value = acc.franId || '';
    document.getElementById('editMasterRevenue').value = acc.revenue || 0;
    document.getElementById('editMasterStatus').value = acc.status || 'Active';
    document.getElementById('editMasterStartDate').value = acc.startDate || '';

    // Address fields
    document.getElementById('editMasterStreet').value = acc.street || '';
    document.getElementById('editMasterCity').value = acc.city || '';
    document.getElementById('editMasterZip').value = acc.zip || '';

    document.getElementById('editMasterAccountModal').style.display = 'flex';
};

window.saveEditedMasterAccount = async function(event) {
    const btn = event.target;
    btn.disabled = true; btn.textContent = 'Saving...';

    const masterId = document.getElementById('editMasterId').value;
    const oldAcc = allMasterAccounts.find(a => a.id === masterId);

    const newFranId = document.getElementById('editMasterFranId').value.trim();
    const newRevenue = parseFloat(document.getElementById('editMasterRevenue').value) || 0;
    const newStreet = document.getElementById('editMasterStreet').value.trim();
    const newCity = document.getElementById('editMasterCity').value.trim();
    const newZip = document.getElementById('editMasterZip').value.trim();

    // Assume state is PA if not explicitly managed in this modal
    const stateFallback = oldAcc.state || 'PA';
    const newAddress = `${newStreet}, ${newCity}, ${stateFallback} ${newZip}`;

    const updateData = {
        name: document.getElementById('editMasterName').value.trim(),
        franId: newFranId,
        revenue: newRevenue,
        status: document.getElementById('editMasterStatus').value,
        startDate: document.getElementById('editMasterStartDate').value,

        // Split Address (always update)
        street: newStreet,
        city: newCity,
        zip: newZip,
        address: newAddress, // Full address string

        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    let needsGeoUpdate = false;

    // 1. Check if address changed to trigger geocoding/full address update
    if (newAddress !== (oldAcc.address || '')) {
         needsGeoUpdate = true;
         window.showToast("Address changed. Geocoding new location...");
    }

    // 2. Perform Geocoding if needed
    if (needsGeoUpdate) {
        try {
            const baseUrl = "https://us1.locationiq.com/v1/search.php";
            const params = new URLSearchParams({
                key: window.LOCATIONIQ_KEY, // Assumes LOCATIONIQ_KEY is exposed via utils.js
                street: newStreet,
                city: newCity,
                state: stateFallback,
                postalcode: newZip,
                format: 'json',
                limit: 1,
                countrycodes: 'us'
            });

            const res = await fetch(`${baseUrl}?${params.toString()}`);
            const data = await res.json();

            if (data && data[0]) {
                updateData.lat = parseFloat(data[0].lat);
                updateData.lng = parseFloat(data[0].lon);
                window.showToast("Geocode success! Pin location updated.");
            } else {
                window.showToast("Warning: Geocoding failed for new address. Pin location remains unchanged.", 'warn');
            }
        } catch (geoErr) {
            console.error("Geocoding failed:", geoErr);
            window.showToast("Error during geocoding. Pin location remains unchanged.", 'error');
        }
    }

    // 3. Save Master Account
    await db.collection('master_client_list').doc(masterId).update(updateData);
    window.showToast('Master Account Saved!');

    // 4. Synchronize Downstream (Franchisee Accounts)
    const franchiseeAccSnap = await db.collection('accounts')
        .where('pid', '==', oldAcc.pid)
        .get();

    if (!franchiseeAccSnap.empty) {
        const batch = db.batch();
        const syncUpdate = {
            name: updateData.name,
            revenue: updateData.revenue,
            status: updateData.status,
            startDate: updateData.startDate,

            // Sync address and geo data
            address: updateData.address,
            street: updateData.street,
            city: updateData.city,
            zip: updateData.zip,
            lat: updateData.lat || null,
            lng: updateData.lng || null
        };

        let linkOwnerEmail = null;
        if (newFranId !== (oldAcc.franId || '')) {
            // Find the owner email corresponding to the new Fran ID
            const owner = allOwners.find(o => o.franId === newFranId);
            if (owner) {
                linkOwnerEmail = owner.email;
            }
        }

        franchiseeAccSnap.forEach(doc => {
            const docRef = doc.ref;
            const currentOwner = doc.data().owner;

            // Decide whether to update the owner email in the franchisee account
            const ownerUpdate = (linkOwnerEmail && linkOwnerEmail !== currentOwner)
                ? { owner: linkOwnerEmail }
                : {};

            batch.update(docRef, { ...syncUpdate, ...ownerUpdate });
        });

        await batch.commit();
        window.showToast(`Synced changes to ${franchiseeAccSnap.size} Franchisee Accounts.`, 'success');
    }

    // 5. Reload UI
    document.getElementById('editMasterAccountModal').style.display = 'none';
    loadMasterAccounts();
    loadGodModeData(); // Update system stats/owner list

    btn.disabled = false;
    btn.textContent = 'Save Master Changes';
};


// --- MODAL FUNCTIONS (Keep existing) ---
window.showAddOwnerModal = function() {
    document.getElementById('ownerName').value = '';
    document.getElementById('ownerEmail').value = '';
    document.getElementById('addOwnerModal').style.display = 'flex';
};

window.closeAddOwnerModal = function() { document.getElementById('addOwnerModal').style.display = 'none'; };

window.saveNewOwner = async function() {
    const name = document.getElementById('ownerName').value.trim();
    const rawEmail = document.getElementById('ownerEmail').value;

    // Aggressive clean
    const email = rawEmail.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
    const password = "123456"; // Default Password for new Owners

    if (!name || !email) return alert("Owner Name and Email are required.");

    const btn = document.querySelector('#addOwnerModal .btn-primary');
    btn.disabled = true;
    btn.textContent = "Creating...";

    let secondaryApp;
    let authUser = null;

    try {
        secondaryApp = firebase.initializeApp(window.firebaseConfig, "OwnerCreation");
        const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        authUser = userCredential.user;

        await createOwnerDocument(authUser.uid, email, name);

        alert(`Successfully created Owner: ${name}. Login: ${email} / "123456"`);
        closeAddOwnerModal();
        loadGodModeData();

    } catch (e) {
        if(e.code === 'auth/email-already-in-use') {
            alert(`Error: The email ${email} already exists in Firebase Auth.\n\nYou must delete this user from the Firebase Console > Authentication tab before you can recreate them.`);
        } else {
            alert("Error creating user: " + e.message);
        }
    } finally {
        if (secondaryApp) secondaryApp.delete();
        btn.disabled = false;
        btn.textContent = "Create Owner";
    }
};

window.importOwnersFromCSV = function() {
    const file = document.getElementById('ownersCsvUpload').files[0];
    if(!file) return alert("Please select a CSV file first.");

    const btn = document.getElementById('btnImportOwners');
    const statusEl = document.getElementById('importOwnerStatus');

    btn.disabled = true;
    btn.textContent = "Processing File...";
    statusEl.innerHTML = '';

    if (typeof Papa === 'undefined') return statusEl.innerHTML = '<span style="color:red;">Error: PapaParse not loaded.</span>';

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/[^a-zA-Z0-9]/g, ''),
        complete: function(results) { uploadNewOwners(results.data, btn, statusEl); },
        error: function(err) {
            alert("CSV Parsing Error: " + err.message);
            btn.disabled = false;
            btn.textContent = "🚀 Start Bulk Import and Account Creation";
        }
    });
};

async function uploadNewOwners(data, btn, statusEl) {
    let createdCount = 0;
    let failedCount = 0;
    let secondaryApp = null;
    const INITIAL_PASSWORD = "123456"; // Default Password for Imports

    try {
        if (typeof window.firebaseConfig === 'undefined') throw new Error("Firebase config not available.");
        secondaryApp = firebase.initializeApp(window.firebaseConfig, "OwnerBulkCreation");
    } catch (e) {
        statusEl.innerHTML = `<span style="color:red;">FATAL ERROR: Could not initialize Auth app: ${e.message}</span>`;
        if (secondaryApp) secondaryApp.delete();
        btn.disabled = false;
        btn.textContent = "🚀 Start Bulk Import";
        return;
    }

    statusEl.innerHTML = `Starting import of ${data.length} records...`;
    console.group("Bulk Import Log");

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        // 1. Read Data
        const rawName = row['ContactName']?.trim() || row['CompanyName']?.trim();
        const rawEmail = row['ContactEmail']?.trim() || row['Contactemail']?.trim();
        const franId = row['FranID']?.trim();

        if (!rawEmail || !rawName) {
            statusEl.innerHTML += `<div style="color:#f59e0b;">Skipping row ${i+1}: Missing Email or Name.</div>`;
            failedCount++;
            continue;
        }

        // 2. Clean Data
        const email = rawEmail.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
        const name = rawName;

        try {
            // 3. Create Auth User
            statusEl.innerHTML = `Creating ${name}...`;
            const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, INITIAL_PASSWORD);
            const uid = userCredential.user.uid;

            // 4. Create Firestore User Document
            const fullAddress = `${row.Address || ''} ${row.City || ''} ${row.State || ''} ${row.Zip || ''}`.trim();
            const cfiValue = parseFloat(row['CFee']) || 0;

            const ownerData = {
                email: email,
                name: name,
                role: 'owner',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                companyName: row['CompanyName'] || name,
                address: fullAddress,
                contactPhone: row['ContactPhone'] || '',
                cfi: cfiValue,
                purchaseDate: row['PurchaseDate'] || '',
                tempPassword: INITIAL_PASSWORD,
                franId: franId || ''
            };

            await db.collection('users').doc(uid).set(ownerData, { merge: true });
            statusEl.innerHTML = `<div style="color:#0d9488;">✅ Created: ${name}</div>`;
            console.log(`CREATED: ${email} | Password: ${INITIAL_PASSWORD}`);

            // 5. AUTOMATICALLY LINK ACCOUNTS (If FranID exists)
            if (franId) {
                statusEl.innerHTML += `<div style="font-size:0.85rem; margin-left:15px; color:#4b5563;">🔎 Searching for client accounts with FranID: ${franId}...</div>`;

                const linkedSnap = await db.collection('master_client_list').where('franId', '==', franId).get();

                if (!linkedSnap.empty) {
                    const batch = db.batch();
                    let linkCount = 0;

                    linkedSnap.forEach(clientDoc => {
                        const client = clientDoc.data();
                        const accRef = db.collection('accounts').doc(`ACC_${client.pid}`);

                        let street = client.street || '';
                        let city = client.city || '';
                        let state = client.state || '';
                        let zip = client.zip || '';

                        if (!street && client.address) {
                            const parts = client.address.split(',').map(s => s.trim());
                            if(parts.length >= 3) {
                                street = parts[0];
                                city = parts[1];
                                if(parts[2].match(/\d{5}/)) zip = parts[2].match(/\d{5}/)[0];
                            }
                        }

                        const newAccountData = {
                            pid: client.pid,
                            name: client.name || 'Unknown',
                            address: client.address || '',
                            street: street,
                            city: city,
                            state: state,
                            zip: zip,
                            revenue: client.revenue || 0,
                            owner: email,
                            status: 'Active',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            startDate: new Date().toISOString().split('T')[0],
                            contactName: client.contactName || '',
                            contactPhone: client.contactPhone || '',
                            contactEmail: client.contactEmail || '',
                            lat: client.lat || null,
                            lng: client.lng || null
                        };

                        batch.set(accRef, newAccountData, { merge: true });
                        linkCount++;
                    });

                    await batch.commit();
                    statusEl.innerHTML += `<div style="font-size:0.85rem; margin-left:15px; color:#0d9488; font-weight:bold;">↳ Linked ${linkCount} accounts!</div>`;
                } else {
                    statusEl.innerHTML += `<div style="font-size:0.85rem; margin-left:15px; color:#9ca3af;">↳ No matching clients found in Master List.</div>`;
                }
            }

            createdCount++;

        } catch (e) {
            if(e.code === 'auth/email-already-in-use') {
                 statusEl.innerHTML += `<div style="color:#ef4444; font-weight:bold;">⚠️ EXISTING AUTH: ${email} already exists. Delete in Firebase Console to reset.</div>`;
            } else {
                 statusEl.innerHTML += `<div style="color:#ef4444;">❌ Failed: ${name} (${email}) - ${e.message}</div>`;
            }
            failedCount++;
        }
    }

    console.groupEnd();
    if (secondaryApp) secondaryApp.delete();

    statusEl.innerHTML += `<hr><strong>Finished: ${createdCount} new, ${failedCount} skipped/failed.</strong>`;
    alert(`Import Complete! Check status log for details.`);

    loadGodModeData();
    btn.disabled = false;
    btn.textContent = "🚀 Start Bulk Import and Account Creation";
}

// --- ACTIONS ---
window.impersonateUser = function(email, uid) {
    let url = `index.html?viewAs=${encodeURIComponent(email)}`;
    // Only append ID if it is a valid string
    if (uid && uid !== 'undefined' && uid !== 'null') {
        url += `&targetId=${encodeURIComponent(uid)}`;
    }
    window.location.href = url;
};

window.nukeUser = async function(uid, name) {
    if(!confirm(`⚠️ DANGER ZONE:\n\nAre you sure you want to DELETE ${name}'s account?\n\nDO NOT PUSH UNLESS YOU REALLY, REALLY, MEAN IT!`)) return;
    if (prompt(`Type "DELETE" to confirm destroying ${name}'s account`) !== "DELETE") return;

    try {
        await db.collection('users').doc(uid).delete();
        alert("User document deleted. Have a nice day");
        loadGodModeData();
    } catch(e) { alert("Error: " + e.message); }
};

window.filterUsers = function() {
    const term = document.getElementById('userSearch').value.toLowerCase();
    document.querySelectorAll('.user-row').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(term) ? 'flex' : 'none';
    });
};

// --- NEW ADMIN ACTIONS ---

// 1. Show/Hide Modal
window.showAddAdminModal = function() {
    document.getElementById('addAdminModal').style.display = 'flex';
};

// 2. Create New Admin
window.saveNewAdmin = async function() {
    const name = document.getElementById('newAdminName').value;
    const email = document.getElementById('newAdminEmail').value.toLowerCase().trim();

    if(!name || !email) return alert("Please fill all fields");

    try {
        const dummyPass = "123456"; // Default Password for Admins

        // A. Create Authentication Record
        const userCred = await firebase.auth().createUserWithEmailAndPassword(email, dummyPass);

        // B. Create Database Record (With isAdmin: true)
        await db.collection('users').doc(userCred.user.uid).set({
            name: name,
            email: email,
            role: 'admin',      // Distinct role
            isAdmin: true,      // The important flag
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Admin Created Successfully!\n\nEmail: ${email}\nPassword: ${dummyPass}`);

        document.getElementById('addAdminModal').style.display = 'none';

        // Reload list to show new admin
        loadGodModeData();

    } catch(e) {
        alert("Error creating admin: " + e.message);
    }
};

// --- NEW ADMIN LIST RENDERER ---
function renderAdmins() {
    const tbody = document.getElementById('adminListBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // If no admins found
    if (allAdmins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#888;">No other admins found.</td></tr>';
        return;
    }

    allAdmins.forEach(admin => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td style="font-weight:600;">
                ${admin.name || 'Unknown'}
                ${admin.email === window.currentUser.email ? '<span class="badge badge-active" style="margin-left:5px;">YOU</span>' : ''}
            </td>
            <td>${admin.email}</td>
            <td style="text-align:center;">
                <button class="btn-delete btn-xs" onclick="deleteAdmin('${admin.id}', '${admin.name}')">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- DELETE ADMIN FUNCTION ---
window.deleteAdmin = async function(uid, name) {
    // 1. Safety Check (Prevent deleting yourself)
    if (window.currentUser && uid === window.currentUser.uid) {
        alert("You cannot delete your own account while logged in.");
        return;
    }

    // 2. Confirmation
    if (!confirm(`⚠️ ARE YOU SURE?\n\nThis will permanently delete the admin account for:\n${name}\n\nThey will lose access immediately.`)) {
        return;
    }

    try {
        // 3. Delete from Database
        await db.collection('users').doc(uid).delete();

        // 4. Update UI
        alert(`Admin ${name} deleted.`);
        loadGodModeData(); // Refresh the list

    } catch (e) {
        console.error(e);
        alert("Error deleting admin: " + e.message);
    }
};

// --- ADDED THIS FUNCTION TO FIX MASTER CLIENT LIST LOADING (UPDATED WITH ORPHAN LOGIC) ---
window.loadMasterAccounts = async function() {
    const tbody = document.getElementById('masterAccountList');
    if (!tbody) return;

    // 1. Show Loading State
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Refreshing Database...</td></tr>';

    const activeEl = document.getElementById('statMasterActive');
    const orphanEl = document.getElementById('statMasterOrphan');
    if (activeEl) activeEl.textContent = "Active: ...";
    if (orphanEl) orphanEl.textContent = "Orphans: ...";

    try {
        // 2. Fetch Master List AND Users
        const [masterSnap, usersSnap] = await Promise.all([
            db.collection('master_client_list').orderBy('pid').get(),
            db.collection('users').where('role', '==', 'owner').get()
        ]);

        // 3. Build Owner Whitelist (Valid FranIDs)
        const validFranIds = new Set();
        usersSnap.forEach(doc => {
            const d = doc.data();
            if (d.franId) validFranIds.add(d.franId.toUpperCase().trim());
        });

        // 4. Cache Data & Tag Orphans
        allMasterAccounts = [];
        let activeCount = 0;
        let orphanCount = 0;

        masterSnap.forEach(doc => {
            const acc = { id: doc.id, ...doc.data() };

            // --- TAGGING LOGIC ---
            const franId = (acc.franId || '').toUpperCase().trim();
            // An account is an orphan if it HAS NO FranID, OR the FranID doesn't match an owner
            acc.isOrphan = (!franId || !validFranIds.has(franId));

            allMasterAccounts.push(acc);

            // Update Counters
            if (acc.status === 'Active') {
                activeCount++;
                if (acc.isOrphan) orphanCount++;
            }
        });

        // 5. Update UI Counters (Neutral Styling Only)
        if (activeEl) activeEl.textContent = `Active: ${activeCount}`;
        if (orphanEl) {
            orphanEl.textContent = `Orphans: ${orphanCount}`;
            // Removed the "if (orphanCount > 0) turn red" logic
            orphanEl.style.backgroundColor = '#f3f4f6';
            orphanEl.style.color = '#6b7280';
            orphanEl.style.borderColor = '#d1d5db';
        }

        console.log(`Loaded ${allMasterAccounts.length} master accounts.`);
        filterMasterAccounts();

    } catch (e) {
        console.error("Error loading master accounts:", e);
        // Basic error fallback
        tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Error: ${e.message}</td></tr>`;
    }
};

// --- ADMIN DATA IMPORTER LOGIC ---

// Helper: Sleep for rate limiting (Geocoding)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: Format Date
function formatDate(dateStr) {
    if(!dateStr) return null;
    const parts = dateStr.trim().replace(/-/g, '/').split('/');
    if(parts.length === 3) {
        let y = parts[2];
        if (y.length === 2) y = "20" + y;
        const m = parts[0].padStart(2,'0');
        const d = parts[1].padStart(2,'0');
        return `${y}-${m}-${d}`;
    }
    return null;
}

// Helper: Geocoding
async function getCoordinates(street, city, state, zip) {
    if (!street && !city) return null;
    try {
        const key = window.LOCATIONIQ_KEY || "pk.c92dcfda3c6ea1c6da25f0c36c34c99e";
        const baseUrl = "https://us1.locationiq.com/v1/search.php";
        const params = new URLSearchParams({
            key: key,
            street: street,
            city: city,
            state: state,
            postalcode: zip,
            format: 'json',
            limit: 1,
            countrycodes: 'us'
        });

        const res = await fetch(`${baseUrl}?${params.toString()}`);
        const data = await res.json();
        if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (e) { console.log("Geo error", e); }
    return null;
}

// Helper: Get Map of FranIDs to Owner Emails
async function getFranIdMap() {
    const map = {};
    const snap = await db.collection('users').where('role', '==', 'owner').get();
    snap.forEach(doc => {
        const data = doc.data();
        if (data.franId) {
            map[data.franId.toUpperCase()] = data.email;
        }
    });
    return map;
}

// --- MAIN PROCESS FUNCTION (Called by the Button) ---
window.processFile = function() {
    const file = document.getElementById('uploadCsv').files[0];
    const mode = document.getElementById('importType').value;

    if(!file) return alert("Please select a CSV file first.");

    const btn = document.getElementById('btnUpload');
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('log');

    btn.disabled = true;
    btn.textContent = "Processing...";
    statusEl.textContent = "Parsing CSV...";
    logEl.innerHTML = '';

    if (typeof Papa === 'undefined') {
        btn.disabled = false;
        return alert("Error: PapaParse library not loaded. Check internet connection.");
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: function(results) {
            if(mode === 'master') uploadMasterList(results.data, btn, statusEl, logEl);
            else if(mode === 'cancelled') uploadCancelledList(results.data, btn, statusEl, logEl);
            else uploadHistoryBook(results.data, btn, statusEl, logEl);
        },
        error: function(err) {
            alert("CSV Error: " + err.message);
            btn.disabled = false;
            btn.textContent = "Start Import";
        }
    });
};

// --- IMPORT FUNCTION: MASTER LIST ---
async function uploadMasterList(data, btn, statusEl, logEl) {
    statusEl.textContent = `Importing ${data.length} Master Records...`;
    const doGeo = document.getElementById('geoEnabled').checked;

    // Get Owners Map for linking
    const franMap = await getFranIdMap();

    let batch = db.batch();
    let count = 0;
    let ops = 0;

    for (const row of data) {
        const pid = row['Client ID'] || row['Clientid'];
        if (!pid) continue;

        // Extract Data
        const addr = (row['Site Address'] || '').trim();
        const city = (row['Site City'] || '').trim();
        const state = (row['Site State'] || '').trim() || 'PA';
        const zip = (row['Site Zip'] || '').trim();
        const fullAddress = [addr, city, state, zip].filter(Boolean).join(', ');
        const franId = (row['Fran ID'] || '').trim().toUpperCase();

        // Geocoding (Slows down import significantly if enabled)
        let lat = null, lng = null;
        if (doGeo && addr.length > 3) {
            // Update the main status text immediately
            statusEl.textContent = `Geocoding ${count + 1}/${data.length}: ${row['Service Loc'] || 'Unknown'}...`;

            await sleep(650); // Rate limit
            const coords = await getCoordinates(addr, city, state, zip);

            if (coords) {
                lat = coords.lat;
                lng = coords.lng;

                // Print SUCCESS to the black box log
                logEl.innerHTML += `<div style="color:#0d9488; font-size:0.8rem;">📍 Found: ${row['Service Loc']}</div>`;
                logEl.scrollTop = logEl.scrollHeight; // Auto-scroll down
            } else {
                // Print FAILURE to the black box log
                logEl.innerHTML += `<div style="color:#ef4444; font-size:0.8rem;">❌ Geo Fail: ${row['Service Loc']}</div>`;
            }
        }

        const clientData = {
            pid: pid,
            status: 'Active',
            name: row['Service Loc'] || row['Service Location Name'] || '',
            address: fullAddress,
            street: addr, city: city, state: state, zip: zip,
            revenue: parseFloat((row['Recur Amt']||'0').replace(/[$,]/g, '')),
            contactName: row['Contact Name'] || '',
            contactPhone: row['Contact Phone'] || '',
            contactEmail: row['Contact Email'] || '',
            franId: franId,
            startDate: formatDate(row['Start Date']),
            lastImportedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (lat) { clientData.lat = lat; clientData.lng = lng; }

        // 1. Update Master List
        const masterRef = db.collection('master_client_list').doc(String(pid).trim());
        batch.set(masterRef, clientData, { merge: true });

        // 2. Sync to Franchisee Account (if owner exists)
        const ownerEmail = franMap[franId];
        if (ownerEmail) {
            const accRef = db.collection('accounts').doc(`ACC_${pid}`);
            batch.set(accRef, { ...clientData, owner: ownerEmail }, { merge: true });
        } else {
             logEl.innerHTML += `<div style="color:orange;">⚠️ Orphan: Client ${pid} (FranID: ${franId}) has no owner.</div>`;
        }

        count++;
        ops++;

        // Commit batches of 400
        if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
            statusEl.textContent = `Saved ${count} records...`;
        }
    }

    if (ops > 0) await batch.commit();

    statusEl.textContent = "✅ Import Complete!";
    alert(`Successfully processed ${count} records.`);
    btn.disabled = false;
    btn.textContent = "Start Import";

    // Refresh Table
    if(window.loadMasterAccounts) window.loadMasterAccounts();
}

// --- IMPORT FUNCTION: CANCELLED LIST ---
async function uploadCancelledList(data, btn, statusEl, logEl) {
    statusEl.textContent = `Processing ${data.length} Cancellations...`;
    let batch = db.batch();
    let count = 0;
    let ops = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    for (const row of data) {
        const pid = row['Client ID'] || row['Clientid'] || row['PID'];
        if (!pid) continue;

        const cancelDateRaw = row['Cancel Date'] || row['CancelDate'];
        const formattedCancelDate = formatDate(cancelDateRaw) || todayStr;
        const customReason = row['Cancel Reason'] || 'Imported from Cancelled List';

        // Update Master
        const masterRef = db.collection('master_client_list').doc(String(pid).trim());
        batch.set(masterRef, {
            status: 'Inactive',
            endDate: formattedCancelDate,
            inactiveReason: customReason
        }, { merge: true });

        // Update Franchisee Account
        const accRef = db.collection('accounts').doc(`ACC_${pid}`);
        batch.set(accRef, {
            status: 'Inactive',
            endDate: formattedCancelDate,
            inactiveReason: customReason
        }, { merge: true });

        count++;
        ops++;

        if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }

    if (ops > 0) await batch.commit();

    statusEl.textContent = "✅ Cancellations Processed";
    btn.disabled = false;
    btn.textContent = "Start Import";
    if(window.loadMasterAccounts) window.loadMasterAccounts();
}

// --- IMPORT FUNCTION: HISTORY (Legacy) ---
async function uploadHistoryBook(data, btn, statusEl, logEl) {
    btn.disabled = false;
    btn.textContent = "Start Import";
    alert("History import logic placeholder executed.");
}

// --- UTILS for UI ---
window.wipeMasterList = async function() {
    if(!confirm("⚠️ DANGER: Delete ALL Master Client records?")) return;
    if(prompt("Type DELETE to confirm") !== "DELETE") return;

    const snap = await db.collection('master_client_list').get();
    const btn = document.querySelector('button[onclick="wipeMasterList()"]');
    btn.textContent = "Deleting...";

    let batch = db.batch();
    let count = 0;
    for(const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        if(count % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    btn.textContent = "Wipe Master Data";
    alert("Master List Wiped.");
    if(window.loadMasterAccounts) window.loadMasterAccounts();
};


// 1. Initialize & Load the Map
// --- ADMIN DASHBOARD (MAP) LOGIC ---

let adminMap = null;

// GLOBAL DATA STORE (To avoid re-fetching when filtering)
let mapData = {
    owners: [],
    accounts: [],
    employees: []
};

// GLOBAL LAYERS (Used for Toggling)
let layers = {
    owners: null,
    accounts: null,
    employees: null
};

// --- UPDATED ADMIN DASHBOARD LOGIC (SHOWS ALL MASTER ACCOUNTS) ---

// 1. HELPER: Smart Geocode (Kept the same)
async function smartGeocodeOwner(address) {
    // ... (No changes needed here, keep your existing helper) ...
    try {
        const key = window.LOCATIONIQ_KEY || "pk.c92dcfda3c6ea1c6da25f0c36c34c99e";
        const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0]) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (e) { console.warn("Geo fail:", e); }
    return null;
}

// 2. TOGGLE & FILTER FUNCTION (UPDATED POPUP)
window.updateMapLayers = function() {
    if (!adminMap) return;

    // A. Get Controls
    const showAcc = document.getElementById('toggleLayerAccounts') ? document.getElementById('toggleLayerAccounts').checked : true;
    const showOwn = document.getElementById('toggleLayerOwners') ? document.getElementById('toggleLayerOwners').checked : true;
    const showEmp = document.getElementById('toggleLayerEmployees') ? document.getElementById('toggleLayerEmployees').checked : true;
    const selectedOwnerId = document.getElementById('mapOwnerFilter') ? document.getElementById('mapOwnerFilter').value : 'all';

    console.log("Filtering Map... Selected:", selectedOwnerId);

    // B. Clear Layers
    if (layers.owners) layers.owners.clearLayers();
    if (layers.accounts) layers.accounts.clearLayers();
    if (layers.employees) layers.employees.clearLayers();

    // C. Define Icons
    const RedIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
    const BlueIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
    const GreyIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }); // Added Grey for orphans
    const GreenIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

    // D. Filter & Re-Draw Owners
    const ownerObj = mapData.owners.find(o => o.id === selectedOwnerId);

    mapData.owners.forEach(d => {
        if (selectedOwnerId === 'all' || d.id === selectedOwnerId) {
            if (d.lat && d.lng) {
                L.marker([d.lat, d.lng], { icon: RedIcon })
                    .bindPopup(`<b>👑 OWNER: ${d.name}</b><br>${d.email}`)
                    .addTo(layers.owners);
            }
        }
    });

    // E. Filter & Re-Draw Accounts (UPDATED FOR ORPHANS)
    mapData.accounts.forEach(d => {
        let match = true;

        // Filter Logic
        if (selectedOwnerId !== 'all' && ownerObj) {
            const aId = String(d.franId || '').toLowerCase();
            const oId = String(ownerObj.franId || '').toLowerCase();
            // If the account has no ID, or IDs don't match, hide it
            if (!aId || aId !== oId) match = false;
        }

        if (match && d.lat && d.lng) {
            // Determine Owner Label
            let ownerLabel = `<span style="color:#ef4444; font-weight:bold;">Owner: No user assigned</span>`;
            let iconToUse = GreyIcon; // Default to orphan (Grey)

            if (d.resolvedOwnerName) {
                ownerLabel = `<span style="color:#0d9488; font-weight:bold;">Owner: ${d.resolvedOwnerName}</span>`;
                iconToUse = BlueIcon; // Assigned (Blue)
            }

            L.marker([d.lat, d.lng], { icon: iconToUse })
                .bindPopup(`
                    <div style="font-size:1.1rem; font-weight:bold; color:#1f2937;">${d.name}</div>
                    <div style="font-size:0.9rem; margin-bottom:5px;">${d.address}</div>
                    <hr style="border:0; border-top:1px solid #eee; margin:5px 0;">
                    <div style="font-size:0.85rem;">${ownerLabel}</div>
                    <div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">PID: ${d.pid} | FranID: ${d.franId || 'N/A'}</div>
                `)
                .addTo(layers.accounts);
        }
    });

    // F. Filter & Re-Draw Employees
    mapData.employees.forEach(d => {
        let match = true;
        if (selectedOwnerId !== 'all' && ownerObj) {
            match = false;
            const targetFranId = String(ownerObj.franId || '').toLowerCase().trim();
            const targetEmail = String(ownerObj.email || '').toLowerCase().trim();
            const targetName = String(ownerObj.name || '').toLowerCase().trim();
            const empLink = String(d.owner || d.ownerEmail || '').toLowerCase().trim();

            if (targetFranId && empLink === targetFranId) match = true;
            if (targetEmail && empLink === targetEmail) match = true;
            if (targetName && empLink === targetName) match = true;
            if (targetFranId.length > 2 && empLink.includes(targetFranId)) match = true;
        }

        if (match && d.lat && d.lng) {
            L.marker([d.lat, d.lng], { icon: GreenIcon })
                .bindPopup(`<b>👷 EMPLOYEE: ${d.name}</b><br>Linked to: ${d.owner}`)
                .addTo(layers.employees);
        }
    });

    // G. Apply to Map
    if (showOwn) adminMap.addLayer(layers.owners); else adminMap.removeLayer(layers.owners);
    if (showAcc) adminMap.addLayer(layers.accounts); else adminMap.removeLayer(layers.accounts);
    if (showEmp) adminMap.addLayer(layers.employees); else adminMap.removeLayer(layers.employees);
};

// 3. MAIN LOAD FUNCTION (SWITCHED TO MASTER LIST)
window.loadAdminDashboard = async function() {
    console.log("Loading Admin Dashboard (Global View)...");

    const statAcc = document.getElementById('mapStatAccounts');
    const statOwn = document.getElementById('mapStatOwners');
    const statEmp = document.getElementById('mapStatEmployees');
    const filterSelect = document.getElementById('mapOwnerFilter');

    if(statAcc) statAcc.innerText = '...';

    // Initialize Map
    if (!adminMap) {
        adminMap = L.map('adminMap').setView([39.9526, -75.1652], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(adminMap);
    }

    if (!layers.owners) layers.owners = L.layerGroup();
    if (!layers.accounts) layers.accounts = L.layerGroup();
    if (!layers.employees) layers.employees = L.layerGroup();

    try {
        // --- DATA FETCH: Using Master List instead of Accounts Collection ---
        const [usersSnap, masterSnap, employeesSnap] = await Promise.all([
            db.collection('users').where('role', '==', 'owner').get(),
            db.collection('master_client_list').where('status', '==', 'Active').get(), // <--- CRITICAL CHANGE
            db.collection('employees').where('status', '==', 'Active').get()
        ]);

        if(statAcc) statAcc.innerText = masterSnap.size; // Now shows 584
        if(statOwn) statOwn.innerText = usersSnap.size;
        if(statEmp) statEmp.innerText = employeesSnap.size;

        // Reset Data
        mapData.owners = [];
        mapData.accounts = [];
        mapData.employees = [];

        // 1. PROCESS OWNERS & Build Lookup Map
        if (filterSelect) filterSelect.innerHTML = '<option value="all">-- Show All Owners --</option>';

        const ownerLookup = {}; // Map: FranID -> Name

        const ownerPromises = usersSnap.docs.map(async doc => {
            const d = doc.data();
            d.id = doc.id;
            mapData.owners.push(d);

            // Populate Lookup
            if (d.franId) {
                ownerLookup[d.franId.toUpperCase()] = d.name;
            }

            if (filterSelect) {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.innerText = `${d.name} (${d.franId || '?'})`;
                filterSelect.appendChild(opt);
            }

            // Self-Heal Pins
            if ((!d.lat || !d.lng) && (d.address || d.street)) {
                const queryAddr = d.address || `${d.street || ''} ${d.city || ''} ${d.state || ''} ${d.zip || ''}`;
                if (queryAddr.trim().length > 5) {
                    const coords = await smartGeocodeOwner(queryAddr);
                    if (coords) {
                        d.lat = coords.lat; d.lng = coords.lng;
                        await db.collection('users').doc(doc.id).update({ lat: coords.lat, lng: coords.lng });
                    }
                }
            }
        });
        await Promise.all(ownerPromises);

        // 2. PROCESS ACCOUNTS (Master List)
        masterSnap.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;

            // Resolve Owner Name
            d.resolvedOwnerName = null;
            if (d.franId && ownerLookup[d.franId.toUpperCase()]) {
                d.resolvedOwnerName = ownerLookup[d.franId.toUpperCase()];
            }

            mapData.accounts.push(d);
        });

        // 3. PROCESS EMPLOYEES
        const empPromises = employeesSnap.docs.map(async doc => {
            const d = doc.data();
            d.id = doc.id;
            if ((!d.lat || !d.lng) && d.address) {
                const coords = await smartGeocodeOwner(d.address);
                if (coords) {
                    d.lat = coords.lat; d.lng = coords.lng;
                    await db.collection('employees').doc(doc.id).update({ lat: coords.lat, lng: coords.lng });
                }
            }
            mapData.employees.push(d);
        });
        await Promise.all(empPromises);

        // --- DRAW INITIAL MAP ---
        updateMapLayers();

        // Fit Bounds
        const allPoints = [];
        mapData.owners.forEach(d => { if(d.lat) allPoints.push([d.lat, d.lng]); });
        mapData.accounts.forEach(d => { if(d.lat) allPoints.push([d.lat, d.lng]); });

        if (allPoints.length > 0) {
            adminMap.fitBounds(allPoints, { padding: [50, 50] });
        }
        setTimeout(() => { adminMap.invalidateSize(); }, 300);

    } catch (e) {
        console.error("Admin Dashboard Error:", e);
    }
};
// --- UTILITY: Check Master Record Count ---
window.checkRecordCount = async function() {
    const btn = document.querySelector('button[onclick="checkRecordCount()"]');
    const originalText = btn ? btn.textContent : "Check Master Count";

    if(btn) {
        btn.textContent = "Counting...";
        btn.disabled = true;
    }

    try {
        // Count documents in the master list collection
        const snap = await db.collection('master_client_list').get();
        alert(`Total Master Records in Database: ${snap.size}`);
    } catch (e) {
        console.error(e);
        alert("Error reading database: " + e.message);
    } finally {
        if(btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
};

// --- NEW TOOL: REPAIR MISSING LOCATIONS ---
window.repairEmployeeLocations = async function() {
    const btn = document.querySelector('button[onclick="repairEmployeeLocations()"]');
    if(btn) { btn.innerText = "⏳ Fixing..."; btn.disabled = true; }

    try {
        console.log("Starting Geo-Repair...");
        const snapshot = await db.collection('employees').where('status', '==', 'Active').get();
        let fixedCount = 0;

        // Process sequentially to respect API limits
        for (const doc of snapshot.docs) {
            const d = doc.data();

            // IF missing coords BUT has address
            if ((!d.lat || !d.lng) && d.address) {
                console.log(`Attempting to geocode: ${d.name} (${d.address})`);

                // 1. Clean Address (Fix common typos like 'Pa.' instead of 'PA')
                let cleanAddr = d.address.replace(/Pa\./gi, 'PA').replace(/Nj/gi, 'NJ');

                // 2. Fetch Coords
                const coords = await smartGeocodeOwner(cleanAddr);

                if (coords) {
                    console.log(` -> Success! Lat: ${coords.lat}, Lng: ${coords.lng}`);

                    // 3. Save to DB
                    await db.collection('employees').doc(doc.id).update({
                        lat: coords.lat,
                        lng: coords.lng
                    });

                    // 4. Update Local Data Immediately
                    const localEmp = mapData.employees.find(e => e.id === doc.id);
                    if (localEmp) {
                        localEmp.lat = coords.lat;
                        localEmp.lng = coords.lng;
                    }
                    fixedCount++;
                } else {
                    console.warn(` -> Failed to find location for: ${cleanAddr}`);
                }

                // Tiny pause to be nice to the API
                await new Promise(r => setTimeout(r, 600));
            }
        }

        if (fixedCount > 0) {
            alert(`✅ Successfully located and pinned ${fixedCount} employees! The map will now update.`);
            updateMapLayers(); // Redraw map immediately
        } else {
            alert("No employees with valid addresses were missing pins. (Check console for failures)");
        }

    } catch (e) {
        console.error("Repair failed:", e);
        alert("Error fixing pins: " + e.message);
    } finally {
        if(btn) { btn.innerText = "📍 Fix Missing Pins"; btn.disabled = false; }
    }
};