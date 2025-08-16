interface CityJSONFeature {
    id: string;
    type: string;
    CityObjects: Record<string, any>;
    vertices: number[][];
}

export interface CityJSONFeatureCollection {
    type: string;
    features: CityJSONFeature[];
    metadata: {
        transform: {
            scale: number[];
            translate: number[];
        };
        referenceSystem?: string;
    };
    version: string;
    numberMatched?: number;
    numberReturned?: number;
    links?: {
        href: string
        rel: "self" | "next" | "prev"
    }[];
}

export interface SingleCityJSON {
    type: string;
    CityObjects: Record<string, any>;
    vertices: number[][];
    transform: {
        scale: number[];
        translate: number[];
    };
    version: string;
    referenceSystem?: string;
}

export class CityJSONConverter {
    /**
     * Converts a CityJSON FeatureCollection to a single CityJSON
     */
    static convertToSingleCityJSON(input: CityJSONFeatureCollection): SingleCityJSON {
        console.log(`Starting conversion of CityJSON with ${input.features.length} features`);

        // Extract metadata
        const { transform, referenceSystem } = input.metadata;

        // Initialize output structure
        const output: SingleCityJSON = {
            type: "CityJSON",
            CityObjects: {},
            vertices: [],
            transform,
            version: input.version,
            referenceSystem
        };

        // Track vertex index mapping for each feature
        let currentVertexIndex = 0;
        const vertexIndexMappings: Map<string, Map<number, number>> = new Map();
        let totalVertices = 0;
        let totalCityObjects = 0;
        let skippedDuplicates = 0;

        // Process each feature
        for (const feature of input.features) {
            if (!feature.CityObjects || !feature.vertices || feature.vertices.length === 0) {
                continue; // Skip features with missing data
            }

            // Create vertex index mapping for this feature
            const vertexMapping = new Map<number, number>();
            for (let i = 0; i < feature.vertices.length; i++) {
                vertexMapping.set(i, currentVertexIndex);
                currentVertexIndex++;
            }
            vertexIndexMappings.set(feature.id, vertexMapping);

            // Add vertices to the output
            output.vertices.push(...feature.vertices);
            totalVertices += feature.vertices.length;

            // Process CityObjects for this feature
            for (const [objectId, cityObject] of Object.entries(feature.CityObjects)) {
                // Skip if we already have this ID (keep first occurrence)
                // This handles cases where the same object appears in multiple pages
                if (output.CityObjects[objectId]) {
                    skippedDuplicates++;
                    continue;
                }

                // Deep clone the city object to avoid modifying the input
                const clonedObject = JSON.parse(JSON.stringify(cityObject));

                // Update geometry boundaries with new vertex indices
                if (clonedObject.geometry) {
                    this.updateGeometryVertexIndices(clonedObject.geometry, vertexMapping);
                }

                output.CityObjects[objectId] = clonedObject;
                totalCityObjects++;
            }
        }

        console.log(`Conversion completed: ${totalCityObjects} CityObjects, ${totalVertices} vertices, ${skippedDuplicates} duplicate objects skipped`);

        return output;
    }

    /**
     * Updates vertex indices in geometry boundaries based on the new vertex mapping
     */
    private static updateGeometryVertexIndices(geometry: any[], vertexMapping: Map<number, number>): void {
        for (const geom of geometry) {
            if (geom.boundaries) {
                this.updateBoundariesVertexIndices(geom.boundaries, vertexMapping);
            }
        }
    }

    /**
     * Recursively updates vertex indices in boundaries arrays
     */
    private static updateBoundariesVertexIndices(boundaries: any[], vertexMapping: Map<number, number>): void {
        for (let i = 0; i < boundaries.length; i++) {
            const boundary = boundaries[i];
            if (Array.isArray(boundary)) {
                if (boundary.length > 0 && typeof boundary[0] === 'number') {
                    // This is a vertex index array
                    for (let j = 0; j < boundary.length; j++) {
                        const oldIndex = boundary[j];
                        const newIndex = vertexMapping.get(oldIndex);
                        if (newIndex !== undefined) {
                            boundary[j] = newIndex;
                        }
                    }
                } else {
                    // This is a nested boundaries array, recurse
                    this.updateBoundariesVertexIndices(boundary, vertexMapping);
                }
            }
        }
    }
}
