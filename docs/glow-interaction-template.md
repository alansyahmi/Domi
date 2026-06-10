# HCI Glow Interaction Template

This template implements a highly premium, human-computer interaction (HCI) focused success/fail border glow animation. It features snappy transitions, focused element-level text blurring during operations, responsive glow origins aligned to triggers, a custom double-pulse intensity swell for failures, and specific easing profiles for larger container components.

---

## 1. CSS Styles (`styles.css`)

Include the following styles in your global stylesheet:

```css
/* Container must be relative to anchor the absolute border overlay */
.success-glow-container {
  position: relative;
}

/* Base border overlay */
.success-border-glow {
  position: absolute;
  inset: -2px;
  border-radius: 0.5rem;
  border: 2px solid #a7f3d0; /* Soft pastel green (Success) */
  box-shadow: 0 0 15px rgba(167, 243, 208, 0.65), inset 0 0 8px rgba(167, 243, 208, 0.3);
  pointer-events: none;
  z-index: 40;
  opacity: 0;
  
  /* Default coordinates match bottom-center (ideal for vertical stack layouts) */
  --glow-x: 50%;
  --glow-y: 90%;
}

/* Responsive override: move origin to middle-right on desktop for horizontal layouts */
@media (min-width: 640px) {
  div.success-glow-container .success-border-glow {
    --glow-x: 90%;
    --glow-y: 50%;
  }
}

/* Soft pastel red/pink (Failure) override */
.success-border-glow.fail {
  border: 2px solid #fca5a5;
  box-shadow: 0 0 15px rgba(252, 165, 165, 0.65), inset 0 0 8px rgba(252, 165, 165, 0.3);
}

/* Success Animation Trigger Class (Snappy 1.2s, instant burst) */
.success-border-glow.animate {
  animation: engulfGlow 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

/* Success Eased Animation (1.6s, smooth ease in/out for larger boxes or menus) */
.success-border-glow.ease-in-out.animate {
  animation: engulfGlowEaseInOut 1.6s ease-in-out forwards;
}

/* Fail Animation Trigger Class (Double pulse, stays longer, swells at 100% border coverage) */
.success-border-glow.fail.animate {
  animation: engulfGlowFail 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

/* Snappy Success Keyframes (starts at 10% radius, static shadow) */
@keyframes engulfGlow {
  0% {
    clip-path: circle(10% at var(--glow-x) var(--glow-y));
    opacity: 1;
  }
  75% {
    clip-path: circle(130% at var(--glow-x) var(--glow-y));
    opacity: 1;
  }
  100% {
    clip-path: circle(150% at var(--glow-x) var(--glow-y));
    opacity: 0;
  }
}

/* Smooth Ease In/Out Keyframes (fade-in, expands, then fade-out) */
@keyframes engulfGlowEaseInOut {
  0% {
    clip-path: circle(10% at var(--glow-x) var(--glow-y));
    opacity: 0;
  }
  20% {
    clip-path: circle(50% at var(--glow-x) var(--glow-y));
    opacity: 1;
  }
  80% {
    clip-path: circle(130% at var(--glow-x) var(--glow-y));
    opacity: 1;
  }
  100% {
    clip-path: circle(150% at var(--glow-x) var(--glow-y));
    opacity: 0;
  }
}

/* Failure Keyframes (2x pulse, swells box-shadow when circle engulfs container edges) */
@keyframes engulfGlowFail {
  0% {
    clip-path: circle(10% at var(--glow-x) var(--glow-y));
    opacity: 1;
    box-shadow: 0 0 15px rgba(252, 165, 165, 0.6), inset 0 0 8px rgba(252, 165, 165, 0.3);
  }
  25% {
    clip-path: circle(130% at var(--glow-x) var(--glow-y));
    opacity: 1;
    box-shadow: 0 0 45px rgba(252, 165, 165, 1), inset 0 0 20px rgba(252, 165, 165, 0.6); /* Swells at 100% border */
  }
  45% {
    clip-path: circle(130% at var(--glow-x) var(--glow-y));
    opacity: 1;
    box-shadow: 0 0 45px rgba(252, 165, 165, 1), inset 0 0 20px rgba(252, 165, 165, 0.6);
  }
  55% {
    clip-path: circle(130% at var(--glow-x) var(--glow-y));
    opacity: 0.4;
    box-shadow: 0 0 15px rgba(252, 165, 165, 0.6), inset 0 0 8px rgba(252, 165, 165, 0.3); /* Dims down */
  }
  65% {
    clip-path: circle(130% at var(--glow-x) var(--glow-y));
    opacity: 1;
    box-shadow: 0 0 45px rgba(252, 165, 165, 1), inset 0 0 20px rgba(252, 165, 165, 0.6); /* Swells at 100% border (pulse 2) */
  }
  85% {
    clip-path: circle(130% at var(--glow-x) var(--glow-y));
    opacity: 1;
    box-shadow: 0 0 45px rgba(252, 165, 165, 1), inset 0 0 20px rgba(252, 165, 165, 0.6);
  }
  100% {
    clip-path: circle(150% at var(--glow-x) var(--glow-y));
    opacity: 0;
    box-shadow: 0 0 15px rgba(252, 165, 165, 0.6), inset 0 0 8px rgba(252, 165, 165, 0.3);
  }
}

/* Button hover/click transition classes */
.primary-button,
.secondary-button {
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease, opacity 0.2s ease;
}

.primary-button > span,
.secondary-button > span {
  transition: filter 0.2s ease;
}

.primary-button.saving,
.secondary-button.saving {
  opacity: 0.9;
}

.primary-button.saving > span,
.secondary-button.saving > span {
  filter: blur(2px); /* Only blurs the text child, keeping the container sharp */
}

/* Premium adapted glow-on-hover style */
.primary-button.glow-on-hover,
.secondary-button.glow-on-hover {
  position: relative;
  z-index: 1;
}

.primary-button.glow-on-hover::before,
.secondary-button.glow-on-hover::before {
  content: '';
  background: linear-gradient(45deg, var(--gold), #10b981, #06b6d4, #3b82f6, #8b5cf6, var(--gold));
  position: absolute;
  top: -1px;
  left: -1px;
  background-size: 400%;
  z-index: -2;
  filter: blur(3px);
  width: calc(100% + 2px);
  height: calc(100% + 2px);
  animation: glowing 20s linear infinite;
  opacity: 0;
  transition: opacity .3s ease-in-out;
  border-radius: 0.45rem;
}

.primary-button.glow-on-hover::after,
.secondary-button.glow-on-hover::after {
  z-index: -1;
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  border-radius: 0.45rem;
}

.primary-button.glow-on-hover::after {
  background: var(--navy);
}

.secondary-button.glow-on-hover::after {
  background: white;
}

.primary-button.glow-on-hover:hover::before,
.secondary-button.glow-on-hover:hover::before {
  opacity: 0.65;
}

.primary-button.glow-on-hover:active,
.secondary-button.glow-on-hover:active {
  opacity: 0.95;
}

@keyframes glowing {
  0% { background-position: 0 0; }
  50% { background-position: 400% 0; }
  100% { background-position: 0 0; }
}

/* Rainbow brand-glow for buttons without loading */
.glow-on-hover.rainbow::before {
  background: linear-gradient(45deg, var(--gold), #10b981, #06b6d4, #3b82f6, #8b5cf6, var(--gold));
  background-size: 400%;
}

/* Active click glow state (keeps it exposed for 0.8s then ease out over 0.4s) */
.glow-on-hover.active-glow::before {
  animation: glowing 20s linear infinite, exposeGlow 1.2s ease-out forwards;
  opacity: 0.85; /* override hover opacity */
}

/* Hide the mask background when clicked to expose full gradient inside the button */
.glow-on-hover.active-glow::after {
  background: transparent !important;
  transition: background 0.15s ease-in-out;
}

/* Ensure text remains visible and readable over the exposed gradient */
.glow-on-hover.active-glow {
  color: white !important;
}

@keyframes exposeGlow {
  0% {
    opacity: 1;
  }
  66% {
    opacity: 1; /* 66% of 1.2s is 0.8s */
  }
  100% {
    opacity: 0;
  }
}
```

