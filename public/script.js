// Global variables
let scene, camera, renderer, sphere, originalPositions;
let analyser, drumSynth, pianoSynth;
let animationId;
let isPlaying = false;
let audioStarted = false;
let pressedKeys = new Set();
let noteRectangles = [];
let raycaster, mouse;

// Recording and looping variables
let isRecording = false;
let isLooping = false;
let recordedSequence = [];
let recordingStartTime = 0;
let activePianoNotes = new Map(); // Track sustained piano notes
let scheduledLoops = []; // Track scheduled loops for cleanup

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

// Initialize audio
async function initializeAudio() {
  if (audioStarted) return;

  try {
    await Tone.start();

    // Create drum synth
    drumSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 10,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 1.4,
      },
    }).toDestination();

    // Create piano synth
    pianoSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();

    // Create analyser
    analyser = new Tone.Analyser("fft", 128);
    Tone.Destination.connect(analyser);

    audioStarted = true;
    console.log("Audio initialized successfully");
  } catch (error) {
    console.error("Audio initialization failed:", error);
  }
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
  recordingStartTime = Tone.now();

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

  // Important: Set isRecording to false BEFORE starting loop
  isRecording = false;
  isLooping = true;

  // Update sphere size and status
  sphere.scale.set(1.5, 1.5, 1.5);
  updateSphereStatus("looping", "Looping... Click to stop");

  console.log("About to start playback loop...");

  // Start the loop
  startPlaybackLoop();

  console.log("Loop should now be playing!");
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

  // Stop transport and clear all scheduled events
  Tone.Transport.stop();
  Tone.Transport.cancel();

  // Clean up all scheduled loops
  scheduledLoops.forEach((loop) => loop.dispose());
  scheduledLoops = [];

  if (currentLoop) {
    currentLoop.dispose();
    currentLoop = null;
  }

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

  // Sort notes by their original recording time to preserve the musical sequence
  const sortedNotes = [...recordedSequence].sort((a, b) => a.time - b.time);

  // Separate piano and drum notes for different processing
  const pianoNotes = sortedNotes.filter((note) => note.type === "piano");
  const drumNotes = sortedNotes.filter((note) => note.type === "drum");

  let normalizedSequence = [];
  let firstNoteTime = sortedNotes[0].time;
  let musicalDuration = 0;

  if (pianoNotes.length > 0 && drumNotes.length > 0) {
    // Mixed piano and drums - preserve exact timing for both
    const lastNote = sortedNotes[sortedNotes.length - 1];
    const lastNoteEndTime =
      lastNote.time + (lastNote.type === "piano" ? lastNote.duration : 0.3);
    musicalDuration = lastNoteEndTime - firstNoteTime;

    normalizedSequence = sortedNotes.map((note) => ({
      ...note,
      normalizedTime: note.time - firstNoteTime,
    }));

    console.log("Mixed piano/drums - preserving exact timing");
  } else if (drumNotes.length > 0 && pianoNotes.length === 0) {
    // Only drums - create tight rhythm by reducing gaps
    console.log("Drums only - creating tight rhythm");

    let currentTime = 0;
    const minDrumGap = 0.15; // Minimum gap between drum hits
    const maxDrumGap = 0.6; // Maximum gap to compress

    normalizedSequence = drumNotes.map((note, index) => {
      const result = {
        ...note,
        normalizedTime: currentTime,
      };

      // Calculate gap to next drum hit
      if (index < drumNotes.length - 1) {
        const originalGap = drumNotes[index + 1].time - note.time;
        const compressedGap =
          originalGap > maxDrumGap
            ? maxDrumGap
            : Math.max(originalGap, minDrumGap);
        currentTime += compressedGap;
      }

      return result;
    });

    musicalDuration = currentTime + 0.3; // Add small buffer for last drum
    firstNoteTime = 0;
  } else {
    // Only piano notes - preserve exact timing
    const lastNote = pianoNotes[pianoNotes.length - 1];
    const lastNoteEndTime = lastNote.time + lastNote.duration;
    musicalDuration = lastNoteEndTime - firstNoteTime;

    normalizedSequence = pianoNotes.map((note) => ({
      ...note,
      normalizedTime: note.time - firstNoteTime,
    }));

    console.log("Piano only - preserving exact timing");
  }

  // Total loop duration = musical content + small buffer for loop gap
  const totalLoopDuration = Math.max(0.5, musicalDuration + 0.2);

  console.log("Loop timing analysis:");
  console.log("- Piano notes:", pianoNotes.length);
  console.log("- Drum notes:", drumNotes.length);
  console.log(
    "- Musical content duration:",
    musicalDuration.toFixed(2),
    "seconds"
  );
  console.log(
    "- Total loop duration:",
    totalLoopDuration.toFixed(2),
    "seconds"
  );
  console.log("- Normalized sequence:", normalizedSequence);

  // Stop and clear any existing transport
  Tone.Transport.stop();
  Tone.Transport.cancel();

  // Clear any existing loops
  scheduledLoops.forEach((loop) => {
    if (loop && loop.dispose) loop.dispose();
  });
  scheduledLoops = [];

  // Create the main repeating loop
  const mainLoop = new Tone.Loop((loopTime) => {
    console.log("=== Starting loop iteration ===");

    // Play each note at its calculated time
    normalizedSequence.forEach((note, index) => {
      const noteTime = loopTime + note.normalizedTime;

      console.log(
        `Playing ${note.type} ${note.note} at +${note.normalizedTime.toFixed(
          2
        )}s`
      );

      if (note.type === "piano") {
        pianoSynth.triggerAttackRelease(note.note, note.duration, noteTime);
      } else if (note.type === "drum") {
        drumSynth.triggerAttackRelease(note.note, "8n", noteTime);
      }

      // Schedule visual feedback
      const visualDelay = (noteTime - Tone.now()) * 1000;
      if (visualDelay >= 0) {
        setTimeout(() => {
          addNoteRectangle(
            note.note,
            note.color,
            note.type === "piano" ? note.duration * 1000 : 800,
            note.index,
            note.type === "drum"
          );
        }, visualDelay);
      }
    });
  }, totalLoopDuration);

  scheduledLoops.push(mainLoop);

  // Start the loop and transport
  mainLoop.start(0);
  Tone.Transport.start();

  console.log("Musical loop started with optimized timing!");
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

