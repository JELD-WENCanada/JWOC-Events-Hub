# JWOC Events Hub

Simple event lead collection for JW Sales Hub. Leads are stored as JSON files in this GitHub repo and served through Vercel API routes.

## Setup

1. Create a GitHub fine-grained personal access token with **Contents** read/write access to this repo.
2. Deploy to Vercel and connect this repository.
3. Add environment variables in Vercel:
   - `API_KEY` — shared secret used by JW Sales Hub and the web UI
   - `GITHUB_TOKEN` — GitHub PAT
   - `GITHUB_OWNER` — GitHub org or username
   - `GITHUB_REPO` — `JWOC-Events-Hub`
   - `GITHUB_BRANCH` — `main`

## API

| Method | Route                    | Auth   | Description           |
| ------ | ------------------------ | ------ | --------------------- |
| GET    | `/api/events`            | No     | List events           |
| POST   | `/api/events`            | Bearer | Create event          |
| GET    | `/api/events/:id`        | No     | Get event and leads   |
| POST   | `/api/events/:id/leads`  | Bearer | Submit lead from app  |
| GET    | `/api/events/:id/export` | No     | Download leads as CSV |

## Local development

Copy `.env.example` to `.env.local` for Vercel CLI, or set the variables in your shell before running `vercel dev`.
