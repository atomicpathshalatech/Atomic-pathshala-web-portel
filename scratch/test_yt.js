const fs = require('fs');
const path = require('path');

// Read .env or .env.local
let envContent = '';
try {
  envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
} catch {
  try {
    envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  } catch {}
}

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

async function main() {
  const clientId = env.YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = env.YOUTUBE_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN;

  console.log('Client ID:', clientId ? 'Present' : 'Missing');
  console.log('Refresh Token:', refreshToken ? 'Present' : 'Missing');

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    console.error('Token refresh failed:', tokenJson);
    return;
  }
  const accessToken = tokenJson.access_token;
  console.log('Access token obtained successfully!');

  // Test liveBroadcasts insert
  const broadcastRes = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        title: "Test Live Class",
        description: "Test description",
        scheduledStartTime: new Date().toISOString(),
      },
      status: {
        privacyStatus: "unlisted",
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableEmbed: true,
        enableAutoStart: true,
        enableAutoStop: true,
        enableDvr: true,
        recordFromStart: true,
        latencyPreference: "ultraLow",
      },
    }),
  });

  const broadcastStatus = broadcastRes.status;
  const broadcastText = await broadcastRes.text();
  console.log('liveBroadcasts.insert Status:', broadcastStatus);
  console.log('liveBroadcasts.insert Response:', broadcastText);
}

main().catch(console.error);
