# Building Extraction Scripts

This directory contains scripts to extract specific buildings from large CityJSON files.

## Scripts

### `extractBuilding.js`
Extracts a complete building including all vertices from the source CityJSON file.
- **Input**: Large CityJSON file (e.g., `7-432-752.city.json`)
- **Output**: Complete building data with all vertices
- **Use case**: When you need the complete building data

### `extractBuildingTargeted.js` (Recommended)
Extracts only the building data and the specific vertices it references.
- **Input**: Large CityJSON file (e.g., `7-432-752.city.json`)
- **Output**: Minimal building data with only referenced vertices
- **Use case**: For web applications where you want to minimize file size

## Usage

```bash
# Extract a specific building with all vertices
node scripts/extractBuilding.js

# Extract a specific building with only referenced vertices (recommended)
node scripts/extractBuildingTargeted.js
```

## Configuration

Both scripts are configured to extract the building with ID `NL.IMBAG.Pand.0852100000001781` from `public/7-432-752.city.json`.

To extract a different building, modify the `buildingId` variable in the script.

## Output

The scripts create:
- `extracted-building-targeted.json` - Minimal building data (recommended)
- `extracted-building.json` - Complete building data with all vertices

## File Size Comparison

- **Original CityJSON**: 13.12 MB
- **Complete extraction**: 5.5 MB
- **Targeted extraction**: 3.6 KB (99.97% reduction)

The targeted extraction is recommended for web applications as it provides the same building geometry with minimal file size.
