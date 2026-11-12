"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Crown, Heart, Plus, Search, Settings, Shield, Shuffle, Swords, UserRoundPlus, X } from "lucide-react";
import { ROLES, type BalanceCandidate, type PlayerAssignment, type RankDivision, type RankTier, type Role, type RoleSkills } from "@/lib/domain";
import { assessBalance, type BalanceAssessment } from "@/lib/balancer/assessment";
import { normalizedRank, roleStrength } from "@/lib/balancer/scoring";

type Screen = "select" | "register" | "balance" | "result" | "feedback" | "admin";
type Player = {
  id: string; name: string; nickname: string | null; tagline: string | null; rankTier: RankTier; rankDivision: RankDivision; rankLp: number | null;
  customSkill: number; roleSkills: RoleSkills; isActive: boolean; createdAt: string; updatedAt: string;
};
type ApiResult<T> = { data?: T; error?: { message: string; code: string } };

const roleIcon: Record<Role, string> = { TOP: "♜", JUNGLE: "♣", MID: "◆", ADC: "➹", SUPPORT: "✦" };
const roleLabel: Record<Role, string> = { TOP: "TOP", JUNGLE: "JUNG", MID: "MID", ADC: "ADC", SUPPORT: "SUP" };
const riotId = (nickname: string | null, tagline: string | null) => nickname ? `${nickname}${tagline ? ` #${tagline}` : ""}` : "";
const navItems: { key: Screen; label: string }[] = [
  { key: "select", label: "플레이어 선택" }, { key: "result", label: "최근 경기" }, { key: "feedback", label: "피드백" }, { key: "admin", label: "관리자" },
];

function Poro({ pose = "hero", className = "" }: { pose?: "hero" | "think" | "cheer" | "icon"; className?: string }) {
  const pos = { hero: "0% 0%", think: "100% 0%", cheer: "0% 100%", icon: "100% 100%" }[pose];
  return <div aria-label="픽셀 포로 마스코트" className={`poro ${className}`} style={{ backgroundPosition: pos }} />;
}

function PixelButton({ children, onClick, disabled, variant = "pink", className = "", type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "pink" | "white" | "blue" | "dark"; className?: string; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`pixel-btn ${variant} ${className}`}>{children}</button>;
}

function RankBadge({ player }: { player: Player }) {
  const code = player.rankTier === "UNRANKED" ? "UR" : `${player.rankTier[0]}${player.rankDivision ?? ""}`;
  return <span className={`rank rank-${player.rankTier.toLowerCase()}`}>{code}</span>;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json() as ApiResult<T>;
  if (response.status === 401) throw new Error("AUTH_REQUIRED");
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "요청을 처리하지 못했습니다.");
  return body.data;
}

