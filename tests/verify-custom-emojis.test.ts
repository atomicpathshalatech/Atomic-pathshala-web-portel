import React from "react";
import { renderFormattedChatMessage } from "../src/components/live-class/MessagesPanel";

function testCustomEmojiRendering() {
  console.log("=================================================");
  console.log("🧪 CUSTOM YOUTUBE EMOJI RENDERING TEST SUITE");
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

  // 2. Custom YouTube Emoji with valid HTTPS image URL
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
    "Test 2: Message with custom emoji tokenized correctly preserving text before and after"
  );

  const imgElement = (customRes as any[]).find((el) => el?.type === "img");
  assert(
    imgElement &&
    imgElement.props.src === "https://yt3.ggpht.com/custom_atom_badge.png" &&
    imgElement.props.alt === ":atom_badge:",
    "Test 3: Custom emoji rendered as safe <img> tag with exact URL and alt text"
  );

  // 3. Multiple Custom Emojis in a single message
  const multiCustomList = [
    { shortcut: ":atom_badge:", url: "https://yt3.ggpht.com/atom.png" },
    { shortcut: ":star_student:", url: "https://yt3.ggpht.com/star.png" },
  ];
  const multiRes = renderFormattedChatMessage(":atom_badge: Congratulations :star_student: to all!", multiCustomList);
  const imgElements = (multiRes as any[]).filter((el) => el?.type === "img");
  assert(
    imgElements.length === 2 &&
    imgElements[0].props.src === "https://yt3.ggpht.com/atom.png" &&
    imgElements[1].props.src === "https://yt3.ggpht.com/star.png",
    "Test 4: Multiple custom emojis in single message rendered in exact order"
  );

  // 4. Insecure / Malformed URLs fallback safely to text (XSS defense)
  const insecureList = [
    { shortcut: ":hack:", url: "javascript:alert(1)" },
    { shortcut: ":fake:", url: "http://insecure.com/fake.png" }, // non-https
  ];
  const insecureRes = renderFormattedChatMessage("Testing :hack: and :fake:", insecureList as any);
  // Should reject non-https URLs and fallback to standard text
  const insecureImgs = Array.isArray(insecureRes) ? (insecureRes as any[]).filter((el) => el?.type === "img") : [];
  assert(
    insecureImgs.length === 0,
    "Test 5: Malformed or non-https URLs safely rejected without rendering unsafe elements"
  );

  console.log(`\nEmoji Results: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testCustomEmojiRendering();
