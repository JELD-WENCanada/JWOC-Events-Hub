# JWOC Events Hub

Simple event lead collection for JW Sales Hub. Leads are stored as JSON files in this GitHub repo and served through Vercel API routes.

## Setup

1. Create a GitHub fine-grained personal access token with **Contents** read/write access to this repo.
2. Deploy to Vercel and connect this repository.
3. Add environment variables in Vercel:
   - `API_KEY` — shared secret used by JW Sales Hub for lead submission and dashboard sessions
   - `GITHUB_TOKEN` — GitHub PAT
   - `GITHUB_OWNER` — GitHub org or username
   - `GITHUB_REPO` — `JWOC-Events-Hub`
   - `GITHUB_BRANCH` — `main`

## API

| Method | Route                     | Auth   | Description                              |
| ------ | ------------------------- | ------ | ---------------------------------------- |
| GET    | `/api/events`             | No     | List events (`?includeArchived=true`)    |
| POST   | `/api/events`             | Bearer | Create event                             |
| GET    | `/api/events/leaderboard` | No     | Rep leaderboard across events            |
| GET    | `/api/events/:id`         | No     | Get event and leads                      |
| PATCH  | `/api/events/:id`         | Bearer | Update event name, date, or archive flag |
| POST   | `/api/events/:id/leads`   | Bearer | Submit lead from app                     |
| GET    | `/api/events/:id/export`  | No     | Download leads as CSV                    |

## Local development

Copy `.env.example` to `.env.local`, set your values, then run `vercel dev` or `npm run local`.
