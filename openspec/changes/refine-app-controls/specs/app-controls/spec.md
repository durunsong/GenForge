## ADDED Requirements

### Requirement: Consistent select interaction

All application selects SHALL use the shared styled menu while retaining their original values and change behavior.

#### Scenario: Keyboard and pointer selection

- **WHEN** a user opens a select in settings or a tool
- **THEN** they can choose with pointer or keyboard, dismiss without changing the value, and inspect long option names
- **AND** the menu stays inside the viewport in both themes

#### Scenario: Dynamic and grouped options

- **WHEN** custom models or channels change
- **THEN** options and the selected label reflect the current native select state
- **AND** group labels remain visible and disabled entries cannot be chosen

### Requirement: Restrained tool surfaces

Navigation, forms, tabs and tool actions SHALL use consistent spacing, accessible focus and restrained surfaces.

#### Scenario: Tool workflows

- **WHEN** a user opens XHS, prompt search, personal prompts or image slicing
- **THEN** existing actions remain available and controls do not overlap or overflow on desktop and mobile
