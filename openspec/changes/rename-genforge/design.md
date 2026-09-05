# Design

## Product identity

Use `genforge` as the npm package name and `GenForge` as the Electron application name, product name, window title and installer prefix. Keep `io.github.durunsong.genforge` stable. Documentation links continue to point to the existing GenForge repository.

Enable Windows executable resource editing so the packaged executable receives the product name and icon. Signing still depends on separately configured certificates; CI continues to disable certificate discovery.

## Visual identity

A geometric white G on charcoal with a mint crossbar forms the product mark. Keep its editable SVG in `assets/brand/genforge-icon.svg`; the existing sharp and png-to-ico pipeline produces the platform and renderer assets. The HTML contains the product name and image before JavaScript runs. Provider changes only update the model subtitle.

## Existing data

Before Electron becomes ready, prefer an existing GenForge profile. Otherwise reuse the previous distribution's profile: `Gemini绘图工作台` for packaged installs or `gemini-image-studio` for development, with the other legacy profile as a fallback. New installs use GenForge. Set both userData and sessionData to the selected path. Do not move, merge or delete profile contents.

Keep `gemini_providers`, `gemini_active_provider` and `GeminiProDB` as compatibility identifiers. Preserve actual Gemini model IDs and API/provider types. Tests use synthetic profile paths and isolated browser contexts.

## Folder rename

Rename the local checkout only after implementation, then build and verify from `personal_code/GenForge`. Relative application asset paths remain valid. Update the verified workspace layout entry.
