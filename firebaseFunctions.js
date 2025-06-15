// firebaseFunctions.js
// Tento soubor obsahuje logiku pro Firebase Firestore a Firebase Messaging.

// !!! Zde je tvůj kompletní konfigurační objekt z Firebase Console !!!
// Ujisti se, že tento objekt je přesný a obsahuje 'messagingSenderId'.
const firebaseConfig = {
    apiKey: "AIzaSyBCIHWbqCFJcCiuY-HFM3btTzUsByduluY",
    authDomain: "moje-vaha-beta-2.firebaseapp.com",
    projectId: "moje-vaha-beta-2",
    storageBucket: "moje-vaha-beta-2.firebasestorage.app",
    messagingSenderId: "870509063847",
    appId: "1:870509063847:web:6e0f922a1b8637e2713582"
    //measurementId: "G-D9FCW0YC2K" // Pokud nepoužíváš Analytics, může být zakomentováno
};

// Log pro potvrzení, že firebaseConfig byl načten
console.log("firebaseFunctions.js: Konfigurační objekt Firebase načten a připraven.", firebaseConfig.projectId);

let db; // Proměnná pro instanci Firestore databáze
let messaging; // Proměnná pro instanci Firebase Messaging

window.initializeFirebaseApp = function() {
    console.log("initializeFirebaseApp: Spuštěna inicializace Firebase aplikace.");
    // Kontrolujeme, zda je globální objekt firebase a jeho metody dostupné.
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        console.error("initializeFirebaseApp: Firebase SDK není načteno. Nelze inicializovat.");
        return false;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("initializeFirebaseApp: Firebase aplikace inicializována.");
    } else {
        console.log("initializeFirebaseApp: Firebase aplikace již byla inicializována (přeskakuji).");
    }
    
    // Získáme instanci Firestore databáze
    db = firebase.firestore();
    console.log("initializeFirebaseApp: Firestore databáze připravena.");

    // --- Inicializace Firebase Messaging ---
    // Kontroluje, zda prohlížeč podporuje messaging a service workers
    if (firebase.messaging.isSupported()) {
        messaging = firebase.messaging();
        // Nastaví Service Worker pro Messaging.
        // Důležité: 'getRegistration()' získá odkaz na již zaregistrovaný service worker.
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration) {
                messaging.useServiceWorker(registration);
                console.log("initializeFirebaseApp: Firebase Messaging Service Worker nastaven.");
                
                // Můžete zde také naslouchat zprávám, když je aplikace na popředí
                // messaging.onMessage((payload) => {
                //     console.log('Zpráva přijata (popředí):', payload);
                //     window.showNotification(payload.notification.title + ": " + payload.notification.body, 5000);
                // });

            } else {
                console.warn("initializeFirebaseApp: Service Worker ještě není zaregistrován. Messaging nemusí fungovat správně na pozadí.");
            }
        }).catch(error => {
            console.error("initializeFirebaseApp: Chyba při získávání Service Worker registrace pro Messaging:", error);
        });
    } else {
        console.warn("initializeFirebaseApp: Firebase Messaging není v tomto prohlížeči podporováno.");
    }
    // --- Konec inicializace Firebase Messaging ---

    return true; // Signalizuje úspěšnou inicializaci
};

