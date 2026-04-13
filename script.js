// ================================================
// FIREBASE INITIALIZATION & AUTH
// ================================================
const firebaseConfig = {
    apiKey: "AIzaSyDP4RpF_OSi9zfMJbe-y-_PW-Cbdajnmgg",
    authDomain: "expense-tracker-3c2bc.firebaseapp.com",
    projectId: "expense-tracker-3c2bc",
    storageBucket: "expense-tracker-3c2bc.firebasestorage.app",
    messagingSenderId: "221040052416",
    appId: "1:221040052416:web:72ca6fac5e009902380525",
    measurementId: "G-X6Y7W4PQXD"
};

// Initialize Firebase (Compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

// Set persistence to LOCAL
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

(function initEmailJS() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init("NZzp8VaAhdhkS_mlV");
    }
})();

// =============================================
// LOGGING SYSTEM
// =============================================
let systemLog = [
    { timestamp: new Date().toISOString(), type: 'SYSTEM', action: 'Initialisation', details: 'Syst\u00e8me d\u00e9marr\u00e9 avec succès', user: 'Admin' }
];

function logActivity(type, action, details) {
    const logEntry = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: type,
        action: action,
        details: details,
        user: auth.currentUser ? auth.currentUser.email.split('@')[0] : 'Admin IT'
    };
    db.collection("systemLogs").add(logEntry).catch(e => console.error("Log error:", e));
}

// =============================================
// SPLASH SCREEN — Official Release 1.0.0
// =============================================
(function initSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;

    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.querySelector('.main-wrapper');
    if (sidebar) sidebar.style.opacity = '0';
    if (mainWrapper) mainWrapper.style.opacity = '0';

    const statusText = splash.querySelector('.splash-status-text');
    const pctEl = splash.querySelector('.splash-progress-pct');
    const messages = [
        'Initialisation de la plateforme...',
        'Chargement des modules principaux...',
        'Vérification des services internes...',
        'Préparation de l\'interface officielle...',
        'Plateforme pr\u00eaute !'
    ];

    let msgIndex = 0;
    const msgInterval = setInterval(() => {
        msgIndex++;
        if (msgIndex < messages.length && statusText) {
            statusText.textContent = messages[msgIndex];
        }
    }, 650);

    const barFill = splash.querySelector('.progress-bar-fill');
    if (pctEl || barFill) {
        let pct = 0;
        const pctInterval = setInterval(() => {
            pct += 1;
            if (pct > 100) pct = 100;
            if (pctEl) pctEl.textContent = pct + '%';
            if (barFill) barFill.style.width = pct + '%';
            if (pct >= 100) clearInterval(pctInterval);
        }, 33);
    }

    setTimeout(() => {
        clearInterval(msgInterval);
        if (statusText) statusText.textContent = 'Plateforme pr\u00eaute !';
        if (pctEl) pctEl.textContent = '100%';

        setTimeout(() => {
            splash.classList.add('fade-out');

            if (sidebar) {
                sidebar.style.transition = 'opacity 0.6s ease';
                sidebar.style.opacity = '1';
            }
            if (mainWrapper) {
                mainWrapper.style.transition = 'opacity 0.6s ease';
                mainWrapper.style.opacity = '1';
            }

            setTimeout(() => {
                splash.remove();
            }, 900);
        }, 400);
    }, 3400);
})();

// =============================================
// GLOBAL STATE & LISTENERS
// =============================================
let itAssets = [];
let itPrinters = [];
let itLogs = [];
let unsubAssets, unsubPrinters, unsubLogs;

// =============================================
// AUTH HELPERS
// =============================================
function checkAuth() {
    if (!auth.currentUser) {
        openLoginModal();
        showCopyNotification('\u26a0\ufe0f Veuillez vous connecter pour accéder à cette fonction');
        return false;
    }
    return true;
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMessage').innerText = message;
        modal.classList.add('show');

        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');

        const cleanup = () => {
            modal.classList.remove('show');
            yesBtn.onclick = null;
            noBtn.onclick = null;
        };

        yesBtn.onclick = () => { cleanup(); resolve(true); };
        noBtn.onclick = () => { cleanup(); resolve(false); };
    });
}

// =============================================
// DOM REFERENCES
// =============================================
const searchInput = document.getElementById('searchInput');
const assetList = document.getElementById('assetList');
const unitCardsGrid = document.getElementById('unitCardsGrid');
const copyToast = document.getElementById('copyToast');
const profileModal = document.getElementById('profileModal');
const closeModal = document.getElementById('closeModal');
const infoBtn = document.getElementById('infoBtn');
const pageTitle = document.getElementById('pageTitle');

const dashTotalAssets = document.getElementById('dashTotalAssets');
const dashLaptopsPC = document.getElementById('dashLaptopsPC');
const dashMaintenanceAssets = document.getElementById('dashMaintenanceAssets');
const dashStockAssets = document.getElementById('dashStockAssets');
const dashTotalPrinters = document.getElementById('dashTotalPrinters');

const sidebar = document.getElementById('sidebar');
const sidebarLinks = document.querySelectorAll('.sidebar-link[data-page]');
const addAssetModal = document.getElementById('addAssetModal');
const addAssetForm = document.getElementById('addAssetForm');

// =============================================
// NAVIGATION SYSTEM
// =============================================
const pageTitles = {
    dashboard: 'TABLEAU DE <span class="accent">BORD</span>',
    directory: 'INVENTAIRE <span class="accent">APPAREILS</span>',
    printers: 'PARC <span class="accent">IMPRIMANTES</span>',
    stats: 'STATISTIQUES <span class="accent">PARC IT</span>',
    tools: 'MAT\u00c9RIEL EN <span class="accent">STOCK</span>',
    database: 'ARCHIVES & <span class="accent">RAPPORTS</span>',
    contact: 'CONTACT <span class="accent">SUPPORT</span>'
};

function navigateTo(page) {
    if (page !== 'dashboard') {
        if (!checkAuth()) return;
    }

    document.querySelectorAll('.page-section').forEach(p => {
        p.classList.remove('active');
    });

    sidebarLinks.forEach(l => l.classList.remove('active'));

    const targetPage = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
    if (targetPage) {
        targetPage.classList.add('active');
    }

    const targetLink = document.querySelector(`.sidebar-link[data-page="${page}"]`);
    if (targetLink) targetLink.classList.add('active');

    if (pageTitles[page]) {
        pageTitle.innerHTML = pageTitles[page];
    }

    if (page === 'dashboard') {
        updateDashboardStats();
    } else if (page === 'directory') {
        if (!searchInput.value.trim()) {
            renderAssets(itAssets.filter(a => a.status !== 'En Stock'));
        } else {
            handleSearch(searchInput.value);
        }
    } else if (page === 'tools') {
        renderStockAssets();
    } else if (page === 'database') {
        renderActivityLog(itLogs);
    }

    if (page === 'printers') {
        renderPrinters();
    }

    sidebar.classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('show');

    const links = document.querySelectorAll('.sidebar-link, .mob-nav-item');
    links.forEach(l => {
        l.classList.remove('active');
        if (l.getAttribute('data-page') === page) l.classList.add('active');
    });
    const pageContent = document.querySelector('.page-content');
    if (pageContent) pageContent.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        navigateTo(page);
    });
});

const devModal = document.getElementById('devModal');
function openDevModal() { if (devModal) devModal.classList.add('show'); }
function closeDevModal() { if (devModal) devModal.classList.remove('show'); }

