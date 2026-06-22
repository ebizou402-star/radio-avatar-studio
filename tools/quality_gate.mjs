import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const results = [];

function pass(label) {
  results.push(label);
  console.log(`PASS ${label}`);
}

function check(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`);
  pass(label);
}

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`FAIL ${label}${detail ? `\n${detail}` : ""}`);
  }

  pass(label);
}

run("JavaScript syntax", process.execPath, ["--check", "app.js"]);
run("single-file build", process.execPath, ["tools/build_single_file.mjs"]);

const sourceHtml = read("index.html");
const app = read("app.js");
const css = read("styles.css");
const distHtml = read("dist/index.html");

const requiredIds = [
  "stage",
  "micButton",
  "secureMicLink",
  "micRecovery",
  "micRecoveryText",
  "micUrlField",
  "copyMicUrlButton",
  "recordButton",
  "hostOfferButton",
  "guestAnswerButton",
  "applyRemoteButton",
  "hangupButton",
  "localSignal",
  "peerSignal",
  "leftDevice",
  "rightDevice",
];
check(requiredIds.every((id) => sourceHtml.includes(`id="${id}"`)), "required controls");

const assetRefs = Array.from(sourceHtml.matchAll(/src="(assets\/[^"?]+)(?:\?v=\d+)?"/g), (match) => match[1]);
check(assetRefs.length > 0, "asset references found");
check(assetRefs.every((file) => fs.existsSync(path.join(root, file))), "referenced assets exist");

check(app.includes("navigator.mediaDevices?.getUserMedia"), "microphone input");
check(app.includes("HTTPS必要") && app.includes("ブラウザ制限") && app.includes("reportMediaError"), "microphone error guidance");
check(app.includes("microphonePolicyAllows") && app.includes("embedding browser policy"), "embedded microphone policy detection");
check(app.includes('setStatus("mic準備")') && app.includes('setStatus("mic")'), "microphone startup states");
check(app.includes("Promise.race") && app.includes("direct browser interaction"), "audio startup timeout");
check(app.includes("copyMicUrlButton") && app.includes("canonicalMicUrl"), "external browser recovery");
check(app.includes("navigator.clipboard?.writeText") && app.includes('document.execCommand?.("copy")'), "URL copy fallback");
check(app.includes('setStatus("URL選択済み")') && app.includes("setSelectionRange"), "manual URL copy fallback");

const micHandler = app.match(/els\.micButton\.addEventListener[\s\S]*?(?=els\.recordButton\.addEventListener)/)?.[0] || "";
const recordHandler = app.match(/els\.recordButton\.addEventListener[\s\S]*?(?=function runRemoteAction)/)?.[0] || "";
check(micHandler.includes("reportMediaError") && !micHandler.includes('setStatus("blocked")'), "microphone error routing");
check(recordHandler.includes("reportMediaError") && !recordHandler.includes('setStatus("blocked")'), "recording error routing");

check(app.includes("new MediaRecorder") && app.includes("encodeWav"), "recording and WAV fallback");
check(app.includes("createChannelMerger(2)"), "stereo recording");
check(
  app.includes("RTCPeerConnection")
    && app.includes('addTransceiver("audio"')
    && app.includes("peer.addTrack")
    && app.includes("peer.createOffer()")
    && app.includes("peer.createAnswer()")
    && app.includes("setLocalDescription")
    && app.includes("setRemoteDescription")
    && app.includes("waitForIceGatheringComplete"),
  "remote audio connection",
);
check(app.includes("clearRemoteSignals();") && app.includes('els.localSignal.value = ""') && app.includes('els.peerSignal.value = ""'), "invite-code cleanup");

check(app.includes("blockedTunnelHostSuffixes") && app.includes("github\\.io"), "trusted URL policy");
check(sourceHtml.includes("Content-Security-Policy") && sourceHtml.includes("form-action 'none'") && sourceHtml.includes("frame-src 'none'"), "source CSP");
check(css.includes("--talk-left") && css.includes("--talk-right") && app.includes("--gesture-left") && app.includes("--gesture-right"), "voice-driven motion");

const styleBlock = distHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
const scriptBlock = distHtml.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] || "";
const csp = distHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1] || "";
const hash = (value) => `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;

check(styleBlock.length > 0 && scriptBlock.length > 0, "single-file content embedded");
check(csp.includes(hash(styleBlock)) && csp.includes(hash(scriptBlock)), "single-file CSP hashes");
check(!/src="assets\//.test(distHtml) && !/href="styles\.css/.test(distHtml), "single-file has no local dependencies");

run("release archive", "zip", [
  "-FS",
  "-r",
  "radio-avatar-site.zip",
  "index.html",
  "app.js",
  "styles.css",
  "README.md",
  "SECURITY.md",
  "AGENTS.md",
  "QUALITY-GATE.md",
  ".nojekyll",
  "assets",
  "dist",
  "tools",
]);
run("archive integrity", "unzip", ["-t", "radio-avatar-site.zip"]);
run("Git whitespace", "git", ["diff", "--check"]);

console.log(`\nQUALITY GATE PASSED (${results.length} checks)`);
