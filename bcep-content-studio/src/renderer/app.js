import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "./styles.css";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  outputDirectory: "",
  videoPath: "",
  videoDuration: 0,
  featurePath: "",
  articlePath: "",
  terminalId: "",
  platform: "win32",
  codexInstalled: false
};

const terminal = new Terminal({
  cursorBlink: true,
  convertEol: true,
  fontFamily: '"Cascadia Code", Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.18,
  theme: {
    background: "#1a1a2e",
    foreground: "#ffffff",
    cursor: "#ffb830",
    selectionBackground: "#ffb83055",
    black: "#16213e",
    brightBlack: "#667085",
    yellow: "#ffb830",
    brightYellow: "#ffb830",
    blue: "#7ec8e3",
    brightBlue: "#5ba8d6",
    cyan: "#7ec8e3",
    brightCyan: "#7ec8e3"
  }
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

function toast(message, kind = "info") {
  const element = $("#toast");
  element.textContent = message;
  element.dataset.kind = kind;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 3600);
}

function setBusy(button, busy, label) {
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent.trim();
  button.disabled = busy;
  button.classList.toggle("busy", busy);
  button.textContent = busy ? label : button.dataset.defaultLabel;
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = (safe % 60).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${remainder}`;
}

function basename(filePath) {
  return String(filePath).split(/[\\/]/).pop();
}

function switchView(name) {
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${name}View`).classList.add("active");
}

async function refreshCodexStatus() {
  state.codexInstalled = await window.bcep.codexStatus();
  const badge = $("#codexBadge");
  badge.textContent = state.codexInstalled ? "Codex ready" : "Codex setup needed";
  badge.classList.toggle("warning", !state.codexInstalled);
  $("#installCodexButton").classList.toggle("attention", !state.codexInstalled);
}

async function selectVideo() {
  const videoPath = await window.bcep.chooseVideo();
  if (!videoPath) return;
  state.videoPath = videoPath;
  $("#videoFileName").textContent = basename(videoPath);
  $("#featureStatus").textContent = "Reading video…";
  try {
    const metadata = await window.bcep.videoMetadata(videoPath);
    state.videoDuration = metadata.duration;
    $("#timestampRange").max = Math.max(0.1, metadata.duration);
    $("#timestampNumber").max = Math.max(0.1, metadata.duration);
    $("#videoMeta").textContent =
      `${metadata.width} × ${metadata.height} • ${formatTime(metadata.duration)}`;
    $("#featureStatus").textContent = "Ready to preview";
    await previewFrame();
  } catch (error) {
    $("#featureStatus").textContent = "Could not read video";
    toast(error.message, "error");
  }
}

function selectedTimestamp() {
  return Math.max(0, Math.min(state.videoDuration || Infinity, Number($("#timestampNumber").value) || 0));
}

function syncTimestamp(source) {
  const value = Number(source.value) || 0;
  $("#timestampRange").value = value;
  $("#timestampNumber").value = value.toFixed(1);
  $("#timestampLabel").textContent = formatTime(value);
}

async function previewFrame() {
  if (!state.videoPath) {
    toast("Choose a video first.", "error");
    return;
  }
  const button = $("#previewFrameButton");
  setBusy(button, true, "Extracting…");
  $("#featureStatus").textContent = "Extracting frame…";
  try {
    const dataUrl = await window.bcep.previewFrame({
      videoPath: state.videoPath,
      seconds: selectedTimestamp()
    });
    $("#featurePreview").src = dataUrl;
    $("#featurePreview").classList.remove("hidden");
    $("#featurePreviewEmpty").classList.add("hidden");
    $("#featureStatus").textContent = `Raw frame at ${formatTime(selectedTimestamp())}`;
  } catch (error) {
    toast(error.message, "error");
    $("#featureStatus").textContent = "Frame extraction failed";
  } finally {
    setBusy(button, false);
  }
}

