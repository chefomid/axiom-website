import { useCallback, useState } from 'react'
import usePropertyEnrichment from '../../hooks/usePropertyEnrichment'
import PropertyDossier from './PropertyDossier'
import PropertyHeader from './PropertyHeader'
import PropertyMap from './PropertyMap'
import PropertySearchBar from './PropertySearchBar'

export default function PropertyIntelligenceView() {
  const [address, setAddress] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const { record, loading, error, apiOnline, enrich, clear } = usePropertyEnrichment()

  const handleSubmit = useCallback(async () => {
    if (!address.trim()) return
    try {
      await enrich({ address, sourceUrl })
    } catch {
      /* error surfaced in hook */
    }
  }, [address, sourceUrl, enrich])

  const handleClear = useCallback(() => {
    setAddress('')
    setSourceUrl('')
    clear()
  }, [clear])

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-ink-primary">
      <PropertyHeader apiOnline={apiOnline} enrichStatus={record?.status} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-r border-panel-border bg-panel-bg lg:w-[360px] xl:w-[400px]">
          <PropertySearchBar
            address={address}
            sourceUrl={sourceUrl}
            loading={loading}
            onAddressChange={setAddress}
            onSourceUrlChange={setSourceUrl}
            onSubmit={handleSubmit}
            onClear={handleClear}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <PropertyDossier record={record} error={error} loading={loading} apiOnline={apiOnline} />
          </div>
        </aside>

        <main className="relative min-h-0 min-w-0 flex-1">
          <PropertyMap
            lat={record?.lat ?? null}
            lng={record?.lng ?? null}
            label={record?.display_name}
          />
        </main>
      </div>
    </div>
  )
}
