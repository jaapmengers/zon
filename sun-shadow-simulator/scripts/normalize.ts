import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import proj4 from 'proj4';

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
// normalizeVertices();

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
const rdCoords = [x2, y2];
const wgs84 = proj4("EPSG:28992", "EPSG:4326", rdCoords);

console.log(wgs84[1], wgs84[0])



// Output: 4.952392986878876, 52.468005275604774
// Real: 52.4675196865463, 4.950109641848087




// const minX = Math.min(...xs)
// const maxX = Math.max(...xs)
// const minY = Math.min(...ys)
// const maxY = Math.max(...ys)
// const minZ = Math.min(...zs)
// const maxZ = Math.max(...zs)

// console.log(minX, maxX, minY, maxY, minZ, maxZ)

// Convert from EPSG:4326 to EPSG:28992
const first = proj4("EPSG:4326", "EPSG:28992", [4.949130381009404, 52.46755248644969])
const second = proj4("EPSG:4326", "EPSG:28992", [4.951367350851736, 52.46700472813446])

// https://api.3dbag.nl//collections/pand/items?bbox=125128.10469439984,497728.02297969145,125163.09922238812,497777.34969445167
// 125128.10469439984, 497728.02297969145 ] [ 125163.09922238812, 497777.34969445167
console.log(first, second)
console.log(`https://api.3dbag.nl//collections/pand/items?bbox=${first[0]},${first[1]},${second[0]},${second[1]}`)
console.log(`https://3dbag.nl/en/viewer?rdx=${first[0]}&rdy=${first[1]}&ox=400&oy=400&oz=400&placeMarker=true`)
console.log(`https://3dbag.nl/en/viewer?rdx=${second[0]}&rdy=${second[1]}&ox=400&oy=400&oz=400&placeMarker=true`)
// 
// https://3dbag.nl/en/viewer?rdx=75900.011&rdy=447000.034&ox=400&oy=400&oz=400&placeMarker=true
// 


// https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typename=bag:verblijfsobject&outputFormat=application/json&filter=<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd"><fes:PropertyIsEqualTo><fes:PropertyName>pandidentificatie</fes:PropertyName><fes:Literal>0852100000001485</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>



// 52.467093347273185, 4.949904524961337
// 52.467538567750005, 4.950415063643829