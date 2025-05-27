// Three.js variables (for 3D graphics)
let scene; // The 3D world where all objects live
let camera; // The "eye" that looks at the 3D world
let renderer; // The tool that draws the 3D world on screen
let sphere; // The main 3D sphere object that reacts to music
let originalPositions; // Stores the original shape of the sphere

// Audio variables
let analyser; // Tool to analyze audio frequencies (currently simplified)
let audioContext; // Web browser's audio system controller
let animationId; // ID to control the animation loop

// State tracking variables (true/false flags)
let isPlaying = false; // Whether music is currently playing
let audioStarted = false; // Whether audio system has been initialized
let isRecording = false; // Whether we're recording user input
let isLooping = false; // Whether recorded music is looping

// Input tracking
let pressedKeys = new Set(); // Tracks which keyboard keys are currently pressed
let noteRectangles = []; // Array to store visual note rectangles

// Mouse interaction variables
let raycaster; // Tool to detect mouse clicks on 3D objects
let mouse; // Stores mouse position coordinates

// Audio management arrays (for handling multiple sounds at once)
let drumAudioSources = []; // Array of drum sound sources
let noteAudioSources = []; // Array of piano note sound sources

// Recording and looping variables
let recordedSequence = []; // Stores all recorded musical notes and timing
let recordingStartTime = 0; // When recording started (in seconds)
let activePianoNotes = new Map(); // Tracks which piano notes are currently being held down
let loopTimeouts = []; // Stores scheduled events for looping
let loopStartTime = 0; // When the loop started
let loopDuration = 0; // How long each loop cycle lasts

// Define which notes and keys correspond to what
// Piano configuration
const pianoNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5"];
// These are the musical notes (C4 = middle C, numbers indicate octave)

const pianoKeys = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
// These keyboard keys trigger the piano notes above (a=C4, s=D4, etc.)

const noteColors = [
  "#ff6b6b", // Red for C4
  "#4ecdc4", // Teal for D4
  "#45b7d1", // Blue for E4
  "#f9ca24", // Yellow for F4
  "#f0932b", // Orange for G4
  "#eb4d4d", // Dark red for A4
  "#6c5ce7", // Purple for B4
  "#a29bfe", // Light purple for C5
  "#fd79a8", // Pink for D5
];
// Each piano note gets a unique color for visualization

// Drum configuration
const drumNotes = ["C2", "D2", "E2", "F2", "G2", "A2", "B2"];
// Lower octave notes for drums (C2 is much lower than C4)

const drumKeys = ["z", "x", "c", "v", "b", "n", "m"];
// These keyboard keys trigger drum sounds

const drumColors = [
  "#e17055", // Reddish for first drum
  "#74b9ff", // Blue for second drum
  "#00b894", // Green for third drum
  "#fdcb6e", // Yellow for fourth drum
  "#6c5ce7", // Purple for fifth drum
  "#fd79a8", // Pink for sixth drum
  "#55a3ff", // Light blue for seventh drum
];

// These arrays store different versions of audio files for better performance

let drumBuffers = []; // Raw audio data for drums (currently unused)
let noteBuffers = []; // Raw audio data for notes (currently unused)
let drumAudioElements = []; // HTML audio elements for drums
let noteAudioElements = []; // HTML audio elements for notes
let drumAudioPools = []; // Multiple copies of each drum sound for instant playback
let noteAudioPools = []; // Multiple copies of each note sound for instant playback

async function initializeAudio() {
  // Check if audio has already been set up
  if (audioStarted) return; // Exit early if already initialized

  try {
    // Create the main audio system controller
    // Different browsers may call it different things, so we try both
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create an audio analyser (tool to examine audio frequencies)
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // How detailed the frequency analysis should be
    analyser.connect(audioContext.destination); // Connect to speakers

    // Load all the audio files from the server
    await loadAudioFiles();

    // Mark audio as successfully started
    audioStarted = true;
    console.log("Audio initialized successfully");
  } catch (error) {
    // If something goes wrong, log the error but don't crash
    console.error("Audio initialization failed:", error);
  }
}

