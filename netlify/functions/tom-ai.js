/**
 * TOM — Gentleman's Assistant
 * Netlify serverless function: proxies requests to the Anthropic API.
 * The API key lives here in an environment variable — never in the browser.
 */

exports.handler = async (event) => {

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Parse the request body sent from the PWA
  let systemPrompt, topic;
  try {
    ({ systemPrompt, topic } = JSON.parse(event.body));
    if (!systemPrompt || !topic) throw new Error('Missing fields');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request' }) };
  }

  // Call the Anthropic API — key is read from Netlify environment variable
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: `The topic I wish to raise: "${topic}"` }],
      }),
    });

    const data = await anthropicRes.json();

    // Log non-200 responses so they appear in Netlify function logs
    if (!anthropicRes.ok) {
      console.error('Anthropic API error:', anthropicRes.status, JSON.stringify(data));
    }

    return {
      statusCode: anthropicRes.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (err) {
    console.error('Function fetch error:', err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Upstream request failed', detail: err.message }),
    };
  }
};

