# Cholecystectomy Incision Annotation Tool

This repository contains a lightweight, browser-based annotation interface designed for surgical research on automation bias, operative decision-making, and incision line accuracy during laparoscopic cholecystectomy.
The tool allows participants to watch operative video clips, freeze the last frame, and draw the intended incision line, which is then securely uploaded to Supabase for later analysis.

This system is inspired by the study described in the proposal “Automation Bias With Incision Lines”.

# Features

Fully client-side annotation interface
No installation required; runs directly in the browser.

Video review + final-frame capture
Participants watch a short operative clip; the last frame is automatically captured for annotation.

Interactive incision drawing
Click-and-drag to draw a single incision line. Adjustable and clearable.

Secure JSON submission
Each annotation is uploaded to a Supabase Storage bucket using a protected Edge Function.

Participant ID tracking
IDs are recorded but not stored in URL or cookies; no PHI is collected.

GitHub Pages hosting
The entire interface is served statically at:
https://mariacmorais.github.io/incision-annotation/

# Repository Structure
incision-annotation/
│
├── index.html           # Main UI structure  :contentReference[oaicite:0]{index=0}
├── styles.css           # UI styling         :contentReference[oaicite:1]{index=1}
├── app.js               # Annotation logic (drawing, capturing, submission)
├── clip-config.js       # Video clip definitions + Supabase endpoint config
│
├── supabase/
│   └── annotator-ingest.ts   # Edge Function handler (secure JSON upload)
│
├── Video_01_K_02.mp4
├── Video_02_K_03.mp4
├── Video_03_Trimmed_...
├── Video_04_...
├── Video_05_...
└── Video_06_...

# How It Works
1. Load clip list

clip-config.js loads all available MP4 files and injects them into the dropdown selector.

2. Watch the clip

Participants review the clip.
During the final ~0.25 seconds, the script automatically prepares to freeze the last frame.

3. Final-frame capture

app.js draws the final frame onto a <canvas> element, enabling annotation.

4. Incision annotation

Users click-and-drag to draw a single line. The line is normalized to canvas coordinates and stored.

5. Submission to Supabase

On submission:

The line + participant ID + metadata are packaged into JSON.

Sent to a Supabase Edge Function (POST).

Saved into a Supabase Storage bucket under a unique filename.

# Security

All uploads go through a server-side validated Edge Function.

A shared secret is required to authenticate requests.

Only the research team has bucket access.

No protected health information (PHI) is collected.

Participant IDs are anonymized codes.

# Output Format (JSON)

Example stored object:

{
  "annotation": {
    "clipId": "clip_03",
    "capturedFrameTime": 29.76,
    "incision": {
      "start": { "x": 0.214, "y": 0.587 },
      "end": { "x": 0.812, "y": 0.601 }
    },
    "canvasSize": { "width": 1280, "height": 720 },
    "generatedAt": "2025-11-13T20:14:05.124Z",
    "participantId": "A32",
    "filenameHint": "A32_clip_03.json"
  }
}

# Deployment

The tool is deployed using GitHub Pages:

Push all files to the repository root.

Enable GitHub Pages → Branch: main, Folder: / (root)

Tool becomes available at:
https://mariacmorais.github.io/incision-annotation/

# Supabase setup:

Create a Storage bucket (annotations)

Deploy Edge Function (annotator-ingest)

Add secrets:

SB_URL

SB_SERVICE_ROLE

SB_BUCKET

SHARED_SECRET

ALLOW_ORIGIN=https://mariacmorais.github.io

# Citation

If using this tool in research or publications, please cite the repository:

Morais MC. Cholecystectomy Incision Annotation Tool.
GitHub, 2025. https://github.com/mariacmorais/incision-annotation

# Contact

For questions, collaboration, or technical issues:

Maria Clara Morais
Email: mmorais@northwell.edu
Research Fellow – Department of Surgery
Lenox Hill Hospital / Northwell Health