// Audio file loading function
async function loadAudioFiles() {
  console.log("Loading audio files...");

  // Load drum sound files (drum1.mp3 through drum7.mp3)
  for (let i = 1; i <= 7; i++) {
    try {
      // Create a new HTML audio element for this drum sound
      const audio = new Audio(`drums/drum${i}.mp3`);
      audio.preload = "auto"; // Start downloading immediately
      audio.crossOrigin = "anonymous"; // Allow loading from different domains
      audio.volume = 0.7; // Set volume to 70%
      audio.load(); // Start loading the file
      drumAudioElements.push(audio); // Add to our collection

      // Create multiple copies of this sound for overlapping playback
      const pool = []; // Array to hold multiple copies
      for (let j = 0; j < 5; j++) {
        // Create 5 copies of each drum sound
        const poolAudio = new Audio(`drums/drum${i}.mp3`);
        poolAudio.preload = "auto";
        poolAudio.crossOrigin = "anonymous";
        poolAudio.volume = 0.7;
        poolAudio.load();
        pool.push(poolAudio); // Add this copy to the pool
      }
      drumAudioPools.push(pool); // Add the whole pool to our collection
    } catch (error) {
      // If loading fails, log error but add empty placeholders
      console.error(`Failed to load drum${i}.mp3:`, error);
      drumAudioElements.push(new Audio()); // Empty audio element
      drumAudioPools.push([]); // Empty pool
    }
  }

  // Load piano note sound files (note1.mp3 through note9.mp3)
  for (let i = 1; i <= 9; i++) {
    try {
      // Create a new HTML audio element for this note
      const audio = new Audio(`notes/note${i}.mp3`);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.volume = 0.6; // Piano notes slightly quieter than drums
      audio.load();
      noteAudioElements.push(audio);

      // Create multiple copies for overlapping playback
      const pool = [];
      for (let j = 0; j < 3; j++) {
        // Only 3 copies per note (fewer than drums)
        const poolAudio = new Audio(`notes/note${i}.mp3`);
        poolAudio.preload = "auto";
        poolAudio.crossOrigin = "anonymous";
        poolAudio.volume = 0.6;
        poolAudio.load();
        pool.push(poolAudio);
      }
      noteAudioPools.push(pool);
    } catch (error) {
      console.error(`Failed to load note${i}.mp3:`, error);
      noteAudioElements.push(new Audio());
      noteAudioPools.push([]);
    }
  }

  // Wait for all audio files to finish loading before continuing
  const allAudio = [...drumAudioElements, ...noteAudioElements];
  // The "..." spreads the arrays into individual elements
  const allPoolAudio = drumAudioPools.flat().concat(noteAudioPools.flat());
  // .flat() flattens nested arrays, .concat() joins arrays together

  // Create promises that resolve when each audio file is ready
  await Promise.all(
    [...allAudio, ...allPoolAudio].map((audio) => {
      return new Promise((resolve) => {
        if (audio.readyState >= 3) {
          // 3 means "can play through"
          resolve(); // This audio is already ready
        } else {
          // Wait for the audio to become ready
          audio.addEventListener("canplaythrough", resolve, {
            once: true, // Only listen for this event once
          });
          audio.addEventListener("error", resolve, { once: true });
        }
      });
    })
  );

  console.log("Audio files loaded and ready");
}

// Time ultility function
function getCurrentTime() {
  // Get current time in seconds (performance.now() gives milliseconds)
  return performance.now() / 1000;
}

