import proj4 from "proj4";

export class GeoConversion {

    public static shared: GeoConversion = new GeoConversion

    private initilizationComplete: Promise<void> | null = null;

    private constructor() {
        this.initilizationComplete = this.initialize();
    }

    private async initialize() {
        // Load the rdtrans2018.gsb file from the local public directory
        const resp = await fetch("/zon/rdtrans2018.gsb");
        const buffer = await resp.arrayBuffer();
        proj4.nadgrid("rdnap2018", buffer);

        proj4.defs("EPSG:28992",
            "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 " +
            "+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel " +
            "+units=m +no_defs +nadgrids=@rdnap2018,null");
    }

    public async rdnapToLatLong(x: number, y: number) {
        await this.initilizationComplete;

        return proj4("EPSG:28992", "EPSG:4326", [x, y]);
    }

    public async latLongToRdnap(lat: number, long: number) {
        await this.initilizationComplete;

        return proj4("EPSG:4326", "EPSG:28992", [long, lat])
    }

}