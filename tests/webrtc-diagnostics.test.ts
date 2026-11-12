import { parseWebRTCStats, WebRTCPreviousStats } from "../src/components/live-class/TeacherMediaDiagnosticsHUD";

function testWebRTCDiagnosticsParser() {
  console.log("=================================================");
  console.log("📡 WEBRTC STATS PARSER & METRIC ACCURACY TEST");
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

  // TEST 1: Candidate-pair RTT & Outbound Audio Delta Bitrate
  const statsMap1 = new Map<string, any>();
  statsMap1.set("cp1", {
    id: "cp1",
    type: "candidate-pair",
    state: "succeeded",
    selected: true,
    currentRoundTripTime: 0.042, // 42 ms
  });
  statsMap1.set("audio-out", {
    id: "audio-out",
    type: "outbound-rtp",
    kind: "audio",
    bytesSent: 12000,
    timestamp: 1000,
    packetsSent: 100,
    remoteId: "audio-remote-in",
  });
  statsMap1.set("audio-remote-in", {
    id: "audio-remote-in",
    type: "remote-inbound-rtp",
    roundTripTime: 0.045,
    jitter: 0.003, // 3 ms
    packetsLost: 2,
  });

  const prevStats0: WebRTCPreviousStats = {
    audioBytesSent: 8000,
    audioTimestamp: 0,
    packetsSent: 60,
    packetsLost: 1,
  };

  const res1 = parseWebRTCStats(statsMap1, prevStats0);

  // dt = (1000 - 0) / 1000 = 1.0s
  // deltaBytes = 12000 - 8000 = 4000 bytes
  // bitrate = (4000 * 8) / (1 * 1000) = 32 kbps
  assert(
    res1.rttMs === 45 && res1.jitterMs === 3,
    "Test 1.1: Reads RTT (45ms) and Jitter (3ms) accurately from remote-inbound-rtp"
  );
  assert(
    res1.audioBitrateKbps === 32,
    "Test 1.2: Calculates audio bitrate (32 kbps) via timestamp & byte delta"
  );

  // deltaSent = 100 - 60 = 40 packets, deltaLost = 2 - 1 = 1 packet
  // lossPct = (1 / (40 + 1)) * 100 = 2.43% -> 2%
  assert(
    res1.audioPacketLossPct === 2,
    "Test 1.3: Calculates interval packet loss (2%) from RTCP counters instead of cumulative ratio"
  );

  // TEST 2: Independent Camera vs Screen-Share Track Identification
  const statsMap2 = new Map<string, any>();
  statsMap2.set("ms-cam", {
    id: "ms-cam",
    type: "media-source",
    trackIdentifier: "camera-track-123",
  });
  statsMap2.set("ms-screen", {
    id: "ms-screen",
    type: "media-source",
    trackIdentifier: "screen-track-456",
  });

  statsMap2.set("cam-out", {
    id: "cam-out",
    type: "outbound-rtp",
    kind: "video",
    mediaSourceId: "ms-cam",
    frameWidth: 1280,
    frameHeight: 720,
    framesPerSecond: 24,
    encoderImplementation: "libvpx",
    framesDropped: 5,
  });

  statsMap2.set("screen-out", {
    id: "screen-out",
    type: "outbound-rtp",
    kind: "video",
    mediaSourceId: "ms-screen",
    frameWidth: 1920,
    frameHeight: 1080,
    framesPerSecond: 30,
  });

  const res2 = parseWebRTCStats(statsMap2, {}, {
    cameraTrackId: "camera-track-123",
    screenTrackId: "screen-track-456",
  });

  assert(
    res2.cameraResolution === "1280x720" && res2.cameraFps === 24 && res2.encoderType === "libvpx",
    "Test 2.1: Camera track correctly identified with resolution 1280x720 @ 24fps"
  );
  assert(
    res2.screenShareResolution === "1920x1080" && res2.screenShareFps === 30,
    "Test 2.2: Screen-share track correctly identified with resolution 1920x1080 @ 30fps"
  );

  // TEST 3: Counter Reset / Renegotiation Handling
  const statsMapReset = new Map<string, any>();
  statsMapReset.set("audio-out", {
    id: "audio-out",
    type: "outbound-rtp",
    kind: "audio",
    bytesSent: 500, // renegotiated from 12000
    timestamp: 2000,
  });

  const prevStatsHigh: WebRTCPreviousStats = {
    audioBytesSent: 12000,
    audioTimestamp: 1000,
  };

  const res3 = parseWebRTCStats(statsMapReset, prevStatsHigh);
  assert(
    res3.audioBitrateKbps === 0,
    "Test 3: Counter reset safely handled without negative bitrate spike"
  );

  // TEST 4: Unavailable Peer Connection / Zero Samples Protection
  const resNull = parseWebRTCStats(null, {});
  assert(
    resNull.rttMs === null &&
    resNull.audioBitrateKbps === null &&
    resNull.audioPacketLossPct === null &&
    resNull.jitterMs === null,
    "Test 4: Unavailable stats return null instead of misleading 0 (healthy) values"
  );

  console.log(`\nWebRTC Diagnostics Parser Results: ${passed} PASSED | ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

testWebRTCDiagnosticsParser();
