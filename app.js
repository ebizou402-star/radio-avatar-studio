const root = document.documentElement;
const body = document.body;
const canvas = document.querySelector("#waveform");
const ctx2d = canvas.getContext("2d");

const els = {
  bodyLeft: document.querySelector("#bodyLeft"),
  bodyRight: document.querySelector("#bodyRight"),
  headLeft: document.querySelector("#headLeft"),
  headRight: document.querySelector("#headRight"),
  mouthLeft: document.querySelector("#mouthLeft"),
  mouthRight: document.querySelector("#mouthRight"),
  signalLeft: document.querySelector("#signalLeft"),
  signalRight: document.querySelector("#signalRight"),
  micButton: document.querySelector("#micButton"),
  recordButton: document.querySelector("#recordButton"),
  recordButtonText: document.querySelector("#recordButtonText"),
  recordTimer: document.querySelector("#recordTimer"),
  recordDownload: document.querySelector("#recordDownload"),
  hostOfferButton: document.querySelector("#hostOfferButton"),
  guestAnswerButton: document.querySelector("#guestAnswerButton"),
  applyRemoteButton: document.querySelector("#applyRemoteButton"),
  hangupButton: document.querySelector("#hangupButton"),
  copySignalButton: document.querySelector("#copySignalButton"),
  localSignal: document.querySelector("#localSignal"),
  peerSignal: document.querySelector("#peerSignal"),
  remoteStatus: document.querySelector("#remoteStatus"),
  remoteAudio: document.querySelector("#remoteAudio"),
  demoButton: document.querySelector("#demoButton"),
  stageOnlyButton: document.querySelector("#stageOnlyButton"),
  audioFile: document.querySelector("#audioFile"),
  audioPlayer: document.querySelector("#audioPlayer"),
  leftDevice: document.querySelector("#leftDevice"),
  rightDevice: document.querySelector("#rightDevice"),
  statusText: document.querySelector("#statusText"),
  sensitivity: document.querySelector("#sensitivity"),
  motion: document.querySelector("#motion"),
  decay: document.querySelector("#decay"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
};

const state = {
  audioContext: null,
  analyserLeft: null,
  analyserRight: null,
  sourcePlayer: null,
  streamLeft: null,
  streamRight: null,
  inputMode: "local",
  peer: null,
  remoteStream: null,
  remoteRole: "",
  recorder: null,
  recordingActive: false,
  recordingChunks: [],
  wavFrames: [],
  recordingStartedAt: 0,
  recordingTimer: null,
  recordingSampleRate: 44100,
  recordingUrl: "",
  recordNodes: [],
  mode: "auto",
  demo: false,
  demoStarted: performance.now(),
  activeSpeaker: "left",
  activeUntil: 0,
  leftLevel: 0,
  rightLevel: 0,
  rawLeft: 0,
  rawRight: 0,
  waveform: new Float32Array(96),
};

const analyserData = new Uint8Array(1024);

function setStatus(text) {
  els.statusText.textContent = text;
}

function setRemoteStatus(text) {
  els.remoteStatus.textContent = text;
}

function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }
  if (state.audioContext.state === "suspended") {
    return state.audioContext.resume();
  }
  return Promise.resolve();
}

function makeAnalyser() {
  const analyser = state.audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.58;
  return analyser;
}

function rmsFromAnalyser(analyser) {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(analyserData);

  let sum = 0;
  for (let i = 0; i < analyserData.length; i += 1) {
    const centered = (analyserData[i] - 128) / 128;
    sum += centered * centered;
  }

  const rms = Math.sqrt(sum / analyserData.length);
  const sensitivity = Number(els.sensitivity.value);
  return clamp((rms - 0.015) * sensitivity * 7, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function populateDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === "audioinput");
  const options = inputs.length
    ? inputs.map((device, index) => ({
        value: device.deviceId,
        label: device.label || `Input ${index + 1}`,
      }))
    : [{ value: "", label: "Default input" }];

  for (const select of [els.leftDevice, els.rightDevice]) {
    const previous = select.value;
    select.replaceChildren();
    for (const option of options) {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      select.append(node);
    }
    if (options.some((option) => option.value === previous)) {
      select.value = previous;
    }
  }
}

