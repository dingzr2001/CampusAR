# Campus AR prototype

A static, dependency-free junction guidance prototype for scooter riders and car drivers.

## Run locally

From this directory:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>. The site also opens directly from `index.html`, although a local server is useful for testing the same URL behavior as hosting.

## Host on GitHub Pages

Push this directory to a GitHub repository. In the repository's **Settings → Pages**, set **Source** to **Deploy from a branch**, select the `main` branch, and choose **/(root)**. The site needs no build step. `index.html` and its relative CSS and JavaScript paths work under both a repository subpath and localhost.

The empty `.nojekyll` file keeps GitHub Pages from processing the static files with Jekyll.

When changing `script.js` or `styles.css`, update the `?v=` value on their links in `index.html` before publishing. This keeps a newly published page from loading older cached assets.

## Conflict zone reports

In either journey, move at least 20 m beyond the stop line. A small flag appears on the display edge. Open it, choose **Report a conflict zone**, tap one of the three areas on the junction map, enter a short description, and submit. The journey summary also has a report button. **Run this journey again** shows the saved area in steady yellow on the map and both AR cameras. Reports are stored in this browser's `localStorage`; this static prototype has no server or cross-device sync.
