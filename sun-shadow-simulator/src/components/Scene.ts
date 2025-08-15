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
  Object3D,
  BufferGeometry,
  Float32BufferAttribute,
  Box3,
  SphereGeometry,
  MeshBasicMaterial,
  CameraHelper,
  BoxGeometry,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SunCalculator, SunPosition } from "../utils/SunCalculator";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

interface CityJSON {
  vertices: { key: number; value: number[] }[];
  CityObjects: {
    [key: string]: {
      geometry: Array<{
        boundaries: number[][][];
        semantics?: {
          surfaces: Array<{ type: string }>;
          values: number[];
        };
        type: string;
      }>;
      type: string;
    };
  };
  transform: {
    scale: number[];
    translate: number[];
  };
}

export class GardenScene {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private controls: OrbitControls;
  private ground!: Mesh; // Using definite assignment assertion
  private sunlight!: DirectionalLight; // Using definite assignment assertion
  private directionMarkers!: Group; // Using definite assignment assertion
  private customModels: Object3D[] = [];

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

    // Load CityJSON buildings
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}/extracted.json`);
      const cityJSON = (await response.json()) as CityJSON;

      console.log("Loaded CityJSON:", cityJSON);
      console.log(
        "Number of buildings:",
        Object.keys(cityJSON.CityObjects).length
      );
      console.log("Transform:", cityJSON.transform);

      // Calculate center point for centering the buildings
      const centerX = cityJSON.transform.translate[0];
      const centerY = cityJSON.transform.translate[1];

      // Create materials for different surface types
      const materials = {
        GroundSurface: new MeshStandardMaterial({
          color: 0x808080,
          transparent: false,
          opacity: 1,
          side: 2,
        }),
        WallSurface: new MeshStandardMaterial({
          color: 0xcccccc,
          transparent: false,
          opacity: 1,
          side: 2,
        }),
        RoofSurface: new MeshStandardMaterial({
          color: 0x666666,
          transparent: false,
          opacity: 1,
          side: 2,
        }),
      };

      // Process each building
      Object.entries(cityJSON.CityObjects).forEach(([buildingId, building]) => {
        if (building.type !== "Building") return;

        console.log("Processing building:", buildingId);

        // Gather all Z (height) values for this building
        let minZ = Infinity;
        building.geometry.forEach((geom: { boundaries: number[][][] }) => {
          geom.boundaries.forEach((boundary: number[][]) => {
            boundary[0].forEach((vertexIndex: number) => {
              const vertex = cityJSON.vertices.find(x => x.key === vertexIndex);
              if (!vertex) {
                console.warn("Vertex not found:", vertexIndex);
                return
              }
              const z = vertex.value[2] * cityJSON.transform.scale[2];
              if (z < minZ) minZ = z;
            });
          });
        });

        building.geometry.forEach(
          (geom: {
            type: string;
            boundaries: number[][][];
            semantics?: { surfaces: Array<{ type: string }>; values: number[] };
          }) => {
            if (geom.type !== "MultiSurface") return;

            console.log(
              "Processing MultiSurface with",
              geom.boundaries.length,
              "surfaces"
            );

            // Process each surface
            geom.boundaries.forEach((boundary: number[][], index: number) => {
              // Get surface type from semantics
              const surfaceType =
                geom.semantics?.surfaces[geom.semantics.values[index]]?.type ||
                "WallSurface";
              const material = materials[surfaceType as keyof typeof materials];

              // Create geometry for this surface
              const geometry = new BufferGeometry();

              // Convert vertices
              const vertices: number[] = [];

              // Debug: Log first few raw vertices before transformation
              if (index === 0) {
                console.log('Raw vertex data (first 3):');
                for (let i = 0; i < Math.min(boundary[0].length, 3); i++) {
                  const vertexIndex = boundary[0][i];
                  const vertex = cityJSON.vertices.find(x => x.key === vertexIndex);
                  if (vertex) {
                    console.log(`Vertex ${i}:`, vertex.value);
                    console.log(`Scale:`, cityJSON.transform.scale);
                    console.log(`Translate:`, cityJSON.transform.translate);
                  }
                }
              }

              boundary[0].forEach((vertexIndex: number) => {
                const vertex = cityJSON.vertices.find(x => x.key === vertexIndex);
                if (!vertex) {
                  console.warn("Vertex not found:", vertexIndex);
                  return
                }
                // Apply transform: center X and Y, and align base to ground for Z
                const x =
                  (vertex.value[0] * cityJSON.transform.scale[0] +
                    cityJSON.transform.translate[0] -
                    centerX) *
                  0.1;
                const z =
                  (vertex.value[1] * cityJSON.transform.scale[1] +
                    cityJSON.transform.translate[1] -
                    centerY) *
                  0.1; // Y (CityJSON) -> Z (Three.js)
                const y =
                  (vertex.value[2] * cityJSON.transform.scale[2] - minZ) * 0.1; // Z (CityJSON) -> Y (Three.js), align base to ground
                vertices.push(x, y, z);
              });

              geometry.setAttribute(
                "position",
                new Float32BufferAttribute(vertices, 3)
              );

              // Compute vertex normals
              geometry.computeVertexNormals();

              // Create mesh
              const mesh = new Mesh(geometry, material);
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Log the first vertex position for debugging
              if (index === 0) {
                const firstVertex = new Vector3(
                  vertices[0],
                  vertices[1],
                  vertices[2]
                );
                console.log(
                  "First vertex position after transform:",
                  firstVertex
                );

                // Debug: Add small spheres at the first few vertices to see where they are
                for (let i = 0; i < Math.min(vertices.length / 3, 5); i++) {
                  const debugVertexGeometry = new SphereGeometry(0.2);
                  const debugVertexMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
                  const debugVertexSphere = new Mesh(debugVertexGeometry, debugVertexMaterial);
                  debugVertexSphere.position.set(
                    vertices[i * 3],
                    vertices[i * 3 + 1],
                    vertices[i * 3 + 2]
                  );
                  // this.scene.add(debugVertexSphere);
                }
              }

              console.log('Adding mesh');

              // Debug: Log mesh dimensions and position
              const box = new Box3().setFromObject(mesh);
              const size = box.getSize(new Vector3());
              const center = box.getCenter(new Vector3());
              console.log('Mesh dimensions:', size);
              console.log('Mesh center:', center);
              console.log('Mesh position:', mesh.position);

              // Debug: Add a small visible sphere at the mesh center to see where it is
              const debugGeometry = new SphereGeometry(0.5);
              const debugMaterial = new MeshBasicMaterial({ color: 0xff0000 });
              const debugSphere = new Mesh(debugGeometry, debugMaterial);
              debugSphere.position.copy(center);
              // this.scene.add(debugSphere);

              this.scene.add(mesh);
            });
          }
        );
      });
    } catch (error) {
      console.error("Error loading CityJSON:", error);
    }

    // Debug: Log overall scene bounds after all buildings are added
    console.log('Scene children count:', this.scene.children.length);

    // Create a temporary group to calculate overall bounds
    const tempGroup = new Group();
    this.scene.children.forEach(child => {
      if (child instanceof Mesh && child !== this.ground) {
        tempGroup.add(child.clone());
      }
    });

    if (tempGroup.children.length > 0) {
      const overallBox = new Box3().setFromObject(tempGroup);
      const overallSize = overallBox.getSize(new Vector3());
      const overallCenter = overallBox.getCenter(new Vector3());
      console.log('Overall buildings bounds:', overallBox);
      console.log('Overall buildings size:', overallSize);
      console.log('Overall buildings center:', overallCenter);

      // Add a large wireframe box to show the overall bounds
      const boundsGeometry = new BoxGeometry(overallSize.x, overallSize.y, overallSize.z);
      const boundsMaterial = new MeshBasicMaterial({
        color: 0xffff00,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      const boundsMesh = new Mesh(boundsGeometry, boundsMaterial);
      boundsMesh.position.copy(overallCenter);
      this.scene.add(boundsMesh);

      // Debug: Auto-adjust camera to frame all objects
      this.frameAllObjects();
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

    // Add axes helper
    const axesHelper = new AxesHelper(45);
    this.scene.add(axesHelper);

    // Add grid for better reference
    const gridHelper = new GridHelper(90, 90);
    this.scene.add(gridHelper);

    // Debug: Add camera helper to visualize camera frustum
    const cameraHelper = new CameraHelper(this.camera);
    this.scene.add(cameraHelper);

    // Debug: Log camera position and target
    console.log('Camera position:', this.camera.position);
    console.log('Camera target (lookAt):', new Vector3(0, 0, 0));
    console.log('Camera near/far:', this.camera.near, this.camera.far);

    // Add cardinal direction markers
    this.addCardinalDirections();

    // Debug: Add a simple test cube to verify rendering is working
    const testGeometry = new BoxGeometry(5, 5, 5);
    const testMaterial = new MeshBasicMaterial({ color: 0xff0000 });
    const testCube = new Mesh(testGeometry, testMaterial);
    testCube.position.set(0, 2.5, 0);
    this.scene.add(testCube);
    console.log('Added test cube at position:', testCube.position);
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

  // Debug method to frame all objects in the scene
  private frameAllObjects(): void {
    if (this.scene.children.length === 0) return;

    // Create a bounding box for all objects (excluding helpers and lights)
    const box = new Box3();
    this.scene.children.forEach(child => {
      if (child instanceof Mesh && child !== this.ground) {
        box.expandByObject(child);
      }
    });

    if (box.isEmpty()) return;

    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());

    // Calculate the distance needed to frame all objects
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    // Add some padding
    cameraZ *= 1.5;

    // Position camera
    this.camera.position.set(center.x, center.y + cameraZ * 0.5, center.z + cameraZ);
    this.camera.lookAt(center);

    // Update controls target
    this.controls.target.copy(center);
    this.controls.update();

    console.log('Camera repositioned to frame all objects');
    console.log('New camera position:', this.camera.position);
    console.log('New camera target:', center);
  }
}
