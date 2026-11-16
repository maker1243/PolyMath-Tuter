import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

interface Info {
  ok: boolean;
  python?: { cmd: string; version: string };
  node?: { version: string };
  pip?: { version: string };
  message?: string;
}

export async function GET() {
  const info: Info = { ok: false };

  const pyCandidates =
    process.platform === "win32"
      ? ["python", "py", "python3"]
      : ["python3", "python"];

  for (const cmd of pyCandidates) {
    const out = await runOnce(cmd, ["--version"]);
    if (out.exitCode === 0 || /Python \d/.test(out.stdout + out.stderr)) {
      const text = (out.stdout + out.stderr).trim();
      info.python = { cmd, version: text };
      info.ok = true;
      // pip 버전도 확인
      const pip = await runOnce(cmd, ["-m", "pip", "--version"]);
      if (pip.exitCode === 0) {
        info.pip = { version: pip.stdout.trim() };
      }
      break;
    }
  }

  const nodeOut = await runOnce("node", ["--version"]);
  if (nodeOut.exitCode === 0) {
    info.node = { version: nodeOut.stdout.trim() };
  }

  if (!info.ok) {
    info.message =
      "로컬 Python 을 찾지 못했습니다. python.org 또는 Microsoft Store 에서 설치해 PATH 에 추가해 주세요.";
  }

  return NextResponse.json(info);
}

function runOnce(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", () => resolve({ stdout, stderr, exitCode: -1 }));
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code }));
  });
}
