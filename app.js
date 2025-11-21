const participantIdInput = document.getElementById("participantIdInput");
const participantIdStatus = document.getElementById("participantIdStatus");
const clipSelect = document.getElementById("clipSelect");
const replayBtn = document.getElementById("replayBtn");
const video = document.getElementById("caseVideo");
const finalFrameCanvas = document.getElementById("finalFrame");
const annotationCanvas = document.getElementById("annotationCanvas");
const canvasContainer = document.getElementById("canvasContainer");
const clearLineBtn = document.getElementById("clearLineBtn");
const videoStatus = document.getElementById("videoStatus");
const annotationStatus = document.getElementById("annotationStatus");
const toastTemplate = document.getElementById("toastTemplate");
const submitAnnotationBtn = document.getElementById("submitAnnotationBtn");
const submissionStatus = document.getElementById("submissionStatus");

const submissionConfig = window.ANNOTATION_SUBMISSION || {};
const baseAdditionalFields = { ...(submissionConfig.additionalFields || {}) };
delete baseAdditionalFields.studyId;
delete baseAdditionalFields.participantId;
delete baseAdditionalFields.filenameHint;
let participantIdValue = "";

const overlayCtx = finalFrameCanvas.getContext("2d");
const annotationCtx = annotationCanvas.getContext("2d");

// State Variables
let frameCaptured = false;
let finalFrameBuffered = false; 
let currentClip = null;
let activeDrawingLine = null; 
let completedLines = []; 
let pointerDown = false;
let latestPayload = null;
let submissionInFlight = false;
let capturedFrameTimeValue = 0;
let isPreloading = false; 

// --- UTILITY FUNCTIONS ---

function collectFormDataAsCSV() {
  const name = document.getElementById("participantIdInput")?.value.trim() || "";
  const institution = document.getElementById("institutionInput")?.value.trim() || "";
  const specialty = document.getElementById("specialtyInput")?.value.trim() || "";
  const years_in_practice = document.getElementById("practiceInput")?.value.trim() || "";
  const case_volume = document.getElementById("volumeInput")?.value.trim() || "";
  const board = document.querySelector('input[name="q3"]:checked')?.value || "";
  const parkland = document.querySelector('input[name="q1"]:checked')?.value || "";
  const nassar = document.querySelector('input[name="q2"]:checked')?.value || "";

  const clipId = currentClip?.id || "";
  const timestamp = new Date().toISOString();

  const csvHeader = "Name,Institution,ClipID,Parkland,Nassar,SubmittedAt\n";
  const csvRow = `"${name}","${institution}","${clipId}","${parkland}","${nassar}","${timestamp}"\n`;

  return csvHeader + csvRow;
}

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("toast--visible");
  });
  setTimeout(() => toast.remove(), 2800);
}

// --- CLIP MANAGEMENT ---

function getClips() {
  const clips = Array.isArray(window.ANNOTATION_CLIPS) ? [...window.ANNOTATION_CLIPS] : [];
  const params = new URLSearchParams(window.location.search);
  const videoParam = params.get("video");
  if (videoParam) {
    clips.unshift({
      id: "survey-param",
      label: "Embedded Clip",
      src: videoParam,
      poster: "",
    });
  }
  return clips;
}

function populateClipSelect(clips) {
  clipSelect.innerHTML = "";
  if (clips.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Add clips in clip-config.js";
    clipSelect.appendChild(option);
    clipSelect.disabled = true;
    videoStatus.textContent = "No clip configured.";
    return;
  }

  clips.forEach((clip, index) => {
    const option = document.createElement("option");
    option.value = clip.id ?? `clip-${index}`;
    option.textContent = clip.label ?? option.value;
    option.dataset.src = clip.src;
    option.dataset.poster = clip.poster || "";
    clipSelect.appendChild(option);
  });

  clipSelect.disabled = false;

  const params = new URLSearchParams(window.location.search);
  const clipId = params.get("clip");
  if (clipId) {
    const match = [...clipSelect.options].find((opt) => opt.value === clipId);
    if (match) {
      clipSelect.value = clipId;
      loadSelectedClip();
      return;
    }
  }

  clipSelect.selectedIndex = 0;
  loadSelectedClip();
}

function loadSelectedClip() {
  const option = clipSelect.selectedOptions[0];
  if (!option) return;

  const src = option.dataset.src;
  if (!src) {
    videoStatus.textContent = "Clip source missing.";
    return;
  }

  resetAnnotationState();

  currentClip = {
    id: option.value,
    label: option.textContent,
    src,
    poster: option.dataset.poster || "",
  };

  canvasContainer.hidden = true;
  video.removeAttribute("controls");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.crossOrigin = "anonymous";
  
  if (currentClip.poster) {
    video.setAttribute("poster", currentClip.poster);
  } else {
    video.removeAttribute("poster");
  }

  video.src = currentClip.src;
  video.load();
  videoStatus.textContent = "Loading clip…";
  replayBtn.disabled = true;
}