// --- NOVÁ FUNKCE: Žádost o povolení notifikací a získání tokenu ---
window.requestNotificationPermission = async function() {
    console.log("requestNotificationPermission: Žádám o povolení notifikací...");
    // Zde se ujistěte, že 'messaging' instance je dostupná
    if (!messaging) {
        console.error("requestNotificationPermission: Firebase Messaging není inicializováno.");
        window.showNotification("Chyba: Služba upozornění není dostupná. Zkuste aktualizovat stránku.", 4000);
        return null;
    }
    
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('requestNotificationPermission: Povolení pro notifikace uděleno.');
            // Získání a uložení zařízení registračního tokenu (FCM token)
            const token = await messaging.getToken();
            console.log('requestNotificationPermission: FCM zařízení registrační token:', token);
            
            // VOLITELNÉ: Zde můžete uložit tento token do Firestore
            // např. do speciální kolekce 'notificationTokens', abyste mohli cílit na konkrétní uživatele
            // nebo si token zapsat pro budoucí ruční odesílání notifikací z vlastního serveru.
            // Příklad uložení do Firestore:
            try {
                await db.collection('notificationTokens').doc(token).set({ 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    deviceType: navigator.userAgent // pro debug
                }, { merge: true }); // merge: true aktualizuje, pokud token existuje
                console.log("requestNotificationPermission: FCM token úspěšně uložen do Firestore.");
            } catch (dbError) {
                console.error("requestNotificationPermission: Chyba při ukládání FCM tokenu do Firestore:", dbError);
                window.showNotification("Chyba při ukládání tokenu pro notifikace do databáze.", 4000);
            }

            window.showNotification('Upozornění budou nyní aktivní!', 3000);
            return token;
        } else {
            console.warn('requestNotificationPermission: Povolení pro notifikace zamítnuto.');
            window.showNotification('Upozornění jsou vypnuta. Můžete je povolit v nastavení prohlížeče.', 5000);
            return null;
        }
    } catch (error) {
        console.error('requestNotificationPermission: Chyba při získávání tokenu pro notifikace:', error);
        window.showNotification('Chyba při povolování upozornění.', 4000);
        return null;
    }
};

// --- FUNKCE PRO UKLÁDÁNÍ A NAČÍTÁNÍ VÁHOVÝCH ZÁZNAMŮ (weightLog) ---

window.saveWeightLogToFirestore = async function(weightLogArray) {
    console.log("saveWeightLogToFirestore: Pokus o uložení dat weightLog do Firestore.", weightLogArray);
    if (!db) {
        console.error("saveWeightLogToFirestore: Firestore databáze není inicializována, nelze uložit data.");
        throw new Error("Firestore databáze není připravena k uložení dat.");
    }

    if (!weightLogArray || weightLogArray.length === 0) {
        console.warn("saveWeightLogToFirestore: Pole weightLog k uložení je prázdné. Mažu kolekci 'weightEntries'.");
        await window.clearCollection('weightEntries'); // Voláme novou pomocnou funkci
        return;
    }

    const batch = db.batch();
    console.log("saveWeightLogToFirestore: Vytvářím dávku pro zápis weightLog.");

    // Smazání všech existujících dokumentů v kolekci 'weightEntries' před nahráním nových
    // To zajistí, že data ve Firestore přesně odpovídají lokálnímu 'weightLog'
    const existingDocsSnapshot = await db.collection('weightEntries').get();
    existingDocsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    console.log(`saveWeightLogToFirestore: Přidáno ${existingDocsSnapshot.size} existujících dokumentů weightLog do dávky ke smazání.`);


    weightLogArray.forEach(entry => {
        const docRef = db.collection('weightEntries').doc(entry.date); // Datum jako ID dokumentu
        console.log(`saveWeightLogToFirestore: Přidávám dokument pro datum: ${entry.date} do dávky.`);
        batch.set(docRef, {
            date: entry.date,
            weight: entry.weight,
            bodyFat: entry.bodyFat,
            muscleMass: entry.muscleMass,
            bodyWater: entry.bodyWater,
            manualBMR: entry.manualBMR,
            manualAMR: entry.manualAMR,
            notes: entry.notes || '',
        });
    });

    try {
        console.log("saveWeightLogToFirestore: Odesílám dávku weightLog k zápisu.");
        await batch.commit();
        console.log("saveWeightLogToFirestore: Data weightLog úspěšně uložena do Firestore.");
        return true;
    } catch (error) {
        console.error("saveWeightLogToFirestore: Chyba při ukládání dat weightLog do Firestore:", error);
        throw error;
    }
};

