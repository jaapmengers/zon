import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractBuilding(inputFilePath, buildingId, outputFilePath) {
  console.log(`Starting extraction of building: ${buildingId}`);
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

    // Extract the required data
    const extractedData = {
      vertices: cityJSON.vertices || [],
      transform: cityJSON.transform || { scale: [], translate: [] },
      CityObjects: {}
    };

    // Check if the building exists
    if (cityJSON.CityObjects && cityJSON.CityObjects[buildingId]) {
      extractedData.CityObjects[buildingId] = cityJSON.CityObjects[buildingId];
      console.log(`Found building: ${buildingId}`);
      console.log(`Building type: ${cityJSON.CityObjects[buildingId].type}`);
      
      // Log geometry information
      if (cityJSON.CityObjects[buildingId].geometry) {
        console.log(`Geometry objects: ${cityJSON.CityObjects[buildingId].geometry.length}`);
        cityJSON.CityObjects[buildingId].geometry.forEach((geom, index) => {
          console.log(`  Geometry ${index}: type=${geom.type}, boundaries=${geom.boundaries?.length || 0}`);
        });
      }
    } else {
      console.log(`Building ${buildingId} not found in CityJSON`);
      console.log('Available building IDs:');
      const buildingIds = Object.keys(cityJSON.CityObjects || {}).slice(0, 10); // Show first 10
      buildingIds.forEach(id => console.log(`  ${id}`));
      if (Object.keys(cityJSON.CityObjects || {}).length > 10) {
        console.log(`  ... and ${Object.keys(cityJSON.CityObjects || {}).length - 10} more`);
      }
      return;
    }

    // Write the extracted data
    console.log('Writing extracted data...');
    const outputData = JSON.stringify(extractedData, null, 2);
    fs.writeFileSync(outputFilePath, outputData, 'utf8');

    console.log(`Successfully extracted building to: ${outputFilePath}`);
    console.log(`Building ID: ${buildingId}`);
    console.log(`Vertices count: ${extractedData.vertices.length}`);
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
  const outputFile = path.join(__dirname, '../public/extracted-building.json');

  try {
    await extractBuilding(inputFile, buildingId, outputFile);
    console.log('Extraction completed successfully!');
  } catch (error) {
    console.error('Extraction failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
