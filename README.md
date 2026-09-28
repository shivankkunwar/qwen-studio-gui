# Qwen Image Studio (Nuxt 4 GUI)

A minimal, high-craft web interface for Alibaba's **Qwen-Image-2.1** deployment on Modal, designed with care following Emil Kowalski's frontend design engineering principles.

## Features

- **Prompt Studio**: Auto-expanding multiline prompt with character counter, instant clear, and keyboard shortcuts (`⌘ + Enter` / `Ctrl + Enter` to run).
- **Reference Images & Composition (0–10 images)**:
  - Drag-and-drop, file picker, or direct clipboard paste (`⌘ + V`).
  - Labeled badges (`Image 1`, `Image 2`, etc.) matching Qwen's prompt reference grammar.
  - Reordering arrows (order matters when referencing images in prompts).
  - **Built-in Image Markup / Canvas Tool**: Draw rough shapes or arrows directly onto reference images to guide localized edits (addressing the model's design where drawing guides edits without mask params).
- **Aspect Ratio & Size Control**:
  - Visual aspect ratio presets (`1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `16:9`, `9:16`).
  - Resolution tiers: `1k` (~1 MP, ~20s) and `2k` (native quality, ~80s).
  - Custom pixel dimensions (multiples of 32 between 256 and 2752 px).
- **Generation Settings**:
  - Variations: 1 to 4 images (`num_images`).
  - Denoising steps slider (1–100, default 40).
  - Guidance scale (CFG) slider with contextual helper (explaining why CFG > 1 doubles compute time).
  - Expandable negative prompt input (active when CFG > 1.0).
  - Seed control: numeric input + randomizer dice button.
  - Transparent background toggle (RGBA output for PNG / WebP).
  - Output format: PNG, WebP, JPEG with quality slider.
  - KV cache toggle.
  - Execution mode: Asynchronous job polling (default) or direct sync.
- **Live Progress Tracking**:
  - GPU cold-start indicator with warm-up time estimate (~30–60s).
  - Real-time denoising step progress bar (`Step N of 40` with percentage).
  - Elapsed seconds timer.
  - Cancel / Stop generation button.
- **Results & Inspection**:
  - Gallery view for multiple variations.
  - High-resolution fullscreen lightbox with zoom.
  - Direct image download with proper seed naming.
  - One-click "Iterate / Use as Reference" to pipe outputs back into the reference image pipeline.
  - "Reuse Settings" to instantly restore all parameters.
  - Copy seed and copy prompt helpers.
- **Session History & Settings**:
  - Slide-over history drawer of past generations in the session.
  - In-app credentials configuration: Nitro Server Proxy, Local Proxy (`server.mjs`), or Custom Browser Credentials with live health check testing.

## Video Studio (`/video`)

A separate studio for the two video models in `../video-modal` (switch with **Image | Video** in the header):

- **Model picker**: LTX-2.5 (22B, synced audio, RTX PRO 6000) or FastWan 2.2 (5B, 3-step, L40S), with live health dots.
- **Start frame** (LTX-2.5 only): drop, pick or paste an image for image-to-video. FastWan's 3-step pipeline ignores start frames.
- **Parameters**: aspect presets or exact size, Standard / HD 2× (two-stage upscale), duration chips or **Auto** (the model's duration head picks a length), frame rate, 1–4 clips, seed, Gemma 4 prompt enhancement. Controls a model can't use are hidden.
- **Cost hint**: GPU seconds and dollars for the current settings, warm and with a cold start.
- **Live progress**: cold start, enhancing, denoising step N of 8, HD upscale/refine, MP4 encode.
- **Results**: players with loop, specs (size, length, fps, audio, GPU time, seed), Save MP4, the enhanced prompt, Reuse Settings, **First frame** / **Continue** (a frame becomes the next start frame, to chain clips).
- **Animate**: in the image studio, send a Qwen image to LTX-2.5 as the start frame.
- **History**: its own drawer (`video_gui_history`, 30 items). Settings keys are shared with the image studio.

Video calls go through `server/api/video/[model]/[...path].ts` to `LTX_API_URL` / `FASTWAN_API_URL` with the same `MODAL_KEY` / `MODAL_SECRET`.

## Usage & Credits (`/usage`)

Everything about the $30/month Modal Starter credit, for all three apps:

- **Credit remaining** (exact, from `modal billing summary`), used %, days to reset, month-end projection, card charges.
- **Live now**: GPU workers and API containers up right now per app, uptime and cost so far (polled every 10 s, ticking every second), queue and running jobs, current burn rate.
- **What the credit still buys**: per model, outputs made, GPU time, real cost per output (cold starts + idle included) vs warm cost, and how many more you can make at each.
- **Charts**: cost per hour (last 48 h) and per day (this month), stacked by app; cost by app and by resource.
- **Every generation this month**: time, model, size, steps/length/HD/i2v, GPU seconds, GPU cost, seed (parsed from the app logs).
- The header shows **"$X left"** in every studio.

Data comes from `server/scripts/modal_usage.py`, run with the Modal CLI's Python
(`MODAL_PYTHON`, default `~/.local/share/uv/tools/modal/bin/python`) and its login
(`modal setup`). Proxy tokens can't read billing, so this page works only on a machine
where the CLI is logged in. Modal itemizes cost per full hour, so the last ~hour shows
as "not itemized yet" until the report catches up.

## Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Credentials (Optional)
Create `.env` in `gui/` (or configure via the in-app Settings modal):
```env
MODAL_API_URL=https://shivankkunwar100--qwen-image-21-api.modal.run
MODAL_KEY=wk-xxxxxxxx
MODAL_SECRET=ws-xxxxxxxx
```

Or run the local proxy from `qwen-image-modal/api`:
```bash
node --env-file=qwen-image-modal/api/.env qwen-image-modal/api/server.mjs
```

### 3. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
pnpm build
node .output/server/index.mjs
```
