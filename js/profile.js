// js/profile.js

function loadProfile() {
  console.log("CleanDash: Loading Profile...");
  
  if (!window.currentUser) {
      console.warn("CleanDash: No user logged in for profile.");
      return;
  }

  const uid = window.currentUser.uid;

  db.collection('users').doc(uid).get().then(doc => {
    const data = doc.exists ? doc.data() : {};

    // Populate View
    setText('viewName', data.name || 'Not set');
    setText('viewEmail', window.currentUser.email);
    setText('viewAddress', data.address || 'Not set');
    setText('viewCfi', (data.cfi || 0).toFixed(2));
    setText('viewCodb', (data.codb || 25) + '%');

    // Populate Edit Inputs
    setValue('editName', data.name || '');
    setValue('editEmail', window.currentUser.email);
    setValue('editAddress', data.address || '');
    setValue('editCfi', data.cfi || '');
    setValue('editCodb', data.codb || '');
    setValue('editAlertThreshold', data.alertThreshold || 15);

    // NEW: Populate SMS Email
    setValue('editSmsEmail', data.smsEmail || '');

  }).catch(error => {
      console.error("CleanDash: Error loading profile:", error);
  });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function initProfileListeners() {
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        const newBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newBtn, editBtn);

        newBtn.addEventListener('click', () => {
            document.getElementById('profileView').style.display = 'none';
            document.getElementById('profileEdit').style.display = 'block';
        });
    }
}

window.cancelEdit = function() {
  document.getElementById('profileView').style.display = 'grid';
  document.getElementById('profileEdit').style.display = 'none';
};

window.saveProfile = function() {
  if (!window.currentUser) return;

  const uid = window.currentUser.uid;

  const data = {
    name: document.getElementById('editName').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
    cfi: parseFloat(document.getElementById('editCfi').value) || 0,
    codb: parseFloat(document.getElementById('editCodb').value) || 25,
    alertThreshold: parseInt(document.getElementById('editAlertThreshold').value) || 15,
    // NEW: Save SMS Email
    smsEmail: document.getElementById('editSmsEmail').value.trim()
  };

  db.collection('users').doc(uid).set(data, { merge: true }).then(() => {
    document.getElementById('saveSuccess').style.display = 'block';

    loadProfile();

    if (typeof window.loadMap === 'function') window.loadMap();
    if (typeof window.populateCfi === 'function') window.populateCfi();
    if (typeof window.loadScheduler === 'function') window.loadScheduler();

    setTimeout(() => {
      document.getElementById('saveSuccess').style.display = 'none';
      cancelEdit();
    }, 2000);
  }).catch(error => {
      alert("Error saving profile: " + error.message);
  });
};

window.loadProfile = loadProfile;
window.initProfileListeners = initProfileListeners;