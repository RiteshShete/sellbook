import { Page } from '../../app/Page'
import { ErrorState, Skeleton } from '../../components/ui'
import { AssetField } from './components/AssetField'
import { ShopDetailsForm } from './components/ShopDetailsForm'
import { useSettings } from './hooks/useSettings'

export function SettingsPage() {
  const settings = useSettings()

  return (
    <Page title="Settings">
      {settings.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <ShopDetailsForm settings={settings.data} />
          <AssetField
            kind="qr"
            label="Payment QR"
            hint="Printed on every bill as “Scan to pay”. Use a sharp, uncropped image."
            settings={settings.data}
          />
          <AssetField
            kind="logo"
            label="Shop logo (optional)"
            hint="Shown at the top of the bill."
            settings={settings.data}
          />
        </div>
      )}
    </Page>
  )
}
