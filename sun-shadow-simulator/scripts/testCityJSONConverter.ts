import { CityJSONConverter } from '../src/utils/CityJSONConverter';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Test script for CityJSONConverter
 * Converts items.json (FeatureCollection) to single CityJSON format
 */

async function testConversion() {
    try {
        console.log('🚀 Starting CityJSON conversion test...\n');

        // Get current directory for ES modules
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        // Read the input FeatureCollection file
        const inputPath = join(__dirname, '../public/items.json');
        const inputData = JSON.parse(readFileSync(inputPath, 'utf8'));

        console.log('📖 Input file loaded:');
        console.log(`   - Type: ${inputData.type}`);
        console.log(`   - Features: ${inputData.features?.length || 0}`);
        console.log(`   - Total vertices: ${inputData.features?.reduce((sum: number, f: any) => sum + (f.vertices?.length || 0), 0) || 0}`);
        console.log(`   - Transform: [${inputData.metadata?.transform?.scale?.join(', ')}] / [${inputData.metadata?.transform?.translate?.join(', ')}]\n`);

        // Perform the conversion
        console.log('🔄 Converting FeatureCollection to single CityJSON...');
        const startTime = Date.now();
        const converted = CityJSONConverter.convertToSingleCityJSON(inputData);
        const conversionTime = Date.now() - startTime;

        console.log(`✅ Conversion completed in ${conversionTime}ms\n`);

        // Display conversion results
        console.log('📊 Conversion Results:');
        console.log(`   - Output type: ${converted.type}`);
        console.log(`   - CityObjects: ${Object.keys(converted.CityObjects).length}`);
        console.log(`   - Total vertices: ${converted.vertices.length}`);
        console.log(`   - Transform preserved: [${converted.transform.scale.join(', ')}] / [${converted.transform.translate.join(', ')}]\n`);

        // Show some sample CityObject IDs
        const cityObjectIds = Object.keys(converted.CityObjects);
        console.log('🏢 Sample CityObject IDs:');
        cityObjectIds.slice(0, 5).forEach(id => console.log(`   - ${id}`));
        if (cityObjectIds.length > 5) {
            console.log(`   ... and ${cityObjectIds.length - 5} more`);
        }
        console.log('');

        // Show vertex statistics
        console.log('📍 Vertex Statistics:');
        const originalVertexCounts = inputData.features?.map((f: any) => f.vertices?.length || 0) || [];
        console.log(`   - Original feature vertex counts: [${originalVertexCounts.join(', ')}]`);
        console.log(`   - Merged vertex count: ${converted.vertices.length}`);
        console.log(`   - Vertex count matches: ${originalVertexCounts.reduce((sum, count) => sum + count, 0) === converted.vertices.length ? '✅' : '❌'}\n`);

        // Save the converted output
        const outputPath = join(__dirname, '../public/converted-output.json');
        writeFileSync(outputPath, JSON.stringify(converted, null, 2));
        console.log(`💾 Converted output saved to: ${outputPath}`);

        // Verify the structure matches expected format
        console.log('\n🔍 Structure Verification:');
        console.log(`   - Has CityObjects: ${'CityObjects' in converted ? '✅' : '❌'}`);
        console.log(`   - Has vertices: ${'vertices' in converted ? '✅' : '❌'}`);
        console.log(`   - Has transform: ${'transform' in converted ? '✅' : '❌'}`);
        console.log(`   - Has version: ${'version' in converted ? '✅' : '❌'}`);
        console.log(`   - No features array: ${!('features' in converted) ? '✅' : '❌'}`);

        console.log('\n🎉 Test completed successfully!');

    } catch (error) {
        console.error('❌ Error during conversion:', error);
        process.exit(1);
    }
}

// Run the test
testConversion();
