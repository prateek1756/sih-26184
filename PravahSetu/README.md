# Pravah Setu — Citizen Cybercrime Complaint Portal
> **Smart India Hackathon (SIH) — Problem Statement PS 26184**  
> *"Report Cybercrime. Protect Yourself."*

A modern, responsive, citizen-centric Cybercrime Complaint Portal designed to simplify reporting, provide transparent real-time tracking, and equip citizens with fraud prevention intelligence.

---

## 🚀 Getting Started

To run the project locally:

```bash
# Navigate to project directory
cd PravahSetu

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Build production bundle
npm run build
```

The portal runs by default on: **`http://localhost:5173/`**

---

## 🏛️ Features & Structure

1. **Official Government of India Identity**:
   - State Emblem of India (Ashoka Lion Capital with *Satyameva Jayate*) + Ministry of Home Affairs affiliation.
   - Pravah Setu brand with *"Report. Track. Prevent."* tagline.
   - Accessibility features: Font size switcher (`A-`, `A`, `A+`), English/Hindi toggle, high-contrast support.

2. **Hero Section (Faithfully Matching the UI Reference)**:
   - Capsule banner: `A SAFER INDIA IN A DIGITAL WORLD`
   - Headline: **Report Cybercrime.** **Protect Yourself.**
   - Action CTAs: `Report a Cybercrime →` & `Track Complaint →`
   - Real-time trust badges: *Secure & Confidential*, *Government Verified*, *Real-time Updates*
   - Interactive Cyber Graphic: Glowing shield with padlock, dotted India map, `CYBER SAFE INDIA / STRONGER INDIA`, tricolor ribbon, and landmark skyline silhouette.

3. **Quick Action Section (4 Cards)**:
   - **Report a Cybercrime**: Direct gateway to the 5-step reporting wizard.
   - **Track Your Complaint**: Instant status checker with Complaint ID.
   - **Stay Informed**: Cyber threat awareness guides.
   - **Official Quote Card**: *“A Safer Digital India is a Stronger India” — Ministry of Home Affairs, Government of India*.

4. **Statistics Strip**:
   - `2,45,678` Total Complaints
   - `78%` Resolved Cases
   - `24x7` Support Available
   - `1,28,340` Citizens Helped
   - `Building a Cyber Safe Nation`

5. **Common Cyber Frauds (6 Priority Categories)**:
   - *UPI & Payment Fraud*
   - *Phishing*
   - *Investment Scams*
   - *Fake Customer Care*
   - *Social Media Fraud*
   - *Identity Theft*

6. **Safety Banner ("Think Before You Click")**:
   - Laptop visual with glowing padlock.
   - 4 safety habits: Strong passwords, Never share OTP/PIN, Verify links before clicking, Report suspicious activity.

7. **Multi-Step Complaint Wizard (`/report`)**:
   - Step 1: Complainant Details (Name, Phone, Email, State, District, Language)
   - Step 2: Incident Details (11 categories, Date/Time, Description, Suspect contact/URL, **AI-assisted incident narrative generator** with citizen approval)
   - Step 3: Financial Details (Did you lose money toggle, Amount, Txn mode, Txn ID, Bank, Beneficiary UPI)
   - Step 4: Evidence Files (Drag-and-drop file uploader with progress and preview)
   - Step 5: Review & Submit (Summary with Edit buttons, legal truthfulness declaration, submission)

8. **Complaint Success (`/complaint-success`)**:
   - Generated Complaint ID (`CYB-2026-XXXXXX`), copy button, print acknowledgment, track complaint & dashboard buttons, confetti celebration.

9. **Complaint Tracking (`/track`)**:
   - Search by ID or Mobile, active complaint lifecycle timeline (*Submitted → Verified → Assigned → In Progress → Resolved*), officer remarks, print dossier.

10. **Citizen Dashboard (`/dashboard`)**:
    - KPI counters, filterable & searchable complaints table, responsive mobile card conversion.

11. **Cyber Awareness Center (`/awareness`)**:
    - Searchable knowledge base, red flags, Golden Hour immediate countermeasures, and expandable FAQs.

12. **Citizen Auth (`/login` & `/register`)**:
    - Dual-tab login (instant simulated OTP `261840` with resend countdown timer vs password login) and user registration.

13. **About & Contact (`/about` & `/contact`)**:
    - SIH PS 26184 context, backend readiness architecture diagram, 1930 emergency helpline, feedback form.

---

## 🛠️ Technology Stack

- **Frontend Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS
- **Routing**: React Router 7
- **Forms & Validation**: React Hook Form + Zod
- **Animations**: Framer Motion & Canvas Confetti
- **Icons**: Lucide React
- **Data Architecture**: Client-side service layer with local storage persistence and full REST backend readiness.
