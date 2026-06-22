# EBIZO TALK Avatar Studio Security Notes

## Safe Public URL

Use GitHub Pages for remote recording:

```text
https://ebizou402-star.github.io/radio-avatar-studio/
https://ebizou402-star.github.io/radio-avatar-studio/?guest=1
```

Do not use temporary tunnel domains such as `lhr.life`, `localhost.run`, `loca.lt`, `trycloudflare.com`, or `ngrok` for cohost invitations. The app blocks remote controls on those domains because security tools often flag them and because anyone with the temporary URL can open the page while the tunnel is active.

Open the app through HTTPS or `localhost` when using the microphone. A `file://` preview can display the studio, but some browsers intentionally do not expose microphone input to local files. When that happens, the app shows `HTTPS必要` and offers the safe GitHub Pages URL instead of the ambiguous `blocked` status.

## What The App Does Not Do

- No account login.
- No payment or paid API.
- No server-side audio upload or cloud recording.
- No analytics, cookies, localStorage, or sessionStorage.
- No fetch, WebSocket, or external JavaScript.

## What The App Does Use

- The browser microphone permission, only after a user action.
- WebRTC for live cohost audio.
- A free public STUN server for connection setup. STUN helps peers find a route; it is not an audio storage service.
- Manual invite/answer codes. Treat those codes as private connection data and send them only to the cohost through a trusted channel. The app clears both code fields after a recording file is created and when the call is disconnected.

## Browser Hardening

The app includes a static Content Security Policy that limits scripts, styles, images, media, forms, frames, and network fetches. It also disables referrer sending.

The single-file build in `dist/index.html` uses hash-based CSP entries for its inline style and script, so only the generated app code is allowed to run.

## Publishing Checklist

1. Publish from the repository through GitHub Pages.
2. Use the `github.io` HTTPS URL, not a temporary tunnel URL.
3. Keep the repository free of passwords, tokens, private documents, or unreleased personal images.
4. Before recording, confirm the app shows `安全URL` in the remote panel.
5. The app clears its invite/answer fields automatically after recording or disconnecting. Delete copies sent through chat after the session.
6. Stop recording and press `切断` when finished.
