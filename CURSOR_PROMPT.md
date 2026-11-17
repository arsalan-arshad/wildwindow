# Cursor agent prompts

## Before the first run

1. Create an empty Git repo (for example `wildwindow`) and copy this whole folder into it, keeping the paths: `AGENTS.md`, `CURSOR_PROMPT.md`, `README.md` and `docs/`.
2. Install Node 22 LTS, pnpm and Docker Desktop.
3. Open the repo in Cursor and start an Agent chat. Paste **Prompt 1**.
4. For every later run, start a **new** Agent chat and paste **Prompt 2**. Starting fresh keeps the context clean, and AGENTS.md and TASKS.md hold the state.

---

## Prompt 1: kickoff (Phase 0, then Phase 1)

```text
You are the lead engineer on WildWindow (working name), a wildlife photo forecast app.

First read these files in full, in this order, and follow them strictly:
1. AGENTS.md                (rules, conventions, commands, task workflow)
2. docs/PRD.md              (product scope, user stories, ethics and privacy requirements)
3. docs/ARCHITECTURE.md     (technical source of truth; cited as §)
4. docs/TASKS.md            (the work queue)

Your goal in this session: set up the repo by finishing Phase 0 (T0.1–T0.11), and then, if there is room, start Phase 1 (the @wildwindow/geoprivacy package, T1.1 onwards).

How to work:
- Do the tasks one at a time, in file order, following AGENTS.md §6. Before each task, say which task you are starting and which § sections you read.
- For each task: write the code and tests, make the task's acceptance test pass, then run pnpm lint, pnpm typecheck and pnpm test.
- After each task, update docs/TASKS.md (tick the box, add "Done: <date>, <commit>", and note any change from the plan), then make one commit in Conventional Commits style with the task ID, for example "chore(repo): init pnpm + turborepo monorepo (T0.1)".
- Use the stack exactly as ARCHITECTURE §2 says: pnpm + Turborepo, TypeScript strict, Expo Router, Next.js App Router, NestJS, Postgres 17 + PostGIS 3.5, Drizzle, Vitest (jest-expo for mobile). Use the latest stable versions, and check that Expo works with pnpm (node-linker=hoisted).
- Non-negotiable: never expose exact coordinates, respect data licences (GBIF CC0/CC BY only; eBird off; no iNaturalist AI training; Open-Meteo dev only), no secrets in code, .env.example without values. See AGENTS.md §5.
- Don't do anything irreversible or external (deploying, publishing packages, creating cloud resources, sending email).
- If a task needs me (marked 🧑), do everything you can, mark it "[!] Blocked: needs Arsalan – <what>" and move on to the next task whose dependencies are done.
- If the docs are unclear or conflict, pick the safer option (more privacy, stricter licence), write down the assumption in TASKS.md, and continue.
- Stop when the session gets long, at a clean point (all tests green, TASKS.md updated, everything committed).

When you stop, give me:
1. The tasks done (IDs), with one line each.
2. How to run what exists now (exact commands).
3. Anything blocked on me, with exact steps for me.
4. The next task ID to run.
```

---

## Prompt 2: next task (reuse for every run after that)

```text
Continue building WildWindow.

1. Read AGENTS.md in full, then docs/TASKS.md.
2. Pick the next task following AGENTS.md §6: the first unchecked task, in file order, whose dependencies are all [x]. Tell me its ID and title, and the docs sections (§ / US / S / W) you read for it.
3. Do only that task. Write code and tests, make its acceptance test pass, then run pnpm lint, pnpm typecheck and pnpm test for everything you touched.
4. Follow the non-negotiable rules in AGENTS.md §5 (no exact coordinates, licence rules, no secrets, honest copy, stay in scope, nothing irreversible or external).
5. Update docs/TASKS.md (tick it, add "Done: <date>, <commit>", add notes) and any docs whose behaviour changed. Commit with the task ID in the message.
6. If the task is too big, split it in TASKS.md and finish the first part. If it needs me (🧑), prepare everything, mark it blocked with exactly what you need, and stop.

When you finish, reply with: the task done, files changed, how you tested it, follow-ups or risks, and the next task ID.
```

---

## Optional prompts

**Run one specific task:**

```text
Read AGENTS.md and docs/TASKS.md, then do task <TASK-ID> only, following AGENTS.md §6 and §5. If its dependencies aren't [x], stop and tell me which ones are missing.
```

**Privacy review of a branch or PR:**

```text
Read AGENTS.md §5 and docs/ARCHITECTURE.md §5. Review the current diff only for location-privacy and data-licence problems: any path where coordinates or fine H3 cells could reach a public response, logs, analytics or third parties; any data source or licence not allowed by ARCHITECTURE §3.1. List each problem with file:line, its severity and a fix. Don't change code unless I ask.
```
