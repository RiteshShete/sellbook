import { useParams } from 'react-router-dom'
import { ForgotCodeFlow } from '../../auth/ForgotCodeFlow'
import { StoreShell } from '../StorefrontLayout'
import { t } from '../i18n'
import { storefrontPath } from '../paths'

export function StoreForgotPage() {
  const { slug = '' } = useParams()
  return (
    <StoreShell title={t('forgot.title')}>
      <ForgotCodeFlow doneTo={storefrontPath(slug, 'account')} />
    </StoreShell>
  )
}
