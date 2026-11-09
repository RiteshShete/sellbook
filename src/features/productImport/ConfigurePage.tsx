import { useState, type ReactNode } from 'react'
import { Page } from '../../app/Page'
import type { ApplyResult } from './api/importApi'
import { AiStep } from './components/AiStep'
import { RecentImports } from './components/RecentImports'
import { ReviewScreen, type ReviewInput } from './components/ReviewScreen'
import { SuccessScreen } from './components/SuccessScreen'
import { TemplateStep } from './components/TemplateStep'
import { UploadStep } from './components/UploadStep'

type Stage =
  | { kind: 'prepare' }
  | { kind: 'review'; input: ReviewInput }
  | { kind: 'done'; result: ApplyResult }

type StepNo = 1 | 2 | 3

function Step({
  no,
  active,
  title,
  onOpen,
  children,
}: {
  no: StepNo
  active: boolean
  title: string
  onOpen: () => void
  children: ReactNode
}) {
  return (
    <li
      aria-current={active ? 'step' : undefined}
      className={`rounded-2xl border bg-surface ${active ? 'border-text' : 'border-border'}`}
    >
      <h2 className="font-display text-lg">
        <button
          type="button"
          aria-expanded={active}
          onClick={onOpen}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
        >
          <span
            aria-hidden
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${active ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-text'}`}
          >
            {no}
          </span>
          <span className="min-w-0 flex-1">
            <span className="sr-only">Step {no}: </span>
            {title}
          </span>
        </button>
      </h2>
      {active && <div className="px-4 pb-4">{children}</div>}
    </li>
  )
}

/** Product import from CSV: template, AI instructions, upload, review, save, undo. */
export function ConfigurePage() {
  const [stage, setStage] = useState<Stage>({ kind: 'prepare' })
  const [step, setStep] = useState<StepNo>(1)
  const [message, setMessage] = useState('')

  return (
    <Page title="Import products" subtitle="From a photo or menu, with any AI tool" back="/catalog">
      {/* One polite live region announces parse results and import progress. */}
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>

      {stage.kind === 'review' && (
        <ReviewScreen
          {...stage.input}
          onBack={() => {
            setStage({ kind: 'prepare' })
            setStep(3)
          }}
          onDone={(result) => setStage({ kind: 'done', result })}
          announce={setMessage}
        />
      )}

      {stage.kind === 'done' && (
        <SuccessScreen
          result={stage.result}
          onAgain={() => {
            setStage({ kind: 'prepare' })
            setStep(3)
          }}
        />
      )}

      {stage.kind === 'prepare' && (
        <div className="flex flex-col gap-6">
          <ol className="flex flex-col gap-3" aria-label="Import steps">
            <Step no={1} active={step === 1} title="Get the template" onOpen={() => setStep(1)}>
              <TemplateStep announce={setMessage} />
            </Step>
            <Step
              no={2}
              active={step === 2}
              title="Make your CSV with AI"
              onOpen={() => setStep(2)}
            >
              <AiStep announce={setMessage} />
            </Step>
            <Step no={3} active={step === 3} title="Upload and review" onOpen={() => setStep(3)}>
              <UploadStep
                announce={setMessage}
                onShowTemplate={() => setStep(1)}
                onParsed={(input) => setStage({ kind: 'review', input })}
              />
            </Step>
          </ol>
          <RecentImports />
        </div>
      )}
    </Page>
  )
}
