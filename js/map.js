// js/map.js
let map = null;

// --- CONFIGURATION ---
const ICON_DIMS = {
    size: [35, 57],
    anchor: [17, 57],
    popup: [1, -54],
    shadow: [50, 50]
};

// --- ICONS ---
const HomeIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: ICON_DIMS.size, iconAnchor: ICON_DIMS.anchor, popupAnchor: ICON_DIMS.popup, shadowSize: ICON_DIMS.shadow
});

const StaffIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: ICON_DIMS.size, iconAnchor: ICON_DIMS.anchor, popupAnchor: ICON_DIMS.popup, shadowSize: ICON_DIMS.shadow
});

const AccountIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: ICON_DIMS.size, iconAnchor: ICON_DIMS.anchor, popupAnchor: ICON_DIMS.popup, shadowSize: ICON_DIMS.shadow
});

async function getGeocode(address) {
    if (!address) return null;
    try {
        const url = `https://us1.locationiq.com/v1/search.php?key=${window.LOCATIONIQ_KEY}&q=${encodeURIComponent(address)}&format=json&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (e) { console.error("Geocoding failed:", e); }
    return null;
}

async function loadMap() {
    console.log("CleanDash: Loading Dashboard & Map...");

    // 1. Initialize Map
    if (!map) {
        map = L.map('map').setView([39.8, -98.5], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        if (L.Control.Geocoder) L.Control.geocoder({ placeholder: "Search..." }).addTo(map);
    }

    // Fix gray area on tab switch
    setTimeout(() => { map.invalidateSize(); }, 200);

    // Clear existing markers
    map.eachLayer(l => l instanceof L.Marker && map.removeLayer(l));

    // Clear Account List
    const listDiv = document.getElementById('dashAccountList');
    if(listDiv) listDiv.innerHTML = '';

    if (!window.currentUser) return;

    let totalRevenue = 0;
    let accountCount = 0;
    let activeEmployeeCount = 0;
    const boundsMarkers = [];

    try {
        // --- A. LOAD HOME BASE ---
        const userDoc = await db.collection('users').doc(window.currentUser.uid).get();
        if (userDoc.exists) {
            const u = userDoc.data();
            if (u.address && u.address !== 'Not set') {
                let coords = (u.lat && u.lng) ? {lat: u.lat, lng: u.lng} : await getGeocode(u.address);
                if (coords) {
                    const home = L.marker([coords.lat, coords.lng], { icon: HomeIcon }).addTo(map).bindPopup("<b>Home Base</b>");
                    boundsMarkers.push(home);
                }
            }
        }

        // --- B. LOAD EMPLOYEES ---
        const empSnap = await db.collection('employees').where('owner', '==', window.currentUser.email).get();
        empSnap.forEach(doc => {
            const e = doc.data();
            if (e.status === 'Active') {
                activeEmployeeCount++;
                if (e.lat && e.lng) {
                    const m = L.marker([e.lat, e.lng], { icon: StaffIcon }).addTo(map).bindPopup(`<b>${e.name}</b><br>${e.role}`);
                    boundsMarkers.push(m);
                }
            }
        });

        // --- C. LOAD ACCOUNTS (MAP + SIDEBAR LIST) ---
        const accSnap = await db.collection('accounts').where('owner', '==', window.currentUser.email).get();
        const today = new Date();

        if (accSnap.empty && listDiv) {
            listDiv.innerHTML = '<div style="text-align:center; color:#9ca3af; padding:2rem;">No accounts found.</div>';
        }

        accSnap.forEach(doc => {
            const a = doc.data();
            const start = a.startDate ? new Date(a.startDate) : null;
            const end = a.endDate ? new Date(a.endDate) : null;
            let isActive = true;

            // Inactive if end date passed
            if(end && end < today) isActive = false;

            if(isActive) {
                accountCount++;
                totalRevenue += (a.revenue || 0);

                // Add to Map
                if (a.lat && a.lng) {
                    const m = L.marker([a.lat, a.lng], { icon: AccountIcon }).addTo(map)
                        .bindPopup(`<b>${a.name}</b><br>$${(a.revenue||0).toLocaleString()}/mo`);
                    boundsMarkers.push(m);
                }

                // Add to Sidebar List
                if (listDiv) {
                    const card = document.createElement('div');
                    card.className = 'dash-account-card';
                    card.innerHTML = `
                        <div class="dash-acc-name">${a.name}</div>
                        <div class="dash-acc-addr">${a.address}</div>
                        <div class="dash-acc-rev">$${(a.revenue||0).toLocaleString()}</div>
                    `;
                    listDiv.appendChild(card);
                }
            }
        });

        // --- D. UPDATE KPI CARDS ---
        // Since we reverted to the original KPI style, we need to generate that HTML here if it's missing,
        // OR simply update the numbers if you kept the specific IDs.
        // Based on the screenshot provided, the KPIs were hardcoded or dynamic.
        // Let's update them using the standard IDs we used previously.

        const kpiContainer = document.getElementById('dashboardKPIs');
        if (kpiContainer) {
            kpiContainer.innerHTML = `
                <div class="kpi-dashboard-item" style="border-left-color: #3b82f6;">
                    <p>Total Accounts</p>
                    <h3>${accountCount}</h3>
                </div>
                <div class="kpi-dashboard-item" style="border-left-color: #0d9488;">
                    <p>Total Monthly Revenue</p>
                    <h3>$${totalRevenue.toLocaleString()}</h3>
                </div>
                <div class="kpi-dashboard-item" style="border-left-color: #ef4444;">
                    <p>Active Team Members</p>
                    <h3>${activeEmployeeCount}</h3>
                </div>
            `;
        }

        // --- E. AUTO ZOOM MAP ---
        if (boundsMarkers.length > 0) {
            const group = new L.featureGroup(boundsMarkers);
            map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 14 });
        } else {
            map.setView([39.8, -98.5], 4);
        }

    } catch (e) {
        console.error("Dashboard Load Error:", e);
    }
}

window.loadMap = loadMap;