# Mahesh 3D — End-to-End Implementation Plan

**Purpose:** Rebuild the application into a polished, iJewel-inspired jewelry-design workspace while retaining the existing WebGi renderer, materials, shaders, and working CAD conversion code wherever verified.

**Execution mode:** Implement every phase in sequence in one continuous agent session. After every phase, inspect the diff, run that phase's checks, correct defects, and only then continue to the next phase. Do not stop merely because a phase is complete; stop only for a genuine external blocker that cannot be resolved from the repository or clearly document the limitation and continue with all independent work.

**Primary startup contract:** From the repository root, the finished local stack must start with exactly:

```bash
docker compose up -d --build
```

No manual `npm install`, manual database migration, separate worker start, manual bucket creation, or additional application startup command should be required. After startup, the user should be able to open `http://localhost:3000` and inspect the application. The agent may run additional test and diagnostic commands during implementation; the one-command requirement is for starting the finished application stack.

---

## 1. Product Goal

Build **Mahesh 3D**, an original jewelry-design workspace inspired by the workflow of iJewel Playground. Recreate the useful interaction patterns, not proprietary source code, branding, or asset files.

The main user workflow is:

1. Open Mahesh 3D and see one of two existing built-in GLB demo rings.
2. The ring is already centered and fully visible inside a proper 3D studio viewport.
3. The ring remains stationary by default. The user rotates and zooms when they choose.
4. The scene has a clean white/light-neutral studio background, an actual ground/floor system, contact shadows where supported, and environment lighting/reflections.
5. Upload a GLB or supported Rhino `.3dm` file.
6. For `.3dm`, run the real converter and generate a GLB plus a semantic model manifest. For GLB, validate and prepare the asset without unnecessarily re-encoding it.
7. Load either asset in the **same existing WebGi viewer and rendering pipeline**.
8. Discover components and permit picking, hiding/showing, and assigning roles to the shank, head, prongs, center diamond, accent diamonds, and other gemstones.
9. Change metal appearance and gemstone material parameters without reloading or reconverting the model.
10. Save and reload the model configuration and applicable studio preferences.

### Non-negotiable principles

- Keep the installed WebGi v0.4.6 renderer unless the actual repository proves otherwise and an unavoidable compatibility blocker is documented.
- Keep the existing working diamond rendering implementation and metal PBR material system. Tune and reuse them; do not replace them with a generic shader or an image/animation.
- Keep both existing built-in GLB demo models as regression fixtures and selectable examples.
- Use one viewer instance, one active scene, and one camera/control system. React state updates must not create new WebGL renderers.
- No automatic camera rotation by default. No camera flight when switching tabs. Keep manual orbit, zoom, Fit View, and Reset View.
- Do not increase the number or cost of full-screen render passes without a measured reason.
- Avoid destructive CAD modification. Preserve uploaded originals and their original dimensions/units.
- Never claim universal `.3dm` support. Support only input types that the actual converter can process; report unsupported geometry honestly.
- No fake material controls, fake conversion progress, stubbed success responses, or placeholder “working” endpoints.
- Preserve unrelated work in the working tree. Do not run destructive Git cleanup or reset commands.

## 2. Source of Truth and Baseline Audit

Before editing, inspect the current branch and working tree and read the repository's current state documents, including `CURRENT_SOFTWARE_STATE.md`, `ARCHITECTURE.md`, and the latest CAD-import plan if present. Then verify each important claim against actual code. Do not trust stale documentation or line numbers without inspection.

The available current-state report describes:

- A Vite/TypeScript frontend in `rendering/`.
- WebGi v0.4.6 with a bundled Three.js runtime.
- Existing built-in assets, including `ring_webgi.glb` and `ring2_webgi.glb`.
- An Express backend in `server/`.
- A custom `rhino3dm`-based CAD converter, GLB builder, and component manifest.
- Existing material-role binding, component picking/model inspection, ground settings, studio presets, and camera framing code.
- Local storage and an in-memory job queue in the current backend.
- Existing automatic camera rotation and camera/tab transitions that should be disabled by default.

These are audit-reported facts, not permission to assume all code still works. Re-verify the actual source, runtime, dependency versions, converter fixtures, and current test state.

### Baseline tasks

