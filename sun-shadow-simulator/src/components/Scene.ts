import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  AmbientLight,
  MeshStandardMaterial,
  Mesh,
  PlaneGeometry,
  Color,
  AxesHelper,
  GridHelper,
  PCFSoftShadowMap,
  Group,
  Vector3,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Box3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SunCalculator, SunPosition } from "../utils/SunCalculator";
import { CityJSONLoader, CityJSONParser } from "cityjson-threejs-loader";

export class GardenScene {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private controls: OrbitControls;
  private ground!: Mesh; // Using definite assignment assertion
  private sunlight!: DirectionalLight; // Using definite assignment assertion
  private directionMarkers!: Group; // Using definite assignment assertion

  private container: HTMLElement;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create scene
    this.scene = new Scene();
    this.scene.background = new Color(0x87ceeb); // Sky blue background

    // Create camera with initial aspect ratio
    this.camera = new PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 50, 50); // Reset camera position
    this.camera.lookAt(0, 0, 0);

    // Create renderer constrained to container dimensions
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Set initial size
    this.updateRendererSize();

    // Create orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Set up resize observer for the container
    this.resizeObserver = new ResizeObserver(() => {
      this.updateRendererSize();
    });

    // Observe the container element
    this.resizeObserver.observe(this.container);

    // Also handle window resize
    window.addEventListener("resize", this.onWindowResize.bind(this));

    // Initialize scene objects and start animation
    this.initializeScene();
  }

  private async initializeScene(): Promise<void> {
    await this.setupSceneObjects();
    this.animate();
  }

  private async setupSceneObjects(): Promise<void> {
    const groundGeometry = new PlaneGeometry(200, 200);
    const groundMaterial = new MeshStandardMaterial({
      color: 0x7cfc00, // Lawn green
      side: 2, // DoubleSide
    });
    this.ground = new Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Load CityJSON buildings using cityjson-threejs-loader
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}/converted-output.json`);
      const cityJSONData = await response.json();

      // Initialize the parser and loader
      const parser = new CityJSONParser();
      const loader = new CityJSONLoader(parser);

      // Load the CityJSON data
      loader.load(cityJSONData);

      // Add the loaded scene to our scene
      this.scene.add(loader.scene);

      // Fix the building rotation - rotate 90 degrees around Z-axis
      loader.scene.rotation.x = -Math.PI / 2; // 90 degrees clockwise around Z-axis

      // Center the CityJSON scene on X and Y axes, but keep Z at ground level (0)
      const box = new Box3().setFromObject(loader.scene);
      const center = box.getCenter(new Vector3());
      loader.scene.position.x = -center.x;
      loader.scene.position.y = 0;
      loader.scene.position.z = -center.z; // Keep at ground level

      this.scene.traverse((child) => {
        if (child instanceof Mesh) {
          if (child.material.isCityObjectsMaterial) {
            child.material.showLod = 3;
            child.castShadow = true
          }
        }
      });
    } catch (error) {
      console.error("Error loading CityJSON:", error);
    }

    // Create sunlight (directional light)
    this.sunlight = new DirectionalLight(0xffffaa, 3);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.width = 2048;
    this.sunlight.shadow.mapSize.height = 2048;
    this.sunlight.shadow.camera.near = 0.5;
    this.sunlight.shadow.camera.far = 225;
    this.sunlight.shadow.camera.left = -67.5;
    this.sunlight.shadow.camera.right = 67.5;
    this.sunlight.shadow.camera.top = 67.5;
    this.sunlight.shadow.camera.bottom = -67.5;
    this.scene.add(this.sunlight);
    this.scene.add(this.sunlight.target);

    // Set initial sun position (current time)
    const initialDate = new Date();
    const initialLatitude = 52.467414002773545; // Amsterdam latitude
    const initialLongitude = 4.9500845675680685; // Amsterdam longitude
    this.updateSunPosition(initialDate, initialLatitude, initialLongitude);

    // Add ambient light for better visibility
    const ambientLight = new AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    // Add grid for better reference
    const gridHelper = new GridHelper(200, 200);
    this.scene.add(gridHelper);

    // Add cardinal direction markers
    this.addCardinalDirections();
  }

  // Create cardinal direction markers
  private addCardinalDirections(): void {
    // Create a group to hold all direction indicators
    this.directionMarkers = new Group();
    this.scene.add(this.directionMarkers);

    // Define cardinal directions and their colors
    const directions = [
      { label: "N", position: new Vector3(0, 0, -100), color: "red" },
      { label: "E", position: new Vector3(100, 0, 0), color: "green" },
      { label: "S", position: new Vector3(0, 0, 100), color: "blue" },
      { label: "W", position: new Vector3(-100, 0, 0), color: "yellow" },
    ];

    // Create markers for each direction
    directions.forEach((dir) => {
      const sprite = this.createTextSprite(dir.label, dir.color);
      sprite.position.copy(dir.position);
      sprite.position.y = 0.5; // Lift slightly above ground
      this.directionMarkers?.add(sprite);
    });
  }

  // Create a text sprite for direction labels
  private createTextSprite(text: string, color: string = "white"): Sprite {
    // Create canvas for the texture
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 256;
    canvas.height = 256;

    if (context) {
      // Clear background
      context.fillStyle = "rgba(0, 0, 0, 0)";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Draw text
      context.font = "Bold 100px Arial";
      context.fillStyle = color;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      // Optional: Add circle around text
      context.strokeStyle = color;
      context.lineWidth = 8;
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, 100, 0, 2 * Math.PI);
      context.stroke();
    }

    // Create sprite with canvas texture
    const texture = new CanvasTexture(canvas);
    const material = new SpriteMaterial({ map: texture, transparent: true });
    const sprite = new Sprite(material);

    // Scale the sprite
    sprite.scale.set(2, 2, 1);

    return sprite;
  }

  // Update renderer and camera based on container dimensions
  private updateRendererSize(): void {
    // Use container's actual dimensions
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;

    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Update renderer size to match container
    this.renderer.setSize(width, height, false);
  }

  updateSunPosition(date: Date, latitude: number, longitude: number): void {
    if (!this.sunlight) {
      return;
    }

    const sunPos: SunPosition = SunCalculator.calculateSunPosition(
      date,
      latitude,
      longitude
    );

    // Update light position
    this.sunlight.position.copy(sunPos.position);

    // Update light intensity
    this.sunlight.intensity = sunPos.intensity;
  }

  private onWindowResize(): void {
    this.updateRendererSize();
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    // Update controls
    this.controls.update();

    // Make direction markers always face the camera
    if (this.directionMarkers) {
      this.directionMarkers.children.forEach((marker) => {
        if (marker instanceof Sprite) {
          marker.lookAt(this.camera.position);
        }
      });
    }

    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
}
