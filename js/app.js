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
let unsubMobiles = null;
let unsubWifi = null;
let unsubToner = null;
let unsubTonerMovements = null;
let unsubUserPins = null;
let unsubUserRequests = null;
let unsubUserPinStatus = null;
let userRequests = [];
let userPins = [];
let wifiAuthorizations = [];
let tonerInventory = [];
let tonerMovements = [];
let unsubPaper = null;
let unsubPaperMovements = null;
let unsubPaperFullHistory = null;
let paperFullHistoryItems = [];
let paperInventory = [];
let paperMovements = [];
let activePaperId = null;
let activePaperFilters = { search: '', format: '', alertOnly: false };
let currentDistributionTab = 'distributions';

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
const defaultMobiles = [];

// Force clearing mock data for fresh database or server migration
if (localStorage.getItem('laboDataClearedForServerV1') !== 'true') {
    localStorage.setItem('laboDevicesV3', JSON.stringify([]));
    localStorage.setItem('laboPrintersV3', JSON.stringify([]));
    localStorage.setItem('laboStockItemsV3', JSON.stringify([]));
    localStorage.setItem('laboDistributionV1', JSON.stringify([]));
    localStorage.setItem('laboBesoinsV3', JSON.stringify([]));
    localStorage.setItem('laboEnvoisV1', JSON.stringify([]));
    localStorage.setItem('laboMobilesV1', JSON.stringify([]));
    localStorage.setItem('laboDataPreparedV10', 'true');
    localStorage.setItem('laboDataClearedForServerV1', 'true');
}

let devices = JSON.parse(localStorage.getItem('laboDevicesV3')) || defaultDevices;
let printers = JSON.parse(localStorage.getItem('laboPrintersV3')) || defaultPrinters;
let mobileDevices = JSON.parse(localStorage.getItem('laboMobilesV1')) || defaultMobiles;

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
window.currentMobilesPage = 1;
window.currentMobilesStatusFilter = null;
window.currentMobilesCategoryFilter = localStorage.getItem("mobileCategory") || "all";

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
                stockCode: item.stockCode || generateStockCode(docId, null, item.date ? new Date(item.date).getFullYear() : null),
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

    // 5. Mobiles, Tablettes & PDA
    const localMobiles = JSON.parse(localStorage.getItem('laboMobilesV1'));
    if (localMobiles && localMobiles.length > 0) {
        localMobiles.forEach(item => {
            const docId = item.id ? String(item.id) : db.collection("itMobiles").doc().id;
            db.collection("itMobiles").doc(docId).set({
                type: item.type || 'Téléphone',
                marque: item.marque || '',
                model: item.model || '',
                imei: item.imei || '',
                simNumber: item.simNumber || '',
                assignee: item.assignee || '',
                service: item.service || '',
                remisPar: item.remisPar || '',
                remisParFonction: item.remisParFonction || '',
                societe: item.societe || '',
                date: item.date || '',
                status: normalizeMobileStatus(item.status),
                notes: item.notes || '',
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(err => console.error("Error migrating mobile item:", err));
        });
        localStorage.removeItem('laboMobilesV1');
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
                returnedDate: data.returnedDate || '',
                restState: data.restState || '',
                restTech: data.restTech || '',
                restNotes: data.restNotes || '',
                restUser: data.restUser || '',
                restService: data.restService || '',
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
                stockCode: data.stockCode || generateStockCode(doc.id, null, data.date ? new Date(data.date).getFullYear() : null),
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
                returnedDate: data.returnedDate || '',
                restState: data.restState || '',
                restTech: data.restTech || '',
                restNotes: data.restNotes || '',
                lastUpdate: data.lastUpdate || null
            };
        });

        renderDistributionTable();
        if (typeof renderRestitutionHistoryTable === 'function') {
            renderRestitutionHistoryTable();
        }
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

    // 8. Mobiles / Tablettes / PDA Sync
    unsubMobiles = db.collection("itMobiles").onSnapshot((snapshot) => {
        mobileDevices = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data.type || 'Téléphone',
                marque: data.marque || '',
                model: data.model || data.marque || '',
                imei: data.imei || data.numSerie || '',
                simNumber: data.simNumber || data.pdaNum || '',
                assignee: data.assignee || data.employe || '',
                service: data.service || '',
                remisPar: data.remisPar || '',
                remisParFonction: data.remisParFonction || '',
                societe: data.societe || '',
                date: data.date || '',
                status: normalizeMobileStatus(data.status || data.etat),
                notes: data.notes || data.remarques || '',
                returnedDate: data.returnedDate || data.dateRestitution || '',
                restState: data.restState || '',
                restTech: data.restTech || '',
                restNotes: data.restNotes || '',
                restUser: data.restUser || '',
                restService: data.restService || '',
                lastUpdate: data.lastUpdate || null
            };
        });

        mobileDevices.sort((a, b) => {
            const tA = a.lastUpdate ? (a.lastUpdate.seconds || (a.lastUpdate.toDate ? a.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            const tB = b.lastUpdate ? (b.lastUpdate.seconds || (b.lastUpdate.toDate ? b.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
            if (tA !== tB) return tB - tA;
            return String(b.date || '').localeCompare(String(a.date || ''));
        });

        if (document.getElementById('mobileSearchInput')) {
            filterMobilesTable();
        } else {
            renderMobilesTable();
        }
        updateMobileStats();
        updateStats();
        updateDashboardAnalytics();

        if (activeMobileId && document.getElementById('mobileDetailView') && document.getElementById('mobileDetailView').classList.contains('view-active')) {
            showMobileDetail(activeMobileId);
        }
    }, (error) => {
        console.error("Firestore mobiles sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (itMobiles)", "red");
    });

    // 9. Wifi Authorizations Sync
    unsubWifi = db.collection("wifiAuthorizations").onSnapshot((snapshot) => {
        wifiAuthorizations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                permitNumber: data.permitNumber || '',
                employeeName: data.employeeName || '',
                matricule: data.matricule || '',
                poste: data.poste || '',
                dept: data.dept || '',
                phoneBrand: data.phoneBrand || '',
                phoneModel: data.phoneModel || '',
                phoneNumber: data.phoneNumber || '',
                phoneImei: data.phoneImei || '',
                phoneSn: data.phoneSn || '',
                ssid: data.ssid || '',
                date: data.date || '',
                status: data.status || 'En attente',
                agreed: data.agreed || false,
                lastUpdate: data.lastUpdate || null
            };
        });

        // Sort by permitNumber descending
        wifiAuthorizations.sort((a, b) => {
            return String(b.permitNumber || '').localeCompare(String(a.permitNumber || ''));
        });

        if (document.getElementById('wifiSearchInput')) {
            renderWifiTable();
        }
        updateWifiStats();
        updateStats();
        updateDashboardAnalytics();
    }, (error) => {
        console.error("Firestore wifi authorizations sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (wifiAuthorizations)", "red");
    });

    // 8. Toners & Cartouches Inventory Sync
    unsubToner = db.collection("tonerInventory").onSnapshot((snapshot) => {
        tonerInventory = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data.type || 'Toner',
                marque: data.marque || 'HP',
                ref: data.ref || '',
                couleur: data.couleur || 'Noir',
                compatible: data.compatible || '',
                qty: typeof data.qty === 'number' ? data.qty : 0,
                location: data.location || '',
                observation: data.observation || '',
                createdAt: data.createdAt || null,
                lastUpdate: data.lastUpdate || null
            };
        });

        tonerInventory.sort((a, b) => String(a.ref).localeCompare(String(b.ref)));

        if (document.getElementById('tonerFilterMarque')) {
            populateTonerMarqueFilter();
        }
        if (document.getElementById('tonerAllFilterMarque')) {
            populateTonerAllMarqueFilter();
        }

        if (document.getElementById('tonerCardsGrid')) {
            renderTonerTable();
        }
        if (document.getElementById('tonerAllCardsGrid')) {
            renderTonerAllCardsGrid();
        }
        updateTonerStats();
        updateDashboardAnalytics();
        initTonerCustomSelects();
    }, (error) => {
        console.error("Firestore tonerInventory sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (tonerInventory)", "red");
    });

    // 9. Toner Movements Sync
    unsubTonerMovements = db.collection("tonerMovements").onSnapshot((snapshot) => {
        tonerMovements = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                date: data.date || '',
                type: data.type || 'Entree',
                ref: data.ref || '',
                couleur: data.couleur || 'Noir',
                qty: typeof data.qty === 'number' ? data.qty : 0,
                details: data.details || '',
                operator: data.operator || '',
                timestamp: data.timestamp || null
            };
        });

        tonerMovements.sort((a, b) => {
            const tA = a.timestamp ? (a.timestamp.seconds || new Date(a.date).getTime() / 1000) : 0;
            const tB = b.timestamp ? (b.timestamp.seconds || new Date(b.date).getTime() / 1000) : 0;
            return tB - tA;
        });

        if (document.getElementById('tonerMovementsTableBody')) {
            renderTonerMovementsTable();
        }
    }, (error) => {
        console.error("Firestore tonerMovements sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (tonerMovements)", "red");
    });

    unsubUserPins = db.collection("userPins").onSnapshot((snapshot) => {
        userPins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSettingsPinsTable();
        populateCollaboratorsDropdown();
    }, (err) => console.error("Firestore sync error in userPins:", err));

    unsubUserRequests = db.collection("userRequests").onSnapshot((snapshot) => {
        userRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdminRequestsTable();
        updateAdminRequestsBadge();
    }, (err) => console.error("Firestore sync error in userRequests:", err));

    // 10. Paper Reams Inventory Sync
    unsubPaper = db.collection("paperInventory").onSnapshot((snapshot) => {
        paperInventory = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                marque: data.marque || '',
                format: data.format || 'A4',
                grammage: data.grammage || '80g',
                qty: typeof data.qty === 'number' ? data.qty : 0,
                threshold: typeof data.threshold === 'number' ? data.threshold : 5,
                location: data.location || '',
                notes: data.notes || '',
                createdAt: data.createdAt || null,
                lastUpdate: data.lastUpdate || null
            };
        });

        paperInventory.sort((a, b) => String(a.marque).localeCompare(String(b.marque)));

        updatePaperStats();
        renderPaperTable();
        if (activePaperId) {
            updatePaperDetailsPanel(activePaperId);
            const historyView = document.getElementById('paperHistoryView');
            if (historyView && historyView.classList.contains('view-active') && typeof refreshHistoryInfoFields === 'function') {
                refreshHistoryInfoFields();
            }
        }
        updateDashboardAnalytics();
    }, (error) => {
        console.error("Firestore paperInventory sync error:", error);
        showToast("⚠️ Erreur de synchronisation Firestore (paperInventory)", "red");
    });

    // 11. Paper Movements Sync
    unsubPaperMovements = db.collection("paperMovements").onSnapshot((snapshot) => {
        paperMovements = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                paperId: data.paperId || '',
                type: data.type || 'Entree',
                qty: typeof data.qty === 'number' ? data.qty : 0,
                recipient: data.recipient || '',
                user: data.user || '',
                date: data.date || '',
                notes: data.notes || '',
                timestamp: data.timestamp || null
            };
        });

        paperMovements.sort((a, b) => {
            const tA = a.timestamp ? (a.timestamp.seconds || new Date(a.date).getTime() / 1000) : 0;
            const tB = b.timestamp ? (b.timestamp.seconds || new Date(b.date).getTime() / 1000) : 0;
            return tB - tA;
        });

        if (activePaperId) {
            renderPaperMovementsTable(activePaperId);
        }
    }, (error) => {
        console.error("Firestore paperMovements sync error:", error);
        showToast("⚠️ Erreur de synchronisation (paperMovements)", "red");
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
    if (unsubMobiles) {
        unsubMobiles();
        unsubMobiles = null;
    }
    if (unsubWifi) {
        unsubWifi();
        unsubWifi = null;
    }
    if (unsubToner) {
        unsubToner();
        unsubToner = null;
    }
    if (unsubTonerMovements) {
        unsubTonerMovements();
        unsubTonerMovements = null;
    }
    if (unsubPaper) {
        unsubPaper();
        unsubPaper = null;
    }
    if (unsubPaperMovements) {
        unsubPaperMovements();
        unsubPaperMovements = null;
    }
    if (unsubPaperFullHistory) {
        unsubPaperFullHistory();
        unsubPaperFullHistory = null;
    }
    if (unsubUserPins) {
        unsubUserPins();
        unsubUserPins = null;
    }
    if (unsubUserRequests) {
        unsubUserRequests();
        unsubUserRequests = null;
    }

    devices = [];
    printers = [];
    mobileDevices = [];
    stockItems = [];
    distributionItems = [];
    besoins = [];
    envois = [];
    pannes = [];
    wifiAuthorizations = [];
    tonerInventory = [];
    tonerMovements = [];
    paperInventory = [];
    paperMovements = [];

    renderTable();
    renderPrintersTable();
    if (typeof renderStockCategoryTable === 'function') renderStockCategoryTable();
    if (typeof renderDistributionTable === 'function') renderDistributionTable();
    if (typeof renderBesoinsTable === 'function') renderBesoinsTable();
    if (typeof renderEnvoisTable === 'function') renderEnvoisTable();
    if (typeof renderPannesTable === 'function') renderPannesTable();
    if (typeof renderMobilesTable === 'function') renderMobilesTable();
    if (typeof renderWifiTable === 'function') renderWifiTable();
    if (typeof renderPaperTable === 'function') renderPaperTable();

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
    const totalMobiles = mobileDevices.length;
    const total = devices.length + printers.length + totalMobiles + stockLaptops + stockDesktops;
    const active = devices.filter(d => d.type !== 'Desktop').length;
    const maint = devices.filter(d => d.status === 'Maintenance').length +
        printers.filter(p => p.status === 'Maintenance').length +
        mobileDevices.filter(m => normalizeMobileStatus(m.status) === 'Maintenance').length;
    const stock = stockItems.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    const desktop = devices.filter(d => d.type === 'Desktop').length;

    smoothAnimate('statTotal', total);
    smoothAnimate('statPC', active);
    smoothAnimate('statMaint', maint);
    smoothAnimate('statStock', stock);
    smoothAnimate('statPrint', printers.length);
    smoothAnimate('statDesktop', desktop);
    smoothAnimate('statMobile', totalMobiles);

    updateDashboardStatChange('statTotalChange', total > 0 ? 'Données live' : 'Aucune donnée', 'fas fa-database');
    updateDashboardStatChange('statPCChange', formatShare(active, total), 'fas fa-chart-pie');
    updateDashboardStatChange('statMaintChange', formatShare(maint, total), 'fas fa-chart-pie');
    updateDashboardStatChange('statStockChange', stock > 0 ? 'Stock réel' : 'Aucune donnée', 'fas fa-boxes-stacked');
    updateDashboardStatChange('statPrintChange', formatShare(printers.length, total), 'fas fa-chart-pie');
    updateDashboardStatChange('statDesktopChange', formatShare(desktop, total), 'fas fa-chart-pie');
    updateDashboardStatChange('statMobileChange', formatShare(totalMobiles, total), 'fas fa-chart-pie');
    
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

    updateMobileStats();
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
    const totalMobiles = mobileDevices.length;
    const totalDevices = devices.length + printers.length + totalMobiles + stockLaptops + stockDesktops;
    const activeDevices = devices.filter(d => d.status === 'Actif').length + printers.filter(p => p.status === 'Actif').length + mobileDevices.filter(m => normalizeMobileStatus(m.status) === 'Affecte').length;
    const maintenanceDevices = devices.filter(d => d.status === 'Maintenance').length +
        printers.filter(p => p.status === 'Maintenance').length +
        mobileDevices.filter(m => normalizeMobileStatus(m.status) === 'Maintenance').length;
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
    const activeDistCount = distributionItems.filter(d => d.type !== 'Fin de Contrat').length;
    setText('analyticsLoanSub', lateLoans > 0 ? `${lateLoans} en retard` : `${activeDistCount} opérations`);

    setText('dashboardLaptopCount', laptopDevices);
    setText('dashboardDesktopCount', desktopDevices);
    setText('dashboardPrinterCount', totalPrinters);
    setText('dashboardMobileCount', totalMobiles);

    const operationsMax = Math.max(1, laptopDevices, desktopDevices, totalPrinters, totalMobiles);
    setMetricWidth('dashboardLaptopBar', (laptopDevices / operationsMax) * 100);
    setMetricWidth('dashboardDesktopBar', (desktopDevices / operationsMax) * 100);
    setMetricWidth('dashboardPrinterBar', (totalPrinters / operationsMax) * 100);
    setMetricWidth('dashboardMobileBar', (totalMobiles / operationsMax) * 100);

    setText('moduleDeviceBadge', `${devices.length} Appareils`);
    setText('modulePrinterBadge', `${totalPrinters} Imprimantes`);
    setText('moduleMobileBadge', `${totalMobiles} Mobiles`);
    setText('moduleStockBadge', `${stockUnits} Pièces`);
    const totalDistributions = activeDistCount + wifiAuthorizations.length;
    setText('moduleDistributionBadge', totalDistributions ? `${totalDistributions} Bons` : 'Suivi');

    const chartValues = [
        { bar: 'chartLaptops', label: 'chartLaptopsValue', value: laptopDevices },
        { bar: 'chartDesktops', label: 'chartDesktopsValue', value: desktopDevices },
        { bar: 'chartPrinters', label: 'chartPrintersValue', value: totalPrinters },
        { bar: 'chartMobiles', label: 'chartMobilesValue', value: totalMobiles }
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
        const parts = specsStr.split(/,|\s-\s|\n/).map(p => p.trim()).filter(Boolean);
        
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
    selectMobileCategory(window.currentMobilesCategoryFilter);
    updateMobileStats();
    
    // Set up Firebase Auth Observer
    auth.onAuthStateChanged((user) => {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const isWelcomeVisible = welcomeScreen && welcomeScreen.style.display !== 'none';

        if (user) {
            console.log("Firebase Auth User connected:", user.email || "Anonymous");
            if (user.email && user.email !== 'collaborateur@nedjma.dz') {
                const localUser = { email: user.email };
                localStorage.setItem('laboCurrentUserV3', JSON.stringify(localUser));
                localStorage.removeItem('laboUserSession');
                
                if (!isWelcomeVisible) {
                    const loginScreen = document.getElementById('loginScreen');
                    if (loginScreen && loginScreen.style.display !== 'none') {
                        handleAuthRedirect();
                    } else {
                        updateAuthUI();
                        startFirestoreSync();
                    }
                } else {
                    updateAuthUI();
                    startFirestoreSync();
                }
            } else if (user.email === 'collaborateur@nedjma.dz') {
                const localSession = JSON.parse(localStorage.getItem('laboUserSession'));
                if (localSession && localSession.role === 'user') {
                    if (!isWelcomeVisible) {
                        const loginScreen = document.getElementById('loginScreen');
                        if (loginScreen && loginScreen.style.display !== 'none') {
                            handleAuthRedirect();
                        }
                    }
                } else {
                    if (!isWelcomeVisible) {
                        const loginScreen = document.getElementById('loginScreen');
                        if (loginScreen) {
                            loginScreen.style.display = 'flex';
                            loginScreen.classList.remove('hidden');
                        }
                        document.querySelector('.container').style.display = 'none';
                        document.getElementById('userPortalContainer').style.display = 'none';
                    }
                }
            } else {
                auth.signOut();
            }
        } else {
            console.log("Firebase Auth User disconnected");
            localStorage.removeItem('laboCurrentUserV3');
            localStorage.removeItem('laboUserSession');
            
            updateAuthUI();
            stopFirestoreSync();
            
            if (!isWelcomeVisible) {
                const loginScreen = document.getElementById('loginScreen');
                if (loginScreen && loginScreen.style.display !== 'flex') {
                    handleAuthRedirect();
                }
            }
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
        if (currentDistributionTab === 'distributions') {
            renderDistributionTable();
        } else {
            renderWifiTable();
        }
    }

    // Refresh needs data when entering besoins view
    if (viewId === 'besoinsView') {
        updateBesoinsStats();
        renderBesoinsTable();
    }

    if (viewId === 'mobilesView') {
        updateMobileStats();
        renderMobilesTable();
    }

    if (viewId === 'tonerCartoucheView') {
        updateTonerStats();
        renderTonerTable();
        renderTonerMovementsTable();
    }

    // Ø§Ù„ØªÙ…Ø±ÙŠØ± Ù„Ù„Ø£Ø¹Ù„Ù‰
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ UNIVERSAL RECORD DETAIL VIEW ============
let activeRecordDetail = null;

function formatRecordDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('fr-FR');
}

function recordDetailField(label, value) {
    return '<div class="record-detail-info-item">' +
        '<span>' + escapeHTML(label) + '</span>' +
        '<strong>' + escapeHTML(value || 'N/A') + '</strong>' +
        '</div>';
}

function recordDetailItemsHTML(items) {
    if (!items || !items.length) {
        return '<div class="record-detail-item-card"><div><strong>Aucun élément détaillé</strong><small>Ce document ne contient pas de lignes supplémentaires.</small></div><span class="record-detail-item-qty">0</span></div>';
    }

    return items.map(item => {
        const title = item.title || item.desc || item.name || 'Élément';
        const sub = item.sub || item.obs || item.notes || '';
        const qty = item.qty || item.quantity || 1;
        return '<div class="record-detail-item-card">' +
            '<div><strong>' + escapeHTML(title) + '</strong>' +
            (sub ? '<small>' + escapeHTML(sub) + '</small>' : '') +
            '</div>' +
            '<span class="record-detail-item-qty">' + escapeHTML(qty) + '</span>' +
            '</div>';
    }).join('');
}

function recordStatusClass(status) {
    const value = (status || '').toLowerCase();
    if (value.includes('retard') || value.includes('rejet') || value.includes('rupture') || value.includes('déclass') || value.includes('révoq') || value.includes('expir')) return 'status-danger';
    if (value.includes('attente') || value.includes('cours') || value.includes('transit') || value.includes('urgent') || value.includes('alerte') || value.includes('suspend')) return 'status-warning';
    if (value.includes('don') || value.includes('livr') || value.includes('approuv') || value.includes('rendu') || value.includes('répar') || value.includes('stock') || value.includes('active')) return 'status-info';
    return '';
}

function setRecordTheme(config) {
    const view = document.getElementById('recordDetailView');
    if (!view) return;
    view.style.setProperty('--record-accent', config.accent || 'var(--gradient-blue-cyan)');
    view.style.setProperty('--record-glow', config.glow || 'rgba(59, 130, 246, 0.14)');
    view.style.setProperty('--record-shadow', config.shadow || 'rgba(37, 99, 235, 0.26)');
}

function configureRecordDetailButtons(config) {
    const backBtn = document.getElementById('recordDetailBackBtn');
    const editBtn = document.getElementById('recordDetailEditBtn');
    const printBtn = document.getElementById('recordDetailPrintBtn');
    const deleteBtn = document.getElementById('recordDetailDeleteBtn');

    if (backBtn) backBtn.onclick = config.back || function () { showView('dashboardView'); };

    if (editBtn) {
        editBtn.style.display = config.edit ? 'inline-flex' : 'none';
        editBtn.onclick = config.edit || null;
    }

    if (printBtn) {
        printBtn.style.display = config.print ? 'inline-flex' : 'none';
        printBtn.style.background = config.accent || 'var(--gradient-blue-cyan)';
        printBtn.onclick = config.print || null;
    }

    if (deleteBtn) {
        deleteBtn.style.display = config.remove ? 'inline-flex' : 'none';
        deleteBtn.onclick = config.remove || null;
    }
}

function setRecordDetailContent(config) {
    activeRecordDetail = { type: config.type, id: config.id };
    setRecordTheme(config);

    const iconClass = config.icon || 'fas fa-folder-open';
    setText('recordDetailTitle', config.title || 'Détail');
    setText('recordDetailSubtitle', config.subtitle || 'Vue complète de l\'enregistrement.');
    setText('recordDetailType', config.typeLabel || 'Module');
    setText('recordDetailMainTitle', config.mainTitle || 'Enregistrement');
    setText('recordDetailRef', config.ref || 'N/A');
    setText('recordDetailStatus', config.status || 'N/A');
    setText('recordDetailOwnerLabel', config.ownerLabel || 'Responsable');
    setText('recordDetailOwner', config.owner || 'N/A');
    setText('recordDetailOwnerSub', config.ownerSub || 'N/A');
    setText('recordDetailNotes', config.notes || 'Aucune observation particulière.');

    const toolbarIcon = document.getElementById('recordDetailIcon');
    const heroIcon = document.getElementById('recordDetailHeroIcon');
    const refEl = document.getElementById('recordDetailRef');
    if (refEl) {
        refEl.style.cursor = config.copyRef ? 'pointer' : '';
        refEl.title = config.copyRef ? 'Cliquer pour copier' : '';
        refEl.onclick = config.copyRef ? function () { copyTextToClipboard(config.ref, 'Code copié'); } : null;
    }
    if (toolbarIcon) {
        toolbarIcon.style.background = config.accent || 'var(--gradient-blue-cyan)';
        safeSetHTML(toolbarIcon, '<i class="' + escapeHTML(iconClass) + '"></i>');
    }
    if (heroIcon) safeSetHTML(heroIcon, '<i class="' + escapeHTML(iconClass) + '"></i>');

    const statusEl = document.getElementById('recordDetailStatus');
    if (statusEl) {
        statusEl.className = 'record-detail-status ' + recordStatusClass(config.status);
    }

    const primaryGrid = document.getElementById('recordDetailPrimaryGrid');
    const secondaryGrid = document.getElementById('recordDetailSecondaryGrid');
    const itemsSection = document.getElementById('recordDetailItemsSection');
    const itemsEl = document.getElementById('recordDetailItems');

    if (primaryGrid) safeSetHTML(primaryGrid, (config.primary || []).map(f => recordDetailField(f.label, f.value)).join(''));
    if (secondaryGrid) safeSetHTML(secondaryGrid, (config.secondary || []).map(f => recordDetailField(f.label, f.value)).join(''));

    if (itemsSection) itemsSection.style.display = config.items === null ? 'none' : 'block';
    if (itemsEl && config.items !== null) safeSetHTML(itemsEl, recordDetailItemsHTML(config.items || []));

    configureRecordDetailButtons(config);
    showView('recordDetailView');
}

function backToBesoinsTab(tab) {
    showView('besoinsView');
    switchBesoinsTab(tab);
}

function showRecordDetail(type, id) {
    const idStr = String(id);

    if (type === 'wifi') {
        const item = wifiAuthorizations.find(x => String(x.id) === idStr);
        if (!item) return;
        setRecordDetailContent({
            type,
            id,
            title: item.permitNumber || 'Autorisation Wi-Fi',
            subtitle: 'Autorisation d\'accès Wi-Fi pour ' + (item.employeeName || 'N/A') + '.',
            typeLabel: 'Wi-Fi Access',
            mainTitle: item.permitNumber || 'Autorisation Wi-Fi',
            ref: item.permitNumber,
            copyRef: true,
            status: item.status,
            ownerLabel: 'Bénéficiaire',
            owner: item.employeeName || 'N/A',
            ownerSub: item.dept || 'N/A',
            icon: 'fas fa-wifi',
            accent: 'var(--gradient-emerald-teal)',
            glow: 'rgba(16, 185, 129, 0.14)',
            shadow: 'rgba(16, 185, 129, 0.25)',
            primary: [
                { label: 'Employé', value: item.employeeName },
                { label: 'Poste', value: item.poste },
                { label: 'Département', value: item.dept }
            ],
            secondary: [
                { label: 'Marque / Modèle', value: (item.phoneBrand || 'N/A') + ' ' + (item.phoneModel || 'N/A') },
                { label: 'MAC / IP', value: 'MAC: ' + (item.phoneImei || 'N/A') + ' / IP: ' + (item.phoneNumber || 'N/A') },
                { label: 'Réseau SSID', value: item.ssid },
                { label: 'Date d\'émission', value: formatRecordDate(item.date) }
            ],
            items: null,
            notes: 'Engagement signé: Oui\n\nStatut d\'accès: ' + item.status,
            back: function () { showWifiAuthView(); },
            edit: function () { editWifiAuthorization(item.id); },
            print: function () { printWifiAuthorization(item.id); },
            remove: function () { deleteWifiAuthorization(item.id); }
        });
        return;
    }

    if (type === 'stock') {
        const item = stockItems.find(x => String(x.id) === idStr);
        if (!item) return;
        const qty = parseInt(item.qty || 0, 10);
        const threshold = parseInt(appSettings.stockThreshold || 5, 10);
        const stockStatus = qty <= 0 ? 'Rupture de stock' : qty <= threshold ? 'Alerte stock' : 'En stock';
        const stockCode = getStockCode(item);
        setRecordDetailContent({
            type,
            id,
            title: item.name || 'Article Stock',
            subtitle: 'Fiche complète de l\'article stocké.',
            typeLabel: item.category || 'Stock',
            mainTitle: item.name || 'Article Stock',
            ref: stockCode,
            copyRef: true,
            status: stockStatus,
            ownerLabel: 'Emplacement',
            owner: item.location || 'N/A',
            ownerSub: item.category || 'Stock IT',
            icon: getCategoryIcon(item.category),
            accent: 'var(--gradient-cyan-blue)',
            glow: 'rgba(14, 165, 233, 0.14)',
            shadow: 'rgba(14, 165, 233, 0.25)',
            primary: [
                { label: 'Désignation', value: item.name },
                { label: 'Référence / S/N', value: item.ref || 'N/A' },
                { label: 'Code RF Stock', value: stockCode },
                { label: 'Catégorie', value: item.category },
                { label: 'Quantité disponible', value: qty + ' unité(s)' }
            ],
            secondary: [
                { label: 'Emplacement', value: item.location },
                { label: 'Date réception', value: formatRecordDate(item.date) },
                { label: 'Seuil d\'alerte', value: threshold + ' unité(s)' },
                { label: 'État stock', value: stockStatus }
            ],
            items: null,
            notes: item.notes || 'Aucune observation particulière.',
            back: function () { showView('stockCategoryDetailView'); },
            edit: function () { editStockItem(item.id); },
            remove: function () { deleteStockItem(item.id); }
        });
        return;
    }

    if (type === 'distribution') {
        const item = distributionItems.find(x => String(x.id) === idStr);
        if (!item) return;
        const statusInfo = getDistributionStatus(item);
        setRecordDetailContent({
            type,
            id,
            title: item.article || 'Distribution',
            subtitle: 'Matériel remis à ' + (item.employeeName || 'N/A') + '.',
            typeLabel: item.type || 'Distribution',
            mainTitle: item.article || 'Distribution',
            ref: 'DIST-' + String(item.id).padStart(4, '0'),
            status: statusInfo.label,
            ownerLabel: 'Bénéficiaire',
            owner: item.employeeName || 'N/A',
            ownerSub: item.service || 'N/A',
            icon: 'fas fa-hand-holding',
            accent: 'var(--gradient-emerald-teal)',
            glow: 'rgba(16, 185, 129, 0.14)',
            shadow: 'rgba(16, 185, 129, 0.25)',
            primary: [
                { label: 'Employé', value: item.employeeName },
                { label: 'Service', value: item.service },
                { label: 'Article', value: item.article },
                { label: 'Quantité', value: (item.qty || 1) + ' unité(s)' }
            ],
            secondary: [
                { label: 'Type', value: item.type },
                { label: 'Date distribution', value: formatRecordDate(item.date) },
                { label: 'Retour prévu', value: item.type === 'Prêt' ? formatRecordDate(item.returnDate) : 'Non concerné' },
                { label: 'Retour effectif', value: item.returnedDate ? formatRecordDate(item.returnedDate) : 'Non renseigné' }
            ],
            items: [{ title: item.article || 'Article', sub: item.type || 'Distribution', qty: item.qty || 1 }],
            notes: item.notes || 'Aucune observation particulière.',
            back: function () { showView('distributionView'); },
            edit: function () { editDistribution(item.id); },
            print: function () { if (item.type === 'Fin de Contrat') { printRestitutionPDF(item.id); } else { printDistributionDischarge(item.id); } },
            remove: function () { deleteDistribution(item.id); }
        });
        return;
    }

    if (type === 'besoin') {
        const item = besoins.find(x => String(x.id) === idStr);
        if (!item) return;
        setRecordDetailContent({
            type,
            id,
            title: 'REQ-' + String(item.id).padStart(4, '0'),
            subtitle: 'Demande d\'achat émise par ' + (item.demandeur || 'N/A') + '.',
            typeLabel: 'Demande d\'achat',
            mainTitle: 'REQ-' + String(item.id).padStart(4, '0'),
            ref: item.priority || 'Urgent',
            status: item.status || 'En attente',
            ownerLabel: 'Demandeur',
            owner: item.demandeur || 'N/A',
            ownerSub: item.service || 'N/A',
            icon: 'fas fa-shopping-cart',
            accent: 'var(--gradient-rose-amber)',
            glow: 'rgba(251, 146, 60, 0.14)',
            shadow: 'rgba(251, 146, 60, 0.25)',
            primary: [
                { label: 'N° demande', value: 'REQ-' + String(item.id).padStart(4, '0') },
                { label: 'Demandeur', value: item.demandeur },
                { label: 'Service / Département', value: item.service },
                { label: 'Priorité', value: item.priority }
            ],
            secondary: [
                { label: 'Date demande', value: formatRecordDate(item.date) },
                { label: 'Date limite', value: item.dateLimite ? formatRecordDate(item.dateLimite) : 'Non spécifiée' },
                { label: 'Statut', value: item.status },
                { label: 'Nombre d\'articles', value: (item.items || []).length }
            ],
            items: (item.items || []).map(x => ({ title: x.desc, sub: x.obs || 'Sans observation', qty: x.qty || 1 })),
            notes: 'Cette fiche regroupe les articles demandés et leur priorité de traitement.',
            back: function () { backToBesoinsTab('demandes'); },
            edit: function () { editBesoin(item.id); },
            print: function () { printBesoinsPDF(item.id); },
            remove: function () { deleteBesoin(item.id); }
        });
        return;
    }

    if (type === 'envoi') {
        const item = envois.find(x => String(x.id) === idStr);
        if (!item) return;
        const status = item.livre === true ? 'Livré' : 'En Transit';
        setRecordDetailContent({
            type,
            id,
            title: item.equipement || 'Confirmation d\'envoi',
            subtitle: 'Envoi destiné à ' + (item.destinataire || 'N/A') + '.',
            typeLabel: 'Confirmation d\'envoi',
            mainTitle: item.equipement || 'Équipement',
            ref: 'ENV-' + String(item.id).padStart(4, '0'),
            status,
            ownerLabel: 'Destinataire',
            owner: item.destinataire || 'N/A',
            ownerSub: item.lieu || 'N/A',
            icon: 'fas fa-paper-plane',
            accent: 'var(--gradient-blue-cyan)',
            glow: 'rgba(59, 130, 246, 0.14)',
            shadow: 'rgba(59, 130, 246, 0.25)',
            primary: [
                { label: 'Destinataire', value: item.destinataire },
                { label: 'Lieu de livraison', value: item.lieu },
                { label: 'Équipement', value: item.equipement },
                { label: 'Quantité', value: (item.qty || 1) + ' unité(s)' }
            ],
            secondary: [
                { label: 'Date d\'envoi', value: formatRecordDate(item.date) },
                { label: 'Type', value: item.type },
                { label: 'Marque', value: item.marque || 'N/A' },
                { label: 'État', value: item.etat }
            ],
            items: [{ title: item.equipement || 'Équipement', sub: (item.type || '') + (item.marque ? ' - ' + item.marque : ''), qty: item.qty || 1 }],
            notes: item.notes || 'Aucune observation particulière.',
            back: function () { backToBesoinsTab('envois'); },
            edit: function () { editEnvoi(item.id); },
            print: function () { printEnvoiPDF(item.id); },
            remove: function () { deleteEnvoi(item.id); }
        });
        return;
    }

    if (type === 'panne') {
        const item = pannes.find(x => String(x.id) === idStr);
        if (!item) return;
        setRecordDetailContent({
            type,
            id,
            title: item.equipement || 'Fiche de panne',
            subtitle: 'Signalement déclaré par ' + (item.declarant || 'N/A') + '.',
            typeLabel: 'Fiche de panne',
            mainTitle: item.equipement || 'Équipement',
            ref: '#' + item.id,
            status: item.status || 'En attente',
            ownerLabel: 'Déclarant',
            owner: item.declarant || 'N/A',
            ownerSub: item.telephone || item.service || 'N/A',
            icon: 'fas fa-tools',
            accent: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            glow: 'rgba(245, 158, 11, 0.14)',
            shadow: 'rgba(245, 158, 11, 0.25)',
            primary: [
                { label: 'Équipement', value: item.equipement },
                { label: 'Numéro de série', value: item.sn || 'N/A' },
                { label: 'Type matériel', value: item.type },
                { label: 'Service', value: item.service }
            ],
            secondary: [
                { label: 'Déclarant', value: item.declarant },
                { label: 'Téléphone', value: item.telephone || 'N/A' },
                { label: 'Date signalement', value: formatRecordDate(item.date) },
                { label: 'Priorité', value: item.gravite }
            ],
            items: null,
            notes: item.notes || 'Aucune observation particulière.',
            back: function () { backToBesoinsTab('pannes'); },
            edit: function () { editPanne(item.id); },
            remove: function () { deletePanne(item.id); }
        });
        return;
    }

    if (type === 'restitution') {
        const item = (typeof distributionItems !== 'undefined' ? distributionItems : (window.distributionItems || [])).find(x => String(x.id) === idStr);
        if (!item) return;
        const rawId = item.id || '0';
        const refCode = `RET-CONTRAT-${rawId.toString().padStart(4, '0')}-${new Date().getFullYear()}`;
        setRecordDetailContent({
            type,
            id,
            title: item.article || 'Fin de Contrat',
            subtitle: 'Restitution de matériel et clôture de contrat pour ' + (item.employeeName || 'N/A') + '.',
            typeLabel: 'Fin de Contrat',
            mainTitle: item.article || 'Matériel Restitué',
            ref: refCode,
            copyRef: true,
            status: item.restState || 'Sain et sauf',
            ownerLabel: 'Bénéficiaire',
            owner: item.employeeName || 'N/A',
            ownerSub: item.service || 'N/A',
            icon: 'fas fa-history',
            accent: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
            glow: 'rgba(153, 27, 27, 0.14)',
            shadow: 'rgba(153, 27, 27, 0.25)',
            primary: [
                { label: 'Bénéficiaire', value: item.employeeName },
                { label: 'Service / Département', value: item.service },
                { label: 'Matériel Rendu', value: item.article },
                { label: 'Référence', value: refCode }
            ],
            secondary: [
                { label: 'Date de restitution', value: formatRecordDate(item.returnedDate || item.date) },
                { label: 'État de conformité', value: item.restState || 'Sain et sauf' },
                { label: 'Technicien Réceptionnaire', value: item.restTech || 'N/A' },
                { label: 'Date Prêt Original', value: formatRecordDate(item.date) }
            ],
            items: [{ title: item.article || 'Article', sub: 'Matériel restitué', qty: 1 }],
            notes: item.restNotes || item.notes || 'Aucune observation particulière.',
            back: function () { showView('restitutionHistoryView'); },
            edit: null,
            print: function () { printRestitutionPDF(item.id); },
            remove: null
        });
        return;
    }
}

window.showRecordDetail = showRecordDetail;

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
        setTimeout(() => {
            screen.style.display = 'none';
            handleAuthRedirect();
        }, 1000);
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

// ============ MODULE: TELEPHONES, TABLETTES & PDA ============
let editingMobileId = null;
let activeMobileId = null;

function normalizeMobileStatus(status) {
    if (status === 'Affecté') return 'Affecte';
    return status || 'Affecte';
}

function getMobileStatusLabel(status) {
    const safeStatus = normalizeMobileStatus(status);
    if (safeStatus === 'Stock') return 'En Stock';
    if (safeStatus === 'Maintenance') return 'Maintenance';
    return 'Affecté';
}

function getMobileStatusClass(status) {
    const safeStatus = normalizeMobileStatus(status);
    if (safeStatus === 'Stock') return 'status-stock';
    if (safeStatus === 'Maintenance') return 'status-maintenance';
    return 'status-active';
}

function updateMobileStats() {
    const total = mobileDevices.length;
    const assigned = mobileDevices.filter(m => normalizeMobileStatus(m.status) === 'Affecte').length;
    const maint = mobileDevices.filter(m => normalizeMobileStatus(m.status) === 'Maintenance').length;
    smoothAnimate('mobileTotalCount', total);
    smoothAnimate('mobileAssignedCount', assigned);
    smoothAnimate('mobileMaintCount', maint);

    // Helper to get stats for a specific category
    function getStatsForType(filterType) {
        let items = mobileDevices;
        if (filterType !== 'all') {
            items = mobileDevices.filter(item => {
                const itemType = (item.type || '').toLowerCase();
                if (filterType === 'Telephone') {
                    return itemType === 'telephone' || itemType === 'téléphone';
                }
                return itemType === filterType.toLowerCase();
            });
        }
        
        const tot = items.length;
        const aff = items.filter(m => normalizeMobileStatus(m.status) === 'Affecte').length;
        const mnt = items.filter(m => normalizeMobileStatus(m.status) === 'Maintenance').length;
        const stk = items.filter(m => normalizeMobileStatus(m.status) === 'Stock').length;
        return { tot, aff, mnt, stk };
    }

    // Calculate stats for all 4 categories
    const allStats = getStatsForType('all');
    const phoneStats = getStatsForType('Telephone');
    const tabletStats = getStatsForType('Tablette');
    const pdaStats = getStatsForType('PDA');

    // Smooth animate all counters on our dashboard cards
    // Tous Card
    smoothAnimate('mobileAllCount', allStats.tot);
    smoothAnimate('mobileAllAssigned', allStats.aff);
    smoothAnimate('mobileAllMaint', allStats.mnt);

    // Téléphones Card
    smoothAnimate('mobilePhonesCount', phoneStats.tot);
    smoothAnimate('mobilePhonesAssigned', phoneStats.aff);
    smoothAnimate('mobilePhonesMaint', phoneStats.mnt);

    // Tablettes Card
    smoothAnimate('mobileTabletsCount', tabletStats.tot);
    smoothAnimate('mobileTabletsAssigned', tabletStats.aff);
    smoothAnimate('mobileTabletsMaint', tabletStats.mnt);

    // PDA Card
    smoothAnimate('mobilePDAsCount', pdaStats.tot);
    smoothAnimate('mobilePDAsAssigned', pdaStats.aff);
    smoothAnimate('mobilePDAsMaint', pdaStats.mnt);
}

function renderMobilesTable(data = null) {
    const tbody = document.getElementById('mobilesTableBody');
    if (!tbody) return;

    let displayData = Array.isArray(data) ? data : mobileDevices;
    
    // Filter by active category card (Tous, Téléphones, Tablettes, PDA)
    if (window.currentMobilesCategoryFilter && window.currentMobilesCategoryFilter !== 'all') {
        displayData = displayData.filter(item => {
            const itemType = (item.type || '').toLowerCase();
            const filterType = window.currentMobilesCategoryFilter.toLowerCase();
            if (filterType === 'telephone') {
                return itemType === 'telephone' || itemType === 'téléphone';
            }
            return itemType === filterType;
        });
    }

    const queryEl = document.getElementById('mobileSearchInput');
    const query = queryEl ? queryEl.value.toLowerCase().trim() : '';

    if (window.currentMobilesStatusFilter) {
        displayData = displayData.filter(item => normalizeMobileStatus(item.status) === window.currentMobilesStatusFilter);
    }

    if (query) {
        displayData = displayData.filter(item =>
            (item.assignee && item.assignee.toLowerCase().includes(query)) ||
            (item.service && item.service.toLowerCase().includes(query)) ||
            (item.model && item.model.toLowerCase().includes(query)) ||
            (item.marque && item.marque.toLowerCase().includes(query)) ||
            (item.imei && item.imei.toLowerCase().includes(query)) ||
            (item.simNumber && item.simNumber.toLowerCase().includes(query)) ||
            (item.type && item.type.toLowerCase().includes(query))
        );
    }

    displayData = [...displayData].sort((a, b) => {
        const tA = a.lastUpdate ? (a.lastUpdate.seconds || (a.lastUpdate.toDate ? a.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
        const tB = b.lastUpdate ? (b.lastUpdate.seconds || (b.lastUpdate.toDate ? b.lastUpdate.toDate().getTime() / 1000 : 0)) : 0;
        if (tA !== tB) return tB - tA;
        return String(b.date || '').localeCompare(String(a.date || ''));
    });

    window.currentMobilesData = displayData;
    const totalItems = displayData.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (window.currentMobilesPage > totalPages) window.currentMobilesPage = totalPages;
    if (window.currentMobilesPage < 1) window.currentMobilesPage = 1;

    const startIndex = (window.currentMobilesPage - 1) * pageSize;
    const pageData = displayData.slice(startIndex, startIndex + pageSize);

    if (pageData.length === 0) {
        safeSetHTML(tbody, '<tr><td colspan="7" style="text-align:center; padding:2.2rem; color:var(--text-muted); font-weight:700;"><i class="fas fa-mobile-screen-button" style="display:block; font-size:2rem; margin-bottom:0.8rem; opacity:0.55;"></i>Aucun mobile enregistre.</td></tr>');
        renderMobilesPagination(totalItems, totalPages, window.currentMobilesPage);
        return;
    }

    tbody.innerHTML = '';
    pageData.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'mobile-clickable-row';
        tr.tabIndex = 0;
        tr.title = 'Ouvrir la fiche détail';
        const statusClass = getMobileStatusClass(item.status);
        const statusLabel = getMobileStatusLabel(item.status);
        const dateLabel = item.date ? new Date(item.date).toLocaleDateString('fr-FR') : 'N/A';
        const equipmentLabel = (item.marque && item.model && item.marque !== item.model) ? `${item.marque} ${item.model}` : (item.marque || item.model || 'N/A');

        safeSetHTML(tr,
            '<td><div style="font-weight:800; color:var(--text-primary);">' + escapeHTML(item.assignee || 'Non assigne') + '</div>' +
            '<small style="color:var(--text-muted); font-weight:650;">' + escapeHTML(item.service || 'Sans service') + '</small></td>' +
            '<td><div style="font-weight:800; color:var(--text-primary);"><i class="fas fa-mobile-screen-button" style="color:var(--indigo-500); margin-right:0.45rem;"></i>' + escapeHTML(equipmentLabel) + '</div>' +
            '<small style="color:var(--text-muted); font-weight:650;">' + escapeHTML(item.type || 'Telephone') + '</small></td>' +
            '<td><code style="background:var(--bg-secondary); padding:0.25rem 0.55rem; border-radius:0.5rem; border:1px solid var(--border-color);">' + escapeHTML(item.imei || 'N/A') + '</code></td>' +
            '<td>' + (item.simNumber ? '<span style="font-weight:800; color:var(--blue-500);">' + escapeHTML(item.simNumber) + '</span>' : '<span style="color:var(--text-muted);">N/A</span>') + '</td>' +
            '<td><span class="status-badge-table ' + escapeHTML(statusClass) + '">' + escapeHTML(statusLabel) + '</span></td>' +
            '<td>' + escapeHTML(dateLabel) + '</td>' +
            '<td><div class="action-btns" style="justify-content:center; gap:0.4rem;">' +
            "<button class=\"action-btn\" title=\"Decharge PDF\" onclick=\"event.stopPropagation(); printMobileDischarge('" + escapeHTML(item.id) + "')\" style=\"color:#2563eb;\"><i class=\"fas fa-file-pdf\"></i></button>" +
            "<button class=\"action-btn\" title=\"Modifier\" onclick=\"event.stopPropagation(); editMobile('" + escapeHTML(item.id) + "')\"><i class=\"fas fa-edit\"></i></button>" +
            "<button class=\"action-btn delete\" title=\"Supprimer\" onclick=\"event.stopPropagation(); deleteMobile('" + escapeHTML(item.id) + "')\"><i class=\"fas fa-trash-alt\"></i></button>" +
            '</div></td>'
        );
        tr.addEventListener('click', function () {
            showMobileDetail(item.id);
        });
        tr.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showMobileDetail(item.id);
            }
        });
        tbody.appendChild(tr);
    });

    renderMobilesPagination(totalItems, totalPages, window.currentMobilesPage);
}

function getMobileTypeIcon(type) {
    const normalizedType = String(type || '').toLowerCase();
    if (normalizedType.includes('tablette')) return 'fa-tablet-screen-button';
    if (normalizedType.includes('pda')) return 'fa-barcode';
    return 'fa-mobile-screen-button';
}

function setMobileDetailText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || 'N/A';
}

function showMobileDetail(id) {
    const item = mobileDevices.find(m => String(m.id) === String(id));
    if (!item) {
        showToast("⚠️ Mobile introuvable", "red");
        showView('mobilesView');
        return;
    }

    activeMobileId = String(id);
    const equipmentLabel = (item.marque && item.model && item.marque !== item.model) ? `${item.marque} ${item.model}` : (item.marque || item.model || 'N/A');
    const dateLabel = item.date ? new Date(item.date).toLocaleDateString('fr-FR') : 'N/A';
    const statusLabel = getMobileStatusLabel(item.status);
    const statusClass = getMobileStatusClass(item.status);
    const typeLabel = item.type || 'Téléphone';

    setMobileDetailText('mobileDetailTitle', equipmentLabel);
    setMobileDetailText('mobileDetailSubtitle', typeLabel + ' confié à ' + (item.assignee || 'N/A'));
    setMobileDetailText('mobileDetailType', typeLabel);
    setMobileDetailText('mobileDetailModel', equipmentLabel);
    setMobileDetailText('mobileDetailImei', item.imei || 'N/A');
    setMobileDetailText('mobileDetailAssignee', item.assignee || 'N/A');
    setMobileDetailText('mobileDetailService', item.service || 'Sans service');
    setMobileDetailText('mobileDetailRemisPar', item.remisPar || 'N/A');
    setMobileDetailText('mobileDetailRemisParFonction', item.remisParFonction || 'N/A');
    setMobileDetailText('mobileDetailSociete', item.societe || 'N/A');
    setMobileDetailText('mobileDetailDate', dateLabel);
    setMobileDetailText('mobileDetailDeviceType', typeLabel);
    setMobileDetailText('mobileDetailMarque', item.marque || 'N/A');
    setMobileDetailText('mobileDetailDeviceModel', item.model || 'N/A');
    setMobileDetailText('mobileDetailSim', item.simNumber || 'N/A');
    setMobileDetailText('mobileDetailNotes', item.notes || 'Aucune observation particulière.');

    const iconEl = document.getElementById('mobileDetailTypeIcon');
    if (iconEl) iconEl.className = 'fas ' + getMobileTypeIcon(typeLabel);

    const statusEl = document.getElementById('mobileDetailStatus');
    if (statusEl) {
        statusEl.textContent = statusLabel;
        statusEl.className = 'mobile-detail-status ' + statusClass;
    }

    const editBtn = document.getElementById('mobileDetailEditBtn');
    if (editBtn) editBtn.onclick = function () { editMobile(item.id); };

    const printBtn = document.getElementById('mobileDetailPrintBtn');
    if (printBtn) printBtn.onclick = function () { printMobileDischarge(item.id); };

    const deleteBtn = document.getElementById('mobileDetailDeleteBtn');
    if (deleteBtn) deleteBtn.onclick = function () { deleteMobile(item.id); };

    showView('mobileDetailView');
}

function renderMobilesPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('mobilesPagination');
    if (!container) return;
    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    safeSetHTML(container, renderPaginationHTML(totalItems, totalPages, currentPage, 'mobiles', 'changeMobilesPage'));
}

function changeMobilesPage(page) {
    window.currentMobilesPage = page;
    renderMobilesTable(window.currentMobilesData || mobileDevices);
    const tableWrapper = document.getElementById('mobilesPagination');
    if (tableWrapper) tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterMobilesByStatus(status) {
    window.currentMobilesPage = 1;
    const maintCard = document.querySelector('#mobilesView .printer-card-offline');
    if (status === 'Total' || window.currentMobilesStatusFilter === status) {
        window.currentMobilesStatusFilter = null;
        if (maintCard) maintCard.classList.remove('active');
    } else {
        window.currentMobilesStatusFilter = status;
        if (maintCard) maintCard.classList.add('active');
    }
    renderMobilesTable();
}

function filterMobilesTable() {
    window.currentMobilesPage = 1;
    renderMobilesTable();
}

function selectMobileCategory(category) {
    window.currentMobilesCategoryFilter = category;
    localStorage.setItem("mobileCategory", category);
    window.currentMobilesPage = 1;
    window.currentMobilesStatusFilter = null; // Reset status filter on category switch

    const maintCard = document.querySelector('#mobilesView .printer-card-offline');
    if (maintCard) maintCard.classList.remove('active');

    const categories = ['all', 'Telephone', 'Tablette', 'PDA'];
    categories.forEach(cat => {
        const card = document.getElementById(`catCard-${cat}`);
        if (card) {
            if (cat === category) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        }
    });

    renderMobilesTable();
}
window.selectMobileCategory = selectMobileCategory;

function openMobileForm() {
    editingMobileId = null;
    document.getElementById('mobileFormTitle').textContent = 'Nouveau Mobile';
    document.getElementById('mobileFormSub').textContent = 'Enregistrer un telephone, une tablette ou un PDA.';
    document.getElementById('mobileType').value = 'Telephone';
    document.getElementById('mobileMarque').value = '';
    document.getElementById('mobileModel').value = '';
    document.getElementById('mobileImei').value = '';
    document.getElementById('mobileRemisPar').value = '';
    document.getElementById('mobileRemisParFonction').value = '';
    document.getElementById('mobileAssignee').value = '';
    document.getElementById('mobileService').value = '';
    document.getElementById('mobileSociete').value = '';
    document.getElementById('mobileSimNumber').value = '';
    document.getElementById('mobileDate').value = '';
    document.getElementById('mobileStatus').value = 'Affecte';
    document.getElementById('mobileNotes').value = '';
    const saveBtn = document.getElementById('saveMobileBtn');
    if (saveBtn) safeSetHTML(saveBtn, '<i class="fas fa-save"></i> Enregistrer');
    showView('mobileFormView');
}

function closeMobileForm() {
    showView('mobilesView');
}

function collectMobileFormData() {
    return {
        type: document.getElementById('mobileType').value,
        marque: document.getElementById('mobileMarque').value.trim(),
        model: document.getElementById('mobileModel').value.trim(),
        imei: document.getElementById('mobileImei').value.trim(),
        remisPar: document.getElementById('mobileRemisPar').value.trim(),
        remisParFonction: document.getElementById('mobileRemisParFonction').value.trim(),
        assignee: document.getElementById('mobileAssignee').value.trim(),
        service: document.getElementById('mobileService').value.trim(),
        societe: document.getElementById('mobileSociete').value.trim(),
        simNumber: document.getElementById('mobileSimNumber').value.trim(),
        date: document.getElementById('mobileDate').value,
        status: normalizeMobileStatus(document.getElementById('mobileStatus').value),
        notes: document.getElementById('mobileNotes').value.trim()
    };
}

function saveMobileItem() {
    const itemData = collectMobileFormData();
    if (!itemData.model || !itemData.imei || !itemData.assignee) {
        showToast("⚠️ Veuillez remplir le modèle, l'IMEI et le bénéficiaire", "red");
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    const docId = editingMobileId || db.collection("itMobiles").doc().id;
    db.collection("itMobiles").doc(String(docId)).set({
        ...itemData,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
        .then(() => {
            logActivity('MOBILES', editingMobileId ? 'MODIFICATION' : 'AJOUT', `${itemData.type}: ${itemData.model} / ${itemData.assignee}`);
            showToast(editingMobileId ? "📱 Mobile mis à jour !" : "📱 Mobile enregistré avec succès !", "green");
            editingMobileId = null;
            showView('mobilesView');
        })
        .catch(error => {
            console.error("Firestore mobile save error:", error);
            showToast("❌ Échec de l'enregistrement du mobile", "red");
        });
}

function editMobile(id) {
    const item = mobileDevices.find(m => String(m.id) === String(id));
    if (!item) return;
    editingMobileId = String(id);
    document.getElementById('mobileFormTitle').textContent = 'Modifier Mobile';
    document.getElementById('mobileFormSub').textContent = 'Modifier les informations du telephone, tablette ou PDA.';
    document.getElementById('mobileType').value = item.type || 'Telephone';
    document.getElementById('mobileMarque').value = item.marque || '';
    document.getElementById('mobileModel').value = item.model || '';
    document.getElementById('mobileImei').value = item.imei || '';
    document.getElementById('mobileRemisPar').value = item.remisPar || '';
    document.getElementById('mobileRemisParFonction').value = item.remisParFonction || '';
    document.getElementById('mobileAssignee').value = item.assignee || '';
    document.getElementById('mobileService').value = item.service || '';
    document.getElementById('mobileSociete').value = item.societe || '';
    document.getElementById('mobileSimNumber').value = item.simNumber || '';
    document.getElementById('mobileDate').value = item.date || '';
    document.getElementById('mobileStatus').value = normalizeMobileStatus(item.status);
    document.getElementById('mobileNotes').value = item.notes || '';
    const saveBtn = document.getElementById('saveMobileBtn');
    if (saveBtn) safeSetHTML(saveBtn, '<i class="fas fa-sync-alt"></i> Mettre à jour');
    showView('mobileFormView');
}

function deleteMobile(id) {
    showCustomConfirm(
        "Supprimer le Mobile",
        "Voulez-vous vraiment supprimer ce téléphone/tablette/PDA ? Cette action est irréversible.",
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itMobiles").doc(String(id)).delete()
                .then(() => {
                    logActivity('MOBILES', 'SUPPRESSION', `Mobile supprime: ${id}`);
                    showToast("🗑️ Mobile supprimé", "blue");
                    if (String(activeMobileId) === String(id)) {
                        activeMobileId = null;
                        showView('mobilesView');
                    }
                })
                .catch(error => {
                    console.error("Firestore mobile delete error:", error);
                    showToast("❌ Échec de la suppression du mobile", "red");
                });
        },
        null,
        true
    );
}

function printMobileDischarge(id) {
    const item = mobileDevices.find(m => String(m.id) === String(id));
    if (!item) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1150');
    if (!printWindow) {
        showToast("⚠️ Pop-up bloqué ! Veuillez autoriser les pop-ups pour imprimer.", "red");
        return;
    }

    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const logoUrl = basePath + 'assets/logo-pdf.png';
    const issuedAt = item.date ? new Date(item.date) : new Date();
    const issueDate = Number.isNaN(issuedAt.getTime()) ? new Date().toLocaleDateString('fr-FR') : issuedAt.toLocaleDateString('fr-FR');
    const equipmentName = [item.marque, item.model].filter(Boolean).join(' ') || item.model || 'N/A';
    const cleanImei = String(item.imei || 'IMEI').replace(/[^A-Za-z0-9]/g, '').substring(0, 12);
    const ref = `TEL-${issueDate.replace(/\D/g, '')}-${cleanImei || 'MOBILE'}`;
    const equipmentType = item.type || 'Téléphone';
    const statusLabel = item.status === 'stock' ? 'En stock' : item.status === 'maintenance' ? 'Maintenance' : 'Affecté';
    const companyName = item.societe || 'N/A';
    const companyForText = item.societe || 'la société';
    const remisParFonction = item.remisParFonction || 'N/A';
    const content = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Decharge Telephone - ${escapeHTML(item.assignee || '')}</title>
    <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; background: #e5e7eb; color: #10203f; font-family: 'Segoe UI', Arial, sans-serif; }
        .page { width: 210mm; height: 297mm; margin: 0 auto; background: #fff; padding: 9mm 10mm 8mm; position: relative; overflow: hidden; }
        .page::before { content: ""; position: absolute; inset: 0 0 auto; height: 50mm; background: linear-gradient(180deg, #edf6ff 0%, #ffffff 100%); z-index: 0; }
        .content { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; }
        .top-header { display: grid; grid-template-columns: 66mm 1fr 48mm; gap: 6mm; align-items: center; min-height: 37mm; padding: 5mm; color: #fff; border-radius: 6mm; background: linear-gradient(135deg, #061738 0%, #073f9e 58%, #0b6ee8 100%); box-shadow: 0 15px 30px rgba(7, 38, 89, .22); overflow: hidden; position: relative; }
        .top-header::after { content: ""; position: absolute; right: -18mm; top: -25mm; width: 70mm; height: 70mm; border-radius: 50%; background: rgba(255,255,255,.08); }
        .brand-panel { background: #fff; border-radius: 4mm; padding: 4mm 5mm; box-shadow: 0 7px 18px rgba(3, 12, 31, .22); border: 1px solid rgba(255,255,255,.65); position: relative; z-index: 1; }
        .brand-panel img { display: block; width: 56mm; max-height: 19mm; object-fit: contain; }
        .doc-name { position: relative; z-index: 1; padding-left: 5mm; border-left: 1px solid rgba(255,255,255,.24); }
        .doc-name .kicker { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1.8px; color: #c9ddff; font-weight: 850; margin-bottom: 2.5mm; }
        .doc-name h1 { margin: 0; color: #fff; font-size: 21px; line-height: 1.12; text-transform: uppercase; letter-spacing: 0; }
        .doc-name .doc-sub { margin-top: 2mm; color: #e9f3ff; font-size: 9.5px; font-weight: 700; }
        .meta-box { position: relative; z-index: 1; background: rgba(255,255,255,.96); border: 1px solid rgba(255,255,255,.7); border-radius: 4.5mm; padding: 3.5mm 4mm; color: #10203f; box-shadow: 0 8px 18px rgba(2, 16, 43, .16); }
        .meta-row { display: grid; grid-template-columns: 15mm 1fr; gap: 2mm; align-items: center; padding: 1.7mm 0; border-bottom: 1px solid #e4edf8; font-size: 8px; text-transform: uppercase; letter-spacing: .6px; color: #6b7890; font-weight: 850; }
        .meta-row:last-child { border-bottom: 0; }
        .meta-row strong { color: #083c9d; font-size: 9px; letter-spacing: 0; text-transform: none; text-align: right; line-height: 1.15; overflow-wrap: anywhere; }
        .title-card { margin-top: 7mm; background: #fff; border-radius: 5mm; border: 1px solid #d7e4f7; box-shadow: 0 14px 32px rgba(15,23,42,.12); padding: 5mm 7mm; display: grid; grid-template-columns: 1fr 42mm; gap: 7mm; align-items: center; }
        .title-card h2 { margin: 0; color: #083c9d; font-size: 19px; text-transform: uppercase; letter-spacing: 0; }
        .title-card p { margin: 2mm 0 0; color: #5c6f91; font-size: 11px; font-weight: 650; }
        .status-pill { justify-self: end; display: inline-flex; align-items: center; justify-content: center; min-width: 33mm; border-radius: 999px; padding: 3mm 5mm; background: #eaf6ff; color: #075db7; font-size: 10px; font-weight: 900; border: 1px solid #bfe2ff; }
        .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 7mm; }
        .info-card { border: 1px solid #d8e4f4; border-radius: 4mm; overflow: hidden; background: #fff; }
        .info-card.primary { border-color: #aac6ff; box-shadow: inset 0 0 0 1px rgba(13,71,161,.05); }
        .card-head { padding: 3.2mm 4.5mm; background: #f2f7ff; color: #083c9d; font-size: 10px; font-weight: 950; letter-spacing: .75px; text-transform: uppercase; border-bottom: 1px solid #d8e4f4; }
        .primary .card-head { background: linear-gradient(90deg, #093b9d, #0d65d9); color: #fff; border-bottom: 0; }
        .field { display: grid; grid-template-columns: 24mm 1fr; gap: 4mm; padding: 3.3mm 4.5mm; border-bottom: 1px solid #eef3fb; min-height: 13mm; align-items: center; }
        .field:last-child { border-bottom: 0; }
        .label { color: #6b7890; font-size: 8.5px; font-weight: 850; text-transform: uppercase; letter-spacing: .5px; }
        .value { color: #10203f; font-size: 11.5px; font-weight: 900; text-transform: uppercase; line-height: 1.25; overflow-wrap: anywhere; }
        .value.small { font-size: 10.5px; text-transform: none; }
        .serial { font-family: Consolas, 'Courier New', monospace; letter-spacing: .3px; }
        .section-kicker { display: inline-flex; align-items: center; color: #083c9d; font-size: 10px; font-weight: 950; letter-spacing: .75px; text-transform: uppercase; margin-bottom: 3mm; }
        .section-kicker::before { content: ""; width: 6mm; height: 2mm; border-radius: 999px; background: #0d65d9; margin-right: 2.5mm; }
        .rules-card { margin-top: 5mm; border: 1px solid #d8e4f4; border-radius: 4mm; padding: 4mm 6mm; background: #fbfdff; }
        .rules-list { margin: 0; padding-left: 6mm; color: #243554; font-size: 9.8px; line-height: 1.48; font-weight: 650; }
        .rules-list li { margin-bottom: 1.2mm; }
        .important-band { margin-top: 6mm; display: grid; grid-template-columns: 1fr 39mm; gap: 7mm; align-items: stretch; }
        .important-text { border-radius: 4mm; background: #f6f9ff; border: 1px solid #cfe0fb; padding: 4.5mm 6mm; color: #203253; font-size: 10.2px; line-height: 1.48; font-weight: 650; }
        .important-text strong { color: #083c9d; font-weight: 950; }
        .device-mark { border-radius: 4mm; background: linear-gradient(160deg, #f8fbff, #eaf4ff); border: 1px solid #d6e5fb; position: relative; overflow: hidden; min-height: 38mm; }
        .phone { position: absolute; right: 14mm; top: 6mm; width: 18mm; height: 31mm; border-radius: 4mm; background: #10203f; padding: 1.6mm; transform: rotate(-8deg); box-shadow: 0 8px 15px rgba(16,32,63,.22); }
        .screen { width: 100%; height: 100%; border-radius: 2.8mm; background: linear-gradient(145deg, #79c0ff, #1458d4); position: relative; overflow: hidden; }
        .screen::after { content: ""; position: absolute; width: 15mm; height: 15mm; border-radius: 50%; right: -4mm; top: 8mm; background: rgba(255,255,255,.35); }
        .sim { position: absolute; right: 5mm; bottom: 5mm; width: 15mm; height: 19mm; border-radius: 2mm; background: #fff; border: 1px solid #d8e4f4; box-shadow: 0 5px 12px rgba(16,32,63,.14); color: #f04438; font-size: 7px; font-weight: 950; display: flex; align-items: center; justify-content: center; transform: rotate(8deg); }
        .signatures { margin-top: auto; padding-top: 7mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; border-top: 1px solid #d8e4f4; }
        .signature { text-align: center; color: #10203f; font-size: 9.5px; font-weight: 850; min-height: 28mm; }
        .signature-title { color: #083c9d; text-transform: uppercase; font-size: 8.5px; letter-spacing: .5px; margin-bottom: 17mm; min-height: 8mm; }
        .signature-line { border-bottom: 1.4px solid #183b7b; margin: 0 3mm 0; height: 1mm; }
        .footer { margin-top: 4mm; display: flex; justify-content: space-between; color: #52627d; font-size: 7.8px; border-top: 1px solid #edf2f8; padding-top: 2mm; background: #fff; }
        @media print {
            @page { size: A4; margin: 0; }
            body { background: #fff; }
            .page { margin: 0; box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="content">
            <header class="top-header">
                <div class="brand-panel"><img src="${logoUrl}" alt="LABO NEDJMA"></div>
                <div class="doc-name">
                    <div class="kicker">Laboratoires cosmétiques</div>
                    <h1>Décharge de téléphone</h1>
                    <div class="doc-sub">Equipement mobile confié au bénéficiaire</div>
                </div>
                <div class="meta-box">
                    <div class="meta-row"><span>Doc.</span><strong>Décharge Mobile</strong></div>
                    <div class="meta-row"><span>Date</span><strong>${escapeHTML(issueDate)}</strong></div>
                    <div class="meta-row"><span>Réf.</span><strong>${escapeHTML(ref)}</strong></div>
                </div>
            </header>

            <section class="title-card">
                <div>
                    <h2>Remise d'équipement mobile</h2>
                    <p>Document officiel de remise et de responsabilité du matériel confié au bénéficiaire.</p>
                </div>
                <div class="status-pill">${escapeHTML(statusLabel)}</div>
            </section>

            <section class="main-grid">
                <div class="info-card">
                    <div class="card-head">Bénéficiaire et remise</div>
                    <div class="field"><div class="label">Remis par</div><div class="value">${escapeHTML(item.remisPar || 'N/A')}</div></div>
                    <div class="field"><div class="label">Fonction</div><div class="value small">${escapeHTML(remisParFonction)}</div></div>
                    <div class="field"><div class="label">Remis à</div><div class="value">${escapeHTML(item.assignee || 'N/A')}</div></div>
                    <div class="field"><div class="label">Service</div><div class="value">${escapeHTML(item.service || 'N/A')}</div></div>
                    <div class="field"><div class="label">Société</div><div class="value">${escapeHTML(companyName)}</div></div>
                </div>

                <div class="info-card primary">
                    <div class="card-head">Equipement remis</div>
                    <div class="field"><div class="label">Type</div><div class="value">${escapeHTML(equipmentType)}</div></div>
                    <div class="field"><div class="label">Marque</div><div class="value">${escapeHTML(item.marque || 'N/A')}</div></div>
                    <div class="field"><div class="label">Modèle</div><div class="value">${escapeHTML(item.model || equipmentName)}</div></div>
                    <div class="field"><div class="label">IMEI</div><div class="value serial">${escapeHTML(item.imei || 'N/A')}</div></div>
                    <div class="field"><div class="label">Carte SIM</div><div class="value serial">${escapeHTML(item.simNumber || 'N/A')}</div></div>
                </div>
            </section>

            <section class="rules-card">
                <div class="section-kicker">Instructions et conditions</div>
                <ul class="rules-list">
                    <li>Le ${escapeHTML(equipmentType.toLowerCase())} et la carte SIM sont remis en bon état de fonctionnement au moment de la remise.</li>
                    <li>Le bénéficiaire s'engage à utiliser cet équipement uniquement pour les besoins professionnels de ${escapeHTML(companyForText)}.</li>
                    <li>Toute perte, casse, vol ou anomalie doit être signalé immédiatement au service IT.</li>
                    <li>L'équipement reste la propriété de ${escapeHTML(companyForText)} et doit être restitué sur demande, changement d'affectation ou cessation de fonction.</li>
                </ul>
            </section>

            <section class="important-band">
                <div class="important-text">
                    <strong>Important :</strong>
                    Cette décharge confirme la remise du matériel indiqué ci-dessus. Le bénéficiaire reconnaît avoir reçu l'équipement et s'engage à le conserver avec soin, sans modification non autorisée ni transfert à une autre personne.
                </div>
                <div class="device-mark">
                    <div class="phone"><div class="screen"></div></div>
                    <div class="sim">SIM</div>
                </div>
            </section>

            <section class="signatures">
                <div class="signature">
                    <div class="signature-title">Remis par<br>${escapeHTML(remisParFonction)}</div>
                    <div class="signature-line"></div>
                </div>
                <div class="signature">
                    <div class="signature-title">Signature du bénéficiaire<br>Réception du téléphone</div>
                    <div class="signature-line"></div>
                </div>
                <div class="signature">
                    <div class="signature-title">Signature du Directeur</div>
                    <div class="signature-line"></div>
                </div>
            </section>

            <footer class="footer">
                <span>${escapeHTML(companyName)} - Service Informatique</span>
                <span>${escapeHTML(ref)} - Généré le ${escapeHTML(issueDate)}</span>
            </footer>
            </div>
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
        };
    <\/script>
</body>
</html>`;

    printWindow.document.write(content);
    printWindow.document.close();
}

window.renderMobilesTable = renderMobilesTable;
window.changeMobilesPage = changeMobilesPage;
window.filterMobilesByStatus = filterMobilesByStatus;
window.filterMobilesTable = filterMobilesTable;
window.openMobileForm = openMobileForm;
window.closeMobileForm = closeMobileForm;
window.showMobileDetail = showMobileDetail;
window.saveMobileItem = saveMobileItem;
window.editMobile = editMobile;
window.deleteMobile = deleteMobile;
window.printMobileDischarge = printMobileDischarge;

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

function normalizeStockCode(code) {
    return String(code || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9-]/g, '');
}

function hashStockSeed(seed) {
    const text = String(seed || Date.now());
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash % 9000) + 1000;
}

function generateStockCode(seed = '', excludeId = null, yearValue = null) {
    const parsedYear = parseInt(yearValue, 10);
    const year = parsedYear >= 2000 ? parsedYear : new Date().getFullYear();
    if (seed) {
        return `RF-STK-${year}-${hashStockSeed(seed)}`;
    }

    const existingCodes = new Set(stockItems
        .filter(item => excludeId === null || String(item.id) !== String(excludeId))
        .map(item => normalizeStockCode(item.stockCode))
        .filter(Boolean));

    let code = '';
    do {
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        code = `RF-STK-${year}-${randomPart}`;
    } while (existingCodes.has(code));

    return code;
}

function getStockCode(item) {
    const itemYear = item?.date ? new Date(item.date).getFullYear() : null;
    return normalizeStockCode(item?.stockCode) || generateStockCode(item?.id || item?.name || '', null, itemYear);
}

function refreshStockCode() {
    const input = document.getElementById('addStockCode');
    if (input) input.value = generateStockCode('', editingStockItemId);
}

function copyTextToClipboard(text, successMessage = 'Code copié') {
    const value = String(text || '').trim();
    if (!value) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value)
            .then(() => showToast('📋 ' + successMessage, 'green'))
            .catch(() => fallbackCopyText(value, successMessage));
        return;
    }

    fallbackCopyText(value, successMessage);
}

function fallbackCopyText(text, successMessage) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('📋 ' + successMessage, 'green');
    } catch (err) {
        showToast('⚠️ Copie impossible, sélectionnez le code manuellement', 'orange');
    }
    textarea.remove();
}

function copyStockCodeFromForm() {
    const input = document.getElementById('addStockCode');
    copyTextToClipboard(input ? input.value : '', 'Code RF copié');
}

function copyStockCode(code) {
    copyTextToClipboard(code, 'Code RF copié');
}

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
        { name: 'Téléphones & PDA', id: 'stockCount_Telephones_PDA', unit: 'unités' },
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
        case 'Téléphones & PDA': return 'fas fa-mobile-screen-button';
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
        case 'Téléphones & PDA': return 'Inventaire des téléphones, tablettes, PDA, terminaux mobiles et cartes SIM en stock.';
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
            'Téléphones & PDA': 'var(--gradient-indigo-sky)',
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
        td.colSpan = 8;
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
        tr.className = 'stock-category-row clickable-record-row';
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btns, .action-btn, button, select, input, textarea, a')) {
                showRecordDetail('stock', item.id);
            }
        };
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

        const tdCode = document.createElement('td');
        const stockCode = getStockCode(item);
        tdCode.innerHTML = '<button class="stock-rf-badge" type="button" title="Copier le code RF" onclick="event.stopPropagation(); copyStockCode(\'' + escapeHTML(stockCode) + '\')">' +
            '<i class="fas fa-fingerprint"></i>' + escapeHTML(stockCode) +
            '</button>';

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
        tr.appendChild(tdCode);
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
            (getStockCode(item).toLowerCase().includes(query)) ||
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
    document.getElementById('addStockCode').value = generateStockCode();
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
    document.getElementById('addStockCode').value = generateStockCode();
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
    let stockCode = normalizeStockCode(document.getElementById('addStockCode').value);
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
    const codeAlreadyExists = stockItems.some(item =>
        normalizeStockCode(item.stockCode) === stockCode &&
        (editingStockItemId === null || String(item.id) !== String(editingStockItemId))
    );
    if (stockCode && codeAlreadyExists) {
        showToast('⚠️ Ce Code RF existe déjà dans le stock !', 'red');
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    let docId = editingStockItemId === null ? String(stockItems.length > 0 ? Math.max(...stockItems.map(item => isNaN(Number(item.id)) ? 0 : Number(item.id))) + 1 : 1) : String(editingStockItemId);
    if (!stockCode) stockCode = generateStockCode('', docId);

    const itemData = {
        name,
        category,
        ref,
        stockCode,
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
    document.getElementById('addStockCode').value = getStockCode(item);
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
    const updateIcon = (id, iconClass) => {
        const el = document.getElementById(id);
        if (el) {
            el.className = `fas ${iconClass}`;
        }
    };

    if (currentDistributionTab === 'wifi') {
        const total = wifiAuthorizations.length;
        const active = wifiAuthorizations.filter(w => w.status === 'Active').length;
        const pending = wifiAuthorizations.filter(w => w.status === 'En attente').length;
        const revoked = wifiAuthorizations.filter(w => w.status === 'Suspendue' || w.status === 'Révoquée').length;

        const elTotal = document.getElementById('distTotalCount');
        const elPret = document.getElementById('distPretEnCoursCount');
        const elRendu = document.getElementById('distRenduCount');
        const elRetard = document.getElementById('distRetardCount');
        if (elTotal) elTotal.textContent = total;
        if (elPret) elPret.textContent = active;
        if (elRendu) elRendu.textContent = pending;
        if (elRetard) elRetard.textContent = revoked;

        // Update labels
        setText('distStatLabel1', 'Total Autorisations');
        setText('distStatLabel2', 'Active');
        setText('distStatLabel3', 'En Attente');
        setText('distStatLabel4', 'Suspendue / Révoquée');

        // Update icons
        updateIcon('distStatIcon1', 'fa-wifi');
        updateIcon('distStatIcon2', 'fa-check-circle');
        updateIcon('distStatIcon3', 'fa-clock');
        updateIcon('distStatIcon4', 'fa-ban');
    } else {
        const activeDistributions = distributionItems.filter(d => d.type !== 'Fin de Contrat');
        const total = activeDistributions.length;
        const pretEnCours = activeDistributions.filter(d => d.type === 'Prêt' && d.status === 'En cours').length;
        const rendu = activeDistributions.filter(d => d.status === 'Rendu').length;
        const today = new Date().toISOString().substring(0, 10);
        const enRetard = activeDistributions.filter(d => d.type === 'Prêt' && d.status === 'En cours' && d.returnDate && d.returnDate < today).length;

        const elTotal = document.getElementById('distTotalCount');
        const elPret = document.getElementById('distPretEnCoursCount');
        const elRendu = document.getElementById('distRenduCount');
        const elRetard = document.getElementById('distRetardCount');
        if (elTotal) elTotal.textContent = total;
        if (elPret) elPret.textContent = pretEnCours;
        if (elRendu) elRendu.textContent = rendu;
        if (elRetard) elRetard.textContent = enRetard;

        // Update labels
        setText('distStatLabel1', 'Total Distributions');
        setText('distStatLabel2', 'Prêts en Cours');
        setText('distStatLabel3', 'Rendus');
        setText('distStatLabel4', 'En Retard');

        // Update icons
        updateIcon('distStatIcon1', 'fa-hand-holding');
        updateIcon('distStatIcon2', 'fa-exchange-alt');
        updateIcon('distStatIcon3', 'fa-check-circle');
        updateIcon('distStatIcon4', 'fa-exclamation-circle');
    }
}

function switchDistributionTab(tab) {
    currentDistributionTab = tab;
    
    const tabDist = document.getElementById('distributionsTabContent');
    const tabWifi = document.getElementById('wifiTabContent');
    const btnDist = document.getElementById('tabDistributionsBtn');
    const btnWifi = document.getElementById('tabWifiBtn');

    if (tabDist) tabDist.style.display = 'none';
    if (tabWifi) tabWifi.style.display = 'none';

    if (btnDist) {
        btnDist.classList.remove('active');
        btnDist.style.color = 'var(--text-muted)';
        btnDist.style.borderBottomColor = 'transparent';
    }
    if (btnWifi) {
        btnWifi.classList.remove('active');
        btnWifi.style.color = 'var(--text-muted)';
        btnWifi.style.borderBottomColor = 'transparent';
    }

    if (tab === 'distributions') {
        if (tabDist) tabDist.style.display = 'block';
        if (btnDist) {
            btnDist.classList.add('active');
            btnDist.style.color = '#10b981';
            btnDist.style.borderBottomColor = '#10b981';
        }
    } else if (tab === 'wifi') {
        if (tabWifi) tabWifi.style.display = 'block';
        if (btnWifi) {
            btnWifi.classList.add('active');
            btnWifi.style.color = '#10b981';
            btnWifi.style.borderBottomColor = '#10b981';
        }
        renderWifiTable();
    }
    
    updateDistributionStats();
}

function onDistributionStatCardClick(num) {
    if (currentDistributionTab === 'distributions') {
        if (num === 1) filterDistributionByStatus('Total');
        if (num === 2) filterDistributionByStatus('Prêt');
        if (num === 3) filterDistributionByStatus('Rendu');
        if (num === 4) filterDistributionByStatus('Retard');
    } else {
        if (num === 1) filterWifiByStatus('Total');
        if (num === 2) filterWifiByStatus('Active');
        if (num === 3) filterWifiByStatus('En attente');
        if (num === 4) filterWifiByStatus('Suspendue/Révoquée');
    }
}

window.switchDistributionTab = switchDistributionTab;
window.onDistributionStatCardClick = onDistributionStatCardClick;

function getDistributionStatus(item) {
    if (item.type === 'Fin de Contrat') return { label: 'Terminé', class: 'rendu' };
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

    let filtered = distributionItems.filter(item => item.type !== 'Fin de Contrat');

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
        tr.className = 'clickable-record-row';
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btns, .action-btn, button, select, input, textarea, a')) {
                showRecordDetail('distribution', item.id);
            }
        };
        const statusInfo = getDistributionStatus(item);

        const statusColors = {
            'don': { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
            'encours': { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
            'rendu': { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
            'retard': { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' }
        };
        const sc = safeGet(statusColors, statusInfo.class, statusColors.don);

        let typeBadge = '';
        if (item.type === 'Prêt') {
            typeBadge = '<span style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid rgba(245, 158, 11, 0.3);"><i class="fas fa-sync-alt" style="margin-right: 3px;"></i>Prêt</span>';
        } else if (item.type === 'Fin de Contrat') {
            typeBadge = '<span style="background: rgba(16, 185, 129, 0.12); color: #10b981; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid rgba(16, 185, 129, 0.3);"><i class="fas fa-file-contract" style="margin-right: 3px;"></i>Fin de Contrat</span>';
        } else {
            typeBadge = '<span style="background: rgba(99, 102, 241, 0.12); color: #6366f1; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid rgba(99, 102, 241, 0.3);"><i class="fas fa-gift" style="margin-right: 3px;"></i>Don</span>';
        }

        const statusBadge = '<span style="background: ' + escapeHTML(sc.bg) + '; color: ' + escapeHTML(sc.color) + '; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid ' + escapeHTML(sc.border) + ';">' + escapeHTML(statusInfo.label) + '</span>';

        let actionBtns = '';
        if (item.type === 'Fin de Contrat') {
            actionBtns += '<button class="action-btn" onclick="printRestitutionPDF(\'' + escapeHTML(item.id) + '\')" title="Imprimer Fin de Contrat" style="color: #10b981;">' +
                '<i class="fas fa-file-signature"></i>' +
                '</button>';
        } else {
            actionBtns += '<button class="action-btn" onclick="printDistributionDischarge(\'' + escapeHTML(item.id) + '\')" title="Imprimer Bon PDF">' +
                '<i class="fas fa-print"></i>' +
                '</button>';

            actionBtns += '<button class="action-btn" onclick="editDistribution(\'' + escapeHTML(item.id) + '\')" title="Modifier">' +
                '<i class="fas fa-edit"></i>' +
                '</button>';

            if (item.type === 'Prêt' && item.status === 'En cours') {
                actionBtns += '<button class="action-btn" onclick="markAsReturned(\'' + escapeHTML(item.id) + '\')" title="Marquer comme Rendu" style="color: #10b981;">' +
                    '<i class="fas fa-check-circle"></i>' +
                    '</button>';
            }

            if (item.type === 'Prêt' && item.status === 'Rendu') {
                actionBtns += '<button class="action-btn" onclick="printRestitutionPDF(\'' + escapeHTML(item.id) + '\')" title="Imprimer Restitution / Fin de Contrat" style="color: #10b981;">' +
                    '<i class="fas fa-file-signature"></i>' +
                    '</button>';
            }
        }

        actionBtns += '<button class="action-btn delete" onclick="deleteDistribution(\'' + escapeHTML(item.id) + '\')" title="Supprimer">' +
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

function editDistribution(id) {
    const item = distributionItems.find(d => String(d.id) === String(id));
    if (!item) return;

    editingDistId = item.id;

    document.getElementById('distEmployeeName').value = item.employeeName || '';
    document.getElementById('distService').value = item.service || '';
    document.getElementById('distArticle').value = item.article || '';
    document.getElementById('distQty').value = item.qty || 1;
    document.getElementById('distType').value = item.type || 'Don';
    document.getElementById('distReturnDate').value = item.returnDate || '';
    document.getElementById('distDate').value = item.date || new Date().toISOString().substring(0, 10);
    document.getElementById('distNotes').value = item.notes || '';
    document.getElementById('returnDateGroup').style.display = item.type === 'Prêt' ? 'block' : 'none';

    document.getElementById('distFormTitle').textContent = 'Modifier la Distribution';
    document.getElementById('distFormSub').textContent = 'Modifier la remise de ' + (item.article || 'matériel') + ' à ' + (item.employeeName || 'un employé') + '.';

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

    const sequentialItems = distributionItems.filter(d => d.type !== 'Fin de Contrat');
    let docId = editingDistId === null ? String(sequentialItems.length > 0 ? Math.max(...sequentialItems.map(d => isNaN(Number(d.id)) ? 0 : Number(d.id))) + 1 : 1) : String(editingDistId);

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
    openRestitutionForm(id);
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
        tr.className = 'clickable-record-row';
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btns, .action-btn, button, select, input, textarea, a')) {
                showRecordDetail('besoin', b.id);
            }
        };

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
        tr.className = 'clickable-record-row';
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btns, .action-btn, button, select, input, textarea, a')) {
                showRecordDetail('panne', p.id);
            }
        };
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
    if (!dropdown) return;
    dropdown.classList.toggle('open');
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
        tr.className = 'clickable-record-row';
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btns, .action-btn, button, select, input, textarea, a')) {
                showRecordDetail('envoi', e.id);
            }
        };
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
        const usernameStr = emailStr.split('@')[0].split('.')[0];
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
        const maintMobiles = mobileDevices.filter(m => normalizeMobileStatus(m.status) === 'Maintenance');

        if (maintDevs.length === 0 && maintPrinters.length === 0 && maintMobiles.length === 0) {
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

            // List mobiles in maintenance
            maintMobiles.forEach(m => {
                const equipmentLabel = [m.marque, m.model].filter(Boolean).join(' ') || m.model || 'N/A';
                const diagText = m.notes || 'En attente de diagnostic';
                html += '<div style="background:rgba(59,130,246,0.06); padding:1rem; border-radius:1rem; border:1px solid rgba(59,130,246,0.22);">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">' +
                    '<div style="font-weight:700; font-size:1rem; color:var(--text-primary);"><i class="fas fa-mobile-screen-button" style="margin-right:5px; color:var(--cyan-500);"></i> ' + escapeHTML(equipmentLabel) + '</div>' +
                    '<span class="status-badge-table status-maintenance">Maintenance</span>' +
                    '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Bénéficiaire: <strong>' + escapeHTML(m.assignee || 'N/A') + '</strong> | Service: <strong>' + escapeHTML(m.service || 'N/A') + '</strong></div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">IMEI: <strong>' + escapeHTML(m.imei || 'N/A') + '</strong> | SIM: <strong>' + escapeHTML(m.simNumber || 'N/A') + '</strong></div>' +
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
    renderSettingsPinsTable();

    showView('settingsView');
}

function closeSettingsModal() {
    showView('dashboardView');
}

function closeSettingsModalOuter(e) {
    // Left empty since it's now a full page view
}

function switchSettingsTab(tabName) {
    // Deactivate all tabs
    document.querySelectorAll('.settings-page-tab-btn').forEach(btn => btn.classList.remove('active'));
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
        { text: "Purge du cache Service Worker ('labo-it-cache-v2.2.5')...", action: () => {
            if ('caches' in window) {
                return caches.keys().then(keys => {
                    return Promise.all(keys.map(key => caches.delete(key)));
                });
            }
            return Promise.resolve();
        }},
        { text: "Nettoyage des clés temporaires de stockage...", action: () => Promise.resolve() },
        { text: "Installation des nouveautés de la version 2.2.5...", action: () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    addLogLine("   🚀 Nouveautés de la version v2.2.5 :", "running");
                    setTimeout(() => {
                        addLogLine("     • Registre des Autorisations Wi-Fi", "success");
                        if (typeof playChime === 'function') playChime('success');
                    }, 200);
                    setTimeout(() => {
                        addLogLine("     • Règles de Sécurité Firestore Wi-Fi", "success");
                        if (typeof playChime === 'function') playChime('success');
                    }, 400);
                    setTimeout(() => {
                        addLogLine("     • Impression PDF A4 & Rendu Logo Optimisé", "success");
                        if (typeof playChime === 'function') playChime('success');
                    }, 600);
                    setTimeout(() => {
                        addLogLine("     • Résolution des conflits CSS des onglets", "success");
                        if (typeof playChime === 'function') playChime('success');
                        resolve();
                    }, 800);
                }, 300);
            });
        }},
        { text: "Préparation du redémarrage système...", action: () => Promise.resolve() },
        { text: "Redémarrage de LABO-IT CONTROL v2.2.5...", action: () => {
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
console.log('%c🚀 LABO-IT CONTROL %c| %cVersion 2.5.4 %c| %cPrêt à l\'emploi',
    'color:#667eea; font-size:1.3em; font-weight:bold;',
    '',
    'color:#10b981; font-weight:bold;',
    '',
    'color:#f59e0b;');
console.log('%c💡 Raccourcis: %cCtrl+K pour rechercher %c| %cCtrl+N pour ajouter %c| %cESC pour fermer',
    'color:#8b5cf6;', '', 'color:#06b6d4;', '', 'color:#ef4444;', '');

// ============ MODULE: AUTORISATIONS WI-FI ============
let editingWifiId = null;
window.currentWifiPage = 1;
window.currentWifiStatusFilter = null;
const wifiPageSize = 10;

function showWifiAuthView() {
    editingWifiId = null;
    showView('distributionView');
    switchDistributionTab('wifi');
}

function openWifiForm() {
    editingWifiId = null;
    document.getElementById('wifiEmployeeName').value = '';
    document.getElementById('wifiPoste').value = '';
    document.getElementById('wifiDept').value = '';
    document.getElementById('wifiPhoneBrand').value = '';
    document.getElementById('wifiPhoneModel').value = '';
    document.getElementById('wifiPhoneNumber').value = '';
    document.getElementById('wifiPhoneImei').value = '';
    document.getElementById('wifiSsid').value = 'Nedjma-Corporate';
    document.getElementById('wifiDate').value = new Date().toISOString().substring(0, 10);
    document.getElementById('wifiStatus').value = 'Active';
    document.getElementById('wifiAgreeCheckbox').checked = false;

    document.getElementById('wifiFormTitle').textContent = 'Nouvelle Autorisation Wi-Fi';
    document.getElementById('wifiFormSub').textContent = "Enregistrer une autorisation d'accès au réseau Wi-Fi de l'entreprise pour un téléphone personnel.";

    showView('wifiFormView');
}

function closeWifiForm() {
    showView('distributionView');
    switchDistributionTab('wifi');
}

function editWifiAuthorization(id) {
    const item = wifiAuthorizations.find(w => String(w.id) === String(id));
    if (!item) return;

    editingWifiId = item.id;

    document.getElementById('wifiEmployeeName').value = item.employeeName || '';
    document.getElementById('wifiPoste').value = item.poste || '';
    document.getElementById('wifiDept').value = item.dept || '';
    document.getElementById('wifiPhoneBrand').value = item.phoneBrand || '';
    document.getElementById('wifiPhoneModel').value = item.phoneModel || '';
    document.getElementById('wifiPhoneNumber').value = item.phoneNumber || '';
    document.getElementById('wifiPhoneImei').value = item.phoneImei || '';
    document.getElementById('wifiSsid').value = item.ssid || 'Nedjma-Corporate';
    document.getElementById('wifiDate').value = item.date || new Date().toISOString().substring(0, 10);
    document.getElementById('wifiStatus').value = item.status || 'En attente';
    document.getElementById('wifiAgreeCheckbox').checked = item.agreed || false;

    document.getElementById('wifiFormTitle').textContent = "Modifier l'Autorisation Wi-Fi";
    document.getElementById('wifiFormSub').textContent = "Modifier l'autorisation pour " + (item.employeeName || 'un employé') + ".";

    showView('wifiFormView');
}

function generateWifiPermitNumber(year) {
    const prefix = `WIFI-${year}-`;
    let maxIndex = 0;
    wifiAuthorizations.forEach(item => {
        if (item.permitNumber && item.permitNumber.startsWith(prefix)) {
            const suffix = item.permitNumber.substring(prefix.length);
            const idx = parseInt(suffix, 10);
            if (!isNaN(idx) && idx > maxIndex) {
                maxIndex = idx;
            }
        }
    });
    return prefix + String(maxIndex + 1).padStart(4, '0');
}

function saveWifiAuthorization() {
    const employeeName = document.getElementById('wifiEmployeeName').value.trim();
    const poste = document.getElementById('wifiPoste').value.trim();
    const dept = document.getElementById('wifiDept').value.trim();
    const phoneBrand = document.getElementById('wifiPhoneBrand').value.trim();
    const phoneModel = document.getElementById('wifiPhoneModel').value.trim();
    const phoneNumber = document.getElementById('wifiPhoneNumber').value.trim();
    const phoneImei = document.getElementById('wifiPhoneImei').value.trim();
    const ssid = document.getElementById('wifiSsid').value.trim();
    const date = document.getElementById('wifiDate').value;
    const status = document.getElementById('wifiStatus').value;
    const agreed = document.getElementById('wifiAgreeCheckbox').checked;

    if (!employeeName) {
        showToast("⚠️ Le nom complet de l'employé est obligatoire !", "red");
        return;
    }
    if (!phoneBrand || !phoneModel) {
        showToast("⚠️ Les informations de la marque et du modèle du téléphone sont obligatoires !", "red");
        return;
    }
    if (!phoneImei) {
        showToast("⚠️ L'adresse MAC est obligatoire !", "red");
        return;
    }
    if (!ssid) {
        showToast("⚠️ Le nom du réseau Wi-Fi est obligatoire !", "red");
        return;
    }
    if (!date) {
        showToast("⚠️ La date d'attribution est obligatoire !", "red");
        return;
    }
    if (!agreed) {
        showToast("⚠️ Vous devez obligatoirement accepter les conditions d'utilisation pour enregistrer !", "red");
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    const year = new Date(date).getFullYear() || 2026;
    let docId = editingWifiId;
    let permitNumber = '';

    if (editingWifiId === null) {
        docId = db.collection("wifiAuthorizations").doc().id;
        permitNumber = generateWifiPermitNumber(year);
    } else {
        const item = wifiAuthorizations.find(w => String(w.id) === String(editingWifiId));
        permitNumber = item ? item.permitNumber : generateWifiPermitNumber(year);
    }

    const wifiData = {
        permitNumber,
        employeeName,
        poste,
        dept,
        phoneBrand,
        phoneModel,
        phoneNumber,
        phoneImei,
        ssid,
        date: date || new Date().toISOString().substring(0, 10),
        status,
        agreed,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("wifiAuthorizations").doc(docId).set(wifiData, { merge: true })
        .then(() => {
            logActivity('WIFI', 'MODIF_AJOUT', `Autorisation Wi-Fi enregistrée: ${permitNumber} pour ${employeeName}`);
            showToast(editingWifiId === null ? '✅ Autorisation Wi-Fi enregistrée avec succès !' : '📝 Autorisation mise à jour !', 'green');
            closeWifiForm();
        })
        .catch(err => {
            console.error("Firestore save wifi error:", err);
            showToast("❌ Échec de l'enregistrement sur Firebase", "red");
        });
}

function deleteWifiAuthorization(id) {
    const item = wifiAuthorizations.find(w => w.id === id);
    if (!item) return;

    showCustomConfirm(
        "Supprimer l'Autorisation",
        `Voulez-vous vraiment supprimer l'autorisation Wi-Fi "${item.permitNumber}" pour ${item.employeeName} ? Cette action est irréversible.`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("wifiAuthorizations").doc(String(id)).delete()
                .then(() => {
                    logActivity('WIFI', 'SUPPRESSION', `Autorisation Wi-Fi supprimée: ${item.permitNumber} pour ${item.employeeName}`);
                    showToast('✅ Autorisation Wi-Fi supprimée !', 'green');
                    if (activeRecordDetail && activeRecordDetail.type === 'wifi' && String(activeRecordDetail.id) === String(id)) {
                        showWifiAuthView();
                    }
                })
                .catch(err => {
                    console.error("Firestore delete wifi error:", err);
                    showToast("❌ Échec de la suppression sur Firebase", "red");
                });
        },
        null,
        true
    );
}

function updateWifiStats() {
    updateDistributionStats();
}

function renderWifiTable() {
    const tbody = document.getElementById('wifiTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('wifiSearchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = wifiAuthorizations;

    if (window.currentWifiStatusFilter) {
        if (window.currentWifiStatusFilter === 'Active') {
            filtered = filtered.filter(item => item.status === 'Active');
        } else if (window.currentWifiStatusFilter === 'En attente') {
            filtered = filtered.filter(item => item.status === 'En attente');
        } else if (window.currentWifiStatusFilter === 'Suspendue/Révoquée') {
            filtered = filtered.filter(item => item.status === 'Suspendue' || item.status === 'Révoquée');
        }
    }

    if (searchTerm) {
        filtered = filtered.filter(w =>
            (w.employeeName || '').toLowerCase().includes(searchTerm) ||
            (w.phoneBrand || '').toLowerCase().includes(searchTerm) ||
            (w.phoneModel || '').toLowerCase().includes(searchTerm) ||
            (w.permitNumber || '').toLowerCase().includes(searchTerm)
        );
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / wifiPageSize) || 1;

    if (window.currentWifiPage > totalPages) {
        window.currentWifiPage = totalPages;
    }
    if (window.currentWifiPage < 1) {
        window.currentWifiPage = 1;
    }

    const startIndex = (window.currentWifiPage - 1) * wifiPageSize;
    const endIndex = startIndex + wifiPageSize;
    const pageData = filtered.slice(startIndex, endIndex);

    if (totalItems === 0) {
        safeSetHTML(tbody, '<tr>' +
            '<td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-secondary);">' +
            '<i class="fas fa-wifi" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>' +
            escapeHTML(searchTerm ? 'Aucun résultat trouvé.' : 'Aucune autorisation enregistrée.') +
            '</td>' +
            '</tr>');
            
        renderWifiPagination(0, 1, 1);
        return;
    }

    tbody.innerHTML = '';
    pageData.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'clickable-record-row';
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btns, .action-btn, button, select, input, textarea, a')) {
                showRecordDetail('wifi', item.id);
            }
        };

        const statusColors = {
            'En attente': { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
            'Active': { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
            'Suspendue': { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
            'Révoquée': { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
            'Expirée': { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' }
        };
        const sc = statusColors[item.status] || statusColors['En attente'];
        const statusBadge = '<span style="background: ' + escapeHTML(sc.bg) + '; color: ' + escapeHTML(sc.color) + '; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 12px; border: 1px solid ' + escapeHTML(sc.border) + ';">' + escapeHTML(item.status) + '</span>';

        let actionBtns = '<button class="action-btn" onclick="printWifiAuthorization(\'' + escapeHTML(item.id) + '\')" title="Imprimer / PDF">' +
            '<i class="fas fa-print"></i>' +
            '</button>';

        actionBtns += '<button class="action-btn" onclick="editWifiAuthorization(\'' + escapeHTML(item.id) + '\')" title="Modifier">' +
            '<i class="fas fa-edit"></i>' +
            '</button>';

        actionBtns += '<button class="action-btn delete" onclick="deleteWifiAuthorization(\'' + escapeHTML(item.id) + '\')" title="Supprimer">' +
            '<i class="fas fa-trash-alt"></i>' +
            '</button>';

        safeSetHTML(tr, '<td style="font-weight: 700; color: var(--blue-500);">' + escapeHTML(item.permitNumber || 'N/A') + '</td>' +
            '<td style="font-weight: 700; color: var(--text-primary);"><i class="fas fa-user" style="color: var(--text-secondary); margin-right: 5px;"></i>' + escapeHTML(item.employeeName || 'N/A') + '</td>' +
            '<td>' + escapeHTML(item.poste || 'N/A') + ' <small style="display:block; color:var(--text-secondary);">' + escapeHTML(item.dept || 'N/A') + '</small></td>' +
            '<td style="font-weight: 600; color: var(--text-primary);">' + escapeHTML(item.phoneBrand || 'N/A') + ' ' + escapeHTML(item.phoneModel || 'N/A') + ' <small style="display:block; color:var(--text-secondary); font-weight:normal; font-size: 11px;">IP: ' + escapeHTML(item.phoneNumber || 'N/A') + '</small></td>' +
            '<td style="font-weight: 700; color: var(--text-primary);"><i class="fas fa-wifi" style="color:var(--text-secondary); margin-right:3px;"></i>' + escapeHTML(item.ssid || 'Nedjma-Corporate') + '</td>' +
            '<td>' + (item.date ? escapeHTML(new Date(item.date).toLocaleDateString('fr-FR')) : 'N/A') + '</td>' +
            '<td style="text-align: center;">' + statusBadge + '</td>' +
            '<td style="text-align: center;">' +
            '<div class="action-btns" style="justify-content: center;">' +
            actionBtns +
            '</div>' +
            '</td>');
        tbody.appendChild(tr);
    });

    renderWifiPagination(totalItems, totalPages, window.currentWifiPage);
}

function renderWifiPagination(totalItems, totalPages, currentPage) {
    const container = document.getElementById('wifiPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const html = renderPaginationHTML(totalItems, totalPages, currentPage, 'wifiAuthorizations', 'changeWifiPage');
    safeSetHTML(container, html);
}

function changeWifiPage(page) {
    window.currentWifiPage = page;
    renderWifiTable();
    
    const tableWrapper = document.getElementById('wifiPagination');
    if (tableWrapper) {
        tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.changeWifiPage = changeWifiPage;

function filterWifiByStatus(status) {
    window.currentWifiPage = 1;
    
    if (window.currentWifiStatusFilter === status || status === 'Total') {
        window.currentWifiStatusFilter = null;
        updateWifiFilterCardHighlight(null);
    } else {
        window.currentWifiStatusFilter = status;
        updateWifiFilterCardHighlight(status);
    }
    
    renderWifiTable();
}
window.filterWifiByStatus = filterWifiByStatus;

function updateWifiFilterCardHighlight(status) {
    const totalCard = document.querySelector('#distributionView .dist-card-total');
    const activeCard = document.querySelector('#distributionView .dist-card-active');
    const pendingCard = document.querySelector('#distributionView .dist-card-returned');
    const revokedCard = document.querySelector('#distributionView .dist-card-late');
    
    if (!totalCard || !activeCard || !pendingCard || !revokedCard) return;
    
    totalCard.style.transform = '';
    totalCard.style.boxShadow = '';
    activeCard.style.transform = '';
    activeCard.style.boxShadow = '';
    pendingCard.style.transform = '';
    pendingCard.style.boxShadow = '';
    revokedCard.style.transform = '';
    revokedCard.style.boxShadow = '';
    
    if (status === 'Active') {
        activeCard.style.transform = 'translateY(-3px)';
        activeCard.style.boxShadow = '0 12px 30px rgba(16, 185, 129, 0.15), 0 0 20px rgba(16, 185, 129, 0.08)';
    } else if (status === 'En attente') {
        pendingCard.style.transform = 'translateY(-3px)';
        pendingCard.style.boxShadow = '0 12px 30px rgba(245, 158, 11, 0.15), 0 0 20px rgba(245, 158, 11, 0.06)';
    } else if (status === 'Suspendue/Révoquée') {
        revokedCard.style.transform = 'translateY(-3px)';
        revokedCard.style.boxShadow = '0 12px 30px rgba(239, 68, 68, 0.15), 0 0 20px rgba(239, 68, 68, 0.08)';
    }
}

function printWifiAuthorization(id) {
    const item = wifiAuthorizations.find(w => w.id === id);
    if (!item) return;

    if (!item.agreed) {
        showToast("⚠️ Impossible de générer le PDF : Les conditions d'utilisation n'ont pas été acceptées !", "red");
        return;
    }

    const logoUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) + 'assets/logo-pdf.png';
    const printWindow = window.open('', '_blank', 'width=900,height=1000');

    const statusPdfClass = item.status === 'Active' ? 'status-pdf-active'
        : item.status === 'En attente' ? 'status-pdf-pending'
            : 'status-pdf-revoked';

    const statusLabel = item.status.toUpperCase();

    const content = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Autorisation WiFi - ${item.employeeName}</title>
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
                        font-size: 13.5px;
                    }
                    
                    .document-wrapper {
                        max-width: 800px;
                        margin: 0 auto;
                        background: #ffffff;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        min-height: 100vh;
                        border: 1px solid #e2e8f0;
                        padding: 30px;
                    }
                    
                    /* Modern Clean Header */
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 3px solid #1e3a8a;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    
                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex-shrink: 0;
                    }
                    
                    .logo-container {
                        height: 45px;
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                        flex-shrink: 0;
                    }
                    
                    .logo-container img {
                        height: 100%;
                        max-width: 160px;
                        object-fit: contain;
                    }
                    
                    .title-area h1 {
                        font-size: 18px;
                        font-weight: 800;
                        color: #0f172a;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                        white-space: nowrap;
                    }
                    
                    .title-area p {
                        font-size: 10.5px;
                        color: #3b82f6;
                        font-weight: 700;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        margin-top: 2px;
                        white-space: nowrap;
                    }
                    
                    .header-right {
                        text-align: right;
                        flex-shrink: 0;
                    }
                    
                    .ref-badge {
                        font-size: 11.5px;
                        font-weight: 800;
                        color: #1e3a8a;
                        background: #eff6ff;
                        border: 1px solid #bfdbfe;
                        padding: 3px 8px;
                        border-radius: 6px;
                        display: inline-block;
                        margin-bottom: 5px;
                        font-family: monospace;
                        white-space: nowrap;
                    }
                    
                    .date-label {
                        font-size: 10.5px;
                        color: #64748b;
                        font-weight: 600;
                    }
                    
                    /* Info Tables Grid */
                    .data-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 24px;
                        margin-bottom: 25px;
                    }
                    
                    .section-box {
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        background: #ffffff;
                        overflow: hidden;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                    }
                    
                    .section-box-header {
                        background: #f8fafc;
                        border-bottom: 1.5px solid #e2e8f0;
                        padding: 10px 18px;
                        font-size: 12.5px;
                        font-weight: 800;
                        color: #1e3a8a;
                        letter-spacing: 0.8px;
                        text-transform: uppercase;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    
                    .section-box-content {
                        padding: 16px 18px;
                    }
                    
                    .data-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        border-bottom: 1px dashed #f1f5f9;
                    }
                    
                    .data-row:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }
                    
                    .data-label {
                        font-size: 10.5px;
                        color: #64748b;
                        font-weight: 700;
                        text-transform: uppercase;
                    }
                    
                    .data-value {
                        font-size: 12.5px;
                        color: #0f172a;
                        font-weight: 700;
                        text-align: right;
                    }
                    
                    .data-value.imei {
                        font-family: monospace;
                        font-size: 12px;
                    }
                    
                    /* Corporate Network Info Banner */
                    .network-banner {
                        background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                        color: #ffffff;
                        border-radius: 8px;
                        padding: 12px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                        font-size: 12.5px;
                        font-weight: 700;
                        box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.15);
                    }
                    
                    .network-banner-left {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .status-badge {
                        background: #ffffff;
                        color: #1e3a8a;
                        padding: 3px 8px;
                        border-radius: 4px;
                        font-size: 10px;
                        font-weight: 800;
                        text-transform: uppercase;
                    }
                    
                    /* Charte / Conditions Section */
                    .charter-section {
                        border: 1px solid #bfdbfe;
                        border-radius: 12px;
                        background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
                        padding: 22px 25px;
                        margin-bottom: 25px;
                    }
                    
                    .charter-title {
                        font-size: 13.5px;
                        font-weight: 800;
                        color: #1e3a8a;
                        margin-bottom: 12px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    
                    .charter-list {
                        list-style-type: none;
                    }
                    
                    .charter-list li {
                        font-size: 11.5px;
                        color: #334155;
                        margin-bottom: 8px;
                        font-weight: 600;
                        display: flex;
                        align-items: flex-start;
                        gap: 6px;
                        line-height: 1.5;
                    }
                    
                    .charter-list li::before {
                        content: '✓';
                        color: #3b82f6;
                        font-weight: 900;
                        font-size: 12px;
                    }
                    
                    .charter-list li:last-child {
                        margin-bottom: 0;
                    }
                    
                    /* Commitment statement */
                    .commitment-box {
                        border-left: 4px solid #1e3a8a;
                        background: #f8fafc;
                        padding: 18px 22px;
                        margin-bottom: 30px;
                        border-radius: 0 8px 8px 0;
                    }
                    
                    .commitment-title {
                        font-size: 12px;
                        font-weight: 800;
                        color: #0f172a;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                    }
                    
                    .commitment-text {
                        font-size: 11.5px;
                        color: #475569;
                        line-height: 1.5;
                        font-weight: 600;
                        text-align: justify;
                    }
                    
                    /* Signature Blocks */
                    .signatures-container {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 24px;
                        margin-top: auto; /* Push signatures to bottom */
                        margin-bottom: 20px;
                    }
                    
                    .sig-card {
                        border: 1px solid #cbd5e1;
                        border-radius: 12px;
                        background: #ffffff;
                        height: 135px;
                        padding: 16px 20px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    
                    .sig-header {
                        font-size: 11.5px;
                        font-weight: 800;
                        color: #1e3a8a;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        border-bottom: 1px solid #e2e8f0;
                        padding-bottom: 4px;
                    }
                    
                    .sig-placeholder {
                        font-size: 10px;
                        color: #94a3b8;
                        font-weight: 500;
                        text-align: center;
                    }
                    
                    /* Sleek Footer */
                    .footer-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 10px;
                        margin-top: 10px;
                        font-size: 9px;
                        color: #94a3b8;
                        font-weight: 600;
                    }
                    
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 0; /* Fully managed by wrapper padding */
                        }
                        body {
                            background: #ffffff;
                        }
                        .document-wrapper {
                            border: none !important;
                            padding: 15mm 20mm !important;
                            width: 210mm;
                            height: 297mm;
                            max-width: 100%;
                            min-height: 297mm;
                            box-shadow: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    <!-- Header -->
                    <div class="header-container">
                        <div class="header-left">
                            <div class="logo-container">
                                <img src="${logoUrl}"
                                     onerror="this.onerror=null; this.src='https://placehold.co/180x55/1e3a8a/ffffff?text=IT';"
                                     alt="Logo">
                            </div>
                            <div class="title-area">
                                <h1>Autorisation d'Accès Wi-Fi</h1>
                                <p>Document Officiel • Service Informatique</p>
                            </div>
                        </div>
                        <div class="header-right">
                            <div class="ref-badge">Réf : ${item.permitNumber || 'N/A'}</div>
                            <div class="date-label">Émis le : ${item.date ? new Date(item.date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>

                    <!-- Corporate Network Info Banner -->
                    <div class="network-banner">
                        <div class="network-banner-left">
                            <span>📶 ACCÈS RÉSEAU SANS FIL DE L'ENTREPRISE :</span>
                            <strong style="text-decoration: underline; font-size: 11.5px;">${item.ssid || 'Nedjma-Corporate'}</strong>
                        </div>
                        <div class="status-badge" style="background: ${item.status === 'Active' ? '#d1fae5' : item.status === 'En attente' ? '#fef3c7' : '#fee2e2'}; color: ${item.status === 'Active' ? '#065f46' : item.status === 'En attente' ? '#92400e' : '#991b1b'};">
                            ${statusLabel}
                        </div>
                    </div>

                    <!-- Data Cards Grid -->
                    <div class="data-grid">
                        <!-- Beneficiary -->
                        <div class="section-box">
                            <div class="section-box-header">
                                👤 Bénéficiaire de l'accès
                            </div>
                            <div class="section-box-content">
                                <div class="data-row">
                                    <span class="data-label">Nom & Prénom</span>
                                    <span class="data-value">${item.employeeName || 'N/A'}</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">Poste / Fonction</span>
                                    <span class="data-value">${item.poste || 'N/A'}</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">Département / Service</span>
                                    <span class="data-value">${item.dept || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Equipment -->
                        <div class="section-box">
                            <div class="section-box-header">
                                📱 Équipement personnel autorisé
                            </div>
                            <div class="section-box-content">
                                <div class="data-row">
                                    <span class="data-label">Marque & Modèle</span>
                                    <span class="data-value">${item.phoneBrand || 'N/A'} ${item.phoneModel || 'N/A'}</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">Adresse MAC</span>
                                    <span class="data-value imei">${item.phoneImei || 'N/A'}</span>
                                </div>
                                <div class="data-row">
                                    <span class="data-label">Adresse IP</span>
                                    <span class="data-value">${item.phoneNumber || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Charter Box -->
                    <div class="charter-section">
                        <h2 class="charter-title">ℹ️ Charte d'utilisation & Clauses de sécurité</h2>
                        <ul class="charter-list">
                            <li>Je m'engage à utiliser le réseau Wi-Fi de l'entreprise uniquement à des fins professionnelles.</li>
                            <li>Je m'engage à ne pas utiliser le réseau pour le divertissement (YouTube, Netflix, TikTok, jeux, téléchargements personnels, etc.).</li>
                            <li>Je m'engage à ne pas partager la clé de sécurité ou le mot de passe avec des tiers.</li>
                            <li>Je m'engage à ne pas tenter d'infiltrer, de scanner ou d'altérer le réseau ou ses dispositifs de protection.</li>
                            <li>J'accepte que le service informatique surveille l'activité réseau à des fins d'administration et de sécurité.</li>
                            <li>J'assume l'entière responsabilité en cas d'utilisation non conforme à la politique de l'établissement.</li>
                            <li>Le service informatique se réserve le droit d'annuler ou de suspendre cet accès à tout moment en cas de non-respect.</li>
                        </ul>
                    </div>

                    <!-- Commitment statement -->
                    <div class="commitment-box">
                        <h3 class="commitment-title">Engagement & Certification de l'employé</h3>
                        <p class="commitment-text">
                            Je soussigné déclare avoir demandé le raccordement de mon téléphone personnel au réseau Wi-Fi de l'entreprise. Je m'engage à utiliser cet accès exclusivement dans le cadre de mes tâches professionnelles. De plus, je certifie avoir lu et compris l'intégralité des conditions d'utilisation énoncées ci-dessus et assume l'entière responsabilité en cas d'usage non conforme aux directives de sécurité de l'information de l'établissement.
                        </p>
                    </div>

                    <!-- Signature Blocks -->
                    <div class="signatures-container">
                        <div class="sig-card">
                            <div class="sig-header">Signature du bénéficiaire</div>
                            <div class="sig-placeholder">Précédé de la mention "Lu et approuvé"<br><br>Date: ____/____/________</div>
                        </div>
                        <div class="sig-card">
                            <div class="sig-header">Visa du responsable informatique</div>
                            <div class="sig-placeholder">Cachet du service IT & Signature<br><br>Date: ____/____/________</div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="footer-container">
                        <span>LABO-IT CONTROL • GESTION DES ACCÈS SANS FIL</span>
                        <span>Document confidentiel • Usage interne uniquement</span>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
            </html>
            `;

    printWindow.document.write(content);
    printWindow.document.close();
}

// Bind to window to allow HTML onclicks to access them
window.showWifiAuthView = showWifiAuthView;
window.openWifiForm = openWifiForm;
window.closeWifiForm = closeWifiForm;
window.editWifiAuthorization = editWifiAuthorization;
window.saveWifiAuthorization = saveWifiAuthorization;
window.deleteWifiAuthorization = deleteWifiAuthorization;
window.updateWifiStats = updateWifiStats;
window.renderWifiTable = renderWifiTable;
window.filterWifiByStatus = filterWifiByStatus;
window.printWifiAuthorization = printWifiAuthorization;

// ============ MODULE: TONERS & CARTOUCHES ============
let tonerFilterMarqueVal = '';
let tonerFilterColorVal = '';
let tonerSearchQuery = '';
let tonerFilterCritOnly = false;
let selectedPrinterModel = null;
let printerSearchQuery = '';

function showTonerView() {
    window.printersLimit = 8;
    tonerFilterMarqueVal = '';
    tonerFilterColorVal = '';
    tonerSearchQuery = '';
    tonerFilterCritOnly = false;
    selectedPrinterModel = null;
    printerSearchQuery = '';
    
    const searchInput = document.getElementById('tonerSearchInput');
    const filterMarque = document.getElementById('tonerFilterMarque');
    const filterColor = document.getElementById('tonerFilterColor');
    const printerSearch = document.getElementById('tonerPrinterSearchInput');
    if (searchInput) searchInput.value = '';
    if (filterMarque) filterMarque.value = '';
    if (filterColor) filterColor.value = '';
    if (printerSearch) printerSearch.value = '';
    
    populateTonerMarqueFilter();
    showView('tonerCartoucheView');
    initTonerCustomSelects();
}

function clearTonerFilters() {
    resetTonerFilters();
}

function filterTonerByColor(color) {
    window.printersLimit = 8;
    tonerFilterColorVal = color;
    const filterColor = document.getElementById('tonerFilterColor');
    if (filterColor) filterColor.value = color;
    
    // If a printer is selected, keep it if it has that color, otherwise go back to printer list
    if (selectedPrinterModel) {
        const hasColor = tonerInventory.some(item => item.compatible === selectedPrinterModel && item.couleur === color);
        if (!hasColor) {
            selectedPrinterModel = null;
        }
    }
    
    filterTonerTable();
    initTonerCustomSelects();
}

function filterTonerCritical() {
    window.printersLimit = 8;
    tonerFilterCritOnly = true;
    
    // If a printer is selected, keep it if it has critical stock, otherwise go back to printer list
    if (selectedPrinterModel) {
        const hasCritical = tonerInventory.some(item => item.compatible === selectedPrinterModel && (item.qty > 0 && item.qty <= 1));
        if (!hasCritical) {
            selectedPrinterModel = null;
        }
    }
    
    filterTonerTable();
    initTonerCustomSelects();
}

function resetTonerFilters() {
    window.printersLimit = 8;
    tonerFilterMarqueVal = '';
    tonerFilterColorVal = '';
    tonerSearchQuery = '';
    tonerFilterCritOnly = false;
    selectedPrinterModel = null;
    printerSearchQuery = '';
    
    const searchInput = document.getElementById('tonerSearchInput');
    const filterMarque = document.getElementById('tonerFilterMarque');
    const filterColor = document.getElementById('tonerFilterColor');
    const printerSearch = document.getElementById('tonerPrinterSearchInput');
    if (searchInput) searchInput.value = '';
    if (filterMarque) filterMarque.value = '';
    if (filterColor) filterColor.value = '';
    if (printerSearch) printerSearch.value = '';
    
    filterTonerTable();
    initTonerCustomSelects();
}

function filterTonerTable() {
    const searchInput = document.getElementById('tonerSearchInput');
    const filterMarque = document.getElementById('tonerFilterMarque');
    const filterColor = document.getElementById('tonerFilterColor');
    
    if (searchInput) tonerSearchQuery = searchInput.value.trim().toLowerCase();
    if (filterMarque) tonerFilterMarqueVal = filterMarque.value;
    if (filterColor) tonerFilterColorVal = filterColor.value;
    
    updateTonerFilterCardHighlight();
    renderTonerTable();
}

function updateTonerFilterCardHighlight() {
    const totalCard = document.querySelector('#tonerCartoucheView .toner-card-total');
    const noirCard = document.querySelector('#tonerCartoucheView .toner-card-noir');
    const cyanCard = document.querySelector('#tonerCartoucheView .toner-card-cyan');
    const magentaCard = document.querySelector('#tonerCartoucheView .toner-card-magenta');
    const yellowCard = document.querySelector('#tonerCartoucheView .toner-card-yellow');
    const critiqueCard = document.querySelector('#tonerCartoucheView .printer-card-offline');
    
    if (!totalCard || !noirCard || !cyanCard || !magentaCard || !yellowCard || !critiqueCard) return;
    
    totalCard.style.transform = '';
    totalCard.style.boxShadow = '';
    noirCard.style.transform = '';
    noirCard.style.boxShadow = '';
    cyanCard.style.transform = '';
    cyanCard.style.boxShadow = '';
    magentaCard.style.transform = '';
    magentaCard.style.boxShadow = '';
    yellowCard.style.transform = '';
    yellowCard.style.boxShadow = '';
    critiqueCard.style.transform = '';
    critiqueCard.style.boxShadow = '';
    
    if (tonerFilterCritOnly) {
        critiqueCard.style.transform = 'translateY(-3px)';
        critiqueCard.style.boxShadow = '0 12px 30px rgba(239, 68, 68, 0.15), 0 0 20px rgba(239, 68, 68, 0.08)';
    } else if (tonerFilterColorVal === 'Noir') {
        noirCard.style.transform = 'translateY(-3px)';
        noirCard.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.15), 0 0 20px rgba(15, 23, 42, 0.08)';
    } else if (tonerFilterColorVal === 'Cyan') {
        cyanCard.style.transform = 'translateY(-3px)';
        cyanCard.style.boxShadow = '0 12px 30px rgba(14, 165, 233, 0.15), 0 0 20px rgba(14, 165, 233, 0.08)';
    } else if (tonerFilterColorVal === 'Magenta') {
        magentaCard.style.transform = 'translateY(-3px)';
        magentaCard.style.boxShadow = '0 12px 30px rgba(217, 70, 239, 0.15), 0 0 20px rgba(217, 70, 239, 0.08)';
    } else if (tonerFilterColorVal === 'Yellow') {
        yellowCard.style.transform = 'translateY(-3px)';
        yellowCard.style.boxShadow = '0 12px 30px rgba(234, 179, 8, 0.15), 0 0 20px rgba(234, 179, 8, 0.08)';
    } else {
        totalCard.style.transform = 'translateY(-3px)';
        totalCard.style.boxShadow = '0 12px 30px rgba(139, 92, 246, 0.15), 0 0 20px rgba(139, 92, 246, 0.08)';
    }
}

function updateTonerStats() {
    let totalItems = 0;
    let totalNoir = 0;
    let totalCyan = 0;
    let totalMagenta = 0;
    let totalYellow = 0;
    let totalCritique = 0;

    tonerInventory.forEach(item => {
        totalItems += item.qty;
        if (item.couleur === 'Noir') totalNoir += item.qty;
        else if (item.couleur === 'Cyan') totalCyan += item.qty;
        else if (item.couleur === 'Magenta') totalMagenta += item.qty;
        else if (item.couleur === 'Yellow') totalYellow += item.qty;

        if (item.qty > 0 && item.qty <= 1) {
            totalCritique++;
        }
    });

    const elTotal = document.getElementById('tonerStatTotal');
    const elNoir = document.getElementById('tonerStatNoir');
    const elCyan = document.getElementById('tonerStatCyan');
    const elMagenta = document.getElementById('tonerStatMagenta');
    const elYellow = document.getElementById('tonerStatYellow');
    const elCritique = document.getElementById('tonerStatCritique');

    if (elTotal) elTotal.textContent = totalItems;
    if (elNoir) elNoir.textContent = totalNoir;
    if (elCyan) elCyan.textContent = totalCyan;
    if (elMagenta) elMagenta.textContent = totalMagenta;
    if (elYellow) elYellow.textContent = totalYellow;
    if (elCritique) elCritique.textContent = totalCritique;

    const mainBadge = document.getElementById('moduleTonerBadge');
    if (mainBadge) {
        mainBadge.textContent = `${totalItems} Articles`;
    }

    updateTonerFilterCardHighlight();
    renderTonerCharts();
}

function renderTonerTable() {
    if (!selectedPrinterModel) {
        // Toggle view containers
        const printersContainer = document.getElementById('tonerPrintersContainer');
        const detailsContainer = document.getElementById('tonerSinglePrinterDetails');
        if (printersContainer) printersContainer.style.display = 'block';
        if (detailsContainer) detailsContainer.style.display = 'none';
        
        renderPrintersGrid();
        return;
    }
    
    // Otherwise, show details container, hide printers list
    const printersContainer = document.getElementById('tonerPrintersContainer');
    const detailsContainer = document.getElementById('tonerSinglePrinterDetails');
    if (printersContainer) printersContainer.style.display = 'none';
    if (detailsContainer) detailsContainer.style.display = 'block';
    
    const titleEl = document.getElementById('selectedPrinterModelName');
    if (titleEl) titleEl.textContent = selectedPrinterModel;
    
    const locTextEl = document.getElementById('selectedPrinterLocationText');
    if (locTextEl) {
        const itemWithLocation = tonerInventory.find(item => item.compatible === selectedPrinterModel && item.location);
        locTextEl.textContent = itemWithLocation ? itemWithLocation.location : 'N/A';
    }
    
    const grid = document.getElementById('tonerCardsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = tonerInventory.filter(item => {
        const matchPrinter = item.compatible === selectedPrinterModel;
        const matchColor = !tonerFilterColorVal || item.couleur === tonerFilterColorVal;
        const matchCrit = !tonerFilterCritOnly || (item.qty > 0 && item.qty <= 1);
        return matchPrinter && matchColor && matchCrit;
    });

    const infoEl = document.getElementById('tonerFilterInfo');
    if (infoEl) {
        const totalQty = filtered.reduce((sum, item) => sum + item.qty, 0);
        const isFiltered = tonerSearchQuery || tonerFilterMarqueVal || tonerFilterColorVal || tonerFilterCritOnly;
        
        if (isFiltered) {
            infoEl.style.borderColor = 'rgba(139, 92, 246, 0.3)';
            infoEl.style.background = 'rgba(139, 92, 246, 0.06)';
            infoEl.style.color = 'var(--text-primary)';
            infoEl.innerHTML = `<i class="fas fa-filter" style="color: #8b5cf6;"></i> <span>Trouvé: <strong>${filtered.length}</strong> (${totalQty} u.)</span>`;
        } else {
            infoEl.style.borderColor = 'var(--border-color)';
            infoEl.style.background = 'var(--bg-secondary)';
            infoEl.style.color = 'var(--text-secondary)';
            infoEl.innerHTML = `<i class="fas fa-info-circle" style="color: var(--text-muted);"></i> <span>Total: <strong>${filtered.length}</strong> (${totalQty} u.)</span>`;
        }
    }

    // Render status pills for the header
    const statusContainer = document.getElementById('selectedPrinterStockStatus');
    if (statusContainer) {
        const critical = filtered.some(item => item.qty > 0 && item.qty <= 1);
        const rupture = filtered.some(item => item.qty === 0);
        const totalQty = filtered.reduce((sum, item) => sum + item.qty, 0);
        
        let statusHtml = '';
        if (rupture) {
            statusHtml = `<span class="printer-status-badge badge-rupture"><i class="fas fa-exclamation-circle"></i> Rupture</span>`;
        } else if (critical) {
            statusHtml = `<span class="printer-status-badge badge-critique"><i class="fas fa-exclamation-triangle"></i> Stock critique</span>`;
        } else {
            statusHtml = `<span class="printer-status-badge badge-ok"><i class="fas fa-check-circle"></i> En stock (${totalQty} u.)</span>`;
        }
        statusContainer.innerHTML = statusHtml;
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border-color); color: var(--text-muted);">
            <i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; color: var(--text-muted);"></i>
            Aucun toner ou cartouche correspondant trouvé pour cette imprimante.
        </div>`;
        const viewAllContainer = document.getElementById('tonerCardsViewAllContainer');
        if (viewAllContainer) viewAllContainer.style.display = 'none';
        return;
    }

    // Sort by color Noir, Cyan, Magenta, Yellow
    const colorOrder = { 'Noir': 1, 'Cyan': 2, 'Magenta': 3, 'Yellow': 4 };
    filtered.sort((a, b) => (colorOrder[a.couleur] || 99) - (colorOrder[b.couleur] || 99));

    filtered.forEach(item => {
        const card = createTonerCardElement(item);
        grid.appendChild(card);
    });

    const viewAllContainer = document.getElementById('tonerCardsViewAllContainer');
    if (viewAllContainer) {
        viewAllContainer.style.display = 'none';
    }
}

function renderPrintersGrid() {
    const grid = document.getElementById('printerCardsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Group toner inventory by printer compatibility
    const printerGroups = {};
    tonerInventory.forEach(item => {
        const key = item.compatible || 'Inconnue';
        if (!printerGroups[key]) {
            printerGroups[key] = {
                name: key,
                marque: item.marque || '',
                type: item.type || 'Toner',
                location: item.location || '',
                items: [],
                totalQty: 0,
                criticalCount: 0,
                outOfStockCount: 0,
                colors: {},
                createdAt: item.createdAt || item.lastUpdate || null,
                lastUpdate: item.lastUpdate || null
            };
        } else {
            // Track the oldest creation date as the creation date of the printer group
            const itemCreatedAt = item.createdAt || item.lastUpdate || null;
            if (itemCreatedAt) {
                if (!printerGroups[key].createdAt) {
                    printerGroups[key].createdAt = itemCreatedAt;
                } else {
                    const currentSec = printerGroups[key].createdAt.seconds || (printerGroups[key].createdAt.toMillis ? printerGroups[key].createdAt.toMillis() / 1000 : 0);
                    const itemSec = itemCreatedAt.seconds || (itemCreatedAt.toMillis ? itemCreatedAt.toMillis() / 1000 : 0);
                    if (itemSec < currentSec) {
                        printerGroups[key].createdAt = itemCreatedAt;
                    }
                }
            }
        }
        printerGroups[key].items.push(item);
        printerGroups[key].totalQty += item.qty;
        if (!printerGroups[key].location && item.location) {
            printerGroups[key].location = item.location;
        }
        if (item.qty === 0) {
            printerGroups[key].outOfStockCount++;
        } else if (item.qty <= 1) {
            printerGroups[key].criticalCount++;
        }
        
        printerGroups[key].colors[item.couleur] = item.qty;

        if (item.lastUpdate) {
            if (!printerGroups[key].lastUpdate) {
                printerGroups[key].lastUpdate = item.lastUpdate;
            } else {
                const currentSec = printerGroups[key].lastUpdate.seconds || (printerGroups[key].lastUpdate.toMillis ? printerGroups[key].lastUpdate.toMillis() / 1000 : 0);
                const itemSec = item.lastUpdate.seconds || (item.lastUpdate.toMillis ? item.lastUpdate.toMillis() / 1000 : 0);
                if (itemSec > currentSec) {
                    printerGroups[key].lastUpdate = item.lastUpdate;
                }
            }
        }
    });
    
    // Convert to array and filter by query
    let printerList = Object.values(printerGroups);
    
    if (printerSearchQuery) {
        const query = printerSearchQuery.toLowerCase();
        printerList = printerList.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.marque.toLowerCase().includes(query)
        );
    }
    
    // Also support filtering by stats cards (e.g. click "Stock Critique" or a color at the top)
    if (tonerFilterCritOnly) {
        printerList = printerList.filter(p => p.criticalCount > 0 || p.outOfStockCount > 0);
    }
    
    if (tonerFilterColorVal) {
        printerList = printerList.filter(p => p.colors[tonerFilterColorVal] !== undefined);
    }
    
    // Sort printer list: oldest first (based on creation date)
    printerList.sort((a, b) => {
        const aTime = a.createdAt ? (a.createdAt.seconds || (a.createdAt.toMillis ? a.createdAt.toMillis() / 1000 : 0)) : 0;
        const bTime = b.createdAt ? (b.createdAt.seconds || (b.createdAt.toMillis ? b.createdAt.toMillis() / 1000 : 0)) : 0;
        return aTime - bTime; // Ascending (oldest first)
    });
    
    // Update printer filter info badge
    const infoText = document.getElementById('printerFilterInfoText');
    if (infoText) {
        infoText.textContent = `${printerList.length} Imprimante${printerList.length > 1 ? 's' : ''}`;
    }
    
    if (printerList.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border-color); color: var(--text-muted);">
            <i class="fas fa-print" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; color: var(--text-muted);"></i>
            Aucune imprimante correspondante trouvée.
        </div>`;
        const loadMoreBtn = document.getElementById('printerCardsLoadMoreContainer');
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
    }
    
    if (window.printersLimit === undefined || window.printersLimit === null) {
        window.printersLimit = 8;
    }

    // Toggle Load More button visibility
    const showLoadMore = printerList.length > window.printersLimit;
    const loadMoreBtn = document.getElementById('printerCardsLoadMoreContainer');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = showLoadMore ? 'flex' : 'none';
    }

    // Render limited printers list
    const visiblePrinters = printerList.slice(0, window.printersLimit);
    visiblePrinters.forEach(p => {
        const card = createPrinterGroupCardElement(p);
        grid.appendChild(card);
    });
}

function loadMorePrinters() {
    window.printersLimit = (window.printersLimit || 8) + 8;
    renderPrintersGrid();
}
window.loadMorePrinters = loadMorePrinters;

function createPrinterGroupCardElement(p) {
    // Determine status badge
    let statusBadge = '';
    let statusClass = 'status-ok';
    if (p.outOfStockCount > 0) {
        statusBadge = `<span class="printer-status-badge badge-rupture"><i class="fas fa-exclamation-circle"></i> Rupture (${p.outOfStockCount})</span>`;
        statusClass = 'status-rupture';
    } else if (p.criticalCount > 0) {
        statusBadge = `<span class="printer-status-badge badge-critique"><i class="fas fa-exclamation-triangle"></i> Critique (${p.criticalCount})</span>`;
        statusClass = 'status-critique';
    } else {
        statusBadge = `<span class="printer-status-badge badge-ok"><i class="fas fa-check-circle"></i> En stock</span>`;
    }

    const card = document.createElement('div');
    card.className = `printer-group-card ${statusClass}`;
    card.onclick = () => selectPrinter(p.name);
    
    // Generate premium color bar rows HTML
    const colorsList = ['Noir', 'Cyan', 'Magenta', 'Yellow'];
    const colorConfigs = {
        'Noir':    { bg: '#1e293b', glow: 'rgba(30, 41, 59, 0.35)', label: 'K', icon: 'fas fa-circle' },
        'Cyan':    { bg: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.35)', label: 'C', icon: 'fas fa-circle' },
        'Magenta': { bg: '#d946ef', glow: 'rgba(217, 70, 239, 0.35)', label: 'M', icon: 'fas fa-circle' },
        'Yellow':  { bg: '#eab308', glow: 'rgba(234, 179, 8, 0.35)', label: 'Y', icon: 'fas fa-circle' }
    };
    
    let colorBarsHtml = '';
    const maxQty = Math.max(...colorsList.map(c => p.colors[c] || 0), 1);
    
    colorsList.forEach(color => {
        const qty = p.colors[color];
        const config = colorConfigs[color];
        const isConfigured = qty !== undefined;
        const percentage = isConfigured ? Math.min((qty / Math.max(maxQty, 1)) * 100, 100) : 0;
        
        let qtyClass = '';
        let barBg = config.bg;
        if (!isConfigured) {
            qtyClass = 'color-na';
            barBg = '#e2e8f0';
        } else if (qty === 0) {
            qtyClass = 'color-rupture';
        } else if (qty <= 1) {
            qtyClass = 'color-critique';
        }
        
        colorBarsHtml += `
            <div class="pcard-color-row" title="${color}: ${isConfigured ? qty + ' unité(s)' : 'Non configuré'}">
                <div class="pcard-color-indicator" style="background: ${config.bg}; box-shadow: 0 0 8px ${config.glow};"></div>
                <div class="pcard-color-name">${color}</div>
                <div class="pcard-color-bar-track">
                    <div class="pcard-color-bar-fill ${qtyClass}" style="width: ${isConfigured ? Math.max(percentage, 4) : 0}%; background: ${isConfigured ? config.bg : '#e2e8f0'};"></div>
                </div>
                <div class="pcard-color-qty ${qtyClass}">${isConfigured ? qty : '-'}</div>
            </div>
        `;
    });

    // Location display
    const locationHtml = p.location ? `
        <div class="pcard-location">
            <i class="fas fa-map-marker-alt"></i>
            <span>${escapeHTML(p.location)}</span>
        </div>
    ` : '';

    card.innerHTML = `
        <div class="printer-card-glow"></div>
        <div class="pcard-top-strip ${statusClass}"></div>
        <div class="printer-card-header-actions">
            ${statusBadge}
        </div>
        
        <div class="pcard-hero">
            <div class="printer-card-radial-glow"></div>
            <div class="printer-css-art-wrapper">
                <svg class="pcard-printer-svg" viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
                    <!-- Base shadow -->
                    <ellipse cx="60" cy="84" rx="46" ry="5" fill="rgba(0,0,0,0.12)"/>
                    
                    <!-- Paper Input Tray (ADF on top) -->
                    <rect x="34" y="6" width="52" height="6" rx="1.5" fill="#475569" stroke="#334155" stroke-width="0.5"/>
                    <path d="M 40 6 L 80 6 L 84 2 L 36 2 Z" fill="#64748b" stroke="#475569" stroke-width="0.4"/>
                    <rect x="42" y="0" width="36" height="2" rx="0.5" fill="#cbd5e1"/>
                    
                    <!-- Scanner Bed / Top Section -->
                    <rect x="22" y="12" width="76" height="8" rx="2.5" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5"/>
                    <!-- Scanner border line -->
                    <line x1="22" y1="17" x2="98" y2="17" stroke="#94a3b8" stroke-width="0.5"/>
                    
                    <!-- Main Body Casing (Off-white / light grey premium office look) -->
                    <rect x="22" y="20" width="76" height="46" rx="5" fill="url(#printerBodyGrad)" stroke="#cbd5e1" stroke-width="0.5"/>
                    
                    <!-- Dark Front Contrast Console Panel -->
                    <rect x="26" y="24" width="68" height="38" rx="3.5" fill="url(#printerDarkPanelGrad)" stroke="#1e293b" stroke-width="0.5"/>
                    
                    <!-- LCD Touchscreen UI panel -->
                    <rect x="30" y="28" width="22" height="15" rx="1.5" fill="#334155" stroke="#475569" stroke-width="0.5"/>
                    <rect x="31.5" y="29.5" width="19" height="12" rx="1" fill="#090d16"/>
                    <!-- Screen details: cyan chart and tiny stats bar -->
                    <circle cx="41" cy="35.5" r="4.5" fill="none" stroke="#0ea5e9" stroke-width="1.2" stroke-dasharray="20 4"/>
                    <circle cx="41" cy="35.5" r="2.5" fill="#10b981"/>
                    <rect x="34" y="39.5" width="14" height="1.2" rx="0.5" fill="#eab308" opacity="0.85"/>
                    
                    <!-- Status LED indicator -->
                    <circle cx="33" cy="48" r="1.8" fill="#10b981"/>
                    <circle cx="33" cy="48" r="1.8" fill="#10b981" opacity="0.6">
                        <animate attributeName="r" values="1.8;2.8;1.8" dur="2s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <text x="37" y="49.5" font-size="3.5" fill="#4ade80" font-weight="800" font-family="sans-serif" letter-spacing="0.05em">READY</text>
                    
                    <!-- Toner Compartment Bay (Transparent dark glass look) -->
                    <rect x="56" y="28" width="34" height="26" rx="2" fill="rgba(15, 23, 42, 0.75)" stroke="#475569" stroke-width="0.5"/>
                    
                    <!-- K C M Y Toner Cartridges (Glowing modern capsule design) -->
                    <!-- Black (K) -->
                    <rect x="59" y="30" width="5" height="18" rx="1" fill="#0f172a" stroke="#1e293b" stroke-width="0.4"/>
                    <rect x="60" y="31" width="3" height="4" fill="#64748b" rx="0.5"/>
                    <circle cx="61.5" cy="44" r="1" fill="#f1f5f9" opacity="0.9"/>
                    <!-- Cyan (C) -->
                    <rect x="66" y="30" width="5" height="18" rx="1" fill="#0284c7" stroke="#0ea5e9" stroke-width="0.4"/>
                    <rect x="67" y="31" width="3" height="4" fill="#38bdf8" rx="0.5"/>
                    <circle cx="68.5" cy="44" r="1" fill="#0ea5e9" opacity="0.9"/>
                    <!-- Magenta (M) -->
                    <rect x="73" y="30" width="5" height="18" rx="1" fill="#a21caf" stroke="#d946ef" stroke-width="0.4"/>
                    <rect x="74" y="31" width="3" height="4" fill="#f0abfc" rx="0.5"/>
                    <circle cx="75.5" cy="44" r="1" fill="#d946ef" opacity="0.9"/>
                    <!-- Yellow (Y) -->
                    <rect x="80" y="30" width="5" height="18" rx="1" fill="#a16207" stroke="#eab308" stroke-width="0.4"/>
                    <rect x="81" y="31" width="3" height="4" fill="#fde047" rx="0.5"/>
                    <circle cx="82.5" cy="44" r="1" fill="#eab308" opacity="0.9"/>
                    
                    <!-- Toner letter labels underneath -->
                    <text x="61.5" y="52" font-size="3" fill="#cbd5e1" font-weight="700" text-anchor="middle" font-family="sans-serif">K</text>
                    <text x="68.5" y="52" font-size="3" fill="#38bdf8" font-weight="700" text-anchor="middle" font-family="sans-serif">C</text>
                    <text x="75.5" y="52" font-size="3" fill="#f0abfc" font-weight="700" text-anchor="middle" font-family="sans-serif">M</text>
                    <text x="82.5" y="52" font-size="3" fill="#fde047" font-weight="700" text-anchor="middle" font-family="sans-serif">Y</text>
                    
                    <!-- Paper Output Tray Base -->
                    <rect x="28" y="66" width="64" height="12" rx="2.5" fill="#1e293b" stroke="#0f172a" stroke-width="0.5"/>
                    <!-- Output slot -->
                    <rect x="34" y="68" width="52" height="3" rx="1" fill="#090d16"/>
                    
                    <!-- Emerging Printed Page with Spectrum Gradient -->
                    <path d="M 38 70 L 82 70 L 80 82 L 40 82 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.4"/>
                    <!-- Full spectrum color printed stripe representing color printer capability -->
                    <rect x="42" y="73" width="36" height="4" fill="url(#printSpectrum)" rx="0.8"/>
                    <rect x="42" y="71.5" width="22" height="0.8" fill="#64748b" rx="0.2"/>
                    <rect x="42" y="79" width="30" height="0.8" fill="#94a3b8" rx="0.2"/>
                    
                    <!-- Gradient Definitions -->
                    <defs>
                        <linearGradient id="printerBodyGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#ffffff"/>
                            <stop offset="40%" stop-color="#f8fafc"/>
                            <stop offset="85%" stop-color="#e2e8f0"/>
                            <stop offset="100%" stop-color="#cbd5e1"/>
                        </linearGradient>
                        <linearGradient id="printerDarkPanelGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#334155"/>
                            <stop offset="35%" stop-color="#1e293b"/>
                            <stop offset="100%" stop-color="#0f172a"/>
                        </linearGradient>
                        <linearGradient id="printSpectrum" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#ea580c"/>
                            <stop offset="20%" stop-color="#eab308"/>
                            <stop offset="40%" stop-color="#16a34a"/>
                            <stop offset="60%" stop-color="#2563eb"/>
                            <stop offset="80%" stop-color="#4f46e5"/>
                            <stop offset="100%" stop-color="#db2777"/>
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        </div>
        
        <div class="pcard-body">
            <div class="pcard-identity">
                <span class="printer-brand-badge">${escapeHTML(p.marque || p.type)}</span>
                <h3 class="printer-model-title" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</h3>
                ${locationHtml}
                <div class="pcard-stock-summary">
                    <i class="fas fa-cubes"></i>
                    <span>${p.totalQty} unité${p.totalQty > 1 ? 's' : ''} au total</span>
                </div>
            </div>
            
            <div class="pcard-colors-detail">
                ${colorBarsHtml}
            </div>
        </div>
        
        <div class="printer-card-footer">
            <span class="printer-action-link"><i class="fas fa-cogs"></i> Gérer les consommables <i class="fas fa-arrow-right pcard-arrow"></i></span>
        </div>
    `;
    
    return card;
}

function selectPrinter(model) {
    selectedPrinterModel = model;
    renderTonerTable();
}

function closePrinterDetails() {
    selectedPrinterModel = null;
    renderTonerTable();
}

function filterPrintersGrid() {
    window.printersLimit = 8;
    const searchInput = document.getElementById('tonerPrinterSearchInput');
    if (searchInput) {
        printerSearchQuery = searchInput.value.trim().toLowerCase();
    }
    renderPrintersGrid();
}


function createTonerCardElement(item) {
    let statusBadge = '';
    let borderStyle = '';
    if (item.qty === 0) {
        statusBadge = '<span class="status-badge" style="background: rgba(239, 68, 68, 0.08) !important; color: var(--red-500) !important; border: 1px solid rgba(239, 68, 68, 0.18) !important; font-weight: 700; border-radius: 8px; padding: 4px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap !important; flex-shrink: 0 !important;">🚨 Rupture</span>';
        borderStyle = 'border-top: 4px solid var(--red-500);';
    } else if (item.qty <= 1) {
        statusBadge = '<span class="status-badge" style="background: rgba(245, 158, 11, 0.08) !important; color: var(--amber-600) !important; border: 1px solid rgba(245, 158, 11, 0.18) !important; font-weight: 700; border-radius: 8px; padding: 4px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap !important; flex-shrink: 0 !important;">⚠️ Critique</span>';
        borderStyle = 'border-top: 4px solid var(--amber-500);';
    } else {
        statusBadge = '<span class="status-badge" style="background: rgba(16, 185, 129, 0.08) !important; color: var(--emerald-600) !important; border: 1px solid rgba(16, 185, 129, 0.18) !important; font-weight: 700; border-radius: 8px; padding: 4px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap !important; flex-shrink: 0 !important;">🟢 En Stock</span>';
        borderStyle = 'border-top: 4px solid var(--emerald-500);';
    }

    let colorDot = '';
    if (item.couleur === 'Noir') colorDot = 'background: #1e293b; box-shadow: 0 0 8px rgba(0,0,0,0.2);';
    else if (item.couleur === 'Cyan') colorDot = 'background: #0ea5e9; box-shadow: 0 0 8px rgba(14,165,233,0.4);';
    else if (item.couleur === 'Magenta') colorDot = 'background: #d946ef; box-shadow: 0 0 8px rgba(217,70,239,0.4);';
    else if (item.couleur === 'Yellow') colorDot = 'background: #eab308; box-shadow: 0 0 8px rgba(234,179,8,0.4);';

    const lastMvt = tonerMovements.find(m => m.ref === item.ref);
    const lastMvtText = lastMvt 
        ? `${lastMvt.type === 'Entree' ? '🟢' : '🔴'} ${lastMvt.qty} u. (${new Date(lastMvt.date).toLocaleDateString('fr-FR')})`
        : 'Aucun mouvement';

    const card = document.createElement('div');
    const colorClass = `color-${item.couleur.toLowerCase()}`;
    card.className = `toner-item-card ${colorClass}`;
    
    card.innerHTML = `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; gap: 0.5rem;">
                <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--card-accent); background: var(--card-accent-wash); padding: 4px 10px; border-radius: 8px; border: 1px solid var(--card-accent-border); display: inline-flex; align-items: center; gap: 6px; max-width: 62%; overflow: hidden; white-space: nowrap;">
                    <i class="fas fa-tag" style="font-size: 0.7rem; flex-shrink: 0;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;" title="${escapeHTML(item.type)} - ${escapeHTML(item.marque)}">${escapeHTML(item.type)} - ${escapeHTML(item.marque)}</span>
                </span>
                ${statusBadge}
            </div>
            
            <h4 style="margin: 0 0 0.4rem 0; font-size: 1.35rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">${escapeHTML(item.compatible)}</h4>

            <div style="display: inline-flex; align-items: center; gap: 6px; margin-bottom: 1.15rem; background: var(--card-accent-wash); padding: 4px 10px; border-radius: 8px; border: 1px solid var(--card-accent-border);">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; ${colorDot}"></span>
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--card-accent);">${escapeHTML(item.couleur)}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.88rem; margin-bottom: 1.15rem; border-top: 1px dashed var(--border-color); padding-top: 0.9rem;">
                <!-- Premium centered quantity box -->
                <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 12px 14px; background: var(--card-accent-wash); border: 1.5px dashed var(--card-accent-border); border-radius: 12px; gap: 4px;">
                    <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 5px; opacity: 0.9;">
                        <i class="fas fa-boxes" style="color: var(--card-accent);"></i> Quantité en stock
                    </span>
                    <strong style="font-size: 1.75rem; color: var(--card-accent); font-weight: 900; font-family: monospace; letter-spacing: -0.01em;">${item.qty} u.</strong>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <span style="color: var(--text-secondary); font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; white-space: nowrap;"><i class="fas fa-history" style="width: 14px; opacity: 0.6; color: var(--card-accent);"></i> Dernier mvt :</span>
                    <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); flex-shrink: 0; white-space: nowrap;">${lastMvtText}</span>
                </div>
            </div>
            
            <!-- Printer Watermark Graphic -->
            <div class="card-printer-watermark">
                <i class="fas fa-print"></i>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
            <button class="btn toner-action-btn-entree" onclick="quickTonerMovement('${item.id}', 'Entree')" style="height: 38px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i class="fas fa-plus-circle" style="font-size: 0.95rem;"></i> Entrée
            </button>
            <button class="btn toner-action-btn-sortie" onclick="quickTonerMovement('${item.id}', 'Sortie')" style="height: 38px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i class="fas fa-minus-circle" style="font-size: 0.95rem;"></i> Sortie
            </button>
        </div>
    `;
    return card;
}

window.currentTonerMovementsPage = 1;
function changeTonerMovementsPage(page) {
    window.currentTonerMovementsPage = page;
    renderTonerMovementsTable();
}

function renderTonerMovementsTable() {
    const tbody = document.getElementById('tonerMovementsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const container = document.getElementById('tonerMovementsPagination');
    if (tonerMovements.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                Aucun mouvement enregistré pour le moment.
            </td>
        </tr>`;
        if (container) container.style.display = 'none';
        return;
    }

    const pageSize = 10;
    const totalItems = tonerMovements.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Bounds safety checks
    if (window.currentTonerMovementsPage > totalPages) {
        window.currentTonerMovementsPage = totalPages;
    }
    if (window.currentTonerMovementsPage < 1) {
        window.currentTonerMovementsPage = 1;
    }

    const startIndex = (window.currentTonerMovementsPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = tonerMovements.slice(startIndex, endIndex);

    pageData.forEach(mvt => {
        let opBadge = '';
        if (mvt.type === 'Entree') {
            opBadge = '<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: var(--emerald-500); border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 700; padding: 2px 8px; border-radius: 4px;"><i class="fas fa-arrow-down" style="margin-right: 4px;"></i> Entrée</span>';
        } else {
            opBadge = '<span class="status-badge" style="background: rgba(239, 68, 68, 0.1); color: var(--red-500); border: 1px solid rgba(239, 68, 68, 0.2); font-weight: 700; padding: 2px 8px; border-radius: 4px;"><i class="fas fa-arrow-up" style="margin-right: 4px;"></i> Sortie</span>';
        }

        let colorBadge = '';
        if (mvt.couleur === 'Noir') colorBadge = '<span style="display:inline-flex; align-items:center; gap:4px; font-weight:700;"><i class="fas fa-circle" style="font-size: 8px; color: #000;"></i> Noir</span>';
        else if (mvt.couleur === 'Cyan') colorBadge = '<span style="display:inline-flex; align-items:center; gap:4px; color:#0ea5e9; font-weight:700;"><i class="fas fa-circle" style="font-size: 8px; color: #0ea5e9;"></i> Cyan</span>';
        else if (mvt.couleur === 'Magenta') colorBadge = '<span style="display:inline-flex; align-items:center; gap:4px; color:#d946ef; font-weight:700;"><i class="fas fa-circle" style="font-size: 8px; color: #d946ef;"></i> Magenta</span>';
        else if (mvt.couleur === 'Yellow') colorBadge = '<span style="display:inline-flex; align-items:center; gap:4px; color:#eab308; font-weight:700;"><i class="fas fa-circle" style="font-size: 8px; color: #eab308;"></i> Yellow</span>';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${new Date(mvt.date).toLocaleString('fr-FR')}</td>
            <td>${opBadge}</td>
            <td style="font-weight: 700; color: var(--text-primary);">${escapeHTML(mvt.ref)}</td>
            <td>${colorBadge}</td>
            <td style="font-weight: 700; font-size: 1.05rem;">${mvt.qty}</td>
            <td style="font-size: 0.9rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(mvt.details)}">${escapeHTML(mvt.details)}</td>
            <td style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">${escapeHTML(mvt.operator)}</td>
            <td class="action-btns" style="text-align: center;">
                <button class="action-btn delete" onclick="deleteTonerMovement('${mvt.id}')" title="Supprimer">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (container) {
        if (totalItems > pageSize) {
            container.style.display = 'flex';
            const html = renderPaginationHTML(totalItems, totalPages, window.currentTonerMovementsPage, 'mouvements', 'changeTonerMovementsPage');
            safeSetHTML(container, html);
        } else {
            container.style.display = 'none';
        }
    }
}

function deleteTonerMovement(id) {
    const mvt = tonerMovements.find(m => m.id === id);
    if (!mvt) return;

    showCustomConfirm(
        "Supprimer le mouvement",
        `Voulez-vous vraiment supprimer définitivement ce mouvement de l'historique (Réf: ${mvt.ref}, Qty: ${mvt.qty}) ? Cette action est irréversible.`,
        () => {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("tonerMovements").doc(id).delete()
                .then(() => {
                    logActivity('TONERS', 'SUPPRESSION_MOUVEMENT', `Mouvement supprimé : ${mvt.type} de ${mvt.qty} u. pour ${mvt.ref}`);
                    showToast("Mouvement supprimé de l'historique.", "emerald");
                })
                .catch(error => {
                    console.error("Error deleting movement:", error);
                    showToast("⚠️ Échec de la suppression.", "red");
                });
        }
    );
}

window.deleteTonerMovement = deleteTonerMovement;

function openAddTonerModal(id = null) {
    const form = document.getElementById('tonerItemForm');
    if (form) form.reset();

    const title = document.getElementById('tonerFormTitle');
    const desc = document.getElementById('tonerFormDesc');
    const tonerIdField = document.getElementById('tonerFormId');
    const qtyFieldGroup = document.getElementById('tonerQtyFormGroup');
    const qtyInput = document.getElementById('tonerFormQty');
    
    const addModeGroup = document.getElementById('tonerAddModeGroup');
    const addModeSelect = document.getElementById('tonerFormAddMode');
    const singleColorGroup = document.getElementById('tonerSingleColorGroup');

    if (id) {
        if (title) title.innerHTML = '<i class="fas fa-edit"></i> Modifier l\'Imprimante';
        if (desc) {
            desc.textContent = 'Modifier les informations du consommable.';
            desc.style.display = 'none';
        }
        if (tonerIdField) tonerIdField.value = id;
        
        if (qtyFieldGroup) qtyFieldGroup.style.display = 'none';
        if (qtyInput) qtyInput.removeAttribute('required');
        
        if (addModeGroup) addModeGroup.style.display = 'none';
        if (singleColorGroup) singleColorGroup.style.display = 'block';
        
        const notesGroup = document.getElementById('tonerNotesGroup');
        if (notesGroup) notesGroup.style.display = 'block';
        
        const singleColorSelect = document.getElementById('tonerFormCouleur');
        if (singleColorSelect) singleColorSelect.setAttribute('required', 'required');

        const item = tonerInventory.find(t => t.id === id);
        if (item) {
            document.getElementById('tonerFormType').value = item.type;
            document.getElementById('tonerFormMarque').value = item.marque;
            document.getElementById('tonerFormCouleur').value = item.couleur;
            document.getElementById('tonerFormCompatible').value = item.compatible;
            document.getElementById('tonerFormLocation').value = item.location;
            document.getElementById('tonerFormObservation').value = item.observation;
        }
    } else {
        if (title) title.innerHTML = '<i class="fas fa-plus-circle"></i> Nouvelle Imprimante';
        if (desc) {
            desc.textContent = 'Ajouter un toner ou une cartouche au stock.';
            desc.style.display = 'none';
        }
        if (tonerIdField) tonerIdField.value = '';
        if (qtyFieldGroup) qtyFieldGroup.style.display = 'block';
        if (qtyInput) {
            qtyInput.setAttribute('required', 'required');
            qtyInput.value = '0';
        }
        
        if (addModeGroup) addModeGroup.style.display = 'block';
        if (addModeSelect) addModeSelect.value = 'single';
        
        toggleTonerAddMode();
    }

    showView('tonerFormView');
}

function toggleTonerAddMode() {
    const addMode = document.getElementById('tonerFormAddMode').value;
    const singleColorGroup = document.getElementById('tonerSingleColorGroup');
    const qtyFormGroup = document.getElementById('tonerQtyFormGroup');
    const notesGroup = document.getElementById('tonerNotesGroup');
    
    if (addMode === 'all-colors') {
        if (singleColorGroup) singleColorGroup.style.display = 'none';
        if (qtyFormGroup) qtyFormGroup.style.display = 'none';
        if (notesGroup) notesGroup.style.display = 'none';
        
        const singleColorSelect = document.getElementById('tonerFormCouleur');
        if (singleColorSelect) singleColorSelect.removeAttribute('required');
    } else {
        if (singleColorGroup) singleColorGroup.style.display = 'block';
        if (notesGroup) notesGroup.style.display = 'none';
        
        const idField = document.getElementById('tonerFormId');
        if (qtyFormGroup && idField && !idField.value) {
            qtyFormGroup.style.display = 'none';
        }
        
        const singleColorSelect = document.getElementById('tonerFormCouleur');
        if (singleColorSelect) singleColorSelect.setAttribute('required', 'required');
    }
}

function closeAddTonerModal() {
    showView('tonerCartoucheView');
}

function saveTonerItem(event) {
    event.preventDefault();

    const id = document.getElementById('tonerFormId').value;
    const type = document.getElementById('tonerFormType').value;
    const marque = document.getElementById('tonerFormMarque').value;
    const compatible = document.getElementById('tonerFormCompatible').value.trim();
    const ref = compatible.toUpperCase();
    const location = document.getElementById('tonerFormLocation').value.trim();
    const observation = document.getElementById('tonerFormObservation').value.trim();

    if (!ref || !compatible || !location) {
        showToast("⚠️ Tous les champs requis doivent être remplis !", "red");
        return;
    }

    const currentUser = auth.currentUser;
    const operatorName = currentUser ? (currentUser.displayName || currentUser.email) : 'Système';

    const tonerData = {
        type,
        marque,
        ref,
        compatible,
        location,
        observation,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        // Edit mode (single item)
        const couleur = document.getElementById('tonerFormCouleur').value;
        tonerData.couleur = couleur;
        
        db.collection("tonerInventory").doc(id).update(tonerData)
            .then(() => {
                showToast("✨ Consommable mis à jour avec succès !", "emerald");
                closeAddTonerModal();
            })
            .catch(error => {
                console.error("Error updating toner:", error);
                showToast("⚠️ Échec de mise à jour du consommable.", "red");
            });
    } else {
        // Add mode
        tonerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const addMode = document.getElementById('tonerFormAddMode') 
            ? document.getElementById('tonerFormAddMode').value 
            : 'single';
            
        if (addMode === 'all-colors') {
            // Add all 4 colors
            const colors = ['Noir', 'Cyan', 'Magenta', 'Yellow'];
            const promises = [];
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // Check if any of these already exist to prevent duplicates
            const existingColors = [];
            colors.forEach(color => {
                const exists = tonerInventory.find(t => t.ref === ref && t.couleur === color);
                if (exists) {
                    existingColors.push(color);
                }
            });
            
            if (existingColors.length > 0) {
                showToast(`⚠️ Certains modèles (${ref}) existent déjà pour les couleurs: ${existingColors.join(', ')} !`, "red");
                return;
            }
            
            showToast("🔄 Création du modèle d'imprimante...", "blue");
            
            colors.forEach(color => {
                const itemData = {
                    ...tonerData,
                    couleur: color,
                    qty: 0 // Quantities defaulted to 0 automatically
                };
                
                const promise = db.collection("tonerInventory").add(itemData);
                promises.push(promise);
            });
            
            Promise.all(promises)
                .then(() => {
                    showToast("✨ Modèle d'imprimante créé avec les 4 couleurs (Initialisées à 0) !", "emerald");
                    closeAddTonerModal();
                })
                .catch(error => {
                    console.error("Error adding printer model:", error);
                    showToast("⚠️ Échec de création du modèle d'imprimante.", "red");
                });
                
        } else {
            // Add single color
            const couleur = document.getElementById('tonerFormCouleur').value;
            tonerData.couleur = couleur;
            
            const qty = parseInt(document.getElementById('tonerFormQty').value) || 0;
            tonerData.qty = qty;

            const exists = tonerInventory.find(t => t.ref === ref && t.couleur === couleur);
            if (exists) {
                showToast(`⚠️ Ce modèle (${ref}) avec la couleur (${couleur}) existe déjà !`, "red");
                return;
            }

            db.collection("tonerInventory").add(tonerData)
                .then((docRef) => {
                    showToast("✨ Consommable créé avec succès !", "emerald");
                    
                    if (qty > 0) {
                        const movement = {
                            date: new Date().toISOString().split('T')[0],
                            type: 'Entree',
                            ref: ref,
                            couleur: couleur,
                            qty: qty,
                            details: "Stock Initial au démarrage",
                            operator: operatorName,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        db.collection("tonerMovements").add(movement);
                    }

                    closeAddTonerModal();
                })
                .catch(error => {
                    console.error("Error adding toner:", error);
                    showToast("⚠️ Échec de création du consommable.", "red");
                });
        }
    }
}

function openTonerMovementModal(id, movementType) {
    const item = tonerInventory.find(t => t.id === id);
    if (!item) return;

    const todayStr = new Date().toISOString().split('T')[0];

    if (movementType === 'Entree') {
        const form = document.getElementById('tonerEntreeForm');
        if (form) form.reset();

        document.getElementById('tonerEntreeId').value = id;
        document.getElementById('tonerEntreeRefLabel').value = `${item.ref} (${item.marque} - ${item.couleur})`;
        document.getElementById('tonerEntreeDate').value = todayStr;
        
        const overlay = document.getElementById('tonerEntreeOverlay');
        if (overlay) overlay.classList.add('modal-active');
    } else {
        const form = document.getElementById('tonerSortieForm');
        if (form) form.reset();

        document.getElementById('tonerSortieId').value = id;
        document.getElementById('tonerSortieRefLabel').value = `${item.ref} (${item.marque} - ${item.couleur})`;
        document.getElementById('tonerSortieMaxQty').textContent = item.qty;
        document.getElementById('tonerSortieDate').value = todayStr;

        const overlay = document.getElementById('tonerSortieOverlay');
        if (overlay) overlay.classList.add('modal-active');
    }
}

function closeTonerMovementModal() {
    const overlayEntree = document.getElementById('tonerEntreeOverlay');
    const overlaySortie = document.getElementById('tonerSortieOverlay');
    if (overlayEntree) overlayEntree.classList.remove('modal-active');
    if (overlaySortie) overlaySortie.classList.remove('modal-active');
}

function saveTonerMovement(event, movementType) {
    event.preventDefault();

    const currentUser = auth.currentUser;
    const operatorName = currentUser ? (currentUser.displayName || currentUser.email) : 'Système';

    if (movementType === 'Entree') {
        const id = document.getElementById('tonerEntreeId').value;
        const qty = parseInt(document.getElementById('tonerEntreeQty').value) || 0;
        const date = document.getElementById('tonerEntreeDate').value;
        const obs = document.getElementById('tonerEntreeObservation').value.trim();

        if (qty <= 0 || !date) {
            showToast("⚠️ Veuillez remplir tous les champs correctement !", "red");
            return;
        }

        const item = tonerInventory.find(t => t.id === id);
        if (!item) return;

        const newQty = item.qty + qty;

        const batch = db.batch();
        const tonerRef = db.collection("tonerInventory").doc(id);
        const mvtRef = db.collection("tonerMovements").doc();

        batch.update(tonerRef, {
            qty: newQty,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });

        batch.set(mvtRef, {
            date: date,
            type: 'Entree',
            ref: item.ref,
            couleur: item.couleur,
            qty: qty,
            details: obs || "Opération d'entrée de matériel",
            operator: operatorName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        batch.commit()
            .then(() => {
                showToast(`✨ Entrée validée ! Nouvelle quantité : ${newQty} u.`, "emerald");
                closeTonerMovementModal();
            })
            .catch(error => {
                console.error("Entree transaction error:", error);
                showToast("⚠️ Échec de validation du mouvement d'entrée.", "red");
            });

    } else {
        const id = document.getElementById('tonerSortieId').value;
        const qty = parseInt(document.getElementById('tonerSortieQty').value) || 0;
        const date = document.getElementById('tonerSortieDate').value;
        const dept = document.getElementById('tonerSortieDept').value.trim();
        const printer = document.getElementById('tonerSortiePrinter').value.trim();
        const reason = document.getElementById('tonerSortieReason').value.trim();

        if (qty <= 0 || !date || !dept || !printer || !reason) {
            showToast("⚠️ Veuillez remplir tous les champs requis !", "red");
            return;
        }

        const item = tonerInventory.find(t => t.id === id);
        if (!item) return;

        if (item.qty < qty) {
            showToast(`⚠️ Quantité insuffisante ! Stock disponible : ${item.qty} u.`, "red");
            return;
        }

        const newQty = item.qty - qty;

        const batch = db.batch();
        const tonerRef = db.collection("tonerInventory").doc(id);
        const mvtRef = db.collection("tonerMovements").doc();

        batch.update(tonerRef, {
            qty: newQty,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });

        batch.set(mvtRef, {
            date: date,
            type: 'Sortie',
            ref: item.ref,
            couleur: item.couleur,
            qty: qty,
            details: `Sortie vers ${dept} (${printer}) - Motif: ${reason}`,
            operator: operatorName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        batch.commit()
            .then(() => {
                showToast(`✨ Sortie validée ! Nouvelle quantité : ${newQty} u.`, "emerald");
                closeTonerMovementModal();
            })
            .catch(error => {
                console.error("Sortie transaction error:", error);
                showToast("⚠️ Échec de validation du mouvement de sortie.", "red");
            });
    }
}

function deleteTonerItem(id) {
    const item = tonerInventory.find(t => t.id === id);
    if (!item) return;

    showCustomConfirm(
        "Supprimer le consommable",
        `Voulez-vous vraiment supprimer définitivement le consommable référencé ${item.ref || 'Sans Réf'} ?`,
        () => {
            db.collection("tonerInventory").doc(id).delete()
                .then(() => {
                    showToast("✨ Consommable supprimé du stock.", "emerald");
                })
                .catch(error => {
                    console.error("Error deleting toner:", error);
                    showToast("⚠️ Échec de la suppression.", "red");
                });
        },
        null,
        'delete'
    );
}

function deletePrinterModel(modelName) {
    if (!modelName) return;

    showCustomConfirm(
        "Supprimer l'imprimante et ses consommables",
        `Voulez-vous vraiment supprimer définitivement l'imprimante "${modelName}" et tous ses consommables associés ? Cette action supprimera tous les stocks de consommables correspondants.`,
        () => {
            const itemsToDelete = tonerInventory.filter(t => t.compatible === modelName);
            if (itemsToDelete.length === 0) {
                showToast("⚠️ Aucun consommable trouvé pour cette imprimante.", "red");
                return;
            }

            const deletePromises = itemsToDelete.map(item => 
                db.collection("tonerInventory").doc(item.id).delete()
            );

            Promise.all(deletePromises)
                .then(() => {
                    showToast(`✨ L'imprimante "${modelName}" et ses consommables ont été supprimés.`, "emerald");
                    closePrinterDetails();
                })
                .catch(error => {
                    console.error("Error deleting printer model:", error);
                    showToast("⚠️ Échec de la suppression de l'imprimante.", "red");
                });
        },
        null,
        'delete'
    );
}

window.deletePrinterModel = deletePrinterModel;

function quickTonerMovement(id, type) {
    const item = tonerInventory.find(t => t.id === id);
    if (!item) return;

    if (type === 'Sortie' && item.qty <= 0) {
        showToast(`⚠️ Quantité insuffisante ! Stock en rupture.`, "red");
        return;
    }

    const qtyChange = 1;
    const newQty = type === 'Entree' ? item.qty + qtyChange : item.qty - qtyChange;

    const actionText = type === 'Entree' ? 'ajouter 1 unité de' : 'retirer 1 unité de';
    const confirmTitle = type === 'Entree' ? "Confirmer l'Entrée rapide" : "Confirmer la Sortie rapide";
    const confirmDesc = `Voulez-vous ${actionText} toner ${item.couleur} (${item.marque}) pour l'imprimante ${item.compatible} ?`;

    showCustomConfirm(
        confirmTitle,
        confirmDesc,
        () => {
            const currentUser = auth.currentUser;
            const operatorName = currentUser ? (currentUser.displayName || currentUser.email) : 'Système';
            const todayStr = new Date().toISOString().split('T')[0];

            const batch = db.batch();
            const tonerRef = db.collection("tonerInventory").doc(id);
            const mvtRef = db.collection("tonerMovements").doc();

            batch.update(tonerRef, {
                qty: newQty,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });

            batch.set(mvtRef, {
                date: todayStr,
                type: type,
                ref: item.ref,
                couleur: item.couleur,
                qty: qtyChange,
                details: type === 'Entree' ? "Entrée rapide (+1 u.)" : "Sortie rapide (-1 u.)",
                operator: operatorName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            batch.commit()
                .then(() => {
                    showToast(`✨ Stock mis à jour ! Nouvelle quantité : ${newQty} u.`, "emerald");
                })
                .catch(error => {
                    console.error("Quick movement commit error:", error);
                    showToast("⚠️ Échec de la mise à jour du stock.", "red");
                });
        },
        null,
        'confirm'
    );
}

function renderTonerCharts() {
    const chartContainer = document.getElementById('tonerColorDistributionChart');
    const alertsContainer = document.getElementById('tonerAlertsList');
    if (!chartContainer || !alertsContainer) return;

    chartContainer.innerHTML = '';
    alertsContainer.innerHTML = '';

    let qtyNoir = 0;
    let qtyCyan = 0;
    let qtyMagenta = 0;
    let qtyYellow = 0;

    tonerInventory.forEach(item => {
        if (item.couleur === 'Noir') qtyNoir += item.qty;
        else if (item.couleur === 'Cyan') qtyCyan += item.qty;
        else if (item.couleur === 'Magenta') qtyMagenta += item.qty;
        else if (item.couleur === 'Yellow') qtyYellow += item.qty;
    });

    const totalQty = qtyNoir + qtyCyan + qtyMagenta + qtyYellow;

    const colors = [
        { name: 'Noir', qty: qtyNoir, hex: '#0f172a', bg: 'rgba(15, 23, 42, 0.1)' },
        { name: 'Cyan', qty: qtyCyan, hex: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
        { name: 'Magenta', qty: qtyMagenta, hex: '#d946ef', bg: 'rgba(217, 70, 239, 0.1)' },
        { name: 'Yellow', qty: qtyYellow, hex: '#eab308', bg: 'rgba(234, 179, 8, 0.1)' }
    ];

    colors.forEach(col => {
        const pct = totalQty > 0 ? Math.round((col.qty / totalQty) * 100) : 0;
        
        const colGradients = {
            'Noir': 'linear-gradient(90deg, #475569, #0f172a)',
            'Cyan': 'linear-gradient(90deg, #38bdf8, #0284c7)',
            'Magenta': 'linear-gradient(90deg, #f472b6, #c026d3)',
            'Yellow': 'linear-gradient(90deg, #fbbf24, #ca8a04)'
        };
        const activeGradient = colGradients[col.name] || col.hex;

        const row = document.createElement('div');
        row.style = 'display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.4rem;';
        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 700;">
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${col.hex}; border: 2px solid var(--border-color); box-shadow: 0 0 6px ${col.hex}66;"></span>
                    <span style="color: var(--text-primary); letter-spacing: -0.01em;">${col.name}</span>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 4px;">
                    <span style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 800;">${col.qty} u.</span>
                    <span style="color: var(--text-muted); font-size: 0.78rem; font-weight: 600;">(${pct}%)</span>
                </div>
            </div>
            <div style="height: 12px; border-radius: 99px; background: var(--bg-secondary); overflow: hidden; width: 100%; border: 1px solid var(--border-color); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); position: relative;">
                <div style="width: ${pct}%; height: 100%; background: ${activeGradient}; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 99px; box-shadow: 0 0 8px ${col.hex}33;"></div>
            </div>
        `;
        chartContainer.appendChild(row);
    });

    const alertItems = tonerInventory.filter(item => item.qty <= 1);

    const viewAllContainer = document.getElementById('tonerAlertsViewAllContainer');
    if (viewAllContainer) {
        if (alertItems.length > 2) {
            viewAllContainer.style.display = 'block';
        } else {
            viewAllContainer.style.display = 'none';
        }
    }

    if (alertItems.length === 0) {
        alertsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 2rem;">
            🟢 Tout est en ordre. Aucun produit en stock critique.
        </div>`;
        return;
    }

    const visibleAlertItems = alertItems.slice(0, 2);

    visibleAlertItems.forEach(item => {
        const isRupture = item.qty === 0;
        const alertClass = isRupture ? 'alert-rupture' : 'alert-critique';
        const badgeText = isRupture ? 'Rupture' : 'Critique';
        
        let colDot = '';
        if (item.couleur === 'Noir') colDot = '#1e293b';
        else if (item.couleur === 'Cyan') colDot = '#0ea5e9';
        else if (item.couleur === 'Magenta') colDot = '#d946ef';
        else if (item.couleur === 'Yellow') colDot = '#eab308';

        const alertRow = document.createElement('div');
        alertRow.className = `toner-alert-item ${alertClass}`;
        alertRow.innerHTML = `
            <div class="toner-alert-item-info">
                <div class="toner-alert-item-icon">
                    <i class="${isRupture ? 'fas fa-ban' : 'fas fa-triangle-exclamation'}"></i>
                </div>
                <div>
                    <span style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${escapeHTML(item.compatible)}</span>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${colDot}; border: 1px solid var(--border-color);"></span>
                        <small style="color: var(--text-muted); font-weight: 600; font-size: 0.78rem;">${escapeHTML(item.marque)} - ${escapeHTML(item.couleur)}</small>
                    </div>
                </div>
            </div>
            <span class="toner-alert-badge">${badgeText} (${item.qty} u.)</span>
        `;
        alertsContainer.appendChild(alertRow);
    });

    if (document.getElementById('tonerAllAlertsGrid')) {
        renderAllAlertsGrid();
    }
}

function populateTonerMarqueFilter() {
    const filterMarque = document.getElementById('tonerFilterMarque');
    if (!filterMarque) return;
    const selectedValue = filterMarque.value;
    
    // Extract unique printer names from current tonerInventory
    const uniqueImprimantes = [...new Set(tonerInventory.map(item => item.compatible).filter(Boolean))];
    uniqueImprimantes.sort();
    
    filterMarque.innerHTML = '<option value="">Toutes Imprimantes</option>';
    uniqueImprimantes.forEach(imprimante => {
        const opt = document.createElement('option');
        opt.value = imprimante;
        opt.textContent = imprimante;
        filterMarque.appendChild(opt);
    });
    
    // Restore selection if it exists in the new list, otherwise reset selection
    if (selectedValue && uniqueImprimantes.includes(selectedValue)) {
        filterMarque.value = selectedValue;
    } else {
        filterMarque.value = '';
        tonerFilterMarqueVal = '';
    }
}

function populateTonerAllMarqueFilter() {
    const filterMarque = document.getElementById('tonerAllFilterMarque');
    if (!filterMarque) return;
    const selectedValue = filterMarque.value;
    
    const uniqueImprimantes = [...new Set(tonerInventory.map(item => item.compatible).filter(Boolean))];
    uniqueImprimantes.sort();
    
    filterMarque.innerHTML = '<option value="">Toutes Imprimantes</option>';
    uniqueImprimantes.forEach(imprimante => {
        const opt = document.createElement('option');
        opt.value = imprimante;
        opt.textContent = imprimante;
        filterMarque.appendChild(opt);
    });
    
    if (selectedValue && uniqueImprimantes.includes(selectedValue)) {
        filterMarque.value = selectedValue;
    } else {
        filterMarque.value = '';
    }
}

function showTonerAllCardsView() {
    const allSearchInput = document.getElementById('tonerAllSearchInput');
    const allFilterMarque = document.getElementById('tonerAllFilterMarque');
    const allFilterColor = document.getElementById('tonerAllFilterColor');
    
    if (allSearchInput) allSearchInput.value = tonerSearchQuery;
    populateTonerAllMarqueFilter();
    if (allFilterMarque) allFilterMarque.value = tonerFilterMarqueVal;
    if (allFilterColor) allFilterColor.value = tonerFilterColorVal;

    showView('tonerAllCardsView');
    renderTonerAllCardsGrid();
    initTonerCustomSelects();
}

function filterAllTonerGrid() {
    const allSearchInput = document.getElementById('tonerAllSearchInput');
    const allFilterMarque = document.getElementById('tonerAllFilterMarque');
    const allFilterColor = document.getElementById('tonerAllFilterColor');
    
    tonerSearchQuery = allSearchInput ? allSearchInput.value.toLowerCase().trim() : '';
    tonerFilterMarqueVal = allFilterMarque ? allFilterMarque.value : '';
    tonerFilterColorVal = allFilterColor ? allFilterColor.value : '';
    
    // Sync to main view inputs:
    const searchInput = document.getElementById('tonerSearchInput');
    const filterMarque = document.getElementById('tonerFilterMarque');
    const filterColor = document.getElementById('tonerFilterColor');
    
    if (searchInput) searchInput.value = tonerSearchQuery;
    if (filterMarque) filterMarque.value = tonerFilterMarqueVal;
    if (filterColor) filterColor.value = tonerFilterColorVal;
    
    renderTonerTable();
    renderTonerAllCardsGrid();
}

function resetAllTonerFilters() {
    tonerSearchQuery = '';
    tonerFilterMarqueVal = '';
    tonerFilterColorVal = '';
    tonerFilterCritOnly = false;
    
    const allSearchInput = document.getElementById('tonerAllSearchInput');
    const allFilterMarque = document.getElementById('tonerAllFilterMarque');
    const allFilterColor = document.getElementById('tonerAllFilterColor');
    if (allSearchInput) allSearchInput.value = '';
    if (allFilterMarque) allFilterMarque.value = '';
    if (allFilterColor) allFilterColor.value = '';
    
    const searchInput = document.getElementById('tonerSearchInput');
    const filterMarque = document.getElementById('tonerFilterMarque');
    const filterColor = document.getElementById('tonerFilterColor');
    if (searchInput) searchInput.value = '';
    if (filterMarque) filterMarque.value = '';
    if (filterColor) filterColor.value = '';
    
    renderTonerTable();
    renderTonerAllCardsGrid();
    initTonerCustomSelects();
}

function renderTonerAllCardsGrid() {
    const grid = document.getElementById('tonerAllCardsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = tonerInventory.filter(item => {
        const matchQuery = !tonerSearchQuery || 
                           item.ref.toLowerCase().includes(tonerSearchQuery) || 
                           item.compatible.toLowerCase().includes(tonerSearchQuery) ||
                           item.marque.toLowerCase().includes(tonerSearchQuery);
        
        const matchMarque = !tonerFilterMarqueVal || item.compatible === tonerFilterMarqueVal;
        const matchColor = !tonerFilterColorVal || item.couleur === tonerFilterColorVal;
        const matchCrit = !tonerFilterCritOnly || (item.qty > 0 && item.qty <= 1);

        return matchQuery && matchMarque && matchColor && matchCrit;
    });

    const infoEl = document.getElementById('tonerAllFilterInfo');
    if (infoEl) {
        const totalQty = filtered.reduce((sum, item) => sum + item.qty, 0);
        const isFiltered = tonerSearchQuery || tonerFilterMarqueVal || tonerFilterColorVal || tonerFilterCritOnly;
        
        if (isFiltered) {
            infoEl.style.borderColor = 'rgba(139, 92, 246, 0.3)';
            infoEl.style.background = 'rgba(139, 92, 246, 0.06)';
            infoEl.style.color = 'var(--text-primary)';
            infoEl.innerHTML = `<i class="fas fa-filter" style="color: #8b5cf6;"></i> <span>Trouvé: <strong>${filtered.length}</strong> (${totalQty} u.)</span>`;
        } else {
            infoEl.style.borderColor = 'var(--border-color)';
            infoEl.style.background = 'var(--bg-secondary)';
            infoEl.style.color = 'var(--text-secondary)';
            infoEl.innerHTML = `<i class="fas fa-info-circle" style="color: var(--text-muted);"></i> <span>Total: <strong>${tonerInventory.length}</strong> (${totalQty} u.)</span>`;
        }
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border-color); color: var(--text-muted);">
            <i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; color: var(--text-muted);"></i>
            Aucun toner ou cartouche trouvé dans le stock.
        </div>`;
        return;
    }

    filtered.forEach(item => {
        const card = createTonerCardElement(item);
        grid.appendChild(card);
    });
}

function handleTonerBack() {
    if (selectedPrinterModel) {
        closePrinterDetails();
    } else {
        showView('dashboardView');
    }
}

// Bind to window to allow HTML onclicks to access them
window.showTonerView = showTonerView;
window.clearTonerFilters = clearTonerFilters;
window.filterTonerByColor = filterTonerByColor;
window.filterTonerCritical = filterTonerCritical;
window.resetTonerFilters = resetTonerFilters;
window.filterTonerTable = filterTonerTable;
window.updateTonerStats = updateTonerStats;
window.renderTonerTable = renderTonerTable;
window.renderTonerMovementsTable = renderTonerMovementsTable;
window.selectPrinter = selectPrinter;
window.closePrinterDetails = closePrinterDetails;
window.handleTonerBack = handleTonerBack;
window.filterPrintersGrid = filterPrintersGrid;
window.openAddTonerModal = openAddTonerModal;
window.closeAddTonerModal = closeAddTonerModal;
window.saveTonerItem = saveTonerItem;
window.toggleTonerAddMode = toggleTonerAddMode;
window.openTonerMovementModal = openTonerMovementModal;
window.closeTonerMovementModal = closeTonerMovementModal;
window.saveTonerMovement = saveTonerMovement;
window.deleteTonerItem = deleteTonerItem;
window.quickTonerMovement = quickTonerMovement;
window.renderTonerCharts = renderTonerCharts;
window.populateTonerMarqueFilter = populateTonerMarqueFilter;
window.updateTonerFilterCardHighlight = updateTonerFilterCardHighlight;
window.changeTonerMovementsPage = changeTonerMovementsPage;
window.showTonerAllCardsView = showTonerAllCardsView;
window.filterAllTonerGrid = filterAllTonerGrid;
window.resetAllTonerFilters = resetAllTonerFilters;
window.populateTonerAllMarqueFilter = populateTonerAllMarqueFilter;
window.renderTonerAllCardsGrid = renderTonerAllCardsGrid;

// Dedicated Alerts View State
let tonerAlertSearchVal = '';
let tonerAlertMarqueVal = '';
let tonerAlertColorVal = '';

function showAllTonerAlerts() {
    showView('tonerAllAlertsView');
    
    // Reset inputs
    const searchInput = document.getElementById('tonerAlertsSearchInput');
    const filterMarque = document.getElementById('tonerAlertsFilterMarque');
    const filterColor = document.getElementById('tonerAlertsFilterColor');
    
    if (searchInput) searchInput.value = '';
    if (filterMarque) filterMarque.value = '';
    if (filterColor) filterColor.value = '';
    
    tonerAlertSearchVal = '';
    tonerAlertMarqueVal = '';
    tonerAlertColorVal = '';
    
    populateTonerAlertsMarqueFilter();
    renderAllAlertsGrid();
    initTonerCustomSelects();
}

function populateTonerAlertsMarqueFilter() {
    const filterMarque = document.getElementById('tonerAlertsFilterMarque');
    if (!filterMarque) return;
    
    const alertItems = tonerInventory.filter(item => item.qty <= 1);
    const uniqueImprimantes = [...new Set(alertItems.map(item => item.compatible).filter(Boolean))];
    uniqueImprimantes.sort();
    
    filterMarque.innerHTML = '<option value="">Toutes Imprimantes</option>';
    uniqueImprimantes.forEach(imprimante => {
        const opt = document.createElement('option');
        opt.value = imprimante;
        opt.textContent = imprimante;
        filterMarque.appendChild(opt);
    });
}

function renderAllAlertsGrid() {
    const grid = document.getElementById('tonerAllAlertsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Filter alert items
    const alertItems = tonerInventory.filter(item => item.qty <= 1);
    
    const filtered = alertItems.filter(item => {
        const matchesSearch = !tonerAlertSearchVal || 
            (item.ref && item.ref.toLowerCase().includes(tonerAlertSearchVal.toLowerCase())) ||
            (item.marque && item.marque.toLowerCase().includes(tonerAlertSearchVal.toLowerCase())) ||
            (item.compatible && item.compatible.toLowerCase().includes(tonerAlertSearchVal.toLowerCase()));
            
        const matchesMarque = !tonerAlertMarqueVal || item.compatible === tonerAlertMarqueVal;
        const matchesColor = !tonerAlertColorVal || item.couleur === tonerAlertColorVal;
        
        return matchesSearch && matchesMarque && matchesColor;
    });

    const infoEl = document.getElementById('tonerAlertsFilterInfo');
    if (infoEl) {
        const totalQty = filtered.reduce((sum, item) => sum + item.qty, 0);
        const isFiltered = tonerAlertSearchVal || tonerAlertMarqueVal || tonerAlertColorVal;
        
        if (isFiltered) {
            infoEl.style.borderColor = 'rgba(139, 92, 246, 0.3)';
            infoEl.style.background = 'rgba(139, 92, 246, 0.06)';
            infoEl.style.color = 'var(--text-primary)';
            infoEl.innerHTML = `<i class="fas fa-filter" style="color: #8b5cf6;"></i> <span>Trouvé: <strong>${filtered.length}</strong> (${totalQty} u.)</span>`;
        } else {
            infoEl.style.borderColor = 'var(--border-color)';
            infoEl.style.background = 'var(--bg-secondary)';
            infoEl.style.color = 'var(--text-secondary)';
            infoEl.innerHTML = `<i class="fas fa-info-circle" style="color: var(--text-muted);"></i> <span>Total Alertes: <strong>${alertItems.length}</strong> (${totalQty} u.)</span>`;
        }
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border-color); color: var(--text-muted);">
            <i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; color: var(--text-muted);"></i>
            Aucune alerte trouvée avec les filtres actuels.
        </div>`;
        return;
    }
    
    filtered.forEach(item => {
        const card = createTonerAlertCardElement(item);
        grid.appendChild(card);
    });
}

function createTonerAlertCardElement(item) {
    const isRupture = item.qty === 0;
    const alertClass = isRupture ? 'alert-card-rupture' : 'alert-card-critique';
    const headerText = isRupture ? 'RUPTURE DE STOCK' : 'STOCK CRITIQUE';
    const headerIcon = isRupture ? 'fas fa-ban' : 'fas fa-triangle-exclamation';

    let colorDot = '';
    if (item.couleur === 'Noir') colorDot = 'background: #1e293b; box-shadow: 0 0 8px rgba(0,0,0,0.2);';
    else if (item.couleur === 'Cyan') colorDot = 'background: #0ea5e9; box-shadow: 0 0 8px rgba(14,165,233,0.4);';
    else if (item.couleur === 'Magenta') colorDot = 'background: #d946ef; box-shadow: 0 0 8px rgba(217,70,239,0.4);';
    else if (item.couleur === 'Yellow') colorDot = 'background: #eab308; box-shadow: 0 0 8px rgba(234,179,8,0.4);';

    const lastMvt = tonerMovements.find(m => m.ref === item.ref);
    const lastMvtText = lastMvt 
        ? `${lastMvt.type === 'Entree' ? '🟢' : '🔴'} ${lastMvt.qty} u. (${new Date(lastMvt.date).toLocaleDateString('fr-FR')})`
        : 'Aucun mouvement';

    const card = document.createElement('div');
    card.className = `toner-alert-card ${alertClass} color-${item.couleur.toLowerCase()}`;
    
    card.innerHTML = `
        <div class="toner-alert-card-header">
            <i class="${headerIcon}" style="margin-right: 6px;"></i> ${headerText}
        </div>
        <div class="toner-alert-card-body">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; gap: 0.5rem;">
                <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--card-accent); background: var(--card-accent-wash); padding: 4px 10px; border-radius: 8px; border: 1px solid var(--card-accent-border); display: inline-flex; align-items: center; gap: 6px; max-width: 100%; overflow: hidden; white-space: nowrap;">
                    <i class="fas fa-tag" style="font-size: 0.7rem; flex-shrink: 0;"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;" title="${escapeHTML(item.type)} - ${escapeHTML(item.marque)}">${escapeHTML(item.type)} - ${escapeHTML(item.marque)}</span>
                </span>
            </div>
            <h4 style="margin: 0 0 0.4rem 0; font-size: 1.35rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">${escapeHTML(item.compatible)}</h4>
            
            <div style="display: inline-flex; align-items: center; gap: 6px; margin-bottom: 1.15rem; background: var(--card-accent-wash); padding: 4px 10px; border-radius: 8px; border: 1px solid var(--card-accent-border);">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; ${colorDot}"></span>
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--card-accent);">${escapeHTML(item.couleur)}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.88rem; margin-bottom: 1.3rem; border-top: 1px dashed var(--border-color); padding-top: 0.9rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px;"><i class="fas fa-map-marker-alt" style="width: 14px; color: var(--card-accent); opacity: 0.8;"></i> Emplacement :</span>
                    <strong style="color: var(--text-primary);">${escapeHTML(item.location || 'N/A')}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px;"><i class="fas fa-layer-group" style="width: 14px; color: var(--card-accent); opacity: 0.8;"></i> Quantité :</span>
                    <strong style="font-size: 1.05rem; color: ${isRupture ? 'var(--red-600)' : 'var(--amber-600)'}; font-weight: 800; background: ${isRupture ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)'}; padding: 2px 8px; border-radius: 6px; border: 1px solid ${isRupture ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.18)'};">${item.qty} u.</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.2rem; background: var(--bg-secondary); padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <span style="color: var(--text-secondary); font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; white-space: nowrap;"><i class="fas fa-history" style="width: 14px; opacity: 0.6; color: var(--card-accent);"></i> Dernier mvt :</span>
                    <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); flex-shrink: 0; white-space: nowrap;">${lastMvtText}</span>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <button class="btn toner-action-btn-entree" onclick="quickTonerMovement('${item.id}', 'Entree')">
                        <i class="fas fa-plus-circle" style="font-size: 0.95rem;"></i> Entrée
                    </button>
                    <button class="btn toner-action-btn-sortie" onclick="quickTonerMovement('${item.id}', 'Sortie')">
                        <i class="fas fa-minus-circle" style="font-size: 0.95rem;"></i> Sortie
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <button class="btn toner-action-btn-edit" onclick="openAddTonerModal('${item.id}')">
                        <i class="fas fa-edit" style="font-size: 0.95rem;"></i> Éditer
                    </button>
                    <button class="btn toner-action-btn-delete" onclick="deleteTonerItem('${item.id}')">
                        <i class="fas fa-trash-alt" style="font-size: 0.95rem;"></i> Supprimer
                    </button>
                </div>
            </div>
            
            <!-- Printer Watermark Graphic -->
            <div class="card-printer-watermark">
                <i class="fas fa-print"></i>
            </div>
        </div>
    `;
    return card;
}

function filterAllAlertsGrid() {
    const searchInput = document.getElementById('tonerAlertsSearchInput');
    const filterMarque = document.getElementById('tonerAlertsFilterMarque');
    const filterColor = document.getElementById('tonerAlertsFilterColor');
    
    if (searchInput) tonerAlertSearchVal = searchInput.value;
    if (filterMarque) tonerAlertMarqueVal = filterMarque.value;
    if (filterColor) tonerAlertColorVal = filterColor.value;
    
    renderAllAlertsGrid();
}

function resetAllAlertsFilters() {
    const searchInput = document.getElementById('tonerAlertsSearchInput');
    const filterMarque = document.getElementById('tonerAlertsFilterMarque');
    const filterColor = document.getElementById('tonerAlertsFilterColor');
    
    if (searchInput) searchInput.value = '';
    if (filterMarque) filterMarque.value = '';
    if (filterColor) filterColor.value = '';
    
    tonerAlertSearchVal = '';
    tonerAlertMarqueVal = '';
    tonerAlertColorVal = '';
    
    renderAllAlertsGrid();
    initTonerCustomSelects();
}

window.showAllTonerAlerts = showAllTonerAlerts;
window.filterAllAlertsGrid = filterAllAlertsGrid;
window.resetAllAlertsFilters = resetAllAlertsFilters;


/* ============ CUSTOM PREMIUM SELECT DROPDOWNS ============ */

function initCustomSelect(selectId, iconClass, iconColor) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Hide original sibling icon if exists (so it doesn't overlap)
    const siblingIcon = select.parentNode.querySelector('i');
    if (siblingIcon && siblingIcon !== select) {
        siblingIcon.style.display = 'none';
    }

    // Check if wrapper already exists
    let wrapper = document.getElementById(`wrapper-${selectId}`);
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = `wrapper-${selectId}`;
        wrapper.className = 'custom-select-wrapper';
        wrapper.style.minWidth = selectId.includes('Color') ? '170px' : '230px';
        wrapper.style.width = 'auto';
        
        // Insert wrapper before the select
        select.parentNode.insertBefore(wrapper, select);
        
        // Hide the original select
        select.style.display = 'none';
        
        // Build trigger HTML
        wrapper.innerHTML = `
            <button class="custom-select-trigger" type="button" id="trigger-${selectId}" onclick="toggleCustomSelectDropdown('${selectId}')">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="${iconClass}" style="color: ${iconColor}; font-size: 0.85rem;" id="trigger-icon-${selectId}"></i>
                    <span id="trigger-text-${selectId}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; display: block; text-align: left;"></span>
                </div>
                <i class="fas fa-chevron-down chevron"></i>
            </button>
            <div class="custom-select-options" id="options-${selectId}"></div>
        `;
    }
    
    syncCustomSelect(selectId);
}

function toggleCustomSelectDropdown(selectId) {
    const wrapper = document.getElementById(`wrapper-${selectId}`);
    if (!wrapper) return;
    
    // Close all other custom selects first
    document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        if (w.id !== `wrapper-${selectId}`) {
            w.classList.remove('open');
        }
    });
    
    wrapper.classList.toggle('open');
}

// Close custom selects when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => {
            w.classList.remove('open');
        });
    }
});

function syncCustomSelect(selectId) {
    const select = document.getElementById(selectId);
    const wrapper = document.getElementById(`wrapper-${selectId}`);
    if (!select || !wrapper) return;
    
    const optionsContainer = document.getElementById(`options-${selectId}`);
    const triggerText = document.getElementById(`trigger-text-${selectId}`);
    const triggerIcon = document.getElementById(`trigger-icon-${selectId}`);
    if (!optionsContainer || !triggerText) return;
    
    // Clear previous custom options
    optionsContainer.innerHTML = '';
    
    const options = Array.from(select.options);
    const selectedOption = select.options[select.selectedIndex] || options[0];
    
    // Update trigger text
    triggerText.textContent = selectedOption ? selectedOption.text : '';
    
    // Custom icon colors for the color dropdown trigger
    if (selectId.includes('Color')) {
        let selectedColor = '#a855f7'; // default purple
        if (select.value === 'Noir') selectedColor = '#1e293b';
        else if (select.value === 'Cyan') selectedColor = '#0ea5e9';
        else if (select.value === 'Magenta') selectedColor = '#d946ef';
        else if (select.value === 'Yellow') selectedColor = '#eab308';
        if (triggerIcon) triggerIcon.style.color = selectedColor;
    }
    
    options.forEach(opt => {
        const optDiv = document.createElement('div');
        optDiv.className = 'custom-select-option';
        if (opt.value === select.value) {
            optDiv.classList.add('selected');
        }
        
        // Color dot logic
        let dotHTML = '';
        if (selectId.includes('Color')) {
            let colorHex = '#a855f7';
            if (opt.value === 'Noir') colorHex = '#1e293b';
            else if (opt.value === 'Cyan') colorHex = '#0ea5e9';
            else if (opt.value === 'Magenta') colorHex = '#d946ef';
            else if (opt.value === 'Yellow') colorHex = '#eab308';
            
            if (opt.value !== '') {
                dotHTML = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${colorHex}; border: 1.5px solid var(--border-color); flex-shrink:0;"></span>`;
            } else {
                dotHTML = `<i class="fas fa-palette" style="color: var(--text-muted); font-size: 0.8rem; width: 10px; flex-shrink:0;"></i>`;
            }
        } else {
            // Printer icon
            if (opt.value !== '') {
                dotHTML = `<i class="fas fa-print" style="color: var(--teal-500); font-size: 0.8rem; width: 10px; flex-shrink:0;"></i>`;
            } else {
                dotHTML = `<i class="fas fa-print" style="color: var(--text-muted); font-size: 0.8rem; width: 10px; flex-shrink:0;"></i>`;
            }
        }
        
        optDiv.innerHTML = `
            ${dotHTML}
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${opt.text}</span>
        `;
        
        optDiv.onclick = function() {
            select.value = opt.value;
            // Trigger the change event
            select.dispatchEvent(new Event('change'));
            
            // Close dropdown
            wrapper.classList.remove('open');
            
            // Sync again
            syncCustomSelect(selectId);
        };
        
        optionsContainer.appendChild(optDiv);
    });
}

function initTonerCustomSelects() {
    initCustomSelect('tonerFilterMarque', 'fas fa-print', 'var(--teal-500)');
    initCustomSelect('tonerFilterColor', 'fas fa-palette', '#a855f7');
    
    initCustomSelect('tonerAllFilterMarque', 'fas fa-print', 'var(--teal-500)');
    initCustomSelect('tonerAllFilterColor', 'fas fa-palette', '#a855f7');
    
    initCustomSelect('tonerAlertsFilterMarque', 'fas fa-print', 'var(--teal-500)');
    initCustomSelect('tonerAlertsFilterColor', 'fas fa-palette', '#a855f7');
}

window.initTonerCustomSelects = initTonerCustomSelects;
window.toggleCustomSelectDropdown = toggleCustomSelectDropdown;

// ============ RESTITUTION & FIN DE CONTRAT LOGIC ============
function openRestitutionForm(selectedId = null) {
    // Store the currently active view before switching
    const activeView = document.querySelector('.view-container.view-active');
    if (activeView && activeView.id !== 'restitutionFormView' && activeView.id !== 'restitutionHistoryView') {
        window.lastActiveViewBeforeRestitution = activeView.id;
    } else if (!window.lastActiveViewBeforeRestitution) {
        window.lastActiveViewBeforeRestitution = 'dashboardView';
    }

    // Dynamically update back button tooltip & aria-label
    const backBtn = document.getElementById('restFormBackBtn');
    if (backBtn) {
        const target = window.lastActiveViewBeforeRestitution || 'dashboardView';
        if (target === 'distributionView') {
            backBtn.setAttribute('title', 'Retour aux Distributions');
            backBtn.setAttribute('aria-label', 'Retour aux Distributions');
        } else if (target === 'dashboardView') {
            backBtn.setAttribute('title', 'Retour au Tableau de Bord');
            backBtn.setAttribute('aria-label', 'Retour au Tableau de Bord');
        } else {
            backBtn.setAttribute('title', 'Retour');
            backBtn.setAttribute('aria-label', 'Retour');
        }
    }

    // Reset search input and suggestions list
    const searchInput = document.getElementById('restSearchInput');
    if (searchInput) searchInput.value = '';
    const suggestionsList = document.getElementById('restSuggestionsList');
    if (suggestionsList) {
        suggestionsList.innerHTML = '';
        suggestionsList.style.display = 'none';
    }

    selectedSuggestionData = null;

    // Reset input fields
    document.getElementById('restEmployeeName').value = '';
    document.getElementById('restService').value = '';
    document.getElementById('restArticle').value = '';
    document.getElementById('restNotes').value = '';

    // If an item ID is selected from a record row
    if (selectedId !== null) {
        const idStr = String(selectedId);
        let foundItem = null;

        // Try looking in distributionItems
        const loan = (typeof distributionItems !== 'undefined' ? distributionItems : (window.distributionItems || [])).find(l => String(l.id) === idStr);
        if (loan && loan.type !== 'Fin de Contrat') {
            foundItem = {
                type: 'loan',
                id: loan.id,
                employeeName: loan.employeeName || '',
                service: loan.service || '',
                article: loan.article || '',
                date: loan.date || '',
                notes: loan.notes || ''
            };
        }

        // Try devices
        if (!foundItem) {
            const d = (typeof devices !== 'undefined' ? devices : (window.devices || [])).find(item => String(item.id) === idStr);
            if (d) {
                foundItem = {
                    type: 'device',
                    id: d.id,
                    employeeName: d.user || '',
                    service: d.service || d.dept || '',
                    article: `${d.type} ${d.model}` + (d.sn ? ` [S/N: ${d.sn}]` : ''),
                    date: d.date || '',
                    notes: d.notes || ''
                };
            }
        }

        // Try mobiles
        if (!foundItem) {
            const m = (typeof mobileDevices !== 'undefined' ? mobileDevices : (window.mobileDevices || [])).find(item => String(item.id) === idStr);
            if (m) {
                foundItem = {
                    type: 'mobile',
                    id: m.id,
                    employeeName: m.assignee || '',
                    service: m.service || '',
                    article: `${m.type} ${m.marque} ${m.model}` + (m.imei ? ` [IMEI: ${m.imei}]` : ''),
                    date: m.date || '',
                    notes: m.notes || ''
                };
            }
        }

        if (foundItem) {
            selectRestitutionSuggestion(foundItem);
        }
    }

    // Prefill date input to today
    document.getElementById('restDate').value = new Date().toISOString().substring(0, 10);

    // Prefill reception technician from localStorage or defaults
    const localUser = JSON.parse(localStorage.getItem('laboCurrentUserV3'));
    document.getElementById('restTech').value = localUser ? (localUser.displayName || localUser.email.split('@')[0]) : 'Ali S.';

    // Reset equipment state select to standard value
    document.getElementById('restEquipmentState').value = "Sain et sauf, conforme à l'état initial";

    showView('restitutionFormView');
}

function showRestitutionSearchSuggestions(query) {
    const listContainer = document.getElementById('restSuggestionsList');
    if (!listContainer) return;

    query = query.toLowerCase().trim();
    if (!query) {
        listContainer.innerHTML = '';
        listContainer.style.display = 'none';
        return;
    }

    const suggestions = [];

    // Helper for matching query in module names
    const isDistModuleMatch = query.length >= 3 && (
        "distribution & prêt de matériel".includes(query) ||
        "distribution & prêt".includes(query) ||
        "distribution".includes(query) ||
        "prêt".includes(query) ||
        "matériel".includes(query)
    );

    const isInventaireModuleMatch = query.length >= 3 && (
        "inventaire".includes(query) ||
        "pc / écran".includes(query) ||
        "pc".includes(query) ||
        "écran".includes(query)
    );

    const isMobileModuleMatch = query.length >= 3 && (
        "téléphones & pda".includes(query) ||
        "téléphones".includes(query) ||
        "pda".includes(query) ||
        "mobile".includes(query)
    );

    // 1. Check active loans & distributions in distributionItems
    (typeof distributionItems !== 'undefined' ? distributionItems : (window.distributionItems || [])).forEach(loan => {
        if (loan.type !== 'Fin de Contrat' && loan.employeeName) {
            const employeeName = loan.employeeName || '';
            const article = loan.article || '';
            const typeLower = (loan.type || '').toLowerCase();
            if (
                employeeName.toLowerCase().includes(query) ||
                article.toLowerCase().includes(query) ||
                typeLower.includes(query) ||
                isDistModuleMatch
            ) {
                suggestions.push({
                    type: 'loan',
                    id: loan.id,
                    employeeName: employeeName,
                    service: loan.service || '',
                    article: article,
                    date: loan.date || '',
                    notes: loan.notes || '',
                    badgeText: 'Distribution & Prêt',
                    badgeBg: loan.type === 'Prêt' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                    badgeColor: loan.type === 'Prêt' ? '#f59e0b' : '#3b82f6'
                });
            }
        }
    });

    // 2. Check devices (PCs/Screens) in devices
    (typeof devices !== 'undefined' ? devices : (window.devices || [])).forEach(d => {
        if (d.user && d.user !== 'Non assigné') {
            const userName = d.user || '';
            const designation = `${d.type} ${d.model}` + (d.sn ? ` [S/N: ${d.sn}]` : '');
            if (
                userName.toLowerCase().includes(query) ||
                (d.model || '').toLowerCase().includes(query) ||
                (d.type || '').toLowerCase().includes(query) ||
                (d.sn || '').toLowerCase().includes(query) ||
                isInventaireModuleMatch
            ) {
                suggestions.push({
                    type: 'device',
                    id: d.id,
                    employeeName: userName,
                    service: d.service || d.dept || '',
                    article: designation,
                    date: d.date || '',
                    notes: d.notes || '',
                    badgeText: 'Inventaire',
                    badgeBg: 'rgba(59, 130, 246, 0.12)',
                    badgeColor: '#3b82f6'
                });
            }
        }
    });

    // 3. Check mobiles in mobileDevices
    (typeof mobileDevices !== 'undefined' ? mobileDevices : (window.mobileDevices || [])).forEach(m => {
        if (m.assignee) {
            const assignee = m.assignee || '';
            const designation = `${m.type} ${m.marque} ${m.model}` + (m.imei ? ` [IMEI: ${m.imei}]` : '');
            if (
                assignee.toLowerCase().includes(query) ||
                (m.marque || '').toLowerCase().includes(query) ||
                (m.model || '').toLowerCase().includes(query) ||
                (m.type || '').toLowerCase().includes(query) ||
                (m.imei || '').toLowerCase().includes(query) ||
                isMobileModuleMatch
            ) {
                suggestions.push({
                    type: 'mobile',
                    id: m.id,
                    employeeName: assignee,
                    service: m.service || '',
                    article: designation,
                    date: m.date || '',
                    notes: m.notes || '',
                    badgeText: 'Téléphones & PDA',
                    badgeBg: 'rgba(16, 185, 129, 0.12)',
                    badgeColor: '#10b981'
                });
            }
        }
    });

    // Cap at 10 items
    const matched = suggestions.slice(0, 10);

    if (matched.length === 0) {
        listContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Aucun matériel ou bénéficiaire actif trouvé</div>';
        listContainer.style.display = 'block';
        return;
    }

    listContainer.innerHTML = '';
    matched.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.onclick = function() {
            selectRestitutionSuggestion(item);
        };

        div.innerHTML = `
            <div class="suggestion-info">
                <span class="suggestion-name">${escapeHTML(item.employeeName)}</span>
                <span class="suggestion-article">${escapeHTML(item.article)} (${escapeHTML(item.service)})</span>
            </div>
            <span class="suggestion-badge" style="background: ${item.badgeBg}; color: ${item.badgeColor}; border: 1px solid ${item.badgeBg.replace('0.12', '0.3')};">${item.badgeText}</span>
        `;
        listContainer.appendChild(div);
    });

    listContainer.style.display = 'block';
}

function selectRestitutionSuggestion(item) {
    document.getElementById('restSearchInput').value = `${item.employeeName} - ${item.article}`;
    document.getElementById('restEmployeeName').value = item.employeeName;
    document.getElementById('restService').value = item.service;
    document.getElementById('restArticle').value = item.article;
    document.getElementById('restNotes').value = item.notes || '';
    
    selectedSuggestionData = item;

    // Hide suggestions
    const listContainer = document.getElementById('restSuggestionsList');
    if (listContainer) {
        listContainer.innerHTML = '';
        listContainer.style.display = 'none';
    }
}

// Close suggestion list when clicking outside
document.addEventListener('click', function(e) {
    const listContainer = document.getElementById('restSuggestionsList');
    const searchInput = document.getElementById('restSearchInput');
    if (listContainer && searchInput && e.target !== searchInput && !listContainer.contains(e.target)) {
        listContainer.style.display = 'none';
    }
});

function closeRestitutionForm() {
    const targetView = window.lastActiveViewBeforeRestitution || 'dashboardView';
    showView(targetView);
}

let selectedSuggestionData = null;

function saveRestitutionAndPrint() {
    const restEmployeeName = document.getElementById('restEmployeeName').value.trim();
    const restService = document.getElementById('restService').value.trim();
    const restArticle = document.getElementById('restArticle').value.trim();
    const returnedDate = document.getElementById('restDate').value;
    const restState = document.getElementById('restEquipmentState').value;
    const restNotes = document.getElementById('restNotes').value.trim();
    const restTech = document.getElementById('restTech').value.trim();

    if (!restEmployeeName) {
        showToast("⚠️ Le nom de l'employé est obligatoire !", "red");
        return;
    }
    if (!restService) {
        showToast("⚠️ Le service est obligatoire !", "red");
        return;
    }
    if (!restArticle) {
        showToast("⚠️ La désignation du matériel est obligatoire !", "red");
        return;
    }
    if (!returnedDate) {
        showToast("⚠️ La date de restitution est obligatoire !", "red");
        return;
    }
    if (!restTech) {
        showToast("⚠️ Le nom du technicien réceptionnaire est obligatoire !", "red");
        return;
    }

    if (!auth.currentUser) {
        showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
        return;
    }

    // Determine original loan/allocation date if available
    let originalDate = '';
    if (selectedSuggestionData) {
        const type = selectedSuggestionData.type;
        const id = selectedSuggestionData.id;
        if (type === 'loan') {
            const loan = (typeof distributionItems !== 'undefined' ? distributionItems : (window.distributionItems || [])).find(l => String(l.id) === String(id));
            if (loan) originalDate = loan.date;
        } else if (type === 'device') {
            const d = (typeof devices !== 'undefined' ? devices : (window.devices || [])).find(item => String(item.id) === String(id));
            if (d && d.date && d.date !== '---') originalDate = d.date;
        } else if (type === 'mobile') {
            const m = (typeof mobileDevices !== 'undefined' ? mobileDevices : (window.mobileDevices || [])).find(item => String(item.id) === String(id));
            if (m) originalDate = m.date;
        }
    }

    // Generate a unique ID for the new Fin de Contrat document
    const newDocId = String(Date.now());
    const newDistData = {
        id: newDocId,
        employeeName: restEmployeeName,
        service: restService,
        article: restArticle,
        qty: 1,
        type: 'Fin de Contrat',
        date: originalDate || returnedDate, // Use original assignment date, fallback to returnedDate
        returnedDate: returnedDate,
        restState: restState,
        restTech: restTech,
        restNotes: restNotes,
        status: 'Terminé',
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Save ONLY the new document to Firestore. Do NOT touch the original records.
    db.collection("itDistributions").doc(newDocId).set(newDistData)
        .then(() => {
            logActivity('DISTRIBUTION', 'FIN_CONTRAT', `Fin de contrat: ${restArticle} pour ${restEmployeeName}`);
            showToast('✅ Fin de contrat enregistrée avec succès !', 'green');
            closeRestitutionForm();
            printRestitutionPDF(newDocId, newDistData);
        })
        .catch(err => {
            console.error("Firestore save Fin de Contrat error:", err);
            showToast("❌ Échec de l'enregistrement du contrat", "red");
        });
}

function printRestitutionPDF(selectedValue, fallbackData = null) {
    if (!selectedValue) return;
    
    let type = '';
    let id = '';
    
    if (typeof selectedValue === 'string' && selectedValue.includes('_')) {
        const parts = selectedValue.split('_');
        type = parts[0];
        id = parts[1];
    } else {
        id = String(selectedValue);
        type = 'dist';
    }

    let employeeName = 'N/A';
    let service = 'N/A';
    let article = 'N/A';
    let qty = 1;
    let initialDate = 'N/A';
    let returnedDate = new Date().toLocaleDateString('fr-FR');
    let restState = "Sain et sauf, conforme à l'état initial";
    let restTech = "Responsable IT";
    let docRefPrefix = 'RET-CONTRAT';
    let item = null;

    if (type === 'dist') {
        item = (typeof distributionItems !== 'undefined' ? distributionItems : (window.distributionItems || [])).find(d => String(d.id) === String(id));
        if (!item && fallbackData && String(fallbackData.id) === String(id)) {
            item = fallbackData;
        }
        if (item) {
            employeeName = item.employeeName || 'N/A';
            service = item.service || 'N/A';
            article = item.article || 'N/A';
            qty = item.qty || 1;
            initialDate = item.date ? (item.date.includes('-') ? new Date(item.date).toLocaleDateString('fr-FR') : item.date) : 'N/A';
            returnedDate = item.returnedDate ? (item.returnedDate.includes('-') ? new Date(item.returnedDate).toLocaleDateString('fr-FR') : item.returnedDate) : new Date().toLocaleDateString('fr-FR');
            restState = item.restState || restState;
            restTech = item.restTech || restTech;
            docRefPrefix = 'RET-CONTRAT';
        }
    } else if (type === 'device') {
        item = (typeof devices !== 'undefined' ? devices : (window.devices || [])).find(d => String(d.id) === String(id));
        if (item) {
            employeeName = item.restUser || item.user || 'N/A';
            service = item.restService || item.service || 'N/A';
            article = `${item.type} ${item.model}` + (item.sn ? ` [S/N: ${item.sn}]` : '');
            qty = 1;
            initialDate = item.date ? (item.date !== '---' ? new Date(item.date).toLocaleDateString('fr-FR') : 'Non définie') : 'N/A';
            returnedDate = item.returnedDate ? new Date(item.returnedDate).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
            restState = item.restState || restState;
            restTech = item.restTech || restTech;
            docRefPrefix = 'RET-PC';
        }
    } else if (type === 'mobile') {
        item = (typeof mobileDevices !== 'undefined' ? mobileDevices : (window.mobileDevices || [])).find(m => String(m.id) === String(id));
        if (item) {
            employeeName = item.restUser || item.assignee || 'N/A';
            service = item.restService || item.service || 'N/A';
            article = `${item.type} ${item.marque || ''} ${item.model}` + (item.imei ? ` [IMEI: ${item.imei}]` : '');
            qty = 1;
            initialDate = item.date ? new Date(item.date).toLocaleDateString('fr-FR') : 'N/A';
            returnedDate = item.returnedDate ? new Date(item.returnedDate).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
            restState = item.restState || restState;
            restTech = item.restTech || restTech;
            docRefPrefix = 'RET-MOB';
        }
    }

    if (!item) return;

    const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const logoUrl = basePath + 'assets/logo-pdf.png';
    const printWindow = window.open('', '_blank', 'width=900,height=1000');

    const rawId = item ? (item.id || '0') : '0';
    const refCode = `${docRefPrefix}-${rawId.toString().padStart(4, '0')}-${new Date().getFullYear()}`;

    const content = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Protocole de Restitution - ${employeeName}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background-color: #ffffff; line-height: 1.4; padding: 0; font-size: 13px; }
                    .document-wrapper { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; background: #ffffff; position: relative; display: flex; flex-direction: column; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); color: #ffffff; padding: 25px 35px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; }
                    .header::after { content: ''; position: absolute; top: 0; right: 0; width: 160px; height: 100%; background: linear-gradient(135deg, #ef4444 0%, #fca5a5 100%); transform: skewX(-25deg) translateX(60px); z-index: 1; }
                    .header-left { display: flex; align-items: center; gap: 20px; z-index: 2; }
                    .logo-img { height: 55px; max-width: 170px; object-fit: contain; background: rgba(255, 255, 255, 0.08); padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15); }
                    .logo-title { display: flex; flex-direction: column; gap: 3px; }
                    .sub-hdr { font-size: 9px; font-weight: 800; color: #fca5a5; letter-spacing: 1.8px; text-transform: uppercase; }
                    .main-hdr { font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 1.5px; margin: 0; line-height: 1.1; }
                    .sub-hdr-green { font-size: 11px; font-weight: 700; color: #fca5a5; letter-spacing: 1px; text-transform: uppercase; }
                    .metadata-bar { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px 35px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #475569; }
                    .status-badge-pdf { display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); background-color: #fee2e2 !important; color: #991b1b !important; border: 1.5px solid #fca5a5; }
                    .status-dot-pdf { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background-color: #ef4444 !important; }
                    .restitution-banner { text-align: center; padding: 10px; font-size: 13px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border-bottom: 2px solid #fca5a5; background: #fee2e2; color: #991b1b; }
                    .content { padding: 25px 35px; flex-grow: 1; }
                    .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                    .info-card { border: 2px solid #cbd5e1; border-radius: 12px; padding: 18px 22px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02); }
                    .card-employee { background: #fef2f2 !important; border-left: 7px solid #b91c1c; }
                    .card-material { background: #eff6ff !important; border-left: 7px solid #3b82f6; }
                    .card-title { font-size: 12px; font-weight: 900; letter-spacing: 1.2px; margin-bottom: 14px; text-transform: uppercase; padding-bottom: 5px; border-bottom: 2px dashed #cbd5e1; }
                    .card-employee .card-title { color: #b91c1c; }
                    .card-material .card-title { color: #3b82f6; }
                    .field-group { margin-bottom: 10px; }
                    .field-label { font-size: 10px; font-weight: 850; text-transform: uppercase; color: #475569; letter-spacing: 1px; margin-bottom: 3px; }
                    .field-value { font-size: 13px; font-weight: 800; color: #0f172a; }
                    .verification-section { margin-bottom: 20px; }
                    .state-box { background: #fef2f2 !important; border: 2px solid #fee2e2; border-left: 7px solid #ef4444; border-radius: 10px; padding: 15px 20px; }
                    .state-header { font-size: 11px; font-weight: 900; color: #991b1b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 5px; }
                    .state-body { font-size: 14px; font-weight: 800; color: #7f1d1d; }
                    .discharge-clause { background: #fef2f2 !important; border: 2px solid #fee2e2; border-left: 7px solid #ef4444; border-radius: 10px; padding: 18px 22px; margin-bottom: 20px; }
                    .discharge-title { font-weight: 900; font-size: 12px; color: #991b1b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1.5px solid #fca5a5; padding-bottom: 4px; }
                    .discharge-text { font-size: 11.5px; font-weight: 600; color: #0f172a; text-align: justify; line-height: 1.5; }
                    .discharge-text p { margin-bottom: 8px; }
                    .discharge-text p:last-child { margin-bottom: 0; }
                    .signatures-row { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-top: 25px; }
                    .signature-block { background: #f8fafc; border: 2px solid #94a3b8; border-radius: 12px; height: 140px; padding: 15px 18px; display: flex; flex-direction: column; justify-content: space-between; }
                    .signature-block-title { font-size: 11.5px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; text-align: center; color: #475569; }
                    .signature-block-sub { font-size: 10.5px; font-weight: 600; color: #94a3b8; text-align: center; margin-bottom: 5px; }
                    .footer { background: #7f1d1d; color: #ffffff; text-align: center; padding: 10px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-top: auto; border-radius: 0 0 8px 8px; }
                    @media print { body { background-color: #ffffff; padding: 0; } .document-wrapper { border: none; max-width: 100%; width: 100%; } button { display: none; } }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    <div class="header">
                        <div class="header-left">
                            <img src="${logoUrl}" onerror="this.onerror=null; this.src='https://placehold.co/180x60/7f1d1d/ffffff?text=LABO-NEDJMA';" class="logo-img">
                            <div class="logo-title">
                                <span class="sub-hdr">PROCÉDURE INTERNE</span>
                                <h1 class="main-hdr">DÉCHARGE DE RESPONSABILITÉ</h1>
                                <span class="sub-hdr-green">CLÔTURE DU CONTRAT D'ACCÈS AU MATÉRIEL</span>
                            </div>
                        </div>
                    </div>
                    <div class="metadata-bar">
                        <div class="meta-item">DATE D'ÉMISSION : ${new Date().toLocaleDateString('fr-FR')}</div>
                        <div class="meta-item">
                            <span class="status-badge-pdf">
                                <span class="status-dot-pdf"></span>
                                CLÔTURÉ / RENDU
                            </span>
                        </div>
                        <div class="meta-item">RÉF : ${refCode}</div>
                    </div>
                    <div class="restitution-banner">⬤ MATÉRIEL RENDU ET VÉRIFIÉ LE ${returnedDate}</div>
                    <div class="content">
                        <div class="cards-grid">
                            <div class="info-card card-employee">
                                <h2 class="card-title">BÉNÉFICIAIRE</h2>
                                <div class="field-group"><div class="field-label">NOM & PRÉNOM</div><div class="field-value">${employeeName}</div></div>
                                <div class="field-group"><div class="field-label">SERVICE</div><div class="field-value">${service}</div></div>
                                <div class="field-group"><div class="field-label">DATE D'ATTRIBUTION</div><div class="field-value">${initialDate}</div></div>
                            </div>
                            <div class="info-card card-material">
                                <h2 class="card-title">MATÉRIEL DÉCHARGÉ</h2>
                                <div class="field-group"><div class="field-label">DÉSIGNATION / ARTICLE</div><div class="field-value" style="color: #1e40af;">${article}</div></div>
                                <div class="field-group"><div class="field-label">QUANTITÉ RENDUE</div><div class="field-value">${qty} unité(s)</div></div>
                                <div class="field-group"><div class="field-label">STATUT</div><div class="field-value" style="color: #dc2626;">RENDU & TERMINÉ</div></div>
                            </div>
                        </div>

                        <!-- Verification details -->
                        <div class="verification-section">
                            <div class="state-box">
                                <div class="state-header">État de conformité constaté par le Service IT</div>
                                <div class="state-body">⬤ ${restState}</div>
                            </div>
                        </div>

                        <!-- Discharge / Release Clause -->
                        <div class="discharge-clause">
                            <div class="discharge-title">Protocole de Libération de Responsabilité</div>
                            <div class="discharge-text">
                                <p>Le présent protocole atteste officiellement que l'emprunteur désigné ci-dessus a restitué au Service IT de LABO NEDJMA le matériel informatique référencé.</p>
                                <p>Après examen attentif de l'état de l'équipement par le technicien IT réceptionnaire <strong>${restTech}</strong>, le matériel a été déclaré conforme aux exigences d'utilisation. Le contrat de prêt associé est résilié de plein droit.</p>
                                <p>En conséquence, l'emprunteur est dégagé de toute responsabilité de garde, de perte ou de détérioration de ce matériel spécifique à compter de la date de signature de ce protocole.</p>
                            </div>
                        </div>

                        <!-- Signatures -->
                        <div class="signatures-row">
                            <div class="signature-block">
                                <div class="signature-block-title">SIGNATURE DE L'EMPLOYÉ</div>
                                <div class="signature-block-sub">Précédée de la mention manuscrite "Rendu ce jour"</div>
                            </div>
                            <div class="signature-block">
                                <div class="signature-block-title">CACHET & VISA SERVICE IT</div>
                                <div class="signature-block-sub">Visa du Technicien Réceptionnaire</div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="footer">
                        LABO-IT CONTROL • PROTOCOLE DE RESTITUTION IT • LABO-NEDJMA
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

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
}

window.openRestitutionForm = openRestitutionForm;
window.closeRestitutionForm = closeRestitutionForm;
window.showRestitutionSearchSuggestions = showRestitutionSearchSuggestions;
window.selectRestitutionSuggestion = selectRestitutionSuggestion;
window.saveRestitutionAndPrint = saveRestitutionAndPrint;
window.printRestitutionPDF = printRestitutionPDF;

function showRestitutionHistory() {
    showView('restitutionHistoryView');
    renderRestitutionHistoryTable();
}

function closeRestitutionHistory() {
    showView('restitutionFormView');
}

function renderRestitutionHistoryTable(query = '') {
    const tbody = document.getElementById('restitutionHistoryTableBody');
    if (!tbody) return;

    const searchTerm = query.toLowerCase().trim();
    
    // distributionItems is script-level array or window
    const list = (typeof distributionItems !== 'undefined' ? distributionItems : (window.distributionItems || []));
    
    // Filter by type: 'Fin de Contrat'
    let filtered = list.filter(item => item.type === 'Fin de Contrat');

    if (searchTerm) {
        filtered = filtered.filter(item => 
            (item.employeeName || '').toLowerCase().includes(searchTerm) ||
            (item.service || '').toLowerCase().includes(searchTerm) ||
            (item.article || '').toLowerCase().includes(searchTerm) ||
            (item.restTech || '').toLowerCase().includes(searchTerm)
        );
    }

    // Sort by ID descending (most recent first)
    const sorted = [...filtered].sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idB - idA;
    });

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr>
            <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <i class="fas fa-file-invoice" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
                ${escapeHTML(searchTerm ? 'Aucun résultat trouvé.' : 'Aucun contrat clôturé enregistré.')}
            </td>
        </tr>`;
        return;
    }

    tbody.innerHTML = '';
    sorted.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'clickable-record-row';
        tr.style.cursor = 'pointer';
        tr.onclick = function (event) {
            if (!event.target.closest('.action-btns, .action-btn, button, select, input, textarea, a')) {
                showRecordDetail('restitution', item.id);
            }
        };

        const rawId = item.id || '0';
        const refCode = `RET-CONTRAT-${rawId.toString().padStart(4, '0')}-${new Date().getFullYear()}`;

        tr.innerHTML = `
            <td style="padding: 1rem; font-weight: 700; font-family: monospace; color: #dc2626;">${escapeHTML(refCode)}</td>
            <td style="padding: 1rem; font-weight: 600;">${escapeHTML(item.employeeName)}</td>
            <td style="padding: 1rem; color: var(--text-secondary);">${escapeHTML(item.service)}</td>
            <td style="padding: 1rem; font-weight: 600; color: #1e3a8a;">${escapeHTML(item.article)}</td>
            <td style="padding: 1rem; font-weight: 700;">${escapeHTML(item.returnedDate || item.date || '---')}</td>
            <td style="padding: 1rem;"><span style="background: rgba(239, 68, 68, 0.08); color: #dc2626; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; border: 1px solid rgba(239, 68, 68, 0.2);">${escapeHTML(item.restState || 'Sain et sauf')}</span></td>
            <td style="padding: 1rem; font-weight: 600; color: var(--text-muted);">${escapeHTML(item.restTech || 'N/A')}</td>
            <td style="padding: 1rem; text-align: center;">
                <div class="action-btns" style="display: flex; justify-content: center; gap: 0.5rem;">
                    <button class="action-btn" onclick="printRestitutionPDF('${escapeHTML(item.id)}')" title="Imprimer le reçu (PDF)" style="color: #dc2626; background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 4px; transition: transform 0.2s;">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="action-btn" onclick="deleteRestitution('${escapeHTML(item.id)}')" title="Supprimer (Fin de contrat)" style="color: #ef4444; background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 4px; transition: transform 0.2s;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterRestitutionHistoryTable(query) {
    renderRestitutionHistoryTable(query);
}

function deleteRestitution(id) {
    const item = (typeof distributionItems !== 'undefined' ? distributionItems : (window.distributionItems || [])).find(d => String(d.id) === String(id));
    if (!item) return;

    showCustomConfirm(
        "Supprimer le Contrat Clôturé",
        `Voulez-vous vraiment supprimer définitivement le registre de fin de contrat pour "${item.article}" à ${item.employeeName} ? Cette action est irréversible.`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }
            db.collection("itDistributions").doc(String(id)).delete()
                .then(() => {
                    logActivity('DISTRIBUTION', 'SUPPRESSION_FIN_CONTRAT', `Fin de contrat supprimée: ${item.article} pour ${item.employeeName}`);
                    showToast("🗑️ Contrat clôturé supprimé avec succès !", "green");
                    if (window.activeRecordDetail && String(window.activeRecordDetail.id) === String(id)) {
                        showView('restitutionHistoryView');
                    }
                })
                .catch(err => {
                    console.error("Firestore delete Fin de Contrat error:", err);
                    showToast("❌ Échec de la suppression sur Firebase", "red");
                });
        }
    );
}

window.showRestitutionHistory = showRestitutionHistory;
window.closeRestitutionHistory = closeRestitutionHistory;
window.renderRestitutionHistoryTable = renderRestitutionHistoryTable;
window.filterRestitutionHistoryTable = filterRestitutionHistoryTable;
window.deleteRestitution = deleteRestitution;

// Ripple effect helper for category cards using requestAnimationFrame
document.addEventListener('click', function (e) {
    const target = e.target.closest('.category-card');
    if (!target) return;
    
    const circle = document.createElement('span');
    const diameter = Math.max(target.clientWidth, target.clientHeight);
    const radius = diameter / 2;
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - target.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${e.clientY - target.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple-span');
    
    const ripple = target.getElementsByClassName('ripple-span')[0];
    if (ripple) {
        ripple.remove();
    }
    
    target.appendChild(circle);
    
    // High-performance cleanup using requestAnimationFrame
    let start = null;
    function cleanup(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        if (progress < 600) {
            requestAnimationFrame(cleanup);
        } else {
            circle.remove();
        }
    }
    requestAnimationFrame(cleanup);
});

// ============ ESPACE COLLABORATEUR & CODES PIN ============

function switchLoginTab(tab) {
    const adminTab = document.getElementById('loginTab-admin');
    const userTab = document.getElementById('loginTab-user');
    const adminContent = document.getElementById('loginContent-admin');
    const userContent = document.getElementById('loginContent-user');
    const loginBox = document.querySelector('.login-box');

    if (tab === 'admin') {
        adminTab.classList.add('active');
        userTab.classList.remove('active');
        adminContent.style.display = 'block';
        userContent.style.display = 'none';
        if (loginBox) {
            loginBox.classList.remove('collaborateur-active');
            loginBox.style.maxWidth = '500px';
        }
        
        if (isAdminLockedOut()) {
            startAdminLockoutCountdown();
        } else {
            stopAdminLockoutCountdown();
        }
    } else {
        userTab.classList.add('active');
        adminTab.classList.remove('active');
        adminContent.style.display = 'none';
        userContent.style.display = 'block';
        if (loginBox) {
            loginBox.classList.remove('collaborateur-active');
            loginBox.style.maxWidth = '500px';
        }
        populateCollaboratorsDropdown();
        
        if (isPinLockedOut()) {
            startLockoutCountdown();
        } else {
            stopLockoutCountdown();
        }
    }
}

function populateCollaboratorsDropdown() {
    const select = document.getElementById('userSelect');
    if (!select) return;

    if (auth.currentUser) {
        fetchPinsAndPopulate(select);
    } else {
        auth.signInWithEmailAndPassword('collaborateur@nedjma.dz', 'CollaborateurPIN2026')
            .then(() => {
                fetchPinsAndPopulate(select);
            })
            .catch(err => {
                console.error("Error signing in as shared collaborator for dropdown:", err);
                select.innerHTML = '<option value="" disabled selected>Erreur de connexion...</option>';
                showToast("⚠️ Le compte partagé 'collaborateur@nedjma.dz' n'a pas pu être authentifié.", "warning");
            });
    }
}

function fetchPinsAndPopulate(select) {
    db.collection("userPins").where("status", "==", "active").get()
        .then((snapshot) => {
            select.innerHTML = '<option value="" disabled selected>Choisir un collaborateur...</option>';
            if (snapshot.empty) {
                const opt = document.createElement('option');
                opt.value = "";
                opt.textContent = "Aucun collaborateur actif";
                opt.disabled = true;
                select.appendChild(opt);
                return;
            }
            snapshot.forEach(doc => {
                const data = doc.data();
                const opt = document.createElement('option');
                opt.value = data.username;
                opt.textContent = data.username;
                select.appendChild(opt);
            });
        })
        .catch(err => {
            console.error("Error fetching PINs for dropdown:", err);
            select.innerHTML = '<option value="" disabled selected>Erreur de chargement...</option>';
        });
}

let currentPinInput = '';
function pressKey(key) {
    const input = document.getElementById('userPinInput');
    if (!input) return;

    if (key === 'clear') {
        currentPinInput = '';
    } else if (key === 'backspace') {
        currentPinInput = currentPinInput.slice(0, -1);
    } else {
        if (currentPinInput.length < 8) {
            currentPinInput += key;
        }
    }
    input.value = currentPinInput;
}

function focusPinInput() {
    currentPinInput = '';
    const input = document.getElementById('userPinInput');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function handlePinLoginSubmit() {
    if (isPinLockedOut()) {
        const remaining = getPinLockoutRemainingTime();
        showToast(`⚠️ Sécurité: Trop de tentatives. Réessayez dans ${remaining}`, "warning");
        return;
    }

    const pin = document.getElementById('userPinInput').value;

    if (!pin) {
        showToast("⚠️ Veuillez saisir votre code PIN", "warning");
        return;
    }

    showToast("🔄 Connexion en cours...", "blue");

    auth.signInWithEmailAndPassword('collaborateur@nedjma.dz', 'CollaborateurPIN2026')
        .then(() => {
            return db.collection("userPins")
                .where("pin", "==", pin)
                .get();
        })
        .then((snapshot) => {
            if (snapshot.empty) {
                registerFailedPinAttempt();
                auth.signOut();
                return;
            }

            const doc = snapshot.docs[0];
            const data = doc.data();

            if (data.status !== 'active') {
                showToast("❌ Ce compte est bloqué. Contactez l'administrateur.", "red");
                auth.signOut();
                return;
            }

            resetFailedPinAttempts();

            const session = {
                role: 'user',
                username: data.username,
                pin: data.pin
            };
            localStorage.setItem('laboUserSession', JSON.stringify(session));
            localStorage.removeItem('laboCurrentUserV3');

            showToast(`🔓 Bienvenue ${data.username} !`, "green");
            handleAuthRedirect();
        })
        .catch(err => {
            console.error("PIN login error:", err);
            showToast("❌ Erreur d'authentification.", "red");
            auth.signOut();
        });
}

let lockoutTimerInterval = null;

function getLockoutState() {
    try {
        const state = localStorage.getItem('pinLockoutState');
        if (state) {
            return JSON.parse(state);
        }
    } catch (e) {
        console.error("Error reading lockout state:", e);
    }
    return { failedAttempts: 0, lockoutCount: 0, lockedUntil: null };
}

function saveLockoutState(state) {
    try {
        localStorage.setItem('pinLockoutState', JSON.stringify(state));
    } catch (e) {
        console.error("Error saving lockout state:", e);
    }
}

function isPinLockedOut() {
    const state = getLockoutState();
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
        return true;
    }
    if (state.lockedUntil && Date.now() >= state.lockedUntil) {
        state.lockedUntil = null;
        state.failedAttempts = 0;
        saveLockoutState(state);
    }
    return false;
}

function getPinLockoutRemainingTime() {
    const state = getLockoutState();
    if (!state.lockedUntil) return '';
    const diff = state.lockedUntil - Date.now();
    if (diff <= 0) return '';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

function registerFailedPinAttempt() {
    const state = getLockoutState();
    state.failedAttempts += 1;
    
    if (state.failedAttempts >= 3) {
        state.lockoutCount += 1;
        let duration = 10 * 60 * 1000; // 10 minutes (1st lockout)
        if (state.lockoutCount === 2) {
            duration = 20 * 60 * 1000; // 20 minutes (2nd lockout)
        } else if (state.lockoutCount >= 3) {
            duration = 120 * 60 * 1000; // 2 hours (3rd lockout and onwards)
        }
        
        state.lockedUntil = Date.now() + duration;
        saveLockoutState(state);
        
        const minutes = duration / 60000;
        showToast(`🛑 Sécurité: 3 tentatives incorrectes. Compte bloqué pour ${minutes >= 60 ? (minutes/60) + ' heure(s)' : minutes + ' minutes'}.`, "red");
        startLockoutCountdown();
    } else {
        saveLockoutState(state);
        showToast(`❌ Code PIN incorrect (${state.failedAttempts}/3)`, "red");
    }
}

function resetFailedPinAttempts() {
    const state = getLockoutState();
    state.failedAttempts = 0;
    state.lockoutCount = 0;
    state.lockedUntil = null;
    saveLockoutState(state);
    stopLockoutCountdown();
}

function startLockoutCountdown() {
    const countdownDiv = document.getElementById('pinLockoutCountdown');
    const timerSpan = document.getElementById('lockoutTimer');
    const pinInput = document.getElementById('userPinInput');
    const loginBtn = document.querySelector('#loginContent-user .welcome-btn');
    
    if (!countdownDiv || !timerSpan) return;

    if (lockoutTimerInterval) clearInterval(lockoutTimerInterval);

    if (pinInput) pinInput.disabled = true;
    if (loginBtn) loginBtn.disabled = true;

    countdownDiv.style.display = 'block';
    
    lockoutTimerInterval = setInterval(() => {
        if (!isPinLockedOut()) {
            clearInterval(lockoutTimerInterval);
            countdownDiv.style.display = 'none';
            if (pinInput) {
                pinInput.disabled = false;
                pinInput.value = '';
                currentPinInput = '';
            }
            if (loginBtn) loginBtn.disabled = false;
            showToast("🔓 Période de blocage terminée. Vous pouvez réessayer.", "green");
            return;
        }
        timerSpan.textContent = getPinLockoutRemainingTime();
    }, 1000);
    
    timerSpan.textContent = getPinLockoutRemainingTime();
}

function stopLockoutCountdown() {
    if (lockoutTimerInterval) {
        clearInterval(lockoutTimerInterval);
        lockoutTimerInterval = null;
    }
    const countdownDiv = document.getElementById('pinLockoutCountdown');
    const pinInput = document.getElementById('userPinInput');
    const loginBtn = document.querySelector('#loginContent-user .welcome-btn');
    if (countdownDiv) countdownDiv.style.display = 'none';
    if (pinInput) pinInput.disabled = false;
    if (loginBtn) loginBtn.disabled = false;
}

function handlePinLogout() {
    showCustomConfirm(
        "Confirmer la Déconnexion",
        "Voulez-vous vraiment quitter l'Espace Collaborateur ?",
        function () {
            showToast("🔄 Déconnexion...", "blue");
            auth.signOut().then(() => {
                if (unsubUserRequests) { unsubUserRequests(); unsubUserRequests = null; }
                if (unsubUserPinStatus) { unsubUserPinStatus(); unsubUserPinStatus = null; }
                localStorage.removeItem('laboUserSession');
                localStorage.removeItem('laboCurrentUserV3');
                handleAuthRedirect();
                showToast("🔒 Déconnecté avec succès", "blue");
            }).catch(e => {
                console.error("Logout error:", e);
                showToast("⚠️ Erreur lors de la déconnexion", "red");
            });
        },
        null,
        'warning'
    );
}

function handleAdminLoginSubmit(e) {
    e.preventDefault();
    if (isAdminLockedOut()) {
        const remaining = getAdminLockoutRemainingTime();
        showToast(`⚠️ Sécurité: Trop de tentatives. Réessayez dans ${remaining}`, "warning");
        return;
    }

    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value;

    if (email && pass) {
        const btn = e.target.querySelector('button[type="submit"]');
        const origText = btn.innerHTML;
        btn.disabled = true;
        safeSetHTML(btn, '<i class="fas fa-spinner fa-spin"></i> Connexion...');

        showToast("🔄 Connexion Administrateur...", "blue");

        auth.signInWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                document.getElementById('adminEmail').value = '';
                document.getElementById('adminPassword').value = '';

                resetFailedAdminAttempts();
                showToast("🔓 Connexion réussie !", "green");
                
                const user = userCredential.user;
                if (user) {
                    const localUser = { email: user.email };
                    localStorage.setItem('laboCurrentUserV3', JSON.stringify(localUser));
                    localStorage.removeItem('laboUserSession');
                    handleAuthRedirect();
                }
            })
            .catch((error) => {
                console.error("Admin login error:", error);
                registerFailedAdminAttempt();
            })
            .finally(() => {
                btn.disabled = false;
                safeSetHTML(btn, origText);
            });
    }
}

let adminLockoutTimerInterval = null;

function getAdminLockoutState() {
    try {
        const state = localStorage.getItem('adminLockoutState');
        if (state) {
            return JSON.parse(state);
        }
    } catch (e) {
        console.error("Error reading admin lockout state:", e);
    }
    return { failedAttempts: 0, lockoutCount: 0, lockedUntil: null };
}

function saveAdminLockoutState(state) {
    try {
        localStorage.setItem('adminLockoutState', JSON.stringify(state));
    } catch (e) {
        console.error("Error saving admin lockout state:", e);
    }
}

function isAdminLockedOut() {
    const state = getAdminLockoutState();
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
        return true;
    }
    if (state.lockedUntil && Date.now() >= state.lockedUntil) {
        state.lockedUntil = null;
        state.failedAttempts = 0;
        saveAdminLockoutState(state);
    }
    return false;
}

function getAdminLockoutRemainingTime() {
    const state = getAdminLockoutState();
    if (!state.lockedUntil) return '';
    const diff = state.lockedUntil - Date.now();
    if (diff <= 0) return '';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

function registerFailedAdminAttempt() {
    const state = getAdminLockoutState();
    state.failedAttempts += 1;
    
    if (state.failedAttempts >= 3) {
        state.lockoutCount += 1;
        let duration = 10 * 60 * 1000; // 10 minutes (1st lockout)
        if (state.lockoutCount === 2) {
            duration = 20 * 60 * 1000; // 20 minutes (2nd lockout)
        } else if (state.lockoutCount >= 3) {
            duration = 120 * 60 * 1000; // 2 hours (3rd lockout and onwards)
        }
        
        state.lockedUntil = Date.now() + duration;
        saveAdminLockoutState(state);
        
        const minutes = duration / 60000;
        showToast(`🛑 Sécurité: 3 tentatives incorrectes. Compte admin bloqué pour ${minutes >= 60 ? (minutes/60) + ' heure(s)' : minutes + ' minutes'}.`, "red");
        startAdminLockoutCountdown();
    } else {
        saveAdminLockoutState(state);
        showToast(`❌ Identifiants incorrects (${state.failedAttempts}/3)`, "red");
    }
}

function resetFailedAdminAttempts() {
    const state = getAdminLockoutState();
    state.failedAttempts = 0;
    state.lockoutCount = 0;
    state.lockedUntil = null;
    saveAdminLockoutState(state);
    stopAdminLockoutCountdown();
}

function startAdminLockoutCountdown() {
    const countdownDiv = document.getElementById('adminLockoutCountdown');
    const timerSpan = document.getElementById('adminLockoutTimer');
    const emailInput = document.getElementById('adminEmail');
    const passInput = document.getElementById('adminPassword');
    const loginBtn = document.querySelector('#adminLoginForm button[type="submit"]');
    
    if (!countdownDiv || !timerSpan) return;

    if (adminLockoutTimerInterval) clearInterval(adminLockoutTimerInterval);

    if (emailInput) emailInput.disabled = true;
    if (passInput) passInput.disabled = true;
    if (loginBtn) loginBtn.disabled = true;

    countdownDiv.style.display = 'block';
    
    adminLockoutTimerInterval = setInterval(() => {
        if (!isAdminLockedOut()) {
            clearInterval(adminLockoutTimerInterval);
            countdownDiv.style.display = 'none';
            if (emailInput) emailInput.disabled = false;
            if (passInput) {
                passInput.disabled = false;
                passInput.value = '';
            }
            if (loginBtn) loginBtn.disabled = false;
            showToast("🔓 Période de blocage admin terminée. Vous pouvez réessayer.", "green");
            return;
        }
        timerSpan.textContent = getAdminLockoutRemainingTime();
    }, 1000);
    
    timerSpan.textContent = getAdminLockoutRemainingTime();
}

function stopAdminLockoutCountdown() {
    if (adminLockoutTimerInterval) {
        clearInterval(adminLockoutTimerInterval);
        adminLockoutTimerInterval = null;
    }
    const countdownDiv = document.getElementById('adminLockoutCountdown');
    const emailInput = document.getElementById('adminEmail');
    const passInput = document.getElementById('adminPassword');
    const loginBtn = document.querySelector('#adminLoginForm button[type="submit"]');
    if (countdownDiv) countdownDiv.style.display = 'none';
    if (emailInput) emailInput.disabled = false;
    if (passInput) passInput.disabled = false;
    if (loginBtn) loginBtn.disabled = false;
}

function handleAuthRedirect() {
    const user = auth.currentUser;
    const localSession = JSON.parse(localStorage.getItem('laboUserSession'));

    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    const loginScreen = document.getElementById('loginScreen');

    if (user) {
        if (user.email && user.email !== 'collaborateur@nedjma.dz') {
            // Admin
            if (loginScreen) {
                loginScreen.style.display = 'none';
                loginScreen.classList.add('hidden');
            }
            document.querySelector('.container').style.display = 'block';
            document.getElementById('userPortalContainer').style.display = 'none';
            updateAuthUI();
            startFirestoreSync();
        } else if (user.email === 'collaborateur@nedjma.dz' && localSession && localSession.role === 'user') {
            // Collaborateur
            if (loginScreen) {
                loginScreen.style.display = 'none';
                loginScreen.classList.add('hidden');
            }
            document.querySelector('.container').style.display = 'none';
            document.getElementById('userPortalContainer').style.display = 'block';
            document.getElementById('userPortalName').textContent = localSession.username;
            syncUserPortalRequests();
        } else {
            // Collaborateur on login screen or loading list
            if (loginScreen) {
                loginScreen.style.display = 'flex';
                loginScreen.classList.remove('hidden');
            }
            document.querySelector('.container').style.display = 'none';
            document.getElementById('userPortalContainer').style.display = 'none';
            populateCollaboratorsDropdown();
        }
    } else {
        if (loginScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.remove('hidden');
        }
        document.querySelector('.container').style.display = 'none';
        document.getElementById('userPortalContainer').style.display = 'none';
        populateCollaboratorsDropdown();
    }
}

function forcePinLogout(message) {
    if (unsubUserRequests) { unsubUserRequests(); unsubUserRequests = null; }
    if (unsubUserPinStatus) { unsubUserPinStatus(); unsubUserPinStatus = null; }
    
    showToast(message, "red");
    auth.signOut().then(() => {
        localStorage.removeItem('laboUserSession');
        localStorage.removeItem('laboCurrentUserV3');
        handleAuthRedirect();
    }).catch(e => {
        console.error("Force logout error:", e);
        localStorage.removeItem('laboUserSession');
        localStorage.removeItem('laboCurrentUserV3');
        handleAuthRedirect();
    });
}

function syncUserPortalRequests() {
    const session = JSON.parse(localStorage.getItem('laboUserSession'));
    if (!session || !session.username) return;

    if (unsubUserRequests) { unsubUserRequests(); }

    unsubUserRequests = db.collection("userRequests")
        .where("username", "==", session.username)
        .onSnapshot((snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            requests.sort((a, b) => {
                const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
                const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
                return dateB - dateA;
            });
            userRequests = requests;
            renderUserRequestsTable(requests);
            updateUserPortalStats(requests);
            updateUserNotifications();
        }, (err) => {
            console.error("Error syncing collaborator requests:", err);
            showToast("⚠️ Erreur de chargement des demandes", "red");
        });

    if (unsubUserPinStatus) { unsubUserPinStatus(); }

    unsubUserPinStatus = db.collection("userPins")
        .where("username", "==", session.username)
        .where("pin", "==", session.pin)
        .onSnapshot((snapshot) => {
            if (snapshot.empty) {
                forcePinLogout("❌ Votre code PIN a été supprimé ou modifié par l'administrateur.");
                return;
            }

            const data = snapshot.docs[0].data();
            if (data.status !== 'active') {
                forcePinLogout("❌ Ce compte/PIN a été bloqué par l'administrateur.");
            }
        }, (err) => {
            console.error("Error syncing collaborator PIN status:", err);
        });
}

function toggleUserRequestFormFields() {
    const type = document.getElementById('userRequestType').value;
    const pcFields = document.getElementById('userRequestFields-pc');
    const mobileFields = document.getElementById('userRequestFields-mobile');
    const restitFields = document.getElementById('userRequestFields-restitution');
    const pcSpecsGroup = document.getElementById('userReqPcSpecsGroup');

    if (type === 'new_pc') {
        pcFields.style.display = 'block';
        pcSpecsGroup.style.display = 'block';
        mobileFields.style.display = 'none';
        restitFields.style.display = 'none';
    } else if (type === 'decharge_pc') {
        pcFields.style.display = 'block';
        pcSpecsGroup.style.display = 'none';
        mobileFields.style.display = 'none';
        restitFields.style.display = 'none';
    } else if (type === 'fin_contrat_pc') {
        pcFields.style.display = 'block';
        pcSpecsGroup.style.display = 'none';
        mobileFields.style.display = 'none';
        restitFields.style.display = 'block';
    } else if (type === 'new_mobile') {
        pcFields.style.display = 'none';
        mobileFields.style.display = 'block';
        restitFields.style.display = 'none';
    } else if (type === 'decharge_mobile') {
        pcFields.style.display = 'none';
        mobileFields.style.display = 'block';
        restitFields.style.display = 'none';
    } else if (type === 'fin_contrat_mobile') {
        pcFields.style.display = 'none';
        mobileFields.style.display = 'block';
        restitFields.style.display = 'block';
    }
}

function submitUserRequest() {
    const session = JSON.parse(localStorage.getItem('laboUserSession'));
    if (!session || !session.username) return;

    const typeInput = document.getElementById('userRequestType');
    const type = typeInput ? typeInput.value : 'new_pc';
    const note = document.getElementById('userRequestNote').value.trim();
    
    const fullname = document.getElementById('userReqFullName').value.trim();
    const dept = document.getElementById('userReqDept').value.trim();

    if (!fullname) {
        showToast("⚠️ Nom & Prénom obligatoires !", "warning");
        return;
    }

    let details = {};

    if (type.includes('_pc')) {
        const model = document.getElementById('userReqPcModel').value.trim();
        const sn = document.getElementById('userReqPcSn').value.trim();
        
        if (!model || !sn) {
            showToast("⚠️ Modèle et S/N obligatoires !", "warning");
            return;
        }
        details.model = model;
        details.sn = sn;
        
        if (type === 'new_pc') {
            details.specs = document.getElementById('userReqPcSpecs').value.trim();
            details.accessories = document.getElementById('userReqPcAccessories').value.trim();
        }
        if (type === 'fin_contrat_pc') {
            details.restitutionNote = document.getElementById('userReqRestitDetails').value.trim();
        }
    } else if (type.includes('_mobile')) {
        const marque = document.getElementById('userReqMobileMarque').value.trim();
        const model = document.getElementById('userReqMobileModel').value.trim();
        const imei = document.getElementById('userReqMobileImei').value.trim();
        const phoneNum = document.getElementById('userReqMobileNum').value.trim();
        const societe = document.getElementById('userReqMobileSociete').value.trim();
        
        if (!marque || !model || !imei) {
            showToast("⚠️ Marque, Modèle et IMEI obligatoires !", "warning");
            return;
        }
        details.marque = marque;
        details.model = model;
        details.imei = imei;
        details.phoneNum = phoneNum;
        details.societe = societe;
        
        if (type === 'fin_contrat_mobile') {
            details.restitutionNote = document.getElementById('userReqRestitDetails').value.trim();
        }
    }

    details.note = note;

    showToast("🔄 Envoi de la demande...", "blue");

    db.collection("userRequests").add({
        username: session.username,
        fullname: fullname,
        dept: dept || 'Sans Service',
        type: type,
        details: details,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        processedAt: null,
        adminComment: ''
    }).then(() => {
        showToast("🚀 Demande envoyée avec succès !", "green");
        closeUserRequestFormView();
    }).catch(err => {
        console.error("Error submitting request:", err);
        showToast("❌ Erreur d'envoi", "red");
    });
}

window.activeCategory = null;
let selectedUserRequestId = null;

function openUserRequestCategory(type) {
    window.activeCategory = type;
    window.userRequestsCurrentPage = 1;
    window.userRequestsSearchQuery = '';
    selectedUserRequestId = null;

    const inputSearch = document.getElementById('userRequestSearchInput');
    if (inputSearch) inputSearch.value = '';

    const homeView = document.getElementById('userPortalHomeView');
    const catView = document.getElementById('userPortalCategoryView');
    
    if (homeView) homeView.style.display = 'none';
    if (catView) catView.style.display = 'block';

    const catTitle = document.getElementById('categoryViewTitle');
    const catHistTitle = document.getElementById('categoryHistoryTitle');
    const categoryIcon = document.getElementById('categoryIcon');
    const categoryViewIcon = document.getElementById('categoryViewIcon');
    
    if (catTitle) {
        let label = "Nouvelle Demande";
        let icon = "fa-edit";
        let gradient = "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)";
        switch (type) {
            case 'new_pc': 
                label = "Decharge PC"; 
                icon = "fa-laptop"; 
                gradient = "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)";
                break;
            case 'new_mobile': 
                label = "Decharge Téléphone"; 
                icon = "fa-mobile-alt"; 
                gradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
                break;
            case 'restitution': 
                label = "Restitution / Fin de Contrat"; 
                icon = "fa-rotate-left"; 
                gradient = "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)";
                break;
        }
        catTitle.textContent = label;
        if (categoryIcon) {
            categoryIcon.className = `fas ${icon}`;
        }
        if (categoryViewIcon) {
            categoryViewIcon.style.background = gradient;
        }
        if (catHistTitle) {
            catHistTitle.innerHTML = `<i class="fas fa-history"></i> Historique : ${label}`;
        }
    }
    
    closeUserRequestForm();
    renderUserRequestsTable();
}

function closeUserRequestCategory() {
    window.activeCategory = null;
    
    const homeView = document.getElementById('userPortalHomeView');
    const catView = document.getElementById('userPortalCategoryView');
    
    if (homeView) homeView.style.display = 'block';
    if (catView) catView.style.display = 'none';
    
    closeUserRequestForm();
}

function openUserRequestForm(type) {
    const card = document.getElementById('userRequestFormCard');
    const typeInput = document.getElementById('userRequestType');
    const typeGroup = document.getElementById('userReqMaterialTypeGroup');
    const materialSelect = document.getElementById('userReqMaterialType');
    
    let subType = type;
    
    if (type === 'decharge' || type === 'restitution') {
        if (typeGroup) typeGroup.style.display = 'block';
        const selectedMaterial = materialSelect ? materialSelect.value : 'pc';
        if (type === 'decharge') {
            subType = selectedMaterial === 'pc' ? 'decharge_pc' : 'decharge_mobile';
        } else {
            subType = selectedMaterial === 'pc' ? 'fin_contrat_pc' : 'fin_contrat_mobile';
        }
    } else {
        if (typeGroup) typeGroup.style.display = 'none';
    }
    
    if (typeInput) typeInput.value = subType;

    const pcFields = document.getElementById('userReqFields-pc');
    const mobileFields = document.getElementById('userReqFields-mobile');
    const restitFields = document.getElementById('userReqFields-restitution');
    
    const specsField = document.querySelector('.id-specs-field');
    const accField = document.querySelector('.id-accessoires-field');

    if (pcFields) pcFields.style.display = subType.includes('_pc') ? 'contents' : 'none';
    if (mobileFields) mobileFields.style.display = subType.includes('_mobile') ? 'contents' : 'none';
    
    if (restitFields) {
        restitFields.style.display = (subType === 'fin_contrat_pc' || subType === 'fin_contrat_mobile') ? 'contents' : 'none';
    }
    
    if (specsField) specsField.style.display = (subType === 'new_pc') ? 'block' : 'none';
    if (accField) accField.style.display = (subType === 'new_pc') ? 'block' : 'none';

    const session = JSON.parse(localStorage.getItem('laboUserSession'));
    if (session && session.username) {
        const nameField = document.getElementById('userReqFullName');
        if (nameField && !nameField.value) {
            nameField.value = session.username;
        }
    }

    const catTitle = document.getElementById('categoryViewTitle');
    const catHistTitle = document.getElementById('categoryHistoryTitle');
    if (catTitle) {
        let label = "Nouvelle Demande";
        let icon = "fa-edit";
        switch (type) {
            case 'new_pc': label = "Decharge PC"; icon = "fa-laptop"; break;
            case 'new_mobile': label = "Decharge Téléphone"; icon = "fa-mobile-alt"; break;
            case 'restitution': label = "Restitution / Fin de Contrat"; icon = "fa-rotate-left"; break;
        }
        catTitle.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
        if (catHistTitle) {
            catHistTitle.innerHTML = `<i class="fas fa-history"></i> Historique : ${label}`;
        }
    }

    if (card) {
        card.style.display = 'block';
    }
}

function closeUserRequestForm() {
    const card = document.getElementById('userRequestFormCard');
    if (card) card.style.display = 'none';

    const inputs = [
        'userReqFullName', 'userReqDept',
        'userReqPcModel', 'userReqPcSn', 'userReqPcSpecs', 'userReqPcAccessories',
        'userReqMobileMarque', 'userReqMobileModel', 'userReqMobileImei', 'userReqMobileNum', 'userReqMobileSociete',
        'userReqRestitDetails', 'userRequestNote'
    ];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function openUserRequestFormView() {
    const catView = document.getElementById('userPortalCategoryView');
    const formView = document.getElementById('userPortalFormView');
    
    if (catView) catView.style.display = 'none';
    if (formView) formView.style.display = 'block';

    if (window.activeCategory) {
        openUserRequestForm(window.activeCategory);
    }

    const formTitle = document.getElementById('formViewTitle');
    const formHeaderIcon = document.getElementById('formHeaderIcon');
    const formViewIcon = document.getElementById('formViewIcon');
    
    if (formTitle && window.activeCategory) {
        let label = "Saisir la Demande";
        let icon = "fa-edit";
        let gradient = "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)";
        switch (window.activeCategory) {
            case 'new_pc': 
                label = "Saisir la Demande : Decharge PC"; 
                icon = "fa-laptop"; 
                gradient = "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)";
                break;
            case 'new_mobile': 
                label = "Saisir la Demande : Decharge Téléphone"; 
                icon = "fa-mobile-alt"; 
                gradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
                break;
            case 'restitution': 
                label = "Saisir la Demande : Restitution / Fin de Contrat"; 
                icon = "fa-rotate-left"; 
                gradient = "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)";
                break;
        }
        formTitle.textContent = label;
        if (formHeaderIcon) {
            formHeaderIcon.className = `fas ${icon}`;
        }
        if (formViewIcon) {
            formViewIcon.style.background = gradient;
        }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeUserRequestFormView() {
    const catView = document.getElementById('userPortalCategoryView');
    const formView = document.getElementById('userPortalFormView');
    
    if (catView) catView.style.display = 'block';
    if (formView) formView.style.display = 'none';

    closeUserRequestForm();
}

function handleMaterialTypeChange() {
    if (window.activeCategory) {
        openUserRequestForm(window.activeCategory);
    }
}

window.userRequestsCurrentPage = 1;
window.userRequestsPageSize = 5;
window.userRequestsSearchQuery = '';

function renderUserRequestsTable(data) {
    const tbody = document.getElementById('userRequestsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredData = getFilteredUserRequests();
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / window.userRequestsPageSize) || 1;

    if (window.userRequestsCurrentPage > totalPages) {
        window.userRequestsCurrentPage = totalPages;
    }

    const startIndex = (window.userRequestsCurrentPage - 1) * window.userRequestsPageSize;
    const endIndex = Math.min(startIndex + window.userRequestsPageSize, totalItems);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    if (totalItems === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Aucune demande trouvée.</td></tr>';
        updateUserRequestsPaginationControls(0, 0, 0, 1);
        selectedUserRequestId = null;
        renderUserRequestDetails(null);
        return;
    }

    // Keep selected request only if it still exists in the list
    if (selectedUserRequestId) {
        const stillExists = paginatedData.some(r => r.id === selectedUserRequestId);
        if (!stillExists) {
            selectedUserRequestId = null;
        }
    }

    paginatedData.forEach(item => {
        const dateStr = item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString('fr-FR') : 'En cours') : 'En cours';
        const typeLabel = getRequestTypeLabel(item.type);
        
        let badgeClass = 'status-badge-pending';
        let statusLabel = 'En attente';
        if (item.status === 'approved') {
            badgeClass = 'status-badge-approved';
            statusLabel = 'Approuvée';
        } else if (item.status === 'rejected') {
            badgeClass = 'status-badge-rejected';
            statusLabel = 'Rejetée';
        }

        const isSelected = item.id === selectedUserRequestId;
        const tr = document.createElement('tr');
        tr.id = `user-req-row-${item.id}`;
        tr.style.cursor = 'pointer';
        if (isSelected) {
            tr.className = 'selected-row';
        }
        tr.onclick = () => selectUserRequest(item.id);

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td style="font-weight: 700; color: var(--indigo-500);">${typeLabel}</td>
            <td>
                <span class="status-badge-pill ${badgeClass}">${statusLabel}</span>
            </td>
            <td style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                <i class="fas fa-chevron-right"></i>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateUserRequestsPaginationControls(startIndex + 1, endIndex, totalItems, totalPages);
    renderUserRequestDetails(selectedUserRequestId);
}

function handleUserRequestSearch() {
    const input = document.getElementById('userRequestSearchInput');
    if (input) {
        window.userRequestsSearchQuery = input.value.trim().toLowerCase();
        window.userRequestsCurrentPage = 1;
        renderUserRequestsTable(userRequests);
    }
}

function changeUserRequestsPage(dir) {
    const totalFiltered = getFilteredUserRequests().length;
    const totalPages = Math.ceil(totalFiltered / window.userRequestsPageSize) || 1;
    let newPage = window.userRequestsCurrentPage + dir;
    if (newPage >= 1 && newPage <= totalPages) {
        window.userRequestsCurrentPage = newPage;
        renderUserRequestsTable(userRequests);
    }
}

function setUserRequestsPage(page) {
    window.userRequestsCurrentPage = page;
    renderUserRequestsTable(userRequests);
}

function getFilteredUserRequests() {
    let list = userRequests;
    if (window.activeCategory) {
        if (window.activeCategory === 'decharge') {
            list = list.filter(req => req.type === 'decharge_pc' || req.type === 'decharge_mobile');
        } else if (window.activeCategory === 'restitution') {
            list = list.filter(req => req.type === 'fin_contrat_pc' || req.type === 'fin_contrat_mobile');
        } else {
            list = list.filter(req => req.type === window.activeCategory);
        }
    }
    if (!window.userRequestsSearchQuery) return list;
    
    const query = window.userRequestsSearchQuery.toLowerCase();
    return list.filter(req => {
        const typeLabel = getRequestTypeLabel(req.type).toLowerCase();
        const comment = (req.adminComment || '').toLowerCase();
        const username = (req.username || '').toLowerCase();
        const fullname = (req.fullname || '').toLowerCase();
        const dept = (req.dept || '').toLowerCase();
        const details = req.details || {};
        const marque = (details.marque || '').toLowerCase();
        const model = (details.model || '').toLowerCase();
        const sn = (details.sn || '').toLowerCase();
        const imei = (details.imei || '').toLowerCase();
        const phone = (details.phoneNum || '').toLowerCase();
        
        return typeLabel.includes(query) ||
               comment.includes(query) ||
               username.includes(query) ||
               fullname.includes(query) ||
               dept.includes(query) ||
               marque.includes(query) ||
               model.includes(query) ||
               sn.includes(query) ||
               imei.includes(query) ||
               phone.includes(query);
    });
}

function updateUserRequestsPaginationControls(start, end, total, totalPages) {
    const info = document.getElementById('userRequestsPaginationInfo');
    const group = document.getElementById('userRequestsPaginationGroup');
    if (!group) return;

    if (info) {
        if (total === 0) {
            info.textContent = "Affichage de 0 à 0 sur 0";
        } else {
            info.textContent = `Affichage de ${start} à ${end} sur ${total}`;
        }
    }

    if (totalPages <= 1) {
        group.innerHTML = '';
        group.style.display = 'none';
    } else {
        group.style.display = 'flex';
        let btnHtml = `
            <button class="pagination-btn" onclick="changeUserRequestsPage(-1)" ${window.userRequestsCurrentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - window.userRequestsCurrentPage) <= 1) {
                btnHtml += `
                    <button class="pagination-btn ${i === window.userRequestsCurrentPage ? 'active' : ''}" onclick="setUserRequestsPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === 2 || i === totalPages - 1) {
                btnHtml += `<span style="padding: 0 0.15rem; color: var(--text-muted); font-size: 0.8rem;">...</span>`;
            }
        }
        
        btnHtml += `
            <button class="pagination-btn" onclick="changeUserRequestsPage(1)" ${window.userRequestsCurrentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        group.innerHTML = btnHtml.replace(/(<span.*?>\.\.\.<\/span>\s*){2,}/g, '<span style="padding: 0 0.15rem; color: var(--text-muted); font-size: 0.8rem;">...</span>');
    }
}

function selectUserRequest(requestId) {
    selectedUserRequestId = requestId;
    document.querySelectorAll('#userRequestsTableBody tr').forEach(tr => {
        tr.classList.remove('selected-row');
    });
    const selectedTr = document.getElementById(`user-req-row-${requestId}`);
    if (selectedTr) {
        selectedTr.classList.add('selected-row');
    }
    renderUserRequestDetails(requestId);
}

function renderUserRequestDetails(requestId) {
    const emptyDiv = document.getElementById('userRequestDetailsEmpty');
    const contentDiv = document.getElementById('userRequestDetailsContent');
    if (!emptyDiv || !contentDiv) return;

    const req = userRequests.find(r => r.id === requestId);
    if (!req) {
        emptyDiv.style.display = 'block';
        contentDiv.style.display = 'none';
        return;
    }

    emptyDiv.style.display = 'none';
    contentDiv.style.display = 'block';

    const dateStr = req.createdAt ? (req.createdAt.toDate ? req.createdAt.toDate().toLocaleDateString('fr-FR') : 'En cours') : 'En cours';
    const typeLabel = getRequestTypeLabel(req.type);
    const detailsStr = formatRequestDetails(req.type, req.details);
    
    let badgeClass = 'status-badge-pending';
    let statusLabel = 'En attente';
    if (req.status === 'approved') {
        badgeClass = 'status-badge-approved';
        statusLabel = 'Approuvée';
    } else if (req.status === 'rejected') {
        badgeClass = 'status-badge-rejected';
        statusLabel = 'Rejetée';
    }

    let pdfButtonHtml = '';
    if (req.status === 'approved') {
        pdfButtonHtml = `
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--border-color); display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" onclick="printCollaboratorRequestPDF('${req.id}')" 
                    style="padding: 0.55rem 1.25rem; font-size: 0.85rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border: none; border-radius: 0.6rem; cursor: pointer; color: white; font-weight: 700; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);">
                    <i class="fas fa-file-pdf"></i> Exporter PDF
                </button>
            </div>
        `;
    }

    let adminFeedbackHtml = '';
    if (req.status !== 'pending') {
        const processedDateStr = req.processedAt ? (req.processedAt.toDate ? req.processedAt.toDate().toLocaleDateString('fr-FR') : '') : '';
        adminFeedbackHtml = `
            <div class="decision-box" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--border-color); font-size: 0.88rem;">
                <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Traitement de la demande</h5>
                <p style="margin-bottom: 0.5rem; color: var(--text-secondary);">
                    Statut final : <span class="status-badge-pill ${badgeClass}" style="padding: 0.25rem 0.6rem !important; font-size: 0.72rem !important;">${statusLabel}</span>
                </p>
                ${processedDateStr ? `<p style="margin-bottom: 0.75rem; color: var(--text-muted); font-size: 0.8rem;">Traité le : ${processedDateStr}</p>` : ''}
                ${req.adminComment ? `
                    <div style="background: rgba(148, 163, 184, 0.06); border-left: 3px solid var(--indigo-500); padding: 0.75rem; border-radius: 0 0.5rem 0.5rem 0; margin-top: 0.5rem;">
                        <strong style="font-size: 0.82rem; color: var(--text-primary);">Note administrative :</strong>
                        <p style="margin-top: 0.25rem; margin-bottom: 0; color: var(--text-secondary); line-height: 1.35;">${escapeHTML(req.adminComment)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    contentDiv.innerHTML = `
        <div class="details-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(236, 72, 153, 0.1); color: #ec4899; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                <i class="fas fa-file-invoice"></i>
            </div>
            <div style="min-width: 0; flex: 1;">
                <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Demande #${req.id.substring(0, 6)}</h4>
                <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted);">Soumis le ${dateStr}</p>
            </div>
            <span class="status-badge-pill ${badgeClass}" style="padding: 0.35rem 0.75rem !important; font-size: 0.72rem !important; flex-shrink: 0;">${statusLabel}</span>
        </div>

        <div class="req-details-box">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.85rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Type de demande</span>
                <strong style="color: var(--indigo-500);">${typeLabel}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.85rem;">
                <span style="color: var(--text-muted);">Collaborateur</span>
                <strong style="color: var(--text-primary);">${escapeHTML(req.fullname || req.username)}</strong>
            </div>
        </div>

        <div class="details-section">
            <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Détails de l'équipement</h5>
            <div class="details-grid req-details-box" style="font-size: 0.85rem; line-height: 1.4; color: var(--text-secondary);">
                ${detailsStr || '<span style="color: var(--text-muted); font-style: italic;">Aucun détail fourni.</span>'}
            </div>
        </div>

        ${adminFeedbackHtml}
        ${pdfButtonHtml}
    `;
}

function getRequestTypeLabel(type) {
    switch (type) {
        case 'new_pc': return "Decharge PC";
        case 'decharge_pc': return "Décharge PC";
        case 'fin_contrat_pc': return "Restitution PC";
        case 'new_mobile': return "Decharge Téléphone";
        case 'decharge_mobile': return "Décharge Téléphone";
        case 'fin_contrat_mobile': return "Restitution Téléphone";
        default: return type;
    }
}

function formatRequestDetails(type, details) {
    if (!details) return '';
    let html = '';
    if (details.marque) html += `<strong>Marque:</strong> ${escapeHTML(details.marque)}<br>`;
    if (details.model) html += `<strong>Modèle:</strong> ${escapeHTML(details.model)}<br>`;
    if (details.sn) html += `<strong>S/N:</strong> ${escapeHTML(details.sn)}<br>`;
    if (details.imei) html += `<strong>IMEI:</strong> ${escapeHTML(details.imei)}<br>`;
    if (details.specs) html += `<strong>Specs:</strong> ${escapeHTML(details.specs)}<br>`;
    if (details.accessories) html += `<strong>Accessoires:</strong> ${escapeHTML(details.accessories)}<br>`;
    if (details.phoneNum) html += `<strong>N° Tél:</strong> ${escapeHTML(details.phoneNum)}<br>`;
    if (details.societe) html += `<strong>Société:</strong> ${escapeHTML(details.societe)}<br>`;
    if (details.restitutionNote) html += `<strong>Restit:</strong> ${escapeHTML(details.restitutionNote)}<br>`;
    if (details.note) html += `<small style="color: var(--text-muted);">Note: ${escapeHTML(details.note)}</small>`;
    return html;
}

function updateUserPortalStats(requests) {
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;

    document.getElementById('userStatTotal').textContent = total;
    document.getElementById('userStatPending').textContent = pending;
    document.getElementById('userStatApproved').textContent = approved;
}

let currentRequestsFilter = 'all';
let adminRequestsCurrentPage = 1;
const adminRequestsPageSize = 10;
let selectedAdminRequestId = null;

function filterAdminRequests(status) {
    currentRequestsFilter = status;
    adminRequestsCurrentPage = 1; // Reset to page 1
    document.querySelectorAll('.view-toolbar-actions button, .requests-filter-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    const filterBtn = document.getElementById(`btnFilterReq-${status}`);
    if (filterBtn) filterBtn.classList.add('active');
    renderAdminRequestsTable();
}

function renderAdminRequestsTable() {
    const tbody = document.getElementById('adminRequestsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = userRequests;
    if (currentRequestsFilter !== 'all') {
        filtered = userRequests.filter(r => r.status === currentRequestsFilter);
    }

    filtered.sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
        const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
        return dateB - dateA;
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / adminRequestsPageSize);
    
    if (adminRequestsCurrentPage > totalPages) {
        adminRequestsCurrentPage = Math.max(1, totalPages);
    }

    const startIndex = (adminRequestsCurrentPage - 1) * adminRequestsPageSize;
    const endIndex = startIndex + adminRequestsPageSize;
    const paginatedItems = filtered.slice(startIndex, endIndex);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Aucune demande disponible.</td></tr>';
        
        // Hide pagination
        const paginationDiv = document.getElementById('adminRequestsPagination');
        if (paginationDiv) paginationDiv.style.display = 'none';

        // Clear details panel
        selectedAdminRequestId = null;
        renderAdminRequestDetails(null);
        return;
    }

    paginatedItems.forEach(item => {
        const dateStr = item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString('fr-FR') : 'En cours') : 'En cours';
        const typeLabel = getRequestTypeLabel(item.type);
        
        let badgeClass = 'status-badge-pending';
        let statusLabel = 'En attente';
        if (item.status === 'approved') {
            badgeClass = 'status-badge-approved';
            statusLabel = 'Approuvée';
        } else if (item.status === 'rejected') {
            badgeClass = 'status-badge-rejected';
            statusLabel = 'Rejetée';
        }

        const pinLabel = item.username && item.username !== item.fullname ? ` <span style="font-size: 0.72rem; font-weight: normal; color: var(--indigo-500); background: rgba(99, 102, 241, 0.08); padding: 2px 6px; border-radius: 4px; margin-left: 4px;">PIN: ${escapeHTML(item.username)}</span>` : '';
        const colLabel = item.fullname ? `<strong>${escapeHTML(item.fullname)}</strong>${pinLabel}<br><small style="color: var(--text-muted);">${escapeHTML(item.dept || '')}</small>` : escapeHTML(item.username);

        const isSelected = item.id === selectedAdminRequestId;
        const tr = document.createElement('tr');
        tr.id = `req-row-${item.id}`;
        tr.style.cursor = 'pointer';
        if (isSelected) {
            tr.className = 'selected-row';
        }
        tr.onclick = () => selectAdminRequest(item.id);

        tr.innerHTML = `
            <td style="line-height: 1.3;">${colLabel}</td>
            <td>${dateStr}</td>
            <td style="font-weight: 700; color: var(--indigo-500);">${typeLabel}</td>
            <td>
                <span class="status-badge-pill ${badgeClass}">${statusLabel}</span>
            </td>
            <td style="text-align: center; color: var(--text-muted);"><i class="fas fa-chevron-right"></i></td>
        `;
        tbody.appendChild(tr);
    });

    // Populate pagination controls
    const paginationDiv = document.getElementById('adminRequestsPagination');
    if (paginationDiv) {
        if (totalPages <= 1) {
            paginationDiv.innerHTML = '';
            paginationDiv.style.display = 'none';
        } else {
            paginationDiv.style.display = 'flex';
            
            let btnHtml = `
                <span class="pagination-info">Page ${adminRequestsCurrentPage} sur ${totalPages} (${totalItems} demandes)</span>
                <div class="pagination-btn-group">
                    <button class="pagination-btn" onclick="changeAdminRequestsPage(-1)" ${adminRequestsCurrentPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left"></i>
                    </button>
            `;
            
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || Math.abs(i - adminRequestsCurrentPage) <= 1) {
                    btnHtml += `
                        <button class="pagination-btn ${i === adminRequestsCurrentPage ? 'active' : ''}" onclick="setAdminRequestsPage(${i})">
                            ${i}
                        </button>
                    `;
                } else if (i === 2 || i === totalPages - 1) {
                    btnHtml += `<span style="padding: 0 0.15rem; color: var(--text-muted); font-size: 0.8rem;">...</span>`;
                }
            }
            
            btnHtml += `
                    <button class="pagination-btn" onclick="changeAdminRequestsPage(1)" ${adminRequestsCurrentPage === totalPages ? 'disabled' : ''}>
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            `;
            // Remove adjacent double "..."
            paginationDiv.innerHTML = btnHtml.replace(/(<span.*?>\.\.\.<\/span>\s*){2,}/g, '<span style="padding: 0 0.15rem; color: var(--text-muted); font-size: 0.8rem;">...</span>');
        }
    }

    // Refresh detail panel with current selection
    renderAdminRequestDetails(selectedAdminRequestId);
}

function changeAdminRequestsPage(dir) {
    adminRequestsCurrentPage += dir;
    renderAdminRequestsTable();
}

function setAdminRequestsPage(page) {
    adminRequestsCurrentPage = page;
    renderAdminRequestsTable();
}

function selectAdminRequest(requestId) {
    selectedAdminRequestId = requestId;
    document.querySelectorAll('#adminRequestsTableBody tr').forEach(tr => {
        tr.classList.remove('selected-row');
    });
    const selectedTr = document.getElementById(`req-row-${requestId}`);
    if (selectedTr) {
        selectedTr.classList.add('selected-row');
    }
    renderAdminRequestDetails(requestId);
}

function renderAdminRequestDetails(requestId) {
    const emptyDiv = document.getElementById('requestsDetailsEmpty');
    const contentDiv = document.getElementById('requestsDetailsContent');
    if (!emptyDiv || !contentDiv) return;

    const req = userRequests.find(r => r.id === requestId);
    if (!req) {
        emptyDiv.style.display = 'block';
        contentDiv.style.display = 'none';
        return;
    }

    emptyDiv.style.display = 'none';
    contentDiv.style.display = 'block';

    const dateStr = req.createdAt ? (req.createdAt.toDate ? req.createdAt.toDate().toLocaleDateString('fr-FR') : 'En cours') : 'En cours';
    const typeLabel = getRequestTypeLabel(req.type);
    const detailsStr = formatRequestDetails(req.type, req.details);
    
    let badgeClass = 'status-badge-pending';
    let statusLabel = 'En attente';
    if (req.status === 'approved') {
        badgeClass = 'status-badge-approved';
        statusLabel = 'Approuvée';
    } else if (req.status === 'rejected') {
        badgeClass = 'status-badge-rejected';
        statusLabel = 'Rejetée';
    }

    let decisionHtml = '';
    if (req.status === 'pending') {
        decisionHtml = `
            <div class="decision-box" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--border-color);">
                <h5 style="margin-bottom: 0.75rem; font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">Prendre une décision</h5>
                <textarea id="panelDecisionComment" style="width: 100%; min-height: 80px; padding: 0.75rem; border-radius: 0.6rem; border: 1px solid var(--border-color); font-family: inherit; font-size: 0.85rem; margin-bottom: 1rem; resize: vertical; box-sizing: border-box; background: var(--bg-card); color: var(--text-primary);" placeholder="Motif ou note administrative (facultatif)..."></textarea>
                <div style="display: flex; gap: 0.75rem;">
                    <button class="req-action-btn req-approve-btn" onclick="submitRequestDecisionFromPanel('${req.id}', 'approved')" style="flex: 1; justify-content: center; height: 38px;">
                        <i class="fas fa-check"></i> Approuver
                    </button>
                    <button class="req-action-btn req-reject-btn" onclick="submitRequestDecisionFromPanel('${req.id}', 'rejected')" style="flex: 1; justify-content: center; height: 38px;">
                        <i class="fas fa-times"></i> Rejeter
                    </button>
                </div>
            </div>
        `;
    } else {
        const processedDateStr = req.processedAt ? (req.processedAt.toDate ? req.processedAt.toDate().toLocaleDateString('fr-FR') : '') : '';
        decisionHtml = `
            <div class="decision-box" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--border-color); font-size: 0.88rem;">
                <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Traitement de la demande</h5>
                <p style="margin-bottom: 0.5rem; color: var(--text-secondary);">
                    Statut : <span class="status-badge-pill ${badgeClass}" style="padding: 0.25rem 0.6rem !important; font-size: 0.72rem !important;">${statusLabel}</span>
                </p>
                ${processedDateStr ? `<p style="margin-bottom: 0.75rem; color: var(--text-muted); font-size: 0.8rem;">Traité le : ${processedDateStr}</p>` : ''}
                ${req.adminComment ? `
                    <div style="background: rgba(148, 163, 184, 0.06); border-left: 3px solid var(--indigo-500); padding: 0.75rem; border-radius: 0 0.5rem 0.5rem 0; margin-top: 0.5rem;">
                        <strong style="font-size: 0.82rem; color: var(--text-primary);">Note administrateur :</strong>
                        <p style="margin-top: 0.25rem; margin-bottom: 0; color: var(--text-secondary); line-height: 1.35;">${escapeHTML(req.adminComment)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    contentDiv.innerHTML = `
        <div class="details-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(236, 72, 153, 0.1); color: #ec4899; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                <i class="fas fa-paper-plane"></i>
            </div>
            <div style="min-width: 0; flex: 1;">
                <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHTML(req.fullname || req.username)}</h4>
                <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted);">${escapeHTML(req.dept || 'Aucun service')} • Compte PIN: <strong>${escapeHTML(req.username)}</strong></p>
            </div>
            <span class="status-badge-pill ${badgeClass}" style="padding: 0.35rem 0.75rem !important; font-size: 0.72rem !important; flex-shrink: 0;">${statusLabel}</span>
        </div>

        <div class="req-details-box">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.85rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Type de demande</span>
                <strong style="color: var(--indigo-500);">${typeLabel}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.85rem;">
                <span style="color: var(--text-muted);">Date de création</span>
                <strong style="color: var(--text-primary);">${dateStr}</strong>
            </div>
        </div>

        <div class="details-section">
            <h5 style="margin-bottom: 0.5rem; font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Détails matériels</h5>
            <div class="details-grid req-details-box" style="font-size: 0.85rem; line-height: 1.4; color: var(--text-secondary);">
                ${detailsStr || '<span style="color: var(--text-muted); font-style: italic;">Aucun détail fourni.</span>'}
            </div>
        </div>

        ${decisionHtml}
        
        <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px dashed var(--border-color); display: flex; justify-content: flex-end;">
            <button onclick="deleteUserRequest('${req.id}')"
                onmouseover="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.borderColor='rgba(239, 68, 68, 0.6)';"
                onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.borderColor='rgba(239, 68, 68, 0.35)';"
                style="padding: 0.55rem 1.1rem; font-size: 0.82rem; background: rgba(239, 68, 68, 0.08); border: 1px dashed rgba(239, 68, 68, 0.35); border-radius: 0.6rem; cursor: pointer; color: #f87171; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.2s ease;">
                <i class="fas fa-trash-alt" style="font-size: 0.85rem;"></i> Supprimer la Demande
            </button>
        </div>
    `;
}

function submitRequestDecisionFromPanel(requestId, decision) {
    const commentInput = document.getElementById('panelDecisionComment');
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!requestId || !decision) return;

    const req = userRequests.find(r => r.id === requestId);
    if (!req) return;

    showToast("🔄 Enregistrement de la décision...", "blue");

    db.collection("userRequests").doc(requestId).update({
        status: decision,
        adminComment: comment,
        processedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        if (decision === 'approved') {
            return executeAutomatedInventoryAction(req);
        }
        return Promise.resolve();
    })
    .then(() => {
        showToast(decision === 'approved' ? "✅ Demande approuvée et traitée !" : "❌ Demande rejetée.", "green");
    })
    .catch(err => {
        console.error("Error processing request decision:", err);
        showToast("⚠️ Erreur lors du traitement", "red");
    });
}

function deleteUserRequest(requestId) {
    if (!requestId) return;

    showCustomConfirm(
        "Supprimer la Demande",
        "Voulez-vous vraiment supprimer définitivement cette demande ?",
        function () {
            showToast("🔄 Suppression en cours...", "blue");
            db.collection("userRequests").doc(requestId).delete()
                .then(() => {
                    showToast("🗑️ Demande supprimée avec succès", "green");
                    selectedAdminRequestId = null;
                    renderAdminRequestDetails(null);
                })
                .catch(error => {
                    console.error("Error deleting request:", error);
                    showToast("❌ Erreur lors de la suppression de la demande", "red");
                });
        },
        null,
        'delete'
    );
}

function updateAdminRequestsBadge() {
    const pendingCount = userRequests.filter(r => r.status === 'pending').length;
    
    // Mettre à jour le badge de la carte du tableau de bord (si présent)
    const badge = document.getElementById('moduleRequestsBadge');
    if (badge) {
        badge.textContent = `${pendingCount} En attente`;
        if (pendingCount > 0) {
            badge.style.background = 'var(--red-500)';
            badge.style.color = 'white';
        } else {
            badge.style.background = 'var(--bg-secondary)';
            badge.style.color = 'var(--text-secondary)';
        }
    }

    const navBadge = document.getElementById('navRequestsBadge');
    if (navBadge) {
        navBadge.textContent = pendingCount;
        navBadge.style.display = 'inline-flex';
    }
}



function executeAutomatedInventoryAction(req) {
    const todayStr = new Date().toISOString().split('T')[0];
    const details = req.details || {};
    const username = req.username;
    const fullname = req.fullname || username;
    const dept = req.dept || 'Sans Service';

    if (req.type === 'new_pc') {
        const parsedSpecs = getDeviceSpecs({ specs: details.specs || '' });
        const deviceData = {
            sn: details.sn,
            model: details.model,
            specs: details.specs || '',
            user: fullname,
            type: 'Laptop',
            dept: dept,
            peripherals: details.accessories || '',
            cpu: parsedSpecs.cpu || '',
            ram: parsedSpecs.ram || '',
            disk: parsedSpecs.disk || '',
            os: '',
            status: 'En Service',
            assignedDate: todayStr,
            notes: 'Ajouté automatiquement via demande Collaborateur PIN.',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection("itAssets").doc(details.sn).set(deviceData, { merge: true })
            .then(() => {
                logActivity('INVENTAIRE', 'MODIF_AJOUT', `Appareil ajouté automatiquement: ${details.sn} (${details.model})`);
            });
    } 
    else if (req.type === 'new_mobile') {
        const docId = db.collection("itMobiles").doc().id;
        
        let adminName = 'Système (Auto)';
        let adminRole = 'Admin IT';
        if (auth.currentUser) {
            const email = auth.currentUser.email || '';
            const prefix = email.split('@')[0];
            adminName = prefix.split(/[\._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            adminRole = 'Administrateur IT';
        }

        const mobileData = {
            id: docId,
            type: 'Téléphone',
            marque: details.marque || '',
            model: details.model || '',
            imei: details.imei || '',
            simNumber: details.phoneNum ? (details.societe ? `${details.phoneNum} (${details.societe})` : details.phoneNum) : '',
            assignee: fullname,
            service: dept,
            remisPar: adminName,
            remisParFonction: adminRole,
            societe: 'LABO NEDJMA',
            date: todayStr,
            status: 'Affecte',
            notes: 'Ajouté automatiquement via demande Collaborateur PIN.',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection("itMobiles").doc(docId).set(mobileData)
            .then(() => {
                logActivity('MOBILES', 'MODIF_AJOUT', `Mobile ajouté automatiquement par ${adminName}: ${details.model} (${details.imei})`);
            });
    } 
    else if (req.type === 'decharge_pc' || req.type === 'decharge_mobile') {
        const docId = db.collection("itDistributions").doc().id;
        const distData = {
            id: docId,
            employeeName: fullname,
            service: dept,
            itemModel: details.model,
            itemSn: details.sn || details.imei || '',
            type: req.type.includes('pc') ? 'Laptop' : 'Téléphone',
            date: todayStr,
            status: 'Actif',
            remarque: 'Généré automatiquement via décharge PIN.',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection("itDistributions").doc(docId).set(distData)
            .then(() => {
                logActivity('DISTRIBUTION', 'AJOUT_DST', `Décharge créée automatiquement pour ${fullname}: ${details.model}`);
            });
    } 
    else if (req.type === 'fin_contrat_pc') {
        let adminName = 'Système (Auto)';
        if (auth.currentUser) {
            const email = auth.currentUser.email || '';
            const prefix = email.split('@')[0];
            adminName = prefix.split(/[\._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }

        return db.collection("itAssets").doc(details.sn).get()
            .then(doc => {
                let originalDate = todayStr;
                let deviceModel = details.model || '';
                let updateAssetPromise = Promise.resolve();

                if (doc.exists) {
                    const devData = doc.data();
                    originalDate = devData.assignedDate || todayStr;
                    deviceModel = devData.model || details.model || '';
                    
                    updateAssetPromise = db.collection("itAssets").doc(details.sn).update({
                        user: 'Non assigné',
                        status: 'En Stock',
                        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                const newDocId = String(Date.now());
                const articleName = `Laptop ${deviceModel} [S/N: ${details.sn || ''}]`;
                const newDistData = {
                    id: newDocId,
                    employeeName: fullname,
                    service: dept,
                    article: articleName,
                    qty: 1,
                    type: 'Fin de Contrat',
                    date: originalDate,
                    returnedDate: todayStr,
                    restState: details.restitutionNote || 'Sain et sauf, conforme à l\'état initial',
                    restTech: adminName,
                    restNotes: details.note || details.restitutionNote || 'Généré automatiquement via approbation de demande PIN.',
                    status: 'Terminé',
                    lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                };
                const createDistPromise = db.collection("itDistributions").doc(newDocId).set(newDistData);

                return Promise.all([updateAssetPromise, createDistPromise]).then(() => {
                    logActivity('INVENTAIRE', 'MODIF_AJOUT', `PC ${details.sn} remis en stock suite fin contrat.`);
                    logActivity('DISTRIBUTION', 'FIN_CONTRAT', `Fin de contrat automatique pour PC ${details.sn}`);
                });
            });
    } 
    else if (req.type === 'fin_contrat_mobile') {
        let adminName = 'Système (Auto)';
        if (auth.currentUser) {
            const email = auth.currentUser.email || '';
            const prefix = email.split('@')[0];
            adminName = prefix.split(/[\._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }

        return db.collection("itMobiles")
            .where("imei", "==", details.imei)
            .get()
            .then(snapshot => {
                let targetDoc = null;
                if (!snapshot.empty) {
                    targetDoc = snapshot.docs[0];
                }
                
                if (targetDoc) {
                    return Promise.resolve(targetDoc);
                } else {
                    return db.collection("itMobiles")
                        .where("numSerie", "==", details.imei)
                        .get()
                        .then(fallbackSnapshot => {
                            if (!fallbackSnapshot.empty) {
                                return Promise.resolve(fallbackSnapshot.docs[0]);
                            }
                            return Promise.resolve(null);
                        });
                }
            })
            .then(doc => {
                let originalDate = todayStr;
                let brand = details.marque || '';
                let model = details.model || '';
                let imeiNum = details.imei || '';
                let updateMobilePromise = Promise.resolve();

                if (doc) {
                    const docId = doc.id;
                    const mobData = doc.data();
                    originalDate = mobData.date || mobData.assignedDate || todayStr;
                    brand = mobData.marque || details.marque || '';
                    model = mobData.model || details.model || '';
                    imeiNum = mobData.imei || mobData.numSerie || details.imei || '';

                    const updateObj = {
                        status: 'Stock',
                        assignee: 'Non assigné',
                        returnedDate: todayStr,
                        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    if (mobData.etat !== undefined) updateObj.etat = 'Restitué';
                    if (mobData.employe !== undefined) updateObj.employe = 'Non assigné';
                    if (mobData.dateRestitution !== undefined) updateObj.dateRestitution = todayStr;
                    
                    updateMobilePromise = db.collection("itMobiles").doc(docId).update(updateObj);
                }

                const newDocId = String(Date.now());
                const articleName = `${brand} ${model} / imei :${imeiNum}`;
                
                const newDistData = {
                    id: newDocId,
                    employeeName: fullname,
                    service: dept,
                    article: articleName,
                    qty: 1,
                    type: 'Fin de Contrat',
                    date: originalDate,
                    returnedDate: todayStr,
                    restState: details.restitutionNote || 'Sain et sauf, conforme à l\'état initial',
                    restTech: adminName,
                    restNotes: details.note || details.restitutionNote || 'Généré automatiquement via approbation de demande PIN.',
                    status: 'Terminé',
                    lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                };
                const createDistPromise = db.collection("itDistributions").doc(newDocId).set(newDistData);

                return Promise.all([updateMobilePromise, createDistPromise]).then(() => {
                    logActivity('MOBILES', 'MODIF_AJOUT', `Mobile ${imeiNum} marqué restitué suite fin contrat.`);
                    logActivity('DISTRIBUTION', 'FIN_CONTRAT', `Fin de contrat automatique pour mobile ${imeiNum}`);
                });
            });
    }
    return Promise.resolve();
}

function createUserPinFromSettings() {
    const username = document.getElementById('newPinUsername').value.trim();
    const pin = document.getElementById('newPinCode').value.trim();

    if (!username) {
        showToast("⚠️ Veuillez saisir le nom du collaborateur", "warning");
        return;
    }
    if (!pin || pin.length < 4 || isNaN(pin)) {
        showToast("⚠️ Veuillez saisir un code PIN numérique d'au moins 4 chiffres", "warning");
        return;
    }

    createUserPin(username, pin);
}

function createUserPin(username, pin) {
    const exists = userPins.some(p => p.pin === pin);
    if (exists) {
        showToast("⚠️ Ce code PIN est déjà attribué à un autre collaborateur !", "warning");
        return;
    }

    db.collection("userPins").add({
        username: username,
        pin: pin,
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        showToast("🔑 Compte PIN créé avec succès !", "green");
        document.getElementById('newPinUsername').value = '';
        document.getElementById('newPinCode').value = '';
    }).catch(err => {
        console.error("Error creating PIN:", err);
        showToast("❌ Erreur lors de la création du PIN", "red");
    });
}

function togglePinStatus(pinId, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
    db.collection("userPins").doc(pinId).update({
        status: nextStatus
    }).then(() => {
        showToast(`Compte PIN ${nextStatus === 'active' ? 'réactivé' : 'bloqué'} !`, "blue");
    }).catch(err => {
        console.error("Error updating PIN status:", err);
        showToast("❌ Erreur de modification du statut", "red");
    });
}

function deleteUserPin(pinId) {
    showCustomConfirm(
        "Supprimer le code PIN",
        "Voulez-vous vraiment supprimer définitivement ce code PIN d'accès ?",
        function() {
            db.collection("userPins").doc(pinId).delete()
                .then(() => showToast("🗑️ Code PIN supprimé !", "blue"))
                .catch(err => console.error("Error deleting PIN:", err));
        },
        null,
        'danger'
    );
}

function renderSettingsPinsTable() {
    const tbody = document.getElementById('settingsPinsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (userPins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">Aucun code PIN configuré.</td></tr>';
        selectedSettingsPinId = null;
        renderSettingsPinDetails(null);
        return;
    }

    userPins.forEach(item => {
        const tr = document.createElement('tr');
        tr.id = `pin-row-${item.id}`;
        tr.style.cursor = 'pointer';
        tr.setAttribute('onclick', `selectSettingsPin('${item.id}')`);
        
        if (item.id === selectedSettingsPinId) {
            tr.classList.add('selected-row');
        }
        
        const badgeClass = item.status === 'active' ? 'badge-active' : 'badge-blocked';
        const badgeText = item.status === 'active' ? 'Actif' : 'Bloqué';

        tr.innerHTML = `
            <td style="font-weight: 700; color: var(--text-primary);">${escapeHTML(item.username)}</td>
            <td style="font-family: monospace; font-size: 0.95rem; font-weight: 600; letter-spacing: 0.05rem; color: var(--indigo-500);">${escapeHTML(item.pin)}</td>
            <td>
                <span class="status-badge-pill ${badgeClass}">${badgeText}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderSettingsPinDetails(selectedSettingsPinId);
}

let selectedSettingsPinId = null;
let isPinRevealed = false;
let isEditingPin = false;

function selectSettingsPin(pinId) {
    selectedSettingsPinId = pinId;
    isEditingPin = false; // Reset editing state
    document.querySelectorAll('#settingsPinsTableBody tr').forEach(tr => {
        tr.classList.remove('selected-row');
    });
    const selectedTr = document.getElementById(`pin-row-${pinId}`);
    if (selectedTr) {
        selectedTr.classList.add('selected-row');
    }
    isPinRevealed = false;
    renderSettingsPinDetails(pinId);
}

function toggleRevealPin() {
    isPinRevealed = !isPinRevealed;
    const pinDisplay = document.getElementById('detailsPinDisplay');
    const eyeIcon = document.getElementById('detailsPinEyeIcon');
    if (!pinDisplay || !selectedSettingsPinId) return;
    
    const pinItem = userPins.find(p => p.id === selectedSettingsPinId);
    if (!pinItem) return;

    if (isPinRevealed) {
        pinDisplay.textContent = pinItem.pin;
        eyeIcon.className = 'fas fa-eye-slash';
    } else {
        pinDisplay.textContent = '•'.repeat(pinItem.pin.length);
        eyeIcon.className = 'fas fa-eye';
    }
}

function enablePinEditing() {
    isEditingPin = true;
    renderSettingsPinDetails(selectedSettingsPinId);
}

function cancelPinEditing() {
    isEditingPin = false;
    renderSettingsPinDetails(selectedSettingsPinId);
}

function saveSettingsPinEdit(pinId) {
    const input = document.getElementById('detailsPinEditInput');
    if (!input) return;
    const newPin = input.value.trim();

    if (!newPin || newPin.length < 4 || newPin.length > 8 || isNaN(newPin)) {
        showToast("⚠️ Le code PIN doit contenir entre 4 et 8 chiffres", "warning");
        return;
    }

    // Check if the pin is already taken by another user
    const exists = userPins.some(p => p.pin === newPin && p.id !== pinId);
    if (exists) {
        showToast("⚠️ Ce code PIN est déjà attribué à un autre collaborateur !", "warning");
        return;
    }

    db.collection("userPins").doc(pinId).update({
        pin: newPin
    }).then(() => {
        showToast("🔑 Code PIN mis à jour avec succès !", "green");
        isEditingPin = false;
    }).catch(err => {
        console.error("Error updating PIN:", err);
        showToast("❌ Erreur lors de la modification du PIN", "red");
    });
}

function renderSettingsPinDetails(pinId) {
    const emptyDiv = document.getElementById('settingsPinDetailsEmpty');
    const contentDiv = document.getElementById('settingsPinDetailsContent');
    if (!emptyDiv || !contentDiv) return;

    const pinItem = userPins.find(p => p.id === pinId);
    if (!pinItem) {
        emptyDiv.style.display = 'block';
        contentDiv.style.display = 'none';
        return;
    }

    emptyDiv.style.display = 'none';
    contentDiv.style.display = 'block';

    const badgeClass = pinItem.status === 'active' ? 'badge-active' : 'badge-blocked';
    const badgeText = pinItem.status === 'active' ? 'Actif' : 'Bloqué';
    const actionBtnText = pinItem.status === 'active' ? 'Bloquer' : 'Activer';
    const actionIcon = pinItem.status === 'active' ? 'fa-ban' : 'fa-check';

    if (isEditingPin) {
        contentDiv.innerHTML = `
            <div class="details-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(99, 102, 241, 0.1); color: var(--indigo-500); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                    <i class="fas fa-edit"></i>
                </div>
                <div style="min-width: 0; flex: 1;">
                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Modifier le code PIN</h4>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(pinItem.username)}</p>
                </div>
            </div>

            <div class="req-details-box" style="margin-bottom: 1.25rem; padding: 1rem; border-radius: 0.75rem; background: rgba(148, 163, 184, 0.05); border: 1px solid var(--border-color);">
                <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
                    <label style="color: var(--text-muted); font-weight: 600;">Nouveau Code PIN (4 à 8 chiffres)</label>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="text" id="detailsPinEditInput" value="${escapeHTML(pinItem.pin)}" maxlength="8" class="settings-input" 
                            style="flex: 1; font-family: monospace; font-size: 1.1rem; font-weight: 700; padding: 0.5rem 0.75rem; border-radius: 0.5rem; text-align: left; letter-spacing: 0.15rem; background: var(--bg-primary); border: 1px solid var(--border-color); outline: none;">
                        <div style="display: flex; gap: 0.25rem;">
                            <button onclick="saveSettingsPinEdit('${pinItem.id}')" 
                                style="width: 34px; height: 34px; border-radius: 0.4rem; background: #22c55e; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: background 0.2s;" onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'" title="Enregistrer">
                                <i class="fas fa-check"></i>
                            </button>
                            <button onclick="cancelPinEditing()" 
                                style="width: 34px; height: 34px; border-radius: 0.4rem; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(148, 163, 184, 0.1)'" onmouseout="this.style.background='var(--bg-secondary)'" title="Annuler">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        const displayPin = isPinRevealed ? pinItem.pin : '•'.repeat(pinItem.pin.length);
        const eyeClass = isPinRevealed ? 'fa-eye-slash' : 'fa-eye';

        contentDiv.innerHTML = `
            <div class="details-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(99, 102, 241, 0.1); color: var(--indigo-500); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                    <i class="fas fa-user-shield"></i>
                </div>
                <div style="min-width: 0; flex: 1;">
                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHTML(pinItem.username)}</h4>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">Compte Collaborateur</p>
                </div>
                <span class="status-badge-pill ${badgeClass}" style="font-size: 0.7rem !important; padding: 0.25rem 0.6rem !important;">${badgeText}</span>
            </div>

            <div class="req-details-box" style="margin-bottom: 1.25rem; padding: 1rem; border-radius: 0.75rem; background: rgba(148, 163, 184, 0.05); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                    <span style="color: var(--text-muted); font-weight: 600;">Code PIN d'accès</span>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <strong id="detailsPinDisplay" style="font-family: monospace; font-size: 1.1rem; letter-spacing: 0.15rem; color: var(--indigo-500); margin-right: 0.5rem;">${escapeHTML(displayPin)}</strong>
                        <button onclick="toggleRevealPin()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem; display: flex; align-items: center; transition: color 0.2s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'" title="Afficher/Masquer le code PIN">
                            <i id="detailsPinEyeIcon" class="fas ${eyeClass}"></i>
                        </button>
                        <button onclick="enablePinEditing()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem; display: flex; align-items: center; transition: color 0.2s;" onmouseover="this.style.color='var(--indigo-500)'" onmouseout="this.style.color='var(--text-muted)'" title="Modifier le code PIN">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 0.6rem;">
                <h5 style="margin: 0 0 0.25rem 0; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Actions Administrateur</h5>
                
                <div style="display: flex; gap: 0.5rem; width: 100%;">
                    <button class="btn" onclick="togglePinStatus('${pinItem.id}', '${pinItem.status}')"
                        onmouseover="this.style.background='rgba(245, 158, 11, 0.12)'; this.style.borderColor='rgba(245, 158, 11, 0.45)';"
                        onmouseout="this.style.background='var(--bg-secondary)'; this.style.borderColor='var(--border-color)';"
                        style="flex: 1; padding: 0.55rem 0.8rem; font-size: 0.82rem; font-weight: 600; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 0.6rem; cursor: pointer; color: var(--text-primary); display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; transition: all 0.2s ease;">
                        <i class="fas ${pinItem.status === 'active' ? 'fa-ban' : 'fa-check'}"></i> ${actionBtnText}
                    </button>
                    
                    <button class="btn" onclick="deleteUserPin('${pinItem.id}')"
                        onmouseover="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.borderColor='rgba(239, 68, 68, 0.45)';"
                        onmouseout="this.style.background='rgba(239, 68, 68, 0.06)'; this.style.borderColor='rgba(239, 68, 68, 0.25)';"
                        style="flex: 1; padding: 0.55rem 0.8rem; font-size: 0.82rem; font-weight: 600; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); color: var(--red-500); border-radius: 0.6rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; transition: all 0.2s ease;">
                        <i class="fas fa-trash-alt"></i> Supprimer
                    </button>
                </div>
            </div>
        `;
    }
}

// Global expose
window.switchLoginTab = switchLoginTab;
window.populateCollaboratorsDropdown = populateCollaboratorsDropdown;
window.pressKey = pressKey;
window.focusPinInput = focusPinInput;
window.handlePinLoginSubmit = handlePinLoginSubmit;
window.handlePinLogout = handlePinLogout;
window.handleAdminLoginSubmit = handleAdminLoginSubmit;
window.handleAuthRedirect = handleAuthRedirect;
window.syncUserPortalRequests = syncUserPortalRequests;
window.toggleUserRequestFormFields = toggleUserRequestFormFields;
window.submitUserRequest = submitUserRequest;
window.filterAdminRequests = filterAdminRequests;
window.submitRequestDecisionFromPanel = submitRequestDecisionFromPanel;
window.createUserPinFromSettings = createUserPinFromSettings;
window.togglePinStatus = togglePinStatus;
window.deleteUserPin = deleteUserPin;
window.renderSettingsPinsTable = renderSettingsPinsTable;
window.enterSystem = enterSystem;

function printCollaboratorRequestPDF(id) {
    const req = userRequests.find(r => r.id === id);
    if (!req) return;

    const logoUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1) + 'assets/logo-pdf.png';
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
        showToast("⚠️ Pop-up bloqué ! Veuillez autoriser les pop-ups pour imprimer.", "red");
        return;
    }

    const isRestitution = req.type.includes('fin_contrat') || req.type.includes('restitution');
    const themeColor = isRestitution ? '#dc2626' : '#6366f1';
    const themeGradient = isRestitution 
        ? 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)' 
        : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)';
    const documentTitle = isRestitution ? 'Attestation de Restitution' : 'Attestation de Validation';
    const documentSubHeader = isRestitution ? 'FIN DE CONTRAT • DECHARGE RESILIEE' : 'LABO-IT CONTROL • LABO NEDJMA';
    const documentRefPrefix = isRestitution ? 'RET' : 'REQ';

    const typeLabel = getRequestTypeLabel(req.type);
    const dateStr = req.createdAt ? (req.createdAt.toDate ? req.createdAt.toDate().toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')) : new Date().toLocaleDateString('fr-FR');
    const processedDateStr = req.processedAt ? (req.processedAt.toDate ? req.processedAt.toDate().toLocaleDateString('fr-FR') : dateStr) : dateStr;
    const ref = `${documentRefPrefix}-${processedDateStr.replace(/\D/g, '')}-${req.id.substring(0, 8).toUpperCase()}`;

    let detailsHtml = '';
    const details = req.details || {};
    if (details.model) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Modèle d'équipement:</span><span class="detail-val">${escapeHTML(details.model)}</span></div>`;
    if (details.sn) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Numéro de Série (S/N):</span><span class="detail-val">${escapeHTML(details.sn)}</span></div>`;
    if (details.imei) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Numéro IMEI / Série Mobile:</span><span class="detail-val">${escapeHTML(details.imei)}</span></div>`;
    if (details.phoneNum) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Numéro de Téléphone:</span><span class="detail-val">${escapeHTML(details.phoneNum)}</span></div>`;
    if (details.specs) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Spécifications Techniques:</span><span class="detail-val">${escapeHTML(details.specs)}</span></div>`;
    if (details.accessories) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Accessoires fournis:</span><span class="detail-val">${escapeHTML(details.accessories)}</span></div>`;
    if (details.restitutionNote) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Détails de Restitution:</span><span class="detail-val">${escapeHTML(details.restitutionNote)}</span></div>`;
    if (details.note) detailsHtml += `<div class="detail-row"><span class="detail-lbl">Notes supplémentaires:</span><span class="detail-val">${escapeHTML(details.note)}</span></div>`;

    const documentIntro = isRestitution 
        ? `La présente attestation confirme la restitution définitive des équipements désignés ci-dessous et la résiliation de plein droit du protocole de décharge associé formulée par le collaborateur <strong>${escapeHTML(req.fullname || req.username)}</strong> (Compte PIN: <strong>${escapeHTML(req.username)}</strong>) du service <strong>${escapeHTML(req.dept || 'N/A')}</strong>.`
        : `La présente attestation confirme que la demande de décharge formulée par le collaborateur <strong>${escapeHTML(req.fullname || req.username)}</strong> (Compte PIN: <strong>${escapeHTML(req.username)}</strong>) du service <strong>${escapeHTML(req.dept || 'N/A')}</strong> a été formellement validée et approuvée par le service informatique.`;

    const content = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>${documentTitle} - ${escapeHTML(req.username)}</title>
            <style>
                @page {
                    size: A4;
                    margin: 10mm;
                }
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
                    line-height: 1.5;
                    font-size: 14px;
                }
                .document-wrapper {
                    width: 100%;
                    max-width: 100%;
                    height: 272mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    padding: 0;
                    position: relative;
                }
                .header {
                    background: ${themeGradient};
                    color: #ffffff;
                    padding: 22px 35px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 4px solid ${themeColor};
                }
                .logo-img {
                    height: 55px;
                    max-width: 180px;
                    object-fit: contain;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 8px;
                    border-radius: 8px;
                }
                .header-title {
                    text-align: right;
                }
                .main-hdr {
                    font-size: 22px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .sub-hdr {
                    font-size: 10.5px;
                    color: #94a3b8;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    margin-top: 4px;
                }
                .metadata-bar {
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 12px 35px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 12.5px;
                    color: #475569;
                    font-weight: 600;
                }
                .content-body {
                    padding: 30px 35px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .doc-intro {
                    margin-bottom: 25px;
                    font-size: 15px;
                    line-height: 1.5;
                }
                .details-box {
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 20px 25px;
                    background: #f8fafc;
                    margin-bottom: 20px;
                }
                .details-box-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: ${isRestitution ? '#7f1d1d' : '#1e1b4b'};
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 8px;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    border-bottom: 1px dashed #e2e8f0;
                }
                .detail-row:last-child {
                    border-bottom: none;
                }
                .detail-lbl {
                    font-weight: 600;
                    color: #64748b;
                }
                .detail-val {
                    font-weight: 700;
                    color: #0f172a;
                    text-align: right;
                }
                .admin-comment-box {
                    border-left: 4px solid #10b981;
                    background: rgba(16, 185, 129, 0.05);
                    padding: 12px 20px;
                    border-radius: 0 8px 8px 0;
                    margin-bottom: 20px;
                    font-style: italic;
                    font-size: 13px;
                }
                .admin-comment-title {
                    font-weight: 700;
                    color: #065f46;
                    font-style: normal;
                    margin-bottom: 5px;
                    font-size: 13px;
                }
                .signature-section {
                    margin-top: auto;
                    padding: 25px 35px;
                    border-top: 1px solid #e2e8f0;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 35px;
                }
                .sig-box {
                    border: 1px dashed #cbd5e1;
                    border-radius: 8px;
                    padding: 15px 20px;
                    min-height: 110px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .sig-title {
                    font-weight: 700;
                    color: #475569;
                    font-size: 12px;
                    text-transform: uppercase;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 6px;
                    margin-bottom: 8px;
                }
                .sig-date {
                    font-size: 11px;
                    color: #94a3b8;
                    text-align: right;
                }
                .footer {
                    background: #0f172a;
                    color: #94a3b8;
                    text-align: center;
                    padding: 15px;
                    font-size: 11px;
                    letter-spacing: 0.5px;
                }
            </style>
        </head>
        <body>
            <div class="document-wrapper">
                ${isRestitution ? `
                <div style="position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); border: 4px dashed #dc2626; color: #dc2626; font-size: 32px; font-weight: 900; padding: 15px 30px; border-radius: 12px; opacity: 0.12; pointer-events: none; text-transform: uppercase; letter-spacing: 2px; text-align: center; z-index: 10;">
                    Restitution Validée<br>
                    <span style="font-size: 20px;">Contrat Clôturé</span>
                </div>
                ` : ''}

                <div class="header">
                    <img src="${logoUrl}" alt="Logo" class="logo-img" onerror="this.style.display='none'">
                    <div class="header-title">
                        <h1 class="main-hdr">${documentTitle}</h1>
                        <p class="sub-hdr">${documentSubHeader}</p>
                    </div>
                </div>
                
                <div class="metadata-bar">
                    <span>Réf : ${escapeHTML(ref)}</span>
                    ${isRestitution ? `
                    <span style="color: #dc2626; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                        🛑 FIN DE CONTRAT DE DECHARGE
                    </span>
                    ` : ''}
                    <span>Date d'attestation : ${processedDateStr}</span>
                </div>

                <div class="content-body">
                    <p class="doc-intro">
                        ${documentIntro}
                    </p>

                    <div class="details-box">
                        <div class="details-box-title">Détails de la demande</div>
                        <div class="detail-row">
                            <span class="detail-lbl">Bénéficiaire (Nom & Prénom):</span>
                            <span class="detail-val">${escapeHTML(req.fullname || req.username)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Service / Département:</span>
                            <span class="detail-val">${escapeHTML(req.dept || 'N/A')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Compte PIN Demandeur:</span>
                            <span class="detail-val">${escapeHTML(req.username)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Nature de l'opération:</span>
                            <span class="detail-val" style="color: ${themeColor}; font-weight: bold;">${typeLabel}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-lbl">Date de soumission:</span>
                            <span class="detail-val">${dateStr}</span>
                        </div>
                        ${detailsHtml}
                    </div>

                    ${req.adminComment ? `
                    <div class="admin-comment-box">
                        <div class="admin-comment-title"><i class="fas fa-comment-dots"></i> Commentaire / Note de l'Administrateur :</div>
                        <div>"${escapeHTML(req.adminComment)}"</div>
                    </div>
                    ` : ''}
                </div>

                <div class="signature-section">
                    <div class="sig-box">
                        <span class="sig-title">Le Collaborateur</span>
                        <span class="sig-date">Date et Signature</span>
                    </div>
                    <div class="sig-box">
                        <span class="sig-title">Le Service Informatique / Administrateur</span>
                        <span class="sig-date">Date, Cachet et Signature</span>
                    </div>
                </div>

                <div class="footer">
                    LABO NEDJMA © 2026 • Document généré électroniquement • LABO-IT CONTROL V2.9.10
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

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
}

function updateUserNotifications() {
    const badge = document.getElementById('userNotificationBadge');
    const list = document.getElementById('userNotificationList');
    if (!list) return;

    // Filter requests that are processed (approved or rejected)
    const processedRequests = userRequests.filter(req => req.status === 'approved' || req.status === 'rejected');
    
    // Load read notifications map from localStorage
    let readMap = {};
    try {
        readMap = JSON.parse(localStorage.getItem('readUserNotifications') || '{}');
    } catch(e) {}

    // Count unread
    const unreadRequests = processedRequests.filter(req => !readMap[req.id]);
    const unreadCount = unreadRequests.length;

    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (unreadRequests.length === 0) {
        list.innerHTML = `
            <div class="user-notification-empty">
                <i class="fas fa-bell-slash"></i>
                Aucune notification.
            </div>
        `;
        return;
    }

    // Sort by processing date (or created date if processing date not available)
    const sorted = [...unreadRequests].sort((a, b) => {
        const dateA = a.processedAt ? (a.processedAt.toDate ? a.processedAt.toDate() : new Date(a.processedAt)) : new Date(a.createdAt);
        const dateB = b.processedAt ? (b.processedAt.toDate ? b.processedAt.toDate() : new Date(b.processedAt)) : new Date(b.createdAt);
        return dateB - dateA;
    });

    let html = '';
    sorted.forEach(req => {
        const isUnread = !readMap[req.id];
        const dateStr = req.processedAt ? (req.processedAt.toDate ? req.processedAt.toDate().toLocaleDateString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : 'Récemment') : 'Récemment';
        const typeLabel = getRequestTypeLabel(req.type);
        
        let iconClass = 'fa-check';
        let iconBgClass = 'icon-bg-approved';
        let statusText = 'Approuvée';
        let statusBadgeClass = 'status-badge-approved';
        
        if (req.status === 'rejected') {
            iconClass = 'fa-times';
            iconBgClass = 'icon-bg-rejected';
            statusText = 'Rejetée';
            statusBadgeClass = 'status-badge-rejected';
        }

        const itemClass = isUnread ? 'user-notification-item unread' : 'user-notification-item';

        html += `
            <div onclick="clickUserNotification('${req.id}', '${req.type}')" class="${itemClass}">
                <div class="user-notification-icon-wrapper ${iconBgClass}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="user-notification-content">
                    <div class="user-notification-meta-top">
                        <span class="user-notification-id">Demande #${req.id.substring(0, 6)}</span>
                        <span class="status-badge-pill ${statusBadgeClass}" style="padding: 0.15rem 0.45rem !important; font-size: 0.68rem !important; display: inline-block;">${statusText}</span>
                    </div>
                    <p class="user-notification-message">
                        Votre dossier pour l'équipement <strong>${typeLabel}</strong> a été traité.
                    </p>
                    ${req.adminComment ? `
                        <div class="user-notification-comment">
                            <i class="fas fa-reply fa-flip-both" style="font-size: 0.72rem; color: var(--indigo-400); margin-right: 0.25rem;"></i>
                            <span>${escapeHTML(req.adminComment)}</span>
                        </div>
                    ` : ''}
                    <div class="user-notification-meta-bottom">
                        <span class="user-notification-category-tag ${req.type.includes('pc') ? 'cat-tag-pc' : 'cat-tag-phone'}">
                            <i class="fas ${req.type.includes('pc') ? 'fa-laptop' : 'fa-mobile-alt'}"></i> ${req.type.includes('pc') ? 'PC' : 'Mobile'}
                        </span>
                        <span class="user-notification-time">
                            <i class="far fa-clock"></i> ${dateStr}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function toggleUserNotificationDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('userNotificationDropdown');
    if (!dropdown) return;
    
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'block';
        updateUserNotifications();
    }
}

function markAllUserNotificationsRead() {
    let readMap = {};
    try {
        readMap = JSON.parse(localStorage.getItem('readUserNotifications') || '{}');
    } catch(e) {}

    userRequests.forEach(req => {
        if (req.status === 'approved' || req.status === 'rejected') {
            readMap[req.id] = true;
        }
    });

    localStorage.setItem('readUserNotifications', JSON.stringify(readMap));
    updateUserNotifications();
}

function clickUserNotification(requestId, requestType) {
    const dropdown = document.getElementById('userNotificationDropdown');
    if (dropdown) dropdown.style.display = 'none';

    // Mark this specific notification as read so it disappears from the list
    let readMap = {};
    try {
        readMap = JSON.parse(localStorage.getItem('readUserNotifications') || '{}');
    } catch(e) {}
    readMap[requestId] = true;
    localStorage.setItem('readUserNotifications', JSON.stringify(readMap));
    updateUserNotifications();

    let cat = requestType;
    if (requestType === 'decharge_pc' || requestType === 'decharge_mobile') {
        cat = 'decharge';
    } else if (requestType === 'fin_contrat_pc' || requestType === 'fin_contrat_mobile') {
        cat = 'restitution';
    }

    openUserRequestCategory(cat);
    selectedUserRequestId = requestId;
    renderUserRequestsTable();
}

// Window click listener to close collaborator notification dropdown
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('userNotificationDropdown');
    const container = document.getElementById('userNotificationsContainer');
    if (dropdown && container && !container.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

window.printCollaboratorRequestPDF = printCollaboratorRequestPDF;
window.enterSystem = enterSystem;
window.handleUserRequestSearch = handleUserRequestSearch;
window.changeUserRequestsPage = changeUserRequestsPage;
window.setUserRequestsPage = setUserRequestsPage;
window.openUserRequestForm = openUserRequestForm;
window.closeUserRequestForm = closeUserRequestForm;
window.openUserRequestCategory = openUserRequestCategory;
window.closeUserRequestCategory = closeUserRequestCategory;
window.openUserRequestFormView = openUserRequestFormView;
window.closeUserRequestFormView = closeUserRequestFormView;
window.handleMaterialTypeChange = handleMaterialTypeChange;
window.toggleUserNotificationDropdown = toggleUserNotificationDropdown;
window.markAllUserNotificationsRead = markAllUserNotificationsRead;
window.clickUserNotification = clickUserNotification;
window.updateUserNotifications = updateUserNotifications;
window.deleteUserRequest = deleteUserRequest;
window.selectSettingsPin = selectSettingsPin;
window.toggleRevealPin = toggleRevealPin;
window.enablePinEditing = enablePinEditing;
window.cancelPinEditing = cancelPinEditing;
window.saveSettingsPinEdit = saveSettingsPinEdit;
window.isPinLockedOut = isPinLockedOut;
window.startLockoutCountdown = startLockoutCountdown;
window.stopLockoutCountdown = stopLockoutCountdown;
window.isAdminLockedOut = isAdminLockedOut;
window.startAdminLockoutCountdown = startAdminLockoutCountdown;
window.stopAdminLockoutCountdown = stopAdminLockoutCountdown;

// ============ MODULE: RAMES DE PAPIER LOGIC ============
function showPaperView() {
    activePaperFilters = { search: '', format: '', alertOnly: false };
    activePaperId = null;
    
    const searchInput = document.getElementById('paperSearchInput');
    if (searchInput) searchInput.value = '';
    
    const panelEmpty = document.getElementById('paperDetailsEmpty');
    const panelContent = document.getElementById('paperDetailsContent');
    if (panelEmpty) panelEmpty.style.display = 'flex';
    if (panelContent) panelContent.style.display = 'none';

    showView('paperReamsView');
}

function clearPaperFilters() {
    activePaperFilters = { search: '', format: '', alertOnly: false };
    const searchInput = document.getElementById('paperSearchInput');
    if (searchInput) searchInput.value = '';
    renderPaperTable();
}

function filterPaperByFormat(format) {
    activePaperFilters.format = format;
    activePaperFilters.alertOnly = false;
    renderPaperTable();
}

function filterPaperAlerts() {
    activePaperFilters.format = '';
    activePaperFilters.alertOnly = true;
    renderPaperTable();
}

function updatePaperStats() {
    let totalCartons = 0;
    let alertsCount = 0;

    paperInventory.forEach(item => {
        totalCartons += item.qty;
        if (item.qty <= item.threshold) {
            alertsCount++;
        }
    });

    // Calculate current calendar month's paper consumption (Sorties only)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let monthlyConsumption = 0;

    paperMovements.forEach(m => {
        if (m.type === 'Sortie') {
            const mDate = m.timestamp ? (m.timestamp.toDate ? m.timestamp.toDate() : new Date()) : new Date(m.date);
            if (mDate.getFullYear() === currentYear && mDate.getMonth() === currentMonth) {
                monthlyConsumption += m.qty;
            }
        }
    });

    const statTotal = document.getElementById('paperStatTotal');
    const statMonthQty = document.getElementById('paperStatMonthQty');
    const statAlerts = document.getElementById('paperStatAlerts');
    const moduleBadge = document.getElementById('modulePaperBadge');

    if (statTotal) statTotal.textContent = totalCartons;
    if (statMonthQty) statMonthQty.textContent = monthlyConsumption;
    if (statAlerts) statAlerts.textContent = alertsCount;
    if (moduleBadge) moduleBadge.textContent = totalCartons + ' Cartons';
}

function renderPaperTable() {
    const tableBody = document.getElementById('paperTableBody');
    if (!tableBody) return;

    const searchInput = document.getElementById('paperSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = paperInventory.filter(item => {
        const matchesSearch = item.marque.toLowerCase().includes(query) || item.format.toLowerCase().includes(query);
        const matchesFormat = !activePaperFilters.format || item.format === activePaperFilters.format;
        const matchesAlert = !activePaperFilters.alertOnly || (item.qty <= item.threshold);
        return matchesSearch && matchesFormat && matchesAlert;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    Aucun format trouvé correspondant aux filtres.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map(item => {
        const isAlert = item.qty <= item.threshold;
        const rowStyle = isAlert ? 'background-color: rgba(239, 68, 68, 0.05); border-left: 3px solid var(--red-500);' : '';
        const qtyStyle = isAlert ? 'color: var(--red-500); font-weight: bold;' : 'font-weight: 600;';
        
        return `
            <tr style="cursor: pointer; ${rowStyle}" onclick="selectPaper('${item.id}', event)">
                <td style="font-weight: 700; color: var(--text-primary);">${escapeHTML(item.marque)}</td>
                <td><span class="badge badge-indigo">${escapeHTML(item.format)}</span></td>
                <td style="${qtyStyle}">${item.qty} Cartons</td>
                <td><span style="font-size: 0.85rem; color: var(--text-muted);">${item.threshold}</span></td>
                <td><i class="fas fa-map-pin" style="margin-right: 4px; color: var(--text-muted); font-size: 0.8rem;"></i>${escapeHTML(item.location || 'N/A')}</td>
                <td>
                    <div style="display: flex; gap: 0.4rem; justify-content: center;" class="action-btns">
                        <button onclick="openPaperModal('${item.id}', event)" class="btn btn-outline" style="padding: 0.35rem 0.6rem; border-radius: 0.4rem;" title="Modifier">
                            <i class="fas fa-edit" style="color: var(--blue-500); font-size: 0.85rem;"></i>
                        </button>
                        <button onclick="deletePaper('${item.id}', event)" class="btn btn-outline" style="padding: 0.35rem 0.6rem; border-radius: 0.4rem;" title="Supprimer">
                            <i class="fas fa-trash-alt" style="color: var(--red-500); font-size: 0.85rem;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function selectPaper(id, event) {
    if (event && event.target.closest('.action-btns, button, select, input, a')) {
        return;
    }
    activePaperId = id;
    
    // Highlight table row
    const tableBody = document.getElementById('paperTableBody');
    if (tableBody) {
        const rows = tableBody.getElementsByTagName('tr');
        for (let row of rows) {
            row.classList.remove('selected-row');
        }
    }
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected-row');
    }

    const panelEmpty = document.getElementById('paperDetailsEmpty');
    const panelContent = document.getElementById('paperDetailsContent');
    if (panelEmpty) panelEmpty.style.display = 'none';
    if (panelContent) panelContent.style.display = 'block';

    updatePaperDetailsPanel(id);
    renderPaperMovementsTable(id);
}

function updatePaperDetailsPanel(id) {
    const item = paperInventory.find(p => p.id === id);
    if (!item) {
        const panelEmpty = document.getElementById('paperDetailsEmpty');
        const panelContent = document.getElementById('paperDetailsContent');
        if (panelEmpty) panelEmpty.style.display = 'flex';
        if (panelContent) panelContent.style.display = 'none';
        return;
    }

    const detailMarque = document.getElementById('detailPaperMarque');
    const detailFormat = document.getElementById('detailPaperFormat');
    const detailStock = document.getElementById('detailPaperStock');
    const detailThreshold = document.getElementById('detailPaperThreshold');
    const detailAlertBadge = document.getElementById('detailPaperAlertBadge');

    if (detailMarque) detailMarque.textContent = item.marque;
    if (detailFormat) detailFormat.textContent = 'Format: ' + item.format;
    if (detailStock) detailStock.innerHTML = `${item.qty} <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-muted);">Cartons</span>`;
    
    if (detailThreshold) detailThreshold.textContent = item.threshold;
    if (detailAlertBadge) {
        if (item.qty <= item.threshold) {
            detailAlertBadge.style.display = 'inline-flex';
        } else {
            detailAlertBadge.style.display = 'none';
        }
    }
}

function openPaperModal(id, event) {
    if (event) event.stopPropagation();
    
    const form = document.getElementById('paperForm');
    if (form) form.reset();

    const title = document.getElementById('paperModalTitle');
    const formId = document.getElementById('paperFormId');
    const initStockGroup = document.getElementById('paperInitialStockGroup');

    if (id) {
        const item = paperInventory.find(p => p.id === id);
        if (!item) return;

        if (title) title.innerHTML = `<i class="fas fa-edit" style="color: var(--blue-500);"></i> Modifier l'article`;
        if (formId) formId.value = item.id;
        if (initStockGroup) initStockGroup.style.display = 'none'; // Hide initial stock input during edit

        document.getElementById('paperFormMarque').value = item.marque;
        document.getElementById('paperFormFormat').value = item.format;
        document.getElementById('paperFormThreshold').value = item.threshold;
        document.getElementById('paperFormLocation').value = item.location;
        document.getElementById('paperFormNotes').value = item.notes;
    } else {
        if (title) title.innerHTML = `<i class="fas fa-plus-circle" style="color: #10b981;"></i> Ajouter un format de papier`;
        if (formId) formId.value = '';
        if (initStockGroup) initStockGroup.style.display = 'block';
    }

    showView('paperFormView');
}

function closePaperModal() {
    showView('paperReamsView');
}

function savePaper(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('paperFormId').value;
    const marque = document.getElementById('paperFormMarque').value.trim();
    const format = document.getElementById('paperFormFormat').value;
    const threshold = parseInt(document.getElementById('paperFormThreshold').value) || 5;
    const location = document.getElementById('paperFormLocation').value.trim();
    const notes = document.getElementById('paperFormNotes').value.trim();

    if (!marque || !location) {
        showToast("⚠️ Veuillez remplir tous les champs obligatoires", "orange");
        return;
    }

    const paperData = {
        marque,
        format,
        threshold,
        location,
        notes,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        // Edit existing
        db.collection("paperInventory").doc(id).update(paperData)
            .then(() => {
                logActivity('STOCKS', 'MODIFICATION_PAPIER', `Papier modifié: ${marque} (${format})`);
                showToast("✨ Article mis à jour avec succès !", "green");
                closePaperModal();
            })
            .catch(error => {
                console.error("Error updating paper:", error);
                showToast("❌ Erreur lors de la modification de l'article", "red");
            });
    } else {
        // Create new
        const initialQty = parseInt(document.getElementById('paperFormQty').value) || 0;
        paperData.qty = initialQty;
        paperData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

        db.collection("paperInventory").add(paperData)
            .then((docRef) => {
                logActivity('STOCKS', 'CREATION_PAPIER', `Papier créé: ${marque} (${format}), Stock initial: ${initialQty}`);
                
                // If initial qty > 0, log initial movement
                if (initialQty > 0) {
                    db.collection("paperMovements").add({
                        paperId: docRef.id,
                        type: 'Entree',
                        qty: initialQty,
                        recipient: 'Stock Initial',
                        notes: 'Initialisation du stock lors de la création de la fiche.',
                        user: auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : 'Technicien',
                        date: new Date().toISOString().split('T')[0],
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                showToast("🎉 Nouveau format ajouté avec succès !", "green");
                closePaperModal();
            })
            .catch(error => {
                console.error("Error creating paper:", error);
                showToast("❌ Erreur lors de la création de l'article", "red");
            });
    }
}

function deletePaper(id, event) {
    if (event) event.stopPropagation();

    const item = paperInventory.find(p => p.id === id);
    if (!item) return;

    showCustomConfirm(
        "Supprimer définitivement l'article",
        `Voulez-vous vraiment supprimer définitivement l'article "${item.marque} (${item.format})" ? Tous les mouvements historiques associés seront perdus.`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }

            db.collection("paperInventory").doc(id).delete()
                .then(() => {
                    logActivity('STOCKS', 'SUPPRESSION_PAPIER', `Papier supprimé: ${item.marque} (${item.format})`);
                    showToast("🗑️ Article supprimé avec succès !", "green");
                    
                    // If activePaperId is the one deleted, clear selection
                    if (activePaperId === id) {
                        activePaperId = null;
                        const panelEmpty = document.getElementById('paperDetailsEmpty');
                        const panelContent = document.getElementById('paperDetailsContent');
                        if (panelEmpty) panelEmpty.style.display = 'flex';
                        if (panelContent) panelContent.style.display = 'none';
                    }

                    // Delete associated movements as well
                    db.collection("paperMovements").where("paperId", "==", id).get()
                        .then(snapshot => {
                            const batch = db.batch();
                            snapshot.docs.forEach(doc => {
                                batch.delete(doc.ref);
                            });
                            batch.commit();
                        });
                })
                .catch(error => {
                    console.error("Error deleting paper:", error);
                    showToast("❌ Erreur lors de la suppression de l'article", "red");
                });
        },
        null,
        true // delete style
    );
}

function editPaperFromDetails() {
    if (activePaperId) {
        openPaperModal(activePaperId);
    }
}

function deletePaperFromDetails() {
    if (activePaperId) {
        deletePaper(activePaperId);
    }
}

function quickUpdatePaperStock(id, delta) {
    const item = paperInventory.find(p => p.id === id);
    if (!item) return;

    const newQty = item.qty + delta;
    if (newQty < 0) {
        showToast("⚠️ Stock insuffisant pour réaliser cette opération", "orange");
        return;
    }

    const type = delta > 0 ? 'Entree' : 'Sortie';
    const absDelta = Math.abs(delta);
    const username = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : 'Technicien';
    const dateStr = new Date().toISOString().split('T')[0];

    db.runTransaction(transaction => {
        const paperRef = db.collection("paperInventory").doc(id);
        return transaction.get(paperRef).then(sfDoc => {
            if (!sfDoc.exists) {
                throw "Document does not exist!";
            }
            const currentQty = sfDoc.data().qty || 0;
            const updatedQty = currentQty + delta;
            if (updatedQty < 0) {
                throw "Stock insuffisant";
            }
            transaction.update(paperRef, { 
                qty: updatedQty,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
            return updatedQty;
        });
    })
    .then(() => {
        // Add log entry
        db.collection("paperMovements").add({
            paperId: id,
            type: type,
            qty: absDelta,
            recipient: type === 'Entree' ? 'Réapprovisionnement' : 'Saisie Rapide',
            notes: `Mouvement rapide de ${absDelta} carton(s) (${type === 'Entree' ? 'Ajout' : 'Retrait'}).`,
            user: username,
            date: dateStr,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        logActivity('STOCKS', 'MOUVEMENT_RAPIDE_PAPIER', `Mouvement rapide papier ${item.marque} (${item.format}): ${delta > 0 ? '+' : ''}${delta} cartons`);
        showToast(`⚡ Stock mis à jour: ${delta > 0 ? '+' : ''}${delta} Carton(s) !`, "green");
    })
    .catch(error => {
        console.error("Quick stock update failed:", error);
        showToast("❌ Erreur lors de la mise à jour rapide", "red");
    });
}

function openPaperMovementModal(type) {
    if (!activePaperId) return;
    
    const item = paperInventory.find(p => p.id === activePaperId);
    if (!item) return;

    const form = document.getElementById('paperMovementForm');
    if (form) form.reset();

    const titleIcon = document.getElementById('paperMovementTitleIcon');
    const titleText = document.getElementById('paperMovementTitleText');
    const movementTypeInput = document.getElementById('paperMovementType');
    const labelInput = document.getElementById('paperMovementLabel');
    const recipientGroup = document.getElementById('paperMovementRecipientGroup');
    const submitBtn = document.getElementById('paperMovementSubmitBtn');

    if (movementTypeInput) movementTypeInput.value = type;
    if (labelInput) labelInput.value = `${item.marque} (${item.format})`;

    if (type === 'Entree') {
        if (titleIcon) {
            titleIcon.className = 'fas fa-circle-arrow-down';
            titleIcon.style.color = '#10b981';
        }
        if (titleText) titleText.textContent = 'Enregistrer une Entrée de Papier';
        if (recipientGroup) recipientGroup.style.display = 'none';
        if (submitBtn) {
            submitBtn.style.background = 'var(--gradient-emerald-teal)';
            submitBtn.textContent = 'Enregistrer l\'Entrée';
        }
    } else {
        if (titleIcon) {
            titleIcon.className = 'fas fa-circle-arrow-up';
            titleIcon.style.color = 'var(--red-500)';
        }
        if (titleText) titleText.textContent = 'Enregistrer une Sortie de Papier';
        if (recipientGroup) recipientGroup.style.display = 'block';
        if (submitBtn) {
            submitBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            submitBtn.textContent = 'Valider la Sortie';
        }
    }

    const modal = document.getElementById('paperMovementModal');
    if (modal) modal.classList.add('modal-active');
}

function closePaperMovementModal() {
    const modal = document.getElementById('paperMovementModal');
    if (modal) modal.classList.remove('modal-active');
}

function savePaperMovement(event) {
    if (event) event.preventDefault();

    if (!activePaperId) return;
    const item = paperInventory.find(p => p.id === activePaperId);
    if (!item) return;

    const type = document.getElementById('paperMovementType').value;
    const qty = parseInt(document.getElementById('paperMovementQty').value) || 0;
    const recipient = type === 'Sortie' ? document.getElementById('paperMovementRecipient').value.trim() : 'Réapprovisionnement';
    const notes = document.getElementById('paperMovementNotes').value.trim();

    if (qty <= 0) {
        showToast("⚠️ La quantité doit être supérieure à 0", "orange");
        return;
    }

    if (type === 'Sortie' && !recipient) {
        showToast("⚠️ Veuillez renseigner le service bénéficiaire", "orange");
        return;
    }

    if (type === 'Sortie' && qty > item.qty) {
        showToast(`⚠️ Stock insuffisant. Quantité disponible: ${item.qty} cartons`, "orange");
        return;
    }

    const delta = type === 'Entree' ? qty : -qty;
    const username = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : 'Technicien';
    const dateStr = new Date().toISOString().split('T')[0];

    db.runTransaction(transaction => {
        const paperRef = db.collection("paperInventory").doc(activePaperId);
        return transaction.get(paperRef).then(sfDoc => {
            if (!sfDoc.exists) {
                throw "Document does not exist!";
            }
            const currentQty = sfDoc.data().qty || 0;
            const updatedQty = currentQty + delta;
            if (updatedQty < 0) {
                throw "Stock insuffisant";
            }
            transaction.update(paperRef, { 
                qty: updatedQty,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
            return updatedQty;
        });
    })
    .then(() => {
        // Add movement log
        db.collection("paperMovements").add({
            paperId: activePaperId,
            type: type,
            qty: qty,
            recipient: recipient,
            notes: notes,
            user: username,
            date: dateStr,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        logActivity('STOCKS', 'MOUVEMENT_PAPIER', `Opération ${type} sur papier ${item.marque} (${item.format}): ${qty} cartons`);
        showToast("✅ Mouvement de stock enregistré !", "green");
        closePaperMovementModal();
    })
    .catch(error => {
        console.error("Paper movement transaction failed:", error);
        showToast("❌ Erreur lors de l'enregistrement", "red");
    });
}

function renderPaperMovementsTable(paperId) {
    const tableBody = document.getElementById('paperMovementTableBody');
    if (!tableBody) return;

    const filtered = paperMovements.filter(m => m.paperId === paperId);

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
                    Aucun mouvement enregistré pour cet article.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map(m => {
        const badgeClass = m.type === 'Entree' ? 'badge-emerald' : 'badge-red';
        const typeText = m.type === 'Entree' ? 'Entrée' : 'Sortie';
        const dateObj = m.timestamp ? (m.timestamp.toDate ? m.timestamp.toDate() : new Date()) : new Date(m.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        
        return `
            <tr>
                <td><span class="badge ${badgeClass}">${typeText}</span></td>
                <td style="font-weight: 600;">${m.qty} Cartons</td>
                <td style="white-space: normal; word-break: break-word;">
                    <span style="font-weight: 600; display:block; white-space: normal;">${escapeHTML(m.recipient)}</span>
                    <span style="font-size: 0.72rem; color: var(--text-muted); display: block; white-space: normal; line-height: 1.3;">${escapeHTML(m.notes || '')}</span>
                </td>
                <td style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">${dateStr}</td>
            </tr>
        `;
    }).join('');
}

window.showPaperView = showPaperView;
window.clearPaperFilters = clearPaperFilters;
window.filterPaperByFormat = filterPaperByFormat;
window.filterPaperAlerts = filterPaperAlerts;
window.renderPaperTable = renderPaperTable;
window.selectPaper = selectPaper;
window.openPaperModal = openPaperModal;
window.closePaperModal = closePaperModal;
window.savePaper = savePaper;
window.deletePaper = deletePaper;
window.editPaperFromDetails = editPaperFromDetails;
window.deletePaperFromDetails = deletePaperFromDetails;
window.quickUpdatePaperStock = quickUpdatePaperStock;
window.openPaperMovementModal = openPaperMovementModal;
window.closePaperMovementModal = closePaperMovementModal;
window.savePaperMovement = savePaperMovement;

function refreshHistoryInfoFields() {
    if (!activePaperId) return;
    const currentItem = paperInventory.find(p => p.id === activePaperId);
    if (!currentItem) return;

    const stockActuelEl = document.getElementById('historyPaperStockActuel');
    if (stockActuelEl) stockActuelEl.textContent = currentItem.qty;

    const infoMarque = document.getElementById('historyInfoMarque');
    if (infoMarque) infoMarque.textContent = currentItem.marque;

    const infoLocation = document.getElementById('historyInfoLocation');
    if (infoLocation) infoLocation.textContent = currentItem.location || 'Non spécifié';

    const infoThreshold = document.getElementById('historyInfoThreshold');
    if (infoThreshold) infoThreshold.textContent = `${currentItem.threshold || 5} Cartons`;

    const statusBadge = document.getElementById('historyInfoStatusBadge');
    if (statusBadge) {
        if (currentItem.qty === 0) {
            statusBadge.className = 'badge badge-red';
            statusBadge.style.background = '';
            statusBadge.style.color = '';
            statusBadge.style.border = '';
            statusBadge.textContent = 'Rupture de Stock';
        } else if (currentItem.qty <= currentItem.threshold) {
            statusBadge.className = 'badge';
            statusBadge.style.background = 'rgba(245, 158, 11, 0.12)';
            statusBadge.style.color = '#d97706';
            statusBadge.style.border = '1px solid rgba(245, 158, 11, 0.2)';
            statusBadge.textContent = 'Seuil Critique';
        } else {
            statusBadge.className = 'badge badge-emerald';
            statusBadge.style.background = '';
            statusBadge.style.color = '';
            statusBadge.style.border = '';
            statusBadge.textContent = 'Stock Suffisant';
        }
    }

    const infoNotes = document.getElementById('historyInfoNotes');
    if (infoNotes) infoNotes.textContent = currentItem.notes || 'Aucune note ou remarque enregistrée pour cet article.';
}

function openFullPaperHistory() {
    if (!activePaperId) {
        showToast("⚠️ Aucun article sélectionné", "orange");
        return;
    }
    const item = paperInventory.find(p => p.id === activePaperId);
    if (!item) return;

    // Set title and subtitle
    const titleEl = document.getElementById('historyPaperMarqueTitle');
    const subtitleEl = document.getElementById('historyPaperFormatSubtitle');
    if (titleEl) titleEl.textContent = `Historique complet : ${item.marque}`;
    if (subtitleEl) subtitleEl.textContent = `Format : ${escapeHTML(item.format)} - Stock actuel : ${item.qty} Cartons`;

    // Refresh general metadata immediately
    refreshHistoryInfoFields();

    // Show loading state
    const tableBody = document.getElementById('paperFullHistoryTableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class="fas fa-circle-notch fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                    Chargement de l'historique complet...
                </td>
            </tr>
        `;
    }

    // Unsubscribe previous if exists
    if (unsubPaperFullHistory) {
        unsubPaperFullHistory();
        unsubPaperFullHistory = null;
    }

    // Start Realtime listener for movements of this paperId
    unsubPaperFullHistory = db.collection("paperMovements")
        .where("paperId", "==", activePaperId)
        .onSnapshot((snapshot) => {
            paperFullHistoryItems = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    paperId: data.paperId || '',
                    type: data.type || '',
                    qty: typeof data.qty === 'number' ? data.qty : 0,
                    reason: data.reason || '',
                    operator: data.operator || 'Système',
                    timestamp: data.timestamp || null
                };
            });

            // Sort in memory by timestamp desc to avoid composite index error
            paperFullHistoryItems.sort((a, b) => {
                const tA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : 0;
                const tB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : 0;
                return tB - tA;
            });

            // Update stats cards in the history view
            let totalEntries = 0;
            let totalExits = 0;
            let monthSorties = 0;

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();

            paperFullHistoryItems.forEach(m => {
                if (m.type === 'Entree') {
                    totalEntries += m.qty;
                } else if (m.type === 'Sortie') {
                    totalExits += m.qty;
                    const date = m.timestamp ? (m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp)) : null;
                    if (date && date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
                        monthSorties += m.qty;
                    }
                }
            });

            const entriesEl = document.getElementById('historyPaperTotalEntries');
            const exitsEl = document.getElementById('historyPaperTotalExits');
            const consomMoisEl = document.getElementById('historyPaperConsomMois');
            if (entriesEl) entriesEl.textContent = totalEntries;
            if (exitsEl) exitsEl.textContent = totalExits;
            if (consomMoisEl) consomMoisEl.textContent = monthSorties;

            // Also keep the specs panel sync'd with latest stock qty
            refreshHistoryInfoFields();

            // Render table
            if (tableBody) {
                if (paperFullHistoryItems.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                                Aucun mouvement de stock enregistré pour cet article.
                            </td>
                        </tr>
                    `;
                    return;
                }

                tableBody.innerHTML = paperFullHistoryItems.map(m => {
                    const typeBadge = m.type === 'Entree'
                        ? `<span class="badge badge-emerald" style="padding: 0.25rem 0.5rem; border-radius: 0.35rem; font-size: 0.75rem;"><i class="fas fa-arrow-down" style="margin-right: 4px;"></i>Entrée</span>`
                        : `<span class="badge badge-rose" style="padding: 0.25rem 0.5rem; border-radius: 0.35rem; font-size: 0.75rem;"><i class="fas fa-arrow-up" style="margin-right: 4px;"></i>Sortie</span>`;

                    let dateStr = 'N/A';
                    if (m.timestamp) {
                        const date = m.timestamp.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
                        dateStr = date.toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }

                    return `
                        <tr>
                            <td>${typeBadge}</td>
                            <td style="font-weight: 700; color: var(--text-primary);">${m.qty} Cartons</td>
                            <td style="white-space: normal !important; word-break: break-word !important; min-width: 150px;">${escapeHTML(m.reason || 'N/A')}</td>
                            <td style="color: var(--text-secondary); font-weight: 500;">${escapeHTML(m.operator)}</td>
                            <td style="color: var(--text-muted); font-size: 0.85rem;">${dateStr}</td>
                            <td style="text-align: center;">
                                <button onclick="deletePaperMovement('${m.id}', event)" class="btn btn-outline" style="padding: 0.35rem 0.6rem; border-radius: 0.4rem;" title="Annuler ce mouvement et réajuster le stock">
                                    <i class="fas fa-trash-alt" style="color: var(--red-500); font-size: 0.85rem;"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }, (error) => {
            console.error("Firestore paper full history listener error:", error);
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--red-500);">
                            ❌ Erreur de chargement: ${error.message}
                        </td>
                    </tr>
                `;
            }
        });

    showView('paperHistoryView');
}

window.refreshHistoryInfoFields = refreshHistoryInfoFields;

function deletePaperMovement(movementId, event) {
    if (event) event.stopPropagation();

    const m = paperFullHistoryItems.find(x => x.id === movementId);
    if (!m) return;

    showCustomConfirm(
        "Annuler le Mouvement de Stock",
        `Voulez-vous vraiment annuler ce mouvement de stock (${m.type === 'Entree' ? 'Entrée' : 'Sortie'} de ${m.qty} cartons) ? Le stock de cet article sera automatiquement réajusté en conséquence.`,
        function () {
            if (!auth.currentUser) {
                showToast("⚠️ Vous devez être connecté pour effectuer cette action", "red");
                return;
            }

            const paperRef = db.collection("paperInventory").doc(m.paperId);
            const movementRef = db.collection("paperMovements").doc(movementId);

            db.runTransaction((transaction) => {
                return transaction.get(paperRef).then((paperDoc) => {
                    if (!paperDoc.exists) {
                        throw "L'article de papier associé n'existe plus.";
                    }
                    const paperData = paperDoc.data();
                    const currentQty = typeof paperData.qty === 'number' ? paperData.qty : 0;
                    let newQty = currentQty;
                    if (m.type === 'Entree') {
                        newQty = currentQty - m.qty;
                    } else {
                        newQty = currentQty + m.qty;
                    }

                    transaction.update(paperRef, {
                        qty: newQty,
                        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    transaction.delete(movementRef);
                    return { marque: paperData.marque, newQty };
                });
            })
            .then((result) => {
                logActivity('STOCKS', 'ANNULATION_MOUVEMENT', `Mouvement annulé: ${m.type} de ${m.qty} cartons pour ${result.marque}. Nouveau stock: ${result.newQty}`);
                showToast("🗑️ Mouvement annulé et stock ajusté !", "blue");
                
                // Update active subtitle immediately
                const subtitleEl = document.getElementById('historyPaperFormatSubtitle');
                if (subtitleEl) {
                    const item = paperInventory.find(p => p.id === activePaperId);
                    const formatStr = item ? item.format : 'A4';
                    subtitleEl.textContent = `Format : ${formatStr} - Stock actuel : ${result.newQty} Cartons`;
                }
            })
            .catch((error) => {
                console.error("Error reverting movement:", error);
                showToast("❌ Échec de l'annulation: " + error, "red");
            });
        },
        null,
        true // delete style confirm button (red background)
    );
}

window.openFullPaperHistory = openFullPaperHistory;
window.deletePaperMovement = deletePaperMovement;
window.stopAdminLockoutCountdown = stopAdminLockoutCountdown;

window.addEventListener('load', () => {
    if (window.isPinLockedOut && window.isPinLockedOut()) {
        window.startLockoutCountdown();
    }
    if (window.isAdminLockedOut && window.isAdminLockedOut()) {
        window.startAdminLockoutCountdown();
    }
});