// 3D graphics initialization
function initializeThreeJS() {
  // Find the HTML container where we'll put the 3D graphics
  const container = document.getElementById("three-container");

  // Create the 3D scene (like a stage where objects perform)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5); // Light gray background

  // Create the camera (point of view for looking at the scene)
  camera = new THREE.PerspectiveCamera(
    75, // Field of view (how wide the view is)
    800 / 600, // Aspect ratio (width divided by height)
    0.1, // Near clipping plane (closest visible distance)
    1000 // Far clipping plane (farthest visible distance)
  );
  camera.position.z = 5; // Move camera back so we can see objects

  // Create the renderer (the thing that actually draws the 3D scene)
  renderer = new THREE.WebGLRenderer({ antialias: true }); // Smooth edges
  renderer.setSize(800, 600); // Set the size of the 3D viewport
  renderer.shadowMap.enabled = true; // Enable shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadow type

  // Add the 3D canvas to the HTML page
  container.appendChild(renderer.domElement);

  // Create the main sphere object
  const geometry = new THREE.SphereGeometry(
    1.5, // Radius of the sphere
    64, // Number of width segments (more = smoother)
    32 // Number of height segments (more = smoother)
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0x333333, // Dark gray color
    wireframe: true, // Show as wireframe (just the lines)
    transparent: true, // Allow transparency
    opacity: 0.8, // 80% opaque
  });

  // Combine geometry and material to create the sphere
  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere); // Add sphere to the scene

  // Store the original vertex positions so we can deform and restore the sphere
  originalPositions = geometry.attributes.position.array.slice();
  // .slice() creates a copy of the array

  // Add lighting to the scene
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Dim overall light
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Bright directional light
  directionalLight.position.set(5, 5, 5); // Position the light
  scene.add(directionalLight);

  // Set up mouse interaction tools
  raycaster = new THREE.Raycaster(); // Tool to detect what mouse is pointing at
  mouse = new THREE.Vector2(); // Stores mouse coordinates

  // Listen for mouse clicks on the 3D canvas
  container.addEventListener("click", onSphereClick);

  // Start the animation loop
  animate();
}

// Set up a mouse click handler
function onSphereClick(event) {
  // Get the position of the 3D canvas on the page
  const rect = event.target.getBoundingClientRect();

  // Convert mouse coordinates to 3D space coordinates
  // This math converts from screen pixels to 3D coordinates (-1 to 1)
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Set up the raycaster to "shoot a ray" from camera through mouse position
  raycaster.setFromCamera(mouse, camera);

  // Check if the ray hits the sphere
  const intersects = raycaster.intersectObject(sphere);

  if (intersects.length > 0) {
    // If we hit the sphere
    toggleRecordingLoop(); // Start/stop recording or looping
  }
}

// Set Record and loop controls
async function toggleRecordingLoop() {
  // Make sure audio is initialized before doing anything
  await initializeAudio();

  console.log("Current state - Recording:", isRecording, "Looping:", isLooping);

  if (!isRecording && !isLooping) {
    // State 1: Not recording, not looping → Start recording
    startRecording();
  } else if (isRecording && !isLooping) {
    // State 2: Recording, not looping → Stop recording and start looping
    stopRecordingAndStartLoop();
  } else if (!isRecording && isLooping) {
    // State 3: Not recording, but looping → Stop looping
    stopLooping();
  }
}

// Start recording function
function startRecording() {
  isRecording = true; // Set recording flag to true
  recordedSequence = []; // Clear any previous recording
  recordingStartTime = getCurrentTime(); // Remember when we started

  // Make the sphere bigger to show we're recording
  sphere.scale.set(1.2, 1.2, 1.2);

  // Update the status message
  updateSphereStatus("recording", "Recording... Click again to loop");

  console.log("Started recording at time:", recordingStartTime);
}

// Stop recording and start looping
function stopRecordingAndStartLoop() {
  console.log("=== STOPPING RECORDING AND STARTING LOOP ===");
  console.log("Recorded sequence length:", recordedSequence.length);
  console.log("Full recorded sequence:", recordedSequence);

  // If nothing was recorded, just stop recording
  if (recordedSequence.length === 0) {
    console.log("No notes recorded, just stopping recording");
    stopRecording();
    return;
  }

  // Stop the recording phase
  isRecording = false;

  // Calculate how long the loop should be
  const sortedSequence = [...recordedSequence].sort((a, b) => a.time - b.time);
  // Sort events by time to find the last one
  const lastEvent = sortedSequence[sortedSequence.length - 1];

  // Calculate when the last sound actually ends
  const lastEventEndTime =
    lastEvent.time + (lastEvent.type === "piano" ? lastEvent.duration : 0.1);
  // Piano notes have duration, drums are short so we add 0.1 seconds

  // Set loop duration with a tiny buffer for seamless looping
  loopDuration = Math.max(1.0, lastEventEndTime + 0.05);

  console.log("Calculated loop duration:", loopDuration, "seconds (seamless)");

  // Start the looping phase
  isLooping = true;

  // Make sphere even bigger to show we're looping
  sphere.scale.set(1.5, 1.5, 1.5);
  updateSphereStatus("looping", "Looping... Click to stop");

  // Begin playing the recorded sequence in a loop
  startPlaybackLoop();
}

