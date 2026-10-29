# Camelock Horses

Stud book and herd register for Camelock Rural: horse profiles, pedigrees, genetic tests,
health and breeding records, the rotational worming plan and a mating planner.

It's an installable web app that works offline. Records are stored in Firebase (Firestore),
which keeps a full copy on each device and syncs when there's a connection. Every push to
`main` is published to GitHub Pages.

## Layout

- `src/app.js`: the app's screens and logic
- `src/platform.js`: Firebase sign-in, storage, photos and downloads
- `src/firebase-config.js`: which Firebase project to use
- `public/`: page, styles, icons, manifest and the service worker that caches the app
- `build.mjs`: bundles everything into `dist/`

## Develop

```
npm install
npm run build
npm run serve   # http://localhost:8080
```

## Firebase setup

Firestore in `australia-southeast1`, Email/Password sign-in with public sign-up turned off,
and these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Collections: `horses`, `records` and `photos` (photos are resized on the device and stored
as JPEG data URLs so they're available offline).
