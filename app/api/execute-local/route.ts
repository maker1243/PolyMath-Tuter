import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  language: "python" | "node";
  code: string;
  timeoutMs?: number;
}

export interface LocalRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut?: boolean;
  cmd: string;
}

/** Windows/Linux/mac 공통: 실제 설치된 python 바이너리를 찾아 코드를 실행합니다. */
export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.code?.trim()) {
    return NextResponse.json({ error: "code 필수" }, { status: 400 });
  }
  const timeoutMs = Math.min(Math.max(body.timeoutMs ?? 15_000, 1_000), 120_000);

  if (body.language === "node") {
    return NextResponse.json(await runLocal("node", [], body.code, timeoutMs));
  }

  // Python: python → python3 → py 순으로 폴백
  for (const bin of pythonCandidates()) {
    try {
      const result = await runLocal(bin.cmd, bin.args, body.code, timeoutMs);
      // ENOENT 는 exitCode -1 + "not found" stderr 로 반환되도록 처리됨 — 다음 후보 시도
      if (!/not found|ENOENT|is not recognized/i.test(result.stderr)) {
        return NextResponse.json(result);
      }
    } catch {
      /* 다음 후보 */
    }
  }

  return NextResponse.json(
    {
      error:
        "Python 실행 파일을 찾지 못했습니다. python / python3 / py 중 하나가 PATH 에 있어야 합니다.",
    },
    { status: 500 },
  );
}

function pythonCandidates(): Array<{ cmd: string; args: string[] }> {
  if (process.platform === "win32") {
    return [
      { cmd: "python", args: ["-u"] },
      { cmd: "py", args: ["-3", "-u"] },
      { cmd: "python3", args: ["-u"] },
    ];
  }
  return [
    { cmd: "python3", args: ["-u"] },
    { cmd: "python", args: ["-u"] },
  ];
}

async function runLocal(
  cmd: string,
  prefixArgs: string[],
  code: string,
  timeoutMs: number,
): Promise<LocalRunResult> {
  const start = Date.now();
  // Windows 에서 `-c "multiline"` 인용 이슈를 피하려고 임시 파일에 쓰고 경로를 넘김
  const scriptPath = join(tmpdir(), `polymath-${randomUUID()}.${cmd === "node" ? "mjs" : "py"}`);
  await writeFile(scriptPath, code, "utf8");

  return new Promise<LocalRunResult>((resolve) => {
    const proc = spawn(cmd, [...prefixArgs, scriptPath], {
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, timeoutMs);
    let timedOut = false;
    const killByTimeout = () => (timedOut = true);
    const to = setTimeout(killByTimeout, timeoutMs);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err) => {
      clearTimeout(timer);
      clearTimeout(to);
      resolve({
        stdout,
        stderr: stderr + (err as NodeJS.ErrnoException).message,
        exitCode: -1,
        durationMs: Date.now() - start,
        cmd: `${cmd} ${prefixArgs.join(" ")}`.trim(),
      });
    });
    proc.on("close", async (code) => {
      clearTimeout(timer);
      clearTimeout(to);
      try {
        await unlink(scriptPath);
      } catch {
        /* best-effort */
      }
      resolve({
        stdout,
        stderr,
        exitCode: code,
        durationMs: Date.now() - start,
        timedOut,
        cmd: `${cmd} ${prefixArgs.join(" ")}`.trim(),
      });
    });
  });
}