export default function Home() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("select");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [balancing, setBalancing] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<BalanceCandidate[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [votingPath, setVotingPath] = useState<string | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); }, []);
  useEffect(() => {
    api<{ isAdmin: boolean }>("/api/me").then((me) => setIsAdmin(me.isAdmin)).catch(() => setIsAdmin(false));
    api<Player[]>("/api/players")
      .then(setPlayers)
      .catch((error) => {
        if (error instanceof Error && error.message === "AUTH_REQUIRED") router.push("/login");
        else notify(error instanceof Error ? error.message : "플레이어를 불러오지 못했습니다.");
      })
      .finally(() => setLoadingPlayers(false));
  }, [notify, router]);

  const filtered = useMemo(() => players.filter((player) => `${player.name} ${player.nickname ?? ""} ${player.tagline ?? ""} ${player.rankTier} ${player.rankDivision ?? ""}`.toLowerCase().includes(query.toLowerCase())), [players, query]);
  const toggle = (id: string) => setSelected((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : previous.length < 10 ? [...previous, id] : previous);
  const start = async () => {
    if (selected.length !== 10) return;
    setScreen("balance"); setBalancing(true);
    try {
      const match = await api<{ id: string }>("/api/matches", { method: "POST", body: JSON.stringify({ playerIds: selected }) });
      setMatchId(match.id);
      const generated = await api<{ candidates: BalanceCandidate[]; votingPath: string }>(`/api/matches/${match.id}/generate`, { method: "POST" });
      setCandidates(generated.candidates); setVotingPath(generated.votingPath); setCandidateIndex(0); setScreen("result");
    } catch (error) { notify(error instanceof Error ? error.message : "팀 생성에 실패했습니다."); setScreen("select"); }
    finally { setBalancing(false); }
  };
  const confirm = async (assignments: Array<{ playerId: string; team: string; role: string }>, publish: boolean) => {
    if (!matchId) throw new Error("활성 매치가 없습니다.");
    return api<{ candidate: BalanceCandidate; publicPath: string | null }>(`/api/matches/${matchId}/${publish ? "confirm" : "assignment"}`, { method: publish ? "POST" : "PATCH", body: JSON.stringify({ assignments, publish }) });
  };

  return <main className="min-h-screen overflow-x-hidden">
    <header className="topbar"><button className="brand brand-logo" onClick={() => setScreen("select")} aria-label="홈으로 이동"><Image src="/assets/league-pixel-logo.png" width={2172} height={724} alt="" aria-hidden="true" priority /><span className="sr-only">League of Legends</span></button><nav className={mobileNav ? "open" : ""}>{navItems.filter((item) => isAdmin || item.key !== "admin").map((item) => <button key={item.key} className={screen === item.key ? "active" : ""} onClick={() => { if (item.key === "result" && !candidates.length) notify("먼저 팀을 생성해 주세요."); else setScreen(item.key); setMobileNav(false); }}>{item.label}</button>)}</nav><div className="header-actions">{isAdmin ? <span className="online"><i /> ADMIN</span> : <button className="online" onClick={() => router.push("/login")}>관리자 로그인</button>}<button className="mini-poro" onClick={() => notify("오늘도 즐거운 내전! ♥")}><Poro pose="icon" /></button><button className="menu-btn" onClick={() => setMobileNav(!mobileNav)}>☰</button></div></header>

    {screen === "select" && <section className="screen selection-screen"><div className="hero-copy"><div><h1>규CK 내전 팀짜기</h1></div><div className="hero-mascot"><span className="speech">나만 믿어! <Heart size={14} fill="currentColor" /></span><Image className="hero-poro-right" src="/assets/poro-hero-right.png" width={1312} height={1199} alt="제목을 바라보는 픽셀 포로" priority /><span className="pixel-star s1">✦</span><span className="pixel-star s2">✦</span></div></div><div className="arcade-panel select-panel"><div className="panel-head"><div><span className="step">STAGE 01</span><h2>플레이어를 선택하세요</h2></div><div className="counter"><span>SELECTED</span><b>{String(selected.length).padStart(2, "0")} <i>/ 10</i></b></div></div><div className="toolbar"><label className="search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 소환사 닉네임 또는 티어 검색" />{query && <button onClick={() => setQuery("")}><X size={16} /></button>}</label>{isAdmin && <PixelButton variant="white" onClick={() => setScreen("register")}><UserRoundPlus size={17} /> 새 플레이어</PixelButton>}</div>
      {loadingPlayers ? <div className="data-state">플레이어를 불러오는 중...</div> : filtered.length === 0 ? <div className="data-state">등록된 플레이어가 없습니다.</div> : <div className="player-grid">{filtered.map((player) => { const active = selected.includes(player.id); const preferred = ROLES.filter((role) => player.roleSkills[role] > 0).sort((a, b) => player.roleSkills[b] - player.roleSkills[a]).slice(0, 2); return <button key={player.id} className={`player-card ${active ? "selected" : ""}`} onClick={() => toggle(player.id)}><span className="check">{active ? "✓" : "+"}</span><RankBadge player={player} /><span className="player-info"><b>{player.name}</b><small>{riotId(player.nickname, player.tagline) ? `${riotId(player.nickname, player.tagline)} · ` : ""}{player.rankTier} {player.rankDivision}</small></span><span className="roles">{preferred.map((role) => <i key={role}>{roleIcon[role]} {roleLabel[role]}</i>)}</span></button>; })}</div>}
      <div className="panel-foot"><div className="hint"><span>!</span> 정확히 10명을 선택해 주세요</div><PixelButton onClick={start} disabled={selected.length !== 10}><Swords size={19} /> GENERATE TEAMS <span>▶</span></PixelButton></div></div></section>}

    {screen === "register" && isAdmin && <RegistrationScreen onCancel={() => setScreen("select")} onSaved={async (player) => { setPlayers((previous) => [...previous, player].sort((a, b) => a.name.localeCompare(b.name))); setSelected((previous) => previous.length < 10 ? [...previous, player.id] : previous); notify("플레이어가 저장됐어요!"); setScreen("select"); }} />}
    {screen === "balance" && <section className="screen loading-screen"><div className="loading-box"><span className="step">MATCH MAKING</span><Poro pose="think" className={balancing ? "thinking" : ""} /><h1>최고의 조합을<br />찾고 있어요!</h1><p>티어 · 포지션 · 숙련도 · 비공개 조건을 서버에서 계산 중...</p><div className="pixel-loader">{Array.from({ length: 8 }).map((_, index) => <i key={index} />)}</div><small>CALCULATING BALANCE...</small></div></section>}
    {screen === "result" && candidates[candidateIndex] && <ResultScreen key={candidates[candidateIndex].deterministicKey} candidate={candidates[candidateIndex]} alternativeCount={candidates.length} candidateIndex={candidateIndex} votingPath={votingPath} matchId={matchId} notify={notify} onBack={() => setScreen("select")} onNext={() => setCandidateIndex((candidateIndex + 1) % candidates.length)} onConfirm={confirm} />}
    {screen === "feedback" && <section className="screen compact-screen"><FeedbackBox matchId={null} notify={notify} board admin={isAdmin} /></section>}
    {screen === "admin" && isAdmin && <AdminScreen players={players} onBack={() => setScreen("select")} onArchived={(id) => { setPlayers((previous) => previous.filter((player) => player.id !== id)); setSelected((previous) => previous.filter((value) => value !== id)); }} notify={notify} />}
    {toast && <div className="toast"><Poro pose="icon" /><span>{toast}</span></div>}
  </main>;
}