const navAbout = document.getElementById('navAbout');
if (navAbout) {
    navAbout.addEventListener('click', (e) => {
        e.preventDefault();
        openDevModal();
    });
}

const companyModal = document.getElementById('companyModal');
const navCompany = document.getElementById('navCompany');
if (navCompany) {
    navCompany.addEventListener('click', (e) => {
        e.preventDefault();
        if (companyModal) companyModal.classList.add('show');
    });
}

function closeCompanyModal() { if (companyModal) companyModal.classList.remove('show'); }

// =============================================
// ASSET MANAGEMENT
// =============================================
if (addAssetForm) {
    addAssetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const snValue = document.getElementById('assetSN').value;
        const newAssetData = {
            sn: snValue,
            dept: document.getElementById('assetDept').value,
            user: document.getElementById('assetUser').value,
            peripherals: document.getElementById('assetPeripherals').value,
            model: document.getElementById('assetModel').value,
            specs: document.getElementById('assetSpecs').value,
            assignedDate: document.getElementById('assetDate').value || '-',
            status: document.getElementById('assetStatus').value,
            notes: document.getElementById('assetNotes').value || '',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };

        const submitBtn = addAssetForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        db.collection("itAssets").doc(snValue).set(newAssetData, { merge: true })
            .then(() => {
                logActivity('INVENTAIRE', 'MODIF_AJOUT', `Op\u00e9ration sur l'appareil: ${snValue} (${newAssetData.model})`);
                showCopyNotification('\u2705 Enregistré sur le serveur avec succès');
                closeAddAssetModal();
                addAssetForm.reset();
            })
            .catch((error) => {
                console.error("Error saving asset:", error);
                showCopyNotification('\u274c Échec de l\'enregistrement sur le serveur');
            })
            .finally(() => {
                if (submitBtn) submitBtn.disabled = false;
            });
    });
}

function openAddAssetModal(isEdit = false) {
    if (!checkAuth()) return;
    const titleEl = addAssetModal.querySelector('h2');
    const submitBtn = addAssetModal.querySelector('button[type="submit"]');
    const snInput = document.getElementById('assetSN');

    if (isEdit) {
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Modifier <span class="accent">l\'Appareil</span>';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
        if (snInput) snInput.readOnly = true;
    } else {
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus"></i> Nouveau <span class="accent">Appareil</span>';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer l\'Appareil';
        if (snInput) snInput.readOnly = false;
        if (addAssetForm) addAssetForm.reset();
    }
    if (addAssetModal) addAssetModal.classList.add('show');
}

function closeAddAssetModal() { if (addAssetModal) addAssetModal.classList.remove('show'); }

// =============================================
// STOCK MANAGEMENT (Firebase)
// =============================================
function openAddStockModal() {
    if (!checkAuth()) return;
    const modal = document.getElementById('addStockModal');
    if (modal) {
        document.getElementById('addStockForm').reset();
        modal.classList.add('show');
    }
}

function closeAddStockModal() {
    const modal = document.getElementById('addStockModal');
    if (modal) modal.classList.remove('show');
}

const addStockForm = document.getElementById('addStockForm');
if (addStockForm) {
    addStockForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const snValue = document.getElementById('stockSN').value;
        const newStockItem = {
            sn: snValue,
            model: document.getElementById('stockModel').value,
            type: document.getElementById('stockType').value,
            specs: document.getElementById('stockSpecs').value,
            assignedDate: document.getElementById('stockDate').value || new Date().toISOString().split('T')[0],
            status: 'En Stock',
            user: 'En Stock',
            dept: 'Stock IT',
            notes: document.getElementById('stockNotes').value || '',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };

        const submitBtn = addStockForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        db.collection("itAssets").doc(snValue).set(newStockItem, { merge: true })
            .then(() => {
                logActivity('STOCK', 'AJOUT_STOCK', `Nouveau matériel au stock: ${snValue} (${newStockItem.model})`);
                showCopyNotification('\u2705 Matériel ajouté au stock avec succès');
                closeAddStockModal();
                addStockForm.reset();
            })
            .catch((err) => {
                console.error(err);
                showCopyNotification('\u274c Échec de l\'ajout au serveur');
            })
            .finally(() => {
                if (submitBtn) submitBtn.disabled = false;
            });
    });
}

const sidebarToggle = document.getElementById('sidebarToggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('show');
            });
        }
        overlay.classList.toggle('show');
    });
}

// =============================================
// DASHBOARD STATS
// =============================================
function updateDashboardStats() {
    const assetCount = itAssets.length;
    const inventoryOnly = itAssets.filter(e => e.status !== 'En Stock').length;
    const maintenance = itAssets.filter(e => e.status === 'En Maintenance').length;
    const stock = itAssets.filter(e => e.status === 'En Stock').length;
    const printers = itPrinters.length;

    const grandTotal = assetCount + printers;

    const computers = itAssets.filter(e => {
        const m = (e.model || '').toLowerCase();
        return m.includes('laptop') || m.includes('pc') || m.includes('fixe') || m.includes('probook') || m.includes('latitude') || m.includes('thinkpad') || m.includes('elitebook') || m.includes('dell') || m.includes('hp') || m.includes('lenovo');
    }).length;

    animateValue(dashTotalAssets, 0, grandTotal, 800);
    animateValue(document.getElementById('dashLaptopsPC'), 0, computers, 900);
    animateValue(dashMaintenanceAssets, 0, maintenance, 1000);
    animateValue(dashStockAssets, 0, stock, 1100);
    animateValue(document.getElementById('dashTotalPrinters'), 0, printers, 1200);

    const bTotal = document.getElementById('bannerTotalAssets');
    const bStock = document.getElementById('bannerStockAssets');
    const bPrint = document.getElementById('bannerTotalPrinters');

    if (bTotal) bTotal.innerText = computers;
    if (bStock) bStock.innerText = stock;
    if (bPrint) bPrint.innerText = printers;

    const mAsset = document.getElementById('modAssetCount');
    const mPrint = document.getElementById('modPrinterCount');
    const mStock = document.getElementById('modStockCount');
    const mLogs = document.getElementById('modLogCount');

    if (mAsset) mAsset.innerText = `${inventoryOnly} Appareils`;
    if (mPrint) mPrint.innerText = `${printers} Imprimantes`;
    if (mStock) mStock.innerText = `${stock} En Stock`;
    if (mLogs) mLogs.innerText = `${systemLog.length} Logs`;
}

