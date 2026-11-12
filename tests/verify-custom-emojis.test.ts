import React from "react";
import { renderFormattedChatMessage, isAllowedYouTubeEmojiHost } from "../src/components/live-class/MessagesPanel";

function testCustomEmojiRenderingAndDataFlow() {
  console.log("=================================================");
  console.log("🧪 CUSTOM YOUTUBE EMOJI DATA FLOW & HOST POLICY TEST");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      failed++;
    }
  }

  // 1. Standard Emoji Shortcode Test
  const standardRes = renderFormattedChatMessage("Hello :thumbsup: and :fire:");
  assert(
    typeof standardRes === "string" && standardRes.includes("👍") && standardRes.includes("🔥"),
    "Test 1: Standard shortcodes (:thumbsup:, :fire:) map to Unicode emojis"
  );

  // 2. Allowed Official YouTube Host Policy Verification
  assert(
    isAllowedYouTubeEmojiHost("https://yt3.ggpht.com/a/custom_atom.png") &&
    isAllowedYouTubeEmojiHost("https://yt4.ggpht.com/badges/star.png") &&
    isAllowedYouTubeEmojiHost("https://lh3.googleusercontent.com/ytc/abc.png") &&
    isAllowedYouTubeEmojiHost("https://youtube.com/img/emoji.png"),
    "Test 2: Allowed official YouTube & Google image hosts accepted"
  );

  // 3. Disallowed Hosts / Non-HTTPS URLs Rejected
  assert(
    !isAllowedYouTubeEmojiHost("https://unauthorized-cdn.com/fake.png") &&
    !isAllowedYouTubeEmojiHost("http://yt3.ggpht.com/insecure.png") &&
    !isAllowedYouTubeEmojiHost("javascript:alert(1)"),
    "Test 3: Non-HTTPS and unauthorized third-party hosts rejected"
  );

  // 4. Custom YouTube Emoji with valid HTTPS image URL
  const customList = [
    {
      shortcut: ":atom_badge:",
      url: "https://yt3.ggpht.com/custom_atom_badge.png",
      label: "Atom Badge",
    },
  ];
  const customRes = renderFormattedChatMessage("Great work :atom_badge: keep it up!", customList);
  assert(
    Array.isArray(customRes) && customRes.length >= 3,
    "Test 4: Message with custom emoji tokenized correctly preserving text before and after"
  );

  const imgElement = (customRes as any[]).find((el) => el?.type === "img");
  assert(
    imgElement &&
    imgElement.props.src === "https://yt3.ggpht.com/custom_atom_badge.png" &&
    imgElement.props.alt === ":atom_badge:",
    "Test 5: Custom emoji rendered as safe <img> tag with exact URL and alt text"
  );

  // 5. Multiple Custom Emojis in a single message
  const multiCustomList = [
    { shortcut: ":atom_badge:", url: "https://yt3.ggpht.com/atom.png" },
    { shortcut: ":star_student:", url: "https://yt4.ggpht.com/star.png" },
  ];
  const multiRes = renderFormattedChatMessage(":atom_badge: Congratulations :star_student: to all!", multiCustomList);
  const imgElements = (multiRes as any[]).filter((el) => el?.type === "img");
  assert(
    imgElements.length === 2 &&
    imgElements[0].props.src === "https://yt3.ggpht.com/atom.png" &&
    imgElements[1].props.src === "https://yt4.ggpht.com/star.png",
    "Test 6: Multiple custom emojis in single message rendered in exact order"
  );

  // 6. Pinned Message Rendering
  const pinnedMessage = {
    id: "msg_pinned_1",
    body: "📌 Pinned: Welcome to Atomic Pathshala! :atom_badge:",
    pinned: true,
  };
  const pinnedRes = renderFormattedChatMessage(pinnedMessage.body, customList);
  const pinnedImg = (pinnedRes as any[]).find((el) => el?.type === "img");
  assert(
    Boolean(pinnedImg && pinnedImg.props.src === "https://yt3.ggpht.com/custom_atom_badge.png"),
    "Test 7: Pinned message renders custom emojis identically to normal messages"
  );

  // 7. Real YouTube Data API v3 Shaped Fixture Simulation
  // Demonstrates that YouTube Live Chat API v3 returns displayMessage as text
  const realApiV3Item = {
    kind: "youtube#liveChatMessage",
    etag: "etag123",
    id: "LCC.Cg0KC3Rlc3RNZXNzYWdl",
    snippet: {
      type: "textMessageEvent",
      liveChatId: "liveChat123",
      authorChannelId: "UC123456789",
      publishedAt: "2026-11-13T00:00:00.000Z",
      hasDisplayContent: true,
      displayMessage: "Physics doubt solved! :fire: :custom_badge:",
      textMessageDetails: {
        messageText: "Physics doubt solved! :fire: :custom_badge:",
      },
    },
    authorDetails: {
      channelId: "UC123456789",
      displayName: "Atomic Student",
      profileImageUrl: "https://yt3.ggpht.com/ytc/student.png",
      isChatOwner: false,
      isChatSponsor: true,
      isChatModerator: false,
    },
  };

  // Upstream YouTube API does not provide custom emoji URLs; when metadata is absent:
  const apiFormatted = renderFormattedChatMessage(realApiV3Item.snippet.displayMessage);
  assert(
    typeof apiFormatted === "string" && apiFormatted.includes("🔥") && apiFormatted.includes(":custom_badge:"),
    "Test 8: Real YouTube API v3 text-only payload cleanly maps standard emojis and preserves unmapped shortcodes"
  );

  console.log(`\nEmoji Results: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testCustomEmojiRenderingAndDataFlow();
