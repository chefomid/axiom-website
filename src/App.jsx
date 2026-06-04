import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import AppErrorBoundary from './components/AppErrorBoundary'
import Home from './pages/Home'
import BetterWorld from './pages/BetterWorld'
import PublicDataCommand from './pages/PublicDataCommand'
import PropertyIntelligence from './pages/PropertyIntelligence'
import ReportPrint from './pages/ReportPrint'
import {
  LEGACY_IMPACT_MAP_PATH,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_PATH,
  REPORT_PRINT_PATH,
} from './constants/routes'

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/a-better-world', element: <BetterWorld /> },
  { path: PUBLIC_DATA_COMMAND_PATH, element: <PublicDataCommand /> },
  { path: PROPERTY_INTELLIGENCE_PATH, element: <PropertyIntelligence /> },
  { path: REPORT_PRINT_PATH, element: <ReportPrint /> },
  {
    path: LEGACY_IMPACT_MAP_PATH,
    element: <Navigate to={PUBLIC_DATA_COMMAND_PATH} replace />,
  },
])

export default function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  )
}
