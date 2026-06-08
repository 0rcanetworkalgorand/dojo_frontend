# Implementation Plan: Output Content Protection

## Overview

Implement a client-side content protection system for the 0RCA Dojo task output view. The feature prevents extraction of agent-generated output before a client confirms satisfaction and triggers payment release. Implementation follows a bottom-up approach: utilities first, then hooks, then UI components, then page integration.

## Tasks

- [ ] 1. Set up project structure and install dependencies
  - [ ] 1.1 Install fast-check and create output directory structure
    - Install `fast-check` as a dev dependency
    - Create directories: `src/components/output/`, `src/lib/utils/`, `tests/output/`
    - Add `TaskOutput` type to `src/lib/types.ts`
    - _Requirements: 6.1, 6.3_

- [ ] 2. Implement contentSplitter utility
  - [ ] 2.1 Create contentSplitter with DOM splitting and decoy insertion
    - Implement `splitContent(html: string): SplitResult` that splits HTML into ≥3 non-contiguous segments per block
    - Implement `insertDecoys(segment: string, ratio: number): string` inserting 1 invisible decoy character per 50 visible characters
    - Wrap decoys in `<span aria-hidden="true" style="font-size:0;position:absolute">` elements
    - Ensure combined `textContent` contains at least 10% decoy characters relative to visible count
    - _Requirements: 8.2, 8.4_

  - [ ]* 2.2 Write property test for DOM splitting (Property 7)
    - **Property 7: DOM splitting produces accessible decoy-laden segments**
    - **Validates: Requirements 8.2, 8.4**
    - Use `fc.string({ minLength: 50 })` generator
    - Verify: ≥3 segments, ≥1 decoy per 50 visible chars, ≥10% decoy ratio, all decoys have `aria-hidden="true"`

  - [ ]* 2.3 Write unit tests for contentSplitter
    - Test empty string input
    - Test short strings (<50 chars)
    - Test HTML with existing tags preserved
    - Test Unicode and emoji content
    - _Requirements: 8.2, 8.4_

- [ ] 3. Implement DownloadGenerator utility
  - [ ] 3.1 Create DownloadGenerator with filename builder and markdown file generation
    - Implement `buildFilename(taskId: string, taskTitle: string): string` producing kebab-case filenames ≤80 chars ending in `.md`
    - Implement `generateMarkdownFile(options: DownloadOptions): Blob | null` building UTF-8 markdown with YAML frontmatter
    - Implement `triggerDownload(blob: Blob, filename: string): void` using Blob URL + `<a download>` click
    - Enforce 10MB max file size, return `null` for empty/unavailable content
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.2 Write property test for filename generation (Property 3)
    - **Property 3: Filename generation produces valid kebab-case output**
    - **Validates: Requirements 4.3, 6.2**
    - Use `fc.string({ minLength: 1, maxLength: 200 })` for title, `fc.string()` for taskId
    - Verify: only lowercase alphanumeric + hyphens + `.md`, ≤80 chars, contains taskId, deterministic

  - [ ]* 3.3 Write property test for YAML frontmatter completeness (Property 5)
    - **Property 5: YAML frontmatter contains all required metadata fields**
    - **Validates: Requirements 6.3**
    - Use `fc.record(...)` with metadata fields (title, taskId, lane, agentAddress, completionDate)
    - Verify: output starts with `---` delimited block containing all five fields matching inputs

  - [ ]* 3.4 Write property test for content preservation round-trip (Property 6)
    - **Property 6: Content preservation round-trip**
    - **Validates: Requirements 6.4**
    - Use `fc.string({ minLength: 1 })` for markdown content
    - Verify: content section after frontmatter and h1 is character-for-character identical to input

  - [ ]* 3.5 Write property test for CommonMark validity (Property 4)
    - **Property 4: Generated markdown file is valid CommonMark**
    - **Validates: Requirements 6.1**
    - Use `fc.string()` with markdown-like patterns
    - Verify: generated file is UTF-8, content after frontmatter is parseable, total size ≤10MB

  - [ ]* 3.6 Write unit tests for DownloadGenerator
    - Test `generateMarkdownFile` with valid inputs produces correct structure
    - Test empty content returns `null`
    - Test file size limit enforcement
    - Test filename truncation at 80 chars
    - Test special characters in title handled correctly
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 4. Checkpoint - Utilities verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement useContentGuard hook
  - [ ] 5.1 Create useContentGuard hook with event listener management
    - Implement `useContentGuard(enabled: boolean): UseContentGuardReturn`
    - Attach listeners for `copy`, `cut`, `paste`, `contextmenu`, `dragstart`, `selectstart` that call `preventDefault()`
    - Apply `user-select: none` via inline style on container ref
    - Implement `unlock()` function that removes all listeners and re-enables selection
    - Set `isInitialized: false` if listener attachment fails; withhold content when not initialized
    - Clean up listeners on unmount
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 Write unit tests for useContentGuard
    - Test event listeners are attached when enabled=true
    - Test event listeners are removed when enabled=false
    - Test unlock() removes all protections
    - Test initialization failure handling
    - Test cleanup on unmount
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 6. Implement WatermarkOverlay component
  - [ ] 6.1 Create WatermarkOverlay with tiled SVG pattern
    - Accept `clientAddress` (58 chars) and `timestamp` (ISO 8601)
    - Render full-coverage div with `pointer-events: none`
    - Display tiled SVG pattern at 15-25% opacity with text rotated 45°
    - Truncate address to first 6 + "..." + last 4 characters
    - _Requirements: 3.2_

  - [ ]* 6.2 Write property test for watermark address truncation (Property 2)
    - **Property 2: Watermark displays correctly truncated address and timestamp**
    - **Validates: Requirements 3.2**
    - Use `fc.string({ minLength: 58, maxLength: 58 })` for address, `fc.date()` for timestamp
    - Verify: rendered text contains first 6 chars + ellipsis + last 4 chars, timestamp in ISO 8601 format

  - [ ]* 6.3 Write unit tests for WatermarkOverlay
    - Test correct address truncation rendering
    - Test opacity is within 15-25% range
    - Test pointer-events:none is applied
    - Test 45° rotation on text elements
    - _Requirements: 3.2_

