// firebase-messaging-sw.js

// Import a inicializace Firebase Messaging
// Použijte přesně stejnou konfiguraci, jakou máte v firebaseFunctions.js
// Firebase SDK verze 8.6.8 (jak máš v index.html)
importScripts('https://www.gstatic.com/firebasejs/8.6.8/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.6.8/firebase-messaging.js');

// TODO: Nahraďte vaší vlastní konfigurací Firebase projektu!
// Získáte ji z Firebase Console > Project settings > Your apps > Firebase SDK snippet
const firebaseConfig = {
    apiKey: "AIzaSyBCIHWbqCFJcCiuY-HFM3btTzUsByduluY",
    authDomain: "moje-vaha-beta-2.firebaseapp.com",
    projectId: "moje-vaha-beta-2",
    storageBucket: "moje-vaha-beta-2.firebasestorage.app",
    messagingSenderId: "870509063847",
    appId: "1:870509063847:web:6e0f922a1b8637e2713582"
};

// Inicializace Firebase
firebase.initializeApp(firebaseConfig);

// Získání instance Firebase Messaging
const messaging = firebase.messaging();

// Nastavení, jak se má chovat notifikace, když je aplikace na pozadí
// Toto zachytí notifikace poslané z Firebase Console nebo přes FCM API
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title || 'Upozornění z Trackeru';
    const notificationOptions = {
        body: payload.notification.body || 'Máme pro vás zprávu!',
        icon: payload.notification.icon || '/icon-192x192.png', // Doporučuji přidat ikonu!
        image: payload.notification.image || undefined, // Obrázek z tvé konzole
        data: payload.data, // Custom data, které jsme nastavovali
        // Další možnosti notifikace (volitelné)
        badge: '/badge-icon.png', // Ikonka pro badge na Androidu/iOSu
        vibrate: [200, 100, 200], // Vibrace
        actions: [
            { action: 'open_tracker', title: 'Otevřít Tracker' },
            { action: 'add_weight', title: 'Zadat váhu' }
        ]
    };

    // Zobrazení notifikace
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Zde definujeme, co se stane po kliknutí na notifikaci
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); // Zavře notifikaci po kliknutí

    const customData = event.notification.data;
    const targetTab = customData ? customData.targetTab : null;
    const notificationType = customData ? customData.notificationType : null;

    console.log(`[firebase-messaging-sw.js] Notifikace kliknuta. targetTab: ${targetTab}, notificationType: ${notificationType}`);

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                // Pokud je již otevřená záložka aplikace, zaměřit se na ni
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    // Zkontroluj URL, aby se ujistil, že jde o tvou aplikaci
                    if (client.url.includes('index.html') || client.url.includes(location.origin)) {
                        console.log('[firebase-messaging-sw.js] Existující klient nalezen. Přesměrování na něj.');
                        if (targetTab) {
                            // Můžeš přidat logiku pro navigaci na specifickou záložku
                            // Např. přesměrování na URL s #hash pro JS obsluhu
                            client.navigate(client.url.split('#')[0] + '#' + targetTab);
                        }
                        return client.focus();
                    }
                }
                // Pokud není otevřená záložka, otevřít novou
                console.log('[firebase-messaging-sw.js] Žádný existující klient. Otevírám novou záložku.');
                let url = self.location.origin;
                if (targetTab) {
                    url += `#${targetTab}`; // Přidáme hash pro cílovou záložku
                }
                return clients.openWindow(url);
            })
    );
});