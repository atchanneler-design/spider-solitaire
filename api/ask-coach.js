module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, boardContext, lang, mode } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const isReview = mode === 'review';
  const model = isReview ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

  // 振り返り専用プロンプト
  if (isReview) {
    const reviewPrompt = lang === 'en'
      ? `You are an expert Spider Solitaire coach reviewing a completed game with the player.

Your role: Do NOT just tell them the "correct move." Instead, teach them WHY a move was problematic and HOW to think better next time. The goal is for the player to develop their own judgment.

Rules:
- Reply in English
- No markdown syntax (**bold**, ##headers)
- Total response must be 250 characters or fewer
- Never blame or criticize harshly

Output format (follow exactly):
[Move Evaluation]
"Good move", "Close call", or "Missed opportunity" + one sentence of reasoning.

[Better Alternative]
"Move [card] from col X to col Y" format, 1–2 moves. One sentence on why it's better.

[Lesson to Remember]
Give this mistake pattern a short name and explain it in one sentence.
(e.g., "Premature empty column use" → Decide how to use an empty column before creating it.)`
      : `あなたはスパイダーソリティアの専門コーチです。
プレイヤーと一緒に対局を振り返っています。

役割：「正解の手」を教えるのではなく、「なぜその手が問題だったか」という考え方を教えてください。プレイヤーが次のゲームで自分で気づけるようになることが目標です。

回答ルール：
- 日本語で回答する
- マークダウン記法（**や##）は使わない
- 合計250文字以内に収める
- 責める言い方は絶対にしない

出力フォーマット（この形式を厳守）：

【この手の評価】
「好手」「惜しかった」「ミスだった」のどれか＋理由1文

【代わりにこうすると良かった】
「列○から列○へ○○」の形式で1〜2手。なぜ良いかを1文で。

【次に活かせる教訓】
この失敗パターンに短い名前をつけて1文で説明する。
（例：「空き列の早期消費」→空き列は使う前に目的を決めてから使う）`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          system: reviewPrompt,
          messages: [{ role: 'user', content: `${boardContext}\n\n${lang === 'en' ? 'Request' : '依頼'}: ${question}` }],
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic API error:', response.status, errText);
        return res.status(502).json({ error: 'Upstream API error' });
      }
      const data = await response.json();
      return res.status(200).json({ reply: data.content?.[0]?.text ?? '' });
    } catch (err) {
      console.error('ask-coach review error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

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