function openGrandTotalModal() {
    if (!checkAuth()) return;
    const computers = itAssets.filter(e => {
        const m = (e.model || '').toLowerCase();
        return m.includes('laptop') || m.includes('pc') || m.includes('fixe') || m.includes('probook') || m.includes('latitude') || m.includes('thinkpad') || m.includes('elitebook') || m.includes('dell') || m.includes('hp') || m.includes('lenovo');
    });
    const printers = itPrinters;
    const stockCount = itAssets.filter(e => e.status === 'En Stock').length;
    const content = document.getElementById('grandTotalContent');
    if (!content) return;

    let html = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
            <div style="background: white; border-radius: 16px; padding: 18px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(16, 185, 129, 0.1); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 18px;"><i class="fas fa-laptop"></i></div>
                <div>
                    <div style="font-size: 0.65rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Ordinateurs</div>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">${computers.length}</div>
                </div>
            </div>
            <div style="background: white; border-radius: 16px; padding: 18px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 18px;"><i class="fas fa-print"></i></div>
                <div>
                    <div style="font-size: 0.65rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Imprimantes</div>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">${printers.length}</div>
                </div>
            </div>
            <div style="background: white; border-radius: 16px; padding: 18px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 18px;"><i class="fas fa-box-open"></i></div>
                <div>
                    <div style="font-size: 0.65rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Stock IT</div>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">${stockCount}</div>
                </div>
            </div>
        </div>
        <div style="margin-bottom: 24px;">
            <h4 style="font-size: 0.85rem; color: #1e3a8a; font-weight: 800; margin-bottom: 12px;">PARC INFORMATIQUE</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 10px; text-align: left;">MOD\u00c8LE</th>
                        <th style="padding: 10px; text-align: left;">UTILISATEUR</th>
                        <th style="padding: 10px; text-align: right;">STATUT</th>
                    </tr>
                </thead>
                <tbody>
                    ${computers.map(c => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px;">${c.model} <br/> <small style="color:#94a3b8;">${c.sn}</small></td>
                        <td style="padding:10px;">${c.user}</td>
                        <td style="padding:10px; text-align:right;">${c.status}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    content.innerHTML = html;
    document.getElementById('grandTotalModal').classList.add('show');
}

function closeGrandTotalModal() { document.getElementById('grandTotalModal').classList.remove('show'); }

function animateValue(el, start, end, duration) {
    if (!el) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        el.innerText = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// =============================================
// ASSET TABLE RENDERING
// =============================================
let currentPage = 1;
const itemsPerPage = 12;
let currentFilteredAssets = [];

function renderAssets(assets, page = 1) {
    currentFilteredAssets = assets;
    currentPage = page;
    if (!assetList) return;
    assetList.innerHTML = '';
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, assets.length);
    const paginatedAssets = assets.slice(startIndex, endIndex);

    if (paginatedAssets.length === 0) {
        assetList.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 40px; color: var(--text-muted);">Aucun appareil trouv\u00e9.</td></tr>`;
        renderPagination(0, page);
        return;
    }

    paginatedAssets.forEach((asset) => {
        const statusClass = getStatusClass(asset.status);
        const m = (asset.model || '').toLowerCase();
        let icon = 'fa-laptop';
        if (m.includes('fixe') || m.includes('desktop')) icon = 'fa-desktop';
        else if (m.includes('ecran')) icon = 'fa-tv';

        const row = `
            <tr class="table-row-professional" onclick="viewAssetDetails('${asset.sn}')">
                <td class="user-info-cell" style="padding: 14px 16px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-user-circle" style="color:var(--primary); font-size:20px;"></i>
                        <div>
                            <div style="font-weight:700; font-size:0.88rem;">${asset.user}</div>
                            <div style="font-size:0.73rem; color:var(--text-muted);">${asset.dept || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="specs-info-cell" style="padding: 14px 16px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:36px; height:36px; border-radius:9px; background:linear-gradient(135deg,#6366f1,#818cf8); display:flex; align-items:center; justify-content:center;">
                            <i class="fas ${icon}" style="color:#fff;"></i>
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:0.87rem;">${asset.model}</div>
                            <div style="font-size:0.74rem; color:var(--text-muted);">${asset.sn}</div>
                        </div>
                    </div>
                </td>
                <td class="status-badge-cell" style="padding: 14px 16px; text-align:right;">
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px;">
                        <span class="status-badge-premium ${statusClass}">${asset.status}</span>
                        <button class="btn-icon-action" onclick="event.stopPropagation(); deleteAsset('${asset.sn}')" style="color:#ef4444; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.1); width:32px; height:32px; border-radius:8px;"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
        assetList.innerHTML += row;
    });
    renderPagination(assets.length, page);
}
// =============================================
// ASSET DETAILS MODAL (FULL VIEW)
// =============================================
function viewAssetDetails(sn) {
    if (!checkAuth()) return;
    const asset = itAssets.find(a => a.sn === sn);
    if (!asset) return;

    const modal = document.getElementById('assetDetailsModal');
    const content = document.getElementById('detailContent');
    if (!modal || !content) return;

    const modelStr = (asset.model || '').toLowerCase();
    let typeIcon = 'fa-laptop';
    if (modelStr.includes('fixe') || modelStr.includes('desktop')) typeIcon = 'fa-desktop';
    else if (modelStr.includes('imprimante')) typeIcon = 'fa-print';
    else if (modelStr.includes('souris')) typeIcon = 'fa-mouse';
    else if (modelStr.includes('clavier')) typeIcon = 'fa-keyboard';
    else if (modelStr.includes('ecran')) typeIcon = 'fa-tv';

    const statusColors = {
        'En Service': { bg: 'rgba(16,185,129,0.12)', color: '#10b981', dot: '#10b981' },
        'En Maintenance': { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', dot: '#ef4444' },
        'En Stock': { bg: 'rgba(100,116,139,0.12)', color: '#64748b', dot: '#64748b' }
    };
    const sc = statusColors[asset.status] || statusColors['En Stock'];

    const periList = asset.peripherals
        ? asset.peripherals.split(',').map(p => `
            <span style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;background:rgba(99,102,241,0.1);color:#818cf8;font-size:0.78rem;font-weight:600;">
                <i class="fas fa-check" style="font-size:0.65rem;"></i>${p.trim()}
            </span>`).join('')
        : '<span style="color:#64748b;font-style:italic;font-size:0.82rem;">Aucun accessoire enregistré</span>';

    content.innerHTML = `
    <div style="display:flex;height:100%;min-height:480px;">
      <div style="width:260px;flex-shrink:0;background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 100%);border-radius:20px 0 0 20px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden;">
        <div style="width:76px;height:76px;border-radius:20px;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 8px 24px rgba(99,102,241,0.35);">
            <i class="fas ${typeIcon}" style="color:#fff;font-size:30px;"></i>
        </div>
        <div style="text-align:center;margin-bottom:6px;">
            <div style="font-size:0.68rem;letter-spacing:2px;color:#6366f1;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Inventaire IT</div>
            <div style="font-size:1.05rem;font-weight:800;color:#f1f5f9;line-height:1.3;">${asset.model}</div>
        </div>
        <div style="margin:10px 0 16px;padding:5px 14px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);">
            <span style="font-size:0.75rem;color:#94a3b8;font-family:monospace;letter-spacing:1px;">${asset.sn}</span>
        </div>
        <div style="width:100%;padding:9px 0;border-radius:12px;background:${sc.bg};display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:20px;">
            <span style="width:7px;height:7px;border-radius:50%;background:${sc.dot};box-shadow:0 0 6px ${sc.dot};"></span>
            <span style="font-size:0.82rem;font-weight:700;color:${sc.color};">${asset.status}</span>
        </div>
        ${asset.notes ? `
        <div style="width:100%; margin-bottom:20px; padding:12px; background:rgba(255,255,255,0.05); border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
            <div style="font-size:0.65rem; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:5px;">Observations</div>
            <div style="font-size:0.82rem; color:#f1f5f9; font-style:italic; line-height:1.4;">"${asset.notes}"</div>
        </div>` : ''}
        <div style="width:100%;height:1px;background:rgba(255,255,255,0.07);margin-bottom:18px;"></div>
        <div style="width:100%;display:flex;flex-direction:column;gap:9px;">
            <button onclick="openEditFromDetail('${asset.sn}')" style="width:100%;padding:11px 0;border-radius:12px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#818cf8;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;font-size:0.83rem;">
                <i class="fas fa-pen-to-square"></i> Modifier
            </button>
            ${asset.status === 'En Service' ? `
            <button onclick="returnToStockFromDetail('${asset.sn}')" style="width:100%;padding:11px 0;border-radius:12px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);color:#f59e0b;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;font-size:0.83rem;">
                <i class="fas fa-arrows-rotate"></i> Retour Stock
            </button>` : ''}
            <button onclick="printVoucher('${asset.sn}')" style="width:100%;padding:11px 0;border-radius:12px;border:none;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;font-size:0.83rem;box-shadow:0 4px 14px rgba(16,185,129,0.3);">
                <i class="fas fa-file-invoice"></i> Imprimer Décharge
            </button>
        </div>
      </div>
      <div style="flex:1;background:#fff;border-radius:0 20px 20px 0;padding:28px 28px 24px;display:flex;flex-direction:column;gap:18px;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid #f1f5f9;">
            <div>
                <div style="font-size:0.7rem;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Fiche Détail</div>
                <div style="font-size:1.15rem;font-weight:800;color:#0f172a;margin-top:2px;">${asset.model}</div>
            </div>
            <button onclick="viewAssetDetailsModalClose()" style="width:32px;height:32px;border-radius:8px;border:none;background:#f1f5f9;color:#64748b;cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="background:#f8fafc;border-radius:14px;padding:14px 16px;border:1px solid #e2e8f0;">
                <div style="font-size:0.68rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Détenteur</div>
                <div style="font-size:0.9rem;font-weight:800;color:#1e293b;margin-top:2px;">${asset.user}</div>
            </div>
            <div style="background:#f8fafc;border-radius:14px;padding:14px 16px;border:1px solid #e2e8f0;">
                <div style="font-size:0.68rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Département</div>
                <div style="font-size:0.9rem;font-weight:800;color:#1e293b;margin-top:2px;">${asset.dept || 'N/A'}</div>
            </div>
            <div style="background:#f8fafc;border-radius:14px;padding:14px 16px;border:1px solid #e2e8f0;">
                <div style="font-size:0.68rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Date Réception</div>
                <div style="font-size:0.9rem;font-weight:800;color:#1e293b;margin-top:2px;">${asset.assignedDate}</div>
            </div>
            <div style="background:#f8fafc;border-radius:14px;padding:14px 16px;border:1px solid #e2e8f0;">
                <div style="font-size:0.68rem;color:#94a3b8;font-weight:600;text-transform:uppercase;">Fiche Technique</div>
                <div style="font-size:0.85rem;font-weight:700;color:#1e293b;margin-top:2px;">${asset.specs}</div>
            </div>
        </div>
        <div style="background:#f8fafc;border-radius:14px;padding:14px 18px;border:1px solid #e2e8f0;">
            <div style="font-size:0.7rem;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:10px;">Accessoires</div>
            <div style="display:flex;flex-wrap:wrap;gap:7px;">${periList}</div>
        </div>
      </div>
    </div>
    `;

    modal.classList.add('show');
}

function viewAssetDetailsModalClose() {
    const modal = document.getElementById('assetDetailsModal');
    if (modal) modal.classList.remove('show');
}

function openEditFromDetail(sn) {
    viewAssetDetailsModalClose();
    setTimeout(() => editAsset(sn), 200);
}

function returnToStockFromDetail(sn) {
    openConfirmReturnModal(sn);
    viewAssetDetailsModalClose();
}

function returnToStock(sn) {
    showConfirm('Retour au Stock', `Retourner l'appareil ${sn} au stock ?`).then(confirmed => {
        if (confirmed) {
            db.collection("itAssets").doc(sn).update({
                status: 'En Stock',
                user: 'En Stock',
                dept: 'Stock IT',
                assignedDate: '-'
            }).then(() => {
                logActivity('STOCK', 'RETOUR_STOCK', `Appareil ${sn} retourn\u00e9 au stock`);
                showCopyNotification('\u2705 Appareil retourné au stock avec succès');
            });
        }
    });
}

function deleteAsset(sn) {
    if (!checkAuth()) return;
    showConfirm('Suppression Appareil', `Confirmer la suppression d\u00e9finitive de l'appareil S/N: ${sn} ?`).then(confirmed => {
        if (confirmed) {
            db.collection("itAssets").doc(sn).delete().then(() => {
                logActivity('INVENTAIRE', 'SUPPRESSION', `Appareil supprimé: ${sn}`);
                showCopyNotification('\ud83d\uddd1\ufe0f Appareil supprimé du serveur');
            });
        }
    });
}

// =============================================
// STOCK 
// =============================================
function renderStockAssets() {
    renderStockAssetsFiltered(itAssets.filter(asset => asset.status === 'En Stock'));
}

function renderStockAssetsFiltered(stockItems) {
    const container = document.getElementById('stockAssetList');
    const badge = document.getElementById('stockCountBadge');
    if (!container) return;

    container.innerHTML = '';
    if (badge) badge.innerText = `${stockItems.length} Équipements`;

    if (stockItems.length === 0) {
        container.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: #94a3b8;">Aucun matériel trouvé.</td></tr>`;
        return;
    }

    stockItems.forEach((asset) => {
        const m = (asset.model || '').toLowerCase();
        let icon = 'fa-box';
        if (m.includes('laptop')) icon = 'fa-laptop';
        else if (m.includes('fixe')) icon = 'fa-desktop';
        else if (m.includes('ecran')) icon = 'fa-tv';

        const tr = document.createElement('tr');
        tr.className = 'table-row-professional';
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:32px; height:32px; border-radius:8px; background:rgba(139, 92, 246, 0.1); color: #8b5cf6; display:flex; align-items:center; justify-content:center;"><i class="fas ${icon}"></i></div>
                    <div>
                        <div style="font-weight: 700; color: var(--text-main);">${asset.model}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${asset.sn}</div>
                    </div>
                </div>
            </td>
            <td style="font-size: 0.85rem;">${asset.specs || 'N/A'}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${asset.assignedDate === '-' ? 'Prêt' : asset.assignedDate}</td>
            <td style="text-align:right;">
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button class="btn-outline btn-delete-stock" onclick="event.stopPropagation(); deleteStockAsset('${asset.sn}')" style="padding: 6px; width: 32px; height: 32px; color: #ef4444;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tr.onclick = () => viewAssetDetails(asset.sn);
        container.appendChild(tr);
    });
}

function deleteStockAsset(sn) {
    showConfirm('Suppression Stock', `Voulez-vous supprimer ${sn} du stock ?`).then(confirmed => {
        if (confirmed) {
            db.collection("itAssets").doc(sn).delete().then(() => {
                logActivity('STOCK', 'SUPPRESSION', `Équipement supprimé du stock: ${sn}`);
                showCopyNotification('\ud83d\uddd1\ufe0f Supprimé avec succès');
            });
        }
    });
}


function editAsset(sn) {
    const asset = itAssets.find(a => a.sn === sn);
    if (asset) {
        openAddAssetModal(true);
        document.getElementById('assetSN').value = asset.sn;
        document.getElementById('assetDept').value = asset.dept || '';
        document.getElementById('assetUser').value = asset.user;
        document.getElementById('assetPeripherals').value = asset.peripherals || '';
        document.getElementById('assetModel').value = asset.model;
        document.getElementById('assetSpecs').value = asset.specs;
        document.getElementById('assetStatus').value = asset.status;
        document.getElementById('assetDate').value = asset.assignedDate === '-' ? '' : asset.assignedDate;
        document.getElementById('assetNotes').value = asset.notes || '';
    }
}

function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('service')) return 'status-service';
    if (s.includes('maintenance')) return 'status-maintenance';
    if (s.includes('stock')) return 'status-stock';
    return 'status-default';
}

