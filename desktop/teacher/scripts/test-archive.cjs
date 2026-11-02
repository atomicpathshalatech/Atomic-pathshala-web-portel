// After-class steps on recorded part files: join them, make the 720p upload copy.
//   node scripts/test-archive.cjs <dir with part-*.mkv> [encoder]
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { buildArchiveArgs } = require("../src/encoder.js");

const dir = process.argv[2];
const encoder = process.argv[3] || "h264_qsv";
const ff = path.join(__dirname, "..", "vendor", "ffmpeg", "ffmpeg.exe");
const probe = path.join(__dirname, "..", "vendor", "ffmpeg", "ffprobe.exe");
const parts = fs.readdirSync(dir).filter((f) => /^part-\d+\.mkv$/.test(f)).sort();
fs.writeFileSync(path.join(dir, "list.txt"), parts.map((f) => `file '${path.join(dir, f).replace(/\\/g, "/")}'`).join("\n"));
let r = spawnSync(ff, ["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-c", "copy", path.join(dir, "joined.mkv")], { encoding: "utf8" });
console.log("join exit", r.status, r.status ? r.stderr.slice(-300) : "");
r = spawnSync(ff, ["-hide_banner", "-y", "-i", path.join(dir, "joined.mkv"), ...buildArchiveArgs({ encoder }), path.join(dir, "class.mp4")], { encoding: "utf8" });
console.log("720p exit", r.status, r.status ? r.stderr.slice(-400) : "");
const p = spawnSync(probe, ["-v", "error", "-show_entries", "stream=codec_name,width,height:format=duration,size", "-of", "csv=p=0", path.join(dir, "class.mp4")], { encoding: "utf8" });
console.log(p.stdout.trim());
const head = fs.readFileSync(path.join(dir, "class.mp4")).subarray(0, 64).toString("latin1");
console.log("moov before mdat (fast start):", fs.readFileSync(path.join(dir, "class.mp4")).indexOf("moov") < fs.readFileSync(path.join(dir, "class.mp4")).indexOf("mdat"), head.includes("ftyp") ? "(mp4)" : "");