// Stop recording function
function stopRecording() {
  isRecording = false; // Turn off recording flag
  sphere.scale.set(1, 1, 1); // Return sphere to normal size
  updateSphereStatus(
    "idle",
    "Click the sphere to start recording your performance"
  );
}

// Stop looping function
function stopLooping() {
  isLooping = false; // Turn off looping flag

  // Cancel all scheduled sound events
  loopTimeouts.forEach((timeout) => clearTimeout(timeout));
  loopTimeouts = []; // Clear the array

  // Return sphere to normal size and update status
  sphere.scale.set(1, 1, 1);
  updateSphereStatus(
    "idle",
    "Click the sphere to start recording your performance"
  );

  console.log("Stopped looping");
}

// Playback the looping function
function startPlaybackLoop() {
  if (recordedSequence.length === 0) {
    console.log("No recorded sequence to play back");
    return;
  }

  console.log("Starting seamless playback loop with duration:", loopDuration);

  // Function that plays one complete loop iteration
  function playLoopIteration() {
    if (!isLooping) return; // Exit if looping was stopped

    console.log("=== Starting new loop iteration (seamless) ===");

    // Schedule each recorded event to play at its correct time
    recordedSequence.forEach((event) => {
      const noteTimeout = setTimeout(() => {
        if (!isLooping) return; // Double-check we're still looping

        console.log(
          `Playing ${event.type} ${event.note} at time ${event.time}`
        );

        if (event.type === "piano") {
          // Play piano note with its original duration
          playNoteAudioByIndex(event.index, event.duration);
          addNoteRectangle(
            event.note,
            event.color,
            event.duration * 1000, // Convert seconds to milliseconds
            event.index,
            false // false = not a drum
          );
        } else if (event.type === "drum") {
          // Play drum sound
          playDrumAudioByIndex(event.index);
          addNoteRectangle(event.note, event.color, 800, event.index, true);
          // true = is a drum, 800ms visual duration
        }
      }, event.time * 1000); // Convert seconds to milliseconds

      loopTimeouts.push(noteTimeout); // Keep track of this timeout
    });

    // Schedule the next loop iteration to start exactly when this one ends
    const nextLoopTimeout = setTimeout(() => {
      playLoopIteration(); // Recursively call itself
    }, loopDuration * 1000);

    loopTimeouts.push(nextLoopTimeout);
  }

  // Start the first loop iteration immediately
  playLoopIteration();
}

// Sphere status update function
function updateSphereStatus(state, message) {
  // Find the HTML elements that show the status
  const statusElement = document.getElementById("sphere-status");
  const containerElement = document.getElementById("visualization-container");

  // Update the CSS class and text content
  statusElement.className = `sphere-status ${state}`;
  statusElement.textContent = message;

  // Add special styling when looping
  if (state === "looping") {
    containerElement.classList.add("looping-active");
  } else {
    containerElement.classList.remove("looping-active");
  }
}

// Animation loop function
function animate() {
  // Schedule this function to run again on the next frame
  animationId = requestAnimationFrame(animate);

  if (sphere && audioStarted) {
    // Get access to the sphere's geometry (shape data)
    const geometry = sphere.geometry;
    const positions = geometry.attributes.position.array;

    // Create pseudo-audio effects with mathematical waves
    const time = Date.now() * 0.001; // Current time in seconds
    const amplitude = 0.1 + Math.sin(time * 2) * 0.05; // Wave amplitude

    // Deform each vertex of the sphere
    for (let i = 0; i < positions.length; i += 3) {
      // i += 3 because each vertex has x,y,z
      // Get original position of this vertex
      const originalX = originalPositions[i];
      const originalY = originalPositions[i + 1];
      const originalZ = originalPositions[i + 2];

      // Calculate wave-based deformation
      const wave1 = Math.sin(time + i * 0.01) * amplitude;
      const wave2 = Math.cos(time * 1.5 + i * 0.02) * amplitude * 0.5;
      const deformation = 1 + wave1 + wave2; // Combine waves

      // Apply deformation to vertex position
      positions[i] = originalX * deformation; // X coordinate
      positions[i + 1] = originalY * deformation; // Y coordinate
      positions[i + 2] = originalZ * deformation; // Z coordinate
    }

    // Tell Three.js that the geometry has changed and needs to be redrawn
    geometry.attributes.position.needsUpdate = true;
  }

  // Rotate the sphere continuously
  if (sphere) {
    sphere.rotation.x += 0.005; // Rotate around X axis
    sphere.rotation.y += 0.01; // Rotate around Y axis (faster)
  }

  // Render the scene (actually draw everything on screen)
  renderer.render(scene, camera);
}

