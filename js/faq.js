// js/faq.js

window.renderFAQ = function(targetContainer) {
    const container = targetContainer || document.getElementById('faqGrid');
    if (!container) return;

    // Clear previous content to prevent duplicates if re-rendering
    container.innerHTML = '';

    const html = `
        <div class="faq-wrapper" style="max-width: 900px; margin: 0 auto; width: 100%;">

            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #1f2937; margin-bottom: 5px; font-size: 1.5rem;">Help Center</h2>
                <p style="color: #6b7280; font-size: 0.9rem;">Guides & App Installation</p>
            </div>

            <!-- Tab Navigation -->
            <div id="faq-tab-buttons" style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;">
                <button onclick="window.switchFaqTab('general')" id="btn-tab-general" class="btn btn-primary" style="flex: 1; max-width: 140px; padding: 10px; font-size: 0.9rem;">General FAQ</button>
                <button onclick="window.switchFaqTab('install')" id="btn-tab-install" class="btn btn-secondary" style="flex: 1; max-width: 140px; padding: 10px; font-size: 0.9rem;">Install App</button>
            </div>

            <!-- Content Area -->
            <div id="faq-content-area"></div>
        </div>
    `;

    container.innerHTML = html;

    // Default to General Tab
    window.switchFaqTab('general');
};

