# JWOC Events Hub

Simple event lead collection for JW Sales Hub. Leads are stored as JSON files in this GitHub repo and served through Vercel API routes.

## Setup

1. Create a GitHub fine-grained personal access token with **Contents** read/write access to this repo.
2. Deploy to Vercel and connect this repository.
3. Add environment variables in Vercel (required for production):
   - `API_KEY` — shared secret for lead submission and dashboard login sessions (**required on Vercel**)
   - `GITHUB_TOKEN` — GitHub PAT with repo Contents read/write
   - `GITHUB_OWNER` — GitHub org or username (`JELD-WENCanada`)
   - `GITHUB_REPO` — `JWOC-Events-Hub`
   - `GITHUB_BRANCH` — `main`
   - `ALLOWED_ADMIN_EMAILS` — optional comma-separated extra dashboard emails

   Without `API_KEY` (or `SESSION_SECRET`), dashboard login will fail on Vercel with a server configuration error.

## API

| Method | Route                           | Auth   | Description                                |
| ------ | ------------------------------- | ------ | ------------------------------------------ |
| GET    | `/api/events`                   | No     | List events (`?includeArchived=true`)      |
| POST   | `/api/events`                   | Bearer | Create event                               |
| GET    | `/api/events/leaderboard`       | No     | Rep leaderboard across events              |
| GET    | `/api/events/:id`               | No     | Get event and leads                        |
| PATCH  | `/api/events/:id`               | Bearer | Update event name, date, or archive flag   |
| DELETE | `/api/events/:id`               | Admin  | Delete an archived event and all its leads |
| POST   | `/api/events/:id/leads`         | Bearer | Submit lead from app                       |
| DELETE | `/api/events/:id/leads/:leadId` | Admin  | Delete a lead (signed-in dashboard only)   |
| GET    | `/api/events/:id/export`        | No     | Download leads as CSV                      |

## Local development

Copy `.env.example` to `.env.local`, set your values, then run `vercel dev` or `npm run local`.
