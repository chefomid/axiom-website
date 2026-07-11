import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import AppErrorBoundary from './components/AppErrorBoundary'
import RouteErrorFallback from './components/RouteErrorFallback'
import RootLayout from './components/RootLayout'
import Home from './pages/Home'
import PublicDataCommand from './pages/PublicDataCommand'
import EarthquakeAnalysis from './pages/EarthquakeAnalysis'
import PropertyIntelligence from './pages/PropertyIntelligence'
import ReportPrint from './pages/ReportPrint'
import PrivacyPolicy from './pages/PrivacyPolicy'
import CookiePolicy from './pages/CookiePolicy'
import Careers from './pages/Careers'
import CareersAdmin from './pages/CareersAdmin'
import BetterWorld from './pages/BetterWorld'
import {
  CAREERS_ADMIN_PATH,
  CAREERS_PATH,
  COOKIE_POLICY_PATH,
  EARTHQUAKE_ANALYSIS_PATH,
  LEGACY_BETTER_WORLD_PATH,
  LEGACY_IMPACT_MAP_PATH,
  MISSION_PATH,
  PRIVACY_POLICY_PATH,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_PATH,
  REPORT_PRINT_PATH,
} from './constants/routes'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: MISSION_PATH, element: <BetterWorld /> },
      { path: LEGACY_BETTER_WORLD_PATH, element: <Navigate to={MISSION_PATH} replace /> },
      { path: PUBLIC_DATA_COMMAND_PATH, element: <PublicDataCommand /> },
      { path: EARTHQUAKE_ANALYSIS_PATH, element: <EarthquakeAnalysis /> },
      {
        path: PROPERTY_INTELLIGENCE_PATH,
        element: <PropertyIntelligence />,
        errorElement: <RouteErrorFallback title="Property Intelligence unavailable" />,
      },
      { path: REPORT_PRINT_PATH, element: <ReportPrint /> },
      { path: CAREERS_PATH, element: <Careers /> },
      { path: CAREERS_ADMIN_PATH, element: <CareersAdmin /> },
      { path: PRIVACY_POLICY_PATH, element: <PrivacyPolicy /> },
      { path: COOKIE_POLICY_PATH, element: <CookiePolicy /> },
      {
        path: LEGACY_IMPACT_MAP_PATH,
        element: <Navigate to={PUBLIC_DATA_COMMAND_PATH} replace />,
      },
    ],
  },
])

export default function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  )
}
