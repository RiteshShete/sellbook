export function EnvErrorScreen({ problems }: { problems: string[] }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">Configuration missing</h1>
      <p className="text-muted">
        The app can&apos;t start because its environment settings are incomplete:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-danger">
        {problems.map((p) => (
          <li key={p} className="break-words">
            {p}
          </li>
        ))}
      </ul>
      <p className="text-muted">
        Copy <code>.env.example</code> to <code>.env.local</code>, fill in the values from your
        Supabase project (Project Settings, API: URL and anon key), then restart the dev server. On
        Cloudflare Pages set the same variables in the project settings and redeploy.
      </p>
    </div>
  )
}
