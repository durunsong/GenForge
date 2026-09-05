# Design

Keep the GenForge identity and the existing neutral surfaces with restrained blue focus and selection accents. Use compact controls, consistent 4-8px corners, stable icon button dimensions, flat navigation rows and full-width tool sections. Reserve shadows for actual floating menus and dialogs.

Use the existing native select elements as the source of truth. A button with combobox semantics opens an HTML popover containing a listbox. Preserve labels, groups, disabled options, dynamic option changes and native change listeners. Support arrows, Home/End, type-ahead, Enter/Space, Escape and Tab. Clamp menus to the viewport and close on outer scrolling or resizing.

Keep all changes inside the renderer and focused checks. Browser tests exercise all ten selects and the tool views, while an isolated Electron launch checks compatibility with the shipped Chromium runtime. No real credentials, profile contents or generation APIs are used in verification.
