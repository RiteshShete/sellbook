import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_INSTRUCTIONS } from './importSchema'
import { ConfigurePage } from './ConfigurePage'

vi.mock('./hooks/useImport', () => ({
  useImportBatches: () => ({ data: [], isError: false }),
  useUndoImport: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }),
  useApplyImport: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../catalog/hooks/useCatalog', () => ({
  useProducts: () => ({ data: [], isError: false, error: null, refetch: vi.fn() }),
  useCategories: () => ({
    data: { available: true, categories: [] },
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

afterEach(cleanup)

const open = () =>
  render(
    <MemoryRouter>
      <ConfigurePage />
    </MemoryRouter>,
  )

describe('ConfigurePage', () => {
  it('shows three steps; the active one has aria-current="step"', () => {
    open()
    const steps = screen
      .getAllByRole('listitem')
      .filter((li) => li.hasAttribute('aria-current') || li.querySelector('h2'))
    expect(steps).toHaveLength(3)
    expect(steps[0]?.getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('button', { name: /Download template/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Download example/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copy template text/ })).toBeTruthy()
    expect(screen.getByText('What each column means')).toBeTruthy()
  })

  it('step 2 has the AI instructions; step 3 has labelled tabs, file input and a paste box', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /Make your CSV with AI/ }))
    expect(screen.getByRole('button', { name: /Copy instructions for AI/ })).toBeTruthy()
    expect(screen.getByText(AI_INSTRUCTIONS)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Upload and review/ }))
    expect(screen.getByRole('tab', { name: 'Upload file' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.getByLabelText(/CSV file/).getAttribute('accept')).toBe('.csv,.txt,text/*')
    fireEvent.click(screen.getByRole('tab', { name: 'Paste CSV text' }))
    expect(screen.getByLabelText('Paste the CSV the AI gave you')).toBeTruthy()
  })

  it('pasting a valid CSV opens the review with focus on its heading; a bad one explains itself', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /Upload and review/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Paste CSV text' }))
    const box = screen.getByLabelText('Paste the CSV the AI gave you')
    fireEvent.change(box, { target: { value: 'product_name,category\nPoha,Tea\n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check pasted text' }))
    expect(screen.getByRole('alert').textContent).toContain('price')
    fireEvent.change(box, { target: { value: 'product_name,price\nPoha,60\n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check pasted text' }))
    const heading = screen.getByRole('heading', { name: 'Review before saving' })
    expect(document.activeElement).toBe(heading)
    expect(screen.getByRole('status').textContent).toContain('Read 1 rows')
  })
})
