# AGENTS.md

Guidance for humans and coding agents working in this repository.

## Project

OpenBoard is a self-hostable online chess platform. The stack is SvelteKit 2 with Svelte 5, Socket.IO, PostgreSQL through Drizzle ORM, and better-auth for accounts. Deployment targets a single application container plus PostgreSQL.

## Commands

- `npm install` installs dependencies.
- `npm run dev` starts the dev server.
- `npm run build` produces the adapter-node build in `build/`.
- `npm run preview` serves the production build locally.
- `npm run check` runs svelte-kit sync and svelte-check. It must pass with zero errors before every commit.
- `npm run lint` runs prettier and eslint. It must pass before every commit.
- `npm run test` runs vitest.
- `npm run db:generate` and `npm run db:migrate` drive drizzle-kit once the persistence ticket lands.

## Commit conventions

Follow Conventional Commits. Keep subjects under 50 characters, imperative mood, and reference the ticket number, for example `feat: project scaffold (#4)`. Commit only files the ticket owns.

## Branch flow

Feature branches follow `stack/openboard/<nn>-<slug>`. Pull requests target `release/v0.1.0`. `main` stays frozen until the release cut.

## Writing rules

Write short declarative sentences in active voice. Keep a formal register in public artifacts such as README text, commit messages, and issue comments. Banned: em dashes, antithesis, corrective negation, rule-of-three rhythm, summary beats, throat-clearing openers, landing sentences, hedging qualifiers, filler intensifiers, corporate verbs like leverage, performed enthusiasm, and emojis.

## Privacy

Never place personal names, emails, hostnames, IPs, tokens, or machine paths in commits or docs. Use placeholders and example.com domains instead.

## Tickets

Tickets live in GitHub issues under map issue #1.