1. Record the branch and `git status --short`.
2. Inspect frontend/backend scripts, lockfiles, build settings, current assets, tests, upload routes, converter, model loader, material binder, component picker, camera framing, studio settings, and WebGi plugin initialization.
3. Run existing tests and builds using the current repository's supported commands before changing code. Record the real results in the final report.
4. Load both built-in GLBs and record baseline visual appearance, startup/load behavior, console errors, camera interaction, and material switching.
5. Capture an available baseline screenshot or browser test result. Do not make visual regressions impossible to compare.
6. Identify the real conversion limits: `rhino3dm` can parse `.3dm` and use cached render meshes when present, but it does not provide Rhino's full NURBS/Brep meshing kernel. Verify the behavior of the existing converter. Unmeshed Breps may require a compatible RhinoCommon/Rhino.Compute processing path.
7. Inspect actual WebGi v0.4.6 types/source/examples before using APIs for material import/export, scene removal, renderer reset, environment setup, and plugin refresh.

**Phase gate:** do not begin implementation until the agent has a list of confirmed active features, current failures, baseline test results, and external dependencies. Do not stop for user confirmation; continue automatically.

## 3. Target Architecture

Prefer evolving the current repository instead of making an unnecessary new repository or a parallel application. Preserve useful code in `rendering/` and `server/`, but reorganize where required for a maintainable frontend.

### Frontend

- React + TypeScript + Vite for the editor UI, if baseline inspection confirms this is the intended rebuild. Keep Vite; do not migrate to Next.js just to obtain Server Actions.
- A single persistent `ViewerHost`/viewer service that creates `ViewerApp` once and holds the WebGi instance in a stable ref/service outside ordinary React render cycles.
- UI panels may re-render; the WebGi renderer must not be recreated due to React state changes.
- Typed domain state for active model, selected component, manifest/roles, material settings, studio settings, import jobs and persisted configurations.
- The existing WebGi version and plugin sequence should be preserved unless a measured, documented correction is required.

Suggested conceptual frontend structure (adapt to actual repository; do not create redundant duplicate modules):

```text
rendering/src/
  app/                 App shell and layout
  studio/              Persistent WebGi viewer host, camera, environment/ground
  models/              Model library, upload, import status
  materials/           Metal/gem libraries and finish controls
  inspector/           Hierarchy, picking, visibility, role/transform inspector
  cad/                 Dynamic loader, manifest, normalization, component discovery
  state/               Typed state and persistence
  styles/              Design tokens, panel and responsive styles
```

### Backend

Keep Express as the API unless repository evidence reveals a compelling blocker. Next.js Server Actions are not the selected CAD worker architecture.

Use three backend responsibilities:

1. **Express API:** validation, upload initiation, listing models, returning manifests/assets, updating roles and configurations, and reporting job status.
2. **Background CAD worker:** expensive CAD inspection, mesh extraction/tessellation where supported, GLB creation, metadata/manifest generation, validation and optimization.
3. **Infrastructure:** PostgreSQL for durable model/job/config metadata and Redis + BullMQ for queued background jobs and controlled concurrency.

The API and worker should share a small, typed contract and the same storage abstraction. Where the existing application can reuse its current converter, do so; don't rewrite a working converter merely to make its file names match this plan.

### Asset/storage model

- Keep uploaded originals immutable.
- Store generated GLB, manifest, conversion report/warnings, material assets, and optional thumbnails as separate versioned assets.
- Use a storage interface so the local Docker deployment can use a mounted persistent volume and a later production deployment can use S3-compatible object storage without rewriting domain logic.
- Keep original dimensions/units distinct from normalized render transforms.
- Never overwrite the original `.3dm` with a normalized GLB or use the display-scaled GLB as a manufacturing master.

## 4. Docker and One-Command Startup Contract

Create or update one root Compose configuration (`compose.yaml` or `docker-compose.yml`, whichever fits the repository) so the following is the single documented startup command:

```bash
docker compose up -d --build
```

It must build and start all locally runnable services and make the application available at `http://localhost:3000`.

### Required Compose components

Use the smallest architecture that meets the actual app requirements. The expected baseline is:

- `web`: multi-stage build of the Vite frontend, served by a small static web server such as Nginx. The web server must serve the SPA and proxy `/api/` requests to the internal API, avoiding browser-side hardcoded `localhost:5000` URLs.
- `api`: the Express service. It runs internal to the Compose network; only `web` needs to be exposed publicly on the host for local use.
- `worker`: the background converter/processor, preferably using the same backend image with a separate worker command when practical.
- `postgres`: persistent metadata database using a pinned supported major version (default to PostgreSQL 16 unless the actual repo already standardizes on another supported version).
- `redis`: BullMQ queue backend using a pinned supported Redis image.
- `migrate`: a one-shot migration service or an equivalent safe automatic migration mechanism that runs as part of Compose startup; the user must not need a separate migration command.

Use health checks and dependency conditions so the API and worker do not process jobs before dependencies are ready. Avoid circular `depends_on` dependencies. The web container should have a simple health endpoint.

### Startup requirements

- No `.env` file should be required for a local first run. Provide safe development defaults in Compose and an `.env.example` for customization.
- Clearly mark any static defaults as **local development only**. Production deployments must override passwords, secrets, CORS/auth, and storage settings.
- Bind the web port to localhost by default when sensible (`127.0.0.1:3000:80`). Do not expose PostgreSQL or Redis ports publicly by default.
- Persist database and uploaded/processed assets in named volumes, not ephemeral container layers.
- Add `.dockerignore` files and multi-stage builds to avoid copying `node_modules`, `.git`, caches, local secrets, and unnecessary build outputs.
- Build the frontend against relative `/api` paths or an equivalent runtime-configured base URL. Do not bake `http://localhost:5000` into production assets.
- Apply schema migrations automatically and safely during startup. Re-running `docker compose up -d --build` must remain safe and not delete user data.
- Use one shared storage volume between API and worker for the local setup if the current storage adapter uses local files. The API should serve completed assets through authorized routes or safe storage URLs.
- Provide health checks for web, API, Postgres, and Redis. Ensure the worker has reliable startup/error logs; if it exposes a health/readiness mechanism, health-check it too.
- `docker compose up -d --build` must not depend on a hidden manual npm install, a manually launched converter, a pre-created database schema, or a manually created storage directory/bucket.
- Do not promise that this command can provision an external paid Rhino.Compute license or credentials. The locally runnable converter must work within its verified capabilities. If full Rhino-kernel conversion requires an external service/license, keep it optional/configurable, start all other services anyway, and report exactly which `.3dm` geometry requires that external runtime. Never return fake conversion success.

### Container validation gate

Before proceeding, validate the Compose file, build each image, boot the stack, check health endpoints, verify SPA-to-API proxying, and verify data survives container recreation. Use Docker commands internally as needed, even though the user's one-command startup contract must remain satisfied.

**Phase gate:** fix all Dockerfile, networking, startup-order, migration, proxy and health errors before starting the next phase. Do not move on with a Compose stack that only builds but does not run.

## 5. Backend API, Persistence and CAD Jobs

### Durable model/job data

Implement database migrations for the minimum required records. Match the schema to existing code where appropriate rather than needlessly duplicating fields.

Expected entities:

- `models`: ID, owner/access scope if supported, original filename, source format, original asset key/path, processed asset key/path, manifest key/path, source units/dimensions, status, created/updated timestamps, and processing version.
- `conversion_jobs`: job ID, model ID, status, progress, current stage, attempt count, safe error code/message, start/end timestamps, and worker/converter version.
- `component_role_overrides`: model ID, stable node/component ID, role, grouping and update timestamp.
- `ring_configurations`: model ID, configuration name/version, role-to-material assignments, material parameter overrides, studio preferences where appropriate, and timestamps.
- `material_presets`: stable preset ID, display name, kind (`metal`, `gemstone`, `diamond`), supported material asset reference or validated runtime values, schema version, and preview metadata.
- `studio_presets`: stable preset ID, background, environment asset reference and supported ground/renderer settings.

Use JSONB for carefully versioned, validated settings where suitable; use relational columns for queryable identifiers/status. Do not store large binary GLBs or CAD files as database blobs.

### Job lifecycle

Use clear states, for example:

`queued -> validating -> inspecting -> converting -> optimizing -> validating_output -> completed`

Failures should transition to `failed` with an actionable, sanitized error. Cancellation/retry behavior must not corrupt an existing asset. Jobs must be idempotent or versioned so a retry cannot overwrite a newer model unexpectedly.

