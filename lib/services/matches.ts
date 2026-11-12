import type { SupabaseClient } from "@supabase/supabase-js";
import { toBalancePlayer, type PlayerRow } from "@/lib/data-mappers";
import type { BalanceCandidate, BalancePlayer, SeparationRule } from "@/lib/domain";

export async function loadMatchContext(supabase: SupabaseClient, matchId: string): Promise<{
  players: BalancePlayer[]; rules: SeparationRule[]; session: { id: string; status: string; created_by: string };
}> {
  const { data: session, error: sessionError } = await supabase.from("match_sessions").select("id,status,created_by").eq("id", matchId).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw new MatchNotFoundError();
  const { data: participants, error: participantsError } = await supabase.from("match_participants").select("player_id,selection_order").eq("match_session_id", matchId).order("selection_order");
  if (participantsError) throw participantsError;
  const playerIds = (participants ?? []).map((row) => row.player_id);
  if (playerIds.length !== 10) throw new Error("매치 참가자는 정확히 10명이어야 합니다.");
  const { data: playerRows, error: playerError } = await supabase.from("players").select("*,player_role_skills(*)").in("id", playerIds);
  if (playerError) throw playerError;
  const byId = new Map(((playerRows ?? []) as PlayerRow[]).map((row) => [row.id, toBalancePlayer(row)]));
  const players = playerIds.map((id) => byId.get(id)).filter((player): player is BalancePlayer => Boolean(player));
  if (players.length !== 10) throw new Error("일부 참가자 프로필을 불러오지 못했습니다.");
  const { data: rulesRows, error: rulesError } = await supabase.from("player_separation_rules").select("player_a_id,player_b_id").eq("is_active", true).in("player_a_id", playerIds);
  if (rulesError) throw rulesError;
  const idSet = new Set(playerIds);
  const rules = (rulesRows ?? []).filter((row) => idSet.has(row.player_b_id)).map((row) => ({ playerAId: row.player_a_id, playerBId: row.player_b_id }));
  return { players, rules, session };
}

export function assignmentSnapshot(candidate: BalanceCandidate, players: BalancePlayer[]) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  return [...candidate.blue, ...candidate.red].map((assignment) => {
    const player = playerMap.get(assignment.playerId)!;
    return { ...assignment, rankTier: player.rankTier, rankDivision: player.rankDivision ?? "", customSkill: player.customSkill };
  });
}

export class MatchNotFoundError extends Error {}

