import "./style.css";
import { GardenScene } from "./components/Scene";
import { GeoConversion } from "./utils/GeoConversion";
import { CityJSONConverter, CityJSONFeatureCollection } from "./utils/CityJSONConverter";

// Default Amsterdam coordinates (fallback)
const DEFAULT_LATITUDE = 52.46755248644969;
const DEFAULT_LONGITUDE = 4.949130381009404;

// DOM Elements
const container = document.getElementById("canvas-container");
const dateDisplay = document.getElementById("date-display");
const timeDisplay = document.getElementById("time-display");
const minimapControl = document.getElementById("minimap-control");
const minimap = document.querySelector(".minimap");

if (!container || !dateDisplay || !timeDisplay || !minimapControl || !minimap) {
  throw new Error("Required DOM elements not found");
}

// Parse URL parameters for coordinates
function parseUrlCoordinates(): { lat: number; long: number } {
  const urlParams = new URLSearchParams(window.location.search);
  const lat = urlParams.get('lat');
  const long = urlParams.get('long');

  if (lat && long) {
    const latNum = parseFloat(lat);
    const longNum = parseFloat(long);

    // Validate coordinates
    if (!isNaN(latNum) && !isNaN(longNum) &&
      latNum >= -90 && latNum <= 90 &&
      longNum >= -180 && longNum <= 180) {
      return { lat: latNum, long: longNum };
    }
  }

  // Return default coordinates if parsing fails
  return { lat: DEFAULT_LATITUDE, long: DEFAULT_LONGITUDE };
}

// Get current coordinates from URL or defaults
const currentCoords = parseUrlCoordinates();
let LATITUDE = currentCoords.lat;
let LONGITUDE = currentCoords.long;

// Initialize scene
const scene = new GardenScene(container);

// Initialize with current time
const today = new Date();
let currentDate = new Date(today); // Keep track of current/selected date
updateDisplays(currentDate);
updateMinimapPosition(currentDate);
updateSunPosition(currentDate);

// Minimap control drag functionality
let isDragging = false;
let startX = 0;
let startY = 0;
let startLeft = 0;
let startTop = 0;

minimapControl.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  const rect = minimapControl.getBoundingClientRect();
  startLeft = rect.left + rect.width / 2; // Use center of control
  startTop = rect.top + rect.height / 2; // Use center of control
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const minimapRect = minimap.getBoundingClientRect();
  const controlRect = minimapControl.getBoundingClientRect();

  // Calculate new position (centered on mouse)
  let newLeft = e.clientX - startX + startLeft;
  let newTop = e.clientY - startY + startTop;

  // Constrain to minimap bounds, accounting for control size
  newLeft = Math.max(
    minimapRect.left + controlRect.width / 2,
    Math.min(minimapRect.right - controlRect.width / 2, newLeft)
  );
  newTop = Math.max(
    minimapRect.top + controlRect.height / 2,
    Math.min(minimapRect.bottom - controlRect.height / 2, newTop)
  );

  // Update control position (centered)
  minimapControl.style.left = `${newLeft - minimapRect.left - controlRect.width / 2
    }px`;
  minimapControl.style.top = `${newTop - minimapRect.top - controlRect.height / 2
    }px`;

  // Calculate time (0-1440 minutes) from x position
  const timePercent =
    (newLeft - minimapRect.left - controlRect.width / 2) /
    (minimapRect.width - controlRect.width);
  const minutes = Math.round(timePercent * 1440);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  // Calculate day of year (0-365) from y position
  const dayPercent =
    (newTop - minimapRect.top - controlRect.height / 2) /
    (minimapRect.height - controlRect.height);
  const dayOfYear = Math.round(dayPercent * 365);

  // Create new date based on minimap position
  currentDate = new Date();
  currentDate.setMonth(0, 1); // Start from January 1st
  currentDate.setDate(dayOfYear + 1);
  currentDate.setHours(hours, mins, 0, 0);

  // Update displays and sun position
  updateDisplays(currentDate);
  updateSunPosition(currentDate);
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});

function updateDisplays(date: Date) {
  // Update date display
  if (dateDisplay) {
    dateDisplay.textContent = date.toLocaleDateString();
  }

  // Update time display
  if (timeDisplay) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    timeDisplay.textContent = `${displayHours}:${minutes
      .toString()
      .padStart(2, "0")} ${period}`;
  }
}

function updateMinimapPosition(date: Date) {
  if (!minimap || !minimapControl) return;
  const minimapRect = minimap.getBoundingClientRect();

  // Calculate x position from time
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const xPercent = totalMinutes / 1440;

  // Calculate y position from day of year
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const yPercent = dayOfYear / 365;

  // Update control position
  minimapControl.style.left = `${xPercent * minimapRect.width}px`;
  minimapControl.style.top = `${yPercent * minimapRect.height}px`;
}

function updateSunPosition(date: Date) {
  scene.updateSunPosition(date, LATITUDE, LONGITUDE);
  updateMinimapPosition(date);
}

