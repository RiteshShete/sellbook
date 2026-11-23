/**
 * Every customer-facing string goes through t() from day one. English now; Marathi arrives later as a second
 * dictionary (the wording needs the owner's review). `{name}` placeholders are filled from the second argument.
 */
const en = {
  'shop.back': 'Back to the shop',
  'login.title': 'Sign in',
  'login.id': 'Mobile number or email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.noAccount': 'New here? Create an account',
  'login.forgot': 'Forgot password?',
  'login.idError': 'Enter a valid mobile number or email',
  'login.passwordError': 'Enter your password',
  'signup.title': 'Create your account',
  'signup.intro': 'Order from {shop} and follow your orders. We use your name and number only to fulfil your orders.',
  'signup.name': 'Your name',
  'signup.nameError': 'Enter your name',
  'signup.phone': 'Mobile number',
  'signup.phoneError': 'Enter a valid 10-digit mobile number',
  'signup.password': 'Password (at least 8 characters)',
  'signup.consent':
    'We share your name, number and address with this shop to fulfil your order. I agree to the Terms and the Privacy policy.',
  'signup.consentError': 'Please agree to continue',
  'signup.submit': 'Create account',
  'signup.submitting': 'Creating…',
  'signup.haveAccount': 'Already have an account? Sign in',
  'signup.finishTitle': 'Finish your details',
  'signup.finishIntro': 'Your account is ready. The shop needs your name and mobile number to deliver your order.',
  'signup.finishSubmit': 'Save and continue',
  'forgot.title': 'Forgot password',
  'account.title': 'Your account',
  'account.name': 'Name',
  'account.phone': 'Mobile number',
  'account.signOut': 'Sign out',
  'account.signingOut': 'Signing out…',
  'account.delete': 'Delete my account and data',
  'account.deleteTitle': 'Delete your account?',
  'account.deleteBody':
    'We will remove your account and saved addresses. The shop keeps its order records (your name and number on past orders) for its books.',
  'account.deleteConfirm': 'Send the request',
  'account.deleteDone': 'Request received. We will remove your account.',
  'account.cancel': 'Cancel',
  'terms.link': 'Terms',
  'privacy.link': 'Privacy policy',
} as const

export type StringKey = keyof typeof en

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}
