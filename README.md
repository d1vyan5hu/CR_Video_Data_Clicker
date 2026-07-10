# Video Annotator

Video Annotator is a responsive, JSON-driven video annotation application. Upload a video or load one from a downloadable share link, then upload a JSON configuration to define exactly which fields are recorded for every annotation.

## Run locally

Install Node.js 22.5 or newer, then run these commands from the project root:

```bash
npm run install:all
npm run dev
```

Open `http://localhost:5173` in a browser. The API runs on port 4000 and the Vite frontend runs on port 5173.

To build the frontend for production:

```bash
npm run build
```

## Features

- **Entry Mode:** click the video to create an annotation and complete the dynamic configuration steps.
- **Audit Mode:** review an already-loaded video without creating new annotations. Select a saved entry to jump to its timestamp.
- **Local upload and link import:** upload a local video or use a public HTTP(S) download/share URL. SharePoint links must permit download by the server; the video is saved locally before it is played.
- **FPS indicator:** appears over the playback video after a short live measurement. Some older browsers do not expose the required media-frame API and will continue to show “detecting”.
- **Responsive layout:** works across desktop, tablet, and phone sizes.
- **CSV/JSON export:** columns are generated from the configured fields.

## JSON configuration example-

```json
{
  "setupFields": [{ "id": "site-name", "label": "Site Name" }],
  "steps": [
    {
      "step_id": "VehicleType",
      "question": "Vehicle Type",
      "choices": [{ "value": "car", "label": "Car" }]
    }
  ],
  "directionMarkers": [
    { "id": "entrance", "label": "Entrance", "x": 10, "y": 50 }
  ]
}
```

`setupFields` is optional. `steps` defines the annotation form. 

## Project structure

```text
server/                         Express API and SQLite data
  routes/videos.js              Upload, share-link import, streaming
  routes/annotations.js         Annotation CRUD
  routes/configs.js             Configuration storage and validation
client/src/
  screens/                      Setup and annotation screens
  components/                   Feature-specific React components
    VideoLinkLoader.jsx         Share-link loader
    VideoPlayer.jsx             Playback stage and FPS display
  hooks/                         Playback, config, and annotation state
  api/client.js                 API calls
  styles/features/              Separate CSS for audit, link loader, and responsive behavior
```

## Notes

The server uses Node’s built-in SQLite module, so Node.js 22.5+ is required. Imported videos are stored in `server/uploads/` and data is stored in `server/data/` at runtime.