function renderPagination(totalItems, currentPage) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let html = '';
    if (totalPages > 1) {
        const prevDis = currentPage === 1 ? 'disabled' : '';
        const nextDis = currentPage === totalPages ? 'disabled' : '';
        html += `<button class="page-btn" ${prevDis} onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
        html += `<span class="page-info">${currentPage} / ${totalPages}</span>`;
        html += `<button class="page-btn" ${nextDis} onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
    }
    container.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(currentFilteredAssets.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        renderAssets(currentFilteredAssets, page);
    }
}

function updateDirectoryStats(assets) {
    const list = assets || itAssets.filter(a => a.status !== 'En Stock');
    const total = list.length;
    const active = list.filter(e => e.status === 'En Service').length;
    const progressEl = document.getElementById('progressBar');
    const rateEl = document.getElementById('activationRate');
    if (progressEl && rateEl) {
        const pct = total > 0 ? Math.round((active / total) * 100) : 0;
        progressEl.style.width = `${pct}%`;
        rateEl.innerText = `${pct}%`;
    }
}

// =============================================
// SEARCH/FILTER
// =============================================
if (searchInput) {
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
}

function handleSearch(term) {
    const t = term.toLowerCase().trim();
    const activePage = document.querySelector('.page-section.active');

    // Redirect dashboard search to directory
    if (activePage && activePage.id === 'pageDashboard' && t.length > 0) {
        navigateTo('directory');
    }

    // Always calculate filtered data
    const filteredAssets = itAssets.filter(a =>
        a.sn.toLowerCase().includes(t) ||
        a.user.toLowerCase().includes(t) ||
        a.model.toLowerCase().includes(t) ||
        (a.dept && a.dept.toLowerCase().includes(t)) ||
        (a.specs && a.specs.toLowerCase().includes(t))
    );

    const filteredPrinters = itPrinters.filter(p =>
        p.model.toLowerCase().includes(t) ||
        p.ip.toLowerCase().includes(t) ||
        p.location.toLowerCase().includes(t) ||
        p.dept.toLowerCase().includes(t)
    );

    // Update active view
    const newActivePage = document.querySelector('.page-section.active');
    if (!newActivePage) return;

    if (newActivePage.id === 'pageDirectory') {
        renderAssets(filteredAssets.filter(a => a.status !== 'En Stock'));
    } else if (newActivePage.id === 'pageTools') {
        renderStockAssetsFiltered(filteredAssets.filter(a => a.status === 'En Stock'));
    } else if (newActivePage.id === 'pagePrinters') {
        renderPrintersFiltered(filteredPrinters);
    } else if (newActivePage.id === 'pageDatabase') {
        const filteredLogs = itLogs.filter(l =>
            l.action.toLowerCase().includes(t) ||
            l.details.toLowerCase().includes(t) ||
            (l.user && l.user.toLowerCase().includes(t))
        );
        renderActivityLog(filteredLogs);
    }
}

