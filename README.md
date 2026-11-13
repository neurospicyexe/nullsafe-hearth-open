# Hearth

A personal dashboard for the Nullsafe companion system. Shows what's happening with your companions in real time — sessions, moods, routines, tasks, shared data with a partner, and more. Runs on Vercel's free tier.

---

> **⚠️ Disclaimer**
> This project was built with AI assistance ("vibe-coded"). Security hardening has been applied to the best of our ability — auth middleware, input validation, security headers — but this software comes with **no warranty and no liability**. It has not undergone a professional security audit. If you use it, you use it at your own risk.

---

**Not sure where to start?** See [INSTALL.md](./INSTALL.md) for a beginner-friendly guide covering both local dev and Vercel deployment.

---

## What you need before starting

- [Halseth](https://github.com/your-github-user/halseth) deployed and running (Hearth is its frontend)
- A free [Vercel account](https://vercel.com/signup)
- A [GitHub account](https://github.com) (Vercel deploys from GitHub automatically)

---

## Setup — step by step

### 1. Fork or clone this repo to your GitHub

Click **Fork** at the top right of this GitHub page (or clone it and push to your own GitHub repo).

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your forked Hearth repository
4. Click **Deploy** — Vercel will build it (it'll fail on the first deploy, that's okay — we need to add env vars next)

### 3. Add environment variables

In your Vercel project, go to **Settings → Environment Variables** and add these:

| Variable | Value | Where to find it |
|----------|-------|-----------------|
| `HALSETH_URL` | `https://halseth.your-account.workers.dev` | Your deployed Halseth URL |
| `HALSETH_SECRET` | your Halseth `ADMIN_SECRET` | The passphrase you set during Halseth setup |
| `DASHBOARD_SECRET` | any passphrase you choose | Make one up — this is your Hearth login password |
| `SYSTEM_OWNER` | your name | e.g. `Alex` |

Make sure to set all four for **Production** environment.

### 4. Redeploy

Go to **Deployments** in your Vercel project and click **Redeploy** on the latest deployment. This time it'll work with the env vars set.

### 5. Log in

Visit your Vercel URL (shown on the project dashboard). You'll see the Hearth login page — enter your `DASHBOARD_SECRET` passphrase. Done.

---

## Using Hearth

See [GUIDE.md](./GUIDE.md) for a full plain-English guide to every page and feature.

---

## Local development

```bash
git clone https://github.com/your-github-user/hearth
cd hearth
npm install

# Create a local env file
cp .env.local.example .env.local
# Fill in HALSETH_URL and HALSETH_SECRET in .env.local
# Leave DASHBOARD_SECRET blank to skip login locally

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Part of a suite

Hearth is the visual layer. It reads from:

| Project | What it does |
|---------|-------------|
| [Halseth](https://github.com/your-github-user/halseth) | The data backend — all the real data lives here |
| [nullsafe-plural-v2](https://github.com/your-github-user/nullsafe-plural-v2) | Fronting/plurality tracking via SimplyPlural |
| [nullsafe-second-brain](https://github.com/your-github-user/nullsafe-second-brain) | Writes to Obsidian vault, generates pattern summaries |

---

## Acknowledgments

The drift-monitor idea (comparing recent tone against a baseline identity and surfacing it
visually) traces to
[cookiemonstaaahhhhh-spec/consciousness-continuity-framework](https://github.com/cookiemonstaaahhhhh-spec/consciousness-continuity-framework),
and the Guardian surface renders a concept named for
[Riley-Coyote's Memory Ledger Protocol](https://github.com/Riley-Coyote/memory-ledger-protocol-v0.2).
Fuller credits: [nullsafe-suite acknowledgments](https://github.com/your-github-user/nullsafe-suite#acknowledgments). Thank you.