// Drum audio playback function
function playDrumAudioByIndex(index) {
  // Check if the index is valid and we have audio for it
  if (
    index >= 0 &&
    index < drumAudioPools.length &&
    drumAudioPools[index].length > 0
  ) {
    // Get the pool of audio elements for this drum sound
    const pool = drumAudioPools[index];
    let audioToPlay = null;

    // Find an available audio element (one that's not playing)
    for (let audio of pool) {
      if (audio.paused || audio.ended || audio.currentTime === 0) {
        audioToPlay = audio;
        break; // Stop looking once we find one
      }
    }

    // If all are busy, just use the first one anyway
    if (!audioToPlay) {
      audioToPlay = pool[0];
    }

    // Play the audio if we have a valid element
    if (audioToPlay && audioToPlay.src) {
      audioToPlay.currentTime = 0; // Start from the beginning
      const playPromise = audioToPlay.play(); // Start playing

      // Handle any playback errors gracefully
      if (playPromise) {
        playPromise.catch((e) => {
          console.warn("Drum audio play failed:", e);
        });
      }
    }
  }
}

// Piano note audio playback function
function playNoteAudioByIndex(index, duration = 0.5) {
  // Check if the index is valid and we have audio for it
  if (
    index >= 0 &&
    index < noteAudioPools.length &&
    noteAudioPools[index].length > 0
  ) {
    // Get the pool of audio elements for this note
    const pool = noteAudioPools[index];
    let audioToPlay = null;

    // Find an available audio element
    for (let audio of pool) {
      if (audio.paused || audio.ended || audio.currentTime === 0) {
        audioToPlay = audio;
        break;
      }
    }

    // If all are busy, use the first one
    if (!audioToPlay) {
      audioToPlay = pool[0];
    }

    if (audioToPlay && audioToPlay.src) {
      audioToPlay.currentTime = 0; // Start from beginning
      const playPromise = audioToPlay.play();

      if (playPromise) {
        playPromise.catch((e) => console.warn("Note audio play failed:", e));
      }

      // Stop the audio after the specified duration (for sustained effect)
      setTimeout(() => {
        if (audioToPlay && !audioToPlay.paused) {
          audioToPlay.pause();
          audioToPlay.currentTime = 0;
        }
      }, duration * 1000); // Convert seconds to milliseconds
    }
  }
}

// Drum playing function
function playDrum(noteIndex = 0) {
  // Check if the index is within our drum range
  if (noteIndex < drumNotes.length) {
    const note = drumNotes[noteIndex]; // Get the note name

    // Play the drum sound
    playDrumAudioByIndex(noteIndex);

    // Add visual feedback (moving rectangle)
    addNoteRectangle(note, drumColors[noteIndex], 800, noteIndex, true);
    // 800ms duration, true = is a drum

    // If we're recording, add this drum hit to the recorded sequence
    if (isRecording) {
      const noteData = {
        type: "drum",
        note: note,
        time: getCurrentTime() - recordingStartTime, // Time since recording started
        duration: 0.5, // Drums have short duration
        color: drumColors[noteIndex],
        index: noteIndex,
      };
      recordedSequence.push(noteData); // Add to recording
      console.log("Recorded drum note:", noteData);
    }
  }
}

// Start piano note function
function startPianoNote(note, index) {
  // Only start if this note isn't already playing
  if (!activePianoNotes.has(note)) {
    const startTime = getCurrentTime();
    const recordingTime = isRecording ? startTime - recordingStartTime : 0;

    // Track this note as active
    activePianoNotes.set(note, {
      startTime: startTime,
      recordingTime: recordingTime,
      audioElement: null,
    });

    // Play the audio (2 second default duration)
    playNoteAudioByIndex(index, 2);

    // Add visual feedback
    addNoteRectangle(note, noteColors[index], 2000, index, false);
    // 2000ms duration, false = not a drum
  }
}

