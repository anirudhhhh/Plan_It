import { createHash } from 'node:crypto';
import { head, list, put } from '@vercel/blob';

const interests = new Set(['trips', 'tickets', 'rides', 'stays', 'all']);
const prefix = 'waitlist/';
const emailPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

async function getCount() {
  let count = 0;
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    count += page.blobs.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}

async function saveSignup(email, interest) {
  const id = createHash('sha256').update(email).digest('hex');
  const pathname = `${prefix}${id}.json`;
  try {
    await put(pathname, JSON.stringify({ email, interest, signedUpAt: new Date().toISOString() }), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  } catch (error) {
    // A repeated or concurrent signup is successful if its record already exists.
    const existing = await head(pathname).catch(() => null);
    if (!existing) throw error;
  }
}

export default async function waitlist(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  try {
    if (request.method === 'GET') {
      return response.status(200).json({ count: await getCount() });
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return response.status(405).json({ error: 'Method not allowed.' });
    }
    const origin = request.headers.origin;
    if (origin && origin !== `https://${request.headers.host}` && origin !== `http://${request.headers.host}`) {
      return response.status(403).json({ error: 'Open the PLAN-IT website to sign up.' });
    }
    if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
      return response.status(415).json({ error: 'Submit the signup form from the PLAN-IT website.' });
    }
    if (Number(request.headers['content-length']) > 2048) {
      return response.status(413).json({ error: 'This signup is too large.' });
    }

    let body;
    try {
      body = request.body;
    } catch {
      return response.status(400).json({ error: 'The signup could not be read. Please try again.' });
    }
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (body?.website) return response.status(200).json({ ok: true });
    if (email.length > 254 || !emailPattern.test(email) || !interests.has(body?.interest) || body?.consent !== true) {
      return response.status(400).json({ error: 'Enter a valid email, choose an interest, and check the consent box.' });
    }

    await saveSignup(email, body.interest);
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Waitlist storage request failed', { method: request.method, error: error.name });
    return response.status(503).json({ error: 'The waitlist is temporarily unavailable. Please try again shortly.' });
  }
}
