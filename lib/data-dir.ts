import { resolve } from "node:path";

/**
 * 영속 데이터 루트.
 * - 로컬 dev: `.polymath-data`
 * - Fly.io: volume mount `/data` 를 `POLYMATH_DATA_DIR=/data` 로 지정
 * - 다른 호스트: 임의 경로
 */
export const DATA_DIR = resolve(
  process.cwd(),
  process.env.POLYMATH_DATA_DIR || ".polymath-data",
);

/**
 * 인증 데이터(users·sessions) 전용 저장 디렉토리.
 * `POLYMATH_AUTH_DIR` 로 분리된 영속 볼륨(예: Fly 의 별도 /auth volume)에 둘 수 있음.
 * 지정 안 하면 DATA_DIR 와 동일.
 */
export const AUTH_DIR = resolve(
  process.cwd(),
  process.env.POLYMATH_AUTH_DIR || process.env.POLYMATH_DATA_DIR || ".polymath-data",
);

export function dataPath(...segments: string[]): string {
  return resolve(DATA_DIR, ...segments);
}

export function authPath(...segments: string[]): string {
  return resolve(AUTH_DIR, ...segments);
}
