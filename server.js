const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const STATS_FILE = path.join(__dirname, 'statistics.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// Endpoint to save info
app.post('/save-info', (req, res) => {
    const userInfo = req.body;

    // Add timestamp
    userInfo.timestamp = new Date().toISOString();

    // Read existing stats
    fs.readFile(STATS_FILE, 'utf8', (err, data) => {
        let stats = [];
        if (!err && data) {
            try {
                stats = JSON.parse(data);
            } catch (e) {
                console.error("Error parsing JSON:", e);
            }
        }

        stats.push(userInfo);

        // Save back to file
        fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), (err) => {
            if (err) {
                console.error("Error saving data:", err);
                return res.status(500).json({ success: false, message: 'Failed to save data' });
            }
            console.log("New data saved:", userInfo);
            res.json({ success: true, message: 'Data saved successfully' });
        });
    });
});

app.listen(PORT, () => {
    console.log(`\n---------------------------------------------`);
    console.log(`Server running!`);
    console.log(`On this computer: http://localhost:${PORT}`);

    // Find local IP
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`On your Network (Mobile): http://${net.address}:${PORT}`);
            }
        }
    }
    console.log(`---------------------------------------------\n`);
});
