import { ROLES, type BalancePlayer, type Role } from "@/lib/domain";
import { roleStrength } from "@/lib/balancer/scoring";

const LANE: Record<Role, string> = { TOP: "탑", JUNGLE: "정글", MID: "미드", ADC: "원딜", SUPPORT: "서폿" };
/** Lane strengths closer than this read as "about the same". */
const SIMILAR = 2;

type Pick = <T>(items: readonly T[]) => T;
const josa = (word: string, withBatchim: string, without: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withBatchim : without;
};
const eun = (w: string) => w + josa(w, "은", "는");
const rang = (w: string) => w + josa(w, "이랑", "랑");

/**
 * Playful, number-free comparisons of one player's lanes against everyone
 * else's strength in the same lane. Neighbours are picked at random among the
 * closest few, so asking again gives a different line.
 */
export function buildVerdicts(target: BalancePlayer, everyone: BalancePlayer[], pick: Pick, count = 3): string[] {
  const others = everyone.filter((p) => p.id !== target.id);
  const lanes = [...ROLES].sort(() => (pick([0, 1]) ? 1 : -1));
  const lines: string[] = [];
  for (const role of lanes) {
    if (lines.length >= count) break;
    const lane = LANE[role];
    const mine = roleStrength(target, role);
    if (!Number.isFinite(mine)) {
      if (pick([true, false])) lines.push(pick([`${eun(lane)} 금지 구역이에요. 🚫 가지 마세요.`, `${lane}? 규pt는 그런 라인을 본 적이 없어요. 🚫`]));
      continue;
    }
    const field = others.map((p) => ({ name: p.name, s: roleStrength(p, role) })).filter((x) => Number.isFinite(x.s));
    const above = field.filter((x) => x.s > mine + SIMILAR).sort((a, b) => a.s - b.s).slice(0, 3);
    const below = field.filter((x) => x.s < mine - SIMILAR).sort((a, b) => b.s - a.s).slice(0, 3);
    const same = field.filter((x) => Math.abs(x.s - mine) <= SIMILAR);
    const up = above.length ? pick(above).name : null;
    const down = below.length ? pick(below).name : null;
    const sim = same.length ? pick(same).name : null;
    const options: string[] = [];
    if (up && down) options.push(
      `당신의 ${eun(lane)} ${down}보다 낫지만 ${up}보다는 별로예요.`,
      `${lane}: ${down} < 당신 < ${up}. 딱 중간 어딘가예요.`,
      `${lane}에서는 ${down} 정도는 이기는데 ${up} 앞에선 작아져요.`,
    );
    if (sim) options.push(`${lane} 실력은 ${rang(sim)} 거의 비슷해요. 맞라인 서면 명경기 예약.`, `${lane}에서 ${eun(sim)} 당신의 라이벌이에요. 👀`);
    if (!up && down) options.push(`${lane}에서는 적수가 없어요… 아마도. 👑`, `${lane}만큼은 당신이 제일 위예요. ${down}도 당신 아래.`);
    if (up && !down) options.push(`${eun(lane)}… ${up}보다도 아래예요. 힘내요. 🫠`, `${lane}에서는 아직 성장 중이에요. ${up}부터 따라잡아 봐요.`);
    if (options.length) lines.push(pick(options));
  }
  return lines.length ? lines : ["규pt도 아직 당신을 잘 모르겠어요. 🤔"];
}
