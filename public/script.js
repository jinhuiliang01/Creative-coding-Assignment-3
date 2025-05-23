// Global variables
let scene, camera, renderer, sphere, originalPositions;
let analyser, audioContext;
let animationId;
let isPlaying = false;
let audioStarted = false;
let pressedKeys = new Set();
let noteRectangles = [];
let raycaster, mouse;

// Audio arrays for managing multiple instances
let drumAudioSources = [];
let noteAudioSources = [];

// Recording and looping variables
let isRecording = false;
let isLooping = false;
let recordedSequence = [];
let recordingStartTime = 0;
let activePianoNotes = new Map(); // Track sustained piano notes
let loopTimeouts = []; // Track scheduled loops for cleanup
let loopStartTime = 0;
let loopDuration = 0;

// Piano and drum configurations
const pianoNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5"];
const pianoKeys = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const noteColors = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#f9ca24",
  "#f0932b",
  "#eb4d4d",
  "#6c5ce7",
  "#a29bfe",
  "#fd79a8",
];

const drumNotes = ["C2", "D2", "E2", "F2", "G2", "A2", "B2"];
const drumKeys = ["z", "x", "c", "v", "b", "n", "m"];
const drumColors = [
  "#e17055",
  "#74b9ff",
  "#00b894",
  "#fdcb6e",
  "#6c5ce7",
  "#fd79a8",
  "#55a3ff",
];

// Audio buffer arrays
let drumBuffers = [];
let noteBuffers = [];
let drumAudioElements = [];
let noteAudioElements = [];
let drumAudioPools = []; // Pre-loaded audio pools for instant playback
let noteAudioPools = [];

// Initialize audio
async function initializeAudio() {
  if (audioStarted) return;

  try {
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(audioContext.destination);

    // Load audio files
    await loadAudioFiles();

    audioStarted = true;
    console.log("Audio initialized successfully");
  } catch (error) {
    console.error("Audio initialization failed:", error);
  }
}

