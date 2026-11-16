import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  getUserBySession,
  publicUser,
  type PublicUser,
} from "./auth-store";

/** 서버 라우트/페이지에서 현재 로그인한 사용자를 반환 (쿠키에서 세션 파싱) */
export async function currentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = getUserBySession(token);
  return user ? publicUser(user) : null;
}
