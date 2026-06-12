/**
 * Simplified polylines for major US fault systems.
 * Coordinates are [longitude, latitude], approximate segment traces for nearest-fault labeling.
 *
 * referenceUrl values point to live USGS fault / earthquake science pages (verified 2026).
 */
export const USGS_FAULTS_HUB_URL = 'https://www.usgs.gov/programs/earthquake-hazards/faults'
export const USGS_INTERACTIVE_FAULT_MAP_URL = 'https://www.usgs.gov/tools/interactive-us-fault-map'

export const US_NAMED_FAULTS = [
  {
    id: 'san-andreas',
    name: 'San Andreas Fault',
    region: 'California',
    referenceUrl:
      'https://www.usgs.gov/programs/earthquake-hazards/science/back-future-san-andreas-fault',
    referenceSource: 'USGS Earthquake Hazards',
    coordinates: [
      [-117.5, 33.5],
      [-116.8, 34.2],
      [-116.2, 35.0],
      [-120.0, 35.5],
      [-121.0, 36.5],
      [-121.5, 37.5],
      [-122.0, 38.0],
      [-122.5, 38.5],
      [-123.0, 39.5],
      [-123.5, 40.0],
    ],
  },
  {
    id: 'hayward',
    name: 'Hayward Fault',
    region: 'San Francisco Bay Area',
    referenceUrl:
      'https://www.usgs.gov/news/featured-story/hayward-fault-it-due-a-repeat-powerful-1868-earthquake',
    referenceSource: 'USGS Earthquake Hazards',
    coordinates: [
      [-122.45, 37.45],
      [-122.15, 37.55],
      [-122.05, 37.65],
      [-121.95, 37.75],
      [-121.85, 37.85],
      [-121.75, 37.95],
    ],
  },
  {
    id: 'cascadia',
    name: 'Cascadia Subduction Zone',
    region: 'Pacific Northwest',
    referenceUrl:
      'https://www.usgs.gov/programs/earthquake-hazards/science/pacific-northwest-hazards',
    referenceSource: 'USGS Earthquake Hazards',
    coordinates: [
      [-125.0, 48.5],
      [-125.5, 47.5],
      [-126.0, 46.5],
      [-126.5, 45.0],
      [-127.0, 44.0],
      [-127.5, 43.0],
      [-128.0, 42.0],
      [-128.5, 41.0],
    ],
  },
  {
    id: 'new-madrid',
    name: 'New Madrid Seismic Zone',
    region: 'Midwest',
    referenceUrl:
      'https://www.usgs.gov/natural-hazards/earthquake-hazards/science/new-madrid-seismic-zone',
    referenceSource: 'USGS Earthquake Hazards',
    coordinates: [
      [-89.5, 36.0],
      [-89.3, 36.3],
      [-89.1, 36.5],
      [-89.0, 36.7],
      [-89.2, 36.9],
      [-89.4, 37.0],
    ],
  },
  {
    id: 'wasatch',
    name: 'Wasatch Fault',
    region: 'Utah',
    referenceUrl:
      'https://www.usgs.gov/programs/earthquake-hazards/science/how-big-and-how-frequent-are-earthquakes-wasatch-fault',
    referenceSource: 'USGS Earthquake Hazards',
    coordinates: [
      [-112.0, 40.5],
      [-111.8, 40.7],
      [-111.7, 40.9],
      [-111.6, 41.1],
      [-111.5, 41.3],
      [-111.4, 41.5],
    ],
  },
  {
    id: 'denali',
    name: 'Denali Fault',
    region: 'Alaska',
    referenceUrl: 'https://pubs.usgs.gov/fs/2003/fs014-03/',
    referenceSource: 'USGS Fact Sheet',
    coordinates: [
      [-150.0, 63.0],
      [-149.5, 62.5],
      [-149.0, 62.0],
      [-148.5, 61.5],
      [-148.0, 61.0],
      [-147.5, 60.5],
      [-147.0, 60.0],
    ],
  },
  {
    id: 'ramapo',
    name: 'Ramapo Fault',
    region: 'Northeast US',
    referenceUrl: 'https://pubs.usgs.gov/publication/i1401',
    referenceSource: 'USGS Publications',
    coordinates: [
      [-74.5, 40.5],
      [-74.6, 40.8],
      [-74.7, 41.0],
      [-74.8, 41.2],
      [-74.9, 41.4],
    ],
  },
  {
    id: 'puente-hills',
    name: 'Puente Hills Fault',
    region: 'Los Angeles Basin',
    referenceUrl: 'https://pubs.usgs.gov/publication/70023887',
    referenceSource: 'USGS Publications',
    coordinates: [
      [-118.2, 33.9],
      [-118.0, 34.0],
      [-117.9, 34.05],
      [-117.8, 34.1],
      [-117.7, 34.05],
    ],
  },
  {
    id: 'garlock',
    name: 'Garlock Fault',
    region: 'Southern California',
    referenceUrl: 'https://pubs.usgs.gov/publication/70025494',
    referenceSource: 'USGS Publications',
    coordinates: [
      [-119.0, 35.3],
      [-118.0, 35.2],
      [-117.5, 35.15],
      [-117.0, 35.1],
      [-116.5, 35.05],
    ],
  },
  {
    id: 'alaska-aleutian',
    name: 'Aleutian Subduction Zone',
    region: 'Alaska',
    referenceUrl:
      'https://www.usgs.gov/centers/alaska-science-center/science/alaska-aleutian-subduction-zone-studies',
    referenceSource: 'USGS Alaska Science Center',
    coordinates: [
      [-170.0, 52.0],
      [-168.0, 53.0],
      [-166.0, 54.0],
      [-164.0, 55.0],
      [-162.0, 56.0],
      [-160.0, 57.0],
    ],
  },
]

export const CONUS_BBOX = {
  west: -125,
  east: -66,
  south: 24,
  north: 50,
}

export function isInConus(lat, lng) {
  return (
    lat >= CONUS_BBOX.south &&
    lat <= CONUS_BBOX.north &&
    lng >= CONUS_BBOX.west &&
    lng <= CONUS_BBOX.east
  )
}
