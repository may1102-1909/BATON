# Baton UI Implementation Specification: Background Glow & Developer Notes

This document provides a complete technical specification of the changes made to the `/usage` page (`src/pages/UsagePage.jsx`) and supporting public assets. It is prepared for another agent or developer to review, verify, and incorporate into production.

---

## 1. Ambient Background Glow (`bg glow`)

### 1.1 Problem Identified in Previous Implementation
- **Scroll Disconnect**: The bottom-left ambient glow was previously pinned using standard page flow or relative/absolute coordinates near the bottom of a ~5000px tall document.
- **Invisibility at Top**: On page load (Hero, Overview, and Features sections), the glow was completely off-screen and invisible.
- **Scroll Disappearance**: As users scrolled through the page, the glow either vanished or popped in abruptly at the footer, failing to provide persistent ambient lighting.
- **Harsh Opacity**: The original radial gradient had an overly bright intensity (`0.30`–`0.40`), creating harsh contrast and visual noise.

### 1.2 Technical Solution
The glow was refactored into a fixed viewport-level ambient layer:

```jsx
{/* Fixed Background Ambient Glow */}
<div
  style={{
    position: 'fixed',
    left: '-12vw',
    bottom: '-10vh',
    width: '65vw',
    height: '65vh',
    background: 'radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.14) 0%, transparent 65%), radial-gradient(circle at 10% 90%, rgba(52, 211, 153, 0.08) 0%, transparent 50%)',
    filter: 'blur(70px)',
    pointerEvents: 'none',
    zIndex: 0
  }}
/>
```

### 1.3 Key Architectural Attributes
1. **`position: fixed`**: Anchors the glow relative to the active viewport regardless of scroll position.
2. **Subtle Multi-Stop Opacity**: Toned down to `0.14` and `0.08` with a `blur(70px)` filter to create an ultra-soft organic vignette behind the dark surface (`#0c0d0e`).
3. **`pointerEvents: 'none'`**: Guarantees zero interference with clicks, selections, or hover states across the entire page.

---

## 2. Developer Notes Section (Evolution from "Docs")

### 2.1 Navigation & Section Rename
- **`NAV_ITEMS` Update**:
  - Changed ID label from `{ id: 'docs', label: 'Docs' }` to `{ id: 'docs', label: 'Developer Notes' }`.
- **Section Eyebrow & Headers**:
  - Eyebrow: `DEVELOPER NOTES`
  - Title: `Behind the code.`
  - Subtitle: `Engineering rationale and candid builder dialogue directly from the developers behind Baton.`

---

### 2.2 Card Design & Geometry
- **Container Styling**:
  - Max width: `780px`, centered with `margin: '50px auto 0'`.
  - Background: `#111316` with a refined 1px border (`#282a30`).
  - Native Rounded Bottoms: `borderRadius: '18px 18px 36px 36px'`.
  - Deep Box Shadow: `0 24px 70px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(52, 211, 153, 0.08)`.
  - **Removed Materialistic Borders**: Eliminated rigid table headers (`Speaker`, `Focus`, `Notes`) and artificial green bottom-corner border arcs in favor of a clean native card aesthetic.

---

### 2.3 Transparent Character Stickers
Two transparent character sticker PNGs are stored in `public/stickers/`:
- `public/stickers/dev-glasses.png` (Dev 1 - Glasses)
- `public/stickers/dev-mustache.png` (Dev 2 - Mustache)

#### Positioning on the Card
- **Dev 1 (Top-Left)**:
  - `position: absolute`, `top: -55px`, `left: -30px`, `width: 115px`, `height: 115px`.
  - Rest rotation: `rotate(-7deg)`.
- **Dev 2 (Top-Right)**:
  - `position: absolute`, `top: -55px`, `right: -30px`, `width: 115px`, `height: 115px`.
  - Rest rotation: `rotate(7deg)`.
- **Default Drop Shadow**: `drop-shadow(0 14px 28px rgba(0, 0, 0, 0.75))`.

---

### 2.4 WhatsApp-Style Conversation (MCP Server Core Theme)
The previous table rows were replaced with an organic WhatsApp-style dialogue stream where Dev 2 explains the architectural core of Baton (the Model Context Protocol):

1. **Dev 1 (Message 1)**:
   > *"Bro, when developers leave, all the architectural reasoning evaporates into deleted Slack threads and lost Jira tickets. How do we capture decisions live without forcing engineers to write tedious manual docs?"*
   - Bubble: Dark slate (`#191c22`), border `#282c35`, borderRadius `3px 16px 16px 16px`.

