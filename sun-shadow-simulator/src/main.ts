import "./style.css";
import { GardenScene } from "./components/Scene";

// Amsterdam coordinates
const LATITUDE = 52.3676;
const LONGITUDE = 4.9041;

// DOM Elements
const container = document.getElementById("canvas-container");
const dateDisplay = document.getElementById("date-display");
const timeDisplay = document.getElementById("time-display");
const minimapControl = document.getElementById("minimap-control");
const minimap = document.querySelector(".minimap");

if (!container || !dateDisplay || !timeDisplay || !minimapControl || !minimap) {
  throw new Error("Required DOM elements not found");
}

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

export async function getCityJSON(): Promise<ApiReponse> {
  const resp = await fetch("https://api.3dbag.nl//collections/pand/items?bbox=125231.00354637404,497846.50210455013,125382.6477488262,497784.63905186305&limit=100")
  const data = await resp.json() as ApiReponse
  return data
}

interface ApiReponse {
  features: {
    CityObjects: {
      [key: string]: {
        attributes: { [key: string]: unknown }
        geometry: {
          boundaries: number[][][]
        }
      }
    }
  }[]
}