// Load CityJSON data for the given coordinates
async function loadCityJSONForCoordinates(lat: number, long: number) {
  try {
    console.log(`Loading CityJSON data for coordinates: ${lat}, ${long}`);

    // Convert lat/long to RDNAP coordinates
    const rdnaapCoords = await GeoConversion.shared.latLongToRdnap(lat, long);

    console.log(`Converted to RDNAP coordinates: ${rdnaapCoords[0]}, ${rdnaapCoords[1]}`);

    // Calculate bounding box (100m x 100m around the point)
    const bboxSize = 50; // 50 meters in each direction
    const bbox = [
      rdnaapCoords[0] - bboxSize, // minX
      rdnaapCoords[1] - bboxSize, // minY
      rdnaapCoords[0] + bboxSize, // maxX
      rdnaapCoords[1] + bboxSize  // maxY
    ];

    // Fetch CityJSON data for the bounding box
    const cityJSONData = await getCityJSON(bbox);

    // Pass the data to the scene
    await scene.loadCityJSONData(CityJSONConverter.convertToSingleCityJSON(cityJSONData));

    // Update the scene with new coordinates
    updateSunPosition(currentDate);

  } catch (error) {
    console.error('Error loading CityJSON data:', error);
    // Fall back to default coordinates if there's an error
    LATITUDE = DEFAULT_LATITUDE;
    LONGITUDE = DEFAULT_LONGITUDE;
    updateSunPosition(currentDate);
  }
}

export async function getCityJSON(bbox?: number[]): Promise<CityJSONFeatureCollection> {
  // Use provided bbox or fall back to default
  const bboxParam = bbox ? bbox.join(',') : "125231.00354637404,497846.50210455013,125382.6477488262,497784.63905186305";

  const baseUrl = `https://api.3dbag.nl//collections/pand/items?bbox=${bboxParam}&limit=100`;

  // Collect all features from all pages
  const allFeatures: any[] = [];
  let currentUrl = baseUrl;
  let hasNextPage = true;
  let pageCount = 0;
  let firstPageData: CityJSONFeatureCollection | null = null;
  const maxPages = 50; // Safety limit to prevent infinite loops

  console.log(`Starting to fetch CityJSON data with pagination from: ${baseUrl}`);

  while (hasNextPage && pageCount < maxPages) {
    pageCount++;
    const encodedUrl = `https://corsproxy.io/?url=${encodeURIComponent(currentUrl)}`;
    console.log(`Fetching page ${pageCount} from: ${encodedUrl}`);

    try {
      const resp = await fetch(encodedUrl);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data = await resp.json() as CityJSONFeatureCollection;

      // Store first page data for metadata
      if (pageCount === 1) {
        firstPageData = data;
      }

      // Add features from this page
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        console.log(`Page ${pageCount}: Added ${data.features.length} features. Total so far: ${allFeatures.length}`);
      }

      // Check if there's a next page
      hasNextPage = false;
      if (data.links) {
        const nextLink = data.links.find(link => link.rel === "next");
        if (nextLink) {
          // Extract the next URL from the link
          const nextUrl = new URL(nextLink.href);
          // Reconstruct the full URL with the base API endpoint
          currentUrl = `https://api.3dbag.nl${nextUrl.pathname}${nextUrl.search}`;
          hasNextPage = true;
        }
      }

      // Add a small delay to be respectful to the API
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`Error fetching page ${pageCount}:`, error);
      break;
    }
  }

  if (pageCount >= maxPages) {
    console.warn(`Reached maximum page limit (${maxPages}). There may be more data available.`);
  }

  if (!firstPageData) {
    throw new Error('Failed to fetch any data from the API');
  }

  console.log(`Finished fetching all pages. Total features collected: ${allFeatures.length}`);

  // Create a combined result with all features
  const combinedResult: CityJSONFeatureCollection = {
    type: firstPageData.type,
    features: allFeatures,
    metadata: firstPageData.metadata,
    version: firstPageData.version,
    numberMatched: firstPageData.numberMatched,
    numberReturned: allFeatures.length
  };

  return combinedResult;
}

// Update URL with new coordinates
function updateUrlWithCoordinates(lat: number, long: number) {
  const url = new URL(window.location.href);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('long', long.toString());

  // Update URL without reloading the page
  window.history.pushState({}, '', url.toString());
}

// Function to change coordinates and reload data
async function changeCoordinates(lat: number, long: number) {
  LATITUDE = lat;
  LONGITUDE = long;

  // Update URL
  updateUrlWithCoordinates(lat, long);

  // Reload CityJSON data for new coordinates
  await loadCityJSONForCoordinates(lat, long);

  // Update sun position with new coordinates
  updateSunPosition(currentDate);
}

// Make functions globally accessible for testing
(window as any).changeCoordinates = changeCoordinates;
(window as any).getCurrentCoordinates = () => ({ lat: LATITUDE, long: LONGITUDE });
(window as any).loadCityJSONForCoordinates = loadCityJSONForCoordinates;
(window as any).scene = scene;
(window as any).clearCityJSONData = () => scene.clearCityJSONData();
(window as any).getCityJSONGroup = () => scene.getCityJSONGroup();

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
  const newCoords = parseUrlCoordinates();
  if (newCoords.lat !== LATITUDE || newCoords.long !== LONGITUDE) {
    changeCoordinates(newCoords.lat, newCoords.long);
  }
});

// Log initial setup
console.log('Sun Shadow Simulator initialized with coordinates:', { lat: LATITUDE, long: LONGITUDE });
console.log('Use window.changeCoordinates(lat, long) to change coordinates programmatically');

// Load initial CityJSON data for the current coordinates
loadCityJSONForCoordinates(LATITUDE, LONGITUDE);
