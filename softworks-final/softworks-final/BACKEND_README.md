# Softworks Brief Assistant — Backend Setup
## Member 2 (Database & Assets) + Member 3 (Integration & Workflow)

---

## What Was Built

### Member 2: Database, Storage & PDF Export
| File | Purpose |
|------|---------|
| `supabase/migrations/001_initial_schema.sql` | Full DB schema: `briefs`, `brief_assets`, `email_log` tables, RLS, indexes, storage buckets |
| `lib/supabase.ts` | Supabase admin & anon client singletons |
| `lib/pdf.ts` | jsPDF-based PDF generation + upload to `brief-pdfs` bucket |
| `app/api/upload/route.ts` | `POST /api/upload` — file uploads (audio, images, docs) to `brief-assets` bucket |
| `app/api/export/[id]/route.ts` | `GET /api/export/[id]` — generate & return signed PDF download URL |

### Member 3: Integration & Workflow
| File | Purpose |
|------|---------|
| `lib/email.ts` | All 3 email templates via Resend (submitter confirmation, manager notification, dept routing) |
| `app/api/briefs/route.ts` | `POST /api/briefs` (create) + `GET /api/briefs` (manager list) |
| `app/api/approve/[id]/route.ts` | `POST /api/approve/[id]` — approve or reject, triggers emails |
| `app/api/share/[token]/route.ts` | `GET /api/share/[token]` — public brief lookup via share token |
| `app/share/[token]/page.tsx` | `/share/[token]` — public no-account brief view page |
| `app/manager/page.tsx` | `/manager` — manager approval dashboard |
| `app/confirm/page.tsx` | `/confirm` — post-submission thank-you page |

---

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
3. Copy your keys from **Settings → API**

### 3. Set Up Resend
1. Create account at [resend.com](https://resend.com)
2. Add & verify your sending domain
3. Create an API key

### 4. Configure Environment Variables
```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

Key variables:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=briefs@yourdomain.com
MANAGER_EMAIL=manager@yourdomain.com
MANAGER_SECRET=<strong-random-string>
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 5. Run Locally
```bash
npm run dev
```

---

## API Reference

### Briefs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/briefs` | None | Create a brief, sends emails |
| `GET`  | `/api/briefs?status=pending_approval` | `Bearer MANAGER_SECRET` | List briefs |

**POST /api/briefs body:**
```json
{
  "submitter_name": "Youssef Zeed",
  "submitter_email": "youssef@example.com",
  "submitter_phone": "+20100000000",
  "raw_text": "We need a new website for our product launch..."
}
```

### Uploads
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/upload` | None | Upload file (multipart: `file`, `brief_id`) |
| `GET`  | `/api/upload?brief_id=xxx` | None | List assets for a brief |

### Approval
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/approve/[id]` | `Bearer MANAGER_SECRET` | Approve or reject |

**POST body:**
```json
{
  "action": "approve",
  "approved_by": "Sarah Chen",
  "manager_notes": "Great brief, routing to design team."
}
```

### Share & Export
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/share/[token]` | None (token = auth) | Public brief view |
| `GET`  | `/api/export/[id]?token=[token]` | Token or Manager | Generate & download PDF |

---

## Status Flow

```
pending_ai → ai_processed → pending_approval → approved → sent_to_dept
                                             ↘ rejected
```

Each transition triggers emails:
- **Brief created** → Submitter confirmation + Manager notification
- **Approved** → Department routing email, status → `sent_to_dept`
- **Rejected** → Submitter revision request email

---

## Integration Point for Member 4 (Gemini/AI)

After Gemini processes a brief, update it via Supabase:
```typescript
await supabaseAdmin
  .from('briefs')
  .update({
    status: 'ai_processed',
    project_title: structured.project_title,
    goals: structured.goals,
    ambiguities: structured.ambiguities,
    department: structured.department,
    priority: structured.priority,
    deadline: structured.deadline,
    structured_brief: structured,
  })
  .eq('id', briefId);

// Then notify manager
await sendManagerNotification(updatedBrief);
```

---

## Pages

| URL | Description |
|-----|-------------|
| `/confirm?id=xxx&token=yyy&email=zzz` | Post-submission thank-you (no account needed) |
| `/share/[token]` | Public brief status page (no account needed) |
| `/manager` | Manager approval dashboard (protected by MANAGER_SECRET) |
