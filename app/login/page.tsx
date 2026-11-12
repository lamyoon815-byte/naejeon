"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
      setMessage(error ? error.message : "로그인 링크를 이메일로 보냈습니다.");
    } catch { setMessage("Supabase 환경 설정을 확인해 주세요."); }
    finally { setLoading(false); }
  }
  return <main className="auth-page"><form className="arcade-panel auth-card" onSubmit={submit}><span className="step">ADMIN LOGIN</span><h1>관리자 로그인</h1><p>등록된 관리자 이메일로 일회용 로그인 링크를 받으세요.</p><label>이메일<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label><button className="pixel-btn pink" disabled={loading}>{loading ? "전송 중..." : "로그인 링크 받기"}</button>{message && <output>{message}</output>}</form></main>;
}

