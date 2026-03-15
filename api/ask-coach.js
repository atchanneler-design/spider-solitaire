module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, boardContext, lang } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const systemPrompt = lang === 'en'
    ? `You are an expert Spider Solitaire coach. Analyze the board and give strategic advice that is easy for beginners to understand.
Answer in English with these 4 sections, concisely:

[1. Board Assessment]
One-word verdict ("Good", "Manageable", "Tough") with 1-2 sentences of reasoning.

[2. Top Priority]
The most important task right now (e.g., "Create an empty column", "Flip face-down cards", "Build same-suit sequences").

[3. Next 3-5 Moves]
Numbered list in the format "Move [card] from column X to column Y".

[4. Cautions]
1-2 sentences on moves to avoid or common pitfalls to watch out for.

Do not use markdown syntax (**bold**, ##headers). Reply in plain text only.`
    : `あなたはスパイダーソリティアの専門家コーチです。
盤面を分析して、初心者にもわかりやすく戦略的なアドバイスをしてください。
回答は日本語で、以下の4項目を簡潔に答えてください。

【1. 盤面の状況判断】
「良い」「まだいける」「厳しい」などひと言で判定し、その根拠を1〜2文で。

【2. 今優先すべきこと】
「空き列を作る」「裏向きをめくる」「スーツを揃える」など、最重要タスクを明示。

【3. 具体的な次の3〜5手の方針】
番号付きリストで「列○から列○へ○○を移動」の形式で記載。

【4. 注意点・リスク】
やってはいけない手や、見落としやすいポイントを1〜2文で。

マークダウン記法（**や##）は使わないでください。普通のテキストで回答してください。`;

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
        max_tokens: 800,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `${boardContext}\n\n${lang === 'en' ? 'Question' : '質問'}: ${question}`,
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