window.switchFaqTab = function(tab) {
    // We search the entire document for these IDs because they are injected by renderFAQ
    // whether in the portal modal or the main dashboard.
    const contentArea = document.getElementById('faq-content-area');
    const btnGeneral = document.getElementById('btn-tab-general');
    const btnInstall = document.getElementById('btn-tab-install');

    if (!contentArea || !btnGeneral || !btnInstall) return;

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
            q: "How do I clock in?",
            a: "Go to the <b>Scheduler</b>. If you are near the location and it is time for your shift, click the green <b>📍 Clock In</b> button on the shift card."
        },
        {
            q: "How do I see my schedule?",
            a: "Your upcoming shifts are listed on the main screen. Use the Day/Week/Month buttons at the top to change your view."
        },
        {
            q: "My location isn't working?",
            a: "Make sure you have allowed Location Services for your browser. If you are on an iPhone, check Settings > Privacy > Location Services."
        },
        {
            q: "How do I reset my password?",
            a: "Please contact your manager to reset your password for you."
        }
    ];

    let html = `<div style="display: flex; flex-direction: column; gap: 10px;">`;

    faqs.forEach((item, index) => {
        html += `
            <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; background: white; overflow: hidden;">
                <button onclick="window.toggleFAQ(${index})" style="width: 100%; text-align: left; padding: 15px; background: white; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; font-weight: 600; color: #374151;">
                    <span>${item.q}</span>
                    <span id="faq-icon-${index}" style="font-size: 1.2rem; color: #9ca3af; font-weight:300;">+</span>
                </button>
                <div id="faq-ans-${index}" style="display: none; padding: 0 15px 15px 15px; color: #4b5563; line-height: 1.5; border-top: 1px solid #f3f4f6; font-size: 0.9rem;">
                    ${item.a}
                </div>
            </div>
        `;
    });

    html += `</div>`;
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
    <div id="install-root" style="padding-bottom: 20px; animation: fadeIn 0.3s;">
        <div style="text-align: center; margin-bottom: 20px; background: #f0fdfa; padding: 15px; border-radius: 8px; border: 1px dashed #0f3f76;">
            <h3 style="color: #0f3f76; font-size: 1.1rem; margin: 0 0 5px 0;">Save to Home Screen</h3>
            <p style="color: #0f3f76; font-size: 0.85rem; margin: 0;">Use this website like a real app.</p>
        </div>

        <!-- Platform Selector -->
        <div id="platform-selector" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 0 auto;">
            <button onclick="window.showPlatformGuide('ios')" style="padding: 15px 10px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); text-align:center;">
                <div style="font-size: 2rem; margin-bottom: 8px;"></div>
                <div style="font-weight: 700; font-size: 1rem; color: #1f2937;">iPhone</div>
            </button>
            <button onclick="window.showPlatformGuide('android')" style="padding: 15px 10px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); text-align:center;">
                <div style="font-size: 2rem; margin-bottom: 8px;"></div>
                <div style="font-weight: 700; font-size: 1rem; color: #1f2937;">Android</div>
            </button>
        </div>

        <!-- iOS Guide -->
        <div id="guide-ios" style="display: none; margin: 0 auto;">
            <button onclick="window.resetInstallSelection()" style="margin-bottom: 15px; background: none; border: none; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 0.9rem;">
                ← Back
            </button>

            <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
                <div style="background: #000; color: white; padding: 15px; text-align: center;">
                    <h3 style="margin:0; font-size: 1.1rem;">iPhone Instructions</h3>

                    <div id="guide-ios-tabs" style="display:flex; justify-content:center; gap:10px; margin-top:10px;">
                        <button onclick="window.switchBrowserGuide('ios', 'safari')" data-browser="safari" style="padding:4px 12px; border-radius:15px; border:none; background:#333; color:white; font-size:0.8rem; cursor:pointer; font-weight:700;">Safari</button>
                        <button onclick="window.switchBrowserGuide('ios', 'edge')" data-browser="edge" style="padding:4px 12px; border-radius:15px; border:none; background:transparent; color:white; font-size:0.8rem; cursor:pointer;">Edge</button>
                    </div>
                </div>
                <div id="guide-ios-content" style="padding: 20px;">
                    ${getIOSSafariHTML()}
                </div>
            </div>
        </div>

        <!-- Android Guide -->
        <div id="guide-android" style="display: none; margin: 0 auto;">
            <button onclick="window.resetInstallSelection()" style="margin-bottom: 15px; background: none; border: none; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 5px; font-size: 0.9rem;">
                ← Back
            </button>

            <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
                <div style="background: #3ddc84; color: #064e3b; padding: 15px; text-align: center;">
                    <h3 style="margin:0; font-size: 1.1rem;">Android Instructions</h3>

                    <div id="guide-android-tabs" style="display:flex; justify-content:center; gap:10px; margin-top:10px;">
                        <button onclick="window.switchBrowserGuide('android', 'chrome')" data-browser="chrome" style="padding:4px 12px; border-radius:15px; border:none; background:#166534; color:white; font-size:0.8rem; cursor:pointer; font-weight:700;">Chrome</button>
                        <button onclick="window.switchBrowserGuide('android', 'edge')" data-browser="edge" style="padding:4px 12px; border-radius:15px; border:none; background:transparent; color:#064e3b; font-size:0.8rem; cursor:pointer;">Edge</button>
                    </div>
                </div>
                <div id="guide-android-content" style="padding: 20px;">
                    ${getAndroidChromeHTML()}
                </div>
            </div>
        </div>
    </div>
    <style>@keyframes fadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }</style>
    `;
};

window.switchBrowserGuide = function(os, browser) {
    const container = document.getElementById(`guide-${os}-content`);
    const btnContainer = document.getElementById(`guide-${os}-tabs`);

    if (!container || !btnContainer) return;

    // Update Content
    if (os === 'ios') {
        if (browser === 'safari') container.innerHTML = getIOSSafariHTML();
        else if (browser === 'edge') container.innerHTML = getIOSEdgeHTML();
    } else if (os === 'android') {
        if (browser === 'chrome') container.innerHTML = getAndroidChromeHTML();
        else if (browser === 'edge') container.innerHTML = getAndroidEdgeHTML();
    }

    // Update Button Styles
    const buttons = btnContainer.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.dataset.browser === browser) {
            if (os === 'ios') {
                btn.style.background = '#333';
                btn.style.fontWeight = '700';
            } else {
                btn.style.background = '#166534'; // Darker green for active
                btn.style.color = 'white';
                btn.style.fontWeight = '700';
            }
        } else {
            btn.style.background = 'transparent';
            if (os === 'ios') {
                 btn.style.color = 'white';
            } else {
                 btn.style.color = '#064e3b';
            }
            btn.style.fontWeight = '400';
        }
    });
};

window.showPlatformGuide = function(platform) {
    const selector = document.getElementById('platform-selector');
    const guideIOS = document.getElementById('guide-ios');
    const guideAndroid = document.getElementById('guide-android');

    if(selector) selector.style.display = 'none';

    if(platform === 'ios' && guideIOS) {
        guideIOS.style.display = 'block';
    } else if (guideAndroid) {
        guideAndroid.style.display = 'block';
    }
};

window.resetInstallSelection = function() {
    const selector = document.getElementById('platform-selector');
    const guideIOS = document.getElementById('guide-ios');
    const guideAndroid = document.getElementById('guide-android');

    if(guideIOS) guideIOS.style.display = 'none';
    if(guideAndroid) guideAndroid.style.display = 'none';
    if(selector) selector.style.display = 'grid';
};

function getIOSSafariHTML() {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">1</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Tap "Share"</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Tap the square icon with an arrow at the bottom of the screen.</div>
            <div style="margin-top: 8px; display: inline-block;">
               <img src="icon/share.png" style="height: 24px; width: auto;" alt="Share" />
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">2</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Select "Add to Home Screen"</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Scroll down the list to find it.</div>
            <div style="margin-top: 8px; font-size: 0.8rem; font-weight: 600; background: #f9fafb; padding: 6px 10px; border-radius: 6px; color: #333; border: 1px solid #e5e7eb; display:inline-block;">
                ➕ Add to Home Screen
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">3</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Tap "Add"</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Click 'Add' in the top right corner.</div>
        </div>
    </div>
    `;
}

