import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category, Product } from '../../catalog/schemas'
import { category, product, variant } from '../fixtures'
import { parseImportText } from '../parseImport'
import { ReviewScreen } from './ReviewScreen'

const state: {
  products: { data?: Product[]; isError: boolean; isPending: boolean }
  categories: { data?: { available: boolean; categories: Category[] }; isError: boolean }
  online: boolean
} = {
  products: { data: [], isError: false, isPending: false },
  categories: { data: { available: true, categories: [] }, isError: false },
  online: true,
}
const mutate = vi.fn()

vi.mock('../../catalog/hooks/useCatalog', () => ({
  useProducts: () => ({ ...state.products, error: null, refetch: vi.fn() }),
  useCategories: () => ({ ...state.categories, error: null, refetch: vi.fn() }),
}))
vi.mock('../hooks/useImport', () => ({ useApplyImport: () => ({ mutate, isPending: false }) }))
vi.mock('../files', async (orig) => ({
  ...(await orig<typeof import('../files')>()),
  useOnline: () => state.online,
}))

function rowsOf(csv: string) {
  const out = parseImportText(csv)
  if (!out.ok) throw new Error(out.message)
  return out.rows
}

const props = (csv: string, extra = {}) => ({
  rows: rowsOf(csv),
  fileWarnings: [],
  fileName: 'menu.csv',
  looksLikeExample: false,
  onBack: vi.fn(),
  onDone: vi.fn(),
  announce: vi.fn(),
  ...extra,
})

beforeEach(() => {
  state.products = { data: [], isError: false, isPending: false }
  state.categories = { data: { available: true, categories: [] }, isError: false }
  state.online = true
  mutate.mockClear()
})
afterEach(cleanup)

describe('ReviewScreen', () => {
  it('focuses the review heading and shows summary chips and product cards', () => {
    render(<ReviewScreen {...props('product_name,category,price\nPoha,Breakfast,60\n')} />)
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Review before saving' }),
    )
    expect(screen.getByLabelText('Import summary').textContent).toContain('1 products to create')
    expect(screen.getByRole('heading', { name: 'Poha' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import 1 product (1 variant)' })).toBeTruthy()
  })

  it('shows every status with an icon and text, plus Check for flagged rows', () => {
    state.products.data = [product('Rice', [variant({ name: 'Variant 1', price: 100 })])]
    render(<ReviewScreen {...props('product_name,price,notes\nPoha,60,CHECK\nRice,1,\n,5,\n')} />)
    for (const text of ['New', 'Already exists', 'Error', 'Check']) {
      expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0)
    }
  })

  it('blocks import while rows have errors until the owner ticks the skip box', () => {
    render(<ReviewScreen {...props('product_name,price\nPoha,60\n,5\nRice,x\n')} />)
    const button = screen.getByRole('button', { name: /^Import 1 product/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Tick "Skip the 2 rows with errors"/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Skip the 2 rows with errors'))
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('offline: saving is disabled with a clear reason', () => {
    state.online = false
    render(<ReviewScreen {...props('product_name,price\nPoha,60\n')} />)
    expect(
      (screen.getByRole('button', { name: /^Import 1 product/ }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText(/You are offline/)).toBeTruthy()
  })

  it('nothing to import when everything already exists', () => {
    state.products.data = [product('Poha', [variant({ name: 'Variant 1', price: 6000 })])]
    render(<ReviewScreen {...props('product_name,price\nPoha,60\n')} />)
    expect(
      (screen.getByRole('button', { name: /^Import 0 products/ }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText(/everything in this file already exists/)).toBeTruthy()
  })

  it('warns when the file looks like the example', () => {
    render(<ReviewScreen {...props('product_name,price\nPoha,60\n', { looksLikeExample: true })} />)
    expect(screen.getByRole('alert').textContent).toContain('This looks like the example file')
  })

  it('update mode lists the price changes before saving', () => {
    state.products.data = [product('Poha', [variant({ name: 'Variant 1', price: 5000 })])]
    render(<ReviewScreen {...props('product_name,price\nPoha,60\n')} />)
    fireEvent.click(screen.getByLabelText(/Add and update prices/))
    expect(screen.getByText('Price ₹50 → ₹60')).toBeTruthy()
    expect(screen.getByRole('button', { name: /update 1 price/ })).toBeTruthy()
  })

  it('tells the owner when the catalog changes under an open review', () => {
    const { rerender } = render(<ReviewScreen {...props('product_name,price\nPoha,60\n')} />)
    expect(screen.queryByText(/catalog changed while you were reviewing/)).toBeNull()
    state.products.data = [product('Poha', [variant({ name: 'Variant 1', price: 6000 })])]
    rerender(<ReviewScreen {...props('product_name,price\nPoha,60\n')} />)
    expect(screen.getByText(/catalog changed while you were reviewing/)).toBeTruthy()
    expect(screen.getByText(/The catalog changed\. Check the plan/)).toBeTruthy()
  })

  it('shows an error state with retry when the catalog cannot load', () => {
    state.products = { isError: true, isPending: false }
    render(<ReviewScreen {...props('product_name,price\nPoha,60\n')} />)
    expect(screen.getByRole('button', { name: /retry|try again/i })).toBeTruthy()
  })

  it('two categories in the data: a new product uses the existing one', () => {
    state.categories.data = { available: true, categories: [category('Breakfast')] }
    render(<ReviewScreen {...props('product_name,category,price\nPoha,breakfast,60\n')} />)
    expect(screen.queryByText('New category')).toBeNull()
    expect(screen.getByText('Breakfast')).toBeTruthy()
  })
})
