// js/faq.js

window.renderFAQ = function() {
    const container = document.getElementById('faqGrid');
    if (!container) return;

    if (document.getElementById('faq-tab-buttons')) return;

    container.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto;">

            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #1f2937; margin-bottom: 10px;">Help Center</h2>
                <p style="color: #6b7280;">Guides, FAQs, and Installation instructions.</p>
            </div>

            <!-- Tab Navigation -->
            <div id="faq-tab-buttons" style="display: flex; justify-content: center; gap: 10px; margin-bottom: 30px;">
                <button onclick="window.switchFaqTab('general')" id="btn-tab-general" class="btn btn-primary" style="min-width: 120px;">General FAQ</button>
                <button onclick="window.switchFaqTab('install')" id="btn-tab-install" class="btn btn-secondary" style="min-width: 120px;">Install App</button>
            </div>

            <!-- Content Area -->
            <div id="faq-content-area"></div>
        </div>
    `;

    window.switchFaqTab('general');
};

window.switchFaqTab = function(tab) {
    const contentArea = document.getElementById('faq-content-area');
    const btnGeneral = document.getElementById('btn-tab-general');
    const btnInstall = document.getElementById('btn-tab-install');

    if (tab === 'general') {
        btnGeneral.className = 'btn btn-primary';
        btnInstall.className = 'btn btn-secondary';
        renderGeneralFAQ(contentArea);
    } else {
        btnGeneral.className = 'btn btn-secondary';
        btnInstall.className = 'btn btn-primary';
        renderInstallGuideContent(contentArea);
    }
};

function renderGeneralFAQ(container) {
    const faqs = [
        {
            q: "How do I add a new Employee?",
            a: "Go to the <b>Team Management</b> tab and click the <b>+ Add Member</b> button in the top right. Fill in their name, email, and role. They will be assigned a default password of 'password'."
        },
        {
            q: "How does the Scheduler work?",
            a: "The Scheduler has three views: Day, Week, and Month. <br>1. <b>Click 'Add Shift'</b> to create a new assignment.<br>2. <b>Drag</b> on empty slots in Day/Week view to quick-create.<br>3. <b>Click a shift</b> to edit details or delete it."
        },
        {
            q: "What is the Auto-Scheduler?",
            a: "In the <b>Accounts</b> tab, click 'Scheduler' next to an account. You can set up a recurring pattern (e.g., Mon/Wed/Fri at 6pm). The system will automatically generate shifts for the next 60 days based on these rules."
        },
        {
            q: "How do I use the Ad Generator?",
            a: "Go to the <b>Ad Generator</b> tab. Select a job role preset (e.g., General Cleaner), tweak the pay rate and location, and select the days. Click 'Generate Ad' to get a formatted text for Craigslist/Indeed, or 'Print Flyer' for a PDF."
        },
        {
            q: "How is Payroll calculated?",
            a: "Payroll is based on <b>Completed</b> shifts. Go to the Payroll tab, select a date range, and the system sums up the hours × wage for every completed job found in that range."
        },
        {
            q: "My Map isn't showing correct pins.",
            a: "Go to the <b>Accounts</b> tab, click 'Edit' on the specific account, and use the map inside the modal to drag the pin to the exact location. Click 'Save Location Details' to update coordinates."
        }
    ];

    let html = `<div style="display: flex; flex-direction: column; gap: 15px;">`;

    faqs.forEach((item, index) => {
        html += `
            <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; background: white; overflow: hidden;">
                <button onclick="window.toggleFAQ(${index})" style="width: 100%; text-align: left; padding: 18px; background: white; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1rem; font-weight: 600; color: #374151;">
                    <span>${item.q}</span>
                    <span id="faq-icon-${index}" style="font-size: 1.2rem; color: #9ca3af; font-weight:300;">+</span>
                </button>
                <div id="faq-ans-${index}" style="display: none; padding: 0 18px 18px 18px; color: #4b5563; line-height: 1.6; border-top: 1px solid #f3f4f6; font-size: 0.95rem;">
                    ${item.a}
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div style="margin-top: 40px; padding: 20px; background: #eff6ff; border-radius: 8px; text-align: center; color: #1e40af; border: 1px solid #dbeafe;">
                <strong>Need more help?</strong><br>
                Contact Home Office Support at <span style="text-decoration: underline;">support@cleandash.com</span>
            </div>
    `;

    container.innerHTML = html;
}

window.toggleFAQ = function(index) {
    const ans = document.getElementById(`faq-ans-${index}`);
    const icon = document.getElementById(`faq-icon-${index}`);

    if (!ans || !icon) return;

    const isHidden = ans.style.display === 'none';

    if (isHidden) {
        ans.style.display = 'block';
        icon.textContent = '−';
        icon.style.color = '#0d9488';
    } else {
        ans.style.display = 'none';
        icon.textContent = '+';
        icon.style.color = '#9ca3af';
    }
};

/* --- INSTALL GUIDE LOGIC --- */

window.renderInstallGuideContent = function(container) {
    container.innerHTML = `
    <div id="install-root" style="padding-bottom: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #1f2937; font-size: 1.2rem;">Save to Home Screen</h3>
            <p style="color: #6b7280; font-size: 0.95rem;">Select your device for instructions.</p>

            <button onclick="window.attemptInstall()" id="btn-main-install" class="btn btn-primary" style="margin-top: 15px; background-color: #0d9488; padding: 12px 24px; font-size: 1rem; border-radius: 25px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px rgba(13, 148, 136, 0.2); transition: transform 0.1s;">
                <span style="font-size: 1.2rem;">⬇</span> Install App
            </button>
        </div>

        <!-- Platform Selector -->
        <div id="platform-selector" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; max-width: 500px; margin: 0 auto;">
            <button onclick="window.showPlatformGuide('ios')" style="padding: 20px 10px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <div style="font-size: 2.5rem; margin-bottom: 10px;"></div>
                <div style="font-weight: 700; font-size: 1.1rem; color: #1f2937;">iPhone (iOS)</div>
            </button>
            <button onclick="window.showPlatformGuide('android')" style="padding: 20px 10px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <div style="font-size: 2.5rem; margin-bottom: 10px;"></div>
                <div style="font-weight: 700; font-size: 1.1rem; color: #1f2937;">Android</div>
            </button>
        </div>

        <!-- iOS Guide -->
        <div id="guide-ios" style="display: none; max-width: 500px; margin: 0 auto;">
            <button onclick="window.resetInstallSelection()" style="margin-bottom: 15px; background: none; border: none; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 0.9rem;">
                ← Back to selection
            </button>

            <div style="background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <div style="background: #000; color: white; padding: 20px; text-align: center;">
                    <h3 style="margin:0; font-size: 1.3rem;">iPhone Instructions</h3>
                    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                        <button id="btn-ios-safari" onclick="window.switchBrowser('ios', 'safari')" style="padding: 6px 14px; border-radius: 20px; border: 1px solid white; background: white; color: black; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Safari</button>
                        <button id="btn-ios-edge" onclick="window.switchBrowser('ios', 'edge')" style="padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.4); background: transparent; color: rgba(255,255,255,0.9); font-weight: 600; cursor: pointer; font-size: 0.85rem;">Edge</button>
                    </div>
                </div>

                <div style="padding: 25px 20px;">
                    <div id="content-ios-safari">${getIOSSafariHTML()}</div>
                    <div id="content-ios-edge" style="display:none;">
                        ${getIOSEdgeHTML()}
                    </div>
                </div>
            </div>
        </div>

        <!-- Android Guide -->
        <div id="guide-android" style="display: none; max-width: 500px; margin: 0 auto;">
            <button onclick="window.resetInstallSelection()" style="margin-bottom: 15px; background: none; border: none; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 0.9rem;">
                ← Back to selection
            </button>

            <div style="background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <div style="background: #3ddc84; color: #064e3b; padding: 20px; text-align: center;">
                    <h3 style="margin:0; font-size: 1.3rem;">Android Instructions</h3>
                        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                        <button id="btn-android-chrome" onclick="window.switchBrowser('android', 'chrome')" style="padding: 6px 14px; border-radius: 20px; border: 1px solid #064e3b; background: #064e3b; color: white; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Chrome</button>
                        <button id="btn-android-edge" onclick="window.switchBrowser('android', 'edge')" style="padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(6,78,59,0.3); background: transparent; color: #064e3b; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Edge</button>
                    </div>
                </div>
                <div style="padding: 25px 20px;">
                    <div id="content-android-chrome">${getAndroidChromeHTML()}</div>
                    <div id="content-android-edge" style="display:none;">
                        ${getAndroidEdgeHTML()}
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
};

