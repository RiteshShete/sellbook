import { Link, useParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { ProductForm } from './components/ProductForm'
import { useProduct } from './hooks/useCatalog'

/** /catalog/new (no param) or /catalog/:productId. */
export function ProductEditorPage() {
  const { productId } = useParams()
  const product = useProduct(productId)

  if (productId === undefined) return <ProductForm />

  if (product.isPending) {
    return (
      <Page title="Edit product" back="/catalog">
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Page>
    )
  }
  if (product.isError) {
    return (
      <Page title="Edit product" back="/catalog">
        <ErrorState error={product.error} onRetry={() => void product.refetch()} />
      </Page>
    )
  }
  if (product.data === null) {
    return (
      <Page title="Edit product" back="/catalog">
        <EmptyState
          title="Product not found"
          description="It may have been moved to Trash."
          action={
            <Link to="/catalog" className="font-medium underline underline-offset-4">
              Back to Catalog
            </Link>
          }
        />
      </Page>
    )
  }
  // key: remount with fresh draft if a different product loads.
  return <ProductForm key={product.data.id} product={product.data} />
}
