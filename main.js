// Scene variables
let scene, camera, renderer, controls;
let ground, house, sunLight;

// DOM elements
const canvas = document.getElementById('canvas');
const dateInput = document.getElementById('date');
const timeInput = document.getElementById('time');
const latInput = document.getElementById('latitude');
const lngInput = document.getElementById('longitude');
const updateBtn = document.getElementById('update');

// Initialize with defaults
const today = new Date();
dateInput.value = today.toISOString().slice(0, 10);
timeInput.value = today.getHours().toString().padStart(2, '0') + ':' + 
                 today.getMinutes().toString().padStart(2, '0');
latInput.value = '52.3676'; // Amsterdam by default
lngInput.value = '4.9041';  // Feel free to change to your location

// Initialize scene
init();
animate();

// Set up event listeners
updateBtn.addEventListener('click', updateSunPosition);

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera
    camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / (window.innerHeight - document.getElementById('controls').offsetHeight), 
        0.1, 
        1000
    );
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight - document.getElementById('controls').offsetHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Create orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Create ground (20x20 meters)
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x7CFC00,  // Lawn green
        side: THREE.DoubleSide
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create house (cube 3x3x3 meters)
    const houseGeometry = new THREE.BoxGeometry(3, 3, 3);
    const houseMaterial = new THREE.MeshStandardMaterial({ color: 0xD2B48C }); // Tan color
    house = new THREE.Mesh(houseGeometry, houseMaterial);
    house.position.y = 1.5; // Position so bottom is on ground
    house.castShadow = true;
    house.receiveShadow = true;
    scene.add(house);
    
    // Create sunlight (directional light)
    sunLight = new THREE.DirectionalLight(0xFFFFAA, 3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -15;
    sunLight.shadow.camera.right = 15;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    scene.add(sunLight);
    
    // Add ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    // Add axes helper
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);
    
    // Add grid for better reference
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);
    
    // Initialize sun position
    updateSunPosition();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function updateSunPosition() {
    // Get input values
    const date = new Date(dateInput.value + 'T' + timeInput.value);
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    
    // Calculate sun position
    const sunPosition = SunCalc.getPosition(date, lat, lng);
    
    // Extract altitude and azimuth
    const altitude = sunPosition.altitude; // Height above horizon in radians
    const azimuth = sunPosition.azimuth;   // Direction from north in radians
    
    // Convert to cartesian coordinates
    // Note: In Three.js, Y is up, X is east-west, Z is north-south
    const distance = 30; // Distance from origin
    
    // Convert from spherical to cartesian
    // Note: SunCalc azimuth is measured clockwise from south
    //       We need to convert to Three.js coordinates
    const x = distance * Math.cos(altitude) * Math.sin(azimuth);
    const y = distance * Math.sin(altitude);
    const z = distance * Math.cos(altitude) * Math.cos(azimuth);
    
    // Position the sun light
    sunLight.position.set(x, y, z);
    
    // Update light target
    sunLight.target.position.set(0, 0, 0);
    scene.add(sunLight.target);
    
    // Set light intensity based on sun altitude
    // No sun below horizon (night)
    if (altitude <= 0) {
        sunLight.intensity = 0.1;  // Almost dark
    } else {
        // Scale from 0.5 (dawn/dusk) to 3 (noon)
        sunLight.intensity = 0.5 + 2.5 * Math.sin(altitude);
    }
    
    // Show sun position info in console
    console.log(`Sun position: altitude ${THREE.MathUtils.radToDeg(altitude).toFixed(2)}°, azimuth ${THREE.MathUtils.radToDeg(azimuth).toFixed(2)}°`);
    console.log(`Sun light position: x:${x.toFixed(2)}, y:${y.toFixed(2)}, z:${z.toFixed(2)}`);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / (window.innerHeight - document.getElementById('controls').offsetHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight - document.getElementById('controls').offsetHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}