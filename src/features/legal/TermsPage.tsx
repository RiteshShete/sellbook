import { Page } from '../../app/Page'
import { APP_TERMS, PRIVACY, SHOP_TERMS, type TermsSection } from './terms'

function Group({ heading, note, sections }: { heading: string; note: string; sections: TermsSection[] }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl">{heading}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      {sections.map((s) => (
        <div key={s.title} className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <h3 className="font-medium">{s.title}</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {s.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/** Read-only terms: the shop's terms of sale and what the app does and does not do. */
export function TermsPage() {
  return (
    <Page title="Terms" back="/more">
      <Group
        heading="Shop terms (customers)"
        note="A short version is printed at the foot of every bill."
        sections={SHOP_TERMS}
      />
      <Group
        heading="Using Sellbook (owner)"
        note="The terms of the service: your account, plans, payments and your data."
        sections={APP_TERMS}
      />
    </Page>
  )
}

/** Public (linked from sign-up): how personal data is handled. */
export function PrivacyPage() {
  return (
    <Page title="Privacy" back="/more">
      <Group
        heading="Privacy policy"
        note="What we keep about you and your customers, why, and your choices."
        sections={PRIVACY}
      />
    </Page>
  )
}
