---
name: frontend-design
type: skill
description: "Frontend UI design patterns and best practices for production-grade web interfaces"
version: 1.0.0
tags: [frontend, ui, design, react, css, accessibility]
trigger: "When building UI components, pages, layouts, or styling web interfaces"

providers:
  opencode:
    location: skills/frontend-design/
  claude-code:
    location: skills/frontend-design/
  copilot:
    applyTo: "**/*.{tsx,jsx,css,scss,html}"
---

# Frontend Design Skill

## Philosophy

Production-grade frontend is not generic. Every UI decision — typography, color, spacing, motion — should be intentional. Avoid defaults that make interfaces look AI-generated. Aim for distinctive, purposeful design that serves the user's task.

## Typography

- Use a specific, non-system font stack for branded interfaces; system fonts only for utility/admin UIs
- Establish a type scale with meaningful semantic names: `text-body`, `text-heading-lg`, `text-caption`
- Line length: 60–80 characters for body text; wider for data-dense displays
- Contrast ratio minimum: 4.5:1 for body text (WCAG AA), 3:1 for large text

## Color System

- Define a palette with intentional roles: `color-primary`, `color-surface`, `color-danger`, `color-success`
- Avoid using raw hex values in components — reference design tokens only
- Use color to communicate meaning, not just aesthetics: errors are always destructive red, success is green
- Support both light and dark mode from the start — retrofitting is expensive

## Component Patterns

### Composition over Configuration
Prefer small, composable primitives over large components with many props. A `Button` component should not have 20 variants — compose `Icon + Button` and `Badge + Button` instead.

### State Ownership
- Lift state only as high as necessary
- Co-locate state with the component that owns it
- Use server state (React Query / SWR) for remote data; local state for UI-only concerns

### Accessibility
- Every interactive element must be keyboard-navigable and have a visible focus indicator
- Use semantic HTML: `<button>` not `<div onClick>`, `<nav>` not `<div className="nav">`
- Every image needs descriptive `alt` text; decorative images get `alt=""`
- Form fields need associated labels — `aria-label` is a last resort

## Motion Guidelines

- Animate with purpose: motion should guide attention, not decorate
- Duration: micro-interactions 100–200ms; page transitions 250–400ms
- Use `prefers-reduced-motion` media query to disable animations for users who need it
- Prefer `transform` and `opacity` for performance; avoid animating layout properties

## Performance

- Code-split at the route level; lazy-load heavy components
- Optimize images: correct format (WebP/AVIF), correct size, lazy loading below the fold
- Avoid layout shift: reserve space for dynamic content with placeholder dimensions
- Measure with Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms

## Rules

- NEVER use inline styles for layout — CSS modules, utility classes, or styled components only
- ALWAYS define focus styles explicitly — do not rely on browser defaults
- Test on mobile viewport sizes before marking any UI work complete
- Review rendered output in both light and dark mode
