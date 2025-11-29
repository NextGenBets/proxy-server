const express = require('express');
const axios = require('axios');
const cors = require('cors');
const request = require('request');   

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



/**
 * ---------------------------------------------------------
 * 2️⃣ RAW IFRAME (STREAM) PROXY
 * ---------------------------------------------------------
 */
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



/**
 * ---------------------------------------------------------
 * 3️⃣  PUPPETEER + STEALTH IFRAME (EAR GAME)
 * ---------------------------------------------------------
 */
app.get('/iframe-puppet', async (req, res) => {
  let url = req.query.url;
  if (!url) return res.status(400).send("Missing url param");

  url = cleanGameUrl(url);
  console.log("🚀 Puppeteer loading:", url);

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false,        // headful → casino games work
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
      ]
    });

    const page = await browser.newPage();

    // Set REALISTIC desktop headers
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "X-Forwarded-For": "185.17.135.10",   // Malta IP
    });

    await page.setViewport({ width: 1920, height: 1080 });

    // Load URL with JS fully enabled
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for game iframe if it loads one
    try {
      await page.waitForSelector("iframe", { timeout: 15000 });
    } catch (err) {
      console.log("⚠️ No iframe found — EAR game might be direct");
    }

    const content = await page.content();

    res.setHeader("Content-Type", "text/html");
    res.send(content);

  } catch (err) {
    console.error("❌ Puppeteer Error:", err.message);
    res.status(500).send("Failed to open iframe via Puppeteer");

  } finally {
    if (browser) await browser.close();
  }
});


app.get('/iframe-exact', (req, res) => {
  const targetUrl = req.url.replace('/iframe-exact?url=', '');
  
  if (!targetUrl) {
    return res.status(400).send("Missing url param");
  }

  console.log("➡ EXACT EAR request:", targetUrl);

  const finalURL = decodeURIComponent(targetUrl);

  request({
    url: finalURL,
    method: "GET",
    gzip: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://nextgenbets.com/casino",
      "Upgrade-Insecure-Requests": 1,
      "Cache-Control": "no-cache"
    }
  })
  .on("error", err => {
    console.error("EAR PROXY ERROR:", err);
    res.status(500).send("EAR Proxy failed");
  })
  .pipe(res);
});


/**
 * ---------------------------------------------------------
 * START SERVER
 * ---------------------------------------------------------
 */
app.listen(3000, () => {
  console.log("✅ EAR Proxy running on Ireland server :3000");
});
