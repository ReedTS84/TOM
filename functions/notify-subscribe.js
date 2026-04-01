export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const data = await request.json();

    const subscription = data.subscription;

    if (!subscription) {
      return new Response('No subscription', { status: 400 });
    }

    const id = crypto.randomUUID();

    await env.TOM_SUBSCRIPTIONS.put(
      id,
      JSON.stringify({
        subscription,
        cycleStart: data.cycleStart,
        cycleLength: data.cycleLength,
        bleedLength: data.bleedLength,
      })
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 });
  }
}
