// js/accounts.js

function loadAccountsList() {
  if (!window.currentUser) return;

  const q = window.currentUser.email === 'admin@cleandash.com'
    ? db.collection('accounts')
    : db.collection('accounts').where('owner', '==', window.currentUser.email);

  q.orderBy('createdAt', 'desc').get().then(snap => {
    const div = document.getElementById('accountsList');
    if (snap.empty) {
      div.innerHTML = '<div style="text-align:center; padding:3rem; color:#6b7280;">No accounts yet — click "+ Add Account"</div>';
      return;
    }
    let html = `<table class="data-table">
      <thead>
        <tr>
          <th>Name / Contact</th>
          <th>Address / Alarm</th>
          <th style="text-align:center;">Status</th>
          <th style="text-align:right;">Revenue</th>
          <th style="text-align:center;">Actions</th>
        </tr>
      </thead>
      <tbody>`;

    const today = new Date().toISOString().split('T')[0];

    snap.forEach(doc => {
      const a = doc.data();
      const safeName = (a.name || '').replace(/'/g, "\\'");
      const safeAddress = (a.address || '').replace(/'/g, "\\'");

      // Status Logic
      let isActive = true;
      let statusBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">Active</span>`;
      let rowStyle = '';

      if (a.endDate && a.endDate <= today) {
          isActive = false;
          statusBadge = `<span style="background:#f3f4f6; color:#6b7280; padding:2px 8px; border-radius:12px; font-size:0.75rem;">Inactive</span>`;
          rowStyle = 'opacity: 0.6; background: #fafafa;';
      }

      // --- NEW CONTACT DISPLAY LOGIC ---
      let contactParts = [];
      if (a.contactName) contactParts.push(`👤 ${a.contactName}`);
      if (a.contactPhone) contactParts.push(`📞 ${a.contactPhone}`);
      if (a.contactEmail) contactParts.push(`✉️ ${a.contactEmail}`);

      const contactDisplay = contactParts.length > 0
          ? `<div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">${contactParts.join(' &nbsp;•&nbsp; ')}</div>`
          : '';

      const alarmDisplay = a.alarmCode ? `<div style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">🚨 Alarm: ${a.alarmCode}</div>` : '';

      html += `<tr style="${rowStyle}">
        <td>
            <div style="font-weight:600; color:#111827;">${a.name}</div>
            ${contactDisplay}
        </td>
        <td>
            <div style="color:#4b5563; font-size:0.9rem;">${a.address}</div>
            ${alarmDisplay}
        </td>
        <td style="text-align:center;">${statusBadge}</td>
        <td class="col-revenue">$${(a.revenue || 0).toLocaleString()}</td>
        <td style="text-align:center;">
            <div class="action-buttons">
                <button onclick="openSpecsModal('${doc.id}', '${safeName}', 'view')"
                        class="btn-xs btn-specs-view">
                    <span>👁️</span> Specs
                </button>
                <button onclick="showEditAccount(
                    '${doc.id}',
                    '${safeName}',
                    '${safeAddress}',
                    ${a.revenue || 0},
                    '${a.startDate || ''}',
                    '${a.endDate || ''}',
                    '${a.contactName || ''}',
                    '${a.contactPhone || ''}',
                    '${a.contactEmail || ''}',
                    '${a.alarmCode || ''}'
                )" class="btn-xs btn-edit">Edit</button>
                <button onclick="deleteAccount('${doc.id}', '${safeName}')"
                        class="btn-xs btn-delete">Delete</button>
            </div>
        </td>
      </tr>`;
    });
    div.innerHTML = html + '</tbody></table>';
  });
}

// --- CRUD Operations ---

window.showAddAccount = function() {
  document.getElementById('addAccountModal').style.display = 'flex';
}

window.hideAddAccount = function() {
  document.getElementById('addAccountModal').style.display = 'none';
  const inputs = document.querySelectorAll('#addAccountModal input');
  inputs.forEach(i => i.value = '');
}

window.saveNewAccount = async () => {
    const name = document.getElementById('accountName').value.trim();
    const address = document.getElementById('accountAddress').value.trim();
    const revenue = Number(document.getElementById('accountRevenue').value);
    const startDate = document.getElementById('accountStartDate').value;
    const endDate = document.getElementById('accountEndDate').value;
    const alarm = document.getElementById('accountAlarm').value.trim();

    const cName = document.getElementById('contactName').value.trim();
    const cPhone = document.getElementById('contactPhone').value.trim();
    const cEmail = document.getElementById('contactEmail').value.trim();

    if (!name || !address) return alert('Name and Address are required');

    try {
        const url = `https://us1.locationiq.com/v1/search.php?key=${window.LOCATIONIQ_KEY}&q=${encodeURIComponent(address)}&format=json&limit=1`;
        const res = await fetch(url);
        const data = await res.json();

        const accountData = {
            name, address, revenue, startDate, endDate, alarmCode: alarm,
            contactName: cName, contactPhone: cPhone, contactEmail: cEmail,
            owner: window.currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (data && data[0]) {
            accountData.lat = parseFloat(data[0].lat);
            accountData.lng = parseFloat(data[0].lon);
        }

        await db.collection('accounts').add(accountData);
        window.showToast('Account added!');
        hideAddAccount();
        loadAccountsList();
        if (typeof loadMap === 'function') loadMap();

    } catch (e) {
        alert('Error: ' + e.message);
    }
};

window.showEditAccount = function(id, name, address, revenue, startDate, endDate, cName, cPhone, cEmail, alarm) {
  document.getElementById('editAccountId').value = id;
  document.getElementById('editAccountName').value = name;
  document.getElementById('editAccountAddress').value = address;
  document.getElementById('editAccountRevenue').value = revenue;
  document.getElementById('editAccountStartDate').value = startDate || '';
  document.getElementById('editAccountEndDate').value = endDate || '';

  document.getElementById('editContactName').value = cName || '';
  document.getElementById('editContactPhone').value = cPhone || '';
  document.getElementById('editContactEmail').value = cEmail || '';
  document.getElementById('editAccountAlarm').value = alarm || '';

  document.getElementById('editAccountModal').style.display = 'flex';
}

window.hideEditAccount = function() {
  document.getElementById('editAccountModal').style.display = 'none';
}

window.saveEditedAccount = async (event) => {
    const btn = event.target;
    btn.disabled = true; btn.textContent = 'Saving...';

    const id = document.getElementById('editAccountId').value;
    const name = document.getElementById('editAccountName').value.trim();
    const address = document.getElementById('editAccountAddress').value.trim();
    const revenue = Number(document.getElementById('editAccountRevenue').value);
    const startDate = document.getElementById('editAccountStartDate').value;
    const endDate = document.getElementById('editAccountEndDate').value;
    const alarm = document.getElementById('editAccountAlarm').value.trim();

    const cName = document.getElementById('editContactName').value.trim();
    const cPhone = document.getElementById('editContactPhone').value.trim();
    const cEmail = document.getElementById('editContactEmail').value.trim();

    try {
        await db.collection('accounts').doc(id).update({
            name, address, revenue, startDate, endDate,
            alarmCode: alarm, contactName: cName, contactPhone: cPhone, contactEmail: cEmail
        });
        window.showToast('Updated!');
        window.hideEditAccount();
        loadAccountsList();
        if (typeof loadMap === 'function') loadMap();
        if (typeof generateMetricsGraphFromDB === 'function') generateMetricsGraphFromDB();

    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Save Changes';
    }
};

window.deleteAccount = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
        await db.collection('accounts').doc(id).delete();
        window.showToast(`Deleted ${name}`);
        loadAccountsList();
        if (typeof loadMap === 'function') loadMap();
    } catch (error) {
        console.error(error);
    }
};

window.loadAccountsList = loadAccountsList;