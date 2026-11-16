import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  package: string;
  upgrade?: boolean;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const pkg = body.package?.trim();
  if (!pkg || !/^[A-Za-z0-9._\-\[\]<>=,! ]+$/.test(pkg)) {
    return NextResponse.json(
      { ok: false, error: "유효하지 않은 패키지 이름." },
      { status: 400 },
    );
  }

  const pyCandidates =
    process.platform === "win32"
      ? ["python", "py", "python3"]
      : ["python3", "python"];

  for (const cmd of pyCandidates) {
    const args = ["-m", "pip", "install"];
    if (body.upgrade) args.push("--upgrade");
    args.push(pkg);

    const out = await run(cmd, args);
    if (!/not found|ENOENT|is not recognized/i.test(out.stderr) || out.exitCode === 0) {
      return NextResponse.json({
        ok: out.exitCode === 0,
        exitCode: out.exitCode,
        stdout: out.stdout,
        stderr: out.stderr,
        durationMs: out.durationMs,
        cmd: `${cmd} ${args.join(" ")}`,
      });
    }
  }

  return NextResponse.json(
    { ok: false, error: "로컬 Python 을 찾지 못했습니다." },
    { status: 500 },
  );
}

function run(cmd: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number | null; durationMs: number }>(
    (resolve) => {
      const start = Date.now();
      const proc = spawn(cmd, args, { shell: false, windowsHide: true });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("error", (err) => {
        resolve({
          stdout,
          stderr: stderr + (err as Error).message,
          exitCode: -1,
          durationMs: Date.now() - start,
        });
      });
      proc.on("close", (code) => {
        resolve({ stdout, stderr, exitCode: code, durationMs: Date.now() - start });
      });
    },
  );
}
