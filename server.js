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


// 1️⃣ Save the target URL and return token
app.post("/save-url", (req, res) => {
  const { targetUrl } = req.body;
  if (!targetUrl) return res.status(400).send("Missing targetUrl");

  const token = uuidv4();
  urlStore[token] = targetUrl;

  console.log("Stored URL:", token, targetUrl);
  res.json({ token });
});

// 2️⃣ Serve iframe with all assets proxied
app.get("/iframe-exact/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const targetUrl = urlStore[token];
    if (!targetUrl) return res.status(400).send("Invalid or expired token");

    console.log("➡ EXACT EAR request:", targetUrl);

    // Fetch the main HTML from original provider
    const { data: html } = await axios.get(targetUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        Accept: "text/html"
      }
    });

    // Rewrite all relative assets to use proxy
    const proxiedHtml = html.replace(
      /((src|href)=["'])([^"']+)/g,
      (match, p1, p2, p3) => {
        // Only rewrite relative paths, leave absolute URLs intact
        if (!p3.startsWith("http") && !p3.startsWith("//")) {
          const absoluteUrl = new URL(p3, targetUrl).href;
          return `${p1}https://108.130.215.127/proxy-asset?url=${encodeURIComponent(absoluteUrl)}`;
        }
        return match;
      }
    );

    res.set("Content-Type", "text/html");
    res.send(proxiedHtml);

  } catch (err) {
    console.error("Proxy iframe error:", err.message);
    res.status(500).send("Proxy failed");
  }
});

// 3️⃣ Proxy all asset requests
app.get("/proxy-asset", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing URL");

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer", // ensures binary data (JS/WASM/images) is returned correctly
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*"
      }
    });

    // Preserve original MIME type
    res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
    res.send(response.data);

  } catch (err) {
    console.error("Proxy asset error:", err.message);
    res.status(500).send("Asset fetch failed");
  }
});

/**
 * ---------------------------------------------------------
 * START SERVER
 * ---------------------------------------------------------
 */
app.listen(3000, () => {
  console.log("✅ EAR Proxy running on Ireland server :3000");
});
