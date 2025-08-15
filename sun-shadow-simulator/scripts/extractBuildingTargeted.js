import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractBuildingTargeted(inputFilePath, buildingId, outputFilePath) {
  console.log(`Starting targeted extraction of building: ${buildingId}`);
  console.log(`Input file: ${inputFilePath}`);
  console.log(`Output file: ${outputFilePath}`);

  try {
    // Read the entire file content
    const fileContent = fs.readFileSync(inputFilePath, 'utf8');
    console.log(`File size: ${(fileContent.length / 1024 / 1024).toFixed(2)} MB`);

    // Parse the JSON
    console.log('Parsing JSON...');
    const cityJSON = JSON.parse(fileContent);
    console.log('JSON parsed successfully');

    // Check if the building exists
    if (!cityJSON.CityObjects || !cityJSON.CityObjects[buildingId]) {
      console.log(`Building ${buildingId} not found in CityJSON`);
      console.log('Available building IDs:');
      const buildingIds = Object.keys(cityJSON.CityObjects || {}).slice(0, 10);
      buildingIds.forEach(id => console.log(`  ${id}`));
      if (Object.keys(cityJSON.CityObjects || {}).length > 10) {
        console.log(`  ... and ${Object.keys(cityJSON.CityObjects || {}).length - 10} more`);
      }
      return;
    }

    const building = cityJSON.CityObjects[buildingId];
    console.log(`Found building: ${buildingId}`);
    console.log(`Building type: ${building.type}`);

    // Collect all vertex indices used by this building
    const usedVertexIndices = new Set();
    
    if (building.geometry) {
      console.log(`Geometry objects: ${building.geometry.length}`);
      building.geometry.forEach((geom, index) => {
        console.log(`  Geometry ${index}: type=${geom.type}, boundaries=${geom.boundaries?.length || 0}`);
        
        // Collect vertex indices from boundaries
        if (geom.boundaries) {
          geom.boundaries.forEach(boundary => {
            if (boundary[0]) { // First array contains vertex indices
              boundary[0].forEach(vertexIndex => {
                usedVertexIndices.add(vertexIndex);
              });
            }
          });
        }
      });
    }

    console.log(`Building uses ${usedVertexIndices.size} unique vertices`);

    // Extract only the used vertices
    const usedVertices = [];
    const vertexIndexMap = new Map(); // Map old index to new index
    let newIndex = 0;
    
    usedVertexIndices.forEach(oldIndex => {
      if (cityJSON.vertices[oldIndex]) {
        usedVertices.push(cityJSON.vertices[oldIndex]);
        vertexIndexMap.set(oldIndex, newIndex);
        newIndex++;
      }
    });

    // Update the building geometry to use new vertex indices
    const updatedBuilding = JSON.parse(JSON.stringify(building)); // Deep clone
    
    if (updatedBuilding.geometry) {
      updatedBuilding.geometry.forEach(geom => {
        if (geom.boundaries) {
          geom.boundaries.forEach(boundary => {
            if (boundary[0]) {
              boundary[0] = boundary[0].map(oldIndex => vertexIndexMap.get(oldIndex));
            }
          });
        }
      });
    }

    // Create the extracted data structure
    const extractedData = {
      vertices: usedVertices,
      transform: cityJSON.transform || { scale: [], translate: [] },
      CityObjects: {
        [buildingId]: updatedBuilding
      }
    };

    // Write the extracted data
    console.log('Writing extracted data...');
    const outputData = JSON.stringify(extractedData, null, 2);
    fs.writeFileSync(outputFilePath, outputData, 'utf8');

    console.log(`Successfully extracted building to: ${outputFilePath}`);
    console.log(`Building ID: ${buildingId}`);
    console.log(`Original vertices count: ${cityJSON.vertices.length}`);
    console.log(`Extracted vertices count: ${usedVertices.length}`);
    console.log(`Size reduction: ${((cityJSON.vertices.length - usedVertices.length) / cityJSON.vertices.length * 100).toFixed(1)}%`);
    console.log(`Transform:`, extractedData.transform);
    console.log(`Building properties:`, Object.keys(extractedData.CityObjects[buildingId] || {}));

  } catch (error) {
    console.error('Error during extraction:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const inputFile = path.join(__dirname, '../public/7-432-752.city.json');
  const buildingId = 'NL.IMBAG.Pand.0852100000001781';
  const outputFile = path.join(__dirname, '../public/extracted-building-targeted.json');

  try {
    await extractBuildingTargeted(inputFile, buildingId, outputFile);
    console.log('Targeted extraction completed successfully!');
  } catch (error) {
    console.error('Targeted extraction failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