window.attemptInstall = async function() {
    // 1. Try to trigger native prompt (Chrome/Android/Desktop)
    if (window.triggerAppInstall) {
        const handled = await window.triggerAppInstall();
        if (handled) return;
    }

    // 2. If no prompt available (iOS or already installed), help user manually
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS) {
        window.showPlatformGuide('ios');
        // Visual cue
        const btn = document.getElementById('btn-main-install');
        if(btn) {
            btn.innerHTML = 'See Instructions Below 👇';
            setTimeout(() => { btn.innerHTML = '<span style="font-size: 1.2rem;">⬇</span> Install App'; }, 3000);
        }
    } else {
        window.showPlatformGuide('android');
        const btn = document.getElementById('btn-main-install');
        if(btn) {
            btn.innerHTML = 'See Instructions Below 👇';
            setTimeout(() => { btn.innerHTML = '<span style="font-size: 1.2rem;">⬇</span> Install App'; }, 3000);
        }
    }
};

window.showPlatformGuide = function(platform) {
    document.getElementById('platform-selector').style.display = 'none';
    if(platform === 'ios') {
        document.getElementById('guide-ios').style.display = 'block';
    } else {
        document.getElementById('guide-android').style.display = 'block';
    }
};

window.resetInstallSelection = function() {
    document.getElementById('guide-ios').style.display = 'none';
    document.getElementById('guide-android').style.display = 'none';
    document.getElementById('platform-selector').style.display = 'grid';
};

