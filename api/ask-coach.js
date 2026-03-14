module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, boardContext } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'あなたはスパイダーソリティアの専門AIコーチです。盤面情報をもとにプレイヤーの質問に日本語で簡潔・具体的に答えてください。200字以内を目安にしてください。',
        messages: [{
          role: 'user',
          content: `${boardContext}\n\n質問: ${question}`,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? 'AIからの応答がありませんでした';
    res.status(200).json({ reply });
  } catch (err) {
    console.error('ask-coach error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
