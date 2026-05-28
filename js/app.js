// ============ FIREBASE INITIALIZATION & AUTH ============
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
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

let unsubAssets = null;
let unsubPrinters = null;
let unsubStock = null;
let unsubDist = null;
let unsubBesoins = null;
let unsubEnvois = null;
let unsubPannes = null;

// ============ SECURITY HELPERS ============
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\//g, '&#x2F;');
}

function safeSetHTML(element, html) {
    if (element) {
        element.textContent = '';
        const range = document.createRange();
        range.selectNodeContents(element);
        element.appendChild(range.createContextualFragment(html));
    }
}

function safeGet(obj, key, fallback = undefined) {
    if (obj && typeof obj === 'object') {
        const k = String(key);
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
            return fallback;
        }
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
            return obj[k];
        }
    }
    return fallback;
}

function safeGetIndex(arr, index, fallback = undefined) {
    if (!Array.isArray(arr)) return fallback;
    const idx = Math.floor(Number(index));
    if (isNaN(idx) || idx < 0 || idx >= arr.length) return fallback;
    return arr[idx];
}

const ENVOI_IMAGE_STORE_KEY = 'laboEnvoiImagesV1';
const PANNE_IMAGE_STORE_KEY = 'laboPanneImagesV1';

function loadLocalImageStore(storageKey) {
    try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (Array.isArray(parsed)) {
            return parsed
                .map(entry => ({
                    id: String(entry?.id || ''),
                    image: typeof entry?.image === 'string' ? entry.image : ''
                }))
                .filter(entry => entry.id && entry.image);
        }
        if (parsed && typeof parsed === 'object') {
            return Object.entries(parsed)
                .map(([id, image]) => ({
                    id: String(id || ''),
                    image: typeof image === 'string' ? image : ''
                }))
                .filter(entry => entry.id && entry.image);
        }
    } catch (error) {
        console.warn('Local image store ignored:', error);
    }
    return [];
}

function saveLocalImageStore(storageKey, store) {
    localStorage.setItem(storageKey, JSON.stringify(Array.isArray(store) ? store : []));
}

function getLocalImage(store, id) {
    const safeId = String(id || '');
    const found = Array.isArray(store) ? store.find(entry => entry.id === safeId) : null;
    return found && typeof found.image === 'string' ? found.image : '';
}

function setLocalImage(store, id, image) {
    const safeId = String(id || '');
    const safeImage = typeof image === 'string' ? image : '';
    const nextStore = Array.isArray(store) ? store.filter(entry => entry.id !== safeId) : [];
    if (safeId && safeImage) {
        nextStore.push({ id: safeId, image: safeImage });
    }
    return nextStore;
}

function removeLocalImage(store, id) {
    const safeId = String(id || '');
    return Array.isArray(store) ? store.filter(entry => entry.id !== safeId) : [];
}

// ============ EFFETS VISUELS D'ARRIERE-PLAN ============
function createParticles() {
    const container = document.getElementById('particlesContainer');
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 6 + 2;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = safeGetIndex(colors, Math.floor(Math.random() * colors.length));
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 8 + 's';
        particle.style.animationDuration = (Math.random() * 8 + 6) + 's';
        container.appendChild(particle);
    }
}

// ============ BASE DE DONNÉES LOCALE (FALLBACKS & DATASETS PREMIOMS) ============
const defaultDevices = [];
const defaultPrinters = [];
const defaultStock = [];
const defaultDistribution = [];
const defaultBesoins = [];
const defaultEnvois = [];

// Force clearing mock data for fresh database or server migration
if (localStorage.getItem('laboDataClearedForServerV1') !== 'true') {
    localStorage.setItem('laboDevicesV3', JSON.stringify([]));
    localStorage.setItem('laboPrintersV3', JSON.stringify([]));
    localStorage.setItem('laboStockItemsV3', JSON.stringify([]));
    localStorage.setItem('laboDistributionV1', JSON.stringify([]));
    localStorage.setItem('laboBesoinsV3', JSON.stringify([]));
    localStorage.setItem('laboEnvoisV1', JSON.stringify([]));
    localStorage.setItem('laboDataPreparedV10', 'true');
    localStorage.setItem('laboDataClearedForServerV1', 'true');
}

let devices = JSON.parse(localStorage.getItem('laboDevicesV3')) || defaultDevices;
let printers = JSON.parse(localStorage.getItem('laboPrintersV3')) || defaultPrinters;

// Pagination and Status Card Filter state for all views
window.currentDevicesPage = 1;
window.currentStatusFilter = null;

window.currentPrintersPage = 1;
window.currentPrintersStatusFilter = null;

window.currentStockCategoryPage = 1;
window.currentStockCategoryStatusFilter = null;

window.currentDistributionPage = 1;
window.currentDistributionStatusFilter = null;

window.currentBesoinsPage = 1;
window.currentEnvoisPage = 1;

const pageSize = 20;

// ============ FIRESTORE REAL-TIME SYNCHRONIZATION ============
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

function migrateLocalDataToFirestore() {
    if (!auth.currentUser) return;

    // 1. Stock
    const localStock = JSON.parse(localStorage.getItem('laboStockItemsV3'));
    if (localStock && localStock.length > 0) {
        localStock.forEach(item => {
            const docId = item.id ? String(item.id) : db.collection("itStock").doc().id;
            db.collection("itStock").doc(docId).set({
                name: item.name || '',
                category: item.category || '',
                ref: item.ref || '',
                qty: parseInt(item.qty) || 0,
                location: item.location || '',
                date: item.date || '',
                notes: item.notes || '',
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.error("Error migrating stock item:", err));
        });
        localStorage.removeItem('laboStockItemsV3');
    }

    // 2. Distributions
    const localDist = JSON.parse(localStorage.getItem('laboDistributionV1'));
    if (localDist && localDist.length > 0) {
        localDist.forEach(item => {
            const docId = item.id ? String(item.id) : db.collection("itDistributions").doc().id;
            db.collection("itDistributions").doc(docId).set({
                employeeName: item.employeeName || '',
                service: item.service || '',
                article: item.article || '',
                qty: parseInt(item.qty) || 1,
                type: item.type || 'Prêt',
                returnDate: item.returnDate || '',
                date: item.date || '',
                notes: item.notes || '',
                status: item.status || 'En cours',
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.error("Error migrating distribution:", err));
        });
        localStorage.removeItem('laboDistributionV1');
    }

    // 3. Besoins
    const localBesoins = JSON.parse(localStorage.getItem('laboBesoinsV3'));
    if (localBesoins && localBesoins.length > 0) {
        localBesoins.forEach(item => {
            const docId = item.id ? String(item.id) : db.collection("itBesoins").doc().id;
            db.collection("itBesoins").doc(docId).set({
                demandeur: item.demandeur || '',
                service: item.service || '',
                date: item.date || '',
                dateLimite: item.dateLimite || '',
                priority: item.priority || 'Urgent',
                status: item.status || 'En attente',
                items: item.items || [],
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.error("Error migrating besoin:", err));
        });
        localStorage.removeItem('laboBesoinsV3');
    }

    // 4. Envois
    const localEnvois = JSON.parse(localStorage.getItem('laboEnvoisV1'));
    if (localEnvois && localEnvois.length > 0) {
        localEnvois.forEach(item => {
            const docId = item.id ? String(item.id) : db.collection("itEnvois").doc().id;
            if (item.imageBase64) {
                const localImages = setLocalImage(loadLocalImageStore(ENVOI_IMAGE_STORE_KEY), docId, item.imageBase64);
                saveLocalImageStore(ENVOI_IMAGE_STORE_KEY, localImages);
            }
            db.collection("itEnvois").doc(docId).set({
                destinataire: item.destinataire || '',
                lieu: item.lieu || '',
                date: item.date || '',
                equipement: item.equipement || '',
                type: item.type || '',
                marque: item.marque || '',
                etat: item.etat || '',
                qty: parseInt(item.qty) || 1,
                notes: item.notes || '',
                livre: item.livre || false,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.error("Error migrating envoi:", err));
        });
        localStorage.removeItem('laboEnvoisV1');
    }
}

function startFirestoreSync() {
    stopFirestoreSync();
    migrateLocalDataToFirestore();

    showToast("🔄 Connexion Cloud Firestore...", "blue");

    unsubAssets = db.collection("itAssets").onSnapshot((snapshot) => {
        const firestoreDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        devices = firestoreDocs.map(doc => {
            const data = doc;
            return {
                id: doc.id,
                sn: data.sn || doc.id,
                type: data.type || 'Laptop',
                service: data.dept || 'Sans Service',
                user: data.user || 'Non assigné',
                accessories: data.peripherals || '',
                model: data.model || 'Inconnu',
                specs: data.specs || '',
                cpu: data.cpu || '',
                ram: data.ram || '',
                disk: data.disk || '',
                status: data.status || 'Actif',
                date: data.assignedDate || '---',
                notes: data.notes || '',
                interventions: data.interventions || [],
                lastUpdate: data.lastUpdate || null
            };
        });

        // Sort by lastUpdate descending (most recent first), fallback to date string descending
        devices.sort((a, b) => {
            const tA = a.lastUpdate ? (a.lastUpdate.seconds || (a.lastUpdate.toDate ? a.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            const tB = b.lastUpdate ? (b.lastUpdate.seconds || (b.lastUpdate.toDate ? b.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            if (tA !== tB) {
                return tB - tA;
            }
            const dA = a.date || '';
            const dB = b.date || '';
            return dB.localeCompare(dA);
        });

        renderTable();
        updateStats();
        updateRecordCount();
        
        if (activeDeviceId && document.getElementById('deviceDetailView').classList.contains('view-active')) {
            showDeviceDetail(activeDeviceId);
        }
    }, (error) => {
        console.error("Firestore sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itAssets)", "red");
    });

    unsubPrinters = db.collection("itPrinters").onSnapshot((snapshot) => {
        printers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                model: data.model || 'Inconnu',
                sn: data.sn || 'N/A',
                type: data.type || 'Laser',
                location: data.location || 'Non spécifié',
                ip: data.ip || 'N/A',
                connexion: data.connexion || 'Réseau',
                status: data.status || 'Actif',
                date: data.date || new Date().toLocaleDateString('fr-FR'),
                interventions: data.interventions || [],
                lastUpdate: data.lastUpdate || null
            };
        });

        // Sort by lastUpdate descending, fallback to date descending
        printers.sort((a, b) => {
            const tA = a.lastUpdate ? (a.lastUpdate.seconds || (a.lastUpdate.toDate ? a.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            const tB = b.lastUpdate ? (b.lastUpdate.seconds || (b.lastUpdate.toDate ? b.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            if (tA !== tB) {
                return tB - tA;
            }
            const dA = a.date || '';
            const dB = b.date || '';
            return dB.localeCompare(dA);
        });

        if (document.getElementById('printerSearchInput')) {
            filterPrintersTable();
        } else {
            renderPrintersTable();
        }
        updateStats();
        
        if (activePrinterId && document.getElementById('printerDetailView').classList.contains('view-active')) {
            showPrinterDetail(activePrinterId);
        }
    }, (error) => {
        console.error("Firestore printers error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itPrinters)", "red");
    });

    // 3. Stock Items Sync
    unsubStock = db.collection("itStock").onSnapshot((snapshot) => {
        stockItems = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: isNaN(Number(doc.id)) ? doc.id : Number(doc.id),
                name: data.name || '',
                category: data.category || '',
                ref: data.ref || '',
                qty: parseInt(data.qty) || 0,
                location: data.location || '',
                date: data.date || '',
                notes: data.notes || '',
                lastUpdate: data.lastUpdate || null
            };
        });

        if (currentCategoryFilter) {
            if (document.getElementById('stockSearchInput')) {
                filterStockTable();
            } else {
                renderStockCategoryTable();
            }
        }
        updateStockCardCounts();
        updateStats();
        updateDashboardAnalytics();
    }, (error) => {
        console.error("Firestore stock sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itStock)", "red");
    });

    // 4. Distributions Sync
    unsubDist = db.collection("itDistributions").onSnapshot((snapshot) => {
        distributionItems = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: isNaN(Number(doc.id)) ? doc.id : Number(doc.id),
                employeeName: data.employeeName || '',
                service: data.service || '',
                article: data.article || '',
                qty: parseInt(data.qty) || 1,
                type: data.type || 'Prêt',
                returnDate: data.returnDate || '',
                date: data.date || '',
                notes: data.notes || '',
                status: data.status || 'En cours',
                lastUpdate: data.lastUpdate || null
            };
        });

        renderDistributionTable();
        updateDistributionStats();
        updateDashboardAnalytics();
    }, (error) => {
        console.error("Firestore distributions sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itDistributions)", "red");
    });

    // 5. Besoins Sync
    unsubBesoins = db.collection("itBesoins").onSnapshot((snapshot) => {
        besoins = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: isNaN(Number(doc.id)) ? doc.id : Number(doc.id),
                demandeur: data.demandeur || '',
                service: data.service || '',
                date: data.date || '',
                dateLimite: data.dateLimite || '',
                priority: data.priority || 'Urgent',
                status: data.status || 'En attente',
                items: data.items || [],
                lastUpdate: data.lastUpdate || null
            };
        });

        renderBesoinsTable();
        updateBesoinsStats();
    }, (error) => {
        console.error("Firestore besoins sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itBesoins)", "red");
    });

    // 6. Envois Sync
    unsubEnvois = db.collection("itEnvois").onSnapshot((snapshot) => {
        envois = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.imageBase64) {
                envoiLocalImages = setLocalImage(envoiLocalImages, doc.id, data.imageBase64);
                saveLocalImageStore(ENVOI_IMAGE_STORE_KEY, envoiLocalImages);
                doc.ref.update({ imageBase64: firebase.firestore.FieldValue.delete() })
                    .catch(err => console.error("Error clearing envoi image from Firestore:", err));
            }
            return {
                id: isNaN(Number(doc.id)) ? doc.id : Number(doc.id),
                destinataire: data.destinataire || '',
                lieu: data.lieu || '',
                date: data.date || '',
                equipement: data.equipement || '',
                type: data.type || '',
                marque: data.marque || '',
                etat: data.etat || '',
                qty: parseInt(data.qty) || 1,
                notes: data.notes || '',
                livre: data.livre || false,
                lastUpdate: data.lastUpdate || null
            };
        });

        renderEnvoisTable();
        updateBesoinsStats();
    }, (error) => {
        console.error("Firestore envois sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itEnvois)", "red");
    });

    // 7. Pannes Sync
    unsubPannes = db.collection("itPannes").onSnapshot((snapshot) => {
        pannes = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.imageBase64) {
                panneLocalImages = setLocalImage(panneLocalImages, doc.id, data.imageBase64);
                saveLocalImageStore(PANNE_IMAGE_STORE_KEY, panneLocalImages);
                doc.ref.update({ imageBase64: firebase.firestore.FieldValue.delete() })
                    .catch(err => console.error("Error clearing panne image from Firestore:", err));
            }
            return {
                id: doc.id,
                equipement: data.equipement || '',
                sn: data.sn || 'N/A',
                type: data.type || '',
                service: data.service || '',
                declarant: data.declarant || '',
                telephone: data.telephone || '',
                gravite: data.gravite || 'Moyenne',
                date: data.date || '',
                notes: data.notes || '',
                status: data.status || 'En attente',
                lastUpdate: data.lastUpdate || null
            };
        });

        // Sort chronologically (recent first based on id or date)
        pannes.sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return idB - idA;
        });

        if (document.getElementById('panneSearchInput')) {
            filterPannesTable();
        } else {
            renderPannesTable();
        }
        updateBesoinsStats();
    }, (error) => {
        console.error("Firestore pannes sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itPannes)", "red");
    });
}

function stopFirestoreSync() {
    if (unsubAssets) {
        unsubAssets();
        unsubAssets = null;
    }
    if (unsubPrinters) {
        unsubPrinters();
        unsubPrinters = null;
    }
    if (unsubStock) {
        unsubStock();
        unsubStock = null;
    }
    if (unsubDist) {
        unsubDist();
        unsubDist = null;
    }
    if (unsubBesoins) {
        unsubBesoins();
        unsubBesoins = null;
    }
    if (unsubEnvois) {
        unsubEnvois();
        unsubEnvois = null;
    }
    if (unsubPannes) {
        unsubPannes();
        unsubPannes = null;
    }

    devices = [];
    printers = [];
    stockItems = [];
    distributionItems = [];
    besoins = [];
    envois = [];
    pannes = [];

    renderTable();
    renderPrintersTable();
    if (typeof renderStockCategoryTable === 'function') renderStockCategoryTable();
    if (typeof renderDistributionTable === 'function') renderDistributionTable();
    if (typeof renderBesoinsTable === 'function') renderBesoinsTable();
    if (typeof renderEnvoisTable === 'function') renderEnvoisTable();
    if (typeof renderPannesTable === 'function') renderPannesTable();

    updateStats();
    updateRecordCount();
}

function savePrinters() {
    localStorage.setItem('laboPrintersV3', JSON.stringify(printers));
    
    if (auth.currentUser && activePrinterId) {
        const p = printers.find(prn => String(prn.id) === String(activePrinterId));
        if (p) {
            const printerData = {
                model: p.model,
                sn: p.sn,
                type: p.type,
                location: p.location,
                ip: p.ip,
                connexion: p.connexion,
                status: p.status,
                date: p.date,
                interventions: p.interventions || [],
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            };
            db.collection("itPrinters").doc(String(p.id)).set(printerData, { merge: true })
                .catch(err => console.error("Firestore sync error in savePrinters:", err));
        }
    }
    
    renderPrintersTable();
    updateStats();
}

let nextId = devices.length > 0 ? Math.max(...devices.map(d => d.id)) + 1 : 1;

function saveDevices() {
    localStorage.setItem('laboDevicesV3', JSON.stringify(devices));
    
    if (auth.currentUser && activeDeviceId) {
        const d = devices.find(dev => String(dev.id) === String(activeDeviceId));
        if (d) {
            const deviceData = {
                sn: d.sn,
                type: d.type,
                dept: d.service,
                user: d.user,
                peripherals: d.accessories,
                model: d.model,
                specs: d.specs,
                cpu: d.cpu || '',
                ram: d.ram || '',
                disk: d.disk || '',
                status: d.status,
                assignedDate: d.date,
                notes: d.notes,
                interventions: d.interventions || [],
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            };
            db.collection("itAssets").doc(String(d.id)).set(deviceData, { merge: true })
                .catch(err => console.error("Firestore sync error in saveDevices:", err));
        }
    }
    
    updateStats();
    updateRecordCount();
}

function updateStats() {
    const stockLaptops = stockItems.filter(item => item.category === 'PC Portables (Laptops)').reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const stockDesktops = stockItems.filter(item => item.category === 'PC Bureau (Desktops)').reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const total = devices.length + printers.length + stockLaptops + stockDesktops;
    const active = devices.filter(d => d.type !== 'Desktop').length;
    const maint = devices.filter(d => d.status === 'Maintenance').length + printers.filter(p => p.status === 'Maintenance').length;
    const stock = stockItems.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const desktop = devices.filter(d => d.type === 'Desktop').length;

    smoothAnimate('statTotal', total);
    smoothAnimate('statPC', active);
    smoothAnimate('statMaint', maint);
    smoothAnimate('statStock', stock);
    smoothAnimate('statPrint', printers.length);
    smoothAnimate('statDesktop', desktop);

    updateDashboardStatChange('statTotalChange', total > 0 ? 'Données live' : 'Aucune donnée', 'fas fa-database');
    updateDashboardStatChange('statPCChange', formatShare(active, total), 'fas fa-chart-pie');
    updateDashboardStatChange('statMaintChange', formatShare(maint, total), 'fas fa-chart-pie');
    updateDashboardStatChange('statStockChange', stock > 0 ? 'Stock réel' : 'Aucune donnée', 'fas fa-boxes-stacked');
    updateDashboardStatChange('statPrintChange', formatShare(printers.length, total), 'fas fa-chart-pie');
    updateDashboardStatChange('statDesktopChange', formatShare(desktop, total), 'fas fa-chart-pie');
    
    // Update detailed inventory view counts (only for physical devices, not printers)
    const activeDevs = devices.filter(d => d.status === 'Actif').length;
    const maintDevs = devices.filter(d => d.status === 'Maintenance').length;
    smoothAnimate('inventaireTotalCount', devices.length);
    smoothAnimate('inventaireActiveCount', activeDevs);
    smoothAnimate('inventaireMaintCount', maintDevs);

    // Update printer stats row
    const activePrinters = printers.filter(p => p.status === 'Actif').length;
    const maintPrinters = printers.filter(p => p.status === 'Maintenance').length;
    const offlinePrinters = printers.filter(p => p.status !== 'Actif' && p.status !== 'Maintenance').length;
    smoothAnimate('printerTotalCount', printers.length);
    smoothAnimate('printerOnlineCount', activePrinters);
    smoothAnimate('printerMaintCount', maintPrinters);
    smoothAnimate('printerOfflineCount', offlinePrinters);

    updateDashboardAnalytics();
}

function formatShare(value, total) {
    if (!total) return 'Aucune donnée';
    return `${Math.round((value / total) * 100)}% du parc`;
}

