

export default async (req) => {

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let systemPrompt, topic;
  try {
    ({ systemPrompt, topic } = await req.json());
    if (!systemPrompt || !topic) throw new Error('Missing fields');
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is not set');
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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

    if (!anthropicRes.ok) {
      console.error('Anthropic API error:', anthropicRes.status, JSON.stringify(data));
    }

    return new Response(JSON.stringify(data), {
      status: anthropicRes.status,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Function fetch error:', err.message);
    return new Response(JSON.stringify({ error: 'Upstream request failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/.netlify/functions/tom-ai',
};