2. **Dev 2 (Message 2 - The MCP Pitch)**:
   > *"That's exactly why I pitched turning Baton into a local **Model Context Protocol (MCP)** server! Since everyone is already coding with Claude, Cursor, and AI agents, Baton hooks straight into the agent runtime via MCP over stdio. Every architectural choice, decision rationale, and unmerged git context gets intercepted automatically while you code."*
   - Bubble: Emerald dark tint (`#0d261b`), border `#1e4f39`, borderRadius `16px 3px 16px 16px`.
   - Read receipt indicator: `✓✓` in mint green.

3. **Dev 3 / Dev 1 (Message 3)**:
   > *"Bro that MCP integration is clutch. And because the MCP daemon runs quietly on localhost, our Shannon entropy engine scrubs Stripe keys, AWS tokens, and secrets client-side before any handover note is compiled."*

4. **Dev 2 (Message 4 - Conclusion)**:
   > *"Exactly. Zero cloud leakage, live agent telemetry, and verified AST-grounded handovers ready in 30 seconds. Pass the knowledge, not just the code. 🤝"*

---

### 2.5 Interactive Cursor Hover Tooltip (`"My GitHub ↗"`) & Profile Links

#### Reference Design Pattern
Inspired by the signature hover pill from `ricco.codes`:
- A soft mint-green floating pill directly tracks the mouse cursor when hovering over either developer sticker.
- Clicking either sticker opens their respective verified GitHub profile in a new browser tab.

#### GitHub Links
- **Dev 1 (Glasses Avatar)**: `https://github.com/vikrannntttt8/`
- **Dev 2 (Mustache Avatar)**: `https://github.com/may1102-1909`

#### Implementation Architecture
1. **State Management**:
   ```jsx
   const [hoveredDev, setHoveredDev] = useState(null) // 'dev1' | 'dev2' | null
   const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

   const handleMouseMove = (e, dev) => {
     setHoveredDev(dev)
     setMousePos({ x: e.clientX, y: e.clientY })
   }

   const handleMouseLeave = () => {
     setHoveredDev(null)
   }
   ```

2. **Floating Cursor Pill Element**:
   ```jsx
   {hoveredDev && (
     <div
       style={{
         position: 'fixed',
         left: isNearRightEdge ? mousePos.x - 140 : mousePos.x + 14,
         top: mousePos.y - 12,
         pointerEvents: 'none',
         zIndex: 999999,
         background: '#86efac',
         color: '#06281e',
         borderRadius: 9999,
         padding: '6px 14px',
         fontSize: 12,
         fontWeight: 700,
         letterSpacing: '-0.01em',
         display: 'inline-flex',
         alignItems: 'center',
         gap: 6,
         boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(52, 211, 153, 0.35)',
         whiteSpace: 'nowrap',
         userSelect: 'none',
         animation: 'fadeIn 0.15s ease-out'
       }}
     >
       {/* GitHub Octocat SVG */}
       <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
         <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
       </svg>
       <span>My GitHub</span>
       <span style={{ fontSize: 13, fontWeight: 800 }}>↗</span>
     </div>
   )}
   ```

3. **Sticker Spring & Glow Effect on Hover**:
   - `transform`: Scales to `1.12` and tilts to `-3deg` (Dev 1) or `+3deg` (Dev 2).
   - `filter`: Activates dual luminous drop-shadow: `drop-shadow(0 0 22px rgba(52, 211, 153, 0.65)) drop-shadow(0 16px 32px rgba(0, 0, 0, 0.85))`.
   - `transition`: `transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease`.
   - `draggable={false}`: Prevents browser ghost-dragging so clicks register instantly.

4. **Edge-Detection Protection**:
   ```jsx
   const isNearRightEdge = typeof window !== 'undefined' && mousePos.x > window.innerWidth - 160
   // When true, offsets left to `mousePos.x - 140` so the tooltip never overflows off-screen
   ```

5. **Chat Avatar Links**:
   - The circular `34x34px` avatars inside the conversation are also wrapped in `<a>` tags pointing to their GitHub profiles with hover scaling (`scale(1.15)`) and border glow.

---

## 3. Files Impacted & Checklist for Merging / Pushing

| File Path | Description |
| :--- | :--- |
| `src/pages/UsagePage.jsx` | Contains all UI updates, fixed ambient glow, and `DeveloperNotesCard` component. |
| `public/stickers/dev-glasses.png` | Transparent sticker asset for Dev 1. |
| `public/stickers/dev-mustache.png` | Transparent sticker asset for Dev 2. |

### Verification Completed
- `npm run build`: Succeeded with code 0 (zero bundle or syntax errors).
- Local HTTP dev server: Verified responding `200 OK` on `/usage`.
- No remote git commits or pushes have been performed.
