# Cardboard AR Stencil (Meta Quest 3)

A tiny **dependency-free WebXR passthrough app**. It is a browser-based prototype, **not** an APK or system-wide overlay. Runs inside the **Meta Quest Browser**, with the 8 x 5 cm paper outline displayed on your real table. It does **not** overlay Immersed or automatically recognize cardboard.

## Running on Quest 3

1. Upload `index.html`, `app.js`, and `style.css` to an HTTPS static host (for example, GitHub Pages). **WebXR requires a secure origin**. Simply opening the `.html` file locally is not a reliable Quest launch method, and a LAN IP over plain HTTP won't provide immersive AR.
2. Open your HTTPS website in Meta Quest Browser.
3. Select the approximate table height and template side.
4. Choose **Enter passthrough AR**.
5. Aim the Quest controller toward your table and press trigger to position the template. You can move it again any time. Grip while touching the table samples controller height, helping align the vertical plane. Thumbstick rotates/nudges height; A/X flips the template.
6. Trace with a **blunt marker only**. **Remove the headset before cutting with scissors or a knife.** Verify the on-screen 20 mm ruler against a physical ruler before tracing; passthrough calibration/registration can be imprecise at short range.

## Notes

- It draws lines in the immersive-ar app. Passthrough is provided by Quest Browser, not by camera readback; the app never saves or transmits video.
- WebXR `local-floor` is required. The table plane is horizontally modeled and can be calibrated with controller grip, rather than automatically detected.
- In VR, the outline has physical dimensions 80 x 50 mm, with a 10 mm fold tab and a 20 mm reference bar. It is a practical handmade approximation of the earlier design, **not** an exact Quest 3 fit guarantee.
- For hand-tracked pinch, the hand must appear as an XR input source with `targetRaySpace`; otherwise use a controller.
- This app has not been tested on a physical headset in this session. It is built as a functional prototype; Quest Browser input mappings, tracking, and visual placement may need headset iteration.
- You cannot use the traced template while keeping another immersive app like Immersed running in the background.

## Host on GitHub Pages (simple path)

Create a new repository, upload the three files from the same folder, then in repository **Settings → Pages** choose **Deploy from a branch**, branch `main`, folder `/ (root)`. When its `https://...github.io/...` URL is ready, open it in the Quest Browser. Publishing with GitHub Pages exposes these prototype source files publicly; don't put private materials into that repository.

The code uses browser-native WebGL and WebXR only; no Unity, NAudio, NuGet, Node, npm or CDN needed **to run the hosted site**.
