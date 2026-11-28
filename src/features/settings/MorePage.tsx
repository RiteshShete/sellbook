import { Page } from '../../app/Page'
import { AccountFooter, MoreLinks } from './MoreLinks'

/** The full account list as a page: it is where the profile menu's links also live for deep links and a locked plan. */
export function MorePage() {
  return (
    <Page title="More">
      <MoreLinks />
      <AccountFooter />
    </Page>
  )
}