function getIOSEdgeHTML() {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">1</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Tap the Menu</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Tap the three dots (•••) at the bottom center.</div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">2</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Select "Share"</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Tap the Share icon in the menu.</div>
            <div style="margin-top: 8px; display: inline-block;">
               <img src="icon/share.png" style="height: 24px; width: auto;" alt="Share" />
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">3</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Add to Home Screen</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Scroll down to find "Add to Home Screen" and tap "Add".</div>
        </div>
    </div>
    `;
}

function getAndroidChromeHTML() {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">1</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Tap the Menu Icon</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Tap the three dots (⋮) in the top right corner.</div>
            <div style="margin-top: 8px; display: inline-block; background: #f9fafb; padding: 5px 10px; border-radius: 6px; border: 1px solid #eee;">
               <span style="font-size: 1.2rem; color: #5f6368; line-height: 1;">⋮</span>
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">2</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Tap "Install App"</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Or "Add to Home Screen".</div>
            <div style="margin-top: 8px; font-size: 0.8rem; font-weight: 600; background: #f9fafb; padding: 6px 10px; border-radius: 6px; color: #333; border: 1px solid #e5e7eb; display:inline-block;">
                ⬇ Install App
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">3</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Confirm</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Tap Add or Install to finish.</div>
        </div>
    </div>
    `;
}

function getAndroidEdgeHTML() {
    return `
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">1</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Tap the Menu</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Tap the three lines (≡) or dots at the bottom center.</div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">2</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Tap "Add to phone"</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Look for "Add to phone" or "Add to screen".</div>
            <div style="margin-top: 8px; font-size: 0.8rem; font-weight: 600; background: #f9fafb; padding: 6px 10px; border-radius: 6px; color: #333; border: 1px solid #e5e7eb; display:inline-block;">
                ➕ Add to phone
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 15px; align-items: flex-start;">
        <div style="background: #f3f4f6; color: #1f2937; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; font-size: 0.9rem;">3</div>
        <div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Confirm</div>
            <div style="color: #6b7280; font-size: 0.85rem;">Tap "Add" to finish.</div>
        </div>
    </div>
    `;
}
