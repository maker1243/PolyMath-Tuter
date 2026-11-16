import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Body {
  language: "javascript" | "python";
  code: string;
}

/**
 * MVP 샌드박스 실행기 — 신뢰할 수 없는 코드를 함부로 평가하지 않습니다.
 * JS는 Function 생성자로 격리된 스코프에서 실행하되, 운영에서는 반드시
 * 별도의 격리 환경(VM, isolate-vm, Docker 등)로 교체하세요.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (body.language !== "javascript") {
    return NextResponse.json({
      stdout: "",
      stderr: `언어 '${body.language}' 는 아직 지원되지 않습니다. (MVP: JavaScript 전용)`,
      durationMs: 0,
    });
  }

  const logs: string[] = [];
  const start = Date.now();
  try {
    const fakeConsole = {
      log: (...args: unknown[]) =>
        logs.push(args.map((a) => safeStringify(a)).join(" ")),
      error: (...args: unknown[]) =>
        logs.push("ERROR: " + args.map((a) => safeStringify(a)).join(" ")),
    };
    const fn = new Function("console", `"use strict";\n${body.code}`);
    await Promise.resolve(fn(fakeConsole));
    return NextResponse.json({
      stdout: logs.join("\n"),
      stderr: "",
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({
      stdout: logs.join("\n"),
      stderr: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      durationMs: Date.now() - start,
    });
  }
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
