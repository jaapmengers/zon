import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import proj4 from 'proj4';
import { GeoConversion } from '../src/utils/GeoConversion';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '../public/extracted.json');

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

let minBoundaries: number;
let maxBoundaries: number;

// 1. Get and save just relevant boundaries
function getRelevantBoundaries() {
    const allBoundaries = Object.values(data.CityObjects).flatMap((x: any) => {
        return x.geometry.flatMap((y: any) => y.boundaries);
    }).flat().flat().flat() as number[];

    minBoundaries = Math.min(...allBoundaries);
    maxBoundaries = Math.max(...allBoundaries);

    data.vertices = data.vertices.slice(minBoundaries, maxBoundaries + 1);
}

// 2. Normalize boundaries
function normalizeBoundaries() {
    Object.entries(data.CityObjects).forEach(([key, value]: [string, any]) => {
        const updatedGeometry = value.geometry.map(x => {

            const updatedBoundaries = x.boundaries.map(y => y.map(z => z.map(a => {
                if (typeof a === 'number') {
                    return a - minBoundaries;
                }

                return a.map(b => b - minBoundaries);
            })))

            return { ...x, boundaries: updatedBoundaries }
        })

        data.CityObjects[key].geometry = updatedGeometry;
    });
}

// 3. Normalize vertices
function normalizeVertices() {
    const xs = data.vertices.map(x => x[0])
    const ys = data.vertices.map(x => x[1])
    const zs = data.vertices.map(x => x[2])

    const minXs = Math.min(...xs)
    const minYs = Math.min(...ys)
    const minZs = Math.min(...zs)

    data.vertices = data.vertices.map(x => [x[0] - minXs, x[1] - minYs, x[2] - minZs])
}

getRelevantBoundaries();
normalizeBoundaries();
normalizeVertices();

// fs.writeFileSync(path.join(__dirname, '../public/normalized.json'), JSON.stringify(data, null, 2));


const [x, y] = data.vertices[1]
const [x2, y2] = [
    x * data.transform.scale[0] + data.transform.translate[0],
    y * data.transform.scale[1] + data.transform.translate[1],
]

const resp = await fetch("https://github.com/OSGeo/proj-datumgrid/raw/refs/heads/master/europe/rdtrans2018.gsb");           // host the file yourself
const buffer = await resp.arrayBuffer();
proj4.nadgrid("rdnap2018", buffer);

proj4.defs("EPSG:28992",
    "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 " +
    "+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel " +
    "+units=m +no_defs +nadgrids=@rdnap2018,null");

// Now convert from RD_New (EPSG:28992) to WGS84 (EPSG:4326)
// Coordinates input: [x, y] (RD X, Y in meters)
const wgs84 = await GeoConversion.shared.rdnapToLatLong(x2, y2);

console.log(wgs84[1], wgs84[0])

// Convert from EPSG:4326 to EPSG:28992
const first = await GeoConversion.shared.latLongToRdnap(52.46755248644969, 4.949130381009404)
const second = await GeoConversion.shared.latLongToRdnap(52.46700472813446, 4.951367350851736)

console.log(first, second)
console.log(`https://api.3dbag.nl//collections/pand/items?bbox=${first[0]},${first[1]},${second[0]},${second[1]}`)
console.log(`https://3dbag.nl/en/viewer?rdx=${first[0]}&rdy=${first[1]}&ox=400&oy=400&oz=400&placeMarker=true`)
console.log(`https://3dbag.nl/en/viewer?rdx=${second[0]}&rdy=${second[1]}&ox=400&oy=400&oz=400&placeMarker=true`)