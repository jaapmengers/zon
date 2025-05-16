import * as SunCalc from "suncalc";
import { Vector3 } from "three";

export interface SunPosition {
  position: Vector3;
  intensity: number;
  visible: boolean;
}

export class SunCalculator {
  /**
   * Calculate sun position for a given date/time and location
   */
  static calculateSunPosition(
    date: Date,
    latitude: number,
    longitude: number,
    distance: number = 30
  ): SunPosition {
    // Get sun position in radians
    const sunPosition = SunCalc.getPosition(date, latitude, longitude);

    // Extract altitude and azimuth
    const altitude = sunPosition.altitude; // Height above horizon in radians
    const azimuth = sunPosition.azimuth; // Direction from south in radians (clockwise)

    /*
     * Coordinate system explanation:
     * - In Three.js, +Z is south, -Z is north, +X is east, -X is west, +Y is up
     * - In SunCalc, azimuth is measured clockwise from south
     *   (south = 0, west = π/2, north = π, east = 3π/2)
     *
     * To convert:
     * - We need to negate the X value to correct east-west direction
     * - X = -sin(azimuth) to correct direction
     * - Z = cos(azimuth) for north-south
     */

    // Convert from spherical to cartesian with corrected directions
    const x = -distance * Math.cos(altitude) * Math.sin(azimuth); // Negated to fix east-west
    const y = distance * Math.sin(altitude);
    const z = distance * Math.cos(altitude) * Math.cos(azimuth);

    // Calculate light intensity based on sun altitude
    let intensity = 0.1; // Default low intensity
    let visible = true;

    if (altitude <= 0) {
      // Sun is below horizon (night)
      visible = false;
      intensity = 0.1; // Almost dark
    } else {
      // Scale from 0.5 (dawn/dusk) to 3 (noon)
      intensity = 0.5 + 2.5 * Math.sin(altitude);
    }

    return {
      position: new Vector3(x, y, z),
      intensity,
      visible,
    };
  }
}