function filterAssets(type) {
    const items = document.querySelectorAll('.filter-item');
    items.forEach(i => i.classList.remove('active'));

    const clickedBtn = Array.from(items).find(i => i.getAttribute('onclick').includes(`'${type}'`));
    if (clickedBtn) clickedBtn.classList.add('active');

    let filtered;
    const inventoryOnly = itAssets.filter(a => a.status !== 'En Stock');

    if (type === 'all') {
        filtered = inventoryOnly;
    } else if (type === 'service') {
        filtered = inventoryOnly.filter(a => a.status === 'En Service');
    } else if (type === 'maintenance') {
        filtered = inventoryOnly.filter(a => a.status === 'En Maintenance');
    }

    renderAssets(filtered);
}

// =============================================
// PRINTERS (Firestore Ready)
// =============================================
let currentPrinterIndex = -1;

function renderPrinters() {
    renderPrintersFiltered(itPrinters);
}

function renderPrintersFiltered(printers) {
    const list = document.getElementById('printerList');
    if (!list) return;
    list.innerHTML = '';
    printers.forEach((p) => {
        // Find actual index in global array for details view
        const globalIdx = itPrinters.findIndex(gp => gp.ip === p.ip);
        const statusClass = p.status === 'En Ligne' ? 'status-service' : (p.status === 'Maintenance' ? 'status-maintenance' : 'status-retired');
        const row = `
            <tr style="cursor:pointer;" onclick="viewPrinterDetails(${globalIdx})">
                <td style="font-weight:700;">${p.model}</td>
                <td>${p.location}</td>
                <td><code>${p.ip}</code></td>
                <td><span class="status-badge ${statusClass}">${p.status}</span></td>
                <td>${p.dept}</td>
                <td style="text-align:right;">
                    <button class="btn-icon-action" onclick="event.stopPropagation(); deletePrinter('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        list.innerHTML += row;
    });
}

function openAddPrinterModal() {
    if (!checkAuth()) return;
    currentPrinterIndex = -1;
    const modal = document.getElementById('addPrinterModal');
    if (modal) {
        modal.querySelector('h2').innerText = 'Ajouter une Imprimante';
        document.getElementById('addPrinterForm').reset();
        modal.classList.add('show');
    }
}

function closeAddPrinterModal() {
    const modal = document.getElementById('addPrinterModal');
    if (modal) modal.classList.remove('show');
}

function viewPrinterDetails(index) {
    currentPrinterIndex = index;
    const p = itPrinters[index];
    if (!p) return;

    document.getElementById('detPrinterModel').innerText = p.model;
    document.getElementById('detPrinterIP').innerText = p.ip;
    document.getElementById('detPrinterLocation').innerText = p.location;
    document.getElementById('detPrinterDept').innerText = p.dept;

    const sEl = document.getElementById('detPrinterStatus');
    const sDot = document.getElementById('detPrinterStatusDot');
    const sBorder = document.getElementById('detPrinterStatusBorder');
    if (sEl) sEl.innerText = p.status;

    if (p.status === 'En Ligne') {
        if (sEl) sEl.style.color = '#10b981';
        if (sDot) sDot.style.background = '#10b981';
        if (sBorder) sBorder.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    } else {
        if (sEl) sEl.style.color = '#ef4444';
        if (sDot) sDot.style.background = '#ef4444';
        if (sBorder) sBorder.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    }

    const modal = document.getElementById('printerDetailsModal');
    if (modal) modal.classList.add('show');
}

function closePrinterDetailsModal() {
    const modal = document.getElementById('printerDetailsModal');
    if (modal) modal.classList.remove('show');
}

function editPrinterFromDetails() {
    if (currentPrinterIndex === -1) return;
    const p = itPrinters[currentPrinterIndex];
    document.getElementById('pModel').value = p.model;
    document.getElementById('pLocation').value = p.location;
    document.getElementById('pIP').value = p.ip;
    document.getElementById('pDept').value = p.dept;
    const modal = document.getElementById('addPrinterModal');
    if (modal) {
        modal.querySelector('h2').innerText = 'Modifier l\'Imprimante';
        closePrinterDetailsModal();
        modal.classList.add('show');
    }
}

const addPrinterForm = document.getElementById('addPrinterForm');
if (addPrinterForm) {
    addPrinterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const ip = document.getElementById('pIP').value;
        const newP = {
            model: document.getElementById('pModel').value,
            location: document.getElementById('pLocation').value,
            ip: ip,
            dept: document.getElementById('pDept').value,
            status: document.getElementById('pStatus').value,
            user: document.getElementById('pUser').value,
            pass: document.getElementById('pPass').value,
            notes: document.getElementById('pNotes').value || '',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };
        const docId = ip.replace(/\./g, '_');
        db.collection("itPrinters").doc(docId).set(newP, { merge: true }).then(() => {
            logActivity('RÉSEAU', 'MODIF_AJOUT', `Opération sur l'imprimante: ${ip} (${newP.model})`);
            showCopyNotification('\u2705 Enregistré avec succès');
            closeAddPrinterModal();
        });
    });
}

