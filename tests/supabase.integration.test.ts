import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);
const createdPlayerIds: string[] = [];
const admin = configured ? createClient(url!, secretKey!, { auth: { persistSession: false } }) : null;

describe.skipIf(!configured)("Supabase persistence and privacy", () => {
  afterAll(async () => {
    if (createdPlayerIds.length) await admin!.from("players").delete().in("id", createdPlayerIds);
  });

  it("persists a player and role skills across client instances", async () => {
    const name = `통합테스트-${crypto.randomUUID()}`;
    const nickname = `integration-${crypto.randomUUID()}`;
    const tagline = "TEST";
    const { data: player, error: playerError } = await admin!.from("players").insert({ name, nickname, tagline, rank_tier: "GOLD", rank_division: "IV", rank_lp: 0, custom_skill: 50 }).select("id").single();
    expect(playerError).toBeNull();
    createdPlayerIds.push(player!.id);

    const { error: skillsError } = await admin!.from("player_role_skills").insert({ player_id: player!.id, top: 3, jungle: 2, mid: 4, adc: 1, support: 5 });
    expect(skillsError).toBeNull();

    const freshClient = createClient(url!, secretKey!, { auth: { persistSession: false } });
    const { data, error } = await freshClient.from("players").select("name, nickname, tagline, player_role_skills(support)").eq("id", player!.id).single();
    expect(error).toBeNull();
    expect(data?.name).toBe(name);
    expect(data?.nickname).toBe(nickname);
    expect(data?.tagline).toBe(tagline);
    expect(data?.player_role_skills).toEqual({ support: 5 });
  });

  it("blocks anonymous access to private separation rules", async () => {
    const anonymous = createClient(url!, publishableKey!, { auth: { persistSession: false } });
    const { error } = await anonymous.from("player_separation_rules").select("*");
    expect(error).not.toBeNull();
  });
});
