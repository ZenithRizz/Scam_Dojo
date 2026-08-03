# Scam Dojo

Scam Dojo is a senior-first scam practice app with a single-playable round, family digest screen, and a fallback demo mode.

## Run

```bash
npm install
npm run dev
```

## Env

The live generation proxy expects:

- `LLM_API_KEY`
- `LLM_API_URL` (defaults to OpenAI chat completions)
- `LLM_MODEL` (defaults to `gpt-4o-mini`)

## Demo mode

Open `/?demo=1` to skip setup and play the seeded round with no network dependency.