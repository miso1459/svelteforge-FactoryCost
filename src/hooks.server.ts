import {
    validateSession,
    setSessionCookie,
    deleteSessionCookie,
    SESSION_COOKIE_NAME,
} from "$lib/server/auth.js";
import { db } from "$lib/server/db/index.js";
import { sessions } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import type { Handle } from "@sveltejs/kit";

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

export const handle = authHandle;