function deletePrinter(id) {
    if (!checkAuth()) return;
    showConfirm('Suppression Imprimante', 'Supprimer cette imprimante d\u00e9finitivement ?').then(confirmed => {
        if (confirmed) {
            db.collection("itPrinters").doc(id).delete().then(() => {
                logActivity('RÉSEAU', 'SUPPRESSION', `Imprimante supprimée: ${id}`);
                showCopyNotification('\u2705 Supprimé avec succès');
            });
        }
    });
}

function printVoucher(sn) {
    if (!checkAuth()) return;
    const asset = itAssets.find(a => a.sn === sn);
    if (!asset) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageW = 210;
    const pageH = 297;
    const mg = 14;
    const cw = pageW - mg * 2;
    const logo = (typeof LOGO_B64 !== 'undefined') ? LOGO_B64 : null;

    // --- Background & Frame ---
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(5, 5, pageW - 10, pageH - 10); // Subtle outer frame

    // Header Block (Premium Midnight)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 48, 'F');

    // Diagonal Accents (Tech Look)
    doc.setFillColor(79, 70, 229); // Primary Indigo
    doc.triangle(140, 0, pageW, 0, pageW, 48, 'F');
    doc.setFillColor(30, 41, 59); // Dark Slate Overlap
    doc.triangle(150, 0, pageW, 0, pageW, 42, 'F');

    // Top Border Accent
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageW, 1.2, 'F');

    // Logo Container
    if (logo) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(12, 10, 48, 28, 2, 2, 'F');
        doc.addImage(logo, 'PNG', 14, 12, 44, 24);
    }

    // Header Text
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENT OFFICIEL  \u2022  SERVICE INFORMATIQUE', 68, 18);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('D\u00c9CHARGE', 68, 30);

    doc.setTextColor(99, 102, 241);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('MAT\u00c9RIEL INFORMATIQUE - BON D\'AFFECTATION', 68, 39);

    // Sub-header Bar (Date & Info)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 48, pageW, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 60, pageW, 60);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.text('DATE D\'\u00c9MISSION : ' + new Date().toLocaleDateString('fr-FR'), mg + 2, 55.5);

    // Status Indicator
    let sColor = [148, 163, 184];
    if (asset.status === 'En Service') sColor = [16, 185, 129];
    else if (asset.status === 'En Maintenance') sColor = [245, 158, 11];

    // Status Indicator & Reference
    doc.setFillColor(sColor[0], sColor[1], sColor[2]);
    doc.circle(85, 54.2, 1.4, 'F');
    doc.setTextColor(15, 23, 42);
    doc.text('STATUT : ' + (asset.status || 'N/A').toUpperCase(), 89, 55.5);

    doc.setFontSize(8);
    doc.text('R\u00c9F : VCH-' + sn, pageW - mg - 2, 55.5, { align: 'right' });

    // --- Subtle Watermark ---
    if (logo) {
        doc.setGState(new doc.GState({ opacity: 0.03 }));
        doc.addImage(logo, 'PNG', pageW / 2 - 40, 110, 80, 50);
        doc.setGState(new doc.GState({ opacity: 1 }));
    }

    const colW = cw / 2 - 4;
    const colL = mg;
    const colR = pageW / 2 + 4;
    const cardH = 62;
    const cardY = 72;

    function drawCard(x, y, w, h, title, accent, rows, icon) {
        // Shadow Effect
        doc.setFillColor(235, 240, 245);
        doc.roundedRect(x + 1.5, y + 1.5, w, h, 2, 2, 'F');
        // Main Card
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, w, h, 2, 2, 'F');
        // Accent Bar
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(x, y, 4, h, 'F');

        doc.setTextColor(accent[0], accent[1], accent[2]); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(title, x + 10, y + 11);

        doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.4);
        doc.line(x + 8, y + 15, x + w - 6, y + 15);

        rows.forEach(function (row, i) {
            var baseY = y + 23 + i * 13;
            doc.setFontSize(7.2); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
            doc.text(row.label.toUpperCase(), x + 10, baseY);
            doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
            doc.text(String(row.value || 'N/A'), x + 10, baseY + 6);
        });
    }

    drawCard(colL, cardY, colW, cardH, '\u00c9QUIPEMENT IT', [79, 70, 229], [
        { label: 'D\u00e9signation / Mod\u00e8le', value: asset.model },
        { label: 'Num\u00e9ro de S\u00e9rie (S/N)', value: asset.sn },
        { label: 'Fiche Technique', value: asset.specs }
    ]);
    drawCard(colR, cardY, colW, cardH, 'AFFECTATION ACTUELLE', [5, 150, 105], [
        { label: 'Utilisateur / D\u00e9tenteur', value: asset.user },
        { label: 'D\u00e9partement / Unit\u00e9', value: asset.dept },
        { label: 'Date d\'Affectation', value: asset.assignedDate }
    ]);

    // Accessories Section
    const accY = cardY + cardH + 10;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4);
    doc.roundedRect(mg, accY, cw, 18, 1.5, 1.5, 'FD');
    doc.setFillColor(248, 250, 252);
    doc.rect(mg, accY, 30, 18, 'F');
    doc.setTextColor(71, 85, 105); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
    doc.text('ACCESSOIRES', mg + 5, accY + 10.5);
    doc.setTextColor(15, 23, 42); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(asset.peripherals || 'Aucun accessoire d\u00e9clar\u00e9', mg + 36, accY + 10.5);

    // Terms of Use
    const termY = accY + 28;
    const termBoxH = 38;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(mg, termY, cw, termBoxH, 2, 2, 'F');
    doc.setDrawColor(99, 102, 241); doc.setLineWidth(1);
    doc.line(mg, termY, mg, termY + termBoxH);

    doc.setTextColor(15, 23, 42); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    const terms = [
        "1. L'employ\u00e9 reconna\u00eet avoir re\u00e7u le mat\u00e9riel d\u00e9crit ci-dessus en bon \u00e9tat de fonctionnement.",
        "2. L'employ\u00e9 s'engage \u00e0 utiliser le mat\u00e9riel exclusivement \u00e0 des fins professionnelles.",
        "3. En cas de perte, de vol ou de dommage r\u00e9sultant d'une n\u00e9gligence, l'employ\u00e9 peut \u00eatre tenu responsable.",
        "4. Le mat\u00e9riel doit \u00eatre restitu\u00e9 au service IT lors de la fin de contrat ou sur demande."
    ];
    terms.forEach((t, i) => doc.text(t, mg + 8, termY + 10 + i * 7));

    // Signatures
    const sigY = termY + 50;
    const sigW = cw / 2 - 5;

    function drawSig(x, title, footer) {
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, sigY, sigW, 40, 2, 2, 'D');
        doc.setFillColor(248, 250, 252);
        doc.rect(x + 1, sigY + 1, sigW - 2, 8, 'F');
        doc.setTextColor(15, 23, 42); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
        doc.text(title, x + sigW / 2, sigY + 6.5, { align: 'center' });
        doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.text(footer, x + sigW / 2, sigY + 36, { align: 'center' });
    }

    drawSig(mg, 'SIGNATURE DE L\'EMPLOY\u00c9', 'Nom & Pr\u00e9nom lisibles obligatoires');
    drawSig(pageW / 2 + 5, 'CACHET & VISA SERVICE IT', 'Responsable Informatique');

    // --- Footer Bar ---
    doc.setFillColor(15, 23, 42);
    doc.rect(0, pageH - 18, pageW, 18, 'F');
    doc.setFillColor(99, 102, 241);
    doc.rect(0, pageH - 18, pageW, 1, 'F');

    doc.setTextColor(148, 163, 184); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('LABO-IT CONTROL  \u2022  Syst\u00e8me de Gestion du Parc Informatique  \u2022  LABO-NEDJMA', pageW / 2, pageH - 8, { align: 'center' });

    doc.save(`Decharge_${sn}_${asset.user.replace(/ /g, '_')}.pdf`);
    showCopyNotification('\u2705 Bon de d\u00e9charge PDF g\u00e9n\u00e9r\u00e9 avec succ\u00e8s');
}

