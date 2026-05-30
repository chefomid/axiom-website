import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppErrorBoundary from './components/AppErrorBoundary'
import Home from './pages/Home'
import BetterWorld from './pages/BetterWorld'
import PublicDataCommand from './pages/PublicDataCommand'
import PropertyIntelligence from './pages/PropertyIntelligence'
import {
  LEGACY_IMPACT_MAP_PATH,
  PROPERTY_INTELLIGENCE_PATH,
  PUBLIC_DATA_COMMAND_PATH,
} from './constants/routes'

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/a-better-world" element={<BetterWorld />} />
          <Route path={PUBLIC_DATA_COMMAND_PATH} element={<PublicDataCommand />} />
          <Route path={PROPERTY_INTELLIGENCE_PATH} element={<PropertyIntelligence />} />
          <Route
            path={LEGACY_IMPACT_MAP_PATH}
            element={<Navigate to={PUBLIC_DATA_COMMAND_PATH} replace />}
          />
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
