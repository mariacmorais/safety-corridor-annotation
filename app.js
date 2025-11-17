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

let frameCaptured = false;
let currentClip = null;
let activeLine = null;
let pointerDown = false;
let latestPayload = null;
let submissionInFlight = false;
let capturedFrameTimeValue = 0;
let helperVideo = null;
let helperSeekAttempted = false;

function showToast(message) {
  const toast = toastTemplate.content.firstElementChild.cloneNode(true);
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("toast--visible");
  });
  setTimeout(() => toast.remove(), 2800);
}

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
  prepareHelperVideo();
}

function looksLikeLocalPath(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower.startsWith("file:") ||
    lower.startsWith("/users/") ||
    lower.startsWith("c:\\") ||
    lower.startsWith("\\\\")
  );
}

function looksLikeGithubBlob(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes("github.com") && lower.includes("/blob/");
}

function handleVideoError() {
  let message = "Clip failed to load. Check that the src URL is correct and publicly accessible.";
  if (currentClip?.src) {
    message += ` (Configured source: ${currentClip.src})`;
    if (looksLikeLocalPath(currentClip.src)) {
      message +=
        " — this looks like a local file path. Upload the video to your hosting provider (e.g., GitHub Pages, CDN) and reference the hosted HTTPS URL instead.";
    } else if (looksLikeGithubBlob(currentClip.src)) {
      message +=
        " — this points to the GitHub repository viewer. Use the GitHub Pages URL or the raw file URL (https://raw.githubusercontent.com/…) so the browser can load the actual video.";
    }
  }
  videoStatus.textContent = message;
  showToast(message);
  replayBtn.disabled = true;
  teardownHelperVideo();
}