function generateInventoryPDF() {
    if (!checkAuth()) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 297, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("RAPPORT GLOBAL D'INVENTAIRE IT - LABO-IT CONTROL", 148, 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const date = new Date().toLocaleDateString();
    doc.text(`Généré le : ${date}`, 20, 40);
    let y = 50;
    doc.setFont(undefined, 'bold');
    doc.text('S/N', 20, y);
    doc.text('UNIT\u00c9', 60, y);
    doc.text('UTILISATEUR', 90, y);
    doc.text('MOD\u00c8LE', 140, y);
    doc.text('STATUT', 240, y);
    doc.line(20, y + 2, 277, y + 2);
    y += 10;
    doc.setFont(undefined, 'normal');
    itAssets.forEach(asset => {
        if (y > 180) { doc.addPage(); y = 20; }
        doc.text(asset.sn, 20, y);
        doc.text(asset.dept || 'N/A', 60, y);
        doc.text(asset.user, 90, y);
        doc.text(asset.model, 140, y);
        doc.text(asset.status, 240, y);
        y += 8;
    });
    doc.save(`Inventaire_Global_IT_${date.replace(/\//g, '-')}.pdf`);
    showCopyNotification(`\u2705 Rapport d'inventaire PDF g\u00e9n\u00e9r\u00e9`);
}

function renderActivityLog(logs) {
    const container = document.getElementById('activityLogContainer');
    if (!container) return;

    // Safety Sort for mixed data (String vs Timestamp)
    const sorted = [...logs].sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return timeB - timeA;
    });

    container.innerHTML = sorted.map(l => {
        let displayTime = '---';
        if (l.timestamp) {
            const dateObj = l.timestamp.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
            displayTime = dateObj.toLocaleString();
        }
        return `
            <tr class="table-row-professional">
                <td style="font-size:0.8rem; color:#64748b;">${displayTime}</td>
                <td><span style="font-size:0.75rem; font-weight:700; padding:4px 10px; border-radius:6px; background:rgba(0,0,0,0.05); color:#475569;">${l.type}</span></td>
                <td><span style="font-weight:700; color:#1e293b;">${l.action}</span></td>
                <td style="font-size:0.82rem; color:#475569;">${l.details}</td>
                <td style="font-weight:600; font-size:0.85rem; color:#6366f1;">${l.user || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

function clearLogs() {
    showConfirm('Vider les Archives', 'Voulez-vous vraiment effacer TOUS les rapports et archives ? Cette action est irr\u00e9versible.').then(confirmed => {
        if (confirmed) {
            db.collection("systemLogs").get().then(snap => {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                batch.commit().then(() => {
                    showCopyNotification('\ud83d\uddd1\ufe0f Toutes les archives ont été effacées');
                    logActivity('SYSTEM', 'CLEAR_LOGS', 'L\'utilisateur a vidé l\'historique des logs');
                });
            });
        }
    });
}

function exportLogsToCSV() {
    db.collection("systemLogs").orderBy('timestamp', 'desc').get().then(snap => {
        const logs = snap.docs.map(doc => doc.data());
        let csv = 'Date,Module,Action,Details,Utilisateur\n';
        logs.forEach(l => {
            csv += `"${l.timestamp}","${l.type}","${l.action}","${l.details.replace(/"/g, '""')}","${l.user}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Archives_IT_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// =============================================
// AUTH & SYNC
// =============================================
function updateDashboardStats() {
    const totalAssets = itAssets.length + itPrinters.length;
    const laptops = itAssets.length;
    const maintenance = itAssets.filter(a => a.status === 'En Maintenance').length;
    const stock = itAssets.filter(a => a.status === 'En Stock').length;
    const printers = itPrinters.length;

    // Update main cards
    const totalEl = document.getElementById('dashTotalAssets');
    const laptopsEl = document.getElementById('dashLaptopsPC');
    const maintEl = document.getElementById('dashMaintenanceAssets');
    const stockEl = document.getElementById('dashStockAssets');
    const printersEl = document.getElementById('dashTotalPrinters');

    if (totalEl) animateValue(totalEl, totalAssets);
    if (laptopsEl) animateValue(laptopsEl, laptops);
    if (maintEl) animateValue(maintEl, maintenance);
    if (stockEl) animateValue(stockEl, stock);
    if (printersEl) animateValue(printersEl, printers);

    // Update banner badges
    const bTotal = document.getElementById('bannerTotalAssets');
    const bPrinters = document.getElementById('bannerTotalPrinters');
    const bStock = document.getElementById('bannerStockAssets');

    if (bTotal) bTotal.innerText = totalAssets;
    if (bPrinters) bPrinters.innerText = printers;
    if (bStock) bStock.innerText = stock;

    // Update modules quick grid badges
    const modAsset = document.getElementById('modAssetCount');
    const modPrinter = document.getElementById('modPrinterCount');
    const modStock = document.getElementById('modStockCount');

    const inventoryCount = itAssets.filter(a => a.status !== 'En Stock').length;

    if (modAsset) modAsset.innerText = `${inventoryCount} Appareils`;
    if (modPrinter) modPrinter.innerText = `${printers} Imprimantes`;
    if (modStock) modStock.innerText = `${stock} En Stock`;
}

