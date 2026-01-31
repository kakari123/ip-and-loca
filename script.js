// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        // Using ipwho.is which is free and reliable (no API key needed)
        const ipRes = await fetch('https://ipwho.is/');
        const ipData = await ipRes.json();

        if (!ipData.success) {
            throw new Error(`API Error: ${ipData.message}`);
        }

        // 2. Detect Device Info
        const userAgent = navigator.userAgent;
        let os = ipData.os || "Unknown OS";    // ipwho.is provides OS often
        let browser = ipData.browser || "Unknown Browser"; // ipwho.is provides browser often
        let deviceType = "Desktop";

        // Fallback or refine OS/Browser/Device if API content is generic
        if (userAgent.indexOf("Mobi") !== -1) deviceType = "Mobile";

        // 3. Detect Connection Type
        const isp = ipData.connection ? ipData.connection.isp : "Unknown ISP";
        const org = ipData.connection ? ipData.connection.org : "Unknown Org";
        let connectionSpeed = "Unknown Speed";

        if (navigator.connection) {
            connectionSpeed = navigator.connection.effectiveType.toUpperCase(); // 4G, 3G, etc.
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

        // Display Detailed Info
        const detailedDisplay = document.getElementById('detailed-device-display');
        let detailsText = "";
        for (const [key, value] of Object.entries(detailedInfo)) {
            detailsText += `${key}: ${value}\n`;
        }
        detailedDisplay.textContent = detailsText;

        // Show content
        loading.style.display = 'none';
        content.style.display = 'block';

        // 5. Wait 0.5s, Request Location, THEN Save
        setTimeout(() => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    // Success
                    (position) => {
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
                            location: {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy
                            },
                            timestamp: serverTimestamp()
                        };
                        saveDataToFirebase(collectedData);
                    },
                    // Error / Denied
                    (error) => {
                        console.warn("Location access denied or error:", error.message);
                        // Save without precise location
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
                            location: {
                                error: error.message,
                                status: "Denied/Unavailable"
                            },
                            timestamp: serverTimestamp()
                        };
                        saveDataToFirebase(collectedData);
                    }
                );
            } else {
                // Geolocation not supported
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
                    location: { status: "Not Supported" },
                    timestamp: serverTimestamp()
                };
                saveDataToFirebase(collectedData);
            }
        }, 500); // 0.5 second delay

    } catch (error) {
        console.error("Error collecting data:", error);
        loading.innerHTML = `
            <span style="color: #ef4444;">ببورە، هەڵەیەک ڕوویدا.</span><br>
            <span style="font-size: 0.8rem; color: #94a3b8;">${error.message}</span>
        `;
    }

    async function saveDataToFirebase(data) {
        try {
            // Add a new document with a generated id.
            const docRef = await addDoc(collection(db, "visitors"), data);

            console.log("Document written with ID: ", docRef.id);
            saveStatus.textContent = "✅ زانیاری بە سەرکەوتوویی لە Firebase سەیڤ کرا";
            saveStatus.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
            saveStatus.style.color = "#10b981";

        } catch (e) {
            console.error("Error adding document: ", e);
            saveStatus.textContent = "❌ کێشە هەیە لە سەیڤکردنی زانیاری لە Firebase";
            saveStatus.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
            saveStatus.style.color = "#ef4444";
        }
    }
});
