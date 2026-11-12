"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type VoteOption = {
  optionIndex: number;
  votes: number;
  metrics: { maximumLaneGap: number; totalStrengthDifference: number; mainRoleAssignments: number };
  teams: { blue: Player[]; red: Player[] };
};
type Player = { name: string; nickname: string | null; tagline: string | null; role: string };
type VoteData = { options: VoteOption[]; totalVotes: number };
const labels: Record<string, string> = { JUNGLE: "JUNG", SUPPORT: "SUP" };

export default function CandidateVotePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VoteData | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch(`/api/public/votes/${token}`);
    const body = await response.json() as { data?: VoteData; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "투표를 불러오지 못했습니다.");
    setData(body.data);
  }
  useEffect(() => {
    fetch(`/api/public/votes/${token}`)
      .then(async (response) => {
        const body = await response.json() as { data?: VoteData; error?: { message?: string } };
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "투표를 불러오지 못했습니다.");
        return body.data;
      })
      .then(setData)
      .catch((reason) => setError(reason.message));
  }, [token]);
  async function vote(optionIndex: number) {
    let voterToken = localStorage.getItem("quyck-voter-token");
    if (!voterToken) { voterToken = crypto.randomUUID(); localStorage.setItem("quyck-voter-token", voterToken); }
    const response = await fetch(`/api/public/votes/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voterToken, optionIndex }) });
    if (!response.ok) { const body = await response.json() as { error?: { message?: string } }; throw new Error(body.error?.message ?? "투표하지 못했습니다."); }
    setSelected(optionIndex); await load();
  }
  if (error) return <main className="public-result-state"><h1>투표를 열 수 없어요</h1><p>{error}</p></main>;
  if (!data) return <main className="public-result-state"><h1>후보 불러오는 중...</h1></main>;
  const roster = (title: string, players: Player[]) => <div className="vote-team"><b>{title}</b>{players.map((player) => <p key={`${player.role}-${player.name}`}><span>{labels[player.role] ?? player.role}</span><strong>{player.name}</strong></p>)}</div>;
  return <main className="vote-page"><header><span className="step">TEAM VOTE</span><h1>어떤 조합이 제일 좋아?</h1><p>후보를 비교하고 한 표를 골라주세요. 다시 누르면 표를 바꿀 수 있어요.</p></header><div className="vote-options">{data.options.map((option) => <section className={selected === option.optionIndex ? "selected" : ""} key={option.optionIndex}><h2>후보 {option.optionIndex}</h2><div className="vote-rosters">{roster("BLUE", option.teams.blue)}{roster("RED", option.teams.red)}</div><div className="vote-metrics"><span>라인 격차 <b>{option.metrics.maximumLaneGap.toFixed(1)}</b></span><span>팀 차이 <b>{option.metrics.totalStrengthDifference.toFixed(1)}</b></span><span>주 포지션 <b>{option.metrics.mainRoleAssignments}/10</b></span></div><button onClick={() => void vote(option.optionIndex)}>♥ {option.votes}표 · 이 조합 선택</button></section>)}</div><footer>총 {data.totalVotes}명이 투표했어요</footer></main>;
}
