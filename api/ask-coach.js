module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, boardContext, lang } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const systemPrompt = lang === 'en'
    ? `You are an expert Spider Solitaire coach.

Analyze the board and give advice that helps players develop their own thinking and decision-making skills.

Answer in English with the following structure. Keep each section to one short sentence (under 200 characters).

Do not use markdown syntax (**bold**, ##headers). Reply in plain text only.

[Situation]
One word ("Good", "Manageable", or "Tough") plus one sentence of reasoning.

[Your Next Move]
One top-priority action only, in the format "Move [card] from column X to column Y." Add one sentence explaining why.

[What Changes]
One sentence on what specifically improves after this move.
(e.g., "Column 3 opens up, making sequence reorganization possible.")

[Coaching Tip]
One sentence on a thinking perspective to take away from this board — not the answer, but a way of seeing.
(e.g., "An empty column is most useful when you've decided how to use it before you create it.")`
    : `あなたはスパイダーソリティアの専門コーチです。

盤面を分析して、プレイヤーが「自分で考える力」を育てられるようアドバイスしてください。

回答は日本語で、以下の構成で答えてください。

マークダウン記法（**や##）は使わないでください。普通のテキストで回答してください。

各項目は200文字以内に収めてください。

【状況】
「良い」「まだいける」「厳しい」のいずれかひと言＋根拠を1文で。

【今すぐやること】
最優先の行動を1つだけ。「列○から列○へ○○を移動」の形式で。理由を1文添える。

【この手で何が変わるか】
その手を打った後に何が改善されるかを具体的に1文で。
（例：「列3が空き、連続の組み替えが可能になります」）

【上達のヒント】
この盤面から学べる考え方を1文で。答えではなく「視点」を伝える。
（例：「空き列は作った瞬間より、使い方を先に決めてから作るのがコツです」）`;

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
