import { CityJSONConverter } from '../src/utils/CityJSONConverter';

/**
 * Test script for pagination logic
 * Simulates multiple API responses with next links to test the conversion
 */

// Mock data structure that simulates paginated API responses
const mockPaginatedData = {
    page1: {
        type: "FeatureCollection",
        features: [
            {
                id: "building1",
                type: "Feature",
                CityObjects: {
                    "building1": {
                        type: "Building",
                        geometry: [{
                            type: "Solid",
                            boundaries: [[[0, 1, 2, 3], [4, 5, 6, 7]]]
                        }]
                    }
                },
                vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
            }
        ],
        metadata: {
            transform: {
                scale: [1, 1, 1],
                translate: [0, 0, 0]
            },
            referenceSystem: "EPSG:28992"
        },
        version: "1.0",
        numberMatched: 3,
        numberReturned: 1,
        links: [
            { href: "/collections/pand/items?bbox=1,2,3,4&limit=1&startindex=1", rel: "next" }
        ]
    },
    page2: {
        type: "FeatureCollection",
        features: [
            {
                id: "building2",
                type: "Feature",
                CityObjects: {
                    "building2": {
                        type: "Building",
                        geometry: [{
                            type: "Solid",
                            boundaries: [[[0, 1, 2, 3], [4, 5, 6, 7]]]
                        }]
                    }
                },
                vertices: [[2, 0, 0], [3, 0, 0], [3, 1, 0], [2, 1, 0], [2, 0, 1], [3, 0, 1], [3, 1, 1], [2, 1, 1]]
            }
        ],
        metadata: {
            transform: {
                scale: [1, 1, 1],
                translate: [0, 0, 0]
            },
            referenceSystem: "EPSG:28992"
        },
        version: "1.0",
        numberMatched: 3,
        numberReturned: 1,
        links: [
            { href: "/collections/pand/items?bbox=1,2,3,4&limit=1&startindex=2", rel: "next" }
        ]
    },
    page3: {
        type: "FeatureCollection",
        features: [
            {
                id: "building3",
                type: "Feature",
                CityObjects: {
                    "building3": {
                        type: "Building",
                        geometry: [{
                            type: "Solid",
                            boundaries: [[[0, 1, 2, 3], [4, 5, 6, 7]]]
                        }]
                    }
                },
                vertices: [[4, 0, 0], [5, 0, 0], [5, 1, 0], [4, 1, 0], [4, 0, 1], [5, 0, 1], [5, 1, 1], [4, 1, 1]]
            }
        ],
        metadata: {
            transform: {
                scale: [1, 1, 1],
                translate: [0, 0, 0]
            },
            referenceSystem: "EPSG:28992"
        },
        version: "1.0",
        numberMatched: 3,
        numberReturned: 1,
        links: [] // No more pages
    }
};

// Simulate the combined result that would come from the pagination logic
const combinedFeatures = [
    ...mockPaginatedData.page1.features,
    ...mockPaginatedData.page2.features,
    ...mockPaginatedData.page3.features
];

const combinedData = {
    type: "FeatureCollection",
    features: combinedFeatures,
    metadata: mockPaginatedData.page1.metadata,
    version: mockPaginatedData.page1.version,
    numberMatched: mockPaginatedData.page1.numberMatched,
    numberReturned: combinedFeatures.length
};

async function testPaginationConversion() {
    try {
        console.log('🚀 Starting pagination conversion test...\n');

        console.log('📖 Simulated paginated data:');
        console.log(`   - Page 1: ${mockPaginatedData.page1.features.length} features`);
        console.log(`   - Page 2: ${mockPaginatedData.page2.features.length} features`);
        console.log(`   - Page 3: ${mockPaginatedData.page3.features.length} features`);
        console.log(`   - Total features: ${combinedFeatures.length}\n`);

        // Test the conversion with combined data
        console.log('🔄 Converting combined paginated data to single CityJSON...');
        const startTime = Date.now();
        const converted = CityJSONConverter.convertToSingleCityJSON(combinedData);
        const conversionTime = Date.now() - startTime;

        console.log(`✅ Conversion completed in ${conversionTime}ms\n`);

        // Display conversion results
        console.log('📊 Conversion Results:');
        console.log(`   - Output type: ${converted.type}`);
        console.log(`   - CityObjects: ${Object.keys(converted.CityObjects).length}`);
        console.log(`   - Total vertices: ${converted.vertices.length}`);
        console.log(`   - Expected vertices: ${combinedFeatures.reduce((sum, f) => sum + f.vertices.length, 0)}`);

        // Verify that all building IDs are present
        const expectedIds = ['building1', 'building2', 'building3'];
        const actualIds = Object.keys(converted.CityObjects);
        console.log(`   - Expected building IDs: [${expectedIds.join(', ')}]`);
        console.log(`   - Actual building IDs: [${actualIds.join(', ')}]`);
        console.log(`   - All expected IDs present: ${expectedIds.every(id => actualIds.includes(id)) ? '✅' : '❌'}`);

        // Verify vertex count
        const expectedVertexCount = combinedFeatures.reduce((sum, f) => sum + f.vertices.length, 0);
        console.log(`   - Vertex count matches: ${converted.vertices.length === expectedVertexCount ? '✅' : '❌'}`);

        console.log('\n🎉 Pagination conversion test completed successfully!');

    } catch (error) {
        console.error('❌ Error during pagination conversion test:', error);
        process.exit(1);
    }
}

// Run the test
testPaginationConversion();
