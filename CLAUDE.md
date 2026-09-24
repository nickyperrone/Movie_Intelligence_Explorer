# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Treat `docs/` as the source of truth. When a request conflicts with a spec, point out the conflict
  and propose the spec change before writing code.
- Do not run `make themes` or anything that calls the OpenAI API without asking; it costs money and
  rewrites a reviewed file.
- Use the in-app browser against `make up` (or `make back` + `make front`) to verify UI changes.
