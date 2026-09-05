# Tasks

- [x] Inspect all select values, callers and tool surfaces.
- [x] Implement and verify provider selection and CRUD.
- [x] Expand the shared select to every application select.
- [x] Flatten navigation, tool forms, buttons and tabs.
- [x] Verify all tool views, grouped/dynamic options and Electron compatibility.
- [x] Run build, types, regression checks, screenshots and encoding checks.

## Verification

- `npm run build` and `npm exec --no -- tsc --noEmit`: passed.
- `node --test scripts/check-branding.cjs scripts/check-image-generation.cjs`: 15 passed, including the shared menus in real Electron and legacy profile recovery.
- `node scripts/check-settings.cjs`: passed.
- `node scripts/check-providers.cjs`: passed provider CRUD, persistence, duplicate-name editing, keyboard selection and responsive menus.
- `node scripts/check-ui.cjs`: passed all ten selects, grouped and dynamic models, disabled groups, remembered values and five application views at 1440, 390 and 320 pixels in both themes.
- Browser checks require Playwright on NODE_PATH. Tests use synthetic data and block external HTTP requests; no live generation API calls were made.
- Screenshot review corrected the translucent dark prompt view, collapsed empty uploader and narrow notification. Final screenshots show no viewport overflow.
- UTF-8, BOM, replacement-character, embedded personal-path and Git whitespace checks passed.
- The optional design detector ran with reduced coverage because its HTML/CSS parser dependencies are unavailable. Its warnings concern existing code outside the refined controls; browser and Electron checks provide the primary verification.