function updateDashboardStatChange(id, text, iconClass) {
    const el = document.getElementById(id);
    if (!el) return;
    const isEmpty = text === 'Aucune donnée';
    el.classList.toggle('up', !isEmpty);
    el.classList.toggle('down', false);
    safeSetHTML(el, '<i class="' + escapeHTML(iconClass) + '"></i> ' + escapeHTML(text));
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setMetricWidth(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function setChartHeight(id, value, maxValue) {
    const el = document.getElementById(id);
    if (!el) return;
    const height = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
    el.style.height = `${Math.max(value > 0 ? 12 : 4, Math.min(100, height))}%`;
}

function updateDashboardAnalytics() {
    const stockLaptops = stockItems.filter(item => item.category === 'PC Portables (Laptops)').reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const stockDesktops = stockItems.filter(item => item.category === 'PC Bureau (Desktops)').reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const totalDevices = devices.length + printers.length + stockLaptops + stockDesktops;
    const activeDevices = devices.filter(d => d.status === 'Actif').length + printers.filter(p => p.status === 'Actif').length;
    const maintenanceDevices = devices.filter(d => d.status === 'Maintenance').length + printers.filter(p => p.status === 'Maintenance').length;
    const stockDevices = totalDevices - activeDevices - maintenanceDevices;
    const desktopDevices = devices.filter(d => d.type === 'Desktop').length;
    const laptopDevices = devices.filter(d => d.type !== 'Desktop').length;
    const totalPrinters = printers.length;
    const stockRecords = stockItems.length;
    const stockUnits = stockItems.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const stockCategories = new Set(stockItems.map(item => item.category).filter(Boolean)).size;
    const loanItems = distributionItems.filter(item => item.type === 'Prêt' && item.status === 'En cours');
    const today = new Date().toISOString().substring(0, 10);
    const lateLoans = loanItems.filter(item => item.returnDate && item.returnDate < today).length;
    const activityRate = totalDevices ? Math.round((activeDevices / totalDevices) * 100) : 0;
    const maintenanceRate = totalDevices ? Math.round((maintenanceDevices / totalDevices) * 100) : 0;

    setText('analyticsHealthValue', `${activityRate}%`);
    setText('analyticsHealthSub', `${activeDevices} / ${totalDevices} actifs`);
    setText('analyticsMaintValue', maintenanceDevices);
    setText('analyticsMaintSub', `${maintenanceRate}% du parc`);
    setText('analyticsStockValue', stockUnits);
    setText('analyticsStockSub', `${stockCategories} catégories`);
    setText('analyticsLoanValue', loanItems.length);
    setText('analyticsLoanSub', lateLoans > 0 ? `${lateLoans} en retard` : `${distributionItems.length} opérations`);

    setText('dashboardLaptopCount', laptopDevices);
    setText('dashboardDesktopCount', desktopDevices);
    setText('dashboardPrinterCount', totalPrinters);

    const operationsMax = Math.max(1, laptopDevices, desktopDevices, totalPrinters);
    setMetricWidth('dashboardLaptopBar', (laptopDevices / operationsMax) * 100);
    setMetricWidth('dashboardDesktopBar', (desktopDevices / operationsMax) * 100);
    setMetricWidth('dashboardPrinterBar', (totalPrinters / operationsMax) * 100);

    setText('moduleDeviceBadge', `${devices.length} Appareils`);
    setText('modulePrinterBadge', `${totalPrinters} Imprimantes`);
    setText('moduleStockBadge', `${stockUnits} Pièces`);
    setText('moduleDistributionBadge', distributionItems.length ? `${distributionItems.length} Bons` : 'Suivi');

    const chartValues = [
        { bar: 'chartDevices', label: 'chartDevicesValue', value: devices.length },
        { bar: 'chartPrinters', label: 'chartPrintersValue', value: totalPrinters },
        { bar: 'chartStock', label: 'chartStockValue', value: stockUnits },
        { bar: 'chartDistribution', label: 'chartDistributionValue', value: distributionItems.length }
    ];
    const chartMax = Math.max(1, ...chartValues.map(item => item.value));
    chartValues.forEach(item => {
        setChartHeight(item.bar, item.value, chartMax);
        setText(item.label, item.value);
    });

    const totalRingItems = activeDevices + maintenanceDevices + stockUnits;
    setText('dashboardStatusRingValue', totalRingItems);
    setText('dashboardStatusActive', activeDevices);
    setText('dashboardStatusMaintenance', maintenanceDevices);
    setText('dashboardStatusStock', stockUnits);

    const ring = document.getElementById('dashboardStatusRing');
    if (ring) {
        if (totalRingItems === 0) {
            ring.style.background = 'conic-gradient(#94a3b8 0deg 360deg)';
        } else {
            const activeDeg = (activeDevices / totalRingItems) * 360;
            const maintDeg = (maintenanceDevices / totalRingItems) * 360;
            const stockDeg = (stockUnits / totalRingItems) * 360;
            const maintEnd = activeDeg + maintDeg;
            const stockEnd = maintEnd + stockDeg;
            ring.style.background = `conic-gradient(#10b981 0deg ${activeDeg}deg, #f59e0b ${activeDeg}deg ${maintEnd}deg, #6366f1 ${maintEnd}deg ${stockEnd}deg, #94a3b8 ${stockEnd}deg 360deg)`;
        }
    }
}

function smoothAnimate(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 800;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Fonction d'easing
        const eased = 1 - Math.pow(1 - progress, 4);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function updateRecordCount() {
    const el = document.getElementById('recordCount');
    if (el) {
        el.textContent = devices.length;
    }
}

function renderTable(data = devices) {
    const tbody = document.getElementById('tableBody');
    const avatarColors = [
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #f093fb, #f5576c)',
        'linear-gradient(135deg, #4facfe, #00f2fe)',
        'linear-gradient(135deg, #43e97b, #38f9d7)',
        'linear-gradient(135deg, #fa709a, #fee140)',
        'linear-gradient(135deg, #a18cd1, #fbc2eb)',
        'linear-gradient(135deg, #2193b0, #6dd5ed)',
        'linear-gradient(135deg, #ff6b6b, #ee5a24)',
    ];

    // Ensure data is sorted descending (most recent first) chronologically
    if (data && Array.isArray(data)) {
        data.sort((a, b) => {
            const tA = a.lastUpdate ? (a.lastUpdate.seconds || (a.lastUpdate.toDate ? a.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            const tB = b.lastUpdate ? (b.lastUpdate.seconds || (b.lastUpdate.toDate ? b.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            if (tA !== tB) {
                return tB - tA;
            }
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            if (idA !== idB) return idB - idA;
            const dA = a.date || '';
            const dB = b.date || '';
            return dB.localeCompare(dA);
        });
    }

    // Save active dataset for pagination controls to paginate through
    window.currentDevicesData = data;

    // Slicing logic for pagination
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Bounds safety checks
    if (window.currentDevicesPage > totalPages) {
        window.currentDevicesPage = totalPages;
    }
    if (window.currentDevicesPage < 1) {
        window.currentDevicesPage = 1;
    }

    const startIndex = (window.currentDevicesPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = data.slice(startIndex, endIndex);

    safeSetHTML(tbody, pageData.map((d) => {
        const colorIndex = isNaN(Number(d.id)) ? (d.id ? d.id.charCodeAt(0) : 0) : Number(d.id);
        const color = safeGetIndex(avatarColors, colorIndex % avatarColors.length, avatarColors[0]);
        const initials = d.user.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const statusClass = d.status === 'Actif' ? 'status-active' : d.status === 'Maintenance' ? 'status-maintenance' : 'status-stock';
        const typeIconClass = d.type === 'Desktop' ? 'fas fa-computer' : 'fas fa-laptop';
        const typeIconColor = d.type === 'Desktop' ? 'var(--purple-500)' : 'var(--blue-500)';
        return '<tr style="cursor:pointer;" onclick="if(!event.target.closest(\'.action-btn\')) showDeviceDetail(\'' + escapeHTML(d.id) + '\')">' +
            '<td>' +
            '<div class="user-cell">' +
            '<div class="user-avatar" style="background:' + escapeHTML(color) + '">' + escapeHTML(initials) + '</div>' +
            '<div>' +
            '<div style="font-weight:700; color:var(--text-primary); transition: color 0.2s ease;" onmouseover="this.style.color=\'var(--blue-500)\'" onmouseout="this.style.color=\'var(--text-primary)\'">' + escapeHTML(d.user) + '</div>' +
            '<div style="font-size:0.75rem; color:var(--text-muted);">' + escapeHTML(d.service || 'Sans Service') + '</div>' +
            '</div>' +
            '</div>' +
            '</td>' +
            '<td>' +
            '<div style="font-weight:600;"><i class="' + escapeHTML(typeIconClass) + '" style="color:' + escapeHTML(typeIconColor) + '; margin-right:5px;"></i> ' + escapeHTML(d.model) + '</div>' +
            '<div style="font-size:0.75rem; color:var(--blue-500); font-family:monospace; margin-top:4px;">' + escapeHTML(d.sn || 'S/N: N/A') + '</div>' +
            '</td>' +
            '<td><code style="background:var(--bg-secondary); padding:0.2rem 0.6rem; border-radius:0.5rem; font-size:0.8rem; border:1px solid var(--border-color);">' + escapeHTML(d.specs || 'N/A') + '</code></td>' +
            '<td><span class="status-badge-table ' + escapeHTML(statusClass) + '">' + escapeHTML(d.status) + '</span></td>' +
            '<td>' + escapeHTML(d.date || '---') + '</td>' +
            '<td>' +
            '<div class="action-btns">' +
            '<button class="action-btn" title="Modifier" onclick="editDevice(\'' + escapeHTML(d.id) + '\')"><i class="fas fa-edit"></i></button>' +
            '<button class="action-btn delete" title="Supprimer" onclick="deleteDevice(\'' + escapeHTML(d.id) + '\')"><i class="fas fa-trash-alt"></i></button>' +
            '</div>' +
            '</td>' +
            '</tr>';
    }).join(''));

    renderDevicesPagination(totalItems, totalPages, window.currentDevicesPage);
    updateRecordCount();
}

function renderDevicesPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('devicesPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, 'appareils', 'changeDevicesPage');
    safeSetHTML(container, html);
}

function changeDevicesPage(page) {
    window.currentDevicesPage = page;
    renderTable(window.currentDevicesData);
    
    // Scroll table into view smoothly
    const tableWrapper = document.getElementById('mainTableWrapper');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Make globally available
window.changeDevicesPage = changeDevicesPage;

function filterInventaireByStatus(status) {
    window.currentDevicesPage = 1; // Reset to page 1
    
    if (status === 'Total' || window.currentStatusFilter === status) {
        window.currentStatusFilter = null;
        updateFilterCardHighlight(null);
    } else {
        window.currentStatusFilter = status;
        updateFilterCardHighlight(status);
    }
    
    const query = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    let filtered = devices;
    
    if (window.currentStatusFilter) {
        filtered = filtered.filter(d => d.status === window.currentStatusFilter);
    }
    
    if (query) {
        filtered = filtered.filter(d =>
            d.user.toLowerCase().includes(query) ||
            (d.model && d.model.toLowerCase().includes(query)) ||
            (d.sn && d.sn.toLowerCase().includes(query)) ||
            (d.service && d.service.toLowerCase().includes(query))
        );
    }
    
    renderTable(filtered);
}

// Make globally available
window.filterInventaireByStatus = filterInventaireByStatus;

function updateFilterCardHighlight(status) {
    const totalCard = document.querySelector('#inventaireView .dist-card-total');
    const activeCard = document.querySelector('#inventaireView .dist-card-returned');
    const maintCard = document.querySelector('#inventaireView .dist-card-active');
    
    if (!totalCard || !activeCard || !maintCard) return;
    
    // Reset borders & box shadows to standard premium state
    totalCard.style.transform = '';
    totalCard.style.boxShadow = '';
    activeCard.style.transform = '';
    activeCard.style.boxShadow = '';
    maintCard.style.transform = '';
    maintCard.style.boxShadow = '';
    
    if (!status) {
        totalCard.style.transform = 'translateY(-3px)';
        totalCard.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.15), 0 0 20px rgba(59, 130, 246, 0.08)';
    } else if (status === 'Actif') {
        activeCard.style.transform = 'translateY(-3px)';
        activeCard.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.15), 0 0 20px rgba(16, 185, 129, 0.08)';
    } else if (status === 'Maintenance') {
        maintCard.style.transform = 'translateY(-3px)';
        maintCard.style.boxShadow = '0 12px 30px rgba(245, 158, 11, 0.15), 0 0 20px rgba(245, 158, 11, 0.06)';
    }
}

function filterTable() {
    window.currentDevicesPage = 1; // Reset to page 1
    const query = document.getElementById('searchInput').value.toLowerCase();
    let filtered = devices;
    
    if (window.currentStatusFilter) {
        filtered = filtered.filter(d => d.status === window.currentStatusFilter);
    }
    
    filtered = filtered.filter(d =>
        d.user.toLowerCase().includes(query) ||
        (d.model && d.model.toLowerCase().includes(query)) ||
        (d.sn && d.sn.toLowerCase().includes(query)) ||
        (d.service && d.service.toLowerCase().includes(query))
    );
    renderTable(filtered);
}

function openAddModal() {
    editDeviceCameFromDetail = false;
    const backBtn = document.querySelector('#deviceFormView .back-btn');
    if (backBtn) {
        backBtn.title = "Retour à l'Inventaire";
        backBtn.setAttribute('aria-label', "Retour à l'Inventaire");
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    }
    showView('deviceFormView');
    setTimeout(() => {
        document.getElementById('addUser').focus();
    }, 600); // Wait for transition
    document.getElementById('modalTitle').innerText = 'Nouveau Appareil';
    // Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø§Ù„Ø²Ø±
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer l\'Appareil';
    saveBtn.onclick = addDevice;
}

function closeAddModal() {
    if (editDeviceCameFromDetail && activeDeviceId) {
        showDeviceDetail(activeDeviceId);
        editDeviceCameFromDetail = false;
    } else {
        showView('inventaireView');
    }

    // Set default radio
    document.getElementById('typeLaptop').checked = true;

    // Clear fields
    ['addSN', 'addService', 'addUser', 'addAccessories', 'addModel', 'addSpecs', 'addCPU', 'addRAM', 'addDisk', 'addDate', 'addNotes', 'addLocation'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function assembleSpecs() {
    const cpu = document.getElementById('addCPU').value.trim();
    const ram = document.getElementById('addRAM').value.trim();
    const disk = document.getElementById('addDisk').value.trim();

    const parts = [];
    if (cpu) parts.push(cpu);
    if (ram) parts.push(ram);
    if (disk) parts.push(disk);

    document.getElementById('addSpecs').value = parts.join(', ');
}

function getDeviceSpecs(d) {
    let cpu = d.cpu || '';
    let ram = d.ram || '';
    let disk = d.disk || '';

    if (!cpu || !ram || !disk) {
        const specsStr = d.specs || '';
        const parts = specsStr.split(',').map(p => p.trim()).filter(Boolean);
        
        let parsedCpu = '';
        let parsedRam = '';
        let parsedDisk = '';

        const remainingParts = [];
        parts.forEach(part => {
            const lower = part.toLowerCase();
            if (lower.includes('i3') || lower.includes('i5') || lower.includes('i7') || lower.includes('i9') || lower.includes('ryzen') || lower.includes('m1') || lower.includes('m2') || lower.includes('m3') || lower.includes('celeron') || lower.includes('core') || lower.includes('pentium') || lower.includes('amd') || lower.includes('intel') || lower.includes('snapdragon') || lower.includes('cpu')) {
                parsedCpu = part;
            } else if (lower.includes('ram') || (lower.includes('gb') && !lower.includes('ssd') && !lower.includes('hdd') && parseInt(part) <= 32) || (lower.includes('go') && !lower.includes('ssd') && !lower.includes('hdd') && parseInt(part) <= 32)) {
                parsedRam = part;
            } else if (lower.includes('ssd') || lower.includes('hdd') || lower.includes('tb') || lower.includes('to') || lower.includes('disk') || lower.includes('stockage') || (lower.includes('gb') && parseInt(part) > 32) || (lower.includes('go') && parseInt(part) > 32)) {
                parsedDisk = part;
            } else {
                remainingParts.push(part);
            }
        });

        // Positional allocations for unmatched fields
        if (!parsedCpu) {
            if (parts.length > 0 && parts[0] !== parsedRam && parts[0] !== parsedDisk) {
                parsedCpu = parts[0];
            }
        }
        if (!parsedRam) {
            if (parts.length > 1 && parts[1] !== parsedCpu && parts[1] !== parsedDisk) {
                parsedRam = parts[1];
            } else if (remainingParts.length > 0) {
                parsedRam = remainingParts.shift();
            }
        }
        if (!parsedDisk) {
            if (parts.length > 2 && parts[2] !== parsedCpu && parts[2] !== parsedRam) {
                parsedDisk = parts[2];
            } else if (remainingParts.length > 0) {
                parsedDisk = remainingParts.shift();
            }
        }

        if (!cpu) cpu = parsedCpu || 'N/A';
        if (!ram) ram = parsedRam || 'N/A';
        if (!disk) disk = parsedDisk || 'N/A';
    }

    return { cpu, ram, disk };
}

function renderPaginationHTML(totalItems, totalPages, currentPage, itemName, clickFunctionName) {
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    
    const infoHTML = '<div class="pagination-info">Affichage de <strong>' + startItem + '</strong> à <strong>' + endItem + '</strong> sur <strong>' + totalItems + '</strong> ' + escapeHTML(itemName) + '</div>';

    let buttonsHTML = '<div class="pagination-buttons">';
    
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    buttonsHTML += '<button class="pagination-btn" ' + prevDisabled + ' onclick="' + escapeHTML(clickFunctionName) + '(' + (currentPage - 1) + ')" title="Précédent"><i class="fas fa-chevron-left"></i></button>';

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        buttonsHTML += '<button class="pagination-btn" onclick="' + escapeHTML(clickFunctionName) + '(1)">1</button>';
        if (startPage > 2) {
            buttonsHTML += '<span style="color: var(--text-muted); padding: 0 0.25rem;">...</span>';
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === currentPage ? 'active' : '';
        buttonsHTML += '<button class="pagination-btn ' + activeClass + '" onclick="' + escapeHTML(clickFunctionName) + '(' + p + ')">' + p + '</button>';
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            buttonsHTML += '<span style="color: var(--text-muted); padding: 0 0.25rem;">...</span>';
        }
        buttonsHTML += '<button class="pagination-btn" onclick="' + escapeHTML(clickFunctionName) + '(' + totalPages + ')">' + totalPages + '</button>';
    }

    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    buttonsHTML += '<button class="pagination-btn" ' + nextDisabled + ' onclick="' + escapeHTML(clickFunctionName) + '(' + (currentPage + 1) + ')" title="Suivant"><i class="fas fa-chevron-right"></i></button>';
    
    buttonsHTML += '</div>';

    return infoHTML + buttonsHTML;
}

// ============ CUSTOM DETAIL FUNCTIONS ============
let activeDeviceId = null;
let editDeviceCameFromDetail = false;

function showDeviceDetail(id) {
    const d = devices.find(d => String(d.id) === String(id));
    if (!d) return;
    activeDeviceId = d.id;

    // Hero Icon & Type
    const heroIcon = document.getElementById('detailPageIcon');
    const heroType = document.getElementById('detailPageType');
    if (d.type === 'Desktop') {
        heroIcon.innerHTML = '<i class="fas fa-computer"></i>';
        heroType.textContent = 'Ordinateur Bureau';
    } else {
        heroIcon.innerHTML = '<i class="fas fa-laptop"></i>';
        heroType.textContent = 'Ordinateur Portable';
    }

    // Model Name & Serial
    document.getElementById('detailPageModelName').textContent = d.model || 'N/A';
    document.getElementById('detailPageSN').textContent = d.sn || 'N/A';

    // Status pill
    const statusEl = document.getElementById('detailPageStatus');
    statusEl.className = 'hero-status-pill';
    if (d.status === 'Actif') {
        statusEl.classList.add('status-active');
        statusEl.innerHTML = '<span class="status-dot"></span> En Service';
    } else if (d.status === 'Maintenance') {
        statusEl.classList.add('status-maintenance');
        statusEl.innerHTML = '<span class="status-dot"></span> En Maintenance';
    } else {
        statusEl.classList.add('status-stock');
        statusEl.innerHTML = '<span class="status-dot"></span> En Stock';
    }

    // Observations / Notes
    document.getElementById('detailPageNotes').textContent = d.notes ? `"${d.notes}"` : '"Aucune observation particulière."';

    // Assignment Details
    document.getElementById('detailPageUser').textContent = d.user || 'N/A';
    document.getElementById('detailPageService').textContent = d.service || 'N/A';
    document.getElementById('detailPageDate').textContent = d.date || 'N/A';

    // Specs parsing for graphics
    const specs = getDeviceSpecs(d);
    const cpu = specs.cpu;
    const ram = specs.ram;
    const disk = specs.disk;

    // Progress widths based on parsed capacities
    let cpuPct = 65;
    const cpuLower = cpu.toLowerCase();
    if (cpuLower.includes('i3')) cpuPct = 40;
    else if (cpuLower.includes('i5')) cpuPct = 65;
    else if (cpuLower.includes('i7')) cpuPct = 85;
    else if (cpuLower.includes('i9') || cpuLower.includes('m1') || cpuLower.includes('m2') || cpuLower.includes('m3') || cpuLower.includes('662')) cpuPct = 95;

    let ramPct = 50;
    const ramLower = ram.toLowerCase();
    if (ramLower.includes('4gb') || ramLower.includes('4 go') || ramLower.includes('4g')) ramPct = 25;
    else if (ramLower.includes('8gb') || ramLower.includes('8 go') || ramLower.includes('8g')) ramPct = 50;
    else if (ramLower.includes('16gb') || ramLower.includes('16 go') || ramLower.includes('16g')) ramPct = 75;
    else if (ramLower.includes('32gb') || ramLower.includes('32 go') || ramLower.includes('32g') || ramLower.includes('64gb') || ramLower.includes('64 go') || ramLower.includes('64g')) ramPct = 95;

    let diskPct = 60;
    const diskLower = disk.toLowerCase();
    if (diskLower.includes('128gb') || diskLower.includes('128 go')) diskPct = 25;
    else if (diskLower.includes('256gb') || diskLower.includes('250') || diskLower.includes('256 go')) diskPct = 50;
    else if (diskLower.includes('512gb') || diskLower.includes('500') || diskLower.includes('512 go')) diskPct = 75;
    else if (diskLower.includes('1tb') || diskLower.includes('1to') || diskLower.includes('1 tb')) diskPct = 95;

    // Render Tech Specs Graphic Grid
    const graphicContainer = document.getElementById('detailPageSpecsGraphic');
    safeSetHTML(graphicContainer,
        '<div class="graphic-spec-block block-cpu">' +
        '<div class="spec-icon-wrapper-large">' +
        '<i class="fas fa-microchip"></i>' +
        '</div>' +
        '<span class="spec-block-title">Processeur (CPU)</span>' +
        '<span class="spec-block-value">' + escapeHTML(cpu) + '</span>' +
        '<div class="spec-progress-track">' +
        '<div class="spec-progress-bar" style="width: ' + escapeHTML(cpuPct) + '%;"></div>' +
        '</div>' +
        '<span class="spec-progress-label">Performance: ' + escapeHTML(cpuPct) + '%</span>' +
        '</div>' +
        '<div class="graphic-spec-block block-ram">' +
        '<div class="spec-icon-wrapper-large">' +
        '<i class="fas fa-memory"></i>' +
        '</div>' +
        '<span class="spec-block-title">Mémoire Vive (RAM)</span>' +
        '<span class="spec-block-value">' + escapeHTML(ram) + '</span>' +
        '<div class="spec-progress-track">' +
        '<div class="spec-progress-bar" style="width: ' + escapeHTML(ramPct) + '%;"></div>' +
        '</div>' +
        '<span class="spec-progress-label">Capacité: ' + escapeHTML(ram) + '</span>' +
        '</div>' +
        '<div class="graphic-spec-block block-disk">' +
        '<div class="spec-icon-wrapper-large">' +
        '<i class="fas fa-hdd"></i>' +
        '</div>' +
        '<span class="spec-block-title">Stockage (Disk)</span>' +
        '<span class="spec-block-value">' + escapeHTML(disk) + '</span>' +
        '<div class="spec-progress-track">' +
        '<div class="spec-progress-bar" style="width: ' + escapeHTML(diskPct) + '%;"></div>' +
        '</div>' +
        '<span class="spec-progress-label">Type: Disque Haute Vitesse</span>' +
        '</div>');

    // Accessories Chromatic Render
    const accContainer = document.getElementById('detailPageAccessories');
    accContainer.innerHTML = '';
    if (d.accessories && d.accessories.trim() !== '') {
        const list = d.accessories.split(',').map(a => a.trim());
        list.forEach(acc => {
            const pill = document.createElement('span');
            const lowerAcc = acc.toLowerCase();
            let iconClass = 'fa-check-circle';
            let themeColor = 'blue';

            if (lowerAcc.includes('souris') || lowerAcc.includes('mouse')) {
                iconClass = 'fa-mouse';
                themeColor = 'blue';
            } else if (lowerAcc.includes('sac') || lowerAcc.includes('bag') || lowerAcc.includes('sacoche')) {
                iconClass = 'fa-briefcase';
                themeColor = 'purple';
            } else if (lowerAcc.includes('ecran') || lowerAcc.includes('screen') || lowerAcc.includes('moniteur')) {
                iconClass = 'fa-desktop';
                themeColor = 'emerald';
            } else if (lowerAcc.includes('clavier') || lowerAcc.includes('keyboard')) {
                iconClass = 'fa-keyboard';
                themeColor = 'pink';
            } else if (lowerAcc.includes('casque') || lowerAcc.includes('headphone') || lowerAcc.includes('mic')) {
                iconClass = 'fa-headphones';
                themeColor = 'amber';
            } else if (lowerAcc.includes('tablet') || lowerAcc.includes('pad')) {
                iconClass = 'fa-tablet-alt';
                themeColor = 'cyan';
            } else if (lowerAcc.includes('câble') || lowerAcc.includes('cable') || lowerAcc.includes('chargeur') || lowerAcc.includes('plug')) {
                iconClass = 'fa-plug';
                themeColor = 'teal';
            }

            pill.className = 'accessory-pill theme-' + escapeHTML(themeColor);
            safeSetHTML(pill, '<i class="fas ' + escapeHTML(iconClass) + '"></i> ' + escapeHTML(acc));
            accContainer.appendChild(pill);
        });
    } else {
        safeSetHTML(accContainer, '<span style="color: var(--text-muted); font-size: 0.95rem; font-style: italic;">Aucun accessoire spécifié.</span>');
    }

    // Action button bindings
    document.getElementById('detailPageActionEdit').onclick = function () {
        editDevice(d.id);
    };

    document.getElementById('detailPageActionPrint').onclick = function () {
        printDischarge(d);
    };

    // Render device interventions
    renderDeviceDetailInterventions(d);

    // Navigate to view
    showView('deviceDetailView');
}

function renderDeviceDetailInterventions(d) {
    const devInterventionsEl = document.getElementById('deviceDetailPageInterventions');
    if (devInterventionsEl) {
        devInterventionsEl.innerHTML = '';
        const list = d.interventions || [];
        if (list.length === 0) {
            devInterventionsEl.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Aucune intervention.</span>';
        } else {
            list.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'intervention-item-card theme-indigo';
                safeSetHTML(div, '<div class="intervention-item-header">' +
                    '<span class="intervention-item-type"><i class="fas fa-tools" style="font-size: 0.75rem;"></i> ' + escapeHTML(item.type) + '</span>' +
                    '<div class="intervention-item-actions">' +
                    '<span class="intervention-item-date">' + escapeHTML(item.date) + '</span>' +
                    '<i class="fas fa-edit" title="Modifier" onclick="editIntervention(' + escapeHTML(idx) + ', \'device\', event)"></i>' +
                    '<i class="fas fa-trash-alt" title="Supprimer" onclick="deleteIntervention(' + escapeHTML(idx) + ', \'device\', event)"></i>' +
                    '</div>' +
                    '</div>' +
                    '<div class="intervention-item-desc">' + escapeHTML(item.desc) + '</div>' +
                    '<div class="intervention-item-tech">Par: ' + escapeHTML(item.tech) + '</div>');
                devInterventionsEl.appendChild(div);
            });
        }
    }
}

function openDeviceInterventionModal() {
    if (activeDeviceId === null) return;
    activeInterventionTarget = 'device';
    editingInterventionIndex = null;

    // Set modal style color theme (Blue-Purple for devices)
    document.getElementById('customInterventionTitle').style.backgroundImage = 'var(--gradient-blue-purple)';
    document.getElementById('customInterventionTitle').innerHTML = '<i class="fas fa-tools" style="color: var(--indigo-500);"></i> Déclarer une Intervention';
    document.getElementById('custIntSaveBtn').style.background = 'var(--gradient-blue-purple)';
    document.getElementById('custIntSaveBtn').innerHTML = '<i class="fas fa-save"></i> Enregistrer';

    // Clear inputs
    document.getElementById('custIntType').value = 'Maintenance';
    document.getElementById('custIntCustomType').value = '';
    document.getElementById('custIntCustomTypeContainer').style.display = 'none';
    document.getElementById('custIntDesc').value = '';
    document.getElementById('custIntTech').value = 'Ali S.';

    // Show modal overlay
    document.getElementById('customInterventionOverlay').classList.add('active');
}

function printDischarge(d) {
    const logoUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) + 'assets/logo-pdf.png';
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    const cleanSerial = d.sn ? d.sn.toUpperCase().replace(/[^A-Z0-9]/g, '') : 'SN';
    const dischargeRef = `DEC-${d.id.toString().padStart(4, '0')}-${cleanSerial.substring(0, 12)}`;

    const content = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Bon de Décharge - ${d.user}</title>
                <style>
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #1e293b;
                        background-color: #ffffff;
                        line-height: 1.42;
                        padding: 0;
                        font-size: 13.5px;
                    }
                    .document-wrapper {
                        max-width: 190mm;
                        margin: 0 auto;
                        border: 1px solid #cbd5e1;
                        background: #ffffff;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        min-height: 281mm;
                    }
                    
                    /* Modern Dark Navy Header */
                    .header {
                        background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
                        color: #ffffff;
                        padding: 26px 34px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: relative;
                        overflow: hidden;
                    }
                    .header::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        right: 0;
                        width: 160px;
                        height: 100%;
                        background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                        transform: skewX(-25deg) translateX(60px);
                        z-index: 1;
                    }
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        z-index: 2;
                    }
                    .logo-img {
                        height: 58px;
                        max-width: 165px;
                        object-fit: contain;
                        background: rgba(255, 255, 255, 0.08);
                        padding: 8px;
                        border-radius: 8px;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                    }
                    .logo-title {
                        display: flex;
                        flex-direction: column;
                        gap: 3px;
                    }
                    .sub-hdr {
                        font-size: 9px;
                        font-weight: 800;
                        color: #94a3b8;
                        letter-spacing: 1.8px;
                        text-transform: uppercase;
                    }
                    .main-hdr {
                        font-size: 28px;
                        font-weight: 900;
                        color: #ffffff;
                        letter-spacing: 2px;
                        margin: 0;
                        line-height: 1.1;
                    }
                    .sub-hdr-blue {
                        font-size: 11px;
                        font-weight: 700;
                        color: #818cf8;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }

                    /* Metadata Info Bar */
                    .metadata-bar {
                        background: #f8fafc;
                        border-bottom: 2px solid #e2e8f0;
                        padding: 12px 34px;
                        display: grid;
                        grid-template-columns: 1fr auto minmax(0, 1.45fr);
                        gap: 16px;
                        align-items: center;
                        font-size: 12px;
                        font-weight: 700;
                        color: #475569;
                    }
                    .meta-item {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        white-space: nowrap;
                    }
                    .meta-ref {
                        justify-content: flex-end;
                        font-size: 10.5px;
                    }
                    .meta-ref-code {
                        display: inline-block;
                        max-width: 100%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        direction: ltr;
                    }
                    .status-badge-pdf {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 5px 14px;
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: 900;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    }
                    .status-dot-pdf {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        display: inline-block;
                    }
                    .status-pdf-actif {
                        background-color: #d1fae5 !important;
                        color: #065f46 !important;
                        border: 1.5px solid #a7f3d0;
                    }
                    .status-pdf-actif .status-dot-pdf {
                        background-color: #10b981 !important;
                    }
                    .status-pdf-maintenance {
                        background-color: #fef3c7 !important;
                        color: #92400e !important;
                        border: 1.5px solid #fde68a;
                    }
                    .status-pdf-maintenance .status-dot-pdf {
                        background-color: #f59e0b !important;
                    }
                    .status-pdf-stock {
                        background-color: #dbeafe !important;
                        color: #1e40af !important;
                        border: 1.5px solid #bfdbfe;
                    }
                    .status-pdf-stock .status-dot-pdf {
                        background-color: #3b82f6 !important;
                    }

                    /* Content Section */
                    .content {
                        padding: 28px 34px;
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }

                    /* Two Columns Grid */
                    .cards-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 24px;
                        margin-bottom: 28px;
                    }
                    .info-card {
                        border: 2px solid #cbd5e1;
                        border-radius: 12px;
                        padding: 22px 26px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
                    }
                    .card-equipment {
                        background: #f5f3ff !important;
                        border-left: 7px solid #4f46e5;
                    }
                    .card-assignment {
                        background: #f0fdf4 !important;
                        border-left: 7px solid #059669;
                    }
                    .card-title {
                        font-size: 14px;
                        font-weight: 900;
                        letter-spacing: 1.2px;
                        margin-bottom: 18px;
                        text-transform: uppercase;
                        padding-bottom: 8px;
                        border-bottom: 2px dashed #cbd5e1;
                    }
                    .card-equipment .card-title {
                        color: #4f46e5;
                    }
                    .card-assignment .card-title {
                        color: #059669;
                    }
                    
                    .field-group {
                        margin-bottom: 14px;
                    }
                    .field-group:last-child {
                        margin-bottom: 0;
                    }
                    .field-label {
                        font-size: 11px;
                        font-weight: 850;
                        text-transform: uppercase;
                        color: #475569;
                        letter-spacing: 1px;
                        margin-bottom: 4px;
                    }
                    .field-value {
                        font-size: 14px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .field-value-sn {
                        font-family: monospace;
                        font-size: 14px;
                        color: #4f46e5;
                        font-weight: 850;
                    }

                    /* Accessories Block */
                    .accessories-box {
                        background: #eff6ff !important;
                        border: 2px solid #cbd5e1;
                        border-left: 7px solid #3b82f6;
                        border-radius: 10px;
                        display: flex;
                        overflow: hidden;
                        margin-bottom: 28px;
                    }
                    .accessories-title {
                        background: #3b82f6;
                        color: #ffffff;
                        font-size: 12px;
                        font-weight: 900;
                        letter-spacing: 1.2px;
                        padding: 15px 22px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-transform: uppercase;
                        flex-shrink: 0;
                        min-width: 130px;
                    }
                    .accessories-content {
                        padding: 15px 24px;
                        font-size: 14px;
                        font-weight: 800;
                        color: #1e3a8a;
                        display: flex;
                        align-items: center;
                    }

                    /* Terms and Conditions Box */
                    .terms-box {
                        background: #faf5ff !important;
                        border: 2px solid #cbd5e1;
                        border-left: 7px solid #6366f1;
                        border-radius: 10px;
                        padding: 22px 28px;
                        margin-bottom: 30px;
                    }
                    .terms-list {
                        list-style-type: decimal;
                        padding-left: 20px;
                        color: #0f172a;
                        font-size: 12.8px;
                        font-weight: 650;
                    }
                    .terms-list li {
                        margin-bottom: 8px;
                    }
                    .terms-list li:last-child {
                        margin-bottom: 0;
                    }

                    /* Signatures Section */
                    .signatures-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 28px;
                        margin-top: 20px;
                    }
                    .signature-block {
                        background: #f8fafc;
                        border: 2px solid #94a3b8;
                        border-radius: 12px;
                        height: 145px;
                        padding: 18px 20px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        position: relative;
                    }
                    .signature-block-title {
                        font-size: 11.5px;
                        font-weight: 900;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        text-align: center;
                        color: #475569;
                    }
                    .signature-block-sub {
                        font-size: 10.5px;
                        font-weight: 600;
                        color: #94a3b8;
                        text-align: center;
                        margin-bottom: 5px;
                    }

                    /* Bottom Footer Banner */
                    .footer {
                        background: #1e1b4b;
                        color: #ffffff;
                        text-align: center;
                        padding: 13px;
                        font-size: 11px;
                        font-weight: 700;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        margin-top: auto;
                        border-radius: 0 0 8px 8px;
                    }

                    @media print {
                        @page {
                            size: A4;
                            margin: 8mm;
                        }
                        body {
                            background-color: #ffffff;
                            padding: 0;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .document-wrapper {
                            border: none;
                            max-width: 100%;
                            width: 100%;
                            min-height: calc(297mm - 16mm);
                            page-break-after: avoid;
                        }
                        .footer,
                        .signatures-row {
                            page-break-inside: avoid;
                        }
                        button {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    <!-- Modern Header -->
                    <div class="header">
                        <div class="header-left">
                            <!-- Image logo linked directly to project files -->
                            <img src="${logoUrl}" 
                                 onerror="this.onerror=null; this.src='https://placehold.co/180x60/1e1b4b/ffffff?text=LABO-NEDJMA';" 
                                 alt="Logo" 
                                 class="logo-img">
                            
                            <div class="logo-title">
                                <span class="sub-hdr">DOCUMENT OFFICIEL • SERVICE INFORMATIQUE</span>
                                <h1 class="main-hdr">DÉCHARGE</h1>
                                <span class="sub-hdr-blue">MATÉRIEL INFORMATIQUE - BON D'AFFECTATION</span>
                            </div>
                        </div>
                    </div>

                    <!-- Metadata Info Bar -->
                    <div class="metadata-bar">
                        <div class="meta-item">DATE D'ÉMISSION : ${new Date().toLocaleDateString('fr-FR')}</div>
                        <div class="meta-item">
                            <span class="status-badge-pdf status-pdf-${d.status === 'Actif' ? 'actif' : d.status === 'Maintenance' ? 'maintenance' : 'stock'}">
                                <span class="status-dot-pdf"></span>
                                STATUT : ${d.status === 'Actif' ? 'EN SERVICE' : d.status === 'Maintenance' ? 'EN MAINTENANCE' : 'EN STOCK'}
                            </span>
                        </div>
                        <div class="meta-item meta-ref">RÉF : <span class="meta-ref-code">${dischargeRef}</span></div>
                    </div>

                    <!-- Content wrapper -->
                    <div class="content">
                        <div class="cards-grid">
                            
                            <!-- Left Card: IT Equipment Details -->
                            <div class="info-card card-equipment">
                                <h2 class="card-title">ÉQUIPEMENT IT</h2>
                                
                                <div class="field-group">
                                    <div class="field-label">DÉSIGNATION / MODÈLE</div>
                                    <div class="field-value">${d.model || 'N/A'}</div>
                                </div>
                                
                                <div class="field-group">
                                    <div class="field-label">NUMÉRO DE SÉRIE (S/N)</div>
                                    <div class="field-value field-value-sn">${d.sn || 'N/A'}</div>
                                </div>
                                
                                <div class="field-group">
                                    <div class="field-label">FICHE TECHNIQUE</div>
                                    <div class="field-value" style="font-size:12.5px;">${d.specs || 'N/A'}</div>
                                </div>
                            </div>

                            <!-- Right Card: Assignment Details -->
                            <div class="info-card card-assignment">
                                <h2 class="card-title">AFFECTATION ACTUELLE</h2>
                                
                                <div class="field-group">
                                    <div class="field-label">UTILISATEUR / DÉTENTEUR</div>
                                    <div class="field-value" style="color:#0f172a;">${d.user || 'N/A'}</div>
                                </div>
                                
                                <div class="field-group">
                                    <div class="field-label">DÉPARTEMENT / UNITÉ</div>
                                    <div class="field-value">${d.service || 'N/A'}</div>
                                </div>
                                
                                <div class="field-group">
                                    <div class="field-label">DATE D'AFFECTATION</div>
                                    <div class="field-value">${d.date || 'N/A'}</div>
                                </div>
                            </div>
                            
                        </div>

                        <!-- Accessories Full-Width Row -->
                        <div class="accessories-box">
                            <div class="accessories-title">ACCESSOIRES</div>
                            <div class="accessories-content">
                                ${d.accessories ? d.accessories.split(',').map(a => a.trim().toUpperCase()).join(' + ') : 'AUCUN ACCESSOIRE PARTICULIER'}
                            </div>
                        </div>

                        <!-- Terms and Conditions Box -->
                        <div class="terms-box">
                            <ol class="terms-list">
                                <li>L'employé reconnaît avoir reçu le matériel décrit ci-dessus en bon état de fonctionnement.</li>
                                <li>L'employé s'engage à utiliser le matériel exclusivement à des fins professionnelles.</li>
                                <li>En cas de perte, de vol ou de dommage résultant d'une négligence, l'employé peut être tenu responsable.</li>
                                <li>Le matériel doit être restitué au service IT lors de la fin de contrat ou sur demande de l'administration.</li>
                            </ol>
                        </div>

                        <!-- Signatures Row -->
                        <div class="signatures-row">
                            <div class="signature-block">
                                <div class="signature-block-title">SIGNATURE DE L'EMPLOYÉ</div>
                                <div class="signature-block-sub">Nom & Prénom lisibles obligatoires</div>
                            </div>
                            <div class="signature-block">
                                <div class="signature-block-title">CACHET & VISA SERVICE IT</div>
                                <div class="signature-block-sub">Responsable Informatique</div>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Footer Banner -->
                    <div class="footer">
                        LABO-IT CONTROL • SYSTÈME DE GESTION DU PARC INFORMATIQUE • LABO-NEDJMA
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                <\/script>
            </body>
            </html>
            `;

    printWindow.document.write(content);
    printWindow.document.close();
}


function addDevice() {
    const typeRadio = document.querySelector('input[name="deviceType"]:checked');
    const type = typeRadio ? typeRadio.value : 'Laptop';
    const sn = document.getElementById('addSN').value.trim();
    const service = document.getElementById('addService').value.trim();
    const user = document.getElementById('addUser').value.trim();
    const accessories = document.getElementById('addAccessories').value.trim();
    const model = document.getElementById('addModel').value.trim();
    const specs = document.getElementById('addSpecs').value.trim();
    const cpu = document.getElementById('addCPU').value.trim();
    const ram = document.getElementById('addRAM').value.trim();
    const disk = document.getElementById('addDisk').value.trim();
    const status = document.getElementById('addStatus').value;
    const date = document.getElementById('addDate').value;
    const notes = document.getElementById('addNotes').value.trim();

    if (!user || !model || !sn) {
        showToast('⚠️ Veuillez remplir l\'utilisateur, le modèle et le S/N', 'red');
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    const deviceData = {
        sn,
        type,
        dept: service,
        user,
        peripherals: accessories,
        model,
        specs,
        cpu,
        ram,
        disk,
        status,
        assignedDate: date,
        notes,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("itAssets").doc(sn).set(deviceData, { merge: true })
        .then(() => {
            logActivity('INVENTAIRE', 'MODIF_AJOUT', `Appareil ajouté: ${sn} (${model})`);
            showToast('✅ Appareil enregistré avec succès sur Firebase !', 'green');
            closeAddModal();
        })
        .catch(error => {
            console.error("Firestore save error:", error);
            showToast('❌ Échec de l\'enregistrement sur Firebase', 'red');
        });
}

function deleteDevice(id) {
    showCustomConfirm(
        "Supprimer l'Appareil",
        "Voulez-vous vraiment supprimer définitivement cet appareil ? Toutes ses données associées seront perdues. Cette action est irréversible.",
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itAssets").doc(String(id)).delete()
                .then(() => {
                    logActivity('INVENTAIRE', 'SUPPRESSION', `Appareil supprimé: ${id}`);
                    showToast('🗑️ Appareil supprimé de Firebase', 'blue');
                    if (activeDeviceId === id) {
                        activeDeviceId = null;
                    }
                })
                .catch(error => {
                    console.error("Firestore delete error:", error);
                    showToast('❌ Échec de la suppression sur Firebase', 'red');
                });
        },
        null,
        true // delete style
    );
}

function editDevice(id) {
    const d = devices.find(d => String(d.id) === String(id));
    if (!d) return;

    editDeviceCameFromDetail = document.getElementById('deviceDetailView').classList.contains('view-active');
    activeDeviceId = id;

    const backBtn = document.querySelector('#deviceFormView .back-btn');
    if (backBtn) {
        if (editDeviceCameFromDetail) {
            backBtn.title = "Retour à la Fiche Appareil";
            backBtn.setAttribute('aria-label', "Retour à la Fiche Appareil");
        } else {
            backBtn.title = "Retour à l'Inventaire";
            backBtn.setAttribute('aria-label', "Retour à l'Inventaire");
        }
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    }

    document.getElementById('modalTitle').innerText = 'Modifier l\'Appareil';
    if (d.type === 'Desktop') document.getElementById('typeDesktop').checked = true;
    else document.getElementById('typeLaptop').checked = true;

    document.getElementById('addSN').value = d.sn || '';
    document.getElementById('addService').value = d.service || '';
    document.getElementById('addUser').value = d.user || '';
    document.getElementById('addAccessories').value = d.accessories || '';
    document.getElementById('addModel').value = d.model || '';

    // Populate the three separate configuration inputs
    const specs = getDeviceSpecs(d);
    document.getElementById('addCPU').value = specs.cpu === 'N/A' ? '' : specs.cpu;
    document.getElementById('addRAM').value = specs.ram === 'N/A' ? '' : specs.ram;
    document.getElementById('addDisk').value = specs.disk === 'N/A' ? '' : specs.disk;
    document.getElementById('addSpecs').value = d.specs || '';

    document.getElementById('addStatus').value = d.status;
    document.getElementById('addDate').value = d.date || '';
    document.getElementById('addNotes').value = d.notes || '';

    showView('deviceFormView');

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Mettre à jour';
    saveBtn.onclick = function () {
        const typeRadio = document.querySelector('input[name="deviceType"]:checked');
        const type = typeRadio ? typeRadio.value : 'Laptop';
        const sn = document.getElementById('addSN').value.trim();
        const service = document.getElementById('addService').value.trim();
        const user = document.getElementById('addUser').value.trim();
        const accessories = document.getElementById('addAccessories').value.trim();
        const model = document.getElementById('addModel').value.trim();
        const specs = document.getElementById('addSpecs').value.trim();
        const cpu = document.getElementById('addCPU').value.trim();
        const ram = document.getElementById('addRAM').value.trim();
        const disk = document.getElementById('addDisk').value.trim();
        const status = document.getElementById('addStatus').value;
        const date = document.getElementById('addDate').value;
        const notes = document.getElementById('addNotes').value.trim();

        if (!user || !model || !sn) {
            showToast('⚠️ Veuillez remplir l\'utilisateur, le modèle et le S/N', 'red');
            return;
        }

        if (!auth.currentUser) {
            showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
            return;
        }

        const deviceData = {
            sn,
            type,
            dept: service,
            user,
            peripherals: accessories,
            model,
            specs,
            cpu,
            ram,
            disk,
            status,
            assignedDate: date,
            notes,
            interventions: d.interventions || [],
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection("itAssets").doc(String(d.id)).set(deviceData, { merge: true })
            .then(() => {
                logActivity('INVENTAIRE', 'MODIF_AJOUT', `Appareil mis à jour: ${sn} (${model})`);
                showToast('✏️ Appareil mis à jour avec succès sur Firebase !', 'blue');
                closeAddModal();
            })
            .catch(error => {
                console.error("Firestore edit error:", error);
                showToast('❌ Échec de la modification sur Firebase', 'red');
            });
    };
}

function showToast(message, color = 'blue') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    const borderColors = {
        blue: 'var(--blue-500)',
        green: 'var(--emerald-500)',
        red: 'var(--red-500)',
        purple: 'var(--purple-500)',
        cyan: 'var(--cyan-500)',
    };
    toast.style.borderColor = safeGet(borderColors, color, borderColors.blue);
    document.body.appendChild(toast);
    
    // Play dynamic crystal chime
    if (typeof playChime === 'function') {
        playChime(color === 'red' ? 'error' : 'success');
    }
    
    setTimeout(() => toast.remove(), 3000);
}

function showRandomNotification() {
    const notifications = [
        '🔔 Mise à jour : Nouvel appareil ajouté au stock',
        '📊 Rapport : Audit hebdomadaire terminé',
        '🖨️ Alerte : L\'imprimante Salle 3 nécessite une maintenance',
        '✅ Succès : Base de données mise à jour',
        '📦 Stock : 3 nouveaux appareils disponibles',
    ];
    const random = safeGetIndex(notifications, Math.floor(Math.random() * notifications.length));
    showToast(random, 'purple');
}

function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('laboThemeV3', newTheme);
    showToast(newTheme === 'dark' ? '🌙 Mode Sombre Activé' : '☀️ Mode Clair Activé', 'blue');
}

function updateFooterTime() {
    const el = document.getElementById('footerTime');
    if (el) {
        const now = new Date();
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        el.textContent = now.toLocaleString('fr-FR', options);
    }
}

// ============ Conseil d'utilisation du système ============
function initDynamicAdvisory() {
    const advisories = [
        "Vous pouvez ajouter instantanément des équipements ou imprimantes depuis les boutons d'ajout rapide pour actualiser le tableau de bord.",
        "Saisissez une date de retour précise pour les prêts afin que le système puisse signaler automatiquement tout retard en rouge.",
        "Utilisez l'icône PDF à côté de chaque prêt ou besoin pour générer une décharge officielle et élégante, prête à l'impression.",
        "Le système enregistre automatiquement toutes les données localement (LocalStorage), garantissant la sécurité de vos informations.",
        "La barre de recherche intelligente permet de filtrer instantanément par nom, département, numéro de série ou adresse IP.",
        "Suivez l'état des demandes d'achat en temps réel dans le module des besoins (En attente, Approuvé, Rejeté).",
        "Les indicateurs et le graphique circulaire (Status Ring) se mettent à jour automatiquement à chaque modification de statut d'un appareil.",
        "Basculez facilement entre le mode clair et le mode sombre en un clic grâce à l'interrupteur situé en haut à droite.",
        "Consultez régulièrement l'indicateur 'Hors Stock' dans le module de stock pour anticiper les ruptures et le réapprovisionnement."
    ];

    const textEl = document.getElementById('dynamicAdvisoryText');
    if (!textEl) return;

    // Set a single random advisory on page load/startup
    const randomIndex = Math.floor(Math.random() * advisories.length);
    textEl.textContent = advisories[randomIndex];
    textEl.style.opacity = 1;
}

// ============ INITIALISATION ============
function init() {
    // Load and Apply Custom Settings
    applyAppSettings();

    const savedTheme = localStorage.getItem('laboThemeV3') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    // Safety: Ensure all devices have a valid numeric id
    let hasChanged = false;
    devices.forEach((d, idx) => {
        if (d.id === undefined || d.id === null) {
            d.id = idx + 1;
            hasChanged = true;
        }
    });
    if (hasChanged) {
        localStorage.setItem('laboDevicesV3', JSON.stringify(devices));
    }

    createParticles();
    renderTable();
    renderPrintersTable();
    updateStats();
    updateFooterTime();
    updateStockCardCounts();
    updateDistributionStats();
    renderDistributionTable();
    updateBesoinsStats();
    renderBesoinsTable();
    renderEnvoisTable();
    
    // Set up Firebase Auth Observer
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("Firebase Auth User connected:", user.email);
            const localUser = { email: user.email };
            localStorage.setItem('laboCurrentUserV3', JSON.stringify(localUser));
            updateAuthUI();
            startFirestoreSync();
        } else {
            console.log("Firebase Auth User disconnected");
            localStorage.removeItem('laboCurrentUserV3');
            updateAuthUI();
            stopFirestoreSync();
        }
    });
    
    initDynamicAdvisory();
    setInterval(updateFooterTime, 30000);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then((reg) => {
                    console.log('[PWA] Service Worker registered with scope:', reg.scope);
                    
                    // Real-time Update Detection
                    reg.onupdatefound = () => {
                        const installingWorker = reg.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed') {
                                    if (navigator.serviceWorker.controller) {
                                        // New version is installed in the background!
                                        showToast("⚡ Nouvelle version disponible ! Rechargement en cours...", "green");
                                        setTimeout(() => {
                                            window.location.reload();
                                        }, 1200);
                                    }
                                }
                            };
                        }
                    };
                })
                .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
        });
    }
}

// Ø§Ø®ØªØµØ§Ø±Ø§Øª Ù„ÙˆØ­Ø© Ø§Ù„Ù…ÙØ§ØªÙŠØ­
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeAddModal();
        closeCustomInterventionModal();
        closeCustomConfirmModal();
        closeCustomLoginModal();
    }
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        showView('inventaireView');
        setTimeout(() => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
        }, 250);
    }
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openAddModal();
    }
});

// ============ SYSTEME DE NAVIGATION (SPA) ============
function showView(viewId) {
    const activeView = document.getElementById(viewId);
    if (!activeView) return;

    // Ø¥Ø®ÙØ§Ø¡ Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø§Øª
    document.querySelectorAll('.view-container').forEach(view => {
        view.classList.remove('view-active');
    });

    // Ø¥Ø¸Ù‡Ø§Ø± Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©
    activeView.classList.add('view-active');

    const mainTable = document.getElementById('mainTableWrapper');
    const dashboardMain = document.querySelector('#dashboardView .main-content');
    const inventaireTarget = document.getElementById('inventaireTableContainer');

    if (mainTable) {
        if (viewId === 'inventaireView') {
            if (inventaireTarget && !inventaireTarget.contains(mainTable)) {
                inventaireTarget.appendChild(mainTable);
            }
        } else {
            // Ø¥Ø±Ø¬Ø§Ø¹ Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ù„Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø¥Ø°Ø§ ØºØ§Ø¯Ø±Ù†Ø§ Ø§Ù„Ø¬Ø±Ø¯ (ÙÙ‚Ø· Ø¥Ø°Ø§ Ù„Ù… ÙŠÙƒÙ† ÙÙŠ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø£ØµÙ„Ø§Ù‹)
            if (dashboardMain && !dashboardMain.contains(mainTable)) {
                dashboardMain.appendChild(mainTable);
            }
        }
    }

    // Refresh distribution data when entering distribution view
    if (viewId === 'distributionView') {
        updateDistributionStats();
        renderDistributionTable();
    }

    // Refresh needs data when entering besoins view
    if (viewId === 'besoinsView') {
        updateBesoinsStats();
        renderBesoinsTable();
    }

    // Ø§Ù„ØªÙ…Ø±ÙŠØ± Ù„Ù„Ø£Ø¹Ù„Ù‰
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ FONCTIONS BIENVENUE ============
function enterSystem() {
    const screen = document.getElementById('welcomeScreen');
    const btn = screen.querySelector('.welcome-btn');

    // Effet clic
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
    btn.style.width = btn.offsetWidth + 'px';
    btn.style.pointerEvents = 'none';

    setTimeout(() => {
        screen.classList.add('hidden');
        showToast('👋 Bienvenue dans LABO-IT CONTROL', 'blue');
    }, 1200);
}

// ============ SYSTEME DE GESTION DES IMPRIMANTES DYNAMIQUE ============
function renderPrintersTable(data = printers) {
    const tbody = document.getElementById('printersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Ensure data is sorted descending (most recent first) chronologically
    if (data && Array.isArray(data)) {
        data.sort((a, b) => {
            const tA = a.lastUpdate ? (a.lastUpdate.seconds || (a.lastUpdate.toDate ? a.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            const tB = b.lastUpdate ? (b.lastUpdate.seconds || (b.lastUpdate.toDate ? b.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            if (tA !== tB) {
                return tB - tA;
            }
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            if (idA !== idB) return idB - idA;
            const dA = a.date || '';
            const dB = b.date || '';
            return dB.localeCompare(dA);
        });
    }

    // Save active dataset for pagination controls to paginate through
    window.currentPrintersData = data;

    // Slicing logic for pagination
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Bounds safety checks
    if (window.currentPrintersPage > totalPages) {
        window.currentPrintersPage = totalPages;
    }
    if (window.currentPrintersPage < 1) {
        window.currentPrintersPage = 1;
    }

    const startIndex = (window.currentPrintersPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = data.slice(startIndex, endIndex);

    pageData.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btn')) {
                showPrinterDetail(p.id);
            }
        };

        // Status badge styling
        let statusClass = 'status-maint';
        let statusStyle = 'padding:2px 10px; border-radius:10px; background: rgba(239, 68, 68, 0.1); color: #ef4444;';
        let statusText = 'Hors Ligne';

        if (p.status === 'Actif') {
            statusClass = 'status-active';
            statusStyle = 'padding:2px 10px; border-radius:10px;';
            statusText = 'En Ligne';
        } else if (p.status === 'Maintenance') {
            statusClass = 'status-maintenance';
            statusStyle = 'padding:2px 10px; border-radius:10px;';
            statusText = 'Maintenance';
        }

        safeSetHTML(tr, '<td style="font-weight: 600; color: var(--text-primary);"><i class="fas fa-print" style="margin-right: 0.5rem; color: var(--purple-500);"></i> ' + escapeHTML(p.model) + '</td>' +
            '<td>' + escapeHTML(p.location) + '</td>' +
            '<td><span class="' + escapeHTML(statusClass) + '" style="' + escapeHTML(statusStyle) + '">' + escapeHTML(statusText) + '</span></td>' +
            '<td>' + escapeHTML(p.date) + '</td>' +
            '<td>' +
            '<div class="action-btns" style="justify-content: center;">' +
            '<button class="action-btn" title="Modifier" onclick="editPrinter(\'' + escapeHTML(p.id) + '\', event)"><i class="fas fa-edit"></i></button>' +
            '<button class="action-btn delete" title="Supprimer" onclick="deletePrinter(\'' + escapeHTML(p.id) + '\', event)"><i class="fas fa-trash-alt"></i></button>' +
            '</div>' +
            '</td>');
        tbody.appendChild(tr);
    });

    renderPrintersPagination(totalItems, totalPages, window.currentPrintersPage);
}

function renderPrintersPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('printersPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, 'imprimantes', 'changePrintersPage');
    safeSetHTML(container, html);
}

function changePrintersPage(page) {
    window.currentPrintersPage = page;
    renderPrintersTable(window.currentPrintersData);
    
    const tableWrapper = document.getElementById('printersPagination');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.changePrintersPage = changePrintersPage;

function filterPrintersByStatus(status) {
    window.currentPrintersPage = 1;
    
    if (status === 'Total' || window.currentPrintersStatusFilter === status) {
        window.currentPrintersStatusFilter = null;
        updatePrinterFilterCardHighlight(null);
    } else {
        window.currentPrintersStatusFilter = status;
        updatePrinterFilterCardHighlight(status);
    }
    
    filterPrintersTable();
}
window.filterPrintersByStatus = filterPrintersByStatus;

function filterPrintersTable() {
    window.currentPrintersPage = 1; // Reset to page 1
    const queryEl = document.getElementById('printerSearchInput');
    const query = queryEl ? queryEl.value.toLowerCase() : '';
    let filtered = printers;
    
    if (window.currentPrintersStatusFilter) {
        filtered = filtered.filter(p => p.status === window.currentPrintersStatusFilter);
    }
    
    if (query) {
        filtered = filtered.filter(p =>
            (p.model && p.model.toLowerCase().includes(query)) ||
            (p.sn && p.sn.toLowerCase().includes(query)) ||
            (p.location && p.location.toLowerCase().includes(query)) ||
            (p.ip && p.ip.toLowerCase().includes(query)) ||
            (p.type && p.type.toLowerCase().includes(query))
        );
    }
    renderPrintersTable(filtered);
}
window.filterPrintersTable = filterPrintersTable;

function updatePrinterFilterCardHighlight(status) {
    const totalCard = document.querySelector('#imprimantesView .dist-card-total');
    const onlineCard = document.querySelector('#imprimantesView .printer-card-online');
    const maintCard = document.querySelector('#imprimantesView .dist-card-active');
    const offlineCard = document.querySelector('#imprimantesView .printer-card-offline');
    
    if (!totalCard || !onlineCard || !maintCard || !offlineCard) return;
    
    totalCard.style.transform = '';
    totalCard.style.boxShadow = '';
    onlineCard.style.transform = '';
    onlineCard.style.boxShadow = '';
    maintCard.style.transform = '';
    maintCard.style.boxShadow = '';
    offlineCard.style.transform = '';
    offlineCard.style.boxShadow = '';
    
    if (!status) {
        totalCard.style.transform = 'translateY(-3px)';
        totalCard.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.15), 0 0 20px rgba(59, 130, 246, 0.08)';
    } else if (status === 'Actif') {
        onlineCard.style.transform = 'translateY(-3px)';
        onlineCard.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.15), 0 0 20px rgba(16, 185, 129, 0.08)';
    } else if (status === 'Maintenance') {
        maintCard.style.transform = 'translateY(-3px)';
        maintCard.style.boxShadow = '0 12px 30px rgba(245, 158, 11, 0.15), 0 0 20px rgba(245, 158, 11, 0.06)';
    } else if (status === 'Hors Ligne') {
        offlineCard.style.transform = 'translateY(-3px)';
        offlineCard.style.boxShadow = '0 12px 30px rgba(239, 68, 68, 0.15), 0 0 20px rgba(239, 68, 68, 0.08)';
    }
}

function addPrinter() {
    const model = document.getElementById('addPrnModel').value.trim();
    const sn = document.getElementById('addPrnSN').value.trim();
    const type = document.getElementById('addPrnType').value;
    const location = document.getElementById('addPrnLocation').value.trim();
    const ip = document.getElementById('addPrnIP').value.trim();
    const connexion = document.getElementById('addPrnConnexion').value;

    // Map the selected option in status select to internal status
    const statusVal = document.getElementById('addPrnStatus').value;
    let status = 'Actif';
    if (statusVal.includes('Panne') || statusVal.includes('Hors')) {
        status = 'Hors Ligne';
    } else if (statusVal.includes('Maintenance')) {
        status = 'Maintenance';
    }

    if (!model || !location) {
        showToast('⚠️ Veuillez remplir au moins le modèle et l\'emplacement', 'red');
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    const printerData = {
        model,
        sn: sn || 'N/A',
        type,
        location,
        ip: ip || 'N/A',
        connexion,
        status,
        date: new Date().toLocaleDateString('fr-FR'),
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("itPrinters").add(printerData)
        .then(() => {
            logActivity('IMPRIMANTES', 'AJOUT_PRN', `Nouvelle imprimante: ${model} (${sn})`);
            showToast('🖨️ Imprimante ajoutée avec succès sur Firebase !', 'green');
            showView('imprimantesView');
            
            // Clear input fields
            document.getElementById('addPrnModel').value = '';
            document.getElementById('addPrnSN').value = '';
            document.getElementById('addPrnLocation').value = '';
            document.getElementById('addPrnIP').value = '';
        })
        .catch(error => {
            console.error("Firestore printer add error:", error);
            showToast('❌ Échec de l\'ajout de l\'imprimante', 'red');
        });
}

function openNewPrinterForm() {
    editPrinterCameFromDetail = false;
    const backBtn = document.querySelector('#printerFormView .back-btn');
    if (backBtn) {
        backBtn.title = "Retour aux Imprimantes";
        backBtn.setAttribute('aria-label', "Retour aux Imprimantes");
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    }
    // Reset titles
    document.getElementById('prnFormTitle').innerText = 'Nouvelle Imprimante';
    document.getElementById('prnFormDesc').innerText = 'Ajouter une imprimante au parc d\'impression.';

    // Reset inputs
    document.getElementById('addPrnModel').value = '';
    document.getElementById('addPrnSN').value = '';
    document.getElementById('addPrnType').value = 'Laser (Monochrome)';
    document.getElementById('addPrnLocation').value = '';
    document.getElementById('addPrnIP').value = '';
    document.getElementById('addPrnConnexion').value = 'Réseau (Ethernet/WiFi)';
    document.getElementById('addPrnStatus').value = 'En Ligne (Actif)';

    // Reset button
    const saveBtn = document.getElementById('savePrnBtn');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
    saveBtn.onclick = addPrinter;

    showView('printerFormView');
}

function deletePrinter(id, event) {
    if (event) event.stopPropagation();

    showCustomConfirm(
        "Supprimer l'Imprimante",
        "Voulez-vous vraiment supprimer définitivement cette imprimante ? Toutes ses données associées seront perdues. Cette action est irréversible.",
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itPrinters").doc(String(id)).delete()
                .then(() => {
                    logActivity('IMPRIMANTES', 'SUPPRESSION', `Imprimante supprimée: ${id}`);
                    showToast('🗑️ Imprimante supprimée de Firebase', 'blue');
                    if (activePrinterId === id) {
                        activePrinterId = null;
                    }
                })
                .catch(error => {
                    console.error("Firestore printer delete error:", error);
                    showToast('❌ Échec de la suppression sur Firebase', 'red');
                });
        },
        null,
        true // delete style
    );
}

function closePrinterForm() {
    if (editPrinterCameFromDetail && activePrinterId) {
        showPrinterDetail(activePrinterId);
        editPrinterCameFromDetail = false;
    } else {
        showView('imprimantesView');
    }
}

function editPrinter(id, event) {
    if (event) event.stopPropagation();
    const p = printers.find(prn => prn.id === id);
    if (!p) return;

    editPrinterCameFromDetail = document.getElementById('printerDetailView').classList.contains('view-active');
    activePrinterId = id;

    const backBtn = document.querySelector('#printerFormView .back-btn');
    if (backBtn) {
        if (editPrinterCameFromDetail) {
            backBtn.title = "Retour à la Fiche Imprimante";
            backBtn.setAttribute('aria-label', "Retour à la Fiche Imprimante");
        } else {
            backBtn.title = "Retour aux Imprimantes";
            backBtn.setAttribute('aria-label', "Retour aux Imprimantes");
        }
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    }

    document.getElementById('prnFormTitle').innerText = 'Modifier l\'Imprimante';
    document.getElementById('prnFormDesc').innerText = 'Modifier les détails de l\'imprimante sélectionnée.';

    document.getElementById('addPrnModel').value = p.model || '';
    document.getElementById('addPrnSN').value = p.sn || '';
    document.getElementById('addPrnType').value = p.type || 'Laser (Monochrome)';
    document.getElementById('addPrnLocation').value = p.location || '';
    document.getElementById('addPrnIP').value = p.ip || '';
    document.getElementById('addPrnConnexion').value = p.connexion || 'Réseau (Ethernet/WiFi)';

    // Map internal status back to dropdown options
    if (p.status === 'Actif') {
        document.getElementById('addPrnStatus').value = 'En Ligne (Actif)';
    } else if (p.status === 'Hors Ligne') {
        document.getElementById('addPrnStatus').value = 'Hors Ligne (Panne)';
    } else if (p.status === 'Maintenance') {
        document.getElementById('addPrnStatus').value = 'En Maintenance';
    }

    showView('printerFormView');

    const saveBtn = document.getElementById('savePrnBtn');
    saveBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Mettre à jour';
    saveBtn.onclick = function () {
        const model = document.getElementById('addPrnModel').value.trim();
        const sn = document.getElementById('addPrnSN').value.trim();
        const type = document.getElementById('addPrnType').value;
        const location = document.getElementById('addPrnLocation').value.trim();
        const ip = document.getElementById('addPrnIP').value.trim();
        const connexion = document.getElementById('addPrnConnexion').value;

        const statusVal = document.getElementById('addPrnStatus').value;
        let status = 'Actif';
        if (statusVal.includes('Panne') || statusVal.includes('Hors')) {
            status = 'Hors Ligne';
        } else if (statusVal.includes('Maintenance')) {
            status = 'Maintenance';
        }

        if (!model || !location) {
            showToast('⚠️ Veuillez remplir au moins le modèle et l\'emplacement', 'red');
            return;
        }

        if (!auth.currentUser) {
            showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
            return;
        }

        const printerData = {
            model,
            sn: sn || 'N/A',
            type,
            location,
            ip: ip || 'N/A',
            connexion,
            status,
            interventions: p.interventions || [],
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection("itPrinters").doc(String(p.id)).set(printerData, { merge: true })
            .then(() => {
                logActivity('IMPRIMANTES', 'MODIF_AJOUT', `Imprimante mise à jour: ${model} (${sn})`);
                showToast('🖨️ Imprimante mise à jour sur Firebase !', 'green');
                closePrinterForm();
            })
            .catch(error => {
                console.error("Firestore printer edit error:", error);
                showToast('❌ Échec de la modification sur Firebase', 'red');
            });
    };
}

let activePrinterId = null;
let editPrinterCameFromDetail = false;

function showPrinterDetail(id) {
    const p = printers.find(prn => prn.id === id);
    if (!p) return;
    activePrinterId = id;

    // Populate printer hero card elements
    document.getElementById('prnDetailPageModelName').textContent = p.model;
    document.getElementById('prnDetailPageSN').textContent = p.sn || 'N/A';
    document.getElementById('prnDetailPageIP').textContent = p.ip || 'N/A';

    // Populate printer specs detailed card elements
    document.getElementById('prnDetailPageSpecModel').textContent = p.model;
    document.getElementById('prnDetailPageSpecType').textContent = p.type || 'Laser (Monochrome)';
    document.getElementById('prnDetailPageSpecConnexion').textContent = p.connexion || 'Réseau (Ethernet/WiFi)';

    // Populate printer emplacement and status elements
    const prnLocationEl = document.getElementById('prnDetailPageSpecLocation');
    if (prnLocationEl) prnLocationEl.textContent = p.location || 'N/A';

    const prnDateEl = document.getElementById('prnDetailPageSpecDate');
    if (prnDateEl) prnDateEl.textContent = p.date || 'N/A';

    // Status badge styling
    const statusEl = document.getElementById('prnDetailPageStatus');
    statusEl.className = 'hero-status-pill';
    if (p.status === 'Actif') {
        statusEl.classList.add('status-active');
        statusEl.innerHTML = '<span class="status-dot"></span> En Ligne';
    } else if (p.status === 'Maintenance') {
        statusEl.classList.add('status-maintenance');
        statusEl.innerHTML = '<span class="status-dot"></span> En Maintenance';
    } else {
        statusEl.classList.add('status-inactive');
        statusEl.innerHTML = '<span class="status-dot" style="background: #ef4444;"></span> Hors Ligne';
    }

    // Render interventions in sidebar
    renderPrinterDetailInterventions(p);

    // Switch view to printerDetailView
    showView('printerDetailView');
}

function renderPrinterDetailInterventions(p) {
    const prnInterventionsEl = document.getElementById('prnDetailPageInterventions');
    if (prnInterventionsEl) {
        prnInterventionsEl.innerHTML = '';
        const list = p.interventions || [];
        if (list.length === 0) {
            prnInterventionsEl.innerHTML = '<span class="detail-empty-intervention">Aucune intervention.</span>';
        } else {
            list.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'intervention-item-card theme-amber';
                safeSetHTML(div, '<div class="intervention-item-header">' +
                    '<span class="intervention-item-type"><i class="fas fa-tools" style="font-size: 0.75rem;"></i> ' + escapeHTML(item.type) + '</span>' +
                    '<div class="intervention-item-actions">' +
                    '<span class="intervention-item-date">' + escapeHTML(item.date) + '</span>' +
                    '<i class="fas fa-edit" title="Modifier" onclick="editIntervention(' + escapeHTML(idx) + ', \'printer\', event)"></i>' +
                    '<i class="fas fa-trash-alt" title="Supprimer" onclick="deleteIntervention(' + escapeHTML(idx) + ', \'printer\', event)"></i>' +
                    '</div>' +
                    '</div>' +
                    '<div class="intervention-item-desc">' + escapeHTML(item.desc) + '</div>' +
                    '<div class="intervention-item-tech">Par: ' + escapeHTML(item.tech) + '</div>');
                prnInterventionsEl.appendChild(div);
            });
        }
    }
}

let activeInterventionTarget = null; // 'device' or 'printer'
let editingInterventionIndex = null;

function toggleCustomInterventionType() {
    const selectEl = document.getElementById('custIntType');
    const customTypeContainer = document.getElementById('custIntCustomTypeContainer');
    if (selectEl.value === 'Autre') {
        customTypeContainer.style.display = 'block';
        document.getElementById('custIntCustomType').focus();
    } else {
        customTypeContainer.style.display = 'none';
    }
}

function openPrinterInterventionModal() {
    if (activePrinterId === null) return;
    activeInterventionTarget = 'printer';
    editingInterventionIndex = null;

    // Set modal style color theme (Orange-Red for printers)
    document.getElementById('customInterventionTitle').style.backgroundImage = 'var(--gradient-orange-red)';
    document.getElementById('customInterventionTitle').innerHTML = '<i class="fas fa-tools" style="color: var(--amber-500);"></i> Déclarer une Intervention';
    document.getElementById('custIntSaveBtn').style.background = 'var(--gradient-pink-orange)';
    document.getElementById('custIntSaveBtn').innerHTML = '<i class="fas fa-save"></i> Enregistrer';

    // Clear inputs
    document.getElementById('custIntType').value = 'Maintenance';
    document.getElementById('custIntCustomType').value = '';
    document.getElementById('custIntCustomTypeContainer').style.display = 'none';
    document.getElementById('custIntDesc').value = '';
    document.getElementById('custIntTech').value = 'Ali S.';

    // Show modal overlay
    document.getElementById('customInterventionOverlay').classList.add('active');
}

function closeCustomInterventionModal() {
    document.getElementById('customInterventionOverlay').classList.remove('active');
}

function closeCustomInterventionModalOuter(event) {
    if (event.target === document.getElementById('customInterventionOverlay')) {
        closeCustomInterventionModal();
    }
}

function editIntervention(index, target, event) {
    if (event) event.stopPropagation();
    editingInterventionIndex = index;
    activeInterventionTarget = target;

    let item = null;
    if (target === 'printer') {
        const p = printers.find(prn => prn.id === activePrinterId);
        if (p && p.interventions) item = safeGetIndex(p.interventions, index);

        // Color Theme
        document.getElementById('customInterventionTitle').style.backgroundImage = 'var(--gradient-orange-red)';
        document.getElementById('custIntSaveBtn').style.background = 'var(--gradient-pink-orange)';
    } else if (target === 'device') {
        const d = devices.find(dev => dev.id === activeDeviceId);
        if (d && d.interventions) item = safeGetIndex(d.interventions, index);

        // Color Theme
        document.getElementById('customInterventionTitle').style.backgroundImage = 'var(--gradient-blue-purple)';
        document.getElementById('custIntSaveBtn').style.background = 'var(--gradient-blue-purple)';
    }

    if (!item) return;

    // Set title & button text
    document.getElementById('customInterventionTitle').innerHTML = '<i class="fas fa-edit" style="color: var(--indigo-500);"></i> Modifier l\'Intervention';
    document.getElementById('custIntSaveBtn').innerHTML = '<i class="fas fa-save"></i> Mettre à jour';

    // Check standard types in select
    const standardTypes = ['Maintenance', 'Réparation', 'Remplacement', 'Installation', 'Nettoyage', 'Diagnostic'];
    const selectEl = document.getElementById('custIntType');
    const customTypeContainer = document.getElementById('custIntCustomTypeContainer');
    const customInput = document.getElementById('custIntCustomType');

    if (standardTypes.includes(item.type)) {
        selectEl.value = item.type;
        customTypeContainer.style.display = 'none';
        customInput.value = '';
    } else {
        selectEl.value = 'Autre';
        customTypeContainer.style.display = 'block';
        customInput.value = item.type;
    }

    document.getElementById('custIntDesc').value = item.desc;
    document.getElementById('custIntTech').value = item.tech;

    // Show modal overlay
    document.getElementById('customInterventionOverlay').classList.add('active');
}

let activeConfirmCleanup = null;

function closeCustomConfirmModal() {
    document.getElementById('customConfirmOverlay').classList.remove('active');
    if (typeof activeConfirmCleanup === 'function') {
        activeConfirmCleanup();
        activeConfirmCleanup = null;
    }
}

function closeCustomConfirmModalOuter(event) {
    if (event.target === document.getElementById('customConfirmOverlay')) {
        closeCustomConfirmModal();
    }
}

function showCustomConfirm(title, desc, onConfirm, onCancel = null, styleType = true) {
    // Clean up any existing listeners/modals first
    closeCustomConfirmModal();

    const overlay = document.getElementById('customConfirmOverlay');
    const titleEl = document.getElementById('customConfirmTitle');
    const descEl = document.getElementById('customConfirmDesc');
    const yesBtn = document.getElementById('customConfirmYesBtn');
    const iconContainer = document.getElementById('customConfirmIconContainer');
    const iconEl = document.getElementById('customConfirmIcon');
    
    if (!overlay || !titleEl || !descEl || !yesBtn) return;

    titleEl.textContent = title;
    descEl.textContent = desc;

    // Normalize styleType into: delete, confirm, warning
    let type = 'delete';
    if (styleType === false || styleType === 'success' || styleType === 'confirm') {
        type = 'confirm';
    } else if (styleType === 'warning') {
        type = 'warning';
    } else {
        type = 'delete';
    }

    // Apply specific theme color and icons
    if (type === 'delete') {
        yesBtn.style.background = 'var(--gradient-orange-red)';
        yesBtn.textContent = 'Supprimer';
        if (iconContainer) {
            iconContainer.style.background = 'rgba(239, 68, 68, 0.1)';
            iconContainer.style.color = '#ef4444';
        }
        if (iconEl) {
            iconEl.className = 'fas fa-exclamation-triangle';
        }
    } else if (type === 'confirm') {
        yesBtn.style.background = 'var(--gradient-blue-cyan)';
        yesBtn.textContent = 'Confirmer';
        if (iconContainer) {
            iconContainer.style.background = 'rgba(16, 185, 129, 0.1)';
            iconContainer.style.color = '#10b981';
        }
        if (iconEl) {
            iconEl.className = 'fas fa-check-circle';
        }
    } else if (type === 'warning') {
        yesBtn.style.background = 'var(--gradient-amber-gold)';
        yesBtn.textContent = 'Confirmer';
        if (iconContainer) {
            iconContainer.style.background = 'rgba(245, 158, 11, 0.1)';
            iconContainer.style.color = '#f59e0b';
        }
        if (iconEl) {
            iconEl.className = 'fas fa-exclamation-circle';
        }
    }

    yesBtn.onclick = function () {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
        closeCustomConfirmModal();
    };

    overlay.classList.add('active');

    // Premium keyboard listeners
    const handleKeydown = function(e) {
        if (e.key === 'Escape') {
            closeCustomConfirmModal();
            if (typeof onCancel === 'function') onCancel();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
            closeCustomConfirmModal();
        }
    };

    activeConfirmCleanup = function() {
        window.removeEventListener('keydown', handleKeydown);
    };

    window.addEventListener('keydown', handleKeydown);
}

// Make globally available
window.showCustomConfirm = showCustomConfirm;

function deleteIntervention(index, target, event) {
    if (event) event.stopPropagation();

    showCustomConfirm(
        "Supprimer l'Intervention",
        "Voulez-vous vraiment supprimer définitivement cette intervention ? Cette action est irréversible.",
        function () {
            if (target === 'printer') {
                const p = printers.find(prn => prn.id === activePrinterId);
                if (p && p.interventions) {
                    p.interventions.splice(index, 1);
                    savePrinters();
                    renderPrinterDetailInterventions(p);
                    showToast('🗑️ Intervention supprimée avec succès', 'blue');
                }
            } else if (target === 'device') {
                const d = devices.find(dev => dev.id === activeDeviceId);
                if (d && d.interventions) {
                    d.interventions.splice(index, 1);
                    saveDevices();
                    renderDeviceDetailInterventions(d);
                    showToast('🗑️ Intervention supprimée avec succès', 'blue');
                }
            }
        },
        null,
        true // delete style
    );
}

function saveCustomIntervention() {
    let type = document.getElementById('custIntType').value;
    const desc = document.getElementById('custIntDesc').value.trim();
    const tech = document.getElementById('custIntTech').value.trim();

    if (type === 'Autre') {
        const customVal = document.getElementById('custIntCustomType').value.trim();
        if (!customVal) {
            showToast('⚠️ Veuillez spécifier le type d\'intervention personnalisé', 'red');
            return;
        }
        type = customVal;
    }

    if (!desc) {
        showToast('⚠️ Veuillez entrer une description pour l\'intervention', 'red');
        return;
    }

    const todayStr = new Date().toLocaleDateString('fr-FR');

    if (editingInterventionIndex !== null) {
        // UPDATE MODE
        if (activeInterventionTarget === 'printer') {
            const p = printers.find(prn => prn.id === activePrinterId);
            if (p && p.interventions) {
                p.interventions[editingInterventionIndex].type = type;
                p.interventions[editingInterventionIndex].desc = desc;
                p.interventions[editingInterventionIndex].tech = tech || 'Ali S.';
                savePrinters();
                renderPrinterDetailInterventions(p);
            }
        } else if (activeInterventionTarget === 'device') {
            const d = devices.find(dev => dev.id === activeDeviceId);
            if (d && d.interventions) {
                d.interventions[editingInterventionIndex].type = type;
                d.interventions[editingInterventionIndex].desc = desc;
                d.interventions[editingInterventionIndex].tech = tech || 'Ali S.';
                saveDevices();
                renderDeviceDetailInterventions(d);
            }
        }
        editingInterventionIndex = null;
        closeCustomInterventionModal();
        showToast('📝 Intervention mise à jour avec succès !', 'green');
    } else {
        // CREATE MODE
        const newInt = {
            date: todayStr,
            type: type,
            desc: desc,
            tech: tech || 'Ali S.'
        };

        if (activeInterventionTarget === 'printer') {
            const p = printers.find(prn => prn.id === activePrinterId);
            if (p) {
                if (!p.interventions) p.interventions = [];
                p.interventions.unshift(newInt);
                p.date = todayStr; // Update Last Maintenance date
                const prnDateEl = document.getElementById('prnDetailPageSpecDate');
                if (prnDateEl) prnDateEl.textContent = todayStr;
                savePrinters();
                renderPrinterDetailInterventions(p);
            }
        } else if (activeInterventionTarget === 'device') {
            const d = devices.find(dev => dev.id === activeDeviceId);
            if (d) {
                if (!d.interventions) d.interventions = [];
                d.interventions.unshift(newInt);
                saveDevices();
                renderDeviceDetailInterventions(d);
            }
        }
        closeCustomInterventionModal();
        showToast('🔧 Intervention enregistrée avec succès !', 'green');
    }
}

// ============ GESTION DYNAMIQUE DU STOCK ============
let stockItems = JSON.parse(localStorage.getItem('laboStockItemsV3')) || defaultStock;

let editingStockItemId = null;
let currentCategoryFilter = '';

function saveStock() {
    localStorage.setItem('laboStockItemsV3', JSON.stringify(stockItems));
    updateStockCardCounts();
    updateStats(); // Force refresh top cards row (En Stock)
    updateDashboardAnalytics();
    if (currentCategoryFilter) {
        renderStockCategoryTable();
    }
}

function updateStockCardCounts() {
    const categories = [
        { name: 'RAM & SSD', id: 'stockCount_RAM_SSD', unit: 'unités' },
        { name: 'Périphériques', id: 'stockCount_Peripheriques', unit: 'unités' },
        { name: 'Câblage & Réseau', id: 'stockCount_Cablage_Reseau', unit: 'mètres' },
        { name: 'Écrans & Moniteurs', id: 'stockCount_Ecrans_Moniteurs', unit: 'unités' },
        { name: 'PC Portables (Laptops)', id: 'stockCount_PC_Portables', unit: 'unités' },
        { name: 'PC Bureau (Desktops)', id: 'stockCount_PC_Bureau', unit: 'unités' },
        { name: 'Accessoires Divers', id: 'stockCount_Accessoires_Divers', unit: 'unités' }
    ];

    categories.forEach(cat => {
        const totalQty = stockItems
            .filter(item => item.category === cat.name)
            .reduce((sum, item) => sum + parseInt(item.qty || 0), 0);

        const el = document.getElementById(cat.id);
        if (el) {
            el.textContent = `${totalQty} ${cat.unit} disponibles`;
        }
    });
}

function getCategoryIcon(cat) {
    switch (cat) {
        case 'RAM & SSD': return 'fas fa-memory';
        case 'Périphériques': return 'fas fa-mouse';
        case 'Câblage & Réseau': return 'fas fa-network-wired';
        case 'Écrans & Moniteurs': return 'fas fa-desktop';
        case 'PC Portables (Laptops)': return 'fas fa-laptop';
        case 'PC Bureau (Desktops)': return 'fas fa-server';
        case 'Accessoires Divers': return 'fas fa-keyboard';
        default: return 'fas fa-box';
    }
}

function getCategorySub(cat) {
    switch (cat) {
        case 'RAM & SSD': return 'Inventaire des disques durs SSD, barrettes de RAM et cartes de stockage.';
        case 'Périphériques': return 'Inventaire des souris, claviers, webcams et autres périphériques externes.';
        case 'Câblage & Réseau': return 'Inventaire des câbles RJ45, switchs, routeurs et connecteurs réseau.';
        case 'Écrans & Moniteurs': return 'Inventaire des moniteurs externes, projecteurs et dalles d\'affichage.';
        case 'PC Portables (Laptops)': return 'Inventaire des ordinateurs portables de rechange ou prêts à être affectés.';
        case 'PC Bureau (Desktops)': return 'Inventaire des unités centrales de bureau en réserve ou disponibles.';
        case 'Accessoires Divers': return 'Inventaire des adaptateurs, clés USB, chargeurs et câbles divers.';
        default: return 'Gestion de stock par catégorie.';
    }
}

function openCategoryDetail(categoryName) {
    currentCategoryFilter = categoryName;

    // Reset search input if exists
    const searchInput = document.getElementById('stockSearchInput');
    if (searchInput) searchInput.value = '';

    // Mettre à jour l'icône, le titre et le sous-titre de la vue détaillée
    const titleEl = document.getElementById('catDetailTitle');
    const subEl = document.getElementById('catDetailSub');
    const iconEl = document.getElementById('catDetailIcon');
    const tableTitleEl = document.getElementById('catTableTitle');

    if (titleEl) titleEl.textContent = categoryName;
    if (subEl) subEl.textContent = getCategorySub(categoryName);
    if (tableTitleEl) tableTitleEl.textContent = 'Articles enregistrés (' + categoryName + ')';

    if (iconEl) {
        iconEl.innerHTML = '';
        const iconI = document.createElement('i');
        iconI.className = getCategoryIcon(categoryName);
        iconEl.appendChild(iconI);

        const colors = {
            'RAM & SSD': 'var(--gradient-cyan-blue)',
            'Périphériques': 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
            'Câblage & Réseau': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            'Écrans & Moniteurs': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            'PC Portables (Laptops)': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            'PC Bureau (Desktops)': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            'Accessoires Divers': 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
        };
        iconEl.style.background = safeGet(colors, categoryName, 'var(--gradient-cyan-blue)');
    }

    renderStockCategoryTable();
    showView('stockCategoryDetailView');
}

function renderStockCategoryTable(data = null) {
    const tbody = document.getElementById('stockCategoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    // Get full category items
    const catItems = stockItems.filter(item => item.category === currentCategoryFilter);

    // Calculate and animate stats (only for the active category)
    const threshold = parseInt(appSettings.stockThreshold || 5);
    const enStockCount = catItems.filter(item => parseInt(item.qty || 0) > 0).length;
    const alerteCount = catItems.filter(item => { const q = parseInt(item.qty || 0); return q > 0 && q <= threshold; }).length;
    const ruptureCount = catItems.filter(item => parseInt(item.qty || 0) === 0).length;

    smoothAnimate('stockCatTotalCount', catItems.length);
    smoothAnimate('stockCatEnStockCount', enStockCount);
    smoothAnimate('stockCatAlerteCount', alerteCount);
    smoothAnimate('stockCatRuptureCount', ruptureCount);

    // Use passed data (filtered) or fallback to full category items
    let displayItems = data || catItems;

    // Apply status filter if active
    if (!data && window.currentStockCategoryStatusFilter) {
        if (window.currentStockCategoryStatusFilter === 'En Stock') {
            displayItems = displayItems.filter(item => parseInt(item.qty || 0) > 0);
        } else if (window.currentStockCategoryStatusFilter === 'Alerte') {
            displayItems = displayItems.filter(item => { const q = parseInt(item.qty || 0); return q > 0 && q <= threshold; });
        } else if (window.currentStockCategoryStatusFilter === 'Rupture') {
            displayItems = displayItems.filter(item => parseInt(item.qty || 0) === 0);
        }
    }

    // Ensure displayItems is always sorted descending by ID (most recent first) globally
    if (displayItems && Array.isArray(displayItems)) {
        displayItems.sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            if (idA !== idB) return idB - idA;
            const dA = a.date || '';
            const dB = b.date || '';
            return dB.localeCompare(dA);
        });
    }

    // Save active dataset for pagination controls
    window.currentStockCategoryData = displayItems;

    const totalItems = displayItems.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Bounds safety checks
    if (window.currentStockCategoryPage > totalPages) {
        window.currentStockCategoryPage = totalPages;
    }
    if (window.currentStockCategoryPage < 1) {
        window.currentStockCategoryPage = 1;
    }

    const startIndex = (window.currentStockCategoryPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = displayItems.slice(startIndex, endIndex);

    if (totalItems === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 9;
        td.style.textAlign = 'center';
        td.style.padding = '3rem';
        td.style.color = 'var(--text-secondary)';
        td.innerHTML = '<i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i> Aucun article disponible.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        
        renderStockCategoryPagination(0, 1, 1);
        return;
    }

    pageData.forEach(item => {
        const tr = document.createElement('tr');
        const qty = parseInt(item.qty || 0);

        const tdName = document.createElement('td');
        tdName.style.fontWeight = '700';
        tdName.style.color = 'var(--text-primary)';
        tdName.textContent = item.name || 'N/A';

        const tdRef = document.createElement('td');
        tdRef.style.fontFamily = 'monospace';
        tdRef.style.fontWeight = '600';
        tdRef.style.color = 'var(--blue-500)';
        tdRef.textContent = item.ref || 'N/A';

        const tdQty = document.createElement('td');
        tdQty.style.textAlign = 'center';
        const qtySpan = document.createElement('span');
        qtySpan.style.padding = '4px 10px';
        qtySpan.style.borderRadius = '12px';
        qtySpan.style.fontWeight = '800';
        qtySpan.style.fontSize = '12.5px';

        if (qty === 0) {
            qtySpan.style.background = 'rgba(239, 68, 68, 0.15)';
            qtySpan.style.color = '#ef4444';
            qtySpan.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            qtySpan.style.display = 'inline-flex';
            qtySpan.style.alignItems = 'center';
            qtySpan.style.gap = '4px';
            qtySpan.textContent = '';
            const icon = document.createElement('i');
            icon.className = 'fas fa-exclamation-circle';
            qtySpan.appendChild(icon);
            qtySpan.appendChild(document.createTextNode(' Épuisé'));
        } else if (qty > 0 && qty <= parseInt(appSettings.stockThreshold || 5)) {
            qtySpan.style.background = 'rgba(16, 185, 129, 0.15)';
            qtySpan.style.color = '#10b981';
            qtySpan.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            qtySpan.style.display = 'inline-flex';
            qtySpan.style.alignItems = 'center';
            qtySpan.style.gap = '4px';
            qtySpan.textContent = '';
            const icon = document.createElement('i');
            icon.className = 'fas fa-exclamation-triangle';
            qtySpan.appendChild(icon);
            qtySpan.appendChild(document.createTextNode(' Alerte (' + qty + ')'));
        } else {
            qtySpan.style.background = 'rgba(16, 185, 129, 0.15)';
            qtySpan.style.color = '#10b981';
            qtySpan.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            qtySpan.textContent = String(qty);
        }
        qtySpan.textContent = String(qty);
        tdQty.appendChild(qtySpan);

        const tdLoc = document.createElement('td');
        const locIcon = document.createElement('i');
        locIcon.className = 'fas fa-map-marker-alt';
        locIcon.style.color = 'var(--text-secondary)';
        locIcon.style.marginRight = '5px';
        tdLoc.appendChild(locIcon);
        tdLoc.appendChild(document.createTextNode(' ' + (item.location || 'N/A')));

        const tdDate = document.createElement('td');
        tdDate.textContent = item.date ? new Date(item.date).toLocaleDateString('fr-FR') : 'N/A';

        const tdNotes = document.createElement('td');
        tdNotes.style.fontSize = '12.5px';
        tdNotes.style.maxWidth = '200px';
        tdNotes.style.overflow = 'hidden';
        tdNotes.style.textOverflow = 'ellipsis';
        tdNotes.style.whiteSpace = 'nowrap';
        tdNotes.title = item.notes || '';
        tdNotes.textContent = item.notes || '—';

        const tdActions = document.createElement('td');
        tdActions.style.textAlign = 'center';

        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-btns';
        actionDiv.style.justifyContent = 'center';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'action-btn';
        btnEdit.title = 'Modifier';
        btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
        btnEdit.onclick = function () { editStockItem(item.id); };

        const btnDelete = document.createElement('button');
        btnDelete.className = 'action-btn delete';
        btnDelete.title = 'Supprimer';
        btnDelete.innerHTML = '<i class="fas fa-trash-alt"></i>';
        btnDelete.onclick = function () { deleteStockItem(item.id); };

        actionDiv.appendChild(btnEdit);
        actionDiv.appendChild(btnDelete);
        tdActions.appendChild(actionDiv);

        tr.appendChild(tdName);
        tr.appendChild(tdRef);
        tr.appendChild(tdQty);
        tr.appendChild(tdLoc);
        tr.appendChild(tdDate);
        tr.appendChild(tdNotes);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });

    renderStockCategoryPagination(totalItems, totalPages, window.currentStockCategoryPage);
}

function renderStockCategoryPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('stockCategoryPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, 'articles', 'changeStockCategoryPage');
    safeSetHTML(container, html);
}

function changeStockCategoryPage(page) {
    window.currentStockCategoryPage = page;
    renderStockCategoryTable(window.currentStockCategoryData);
    
    const tableWrapper = document.getElementById('stockCategoryPagination');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.changeStockCategoryPage = changeStockCategoryPage;

function filterStockCatByStatus(status) {
    window.currentStockCategoryPage = 1;
    
    if (status === 'Total' || window.currentStockCategoryStatusFilter === status) {
        window.currentStockCategoryStatusFilter = null;
        updateStockCatFilterCardHighlight(null);
    } else {
        window.currentStockCategoryStatusFilter = status;
        updateStockCatFilterCardHighlight(status);
    }
    
    filterStockTable();
}
window.filterStockCatByStatus = filterStockCatByStatus;

function filterStockTable() {
    window.currentStockCategoryPage = 1; // Reset to page 1
    const queryEl = document.getElementById('stockSearchInput');
    const query = queryEl ? queryEl.value.toLowerCase() : '';
    
    // Get full category items
    let filtered = stockItems.filter(item => item.category === currentCategoryFilter);
    
    // Apply status filter if active
    const threshold = parseInt(appSettings.stockThreshold || 5);
    if (window.currentStockCategoryStatusFilter) {
        if (window.currentStockCategoryStatusFilter === 'En Stock') {
            filtered = filtered.filter(item => parseInt(item.qty || 0) > 0);
        } else if (window.currentStockCategoryStatusFilter === 'Alerte') {
            filtered = filtered.filter(item => { const q = parseInt(item.qty || 0); return q > 0 && q <= threshold; });
        } else if (window.currentStockCategoryStatusFilter === 'Rupture') {
            filtered = filtered.filter(item => parseInt(item.qty || 0) === 0);
        }
    }
    
    // Apply search query
    if (query) {
        filtered = filtered.filter(item =>
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.ref && item.ref.toLowerCase().includes(query)) ||
            (item.location && item.location.toLowerCase().includes(query)) ||
            (item.notes && item.notes.toLowerCase().includes(query))
        );
    }
    
    renderStockCategoryTable(filtered);
}
window.filterStockTable = filterStockTable;

function updateStockCatFilterCardHighlight(status) {
    const totalCard = document.querySelector('#stockCategoryDetailView .dist-card-total');
    const enStockCard = document.querySelector('#stockCategoryDetailView .dist-card-returned');
    const alerteCard = document.querySelector('#stockCategoryDetailView .dist-card-active');
    const ruptureCard = document.querySelector('#stockCategoryDetailView .printer-card-offline');
    
    if (!totalCard || !enStockCard || !ruptureCard) return;
    
    totalCard.style.transform = '';
    totalCard.style.boxShadow = '';
    enStockCard.style.transform = '';
    enStockCard.style.boxShadow = '';
    if (alerteCard) {
        alerteCard.style.transform = '';
        alerteCard.style.boxShadow = '';
    }
    ruptureCard.style.transform = '';
    ruptureCard.style.boxShadow = '';
    
    if (!status) {
        totalCard.style.transform = 'translateY(-3px)';
        totalCard.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.15), 0 0 20px rgba(59, 130, 246, 0.08)';
    } else if (status === 'En Stock') {
        enStockCard.style.transform = 'translateY(-3px)';
        enStockCard.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.15), 0 0 20px rgba(16, 185, 129, 0.08)';
    } else if (status === 'Alerte' && alerteCard) {
        alerteCard.style.transform = 'translateY(-3px)';
        alerteCard.style.boxShadow = '0 12px 30px rgba(245, 158, 11, 0.15), 0 0 20px rgba(245, 158, 11, 0.06)';
    } else if (status === 'Rupture') {
        ruptureCard.style.transform = 'translateY(-3px)';
        ruptureCard.style.boxShadow = '0 12px 30px rgba(239, 68, 68, 0.15), 0 0 20px rgba(239, 68, 68, 0.08)';
    }
}

function closeStockForm() {
    if (currentCategoryFilter) {
        showView('stockCategoryDetailView');
    } else {
        showView('stockView');
    }
}

function openAddStockFormGeneric() {
    editingStockItemId = null;
    currentCategoryFilter = '';

    document.getElementById('addStockName').value = '';
    document.getElementById('addStockCategory').value = 'RAM & SSD';
    document.getElementById('addStockRef').value = '';
    document.getElementById('addStockQty').value = '';
    document.getElementById('addStockLocation').value = '';
    document.getElementById('addStockDate').value = new Date().toISOString().substring(0, 10);
    document.getElementById('addStockNotes').value = '';

    document.getElementById('stockFormTitle').textContent = 'Ajouter au Stock';
    document.getElementById('stockFormSub').textContent = 'Enregistrer une nouvelle pièce ou du matériel.';

    showView('stockFormView');
}

function openAddStockFormFromCategory() {
    editingStockItemId = null;

    document.getElementById('addStockName').value = '';
    document.getElementById('addStockCategory').value = currentCategoryFilter;
    document.getElementById('addStockRef').value = '';
    document.getElementById('addStockQty').value = '';
    document.getElementById('addStockLocation').value = '';
    document.getElementById('addStockDate').value = new Date().toISOString().substring(0, 10);
    document.getElementById('addStockNotes').value = '';

    document.getElementById('stockFormTitle').textContent = 'Ajouter au Stock';
    document.getElementById('stockFormSub').textContent = `Enregistrer une nouvelle pièce dans la catégorie: ${currentCategoryFilter}.`;

    showView('stockFormView');
}

function saveStockItem() {
    const name = document.getElementById('addStockName').value.trim();
    const category = document.getElementById('addStockCategory').value;
    const ref = document.getElementById('addStockRef').value.trim();
    const qty = parseInt(document.getElementById('addStockQty').value) || 0;
    const location = document.getElementById('addStockLocation').value.trim();
    const date = document.getElementById('addStockDate').value;
    const notes = document.getElementById('addStockNotes').value.trim();

    if (!name) {
        showToast('⚠️ La désignation est obligatoire !', 'red');
        return;
    }
    if (qty < 0) {
        showToast('⚠️ La quantité ne peut pas être négative !', 'red');
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    let docId = editingStockItemId === null ? String(stockItems.length > 0 ? Math.max(...stockItems.map(item => isNaN(Number(item.id)) ? 0 : Number(item.id))) + 1 : 1) : String(editingStockItemId);

    const itemData = {
        name,
        category,
        ref,
        qty,
        location,
        date,
        notes,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("itStock").doc(docId).set(itemData, { merge: true })
        .then(() => {
            logActivity('STOCK', 'MODIF_AJOUT', `Article de stock mis à jour: ${name} (${category})`);
            showToast(editingStockItemId === null ? '📦 Article ajouté avec succès !' : '📝 Article mis à jour avec succès !', 'green');
            currentCategoryFilter = category;
            openCategoryDetail(category);
        })
        .catch(err => {
            console.error("Firestore save stock item error:", err);
            showToast('❌ Échec de la sauvegarde sur Firebase', 'red');
        });
}

function editStockItem(id) {
    const item = stockItems.find(i => i.id === id);
    if (!item) return;

    editingStockItemId = id;

    document.getElementById('addStockName').value = item.name || '';
    document.getElementById('addStockCategory').value = item.category || 'RAM & SSD';
    document.getElementById('addStockRef').value = item.ref || '';
    document.getElementById('addStockQty').value = item.qty || 0;
    document.getElementById('addStockLocation').value = item.location || '';
    document.getElementById('addStockDate').value = item.date || '';
    document.getElementById('addStockNotes').value = item.notes || '';

    document.getElementById('stockFormTitle').textContent = 'Modifier l\'Article';
    document.getElementById('stockFormSub').textContent = `Modifier les détails de: ${item.name}`;

    showView('stockFormView');
}

function deleteStockItem(id) {
    const item = stockItems.find(i => i.id === id);
    if (!item) return;

    showCustomConfirm(
        "Supprimer l'Article",
        `Voulez-vous vraiment supprimer définitivement l'article "${item.name}" du stock ? Cette action est irréversible.`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itStock").doc(String(id)).delete()
                .then(() => {
                    logActivity('STOCK', 'SUPPR', `Article supprimé du stock: ${item.name}`);
                    showToast('🗑️ Article supprimé du stock', 'blue');
                    if (currentCategoryFilter) renderStockCategoryTable();
                })
                .catch(err => {
                    console.error("Firestore delete stock item error:", err);
                    showToast('❌ Échec de la suppression sur Firebase', 'red');
                });
        },
        null,
        true // delete style
    );
}

// ============ GESTION DISTRIBUTION & PRÊT ============
let distributionItems = JSON.parse(localStorage.getItem('laboDistributionV1')) || defaultDistribution;
let editingDistId = null;

function saveDistributions() {
    localStorage.setItem('laboDistributionV1', JSON.stringify(distributionItems));
    updateDistributionStats();
    renderDistributionTable();
    updateDashboardAnalytics();
}

function updateDistributionStats() {
    const total = distributionItems.length;
    const pretEnCours = distributionItems.filter(d => d.type === 'Prêt' && d.status === 'En cours').length;
    const rendu = distributionItems.filter(d => d.status === 'Rendu').length;
    const today = new Date().toISOString().substring(0, 10);
    const enRetard = distributionItems.filter(d => d.type === 'Prêt' && d.status === 'En cours' && d.returnDate && d.returnDate < today).length;

    const elTotal = document.getElementById('distTotalCount');
    const elPret = document.getElementById('distPretEnCoursCount');
    const elRendu = document.getElementById('distRenduCount');
    const elRetard = document.getElementById('distRetardCount');
    if (elTotal) elTotal.textContent = total;
    if (elPret) elPret.textContent = pretEnCours;
    if (elRendu) elRendu.textContent = rendu;
    if (elRetard) elRetard.textContent = enRetard;
}

function getDistributionStatus(item) {
    if (item.type === 'Don') return { label: 'Don', class: 'don' };
    if (item.status === 'Rendu') return { label: 'Rendu', class: 'rendu' };
    const today = new Date().toISOString().substring(0, 10);
    if (item.returnDate && item.returnDate < today) return { label: 'En retard', class: 'retard' };
    return { label: 'En cours', class: 'encours' };
}

function renderDistributionTable() {
    const tbody = document.getElementById('distributionTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('distSearchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = distributionItems;

    // Apply active status card filter
    if (window.currentDistributionStatusFilter) {
        const today = new Date().toISOString().substring(0, 10);
        if (window.currentDistributionStatusFilter === 'Prêt') {
            filtered = filtered.filter(item => item.type === 'Prêt' && item.status === 'En cours');
        } else if (window.currentDistributionStatusFilter === 'Rendu') {
            filtered = filtered.filter(item => item.type === 'Prêt' && item.status === 'Rendu');
        } else if (window.currentDistributionStatusFilter === 'Retard') {
            filtered = filtered.filter(item => item.type === 'Prêt' && item.status === 'En cours' && item.returnDate && item.returnDate < today);
        }
    }

    if (searchTerm) {
        filtered = filtered.filter(d =>
            (d.employeeName || '').toLowerCase().includes(searchTerm) ||
            (d.service || '').toLowerCase().includes(searchTerm) ||
            (d.article || '').toLowerCase().includes(searchTerm)
        );
    }

    // Sort by ID descending (most recent first)
    const sorted = [...filtered].sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        if (idA !== idB) return idB - idA;
        const dA = a.date || '';
        const dB = b.date || '';
        return dB.localeCompare(dA);
    });

    // Save active dataset for pagination controls
    window.currentDistributionData = sorted;

    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Bounds safety checks
    if (window.currentDistributionPage > totalPages) {
        window.currentDistributionPage = totalPages;
    }
    if (window.currentDistributionPage < 1) {
        window.currentDistributionPage = 1;
    }

    const startIndex = (window.currentDistributionPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = sorted.slice(startIndex, endIndex);

    if (totalItems === 0) {
        safeSetHTML(tbody, '<tr>' +
            '<td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-secondary);">' +
            '<i class="fas fa-hand-holding" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>' +
            escapeHTML(searchTerm ? 'Aucun résultat trouvé.' : 'Aucune distribution enregistrée.') +
            '</td>' +
            '</tr>');
            
        renderDistributionPagination(0, 1, 1);
        return;
    }

    tbody.innerHTML = '';
    pageData.forEach(item => {
        const tr = document.createElement('tr');
        const statusInfo = getDistributionStatus(item);

        const statusColors = {
            'don': { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
            'encours': { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
            'rendu': { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
            'retard': { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' }
        };
        const sc = safeGet(statusColors, statusInfo.class, statusColors.don);

        const typeBadge = item.type === 'Prêt'
            ? '<span style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid rgba(245, 158, 11, 0.3);"><i class="fas fa-sync-alt" style="margin-right: 3px;"></i>Prêt</span>'
            : '<span style="background: rgba(99, 102, 241, 0.12); color: #6366f1; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid rgba(99, 102, 241, 0.3);"><i class="fas fa-gift" style="margin-right: 3px;"></i>Don</span>';

        const statusBadge = '<span style="background: ' + escapeHTML(sc.bg) + '; color: ' + escapeHTML(sc.color) + '; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid ' + escapeHTML(sc.border) + ';">' + escapeHTML(statusInfo.label) + '</span>';

        let actionBtns = '<button class="action-btn" onclick="printDistributionDischarge(' + escapeHTML(item.id) + ')" title="Imprimer Bon PDF">' +
            '<i class="fas fa-print"></i>' +
            '</button>';

        if (item.type === 'Prêt' && item.status === 'En cours') {
            actionBtns += '<button class="action-btn" onclick="markAsReturned(' + escapeHTML(item.id) + ')" title="Marquer comme Rendu" style="color: #10b981;">' +
                '<i class="fas fa-check-circle"></i>' +
                '</button>';
        }

        actionBtns += '<button class="action-btn delete" onclick="deleteDistribution(' + escapeHTML(item.id) + ')" title="Supprimer">' +
            '<i class="fas fa-trash-alt"></i>' +
            '</button>';

        safeSetHTML(tr, '<td style="font-weight: 700; color: var(--text-primary);"><i class="fas fa-user" style="color: var(--text-secondary); margin-right: 5px;"></i>' + escapeHTML(item.employeeName || 'N/A') + '</td>' +
            '<td>' + escapeHTML(item.service || 'N/A') + '</td>' +
            '<td style="font-weight: 700; color: var(--blue-500);">' + escapeHTML(item.article || 'N/A') + '</td>' +
            '<td style="text-align: center; font-weight: 800;">' + escapeHTML(item.qty || 1) + '</td>' +
            '<td style="text-align: center;">' + typeBadge + '</td>' +
            '<td>' + (item.date ? escapeHTML(new Date(item.date).toLocaleDateString('fr-FR')) : 'N/A') + '</td>' +
            '<td style="text-align: center;">' + statusBadge + '</td>' +
            '<td style="text-align: center;">' +
            '<div class="action-btns" style="justify-content: center;">' +
            actionBtns +
            '</div>' +
            '</td>');
        tbody.appendChild(tr);
    });

    renderDistributionPagination(totalItems, totalPages, window.currentDistributionPage);
}

function renderDistributionPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('distributionPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, 'distributions', 'changeDistributionPage');
    safeSetHTML(container, html);
}

function changeDistributionPage(page) {
    window.currentDistributionPage = page;
    renderDistributionTable();
    
    const tableWrapper = document.getElementById('distributionPagination');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.changeDistributionPage = changeDistributionPage;

function filterDistributionByStatus(status) {
    window.currentDistributionPage = 1;
    
    if (window.currentDistributionStatusFilter === status || status === 'Total') {
        window.currentDistributionStatusFilter = null;
        updateDistributionFilterCardHighlight(null);
    } else {
        window.currentDistributionStatusFilter = status;
        updateDistributionFilterCardHighlight(status);
    }
    
    renderDistributionTable();
}
window.filterDistributionByStatus = filterDistributionByStatus;

function updateDistributionFilterCardHighlight(status) {
    const totalCard = document.querySelector('#distributionView .dist-card-total');
    const pretCard = document.querySelector('#distributionView .dist-card-active');
    const renduCard = document.querySelector('#distributionView .dist-card-returned');
    const retardCard = document.querySelector('#distributionView .dist-card-late');
    
    if (!totalCard || !pretCard || !renduCard || !retardCard) return;
    
    totalCard.style.transform = '';
    totalCard.style.boxShadow = '';
    pretCard.style.transform = '';
    pretCard.style.boxShadow = '';
    renduCard.style.transform = '';
    renduCard.style.boxShadow = '';
    retardCard.style.transform = '';
    retardCard.style.boxShadow = '';
    
    if (status === 'Prêt') {
        pretCard.style.transform = 'translateY(-3px)';
        pretCard.style.boxShadow = '0 12px 30px rgba(245, 158, 11, 0.15), 0 0 20px rgba(245, 158, 11, 0.06)';
    } else if (status === 'Rendu') {
        renduCard.style.transform = 'translateY(-3px)';
        renduCard.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.15), 0 0 20px rgba(16, 185, 129, 0.08)';
    } else if (status === 'Retard') {
        retardCard.style.transform = 'translateY(-3px)';
        retardCard.style.boxShadow = '0 12px 30px rgba(239, 68, 68, 0.15), 0 0 20px rgba(239, 68, 68, 0.08)';
    }
}

function toggleReturnDate() {
    const type = document.getElementById('distType').value;
    const group = document.getElementById('returnDateGroup');
    if (group) {
        group.style.display = type === 'Prêt' ? 'block' : 'none';
        
        // Dynamically pre-fill the return date based on loanDuration setting!
        const returnDateInput = document.getElementById('distReturnDate');
        if (type === 'Prêt' && returnDateInput && !returnDateInput.value) {
            const duration = parseInt(appSettings.loanDuration || 30);
            const defaultReturnDate = new Date();
            defaultReturnDate.setDate(defaultReturnDate.getDate() + duration);
            returnDateInput.value = defaultReturnDate.toISOString().substring(0, 10);
        }
    }
}

function openDistributionForm() {
    editingDistId = null;
    document.getElementById('distEmployeeName').value = '';
    document.getElementById('distService').value = '';
    document.getElementById('distArticle').value = '';
    document.getElementById('distQty').value = 1;
    document.getElementById('distType').value = 'Don';
    document.getElementById('distReturnDate').value = '';
    document.getElementById('distDate').value = new Date().toISOString().substring(0, 10);
    document.getElementById('distNotes').value = '';
    document.getElementById('returnDateGroup').style.display = 'none';

    document.getElementById('distFormTitle').textContent = 'Nouvelle Distribution';
    document.getElementById('distFormSub').textContent = 'Enregistrer une distribution ou un prêt de matériel à un employé.';

    showView('distributionFormView');
}

function closeDistributionForm() {
    showView('distributionView');
}

function saveDistribution() {
    const employeeName = document.getElementById('distEmployeeName').value.trim();
    const service = document.getElementById('distService').value.trim();
    const article = document.getElementById('distArticle').value.trim();
    const qty = parseInt(document.getElementById('distQty').value) || 1;
    const type = document.getElementById('distType').value;
    const returnDate = document.getElementById('distReturnDate').value;
    const date = document.getElementById('distDate').value;
    const notes = document.getElementById('distNotes').value.trim();

    if (!employeeName) {
        showToast('⚠️ Le nom de l\'employé est obligatoire !', 'red');
        return;
    }
    if (!article) {
        showToast('⚠️ L\'article distribué est obligatoire !', 'red');
        return;
    }
    if (!service) {
        showToast('⚠️ Le service est obligatoire !', 'red');
        return;
    }
    if (type === 'Prêt' && !returnDate) {
        showToast('⚠️ La date de retour est obligatoire pour un prêt !', 'red');
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    let docId = editingDistId === null ? String(distributionItems.length > 0 ? Math.max(...distributionItems.map(d => isNaN(Number(d.id)) ? 0 : Number(d.id))) + 1 : 1) : String(editingDistId);

    const distData = {
        employeeName,
        service,
        article,
        qty,
        type,
        returnDate: type === 'Prêt' ? returnDate : '',
        date: date || new Date().toISOString().substring(0, 10),
        notes,
        status: type === 'Prêt' ? 'En cours' : 'Don',
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingDistId !== null) {
        const item = distributionItems.find(d => d.id === editingDistId);
        if (item && type === 'Prêt') {
            distData.status = item.status || 'En cours';
        }
    }

    db.collection("itDistributions").doc(docId).set(distData, { merge: true })
        .then(() => {
            logActivity('DISTRIBUTION', 'MODIF_AJOUT', `Distribution enregistrée: ${article} pour ${employeeName}`);
            showToast(editingDistId === null ? '✅ Distribution enregistrée avec succès !' : '📝 Distribution mise à jour !', 'green');
            closeDistributionForm();
        })
        .catch(err => {
            console.error("Firestore save distribution error:", err);
            showToast("❌ Échec de l'enregistrement sur Firebase", "red");
        });
}

function markAsReturned(id) {
    const item = distributionItems.find(d => d.id === id);
    if (!item) return;
    
    showCustomConfirm(
        "Confirmer le Retour",
        `Voulez-vous confirmer le retour du matériel "${item.article}" par ${item.employeeName} ?`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itDistributions").doc(String(id)).set({
                status: 'Rendu',
                returnedDate: new Date().toISOString().substring(0, 10),
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true })
                .then(() => {
                    logActivity('DISTRIBUTION', 'RETOUR', `Matériel rendu: ${item.article} par ${item.employeeName}`);
                    showToast('✅ Matériel marqué comme rendu !', 'green');
                })
                .catch(err => {
                    console.error("Firestore return distribution error:", err);
                    showToast("❌ Échec du marquage sur Firebase", "red");
                });
        },
        null,
        false // green/cyan validation style!
    );
}

function deleteDistribution(id) {
    const item = distributionItems.find(d => d.id === id);
    if (!item) return;
    
    showCustomConfirm(
        "Supprimer la Distribution",
        `Voulez-vous vraiment supprimer la distribution de "${item.article}" à ${item.employeeName} ? Cette action est irréversible.`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itDistributions").doc(String(id)).delete()
                .then(() => {
                    logActivity('DISTRIBUTION', 'SUPPR', `Distribution supprimée: ${item.article} à ${item.employeeName}`);
                    showToast('🗑️ Distribution supprimée', 'blue');
                })
                .catch(err => {
                    console.error("Firestore delete distribution error:", err);
                    showToast("❌ Échec de la suppression sur Firebase", "red");
                });
        },
        null,
        true // delete style
    );
}

function printDistributionDischarge(id) {
    const item = distributionItems.find(d => d.id === id);
    if (!item) return;

    const logoUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) + 'assets/logo-pdf.png';
    const printWindow = window.open('', '_blank', 'width=900,height=1000');

    const statusInfo = getDistributionStatus(item);
    const statusLabel = statusInfo.label.toUpperCase();

    const statusPdfClass = statusInfo.class === 'don' ? 'status-pdf-don'
        : statusInfo.class === 'rendu' ? 'status-pdf-rendu'
            : statusInfo.class === 'retard' ? 'status-pdf-retard'
                : 'status-pdf-encours';

    const refCode = `DIST-${item.id.toString().padStart(4, '0')}-${new Date(item.date).getFullYear()}`;

    const typeLabel = item.type === 'Prêt' ? 'PRÊT TEMPORAIRE' : 'ATTRIBUTION DÉFINITIVE (DON)';
    const typeColor = item.type === 'Prêt' ? '#f59e0b' : '#6366f1';

    let returnInfo = '';
    if (item.type === 'Prêt') {
        returnInfo = '\n' +
            '                    <div class="field-group">\n' +
            '                        <div class="field-label">DATE DE RETOUR PRÉVUE</div>\n' +
            '                        <div class="field-value" style="color: #f59e0b;">' + (item.returnDate ? escapeHTML(new Date(item.returnDate).toLocaleDateString('fr-FR')) : 'Non définie') + '</div>\n' +
            '                    </div>';
        if (item.status === 'Rendu' && item.returnedDate) {
            returnInfo += '\n' +
                '                    <div class="field-group">\n' +
                '                        <div class="field-label">DATE DE RETOUR EFFECTIF</div>\n' +
                '                        <div class="field-value" style="color: #10b981;">' + escapeHTML(new Date(item.returnedDate).toLocaleDateString('fr-FR')) + '</div>\n' +
                '                    </div>';
        }
    }

    const termsForType = item.type === 'Prêt' ?
        '                <li>L\'employé reconnaît avoir reçu le matériel décrit ci-dessus en bon état de fonctionnement.</li>\n' +
        '                <li>Le matériel prêté reste la propriété de l\'établissement et doit être restitué à la date convenue.</li>\n' +
        '                <li>En cas de perte, de vol ou de dommage résultant d\'une négligence, l\'employé sera tenu responsable.</li>\n' +
        '                <li>Tout retard de restitution devra être justifié auprès du service IT.</li>\n' +
        '                <li>Le matériel doit être rendu dans le même état que lors de la remise.</li>\n'
        :
        '                <li>L\'employé reconnaît avoir reçu le matériel décrit ci-dessus en bon état de fonctionnement.</li>\n' +
        '                <li>Ce matériel est attribué de manière définitive à l\'employé pour usage professionnel.</li>\n' +
        '                <li>L\'employé s\'engage à utiliser le matériel exclusivement à des fins professionnelles.</li>\n' +
        '                <li>En cas de départ de l\'employé, le matériel devra être restitué au service IT sur demande.</li>\n';

    const content = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Bon de Distribution - ${item.employeeName}</title>
                <style>
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #1e293b;
                        background-color: #ffffff;
                        line-height: 1.4;
                        padding: 0;
                        font-size: 13px;
                    }
                    .document-wrapper {
                        max-width: 800px;
                        margin: 0 auto;
                        border: 1px solid #cbd5e1;
                        background: #ffffff;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        min-height: 100vh;
                    }

                    /* Header */
                    .header {
                        background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
                        color: #ffffff;
                        padding: 25px 35px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: relative;
                        overflow: hidden;
                    }
                    .header::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        right: 0;
                        width: 160px;
                        height: 100%;
                        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                        transform: skewX(-25deg) translateX(60px);
                        z-index: 1;
                    }
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        z-index: 2;
                    }
                    .logo-img {
                        height: 55px;
                        max-width: 170px;
                        object-fit: contain;
                        background: rgba(255, 255, 255, 0.08);
                        padding: 8px;
                        border-radius: 8px;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                    }
                    .logo-title {
                        display: flex;
                        flex-direction: column;
                        gap: 3px;
                    }
                    .sub-hdr {
                        font-size: 9px;
                        font-weight: 800;
                        color: #94a3b8;
                        letter-spacing: 1.8px;
                        text-transform: uppercase;
                    }
                    .main-hdr {
                        font-size: 24px;
                        font-weight: 900;
                        color: #ffffff;
                        letter-spacing: 2px;
                        margin: 0;
                        line-height: 1.1;
                    }
                    .sub-hdr-green {
                        font-size: 11px;
                        font-weight: 700;
                        color: #6ee7b7;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }

                    /* Metadata */
                    .metadata-bar {
                        background: #f8fafc;
                        border-bottom: 2px solid #e2e8f0;
                        padding: 12px 35px;
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        font-weight: 700;
                        color: #475569;
                    }
                    .meta-item {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .status-badge-pdf {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 5px 14px;
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: 900;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    }
                    .status-dot-pdf {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        display: inline-block;
                    }
                    .status-pdf-don { background-color: #ede9fe !important; color: #5b21b6 !important; border: 1.5px solid #c4b5fd; }
                    .status-pdf-don .status-dot-pdf { background-color: #6366f1 !important; }
                    .status-pdf-encours { background-color: #fef3c7 !important; color: #92400e !important; border: 1.5px solid #fde68a; }
                    .status-pdf-encours .status-dot-pdf { background-color: #f59e0b !important; }
                    .status-pdf-rendu { background-color: #d1fae5 !important; color: #065f46 !important; border: 1.5px solid #a7f3d0; }
                    .status-pdf-rendu .status-dot-pdf { background-color: #10b981 !important; }
                    .status-pdf-retard { background-color: #fee2e2 !important; color: #991b1b !important; border: 1.5px solid #fecaca; }
                    .status-pdf-retard .status-dot-pdf { background-color: #ef4444 !important; }

                    /* Type Banner */
                    .type-banner {
                        text-align: center;
                        padding: 10px;
                        font-size: 13px;
                        font-weight: 900;
                        letter-spacing: 2px;
                        text-transform: uppercase;
                        border-bottom: 2px solid #e2e8f0;
                    }

                    /* Content */
                    .content {
                        padding: 25px 35px;
                        flex-grow: 1;
                    }
                    .cards-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .info-card {
                        border: 2px solid #cbd5e1;
                        border-radius: 12px;
                        padding: 18px 22px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
                    }
                    .card-employee {
                        background: #f0fdf4 !important;
                        border-left: 7px solid #059669;
                    }
                    .card-material {
                        background: #eff6ff !important;
                        border-left: 7px solid #3b82f6;
                    }
                    .card-title {
                        font-size: 12px;
                        font-weight: 900;
                        letter-spacing: 1.2px;
                        margin-bottom: 14px;
                        text-transform: uppercase;
                        padding-bottom: 5px;
                        border-bottom: 2px dashed #cbd5e1;
                    }
                    .card-employee .card-title { color: #059669; }
                    .card-material .card-title { color: #3b82f6; }

                    .field-group { margin-bottom: 10px; }
                    .field-group:last-child { margin-bottom: 0; }
                    .field-label {
                        font-size: 10px;
                        font-weight: 850;
                        text-transform: uppercase;
                        color: #475569;
                        letter-spacing: 1px;
                        margin-bottom: 3px;
                    }
                    .field-value {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0f172a;
                    }

                    /* Notes Box */
                    .notes-box {
                        background: #eff6ff !important;
                        border: 2px solid #cbd5e1;
                        border-left: 7px solid #3b82f6;
                        border-radius: 10px;
                        display: flex;
                        overflow: hidden;
                        margin-bottom: 18px;
                    }
                    .notes-title {
                        background: #3b82f6;
                        color: #ffffff;
                        font-size: 12px;
                        font-weight: 900;
                        letter-spacing: 1.2px;
                        padding: 12px 18px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-transform: uppercase;
                        flex-shrink: 0;
                        min-width: 130px;
                    }
                    .notes-content {
                        padding: 12px 20px;
                        font-size: 14px;
                        font-weight: 700;
                        color: #1e3a8a;
                        display: flex;
                        align-items: center;
                    }

                    /* Terms */
                    .terms-box {
                        background: #f0fdf4 !important;
                        border: 2px solid #cbd5e1;
                        border-left: 7px solid #059669;
                        border-radius: 10px;
                        padding: 16px 22px;
                        margin-bottom: 20px;
                    }
                    .terms-list {
                        list-style-type: decimal;
                        padding-left: 20px;
                        color: #0f172a;
                        font-size: 12px;
                        font-weight: 650;
                    }
                    .terms-list li { margin-bottom: 5px; }
                    .terms-list li:last-child { margin-bottom: 0; }

                    /* Signatures */
                    .signatures-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 25px;
                        margin-top: 25px;
                    }
                    .signature-block {
                        background: #f8fafc;
                        border: 2px solid #94a3b8;
                        border-radius: 12px;
                        height: 140px;
                        padding: 15px 18px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        position: relative;
                    }
                    .signature-block-title {
                        font-size: 11.5px;
                        font-weight: 900;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        text-align: center;
                        color: #475569;
                    }
                    .signature-block-sub {
                        font-size: 10.5px;
                        font-weight: 600;
                        color: #94a3b8;
                        text-align: center;
                        margin-bottom: 5px;
                    }

                    /* Footer */
                    .footer {
                        background: #064e3b;
                        color: #ffffff;
                        text-align: center;
                        padding: 10px;
                        font-size: 11px;
                        font-weight: 700;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        margin-top: auto;
                        border-radius: 0 0 8px 8px;
                    }

                    @media print {
                        body { background-color: #ffffff; padding: 0; }
                        .document-wrapper { border: none; max-width: 100%; width: 100%; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    <!-- Header -->
                    <div class="header">
                        <div class="header-left">
                            <img src="${logoUrl}"
                                 onerror="this.onerror=null; this.src='https://placehold.co/180x60/064e3b/ffffff?text=LABO-NEDJMA';"
                                 alt="Logo"
                                 class="logo-img">

                            <div class="logo-title">
                                <span class="sub-hdr">DOCUMENT OFFICIEL • SERVICE INFORMATIQUE</span>
                                <h1 class="main-hdr">BON DE DISTRIBUTION</h1>
                                <span class="sub-hdr-green">MATÉRIEL INFORMATIQUE — ${typeLabel}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Metadata -->
                    <div class="metadata-bar">
                        <div class="meta-item">DATE D'ÉMISSION : ${new Date().toLocaleDateString('fr-FR')}</div>
                        <div class="meta-item">
                            <span class="status-badge-pdf ${statusPdfClass}">
                                <span class="status-dot-pdf"></span>
                                ${statusLabel}
                            </span>
                        </div>
                        <div class="meta-item">RÉF : ${refCode}</div>
                    </div>

                    <!-- Type Banner -->
                    <div class="type-banner" style="background: ${item.type === 'Prêt' ? '#fef3c7' : '#ede9fe'}; color: ${typeColor};">
                        ⬤ ${typeLabel} ${item.type === 'Prêt' && item.returnDate ? '— RETOUR PRÉVU LE ' + new Date(item.returnDate).toLocaleDateString('fr-FR') : ''}
                    </div>

                    <!-- Content -->
                    <div class="content">
                        <div class="cards-grid">
                            <!-- Employee Card -->
                            <div class="info-card card-employee">
                                <h2 class="card-title">BÉNÉFICIAIRE</h2>
                                <div class="field-group">
                                    <div class="field-label">NOM & PRÉNOM</div>
                                    <div class="field-value">${item.employeeName || 'N/A'}</div>
                                </div>
                                <div class="field-group">
                                    <div class="field-label">SERVICE / DÉPARTEMENT</div>
                                    <div class="field-value">${item.service || 'N/A'}</div>
                                </div>
                                <div class="field-group">
                                    <div class="field-label">DATE DE DISTRIBUTION</div>
                                    <div class="field-value">${item.date ? new Date(item.date).toLocaleDateString('fr-FR') : 'N/A'}</div>
                                </div>
                            </div>

                            <!-- Material Card -->
                            <div class="info-card card-material">
                                <h2 class="card-title">MATÉRIEL DISTRIBUÉ</h2>
                                <div class="field-group">
                                    <div class="field-label">DÉSIGNATION / ARTICLE</div>
                                    <div class="field-value" style="color: #1e40af;">${item.article || 'N/A'}</div>
                                </div>
                                <div class="field-group">
                                    <div class="field-label">QUANTITÉ</div>
                                    <div class="field-value">${item.qty || 1} unité(s)</div>
                                </div>
                                <div class="field-group">
                                    <div class="field-label">TYPE DE DISTRIBUTION</div>
                                    <div class="field-value" style="color: ${typeColor};">${typeLabel}</div>
                                </div>
                                ${returnInfo}
                            </div>
                        </div>

                        <!-- Notes -->
                        <div class="notes-box">
                            <div class="notes-title">OBSERVATIONS</div>
                            <div class="notes-content">
                                ${item.notes ? item.notes.toUpperCase() : 'AUCUNE OBSERVATION PARTICULIÈRE'}
                            </div>
                        </div>

                        <!-- Terms -->
                        <div class="terms-box">
                            <ol class="terms-list">
                                ${termsForType}
                            </ol>
                        </div>

                        <!-- Signatures -->
                        <div class="signatures-row">
                            <div class="signature-block">
                                <div class="signature-block-title">SIGNATURE DE L'EMPLOYÉ</div>
                                <div class="signature-block-sub">Nom & Prénom lisibles obligatoires</div>
                            </div>
                            <div class="signature-block">
                                <div class="signature-block-title">CACHET & VISA SERVICE IT</div>
                                <div class="signature-block-sub">Responsable Informatique</div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="footer">
                        LABO-IT CONTROL • BON DE DISTRIBUTION MATÉRIEL IT • LABO-NEDJMA
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                <\/script>
            </body>
            </html>
            `;

    printWindow.document.write(content);
    printWindow.document.close();
}

// ============ MODULE: ÉTAT DE BESOINS (DEMANDES D'ACHAT) ============
let besoins = JSON.parse(localStorage.getItem('laboBesoinsV3')) || defaultBesoins;
let nextBesoinId = besoins.length > 0 ? Math.max(...besoins.map(b => b.id)) + 1 : 1;
let currentBesoinsTab = 'demandes';

function saveBesoins() {
    localStorage.setItem('laboBesoinsV3', JSON.stringify(besoins));
    updateBesoinsStats();
    renderBesoinsTable();
}

function updateBesoinsStats() {
    const updateIcon = (id, iconClass) => {
        const el = document.getElementById(id);
        if (el) {
            el.className = `fas ${iconClass}`;
        }
    };
    const updatePlainCount = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        const count = Number(value) || 0;
        el.textContent = count;
        el.classList.toggle('is-empty', count <= 0);
        el.classList.toggle('has-notification', id === 'besoinCountBadge' && count > 0);
        el.style.display = count > 0 ? 'inline-flex' : 'none';
    };

    if (currentBesoinsTab === 'demandes') {
        const total = besoins.length;
        const waiting = besoins.filter(b => b.status === 'En attente').length;
        const approved = besoins.filter(b => b.status === 'Approuvé').length;
        const rejected = besoins.filter(b => b.status === 'Rejeté').length;

        setText('besoinTotalCount', total);
        setText('besoinEnAttenteCount', waiting);
        setText('besoinApprouveCount', approved);
        setText('besoinRejeteCount', rejected);

        // Update labels
        setText('besoinStatLabel1', 'Total Demandes');
        setText('besoinStatLabel2', 'En Attente');
        setText('besoinStatLabel3', 'Approuvées');
        setText('besoinStatLabel4', 'Rejetées');

        // Update icons
        updateIcon('besoinStatIcon1', 'fa-shopping-cart');
        updateIcon('besoinStatIcon2', 'fa-hourglass-half');
        updateIcon('besoinStatIcon3', 'fa-check-circle');
        updateIcon('besoinStatIcon4', 'fa-times-circle');
    } else if (currentBesoinsTab === 'envois') {
        const total = envois.length;
        const totalQty = envois.reduce((sum, e) => sum + (parseInt(e.qty, 10) || 0), 0);
        const totalLieux = new Set(envois.map(e => e.lieu ? e.lieu.toLowerCase().trim() : '').filter(Boolean)).size;
        const totalLivres = envois.filter(e => e.livre === true).length;

        setText('besoinTotalCount', total);
        setText('besoinEnAttenteCount', totalQty);
        setText('besoinApprouveCount', totalLieux);
        setText('besoinRejeteCount', totalLivres);

        // Update labels
        setText('besoinStatLabel1', 'Total Envois');
        setText('besoinStatLabel2', 'Total Unités');
        setText('besoinStatLabel3', 'Lieux de Livraison');
        setText('besoinStatLabel4', 'Livrés');

        // Update icons
        updateIcon('besoinStatIcon1', 'fa-paper-plane');
        updateIcon('besoinStatIcon2', 'fa-box-open');
        updateIcon('besoinStatIcon3', 'fa-map-marker-alt');
        updateIcon('besoinStatIcon4', 'fa-check-double');
    } else if (currentBesoinsTab === 'pannes') {
        const total = pannes.length;
        const waiting = pannes.filter(p => p.status === 'En attente').length;
        const inProgress = pannes.filter(p => p.status === 'En cours').length;
        const fixed = pannes.filter(p => p.status === 'Réparé').length;

        setText('besoinTotalCount', total);
        setText('besoinEnAttenteCount', waiting);
        setText('besoinApprouveCount', inProgress);
        setText('besoinRejeteCount', fixed);

        // Update labels
        setText('besoinStatLabel1', 'Total Signalements');
        setText('besoinStatLabel2', 'En Attente');
        setText('besoinStatLabel3', 'En Cours');
        setText('besoinStatLabel4', 'Réparées');

        // Update icons
        updateIcon('besoinStatIcon1', 'fa-tools');
        updateIcon('besoinStatIcon2', 'fa-hourglass-half');
        updateIcon('besoinStatIcon3', 'fa-wrench');
        updateIcon('besoinStatIcon4', 'fa-check-circle');
    }

    // Also update the nav button count badge and dropdown item badges
    const waitingBesoins = besoins.filter(b => b.status === 'En attente').length;
    const activeEnvois = envois.filter(e => !e.livre).length;
    const activePannes = pannes.filter(p => p.status === 'En attente' || p.status === 'En cours').length;

    const totalWaiting = waitingBesoins + activeEnvois + activePannes;

    const badge = document.getElementById('besoinCountBadge');
    if (badge) updatePlainCount('besoinCountBadge', totalWaiting);
    updatePlainCount('besoinDemandesCount', waitingBesoins);
    updatePlainCount('besoinEnvoisCount', activeEnvois);
    updatePlainCount('besoinPannesCount', activePannes);
}

function renderBesoinsTable() {
    const tbody = document.getElementById('besoinsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchInput = document.getElementById('besoinSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Filter besoins
    const filtered = besoins.filter(b => {
        const idStr = `REQ-${b.id.toString().padStart(4, '0')}`.toLowerCase();
        const demandeur = (b.demandeur || '').toLowerCase();
        const service = (b.service || '').toLowerCase();
        const hasItem = b.items && b.items.some(item => (item.desc || '').toLowerCase().includes(query));

        return idStr.includes(query) || demandeur.includes(query) || service.includes(query) || hasItem;
    });

    // Sort by ID descending (most recent first)
    filtered.sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        if (idA !== idB) return idB - idA;
        const dA = a.date || '';
        const dB = b.date || '';
        return dB.localeCompare(dA);
    });

    // Save active dataset for pagination controls
    window.currentBesoinsData = filtered;

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Bounds safety checks
    if (window.currentBesoinsPage > totalPages) {
        window.currentBesoinsPage = totalPages;
    }
    if (window.currentBesoinsPage < 1) {
        window.currentBesoinsPage = 1;
    }

    const startIndex = (window.currentBesoinsPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filtered.slice(startIndex, endIndex);

    if (totalItems === 0) {
        tbody.innerHTML = '<tr>' +
            '<td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem; font-style: italic;">' +
            'Aucune demande trouvée.' +
            '</td>' +
            '</tr>';
        
        renderBesoinsPagination(0, 1, 1);
        return;
    }

    pageData.forEach(b => {
        const tr = document.createElement('tr');

        // Priority Badge
        let priorityBadge = '';
        if (b.priority === 'Très Urgent') {
            priorityBadge = '<span class="badge-priority-very-urgent">🚨 Très Urgent</span>';
        } else {
            priorityBadge = '<span class="badge-priority-urgent">⚠️ Urgent</span>';
        }

        // Status Badge
        let statusBadge = '';
        if (b.status === 'Approuvé') {
            statusBadge = '<span class="badge-status-approved">Approuvé</span>';
        } else if (b.status === 'Rejeté') {
            statusBadge = '<span class="badge-status-rejected">Rejeté</span>';
        } else {
            statusBadge = '<span class="badge-status-waiting">En attente</span>';
        }

        const dateFormatee = b.date ? new Date(b.date).toLocaleDateString('fr-FR') : 'N/A';
        const dateLimiteFormatee = b.dateLimite ? new Date(b.dateLimite).toLocaleDateString('fr-FR') : '---';

        safeSetHTML(tr, '<td style="font-weight: 700; color: var(--text-primary);">REQ-' + escapeHTML(b.id.toString().padStart(4, '0')) + '</td>' +
            '<td style="font-weight: 600;">' + escapeHTML(b.demandeur) + '</td>' +
            '<td>' + escapeHTML(b.service) + '</td>' +
            '<td>' + escapeHTML(dateFormatee) + '</td>' +
            '<td style="text-align: center;">' + priorityBadge + '</td>' +
            '<td>' + escapeHTML(dateLimiteFormatee) + '</td>' +
            '<td style="text-align: center;">' + statusBadge + '</td>' +
            '<td>' +
            '<div class="action-btns" style="justify-content: center; gap: 0.4rem; align-items: center;">' +
            '<select class="besoin-row-input" onchange="changeBesoinStatus(' + escapeHTML(b.id) + ', this.value)" style="width: 110px; padding: 0.25rem 0.4rem; font-size: 0.78rem; height: auto; border-radius: 0.4rem;">' +
            '<option value="En attente" ' + (b.status === 'En attente' ? 'selected' : '') + '>En attente</option>' +
            '<option value="Approuvé" ' + (b.status === 'Approuvé' ? 'selected' : '') + '>Approuvé</option>' +
            '<option value="Rejeté" ' + (b.status === 'Rejeté' ? 'selected' : '') + '>Rejeté</option>' +
            '</select>' +
            '<button class="action-btn" title="Modifier" onclick="editBesoin(' + escapeHTML(b.id) + ')">' +
            '<i class="fas fa-edit"></i>' +
            '</button>' +
            '<button class="action-btn" title="Imprimer PDF" onclick="printBesoinsPDF(' + escapeHTML(b.id) + ')" style="color: #fb923c;">' +
            '<i class="fas fa-file-pdf"></i>' +
            '</button>' +
            '<button class="action-btn delete" title="Supprimer" onclick="deleteBesoin(' + escapeHTML(b.id) + ')">' +
            '<i class="fas fa-trash-alt"></i>' +
            '</button>' +
            '</div>' +
            '</td>');
        tbody.appendChild(tr);
    });

    renderBesoinsPagination(totalItems, totalPages, window.currentBesoinsPage);
}

function renderBesoinsPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('besoinsPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, 'demandes', 'changeBesoinsPage');
    safeSetHTML(container, html);
}

function changeBesoinsPage(page) {
    window.currentBesoinsPage = page;
    renderBesoinsTable();
    
    const tableWrapper = document.getElementById('besoinsPagination');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.changeBesoinsPage = changeBesoinsPage;

function changeBesoinStatus(id, newStatus) {
    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }
    db.collection("itBesoins").doc(String(id)).set({
        status: newStatus,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
        .then(() => {
            logActivity('BESOINS', 'STATUT', `Statut besoin REQ-${id} modifié en: ${newStatus}`);
            showToast(`⚙️ Statut de la demande mis à jour : ${newStatus}`, 'blue');
        })
        .catch(err => {
            console.error("Firestore update besoin status error:", err);
            showToast("❌ Échec de la mise à jour sur Firebase", "red");
        });
}

function deleteBesoin(id) {
    showCustomConfirm(
        "Supprimer la Demande",
        `Voulez-vous vraiment supprimer définitivement la demande REQ-${id.toString().padStart(4, '0')} ?`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itBesoins").doc(String(id)).delete()
                .then(() => {
                    logActivity('BESOINS', 'SUPPR', `Demande supprimée: REQ-${id}`);
                    showToast('🗑️ Demande supprimée avec succès', 'blue');
                })
                .catch(err => {
                    console.error("Firestore delete besoin error:", err);
                    showToast("❌ Échec de la suppression sur Firebase", "red");
                });
        },
        null,
        true // delete style
    );
}

let editingBesoinId = null;

function openBesoinForm() {
    editingBesoinId = null;
    document.getElementById('besoinFormTitle').textContent = "Nouvelle Demande de Besoins";
    document.getElementById('besoinFormSub').textContent = "Déclarez les consommables informatiques ou matériels requis pour votre service.";

    // Reset fields
    document.getElementById('besoinDemandeur').value = '';
    document.getElementById('besoinService').value = '';
    document.getElementById('besoinDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('besoinDateLimite').value = '';
    document.querySelectorAll('input[name="besoinPriority"]').forEach(r => {
        if (r.value === 'Urgent') r.checked = true;
    });

    // Reset table
    const tbody = document.getElementById('besoinFormTableBody');
    tbody.innerHTML = '';
    // Add 3 default empty rows
    addBesoinRow();
    addBesoinRow();
    addBesoinRow();

    showView('besoinsFormView');
}

function closeBesoinForm() {
    showView('besoinsView');
}

function editBesoin(id) {
    const b = besoins.find(x => x.id === id);
    if (!b) return;

    editingBesoinId = id;
    document.getElementById('besoinFormTitle').textContent = "Modifier la Demande " + `REQ-${id.toString().padStart(4, '0')}`;
    document.getElementById('besoinFormSub').textContent = "Modifier les détails de la demande d'achat IT.";

    document.getElementById('besoinDemandeur').value = b.demandeur;
    document.getElementById('besoinService').value = b.service;
    document.getElementById('besoinDate').value = b.date;
    document.getElementById('besoinDateLimite').value = b.dateLimite || '';
    document.querySelectorAll('input[name="besoinPriority"]').forEach(r => {
        r.checked = (r.value === b.priority);
    });

    const tbody = document.getElementById('besoinFormTableBody');
    tbody.innerHTML = '';
    if (b.items && b.items.length > 0) {
        b.items.forEach(item => {
            addBesoinRow(item.desc, item.qty, item.obs);
        });
    } else {
        addBesoinRow();
    }

    showView('besoinsFormView');
}

function addBesoinRow(desc = '', qty = 1, obs = '') {
    const tbody = document.getElementById('besoinFormTableBody');
    if (!tbody) return;

    const rowCount = tbody.children.length;
    const tr = document.createElement('tr');
    safeSetHTML(tr, '<td class="row-number" style="padding: 0.8rem;">' + (rowCount + 1) + '</td>' +
        '<td style="padding: 0.8rem;">' +
        '<input type="text" class="besoin-row-input row-item-desc" placeholder="Ex: Cartouche Toner HP CF226A" value="' + escapeHTML(desc) + '">' +
        '</td>' +
        '<td style="padding: 0.8rem; text-align: center;">' +
        '<input type="number" class="besoin-row-input besoin-qty-input row-item-qty" min="1" value="' + escapeHTML(qty) + '">' +
        '</td>' +
        '<td style="padding: 0.8rem;">' +
        '<input type="text" class="besoin-row-input row-item-obs" placeholder="Ex: Service RH" value="' + escapeHTML(obs) + '">' +
        '</td>' +
        '<td style="padding: 0.8rem; text-align: center;">' +
        '<button type="button" class="row-delete-btn" onclick="removeBesoinRow(this)" title="Supprimer cette ligne">' +
        '<i class="fas fa-minus-circle"></i>' +
        '</button>' +
        '</td>');
    tbody.appendChild(tr);
    reindexBesoinRows();
}

function removeBesoinRow(btn) {
    const tbody = document.getElementById('besoinFormTableBody');
    if (tbody.children.length <= 1) {
        showToast("⚠️ Il faut au moins insérer un seul article", "red");
        return;
    }
    const tr = btn.closest('tr');
    tr.remove();
    reindexBesoinRows();
}

function reindexBesoinRows() {
    const rows = document.querySelectorAll('#besoinFormTableBody tr');
    rows.forEach((row, idx) => {
        row.querySelector('.row-number').textContent = idx + 1;
    });
}

function saveBesoin() {
    const demandeur = document.getElementById('besoinDemandeur').value.trim();
    const service = document.getElementById('besoinService').value.trim();
    const date = document.getElementById('besoinDate').value;
    const dateLimite = document.getElementById('besoinDateLimite').value;
    const priorityRadio = document.querySelector('input[name="besoinPriority"]:checked');
    const priority = priorityRadio ? priorityRadio.value : 'Urgent';

    if (!demandeur || !service) {
        showToast("⚠️ Veuillez remplir le demandeur et le service", "red");
        return;
    }

    // Gather items
    const items = [];
    const rows = document.querySelectorAll('#besoinFormTableBody tr');
    let hasValidItem = false;

    rows.forEach(row => {
        const desc = row.querySelector('.row-item-desc').value.trim();
        const qty = parseInt(row.querySelector('.row-item-qty').value) || 1;
        const obs = row.querySelector('.row-item-obs').value.trim();

        if (desc) {
            items.push({ desc, qty, obs });
            hasValidItem = true;
        }
    });

    if (!hasValidItem) {
        showToast("⚠️ Veuillez insérer au moins une désignation valide d'article", "red");
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    let docId = editingBesoinId === null ? String(besoins.length > 0 ? Math.max(...besoins.map(b => isNaN(Number(b.id)) ? 0 : Number(b.id))) + 1 : 1) : String(editingBesoinId);

    const besoinData = {
        demandeur,
        service,
        date,
        dateLimite,
        priority,
        status: editingBesoinId === null ? 'En attente' : (besoins.find(x => x.id === editingBesoinId)?.status || 'En attente'),
        items,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("itBesoins").doc(docId).set(besoinData, { merge: true })
        .then(() => {
            logActivity('BESOINS', 'MODIF_AJOUT', `Demande d'achat enregistrée: REQ-${docId} par ${demandeur}`);
            showToast(editingBesoinId === null ? "✅ Demande enregistrée avec succès !" : "✏️ Demande mise à jour avec succès !", "green");
            closeBesoinForm();
        })
        .catch(err => {
            console.error("Firestore save besoin error:", err);
            showToast("❌ Échec de l'enregistrement sur Firebase", "red");
        });
}

function printBesoinsPDF(id) {
    const b = besoins.find(x => x.id === id);
    if (!b) return;

    const printWindow = window.open('', '_blank', 'width=850,height=1100');
    if (!printWindow) {
        showToast("⚠️ Pop-up bloqué ! Veuillez autoriser les pop-ups pour imprimer.", "red");
        return;
    }

    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const logoUrl = basePath + 'assets/logo-pdf.png';

    // Build table rows
    let rowsHtml = '';
    for (let i = 0; i < 7; i++) {
        const item = safeGetIndex(b.items, i);
        if (item) {
            rowsHtml += '\n' +
                '                        <tr>\n' +
                '                            <td class="center" style="font-weight: bold;">' + (i + 1) + '</td>\n' +
                '                            <td style="font-weight: 600;">' + escapeHTML(item.desc) + '</td>\n' +
                '                            <td class="center" style="font-weight: bold;">' + escapeHTML(item.qty) + '</td>\n' +
                '                            <td>' + escapeHTML(item.obs || '') + '</td>\n' +
                '                        </tr>\n';
        } else {
            rowsHtml += '\n' +
                '                        <tr>\n' +
                '                            <td class="center" style="color: #cbd5e1;">' + (i + 1) + '</td>\n' +
                '                            <td></td>\n' +
                '                            <td></td>\n' +
                '                            <td></td>\n' +
                '                        </tr>\n';
        }
    }

    const content = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>État de Besoins - REQ-${b.id.toString().padStart(4, '0')}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                        color: #1e293b;
                        background-color: #ffffff;
                        padding: 20px;
                        font-size: 13px;
                        line-height: 1.4;
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        position: relative;
                    }
                    .document-wrapper {
                        width: 100%;
                        max-width: 800px;
                        margin: 0 auto;
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        border: 1px solid #e2e8f0;
                        padding: 40px;
                        position: relative;
                        background: #fff;
                        overflow: hidden;
                    }
                    
                    /* Watermark Background */
                    .watermark-bg {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-15deg);
                        width: 70%;
                        opacity: 0.04;
                        pointer-events: none;
                        z-index: 0;
                    }

                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 25px;
                        z-index: 1;
                    }
                    .header-left {
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                    }
                    .logo-img {
                        height: 55px;
                        object-fit: contain;
                    }
                    .logo-subtitle {
                        font-size: 10px;
                        font-weight: 800;
                        color: #1e3a8a;
                        letter-spacing: 2px;
                        text-align: center;
                    }
                    .header-right-box {
                        border: 1px solid #cbd5e1;
                        padding: 8px 12px;
                        font-size: 9px;
                        color: #475569;
                        text-align: left;
                        border-radius: 4px;
                        max-width: 320px;
                        line-height: 1.3;
                    }
                    
                    .title-block {
                        background-color: #e2e8f0;
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        text-align: center;
                        padding: 10px 0;
                        margin-bottom: 25px;
                        z-index: 1;
                    }
                    .title-block h1 {
                        font-size: 22px;
                        font-weight: 800;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }

                    .meta-section {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        margin-bottom: 25px;
                        z-index: 1;
                        font-size: 13.5px;
                    }
                    .meta-item {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .meta-label {
                        font-weight: 700;
                        text-decoration: underline;
                    }
                    .meta-val {
                        font-weight: 600;
                    }
                    
                    /* Checkbox styling */
                    .check-box {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 14px;
                        height: 14px;
                        border: 1.5px solid #0f172a;
                        font-weight: 800;
                        font-size: 10px;
                        line-height: 1;
                        margin-left: 4px;
                        margin-right: 4px;
                        vertical-align: middle;
                        background: #fff;
                    }

                    /* Table */
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 30px;
                        z-index: 1;
                    }
                    .items-table th {
                        background-color: #cbd5e1;
                        border: 1px solid #94a3b8;
                        color: #0f172a;
                        font-weight: 800;
                        padding: 8px;
                        text-align: left;
                        font-size: 12px;
                    }
                    .items-table th.center, .items-table td.center {
                        text-align: center;
                    }
                    .items-table td {
                        border: 1px solid #cbd5e1;
                        padding: 9px 8px;
                        font-size: 12.5px;
                        height: 38px; /* Fixed height for clean spacing */
                    }
                    .items-table tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    
                    .signatures-section {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                        margin-top: auto; /* Push to bottom naturally */
                        margin-bottom: 25px;
                        z-index: 1;
                    }
                    .signature-col {
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .signature-title {
                        font-weight: 800;
                        font-size: 12.5px;
                        text-decoration: underline;
                        margin-bottom: 60px;
                        color: #0f172a;
                        text-transform: uppercase;
                    }
                    .signature-line {
                        width: 80%;
                        border-top: 1px dashed #94a3b8;
                    }

                    .footer-address {
                        text-align: center;
                        font-size: 8px;
                        color: #64748b;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 10px;
                        margin-top: 10px;
                        line-height: 1.4;
                        z-index: 1;
                    }
                    .blue-bar {
                        width: 100%;
                        height: 12px;
                        background-color: #1e3a8a;
                        margin-top: 8px;
                        border-radius: 2px;
                        z-index: 1;
                    }

                    @media print {
                        body {
                            padding: 0;
                            background-color: #ffffff;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .document-wrapper {
                            border: none;
                            padding: 20px;
                            max-width: 100%;
                            width: 100%;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    <!-- Faint watermark in center background -->
                    <img src="${logoUrl}" class="watermark-bg" alt="watermark">

                    <!-- Top Header -->
                    <div class="header">
                        <div class="header-left">
                            <img src="${logoUrl}" onerror="this.onerror=null; this.src='https://placehold.co/180x60/1e1b4b/ffffff?text=LABO-NEDJMA';" class="logo-img" alt="Logo">
                            <div class="logo-subtitle">LABORATOIRES NEDJMA</div>
                        </div>
                        <div class="header-right-box">
                            Cité el fahs Zone d'Activité.lot n°01 Larabaa -Blida<br>
                            Algérie Tél : +213 (0) 23 31 71 02/06/10 - +213(0) 23 92 02 93/94<br>
                            Fax : +213(0) 23 31 71 08 Service Commercial : +213(0) 770 255 115
                        </div>
                    </div>

                    <!-- Grey Title Block -->
                    <div class="title-block">
                        <h1>Etat de Besoins</h1>
                    </div>

                    <!-- Meta Section -->
                    <div class="meta-section">
                        <div class="meta-item">
                            <span class="meta-label">Le service</span> :
                            <span class="meta-val">${b.service}</span>
                        </div>
                        <div class="meta-item" style="justify-content: flex-end;">
                            <span class="meta-label">Larbaa le</span> :
                            <span class="meta-val">${new Date(b.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Date limite de besoin</span> :
                            <span class="meta-val">${b.dateLimite ? new Date(b.dateLimite).toLocaleDateString('fr-FR') : 'Non spécifiée'}</span>
                        </div>
                        <div class="meta-item" style="justify-content: flex-end;">
                            <span class="meta-label">Priorité</span> :
                            &nbsp;&nbsp;
                            urgent <span class="check-box">${b.priority === 'Urgent' ? '✓' : ''}</span>
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            très urgent <span class="check-box">${b.priority === 'Très Urgent' ? '✓' : ''}</span>
                        </div>
                    </div>

                    <!-- Items Table (Exactly 7 Rows) -->
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th class="center" style="width: 8%;">N°</th>
                                <th style="width: 52%;">Désignation</th>
                                <th class="center" style="width: 15%;">Qte</th>
                                <th style="width: 25%;">OBS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <!-- Signatures Column Section -->
                    <div class="signatures-section">
                        <div class="signature-col">
                            <div class="signature-title">${escapeHTML(appSettings.sig1 || 'Le Demandeur')}</div>
                            <div class="signature-line"></div>
                        </div>
                        <div class="signature-col">
                            <div class="signature-title">${escapeHTML(appSettings.sig2 || 'Le Responsable du service')}</div>
                            <div class="signature-line"></div>
                        </div>
                        <div class="signature-col">
                            <div class="signature-title">${escapeHTML(appSettings.sig3 || 'ASSISTANTE MGX')}</div>
                            <div class="signature-line"></div>
                        </div>
                    </div>

                    <!-- Footer Info Block -->
                    <div class="footer-address">
                        Cité el fahs Zone d'Activité.lot n°01 Larabaa -Blida Algérie Tél : +213 (0) 23 31 71 02/06/10 - +213(0) 23 92 02 93/94<br>
                        Fax : +213(0) 23 31 71 08 Service Commercial : +213(0) 770 255 115
                    </div>
                    <div class="blue-bar"></div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                <\/script>
            </body>
            </html>
            `;

    printWindow.document.write(content);
    printWindow.document.close();
}

// ============ MODULE: CONFIRMATION D'ENVOI D'ÉQUIPEMENT (Besoins IT Integration) ============
let envois = JSON.parse(localStorage.getItem('laboEnvoisV1')) || defaultEnvois;
let nextEnvoiId = envois.length > 0 ? Math.max(...envois.map(e => e.id)) + 1 : 1;
let editingEnvoiId = null;
let tempUploadedImageBase64 = null;
let envoiLocalImages = loadLocalImageStore(ENVOI_IMAGE_STORE_KEY);

let pannes = [];
let editingPanneId = null;
let tempPanneImageBase64 = null;
let panneLocalImages = loadLocalImageStore(PANNE_IMAGE_STORE_KEY);
window.currentPannesPage = 1;

function handleEnvoiImageUpload(event) {
    const file = event.target.files[0];
    const nameSpan = document.getElementById('envoiImageName');
    if (file) {
        if (false && file.size > 2 * 1024 * 1024) {
            showToast("⚠️ Image trop lourde (max 2Mo)", "red");
            event.target.value = '';
            if (nameSpan) nameSpan.textContent = '';
            tempUploadedImageBase64 = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            tempUploadedImageBase64 = e.target.result;
            if (nameSpan) {
                nameSpan.textContent = `📷 ${file.name} chargée`;
                nameSpan.style.color = '#10b981';
            }
        };
        reader.readAsDataURL(file);
    } else {
        tempUploadedImageBase64 = null;
        if (nameSpan) nameSpan.textContent = '';
    }
}

function saveEnvois() {
    localStorage.setItem('laboEnvoisV1', JSON.stringify(envois));
    updateBesoinsStats();
    renderEnvoisTable();
}

function switchBesoinsTab(tab) {
    currentBesoinsTab = tab;
    
    const tabDemandes = document.getElementById('besoinsTabContent');
    const tabEnvois = document.getElementById('envoisTabContent');
    const tabPannes = document.getElementById('pannesTabContent');
    const btnDemandes = document.getElementById('tabDemandesBtn');
    const btnEnvois = document.getElementById('tabEnvoisBtn');
    const btnPannes = document.getElementById('tabPannesBtn');

    // Hide all tab contents
    if (tabDemandes) tabDemandes.style.display = 'none';
    if (tabEnvois) tabEnvois.style.display = 'none';
    if (tabPannes) tabPannes.style.display = 'none';

    // Remove active class from all buttons
    if (btnDemandes) {
        btnDemandes.classList.remove('active');
        btnDemandes.style.color = 'var(--text-muted)';
        btnDemandes.style.borderBottomColor = 'transparent';
    }
    if (btnEnvois) {
        btnEnvois.classList.remove('active');
        btnEnvois.style.color = 'var(--text-muted)';
        btnEnvois.style.borderBottomColor = 'transparent';
    }
    if (btnPannes) {
        btnPannes.classList.remove('active');
        btnPannes.style.color = 'var(--text-muted)';
        btnPannes.style.borderBottomColor = 'transparent';
    }

    // Show and activate the selected tab
    if (tab === 'demandes') {
        if (tabDemandes) tabDemandes.style.display = 'block';
        if (btnDemandes) {
            btnDemandes.classList.add('active');
            btnDemandes.style.color = '#ec4899';
            btnDemandes.style.borderBottomColor = '#ec4899';
        }
    } else if (tab === 'envois') {
        if (tabEnvois) tabEnvois.style.display = 'block';
        if (btnEnvois) {
            btnEnvois.classList.add('active');
            btnEnvois.style.color = 'var(--blue-500)';
            btnEnvois.style.borderBottomColor = 'var(--blue-500)';
        }
    } else if (tab === 'pannes') {
        if (tabPannes) tabPannes.style.display = 'block';
        if (btnPannes) {
            btnPannes.classList.add('active');
            btnPannes.style.color = '#f59e0b';
            btnPannes.style.borderBottomColor = '#f59e0b';
        }
        renderPannesTable();
    }
    
    updateBesoinsStats();
}

function handlePanneImageUpload(event) {
    const file = event.target.files[0];
    const nameSpan = document.getElementById('panneImageName');
    if (file) {
        if (false && file.size > 2 * 1024 * 1024) {
            showToast("⚠️ Image trop lourde (max 2Mo)", "red");
            event.target.value = '';
            if (nameSpan) nameSpan.textContent = '';
            tempPanneImageBase64 = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            tempPanneImageBase64 = e.target.result;
            if (nameSpan) {
                nameSpan.textContent = `📷 ${file.name} chargée`;
                nameSpan.style.color = '#f59e0b';
            }
        };
        reader.readAsDataURL(file);
    } else {
        tempPanneImageBase64 = null;
        if (nameSpan) nameSpan.textContent = '';
    }
}

function openNewPanneForm() {
    editingPanneId = null;
    document.getElementById('panneFormTitle').textContent = "Signalement de Panne & Diagnostic";
    document.getElementById('panneFormSub').textContent = "Enregistrez un matériel informatique en panne et générez sa fiche technique d'impression.";

    // Reset inputs
    const select = document.getElementById('panneEquipementSelect');
    if (select) select.value = '';
    
    document.getElementById('panneEquipementName').value = '';
    document.getElementById('panneSN').value = '';
    document.getElementById('panneType').selectedIndex = 0;
    document.getElementById('panneService').value = '';
    document.getElementById('panneDeclarant').value = '';
    document.getElementById('panneTelephone').value = '';
    document.getElementById('panneGravite').value = 'Moyenne';
    document.getElementById('panneDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('panneNotes').value = '';
    
    tempPanneImageBase64 = null;
    const imgInput = document.getElementById('panneImage');
    if (imgInput) imgInput.value = '';
    const imgName = document.getElementById('panneImageName');
    if (imgName) imgName.textContent = '';

    // Populate the dropdown list dynamically
    if (select) {
        select.innerHTML = '<option value="">-- Autre matériel (Saisie libre) --</option>';
        
        // Add Devices (Computers)
        if (devices && devices.length > 0) {
            const optGroupDevices = document.createElement('optgroup');
            optGroupDevices.label = "Ordinateurs (PC / Portables)";
            devices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = `device_${d.id}`;
                opt.textContent = `${d.type} - ${d.model} (${d.sn})`;
                optGroupDevices.appendChild(opt);
            });
            select.appendChild(optGroupDevices);
        }
        
        // Add Printers
        if (printers && printers.length > 0) {
            const optGroupPrinters = document.createElement('optgroup');
            optGroupPrinters.label = "Imprimantes";
            printers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = `printer_${p.id}`;
                opt.textContent = `Imprimante - ${p.model} (${p.sn})`;
                optGroupPrinters.appendChild(opt);
            });
            select.appendChild(optGroupPrinters);
        }
    }

    showView('panneFormView');
}

function closePanneForm() {
    showView('besoinsView');
    switchBesoinsTab('pannes');
}

function handlePanneEquipementSelectChange() {
    const select = document.getElementById('panneEquipementSelect');
    const val = select ? select.value : '';
    
    const inputName = document.getElementById('panneEquipementName');
    const inputSN = document.getElementById('panneSN');
    const inputType = document.getElementById('panneType');
    const inputService = document.getElementById('panneService');
    
    if (!val) {
        if (inputName) inputName.value = '';
        if (inputSN) inputSN.value = '';
        if (inputType) inputType.selectedIndex = 0;
        if (inputService) inputService.value = '';
        return;
    }
    
    if (val.startsWith('device_')) {
        const deviceId = val.substring('device_'.length);
        const d = devices.find(x => x.id === deviceId);
        if (d) {
            if (inputName) inputName.value = d.model;
            if (inputSN) inputSN.value = d.sn;
            if (inputType) {
                const typeText = d.type.toLowerCase();
                if (typeText.includes('portable') || typeText.includes('laptop')) {
                    inputType.value = "Ordinateur Portable (Laptop)";
                } else if (typeText.includes('bureau') || typeText.includes('desktop') || typeText.includes('pc') || typeText.includes('unite')) {
                    inputType.value = "Ordinateur Bureau (Desktop)";
                } else {
                    inputType.value = "Ordinateur Bureau (Desktop)";
                }
            }
            if (inputService) inputService.value = d.service;
        }
    } else if (val.startsWith('printer_')) {
        const printerId = val.substring('printer_'.length);
        const p = printers.find(x => x.id === printerId);
        if (p) {
            if (inputName) inputName.value = p.model;
            if (inputSN) inputSN.value = p.sn;
            if (inputType) inputType.value = "Imprimante (Printer)";
            if (inputService) inputService.value = p.location;
        }
    }
}

function savePanneItem() {
    const equipement = document.getElementById('panneEquipementName').value.trim();
    const sn = document.getElementById('panneSN').value.trim();
    const type = document.getElementById('panneType').value;
    const service = document.getElementById('panneService').value.trim();
    const declarant = document.getElementById('panneDeclarant').value.trim();
    const telephone = document.getElementById('panneTelephone').value.trim();
    const gravite = document.getElementById('panneGravite').value;
    const date = document.getElementById('panneDate').value;
    const notes = document.getElementById('panneNotes').value.trim();

    if (!equipement || !sn || !service || !declarant || !date || !notes) {
        showToast("⚠️ Veuillez remplir tous les champs obligatoires (*)", "red");
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    let docId = editingPanneId === null ? String(Date.now()) : String(editingPanneId);
    const existingPanne = editingPanneId === null ? null : pannes.find(p => p.id === String(editingPanneId));

    const panneData = {
        equipement,
        sn,
        type,
        service,
        declarant,
        telephone,
        gravite,
        date,
        notes,
        imageBase64: firebase.firestore.FieldValue.delete(),
        status: editingPanneId === null ? 'En attente' : (existingPanne?.status || 'En attente'),
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("itPannes").doc(docId).set(panneData, { merge: true })
        .then(() => {
            if (tempPanneImageBase64) {
                panneLocalImages = setLocalImage(panneLocalImages, docId, tempPanneImageBase64);
                saveLocalImageStore(PANNE_IMAGE_STORE_KEY, panneLocalImages);
            }
            logActivity('PANNES', 'SIGNALEMENT', `Signalement de panne enregistré pour ${equipement} (${sn})`);
            showToast(editingPanneId === null ? "✅ Signalement de panne enregistré !" : "✏️ Signalement de panne mis à jour !", "green");
            
            closePanneForm();
        })
        .catch(err => {
            console.error("Firestore save panne error:", err);
            showToast("❌ Échec de l'enregistrement sur Firebase", "red");
        });
}

function deletePanne(id) {
    showCustomConfirm(
        "Supprimer le Signalement",
        `Voulez-vous vraiment supprimer définitivement cette fiche de panne ?`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itPannes").doc(String(id)).delete()
                .then(() => {
                    panneLocalImages = removeLocalImage(panneLocalImages, id);
                    saveLocalImageStore(PANNE_IMAGE_STORE_KEY, panneLocalImages);
                    logActivity('PANNES', 'SUPPR', `Fiche de panne supprimée: ${id}`);
                    showToast('🗑️ Fiche de panne supprimée', 'blue');
                })
                .catch(err => {
                    console.error("Firestore delete panne error:", err);
                    showToast("❌ Échec de la suppression sur Firebase", "red");
                });
        },
        null,
        true
    );
}

function editPanne(id) {
    const p = pannes.find(x => x.id === String(id));
    if (!p) return;

    editingPanneId = String(id);
    document.getElementById('panneFormTitle').textContent = "Modifier le Signalement de Panne";
    document.getElementById('panneFormSub').textContent = "Modifiez les détails de l'équipement défectueux et mettez à jour le diagnostic.";

    const select = document.getElementById('panneEquipementSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Autre matériel (Saisie libre) --</option>';
        
        if (devices && devices.length > 0) {
            const optGroupDevices = document.createElement('optgroup');
            optGroupDevices.label = "Ordinateurs (PC / Portables)";
            devices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = `device_${d.id}`;
                opt.textContent = `${d.type} - ${d.model} (${d.sn})`;
                optGroupDevices.appendChild(opt);
            });
            select.appendChild(optGroupDevices);
        }
        
        if (printers && printers.length > 0) {
            const optGroupPrinters = document.createElement('optgroup');
            optGroupPrinters.label = "Imprimantes";
            printers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = `printer_${p.id}`;
                opt.textContent = `Imprimante - ${p.model} (${p.sn})`;
                optGroupPrinters.appendChild(opt);
            });
            select.appendChild(optGroupPrinters);
        }
        
        let matchedVal = '';
        const foundDevice = devices.find(d => d.sn === p.sn);
        const foundPrinter = printers.find(pr => pr.sn === p.sn);
        if (foundDevice) matchedVal = `device_${foundDevice.id}`;
        else if (foundPrinter) matchedVal = `printer_${foundPrinter.id}`;
        select.value = matchedVal;
    }

    document.getElementById('panneEquipementName').value = p.equipement;
    document.getElementById('panneSN').value = p.sn;
    document.getElementById('panneType').value = p.type;
    document.getElementById('panneService').value = p.service;
    document.getElementById('panneDeclarant').value = p.declarant;
    document.getElementById('panneTelephone').value = p.telephone || '';
    document.getElementById('panneGravite').value = p.gravite;
    document.getElementById('panneDate').value = p.date;
    document.getElementById('panneNotes').value = p.notes || '';

    tempPanneImageBase64 = getLocalImage(panneLocalImages, id);
    const imgInput = document.getElementById('panneImage');
    if (imgInput) imgInput.value = '';
    const imgName = document.getElementById('panneImageName');
    if (imgName) {
        imgName.textContent = tempPanneImageBase64 ? 'Image existante chargée' : '';
        imgName.style.color = tempPanneImageBase64 ? '#f59e0b' : '';
    }

    showView('panneFormView');
}

function triggerPannePrint(id) {
    const p = pannes.find(x => x.id === String(id));
    if (!p) return;
    printPanneSheet(p, getLocalImage(panneLocalImages, id) || null);
}

function changePanneStatus(id) {
    const p = pannes.find(x => x.id === String(id));
    if (!p) return;

    // Create the custom modal elements
    const overlay = document.createElement('div');
    overlay.id = 'customStatusModalOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(15, 23, 42, 0.6)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    const card = document.createElement('div');
    card.style.background = 'var(--bg-card, #ffffff)';
    card.style.border = '1px solid var(--border-color, #cbd5e1)';
    card.style.borderRadius = '1.25rem';
    card.style.width = '420px';
    card.style.maxWidth = '90%';
    card.style.padding = '2rem';
    card.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
    card.style.transform = 'scale(0.9)';
    card.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '1.5rem';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const title = document.createElement('h3');
    title.textContent = "Statut de Maintenance";
    title.style.margin = '0';
    title.style.fontSize = '1.25rem';
    title.style.fontWeight = '700';
    title.style.color = 'var(--text-primary, #0f172a)';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.color = 'var(--text-muted, #64748b)';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.transition = 'color 0.2s';
    closeBtn.onmouseenter = () => closeBtn.style.color = 'var(--text-primary)';
    closeBtn.onmouseleave = () => closeBtn.style.color = 'var(--text-muted)';
    closeBtn.onclick = () => {
        overlay.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => overlay.remove(), 300);
    };

    header.appendChild(title);
    header.appendChild(closeBtn);
    card.appendChild(header);

    // Subtitle / Info
    const sub = document.createElement('p');
    sub.style.margin = '0';
    sub.style.fontSize = '0.9rem';
    sub.style.color = 'var(--text-secondary, #475569)';
    sub.appendChild(document.createTextNode("Modifier l'état de la fiche "));
    const strong = document.createElement('strong');
    strong.textContent = `#${p.id}`;
    sub.appendChild(strong);
    sub.appendChild(document.createTextNode(` (${p.equipement}).`));
    card.appendChild(sub);

    // Buttons Container
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.flexDirection = 'column';
    btnContainer.style.gap = '0.75rem';

    const statuses = [
        { key: 'En attente', label: 'En Attente de Prise en Charge', icon: 'fa-hourglass-half', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
        { key: 'En cours', label: 'En Cours de Diagnostic / Réparation', icon: 'fa-wrench', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
        { key: 'Réparé', label: 'Réparation Effectuée avec Succès', icon: 'fa-check-circle', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        { key: 'Déclassé', label: 'Matériel Inréparable / Déclassé', icon: 'fa-ban', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
    ];

    statuses.forEach(s => {
        const btn = document.createElement('button');
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '1rem';
        btn.style.width = '100%';
        btn.style.padding = '1rem';
        btn.style.borderRadius = '0.75rem';
        btn.style.border = p.status === s.key ? `2px solid ${s.color}` : '1px solid var(--border-color, #cbd5e1)';
        btn.style.background = p.status === s.key ? s.bg : 'var(--bg-secondary, #f8fafc)';
        btn.style.color = 'var(--text-primary, #0f172a)';
        btn.style.fontWeight = '700';
        btn.style.fontSize = '0.95rem';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        btn.style.outline = 'none';

        // Icon
        const iconWrapper = document.createElement('div');
        iconWrapper.style.width = '34px';
        iconWrapper.style.height = '34px';
        iconWrapper.style.borderRadius = '50%';
        iconWrapper.style.background = s.bg;
        iconWrapper.style.color = s.color;
        iconWrapper.style.display = 'flex';
        iconWrapper.style.alignItems = 'center';
        iconWrapper.style.justifyContent = 'center';
        const icon = document.createElement('i');
        icon.className = `fas ${s.icon}`;
        iconWrapper.appendChild(icon);
        btn.appendChild(iconWrapper);
        
        const labelText = document.createElement('span');
        labelText.textContent = s.label;
        btn.appendChild(labelText);

        // Hover effect
        btn.onmouseenter = () => {
            if (p.status !== s.key) {
                btn.style.borderColor = s.color;
                btn.style.background = s.bg;
                btn.style.transform = 'translateY(-2px)';
            }
        };
        btn.onmouseleave = () => {
            if (p.status !== s.key) {
                btn.style.borderColor = 'var(--border-color, #cbd5e1)';
                btn.style.background = 'var(--bg-secondary, #f8fafc)';
                btn.style.transform = 'translateY(0)';
            }
        };

        btn.onclick = () => {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }

            db.collection("itPannes").doc(String(id)).update({
                status: s.key,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            })
            .then(() => {
                logActivity('PANNES', 'STATUT', `Statut mis à jour pour fiche N° ${id} : ${s.key}`);
                showToast(`✅ Statut mis à jour : ${s.key}`, "green");
                closeBtn.click();
            })
            .catch(err => {
                console.error("Firestore update status error:", err);
                showToast("❌ Échec de la mise à jour du statut", "red");
            });
        };

        btnContainer.appendChild(btn);
    });

    card.appendChild(btnContainer);

    // Cancel Button at bottom
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = "Annuler";
    cancelBtn.style.padding = '0.75rem';
    cancelBtn.style.borderRadius = '0.75rem';
    cancelBtn.style.border = '1px solid var(--border-color, #cbd5e1)';
    cancelBtn.style.background = 'var(--bg-secondary, #f8fafc)';
    cancelBtn.style.color = 'var(--text-muted, #64748b)';
    cancelBtn.style.fontWeight = '600';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.transition = 'all 0.2s';
    cancelBtn.onclick = () => closeBtn.click();
    cancelBtn.onmouseenter = () => {
        cancelBtn.style.background = 'var(--border-color, #cbd5e1)';
        cancelBtn.style.color = 'var(--text-primary, #0f172a)';
    };
    cancelBtn.onmouseleave = () => {
        cancelBtn.style.background = 'var(--bg-secondary, #f8fafc)';
        cancelBtn.style.color = 'var(--text-muted, #64748b)';
    };
    card.appendChild(cancelBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Fade in animation
    setTimeout(() => {
        overlay.style.opacity = '1';
        card.style.transform = 'scale(1)';
    }, 10);
}

function printPanneSheet(p, imgBase64) {
    const printWindow = window.open('', '_blank', 'width=950,height=1150');
    if (!printWindow) {
        showToast("Pop-up bloqué ! Veuillez autoriser les pop-ups pour imprimer.", "red");
        return;
    }

    let gravityColor = '#3b82f6';
    if (p.gravite === 'Moyenne') gravityColor = '#f59e0b';
    else if (p.gravite === 'Haute') gravityColor = '#ea580c';
    else if (p.gravite === 'Critique') gravityColor = '#dc2626';

    let techIllustration = '';
    if (imgBase64 && /^data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+$/.test(imgBase64)) {
        techIllustration = `
            <div style="text-align: center; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #ffffff; width: 100%; display: flex; justify-content: center; align-items: center; height: 100%;">
                <img src="${imgBase64}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;" alt="Visuel Panne">
            </div>`;
    } else {
        const lowerType = (p.type || '').toLowerCase();
        const lowerEquip = (p.equipement || '').toLowerCase();
        
        let svgGraphic = '';
        if (lowerType.includes('onduleur') || lowerType.includes('ups') || lowerEquip.includes('onduleur')) {
            svgGraphic = `
                <svg width="130" height="130" viewBox="0 0 150 200" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <rect x="25" y="15" width="100" height="170" rx="12" fill="#dc2626" opacity="0.8" />
                    <rect x="28" y="18" width="94" height="164" rx="10" fill="#0f172a" />
                    <line x1="45" y1="28" x2="105" y2="28" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
                    <circle cx="45" cy="45" r="3" fill="#ef4444" />
                    <circle cx="55" cy="45" r="3" fill="#ef4444" />
                    <circle cx="65" cy="45" r="3" fill="#dc2626" />
                    <rect x="40" y="55" width="70" height="12" rx="4" fill="#334155" />
                    <circle cx="75" cy="61" r="3" fill="#ef4444" />
                    <rect x="40" y="80" width="70" height="45" rx="6" fill="#1e293b" stroke="#ef4444" stroke-width="1.5" />
                    <text x="75" y="106" font-family="'Segoe UI', Tahoma, Arial" font-weight="bold" font-size="20" fill="#ef4444" text-anchor="middle">PANNE</text>
                    <text x="75" y="155" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill="#475569" text-anchor="middle" letter-spacing="1">APC</text>
                </svg>`;
        } else if (lowerType.includes('portable') || lowerType.includes('laptop') || lowerType.includes('pc') || lowerEquip.includes('pc') || lowerEquip.includes('laptop') || lowerEquip.includes('ordinateur')) {
            svgGraphic = `
                <svg width="130" height="130" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <rect x="20" y="25" width="110" height="75" rx="6" fill="#475569" />
                    <rect x="25" y="30" width="100" height="65" rx="4" fill="#0f172a" />
                    <line x1="30" y1="35" x2="120" y2="125" stroke="#ef4444" stroke-width="3" />
                    <line x1="120" y1="35" x2="30" y2="125" stroke="#ef4444" stroke-width="3" />
                    <path d="M10,103 L140,103 L150,118 L0,118 Z" fill="#64748b" />
                </svg>`;
        } else if (lowerType.includes('imprimante') || lowerEquip.includes('imprimante') || lowerEquip.includes('printer')) {
            svgGraphic = `
                <svg width="130" height="130" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <path d="M30,30 L120,30 L120,55 L30,55 Z" fill="#94a3b8" />
                    <rect x="20" y="50" width="110" height="60" rx="8" fill="#475569" />
                    <rect x="25" y="55" width="100" height="50" rx="6" fill="#334155" />
                    <line x1="30" y1="35" x2="120" y2="125" stroke="#ef4444" stroke-width="3" />
                    <line x1="120" y1="35" x2="30" y2="125" stroke="#ef4444" stroke-width="3" />
                    <path d="M35,105 L115,105 L125,128 L25,128 Z" fill="#cbd5e1" />
                </svg>`;
        } else {
            svgGraphic = `
                <svg width="130" height="130" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <rect x="25" y="25" width="100" height="100" rx="10" fill="#475569" />
                    <line x1="25" y1="25" x2="125" y2="125" stroke="#ef4444" stroke-width="4" />
                    <line x1="125" y1="25" x2="25" y2="125" stroke="#ef4444" stroke-width="4" />
                </svg>`;
        }
        techIllustration = `
            <div style="text-align: center; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 15px; background: #f8fafc; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                ${svgGraphic}
                <div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 8px; text-transform: uppercase;">Aucun visuel fourni</div>
            </div>`;
    }

    const declarantTelephoneHtml = escapeHTML(p.declarant || 'N/A') +
        (p.telephone ? ' <span style="color: #64748b; font-weight: 600; font-size: 13px; font-family: monospace;">(' + escapeHTML(p.telephone) + ')</span>' : '');

    const content = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Fiche de Panne - N° ${escapeHTML(p.id)}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                html, body {
                    height: 100%;
                    overflow: hidden;
                }
                body {
                    font-family: 'Inter', 'Cairo', sans-serif;
                    color: #1e293b;
                    background-color: #f1f5f9;
                    padding: 20px;
                    margin: 0;
                    font-size: 13px;
                    line-height: 1.4;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .document-wrapper {
                    width: 210mm;
                    height: 297mm;
                    background: #ffffff;
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    padding: 30px 40px 25px 40px;
                }

                .tech-banner {
                    background-color: #0f172a;
                    background-image: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    color: #ffffff;
                    padding: 16px 28px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 4px solid #f59e0b;
                    border-radius: 6px;
                }
                .company-logo-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .company-name {
                    font-size: 22px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: #ffffff;
                }
                .company-sub {
                    font-size: 9px;
                    font-weight: 600;
                    color: #94a3b8;
                    letter-spacing: 2.5px;
                    text-transform: uppercase;
                }
                .tech-circle {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: rgba(245, 158, 11, 0.12);
                    border: 2px solid rgba(245, 158, 11, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .main-content {
                    padding: 15px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    flex-grow: 1;
                    height: 100%;
                }

                .title-block {
                    text-align: center;
                    margin-bottom: 8px;
                }
                .title-block h1 {
                    font-size: 21px;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .title-underline {
                    width: 160px;
                    height: 3.5px;
                    background: #f59e0b;
                    margin: 0 auto 4px auto;
                    border-radius: 2px;
                }
                .intro-text {
                    font-size: 13px;
                    color: #475569;
                    text-align: center;
                    margin-bottom: 2px;
                    font-style: italic;
                }

                .details-box {
                    border: 1.5px solid #cbd5e1;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #ffffff;
                    position: relative;
                    margin-bottom: 12px !important;
                    flex-shrink: 0 !important; /* Prevent flex squishing */
                }
                .details-box-header {
                    background-color: #0f172a;
                    color: #ffffff;
                    padding: 6px 18px;
                    font-weight: 700;
                    font-size: 10px;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    display: inline-block;
                    clip-path: polygon(0 0, 92% 0, 100% 100%, 0 100%);
                    min-width: 160px;
                    border-bottom: 2px solid #f59e0b;
                }
                .details-box-content {
                    padding: 12px 18px 20px 18px !important; /* Spacious bottom padding */
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px !important;
                }
                .info-item {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .info-item .label {
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #64748b;
                    font-weight: 600;
                }
                .info-item .value {
                    font-size: 14px;
                    font-weight: 700;
                    color: #0f172a;
                }
                .info-item .badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    color: #ffffff;
                    font-weight: 700;
                    font-size: 11px;
                    text-align: center;
                    width: fit-content;
                }

                .split-layout {
                    display: grid;
                    grid-template-columns: 1.25fr 0.75fr;
                    gap: 15px;
                    height: 220px !important; /* Optimized to fit perfectly on single-page A4 */
                    flex-shrink: 0 !important;
                }

                .tech-checklist {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    padding-top: 6px;
                }
                .check-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    color: #334155;
                }
                .check-box-square {
                    width: 18px;
                    height: 18px;
                    border: 2px solid #64748b;
                    border-radius: 4px;
                    display: inline-block;
                }

                .signatures-section {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 50px;
                    margin-top: 15px !important;
                    border-top: 1.5px dashed #cbd5e1;
                    padding-top: 15px !important;
                    flex-shrink: 0 !important;
                }
                .signature-col {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .signature-title {
                    font-size: 11px;
                    font-weight: 700;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .signature-line {
                    border-bottom: 1.5px dashed #94a3b8;
                    height: 60px !important;
                    margin-top: 5px;
                }

                .footer-address {
                    text-align: center;
                    font-size: 10px;
                    color: #64748b;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 10px;
                    margin-top: auto;
                    line-height: 1.5;
                }
                .orange-bar {
                    height: 6px;
                    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
                    margin-top: 10px;
                    border-radius: 3px;
                }

                @media print {
                    body {
                        background: #ffffff;
                        padding: 0;
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .document-wrapper {
                        border: none;
                        box-shadow: none;
                        padding: 10mm 12mm;
                        width: 100% !important;
                        height: 100vh !important;
                        box-sizing: border-box;
                    }
                }
            </style>
        </head>
        <body>
            <div class="document-wrapper">
                <div class="tech-banner">
                    <div class="company-logo-text">
                        <div class="company-name">LABO NEDJMA</div>
                        <div class="company-sub">Fiche de Diagnostic & Panne</div>
                    </div>
                    <div class="tech-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                        </svg>
                    </div>
                </div>

                <div class="main-content">
                    <div class="title-block">
                        <h1>Fiche Technique de Maintenance</h1>
                        <div class="title-underline"></div>
                        <div class="intro-text">Ce document doit être obligatoirement collé sur l'appareil défectueux avant son envoi au technicien.</div>
                    </div>

                    <div class="details-box">
                        <div class="details-box-header">Identification du Matériel</div>
                        <div class="details-box-content">
                            <div class="info-grid">
                                <div class="info-item">
                                    <span class="label">Désignation Équipement</span>
                                    <span class="value" style="color: #0f172a; font-weight: 800;">${escapeHTML(p.equipement)}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Numéro de Fiche</span>
                                    <span class="value" style="color: #2563eb; font-weight: 800;">N° ${escapeHTML(p.id)}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Numéro de Série (S/N)</span>
                                    <span class="value" style="font-family: monospace; font-size: 14px; font-weight: 700; color: #334155;">${escapeHTML(p.sn)}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Type de Matériel</span>
                                    <span class="value">${escapeHTML(p.type)}</span>
                                </div>
                                <div class="info-item" style="grid-column: span 2; height: 1px; background: #e2e8f0; margin: 4px 0;"></div>
                                <div class="info-item">
                                    <span class="label">Service Émetteur</span>
                                    <span class="value" style="font-weight: 700;">${escapeHTML(p.service)}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Déclarant de la Panne</span>
                                    <span class="value">${declarantTelephoneHtml}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Date Signalement</span>
                                    <span class="value">${new Date(p.date).toLocaleDateString('fr-FR')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="label">Niveau de Gravité</span>
                                    <span class="badge" style="background-color: ${gravityColor};">${escapeHTML(p.gravite)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="split-layout">
                        <div class="details-box" style="height: 100%; margin-bottom: 0;">
                            <div class="details-box-header">Symptômes & Problèmes Signalés</div>
                            <div class="details-box-content" style="font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-line; height: calc(100% - 24px); overflow: auto;">
                                ${escapeHTML(p.notes)}
                            </div>
                        </div>
                        
                        <div class="details-box" style="height: 100%; margin-bottom: 0;">
                            <div class="details-box-header">Aperçu / Visuel Panne</div>
                            <div class="details-box-content" style="height: calc(100% - 24px); padding: 8px;">
                                ${techIllustration}
                            </div>
                        </div>
                    </div>

                    <div class="details-box" style="margin-top: 16px; margin-bottom: 16px;">
                        <div class="details-box-header">Actions du Technicien de Maintenance (Réservé à l'Atelier)</div>
                        <div class="details-box-content">
                            <div class="tech-checklist">
                                <div class="check-item"><span class="check-box-square"></span> Prise en charge effectuée</div>
                                <div class="check-item"><span class="check-box-square"></span> Diagnostic matériel confirmé</div>
                                <div class="check-item" style="grid-column: span 2; margin-top: 5px;">
                                    <span class="check-box-square" style="vertical-align: middle; margin-right: 5px;"></span> Pièces de rechange requises. Liste : _______________________________________________
                                </div>
                                <div class="check-item" style="margin-top: 5px;"><span class="check-box-square"></span> Réparation effectuée avec succès</div>
                                <div class="check-item" style="margin-top: 5px;"><span class="check-box-square"></span> Matériel déclassé (Irréparable)</div>
                            </div>
                            <div style="margin-top: 20px; font-size: 12px; color: #475569; font-weight: 600;">
                                Note du Technicien : ____________________________________________________________________________________________
                            </div>
                        </div>
                    </div>

                    <div class="signatures-section">
                        <div class="signature-col">
                            <span class="signature-title">Déclarant de la Panne</span>
                            <div style="font-size: 11px; font-weight: 600; color: #64748b;">Nom : ${escapeHTML(p.declarant)}</div>
                            <div class="signature-line"></div>
                        </div>
                        <div class="signature-col">
                            <span class="signature-title">Technicien de Maintenance</span>
                            <div style="font-size: 11px; font-weight: 600; color: #64748b;">Date & Signature</div>
                            <div class="signature-line"></div>
                        </div>
                    </div>

                    <div class="footer-address">
                        Cité El Fahs Zone d'Activité Larbaâ Blida | Service Maintenance Informatique IT<br>
                        Tél : +213 (0)23 31 71 02 - Email : contact@labo-nedjma.com
                        <div class="orange-bar"></div>
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                }
            <\/script>
        </body>
        </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
}

function renderPannesTable() {
    const tbody = document.getElementById('pannesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchInput = document.getElementById('panneSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = pannes.filter(p => {
        const equip = (p.equipement || '').toLowerCase();
        const sn = (p.sn || '').toLowerCase();
        const dec = (p.declarant || '').toLowerCase();
        const tel = (p.telephone || '').toLowerCase();
        const serv = (p.service || '').toLowerCase();
        return equip.includes(query) || sn.includes(query) || dec.includes(query) || tel.includes(query) || serv.includes(query);
    });

    filtered.sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idB - idA;
    });

    window.currentPannesData = filtered;

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    if (window.currentPannesPage > totalPages) {
        window.currentPannesPage = totalPages;
    }
    if (window.currentPannesPage < 1) {
        window.currentPannesPage = 1;
    }

    const startIndex = (window.currentPannesPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filtered.slice(startIndex, endIndex);

    if (totalItems === 0) {
        tbody.innerHTML = '<tr>' +
            '<td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem; font-style: italic;">' +
            'Aucun signalement de panne trouvé.' +
            '</td>' +
            '</tr>';
        
        renderPannesPagination(0, 1, 1);
        return;
    }

    pageData.forEach(p => {
        const tr = document.createElement('tr');
        const dateFormatee = p.date ? new Date(p.date).toLocaleDateString('fr-FR') : 'N/A';

        let gravColor = '#10b981';
        if (p.gravite === 'Moyenne') {
            gravColor = '#f59e0b';
        } else if (p.gravite === 'Haute') {
            gravColor = '#ea580c';
        } else if (p.gravite === 'Critique') {
            gravColor = '#dc2626';
        }
        
        const gravBadge = `<td><span class="status-badge-table" style="background: rgba(245, 158, 11, 0.05); color: ` + gravColor + `; border: 1px solid ` + gravColor + `; font-weight: 700; padding: 0.2rem 0.6rem; font-size: 0.75rem;">` + escapeHTML(p.gravite) + `</span></td>`;

        let statusBadge = '';
        if (p.status === 'En attente') {
            statusBadge = '<td><span class="status-badge-table status-pending" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;"><i class="fas fa-hourglass-half" style="margin-right:4px;"></i> En Attente</span></td>';
        } else if (p.status === 'En cours') {
            statusBadge = '<td><span class="status-badge-table status-maintenance" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;"><i class="fas fa-wrench" style="margin-right:4px;"></i> En Cours</span></td>';
        } else if (p.status === 'Réparé') {
            statusBadge = '<td><span class="status-badge-table status-active" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;"><i class="fas fa-check-circle" style="margin-right:4px;"></i> Réparé</span></td>';
        } else {
            statusBadge = '<td><span class="status-badge-table" style="background: rgba(100, 116, 139, 0.1); color: #64748b; border: 1px solid #64748b; padding: 0.2rem 0.6rem; font-size: 0.75rem;"><i class="fas fa-ban" style="margin-right:4px;"></i> Déclassé</span></td>';
        }

        safeSetHTML(tr, '<td style="font-weight: 700; color: var(--text-muted);">#' + escapeHTML(p.id) + '</td>' +
            '<td style="font-weight: 700; color: var(--text-primary);">' + escapeHTML(p.equipement) + '</td>' +
            '<td><code style="background:var(--bg-secondary); padding:0.2rem 0.6rem; border-radius:0.5rem; font-size:0.8rem; border:1px solid var(--border-color);">' + escapeHTML(p.sn) + '</code></td>' +
            '<td style="font-weight: 600;">' + escapeHTML(p.service) + '</td>' +
            '<td>' + escapeHTML(p.declarant) + (p.telephone ? '<br><small style="color: var(--text-muted); font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-weight: 500;"><i class="fas fa-phone-alt" style="font-size: 0.7rem; color: #f59e0b;"></i> ' + escapeHTML(p.telephone) + '</small>' : '') + '</td>' +
            '<td>' + escapeHTML(dateFormatee) + '</td>' +
            gravBadge +
            statusBadge +
            '<td>' +
            '<div class="action-btns" style="justify-content: center; gap: 0.4rem; align-items: center;">' +
            '<button class="action-btn" title="Changer Statut" onclick="changePanneStatus(' + escapeHTML(p.id) + ')" style="color: #f59e0b;">' +
            '<i class="fas fa-tasks"></i>' +
            '</button>' +
            '<button class="action-btn" title="Modifier" onclick="editPanne(' + escapeHTML(p.id) + ')">' +
            '<i class="fas fa-edit"></i>' +
            '</button>' +
            '<button class="action-btn" title="Imprimer PDF" onclick="triggerPannePrint(' + escapeHTML(p.id) + ')" style="color: #3b82f6;">' +
            '<i class="fas fa-file-pdf"></i>' +
            '</button>' +
            '<button class="action-btn delete" title="Supprimer" onclick="deletePanne(' + escapeHTML(p.id) + ')">' +
            '<i class="fas fa-trash-alt"></i>' +
            '</button>' +
            '</div>' +
            '</td>');
        tbody.appendChild(tr);
    });

    renderPannesPagination(totalItems, totalPages, window.currentPannesPage);
}

function renderPannesPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('pannesPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, "fiches de panne", 'changePannesPage');
    safeSetHTML(container, html);
}

function changePannesPage(page) {
    window.currentPannesPage = page;
    renderPannesTable();
    
    const tableWrapper = document.getElementById('pannesPagination');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function filterPannesTable() {
    window.currentPannesPage = 1;
    renderPannesTable();
}

// Expose panne functions globally
window.switchBesoinsTab = switchBesoinsTab;
window.handlePanneImageUpload = handlePanneImageUpload;
window.openNewPanneForm = openNewPanneForm;
window.closePanneForm = closePanneForm;
window.handlePanneEquipementSelectChange = handlePanneEquipementSelectChange;
window.savePanneItem = savePanneItem;
window.deletePanne = deletePanne;
window.editPanne = editPanne;
window.triggerPannePrint = triggerPannePrint;
window.changePanneStatus = changePanneStatus;
window.printPanneSheet = printPanneSheet;
window.renderPannesTable = renderPannesTable;
window.changePannesPage = changePannesPage;
window.filterPannesTable = filterPannesTable;

// ============ Besoins IT Dropdown Navigation ============
function toggleBesoinDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('besoinDropdown');
    if (dropdown) dropdown.classList.toggle('open');
}

function navigateBesoinTab(tab) {
    const dropdown = document.getElementById('besoinDropdown');
    if (dropdown) dropdown.classList.remove('open');
    showView('besoinsView');
    switchBesoinsTab(tab);
}

// Close dropdown when clicking anywhere outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('besoinDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

window.toggleBesoinDropdown = toggleBesoinDropdown;
window.navigateBesoinTab = navigateBesoinTab;

function openEnvoiForm() {
    editingEnvoiId = null;
    document.getElementById('envoiFormTitle').textContent = "Nouvelle Confirmation d'Envoi";
    document.getElementById('envoiFormSub').textContent = "Déclarez l'expédition d'ordinateurs, d'imprimantes ou de matériels vers un destinataire ou une succursale.";

    document.getElementById('envoiDestinataire').value = '';
    document.getElementById('envoiLieu').value = '';
    document.getElementById('envoiDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('envoiEquipement').value = '';
    document.getElementById('envoiType').value = '';
    document.getElementById('envoiMarque').value = '';
    document.getElementById('envoiEtat').value = '';
    document.getElementById('envoiQty').value = '';
    document.getElementById('envoiNotes').value = '';

    tempUploadedImageBase64 = null;
    const imgInput = document.getElementById('envoiImage');
    if (imgInput) imgInput.value = '';
    const imgName = document.getElementById('envoiImageName');
    if (imgName) imgName.textContent = '';

    showView('envoisFormView');
}

function closeEnvoiForm() {
    showView('besoinsView');
}

function editEnvoi(id) {
    const e = envois.find(x => String(x.id) === String(id));
    if (!e) return;

    editingEnvoiId = String(id);
    document.getElementById('envoiFormTitle').textContent = "Modifier la Confirmation d'Envoi";
    document.getElementById('envoiFormSub').textContent = "Modifier les détails de la confirmation d'expédition d'équipement.";

    document.getElementById('envoiDestinataire').value = e.destinataire;
    document.getElementById('envoiLieu').value = e.lieu;
    document.getElementById('envoiDate').value = e.date;
    document.getElementById('envoiEquipement').value = e.equipement;
    document.getElementById('envoiType').value = e.type;
    document.getElementById('envoiMarque').value = e.marque;
    document.getElementById('envoiEtat').value = e.etat;
    document.getElementById('envoiQty').value = e.qty;
    document.getElementById('envoiNotes').value = e.notes || '';

    tempUploadedImageBase64 = getLocalImage(envoiLocalImages, id);
    const imgInput = document.getElementById('envoiImage');
    if (imgInput) imgInput.value = '';
    const imgName = document.getElementById('envoiImageName');
    if (imgName) {
        imgName.textContent = tempUploadedImageBase64 ? 'Image existante chargée' : '';
        imgName.style.color = tempUploadedImageBase64 ? '#10b981' : '';
    }

    showView('envoisFormView');
}

function saveEnvoiItem() {
    const destinataire = document.getElementById('envoiDestinataire').value.trim();
    const lieu = document.getElementById('envoiLieu').value.trim();
    const date = document.getElementById('envoiDate').value;
    const equipement = document.getElementById('envoiEquipement').value.trim();
    const type = document.getElementById('envoiType').value.trim();
    const marque = document.getElementById('envoiMarque').value.trim();
    const etat = document.getElementById('envoiEtat').value.trim();
    const qty = parseInt(document.getElementById('envoiQty').value, 10);
    const notes = document.getElementById('envoiNotes').value.trim();

    if (!destinataire || !lieu || !date || !equipement || !type || !marque || !etat || isNaN(qty) || qty < 1) {
        showToast("⚠️ Veuillez remplir tous les champs obligatoires (*) avec des valeurs valides", "red");
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    let docId = editingEnvoiId === null ? String(envois.length > 0 ? Math.max(...envois.map(e => isNaN(Number(e.id)) ? 0 : Number(e.id))) + 1 : 1) : String(editingEnvoiId);
    const existingEnvoi = editingEnvoiId === null ? null : envois.find(e => String(e.id) === String(editingEnvoiId));

    const envoiData = {
        destinataire,
        lieu,
        date,
        equipement,
        type,
        marque,
        etat,
        qty,
        notes,
        imageBase64: firebase.firestore.FieldValue.delete(),
        livre: editingEnvoiId === null ? false : (existingEnvoi?.livre || false),
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("itEnvois").doc(docId).set(envoiData, { merge: true })
        .then(() => {
            if (tempUploadedImageBase64) {
                envoiLocalImages = setLocalImage(envoiLocalImages, docId, tempUploadedImageBase64);
                saveLocalImageStore(ENVOI_IMAGE_STORE_KEY, envoiLocalImages);
            }
            logActivity('ENVOIS', 'MODIF_AJOUT', `Expédition enregistrée pour ${destinataire} (${equipement})`);
            showToast(editingEnvoiId === null ? "✅ Confirmation d'envoi enregistrée !" : "✏️ Confirmation d'envoi mise à jour !", "green");
            closeEnvoiForm();
        })
        .catch(err => {
            console.error("Firestore save envoi error:", err);
            showToast("❌ Échec de l'enregistrement sur Firebase", "red");
        });
}

function deleteEnvoi(id) {
    showCustomConfirm(
        "Supprimer la Confirmation",
        `Voulez-vous vraiment supprimer définitivement cette confirmation d'envoi ?`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itEnvois").doc(String(id)).delete()
                .then(() => {
                    envoiLocalImages = removeLocalImage(envoiLocalImages, id);
                    saveLocalImageStore(ENVOI_IMAGE_STORE_KEY, envoiLocalImages);
                    logActivity('ENVOIS', 'SUPPR', `Expédition supprimée: ${id}`);
                    showToast('🗑️ Confirmation d\'envoi supprimée', 'blue');
                })
                .catch(err => {
                    console.error("Firestore delete envoi error:", err);
                    showToast("❌ Échec de la suppression sur Firebase", "red");
                });
        },
        null,
        true // delete style
    );
}

function renderEnvoisTable() {
    const tbody = document.getElementById('envoisTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchInput = document.getElementById('envoiSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = envois.filter(e => {
        const dest = (e.destinataire || '').toLowerCase();
        const lieu = (e.lieu || '').toLowerCase();
        const equip = (e.equipement || '').toLowerCase();
        const type = (e.type || '').toLowerCase();
        return dest.includes(query) || lieu.includes(query) || equip.includes(query) || type.includes(query);
    });

    // Sort by ID descending (most recent first)
    filtered.sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        if (idA !== idB) return idB - idA;
        const dA = a.date || '';
        const dB = b.date || '';
        return dB.localeCompare(dA);
    });

    // Save active dataset for pagination controls
    window.currentEnvoisData = filtered;

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Bounds safety checks
    if (window.currentEnvoisPage > totalPages) {
        window.currentEnvoisPage = totalPages;
    }
    if (window.currentEnvoisPage < 1) {
        window.currentEnvoisPage = 1;
    }

    const startIndex = (window.currentEnvoisPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filtered.slice(startIndex, endIndex);

    if (totalItems === 0) {
        tbody.innerHTML = '<tr>' +
            '<td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem; font-style: italic;">' +
            'Aucun envoi trouvé.' +
            '</td>' +
            '</tr>';
        
        renderEnvoisPagination(0, 1, 1);
        return;
    }

    pageData.forEach(e => {
        const tr = document.createElement('tr');
        const dateFormatee = e.date ? new Date(e.date).toLocaleDateString('fr-FR') : 'N/A';

        const statusBadge = e.livre === true ? 
            '<td><span class="status-badge-table status-active" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;"><i class="fas fa-check-circle" style="margin-right:4px;"></i> Livré</span></td>' : 
            '<td><span class="status-badge-table status-maintenance" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;"><i class="fas fa-truck" style="margin-right:4px;"></i> En Transit</span></td>';

        const deliveryBtn = e.livre !== true ? 
            '<button class="action-btn" title="Confirmer la livraison" onclick="confirmEnvoiDelivery(' + escapeHTML(e.id) + ')" style="color: #10b981;">' +
            '<i class="fas fa-check-double"></i>' +
            '</button>' : 
            '<button class="action-btn" title="Livraison validée" style="color: #64748b; opacity: 0.5; cursor: not-allowed;" disabled>' +
            '<i class="fas fa-check-double"></i>' +
            '</button>';

        safeSetHTML(tr, '<td>' + escapeHTML(dateFormatee) + '</td>' +
            '<td style="font-weight: 700; color: var(--text-primary);">' + escapeHTML(e.destinataire) + '</td>' +
            '<td>' + escapeHTML(e.lieu) + '</td>' +
            '<td style="font-weight: 600;">' + escapeHTML(e.equipement) + '</td>' +
            '<td><code style="background:var(--bg-secondary); padding:0.2rem 0.6rem; border-radius:0.5rem; font-size:0.8rem; border:1px solid var(--border-color);">' + escapeHTML(e.type) + '</code></td>' +
            '<td style="text-align: center; font-weight: bold; color: var(--blue-500);">' + escapeHTML(e.qty) + ' Unités</td>' +
            '<td><span class="status-badge-table status-active" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">' + escapeHTML(e.etat) + '</span></td>' +
            statusBadge +
            '<td>' +
            '<div class="action-btns" style="justify-content: center; gap: 0.4rem; align-items: center;">' +
            deliveryBtn +
            '<button class="action-btn" title="Modifier" onclick="editEnvoi(' + escapeHTML(e.id) + ')">' +
            '<i class="fas fa-edit"></i>' +
            '</button>' +
            '<button class="action-btn" title="Imprimer PDF" onclick="printEnvoiPDF(' + escapeHTML(e.id) + ')" style="color: #3b82f6;">' +
            '<i class="fas fa-file-pdf"></i>' +
            '</button>' +
            '<button class="action-btn delete" title="Supprimer" onclick="deleteEnvoi(' + escapeHTML(e.id) + ')">' +
            '<i class="fas fa-trash-alt"></i>' +
            '</button>' +
            '</div>' +
            '</td>');
        tbody.appendChild(tr);
    });

    renderEnvoisPagination(totalItems, totalPages, window.currentEnvoisPage);
}

function renderEnvoisPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('envoisPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, "confirmations d'envoi", 'changeEnvoisPage');
    safeSetHTML(container, html);
}

function changeEnvoisPage(page) {
    window.currentEnvoisPage = page;
    renderEnvoisTable();
    
    const tableWrapper = document.getElementById('envoisPagination');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.changeEnvoisPage = changeEnvoisPage;

function printEnvoiPDF(id) {
    const e = envois.find(x => String(x.id) === String(id));
    if (!e) return;
    const localImageBase64 = getLocalImage(envoiLocalImages, id) || null;

    const printWindow = window.open('', '_blank', 'width=950,height=1150');
    if (!printWindow) {
        showToast("⚠️ Pop-up bloqué ! Veuillez autoriser les pop-ups pour imprimer.", "red");
        return;
    }

    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const logoUrl = basePath + 'assets/logo-pdf.png';

    // Choose vector SVG icon depending on type
    const lowerType = e.type.toLowerCase();
    const lowerEquip = e.equipement.toLowerCase();
    let techIllustration = '';

    if (localImageBase64 && /^data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+$/.test(localImageBase64)) {
        const imgEl = document.createElement('img');
        imgEl.src = localImageBase64;
        imgEl.style.maxWidth = '100%';
        imgEl.style.maxHeight = '110px';
        imgEl.style.objectFit = 'contain';
        imgEl.style.borderRadius = '8px';
        imgEl.style.display = 'block';
        imgEl.style.margin = '0 auto';
        imgEl.alt = 'Produit';
        techIllustration = imgEl.outerHTML;
    } else if (lowerType.includes('onduleur') || lowerType.includes('ups') || lowerEquip.includes('onduleur')) {
        // UPS Tower
        techIllustration = `
                <svg width="110" height="110" viewBox="0 0 150 200" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <rect x="25" y="15" width="100" height="170" rx="12" fill="#1e293b" />
                    <rect x="28" y="18" width="94" height="164" rx="10" fill="#0f172a" />
                    <line x1="45" y1="28" x2="105" y2="28" stroke="#334155" stroke-width="3" stroke-linecap="round" />
                    <line x1="45" y1="34" x2="105" y2="34" stroke="#334155" stroke-width="3" stroke-linecap="round" />
                    <circle cx="45" cy="45" r="3" fill="#10b981" />
                    <circle cx="55" cy="45" r="3" fill="#10b981" />
                    <circle cx="65" cy="45" r="3" fill="#f59e0b" />
                    <rect x="40" y="55" width="70" height="12" rx="4" fill="#334155" />
                    <circle cx="75" cy="61" r="3" fill="#10b981" />
                    <rect x="40" y="80" width="70" height="45" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
                    <text x="75" y="106" font-family="'Segoe UI', Tahoma, Arial" font-weight="bold" font-size="22" fill="#06b6d4" text-anchor="middle">120</text>
                    <text x="75" y="118" font-family="'Segoe UI', Tahoma, Arial" font-size="7" fill="#0891b2" text-anchor="middle">V AC OUT</text>
                    <text x="75" y="155" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill="#475569" text-anchor="middle" letter-spacing="1">APC</text>
                    <rect x="45" y="170" width="60" height="4" rx="2" fill="#1e293b" />
                </svg>`;
    } else if (lowerType.includes('portable') || lowerType.includes('laptop') || lowerType.includes('pc') || lowerEquip.includes('pc') || lowerEquip.includes('laptop') || lowerEquip.includes('ordinateur')) {
        // Sleek Laptop
        techIllustration = `
                <svg width="110" height="110" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <rect x="20" y="25" width="110" height="75" rx="6" fill="#1e293b" />
                    <rect x="25" y="30" width="100" height="65" rx="4" fill="#0f172a" />
                    <rect x="35" y="40" width="40" height="8" rx="2" fill="#3b82f6" opacity="0.8" />
                    <rect x="35" y="52" width="25" height="6" rx="2" fill="#10b981" opacity="0.8" />
                    <circle cx="100" cy="50" r="12" fill="#8b5cf6" opacity="0.7" />
                    <path d="M10,103 L140,103 L150,118 L0,118 Z" fill="#64748b" />
                    <path d="M15,103 L135,103 L142,112 L8,112 Z" fill="#475569" />
                    <rect x="63" y="113" width="24" height="4" rx="1" fill="#334155" />
                </svg>`;
    } else if (lowerType.includes('imprimante') || lowerEquip.includes('imprimante') || lowerEquip.includes('printer')) {
        // High-fidelity Printer
        techIllustration = `
                <svg width="110" height="110" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <path d="M30,30 L120,30 L120,55 L30,55 Z" fill="#94a3b8" />
                    <rect x="20" y="50" width="110" height="60" rx="8" fill="#475569" />
                    <rect x="25" y="55" width="100" height="50" rx="6" fill="#334155" />
                    <rect x="45" y="15" width="60" height="20" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
                    <rect x="35" y="65" width="20" height="12" rx="2" fill="#0ea5e9" />
                    <circle cx="63" cy="71" r="3" fill="#10b981" />
                    <path d="M35,105 L115,105 L125,128 L25,128 Z" fill="#cbd5e1" />
                    <rect x="40" y="110" width="70" height="25" fill="#ffffff" rx="2" />
                    <line x1="48" y1="116" x2="102" y2="116" stroke="#94a3b8" stroke-width="2" />
                    <line x1="48" y1="123" x2="88" y2="123" stroke="#94a3b8" stroke-width="2" />
                </svg>`;
    } else {
        // Isometric Cargo Crate/Tech Pack
        techIllustration = `
                <svg width="110" height="110" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <path d="M75,20 L130,50 L75,80 L20,50 Z" fill="#60a5fa" />
                    <path d="M20,50 L75,80 L75,130 L20,100 Z" fill="#2563eb" />
                    <path d="M75,80 L130,50 L130,100 L75,130 Z" fill="#1d4ed8" />
                    <circle cx="75" cy="50" r="15" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.6" />
                    <line x1="75" y1="35" x2="75" y2="65" stroke="#ffffff" stroke-width="2" opacity="0.6" />
                    <line x1="60" y1="50" x2="90" y2="50" stroke="#ffffff" stroke-width="2" opacity="0.6" />
                </svg>`;
    }

    const content = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Confirmation d'Envoi d'Équipement - ${escapeHTML(e.destinataire)}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    html, body {
                        height: 100%;
                        overflow: hidden;
                    }
                    body {
                        font-family: 'Inter', 'Cairo', sans-serif;
                        color: #1e293b;
                        background-color: #f1f5f9;
                        padding: 20px;
                        margin: 0;
                        font-size: 13px;
                        line-height: 1.4;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                    }
                    .document-wrapper {
                        width: 210mm;
                        height: 297mm;
                        background: #ffffff;
                        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        position: relative;
                        padding: 30px 40px 25px 40px;
                    }

                    /* Navy Banner */
                    .navy-banner {
                        background-color: #0f172a;
                        background-image: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                        color: #ffffff;
                        padding: 14px 28px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 4px solid #2563eb;
                        border-radius: 6px;
                    }
                    .company-logo-text {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }
                    .company-name {
                        font-size: 22px;
                        font-weight: 800;
                        letter-spacing: 2px;
                        color: #ffffff;
                    }
                    .company-sub {
                        font-size: 9px;
                        font-weight: 600;
                        color: #94a3b8;
                        letter-spacing: 2.5px;
                        text-transform: uppercase;
                    }
                    .cargo-circle {
                        width: 42px;
                        height: 42px;
                        border-radius: 50%;
                        background: rgba(255,255,255,0.08);
                        border: 2px solid rgba(255, 255, 255, 0.25);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .cargo-circle svg {
                        width: 20px;
                        height: 20px;
                        fill: #ffffff;
                    }

                    .main-content {
                        padding: 15px 0 0 0;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        flex-grow: 1;
                    }
                    .header-group {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }

                    .title-block {
                        text-align: center;
                        margin-bottom: 4px;
                    }
                    .title-block h1 {
                        font-size: 21px;
                        font-weight: 800;
                        color: #0f172a;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                    }
                    .title-underline {
                        width: 140px;
                        height: 3px;
                        background: #2563eb;
                        margin: 0 auto 6px auto;
                        border-radius: 2px;
                    }
                    .intro-text {
                        font-size: 13.5px;
                        color: #475569;
                        margin-bottom: 2px;
                    }

                    /* Cards layout */
                    .details-box {
                        border: 1.5px solid #cbd5e1;
                        border-radius: 8px;
                        overflow: hidden;
                        background: #ffffff;
                        position: relative;
                    }
                    .details-box-header {
                        background-color: #0f172a;
                        color: #ffffff;
                        padding: 6px 18px;
                        font-weight: 700;
                        font-size: 10px;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        display: inline-block;
                        clip-path: polygon(0 0, 92% 0, 100% 100%, 0 100%);
                        min-width: 140px;
                    }
                    .details-box-content {
                        padding: 12px 20px;
                    }

                    /* Destinataire Card columns */
                    .dest-grid {
                        display: grid;
                        grid-template-columns: 1fr 1px 1fr;
                        gap: 20px;
                        align-items: center;
                    }
                    .dest-separator {
                        background: #e2e8f0;
                        align-self: stretch;
                        border-left: 1.5px dashed #cbd5e1;
                    }
                    .dest-col {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    }
                    .dest-icon-circle {
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background: #f1f5f9;
                        border: 1.5px solid #e2e8f0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #2563eb;
                        font-size: 15px;
                    }
                    .dest-info {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }
                    .dest-info .label {
                        font-size: 9px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        color: #64748b;
                        font-weight: 600;
                    }
                    .dest-info .value {
                        font-size: 15px;
                        font-weight: 800;
                        color: #0f172a;
                        text-transform: uppercase;
                    }
                    .dest-info .sub-val {
                        font-size: 12.5px;
                        color: #475569;
                        font-weight: 500;
                    }

                    /* Equipement Details Card */
                    .equip-layout {
                        display: grid;
                        grid-template-columns: 160px 1px 1fr;
                        gap: 16px;
                        align-items: center;
                    }
                    .equip-graphic-pane {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #f8fafc;
                        border: 1px solid #f1f5f9;
                        border-radius: 8px;
                        padding: 6px;
                        align-self: stretch;
                        height: 120px;
                    }
                    .equip-details-pane {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .equip-title {
                        font-size: 16px;
                        font-weight: 800;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        border-bottom: 2px solid #2563eb;
                        padding-bottom: 3px;
                        width: fit-content;
                        margin-bottom: 4px;
                    }
                    .spec-rows {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .spec-row {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 12.5px;
                        border-bottom: 1px dotted #cbd5e1;
                        padding-bottom: 3px;
                    }
                    .spec-row:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }
                    .spec-icon {
                        color: #2563eb;
                        font-size: 12px;
                        width: 16px;
                        text-align: center;
                    }
                    .spec-label {
                        color: #475569;
                        font-weight: 500;
                    }
                    .spec-value {
                        color: #0f172a;
                        font-weight: 700;
                    }

                    /* Notice list with icons */
                    .notice-box {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        padding: 4px 6px;
                    }
                    .notice-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 12px;
                        color: #334155;
                        font-weight: 500;
                    }
                    .notice-icon-circle {
                        width: 22px;
                        height: 22px;
                        border-radius: 50%;
                        background: #e0f2fe;
                        color: #0369a1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    /* Safety guidelines grid */
                    .safety-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 6px 20px;
                    }
                    .safety-item {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 11.5px;
                        color: #334155;
                        font-weight: 500;
                    }
                    .safety-icon {
                        font-size: 12px;
                        flex-shrink: 0;
                        width: 16px;
                        text-align: center;
                    }
                    
                    /* Signatures */
                    .signatures-grid {
                        display: grid;
                        grid-template-columns: 1fr 1px 1fr;
                        gap: 25px;
                    }
                    .sig-separator {
                        background: #cbd5e1;
                        align-self: stretch;
                        width: 1px;
                        border-left: 1.5px dashed #cbd5e1;
                    }
                    .sig-col {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 10px 15px;
                        border: 1.5px dashed #cbd5e1;
                        border-radius: 8px;
                        background: #f8fafc;
                        min-height: 85px;
                        position: relative;
                    }
                    .sig-label {
                        font-size: 11.5px;
                        font-weight: 700;
                        color: #0f172a;
                        text-transform: uppercase;
                        margin-bottom: auto;
                    }
                    .sig-dotted-line {
                        width: 80%;
                        border-top: 1.5px dotted #94a3b8;
                        margin-top: 28px;
                    }
                    .sig-pen-icon {
                        position: absolute;
                        bottom: 8px;
                        right: 12px;
                        color: #94a3b8;
                        font-size: 12px;
                    }

                    /* Footer address/social media bar */
                    .official-footer {
                        background-color: #0f172a;
                        color: #94a3b8;
                        padding: 10px 25px;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        border-top: 4px solid #2563eb;
                        font-size: 10px;
                        text-align: center;
                        border-radius: 6px;
                        margin-top: auto;
                    }
                    .footer-links {
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                        flex-wrap: wrap;
                        border-bottom: 1px solid rgba(255,255,255,0.08);
                        padding-bottom: 6px;
                    }
                    .footer-link-item {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        color: #ffffff;
                        text-decoration: none;
                        font-weight: 500;
                    }
                    .footer-link-item i {
                        color: #2563eb;
                        font-size: 11px;
                    }
                    @media print {
                        body {
                            background-color: #ffffff;
                            padding: 0;
                            margin: 0;
                            width: 100%;
                            height: 100vh;
                            overflow: hidden;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .document-wrapper {
                            box-shadow: none;
                            border: none;
                            border-radius: 0;
                            width: 100%;
                            height: 100vh;
                            padding: 25px 35px 20px 35px;
                            overflow: hidden;
                            page-break-inside: avoid;
                            page-break-after: avoid;
                        }
                    }
                </style>
                <!-- FontAwesome for Premium Icons -->
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            </head>
            <body>
                <div class="document-wrapper">
                    <!-- Top official navy banner -->
                    <div class="navy-banner">
                        <div class="company-logo-text">
                            <span class="company-name">L A B O N E D J M A</span>
                            <span class="company-sub">Laboratoires Cosmétiques</span>
                        </div>
                        <div class="cargo-circle">
                            <!-- Box package SVG -->
                            <svg viewBox="0 0 24 24">
                                <path d="M12,1.3L2,6.3v11.4l10,5l10-5V6.3L12,1.3z M12,3.6l7.4,3.7L12,11L4.6,7.3L12,3.6z M4,8.9l7,3.5v7.2l-7-3.5V8.9z M13,19.6v-7.2l7-3.5v7.2L13,19.6z"/>
                            </svg>
                        </div>
                    </div>

                    <div class="main-content">
                        <!-- Centered Header & Intro Group -->
                        <div class="header-group">
                            <div class="title-block">
                                <h1>Confirmation d'Envoi d'Équipement</h1>
                                <div class="title-underline"></div>
                            </div>
                            <p class="intro-text">
                                Bonjour,<br>
                                Nous vous informons que nous avons expédié l'équipement suivant à la destination indiquée ci-dessous :
                            </p>
                        </div>

                        <!-- Box 1: Destinataire Details -->
                        <div class="details-box">
                            <div class="details-box-header">Destinataire</div>
                            <div class="details-box-content">
                                <div class="dest-grid">
                                    <div class="dest-col">
                                        <div class="dest-icon-circle">
                                            <i class="fas fa-user"></i>
                                        </div>
                                        <div class="dest-info">
                                            <span class="label">Destinataire</span>
                                            <span class="value">${escapeHTML(e.destinataire)}</span>
                                            <span class="sub-val">${escapeHTML(e.lieu)}</span>
                                        </div>
                                    </div>
                                    <div class="dest-separator"></div>
                                    <div class="dest-col">
                                        <div class="dest-icon-circle">
                                            <i class="fas fa-map-marker-alt"></i>
                                        </div>
                                        <div class="dest-info">
                                            <span class="label">Livraison à :</span>
                                            <span class="value" style="color: #2563eb;">${escapeHTML(e.lieu)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Box 2: Equipment Details with dynamic SVG -->
                        <div class="details-box">
                            <div class="details-box-header">Détails de l'équipement expédié</div>
                            <div class="details-box-content">
                                <div class="equip-layout">
                                    <div class="equip-graphic-pane">
                                        ${techIllustration}
                                    </div>
                                    <div class="dest-separator"></div>
                                    <div class="equip-details-pane">
                                        <div class="equip-title">${escapeHTML(e.equipement)}</div>
                                        <div class="spec-rows">
                                            <div class="spec-row">
                                                <i class="fas fa-cog spec-icon"></i>
                                                <span class="spec-label">Type d'équipement :</span>
                                                <span class="spec-value">${escapeHTML(e.type)}</span>
                                            </div>
                                            <div class="spec-row">
                                                <i class="fas fa-tag spec-icon"></i>
                                                <span class="spec-label">Marque :</span>
                                                <span class="spec-value">${escapeHTML(e.marque)}</span>
                                            </div>
                                            <div class="spec-row">
                                                <i class="fas fa-heartbeat spec-icon"></i>
                                                <span class="spec-label">État :</span>
                                                <span class="spec-value">${escapeHTML(e.etat)}</span>
                                            </div>
                                            <div class="spec-row">
                                                <i class="fas fa-cubes spec-icon"></i>
                                                <span class="spec-label">Quantité :</span>
                                                <span class="spec-value" style="color: #2563eb;">${escapeHTML(e.qty)} Unités</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Notices / Information footer lines -->
                        <div class="notice-box">
                            <div class="notice-item">
                                <div class="notice-icon-circle"><i class="fas fa-shipping-fast"></i></div>
                                <span>${escapeHTML(e.notes || "Cet équipement a été envoyé à " + e.lieu + " où il sera pris en charge pour être livré à son destinataire.")}</span>
                            </div>
                            <div class="notice-item">
                                <div class="notice-icon-circle"><i class="fas fa-user-shield"></i></div>
                                <span>Cet envoi a été effectué par l'équipe technique IT de LABONEDJMA.</span>
                            </div>
                        </div>

                        <!-- Box 3: Precautions & Transport Safety Guidelines -->
                        <div class="details-box">
                            <div class="details-box-header" style="background-color: #b91c1c; min-width: 170px;">Consignes & Sécurité</div>
                            <div class="details-box-content">
                                <div class="safety-grid">
                                    <div class="safety-item">
                                        <i class="fas fa-exclamation-triangle safety-icon" style="color: #ef4444;"></i>
                                        <span><strong>Matériel fragile :</strong> Manipuler avec précaution, produit sensible aux chocs.</span>
                                    </div>
                                    <div class="safety-item">
                                        <i class="fas fa-thermometer-half safety-icon" style="color: #f59e0b;"></i>
                                        <span><strong>Humidité & Température :</strong> Stocker dans un endroit sec et à l'abri de l'eau.</span>
                                    </div>
                                    <div class="safety-item">
                                        <i class="fas fa-layer-group safety-icon" style="color: #3b82f6;"></i>
                                        <span><strong>Empilement limité :</strong> Éviter d'entasser des colis lourds sur le produit.</span>
                                    </div>
                                    <div class="safety-item">
                                        <i class="fas fa-shield-alt safety-icon" style="color: #10b981;"></i>
                                        <span><strong>Mise en service :</strong> Tester la tension électrique avant tout raccordement.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Box 4: Signatures Area -->
                        <div class="details-box">
                            <div class="details-box-header" style="min-width: 140px;">Signatures</div>
                            <div class="details-box-content" style="padding: 10px 15px;">
                                <div class="signatures-grid">
                                    <div class="sig-col">
                                        <span class="sig-label">IT / Responsable</span>
                                        <div class="sig-dotted-line"></div>
                                        <i class="fas fa-pen-nib sig-pen-icon"></i>
                                    </div>
                                    <div class="sig-separator"></div>
                                    <div class="sig-col">
                                        <span class="sig-label">Destinataire</span>
                                        <div class="sig-dotted-line"></div>
                                        <i class="fas fa-pen-nib sig-pen-icon"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Official Navy Footer bar -->
                    <div class="official-footer">
                        <div class="footer-links">
                            <span class="footer-link-item">
                                <i class="fas fa-map-marker-alt"></i> Zone industrielle Oued Smar, Alger
                            </span>
                            <a href="https://www.labo-nedjma.com" target="_blank" class="footer-link-item">
                                <i class="fas fa-globe"></i> www.labo-nedjma.com
                            </a>
                            <a href="mailto:contact@labo-nedjma.com" class="footer-link-item">
                                <i class="fas fa-envelope"></i> contact@labo-nedjma.com
                            </a>
                        </div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                <\/script>
            </body>
            </html>`;

    printWindow.document.write(content);
    printWindow.document.close();

    // Clear temporary image and file input after generating the document to prevent memory leaks or reuse by other rows
    tempUploadedImageBase64 = null;
    const imgInput = document.getElementById('envoiImage');
    if (imgInput) imgInput.value = '';
    const imgName = document.getElementById('envoiImageName');
    if (imgName) imgName.textContent = '';
}

function confirmEnvoiDelivery(id) {
    const e = envois.find(x => x.id === id);
    if (!e) return;
    
    showCustomConfirm(
        "Confirmer la Livraison",
        `Voulez-vous vraiment marquer l'équipement "${e.equipement}" envoyé à ${e.destinataire} comme livré ?`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itEnvois").doc(String(id)).set({
                livre: true,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true })
                .then(() => {
                    logActivity('ENVOIS', 'LIVRAISON', `Livraison confirmée pour l'envoi: ${id} (${e.equipement})`);
                    showToast("📦 Livraison confirmée avec succès !", "green");
                })
                .catch(err => {
                    console.error("Firestore confirm delivery error:", err);
                    showToast("❌ Échec de la validation sur Firebase", "red");
                });
        },
        null,
        false // green/cyan/blue validation style
    );
}

// Expose new functions globally
window.switchBesoinsTab = switchBesoinsTab;
window.openEnvoiForm = openEnvoiForm;
window.closeEnvoiForm = closeEnvoiForm;
window.editEnvoi = editEnvoi;
window.saveEnvoiItem = saveEnvoiItem;
window.deleteEnvoi = deleteEnvoi;
window.renderEnvoisTable = renderEnvoisTable;
window.printEnvoiPDF = printEnvoiPDF;
window.handleEnvoiImageUpload = handleEnvoiImageUpload;
window.confirmEnvoiDelivery = confirmEnvoiDelivery;

// ============ MODULE: AUTHENTICATION (ESPACE IT / FIREBASE READY) ============
function updateAuthUI() {
    const authArea = document.getElementById('authArea');
    if (!authArea) return;

    const user = JSON.parse(localStorage.getItem('laboCurrentUserV3'));
    if (user) {
        const emailStr = String(user.email || '');
        const usernameStr = emailStr.split('@')[0];
        safeSetHTML(authArea, '<button class="nav-logout-btn" onclick="handleLogout()" title="Se déconnecter (' + escapeHTML(emailStr) + ')">' +
            '<span class="status-dot"></span>' +
            '<span class="username">' + escapeHTML(usernameStr) + '</span>' +
            '<i class="fas fa-sign-out-alt"></i>' +
            '</button>');
    } else {
        safeSetHTML(authArea, '<button class="nav-login-btn" onclick="openLoginModal()" title="Se connecter">' +
            '<i class="fas fa-user-shield"></i>' +
            '<span>Se connecter</span>' +
            '</button>');
    }
}

function openLoginModal() {
    const overlay = document.getElementById('customLoginOverlay');
    if (overlay) overlay.classList.add('active');
}

function closeCustomLoginModal() {
    const overlay = document.getElementById('customLoginOverlay');
    if (overlay) overlay.classList.remove('active');
}

function closeCustomLoginModalOuter(e) {
    if (e.target.id === 'customLoginOverlay') {
        closeCustomLoginModal();
    }
}

function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;

    if (email && pass) {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        let originalText = "";
        if (submitBtn) {
            originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            safeSetHTML(submitBtn, '<i class="fas fa-spinner fa-spin"></i> Connexion...');
        }
        
        showToast("🔄 Connexion en cours...", "blue");

        auth.signInWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                // Clear fields
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';

                closeCustomLoginModal();
                showToast("🔓 Connexion réussie !", "green");
                
                // Explicitly trigger UI update and Sync to avoid any latency or race condition in observers!
                const user = userCredential.user;
                if (user) {
                    const localUser = { email: user.email };
                    localStorage.setItem('laboCurrentUserV3', JSON.stringify(localUser));
                    updateAuthUI();
                    startFirestoreSync();
                }
            })
            .catch((error) => {
                console.error("Firebase Login Error:", error);
                let errorMsg = "Erreur de connexion";
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                    errorMsg = "Identifiants invalides !";
                } else if (error.code === 'auth/too-many-requests') {
                    errorMsg = "Compte temporairement bloqué suite à plusieurs échecs. Veuillez réessayer plus tard.";
                } else {
                    errorMsg = error.message;
                }
                showToast("❌ " + errorMsg, "red");
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    safeSetHTML(submitBtn, originalText);
                }
            });
    }
}

function handleLogout() {
    showCustomConfirm(
        "Confirmer la Déconnexion",
        "Voulez-vous vraiment vous déconnecter de LABO-IT CONTROL ?",
        function () {
            showToast("🔄 Déconnexion en cours...", "blue");
            auth.signOut()
                .then(() => {
                    localStorage.removeItem('laboCurrentUserV3');
                    updateAuthUI();
                    stopFirestoreSync();
                    showToast("🔒 Déconnexion réussie", "blue");
                })
                .catch((error) => {
                    console.error("Firebase Logout Error:", error);
                    showToast("⚠️ Erreur lors de la déconnexion", "red");
                });
        },
        null,
        'warning'
    );
}

// Expose globally for inline HTML event handlers
window.updateAuthUI = updateAuthUI;
window.openLoginModal = openLoginModal;
window.closeCustomLoginModal = closeCustomLoginModal;
window.closeCustomLoginModalOuter = closeCustomLoginModalOuter;
window.handleLoginSubmit = handleLoginSubmit;
window.handleLogout = handleLogout;

// ============ MODULE: INFO MODALS (COMPANY & DEVELOPER) ============
function openCompanyModal() {
    const modal = document.getElementById('companyModal');
    if (modal) modal.classList.add('modal-active');
}

function closeCompanyModal() {
    const modal = document.getElementById('companyModal');
    if (modal) modal.classList.remove('modal-active');
}

function openDevModal() {
    const modal = document.getElementById('devModal');
    const missionText = document.querySelector('#devModal .dev-mission-text');
    if (missionText) {
        missionText.textContent = "Passionné par l’innovation digitale et l’excellence IT, je développe des solutions intelligentes alliant performance, sécurité et design moderne afin d’optimiser les environnements numériques et les infrastructures professionnelles.";
    }
    if (modal) modal.classList.add('modal-active');
}

function closeDevModal() {
    const modal = document.getElementById('devModal');
    if (modal) modal.classList.remove('modal-active');
}

// Global Event Listeners for closing info modals
window.addEventListener('click', function (e) {
    const companyModal = document.getElementById('companyModal');
    const devModal = document.getElementById('devModal');

    if (companyModal && e.target === companyModal) {
        closeCompanyModal();
    }
    if (devModal && e.target === devModal) {
        closeDevModal();
    }
});

window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeCompanyModal();
        closeDevModal();
    }
});

// Expose globally for inline HTML event handlers
window.openCompanyModal = openCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.openDevModal = openDevModal;
window.closeDevModal = closeDevModal;

// ============ MODULE: KPI DETAILS POPUPS ============
function showKpiDetails(type) {
    const overlay = document.getElementById('kpiDetailsOverlay');
    const titleEl = document.getElementById('kpiDetailsTitle');
    const contentEl = document.getElementById('kpiDetailsContent');
    if (!overlay || !titleEl || !contentEl) return;

    let title = '';
    let html = '';

    if (type === 'total') {
        title = '<i class="fas fa-desktop" style="color: var(--indigo-500); margin-right: 5px;"></i> Équipements Globaux';

        // Group 1: Devices
        const stockLaptops = stockItems.filter(item => item.category === 'PC Portables (Laptops)').reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
        const stockDesktops = stockItems.filter(item => item.category === 'PC Bureau (Desktops)').reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);

        html += '<div style="margin-bottom:1.5rem;">';
        html += '<h4 style="color:var(--text-primary); font-size:1.05rem; font-weight:700; margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.25rem;">💻 Ordinateurs en Service / Maintenance (' + devices.length + ')</h4>';
        if (devices.length === 0) {
            html += '<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic;">Aucun ordinateur disponible.</p>';
        } else {
            html += '<div style="display:flex; flex-direction:column; gap:0.6rem;">';
            devices.forEach(d => {
                const statusClass = d.status === 'Actif' ? 'status-active' : 'status-maintenance';
                const icon = d.type === 'Desktop' ? 'fas fa-computer' : 'fas fa-laptop';
                html += '<div style="background:var(--bg-card); padding:0.85rem 1rem; border-radius:0.85rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
                    '<div>' +
                    '<div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);"><i class="' + icon + '" style="margin-right:5px; color:var(--blue-500);"></i> ' + escapeHTML(d.model) + '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Utilisateur: <strong>' + escapeHTML(d.user) + '</strong> | Service: <strong>' + escapeHTML(d.service || 'N/A') + '</strong></div>' +
                    '</div>' +
                    '<div>' +
                    '<span class="status-badge-table ' + statusClass + '" style="font-size:0.75rem; padding:0.15rem 0.5rem;">' + escapeHTML(d.status === 'Actif' ? 'Actif' : 'Maintenance') + '</span>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        // Group 2: Printers
        html += '<div style="margin-bottom:1.5rem;">';
        html += '<h4 style="color:var(--text-primary); font-size:1.05rem; font-weight:700; margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.25rem;">🖨️ Imprimantes Mises en Service (' + printers.length + ')</h4>';
        if (printers.length === 0) {
            html += '<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic;">Aucune imprimante disponible.</p>';
        } else {
            html += '<div style="display:flex; flex-direction:column; gap:0.6rem;">';
            printers.forEach(p => {
                const statusClass = p.status === 'Actif' ? 'status-active' : p.status === 'Maintenance' ? 'status-maintenance' : 'status-offline';
                const statusLabel = p.status === 'Actif' ? 'En Ligne' : p.status === 'Maintenance' ? 'Maintenance' : 'Hors Ligne';
                html += '<div style="background:var(--bg-card); padding:0.85rem 1rem; border-radius:0.85rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
                    '<div>' +
                    '<div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);"><i class="fas fa-print" style="margin-right:5px; color:var(--amber-500);"></i> ' + escapeHTML(p.model) + '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Emplacement: <strong>' + escapeHTML(p.location || 'N/A') + '</strong> | IP: <strong>' + escapeHTML(p.ip || 'N/A') + '</strong></div>' +
                    '</div>' +
                    '<div>' +
                    '<span class="status-badge-table ' + statusClass + '" style="font-size:0.75rem; padding:0.15rem 0.5rem;">' + escapeHTML(statusLabel) + '</span>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }
        html += '</div>';

        // Group 3: Computers in stock
        html += '<div>';
        html += '<h4 style="color:var(--text-primary); font-size:1.05rem; font-weight:700; margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.25rem;">📦 Ordinateurs Disponibles en Stock (' + (stockLaptops + stockDesktops) + ')</h4>';
        html += '<div style="display:flex; flex-direction:column; gap:0.6rem;">' +
            '<div style="background:var(--bg-card); padding:0.85rem 1rem; border-radius:0.85rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
            '<div>' +
            '<div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);"><i class="fas fa-laptop" style="margin-right:5px; color:var(--blue-500);"></i> PC Portables (Laptops)</div>' +
            '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Emplacement: <strong>Coffre-fort Laptops</strong></div>' +
            '</div>' +
            '<div><span style="background:rgba(99,102,241,0.1); color:var(--indigo-500); font-weight:800; padding:0.25rem 0.75rem; border-radius:0.5rem; font-size:0.9rem;">' + stockLaptops + ' unités</span></div>' +
            '</div>' +
            '<div style="background:var(--bg-card); padding:0.85rem 1rem; border-radius:0.85rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
            '<div>' +
            '<div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);"><i class="fas fa-computer" style="margin-right:5px; color:var(--purple-500);"></i> PC Bureau (Desktops)</div>' +
            '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Emplacement: <strong>Zone Desktops</strong></div>' +
            '</div>' +
            '<div><span style="background:rgba(99,102,241,0.1); color:var(--indigo-500); font-weight:800; padding:0.25rem 0.75rem; border-radius:0.5rem; font-size:0.9rem;">' + stockDesktops + ' unités</span></div>' +
            '</div>' +
            '</div>';
        html += '</div>';

    } else if (type === 'laptop') {
        title = '<i class="fas fa-laptop" style="color: var(--blue-500); margin-right: 5px;"></i> PC Laptop Actifs / Maintenance';
        const laptops = devices.filter(d => d.type !== 'Desktop');

        if (laptops.length === 0) {
            html = '<p style="color:var(--text-muted); font-size:0.95rem; font-style:italic; text-align:center; padding:2rem 0;">Aucun ordinateur portable enregistré.</p>';
        } else {
            html = '<div style="display:flex; flex-direction:column; gap:0.75rem;">';
            laptops.forEach(d => {
                const statusClass = d.status === 'Actif' ? 'status-active' : 'status-maintenance';
                html += '<div style="background:var(--bg-card); padding:1rem; border-radius:1rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
                    '<div>' +
                    '<div style="font-weight:700; font-size:1rem; color:var(--text-primary);">' + escapeHTML(d.model) + '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Utilisateur: <strong>' + escapeHTML(d.user) + '</strong> | Service: <strong>' + escapeHTML(d.service || 'N/A') + '</strong></div>' +
                    '<div style="font-size:0.75rem; color:var(--blue-500); font-family:monospace; margin-top:4px;"><i class="fas fa-fingerprint"></i> ' + escapeHTML(d.sn) + ' | <i class="fas fa-microchip"></i> ' + escapeHTML(d.specs) + '</div>' +
                    '</div>' +
                    '<div>' +
                    '<span class="status-badge-table ' + statusClass + '">' + escapeHTML(d.status === 'Actif' ? 'Actif' : 'Maintenance') + '</span>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }

    } else if (type === 'desktop') {
        title = '<i class="fas fa-computer" style="color: var(--purple-500); margin-right: 5px;"></i> PC Bureau Actifs / Maintenance';
        const desktops = devices.filter(d => d.type === 'Desktop');

        if (desktops.length === 0) {
            html = '<p style="color:var(--text-muted); font-size:0.95rem; font-style:italic; text-align:center; padding:2rem 0;">Aucun ordinateur de bureau enregistré.</p>';
        } else {
            html = '<div style="display:flex; flex-direction:column; gap:0.75rem;">';
            desktops.forEach(d => {
                const statusClass = d.status === 'Actif' ? 'status-active' : 'status-maintenance';
                html += '<div style="background:var(--bg-card); padding:1rem; border-radius:1rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
                    '<div>' +
                    '<div style="font-weight:700; font-size:1rem; color:var(--text-primary);">' + escapeHTML(d.model) + '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Utilisateur: <strong>' + escapeHTML(d.user) + '</strong> | Service: <strong>' + escapeHTML(d.service || 'N/A') + '</strong></div>' +
                    '<div style="font-size:0.75rem; color:var(--purple-500); font-family:monospace; margin-top:4px;"><i class="fas fa-fingerprint"></i> ' + escapeHTML(d.sn) + ' | <i class="fas fa-microchip"></i> ' + escapeHTML(d.specs) + '</div>' +
                    '</div>' +
                    '<div>' +
                    '<span class="status-badge-table ' + statusClass + '">' + escapeHTML(d.status === 'Actif' ? 'Actif' : 'Maintenance') + '</span>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }

    } else if (type === 'maintenance') {
        title = '<i class="fas fa-tools" style="color: var(--amber-500); margin-right: 5px;"></i> Équipements en Maintenance';
        const maintDevs = devices.filter(d => d.status === 'Maintenance');
        const maintPrinters = printers.filter(p => p.status === 'Maintenance');

        if (maintDevs.length === 0 && maintPrinters.length === 0) {
            html = '<p style="color:var(--text-muted); font-size:0.95rem; font-style:italic; text-align:center; padding:2rem 0;">Aucun matériel en maintenance pour le moment.</p>';
        } else {
            html = '<div style="display:flex; flex-direction:column; gap:0.75rem;">';

            // List computers in maintenance
            maintDevs.forEach(d => {
                const icon = d.type === 'Desktop' ? 'fas fa-computer' : 'fas fa-laptop';
                const lastInt = d.interventions && d.interventions.length > 0 ? d.interventions.at(-1) : null;
                const diagText = lastInt ? lastInt.desc : (d.notes || 'En attente de diagnostic');
                html += '<div style="background:rgba(245,158,11,0.05); padding:1rem; border-radius:1rem; border:1px solid rgba(245,158,11,0.2);">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                    '<div style="font-weight:700; font-size:1rem; color:var(--text-primary);"><i class="' + icon + '" style="margin-right:5px; color:var(--blue-500);"></i> ' + escapeHTML(d.model) + '</div>' +
                    '<span class="status-badge-table status-maintenance">Maintenance</span>' +
                    '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Utilisateur: <strong>' + escapeHTML(d.user) + '</strong> | Service: <strong>' + escapeHTML(d.service || 'N/A') + '</strong></div>' +
                    '<div style="font-size:0.8rem; color:var(--text-primary); background:var(--bg-secondary); padding:0.5rem 0.75rem; border-radius:0.5rem; margin-top:8px; border:1px dashed var(--border-color);">' +
                    '<i class="fas fa-notes-medical" style="color:var(--amber-500); margin-right:5px;"></i> <strong>Diagnostic:</strong> ' + escapeHTML(diagText) +
                    '</div>' +
                    '</div>';
            });

            // List printers in maintenance
            maintPrinters.forEach(p => {
                const lastInt = p.interventions && p.interventions.length > 0 ? p.interventions.at(-1) : null;
                const diagText = lastInt ? lastInt.desc : 'Bourrage ou problème de consommables';
                html += '<div style="background:rgba(245,158,11,0.05); padding:1rem; border-radius:1rem; border:1px solid rgba(245,158,11,0.2);">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                    '<div style="font-weight:700; font-size:1rem; color:var(--text-primary);"><i class="fas fa-print" style="margin-right:5px; color:var(--amber-500);"></i> ' + escapeHTML(p.model) + '</div>' +
                    '<span class="status-badge-table status-maintenance">Maintenance</span>' +
                    '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Emplacement: <strong>' + escapeHTML(p.location) + '</strong> | IP: <strong>' + escapeHTML(p.ip) + '</strong></div>' +
                    '<div style="font-size:0.8rem; color:var(--text-primary); background:var(--bg-secondary); padding:0.5rem 0.75rem; border-radius:0.5rem; margin-top:8px; border:1px dashed var(--border-color);">' +
                    '<i class="fas fa-notes-medical" style="color:var(--amber-500); margin-right:5px;"></i> <strong>Diagnostic:</strong> ' + escapeHTML(diagText) +
                    '</div>' +
                    '</div>';
            });

            html += '</div>';
        }

    } else if (type === 'printer') {
        title = '<i class="fas fa-print" style="color: var(--amber-500); margin-right: 5px;"></i> Parc d\'Imprimantes Réseau';

        if (printers.length === 0) {
            html = '<p style="color:var(--text-muted); font-size:0.95rem; font-style:italic; text-align:center; padding:2rem 0;">Aucune imprimante enregistrée.</p>';
        } else {
            html = '<div style="display:flex; flex-direction:column; gap:0.75rem;">';
            printers.forEach(p => {
                const statusClass = p.status === 'Actif' ? 'status-active' : p.status === 'Maintenance' ? 'status-maintenance' : 'status-offline';
                const statusLabel = p.status === 'Actif' ? 'En Ligne' : p.status === 'Maintenance' ? 'Maintenance' : 'Hors Ligne';
                html += '<div style="background:var(--bg-card); padding:1rem; border-radius:1rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
                    '<div>' +
                    '<div style="font-weight:700; font-size:1rem; color:var(--text-primary);">' + escapeHTML(p.model) + '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Emplacement: <strong>' + escapeHTML(p.location) + '</strong> | IP: <strong style="color:var(--blue-500); font-family:monospace;">' + escapeHTML(p.ip) + '</strong></div>' +
                    '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;"><i class="fas fa-tint"></i> Type: ' + escapeHTML(p.type) + ' | Connexion: ' + escapeHTML(p.connexion) + '</div>' +
                    '</div>' +
                    '<div>' +
                    '<span class="status-badge-table ' + statusClass + '">' + escapeHTML(statusLabel) + '</span>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }

    } else if (type === 'stock') {
        title = '<i class="fas fa-boxes" style="color: var(--emerald-500); margin-right: 5px;"></i> Inventaire du Stock Global';

        if (stockItems.length === 0) {
            html = '<p style="color:var(--text-muted); font-size:0.95rem; font-style:italic; text-align:center; padding:2rem 0;">Le stock est vide.</p>';
        } else {
            html = '<div style="display:flex; flex-direction:column; gap:0.75rem;">';
            stockItems.forEach(item => {
                const isOut = item.qty === 0;
                const qtyBg = isOut ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
                const qtyColor = isOut ? 'var(--red-500)' : 'var(--emerald-500)';
                const qtyText = isOut ? 'Rupture' : item.qty + ' unités';
                const isMeter = item.category === 'Câblage & Réseau' && item.qty > 0;
                const finalQtyText = isMeter ? item.qty + ' mètres' : qtyText;

                html += '<div style="background:var(--bg-card); padding:1rem; border-radius:1rem; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
                    '<div>' +
                    '<div style="font-weight:700; font-size:1rem; color:var(--text-primary);">' + escapeHTML(item.name) + '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Catégorie: <strong>' + escapeHTML(item.category) + '</strong> | Réf: <strong style="font-family:monospace;">' + escapeHTML(item.ref) + '</strong></div>' +
                    '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;"><i class="fas fa-map-marker-alt" style="color:var(--pink-500);"></i> Emplacement: ' + escapeHTML(item.location || 'N/A') + '</div>' +
                    '</div>' +
                    '<div>' +
                    '<span style="background:' + qtyBg + '; color:' + qtyColor + '; font-weight:800; padding:0.3rem 0.8rem; border-radius:0.5rem; font-size:0.85rem; border:1px solid ' + qtyColor + '33;">' + escapeHTML(finalQtyText) + '</span>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }
    }

    safeSetHTML(titleEl, title);
    safeSetHTML(contentEl, html);
    overlay.classList.add('active');
}

function closeKpiDetailsModal() {
    const overlay = document.getElementById('kpiDetailsOverlay');
    if (overlay) overlay.classList.remove('active');
}

function closeKpiDetailsModalOuter(e) {
    if (e.target.id === 'kpiDetailsOverlay') {
        closeKpiDetailsModal();
    }
}

// Expose globally for inline HTML event handlers
window.showKpiDetails = showKpiDetails;
window.closeKpiDetailsModal = closeKpiDetailsModal;
window.closeKpiDetailsModalOuter = closeKpiDetailsModalOuter;

window.openCompanyModal = openCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.openDevModal = openDevModal;
window.closeDevModal = closeDevModal;

// ============ MODULE: PARAMÈTRES SYSTEME (SETTINGS) ============
const defaultAppSettings = {
    appName: 'LABO-IT CONTROL',
    appSlogan: '◆ GESTION LABORATOIRE INFORMATIQUE ◆',
    accentPalette: 'indigo',
    neonGlows: true,
    showAdvisory: true,
    stockThreshold: 5,
    loanDuration: 30,
    sig1: 'Le Demandeur',
    sig2: 'Le Responsable du service',
    sig3: 'ASSISTANTE MGX',
    soundEffects: true
};

let appSettings = defaultAppSettings;

function loadAppSettings() {
    const saved = localStorage.getItem('laboAppSettingsV1');
    if (saved) {
        try {
            appSettings = JSON.parse(saved);
            appSettings = { ...defaultAppSettings, ...appSettings };
        } catch (e) {
            appSettings = { ...defaultAppSettings };
        }
    } else {
        appSettings = { ...defaultAppSettings };
    }
}

// Initial pre-load so settings is available instantly
loadAppSettings();

// Web Audio API Synthesizer for high-end notifications chimes
function playChime(type = 'success') {
    if (!appSettings.soundEffects) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        
        if (type === 'success') {
            // Crystalline double bell chime
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now); // C5
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.45);
            
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
            gain2.gain.setValueAtTime(0, now + 0.08);
            gain2.gain.linearRampToValueAtTime(0.12, now + 0.13);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.55);
        } else {
            // Alert chime
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, now); // A3
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (e) {
        console.warn("Web Audio API not allowed or failed to initialize sound.", e);
    }
}

// Attach globally for toast chime integration
window.playChime = playChime;

function applyAppSettings() {
    // 1. App name & slogan
    const appNameEl = document.querySelector('.logo-text h2');
    const appSloganEl = document.querySelector('.logo-text span');
    if (appNameEl) appNameEl.textContent = appSettings.appName || defaultAppSettings.appName;
    if (appSloganEl) appSloganEl.textContent = appSettings.appSlogan || defaultAppSettings.appSlogan;

    // 2. Accent Color Palette Override
    const root = document.documentElement;
    const palette = appSettings.accentPalette || 'indigo';
    if (palette === 'emerald') {
        root.style.setProperty('--gradient-blue-purple', 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)');
        root.style.setProperty('--blue-500', '#10b981');
    } else if (palette === 'rose') {
        root.style.setProperty('--gradient-blue-purple', 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)');
        root.style.setProperty('--blue-500', '#f43f5e');
    } else if (palette === 'ocean') {
        root.style.setProperty('--gradient-blue-purple', 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)');
        root.style.setProperty('--blue-500', '#06b6d4');
    } else {
        // Indigo (Default)
        root.style.setProperty('--gradient-blue-purple', 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)');
        root.style.setProperty('--blue-500', '#3b82f6');
    }

    // 3. Neon Glows (Disable glowing effects if set to false)
    if (appSettings.neonGlows) {
        document.body.classList.remove('disable-glows');
    } else {
        document.body.classList.add('disable-glows');
    }

    // 4. Advisory IT Tips display toggle
    const advisoryBox = document.querySelector('.dynamic-advisory-box');
    if (advisoryBox) {
        advisoryBox.style.display = appSettings.showAdvisory !== false ? 'flex' : 'none';
    }



    // 6. Re-render stock category table to apply the stockThreshold dynamically
    if (currentCategoryFilter) {
        renderStockCategoryTable();
    }
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    // Load current values into form fields
    document.getElementById('setAppName').value = appSettings.appName || '';
    document.getElementById('setAppSlogan').value = appSettings.appSlogan || '';
    document.getElementById('setAccentPalette').value = appSettings.accentPalette || 'indigo';
    document.getElementById('setNeonGlows').checked = appSettings.neonGlows !== false;
    document.getElementById('setShowAdvisory').checked = appSettings.showAdvisory !== false;
    
    document.getElementById('setStockThreshold').value = appSettings.stockThreshold || 5;
    document.getElementById('stockThresholdVal').textContent = (appSettings.stockThreshold || 5) + ' Pièces';
    document.getElementById('setLoanDuration').value = appSettings.loanDuration || 30;
    
    document.getElementById('setSig1').value = appSettings.sig1 || '';
    document.getElementById('setSig2').value = appSettings.sig2 || '';
    document.getElementById('setSig3').value = appSettings.sig3 || '';

    document.getElementById('setSoundEffects').checked = appSettings.soundEffects !== false;

    // Reset default active tab
    switchSettingsTab('general');

    modal.classList.add('modal-active');
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('modal-active');
}

function closeSettingsModalOuter(e) {
    if (e.target.id === 'settingsModal') {
        closeSettingsModal();
    }
}

function switchSettingsTab(tabName) {
    // Deactivate all tabs
    document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.settings-pane').forEach(pane => pane.classList.remove('active'));

    // Activate selected tab & pane
    const tabBtn = document.getElementById('setTab-' + tabName);
    const tabPane = document.getElementById('settingsPane-' + tabName);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabPane) tabPane.classList.add('active');
}

function saveAppSettings() {
    // Read from fields
    appSettings.appName = document.getElementById('setAppName').value.trim() || defaultAppSettings.appName;
    appSettings.appSlogan = document.getElementById('setAppSlogan').value.trim() || defaultAppSettings.appSlogan;
    appSettings.accentPalette = document.getElementById('setAccentPalette').value;
    appSettings.neonGlows = document.getElementById('setNeonGlows').checked;
    appSettings.showAdvisory = document.getElementById('setShowAdvisory').checked;

    appSettings.stockThreshold = parseInt(document.getElementById('setStockThreshold').value) || 5;
    appSettings.loanDuration = parseInt(document.getElementById('setLoanDuration').value) || 30;
    
    appSettings.sig1 = document.getElementById('setSig1').value.trim() || defaultAppSettings.sig1;
    appSettings.sig2 = document.getElementById('setSig2').value.trim() || defaultAppSettings.sig2;
    appSettings.sig3 = document.getElementById('setSig3').value.trim() || defaultAppSettings.sig3;

    appSettings.soundEffects = document.getElementById('setSoundEffects').checked;

    // Save and apply
    localStorage.setItem('laboAppSettingsV1', JSON.stringify(appSettings));
    applyAppSettings();
    updateAuthUI(); // Update admin username if changed!

    closeSettingsModal();
    showToast('⚙️ Paramètres système enregistrés avec succès !', 'green');
}

// Expose settings handlers globally
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.closeSettingsModalOuter = closeSettingsModalOuter;
window.switchSettingsTab = switchSettingsTab;
window.saveAppSettings = saveAppSettings;

// Global Event Listeners integration for Settings modal close
window.addEventListener('click', function(e) {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal && e.target === settingsModal) {
        closeSettingsModal();
    }
});

window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeSettingsModal();
    }
});

function clearSystemCacheAndRestart() {
    // Hide the settings modal
    closeSettingsModal();

    // Show the cleaning modal overlay (centered with flex layout using 'active')
    const overlay = document.getElementById('cacheCleanOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }

    const logContainer = document.getElementById('cacheCleanLog');
    const progressBar = document.getElementById('cacheCleanProgressBar');
    const footerText = document.getElementById('cacheCleanFooter');
    const modalIcon = document.getElementById('cacheCleanModalIcon');

    if (logContainer) logContainer.innerHTML = '';
    if (progressBar) progressBar.style.width = '0%';

    // Helper to add log line
    function addLogLine(text, status = 'pending') {
        const line = document.createElement('div');
        line.style.display = 'flex';
        line.style.justifyContent = 'space-between';
        line.style.alignItems = 'center';
        
        let statusIcon = '🔄';
        let color = 'var(--text-secondary)';
        if (status === 'success') {
            statusIcon = '✅';
            color = '#10b981';
        } else if (status === 'error') {
            statusIcon = '❌';
            color = '#ef4444';
        } else if (status === 'running') {
            statusIcon = '⚡';
            color = '#60a5fa';
        }

        const colorSpan = document.createElement('span');
        colorSpan.style.color = color;
        colorSpan.style.fontWeight = '500';
        colorSpan.textContent = text;
        const statusSpan = document.createElement('span');
        statusSpan.style.fontSize = '0.9em';
        statusSpan.textContent = ` ${statusIcon}`;
        line.innerHTML = '';
        line.appendChild(colorSpan);
        line.appendChild(statusSpan);
        logContainer.appendChild(line);
        logContainer.scrollTop = logContainer.scrollHeight;
        return line;
    }

    const steps = [
        { text: "Connexion au stockage local...", action: () => Promise.resolve() },
        { text: "Analyse des répertoires du cache système...", action: () => Promise.resolve() },
        { text: "Purge du cache Service Worker ('labo-it-cache-v2.0.1')...", action: () => {
            if ('caches' in window) {
                return caches.keys().then(keys => {
                    return Promise.all(keys.map(key => caches.delete(key)));
                });
            }
            return Promise.resolve();
        }},
        { text: "Nettoyage des clés temporaires de stockage...", action: () => Promise.resolve() },
        { text: "Installation des nouveautés de la version 2.0.1...", action: () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    addLogLine("   🚀 Nouveautés de la version v2.0.1 :", "running");
                    setTimeout(() => {
                        addLogLine("     • Redirection Fiche Appareil corrigée", "success");
                        if (typeof playChime === 'function') playChime('success');
                    }, 200);
                    setTimeout(() => {
                        addLogLine("     • Synchronisation Firestore stabilisée", "success");
                        if (typeof playChime === 'function') playChime('success');
                    }, 400);
                    setTimeout(() => {
                        addLogLine("     • Outil de maintenance en temps réel", "success");
                        if (typeof playChime === 'function') playChime('success');
                    }, 600);
                    setTimeout(() => {
                        addLogLine("     • Version globale mise à jour à v2.0.1", "success");
                        if (typeof playChime === 'function') playChime('success');
                        resolve();
                    }, 800);
                }, 300);
            });
        }},
        { text: "Préparation du redémarrage système...", action: () => Promise.resolve() },
        { text: "Redémarrage de LABO-IT CONTROL v2.0.1...", action: () => {
            if (progressBar) progressBar.style.width = '100%';
            if (footerText) footerText.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981; margin-right: 5px;"></i> Terminé ! Redémarrage...';
            if (modalIcon) {
                modalIcon.className = 'fas fa-sync-alt fa-spin';
                modalIcon.parentElement.style.color = '#10b981';
                modalIcon.parentElement.style.background = 'rgba(16, 185, 129, 0.1)';
            }
            if (typeof playChime === 'function') playChime('success');
            setTimeout(() => {
                window.location.reload(true);
            }, 1200);
            return Promise.resolve();
        }}
    ];

    let currentStep = 0;
    
    function runNextStep() {
        if (currentStep >= steps.length) return;
        
        const step = steps[currentStep];
        const stepLine = addLogLine(step.text, 'running');
        
        if (typeof playChime === 'function') {
            playChime('success');
        }

        setTimeout(() => {
            step.action()
                .then(() => {
                    // Update log line status to success
                    if (stepLine) {
                        stepLine.querySelector('span:last-child').textContent = '✅';
                        stepLine.querySelector('span:first-child').style.color = '#10b981';
                    }
                    
                    currentStep++;
                    if (progressBar) {
                        const pct = Math.round((currentStep / steps.length) * 100);
                        progressBar.style.width = `${pct}%`;
                    }
                    
                    if (currentStep < steps.length) {
                        runNextStep();
                    }
                })
                .catch(err => {
                    console.error("Step error:", err);
                    if (stepLine) {
                        stepLine.querySelector('span:last-child').textContent = '❌';
                        stepLine.querySelector('span:first-child').style.color = '#ef4444';
                    }
                    if (typeof playChime === 'function') playChime('error');
                    if (footerText) footerText.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444; margin-right: 5px;"></i> Échec de la maintenance !';
                });
        }, 800);
    }

    // Start execution
    setTimeout(() => {
        runNextStep();
    }, 400);
}
window.clearSystemCacheAndRestart = clearSystemCacheAndRestart;

init();
console.log('%c🚀 LABO-IT CONTROL %c| %cVersion 2.0.1 %c| %cPrêt à l\'emploi',
    'color:#667eea; font-size:1.3em; font-weight:bold;',
    '',
    'color:#10b981; font-weight:bold;',
    '',
    'color:#f59e0b;');
console.log('%c💡 Raccourcis: %cCtrl+K pour rechercher %c| %cCtrl+N pour ajouter %c| %cESC pour fermer',
    'color:#8b5cf6;', '', 'color:#06b6d4;', '', 'color:#ef4444;', '');
