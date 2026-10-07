import crypto from "crypto";
import { verifyWebhookToken, verifyMetaWebhookSignature } from "../src/lib/whatsapp/security";
import { parseMetaWhatsAppWebhook } from "../src/lib/whatsapp/parser";
import { classifyWhatsAppIntent } from "../src/lib/whatsapp/inbound-service";
import { processWhatsAppWebhookPayload } from "../src/lib/whatsapp/processor";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 ATOMIC PATHSHALA — META WHATSAPP WEBHOOK TESTS");
  console.log("=================================================\n");

  const TEST_VERIFY_TOKEN = "atomic_meta_verify_token_test_123";
  const TEST_APP_SECRET = "atomic_meta_app_secret_test_xyz987";

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. GET Webhook Verification Tests
  console.log("--- 1. Webhook Verification (GET) ---");
  assert(
    verifyWebhookToken("subscribe", TEST_VERIFY_TOKEN, TEST_VERIFY_TOKEN) === true,
    "GET verification with valid verify token and subscribe mode"
  );
  assert(
    verifyWebhookToken("subscribe", "wrong_token", TEST_VERIFY_TOKEN) === false,
    "GET verification with invalid verify token returns false"
  );
  assert(
    verifyWebhookToken("unsubscribe", TEST_VERIFY_TOKEN, TEST_VERIFY_TOKEN) === false,
    "GET verification with invalid hub.mode returns false"
  );
  assert(
    verifyWebhookToken("subscribe", null, TEST_VERIFY_TOKEN) === false,
    "GET verification with missing token returns false"
  );

  // 2. POST Signature Verification Tests
  console.log("\n--- 2. HMAC SHA-256 Signature Verification (POST) ---");
  const samplePayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "12345", changes: [] }],
  });

  const validHash = crypto
    .createHmac("sha256", TEST_APP_SECRET)
    .update(samplePayload, "utf8")
    .digest("hex");

  const validSignature = `sha256=${validHash}`;
  const invalidSignature = `sha256=invalid_hash_value_1234567890abcdef1234567890abcdef`;

  assert(
    verifyMetaWebhookSignature(samplePayload, validSignature, TEST_APP_SECRET) === true,
    "POST signature verification with valid X-Hub-Signature-256"
  );
  assert(
    verifyMetaWebhookSignature(samplePayload, invalidSignature, TEST_APP_SECRET) === false,
    "POST signature verification with tampered/invalid signature returns false"
  );
  assert(
    verifyMetaWebhookSignature(samplePayload, null, TEST_APP_SECRET) === false,
    "POST signature verification with missing signature header returns false"
  );

  // 3. Payload Parsing Tests
  console.log("\n--- 3. Meta Cloud API Payload Parser ---");
  const testWamId = `wamid.HBgL${Date.now()}`;
  const mockIncomingMessagePayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1092837465",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "919999999999",
                phone_number_id: "8888888888",
              },
              contacts: [
                {
                  profile: { name: "Ananya Sharma" },
                  wa_id: "919876543210",
                },
              ],
              messages: [
                {
                  from: "919876543210",
                  id: testWamId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "Sir when is tomorrow physics live class and where is DPP link?" },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  const parsed = parseMetaWhatsAppWebhook(mockIncomingMessagePayload);
  assert(parsed.isWhatsApp === true, "Payload detected as WhatsApp Business Account");
  assert(parsed.messages.length === 1, "Extracted exactly 1 message");
  assert(parsed.messages[0].fromPhone === "+919876543210", "Sender phone normalized to +919876543210");
  assert(parsed.messages[0].senderName === "Ananya Sharma", "Contact name correctly resolved to Ananya Sharma");
  assert(parsed.messages[0].type === "text", "Message type identified as text");

  // 4. Intent Classification Tests
  console.log("\n--- 4. Support & Academic Intent Classification ---");
  assert(
    classifyWhatsAppIntent("Where can I join today live class link?") === "CLASS_LINK",
    "Intent detected as CLASS_LINK"
  );
  assert(
    classifyWhatsAppIntent("I missed lecture, please send recording") === "RECORDING",
    "Intent detected as RECORDING"
  );
  assert(
    classifyWhatsAppIntent("Please provide Cell chapter notes PDF") === "NOTES",
    "Intent detected as NOTES"
  );
  assert(
    classifyWhatsAppIntent("I need DPP 4 solution sheet") === "DPP",
    "Intent detected as DPP"
  );
  assert(
    classifyWhatsAppIntent("What is batch fee and discount coupon for NEET 2026?") === "FEES_ENROLLMENT",
    "Intent detected as FEES_ENROLLMENT"
  );
  assert(
    classifyWhatsAppIntent("I want to speak with human agent urgently") === "HUMAN_ESCALATION",
    "Intent detected as HUMAN_ESCALATION"
  );

  // 5. Status Update Parsing Tests
  console.log("\n--- 5. Delivery Status Update Parsing ---");
  const mockStatusPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1092837465",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "8888888888" },
              statuses: [
                {
                  id: testWamId,
                  status: "delivered",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  recipient_id: "919876543210",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  const parsedStatus = parseMetaWhatsAppWebhook(mockStatusPayload);
  assert(parsedStatus.statuses.length === 1, "Extracted exactly 1 status event");
  assert(parsedStatus.statuses[0].status === "delivered", "Status correctly parsed as 'delivered'");
  assert(parsedStatus.statuses[0].recipientPhone === "+919876543210", "Recipient phone normalized");

  // 6. Full Processor Execution & Idempotency Test
  console.log("\n--- 6. Inbound Processor & Idempotency Execution ---");
  const res1 = await processWhatsAppWebhookPayload(mockIncomingMessagePayload);
  assert(res1.messagesProcessed === 1, "First ingestion: 1 message processed and saved to database");

  // Re-run same payload -> must be skipped due to unique wamId
  const res2 = await processWhatsAppWebhookPayload(mockIncomingMessagePayload);
  assert(res2.messagesSkipped === 1 && res2.messagesProcessed === 0, "Second ingestion: Duplicate message safely skipped (Idempotency PASS)");

  // 7. Malformed / Empty Payload Resilience Test
  console.log("\n--- 7. Malformed Payload Resilience ---");
  const malformedRes = await processWhatsAppWebhookPayload({ foo: "bar", invalid: true });
  assert(malformedRes.success === true && malformedRes.messagesProcessed === 0, "Malformed payload handled gracefully without crashing");

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
