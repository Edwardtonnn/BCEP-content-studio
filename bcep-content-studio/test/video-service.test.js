const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HERO_JPEG_QUALITY,
  safeFileStem,
  wrapHeadline
} = require("../src/main/services/video-service");

test("feature images use the agreed web JPEG quality", () => {
  assert.equal(HERO_JPEG_QUALITY, 82);
});

test("safeFileStem creates Windows-friendly names", () => {
  assert.equal(
    safeFileStem("  Number Sequencing: 3 Methods!  "),
    "number-sequencing-3-methods"
  );
});

test("wrapHeadline limits the feature headline to three lines", () => {
  const lines = wrapHeadline(
    "How to Solve Difficult Number Sequencing Aptitude Questions",
    18
  );
  assert.ok(lines.length <= 3);
  assert.ok(lines.every((line) => line === line.toUpperCase()));
});