function resetAnnotationState() {
  frameCaptured = false;
  finalFrameBuffered = false;
  isPreloading = false;
  activeDrawingLine = null;
  completedLines = [];
  pointerDown = false;
  latestPayload = null;
  submissionInFlight = false;
  
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  overlayCtx.clearRect(0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
  
  annotationCanvas.style.backgroundImage = "";
  
  annotationStatus.textContent = "Preparing final frame...";
  clearLineBtn.disabled = true;
  submitAnnotationBtn.disabled = true;
  
  if (submissionConfig.endpoint) {
    submissionStatus.textContent = participantIdValue
      ? "Draw two lines on the frozen frame to enable submission."
      : "Enter your participant ID above before submitting.";
  } else {
    submissionStatus.textContent =
      "Investigator submission endpoint not configured. Update clip-config.js.";
  }
  capturedFrameTimeValue = 0;
}

// --- CORE CAPTURE LOGIC ---

function resizeCanvases(videoWidth, videoHeight) {
  const MAX_WIDTH = 1920;
  let width = videoWidth;
  let height = videoHeight;

  if (width > MAX_WIDTH) {
    const ratio = MAX_WIDTH / width;
    width = MAX_WIDTH;
    height = videoHeight * ratio;
  }

  if (finalFrameCanvas.width !== width || finalFrameCanvas.height !== height) {
    finalFrameCanvas.width = width;
    finalFrameCanvas.height = height;
    annotationCanvas.width = width;
    annotationCanvas.height = height;
  }
}

function bufferFrame(source) {
  if (!source.videoWidth || !source.videoHeight) return false;

  resizeCanvases(source.videoWidth, source.videoHeight);
  overlayCtx.drawImage(source, 0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
  annotationCanvas.style.backgroundImage = "";
  finalFrameBuffered = true;
  return true;
}

function revealCapturedFrame() {
  if (!finalFrameBuffered) return;

  frameCaptured = true;
  canvasContainer.hidden = false;
  
  annotationStatus.textContent =
    "Final frame ready. You can watch the clip above, and draw on this frame below.";
  
  replayBtn.disabled = false;
}

// --- PRELOAD SEQUENCE ---

function handleVideoLoadedMetadata() {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;

  isPreloading = true;
  videoStatus.textContent = "Initializing final frame...";

  const target = Math.max(0, duration - 0.1);
  
  const onSeekEnd = () => {
     bufferFrame(video);
     const numericTime = Number(target.toFixed(3));
     capturedFrameTimeValue = Number.isFinite(numericTime) ? numericTime : 0;
     revealCapturedFrame();

     const onSeekStart = () => {
        isPreloading = false;
        videoStatus.textContent = "Ready. Press play to watch.";
        video.controls = true;
        video.setAttribute("controls", "");
     };
     
     video.addEventListener("seeked", onSeekStart, { once: true });
     video.currentTime = 0;
  };

  video.addEventListener("seeked", onSeekEnd, { once: true });
  video.currentTime = target;
}

function handleVideoTimeUpdate() {
  // No operations needed during playback
}

function handleVideoEnded() {
  if (isPreloading) return; 
  videoStatus.textContent = "Clip complete. The final frame is below.";
  video.controls = true;
  video.setAttribute("controls", "");
}

function handleVideoPlay() {
  if (isPreloading) return;
  videoStatus.textContent = "Watching clip…";
}

function handleVideoError() {
  let message = "Clip failed to load. ";
  if (currentClip?.src) message += "Check URL. ";
  videoStatus.textContent = message;
  showToast(message);
}

function handleReplay() {
  if (!currentClip) return;
  videoStatus.textContent = "Replaying clip...";
  video.currentTime = 0;
  video.play().catch(() => {
    videoStatus.textContent = "Clip reset. Press play to watch again.";
  });
}

// --- DRAWING LOGIC ---

function getPointerPosition(evt) {
  const rect = annotationCanvas.getBoundingClientRect();
  const touch = evt.touches?.[0] ?? evt.changedTouches?.[0] ?? null;
  const clientX = evt.clientX ?? touch?.clientX ?? 0;
  const clientY = evt.clientY ?? touch?.clientY ?? 0;
  const x = ((clientX - rect.left) / rect.width) * annotationCanvas.width;
  const y = ((clientY - rect.top) / rect.height) * annotationCanvas.height;
  return { x, y };
}

function drawLine() {
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  
  const linesToDraw = [...completedLines];
  if (activeDrawingLine) {
    linesToDraw.push(activeDrawingLine);
  }

  linesToDraw.forEach(line => {
    if (!line) return;
    
    // QUALITY FIX: Increased thickness multiplier from 0.004 to 0.008
    // This ensures the line looks solid even when scaled down on mobile screens.
    annotationCtx.strokeStyle = "#38bdf8";
    annotationCtx.lineWidth = Math.max(4, annotationCanvas.width * 0.008);
    annotationCtx.lineCap = "round";
    annotationCtx.lineJoin = "round"; // Smooth corners
    
    annotationCtx.beginPath();
    annotationCtx.moveTo(line.start.x, line.start.y);
    annotationCtx.lineTo(line.end.x, line.end.y);
    annotationCtx.stroke();
    
    annotationCtx.fillStyle = "#0ea5e9";
    annotationCtx.beginPath();
    annotationCtx.arc(line.start.x, line.start.y, annotationCtx.lineWidth, 0, Math.PI * 2);
    annotationCtx.fill();
    annotationCtx.beginPath();
    annotationCtx.arc(line.end.x, line.end.y, annotationCtx.lineWidth, 0, Math.PI * 2);
    annotationCtx.fill();
  });
}

function normalizeLine(line) {
  return {
    start: {
      x: line.start.x / annotationCanvas.width,
      y: line.start.y / annotationCanvas.height,
    },
    end: {
      x: line.end.x / annotationCanvas.width,
      y: line.end.y / annotationCanvas.height,
    },
  };
}

function updateSubmissionPayload() {
  if (completedLines.length !== 2 || !frameCaptured || !currentClip) {
    latestPayload = null;
    submitAnnotationBtn.disabled = true;
    if (frameCaptured && submissionConfig.endpoint) {
      submissionStatus.textContent = participantIdValue
        ? `Draw exactly two lines on the frozen frame (${completedLines.length} drawn).`
        : "Enter your participant ID above before submitting.";
    }
    return;
  }
  
  const incisionDetails = completedLines.map(line => {
      const lengthPixels = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
      return {
          normalized: normalizeLine(line),
          pixels: {
              start: { x: Number(line.start.x.toFixed(2)), y: Number(line.start.y.toFixed(2)) },
              end: { x: Number(line.end.x.toFixed(2)), y: Number(line.end.y.toFixed(2)) },
              length: Number(lengthPixels.toFixed(2)),
          }
      };
  });
  
  const normalizedIncisionLines = incisionDetails.map(d => d.normalized);
  const filenameHint = getFilenameHint();

  latestPayload = {
    clipId: currentClip.id,
    clipLabel: currentClip.label,
    videoSrc: currentClip.src,
    capturedFrameTime: capturedFrameTimeValue,
    incisions: normalizedIncisionLines,
    incisionDetails: incisionDetails, 
    canvasSize: { width: annotationCanvas.width, height: annotationCanvas.height },
    generatedAt: new Date().toISOString(),
    participantId: participantIdValue || "",
    filenameHint,
  };

  if (!submissionConfig.endpoint || !participantIdValue) {
    submitAnnotationBtn.disabled = true;
    return;
  }

  if (!submissionInFlight) {
    submitAnnotationBtn.disabled = false;
  }
  submissionStatus.textContent = "Ready to submit. Tap the button to send your annotation.";
}

// --- INPUT HANDLING ---

function handlePointerDown(evt) {
  if (!frameCaptured) {
    showToast("Final frame loading...");
    return;
  }
  if (completedLines.length >= 2) {
      showToast("Two lines already drawn. Tap 'Clear Line(s)' to restart.");
      return;
  }
  evt.preventDefault();
  pointerDown = true;
  const start = getPointerPosition(evt);
  activeDrawingLine = { start, end: start };
  drawLine();
}

function handlePointerMove(evt) {
  if (!pointerDown || !activeDrawingLine) return;
  evt.preventDefault();
  activeDrawingLine.end = getPointerPosition(evt);
  drawLine();
}

function handlePointerUp(evt) {
  if (!pointerDown || !activeDrawingLine) return;
  if (evt.type === "mouseleave") {
    pointerDown = false;
    return;
  }
  evt.preventDefault();
  pointerDown = false;
  activeDrawingLine.end = getPointerPosition(evt);
  completedLines.push(activeDrawingLine);
  activeDrawingLine = null;
  drawLine();
  clearLineBtn.disabled = false;
  
  if (completedLines.length === 2) {
      annotationStatus.textContent = "Two lines recorded. Submit below.";
  } else {
      annotationStatus.textContent = `Line recorded. Draw ${2 - completedLines.length} more.`;
  }
  updateSubmissionPayload();
}

function clearLine() {
  activeDrawingLine = null;
  completedLines = [];
  pointerDown = false;
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  annotationStatus.textContent = "Frame ready. Draw your two lines for the safety corridor.";
  clearLineBtn.disabled = true;
  updateSubmissionPayload();
}

async function submitAnnotation() {
  if (!latestPayload || !submissionConfig.endpoint) return;
  if (submissionInFlight) return;

  submissionInFlight = true;
  submitAnnotationBtn.disabled = true;
  submissionStatus.textContent = "Submitting annotation…";

  const headers = { ...(submissionConfig.headers || {}) };
  if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
     headers["Content-Type"] = "application/json";
  }

  const csvContent = collectFormDataAsCSV();
  const wrapperKey = (submissionConfig.bodyWrapper && submissionConfig.bodyWrapper !== "none") 
                     ? submissionConfig.bodyWrapper : "annotation";

  const body = submissionConfig.bodyWrapper === "none" 
    ? { ...buildAdditionalFields(getFilenameHint()), ...latestPayload, csv_form_data: csvContent }
    : { ...buildAdditionalFields(getFilenameHint()), [wrapperKey]: latestPayload, csv_form_data: csvContent };

  try {
    const response = await fetch(submissionConfig.endpoint, {
        method: submissionConfig.method || "POST",
        headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error("Submission failed");
    submissionStatus.textContent = "Annotation submitted. Thank you!";
    showToast("Annotation sent to investigator.");
  } catch (error) {
    submissionStatus.textContent = "Submission failed. Please try again.";
    submitAnnotationBtn.disabled = false;
    showToast("Unable to submit annotation. Check connection.");
  } finally {
    submissionInFlight = false;
  }
}

// --- HELPERS ---

function applyParticipantId(rawValue) {
  participantIdValue = (rawValue || "").trim();
  participantIdStatus.textContent = participantIdValue 
    ? "Participant ID recorded. Continue with the steps below."
    : "Enter the ID provided by the study team. This is required before submitting your annotation.";
  updateSubmissionPayload();
}

function getFilenameHint() {
  const clipPart = currentClip?.id ? String(currentClip.id) : "annotation";
  return participantIdValue ? `${participantIdValue}_${clipPart}.json` : `${clipPart}.json`;
}

function buildAdditionalFields(filenameHint) {
  const fields = { ...baseAdditionalFields };
  if (participantIdValue) {
    fields.studyId = participantIdValue;
    fields.participantId = participantIdValue;
  }
  if (filenameHint) fields.filenameHint = filenameHint;
  return fields;
}

// --- EVENT LISTENERS ---

clipSelect.addEventListener("change", loadSelectedClip);
replayBtn.addEventListener("click", handleReplay);
video.addEventListener("loadedmetadata", handleVideoLoadedMetadata);
video.addEventListener("error", handleVideoError);
video.addEventListener("play", handleVideoPlay);
video.addEventListener("timeupdate", handleVideoTimeUpdate);
video.addEventListener("ended", handleVideoEnded);
clearLineBtn.addEventListener("click", clearLine);
submitAnnotationBtn.addEventListener("click", submitAnnotation);
participantIdInput.addEventListener("input", (e) => applyParticipantId(e.target.value));

if (window.PointerEvent) {
  annotationCanvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  annotationCanvas.addEventListener("pointermove", handlePointerMove, { passive: false });
  annotationCanvas.addEventListener("pointerup", handlePointerUp, { passive: false });
  annotationCanvas.addEventListener("pointercancel", handlePointerUp, { passive: false });
  annotationCanvas.addEventListener("mouseleave", handlePointerUp, { passive: false });
} else {
  annotationCanvas.addEventListener("mousedown", handlePointerDown, { passive: false });
  annotationCanvas.addEventListener("mousemove", handlePointerMove, { passive: false });
  annotationCanvas.addEventListener("mouseup", handlePointerUp, { passive: false });
  annotationCanvas.addEventListener("touchstart", handlePointerDown, { passive: false });
  annotationCanvas.addEventListener("touchmove", handlePointerMove, { passive: false });
  annotationCanvas.addEventListener("touchend", handlePointerUp, { passive: false });
}

const availableClips = getClips();
populateClipSelect(availableClips);
applyParticipantId(participantIdInput.value);
