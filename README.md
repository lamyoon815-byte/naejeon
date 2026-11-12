# 규CK 내전 팀짜기

League of Legends 5:5 내전을 위한 관리자용 팀 밸런서입니다. 사람 이름을 기본 식별자로 사용하고 소환사 닉네임과 `#태그`는 선택적인 보조 정보로 관리합니다. 선수 정보와 매치 결과는 Supabase PostgreSQL에 영구 저장하고, 팀 구성은 서버에서 계산합니다.

## 기술 구성

- Next.js 16 App Router + TypeScript
- Supabase PostgreSQL, Auth, Row Level Security
- Zod 요청 검증
- Vitest 알고리즘/선택적 DB 통합 테스트
- Vercel 배포

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 다음 값을 입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SECRET_KEY`는 브라우저 코드에 넣거나 Git에 커밋하면 안 됩니다. 이 프로젝트에서는 `server-only` 모듈과 Route Handler에서만 사용합니다.

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 [초기 마이그레이션](./supabase/migrations/202611120001_initial.sql)을 실행합니다. Supabase CLI를 사용한다면 프로젝트를 연결한 뒤 `supabase db push`로 적용해도 됩니다.
3. Auth의 URL Configuration에서 로컬 주소 `http://localhost:3000/auth/callback`과 실제 Vercel 주소의 `/auth/callback`을 Redirect URL로 등록합니다.
4. `/login`에서 Magic Link로 한 번 로그인해 Auth 사용자를 생성합니다.
5. Supabase Dashboard의 Authentication > Users에서 해당 사용자의 UUID를 복사하고 SQL Editor에서 최초 관리자를 등록합니다.

```sql
insert into public.admin_users (user_id)
values ('AUTH-USER-UUID');
```

관리자로 등록되지 않은 로그인 사용자는 API에 접근할 수 없습니다. 선수, 숙련도, 비공개 분리 조건, 매치 원본은 RLS로 관리자만 읽고 쓸 수 있습니다.

## 밸런싱 규칙

각 선수의 포지션 전력은 다음 휴리스틱으로 계산합니다.

```text
roleStrength = 0.40 × rankStrength
             + 0.25 × customSkill
             + 0.35 × roleProficiencyStrength
```

티어/디비전/LP는 결정적인 숫자로 변환하며, 커스텀 레이팅은 0–100, 포지션 숙련도는 0–5입니다. 숙련도 0은 단순히 낮은 점수가 아니라 해당 라인 배정 금지 조건입니다. 자동 생성과 수동 교환 모두 서버에서 이를 거부합니다. 이 값은 승률 예측이 아니라 팀 비교를 위한 내부 전력 지표입니다.

기본 티어 기준값은 언랭크 20, 아이언 25, 브론즈 35, 실버 45, 골드 55, 플래티넘 65, 에메랄드 72, 다이아몬드 80, 마스터 90, 그랜드마스터 95, 챌린저 100입니다. IV/III/II/I 디비전 보너스는 각각 0/2.5/5/7.5이며 LP 보정은 티어 범위를 크게 뒤집지 않도록 최대 1.5점으로 제한합니다.

탐색기는 정확히 10명을 BLUE/RED 각 5명, 팀별 TOP/JUNGLE/MID/ADC/SUPPORT 1명씩 배정하고 비공개 분리 조건을 지킵니다. 후보 비교는 아래 우선순위를 엄격하게 따릅니다.

1. 라인별 전력 차이의 최댓값 최소화
2. 라인 차이 제곱합 최소화
3. 팀 총 전력 차이 최소화
4. 주 포지션 만족도 최대화
5. 동률일 때 결정적 키로 정렬

수동 교환도 서버에서 동일한 제약을 다시 검증하고 지표를 재계산한 뒤 저장합니다.

자동 생성된 상위 3개 후보는 `/vote/{64자 토큰}` 링크로 공유할 수 있습니다. 참가자는 공개 링크에서 내부 레이팅 없이 팀 명단과 요약 지표만 비교하며, 브라우저별 한 표를 행사하거나 다른 후보로 변경할 수 있습니다.

수동 교환 후에는 별도의 설명용 0–100점 평가를 표시합니다. 라인 균형 50%, 팀 총점 균형 30%, 포지션 만족도 20%로 구성하며 80점 이상은 추천, 60점 이상은 적정, 그 미만은 비추천입니다. 이 표시는 사용자 설명용이며 실제 후보 정렬의 엄격한 우선순위를 대체하지 않습니다.

## 검증

```bash
npm run typecheck
npm test
npm run build
```

기본 테스트는 균형/불균형, SUPPORT 격차 우선순위, 단일·다중 분리 조건, 숙련도 0 금지, 해가 없는 경우, 잘못된 수동 교환을 다룹니다.

실제 Supabase 저장과 익명 접근 차단까지 확인하려면 폐기 가능한 테스트 프로젝트에 마이그레이션을 적용하고 아래 변수도 설정합니다.

```dotenv
SUPABASE_TEST_URL=
SUPABASE_TEST_PUBLISHABLE_KEY=
SUPABASE_TEST_SECRET_KEY=
```

테스트 변수들이 없으면 DB 통합 테스트는 자동으로 건너뜁니다. 운영 프로젝트를 통합 테스트 대상으로 사용하지 마세요.

## Vercel 배포

1. 이 디렉터리를 Git 저장소에 올리고 Vercel에서 Import합니다.
2. Framework Preset은 Next.js, Root Directory는 `quyck-ui`(저장소 루트가 상위 폴더인 경우)로 지정합니다.
3. Preview와 Production에 위의 Supabase 환경 변수 3개를 등록합니다.
4. 배포 주소의 `/auth/callback`을 Supabase Redirect URL에 추가합니다.
5. 배포 후 `/login`에서 관리자 계정으로 로그인합니다.

공유 URL은 `/result/{64자 토큰}` 형태입니다. 공개 API는 스냅샷의 닉네임·팀·포지션과 요약 지표만 반환하며, 커스텀 레이팅·숙련도·분리 조건·관리자 정보는 반환하지 않습니다.

## 주요 경로

- `app/page.tsx` — 관리자 UI
- `app/api` — 인증된 CRUD, 팀 생성, 확정/공개 API
- `lib/balancer` — 순수 TypeScript 전력 계산 및 최적화 엔진
- `supabase/migrations` — 스키마, 인덱스, RLS, 원자적 확정 RPC
- `lib/balancer/engine.test.ts` — 알고리즘 단위 테스트
- `tests/supabase.integration.test.ts` — 선택적 실제 DB 통합 테스트
