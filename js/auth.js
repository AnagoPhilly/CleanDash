// js/auth.js

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDOOQuFmcvGjCHe8PFT5r2TLYQDaYalubA",
  authDomain: "hail-mary-10391.firebaseapp.com",
  projectId: "hail-mary-10391",
  storageBucket: "hail-mary-10391.firebasestorage.app",
  messagingSenderId: "911770919550",
  appId: "1:911770919550:web:7f1a839e39d488b2072e2f"
};

// Expose config globally so employees.js can use it for 'Secondary App' creation
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

// --- THE TRAFFIC COP (Role-Based Access Control) ---
auth.onAuthStateChanged(async realUser => {
    // 1. ROBUST PAGE DETECTION (Fixes the loop/stuck issue)
    // Checks for 'employee_portal', 'employee-portal', or just 'portal'
    const currentPath = window.location.pathname.toLowerCase();
    const isPortal = currentPath.includes('portal');
    const isDashboard = currentPath.includes('index') || currentPath === '/' || currentPath.endsWith('/');

    // UI Elements
    const loginPage = document.getElementById('loginPage');
    const app = document.getElementById(isPortal ? 'empApp' : 'app');
    const appLoading = document.getElementById('appLoading');
    const nameDisplay = document.getElementById('userNameDisplay');
    const emailDisplay = document.getElementById('userEmailDisplay');
    const btnGodMode = document.getElementById('navGodMode');
    const adminLabel = document.getElementById('adminModeStatusLabel');

    if (realUser) {
        console.log("Auth: Logged in as", realUser.email);

        try {
            // --- 1. FETCH REAL USER PROFILE ---
            const realUserDoc = await db.collection('users').doc(realUser.uid).get();
            const realUserData = realUserDoc.exists ? realUserDoc.data() : {};

            // Define Admins
            const HARDCODED_ADMINS = [
                'nate@anagophilly.com',
                'admin@cleandash.com'
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

            // Check 'users' collection (Owners/Admins)
            if (isImpersonating) {
                 // (Your existing impersonation fetch logic here...)
                 // For brevity, assuming success if impersonating
                 isOwner = true;
            } else {
                 isOwner = realUserDoc.exists;
                 targetUserData = realUserData;
            }

            // If not Owner, Check 'employees' collection
            let isEmployee = false;
            if (!isOwner) {
                let empSnap = await db.collection('employees').where('email', '==', targetEmail.toLowerCase()).limit(1).get();
                if (empSnap.empty) {
                    // Fallback for mixed case emails
                    empSnap = await db.collection('employees').where('email', '==', targetEmail).limit(1).get();
                }

                if (!empSnap.empty) {
                    isEmployee = true;
                    targetUserData = empSnap.docs[0].data();
                    // Update currentUser ID to the employee doc ID
                    window.currentUser.uid = empSnap.docs[0].id;
                }
            }

            // --- 4. THE ROUTING LOGIC (CRITICAL FIX) ---

            if (isOwner) {
                // Owner on Portal? -> KICK TO DASHBOARD
                if (isPortal) {
                    console.log("Redirecting Owner to Dashboard...");
                    window.location.href = 'index.html';
                    return;
                }
                // (Keep your God Mode / Admin Page logic here)
            }
            else if (isEmployee) {
                // Employee on Dashboard? -> KICK TO PORTAL
                if (!isPortal) {
                    console.log("Redirecting Employee to Portal...");
                    // *** VERIFY THIS FILENAME MATCHES YOUR ACTUAL FILE ***
                    window.location.href = 'employee_portal.html';
                    return;
                }
                // If we are here, we are an Employee ON the Portal. Access Granted.
            }
            else {
                // Phantom User
                alert("Account not found. Please contact support.");
                await auth.signOut();
                window.location.href = 'index.html';
                return;
            }

            // --- 5. RENDER UI ---
            // Update Sidebar Name
            if (nameDisplay) nameDisplay.textContent = targetUserData.name || "User";
            if (emailDisplay) emailDisplay.textContent = targetEmail;

            // Hide Login / Show App
            if (loginPage) loginPage.style.display = 'none';
            if (appLoading) appLoading.style.display = 'none';
            if (app) {
                app.style.display = 'flex';
                // Trigger page-specific loads
                setTimeout(() => {
                    const activePage = document.querySelector('.page.active');
                    const pageId = activePage ? activePage.id : (isPortal ? 'employee-scheduler' : 'dashboard'); // Default

                    if (isPortal && window.loadEmployeePortal) window.loadEmployeePortal();
                    else if (pageId === 'scheduler' && window.loadScheduler) window.loadScheduler();
                    else if (pageId === 'accounts' && window.loadAccountsList) window.loadAccountsList();
                    else if (pageId === 'employees' && window.loadEmployees) window.loadEmployees();
                }, 100);
            }

        } catch (error) {
            console.error("Auth Error:", error);
            // Don't alert on simple redirects
        }
    } else {
        // Not Logged In
        if (isPortal) {
            window.location.href = 'index.html'; // Protect Portal
        } else {
            if (loginPage) loginPage.style.display = 'flex';
            if (app) app.style.display = 'none';
            if (appLoading) appLoading.style.display = 'none';
        }
    }
});

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