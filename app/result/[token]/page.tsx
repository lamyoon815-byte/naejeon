"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PublicResult = { publishedAt: string; teams: Array<{ team: "BLUE" | "RED"; role: string; name: string; nickname: string | null; tagline: string | null }>; metrics: { maximumLaneGap?: number; totalStrengthDifference?: number } | null };
const roleLabel: Record<string, string> = { JUNGLE: "JUNG", SUPPORT: "SUP" };

export default function PublicResultPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<PublicResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/public/results/${token}`).then(async (response) => { const body = await response.json() as { data?: PublicResult; error?: { message?: string } }; if (!response.ok || !body.data) throw new Error(body.error?.message ?? "결과를 불러오지 못했습니다."); return body.data; }).then(setResult).catch((reason) => setError(reason.message)); }, [token]);
  if (error) return <main className="public-result-state"><h1>결과를 열 수 없어요</h1><p>{error}</p></main>;
  if (!result) return <main className="public-result-state"><h1>팀 결과 불러오는 중...</h1></main>;
  return <main className="public-result-page"><header><span className="step">SHARED MATCH</span><h1>내전 팀 편성 결과</h1><p>읽기 전용으로 공유된 최종 편성입니다.</p></header><div className="public-teams">{(["BLUE", "RED"] as const).map((team) => <section className={`team ${team.toLowerCase()}`} key={team}><header><b>{team} TEAM</b></header>{result.teams.filter((row) => row.team === team).map((row) => <div className="roster" key={row.role}><span className="lane"><small>{roleLabel[row.role] ?? row.role}</small></span><span className="roster-name"><b>{row.name}</b>{row.nickname && <small>{row.nickname}{row.tagline ? ` #${row.tagline}` : ""}</small>}</span></div>)}</section>)}</div>{result.metrics && <div className="balance-stats"><div><span>최대 라인 격차</span><b>{result.metrics.maximumLaneGap ?? "-"}</b></div><div><span>팀 전력 차이</span><b>{result.metrics.totalStrengthDifference ?? "-"}</b></div></div>}</main>;
}