The UI's progress must come from real job state/stages. Do not fabricate a percent complete just to animate the progress bar. If the converter cannot report exact progress, use stage-based statuses and only advance progress at verified milestones.

### Upload handling and security

- Validate extension, file signature and actual parser acceptance; extension/signature alone is insufficient.
- Enforce size limits on the proxy and API.
- Avoid holding large uploads in Node memory unnecessarily. Stream or use disk-backed temporary uploads with safe cleanup.
- Store originals in immutable paths keyed by generated IDs, not untrusted filenames.
- Treat CAD documents as untrusted data; limit processing concurrency, execution time and memory.
- Do not expose internal filesystem paths or secrets in errors.
- Keep production auth and per-model authorization explicit. If auth is not implemented in the current product, bind the dev service to localhost and document the limitation before public deployment.
- Keep the current endpoint contracts if possible. If routes need to change, provide backward-compatible adapters or update all call sites and tests in the same phase.

## 6. CAD Conversion Contract

Create one well-defined converter interface with a real implementation, using the existing `rhino3dm`-based converter as the first path where it works.

### Input paths

**GLB upload:** validate glTF/GLB structure, inspect the full node hierarchy with accumulated transforms, preserve original materials/extensions, build or complete the semantic manifest, and avoid unnecessary re-encoding.

**3DM upload:** parse a genuine `.3dm`, inspect units/layers/visibility/object IDs/transforms/geometry types, extract suitable precomputed render meshes, resolve block/instance transforms as supported, convert coordinate frames exactly once, preserve component IDs/roles, and emit a valid GLB plus manifest.

### NURBS/Brep capability boundary

`rhino3dm`/OpenNURBS is not equivalent to the full RhinoCommon meshing kernel. Verify whether the particular source geometry has usable render meshes. If a file contains unmeshed NURBS/Breps that the current path cannot tessellate, use a verified RhinoCommon/Rhino.Compute adapter when configured, or fail with a clear `requires_cad_meshing_runtime` error. Do not substitute an empty GLB or treat source control geometry as the finished ring.

Any remote Rhino.Compute integration must be configurable and must not be represented as bundled/working unless tested with a real file and valid license/runtime.

### Geometry integrity

- Preserve original CAD and dimensions.
- Apply unit conversion once; record original units and exact render transform.
- Preserve object transforms, hierarchy and component boundaries.
- Retain flat diamond facet normals. Never apply generic smoothing across diamond facets.
- Use smoothing only on appropriate metal surfaces and only when verified not to damage sharp edges.
- Filter hidden/construction objects by explicit visibility/metadata and conservative rules; don't exclude valid geometry just because a layer name contains “curve”.
- Do not infer every reflective mesh is a diamond.
- Don't apply generic decimation or Draco compression until the resulting model is tested through the actual WebGi loader and relevant material extensions survive.
- Validate output structure, finite coordinates, index bounds, non-empty product geometry, node transforms and material-extension integrity before marking completed.

### Manifest contract

Use a versioned, validated manifest containing at least:

- schema version, model ID, input type, original filename and source units;
- original CAD dimensions and export/render transform;
- generated GLB version and bounds;
- stable node/component IDs, names, source layer/object IDs and parent relationships where available;
- semantic role (`metal_shank`, `metal_head`, `metal_prongs`, `diamond`, `colored_gemstone`, `accent_stone`, `unassigned`);
- role confidence/source (`explicit_metadata`, `layer_name`, `name_heuristic`, `manual_override`);
- mesh/vertex/triangle statistics and facet-normal flags if actually measured;
- warnings and unsupported objects;
- conversion settings and converter version.

Keep semantic mapping separate from assumptions about node names.

## 7. Frontend Rebuild: Mahesh 3D Workspace

Rebuild the editor UI to look and behave like a polished professional jewelry editor, but retain the existing rendering core. Avoid a pixel-for-pixel imitation of iJewel branding or proprietary assets. Use a coherent original design system and the user's existing visual direction where appropriate.

### Main layout

