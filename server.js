const express = require('express');
const axios = require('axios');
const cors = require('cors');
const request = require('request');

// Puppeteer + Stealth
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { createProxyServer } = require("http-proxy");
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

// Helper: Clean & encode URL
function cleanGameUrl(url) {
  return encodeURI(
    url
      .replace(/%60/g, "")
      .replace(/`/g, "")
  );
}


/* =========================================================
 * 1️⃣ GAME-LAUNCH API PROXY
 * =======================================================*/
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


/* =========================================================
 * 2️⃣ BASIC RAW IFRAME PROXY (keep as-is)
 * =======================================================*/
app.get('/iframe', (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) return res.status(400).send('Missing url param');

  console.log("[REQUEST] Iframe proxy:", targetUrl);

  request({
    url: targetUrl,
    method: 'GET',
    headers: {
      "User-Agent": req.headers['user-agent'] || "Mozilla/5.0",
      "Accept": "*/*",
      "Referer": "https://nextgenbets.com/casino"
    }
  })
  .on('error', err => {
    console.error("Iframe Proxy Error:", err.message);
    res.status(400).send("Iframe Proxy failed");
  })
  .pipe(res);
});


/* =========================================================
 * 3️⃣ FIXED IFRAME-EXACT (NEW http-proxy VERSION)
 * =======================================================*/

// Create proxy instance
const exactProxy = createProxyServer({
  changeOrigin: true,
  secure: false,
  followRedirects: true,
  selfHandleResponse: false
});

// Error handling
exactProxy.on("error", (err, req, res) => {
  console.error("Iframe-exact Proxy Error:", err.message);
  if (!res.headersSent) {
    res.status(500).send("Iframe-exact proxy failed");
  }
});

/**
 * FINAL FIXED ENDPOINT
 * Works with ALL casino providers:
 * Pragmatic, PG Soft, Evolution, Ezugi, Hacksaw, Relax etc.
 */
app.get('/iframe-exact', (req, res) => {
  let raw = req.query.url;
  if (!raw) return res.status(400).send("Missing url param");

  let targetUrl;

  try {
    targetUrl = decodeURIComponent(raw);
  } catch {
    targetUrl = raw;
  }

  targetUrl = cleanGameUrl(targetUrl);
  console.log("➡ EXACT Proxy Target:", targetUrl);

  req.url = targetUrl; // rewrite URL internally

  exactProxy.web(req, res, {
    target: targetUrl,
    headers: {
      "User-Agent":
        req.headers["user-agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://nextgenbets.com/",
    }
  });
});


/* =========================================================
 * START SERVER
 * =======================================================*/
app.listen(3000, () => {
  console.log("✅ EAR Proxy running on Ireland server :3000");
});