function animateValue(obj, end, duration = 800) {
    if (!obj) return;
    let startTimestamp = null;
    const start = parseInt(obj.innerText) || 0;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function syncAssets() {
    if (unsubAssets) unsubAssets();
    unsubAssets = db.collection("itAssets").onSnapshot(snap => {
        itAssets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboardStats();
        if (document.getElementById('pageDirectory').classList.contains('active')) renderAssets(itAssets.filter(a => a.status !== 'En Stock'));
        if (document.getElementById('pageTools').classList.contains('active')) renderStockAssets();
    }, err => console.warn("Firestore Sync Assets:", err.message));
}

function syncPrinters() {
    if (unsubPrinters) unsubPrinters();
    unsubPrinters = db.collection("itPrinters").onSnapshot(snap => {
        itPrinters = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboardStats();
        if (document.getElementById('pagePrinters').classList.contains('active')) renderPrinters();
    }, err => console.warn("Firestore Sync Printers:", err.message));
}

function syncLogs() {
    if (unsubLogs) unsubLogs();
    unsubLogs = db.collection("systemLogs").orderBy("timestamp", "desc").limit(20).onSnapshot(snap => {
        itLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const countBadge = document.querySelector('.page-card[onclick*="database"] .module-count-badge, .module-card[onclick*="database"] .module-count-badge, #modLogCount');
        if (countBadge) countBadge.innerText = `${itLogs.length} Logs`;

        if (document.getElementById('pageDatabase').classList.contains('active')) {
            renderActivityLog(itLogs);
        }
    }, err => console.warn("Firestore Sync Logs:", err.message));
}

auth.onAuthStateChanged(user => {
    const authZone = document.getElementById('authZone');
    const body = document.body;

    if (user) {
        body.classList.remove('auth-locked');
        closeLoginModal();
        syncAssets();
        syncPrinters();
        syncLogs();
        if (authZone) {
            authZone.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; color:white;">
                    <div style="display:flex; flex-direction:column; align-items:flex-end;">
                        <span style="font-size:0.75rem; font-weight:800; letter-spacing:1px; color:white;">${user.email.split('@')[0].toUpperCase()}</span>
                        <span style="font-size:0.6rem; color:#818cf8; font-weight:700;">ADMINISTRATEUR</span>
                    </div>
                    <button id="logoutBtn" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); width:36px; height:36px; border-radius:10px; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.3s;" title="Déconnexion"><i class="fas fa-power-off"></i></button>
                </div>`;
            document.getElementById('logoutBtn').onclick = () => {
                showConfirm('D\u00e9connexion', 'Voulez-vous vraiment vous d\u00e9connecter ?').then(confirmed => {
                    if (confirmed) auth.signOut();
                });
            };
        }
    } else {
        // Unsubscribe from active listeners on logout
        if (unsubAssets) unsubAssets();
        if (unsubPrinters) unsubPrinters();
        if (unsubLogs) unsubLogs();

        itAssets = []; itPrinters = [];
        updateDashboardStats();
        body.classList.add('auth-locked');
        // No longer forcing modal here to allow guest exploration
        if (authZone) authZone.innerHTML = `<button class="login-trigger-btn" onclick="openLoginModal()">ACC\u00c8S S\u00c9CURIS\u00c9</button>`;
    }
});

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value.trim();
        auth.signInWithEmailAndPassword(email, pass).then(() => {
            showCopyNotification('\u2705 Connexion réussie');
            closeLoginModal();
        }).catch(() => showCopyNotification('\u274c Email ou mot de passe incorrect'));
    };
}

function openLoginModal() { document.getElementById('loginModal').classList.add('show'); }
function closeLoginModal() { document.getElementById('loginModal').classList.remove('show'); }

function openConfirmReturnModal(sn) {
    const modal = document.getElementById('confirmReturnModal');
    const btn = document.getElementById('confirmReturnActionBtn');
    if (modal && btn) {
        btn.onclick = () => {
            returnToStock(sn);
            closeConfirmReturnModal();
        };
        modal.classList.add('show');
    }
}
function closeConfirmReturnModal() {
    const modal = document.getElementById('confirmReturnModal');
    if (modal) modal.classList.remove('show');
}

// Global Backdrop Close Listener
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('show');
    }
});

// Helpers
function showCopyNotification(msg) {
    let n = document.getElementById('copyNotification');
    if (!n) {
        n = document.createElement('div'); n.id = 'copyNotification';
        n.style.cssText = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#0f172a; color:#fff; padding:10px 20px; border-radius:10px; z-index:9999;";
        document.body.appendChild(n);
    }
    n.innerText = msg;
    n.style.display = 'block';
    setTimeout(() => { n.style.display = 'none'; }, 3000);
}
function openGrandTotalModal() {
    const content = document.getElementById('grandTotalContent');
    if (!content) return;

    const stockCount = itAssets.filter(a => a.status === 'En Stock').length;
    const laptopCount = itAssets.length;
    const printerCount = itPrinters.length;

    content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
            <div style="background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px;">
               <div style="width: 45px; height: 45px; background: #e0f2fe; color: #0ea5e9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;"><i class="fas fa-laptop"></i></div>
               <div>
                  <div style="font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Ordinateurs</div>
                  <div style="font-size: 1.5rem; font-weight: 800; color: #0f172a;">${laptopCount}</div>
               </div>
            </div>
            <div style="background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px;">
               <div style="width: 45px; height: 45px; background: #f5f3ff; color: #8b5cf6; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;"><i class="fas fa-print"></i></div>
               <div>
                  <div style="font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Imprimantes</div>
                  <div style="font-size: 1.5rem; font-weight: 800; color: #0f172a;">${printerCount}</div>
               </div>
            </div>
            <div style="background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px;">
               <div style="width: 45px; height: 45px; background: #fff7ed; color: #f97316; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;"><i class="fas fa-box"></i></div>
               <div>
                  <div style="font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Stock IT</div>
                  <div style="font-size: 1.5rem; font-weight: 800; color: #0f172a;">${stockCount}</div>
               </div>
            </div>
        </div>
        
        <h4 style="font-size: 0.8rem; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
           <i class="fas fa-desktop"></i> Parc Informatique
        </h4>
        <div style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <tr>
                        <th style="padding: 12px 20px; text-align: left; color: #64748b; font-weight: 700;">MODÈLE</th>
                        <th style="padding: 12px 20px; text-align: left; color: #64748b; font-weight: 700;">UTILISATEUR</th>
                        <th style="padding: 12px 20px; text-align: right; color: #64748b; font-weight: 700;">STATUT</th>
                    </tr>
                </thead>
                <tbody>
                      ${(itAssets.length === 0 && itPrinters.length === 0) ? '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8;">Aucun appareil enregistré</td></tr>' :
            [...itAssets.map(a => ({ ...a, type: 'IT', displaySN: a.sn, displayUser: a.user })),
            ...itPrinters.map(p => ({ ...p, type: 'PRINTER', displaySN: p.ip, displayUser: p.dept }))]
                .map(item => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px 20px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <i class="fas ${item.type === 'PRINTER' ? 'fa-print' : 'fa-laptop'}" style="color:#64748b; font-size:12px;"></i>
                                    <strong>${item.model}</strong>
                                </div>
                                <small style="color: #94a3b8; margin-left:22px;">${item.displaySN}</small>
                            </td>
                            <td style="padding: 12px 20px; font-weight: 600; color: #475569;">${item.displayUser.toUpperCase()}</td>
                            <td style="padding: 12px 20px; text-align: right;"><span style="font-size: 0.75rem; font-weight: 600; color: ${item.status === 'En Service' || item.status === 'En Ligne' ? '#10b981' : '#f59e0b'};">${item.status}</span></td>
                        </tr>
                      `).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('grandTotalModal').classList.add('show');
}
function closeGrandTotalModal() { document.getElementById('grandTotalModal').classList.remove('show'); }
