import {
    validateSession,
    setSessionCookie,
    deleteSessionCookie,
    SESSION_COOKIE_NAME,
} from "$lib/server/auth.js";
import { db } from "$lib/server/db/index.js";
import { sessions } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import { redirect, type Handle } from "@sveltejs/kit"; // redirect 추가
import { sequence } from "@sveltejs/kit/hooks";        // sequence 추가

// 기존 인증 핸들러 (그대로 유지)
const authHandle: Handle = async ({ event, resolve }) => {
    const token = event.cookies.get(SESSION_COOKIE_NAME);
    if (!token) {
        event.locals.user = null;
        event.locals.session = null;
        return resolve(event);
    }

    try {
        const { session, user } = await validateSession(token);

        if (session) {
            setSessionCookie(event.cookies, token, session.expiresAt);
            const ua = event.request.headers.get("user-agent");
            const ip = event.getClientAddress();
            await db
                .update(sessions)
                .set({ userAgent: ua, ipAddress: ip })
                .where(eq(sessions.id, session.id));
        } else {
            deleteSessionCookie(event.cookies);
        }

        event.locals.user = user;
        event.locals.session = session;
    } catch {
        deleteSessionCookie(event.cookies);
        event.locals.user = null;
        event.locals.session = null;
    }

    return resolve(event);
};

// 빈 라우트 리다이렉트 핸들러
const redirectHandle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);

    if (response.status === 404) {
        const parts = event.url.pathname.split("/").filter(Boolean);
        
        // 상위 경로를 순서대로 탐색하면서 유효한 경로 찾기
        while (parts.length > 1) {
            parts.pop();
            const parentPath = "/" + parts.join("/");
            
            // 해당 경로가 유효한지 fetch로 확인
            const check = await fetch(new URL(parentPath, event.url.origin));
            
            if (check.status !== 404) {
                redirect(307, parentPath);
            }
        }

        // 모두 빈 폴더면 루트로
        redirect(307, "/");
    }

    return response;
};

// 순서 중요: 인증 먼저 → 리다이렉트
export const handle = sequence(authHandle, redirectHandle);