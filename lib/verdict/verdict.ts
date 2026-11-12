import { ROLES, type BalancePlayer, type Role } from "@/lib/domain";
import { roleStrength } from "@/lib/balancer/scoring";

export const LANE: Record<Role, string> = { TOP: "탑", JUNGLE: "정글", MID: "미드", ADC: "원딜", SUPPORT: "서폿" };
/** Lane strengths closer than this read as "about the same". */
const SIMILAR = 2;

export type Pick = <T>(items: readonly T[]) => T;

/** One comparison, computed by the engine. Names only — never numbers. */
export type VerdictFact =
  | { role: Role; kind: "between"; down: string; up: string }
  | { role: Role; kind: "similar"; sim: string }
  | { role: Role; kind: "top"; down: string }
  | { role: Role; kind: "bottom"; up: string }
  | { role: Role; kind: "forbidden" };

/**
 * Picks up to `count` lanes and, for each, who sits just above / below / level
 * with the player in that lane. Neighbours are chosen at random among the
 * closest few, so asking again gives a different set.
 */
export function planVerdicts(target: BalancePlayer, everyone: BalancePlayer[], pick: Pick, count = 3): VerdictFact[] {
  const others = everyone.filter((p) => p.id !== target.id);
  const lanes = [...ROLES].sort(() => (pick([0, 1]) ? 1 : -1));
  const facts: VerdictFact[] = [];
  for (const role of lanes) {
    if (facts.length >= count) break;
    const mine = roleStrength(target, role);
    if (!Number.isFinite(mine)) {
      if (pick([true, false])) facts.push({ role, kind: "forbidden" });
      continue;
    }
    const field = others.map((p) => ({ name: p.name, s: roleStrength(p, role) })).filter((x) => Number.isFinite(x.s));
    const above = field.filter((x) => x.s > mine + SIMILAR).sort((a, b) => a.s - b.s).slice(0, 3);
    const below = field.filter((x) => x.s < mine - SIMILAR).sort((a, b) => b.s - a.s).slice(0, 3);
    const same = field.filter((x) => Math.abs(x.s - mine) <= SIMILAR);
    const kinds: VerdictFact[] = [];
    if (above.length && below.length) kinds.push({ role, kind: "between", down: pick(below).name, up: pick(above).name });
    if (same.length) kinds.push({ role, kind: "similar", sim: pick(same).name });
    if (!above.length && below.length) kinds.push({ role, kind: "top", down: pick(below).name });
    if (above.length && !below.length) kinds.push({ role, kind: "bottom", up: pick(above).name });
    if (kinds.length) facts.push(pick(kinds));
  }
  return facts;
}

const josa = (word: string, withBatchim: string, without: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withBatchim : without;
};
const eun = (w: string) => w + josa(w, "은", "는");

// Particle pairs (after a final consonant, after a vowel). Longest first.
const PARTICLES: Array<[string, string]> = [["이랑", "랑"], ["과", "와"], ["은", "는"], ["이", "가"], ["을", "를"], ["아", "야"]];

/** Fixes the particle right after each name, e.g. "동완랑" → "동완이랑", "민수이랑" → "민수랑". */
export function fixParticles(text: string, names: string[]): string {
  let out = text;
  for (const name of names) {
    for (const [hard, soft] of PARTICLES) {
      const right = josa(name, hard, soft);
      for (const wrong of [hard, soft]) {
        if (wrong === right) continue;
        // Only when the particle ends the word, so "김하승보다" or "동완이" (name+이) aren't touched wrongly.
        out = out.replace(new RegExp(`${escape(name)}${wrong}(?=[\\s,.!?~ㅋ)도요만]|$)`, "g"), name + right);
      }
    }
  }
  return out;
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rang = (w: string) => w + josa(w, "이랑", "랑");

/** Built-in phrasing; used when no AI is configured or it fails. */
export function renderTemplate(fact: VerdictFact, pick: Pick): string {
  const lane = LANE[fact.role];
  switch (fact.kind) {
    case "forbidden": return pick([`엄. ${eun(lane)} 안 가시는 걸로 할게요.`, `엄. ${eun(lane)} 금지 구역이에요.`]);
    case "between": return pick([
      `${eun(lane)} ${fact.down}보다는 낫지만 ${fact.up}보다는 낮네요, 까비요.`,
      `${lane}에서 ${fact.down}한테는 이기는데 ${fact.up}한테는 지네요, 줴줴이야.`,
      `${eun(lane)} ${fact.down}보다 위네요, 나이쨔. ${fact.up}보다는 아래고요.`,
    ]);
    case "similar": return pick([`${lane} 실력은 ${rang(fact.sim)} 거의 비슷하네요.`, `${lane}에서는 ${eun(fact.sim)} 라이벌이네요. 맞라인 서면 명경기예요.`]);
    case "top": return pick([`${eun(lane)} 규ck에서 제일 잘하시네요, 나이쨔.`, `${lane}만큼은 규ck 1등이에요. ${fact.down}도 아래예요.`]);
    case "bottom": return pick([`엄. ${eun(lane)} 규ck에서 제일 못하시네요.`, `${eun(lane)} ${fact.up}보다도 아래네요, 줴줴이야.`]);
  }
}

/** Number-free comparisons using the built-in phrasing. */
export function buildVerdicts(target: BalancePlayer, everyone: BalancePlayer[], pick: Pick, count = 3): string[] {
  const lines = planVerdicts(target, everyone, pick, count).map((fact) => renderTemplate(fact, pick));
  return lines.length ? lines : ["규pt도 아직 당신을 잘 모르겠어요."];
}
