# BATON 🏃‍♂️

> **Pass the knowledge, not just the code.**  
> When engineers leave, the code stays but the reasoning disappears. Baton captures architectural decisions directly from your AI coding agents and git history, generating cited, secret-redacted, role-based handovers before anyone walks out the door.
>
> **CodersInPune Hackathon 2026** · **Track: Full Stack** · **Team: MUMBAI_WALE**

---

## ⚡ Key Highlights

### 1. Interactive 3D Paper WebGL Hero
- **Inspired by ThreeUI 3D Paper (`@designcodeio/threeui`)**:
  - Realistic translucent 3D floating paper/certificate plane with physics-based curvature.
  - GLSL vertex shader simulating paper bend and curl conserving arc length.
  - Equirectangular PMREM reflection mapping, directional key/fill/rim lighting, and interactive specular point lights tracking the cursor.
  - Subtle procedural film grain and soft depth halos.
- **Architectural Typography**:
  - Background layer displays **`BATON`** in oversized architectural display typography behind the bending 3D paper.
- **3D Card Surface Details**:
  - **Top Monogram / Header**: `BATON` + Brand Mark + Registered Symbol `®`
  - **Sub-Badge**: `TEAM MUMBAI_WALE`
  - **Big Title**: `Pass the knowledge, not just the code.`
  - **Project Details**: `CodersInPune Hackathon 2026 · Track: Full Stack`
  - **Body Note**: `Autonomous developer handover platform powered by MCP & Supabase.`
  - **Bottom Monospace Footer**: `BATON // MUMBAI_WALE // ROUND 2 BUILD`
  - **Interactive CTA Buttons**: Direct navigation for `"Explore Dashboard"` and `"View Handover Review"`.
- **Live Variant Switcher**:
  - Seamlessly toggle between `Baton Official`, `Certificate`, `Japanese (認定証)`, `Site of the Year (SOTY)`, and `Nocturne`.

### 2. Live Handover Inspection Dashboard
- Interactive preview with verified claim status classification:
  - 🟢 **Verified**: Traceable decisions with verified PR approvals (e.g., Supabase migration).
  - 🟡 **Inferred**: Extracted from unmerged branches and commits (e.g., payment webhook).
  - 🔴 **Conflicting**: Discrepancies flagged for incoming engineers (e.g., release dates).
- Quarantined secrets counter and role clearance filters.
- Expandable file inspect diffs (`auth/migration.md`, `api/webhooks/payment.ts`, etc.).

### 3. Architecture Pipeline
- **01 Capture**: Real-time developer reasoning indexing via MCP & agent daemon.
- **02 Verify**: Cryptographic redaction of JWTs/passwords and AST-grounded claim checking.
- **03 Deliver**: Tailored role-based handovers presented in interactive 3D cards and reports.

### 4. Preservation & Route Support
- Clean independent routing:
  - `http://localhost:3000/` or `#/paper` — 3D Paper Landing Experience.
  - `#/dashboard` or `#/review` — Handover Inspection Dashboard.
  - `#/classic` — Original Framer-style build.
  - `#/auth` — Simulated Auth workflow (Magic link, GitHub OAuth, password).

---

## 🚀 Quick Start (Localhost Preview)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

4. **Production Build:**
   ```bash
   npm run build
   ```

---

## 🛠️ Tech Stack

- **React 18**
- **Vite 6**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **Three.js r149 (WebGL, GLSL, PMREM, CanvasTexture)**
- **ThreeUI 3D Paper Source Bundle**
- **Inter, Inter Tight & JetBrains Mono Typography**
