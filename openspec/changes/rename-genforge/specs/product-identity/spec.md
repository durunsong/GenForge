## ADDED Requirements

### Requirement: Consistent GenForge identity

The application SHALL use GenForge for visible product names, window titles, installer names and product icons.

#### Scenario: Provider changes

- **WHEN** the user selects no provider, random selection, Gemini, OpenAI or a custom model
- **THEN** the headers, empty-state heading and document title remain GenForge
- **AND** the selected model is represented separately from the product brand

#### Scenario: Build and package metadata

- **WHEN** the project builds from the GenForge source directory
- **THEN** package metadata and icons use the new identity at all required sizes
- **AND** the stable application ID, author and Apache-2.0 license are retained

### Requirement: Existing data remains accessible

The application SHALL preserve access to previous configuration and conversation storage.

#### Scenario: Upgrade with a legacy profile

- **WHEN** no GenForge profile exists and a previous profile exists
- **THEN** Electron reuses that profile for userData and sessionData before ready
- **AND** profile files and existing browser storage names are unchanged

#### Scenario: New or current installation

- **WHEN** a GenForge profile already exists or no previous profile exists
- **THEN** Electron uses the GenForge profile
