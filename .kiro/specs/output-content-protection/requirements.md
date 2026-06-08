# Requirements Document

## Introduction

Output Content Protection is a frontend feature for the 0RCA Dojo platform that prevents clients from extracting agent-generated output (text copy, screenshots) before they confirm satisfaction. When a task reaches the SUBMITTED state, the client sees the output in a protected view. They must explicitly declare satisfaction or dissatisfaction. Satisfaction unlocks the content as a downloadable Markdown file and triggers payment release. Dissatisfaction triggers the refund flow without granting access to the unprotected output.

## Glossary

- **Output_Panel**: The React component that renders agent-generated task output in a protected, restricted view
- **Protected_View**: A rendering mode where content is visually obscured (blurred, overlay-masked) and copy-disabled to prevent extraction
- **Satisfaction_Button**: A UI control the client clicks to confirm they accept the agent's output
- **Dissatisfaction_Button**: A UI control the client clicks to reject the agent's output and initiate a refund
- **Content_Guard**: The set of CSS and JavaScript protections that prevent text selection, clipboard operations, drag-and-drop, and screenshot readability
- **Download_Generator**: The module that converts approved output content into a downloadable Markdown (.md) file
- **Client**: The user who posted the task and is reviewing the agent's submitted work
- **Task_Output**: The markdown-formatted result produced by an agent for a given task

## Requirements

### Requirement 1: Protected Output Rendering

**User Story:** As a client, I want to see the agent's output clearly in a protected view when the task reaches SUBMITTED state, so that I can evaluate the quality of work before committing to payment.

#### Acceptance Criteria

1. WHEN a task transitions to SUBMITTED state, THE Output_Panel SHALL render the Task_Output in Protected_View mode within 2 seconds, displaying all content at a minimum 4.5:1 contrast ratio with no truncation of the original output
2. WHILE in Protected_View mode, THE Output_Panel SHALL display the content as rendered Markdown with all heading, list, code block, and inline formatting preserved, without any blur, opacity reduction, or obscuring filters applied
3. WHILE in Protected_View mode, THE Output_Panel SHALL disable text selection, clipboard copy events, and right-click context menu on all Task_Output content
4. WHILE in Protected_View mode, THE Output_Panel SHALL display a persistent banner above the content area indicating the content is copy-protected until satisfaction is confirmed, without overlapping or obscuring the Task_Output content
5. WHEN the client scrolls within the Output_Panel, THE Protected_View SHALL maintain disabled text selection, disabled clipboard copy events, and disabled right-click context menu on all visible and off-screen content sections
6. IF the Task_Output is empty or fails to load when transitioning to SUBMITTED state, THEN THE Output_Panel SHALL display a message indicating that no output is available and SHALL not enter Protected_View mode

### Requirement 2: Copy Prevention

**User Story:** As a platform operator, I want to prevent clients from copying agent output text before satisfaction confirmation, so that the platform's pay-for-service model is protected.

#### Acceptance Criteria

1. WHILE in Protected_View mode, THE Content_Guard SHALL disable text selection on the Output_Panel via CSS user-select property set to none, such that the client cannot highlight any text within the Output_Panel using mouse or keyboard selection
2. WHILE in Protected_View mode, THE Content_Guard SHALL intercept and cancel clipboard copy events (keyboard shortcuts Ctrl+C/Cmd+C, browser Edit menu copy, right-click context menu copy, and programmatic Clipboard API read requests) on the Output_Panel, leaving the system clipboard contents unchanged
3. WHILE in Protected_View mode, THE Content_Guard SHALL prevent drag-and-drop operations originating from the Output_Panel by cancelling dragstart events, such that no text content is transferred to a drop target
4. WHILE in Protected_View mode, THE Content_Guard SHALL disable the browser context menu on the Output_Panel by cancelling the contextmenu event, such that no context menu is displayed on right-click or long-press within the Output_Panel
5. WHEN the client submits a satisfaction confirmation for a given agent output, THE Content_Guard SHALL transition the Output_Panel from Protected_View mode to normal mode within 1 second, re-enabling text selection, clipboard operations, drag-and-drop, and the context menu for that output
6. IF the Content_Guard fails to attach or initialize protection on the Output_Panel (e.g., event listeners fail to register), THEN THE Content_Guard SHALL withhold rendering of the agent output text in the Output_Panel until protection is successfully applied

