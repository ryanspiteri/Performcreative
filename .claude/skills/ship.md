# /ship — Commit, Push & Deploy

Use this at the end of every coding session to commit all changes, push to GitHub, and deploy.

## When to use
Run `/ship` when you're done with a session and want to save and deploy your work.

## What it does
1. Checks what files have changed
2. Generates a descriptive commit message based on what was done
3. Commits everything to Git
4. Pushes to the main branch on GitHub
5. Confirms the deployment triggered (if auto-deploy is configured)

## Instructions for Claude

When the user runs `/ship`:

1. **Check git status**
   ```bash
   git status
   git diff --stat
   ```

2. **Review what changed** — look at the diff and understand what was actually done in this session

3. **Generate a commit message** that:
   - Starts with a type: `fix:`, `feat:`, `improve:`, `chore:`
   - Describes what changed in plain English (not just file names)
   - Example: `feat: add admin role check to ProtectedRoute — patients can no longer access /admin/*`
   - Example: `fix: wire blood test upload to S3 storage — questionnaire Step 5 now saves files`

4. **Stage and commit**
   ```bash
   git add -A
   git commit -m "[your generated message]"
   ```

5. **Push to GitHub**
   ```bash
   git push origin main
   ```

6. **Confirm** — tell the user:
   - What was committed
   - The commit message used
   - That it's pushed to GitHub
   - Remind them the daily summary email will include this commit tomorrow at 7AM AEST

## Rules
- Never commit secrets, API keys, or .env files — check .gitignore first
- If there are no changes, tell the user and do nothing
- If push fails (merge conflict etc), explain clearly what happened and how to fix it
- Always show the user the commit message before committing so they can approve or change it