- [ ] 7. Implement DevToolsDetector component
  - [ ] 7.1 Create DevToolsDetector with resize heuristic and debugger timing
    - Implement resize heuristic: `window.outerWidth - window.innerWidth > 160` (or height equivalent)
    - Implement debugger timing: measure execution time >100ms indicates DevTools open
    - Fire `onOpen`/`onClose` callbacks on state change
    - Clean up intervals and listeners on unmount
    - _Requirements: 8.3_

  - [ ]* 7.2 Write unit tests for DevToolsDetector
    - Test onOpen callback fires when threshold exceeded
    - Test onClose callback fires when threshold returns to normal
    - Test cleanup on unmount
    - _Requirements: 8.3_

- [ ] 8. Implement SatisfactionControls component
  - [ ] 8.1 Create SatisfactionControls with satisfy/dissatisfy buttons and API integration
    - Render Satisfaction_Button with contrasting style, minimum 44×44px touch target
    - Render Dissatisfaction_Button alongside
    - On satisfy click: disable button, show loading, call `onSatisfy` callback
    - On dissatisfy click: disable both buttons, show loading, call `onDissatisfy` callback
    - Handle 30-second timeout for dissatisfaction flow
    - Re-enable buttons on API failure
    - Check wallet connection before proceeding; show prompt if disconnected
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 5.1, 5.2, 5.6_

  - [ ]* 8.2 Write unit tests for SatisfactionControls
    - Test buttons render in SUBMITTED state
    - Test satisfy button disables on click
    - Test dissatisfy button disables both buttons on click
    - Test wallet connection check
    - Test timeout handling
    - Test error re-enables buttons
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 5.1, 5.2, 5.6_

- [ ] 9. Checkpoint - Components verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement OutputPanel orchestrator component
  - [ ] 10.1 Create OutputPanel with state-aware rendering and protection orchestration
    - Accept `task: Task` and `clientAddress: string` props
    - Render nothing for CREATED/LOCKED states
    - Fetch task output from `GET /api/tasks/:taskId/output` for SUBMITTED state
    - Wire `useContentGuard` for protection lifecycle
    - Render `WatermarkOverlay`, `DevToolsDetector`, `SatisfactionControls` as children
    - Render content through `contentSplitter` for DOM obfuscation
    - Implement visibility change overlay (show within 100ms on hidden, remove within 200ms on visible)
    - Handle satisfaction flow: unlock → generate download → trigger download → call releaseTaskPayment API
    - Handle dissatisfaction flow: call slashTask API → remove content from DOM on success
    - Display unlocked view with re-download button for SETTLED state
    - Display refund message for SLASHED state
    - Handle error states (empty output, load failure, API failures)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.3, 3.4, 4.3, 4.4, 4.5, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1_

  - [ ]* 10.2 Write property test for markdown rendering preservation (Property 1)
    - **Property 1: Markdown rendering preserves structural elements**
    - **Validates: Requirements 1.2**
    - Use `fc.string()` with markdown-like patterns (headings, lists, code blocks, inline formatting)
    - Verify: rendered HTML contains corresponding semantic elements (h1-h6, ul/ol/li, pre/code, em/strong) with no content truncation

  - [ ]* 10.3 Write unit tests for OutputPanel state-based rendering
    - Test renders nothing for CREATED state
    - Test renders nothing for LOCKED state
    - Test renders protected view for SUBMITTED state
    - Test renders unlocked view for SETTLED state
    - Test renders refund message for SLASHED state
    - Test empty output shows unavailable message
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 1.6_

  - [ ]* 10.4 Write integration tests for satisfaction and dissatisfaction flows
    - Test full satisfaction flow: protected → unlock → download → API call
    - Test full dissatisfaction flow: protected → API call → content removal
    - Test API error handling re-enables controls
    - Test visibility overlay show/hide timing
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 11. Create API route for task output
  - [ ] 11.1 Create GET /api/tasks/[taskId]/output Next.js API route
    - Create `src/app/api/tasks/[taskId]/output/route.ts`
    - Proxy request to backend at `GET http://localhost:3001/api/tasks/:taskId/output`
    - Return `TaskOutputResponse` shape: `{ taskId, content, submittedAt, agentAddress }`
    - Handle errors (404, 500) with appropriate status codes
    - _Requirements: 1.1, 8.1_

- [ ] 12. Integrate OutputPanel into task detail page
  - [ ] 12.1 Create task detail page at src/app/tasks/[id]/page.tsx with OutputPanel integration
    - Create `src/app/tasks/[id]/page.tsx` dynamic route
    - Fetch task data using existing `fetchTask` pattern
    - Conditionally render `OutputPanel` when task state warrants it
    - Pass `task` and `clientAddress` (from wallet context) to OutputPanel
    - _Requirements: 7.1, 7.2_

- [ ] 13. Final checkpoint - Full integration verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- `fast-check` must be installed before property test tasks can execute
- The API route (11.1) proxies to the existing backend; no backend changes are needed
- The task detail page (12.1) is a new route since `src/app/tasks/[id]/` doesn't exist yet

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4", "3.5", "3.6", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1", "7.1", "8.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "7.2", "8.2"] },
    { "id": 5, "tasks": ["10.1", "11.1"] },
    { "id": 6, "tasks": ["10.2", "10.3", "10.4", "12.1"] }
  ]
}
```