- **Top toolbar:** Mahesh 3D brand, model name, Upload, Save configuration, Fit View, Reset View, optional Auto Rotate toggle (off by default).
- **Left panel:** model library, material library, gemstone presets, selectable built-in demo models.
- **Center viewport:** main WebGi canvas with the ring occupying a well-framed central area, ground plane, background/environment and shadows.
- **Right panel:** scene hierarchy, selected object, visibility, role assignment and supported transform/material settings.
- **Bottom/compact controls:** only context-sensitive configuration controls where needed; do not permanently cover the ring with a huge dock.

Panels should be collapsible/resizable where practical, responsive, keyboard accessible and visually consistent. Avoid excessive glassmorphism, excessive animations, arbitrary iconography and lots of empty cards. The jewelry model must be the visual focus.

### Visual quality requirements

- Neutral/white studio is the default; pink is an optional preset.
- No automatic ring rotation or automatic camera flight on tab changes.
- Manual orbit and zoom remain responsive.
- The complete model should fit inside the viewport after load, with comfortable margins.
- No model clipping behind panels or controls.
- Avoid hardcoded screen pixel offsets as the sole camera framing method.
- Avoid layout shifts when the inspector opens or closes; update camera aspect and framing when the canvas dimensions actually change.
- No fake progress indicators, decorative animation loops, or buttons that don't do anything.
- Every visible control needs a real action, a disabled/unsupported state, or should be removed.

### React + WebGi lifecycle

- Use a stable viewer service/React ref.
- Initialize WebGi once after the canvas mounts.
- Never create the viewer as a side effect of every render.
- Keep WebGi object/material references outside serializable UI state; store stable IDs and values in UI state.
- Detach listeners on teardown and avoid duplicated event handlers.
- Use safe cleanup only on actual unmount, not whenever a panel or slider state changes.
- State changes for material/background settings should mutate the live scene/material in place where supported.

## 8. Stationary Studio, Ground and Camera

### Studio

- Use the existing `GroundPlugin` if it is the supported current ground implementation. Do not also add `ContactShadowGroundPlugin` if the installed WebGi documentation says the two are incompatible.
- Keep visible background color independent of the HDR environment used for reflections.
- Reuse an existing licensed/owned environment asset if available. If none exists, choose an appropriately licensed environment asset and record its source/license; do not add a randomly downloaded or unlicensed HDRI.
- Configure ground height using normalized render bounds and actual coordinate conventions. Verify orientation; don't assume Y-up or Z-up after export without evidence.
- Keep actual ground shadows and reflections where the chosen plugin supports them.
- Tune color management/tone mapping so the white environment doesn't blow out all metal/diamond details. Do not solve overexposure by arbitrarily lowering every light or shader parameter.

### Camera

- Turn `autoRotate` off by default.
- Remove tab-dependent camera flights; keep optional explicit Fit View/Focus actions.
- Compute bounds from visible, relevant jewelry meshes after world matrices update, ignoring excluded helpers/construction objects conservatively.
- Apply non-destructive render normalization through a wrapper/root transform. Do not normalize the same asset both in the backend and frontend without an explicit manifest contract.
- Use actual perspective FOV and current canvas aspect to fit the full bounds with margins.
- Keep one camera/control implementation and stable orbit target per active model.
- Update camera aspect on canvas resize via `ResizeObserver` or the verified WebGi mechanism.
- After changing models, reset relevant TAA/progressive history through verified APIs so old frames don't ghost into the new ring.
- On material slider movement, do not repeatedly reinitialize the camera or renderer.

## 9. Material System: Metal PBR, DiamondPlugin, PMAT and DMAT

### Metal materials

The current-state report says the application uses WebGi `MeshStandardMaterial2`, not custom metal GLSL. Verify this in code. Reuse it.

Support reusable metal presets such as polished yellow gold, white gold, rose gold, platinum and satin variants. At minimum, preserve/control color, metalness, roughness, and environment intensity where the installed material API supports them.

- Keep the correct metallic behavior (normally metalness close to 1 for metals).
- Lower roughness for high polish and raise it for satin/matte finishes.
- Keep base color, roughness and reflection intensity as distinct properties.
- Avoid replacing already compatible native materials unless required for the assigned preset.
- Avoid accidental mutation of a shared material used by unrelated components; clone or share materials intentionally.

### Diamond materials

The current-state report says the application uses WebGi `DiamondPlugin` and `makeDiamond()` or an equivalent supported runtime path, with parameters such as refractive index, dispersion, absorption and environment-map intensity. Verify all exact APIs/values in the installed WebGi v0.4.6 package before relying on them.