function resetAnnotationState() {
  teardownHelperVideo();
  frameCaptured = false;
  activeLine = null;
  pointerDown = false;
  latestPayload = null;
  submissionInFlight = false;
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  overlayCtx.clearRect(0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
  annotationCanvas.style.backgroundImage = "";
  annotationStatus.textContent =
    "Final frame will appear below shortly. You can keep watching the clip while it prepares.";
  clearLineBtn.disabled = true;
  submitAnnotationBtn.disabled = true;
  if (submissionConfig.endpoint) {
    submissionStatus.textContent = participantIdValue
      ? "Draw the incision on the frozen frame to enable submission."
      : "Enter your participant ID above before submitting.";
  } else {
    submissionStatus.textContent =
      "Investigator submission endpoint not configured. Update clip-config.js.";
  }
  capturedFrameTimeValue = 0;
}

function resizeCanvases(width, height) {
  finalFrameCanvas.width = width;
  finalFrameCanvas.height = height;
  annotationCanvas.width = width;
  annotationCanvas.height = height;
}

function teardownHelperVideo() {
  if (!helperVideo) return;
  helperVideo.removeEventListener("loadedmetadata", handleHelperLoadedMetadata);
  helperVideo.removeEventListener("seeked", handleHelperSeeked);
  helperVideo.removeEventListener("timeupdate", handleHelperTimeUpdate);
  helperVideo.removeEventListener("error", handleHelperError);
  try {
    helperVideo.pause();
  } catch (error) {
    // ignore pause issues on cleanup
  }
  helperVideo.removeAttribute("src");
  helperVideo.load();
  helperVideo.remove();
  helperVideo = null;
  helperSeekAttempted = false;
}

function prepareHelperVideo() {
  teardownHelperVideo();
  if (!currentClip?.src) {
    return;
  }

  helperVideo = document.createElement("video");
  helperVideo.crossOrigin = "anonymous";
  helperVideo.preload = "auto";
  helperVideo.muted = true;
  helperVideo.setAttribute("playsinline", "");
  helperVideo.setAttribute("webkit-playsinline", "");
  helperVideo.addEventListener("loadedmetadata", handleHelperLoadedMetadata);
  helperVideo.addEventListener("seeked", handleHelperSeeked);
  helperVideo.addEventListener("timeupdate", handleHelperTimeUpdate);
  helperVideo.addEventListener("error", handleHelperError);
  helperVideo.src = currentClip.src;
  helperVideo.load();
}

function handleHelperLoadedMetadata() {
  if (!helperVideo || !Number.isFinite(helperVideo.duration)) {
    return;
  }
  helperSeekAttempted = true;
  const duration = helperVideo.duration;
  const offset = duration > 0.5 ? 0.04 : Math.max(duration * 0.5, 0.01);
  const target = Math.max(duration - offset, 0);
  try {
    helperVideo.currentTime = target;
  } catch (error) {
    // Safari may throw if data for the target frame is not buffered yet.
  }
}

function helperFinalizeCapture() {
  if (!helperVideo || helperVideo.readyState < 2 || frameCaptured) {
    return;
  }
  const success = captureFrameImage(helperVideo, helperVideo.currentTime);
  if (success) {
    teardownHelperVideo();
  } else {
    handleHelperError();
  }
}

function handleHelperSeeked() {
  helperFinalizeCapture();
}

function handleHelperTimeUpdate() {
  if (!helperSeekAttempted || frameCaptured) {
    return;
  }
  helperFinalizeCapture();
}

function handleHelperError() {
  teardownHelperVideo();
  if (!frameCaptured) {
    annotationStatus.textContent =
      "Final frame will appear below once the clip finishes playing. If it does not, replay the clip.";
  }
}

function captureFrameImage(source, frameTimeValue) {
  if (!source.videoWidth || !source.videoHeight) {
    return false;
  }

  const firstCapture = !frameCaptured;
  resizeCanvases(source.videoWidth, source.videoHeight);
  overlayCtx.drawImage(source, 0, 0, finalFrameCanvas.width, finalFrameCanvas.height);
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

  try {
    const dataUrl = finalFrameCanvas.toDataURL("image/png");
    annotationCanvas.style.backgroundImage = `url(${dataUrl})`;
    annotationCanvas.style.backgroundSize = "contain";
    annotationCanvas.style.backgroundRepeat = "no-repeat";
    annotationCanvas.style.backgroundPosition = "center";
  } catch (error) {
    frameCaptured = false;
    showToast("Unable to capture frame. Serve the clip from the same origin or enable CORS.");
    return false;
  }

  frameCaptured = true;
  canvasContainer.hidden = false;
  annotationStatus.textContent =
    "Final frame ready. Review the clip above and draw your incision when ready.";
  if (firstCapture) {
    if (video.paused) {
      videoStatus.textContent = "Final frame captured. Replay the clip if you need another look.";
    } else {
      videoStatus.textContent =
        "Final frame captured below. You can keep watching or replay the clip when ready.";
    }
  }
  replayBtn.disabled = false;
  const numericTime = Number(
    ((frameTimeValue ?? source.currentTime ?? 0) || 0).toFixed(3)
  );
  capturedFrameTimeValue = Number.isFinite(numericTime) ? numericTime : 0;
  return true;
}

function freezeOnFinalFrame() {
  if (!frameCaptured) {
    const captureTime = Number.isFinite(video.duration)
      ? video.duration
      : video.currentTime || 0;
    const success = captureFrameImage(video, captureTime);
    if (!success) {
      return;
    }
  } else {
    const captureTime = Number.isFinite(video.duration)
      ? video.duration
      : video.currentTime || capturedFrameTimeValue;
    const numericTime = Number(((captureTime || 0)).toFixed(3));
    capturedFrameTimeValue = Number.isFinite(numericTime) ? numericTime : capturedFrameTimeValue;
  }
  videoStatus.textContent =
    "Clip complete. The frozen frame below is ready for annotation. Use Replay to review again.";
}

function handleVideoLoaded() {
  videoStatus.textContent = "Clip loaded. Tap play to begin.";
  video.controls = true;
  video.setAttribute("controls", "");
  video.play().catch(() => {
    try {
      video.pause();
    } catch (error) {
      // ignore pause failures
    }
    videoStatus.textContent = "Clip loaded. Press play to begin.";
  });
}

function handleVideoPlay() {
  videoStatus.textContent = frameCaptured
    ? "Replaying clip. The final frame remains available below."
    : "Watching clip…";
}

function handleVideoEnded() {
  freezeOnFinalFrame();
  video.controls = true;
  video.setAttribute("controls", "");
}

function handleVideoTimeUpdate() {
  if (frameCaptured) {
    return;
  }

  const duration = Number.isFinite(video.duration) ? video.duration : null;
  if (!duration) {
    return;
  }

  const remaining = duration - video.currentTime;
  if (remaining <= 0.25) {
    const success = captureFrameImage(video, duration);
    if (!success) {
      return;
    }
    annotationStatus.textContent =
      "Final frame ready. Review the clip above and draw your incision when ready.";
  }
}

function handleReplay() {
  if (!currentClip) return;
  annotationStatus.textContent =
    "Final frame remains below. Review the clip again and adjust your line if needed.";
  activeLine = null;
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  clearLineBtn.disabled = true;
  submitAnnotationBtn.disabled = true;
  if (submissionConfig.endpoint) {
    submissionStatus.textContent = participantIdValue
      ? "Draw the incision on the frozen frame to enable submission."
      : "Enter your participant ID above before submitting.";
  } else {
    submissionStatus.textContent =
      "Investigator submission endpoint not configured. Update clip-config.js.";
  }
  updateSubmissionPayload();
  try {
    video.pause();
  } catch (error) {
    // ignore pause issues on replay
  }
  video.currentTime = 0;
  video.controls = true;
  video.setAttribute("controls", "");
  video.play()
    .then(() => {
      videoStatus.textContent = frameCaptured
        ? "Replaying clip. The final frame remains available below."
        : "Replaying clip…";
    })
    .catch(() => {
      videoStatus.textContent = "Clip reset. Press play to watch again.";
    });
}

function getPointerPosition(evt) {
  const rect = annotationCanvas.getBoundingClientRect();
  const touch = evt.touches?.[0] ?? evt.changedTouches?.[0] ?? null;
  const clientX = evt.clientX ?? touch?.clientX ?? 0;
  const clientY = evt.clientY ?? touch?.clientY ?? 0;
  const x = ((clientX - rect.left) / rect.width) * annotationCanvas.width;
  const y = ((clientY - rect.top) / rect.height) * annotationCanvas.height;
  return { x, y };
}

function drawLine(line) {
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  if (!line) return;
  annotationCtx.strokeStyle = "#38bdf8";
  annotationCtx.lineWidth = Math.max(4, annotationCanvas.width * 0.004);
  annotationCtx.lineCap = "round";
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
  if (!activeLine || !frameCaptured || !currentClip) {
    latestPayload = null;
    submitAnnotationBtn.disabled = true;
    if (frameCaptured && submissionConfig.endpoint) {
      submissionStatus.textContent = participantIdValue
        ? "Draw the incision and release to submit."
        : "Enter your participant ID above before submitting.";
    }
    return;
  }

  const frameTime = capturedFrameTimeValue;
  const normalizedLine = normalizeLine(activeLine);
  const lengthPixels = Math.hypot(
    activeLine.end.x - activeLine.start.x,
    activeLine.end.y - activeLine.start.y
  );

  const startPixels = {
    x: Number(activeLine.start.x.toFixed(2)),
    y: Number(activeLine.start.y.toFixed(2)),
  };
  const endPixels = {
    x: Number(activeLine.end.x.toFixed(2)),
    y: Number(activeLine.end.y.toFixed(2)),
  };

  const filenameHint = getFilenameHint();

  const payload = {
    clipId: currentClip.id,
    clipLabel: currentClip.label,
    videoSrc: currentClip.src,
    capturedFrameTime: frameTime,
    incision: normalizedLine,
    incisionPixels: {
      start: startPixels,
      end: endPixels,
      length: Number(lengthPixels.toFixed(2)),
    },
    canvasSize: { width: annotationCanvas.width, height: annotationCanvas.height },
    generatedAt: new Date().toISOString(),
    participantId: participantIdValue || "",
    filenameHint,
  };

  latestPayload = payload;

  if (!submissionConfig.endpoint) {
    submitAnnotationBtn.disabled = true;
    submissionStatus.textContent =
      "Investigator submission endpoint not configured. Update clip-config.js.";
    return;
  }

  if (!participantIdValue) {
    submitAnnotationBtn.disabled = true;
    submissionStatus.textContent = "Enter your participant ID above before submitting.";
    return;
  }

  if (!submissionInFlight) {
    submitAnnotationBtn.disabled = false;
  }
  submissionStatus.textContent = "Ready to submit. Tap the button to send your annotation.";
}

function handlePointerDown(evt) {
  if (!frameCaptured) {
    showToast("Final frame still loading. Please wait a moment before drawing.");
    return;
  }

  evt.preventDefault();
  pointerDown = true;
  const start = getPointerPosition(evt);
  activeLine = { start, end: start };
  drawLine(activeLine);
}

function handlePointerMove(evt) {
  if (!pointerDown || !activeLine) return;
  evt.preventDefault();
  activeLine.end = getPointerPosition(evt);
  drawLine(activeLine);
}

function handlePointerUp(evt) {
  if (!pointerDown || !activeLine) return;
  if (evt.type === "mouseleave") {
    pointerDown = false;
    return;
  }
  evt.preventDefault();
  pointerDown = false;
  activeLine.end = getPointerPosition(evt);
  drawLine(activeLine);
  clearLineBtn.disabled = false;
  annotationStatus.textContent = "Incision line recorded. Submit below.";
  updateSubmissionPayload();
}

function clearLine() {
  activeLine = null;
  pointerDown = false;
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  annotationStatus.textContent =
    "Final frame ready. Draw your incision line.";
  clearLineBtn.disabled = true;
  updateSubmissionPayload();
}

async function submitAnnotation() {
  if (!latestPayload) {
    showToast("Draw the incision before submitting.");
    return;
  }

  if (!submissionConfig.endpoint) {
    showToast("Submission endpoint missing. Update clip-config.js.");
    return;
  }

  if (submissionInFlight) return;

  submissionInFlight = true;
  submitAnnotationBtn.disabled = true;
  submissionStatus.textContent = "Submitting annotation…";

  const method = submissionConfig.method || "POST";
  const headers = { ...(submissionConfig.headers || {}) };
  let shouldSetDefaultContentType = true;
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "content-type") {
      shouldSetDefaultContentType = false;
      if (headers[key] === null) {
        delete headers[key];
      }
    }
  }
  if (shouldSetDefaultContentType) {
    headers["Content-Type"] = "application/json";
  }

  const filenameHint = getFilenameHint();
  const additionalFields = buildAdditionalFields(filenameHint);
  let bodyWrapper;
  if (submissionConfig.bodyWrapper === "none") {
    bodyWrapper = { ...additionalFields, ...latestPayload };
  } else {
    const key =
      typeof submissionConfig.bodyWrapper === "string" && submissionConfig.bodyWrapper
        ? submissionConfig.bodyWrapper
        : "annotation";
    bodyWrapper = { ...additionalFields, [key]: latestPayload };
  }

  const fetchOptions = {
    method,
    headers,
    body: JSON.stringify(bodyWrapper),
  };

  if (submissionConfig.mode) {
    fetchOptions.mode = submissionConfig.mode;
  }
  if (submissionConfig.credentials) {
    fetchOptions.credentials = submissionConfig.credentials;
  }

  try {
    const response = await fetch(submissionConfig.endpoint, fetchOptions);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    submissionStatus.textContent = "Annotation submitted. Thank you!";
    showToast("Annotation sent to investigator.");
  } catch (error) {
    submissionStatus.textContent = "Submission failed. Please try again.";
    submitAnnotationBtn.disabled = false;
    showToast("Unable to submit annotation. Check your connection and try again.");
    console.error(error);
  } finally {
    submissionInFlight = false;
  }
}