async function getInputStream(deviceId) {
  const audio = {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
  return navigator.mediaDevices.getUserMedia({ audio, video: false });
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function hasLiveAudio(stream) {
  return stream?.getAudioTracks().some((track) => track.readyState === "live") || false;
}

function disconnectRecordNodes() {
  state.recordNodes.forEach((node) => node.disconnect());
  state.recordNodes = [];
}

function connectAnalyser(stream, side) {
  const analyser = makeAnalyser();
  state.audioContext.createMediaStreamSource(stream).connect(analyser);
  if (side === "left") state.analyserLeft = analyser;
  else state.analyserRight = analyser;
}

async function ensureLocalMic(force = false) {
  await ensureAudioContext();

  if (!force && hasLiveAudio(state.streamLeft)) return state.streamLeft;

  if (!els.leftDevice.options.length) {
    const primer = await getInputStream("");
    stopStream(primer);
    await populateDevices();
  }

  stopStream(state.streamLeft);
  state.streamLeft = await getInputStream(els.leftDevice.value);
  connectAnalyser(state.streamLeft, "left");
  await populateDevices();
  return state.streamLeft;
}

async function startMicrophones() {
  await ensureAudioContext();
  setStatus("mic");
  state.demo = false;
  hangUpRemote(false);
  state.inputMode = "local";
  stopStream(state.streamLeft);
  stopStream(state.streamRight);

  if (!els.leftDevice.options.length) {
    const primer = await getInputStream("");
    stopStream(primer);
    await populateDevices();
  }

  state.streamLeft = await getInputStream(els.leftDevice.value);
  connectAnalyser(state.streamLeft, "left");

  const useSameDevice = els.rightDevice.value === els.leftDevice.value;
  state.streamRight = useSameDevice ? state.streamLeft : await getInputStream(els.rightDevice.value);
  connectAnalyser(state.streamRight, "right");

  await populateDevices();
}

function encodeSignal(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeSignal(value) {
  const compact = value.replace(/\s/g, "");
  const binary = atob(compact);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function waitForIceGatheringComplete(peer) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (peer.iceGatheringState === "complete") done();
    };
    const timeout = setTimeout(done, 4500);
    peer.addEventListener("icegatheringstatechange", onStateChange);
  });
}

function createPeer(role) {
  if (!window.RTCPeerConnection) {
    throw new Error("WebRTC is not available in this browser.");
  }

  hangUpRemote(false);
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  state.peer = peer;
  state.remoteRole = role;
  state.inputMode = "remote";
  setRemoteStatus(role === "host" ? "招待作成中" : "回答作成中");

  peer.addEventListener("track", (event) => {
    attachRemoteStream(event.streams[0] || new MediaStream([event.track]));
  });

  peer.addEventListener("connectionstatechange", () => {
    if (peer.connectionState === "connected") setRemoteStatus("接続中");
    if (peer.connectionState === "failed") setRemoteStatus("失敗");
    if (peer.connectionState === "disconnected") setRemoteStatus("切断");
  });

  peer.addEventListener("iceconnectionstatechange", () => {
    if (peer.iceConnectionState === "checking") setRemoteStatus("確認中");
    if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
      setRemoteStatus("接続中");
    }
  });

  return peer;
}

async function addLocalAudio(peer) {
  const stream = await ensureLocalMic();
  stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
}

async function attachRemoteStream(stream) {
  await ensureAudioContext();

  if (state.streamRight && state.streamRight !== state.streamLeft && state.streamRight !== stream) {
    stopStream(state.streamRight);
  }

  state.remoteStream = stream;
  state.streamRight = stream;
  state.inputMode = "remote";
  connectAnalyser(stream, "right");
  els.remoteAudio.srcObject = stream;
  els.remoteAudio.play().catch(() => {});
  setMode("auto");
  setRemoteStatus("接続中");
  setStatus("remote");
}

