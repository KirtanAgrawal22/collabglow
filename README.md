CollabGlow2 – Deployment Guide

This repo contains a backend (Express + Socket.IO) and a frontend (Next.js). Below are one-click friendly deployment steps using Render (backend) and Vercel (frontend).

Backend (Render)
- Requirements: A Render account linked to your GitHub.
- Render will read the provided render.yaml and set up the backend automatically.

Steps
1) Push this repository to GitHub (private or public).
2) In Render, click New > Blueprint and select this repository.
3) Review the plan; you should see a single Web Service named collabglow-backend.
4) Click Apply. Render will:
   - Install and build the backend
   - Start the server (Render provides PORT automatically)
5) After deploy completes, copy the backend service URL, e.g. https://collabglow-backend.onrender.com

Frontend (Vercel)
- Requirements: A Vercel account linked to your GitHub.

Steps
1) Import the project in Vercel and select the frontend/ directory as the project root when prompted (or use the monorepo UI to point the project to frontend).
2) Set an environment variable in Vercel Project Settings → Environment Variables:
   - NEXT_PUBLIC_API_URL = https://<your-render-backend-host>
3) Deploy. Vercel will build and host the Next.js site.

Local development
- Backend
  - cd backend
  - npm install
  - npm run dev

- Frontend
  - cd frontend
  - npm install
  - Create .env.local with NEXT_PUBLIC_API_URL=http://localhost:3001
  - npm run dev

Notes
- CORS is currently permissive (*) on the backend for simplicity. For production hardening, restrict origin to your Vercel domain.
- Room state is kept in-memory on the backend. It persists as long as the Render instance is running; it will reset on restarts/redeploys. For durable persistence, add a database later.


