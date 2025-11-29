// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const request = require('request');   // stream-based → EAR accepts it

const app = express();

// Parse JSON
app.use(express.json());

// CORS
app.use(cors({
  origin: 'https://nextgenbets.com',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true
}));


// ----------------------------------------------
// Helper: Clean EAR URL (remove backticks %60)
// ----------------------------------------------
function cleanEarUrl(url) {
  return url
    .replace(/%60/g, "")   // remove encoded `
    .replace(/`/g, "")     // remove raw `
    .replace(/\|/g, "%7C"); // encode pipe
}


/**
 * ---------------------------------------------------------
 * 1️⃣  GAME-LAUNCH API PROXY
 * ---------------------------------------------------------
 */
app.post('/game-launch', async (req, res) => {
  try {
    const earUrl = 'https://api.nextgenbets.com/api/v1/ear-casino/game-launch';

    const response = await axios.post(
      earUrl,
      req.body,
      {
        headers: {
          Authorization: req.headers.authorization,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json(response.data);

  } catch (error) {
    console.error('Proxy Error:', error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: 'Ear Casino proxy failed',
      error: error.response?.data || error.message
    });
  }
});



/**
 * ---------------------------------------------------------
 * 2️⃣  IFRAME REVERSE PROXY  (EAR HTML)
 * ---------------------------------------------------------
 * axios ❌  → EAR blocks
 * request() ✔️ → streams HTML → EAR allows
 * ---------------------------------------------------------
 */
app.get('/iframe', (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url param' });
  }

  // Always clean URL first
  targetUrl = cleanEarUrl(targetUrl);

  console.log("Proxying iframe URL:", targetUrl);

  // Stream HTML directly to browser
  request({
    url: targetUrl,
    method: 'GET',
    headers: {
      "User-Agent": req.headers['user-agent'] || "Mozilla/5.0",
      "Accept": "text/html",
      "Referer": "https://nextgenbets.com/casino",

      // Forward cookies
      "Cookie": req.headers.cookie || "",

      // Forward BEARER-TOKEN if any
      "Authorization": req.headers.authorization || "",

      // Fake Malta IP
      "X-Forwarded-For": "185.17.135.10"
    }
  })
  .on('error', err => {
    console.error("Iframe Proxy Error:", err.message);
    res.status(400).send("Iframe Proxy failed");
  })
  .pipe(res); // stream to client
});



// ---------------------------------------------------------
// Start Server
// ---------------------------------------------------------
app.listen(3000, () => {
  console.log('✅ EAR Proxy running on Ireland server :3000');
});
