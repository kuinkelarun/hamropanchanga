Team pause notice — who is currently working and how to ask them to pause

Purpose
-------
Quick guide to discover active contributors working on this repository and to notify them to pause work temporarily.

What this document contains
--------------------------
- Quick commands (PowerShell / cmd) to discover active git activity (recent commits, unpushed commits, local modifications).
- A short checklist to run before sending the notice.
- Message templates for Slack, Microsoft Teams, and Email.

Important
---------
Run the git commands from the repository root:
`e:\Arun\Side - Projects\Family Tree\family-tree-app`.

Commands to find recent activity (PowerShell-friendly)
-----------------------------------------------------
1) Show recent commits (last 7 days)

```powershell
# show commits from the last 7 days with author and date
git --no-pager log --since="7 days ago" --pretty=format:"%C(yellow)%h%Creset %C(green)%cd%Creset %C(cyan)%an%Creset %s" --date=local
```

2) List recent committers and commit counts (last 30 days)

```powershell
git --no-pager shortlog -sne --since="30 days ago"
```

3) Show branches with last commit date (local + remote)

```powershell
# Local branches sorted by last commit date
git for-each-ref --sort=-committerdate refs/heads/ --format="%(committerdate:iso8601) %(refname:short) %(authorname) %(objectname:short)"

# Remote branches
git for-each-ref --sort=-committerdate refs/remotes/ --format="%(committerdate:iso8601) %(refname:short) %(authorname) %(objectname:short)"
```

4) Find branches with unpushed commits

```powershell
# show commits on local branches that are not on origin
git fetch --prune
for ($b in (git for-each-ref --format='%(refname:short)' refs/heads/)) { 
  $unpushed = git log origin/$b..$b --oneline 2>$null; if ($LASTEXITCODE -eq 0 -and $unpushed) { Write-Host "Branch: $b has unpushed commits:"; git log origin/$b..$b --oneline; }
}
```

5) Show uncommitted changes (working tree)

```powershell
git status --porcelain
# For more detail:
git --no-pager status -sb
```

6) Show commits that differ between local and remote (useful to see pending pushes)

```powershell
# commits that are in local but not on remote
git rev-list --left-only --count origin/HEAD...HEAD
# or list the commits
git log origin/HEAD..HEAD --pretty=format:"%h %an %s" --abbrev-commit
```

7) Show who last changed a file (find who to message about that area)

```powershell
git blame --line-porcelain -- <path/to/file> | sed -n 's/^author //p' | sort | uniq -c | sort -nr
```

(Windows note: the `sed` pipeline requires tools like Git Bash, WSL, or GnuWin32 utils. Run `git blame --line-porcelain <file>` and inspect the `author` lines if you don't have `sed`.)

Checklist before sending the pause notice
----------------------------------------
- Run `git status --porcelain` locally to ensure you have no uncommitted work you will lose.
- Fetch remotes: `git fetch --prune`.
- Run the recent commits and branch checks above to identify active contributors with recent commits or unpushed branches.
- If someone has unpushed commits, notify them first before anyone else merges or rebases branches that may affect theirs.

Message templates
-----------------
Use these templates, and adapt the channel or urgency. Replace placeholders like `<name>`, `<branch>`, `<time-window>`, and `<reason>`.

Slack (short) — a quick channel notice

```
:stop_sign: Hi team — quick pause request

We're about to make a change that will affect the repo (config/rules/deploy). If you're actively working on this repo or have unpushed changes, please pause and reply here with your branch name. We'll hold changes for the next <time-window> (e.g. 30 minutes) while we perform the update.

If you need more time, mention it and we'll coordinate. Thanks!
```

Slack (direct to a person)

```
Hey <@username>, quick check — are you working on branch `<branch>` or do you have unpushed changes? We're about to run repo-wide changes and need everyone to pause for ~<time-window>. Please reply here if you need more time.
```

Microsoft Teams (channel)

```
[Action required] Repo pause request

We're going to make changes (deploy rules / update critical config) that may affect in-progress work. Please pause any active work and avoid pushing for the next <time-window>. If you have unpushed commits, post your branch or DM me and we'll coordinate.
```

Email (longer, for managers or stakeholders)

```
Subject: Temporary pause on repo activity — <project-name>

Hi all,

We will be performing a short change to the repository that could impact in-progress work (for example, Firestore rules deploy). To avoid interrupted work or merge conflicts, please pause active work on the repo for the next <time-window> starting now.

Action items:
- If you have uncommitted work, commit locally but avoid pushing until we confirm it's safe.
- If you have unpushed commits that you must save, push to your feature branch and note it in the thread.
- If you cannot pause, reply with your branch and ETA to finish.

We expect this to take about <time-window>. Thanks for your cooperation.

Best,
<your-name>
```

Suggested process (short)
-------------------------
1. Run the git commands above to list recent activity and unpushed branches.
2. Post the Slack/Teams channel message asking for pause.
3. Direct-message any people with recent/unpushed work using the direct template.
4. Wait for confirmations. If someone cannot pause, either wait for their short ETA or schedule around them.
5. Proceed with the repo change (deploy rules / migration) and announce completion when done.

If you want, I can build a short PowerShell script that collects the active-contributor info and prints a short report ready to paste into Slack. Say the word and I'll add it to `tools/` as `tools/collect-active-contributors.ps1` or a Node script.

Safety note
-----------
Don't delete branches or force-push changes while people have unpushed work; coordinate and merge safely.
