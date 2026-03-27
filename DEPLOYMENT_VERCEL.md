# Deployment Guide: Git to Vercel

This document outlines the pipeline for deploying **CityBeat Magazine** to Vercel via GitHub.

## 1. Local Commit and Push
Ensure all changes are committed and pushed to the `main` branch of the correct repository.

```powershell
# Add changes
git add .

# Commit
git commit -m "Your descriptive commit message"

# Push to GitHub
git push origin main
```

## 2. Vercel Automatic Deployment
Once pushed, GitHub will notify Vercel, which will automatically start the build process.

- **URL**: [https://city-beat-mag.vercel.app](https://city-beat-mag.vercel.app)
- **Dashboard**: Monitor build status at [vercel.com](https://vercel.com)

## 3. Environment Variable Configuration
The application requires several environment variables to connect to your backend services. In the **Vercel Project Settings > Environment Variables**, add the following:

| Key | Value Source |
|-----|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings > API |
| `NEXT_PUBLIC_POCKETBASE_URL` | Your hosted PocketBase URL (e.g., `https://pb.yourdomain.com`) |

## 4. Verification Checklist
- [ ] Check Vercel build logs for any TypeScript or Linting errors.
- [ ] Verify that images load correctly (check `next.config.ts` for allowed domains).
- [ ] Test the language switcher to ensure bilingual content resolves.
- [ ] Confirm that PocketBase article data is being fetched correctly.

## 5. Troubleshooting
If the build fails on Vercel:
1. Ensure `pnpm-lock.yaml` is up to date (`pnpm install`).
2. Verify that `next.config.ts` does not contain references to local-only services (like `127.0.0.1` unless proxied).
3. Check that all required `devDependencies` are correctly listed in `package.json`.
