import { useEffect, useState } from 'react'

import PropertySearchBar from './PropertySearchBar'

import IntentPackagePicker from './IntentPackagePicker'

import WorkflowGenerateButton from './WorkflowGenerateButton'

import IntelligencePanelContent from './IntelligencePanelContent'

import PublicSourcePanel from './PublicSourcePanel'

import BatchQuotePanel from './BatchQuotePanel'

import WorkflowPricingPanel from './WorkflowPricingPanel'

import { WORKFLOW_HUD_WIDTH_DOCKED } from './workflowControls'

import { PRESET_OPTIONAL_ADDONS } from '../../services/propertyApi'



export default function PropertyWorkflowHud({

  inputMode = 'single',

  onInputModeChange,

  scheduleReady = false,

  batchQuote,

  onOpenSchedule,

  onPreviewScheduleLocation,

  onFitAllScheduleOnMap,

  selectedScheduleRowIndex = null,

  scheduleMapReady = false,

  locationLocked,

  locationPhase,

  address,

  loadingReport,

  locationError,

  locateSuccess,

  geolocateCommitting = false,

  onAddressChange,

  onAddressSelect,

  onMyLocation,

  onClear,

  onSearchingChange,

  presets,

  catalog,

  loadingCatalog = false,

  activePresetId,

  selectedSources,

  quote,

  loadingQuote,

  onToggleSource,

  onApply,

  disabled,

  apiOnline,

  requiredUrlIds,

  sourceUrls,

  onSourceUrlsChange,

  billingEnabled = false,

  checkoutPreview = null,

  payLoading = false,

  onGenerate,

  generateDisabled,

  generateBlockReason,

  hasReport,

  hasBatchReport = false,

  enrichStatus,

  billingNotice,

  onDismissBillingNotice,

  presetNotice,

  onDismissPresetNotice,

  quoteSynced,

  displayQuote,

  quoteError,

  scheduleMode = false,

  scheduleRows = [],

}) {

  const sourceCount = selectedSources?.length ?? 0

  const readyForGenerate = scheduleMode ? scheduleReady : locationLocked && Boolean(activePresetId)

  const showPricing = Boolean(
    activePresetId &&
      selectedSources?.length &&
      (scheduleMode
        ? scheduleRows.length > 0 && (loadingBatchQuote || Boolean(batchQuote?.totals))
        : Boolean((quoteSynced ? displayQuote : quote)?.totals)),
  )

  const pricingQuote = scheduleMode ? { totals: batchQuote?.totals } : quoteSynced ? displayQuote : quote

  const hasLocationInput = scheduleMode ? scheduleRows.length > 0 : locationLocked

  const [packageExpanded, setPackageExpanded] = useState(false)

  useEffect(() => {
    setPackageExpanded(hasLocationInput)
  }, [hasLocationInput])

  const activePreset = presets?.find(preset => preset.id === activePresetId)

  const addonCount =
    selectedSources?.filter(sourceId => PRESET_OPTIONAL_ADDONS.includes(sourceId)).length ?? 0

  const packageSummary = !hasLocationInput
    ? scheduleMode
      ? 'Upload a schedule to choose a package'
      : 'Lock a location to choose a package'
    : activePreset
      ? `${activePreset.label}${addonCount ? ` · ${addonCount} add-on${addonCount === 1 ? '' : 's'}` : ''}`
      : 'Choose a package'

  return (

    <aside

      className="workflow-sidebar side-panel side-panel--compact side-panel--fill sleek-scrollbar shrink-0"

      style={{ width: WORKFLOW_HUD_WIDTH_DOCKED }}

    >

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



        <section
          className={`side-panel-section shrink-0 border-b-0 ${locationLocked && inputMode === 'single' ? 'pb-1' : 'pb-2'}`}
          aria-label="Property location"
        >

          <h2 className="side-panel-title">Property Input</h2>



          <div className="workflow-input-mode-bar mb-3 flex rounded border border-command-watch/20 bg-black/90 p-0.5">

            <button

              type="button"

              onClick={() => onInputModeChange?.('single')}

              className={`flex-1 rounded px-2 py-2 font-mono text-[9px] uppercase tracking-wider transition ${

                inputMode === 'single'

                  ? 'bg-command-watch/15 text-command-watch'

                  : 'text-ink-secondary hover:text-white'

              }`}

            >

              Enter location

            </button>

            <button

              type="button"

              onClick={() => onInputModeChange?.('schedule')}

              className={`flex-1 rounded px-2 py-2 font-mono text-[9px] uppercase tracking-wider transition ${

                inputMode === 'schedule'

                  ? 'bg-command-watch/15 text-command-watch'

                  : 'text-ink-secondary hover:text-white'

              }`}

            >

              Upload schedule

            </button>

          </div>



          {inputMode === 'single' ? (
            <div>
              {!locationLocked ? (
                <p className="side-panel-copy mb-2">
                  Enter an address or use your location. The map unlocks once the property is locked.
                </p>
              ) : null}

              <PropertySearchBar
                address={address}
                loading={loadingReport}
                locationLocked={locationLocked}
                locationPhase={locationPhase}
                locationError={locationError}
                locateSuccess={locateSuccess}
                geolocateCommitting={geolocateCommitting}
                onAddressChange={onAddressChange}
                onAddressSelect={onAddressSelect}
                onMyLocation={onMyLocation}
                onClear={onClear}
                onSearchingChange={onSearchingChange}
                compact
              />
            </div>
          ) : (
            <div>
              <p className="side-panel-copy mb-2">
                Upload up to 100 locations, then choose a package to validate and price the schedule.
              </p>

              <BatchQuotePanel
                batchQuote={batchQuote}
                scheduleRows={scheduleRows}
                loadingQuote={loadingQuote}
                onOpenSchedule={onOpenSchedule}
                onPreviewLocation={onPreviewScheduleLocation}
                onFitAllOnMap={onFitAllScheduleOnMap}
                selectedRowIndex={selectedScheduleRowIndex}
                scheduleMapReady={scheduleMapReady}
              />
            </div>
          )}

        </section>



        <section
          className={`side-panel-section shrink-0 border-b-0 pb-2 ${!hasLocationInput ? 'opacity-45' : ''}`}
          aria-label="Data package"
        >

          <button
            type="button"
            onClick={() => hasLocationInput && setPackageExpanded(expanded => !expanded)}
            disabled={!hasLocationInput}
            className="flex w-full items-start justify-between gap-2 text-left disabled:cursor-not-allowed"
            aria-expanded={packageExpanded}
          >
            <span>
              <span className="side-panel-title mb-0 block">Data Package</span>
              <p className="side-panel-copy mt-1.5">
                Pick a source stack for one run. Publicly Available covers government hazards and COPE
                map at no vendor cost; licensed tiers add property records and building attributes.
              </p>
              {!packageExpanded ? (
                <span
                  className={`mt-1 block font-mono text-[10px] leading-snug ${
                    hasLocationInput ? 'text-ink-secondary' : 'text-ink-faint'
                  }`}
                >
                  {packageSummary}
                </span>
              ) : null}
            </span>
            <span
              className={`mt-0.5 shrink-0 font-mono text-[11px] text-ink-faint transition-transform duration-150 ${
                packageExpanded ? 'rotate-180' : ''
              }`}
              aria-hidden
            >
              ▾
            </span>
          </button>

          {packageExpanded && hasLocationInput ? (
            <>
              {!readyForGenerate ? (
                <p className="side-panel-copy mb-2 mt-2">
                  {scheduleMode
                    ? 'Pick a package tier and validate your schedule. Pricing appears at the bottom.'
                    : 'Pick a package tier and any add-ons. Pricing appears at the bottom once you lock the property.'}
                </p>
              ) : null}

              <IntentPackagePicker
                layout="sidebar"
                presets={presets}
                catalog={catalog}
                loading={loadingCatalog}
                activePresetId={activePresetId}
                selectedSources={selectedSources}
                onToggleSource={onToggleSource}
                onApply={onApply}
                disabled={disabled}
                locationLocked={locationLocked}
                scheduleHasRows={scheduleMode && scheduleRows.length > 0}
                scheduleMode={scheduleMode}
              />
            </>
          ) : null}

        </section>



        {!scheduleMode && locationLocked && requiredUrlIds?.length > 0 ? (

          <section className="side-panel-section shrink-0 border-b-0 pb-2" aria-label="Public record sources">

            <PublicSourcePanel

              catalog={catalog}

              selectedSources={selectedSources}

              address={address}

              locationLocked={locationLocked}

              apiOnline={apiOnline}

              disabled={disabled}

              sourceUrls={sourceUrls}

              onSourceUrlsChange={onSourceUrlsChange}

              variant="sidebar"

            />

          </section>

        ) : null}



        <IntelligencePanelContent />

      </div>



      <footer className="side-panel-footer workflow-sidebar__footer">

        <WorkflowPricingPanel

          visible={showPricing}

          loading={loadingQuote}

          catalog={catalog}

          presets={presets}

          activePresetId={activePresetId}

          quote={pricingQuote}

          selectedSources={selectedSources}

          batchQuote={batchQuote}

          scheduleMode={scheduleMode}

          isFinal={hasReport || hasBatchReport}

        />

        <WorkflowGenerateButton

          quote={pricingQuote}

          loading={loadingQuote}

          onGenerate={onGenerate}

          billingEnabled={billingEnabled}

          checkoutPreview={checkoutPreview}

          payLoading={payLoading}

          generateDisabled={generateDisabled || !readyForGenerate}

          loadingReport={loadingReport}

          address={address}

          selectedCount={sourceCount}

          locationLocked={readyForGenerate}

          apiOnline={apiOnline}

          hasReport={hasReport || hasBatchReport}

          generateBlockReason={generateBlockReason}

          enrichStatus={enrichStatus}

          fullWidth

          variant="intelligence"

          scheduleMode={scheduleMode}

          hidePriceInLabel

        />

      </footer>

    </aside>

  )

}


