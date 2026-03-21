# Deploying TOM to Netlify
### A Gentleman's Step-by-Step Deployment Guide

This guide takes you from your local files to a live, working PWA with a
secure AI backend. It assumes no prior experience with Netlify or APIs.
Estimated time: 15–20 minutes.

---

## What you'll need

- A free account at [netlify.com](https://netlify.com)
- A free account at [github.com](https://github.com)
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
- The TOM project files (the zip you downloaded)

---

## Part 1 — Get an Anthropic API key

1. Go to **console.anthropic.com** and sign in (or create a free account).
2. Click **API Keys** in the left sidebar.
3. Click **Create Key**, give it a name like `TOM PWA`, and click **Create**.
4. **Copy the key immediately** — it starts with `sk-ant-...`
   You will not be able to see it again. Paste it somewhere safe for now
   (e.g. a notes app). You'll need it in Part 3.

> ⚠️ Never paste this key into your HTML or JavaScript files. That's exactly
> what the Netlify function prevents.

---

## Part 2 — Put TOM on GitHub

1. Go to **github.com** and sign in.
2. Click the **+** button (top right) → **New repository**.
3. Name it `tom-pwa`. Set it to **Private** (recommended). Click
   **Create repository**.
4. On your computer, unzip the TOM files into a folder called `tom-pwa`.
   The folder should contain:
   ```
   tom-pwa/
   ├── index.html
   ├── manifest.json
   ├── sw.js
   ├── icon-192.png
   ├── icon-512.png
   ├── netlify.toml
   └── netlify/
       └── functions/
           └── tom-ai.js
   ```
5. Open **GitHub Desktop** (or use the command line if you're comfortable).
   - In GitHub Desktop: File → Add Local Repository → choose your `tom-pwa` folder.
   - Commit all files with message `Initial deploy`.
   - Click **Push origin**.

   > If using the command line:
   > ```bash
   > cd tom-pwa
   > git init
   > git add .
   > git commit -m "Initial deploy"
   > git remote add origin https://github.com/YOUR_USERNAME/tom-pwa.git
   > git push -u origin main
   > ```

---

## Part 3 — Deploy on Netlify

1. Go to **app.netlify.com** and sign in.
2. Click **Add new site** → **Import an existing project**.
3. Click **Deploy with GitHub** and authorise Netlify to access your account.
4. Select your `tom-pwa` repository from the list.
5. On the build settings screen:
   - **Build command**: leave blank
   - **Publish directory**: `.` (just a single dot)
   - Click **Deploy site**

   Netlify will deploy in about 30 seconds. You'll get a URL like
   `https://cheerful-gentleman-abc123.netlify.app`.

---

## Part 4 — Add your API key (the important bit)

Your site is live but TOM's AI won't work yet — the API key hasn't been
added. Here's how:

1. In Netlify, go to your site dashboard.
2. Click **Site configuration** → **Environment variables**.
3. Click **Add a variable**.
4. Set:
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: paste your `sk-ant-...` key here
5. Click **Save**.
6. Go back to **Deploys** and click **Trigger deploy** → **Deploy site**.

This forces the site to restart with the new environment variable active.

> The key is now locked inside Netlify's servers. It never appears in your
> HTML, JavaScript, or GitHub repository. Users of TOM cannot see it.

---

## Part 5 — Test it

1. Open your Netlify URL in a browser.
2. Enter a cycle start date and click **Begin Gentlemanly Guidance**.
3. Scroll down to **Topic Suitability Checker**.
4. Type a topic and click **Ask TOM**.
5. TOM should respond within a few seconds with a verdict and dry advice.

**To test the scolding feature**, try typing something like:
- "why is she being so difficult"
- "she's just hormonal"

TOM should return a `🎩 A GENTLE WORD, OLD BOY` response.

---

## Part 6 — Custom domain (optional)

If you'd like `tom.yourdomain.com` instead of the Netlify URL:

1. In Netlify → **Domain management** → **Add a domain**.
2. Enter your domain name and follow the DNS instructions.
3. Netlify provides a free SSL certificate automatically.

---

## Future updates — how to push changes

Once everything is connected, updating TOM is simple:

1. Edit your files locally.
2. If you made meaningful changes, bump the cache version in `sw.js`:
   ```javascript
   const CACHE = 'tom-v2'; // increment each time
   ```
3. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Describe what you changed"
   git push
   ```
4. Netlify detects the push and redeploys automatically within ~30 seconds.
5. Users will receive the update the next time they open the app.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| AI checker returns an error | Check the API key is saved in Netlify environment variables and re-deploy |
| Site not updating after a push | Check the Deploys tab in Netlify for errors |
| App not installing on phone | The site must be served over HTTPS — Netlify does this automatically |
| Old version still showing | The service worker cache needs to clear — bump `CACHE` version in `sw.js` |
| "Function not found" error | Check that `netlify/functions/tom-ai.js` exists in your repo and `netlify.toml` is present |

---

*"A gentleman's infrastructure, like his manners, should be invisible — 
present when needed, never intrusive."*
— TOM
