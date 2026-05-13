# Rack+ Rebuild Roadmap

This document is the working plan for rebuilding Rack+ into a more reliable backend and a more polished, feature-rich rack planning experience.

## Current State Snapshot

- Stack: Express, Prisma, PostgreSQL, Vite, React, Tailwind, Radix-style component dependencies, React DnD.
- Product shape: rack builder, saved rack library, device catalog, CSV import, catalog sync from AVCAD/Google Sheets, PNG/print export, cable connection planning.
- Backend strengths: Prisma schema exists, route surface is small, catalog sync already captures important domain behavior.
- Backend issues: routes are thin and inconsistent, server startup owns too many responsibilities, admin UI is inline HTML, auth is minimal, no OpenAPI contract, no test harness, no API versioning, no audit/history model.
- Frontend strengths: useful domain features already exist, including rack placement, cable metadata, import/export, and device catalog workflows.
- Frontend issues: core planner state is concentrated in a very large component, the UI language is visually heavy, data fetching is manual, error/loading states are uneven, and there is no clear app shell or reusable design system.

## Rebuild Principle

Preserve domain intelligence. Replace the architecture around it.

The rack placement rules, CSV/catalog parsing knowledge, saved rack shape, and cable calculations are valuable. The rebuild should extract them into testable modules, then present them through cleaner backend services and a focused frontend workbench.

## Target Architecture

### Backend

- Keep TypeScript, Prisma, and PostgreSQL.
- Refactor Express into a layered backend:
  - `app` setup, middleware, route registration
  - versioned API routes under `/api/v1`
  - service layer for rack, catalog, import, cable, and admin operations
  - repositories for Prisma access only
  - shared response/error helpers
  - typed environment validation
- Add first-class operational features:
  - catalog sync job history
  - admin API backed by React UI instead of inline HTML
  - rack revision history
  - duplicate/collision validation at the service layer
  - seed/demo data for local development
  - OpenAPI or generated route contract
- Add quality gates:
  - backend typecheck
  - API contract tests
  - Prisma migration checks
  - service unit tests for rack placement, imports, and sync normalization

### Frontend

- Keep Vite and React unless we explicitly decide otherwise.
- Build a proper app shell:
  - dashboard
  - rack workbench
  - saved racks
  - device catalog
  - cable finder
  - admin/settings
- Introduce a small design system:
  - buttons, icon buttons, fields, tabs, dialogs, tables, empty states, toasts
  - consistent spacing, typography, density, and color tokens
  - restrained operational UI rather than a landing-page-first experience
- Split planner state into smaller feature modules:
  - rack document state
  - placement/validation
  - imports
  - device selection
  - cable connections
  - persistence
- Add richer UX:
  - command/search palette
  - autosave drafts
  - undo/redo
  - rack validation panel
  - collision and power/depth warnings
  - better saved rack filtering
  - import preview with mapped columns and unmatched-device review
  - catalog sync status and history

## Staged Plan

### Stage 1 - Audit, Decisions, and Baseline

Goal: make the current app understandable and safe to change.

Codex tasks:

1. Inventory existing backend routes, data models, frontend flows, and reusable domain utilities.
2. Add repo-level scripts for build/typecheck where missing.
3. Add environment examples and local setup notes if incomplete.
4. Decide the v1 API contract and frontend app map.
5. Identify the first vertical slice to rebuild.

User tasks:

1. Confirm the primary deployment target: local Mac Studio only, LAN users, or hosted/cloud.
2. Confirm whether Rack+ needs user accounts, employee-only attribution, or simple admin-token access.
3. Provide one real-world sample workflow: for example, "import AVCAD CSV, place devices, make cable list, export PNG."
4. Share any brand constraints: Fox colors required, neutral professional UI preferred, or something else.

Done when:

- We can run typecheck/build locally.
- We have a written target app map.
- We agree on auth/deployment assumptions.
- The first rebuild slice is chosen.

### Stage 2 - Backend Foundation

Goal: replace ad hoc backend structure with a maintainable API core.

Codex tasks:

1. Create modular server setup with `createApp()`.
2. Add typed env validation.
3. Move route logic into services.
4. Add consistent API errors and response helpers.
5. Add `/api/v1/health`, `/api/v1/racks`, `/api/v1/catalog`, and `/api/v1/admin`.
6. Add tests for the highest-risk services.

User tasks:

1. Verify local PostgreSQL access.
2. Provide or approve sample data for seeds.
3. Test the health endpoint and saved rack flow on your machine.

Done when:

- Backend can start cleanly.
- API behavior matches the old app where required.
- New service tests pass.

### Stage 3 - Frontend Foundation

Goal: create the polished app shell and design system.

Codex tasks:

1. Replace the landing-first flow with a dashboard/workbench app shell.
2. Build shared UI primitives.
3. Add route-level layouts for dashboard, racks, catalog, cable finder, and admin.
4. Add typed API client boundaries.
5. Add loading, empty, error, and offline states.

User tasks:

1. Review screenshots.
2. Try the main navigation.
3. Mark any copy, labels, or workflow names that feel wrong.

Done when:

- App feels like an operational tool.
- Main navigation is stable.
- Existing rack features remain reachable.

### Stage 4 - Rack Workbench Rebuild

Goal: make the core builder easier, faster, and safer.

Codex tasks:

1. Split `RackPlanner` into feature modules.
2. Add document state with dirty tracking, undo/redo, and draft autosave.
3. Improve rack visualization controls.
4. Add validation side panel for collisions, missing ports, depth, power, and placement.
5. Improve device picker and quick add.
6. Preserve CSV import, PNG export, print, and save/load flows.

User tasks:

1. Run through a real rack build.
2. Tell me where the workflow feels slow or confusing.
3. Verify output PNG/print quality.

Done when:

- Rack creation and editing are easier than the current app.
- Validation prevents common mistakes.
- Export outputs are trustworthy.

### Stage 5 - Catalog, Import, and Admin

Goal: make data management reliable and transparent.

Codex tasks:

1. Build React admin/catalog UI.
2. Add catalog sync status, job history, and manual sync controls.
3. Improve import mapping and unmatched-device review.
4. Add device category management.
5. Add audit trail for destructive actions.

User tasks:

1. Confirm CSV/sheet source behavior.
2. Test catalog sync.
3. Review admin destructive actions.

Done when:

- Catalog changes are visible and explainable.
- Admin tasks no longer depend on inline HTML.
- Imports are predictable.

### Stage 6 - Polish, Packaging, and Deployment

Goal: make Rack+ feel finished.

Codex tasks:

1. Add final responsive polish.
2. Add smoke tests for core flows.
3. Update Mac Studio launch/deploy scripts.
4. Write operator documentation.
5. Build release checklist.

User tasks:

1. Run final acceptance workflow.
2. Confirm LAN/local access.
3. Approve release packaging.

Done when:

- App can be built, launched, used, and maintained from clear instructions.
- Rebuild is ready for daily use.

## First Recommended Slice

Start with Stage 1 plus the beginning of Stage 2:

1. Add root scripts and baseline quality commands.
2. Refactor backend startup into `createApp()` without changing public behavior.
3. Add typed env validation.
4. Add a simple React app shell route structure while keeping the existing planner reachable.

This gives us a better foundation quickly without risking the rack builder before we have tests around it.
