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

export function dataPath(...segments: string[]): string {
  return resolve(DATA_DIR, ...segments);
}
