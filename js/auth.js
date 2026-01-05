// js/auth.js

// js/auth.js (Updated God Mode Logic)

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDOOQuFmcvGjCHe8PFT5r2TLYQDaYalubA",
  authDomain: "hail-mary-10391.firebaseapp.com",
  projectId: "hail-mary-10391",
  storageBucket: "hail-mary-10391.firebasestorage.app",
  messagingSenderId: "911770919550",
  appId: "1:911770919550:web:7f1a839e39d488b2072e2f"
};

window.firebaseConfig = firebaseConfig;

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Expose globals
window.auth = auth;
window.db = db;
window.currentUser = null;

// --- THE TRAFFIC COP ---
auth.onAuthStateChanged(async realUser => {
    // 1. ROBUST PAGE DETECTION
    const currentPath = window.location.pathname.toLowerCase();
    const isPortal = currentPath.includes('portal');

    // UI Elements
    const loginPage = document.getElementById('loginPage');
    const app = document.getElementById(isPortal ? 'empApp' : 'app');
    const appLoading = document.getElementById('appLoading');
    const nameDisplay = document.getElementById('userNameDisplay');
    const emailDisplay = document.getElementById('userEmailDisplay');
    const btnGodMode = document.getElementById('navGodMode'); // Ensure this ID exists in HTML sidebar
    const adminLabel = document.getElementById('adminModeStatusLabel');

    if (realUser) {
        console.log("Auth: Logged in as", realUser.email);

        try {
            // --- 1. FETCH REAL USER PROFILE ---
            const realUserDoc = await db.collection('users').doc(realUser.uid).get();
            const realUserData = realUserDoc.exists ? realUserDoc.data() : {};

            // --- [UPDATED] ADMIN LIST ---
            // Added work2@gmail.com so you can test with that account too
            const HARDCODED_ADMINS = [
                'nate@anagophilly.com',
                'admin@cleandash.com',
                'work2@gmail.com'
            ];

            const isDbAdmin = realUserData.isAdmin === true;
            const isRealAdmin = HARDCODED_ADMINS.includes(realUser.email.toLowerCase()) || isDbAdmin;

            // --- 2. IMPERSONATION LOGIC ---
            const params = new URLSearchParams(window.location.search);
            const viewAsEmail = params.get('viewAs');
            const viewAsUid = params.get('targetId');

            let targetEmail = realUser.email;
            let targetUid = realUser.uid;
            let isImpersonating = false;

            if (viewAsEmail && isRealAdmin) {
                console.warn(`⚡ GOD MODE: Impersonating ${viewAsEmail}`);
                targetEmail = viewAsEmail;
                targetUid = viewAsUid || 'IMPERSONATED_UID';
                isImpersonating = true;

                // Visual Indicator
                const sidebarHeader = document.querySelector('.sidebar-header h1');
                if(sidebarHeader) sidebarHeader.innerHTML = `CleanDash <br><span style="font-size:12px; color:#ef4444;">VIEWING: ${viewAsEmail}</span>`;
                if (adminLabel) adminLabel.innerHTML = `STATUS: <span style="color:#ef4444;">IMPERSONATING</span>`;
            }

            // Set Global Context
            window.currentUser = { uid: targetUid, email: targetEmail, isRealAdmin: isRealAdmin };

            // --- 3. IDENTIFY USER TYPE ---
            let targetUserData = {};
            let isOwner = false;

            if (isImpersonating) {
                 isOwner = true; // Assume impersonation is usually for Owners
            } else {
                 isOwner = realUserDoc.exists;
                 targetUserData = realUserData;
            }

            // If not Owner, Check Employee
            let isEmployee = false;
            if (!isOwner) {
                let empSnap = await db.collection('employees').where('email', '==', targetEmail.toLowerCase()).limit(1).get();
                if (empSnap.empty) {
                    empSnap = await db.collection('employees').where('email', '==', targetEmail).limit(1).get();
                }

                if (!empSnap.empty) {
                    isEmployee = true;
                    targetUserData = empSnap.docs[0].data();
                    window.currentUser.uid = empSnap.docs[0].id;
                }
            }

            // --- 4. ROUTING & GOD MODE ---

            if (isOwner) {
                if (isPortal) {
                    window.location.href = 'index.html';
                    return;
                }

                // --- [CRITICAL FIX] GOD MODE BUTTON ---
                if (btnGodMode) {
                    if (isRealAdmin) {
                        // 1. Show Button
                        btnGodMode.style.display = 'flex';

                        // 2. Clone to strip existing listeners (fixes "Green Freeze" / Conflicts)
                        const newBtn = btnGodMode.cloneNode(true);
                        btnGodMode.parentNode.replaceChild(newBtn, btnGodMode);

                        // 3. Add robust Redirect Listener
                        newBtn.addEventListener('click', (e) => {
                            console.log("God Mode Button Clicked - Redirecting...");
                            e.preventDefault();
                            e.stopPropagation(); // STOP main.js from seeing this click!
                            window.location.href = 'admin.html';
                        });

                        // 4. AUTO-REDIRECT (Optional)
                        // If you want pure admins to go there automatically:
                        const isNate = (realUser.email.toLowerCase() === 'nate@anagophilly.com');
                        const onAdminPage = window.location.pathname.includes('admin.html');

                        // If Admin + Not Nate + Not Impersonating + Not already there -> GO
                        if (!isNate && !isImpersonating && !onAdminPage) {
                            console.log("Auto-redirecting Admin...");
                            window.location.href = 'admin.html';
                            return;
                        }

                    } else {
                        btnGodMode.style.display = 'none';
                    }
                }
            }
            else if (isEmployee) {
                if (!isPortal) {
                    window.location.href = 'employee_portal.html';
                    return;
                }
            }
            else {
                // Phantom User
                alert("Account not found. Please contact support.");
                await auth.signOut();
                window.location.href = 'index.html';
                return;
            }

            // --- 5. RENDER UI ---
            if (nameDisplay) nameDisplay.textContent = targetUserData.name || "User";
            if (emailDisplay) emailDisplay.textContent = targetEmail;

            if (loginPage) loginPage.style.display = 'none';
            if (appLoading) appLoading.style.display = 'none';
            if (app) {
                app.style.display = 'flex';
                // Trigger page loads
                setTimeout(() => {
                    const activePage = document.querySelector('.page.active');
                    const pageId = activePage ? activePage.id : (isPortal ? 'employee-scheduler' : 'dashboard');

                    if (isPortal && window.loadEmployeePortal) window.loadEmployeePortal();
                    else if (pageId === 'scheduler' && window.loadScheduler) window.loadScheduler();
                    else if (pageId === 'accounts' && window.loadAccountsList) window.loadAccountsList();
                    else if (pageId === 'employees' && window.loadEmployees) window.loadEmployees();
                }, 100);
            }

        } catch (error) {
            console.error("Auth Error:", error);
        }
    } else {
        // Not Logged In
        if (isPortal) window.location.href = 'index.html';
        else {
            if (loginPage) loginPage.style.display = 'flex';
            if (app) app.style.display = 'none';
            if (appLoading) appLoading.style.display = 'none';
        }
    }
});

