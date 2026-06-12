import { Outlet } from 'react-router-dom'
import { ConsentProvider } from '../context/ConsentContext'
import CookieConsentManager from './cookie/CookieConsentManager'

export default function RootLayout() {
  return (
    <ConsentProvider>
      <Outlet />
      <CookieConsentManager />
    </ConsentProvider>
  )
}
