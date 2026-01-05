// js/profile.js

// --- 1. SMS UTILITY ---
function generateSmsEmail() {
    const phoneInput = document.getElementById('editPhoneNumber');
    const carrierInput = document.getElementById('editCarrier');
    const previewEl = document.getElementById('smsPreview');

    if (!phoneInput || !carrierInput) return null;

    // Standardize input
    const rawPhone = phoneInput.value || '';
    const carrier = carrierInput.value || '';

    // Clean number (remove all non-digit characters)
    const cleanNumber = rawPhone.replace(/[^0-9]/g, '');

    if (cleanNumber.length !== 10) {
        if(previewEl) previewEl.textContent = "⚠️ 10 digits required";
        return null;
    }

    if (!carrier) {
        if(previewEl) previewEl.textContent = "Select a carrier";
        return null;
    }

    const finalSmsEmail = `${cleanNumber}@${carrier}`;
    if(previewEl) previewEl.textContent = `SMS: ${finalSmsEmail}`;
    return finalSmsEmail;
}


// --- 2. LOAD PROFILE ---
window.loadProfile = async function() {
  console.log("CleanDash: Loading Profile...");

  if (!window.currentUser) return console.warn("No user logged in.");

  try {
      const uid = window.currentUser.uid;
      const doc = await db.collection('users').doc(uid).get();
      const data = doc.exists ? doc.data() : {};

      // A. Populate "View" mode (Dashboard Display)
      setText('viewName', data.name || 'Not set');
      setText('viewEmail', window.currentUser.email);
      setText('viewAddress', data.address || 'Not set');
      setText('viewCfi', (data.cfi || 0).toFixed(2));
      setText('viewCodb', (data.codb || 25) + '%');

      // B. Populate "Edit" mode inputs (Modal)
      // We check if element exists before setting value to prevent errors
      setValue('editName', data.name || '');
      setValue('editAddress', data.address || '');
      setValue('editCfi', data.cfi || '');
      setValue('editCodb', data.codb || 25);

      // C. Populate SMS Fields
      if (data.contactPhone) setValue('editPhoneNumber', data.contactPhone);
      if (data.carrier) setValue('editCarrier', data.carrier);

      // Update preview text
      generateSmsEmail();

  } catch (error) {
      console.error("Error loading profile:", error);
  }
};


// --- 3. SAVE PROFILE ---
window.saveProfile = function() {
  if (!window.currentUser) return alert("You must be logged in to save.");

  const btn = document.getElementById('btnSaveProfile');
  const originalText = btn ? btn.textContent : 'Save Changes';

  if(btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
  }

  const uid = window.currentUser.uid;

  // 1. Gather Data safely
  // We use "|| ''" to ensure we don't save nulls
  const nameVal = document.getElementById('editName')?.value.trim() || '';
  const addrVal = document.getElementById('editAddress')?.value.trim() || '';
  const phoneVal = document.getElementById('editPhoneNumber')?.value.trim() || '';
  const carrierVal = document.getElementById('editCarrier')?.value || '';

  const cfiVal = parseFloat(document.getElementById('editCfi')?.value) || 0;
  const codbVal = parseFloat(document.getElementById('editCodb')?.value) || 25;

  const smsEmail = generateSmsEmail(); // Recalculate based on current inputs

  const data = {
    name: nameVal,
    address: addrVal,
    contactPhone: phoneVal,
    carrier: carrierVal,
    smsEmail: smsEmail || '',
    cfi: cfiVal,
    codb: codbVal,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };

  // 2. Write to Database (Using SET with MERGE is safer than UPDATE)
  db.collection('users').doc(uid).set(data, { merge: true })
  .then(() => {
    window.showToast("Profile Saved!");

    // Refresh UI
    loadProfile();

    // Close Modal
    setTimeout(() => {
        document.getElementById('editProfileModal').style.display = 'none';
    }, 500);
  })
  .catch(error => {
      alert("Error saving: " + error.message);
      console.error(error);
  })
  .finally(() => {
      if(btn) {
          btn.disabled = false;
          btn.textContent = originalText;
      }
  });
};


// --- 4. HELPERS ---
window.openEditProfile = function() {
    loadProfile();
    document.getElementById('editProfileModal').style.display = 'flex';
};

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

// Auto-Attach Listeners
document.addEventListener('DOMContentLoaded', () => {
    const pInput = document.getElementById('editPhoneNumber');
    const cInput = document.getElementById('editCarrier');
    if(pInput) pInput.addEventListener('input', generateSmsEmail);
    if(cInput) cInput.addEventListener('change', generateSmsEmail);
});