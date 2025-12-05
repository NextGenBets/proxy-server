const express = require('express');
const axios = require('axios');
const cors = require('cors');
const request = require('request');   
const { v4: uuidv4 } = require("uuid");
const urlStore = {};

// Puppeteer + Stealth
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

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


// -----------------------------------------------------
// Helper: Clean and encode URL properly
// -----------------------------------------------------
function cleanGameUrl(url) {
  return encodeURI(
    url
      .replace(/%60/g, "")   // remove encoded `
      .replace(/`/g, "")     // remove raw `
  );
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

app.get('/iframe-exact', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send("Missing url param");
  }

  console.log("➡ EXACT EAR request:", targetUrl);

  // Do NOT change the URL. Just pass it as-is.
  const finalURL = targetUrl;

  request({
    url: finalURL,
    method: "GET",
    gzip: true,
    followRedirect: false,   // EAR hates forced redirects
    headers: {
      "User-Agent": req.headers["user-agent"] || 
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": req.headers.referer || "https://nextgenbets.com/",
      "Cache-Control": "no-cache"
    }
  })
  .on("error", err => {
    console.error("EAR PROXY ERROR:", err);
    res.status(500).send("EAR Proxy failed");
  })
  .pipe(res);
});

app.post("/iframe-exact", (req, res) => {
  const { targetUrl } = req.body;
  if (!targetUrl) return res.status(400).send("Missing targetUrl");

  console.log("➡ EXACT URL request:", targetUrl);

  // Make GET request exactly as browser
  request({
    url: targetUrl,
    method: "GET",
    gzip: true,
    followRedirect: false,
    headers: {
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      "Accept": "*/*",
      "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9",
      "Referer": req.headers["referer"] || "https://nextgenbets.com",
      "Cache-Control": "no-cache"
    }
  })
  .on("error", (err) => {
    console.error("EAR Proxy Error:", err);
    res.status(500).send("Proxy failed");
  })
  .pipe(res);
});

app.post("/save-url", (req, res) => {
  const { targetUrl } = req.body;
  if (!targetUrl) return res.status(400).send("Missing targetUrl");

  const token = uuidv4();
  urlStore[token] = targetUrl;

  console.log("Stored URL:", token, targetUrl);

  res.json({ token });
});


// app.get('/iframe-exact/:token', (req, res) => {
//   const token = req.params.token;
//   const targetUrl = urlStore[token];

//   if (!targetUrl) return res.status(400).send("Invalid or expired token");

//   console.log("➡ EXACT EAR request:", targetUrl);

//   request({
//     url: targetUrl,
//     method: "GET",
//     gzip: true,
//     followRedirect: false,
//     headers: {
//       "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
//       "Accept": "*/*",
//       "Accept-Language": "en-US,en;q=0.9",
//       "Referer": "https://nextgenbets.com",
//       "Cache-Control": "no-cache"
//     }
//   })
//   .on("error", err => {
//     console.error("EAR Proxy ERROR:", err);
//     res.status(500).send("EAR Proxy failed");
//   })
//   .pipe(res);
// });

app.get('/iframe-exact/:token', (req, res) => {
  const token = req.params.token;
  const targetUrl = urlStore[token];

  if (!targetUrl) return res.status(400).send("Invalid or expired token");

  console.log("➡ EXACT EAR request:", targetUrl);

  // Fetch HTML as string
  request({
    url: targetUrl,
    method: "GET",
    gzip: true,
    followRedirect: false,
    headers: {
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://nextgenbets.com",
      "Cache-Control": "no-cache"
    }
  }, (err, response, body) => {
    if (err) {
      console.error("EAR Proxy ERROR:", err);
      return res.status(500).send("EAR Proxy failed");
    }

    // Rewrite relative URLs to absolute URLs (pointing to the original server)
    // This handles <script src="/..."> and <link href="/...">
    body = body.replace(/(src|href)=["']\/([^"']+)["']/g, `$1="${new URL(targetUrl).origin}/$2"`);

    res.send(body);
  });
});

/**
 * ---------------------------------------------------------
 * START SERVER
 * ---------------------------------------------------------
 */
app.listen(3000, () => {
  console.log("✅ EAR Proxy running on Ireland server :3000");
});