function RegistrationScreen({ onCancel, onSaved }: { onCancel: () => void; onSaved: (player: Player) => void }) {
  const [name, setName] = useState(""); const [nickname, setNickname] = useState(""); const [tagline, setTagline] = useState(""); const [rankTier, setRankTier] = useState<RankTier>("GOLD"); const [rankDivision, setRankDivision] = useState("IV"); const [customSkill, setCustomSkill] = useState(50); const [skills, setSkills] = useState<RoleSkills>({ TOP: 3, JUNGLE: 3, MID: 3, ADC: 3, SUPPORT: 3 }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const usesDivision = !["UNRANKED", "MASTER", "GRANDMASTER", "CHALLENGER"].includes(rankTier);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const player = await api<Player>("/api/players", { method: "POST", body: JSON.stringify({ name, nickname: nickname || null, tagline: tagline || null, rankTier, rankDivision: usesDivision ? rankDivision : null, rankLp: rankTier === "UNRANKED" ? null : 0, customSkill, roleSkills: skills }) }); onSaved(player); } catch (reason) { setError(reason instanceof Error ? reason.message : "저장하지 못했습니다."); } finally { setSaving(false); } }
  return <section className="screen compact-screen"><div className="page-title"><span className="step">NEW CHALLENGER</span><h1>새 플레이어 등록</h1><p>사람 이름을 기준으로 관리하고 Riot ID는 보조 정보로 표시합니다.</p></div><div className="form-layout"><form className="arcade-panel form-card" onSubmit={submit}><div className="identity-fields"><label>사람 이름<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="이름을 입력해주세요" /></label><label>소환사 닉네임 <small>(선택)</small><input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="게임 이름" /></label><label>태그 <small>(선택)</small><span className="tag-input"><i>#</i><input value={tagline} onChange={(event) => setTagline(event.target.value.replace(/^#+/, ""))} placeholder="KR1" /></span></label></div><div className="two-col"><label>솔로 랭크<select value={rankTier} onChange={(event) => setRankTier(event.target.value as RankTier)}>{["UNRANKED","IRON","BRONZE","SILVER","GOLD","PLATINUM","EMERALD","DIAMOND","MASTER","GRANDMASTER","CHALLENGER"].map((tier) => <option key={tier}>{tier}</option>)}</select></label>{usesDivision && <label>디비전<select value={rankDivision} onChange={(event) => setRankDivision(event.target.value)}>{["IV","III","II","I"].map((division) => <option key={division}>{division}</option>)}</select></label>}<label>커스텀 레이팅<input type="number" min="0" max="100" value={customSkill} onChange={(event) => setCustomSkill(Number(event.target.value))} /></label></div><div className="role-ratings"><h3>포지션별 숙련도 <span>0 — 5 · 0은 절대 배정 금지</span></h3>{ROLES.map((role) => <label key={role}><b>{roleIcon[role]} {roleLabel[role]}</b><input type="range" min="0" max="5" value={skills[role]} onChange={(event) => setSkills({ ...skills, [role]: Number(event.target.value) })} /><output>{skills[role]}</output></label>)}</div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><PixelButton variant="white" onClick={onCancel}>취소</PixelButton><PixelButton type="submit" disabled={saving}><Plus size={18} /> {saving ? "저장 중..." : "등록하기"}</PixelButton></div></form><aside className="mascot-tip"><Poro pose="think" /><div><b>TIP!</b><p>숙련도 0인 포지션에는 어떤 경우에도 배정되지 않습니다.</p></div></aside></div></section>;
}