async function createHostOffer() {
  await ensureAudioContext();
  state.demo = false;
  const peer = createPeer("host");
  await addLocalAudio(peer);
  const offer = await peer.createOffer({ offerToReceiveAudio: true });
  await peer.setLocalDescription(offer);
  await waitForIceGatheringComplete(peer);
  els.localSignal.value = encodeSignal(peer.localDescription);
  els.peerSignal.value = "";
  setRemoteStatus("招待コード");
}

async function createGuestAnswer() {
  await ensureAudioContext();
  state.demo = false;
  const offer = decodeSignal(els.peerSignal.value);
  const peer = createPeer("guest");
  await addLocalAudio(peer);
  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  await waitForIceGatheringComplete(peer);
  els.localSignal.value = encodeSignal(peer.localDescription);
  setRemoteStatus("回答コード");
}

async function applyRemoteSignal() {
  if (!state.peer) {
    setRemoteStatus("招待なし");
    return;
  }

  const signal = decodeSignal(els.peerSignal.value);
  await state.peer.setRemoteDescription(signal);
  setRemoteStatus("接続待ち");
}

function hangUpRemote(updateStatus = true) {
  if (state.peer) state.peer.close();

  if (state.remoteStream) {
    stopStream(state.remoteStream);
  }

  if (state.streamRight === state.remoteStream) {
    state.streamRight = null;
    state.analyserRight = null;
  }

  state.peer = null;
  state.remoteStream = null;
  state.remoteRole = "";
  els.remoteAudio.srcObject = null;
  state.inputMode = "local";
  if (updateStatus) {
    setRemoteStatus("未接続");
    setStatus("standby");
  }
}