---

## 2. React Implementation Template

Use the following React structure to handle triggers, timer cleanup refs, and animation overrides:

```tsx
import React, { useState, useRef, FormEvent } from "react";

export default function GlowDemoComponent() {
  const [isSaving, setIsSaving] = useState(false);
  const [isFailing, setIsFailing] = useState(false);
  const [showSuccessGlow, setShowSuccessGlow] = useState(false);
  const [glowType, setGlowType] = useState<"success" | "fail">("success");
  const [successGlowKey, setSuccessGlowKey] = useState(0); // Changing key resets and restarts CSS animations

  // Refs prevent overlapping timer issues on rapid user clicks
  const successTimeoutRef = useRef<number | null>(null);
  const successDelayRef = useRef<number | null>(null);

  const triggerGlow = (type: "success" | "fail") => {
    // Clear any previous running timers
    if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    if (successDelayRef.current) window.clearTimeout(successDelayRef.current);

    setGlowType(type);
    setSuccessGlowKey((prev) => prev + 1); // Incrementing key forces React to re-mount the animation node

    // Trigger visual overlay after a brief snappy delay (50ms)
    successDelayRef.current = window.setTimeout(() => {
      setShowSuccessGlow(true);
      // Success ease-in-out animation takes 1.6s (1600ms), fail takes 2.2s (2200ms)
      const duration = type === "success" ? 1600 : 2200;
      successTimeoutRef.current = window.setTimeout(() => {
        setShowSuccessGlow(false);
      }, duration);
    }, 50);
  };

  const handleAction = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      // Perform save operations...
      setIsSaving(false);
      triggerGlow("success");
    } catch {
      setIsSaving(false);
      triggerGlow("fail");
    }
  };

  return (
    <div className="card p-7 relative success-glow-container">
      {/* 1. Animation overlay (remounts when successGlowKey increments, uses ease-in-out class for bigger boxes) */}
      {showSuccessGlow && (
        <div 
          key={successGlowKey} 
          className={`success-border-glow ease-in-out animate ${glowType === "fail" ? "fail" : ""}`} 
        />
      )}
      
      <h2>Settings Section</h2>
      
      <form onSubmit={handleAction}>
        {/* 2. Interactive action button with child span targeting */}
        <button 
          className={`primary-button w-full mt-4 glow-on-hover ${isSaving ? "saving" : ""}`} 
          type="submit" 
          disabled={isSaving}
        >
          <span>Save Preferences</span>
        </button>
      </form>
    </div>
  );
}
```
