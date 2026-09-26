import { getYoutubeAccessToken } from "../src/lib/youtube/upload-client";

async function main() {
  const token = await getYoutubeAccessToken();
  console.log("Token obtained:", token ? "YES (length: " + token.length + ")" : "NO");

  // Test liveBroadcasts insert
  const res = await fetch("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        title: "Atomic Pathshala Test Live Class",
        description: "Test live class description",
        scheduledStartTime: new Date(Date.now() + 60000).toISOString(),
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
        latencyPreference: "low",
      },
    }),
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

main().catch(console.error);