// Animation loop
function animate() {
  animationId = requestAnimationFrame(animate);

  if (sphere && analyser && audioStarted) {
    // Get frequency data
    const frequencyData = analyser.getValue();
    const geometry = sphere.geometry;
    const positions = geometry.attributes.position.array;

    // Deform sphere based on audio
    for (let i = 0; i < positions.length; i += 3) {
      const originalX = originalPositions[i];
      const originalY = originalPositions[i + 1];
      const originalZ = originalPositions[i + 2];

      // Calculate deformation
      const frequencyIndex = Math.floor((i / 3) % frequencyData.length);
      const amplitude = Math.max(
        0,
        (frequencyData[frequencyIndex] + 100) / 100
      );
      const deformation = 1 + amplitude * 1.2;

      // Add randomness
      const randomFactor =
        1 + Math.sin(Date.now() * 0.001 + i * 0.01) * amplitude * 0.3;
      const finalDeformation = deformation * randomFactor;

      positions[i] = originalX * finalDeformation;
      positions[i + 1] = originalY * finalDeformation;
      positions[i + 2] = originalZ * finalDeformation;
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

// Play drum
async function playDrum(noteIndex = 0) {
  await initializeAudio();
  if (drumSynth && noteIndex < drumNotes.length) {
    const note = drumNotes[noteIndex];
    drumSynth.triggerAttackRelease(note, "8n");

    // Add visual note
    addNoteRectangle(note, drumColors[noteIndex], 800, noteIndex, true);

    // Record if recording
    if (isRecording) {
      const noteData = {
        type: "drum",
        note: note,
        time: Tone.now() - recordingStartTime,
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
async function startPianoNote(note, index) {
  await initializeAudio();
  if (pianoSynth && !activePianoNotes.has(note)) {
    const synth = pianoSynth.triggerAttack(note);
    activePianoNotes.set(note, {
      synth: synth,
      startTime: Tone.now(),
      recordingStartTime: isRecording ? Tone.now() - recordingStartTime : 0,
    });

    // Add visual note
    addNoteRectangle(note, noteColors[index], 2000, index, false);
  }
}

// Stop piano note
function stopPianoNote(note, index) {
  if (pianoSynth && activePianoNotes.has(note)) {
    const noteData = activePianoNotes.get(note);
    pianoSynth.triggerRelease(note);

    // Record if recording
    if (isRecording) {
      const duration = Tone.now() - noteData.startTime;
      const recordedNote = {
        type: "piano",
        note: note,
        time: noteData.recordingStartTime,
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

// Legacy function for backward compatibility
async function playPianoNote(note, index) {
  await startPianoNote(note, index);
  setTimeout(() => stopPianoNote(note, index), 500);
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

// Start loop (legacy function - now unused)
async function startLoop() {
  // This function is no longer used - sphere click controls everything
}

// Stop loop (legacy function - now unused)
function stopLoop() {
  // This function is no longer used - sphere click controls everything
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
function init() {
  initializeThreeJS();
  updateKeyDisplay();
  updatePianoVisual();

  // Add event listeners
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  // Focus on the page to ensure key events work
  document.body.tabIndex = 0;
  document.body.focus();
}

// Start when page loads
window.addEventListener("load", init);
