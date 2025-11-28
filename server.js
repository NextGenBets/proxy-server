const express = require('express')
const axios = require('axios')
// const config = require('./config') // optional

const app = express()
app.use(express.json())

app.post('/game-launch', async (req, res) => {
  try {
    const earCasinoUrl = 'https://api.nextgenbets.com/api/v1/ear-casino/game-launch'

    const response = await axios.post(
      earCasinoUrl,
      req.body,
      {
        headers: {
          Authorization: req.headers.authorization,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    res.status(200).json(response.data)
  } catch (error) {
    console.error('Proxy Error:', error.response?.data || error.message)

    res.status(500).json({
      success: false,
      message: 'Ear Casino proxy failed',
      error: error.response?.data || error.message
    })
  }
})

app.listen(3000, () => {
  console.log('✅ EAR Proxy running on Ireland server :3000')
})
