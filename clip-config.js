// Replace the sample entries with your own clips. Add a new object to the array
// for each video you want participants to review. Provide absolute HTTPS URLs
// (e.g., https://your-org.github.io/study/clip-01.mp4) when hosting on GitHub
// Pages, REDCap, or other survey tools. Avoid referencing local file-system
// paths such as /Users/... or C:\... because participants cannot reach them.
window.ANNOTATION_CLIPS = [
  {
    id: "clip_01",
    label: "Clip 1",
    src: "https://raw.githubusercontent.com/mariacmorais/incision-annotation/main/Video_01_K_02.mp4",
    poster: "",
  },
  // Clip 02 //
  {
    id: "clip_02",
    label: "Clip 2",
    src: "https://raw.githubusercontent.com/mariacmorais/incision-annotation/main/Video_02_K_03.mp4",
    poster: "",
  },
    // Clip 03 //
  {
    id: "clip_03",
    label: "Clip 3",
    src: "https://raw.githubusercontent.com/mariacmorais/incision-annotation/main/Video_03_Trimmed_00053_53001_0000054.mp4",
    poster: "",
  },
      // Clip 04 //
  {
    id: "clip_04",
    label: "Clip 4",
    src: "https://raw.githubusercontent.com/mariacmorais/incision-annotation/main/Video_04_00099_99001_0000101.mp4",
    poster: "",
  },
        // Clip 05 //
  {
    id: "clip_05",
    label: "Clip 5",
    src: "https://raw.githubusercontent.com/mariacmorais/incision-annotation/main/Video_05_00130_130001_0000132.mp4",
    poster: "",
  },
          // Clip 06 //
  {
    id: "clip_06",
    label: "Clip 6",
    src: "https://raw.githubusercontent.com/mariacmorais/incision-annotation/main/Video_06_00172_172001_0000174.mp4",
    poster: "",
  },
];

// Configure where annotations are sent after participants submit.
// Replace `endpoint` with your secure collection URL.
window.ANNOTATION_SUBMISSION = {
  endpoint: "https://formspree.io/f/mblqdnrw", // ← your actual Formspree endpoint
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  additionalFields: {},
  bodyWrapper: "annotation"
};