type LineupRow = { role: Role; blue: string; red: string };
type Feedback = { id: string; matchId: string | null; authorName: string | null; body: string; createdAt: string; lineup: LineupRow[] | null; lineupIsGuess?: boolean };

/** Comments anyone can leave; on the result screen they are tied to the current match. */
function FeedbackBox({ matchId, notify, admin = false, board = false, lineup }: { matchId: string | null; notify: (message: string) => void; admin?: boolean; board?: boolean; lineup?: LineupRow[] }) {
  const [items, setItems] = useState<Feedback[]>([]);
  // Only rendered after client-side navigation, so reading storage here is safe.
  const [authorName, setAuthorName] = useState(() => { try { return localStorage.getItem("feedback-name") ?? ""; } catch { return ""; } });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    api<Feedback[]>(matchId ? `/api/feedback?matchId=${matchId}` : "/api/feedback").then(setItems).catch(() => setItems([]));
  }, [matchId]);
  async function submit() {
    if (!body.trim()) return;
    setSending(true);
    try {
      const created = await api<Feedback>("/api/feedback", { method: "POST", body: JSON.stringify({ matchId, authorName, body, lineup: lineup ?? null }) });
      setItems((previous) => [created, ...previous]); setBody("");
      try { localStorage.setItem("feedback-name", authorName); } catch { /* storage unavailable */ }
      notify("피드백을 남겼어요!");
    } catch (error) { notify(error instanceof Error ? error.message : "피드백을 남기지 못했어요."); }
    finally { setSending(false); }
  }
  async function remove(id: string) {
    try { await api(`/api/feedback/${id}`, { method: "DELETE" }); setItems((previous) => previous.filter((item) => item.id !== id)); }
    catch (error) { notify(error instanceof Error ? error.message : "삭제하지 못했어요."); }
  }
  return <section className="feedback-box">
    <div className="feedback-head"><span className="step">💬 FEEDBACK</span><h3>{board ? "모두의 피드백" : "이 조합 어때요?"}</h3><p>{board ? "어떤 조합에 어떤 의견이 있었는지 모아 봤어요." : "라인이 이상하거나 바꾸면 좋을 사람이 있으면 남겨 주세요."}</p></div>
    {!board && <div className="feedback-form">
      <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={20} placeholder="이름 (선택)" aria-label="이름" />
      <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} rows={3} placeholder="예: 세훈이랑 동완 바꾸는 게 맞을 듯" aria-label="피드백 내용" />
      <PixelButton onClick={() => void submit()} disabled={sending || !body.trim()}>{sending ? "보내는 중..." : "남기기"}</PixelButton>
    </div>}
    {items.length === 0 ? <p className="feedback-empty">아직 남겨진 피드백이 없어요.</p> : <ul className="feedback-list">{items.map((item) => <li key={item.id}>
      <div><b>{item.authorName ?? "익명"}</b><small>{new Date(item.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>{admin && <button onClick={() => void remove(item.id)} aria-label="피드백 삭제">삭제</button>}</div>
      {board && item.lineup && <div className="feedback-lineup" aria-label="피드백한 조합">{item.lineup.map((row) => <span key={row.role}><em>{roleLabel[row.role]}</em><i className="blue">{row.blue}</i> vs <i className="red">{row.red}</i></span>)}{item.lineupIsGuess && <small>후보 1 기준</small>}</div>}
      <p>{item.body}</p>
    </li>)}</ul>}
  </section>;
}

function ResultScreen({ candidate, alternativeCount, candidateIndex, votingPath, matchId, notify, onBack, onNext, onConfirm }: { candidate: BalanceCandidate; matchId: string | null; alternativeCount: number; candidateIndex: number; votingPath: string | null; notify: (message: string) => void; onBack: () => void; onNext: () => void; onConfirm: (assignments: Array<{ playerId: string; team: string; role: string }>, publish: boolean) => Promise<{ candidate: BalanceCandidate; publicPath: string | null }> }) {
  const [working, setWorking] = useState(candidate); const [picked, setPicked] = useState<PlayerAssignment | null>(null); const [saving, setSaving] = useState(false);
  const [swapReport, setSwapReport] = useState<{ assessment: BalanceAssessment; beforeMaxGap: number; beforeTeamGap: number } | null>(null);
  const assignments = () => [...working.blue, ...working.red].map(({ playerId, team, role }) => ({ playerId, team, role }));
  async function choose(assignment: PlayerAssignment) {
    if (!picked) { setPicked(assignment); return; }
    if (picked.team === assignment.team) { setPicked(assignment); return; }
    const next = assignments().map((item) => item.playerId === picked.playerId ? { ...item, playerId: assignment.playerId } : item.playerId === assignment.playerId ? { ...item, playerId: picked.playerId } : item);
    try { setSaving(true); const result = await onConfirm(next, false); setSwapReport({ assessment: assessBalance(result.candidate.metrics), beforeMaxGap: working.metrics.maximumLaneGap, beforeTeamGap: working.metrics.totalStrengthDifference }); setWorking(result.candidate); notify("수동 교환 후 밸런스를 다시 계산했어요."); }
    catch (error) { notify(error instanceof Error ? error.message : "교환할 수 없습니다."); }
    finally { setSaving(false); setPicked(null); }
  }
  async function share() { try { setSaving(true); const result = await onConfirm(assignments(), true); if (result.publicPath) { await navigator.clipboard.writeText(`${location.origin}${result.publicPath}`); notify("공유 링크를 복사했어요!"); } } catch (error) { notify(error instanceof Error ? error.message : "공유하지 못했습니다."); } finally { setSaving(false); } }
  async function shareVote() { if (!votingPath) return; await navigator.clipboard.writeText(`${location.origin}${votingPath}`); notify("후보 3개 투표 링크를 복사했어요!"); }
  const team = (teamName: "BLUE" | "RED", list: PlayerAssignment[]) => <div className={`team ${teamName.toLowerCase()}`}><header><div>{teamName === "BLUE" ? <Shield /> : <Crown />}<span>{teamName} TEAM<small>배정 포지션 전력</small></span></div><b>{(teamName === "BLUE" ? working.metrics.blueTotalStrength : working.metrics.redTotalStrength).toFixed(1)}</b></header>{list.map((assignment) => <button className={`roster ${picked?.playerId === assignment.playerId ? "picked" : ""}`} key={assignment.playerId} onClick={() => void choose(assignment)} disabled={saving}><span className="lane">{roleIcon[assignment.role]}<small>{roleLabel[assignment.role]}</small></span><span className="rank">R{assignment.roleProficiency}</span><span className="roster-name"><b>{assignment.name}</b>{assignment.nickname && <small>{riotId(assignment.nickname, assignment.tagline)}</small>}</span><em>{assignment.roleStrength.toFixed(1)}</em></button>)}</div>;
  return <section className="screen result-screen"><div className="result-head"><span className="step">MATCH READY · {candidateIndex + 1}/{alternativeCount}</span><h1>팀 편성 완료!</h1><p>두 플레이어를 차례로 누르면 서버에서 교환 가능 여부와 밸런스를 다시 검증합니다.</p></div><div className="team-board">{team("BLUE", working.blue)}<div className="versus"><Poro pose="cheer" /><b>VS</b><span>MAX LANE GAP</span><strong>{working.metrics.maximumLaneGap.toFixed(1)}</strong></div>{team("RED", working.red)}</div><div className="balance-stats"><div><span>라인 최대 격차</span><b>{working.metrics.maximumLaneGap.toFixed(1)}</b><small>최우선 최적화</small></div><div><span>팀 전력 차이</span><b>{working.metrics.totalStrengthDifference.toFixed(1)}</b><small>ASSIGNED POWER</small></div><div><span>주 포지션 배정</span><b className="grade">{working.metrics.mainRoleAssignments}</b><small>/ 10 PLAYERS</small></div></div>{swapReport && <div className={`swap-report ${swapReport.assessment.label === "추천" ? "good" : swapReport.assessment.label === "적정" ? "fair" : "bad"}`}><div><span>수동 교환 평가</span><strong>{swapReport.assessment.label}</strong><b>{swapReport.assessment.score}<small>/100</small></b></div><p>라인 최대 격차 <del>{swapReport.beforeMaxGap.toFixed(1)}</del> → <b>{working.metrics.maximumLaneGap.toFixed(1)}</b> · 팀 전력 차이 <del>{swapReport.beforeTeamGap.toFixed(1)}</del> → <b>{working.metrics.totalStrengthDifference.toFixed(1)}</b></p><small>라인 균형 50% · 팀 균형 30% · 포지션 만족도 20%</small></div>}<div className="result-actions"><PixelButton variant="white" onClick={onBack}>다시 선택</PixelButton><PixelButton variant="blue" onClick={onNext} disabled={alternativeCount < 2}><Shuffle size={17} /> 다음 대안</PixelButton><PixelButton variant="dark" onClick={() => void shareVote()}>♥ 후보 투표</PixelButton><PixelButton onClick={() => void share()} disabled={saving}>{saving ? "검증 중..." : "확정 및 공유"}</PixelButton></div><FeedbackBox matchId={matchId} notify={notify} lineup={ROLES.map((role) => ({ role, blue: working.blue.find((a) => a.role === role)?.name ?? "?", red: working.red.find((a) => a.role === role)?.name ?? "?" }))} /></section>;
}

function AdminScreen({ players, onBack, onArchived, notify }: { players: Player[]; onBack: () => void; onArchived: (id: string) => void; notify: (message: string) => void }) {
  const [rules, setRules] = useState<Array<{ id: string; playerAId: string; playerBId: string }>>([]); const [playerAId, setPlayerAId] = useState(""); const [playerBId, setPlayerBId] = useState("");
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [pillOffer, setPillOffer] = useState<Player | null>(null);
  useEffect(() => { api<Array<{ id: string; playerAId: string; playerBId: string }>>("/api/admin/separation-rules").then(setRules).catch((error) => notify(error.message)); }, [notify]);
  async function archive(id: string) { try { await api(`/api/players/${id}`, { method: "DELETE" }); onArchived(id); notify("플레이어를 보관 처리했습니다."); } catch (error) { notify(error instanceof Error ? error.message : "처리하지 못했습니다."); } }
  async function addRule() { try { const rule = await api<{ id: string; playerAId: string; playerBId: string }>("/api/admin/separation-rules", { method: "POST", body: JSON.stringify({ playerAId, playerBId }) }); setRules((previous) => [rule, ...previous]); setPlayerAId(""); setPlayerBId(""); notify("비공개 분리 조건을 저장했습니다."); } catch (error) { notify(error instanceof Error ? error.message : "저장하지 못했습니다."); } }
  async function removeRule(id: string) { try { await api(`/api/admin/separation-rules/${id}`, { method: "DELETE" }); setRules((previous) => previous.filter((rule) => rule.id !== id)); notify("분리 조건을 삭제했습니다."); } catch (error) { notify(error instanceof Error ? error.message : "삭제하지 못했습니다."); } }
  const name = (id: string) => players.find((player) => player.id === id)?.name ?? "알 수 없음";
  return <section className="screen compact-screen"><div className="page-title"><span className="step">ADMIN ONLY</span><h1>게임 룰 설정실</h1><p>이 화면의 분리 조건은 공개 결과에 절대 포함되지 않습니다.</p></div><div className="admin-grid"><aside className="admin-menu"><b><Settings size={17} /> SETTINGS</b><button className="active">01. 플레이어 데이터</button><button>02. 분리 제약</button></aside><div className="arcade-panel admin-panel"><div className="admin-title"><div><span className="step">PLAYER DATABASE</span><h2>플레이어 데이터</h2></div></div><div className="admin-table"><div className="tr head"><span>PLAYER</span><span>RANK</span><span>STATUS</span><span /></div>{players.map((player) => <div className="tr" key={player.id}><span><RankBadge player={player} /><span><b>{player.name}</b>{player.nickname && <small>{riotId(player.nickname, player.tagline)}</small>}</span></span><span>{player.rankTier} {player.rankDivision}</span><span><i className="status-dot" /> 활성</span><span className="row-actions"><button className="red-pill-btn" onClick={() => setPillOffer(player)} aria-label={`${player.name} 빨간약 먹기`}>💊 빨간약 먹기</button><button onClick={() => void archive(player.id)} aria-label={`${player.name} 보관`}>×</button></span></div>)}</div><div className="constraint-editor"><h3>비공개 팀 분리 조건</h3><div><select value={playerAId} onChange={(event) => setPlayerAId(event.target.value)}><option value="">플레이어 A</option>{players.map((player) => <option value={player.id} key={player.id}>{player.name}{player.nickname ? ` (${riotId(player.nickname, player.tagline)})` : ""}</option>)}</select><span>≠</span><select value={playerBId} onChange={(event) => setPlayerBId(event.target.value)}><option value="">플레이어 B</option>{players.map((player) => <option value={player.id} key={player.id}>{player.name}{player.nickname ? ` (${riotId(player.nickname, player.tagline)})` : ""}</option>)}</select><PixelButton onClick={() => void addRule()} disabled={!playerAId || !playerBId}>추가</PixelButton></div>{rules.map((rule) => <p key={rule.id}><span>{name(rule.playerAId)} ↔ {name(rule.playerBId)}</span><button onClick={() => void removeRule(rule.id)}>삭제</button></p>)}</div><div className="admin-note"><Shield size={18} /><p><b>PRIVATE ZONE</b> 관계 설명은 저장하지 않으며 조건은 서버에서만 평가됩니다.</p></div><div className="form-actions"><PixelButton variant="white" onClick={onBack}>나가기</PixelButton></div></div></div>{pillOffer && <div className="modal-backdrop" onClick={() => setPillOffer(null)}><article className="red-pill-modal pill-confirm" role="alertdialog" aria-labelledby="pill-confirm-title" onClick={(event) => event.stopPropagation()}><span className="step">💊 RED PILL</span><h2 id="pill-confirm-title">빨간약을 정말 드시겠어요...?</h2><p>{pillOffer.name}의 숨겨진 숙련도가 보이게 됩니다.</p><div className="pill-confirm-actions"><PixelButton variant="white" onClick={() => setPillOffer(null)}>안 먹을래요</PixelButton><PixelButton onClick={() => { setDetailPlayer(pillOffer); setPillOffer(null); }}>💊 먹는다</PixelButton></div></article></div>}{detailPlayer && <div className="modal-backdrop" onClick={() => setDetailPlayer(null)}><article className="red-pill-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setDetailPlayer(null)}>×</button><span className="step">규피티의 빨간약 💊</span><h2>{detailPlayer.name}의 상세 숙련도</h2><p>{riotId(detailPlayer.nickname, detailPlayer.tagline) || "Riot ID 미등록"} · 티어 환산 {normalizedRank(detailPlayer.rankTier, detailPlayer.rankDivision, detailPlayer.rankLp).toFixed(1)} · 커스텀 {detailPlayer.customSkill}</p><div className="skill-reveal">{ROLES.map((role) => <div className={detailPlayer.roleSkills[role] === 0 ? "blocked" : ""} key={role}><span>{roleIcon[role]} {roleLabel[role]}</span><b>{detailPlayer.roleSkills[role] === 0 ? "배정 금지" : roleStrength(detailPlayer, role).toFixed(1)}</b><i style={{ width: `${detailPlayer.roleSkills[role] * 20}%` }} /></div>)}</div><small>라인 전력 = 티어 점수(한 티어 15점, 커스텀 ±5 보정). 주포·부포는 티어 그대로, 그 외 라인은 한 티어 아래(−15)로 계산합니다.</small></article></div>}</section>;
}
