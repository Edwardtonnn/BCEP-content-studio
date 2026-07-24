const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBlogPrompt } = require("../src/main/services/blog-service");

test("blog prompt preserves the supplied transcript and BCEP requirements", () => {
  const prompt = buildBlogPrompt({
    title: "Number Sequencing",
    transcript: "Three, seven, fifteen, thirty-one.",
    audience: "Electrical apprenticeship applicants.",
    callToAction: "Visit the BCEP website.",
    extraInstructions: "Keep it under 900 words."
  });

  assert.match(prompt, /Number Sequencing/);
  assert.match(prompt, /Three, seven, fifteen, thirty-one/);
  assert.match(prompt, /Electrical apprenticeship applicants/);
  assert.match(prompt, /Visit the BCEP website/);
  assert.match(prompt, /Keep it under 900 words/);
  assert.match(prompt, /Return Markdown only/);
});
