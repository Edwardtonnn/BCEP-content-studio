const fs = require("node:fs/promises");
const path = require("node:path");
const { runProcess } = require("./process-utils");
const { safeFileStem } = require("./video-service");

function buildBlogPrompt({
  title,
  transcript,
  audience,
  callToAction,
  extraInstructions
}) {
  return `You are the editorial writer for Blue Collar Exam Prep (BCEP).

Write a useful, accurate blog article based only on the supplied video transcript.

ARTICLE TOPIC
${title}

AUDIENCE
${audience || "Beginners preparing for electrical union apprenticeship aptitude tests."}

EDITORIAL REQUIREMENTS
- Use a direct, practical, encouraging, beginner-friendly, trade-respectful voice.
- Write in plain language, second person, like one tradesperson helping another.
- Do not use hype, "guru" language, or corporate marketing language.
- Do not invent personal stories, statistics, union requirements, application dates, or facts missing from the transcript.
- Treat the transcript as the factual ceiling. Do not embellish beyond it.
- Only use first-person founder framing when the transcript explicitly supports it.
- Correct obvious transcription errors silently.
- Explain the lesson more clearly than a raw transcript.
- Use short paragraphs, descriptive H2 headings, and only practical examples supported by the transcript.
- Include a concise introduction and conclusion.
- Include a Key Takeaways section.
- Include an SEO title, slug, and meta description in a YAML front matter block.
- End with this call to action: ${callToAction || "Visit bluecollarexamprep.com for the free study guide and more apprenticeship exam preparation."}
- Return Markdown only. Do not wrap the article in a Markdown code fence.
${extraInstructions ? `\nADDITIONAL INSTRUCTIONS\n${extraInstructions}` : ""}

VIDEO TRANSCRIPT
---
${transcript}
---`;
}

async function findCommand(command) {
  const checker = process.platform === "win32" ? "where.exe" : "which";
  try {
    const result = await runProcess(checker, [command]);
    const resolved = result.stdout.split(/\r?\n/).find(Boolean);
    if (resolved) return resolved.trim();
  } catch {
    // Check the standalone Codex install location below.
  }
  if (process.platform === "win32" && command.toLowerCase() === "codex") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const standalone = path.join(
        localAppData,
        "Programs",
        "OpenAI",
        "Codex",
        "bin",
        "codex.exe"
      );
      try {
        await fs.access(standalone);
        return standalone;
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function commandExists(command) {
  return Boolean(await findCommand(command));
}

async function generateBlog(payload, onProgress) {
  const executable = await findCommand("codex");
  if (!executable) {
    const error = new Error(
      "Codex CLI is not installed or is not on PATH. Open the terminal panel and choose Install Codex, then sign in with `codex login`."
    );
    error.code = "CODEX_NOT_FOUND";
    throw error;
  }

  const outputDirectory = path.resolve(payload.outputDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    `${safeFileStem(payload.title)}.md`
  );
  const prompt = buildBlogPrompt(payload);

  onProgress?.("Starting Codex article generation…");
  await runProcess(
    executable,
    [
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--output-last-message",
      outputPath,
      "-"
    ],
    {
      cwd: outputDirectory,
      input: prompt,
      onStderr: (text) => onProgress?.(text.trim())
    }
  );

  const article = await fs.readFile(outputPath, "utf8");
  return { outputPath, article };
}

async function saveBlog({ outputPath, article }) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, article, "utf8");
  return { outputPath };
}

module.exports = {
  buildBlogPrompt,
  commandExists,
  findCommand,
  generateBlog,
  saveBlog
};
