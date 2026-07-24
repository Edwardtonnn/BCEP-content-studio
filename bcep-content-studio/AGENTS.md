# BCEP Content Studio

Single reference file for this repo — setup, rules, and current pipeline
status all in one place. Update this file as things change instead of
re-explaining context from scratch each session. Codex reads this file by
its own convention; Claude Code should be pointed at it explicitly since it
normally looks for `CLAUDE.md`.

**Last verified against disk:** 2026-07-23.

## What this app is

BCEP Content Studio is a Windows desktop app that turns a Blue Collar Exam
Prep OBS recording into the media a blog post needs — a branded feature
image and a transcript. It is an upstream media generator, not a publisher:
it does not write the final blog article and does not publish or deploy
anything. Those stay separate, human-reviewed steps.

## Current on-disk state (verified, not assumed)

As of this writing, the shipped code is still the **original MVP**:

- `src/main/main.js` registers Codex-terminal and Codex-blog-article IPC
  handlers, output goes to a generic `Documents/BCEP Content Studio` folder
  chosen per session (not persisted).
- `src/main/services/blog-service.js` sends a pasted/loaded transcript to
  the installed Codex CLI and writes an editable Markdown draft.
- `src/main/services/terminal-service.js` is an embedded PowerShell terminal
  with a `codex` mode that runs `codex exec --sandbox workspace-write`,
  letting Codex edit this project's own source from inside the packaged app.
- `package.json` depends on `@xterm/xterm`, `@xterm/addon-fit`, `marked`,
  and `dompurify` for the terminal UI and Markdown preview.

A refactor that removed all of the above was implemented and verified
working earlier in this project's life (tests passing, a real 1200×630
image generated end-to-end from a synthetic video). **That refactor is not
on disk right now** — this folder reverted to the pre-refactor state
through some mechanism outside either agent's edits (this project lives in
Dropbox and has no git history, so there's no diff to point to — a sync
conflict from another device is the likely cause, but it can't be confirmed
without git). Don't assume any prior description of "what's implemented"
in this file or elsewhere is accurate — re-check the actual files before
building on top of them. Initializing git here would make future "did
something revert?" questions answerable instead of requiring a full
file-by-file re-read; consider doing that before more work happens.

## Setup

1. Install [Node.js LTS](https://nodejs.org/).
2. `npm install`
3. `npm start` (builds the renderer, then launches Electron)
4. In the bottom terminal, select **Install Codex** if not already
   installed, then run `codex login`.

FFmpeg/FFprobe are bundled via npm dependencies and don't need a separate
system install.

## Dev commands

```powershell
npm install
npm start        # build + launch
npm test         # node --test test/*.test.js
npm run build    # esbuild renderer bundle only
npm run dist:win # Windows installer + portable exe, output in release/
```

There is no auto-update mechanism — `dist:win` + manually replacing the old
installed copy is the right amount of effort for a single-user internal
tool. Don't build auto-update infrastructure for this.

## Project structure (current, reflects the MVP state above)

```text
src/main/main.js                       Electron window and IPC registration
src/main/services/video-service.js     Frame extraction and BCEP image composition
src/main/services/blog-service.js      Codex article prompt + Markdown generation
src/main/services/terminal-service.js  Embedded PowerShell + Codex update mode
src/main/services/process-utils.js     Shared subprocess helpers
src/preload.js                         Secure renderer bridge
src/renderer/                          Interface (Feature Image / Blog Article / Workflow views)
scripts/                               Renderer + icon build scripts
test/                                  Automated tests
examples/                              Sample output (currently a JPEG — see Image format below)
```

## Agent rules (apply regardless of which pipeline design below is chosen)

- Keep `contextIsolation: true` and `nodeIntegration: false`. Expose only
  narrow operations through `src/preload.js`. Never send secrets, Codex
  auth files, or environment dumps to the renderer.
- Keep video processing, transcription/article generation, and settings
  persistence in separate modules under `src/main/services`.
- **No embedded coding agent that edits this app's own source from inside
  the packaged app.** If BCEP Content Studio's own code needs a change,
  that happens the normal way — open this repo directly in an editor,
  Claude Code, or Codex CLI. This is a deliberate design goal (removing the
  Codex-terminal self-edit mode), not yet reflected in the current on-disk
  code described above.
- Never overwrite an existing feature image, transcript, or other
  lesson-folder file without an explicit user-facing confirmation step.
- No automatic publishing, deletion, uploads, or external writes without an
  explicit user-facing confirmation step. Deployment stays manual.
- Use the BCEP palette already defined in `src/renderer/styles.css`. Keep
  the interface direct, readable, and useful on 1080p Windows displays.
- After code changes, run `npm test` and `npm run build`. For feature-image
  changes, also generate a sample image from a real video and verify its
  format matches whatever is decided below (currently a 1200 × 630
  progressive JPEG, quality 82, 4:2:0 chroma subsampling, filename
  `feature.jpg` — see `examples/number-sequencing-feature.jpg`).

## Pipeline design — open decisions

Two different redesigns of the media pipeline have been proposed and
**neither is implemented** in the current on-disk MVP code:

**Direct-to-blog model** (simpler): Website Folder setting persisted in
`%APPDATA%`, a lesson-slug field in the UI, `feature.png`/`transcript.txt`
saved straight into `<websiteFolder>/blog/<slug>/` with no staging folder,
local Whisper transcription (system Python + `openai-whisper`, self-installs
on first use, uses the app's bundled FFmpeg), overwrite-confirmation on
every write, and a real status check instead of a decorative pipeline view.
Codex-terminal and Markdown-article generation are removed entirely under
this model.

**Private-staging model**: writes to a private `_video/incoming/<slug>/`
area instead of touching `blog/` directly; `blog/<slug>/` only receives
final, reviewed output. Supports multiple **feature-image candidates** per
lesson (Claude/the reviewing agent picks the strongest one) plus a
**"content brief"** accompanying the transcript into the intake folder
(not yet specified — needs its own design if this direction is chosen).
Explicitly forbids ever copying transcripts, drafts, or alternate images
into `blog/`.

| | Direct-to-blog | Private-staging |
|---|---|---|
| Staging location | `blog/<slug>/` directly | `_video/incoming/<slug>/`, then curated into `blog/<slug>/` |
| Image format | `feature.png` | `feature.jpg`, progressive, q82, 4:2:0 |
| Image candidates | One generated image | Multiple candidates, best one selected |
| Transcript in `blog/`? | Yes, `transcript.txt` saved there | No — stays private, never copied out |
| Extra content | `source.json` (generation metadata) | "content brief" (undefined so far) |

Note: the website repo (`_Blue Collar Exam Prep/website`) currently only has
a `_video-drops/` folder — a Whisper-only stopgap kept around until Content
Studio's own transcription is proven. It does not have the `_video/incoming/`
folder the private-staging model describes; that folder doesn't exist yet
in either repo.

**Before more code gets written, resolve:**

1. Which staging model — direct-to-blog or private-staging.
2. Image format — PNG (simpler, currently coded in `video-service.js`'s
   `sharp(...).png(...)` calls) vs. progressive JPEG q82/4:2:0 (what
   `examples/` and the agent rules above already point to). If JPEG wins,
   every `feature.png` reference needs to become `feature.jpg`, including
   on the website side.
3. If private-staging wins: define what a "content brief" contains and how
   many image candidates get generated per lesson.
4. Either way, the actual code still needs to be (re)built — right now the
   shipped code is the pre-refactor MVP described above.
