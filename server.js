const express = require('express');
const axios = require('axios');
const cors = require('cors');
const request = require('request');   
const { v4: uuidv4 } = require("uuid");
const urlStore = {};


const app = express();


// CORS
// app.use(cors({
//   origin: [
//     'https://nextgenbets.com',
//     'https://proxy.nextgenbets.com'
//   ],
//   methods: ['GET', 'POST', 'OPTIONS'],
//   allowedHeaders: ['Authorization', 'Content-Type'],
//   credentials: true
// }));
// CORS preflight for all routes
// app.options('/*', cors());

app.use(cors())

// Parse JSON
app.use(express.json());


app.post("/save-url", (req, res) => {
  // Force CORS headers manually
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "https://nextgenbets.com");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");

  const { targetUrl } = req.body;
  if (!targetUrl) return res.status(400).json({ error: "Missing targetUrl" });

  const token = uuidv4();
  urlStore[token] = targetUrl;

  console.log("Stored URL:", token, targetUrl);

  // KEY FIX: Always return 200 + JSON
  return res.status(200).json({ token });
});


app.get('/iframe-exact/:token', (req, res) => {
  const token = req.params.token;
  const targetUrl = urlStore[token];
  // Fix CORS for piped response
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "https://nextgenbets.com");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  
  if (!targetUrl) return res.status(400).send("Invalid or expired token");

  console.log("➡ EXACT EAR request:", targetUrl);

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
  })
  .on("error", err => {
    console.error("EAR Proxy ERROR:", err);
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