- Keep the existing diamond shader/plugin.
- Apply it only to meshes/groups assigned a gemstone role.
- Preserve facet geometry and flat normals.
- Support separate center-stone and accent-stone material settings.
- Tune brilliance/environment intensity and dispersion within bounded, visually tested ranges.
- Keep bloom separate from diamond-specific material controls; document when bloom affects the rest of the image too.
- Don't pretend a normal transparent PBR material is equivalent to DiamondPlugin.
- Don't claim a gemstone will look optically correct if its source geometry is unsuitable.

### PMAT/DMAT authoring and import

- Verify standalone `.pmat`/`.dmat` loading and export/authoring APIs against installed WebGi v0.4.6 and official docs.
- If official presets are available, test importing and assigning them to one demo mesh of the correct kind.
- Do not invent proprietary file structures or use an unverified method such as an assumed `exportAsset()` API.
- If the standalone authoring/export route is not available in code, implement a versioned internal **preset registry** backed by validated runtime configuration for all built-in materials. Document which presets are native PMAT/DMAT files versus application-managed presets.
- Support PMAT/DMAT only through verified compatibility. Do not hand-write fake `.pmat` or `.dmat` files and label them native assets.
- Keep reusable material presets separate from per-model component-role assignments and studio settings.

### Material changes must be local

Changing a metal or diamond property must not require a CAD conversion, GLB network fetch, a viewer reinitialization, or full scene reload. Update the active material in place where supported and invalidate rendering history only when necessary.

## 10. Component Picking, Hierarchy and Visibility

Implement a useful editor hierarchy based on the active scene graph and manifest.

- Allow click-to-select in the viewport using the current compatible picking API or verified Three.js raycasting.
- Selecting an object highlights it without permanently destroying its assigned material.
- Show name, parent, material/role, visibility, and transform information.
- Add hide/show controls for individual objects and parent groups.
- Hidden objects should be excluded from visible-model bounds when framing if appropriate; hiding must not delete them.
- Role mapping should persist by stable node/component ID, not only transient array index or non-unique name.
- Allow grouping selected stones into center-stone or accent-stone groups.
- Changing a gemstone preset applies only to selected/mapped gemstone meshes; metal parts remain unchanged.
- Changing a metal preset applies only to mapped metal groups; gemstones remain unchanged.
- If the source model combines unrelated components into one mesh, show an explicit limitation and provide supported mapping/preprocessing. Never claim independent picking is possible when there are no separate selectable primitives/material groups.
- Verify parent transforms and raycast coordinates after normalization and component picking.

## 11. Persistence and State

Persist only suitable serializable data:

- Model records and asset versions.
- Source-to-exported-object mapping and user role overrides.
- Material preset IDs and validated parameter overrides.
- Selected configuration name/version.
- Studio preferences and optional camera view preset.

Do not serialize WebGL resources, live Object3D instances, plugin instances, or material objects directly. Rebuild those at runtime from asset IDs, manifest data and validated configuration values.

For the initial local deployment, persistent PostgreSQL and named storage volumes are required. Add migrations and seed the two built-in demo models automatically so they appear without manual setup. Avoid requiring a separate manual database/bootstrap command.

## 12. Testing and Anti-Slop Quality Gates

The agent must test each phase before beginning the next one. “It compiles” is not enough.

### Required automated tests

**Frontend/unit:**
- Manifest schema validation and role mappings.
- Unit conversions and canonical normalization math.
- Bounding calculations with nested transforms, hidden helpers, and distant outliers.
- Camera fitting for different viewport aspect ratios and model dimensions.
- Material preset validation and correct role targeting.
- No renderer reinitialization when React UI state changes.
- State persistence and reset-to-default behavior.

**Backend/unit/integration:**
- Upload file signature/size validation.
- Valid/invalid GLB handling.
- Genuine `.3dm` converter fixture for every supported input path.
- Converter behavior when render meshes are missing or Breps are unsupported.
- Model/job database lifecycle.
- Queue success/failure/retry transitions.
- Manifest and asset delivery.
- Role override and configuration persistence.
- Traversal/transform correctness for GLB node matrices.
- No fake success when conversion fails.

