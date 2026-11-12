import "server-only";
import { fixParticles, LANE, type VerdictFact } from "./verdict";

const SYSTEM = [
  "너는 롤 내전 팀 밸런서의 마스코트 '규pt'야. 친구끼리 놀리듯 장난스러운 말투로, 한 선수의 라인 실력을 다른 사람과 비교해 한 줄씩 말해.",
  "규칙: 1) 사실마다 정확히 한 줄, 같은 순서로. 2) 사실에 나온 기호([A] 같은)를 반드시 그대로 넣고, 다른 이름은 지어내지 마.",
  "3) 숫자·점수·티어 이름은 쓰지 마. 4) 한 줄은 60자 이내, 이모지는 최대 1개. 5) 사실의 위아래 관계를 절대 뒤집지 마. 6) 욕설·비하 금지.",
  // House slang requested by the organizer; sprinkle it in, don't force every word into every line.
  "말투: 게임 친구들끼리 쓰는 장난스러운 인터넷 말투를 자연스럽게 섞어. 예: '줴줴이야'(그렇지/맞아), '나이쨔'(나이스), '까비요'(아깝다),",
  "'ㅋㅋ', '~하쥬', '실화냐', '개꿀', '에바임'. 한 줄에 이런 표현 0~2개, 매번 다르게 골라.",
].join(" ");

/**
 * Asks Gemini to phrase engine-computed facts. Player names never leave the
 * server: they are replaced by tokens ([A], [B], …) and put back afterwards.
 * Returns null on any failure so the caller can fall back to templates.
 */
export async function phraseWithGemini(facts: VerdictFact[]): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || facts.length === 0) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const tokenOf = new Map<string, string>();
  const token = (name: string) => {
    if (!tokenOf.has(name)) tokenOf.set(name, `[${String.fromCharCode(65 + tokenOf.size)}]`);
    return tokenOf.get(name)!;
  };
  const needs: string[][] = [];
  const lines = facts.map((fact, index) => {
    const lane = LANE[fact.role];
    let text: string; let req: string[] = [];
    switch (fact.kind) {
      case "between": req = [token(fact.down), token(fact.up)]; text = `${lane}: 당신은 ${req[0]}보다 위, ${req[1]}보다 아래`; break;
      case "similar": req = [token(fact.sim)]; text = `${lane}: ${req[0]}와 거의 비슷`; break;
      case "top": req = [token(fact.down)]; text = `${lane}: 이 라인에서 당신이 1등 (바로 아래 ${req[0]})`; break;
      case "bottom": req = [token(fact.up)]; text = `${lane}: 이 라인에서 당신이 꼴등 (바로 위 ${req[0]})`; break;
      case "forbidden": text = `${lane}: 당신은 이 라인 배정 금지`; break;
    }
    needs.push(req);
    return `${index + 1}. ${text}`;
  });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `사실 목록:\n${lines.join("\n")}\nJSON 문자열 배열로만 답해.` }] }],
        generationConfig: { temperature: 1.1, maxOutputTokens: 400, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== facts.length) return null;
    const allTokens = [...tokenOf.values()];
    const out: string[] = [];
    for (const [index, item] of parsed.entries()) {
      if (typeof item !== "string") return null;
      const line = item.trim();
      // Reject anything that could mislead: numbers, missing or invented tokens, overly long lines.
      if (!line || line.length > 90 || /\d/.test(line)) return null;
      if (!needs[index].every((t) => line.includes(t))) return null;
      const used = line.match(/\[[A-Z]\]/g) ?? [];
      if (used.some((t) => !allTokens.includes(t) || !needs[index].includes(t))) return null;
      out.push(line);
    }
    const names = [...tokenOf.keys()];
    return out.map((line) => fixParticles([...tokenOf].reduce((text, [name, t]) => text.replaceAll(t, name), line), names));
  } catch {
    return null;
  }
}
