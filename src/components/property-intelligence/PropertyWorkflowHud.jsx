import { useCallback, useEffect, useRef, useState } from 'react'

import PropertySearchBar from './PropertySearchBar'
import IntentPackagePicker from './IntentPackagePicker'
import SourceCatalogPanel from './SourceCatalogPanel'
import PublicSourcePanel from './PublicSourcePanel'
import WorkflowGenerateButton from './WorkflowGenerateButton'
import IntelligencePanelContent from './IntelligencePanelContent'
import {
  WORKFLOW_CTL,
  WORKFLOW_CTL_NEUTRAL,
  WORKFLOW_HUD_WIDTH_DOCKED,
} from './workflowControls'

function CollapseIcon({ collapsed }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
      {collapsed ? (
        <path
          d="m8 5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m12 5-5 5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export default function PropertyWorkflowHud({
  locationLocked,
  locationPhase,
  address,
  loadingReport,
  locationError,
  locateSuccess,
  onAddressChange,
  onAddressSelect,
  onMyLocation,
  onClear,
  onSearchingChange,
  presets,
  catalog,
  activePresetId,
  selectedSources,
  quote,
  loadingQuote,
  onToggleSource,
  onApply,
  onToggleCatalogSource,
  disabled,
  apiOnline,
  requiredUrlIds = [],
  sourceUrls,
  onSourceUrlsChange,
  onPaymentRequired,
  onGenerate,
  generateDisabled,
  generateBlockReason,
  hasReport,
  enrichStatus,
  billingNotice,
  onDismissBillingNotice,
  presetNotice,
  onDismissPresetNotice,
  quoteSynced,
  displayQuote,
  quoteError,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [sourcesTab, setSourcesTab] = useState('sources')
  const sourcesRef = useRef(null)

  useEffect(() => {
    if (!sourcesOpen) return undefined
    const onPointerDown = e => {
      if (sourcesRef.current?.contains(e.target)) return
      setSourcesOpen(false)
    }
    const onKey = e => {
      if (e.key === 'Escape') setSourcesOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('keydown', onKey)
    }
  }, [sourcesOpen])

  const togglePanelCollapsed = useCallback(() => {
    setPanelCollapsed(v => !v)
    setSourcesOpen(false)
  }, [])

  useEffect(() => {
    if (panelCollapsed || sourcesOpen) return undefined
    const onKey = e => {
      if (e.key === 'Escape') setPanelCollapsed(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelCollapsed, sourcesOpen])

  const sourceCount = selectedSources?.length ?? 0
  const hasPublicUrls = requiredUrlIds.length > 0

  return (
    <aside
      className={`workflow-sidebar side-panel side-panel--compact side-panel--fill sleek-scrollbar shrink-0 ${panelCollapsed ? 'workflow-sidebar--collapsed' : ''} ${sourcesOpen ? 'workflow-sidebar--sources-open' : ''}`}
      style={panelCollapsed ? undefined : { width: WORKFLOW_HUD_WIDTH_DOCKED }}
    >
      {panelCollapsed ? (
        <button
          type="button"
          onClick={togglePanelCollapsed}
          className="workflow-sidebar__rail"
          aria-expanded={false}
          aria-label="Open workflow panel"
          title="Open workflow panel"
        >
          <CollapseIcon collapsed />
        </button>
      ) : (
        <>
          <header ref={sourcesRef} className="workflow-sidebar__toolbar">
            <div className="workflow-sidebar__toolbar-row">
              <button
                type="button"
                onClick={togglePanelCollapsed}
                className={`${WORKFLOW_CTL} ${WORKFLOW_CTL_NEUTRAL}`}
                aria-expanded
                aria-label="Collapse panel"
                title="Collapse panel"
              >
                <CollapseIcon collapsed={false} />
              </button>

              {locationLocked ? (
                <button
                  type="button"
                  onClick={() => setSourcesOpen(v => !v)}
                  className={`${WORKFLOW_CTL} ml-auto ${
                    sourcesOpen
                      ? 'border-command-watch/50 bg-command-watch/10 text-command-watch'
                      : WORKFLOW_CTL_NEUTRAL
                  }`}
                  aria-expanded={sourcesOpen}
                >
                  Sources
                  <span className="tabular-nums text-ink-faint">{sourceCount}</span>
                </button>
              ) : null}
            </div>

            {locationLocked && sourcesOpen ? (
              <div className="workflow-sidebar__sources-popover">
                {hasPublicUrls ? (
                  <div className="flex shrink-0 gap-1 border-b border-panel-border/70 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setSourcesTab('sources')}
                      className={`rounded px-2 py-1 font-mono text-[8px] uppercase tracking-wider ${
                        sourcesTab === 'sources'
                          ? 'bg-command-watch/10 text-command-watch'
                          : 'text-ink-faint hover:text-ink-secondary'
                      }`}
                    >
                      Catalog
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourcesTab('urls')}
                      className={`rounded px-2 py-1 font-mono text-[8px] uppercase tracking-wider ${
                        sourcesTab === 'urls'
                          ? 'bg-command-live/10 text-command-live'
                          : 'text-ink-faint hover:text-ink-secondary'
                      }`}
                    >
                      Public URLs
                    </button>
                  </div>
                ) : null}
                <div className="workflow-sidebar__sources-popover-body">
                  {sourcesTab === 'urls' && hasPublicUrls ? (
                    <PublicSourcePanel
                      catalog={catalog}
                      selectedSources={selectedSources}
                      address={address}
                      locationLocked={locationLocked}
                      apiOnline={apiOnline}
                      disabled={disabled}
                      sourceUrls={sourceUrls}
                      onSourceUrlsChange={onSourceUrlsChange}
                      onPaymentRequired={onPaymentRequired}
                      variant="hud"
                    />
                  ) : (
                    <SourceCatalogPanel
                      variant="popover"
                      catalog={catalog}
                      selectedSources={selectedSources}
                      onToggle={onToggleCatalogSource}
                      disabled={disabled}
                      quote={quote}
                      activePresetId={activePresetId}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </header>

          <div className="side-panel-content workflow-sidebar__body sleek-scrollbar flex min-h-0 flex-1 flex-col">
            {billingNotice ? (
              <div className="side-panel-section shrink-0 px-0 pt-0">
                <div className="shrink-0 rounded border border-command-stable/30 bg-command-stable/10 px-3 py-2">
                  <p className="font-mono text-[9px] leading-snug text-command-stable">{billingNotice}</p>
                  <button
                    type="button"
                    onClick={onDismissBillingNotice}
                    className="mt-1 font-mono text-[8px] uppercase tracking-wider text-ink-faint hover:text-ink-secondary"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            {presetNotice ? (
              <div className="side-panel-section shrink-0 px-0">
                <div className="shrink-0 rounded border border-command-watch/30 bg-command-watch/10 px-3 py-2">
                  <p className="font-mono text-[9px] leading-snug text-command-watch">{presetNotice}</p>
                  <button
                    type="button"
                    onClick={onDismissPresetNotice}
                    className="mt-1 font-mono text-[8px] uppercase tracking-wider text-ink-faint hover:text-ink-secondary"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            <section className="side-panel-section shrink-0 border-b-0 pb-2" aria-label="Property location">
              <h2 className="side-panel-title">Property Input</h2>
              {!locationLocked ? (
                <p className="side-panel-copy mb-2">
                  Enter an address or use your location. The map unlocks once the property is locked.
                </p>
              ) : null}

              <PropertySearchBar
                address={address}
                loading={loadingReport}
                locationPhase={locationPhase}
                locationError={locationError}
                locateSuccess={locateSuccess}
                onAddressChange={onAddressChange}
                onAddressSelect={onAddressSelect}
                onMyLocation={onMyLocation}
                onClear={onClear}
                onSearchingChange={onSearchingChange}
                compact
              />
            </section>

            {locationLocked ? (
              <section className="side-panel-section shrink-0 border-b-0 pb-2" aria-label="Data package">
                <h2 className="side-panel-title">Data Package</h2>
                <IntentPackagePicker
                  layout="sidebar"
                  presets={presets}
                  catalog={catalog}
                  activePresetId={activePresetId}
                  selectedSources={selectedSources}
                  quote={quote}
                  loadingQuote={loadingQuote}
                  onToggleSource={onToggleSource}
                  onApply={onApply}
                  disabled={disabled}
                  locationLocked={locationLocked}
                />
              </section>
            ) : null}

            <IntelligencePanelContent
              locationPhase={locationPhase}
              locationLocked={locationLocked}
              apiOnline={apiOnline}
              loadingReport={loadingReport}
              hasReport={hasReport}
            />
          </div>

          <footer className="side-panel-footer workflow-sidebar__footer">
            <WorkflowGenerateButton
              quote={quoteSynced ? displayQuote : quote}
              loading={loadingQuote}
              onGenerate={onGenerate}
              generateDisabled={generateDisabled || !locationLocked}
              loadingReport={loadingReport}
              address={address}
              selectedCount={sourceCount}
              locationLocked={locationLocked}
              apiOnline={apiOnline}
              hasReport={hasReport}
              generateBlockReason={generateBlockReason}
              enrichStatus={enrichStatus}
              fullWidth
              variant="intelligence"
            />
            <button
              type="button"
              onClick={() => {
                if (!locationLocked) return
                setSourcesOpen(true)
              }}
              disabled={!locationLocked}
              className="side-panel-secondary"
            >
              Review Data Sources
            </button>
          </footer>
        </>
      )}
    </aside>
  )
}