window.loadWeightLogFromFirestore = async function() {
    console.log("loadWeightLogFromFirestore: Pokus o načtení dat weightLog z Firestore.");
    if (!db) {
        console.error("loadWeightLogFromFirestore: Firestore databáze není inicializována, nelze načíst data.");
        return [];
    }

    try {
        console.log("loadWeightLogFromFirestore: Načítám snímek kolekce 'weightEntries'.");
        const snapshot = await db.collection('weightEntries').orderBy('date').get();
        const loadedData = [];
        console.log("loadWeightLogFromFirestore: Snímek načten, zpracovávám dokumenty weightLog.");
        snapshot.forEach(doc => {
            const data = doc.data();
            loadedData.push({
                date: data.date,
                weight: data.weight,
                bodyFat: data.bodyFat || null,
                muscleMass: data.muscleMass || null,
                bodyWater: data.bodyWater || null,
                manualBMR: data.manualBMR || null,
                manualAMR: data.manualAMR || null,
                notes: data.notes || ''
            });
            console.log(`loadWeightLogFromFirestore: Přidán weightLog dokument: ${doc.id}`);
        });
        console.log("loadWeightLogFromFirestore: Data weightLog úspěšně načtena z Firestore:", loadedData);
        return loadedData;
    } catch (error) {
        console.error("loadWeightLogFromFirestore: Chyba při načítání dat weightLog z Firestore:", error);
        throw error;
    }
};

window.deleteWeightEntryFromFirestore = async function(date) {
    console.log(`deleteWeightEntryFromFirestore: Pokus o smazání záznamu pro datum: ${date} z kolekce 'weightEntries'.`);
    if (!db) {
        console.error("deleteWeightEntryFromFirestore: Firestore databáze není inicializována, nelze smazat data.");
        throw new Error("Firestore databáze není připravena ke smazání dat.");
    }
    try {
        console.log(`deleteWeightEntryFromFirestore: Mažu dokument s ID: ${date} z 'weightEntries'.`);
        await db.collection('weightEntries').doc(date).delete();
        console.log(`deleteWeightEntryFromFirestore: Záznam pro datum ${date} úspěšně smazán z Firestore.`);
        return true;
    } catch (error) {
        console.error(`deleteWeightEntryFromFirestore: Chyba při mazání záznamu pro datum ${date} z Firestore:`, error);
        throw error;
    }
};

// --- FUNKCE PRO UKLÁDÁNÍ A NAČÍTÁNÍ NASTAVENÍ (settings) ---

window.saveSettingsToFirestore = async function(settingsObject) {
    console.log("saveSettingsToFirestore: Pokus o uložení nastavení do Firestore.", settingsObject);
    if (!db) {
        console.error("saveSettingsToFirestore: Firestore databáze není inicializována, nelze uložit nastavení.");
        throw new Error("Firestore databáze není připravena k uložení nastavení.");
    }
    try {
        const docRef = db.collection('userSettings').doc('mainSettings');
        console.log("saveSettingsToFirestore: Ukládám dokument 'mainSettings' do kolekce 'userSettings'.");
        await docRef.set(settingsObject, { merge: true });
        console.log("saveSettingsToFirestore: Nastavení úspěšně uložena do Firestore.");
        return true;
    } catch (error) {
        console.error("saveSettingsToFirestore: Chyba při ukládání nastavení do Firestore:", error);
        throw error;
    }
};

window.loadSettingsFromFirestore = async function() {
    console.log("loadSettingsFromFirestore: Pokus o načtení nastavení z Firestore.");
    if (!db) {
        console.error("loadSettingsFromFirestore: Firestore databáze není inicializována, nelze načíst nastavení.");
        return null;
    }
    try {
        const docRef = db.collection('userSettings').doc('mainSettings');
        console.log("loadSettingsFromFirestore: Načítám dokument 'mainSettings' z kolekce 'userSettings'.");
        const doc = await docRef.get();
        if (doc.exists) {
            console.log("loadSettingsFromFirestore: Nastavení úspěšně načtena z Firestore.", doc.data());
            return doc.data();
        } else {
            console.log("loadSettingsFromFirestore: Dokument s nastavením 'mainSettings' neexistuje.");
            return null;
        }
    } catch (error) {
        console.error("loadSettingsFromFirestore: Chyba při načítání nastavení z Firestore:", error);
        throw error;
    }
};

// --- FUNKCE PRO UKLÁDÁNÍ A NAČÍTÁNÍ CÍLŮ (goals) ---

