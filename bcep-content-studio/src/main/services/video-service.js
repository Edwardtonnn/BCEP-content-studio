const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
function unpackedBinary(binaryPath) {
  return appPathFix(binaryPath);
}

function appPathFix(binaryPath) {
  return String(binaryPath).replace("app.asar", "app.asar.unpacked");
}

const ffmpegPath = unpackedBinary(require("@ffmpeg-installer/ffmpeg").path);
const ffprobePath = unpackedBinary(require("@ffprobe-installer/ffprobe").path);
const { runProcess } = require("./process-utils");

const HERO_WIDTH = 1200;
const HERO_HEIGHT = 630;
const HERO_JPEG_QUALITY = 82;

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeFileStem(value = "bcep-feature-image") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "bcep-feature-image";
}

function wrapHeadline(value, max = 19) {
  const words = String(value || "NEW BCEP LESSON").toUpperCase().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const proposed = current ? `${current} ${word}` : word;
    if (proposed.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = proposed;
    }
  }
  if (current) lines.push(current);
  const visibleLines = lines.slice(0, 3);
  if (visibleLines.length === 1 && words.length > 1) {
    const splitAt = Math.ceil(words.length / 2);
    return [
      words.slice(0, splitAt).join(" "),
      words.slice(splitAt).join(" ")
    ];
  }
  return visibleLines;
}

function featureOverlaySvg({ title, eyebrow, footer }) {
  const lines = wrapHeadline(title);
  const firstLineY = lines.length === 1 ? 280 : lines.length === 2 ? 225 : 178;
  const headline = lines
    .map(
      (line, index) =>
        `<text x="68" y="${firstLineY + index * 92}" class="headline ${index === lines.length - 1 ? "headline-bold" : "headline-thin"}">${escapeXml(line)}</text>`
    )
    .join("");

  return Buffer.from(`
    <svg width="${HERO_WIDTH}" height="${HERO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#1a1a2e" stop-opacity="0.96"/>
          <stop offset="0.58" stop-color="#16213e" stop-opacity="0.82"/>
          <stop offset="1" stop-color="#16213e" stop-opacity="0.14"/>
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".65"/></filter>
        <style>
          .eyebrow { font: 700 21px Oswald, "Arial Narrow", sans-serif; letter-spacing: 3px; fill: #1a1a2e; }
          .headline { font-family: "Segoe UI", Arial, sans-serif; font-size: 78px; letter-spacing: -2px; filter: url(#shadow); }
          .headline-thin { font-weight: 100; fill: #ffffff; }
          .headline-bold { font-weight: 900; fill: #ffb830; }
          .brand { font: 700 27px Oswald, "Arial Narrow", sans-serif; letter-spacing: 1.5px; fill: #1a1a2e; }
          .footer { font: 600 19px Oswald, "Arial Narrow", sans-serif; letter-spacing: 1px; fill: rgba(255,255,255,0.82); }
        </style>
      </defs>
      <rect width="1200" height="630" fill="url(#shade)"/>
      <path d="M0 0 H6 V630 H0 Z" fill="#ffb830"/>
      <g transform="translate(68 62)">
        <rect width="430" height="46" rx="4" fill="#ffb830"/>
        <text x="20" y="32" class="eyebrow">${escapeXml(eyebrow || "PASS THE APTITUDE TEST")}</text>
      </g>
      ${headline}
      <g transform="translate(68 522)">
        <rect width="365" height="60" rx="6" fill="#ffb830"/>
        <text x="22" y="40" class="brand">BLUE COLLAR EXAM PREP</text>
      </g>
      <text x="465" y="561" class="footer">${escapeXml(footer || "STUDY SMARTER. GET UNION READY.")}</text>
      <path d="M1124 42 l-24 43 h22 l-17 34 49-52 h-24 l19-25 z" fill="#ffb830" opacity=".95"/>
    </svg>
  `);
}

async function getVideoMetadata(videoPath) {
  const { stdout } = await runProcess(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=width,height,codec_type",
    "-of",
    "json",
    videoPath
  ]);
  const data = JSON.parse(stdout);
  const video = data.streams?.find((stream) => stream.codec_type === "video") || {};
  return {
    duration: Number(data.format?.duration || 0),
    width: Number(video.width || 0),
    height: Number(video.height || 0)
  };
}

async function extractFrame(videoPath, seconds) {
  const tempPath = path.join(
    os.tmpdir(),
    `bcep-frame-${crypto.randomUUID()}.png`
  );
  await runProcess(ffmpegPath, [
    "-y",
    "-ss",
    String(Math.max(0, Number(seconds) || 0)),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${HERO_WIDTH}:${HERO_HEIGHT}:force_original_aspect_ratio=increase,crop=${HERO_WIDTH}:${HERO_HEIGHT}`,
    tempPath
  ]);
  return tempPath;
}

async function framePreview(videoPath, seconds) {
  const frame = await extractFrame(videoPath, seconds);
  try {
    const bytes = await fs.readFile(frame);
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } finally {
    await fs.unlink(frame).catch(() => {});
  }
}

async function generateFeatureImage({
  videoPath,
  seconds,
  title,
  eyebrow,
  footer,
  outputDirectory
}) {
  await fs.mkdir(outputDirectory, { recursive: true });
  const frame = await extractFrame(videoPath, seconds);
  const outputPath = path.join(
    outputDirectory,
    `${safeFileStem(title)}-feature.jpg`
  );
  try {
    const background = await sharp(frame)
      .resize(HERO_WIDTH, HERO_HEIGHT, { fit: "cover" })
      .modulate({ saturation: 0.82, brightness: 0.72 })
      .sharpen()
      .png()
      .toBuffer();

    await sharp(background)
      .composite([
        {
          input: featureOverlaySvg({ title, eyebrow, footer }),
          left: 0,
          top: 0
        }
      ])
      .jpeg({
        quality: HERO_JPEG_QUALITY,
        progressive: true,
        chromaSubsampling: "4:2:0",
        mozjpeg: true
      })
      .toFile(outputPath);

    const bytes = await fs.readFile(outputPath);
    return {
      outputPath,
      imageDataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`
    };
  } finally {
    await fs.unlink(frame).catch(() => {});
  }
}

module.exports = {
  HERO_HEIGHT,
  HERO_JPEG_QUALITY,
  HERO_WIDTH,
  escapeXml,
  featureOverlaySvg,
  framePreview,
  generateFeatureImage,
  getVideoMetadata,
  safeFileStem,
  wrapHeadline
};
