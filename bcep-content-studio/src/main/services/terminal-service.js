const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { findCommand } = require("./blog-service");

class TerminalService {
  constructor() {
    this.sessions = new Map();
  }

  send(session, data) {
    if (!session.webContents.isDestroyed()) {
      session.webContents.send("terminal:data", { id: session.id, data });
    }
  }

  prompt(session) {
    const marker = session.codexMode
      ? "\x1b[33mcodex>\x1b[0m "
      : "\x1b[36mPS>\x1b[0m ";
    this.send(session, marker);
  }

  create(webContents, cwd) {
    const id = crypto.randomUUID();
    const session = {
      id,
      webContents,
      cwd: path.resolve(cwd || os.homedir()),
      buffer: "",
      codexMode: false,
      child: null
    };
    this.sessions.set(id, session);
    this.send(
      session,
      "\x1b[1;34mBCEP Command Terminal\x1b[0m\r\n" +
        "Run PowerShell commands here. Select Start Codex to enter Codex update mode.\r\n" +
        "Type /exit to leave Codex mode.\r\n\r\n"
    );
    this.prompt(session);
    return { id, cwd: session.cwd };
  }

  write(id, data) {
    const session = this.sessions.get(id);
    if (!session) return;

    if (data === "\u0003") {
      session.child?.kill();
      session.child = null;
      session.buffer = "";
      this.send(session, "^C\r\n");
      this.prompt(session);
      return;
    }

    if (data === "\r" || data === "\n") {
      const command = session.buffer.trim();
      session.buffer = "";
      this.send(session, "\r\n");
      if (!command) {
        this.prompt(session);
        return;
      }
      this.execute(session, command);
      return;
    }

    if (data === "\u007f" || data === "\b") {
      if (session.buffer.length) {
        session.buffer = session.buffer.slice(0, -1);
        this.send(session, "\b \b");
      }
      return;
    }

    if (data.startsWith("\u001b")) return;
    if (/^[\x20-\x7e]+$/.test(data)) {
      session.buffer += data;
      this.send(session, data);
    }
  }

  async execute(session, command) {
    if (session.codexMode) {
      if (command === "/exit" || command === "exit") {
        session.codexMode = false;
        this.send(session, "Leaving Codex mode.\r\n");
        this.prompt(session);
        return;
      }
      await this.runCodex(session, command);
      return;
    }

    if (command === "codex") {
      session.codexMode = true;
      this.send(
        session,
        "\x1b[33mCodex update mode enabled.\x1b[0m " +
          "Describe one change at a time. Codex can edit this project.\r\n"
      );
      this.prompt(session);
      return;
    }

    if (command.startsWith("codex ")) {
      await this.runCodex(session, command.slice(6).trim());
      return;
    }

    if (/^cd(?:\s|$)/i.test(command)) {
      await this.changeDirectory(session, command.replace(/^cd\s*/i, ""));
      this.prompt(session);
      return;
    }

    if (/^(clear|cls)$/i.test(command)) {
      this.send(session, "\x1b[2J\x1b[H");
      this.prompt(session);
      return;
    }

    await this.runShell(session, command);
  }

  async changeDirectory(session, requested) {
    const cleaned = requested.trim().replace(/^["']|["']$/g, "");
    const next = cleaned ? path.resolve(session.cwd, cleaned) : os.homedir();
    try {
      const info = await fs.stat(next);
      if (!info.isDirectory()) throw new Error("Not a directory");
      session.cwd = next;
      this.send(session, `${next}\r\n`);
    } catch {
      this.send(session, `Directory not found: ${next}\r\n`);
    }
  }

  runChild(session, command, args, options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: session.cwd,
        env: process.env,
        windowsHide: true
      });
      session.child = child;
      child.stdout?.on("data", (chunk) =>
        this.send(session, chunk.toString().replace(/\n/g, "\r\n"))
      );
      child.stderr?.on("data", (chunk) =>
        this.send(
          session,
          `\x1b[90m${chunk.toString().replace(/\n/g, "\r\n")}\x1b[0m`
        )
      );
      child.on("error", (error) => {
        this.send(session, `\x1b[31m${error.message}\x1b[0m\r\n`);
      });
      child.on("close", (code) => {
        session.child = null;
        if (code && code !== 0) {
          this.send(
            session,
            `\r\n\x1b[31mProcess exited with code ${code}.\x1b[0m\r\n`
          );
        } else {
          this.send(session, "\r\n");
        }
        this.prompt(session);
        resolve(code);
      });
      if (options.input !== undefined) child.stdin?.end(options.input);
    });
  }

  async runShell(session, command) {
    if (process.platform === "win32") {
      const hasComSpec = Boolean(process.env.ComSpec);
      await this.runChild(
        session,
        hasComSpec ? process.env.ComSpec : "powershell.exe",
        hasComSpec
          ? ["/d", "/s", "/c", command]
          : ["-NoLogo", "-NoProfile", "-Command", command]
      );
    } else {
      await this.runChild(
        session,
        process.env.SHELL || "/bin/bash",
        ["-lc", command]
      );
    }
  }

  async runCodex(session, prompt) {
    const codexPath = await findCommand("codex");
    if (!codexPath) {
      this.send(
        session,
        "\x1b[31mCodex is not installed.\x1b[0m Select Install Codex above, then restart the app after installation.\r\n"
      );
      this.prompt(session);
      return;
    }
    this.send(session, "\x1b[90mCodex is working…\x1b[0m\r\n");
    await this.runChild(
      session,
      codexPath,
      [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "workspace-write",
        "-"
      ],
      { input: prompt }
    );
  }

  resize() {
    // Line-based processes do not require PTY dimensions.
  }

  kill(id) {
    const session = this.sessions.get(id);
    session?.child?.kill();
    this.sessions.delete(id);
  }

  killAll() {
    for (const session of this.sessions.values()) session.child?.kill();
    this.sessions.clear();
  }
}

module.exports = { TerminalService };