function applyParticipantId(rawValue) {
  participantIdValue = (rawValue || "").trim();
  if (participantIdValue) {
    participantIdStatus.textContent =
      "Participant ID recorded. Continue with the steps below.";
  } else {
    participantIdStatus.textContent =
      "Enter the ID provided by the study team. This is required before submitting your annotation.";
  }
  updateSubmissionPayload();
}

function getFilenameHint() {
  const clipPart = currentClip?.id ? String(currentClip.id) : "annotation";
  if (participantIdValue) {
    return `${participantIdValue}_${clipPart}.json`;
  }
  return `${clipPart}.json`;
}

function buildAdditionalFields(filenameHint) {
  const fields = { ...baseAdditionalFields };
  if (participantIdValue) {
    fields.studyId = participantIdValue;
    fields.participantId = participantIdValue;
  }
  if (filenameHint) {
    fields.filenameHint = filenameHint;
  }
  return fields;
}

clipSelect.addEventListener("change", loadSelectedClip);
replayBtn.addEventListener("click", handleReplay);
video.addEventListener("loadeddata", handleVideoLoaded);
video.addEventListener("error", handleVideoError, { once: false });
video.addEventListener("play", handleVideoPlay);
video.addEventListener("timeupdate", handleVideoTimeUpdate);
video.addEventListener("ended", handleVideoEnded);
clearLineBtn.addEventListener("click", clearLine);
submitAnnotationBtn.addEventListener("click", submitAnnotation);

participantIdInput.addEventListener("input", (event) => {
  applyParticipantId(event.target.value);
});

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
  annotationCanvas.addEventListener("mouseleave", handlePointerUp, { passive: false });
  annotationCanvas.addEventListener("touchstart", handlePointerDown, { passive: false });
  annotationCanvas.addEventListener("touchmove", handlePointerMove, { passive: false });
  annotationCanvas.addEventListener("touchend", handlePointerUp, { passive: false });
  annotationCanvas.addEventListener("touchcancel", handlePointerUp, { passive: false });
}

const availableClips = getClips();
populateClipSelect(availableClips);
applyParticipantId(participantIdInput.value);
