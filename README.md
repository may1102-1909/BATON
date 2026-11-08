# BATON 🏃‍♂️

> **Pass the knowledge, not just the code.**
> When engineers leave, the code stays but the reasoning disappears. Baton captures architectural decisions directly from your AI coding agents and git history, generating cited, secret-redacted, role-based handovers before anyone walks out the door.

---

## ⚡ Features

- **Direct Framer Component Reproduction**: Faithfully recreated from Framer module `https://framer.com/m/Baton-9klTSK.js@jX5iVIgojAlxgrHyMaLC`.
- **Interactive Handover Inspection Demo**:
  - Live preview with status classification:
    - 🟢 **Verified**: Traceable with verified PR approval.
    - 🟡 **Inferred**: Extracted from unmerged branches / commits.
    - 🔴 **Conflicting**: Highlights discrepancy between tasks & notes.
  - Interactive accordion to inspect code files and context snippets.
  - Redaction badges for secrets & role clearance security.
- **Simulated Auth Workflow**:
  - Magic Link simulation.
  - GitHub OAuth flow demo.
  - Password-based auth mode with form validation and show/hide toggles.
- **Responsive & Dark-Themed**:
  - Precision dark UI styled to match Baton's brand palette (`#0c0d0e`, `#17181c`, `#34d399`).
  - Mobile-responsive navigation and layouts.

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
   http://localhost:5173
   ```

---

## 🛠️ Tech Stack

- **React 18**
- **Vite 6**
- **Inter & JetBrains Mono Fonts**
- **Custom SVG Icons & Components**