**Browser/E2E and visual verification:**
- Initial demo screen.
- Load both built-in GLBs.
- Direct GLB upload.
- `.3dm` upload and actual conversion where the runtime supports the test file.
- Metal and gemstone selection.
- Selecting a small diamond and changing only that stone/group.
- Hide/show a component.
- Switch models repeatedly.
- Fit View and reset behavior.
- White/neutral/pink background and ground/shadow controls.
- Browser console has no new uncaught exceptions.
- Check wide and narrow viewport behavior.

Use the repository's existing test framework when possible. Add Playwright or another browser test dependency only if justified and compatible with the current stack. For WebGL visual checks, do not rely exclusively on brittle pixel-perfect snapshots across unrelated GPU drivers; combine interaction assertions, screenshots and documented manual review.

### Performance preservation gate

Before changing the UI or renderer, capture baseline timings for the two built-in models at the same viewport size/device settings.

After implementation, compare:
- First usable render/load time.
- Average frame time/FPS while idle and while interacting.
- GPU/CPU memory trend while switching models.
- GLB size and number of draw calls/triangles where measurable.
- Main-thread blocking during material changes.

Do not increase the number of render passes or raise quality settings by default without measurements. Avoid extra continuously running animations, duplicate WebGL contexts, repeated GLB reloads, and repeated material creation on slider drag. Aim to avoid a regression greater than 10% in comparable baseline measurements; if environment variance makes a result inconclusive, record that and inspect it instead of fabricating success. Desktop 60 FPS and mobile 30 FPS are targets, not promises, until tested on representative hardware.

### Mandatory phase-gate routine

After **every phase**:

1. Inspect every changed file and the complete Git diff.
2. Check for placeholders, dead controls, duplicated logic, unsafe casts, unhandled errors, and copied assumptions from the plan.
3. Run relevant tests, type checks, lint and build commands.
4. Run or extend integration tests for changed API/asset contracts.
5. Check browser console, service logs, and Docker health where applicable.
6. Fix every failure caused by the phase.
7. Re-run failed checks until passing or a genuine external dependency is proven unavailable.
8. Record concise phase results in the final report/agent progress output.
9. Only then advance automatically to the next phase. Do not wait for user confirmation between phases.

If a phase has an external blocker (for example, a Rhino runtime/license is absent), implement and test the available parts, document the exact boundary, and continue all independent phases. Do not fake a pass.

## 13. Implementation Phases and Exit Criteria

### Phase 0 — Audit and baseline

Deliverables: verified current architecture, baseline commands/tests, baseline screenshots/performance data, list of known issues and external dependencies.

Exit: existing checks have been run and their real status is known. Continue automatically.

### Phase 1 — Docker baseline and one-command startup

Deliverables: root Compose file, frontend Dockerfile, backend/API Dockerfile, worker command/container, Postgres and Redis services, storage volume, migrations/startup orchestration, health checks, `.dockerignore`, `.env.example`, Nginx SPA/API proxy configuration as needed.

Exit: `docker compose up -d --build` brings up the application at `http://localhost:3000`; health checks and API proxy work; no manual install/migrate step is required; model/data volume survives container recreation. Test this before further phases.

### Phase 2 — Reliable backend and CAD job lifecycle

Deliverables: persistent metadata, migrations, durable queue, upload validation, background job execution, status reporting, storage abstraction, conversion failure handling and versioned model/manifest records.

Exit: API/job integration tests pass; the existing supported real `.3dm` fixture converts; unsupported CAD paths fail explicitly and do not return fake success. Both API and worker use the same asset contract.

### Phase 3 — Stable WebGi viewer and 3D studio

Deliverables: persistent viewer host, stationary default camera, neutral/white studio, existing ground/shadow system configured correctly, background/environment separation, canonical model framing, resize handling, explicit Fit View/Reset View, no tab camera flights.

Exit: both built-in demo GLBs still render with the same current shaders; full ring fits and is stationary by default; orbit and zoom work; ground and environment do not create clipping/overexposure; no duplicate renderer. Existing benchmark does not materially regress.

### Phase 4 — React editor workspace

Deliverables: high-quality Mahesh 3D layout, left library, center viewport, right inspector, responsive/collapsible panels, top toolbar, loading/error states, model selection and two built-in demo options.