### Requirement 3: Screenshot Deterrence

**User Story:** As a platform operator, I want to deter clients from capturing usable screenshots of the output, so that the content has reduced value if captured outside the platform.

#### Acceptance Criteria

1. WHILE in Protected_View mode, THE Output_Panel SHALL render text content with CSS properties that reduce captured-image legibility, including sub-pixel font rendering and background-foreground color pairs that differ by no more than 5% luminance from adjacent UI elements while remaining readable at normal viewing distance on the display
2. WHILE in Protected_View mode, THE Output_Panel SHALL display a tiled watermark overlay at 15%-25% opacity containing the client wallet address (first 6 and last 4 characters) and a timestamp in ISO 8601 format (YYYY-MM-DDThh:mm:ssZ) rotated at 45 degrees, covering 100% of the content area
3. WHEN the browser visibility state changes to hidden, THE Output_Panel SHALL display a full-coverage opaque overlay within 100 milliseconds that completely obscures all content beneath it
4. WHEN the browser visibility state changes to visible after an opaque overlay has been applied, THE Output_Panel SHALL remove the opaque overlay and restore the Protected_View watermarked display within 200 milliseconds

### Requirement 4: Satisfaction Confirmation Flow

**User Story:** As a client, I want to confirm my satisfaction with the output so that I can download the full content and the agent receives payment.

#### Acceptance Criteria

1. WHEN the task is in SUBMITTED state, THE Output_Panel SHALL display the Satisfaction_Button in a visually distinct style (contrasting background color, minimum touch-target size of 44×44 pixels) above the fold of the output content area
2. WHEN the client clicks the Satisfaction_Button, THE Output_Panel SHALL immediately disable the Satisfaction_Button to prevent duplicate submissions and display a loading indicator until all operations complete
3. WHEN the client clicks the Satisfaction_Button, THE Output_Panel SHALL remove all Content_Guard protections and THE Download_Generator SHALL produce a Markdown file named "{task_title}.md" containing the full Task_Output, limited to 10 MB maximum file size
4. WHEN the client clicks the Satisfaction_Button, THE Output_Panel SHALL trigger the browser file download dialog with the generated Markdown file
5. WHEN the client clicks the Satisfaction_Button, THE Output_Panel SHALL call the releaseTaskPayment API endpoint with the task identifier and the client wallet address to release escrowed funds
6. IF the releaseTaskPayment API call fails, THEN THE Output_Panel SHALL display an error message indicating the payment release failed, re-enable the Satisfaction_Button, and retain the downloaded file without rolling back the Content_Guard removal
7. IF the client is not connected with a wallet address when clicking the Satisfaction_Button, THEN THE Output_Panel SHALL display a message prompting the client to connect their wallet and SHALL NOT proceed with content unlock or payment release

### Requirement 5: Dissatisfaction and Refund Flow

**User Story:** As a client, I want to reject the agent's output if it does not meet requirements, so that I receive a refund and do not pay for unsatisfactory work.

#### Acceptance Criteria

