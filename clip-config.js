// Replace the sample entries with your own clips. Add a new object to the array
// for each video you want participants to review. Provide absolute HTTPS URLs
// (e.g., https://your-org.github.io/study/clip-01.mp4) when hosting on GitHub
// Pages, REDCap, or other survey tools. Avoid referencing local file-system
// paths such as /Users/... or C:\... because participants cannot reach them.
window.ANNOTATION_CLIPS = [
  {
    id: "clip_01",
    label: "Clip 1",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_01.mp4",
    poster: "",
  },
  // Clip 02 //
  {
    id: "clip_02",
    label: "Clip 2",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_02.mp4",
    poster: "",
  },
  // Clip 03 //
  {
    id: "clip_03",
    label: "Clip 3",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_03.mp4",
    poster: "",
  },
  // Clip 04 //
  {
    id: "clip_04",
    label: "Clip 4",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_04.mp4",
    poster: "",
  },
  // Clip 05 //
  {
    id: "clip_05",
    label: "Clip 5",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_05.mp4",
    poster: "",
  },
  // Clip 06 //
  {
    id: "clip_06",
    label: "Clip 6",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_06.mp4",
    poster: "",
  },
  // Clip 07 //
  {
    id: "clip_07",
    label: "Clip 7",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_07.mp4",
    poster: "",
  },
  // Clip 08 //
  {
    id: "clip_08",
    label: "Clip 8",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_08.mp4",
    poster: "",
  },
  // Clip 09 //
  {
    id: "clip_09",
    label: "Clip 9",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_09.mp4",
    poster: "",
  },
  // Clip 10 //
  {
    id: "clip_10",
    label: "Clip 10",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_10.mp4",
    poster: "",
  },
  // Clip 11 //
  {
    id: "clip_11",
    label: "Clip 11",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_11.mp4",
    poster: "",
  },
  // Clip 12 //
  {
    id: "clip_12",
    label: "Clip 12",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_12.mp4",
    poster: "",
  },
  // Clip 13 //
  {
    id: "clip_13",
    label: "Clip 13",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_13.mp4",
    poster: "",
  },
  // Clip 14 //
  {
    id: "clip_14",
    label: "Clip 14",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_14.mp4",
    poster: "",
  },
  // Clip 15 //
  {
    id: "clip_15",
    label: "Clip 15",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_15.mp4",
    poster: "",
  },
  // Clip 16 //
  {
    id: "clip_16",
    label: "Clip 16",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_16.mp4",
    poster: "",
  },
  // Clip 17 //
  {
    id: "clip_17",
    label: "Clip 17",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_17.mp4",
    poster: "",
  },
  // Clip 18 //
  {
    id: "clip_18",
    label: "Clip 18",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_18.mp4",
    poster: "",
  },
  // Clip 19 //
  {
    id: "clip_19",
    label: "Clip 19",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_19.mp4",
    poster: "",
  },
  // Clip 20 //
  {
    id: "clip_20",
    label: "Clip 20",
    src: "https://raw.githubusercontent.com/mariacmorais/safety-corridor-annotation/main/clip_20.mp4",
    poster: "",
  },
];

// Configure where annotations are sent after participants submit.
// Replace `endpoint` with your secure collection URL.
window.ANNOTATION_SUBMISSION = {
  endpoint: "https://formspree.io/f/mnnlywpg", // ← your actual Formspree endpoint
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  additionalFields: {},
  bodyWrapper: "annotation"
};


// Configure where annotations are sent after participants submit.
window.ANNOTATION_SUBMISSION = {
  // JSON endpoint (leave as your existing Formspree endpoint if desired)
  endpoint: "https://formspree.io/f/mnnlywpg",
  method: "POST",
  headers: {
    "Accept": "application/json"
  },
  additionalFields: {
    studyId: "demo-study",
  },
  // Wrap the annotation in a key OR set to "none" for a flat JSON body.
  // If your JSON is already correct, keep as "annotation".
  bodyWrapper: "annotation",
  // Optional CSV mirror: sends a second POST as form-encoded flat fields
  // so Formspree's CSV includes Specialty/Board/Practice/Volume.
  csvMirror: {
    enabled: true,
    endpoint: "https://formspree.io/f/mnnlywpg", //
    method: "POST",
    headers: {
      // Usually no need to set; Content-Type is set by the code.
    },
    // mode: "cors",
    // credentials: "omit",
  },
};