async function generateFeature() {
  if (!state.videoPath) {
    toast("Choose a video first.", "error");
    return;
  }
  const title = $("#featureTitle").value.trim();
  if (!title) {
    toast("Add a headline.", "error");
    return;
  }
  const button = $("#generateFeatureButton");
  setBusy(button, true, "Creating feature image…");
  $("#featureStatus").textContent = "Applying BCEP design…";
  try {
    const result = await window.bcep.generateFeature({
      videoPath: state.videoPath,
      seconds: selectedTimestamp(),
      title,
      eyebrow: $("#featureEyebrow").value.trim(),
      footer: $("#featureFooter").value.trim(),
      outputDirectory: state.outputDirectory
    });
    state.featurePath = result.outputPath;
    $("#featurePreview").src = result.imageDataUrl;
    $("#featurePreview").classList.remove("hidden");
    $("#featurePreviewEmpty").classList.add("hidden");
    $("#showFeatureButton").classList.remove("hidden");
    $("#featureStatus").textContent = basename(result.outputPath);
    toast("Feature image created.", "success");
  } catch (error) {
    toast(error.message, "error");
    $("#featureStatus").textContent = "Image generation failed";
  } finally {
    setBusy(button, false);
  }
}

async function chooseTranscript() {
  const result = await window.bcep.chooseTranscript();
  if (!result) return;
  $("#transcriptText").value = result.content;
  $("#transcriptMeta").textContent =
    `${basename(result.path)} • ${result.content.trim().split(/\s+/).length.toLocaleString()} words`;
}

function renderArticle() {
  const markdown = $("#articleEditor").value;
  $("#articlePreview").innerHTML = DOMPurify.sanitize(marked.parse(markdown || ""));
}

function setArticleMode(mode) {
  const editing = mode === "edit";
  $("#articleEditor").classList.toggle("hidden", !editing);
  $("#articlePreview").classList.toggle("hidden", editing);
  $("#editArticleTab").classList.toggle("active", editing);
  $("#previewArticleTab").classList.toggle("active", !editing);
  if (!editing) renderArticle();
}

async function generateArticle() {
  const transcript = $("#transcriptText").value.trim();
  const title = $("#articleTitle").value.trim();
  if (!title || !transcript) {
    toast("Add an article topic and transcript first.", "error");
    return;
  }
  const button = $("#generateArticleButton");
  setBusy(button, true, "Codex is writing…");
  $("#articleProgress").textContent = "Starting Codex…";
  try {
    const result = await window.bcep.generateBlog({
      title,
      transcript,
      audience: $("#articleAudience").value.trim(),
      callToAction: $("#articleCta").value.trim(),
      extraInstructions: $("#articleExtra").value.trim(),
      outputDirectory: state.outputDirectory
    });
    state.articlePath = result.outputPath;
    $("#articleEditor").value = result.article;
    $("#articleStatus").textContent = basename(result.outputPath);
    $("#saveArticleButton").disabled = false;
    $("#showArticleButton").classList.remove("hidden");
    $("#articleProgress").textContent = "Draft complete.";
    setArticleMode("edit");
    toast("Article draft created.", "success");
  } catch (error) {
    $("#articleProgress").textContent = error.message;
    toast(error.message, "error");
    if (error.code === "CODEX_NOT_FOUND" || /Codex CLI is not installed/i.test(error.message)) {
      $("#terminalPanel").classList.remove("collapsed");
      setTimeout(() => fitAddon.fit(), 100);
    }
  } finally {
    setBusy(button, false);
    refreshCodexStatus();
  }
}

