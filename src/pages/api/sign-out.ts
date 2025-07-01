import type { APIRoute } from "astro";
import { clerk } from '../../util/clerk';

export const GET: APIRoute = async ({ locals, redirect }) => {
  const sessionId = locals.auth().sessionId;

  if (sessionId) {
    clerk.sessions.revokeSession(sessionId);
  }

  return redirect('/dashboard/sign-out', 307);
}