window.saveGoalsToFirestore = async function(goalsObject) {
    console.log("saveGoalsToFirestore: Pokus o uložení cílů do Firestore.", goalsObject);
    if (!db) {
        console.error("saveGoalsToFirestore: Firestore databáze není inicializována, nelze uložit cíle.");
        throw new Error("Firestore databáze není připravena k uložení cílů.");
    }
    try {
        const docRef = db.collection('userGoals').doc('mainGoals');
        console.log("saveGoalsToFirestore: Ukládám dokument 'mainGoals' do kolekce 'userGoals'.");
        await docRef.set(goalsObject, { merge: true });
        console.log("saveGoalsToFirestore: Cíle úspěšně uloženy do Firestore.");
        return true;
    } catch (error) {
        console.error("saveGoalsToFirestore: Chyba při ukládání cílů do Firestore:", error);
        throw error;
    }
};

window.loadGoalsFromFirestore = async function() {
    console.log("loadGoalsFromFirestore: Pokus o načtení cílů z Firestore.");
    if (!db) {
        console.error("loadGoalsFromFirestore: Firestore databáze není inicializována, nelze načíst cíle.");
        return null;
    }
    try {
        const docRef = db.collection('userGoals').doc('mainGoals');
        console.log("loadGoalsFromFirestore: Načítám dokument 'mainGoals' z kolekce 'userGoals'.");
        const doc = await docRef.get();
        if (doc.exists) {
            console.log("loadGoalsFromFirestore: Cíle úspěšně načteny z Firestore.", doc.data());
            return doc.data();
        } else {
            console.log("loadGoalsFromFirestore: Dokument s cíli 'mainGoals' neexistuje.");
            return null;
        }
    } catch (error) {
        console.error("loadGoalsFromFirestore: Chyba při načítání cílů z Firestore:", error);
        throw error;
    }
};

// --- POMOCNÁ FUNKCE PRO SMAZÁNÍ CELÉ KOLEKCE (pro clearAllFirestoreData) ---
// Tuto funkci volá 'clearAllFirestoreData' pro smazání jednotlivých kolekcí
window.clearCollection = async function(collectionName) {
    console.log(`clearCollection: Spouštím mazání všech dokumentů z kolekce '${collectionName}'.`);
    if (!db) {
        console.error("clearCollection: Firestore databáze není inicializována.");
        throw new Error("Firestore databáze není připravena k mazání.");
    }
    try {
        const collectionRef = db.collection(collectionName);
        const snapshot = await collectionRef.get();
        const batch = db.batch();
        let deletedCount = 0;

        if (snapshot.size === 0) {
            console.log(`clearCollection: Kolekce '${collectionName}' je již prázdná.`);
            return 0;
        }

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        console.log(`clearCollection: Přidáno ${deletedCount} dokumentů z kolekce '${collectionName}' do dávky pro smazání.`);
        await batch.commit();
        console.log(`clearCollection: Smazáno ${deletedCount} dokumentů z kolekce '${collectionName}'.`);
        return deletedCount;
    } catch (error) {
        console.error(`clearCollection: Chyba při mazání kolekce '${collectionName}':`, error);
        throw error;
    }
};


// --- FUNKCE PRO SMAZÁNÍ VŠECH DAT Z KOLEKCÍ FIRESTORE (POZOR! Důrazně!) ---
// Rozšířena o mazání settings a goals kolekcí pomocí 'clearCollection'
window.clearAllFirestoreData = async function() {
    console.log("clearAllFirestoreData: Pokus o smazání všech dat z Firebase Firestore (všechny určené kolekce).");
    if (!db) {
        console.error("clearAllFirestoreData: Firestore databáze není inicializována, nelze smazat všechna data.");
        throw new Error("Firestore databáze není připravena ke smazání všech dat.");
    }

    try {
        const collectionsToClear = ['weightEntries', 'userSettings', 'userGoals', 'notificationTokens']; // Přidáme i kolekci pro tokeny
        let totalDeletedCount = 0;

        for (const collectionName of collectionsToClear) {
            totalDeletedCount += await window.clearCollection(collectionName);
        }
        
        console.log(`clearAllFirestoreData: Všechna data z určených kolekcí Firestore úspěšně smazána. Celkem smazáno: ${totalDeletedCount} dokumentů.`);
        return true;
    } catch (error) {
        console.error("clearAllFirestoreData: Chyba při mazání všech dat z Firestore:", error);
        throw error;
    }
};