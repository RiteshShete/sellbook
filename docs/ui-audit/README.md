# UI audit screenshots (360x800, test data only)

`before/` = main as of tag backup-before-ui-round-2; `after/` = ui-round-2. Names/orders are fake (e2e/mock.ts); the API is mocked, nothing touches a real project.

```
# Windows Git Bash rewrites /sellbook/ into a Windows path: set MSYS_NO_PATHCONV=1 (or use PowerShell)
MSYS_NO_PATHCONV=1 VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=test-anon-key-for-screenshots-only BASE_PATH=/sellbook/ npm run build
SHOT_LABEL=after npm run e2e
```
