import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  AmbientLight,
  MeshStandardMaterial,
  BoxGeometry,
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
  Object3D,
  BufferGeometry,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SunCalculator, SunPosition } from "../utils/SunCalculator";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export class GardenScene {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private controls: OrbitControls;
  private ground!: Mesh; // Using definite assignment assertion
  private house!: Group; // Using definite assignment assertion
  private sunlight!: DirectionalLight; // Using definite assignment assertion
  private sunCalculator: SunCalculator = new SunCalculator();
  private directionMarkers!: Group; // Using definite assignment assertion
  private customModels: Object3D[] = [];

  private container: HTMLElement;
  private controlsElement: HTMLElement | null;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.controlsElement = document.getElementById("controls");

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
    this.camera.position.set(0, 40, 50);
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
    // Create ground (90x90 meters)
    const groundGeometry = new PlaneGeometry(90, 90);
    const groundMaterial = new MeshStandardMaterial({
      color: 0x7cfc00, // Lawn green
      side: 2, // DoubleSide
    });
    this.ground = new Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Load house model
    try {
      const objLoader = new OBJLoader();
      this.house = await new Promise<Group>((resolve, reject) => {
        objLoader.load(
          "/src/assets/huis-tuin.obj",
          (object) => {
            // Enable shadows for all meshes
            object.traverse((child) => {
              if (child instanceof Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            resolve(object);
          },
          undefined,
          reject
        );
      });

      // Position the house model
      this.house.position.set(0, 0, 0); // Center position
      this.house.scale.set(0.1, 0.1, 0.1); // Default scale
      this.house.rotation.set(-Math.PI / 2, 0, 0); // Rotate -90 degrees around X to convert from Z-up to Y-up
      this.scene.add(this.house);
    } catch (error) {
      console.error("Error loading house model:", error);
      // Fallback to cube if model loading fails
      const houseGeometry = new BoxGeometry(3, 3, 3);
      const houseMaterial = new MeshStandardMaterial({ color: 0xd2b48c });
      const fallbackHouse = new Mesh(houseGeometry, houseMaterial);
      fallbackHouse.position.y = 1.5;
      fallbackHouse.castShadow = true;
      fallbackHouse.receiveShadow = true;
      this.house = new Group();
      this.house.add(fallbackHouse);
      this.scene.add(this.house);
    }

    // Create sunlight (directional light)
    this.sunlight = new DirectionalLight(0xffffaa, 3);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.width = 2048;
    this.sunlight.shadow.mapSize.height = 2048;
    this.sunlight.shadow.camera.near = 0.5;
    this.sunlight.shadow.camera.far = 225; // Increased to cover larger area
    this.sunlight.shadow.camera.left = -67.5; // Increased to cover larger area
    this.sunlight.shadow.camera.right = 67.5; // Increased to cover larger area
    this.sunlight.shadow.camera.top = 67.5; // Increased to cover larger area
    this.sunlight.shadow.camera.bottom = -67.5; // Increased to cover larger area
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

    // Add axes helper
    const axesHelper = new AxesHelper(45); // Increased to match new scale
    this.scene.add(axesHelper);

    // Add grid for better reference
    const gridHelper = new GridHelper(90, 90); // Increased to match new ground size
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
      { label: "N", position: new Vector3(0, 0, -45), color: "red" }, // Increased from -30 to -45
      { label: "E", position: new Vector3(45, 0, 0), color: "green" }, // Increased from 30 to 45
      { label: "S", position: new Vector3(0, 0, 45), color: "blue" }, // Increased from 30 to 45
      { label: "W", position: new Vector3(-45, 0, 0), color: "yellow" }, // Increased from -30 to -45
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
      //   throw new Error("Sun light not initialized");
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

    // Show sun position info in console
    console.log(
      `Sun position: altitude: ${(
        Math.asin(sunPos.position.y / 30) *
        (180 / Math.PI)
      ).toFixed(2)}°`
    );
    console.log(
      `Sun light position: x:${sunPos.position.x.toFixed(
        2
      )}, y:${sunPos.position.y.toFixed(2)}, z:${sunPos.position.z.toFixed(2)}`
    );
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

  public loadModel(
    file: File,
    position: Vector3 = new Vector3(0, 0, 0),
    scale: Vector3 = new Vector3(1, 1, 1),
    rotation: Vector3 = new Vector3(0, 0, 0)
  ): Promise<Object3D> {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      const objectUrl = URL.createObjectURL(file);

      const onLoad = (object: Object3D) => {
        // Enable shadows for all meshes
        object.traverse((child) => {
          if (child instanceof Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Apply transformations
        object.position.copy(position);
        object.scale.copy(scale);
        object.rotation.set(rotation.x, rotation.y, rotation.z);

        // Add to scene and store reference
        this.scene.add(object);
        this.customModels.push(object);

        URL.revokeObjectURL(objectUrl);
        resolve(object);
      };

      const onError = (error: unknown) => {
        URL.revokeObjectURL(objectUrl);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      switch (fileExtension) {
        case "obj":
          const objLoader = new OBJLoader();
          objLoader.load(objectUrl, onLoad, undefined, onError);
          break;

        case "stl":
          const stlLoader = new STLLoader();
          stlLoader.load(
            objectUrl,
            (geometry) => {
              const material = new MeshStandardMaterial({ color: 0x808080 });
              const mesh = new Mesh(geometry, material);
              onLoad(mesh);
            },
            undefined,
            onError
          );
          break;

        case "gltf":
        case "glb":
          const gltfLoader = new GLTFLoader();
          gltfLoader.load(
            objectUrl,
            (gltf) => onLoad(gltf.scene),
            undefined,
            onError
          );
          break;

        case "fbx":
          const fbxLoader = new FBXLoader();
          fbxLoader.load(objectUrl, onLoad, undefined, onError);
          break;

        default:
          reject(new Error(`Unsupported file format: ${fileExtension}`));
      }
    });
  }

  public removeModel(model: Object3D): void {
    const index = this.customModels.indexOf(model);
    if (index !== -1) {
      this.customModels.splice(index, 1);
      this.scene.remove(model);
    }
  }

  public clearModels(): void {
    this.customModels.forEach((model) => this.scene.remove(model));
    this.customModels = [];
  }

  public async loadStaticModel(
    modelPath: string,
    position: Vector3 = new Vector3(0, 0, 0),
    scale: Vector3 = new Vector3(1, 1, 1),
    rotation: Vector3 = new Vector3(0, 0, 0)
  ): Promise<Object3D> {
    const fileExtension = modelPath.split(".").pop()?.toLowerCase();

    try {
      let object: Object3D;

      switch (fileExtension) {
        case "obj":
          const objLoader = new OBJLoader();
          object = await new Promise<Object3D>((resolve, reject) => {
            objLoader.load(modelPath, resolve, undefined, reject);
          });
          break;

        case "stl":
          const stlLoader = new STLLoader();
          const geometry = await new Promise<BufferGeometry>(
            (resolve, reject) => {
              stlLoader.load(modelPath, resolve, undefined, reject);
            }
          );
          const material = new MeshStandardMaterial({ color: 0x808080 });
          object = new Mesh(geometry, material);
          break;

        case "gltf":
        case "glb":
          const gltfLoader = new GLTFLoader();
          const gltf = await new Promise<any>((resolve, reject) => {
            gltfLoader.load(modelPath, resolve, undefined, reject);
          });
          object = gltf.scene;
          break;

        case "fbx":
          const fbxLoader = new FBXLoader();
          object = await new Promise<Object3D>((resolve, reject) => {
            fbxLoader.load(modelPath, resolve, undefined, reject);
          });
          break;

        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Enable shadows for all meshes
      object.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Apply transformations
      object.position.copy(position);
      object.scale.copy(scale);
      object.rotation.set(rotation.x, rotation.y, rotation.z);

      // Add to scene and store reference
      this.scene.add(object);
      this.customModels.push(object);

      return object;
    } catch (error) {
      console.error("Error loading model:", error);
      throw error;
    }
  }
}
