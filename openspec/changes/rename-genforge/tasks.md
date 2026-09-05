# Tasks

- [x] Add failing checks for fixed branding and profile compatibility.
- [x] Update package, window, UI, download names and documentation.
- [x] Replace icon source and generate all platform assets.
- [x] Preserve legacy profile and storage compatibility.
- [x] Rename checkout and update the verified workspace layout.
- [x] Verify build, types, regression tests and responsive screenshots.
- [x] Review the scoped changes for the authorized commit and push to main.

## Verification

- `npm run build`: passed from the renamed checkout.
- `npm exec --no -- tsc --noEmit`: passed.
- `node --test scripts/check-branding.cjs scripts/check-image-generation.cjs`: 15 passed, with Playwright available on NODE_PATH.
- `node scripts/check-settings.cjs`: passed with Playwright available on NODE_PATH.
- Desktop and mobile screenshots: light/dark at 1440, 1024, 390 and 320 pixels; no horizontal overflow.
- Real Electron startup: synthetic legacy provider, conversation and message survive restart; fresh installs use GenForge.
- macOS arm64 directory package: passed using the installed Electron distribution, with signing disabled. Bundle identity is GenForge with the existing application ID and durunsong copyright.
- Windows/Linux installer execution and signed release publishing are outside this local verification.