// Login/Logout Helpers
window.login = () => {
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  if (!email || !password) return alert('Enter email & password');

  const btn = document.querySelector('button[onclick="login()"]');
  if(btn) btn.textContent = "Verifying...";

  auth.signInWithEmailAndPassword(email, password).catch(e => {
      alert("Login Failed: " + e.message);
      if(btn) btn.textContent = "Login";
  });
};

window.logout = () => {
  sessionStorage.clear();
  auth.signOut().then(() => {
      window.location.href = 'index.html';
  });
};

// --- LOGIN FUNCTION ---
window.login = () => {
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  if (!email || !password) return alert('Enter email & password');

  const btn = document.querySelector('button[onclick="login()"]');
  if(btn) btn.textContent = "Verifying...";

  auth.signInWithEmailAndPassword(email, password).catch(e => {
      alert("Login Failed: " + e.message);
      if(btn) btn.textContent = "Login";
  });
};

// --- LOGOUT FUNCTION ---
window.logout = () => {
  sessionStorage.clear();
  auth.signOut().then(() => {
      window.location.href = 'index.html';
  });
};

// Fallback to hide loader if auth hangs
setTimeout(() => {
    const appLoading = document.getElementById('appLoading');
    const loginPage = document.getElementById('loginPage');
    if (appLoading && appLoading.style.display !== 'none' && !window.currentUser) {
       // appLoading.style.display = 'none'; // Optional: Don't hide prematurely
       // if (loginPage) loginPage.style.display = 'flex';
    }
}, 4000);