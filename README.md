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
