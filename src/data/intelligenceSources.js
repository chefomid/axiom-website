export const INTELLIGENCE_SOURCE_GROUPS = [
  {
    id: 'vendors',
    label: 'Licensed property APIs',
    intro:
      'Carrier-trusted vendors supply normalized building attributes, ownership, and valuation fields used in underwriting workflows.',
    sources: [
      {
        id: 'attom',
        chipLabel: 'ATTOM',
        name: 'ATTOM Data',
        summary:
          'Insurance-grade property characteristics: construction type, roof, stories, lot size, ownership, and peril scores normalized for underwriting.',
        credibility:
          'Used by carriers and MGAs for defensible COPE snapshots. AXIOM maps ATTOM fields into Construction, Occupancy, and Exposure sections.',
        website: 'https://www.attomdata.com',
      },
      {
        id: 'melissa',
        chipLabel: 'Melissa',
        name: 'Melissa',
        summary:
          'Assessor-aligned property records covering owner, mortgage, valuation, and parcel identifiers across 140M+ US properties.',
        credibility:
          'Strong for occupancy and ownership verification when assessor roll alignment matters. Complements vendor-grade construction feeds.',
        website: 'https://www.melissa.com',
      },
      {
        id: 'rentcast',
        chipLabel: 'RentCast',
        name: 'RentCast',
        summary:
          'Fast residential profile: square footage, year built, beds and baths, property type, and recent sale history.',
        credibility:
          'Affordable enrichment for triage and comparison before escalating to insurance-grade sources. Ideal for quick COPE baselines.',
        website: 'https://www.rentcast.io',
      },
      {
        id: 'firststreet',
        chipLabel: 'First Street',
        name: 'First Street Foundation',
        summary:
          'Property-level climate peril scores for flood, wildfire, and extreme heat, widely referenced by insurers and lenders.',
        credibility:
          'Adds forward-looking exposure context beyond static flood zones. Scores are property-specific, not county averages.',
        website: 'https://firststreet.org',
      },
    ],
  },
  {
    id: 'government',
    label: 'Government hazard feeds',
    intro:
      'Live public peril data from US agencies. AXIOM pulls authoritative feeds at the property pin, not regional approximations.',
    sources: [
      {
        id: 'fema',
        chipLabel: 'FEMA',
        name: 'FEMA',
        summary:
          'National Flood Hazard Layer (NFHL) flood zone and Special Flood Hazard Area status at the property location.',
        credibility:
          'The standard reference for SFHA determination in US underwriting. Updated as FEMA revises NFHL boundaries and studies.',
        website: 'https://www.fema.gov/flood-maps',
      },
      {
        id: 'usgs',
        chipLabel: 'USGS',
        name: 'USGS',
        summary:
          'Recent earthquake activity within roughly 100 km of the property, including magnitude, depth, and distance.',
        credibility:
          'Direct from the US Geological Survey earthquake catalog. Useful for seismic exposure context and portfolio scanning.',
        website: 'https://www.usgs.gov/programs/earthquake-hazards',
      },
      {
        id: 'nws',
        chipLabel: 'NWS',
        name: 'National Weather Service',
        summary:
          'Active weather alerts at the property, including severe storms, flood watches, heat advisories, and winter hazards.',
        credibility:
          'Official NWS alert polygons geofenced to the pin. Timely situational awareness for Exposure and live hazard review.',
        website: 'https://www.weather.gov',
      },
      {
        id: 'epa',
        chipLabel: 'EPA',
        name: 'EPA',
        summary:
          'Nearby EPA-regulated facilities from ECHO, surfacing environmental compliance and proximity signals.',
        credibility:
          'Public enforcement and compliance data for situational environmental context. Supplementary to, not a substitute for, Phase I findings.',
        website: 'https://www.epa.gov/echo',
      },
    ],
  },
]

export const INTELLIGENCE_SOURCE_CHIP_LABELS = INTELLIGENCE_SOURCE_GROUPS.flatMap(group =>
  group.sources.map(source => source.chipLabel),
)