async function saveArticle() {
  if (!state.articlePath) return;
  try {
    await window.bcep.saveBlog({
      outputPath: state.articlePath,
      article: $("#articleEditor").value
    });
    toast("Article saved.", "success");
    $("#articleStatus").textContent = basename(state.articlePath);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function changeOutputDirectory() {
  const selected = await window.bcep.chooseOutput(state.outputDirectory);
  if (!selected) return;
  state.outputDirectory = selected;
  $("#outputPathButton").textContent = selected;
  $("#terminalCwd").textContent = selected;
  toast("Project folder updated. Restart the terminal to change its working folder.");
}

function terminalCommand(command) {
  if (!state.terminalId) return;
  window.bcep.writeTerminal(state.terminalId, `${command}\r`);
  terminal.focus();
}

function installCodex() {
  const command =
    state.platform === "win32"
      ? "irm https://chatgpt.com/codex/install.ps1 | iex"
      : "curl -fsSL https://chatgpt.com/codex/install.sh | sh";
  const confirmed = window.confirm(
    `This will run OpenAI's official Codex installer in the terminal:\n\n${command}\n\nContinue?`
  );
  if (!confirmed) return;
  terminalCommand(command);
}

async function startTerminal() {
  terminal.open($("#terminal"));
  fitAddon.fit();
  const session = await window.bcep.createTerminal(state.outputDirectory);
  state.terminalId = session.id;
  $("#terminalCwd").textContent = session.cwd;
  terminal.onData((data) => window.bcep.writeTerminal(state.terminalId, data));
  window.bcep.onTerminalData(({ id, data }) => {
    if (id === state.terminalId) terminal.write(data);
  });
  window.bcep.onTerminalExit(({ id, exitCode }) => {
    if (id === state.terminalId) terminal.writeln(`\r\n[Terminal exited: ${exitCode}]`);
  });
  window.addEventListener("resize", () => {
    fitAddon.fit();
    window.bcep.resizeTerminal(state.terminalId, terminal.cols, terminal.rows);
  });
  new ResizeObserver(() => {
    if (!$("#terminalPanel").classList.contains("collapsed")) {
      fitAddon.fit();
      window.bcep.resizeTerminal(state.terminalId, terminal.cols, terminal.rows);
    }
  }).observe($("#terminal"));
}

function bindEvents() {
  $$(".nav-item").forEach((item) =>
    item.addEventListener("click", () => switchView(item.dataset.view))
  );
  $("#outputPathButton").addEventListener("click", changeOutputDirectory);
  $("#openOutputButton").addEventListener("click", () =>
    window.bcep.openPath(state.outputDirectory)
  );
  $("#chooseVideoButton").addEventListener("click", selectVideo);
  $("#timestampRange").addEventListener("input", (event) => syncTimestamp(event.target));
  $("#timestampNumber").addEventListener("input", (event) => syncTimestamp(event.target));
  $("#previewFrameButton").addEventListener("click", previewFrame);
  $("#generateFeatureButton").addEventListener("click", generateFeature);
  $("#showFeatureButton").addEventListener("click", () =>
    window.bcep.showItem(state.featurePath)
  );
  $("#chooseTranscriptButton").addEventListener("click", chooseTranscript);
  $("#generateArticleButton").addEventListener("click", generateArticle);
  $("#saveArticleButton").addEventListener("click", saveArticle);
  $("#showArticleButton").addEventListener("click", () =>
    window.bcep.showItem(state.articlePath)
  );
  $("#editArticleTab").addEventListener("click", () => setArticleMode("edit"));
  $("#previewArticleTab").addEventListener("click", () => setArticleMode("preview"));
  $("#installCodexButton").addEventListener("click", installCodex);
  $("#startCodexButton").addEventListener("click", () => terminalCommand("codex"));
  $("#clearTerminalButton").addEventListener("click", () => terminal.clear());
  $("#toggleTerminalButton").addEventListener("click", () => {
    const collapsed = $("#terminalPanel").classList.toggle("collapsed");
    $(".app-shell").classList.toggle("terminal-collapsed", collapsed);
    $("#toggleTerminalButton").textContent = collapsed ? "Expand" : "Collapse";
    if (!collapsed) setTimeout(() => fitAddon.fit(), 100);
  });
  window.bcep.onBlogProgress((message) => {
    if (message) $("#articleProgress").textContent = message.split("\n").at(-1);
  });
}

async function initialize() {
  const bootstrap = await window.bcep.bootstrap();
  state.outputDirectory = bootstrap.outputDirectory;
  state.platform = bootstrap.platform;
  state.codexInstalled = bootstrap.codexInstalled;
  $("#outputPathButton").textContent = state.outputDirectory;
  $("#terminalCwd").textContent = state.outputDirectory;
  bindEvents();
  await refreshCodexStatus();
  await startTerminal();
}

initialize().catch((error) => {
  console.error(error);
  toast(`Startup failed: ${error.message}`, "error");
});
