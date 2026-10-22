// Footnote: server-side proxy to the Anthropic API.
// The browser sends { prompt }, this function calls Claude with YOUR key and returns the JSON Claude wrote.
// The key lives only in Vercel's environment variables, never in the page.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MAX_PROMPT_CHARS = 60000;          // Footnote's longest prompt is about 22,000 characters
const LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 12); // per visitor (one story uses 1 to 3 calls)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''; // e.g. https://footnote.vercel.app (optional)

// Best-effort rate limit. Serverless instances don't share memory, so this slows abuse
// but isn't a hard cap. Your monthly spend limit in the Anthropic Console is the hard cap.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT_PER_MINUTE;
}

// Pull the JSON object out of Claude's reply, even if it adds a sentence or a code fence around it.
function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  if (ALLOWED_ORIGIN) {
    const origin = req.headers.origin || '';
    if (origin && origin !== ALLOWED_ORIGIN) return res.status(403).json({ error: 'Not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const prompt = body && typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS) return res.status(400).json({ error: 'Bad prompt' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: 'Reply with a single JSON object only. No prose, no code fences.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (r.status === 429) return res.status(429).json({ error: 'Busy, try again' });
    if (!r.ok) {
      console.error('Anthropic error', r.status, await r.text());
      return res.status(502).json({ error: 'Upstream error' });
    }

    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const json = extractJson(text);
    if (!json) return res.status(502).json({ error: 'Could not read reply' });
    return res.status(200).json(json);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Request failed' });
  }
};
