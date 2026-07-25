const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HERO_JPEG_QUALITY,
  featureOverlaySvg,
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

test("short headlines split into the BCEP thin and bold title pattern", () => {
  assert.deepEqual(wrapHeadline("Number Sequencing"), ["NUMBER", "SEQUENCING"]);
});

test("feature overlay uses the consolidated BCEP palette and typography", () => {
  const svg = featureOverlaySvg({
    title: "Number Sequencing",
    eyebrow: "TEST PREP",
    footer: "FIND THE PATTERN"
  }).toString();

  assert.match(svg, /#ffb830/i);
  assert.match(svg, /#1a1a2e/i);
  assert.match(svg, /headline-thin/);
  assert.match(svg, /headline-bold/);
  assert.doesNotMatch(svg, /#ffd(?:000|700)/i);
  assert.doesNotMatch(svg, /Impact|Arial Black/i);
});