// Stop piano note function
function stopPianoNote(note, index) {
  // Only stop if this note is currently active
  if (activePianoNotes.has(note)) {
    const noteData = activePianoNotes.get(note);
    const endTime = getCurrentTime();
    const duration = endTime - noteData.startTime; // Calculate how long note was held

    // If we're recording, add this note to the recorded sequence
    if (isRecording) {
      const recordedNote = {
        type: "piano",
        note: note,
        time: noteData.recordingTime,
        duration: duration,
        color: noteColors[index],
        index: index,
      };
      recordedSequence.push(recordedNote);
      console.log("Recorded piano note:", recordedNote);
    }

    // Remove from active notes
    activePianoNotes.delete(note);
  }
}

// Visual note rectangle function
function addNoteRectangle(note, color, duration, pitch, isDrum) {
  // Find the HTML overlay where visual notes appear
  const overlay = document.getElementById("note-overlay");

  // Create a new div element for this note
  const rect = document.createElement("div");
  rect.className = "note-rect";
  rect.textContent = note; // Show the note name

  // Calculate position and size based on whether it's a drum or piano note
  const top = isDrum ? 500 + pitch * 15 : 20 + pitch * 60; // Drums lower, piano higher
  const width = isDrum ? 40 : 60; // Drums narrower
  const height = isDrum ? 20 : 40; // Drums shorter

  // Set the visual properties of the rectangle
  rect.style.cssText = `
    left: 0%;
    top: ${top}px;
    width: ${width}px;
    height: ${height}px;
    background-color: ${color};
    transform: translateX(-50%);
    transition: left ${duration}ms linear;
  `;

  // Add the rectangle to the overlay
  overlay.appendChild(rect);

  // Start the animation after a tiny delay (to ensure CSS is applied)
  setTimeout(() => {
    rect.style.left = "100%"; // Move to right side of screen
  }, 10);

  // Remove the rectangle after animation completes
  setTimeout(() => {
    if (rect.parentNode) {
      // Check if still in the DOM
      rect.parentNode.removeChild(rect);
    }
  }, duration + 100); // Small buffer time
}