function recordingMimeType() {
  if (!window.MediaRecorder) return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function setRecordingUi(isRecording) {
  els.recordButton.classList.toggle("is-recording", isRecording);
  els.recordButtonText.textContent = isRecording ? "録音停止" : "録音開始";
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function ensureLiveInputs() {
  if (state.inputMode === "remote") {
    await ensureLocalMic();
    if (!state.streamRight) {
      throw new Error("Remote audio is not connected.");
    }
    return;
  }

  if (!hasLiveAudio(state.streamLeft) || !hasLiveAudio(state.streamRight)) {
    await startMicrophones();
  }
}

function createRecordingMerger() {
  const merger = state.audioContext.createChannelMerger(2);
  const leftSource = state.audioContext.createMediaStreamSource(state.streamLeft);
  const rightSource = state.audioContext.createMediaStreamSource(state.streamRight);
  const leftGain = state.audioContext.createGain();
  const rightGain = state.audioContext.createGain();

  leftGain.gain.value = 0.9;
  rightGain.gain.value = 0.9;
  leftSource.connect(leftGain);
  rightSource.connect(rightGain);
  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);

  state.recordNodes = [leftSource, rightSource, leftGain, rightGain, merger];
  return merger;
}

function createRecordingStream() {
  const destination = state.audioContext.createMediaStreamDestination();
  const merger = createRecordingMerger();
  merger.connect(destination);
  state.recordNodes.push(destination);
  return destination.stream;
}

function resetRecordingLink() {
  if (state.recordingUrl) {
    URL.revokeObjectURL(state.recordingUrl);
    state.recordingUrl = "";
  }

  els.recordDownload.removeAttribute("href");
  els.recordDownload.removeAttribute("download");
  els.recordDownload.classList.add("disabled");
}

function startRecordingTimer() {
  state.recordingStartedAt = performance.now();
  els.recordTimer.textContent = "00:00";
  state.recordingTimer = setInterval(() => {
    els.recordTimer.textContent = formatDuration(performance.now() - state.recordingStartedAt);
  }, 250);
}

function finishRecordingBlob(blob, extension) {
  clearInterval(state.recordingTimer);
  state.recordingTimer = null;
  disconnectRecordNodes();

  state.recordingUrl = URL.createObjectURL(blob);
  els.recordDownload.href = state.recordingUrl;
  els.recordDownload.download = `futari-radio-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  els.recordDownload.classList.remove("disabled");
  els.recordDownload.textContent = `録音ファイル ${formatDuration(performance.now() - state.recordingStartedAt)}`;
  state.recorder = null;
  state.recordingActive = false;
  setRecordingUi(false);
  setStatus("saved");
}

function abortRecording() {
  clearInterval(state.recordingTimer);
  state.recordingTimer = null;
  state.recordingActive = false;
  state.recorder = null;
  state.wavFrames = [];
  disconnectRecordNodes();
  setRecordingUi(false);
}

async function prepareRecording() {
  await ensureAudioContext();
  await ensureLiveInputs();
  state.recordingChunks = [];
  state.wavFrames = [];
  resetRecordingLink();
  startRecordingTimer();
  state.recordingActive = true;
  setRecordingUi(true);
  setStatus("rec");
}

async function startMediaRecording() {
  await prepareRecording();

  const mimeType = recordingMimeType();
  const stream = createRecordingStream();
  state.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  state.recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) state.recordingChunks.push(event.data);
  });

  state.recorder.addEventListener("stop", () => {
    const type = state.recorder.mimeType || mimeType || "audio/webm";
    const blob = new Blob(state.recordingChunks, { type });
    const extension = type.includes("mp4") ? "mp4" : "webm";
    finishRecordingBlob(blob, extension);
  });

  state.recorder.start(1000);
}

function encodeWav(frames, sampleRate) {
  const channelCount = 2;
  const sampleCount = frames.reduce((total, frame) => total + frame.left.length, 0);
  const buffer = new ArrayBuffer(44 + sampleCount * channelCount * 2);
  const view = new DataView(buffer);
  let offset = 0;

  function writeString(value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  }

  function writeUint32(value) {
    view.setUint32(offset, value, true);
    offset += 4;
  }

  function writeUint16(value) {
    view.setUint16(offset, value, true);
    offset += 2;
  }

  writeString("RIFF");
  writeUint32(36 + sampleCount * channelCount * 2);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16);
  writeUint16(1);
  writeUint16(channelCount);
  writeUint32(sampleRate);
  writeUint32(sampleRate * channelCount * 2);
  writeUint16(channelCount * 2);
  writeUint16(16);
  writeString("data");
  writeUint32(sampleCount * channelCount * 2);

  for (const frame of frames) {
    for (let i = 0; i < frame.left.length; i += 1) {
      const left = clamp(frame.left[i], -1, 1);
      const right = clamp(frame.right[i], -1, 1);
      view.setInt16(offset, left < 0 ? left * 0x8000 : left * 0x7fff, true);
      offset += 2;
      view.setInt16(offset, right < 0 ? right * 0x8000 : right * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function startWavRecording() {
  await prepareRecording();

  const merger = createRecordingMerger();
  const processor = state.audioContext.createScriptProcessor(4096, 2, 2);
  const silentGain = state.audioContext.createGain();
  silentGain.gain.value = 0;
  state.recordingSampleRate = state.audioContext.sampleRate;

  processor.onaudioprocess = (event) => {
    const left = event.inputBuffer.getChannelData(0);
    const right = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : left;
    state.wavFrames.push({
      left: new Float32Array(left),
      right: new Float32Array(right),
    });
  };

  merger.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(state.audioContext.destination);
  state.recordNodes.push(processor, silentGain);
}

function finishWavRecording() {
  const blob = encodeWav(state.wavFrames, state.recordingSampleRate);
  state.wavFrames = [];
  finishRecordingBlob(blob, "wav");
}

async function startRecording() {
  if (window.MediaRecorder) {
    await startMediaRecording();
    return;
  }

  await startWavRecording();
}

function stopRecording() {
  if (state.recorder?.state === "recording") {
    state.recorder.stop();
    return;
  }

  if (state.recordingActive) {
    finishWavRecording();
  }
}

async function setupPlayerSource() {
  await ensureAudioContext();
  if (state.sourcePlayer) return;

  state.sourcePlayer = state.audioContext.createMediaElementSource(els.audioPlayer);
  const splitter = state.audioContext.createChannelSplitter(2);
  state.analyserLeft = makeAnalyser();
  state.analyserRight = makeAnalyser();

  state.sourcePlayer.connect(splitter);
  splitter.connect(state.analyserLeft, 0);
  splitter.connect(state.analyserRight, 1);
  state.sourcePlayer.connect(state.audioContext.destination);
}

async function loadAudioFile(file) {
  if (!file) return;
  state.demo = false;
  setStatus("file");
  await setupPlayerSource();
  els.audioPlayer.src = URL.createObjectURL(file);
  await els.audioPlayer.play().catch(() => {
    setStatus("loaded");
  });
}

function setMode(mode) {
  state.mode = mode;
  els.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function demoLevels(now) {
  const elapsed = (now - state.demoStarted) / 1000;
  const phrase = Math.floor(elapsed / 1.7) % 4;
  const pulse = Math.max(0, Math.sin(elapsed * 10.2)) * 0.45 + Math.random() * 0.35;

  if (phrase === 0) return [pulse, 0.08 + Math.random() * 0.08];
  if (phrase === 1) return [0.06 + Math.random() * 0.08, pulse * 0.9];
  if (phrase === 2) return [pulse * 0.72, pulse * 0.66];
  return [0.1 + Math.random() * 0.1, 0.08 + Math.random() * 0.12];
}

function splitMonoLevel(level, now) {
  if (state.mode === "left") return [level, 0];
  if (state.mode === "right") return [0, level];
  if (state.mode === "duet") return [level * 0.92, level * 0.9];

  if (level > 0.16 && now > state.activeUntil) {
    state.activeSpeaker = state.activeSpeaker === "left" ? "right" : "left";
    state.activeUntil = now + 900 + Math.random() * 1800;
  }

  return state.activeSpeaker === "left" ? [level, level * 0.18] : [level * 0.18, level];
}

function resolveLevels(now) {
  if (state.demo) return demoLevels(now);

  const left = rmsFromAnalyser(state.analyserLeft);
  const right = rmsFromAnalyser(state.analyserRight);
  state.rawLeft = left;
  state.rawRight = right;

  const looksMono = Math.abs(left - right) < 0.025;
  if (looksMono) {
    return splitMonoLevel(Math.max(left, right), now);
  }

  if (state.mode === "left") return [Math.max(left, right), 0];
  if (state.mode === "right") return [0, Math.max(left, right)];
  if (state.mode === "duet") return [Math.max(left, right), Math.max(left, right)];
  return [left, right];
}

function smooth(current, target) {
  const decay = Number(els.decay.value);
  if (target > current) return current * 0.34 + target * 0.66;
  return current * decay + target * (1 - decay);
}

function drawWaveform(left, right) {
  const width = canvas.width;
  const height = canvas.height;
  ctx2d.clearRect(0, 0, width, height);

  state.waveform.copyWithin(0, 1);
  state.waveform[state.waveform.length - 1] = Math.max(left, right);

  ctx2d.lineWidth = 5;
  ctx2d.lineCap = "round";
  ctx2d.strokeStyle = "rgba(247, 241, 233, 0.86)";
  ctx2d.beginPath();

  for (let i = 0; i < state.waveform.length; i += 1) {
    const x = (i / (state.waveform.length - 1)) * width;
    const amp = state.waveform[i];
    const wobble = Math.sin(i * 0.55 + performance.now() / 130) * amp * 38;
    const y = height / 2 + wobble;
    if (i === 0) ctx2d.moveTo(x, y);
    else ctx2d.lineTo(x, y);
  }
  ctx2d.stroke();

  ctx2d.fillStyle = `rgba(238, 97, 72, ${0.16 + left * 0.36})`;
  ctx2d.fillRect(0, height - 10 - left * 92, width / 2 - 8, 8 + left * 92);
  ctx2d.fillStyle = `rgba(85, 166, 161, ${0.16 + right * 0.36})`;
  ctx2d.fillRect(width / 2 + 8, height - 10 - right * 92, width / 2 - 8, 8 + right * 92);
}

function render(now) {
  const [targetLeft, targetRight] = resolveLevels(now);
  const motion = Number(els.motion.value);

  state.leftLevel = smooth(state.leftLevel, targetLeft);
  state.rightLevel = smooth(state.rightLevel, targetRight);

  const leftTalk = clamp(state.leftLevel * motion, 0, 1);
  const rightTalk = clamp(state.rightLevel * motion, 0, 1);

  root.style.setProperty("--talk-left", leftTalk.toFixed(3));
  root.style.setProperty("--talk-right", rightTalk.toFixed(3));
  els.mouthLeft.style.opacity = String(0.18 + leftTalk * 0.8);
  els.mouthRight.style.opacity = String(0.18 + rightTalk * 0.8);
  els.signalLeft.style.opacity = String(leftTalk * 0.85);
  els.signalRight.style.opacity = String(rightTalk * 0.85);
  els.signalLeft.style.transform = `translate(-50%, -50%) scale(${0.7 + leftTalk * 0.9})`;
  els.signalRight.style.transform = `translate(-50%, -50%) scale(${0.7 + rightTalk * 0.9})`;

  drawWaveform(leftTalk, rightTalk);
  requestAnimationFrame(render);
}

els.micButton.addEventListener("click", () => {
  startMicrophones().catch((error) => {
    console.error(error);
    setStatus("blocked");
  });
});

els.recordButton.addEventListener("click", () => {
  if (state.recordingActive || state.recorder?.state === "recording") {
    stopRecording();
    return;
  }

  startRecording().catch((error) => {
    console.error(error);
    abortRecording();
    setStatus("blocked");
  });
});

function runRemoteAction(action) {
  action().catch((error) => {
    console.error(error);
    setRemoteStatus("失敗");
    setStatus("blocked");
  });
}

els.hostOfferButton.addEventListener("click", () => {
  runRemoteAction(createHostOffer);
});

els.guestAnswerButton.addEventListener("click", () => {
  runRemoteAction(createGuestAnswer);
});

els.applyRemoteButton.addEventListener("click", () => {
  runRemoteAction(applyRemoteSignal);
});

els.hangupButton.addEventListener("click", () => {
  hangUpRemote(true);
});

els.copySignalButton.addEventListener("click", () => {
  const signal = els.localSignal.value.trim();
  if (!signal) {
    setRemoteStatus("コードなし");
    return;
  }

  if (!navigator.clipboard?.writeText) {
    els.localSignal.focus();
    els.localSignal.select();
    setRemoteStatus("選択中");
    return;
  }

  navigator.clipboard.writeText(signal).then(() => setRemoteStatus("コピー済み")).catch(() => {
    els.localSignal.focus();
    els.localSignal.select();
    setRemoteStatus("選択中");
  });
});

els.demoButton.addEventListener("click", () => {
  state.demo = !state.demo;
  state.demoStarted = performance.now();
  setStatus(state.demo ? "demo" : "standby");
});

els.stageOnlyButton.addEventListener("click", () => {
  body.classList.toggle("stage-only");
});

els.audioFile.addEventListener("change", (event) => {
  loadAudioFile(event.target.files?.[0]).catch((error) => {
    console.error(error);
    setStatus("blocked");
  });
});

els.leftDevice.addEventListener("change", () => {
  if (state.inputMode === "remote" && state.peer) {
    ensureLocalMic(true)
      .then((stream) => {
        const track = stream.getAudioTracks()[0];
        const sender = state.peer.getSenders().find((item) => item.track?.kind === "audio");
        return sender?.replaceTrack(track);
      })
      .catch((error) => {
        console.error(error);
        setRemoteStatus("失敗");
      });
    return;
  }

  if (state.streamLeft) startMicrophones();
});

els.rightDevice.addEventListener("change", () => {
  if (state.inputMode === "remote") return;
  if (state.streamRight) startMicrophones();
});

els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "1") setMode("left");
  if (event.key === "2") setMode("right");
  if (event.key === "0") setMode("auto");
});

if (new URLSearchParams(location.search).has("stage")) {
  body.classList.add("stage-only");
}

if (new URLSearchParams(location.search).has("guest")) {
  body.classList.add("guest-mode");
  setStatus("guest");
  setRemoteStatus("携帯待機");
}

populateDevices().catch(() => {});
requestAnimationFrame(render);