1. WHEN the task is in SUBMITTED state, THE Output_Panel SHALL display the Dissatisfaction_Button alongside the Satisfaction_Button
2. WHEN the client clicks the Dissatisfaction_Button, THE Output_Panel SHALL disable both the Dissatisfaction_Button and the Satisfaction_Button and display a loading indicator until the API response is received or a timeout of 30 seconds elapses
3. WHEN the client clicks the Dissatisfaction_Button, THE Output_Panel SHALL call the slashTask API endpoint with the current taskId and callerAddress to initiate the refund process
4. WHEN the client clicks the Dissatisfaction_Button, THE Content_Guard SHALL maintain all protections (text selection disabled, clipboard events suppressed, drag-and-drop blocked, context menu disabled)
5. WHEN the slashTask API returns a successful response, THE Output_Panel SHALL display a confirmation message indicating the refund has been initiated and remove the Task_Output from the DOM within 2 seconds to prevent inspection via developer tools
6. IF the slashTask API call fails or the 30-second timeout elapses, THEN THE Output_Panel SHALL re-enable the Dissatisfaction_Button and Satisfaction_Button and display an error message indicating the refund could not be processed

### Requirement 6: Markdown File Generation

**User Story:** As a client, I want to download the agent's output as a properly formatted Markdown file after confirming satisfaction, so that I have a permanent copy of the work.

#### Acceptance Criteria

1. WHEN generating the download file, THE Download_Generator SHALL produce a UTF-8 encoded Markdown file with .md extension that is parseable by a CommonMark-compliant parser without errors
2. WHEN generating the download file, THE Download_Generator SHALL include the task title as the top-level heading (h1) and use a filename composed of the task identifier and task title in kebab-case, truncated to a maximum of 80 characters
3. WHEN generating the download file, THE Download_Generator SHALL include task metadata (lane, agent, completion date in ISO 8601 format) in a YAML frontmatter block delimited by `---` lines
4. WHEN generating the download file, THE Download_Generator SHALL preserve all original markdown formatting from the Task_Output such that heading levels, lists, code blocks, and inline formatting in the output match the source Task_Output content
5. IF the Task_Output content is unavailable or empty at the time of file generation, THEN THE Download_Generator SHALL not produce a file and SHALL display an error message indicating that the task output could not be retrieved

### Requirement 7: State-Aware Panel Visibility

**User Story:** As a client, I want the output panel to appear only when relevant, so that my interface remains clean for tasks in other states.

#### Acceptance Criteria

1. WHILE the task state is CREATED or LOCKED, THE Output_Panel SHALL not be rendered in the DOM
2. WHEN the task transitions to SUBMITTED, or WHEN the page loads with the task already in SUBMITTED state, THE Output_Panel SHALL become visible with Protected_View active within 1 second of the state being determined
3. WHILE the task state is SETTLED, THE Output_Panel SHALL display the Task_Output without Content_Guard protections and SHALL display a re-download button that triggers the Download_Generator to produce and deliver the Markdown file
4. WHILE the task state is SLASHED, THE Output_Panel SHALL display a message indicating the task was refunded with no output available
5. IF the task state is SETTLED and the Task_Output cannot be retrieved, THEN THE Output_Panel SHALL display an error message indicating the output is temporarily unavailable and SHALL hide the re-download button

### Requirement 8: Developer Tools Mitigation

**User Story:** As a platform operator, I want to deter extraction of output content through browser developer tools, so that the protection layer provides meaningful commercial deterrence.

#### Acceptance Criteria

1. THE Output_Panel SHALL NOT include plaintext or directly readable Task_Output text in the initial page HTML source served to the browser
2. WHEN rendering protected content, THE Output_Panel SHALL split the Task_Output into a minimum of 3 non-contiguous DOM segments per output block, interleaving at least 1 invisible decoy character per 50 visible characters, such that programmatically extracting the combined textContent of the output container produces a string containing at least 10% non-visible decoy characters relative to the visible character count
3. IF the browser DevTools open event is detected, THEN THE Output_Panel SHALL display a full-viewport warning overlay indicating that developer tools access is restricted, hide all protected content beneath the overlay, and restore the protected content within 2 seconds after DevTools is closed
4. THE Output_Panel SHALL render decoy characters with zero visible width and exclude them from assistive technology output via aria-hidden attributes so that displayed text and screen-reader output match the original Task_Output exactly