// Load audio files
async function loadAudioFiles() {
  console.log("Loading audio files...");

  // Load drum audio files with optimized settings
  for (let i = 1; i <= 7; i++) {
    try {
      const audio = new Audio(`drums/drum${i}.mp3`);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.volume = 0.7;
      audio.load();
      drumAudioElements.push(audio);

      // Create audio pool for instant playback (5 copies per sound)
      const pool = [];
      for (let j = 0; j < 5; j++) {
        const poolAudio = new Audio(`drums/drum${i}.mp3`);
        poolAudio.preload = "auto";
        poolAudio.crossOrigin = "anonymous";
        poolAudio.volume = 0.7;
        poolAudio.load();
        pool.push(poolAudio);
      }
      drumAudioPools.push(pool);
    } catch (error) {
      console.error(`Failed to load drum${i}.mp3:`, error);
      drumAudioElements.push(new Audio());
      drumAudioPools.push([]);
    }
  }

  // Load note audio files with optimized settings
  for (let i = 1; i <= 9; i++) {
    try {
      const audio = new Audio(`notes/note${i}.mp3`);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audio.volume = 0.6;
      audio.load();
      noteAudioElements.push(audio);

      // Create audio pool for instant playback (3 copies per sound)
      const pool = [];
      for (let j = 0; j < 3; j++) {
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

  // Wait for all audio files to be ready
  const allAudio = [...drumAudioElements, ...noteAudioElements];
  const allPoolAudio = drumAudioPools.flat().concat(noteAudioPools.flat());

  await Promise.all(
    [...allAudio, ...allPoolAudio].map((audio) => {
      return new Promise((resolve) => {
        if (audio.readyState >= 3) {
          resolve();
        } else {
          audio.addEventListener("canplaythrough", resolve, {
            once: true,
          });
          audio.addEventListener("error", resolve, { once: true });
        }
      });
    })
  );

  console.log("Audio files loaded and ready");
}

// Get current time (replacement for Tone.now())
function getCurrentTime() {
  return performance.now() / 1000;
}

// Initialize Three.js
function initializeThreeJS() {
  const container = document.getElementById("three-container");

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  // Camera setup
  camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
  camera.position.z = 5;

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(800, 600);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.appendChild(renderer.domElement);

  // Create sphere
  const geometry = new THREE.SphereGeometry(1.5, 64, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x333333,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
  });

  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // Store original positions
  originalPositions = geometry.attributes.position.array.slice();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Setup raycaster for mouse interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Add click event listener
  container.addEventListener("click", onSphereClick);

  // Start animation
  animate();
}

// Handle sphere click
function onSphereClick(event) {
  const rect = event.target.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(sphere);

  if (intersects.length > 0) {
    toggleRecordingLoop();
  }
}

// Toggle recording/looping
async function toggleRecordingLoop() {
  await initializeAudio();

  console.log("Current state - Recording:", isRecording, "Looping:", isLooping);

  if (!isRecording && !isLooping) {
    // Start recording
    startRecording();
  } else if (isRecording && !isLooping) {
    // Stop recording and start looping
    stopRecordingAndStartLoop();
  } else if (!isRecording && isLooping) {
    // Stop looping
    stopLooping();
  }
}

// Start recording
function startRecording() {
  isRecording = true;
  recordedSequence = [];
  recordingStartTime = getCurrentTime();

  // Update sphere size and status
  sphere.scale.set(1.2, 1.2, 1.2);
  updateSphereStatus("recording", "Recording... Click again to loop");

  console.log("Started recording at time:", recordingStartTime);
}

// Stop recording and start looping
function stopRecordingAndStartLoop() {
  console.log("=== STOPPING RECORDING AND STARTING LOOP ===");
  console.log("Recorded sequence length:", recordedSequence.length);
  console.log("Full recorded sequence:", recordedSequence);

  if (recordedSequence.length === 0) {
    console.log("No notes recorded, just stopping recording");
    stopRecording();
    return;
  }

  // Stop recording
  isRecording = false;

  // Calculate loop duration based on the last event - NO EXTRA BUFFER
  const sortedSequence = [...recordedSequence].sort((a, b) => a.time - b.time);
  const lastEvent = sortedSequence[sortedSequence.length - 1];

  // For piano notes, add their duration to get the true end time
  // For drums, add a small amount for the sound to complete
  const lastEventEndTime =
    lastEvent.time + (lastEvent.type === "piano" ? lastEvent.duration : 0.1);

  // Use the exact musical duration with minimal buffer (0.05s max)
  loopDuration = Math.max(1.0, lastEventEndTime + 0.05);

  console.log("Calculated loop duration:", loopDuration, "seconds (seamless)");

  // Start looping
  isLooping = true;

  // Update sphere size and status
  sphere.scale.set(1.5, 1.5, 1.5);
  updateSphereStatus("looping", "Looping... Click to stop");

  // Start the loop
  startPlaybackLoop();
}

// Stop recording
function stopRecording() {
  isRecording = false;
  sphere.scale.set(1, 1, 1);
  updateSphereStatus(
    "idle",
    "Click the sphere to start recording your performance"
  );
}

// Stop looping
function stopLooping() {
  isLooping = false;

  // Clear all scheduled timeouts
  loopTimeouts.forEach((timeout) => clearTimeout(timeout));
  loopTimeouts = [];

  sphere.scale.set(1, 1, 1);
  updateSphereStatus(
    "idle",
    "Click the sphere to start recording your performance"
  );

  console.log("Stopped looping");
}

// Start playback loop
function startPlaybackLoop() {
  if (recordedSequence.length === 0) {
    console.log("No recorded sequence to play back");
    return;
  }

  console.log("Starting seamless playback loop with duration:", loopDuration);

  // Function to play one loop iteration
  function playLoopIteration() {
    if (!isLooping) return;

    console.log("=== Starting new loop iteration (seamless) ===");

    // Schedule each recorded event
    recordedSequence.forEach((event) => {
      const noteTimeout = setTimeout(() => {
        if (!isLooping) return;

        console.log(
          `Playing ${event.type} ${event.note} at time ${event.time}`
        );

        if (event.type === "piano") {
          playNoteAudioByIndex(event.index, event.duration);
          addNoteRectangle(
            event.note,
            event.color,
            event.duration * 1000,
            event.index,
            false
          );
        } else if (event.type === "drum") {
          playDrumAudioByIndex(event.index);
          addNoteRectangle(event.note, event.color, 800, event.index, true);
        }
      }, event.time * 1000);

      loopTimeouts.push(noteTimeout);
    });

    // Schedule the next loop iteration with precise timing - NO GAP
    const nextLoopTimeout = setTimeout(() => {
      playLoopIteration();
    }, loopDuration * 1000);

    loopTimeouts.push(nextLoopTimeout);
  }

  // Start the first loop iteration immediately
  playLoopIteration();
}

// Update sphere status
function updateSphereStatus(state, message) {
  const statusElement = document.getElementById("sphere-status");
  const containerElement = document.getElementById("visualization-container");

  statusElement.className = `sphere-status ${state}`;
  statusElement.textContent = message;

  if (state === "looping") {
    containerElement.classList.add("looping-active");
  } else {
    containerElement.classList.remove("looping-active");
  }
}

// Animation loop with simplified audio analysis
function animate() {
  animationId = requestAnimationFrame(animate);

  if (sphere && audioStarted) {
    // Simple audio-reactive deformation based on recent activity
    const geometry = sphere.geometry;
    const positions = geometry.attributes.position.array;

    // Create a pseudo-frequency effect based on recent audio activity
    const time = Date.now() * 0.001;
    const amplitude = 0.1 + Math.sin(time * 2) * 0.05;

    // Deform sphere based on pseudo audio data
    for (let i = 0; i < positions.length; i += 3) {
      const originalX = originalPositions[i];
      const originalY = originalPositions[i + 1];
      const originalZ = originalPositions[i + 2];

      // Calculate deformation with wave patterns
      const wave1 = Math.sin(time + i * 0.01) * amplitude;
      const wave2 = Math.cos(time * 1.5 + i * 0.02) * amplitude * 0.5;
      const deformation = 1 + wave1 + wave2;

      positions[i] = originalX * deformation;
      positions[i + 1] = originalY * deformation;
      positions[i + 2] = originalZ * deformation;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  // Rotate sphere
  if (sphere) {
    sphere.rotation.x += 0.005;
    sphere.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
}

// Play drum audio by index with minimal latency
function playDrumAudioByIndex(index) {
  if (
    index >= 0 &&
    index < drumAudioPools.length &&
    drumAudioPools[index].length > 0
  ) {
    // Find the first available audio element in the pool
    const pool = drumAudioPools[index];
    let audioToPlay = null;

    for (let audio of pool) {
      if (audio.paused || audio.ended || audio.currentTime === 0) {
        audioToPlay = audio;
        break;
      }
    }

    // If no available audio found, use the first one anyway
    if (!audioToPlay) {
      audioToPlay = pool[0];
    }

    if (audioToPlay && audioToPlay.src) {
      audioToPlay.currentTime = 0;
      const playPromise = audioToPlay.play();
      if (playPromise) {
        playPromise.catch((e) => {
          console.warn("Drum audio play failed:", e);
        });
      }
    }
  }
}

// Play note audio by index with minimal latency
function playNoteAudioByIndex(index, duration = 0.5) {
  if (
    index >= 0 &&
    index < noteAudioPools.length &&
    noteAudioPools[index].length > 0
  ) {
    // Find the first available audio element in the pool
    const pool = noteAudioPools[index];
    let audioToPlay = null;

    for (let audio of pool) {
      if (audio.paused || audio.ended || audio.currentTime === 0) {
        audioToPlay = audio;
        break;
      }
    }

    // If no available audio found, use the first one anyway
    if (!audioToPlay) {
      audioToPlay = pool[0];
    }

    if (audioToPlay && audioToPlay.src) {
      audioToPlay.currentTime = 0;
      const playPromise = audioToPlay.play();
      if (playPromise) {
        playPromise.catch((e) => console.warn("Note audio play failed:", e));
      }

      // Stop after duration for sustained effect
      setTimeout(() => {
        if (audioToPlay && !audioToPlay.paused) {
          audioToPlay.pause();
          audioToPlay.currentTime = 0;
        }
      }, duration * 1000);
    }
  }
}

// Play drum
function playDrum(noteIndex = 0) {
  if (noteIndex < drumNotes.length) {
    const note = drumNotes[noteIndex];

    // Play the audio file (no await needed)
    playDrumAudioByIndex(noteIndex);

    // Add visual note
    addNoteRectangle(note, drumColors[noteIndex], 800, noteIndex, true);

    // Record if recording
    if (isRecording) {
      const noteData = {
        type: "drum",
        note: note,
        time: getCurrentTime() - recordingStartTime,
        duration: 0.5,
        color: drumColors[noteIndex],
        index: noteIndex,
      };
      recordedSequence.push(noteData);
      console.log("Recorded drum note:", noteData);
    }
  }
}

// Play piano note (start)
function startPianoNote(note, index) {
  if (!activePianoNotes.has(note)) {
    const startTime = getCurrentTime();
    const recordingTime = isRecording ? startTime - recordingStartTime : 0;

    activePianoNotes.set(note, {
      startTime: startTime,
      recordingTime: recordingTime,
      audioElement: null,
    });

    // Play the audio file (no await needed)
    playNoteAudioByIndex(index, 2); // 2 second default duration

    // Add visual note
    addNoteRectangle(note, noteColors[index], 2000, index, false);
  }
}

// Stop piano note
function stopPianoNote(note, index) {
  if (activePianoNotes.has(note)) {
    const noteData = activePianoNotes.get(note);
    const endTime = getCurrentTime();
    const duration = endTime - noteData.startTime;

    // Record if recording
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

    activePianoNotes.delete(note);
  }
}

// Add note rectangle
function addNoteRectangle(note, color, duration, pitch, isDrum) {
  const overlay = document.getElementById("note-overlay");
  const rect = document.createElement("div");
  rect.className = "note-rect";
  rect.textContent = note;

  const top = isDrum ? 500 + pitch * 15 : 20 + pitch * 60;
  const width = isDrum ? 40 : 60;
  const height = isDrum ? 20 : 40;

  rect.style.cssText = `
    left: 0%;
    top: ${top}px;
    width: ${width}px;
    height: ${height}px;
    background-color: ${color};
    transform: translateX(-50%);
    transition: left ${duration}ms linear;
  `;

  overlay.appendChild(rect);

  // Animate
  setTimeout(() => {
    rect.style.left = "100%";
  }, 10);

  // Remove after animation
  setTimeout(() => {
    if (rect.parentNode) {
      rect.parentNode.removeChild(rect);
    }
  }, duration + 100);
}

// Keyboard handlers
function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  if (pressedKeys.has(key)) return;
  pressedKeys.add(key);

  // Piano keys
  const pianoKeyIndex = pianoKeys.indexOf(key);
  if (pianoKeyIndex !== -1) {
    startPianoNote(pianoNotes[pianoKeyIndex], pianoKeyIndex);
    updateKeyDisplay();
    updatePianoVisual();
    return;
  }

  // Drum keys
  const drumKeyIndex = drumKeys.indexOf(key);
  if (drumKeyIndex !== -1) {
    playDrum(drumKeyIndex);
    updateKeyDisplay();
    return;
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  pressedKeys.delete(key);

  // Piano keys
  const pianoKeyIndex = pianoKeys.indexOf(key);
  if (pianoKeyIndex !== -1) {
    stopPianoNote(pianoNotes[pianoKeyIndex], pianoKeyIndex);
  }

  updateKeyDisplay();
  updatePianoVisual();
}

// Update key displays
function updateKeyDisplay() {
  // Update piano key display
  const pianoDisplay = document.getElementById("piano-key-display");
  pianoDisplay.innerHTML = "";
  pianoKeys.forEach((key, index) => {
    const span = document.createElement("span");
    span.className = `key-item ${pressedKeys.has(key) ? "active" : "inactive"}`;
    span.textContent = `${key.toUpperCase()} = ${pianoNotes[index]}`;
    if (pressedKeys.has(key)) {
      span.style.backgroundColor = noteColors[index];
    }
    pianoDisplay.appendChild(span);
  });

  // Update drum key display
  const drumDisplay = document.getElementById("drum-key-display");
  drumDisplay.innerHTML = "";
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

// Update piano visual
function updatePianoVisual() {
  const pianoVisual = document.getElementById("piano-visual");
  pianoVisual.innerHTML = "";
  pianoNotes.forEach((note, index) => {
    const key = document.createElement("button");
    key.className = `piano-key ${
      pressedKeys.has(pianoKeys[index]) ? "pressed" : ""
    }`;

    // Add mouse events for piano keys
    key.onmousedown = () => {
      startPianoNote(note, index);
      key.classList.add("pressed");
    };
    key.onmouseup = () => {
      stopPianoNote(note, index);
      key.classList.remove("pressed");
    };
    key.onmouseleave = () => {
      stopPianoNote(note, index);
      key.classList.remove("pressed");
    };

    const isPressed = pressedKeys.has(pianoKeys[index]);
    key.style.backgroundColor = isPressed
      ? noteColors[index]
      : noteColors[index] + "33";

    key.innerHTML = `
      <div class="piano-key-label">
        <div>${pianoKeys[index].toUpperCase()}</div>
        <div class="piano-key-note">${note}</div>
      </div>
    `;
    pianoVisual.appendChild(key);
  });
}

// Initialize everything
async function init() {
  initializeThreeJS();
  updateKeyDisplay();
  updatePianoVisual();

  // Pre-initialize audio for instant response
  await initializeAudio();

  // Add event listeners
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  // Focus on the page to ensure key events work
  document.body.tabIndex = 0;
  document.body.focus();
}

// Start when page loads
window.addEventListener("load", init);
