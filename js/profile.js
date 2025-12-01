// js/profile.js

// Utility function that cleans the number and builds the SMS email address
function generateSmsEmail() {
    const phoneInput = document.getElementById('editPhoneNumber')?.value;
    const carrierInput = document.getElementById('editCarrier')?.value;
    const previewEl = document.getElementById('smsPreview');

    if (!phoneInput || !carrierInput) {
        if(previewEl) previewEl.textContent = "Final SMS Address: Not Set";
        return null;
    }

    // 1. Clean number (remove all non-digit characters, ignoring hyphens initially due to input field)
    const cleanNumber = phoneInput.replace(/[^0-9]/g, '');

    if (cleanNumber.length !== 10) {
        if(previewEl) previewEl.textContent = "Final SMS Address: ⚠️ 10 digits required";
        return null;
    }

    const finalSmsEmail = `${cleanNumber}@${carrierInput}`;
    if(previewEl) previewEl.textContent = `Final SMS Address: ${finalSmsEmail}`;
    return finalSmsEmail;
}


function loadProfile() {
  console.log("CleanDash: Loading Profile...");

  if (!window.currentUser) {
      console.warn("CleanDash: No user logged in for profile.");
      return;
  }

  const uid = window.currentUser.uid;

  db.collection('users').doc(uid).get().then(doc => {
    const data = doc.exists ? doc.data() : {};

    // Populate the "View" mode
    setText('viewName', data.name || 'Not set');
    setText('viewEmail', window.currentUser.email);
    setText('viewAddress', data.address || 'Not set');
    setText('viewCfi', (data.cfi || 0).toFixed(2));
    setText('viewCodb', (data.codb || 25) + '%');

    // Populate the "Edit" mode inputs
    setValue('editName', data.name || '');
    setValue('editEmail', window.currentUser.email);
    setValue('editAddress', data.address || '');
    setValue('editCfi', data.cfi || '');
    setValue('editCodb', data.codb || '');
    setValue('editAlertThreshold', data.alertThreshold || 15);

    // NEW: Populate SMS Fields from saved smsEmail
    if (data.smsEmail) {
        // Split the saved email (e.g., 2155551234@vtext.com)
        const [number, carrier] = data.smsEmail.split('@');

        // Format number for display (215-555-1234)
        setValue('editPhoneNumber', number.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'));
        setValue('editCarrier', carrier);
    } else {
        setValue('editPhoneNumber', '');
        setValue('editCarrier', '');
    }

    // Ensure the preview runs once after load
    // The event listeners added in initProfileListeners will handle this dynamically
    setTimeout(generateSmsEmail, 100);

  }).catch(error => {
      console.error("CleanDash: Error loading profile:", error);
  });
}

// Helper to safely set text content
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Helper to safely set input value
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

    // NEW: Add event listeners for the SMS fields
    const phoneInput = document.getElementById('editPhoneNumber');
    const carrierInput = document.getElementById('editCarrier');

    // Note: oninput is added directly to HTML for real-time validation/formatting
    if(phoneInput && !phoneInput.hasAttribute('oninput')) {
        // Fallback or safety registration if HTML attribute is missed
        phoneInput.addEventListener('input', generateSmsEmail);
    }
    if(carrierInput) {
         carrierInput.addEventListener('change', generateSmsEmail);
    }
}

window.cancelEdit = function() {
  document.getElementById('profileView').style.display = 'grid';
  document.getElementById('profileEdit').style.display = 'none';
};

window.saveProfile = function() {
  if (!window.currentUser) return;

  const uid = window.currentUser.uid;

  // Generate the final SMS email address (with validation)
  const finalSmsEmail = generateSmsEmail();

  // If the user has data in the phone field but the generation failed (e.g., missing carrier or 10 digits)
  if (!finalSmsEmail && document.getElementById('editPhoneNumber').value.trim().length > 0) {
      return alert("ERROR: Please select your carrier and ensure your phone number has 10 digits.");
  }

  // Gather data from inputs
  const data = {
    name: document.getElementById('editName').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
    cfi: parseFloat(document.getElementById('editCfi').value) || 0,
    codb: parseFloat(document.getElementById('editCodb').value) || 25,
    alertThreshold: parseInt(document.getElementById('editAlertThreshold').value) || 15,

    // NEW: Save the generated SMS Email. Saves null/empty string if not fully set up.
    smsEmail: finalSmsEmail || ''
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

window.generateSmsEmail = generateSmsEmail;
window.loadProfile = loadProfile;
window.initProfileListeners = initProfileListeners;