// Keyboard event handlers
function handleKeyDown(event) {
  const key = event.key.toLowerCase(); // Convert to lowercase for consistency

  // Prevent repeated events if key is held down
  if (pressedKeys.has(key)) return;
  pressedKeys.add(key); // Mark this key as pressed

  // Check if it's a piano key
  const pianoKeyIndex = pianoKeys.indexOf(key);
  if (pianoKeyIndex !== -1) {
    // -1 means "not found"
    startPianoNote(pianoNotes[pianoKeyIndex], pianoKeyIndex);
    updateKeyDisplay(); // Update visual display
    updatePianoVisual(); // Update piano keyboard visual
    return; // Exit early since we handled the key
  }

  // Check if it's a drum key
  const drumKeyIndex = drumKeys.indexOf(key);
  if (drumKeyIndex !== -1) {
    playDrum(drumKeyIndex);
    updateKeyDisplay();
    return;
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  pressedKeys.delete(key); // Mark key as no longer pressed

  // For piano keys, we need to stop the sustained note
  const pianoKeyIndex = pianoKeys.indexOf(key);
  if (pianoKeyIndex !== -1) {
    stopPianoNote(pianoNotes[pianoKeyIndex], pianoKeyIndex);
  }

  // Update visual displays
  updateKeyDisplay();
  updatePianoVisual();
}

// Visual display update functions
function updateKeyDisplay() {
  // Update piano key display section
  const pianoDisplay = document.getElementById("piano-key-display");
  pianoDisplay.innerHTML = ""; // Clear existing content

  // Create a visual element for each piano key
  pianoKeys.forEach((key, index) => {
    const span = document.createElement("span"); // Create new span element

    // Set CSS class based on whether key is currently pressed
    span.className = `key-item ${pressedKeys.has(key) ? "active" : "inactive"}`;

    // Set the text content to show key and corresponding note
    span.textContent = `${key.toUpperCase()} = ${pianoNotes[index]}`;

    // If key is pressed, color it with the note's color
    if (pressedKeys.has(key)) {
      span.style.backgroundColor = noteColors[index];
    }

    pianoDisplay.appendChild(span); // Add to the display
  });

  // Update drum key display section (same process for drums)
  const drumDisplay = document.getElementById("drum-key-display");
  drumDisplay.innerHTML = ""; // Clear existing content

  drumKeys.forEach((key, index) => {
    const span = document.createElement("span");
    span.className = `key-item ${pressedKeys.has(key) ? "active" : "inactive"}`;
    span.textContent = `${key.toUpperCase()} = ${drumNotes[index]}`;

    if (pressedKeys.has(key)) {
      span.style.backgroundColor = drumColors[index];
    }

    drumDisplay.appendChild(span);
  });
}

// Piano visual keyboard update
function updatePianoVisual() {
  // Find the HTML element that shows the visual piano keyboard
  const pianoVisual = document.getElementById("piano-visual");
  pianoVisual.innerHTML = ""; // Clear existing piano keys

  // Create a button for each piano note
  pianoNotes.forEach((note, index) => {
    const key = document.createElement("button"); // Create button element

    // Set CSS class, add "pressed" if currently pressed
    key.className = `piano-key ${
      pressedKeys.has(pianoKeys[index]) ? "pressed" : ""
    }`;

    // Add mouse event handlers for clicking piano keys with mouse
    key.onmousedown = () => {
      startPianoNote(note, index); // Start playing the note
      key.classList.add("pressed"); // Add visual pressed state
    };

    key.onmouseup = () => {
      stopPianoNote(note, index); // Stop playing the note
      key.classList.remove("pressed"); // Remove visual pressed state
    };

    key.onmouseleave = () => {
      // Also stop if mouse leaves the button while pressed
      stopPianoNote(note, index);
      key.classList.remove("pressed");
    };

    // Set background color based on whether key is pressed
    const isPressed = pressedKeys.has(pianoKeys[index]);
    key.style.backgroundColor = isPressed
      ? noteColors[index] // Full color if pressed
      : noteColors[index] + "33"; // Transparent version if not pressed (33 = 20% alpha)

    // Set the HTML content of the button (keyboard key and note name)
    key.innerHTML = `
      <div class="piano-key-label">
        <div>${pianoKeys[index].toUpperCase()}</div>
        <div class="piano-key-note">${note}</div>
      </div>
    `;

    pianoVisual.appendChild(key); // Add button to piano visual
  });
}

// Main initialization function
async function init() {
  // Initialize the 3D graphics system
  initializeThreeJS();

  // Set up the initial visual displays
  updateKeyDisplay(); // Show keyboard mappings
  updatePianoVisual(); // Show visual piano

  // Pre-load audio for instant response (don't wait for user interaction)
  await initializeAudio();

  // Set up keyboard event listeners
  document.addEventListener("keydown", handleKeyDown); // When key is pressed down
  document.addEventListener("keyup", handleKeyUp); // When key is released

  // Make sure the page can receive keyboard events
  document.body.tabIndex = 0; // Make body focusable
  document.body.focus(); // Give focus to body element
}

// Application startup
// Wait for the entire page to load, then start the application
window.addEventListener("load", init);

// Summary of how the application works
/*
This is a musical instrument application that combines:

1. AUDIO SYSTEM:
   - Loads drum and piano sound files
   - Uses multiple copies of each sound for overlapping playback
   - Manages Web Audio API for sound processing

2. 3D VISUALIZATION:
   - Creates an animated, deforming sphere using Three.js
   - Sphere responds to audio and shows current state (idle/recording/looping)
   - Continuously rotates and deforms with wave patterns

3. INPUT HANDLING:
   - Keyboard keys trigger different sounds (piano: a-l, drums: z-m)
   - Mouse clicks on sphere control recording/looping
   - Visual feedback shows which keys are pressed

4. RECORDING & LOOPING:
   - Records timing and duration of all notes played
   - Can play back the recording in a seamless loop
   - Handles both sustained piano notes and percussive drums

5. VISUAL FEEDBACK:
   - Colored rectangles move across screen when notes play
   - Piano keyboard shows pressed keys
   - Status messages indicate current mode

The app flow:
- Load page → Initialize audio and 3D graphics
- Play music with keyboard → Sounds play + visuals appear
- Click sphere → Start recording
- Play music → Notes are recorded with timing
- Click sphere again → Stop recording, start looping
- Click sphere once more → Stop looping

This creates an interactive music loop station with 3D visualization!
*/