Exit: UI controls all have functional actions; WebGi viewer survives ordinary React state changes without reinitialization; panels do not block canvas interaction; desktop and narrow viewport checks pass.

### Phase 5 — Unified model ingestion and normalization

Deliverables: direct GLB path, current verified `.3dm` path, normalization manifest contract, robust bounds, component IDs, upload settings, true progress stages, GLB validation and safe model lifecycle.

Exit: built-in GLBs, a real supported uploaded GLB, and the actual supported `.3dm` fixture load through the same viewer pipeline; no out-of-origin/helper object distorts the bounds; switch-model tests pass.

### Phase 6 — Component picking and configuration

Deliverables: hierarchical inspector, stable picking, hide/show, selected-object highlight, role mapping, metal and gemstone groups, center/accent stone configuration, persistence of role overrides and saved configurations.

Exit: selection of a small separately represented diamond updates only its intended mesh/group; metal changes do not change stones; gemstone changes do not change metal; roles survive reload; merged-geometry limitations are communicated correctly.

### Phase 7 — Material/scene preset system

Deliverables: metal PBR preset library, DiamondPlugin-compatible preset controls, brilliance/dispersion controls with bounded defaults, studio presets, appropriate ground/shadow controls, and PMAT/DMAT import/export only via verified v0.4.6-supported APIs. If native file authoring is unavailable, deliver an internal versioned preset registry and document the native format limitation.

Exit: real values change live rendered materials; defaults/reset work; no fake controls; no material leaks on slider movement; environment, metal and diamond controls remain independent where their APIs allow it.

### Phase 8 — Hardening, full test sweep and review handoff

Deliverables: security and failure handling, performance comparison, full tests/build, Docker clean startup test, final docs/run instructions, final diff review and a concise results report.

Exit: all acceptance criteria are either verified or listed as blocked with evidence. The application is ready for the user to inspect at `http://localhost:3000` after the single startup command.

## 14. Final Acceptance Checklist

- [ ] Built-in `ring_webgi.glb` and `ring2_webgi.glb` remain available as demo models.
- [ ] React UI is polished, coherent, responsive, and focused on the jewelry viewport.
- [ ] Existing WebGi v0.4.6 renderer and diamond/metal rendering systems are reused.
- [ ] No automatic camera rotation by default; user orbit/zoom and explicit Fit/Reset work.
- [ ] White/neutral studio, existing ground system, shadows and environment reflections work together.
- [ ] No clipped or microscopic model after upload; bounds and transforms are correct.
- [ ] Direct GLB upload works.
- [ ] Real supported `.3dm` conversion works through the converter and produces GLB + manifest.
- [ ] Unmeshed/unsupported CAD geometry fails clearly or uses a verified configured Rhino meshing runtime.
- [ ] Object hierarchy, picking, hide/show and component role mapping work for distinct components.
- [ ] Metal and gemstone controls update the intended meshes in place.
- [ ] PMAT/DMAT support uses verified asset APIs; unsupported native authoring is not faked.
- [ ] Configurations and model metadata persist in the database.
- [ ] Docker Compose includes health checks, persistent storage and startup migrations.
- [ ] From repository root, `docker compose up -d --build` is sufficient to start the local application stack.
- [ ] Existing tests/builds pass; new tests pass; any external blockers are clearly identified.
- [ ] Comparable performance is measured and no unjustified quality/performance regression is introduced.
- [ ] Final Git diff is reviewed; unrelated user changes are untouched.

## 15. Final Agent Report and User Handoff

When all possible phases are complete, report:

1. What was implemented in each phase.
2. Actual files added and changed.
3. Exact tests/builds executed and their results.
4. Docker services and health results.
5. Whether a real `.3dm` was converted and opened by the live viewer.
6. Actual current material/PMAT/DMAT capabilities and any verified limitations.
7. Baseline vs final performance observations.
8. Any remaining external dependency or blocker.
9. The single command to start the stack: `docker compose up -d --build`.
10. Tell the user explicitly that the app is ready to check at `http://localhost:3000` **only if the command and startup were actually verified**. If not, state exactly what prevented verification and never claim it is running.

Do not commit changes unless explicitly requested. Do not end after preparing this document. The implementation agent receiving this plan must carry out the phases sequentially and perform the phase-gate checks before advancing.