window.switchBrowser = function(platform, browser) {
    if (platform === 'ios') {
        document.getElementById('content-ios-safari').style.display = (browser === 'safari') ? 'block' : 'none';
        document.getElementById('content-ios-edge').style.display = (browser === 'edge') ? 'block' : 'none';

        // Update Buttons
        const btnSaf = document.getElementById('btn-ios-safari');
        const btnEdge = document.getElementById('btn-ios-edge');

        if (browser === 'safari') {
            btnSaf.style.background = 'white'; btnSaf.style.color = 'black'; btnSaf.style.borderColor='white';
            btnEdge.style.background = 'transparent'; btnEdge.style.color = 'rgba(255,255,255,0.9)'; btnEdge.style.borderColor='rgba(255,255,255,0.4)';
        } else {
            btnEdge.style.background = 'white'; btnEdge.style.color = 'black'; btnEdge.style.borderColor='white';
            btnSaf.style.background = 'transparent'; btnSaf.style.color = 'rgba(255,255,255,0.9)'; btnSaf.style.borderColor='rgba(255,255,255,0.4)';
        }

    } else {
        document.getElementById('content-android-chrome').style.display = (browser === 'chrome') ? 'block' : 'none';
        document.getElementById('content-android-edge').style.display = (browser === 'edge') ? 'block' : 'none';

        // Update Buttons
        const btnChr = document.getElementById('btn-android-chrome');
        const btnEdge = document.getElementById('btn-android-edge');

        if (browser === 'chrome') {
            btnChr.style.background = '#064e3b'; btnChr.style.color = 'white';
            btnEdge.style.background = 'transparent'; btnEdge.style.color = '#064e3b';
        } else {
            btnEdge.style.background = '#064e3b'; btnEdge.style.color = 'white';
            btnChr.style.background = 'transparent'; btnChr.style.color = '#064e3b';
        }
    }
};

function getIOSSafariHTML(startStep = 1) {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">${startStep}</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap the "Share" Button</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Look at the bottom of your screen for the square icon with an arrow pointing up.</div>
            <div style="margin-top: 10px; display: flex; justify-content: center; background: #f9fafb; padding: 10px; border-radius: 8px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">${startStep + 1}</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Select "Add to Home Screen"</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Scroll down the list until you see this option.</div>
            <div style="margin-top: 10px; font-size: 0.85rem; font-weight: 600; text-align: center; background: #f9fafb; padding: 10px; border-radius: 8px; color: #333; border: 1px solid #e5e7eb;">
                ➕ Add to Home Screen
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">${startStep + 2}</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap "Add"</div>
            <div style="color: #6b7280; font-size: 0.9rem;">In the top right corner, click Add. The icon will appear on your home screen instantly.</div>
        </div>
    </div>
    `;
}

function getAndroidChromeHTML(startStep = 1) {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">${startStep}</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap the Menu Icon</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Tap the <strong>three dots</strong> (⋮) in the top right corner of the browser.</div>
            <div style="margin-top: 10px; font-size: 1.5rem; color: #5f6368; text-align: center; background: #f9fafb; padding: 8px; border-radius: 8px;">⋮</div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">${startStep + 1}</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap "Install App"</div>
            <div style="color: #6b7280; font-size: 0.9rem;">You might also see <strong>"Add to Home Screen"</strong>. You may need to <strong>swipe right</strong> to find it.</div>
            <div style="margin-top: 10px; font-size: 0.85rem; font-weight: 600; text-align: center; background: #f9fafb; padding: 10px; border-radius: 8px; color: #333; border: 1px solid #e5e7eb;">
                ⬇ Install App
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">${startStep + 2}</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Confirm Install</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Follow the prompt to add the icon to your app drawer or home screen.</div>
        </div>
    </div>
    `;
}

function getIOSEdgeHTML() {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">1</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap the Menu Button</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Tap the <strong>three dash lines</strong> (≡) at the bottom right.</div>
            <div style="margin-top: 10px; font-size: 1.5rem; text-align: center; background: #f9fafb; padding: 8px; border-radius: 8px;">≡</div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">2</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap "Share"</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Find the Share icon in the menu. <strong>If you do not see "Add to Home Screen", tap "More" to find it.</strong></div>
            <div style="margin-top: 10px; display: flex; justify-content: center; background: #f9fafb; padding: 10px; border-radius: 8px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">3</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap "Add to Home Screen"</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Select Add to Home Screen from the share sheet.</div>
        </div>
    </div>
    `;
}

function getAndroidEdgeHTML() {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">1</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap the Menu Button</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Tap the <strong>three horizontal lines</strong> (≡) at the bottom center.</div>
            <div style="margin-top: 10px; font-size: 1.5rem; text-align: center; background: #f9fafb; padding: 8px; border-radius: 8px;">≡</div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 25px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">2</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap "Add to phone"</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Look for the "Add to phone" or "Add to Home screen" option in the menu. If you do not see the option, <strong>scroll to the right</strong> for more options.</div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 1rem;">3</div>
        <div>
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">Tap "Install"</div>
            <div style="color: #6b7280; font-size: 0.9rem;">Confirm the installation to add the app to your home screen.</div>
        </div>
    </div>
    `;
}
