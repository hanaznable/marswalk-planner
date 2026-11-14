# Route Domain Model and Grid Pathfinding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure TypeScript domain model for waypoints and route results, plus A* pathfinding over an abstract terrain grid that produces distance-focused and terrain-constrained routes, all verified by unit tests without real NASA data.

**Architecture:** All code lives under `src/features/routing/` as pure modules that never import React, Leaflet, or Three.js. Terrain is modeled as a projected grid that future preprocessing will produce (`TerrainGrid`: cell size in metres, per-cell slope or "no data", optional hazard mask). `findPath` solves a single leg with A* (8-neighbour, no corner cutting); `planRoute` splits an ordered waypoint list into legs and computes the optional return leg separately; `planAlternatives` produces both profiles side by side.

**Tech Stack:** TypeScript 6, Vitest (new dev dependency), existing Vite 8 / ESLint 10 setup.

**Spec:** [SCOPE.md](../../../SCOPE.md) — in particular the *Route points*, *Distance-focused route*, *Terrain-constrained route*, *Alternative routes*, and *Round trip* rows of the "Phase 1" table, and the "Route model limits" section. Also [src/features/routing/README.md](../../../src/features/routing/README.md).

## Global Constraints

- All code, comments, identifiers, test names, and commit messages are in English.
- Routing modules do not import React, Leaflet, or Three.js; they do not fetch data or read map state (`routing/README.md`).
- Missing data is never interpreted as safe terrain: a cell whose slope is `null` is impassable.
- The distance-focused route must still respect basic traversability: hazard-mask and no-data cells are impassable in both profiles.
- When no valid route exists, the reason is reported; the algorithm never silently relaxes constraints.
- Values that cannot be computed stay empty and are never filled with zero: if any leg fails, total distance is `null`.
- The return leg is evaluated separately; distance or duration is never simply doubled. The return leg is computed with its own A* call.
- Two results may be identical; no alternative is invented. If both profiles produce the same path, return `identical: true` and do not try to produce a different path.
- The slope limit is a user input and is marked in the type with `slopeLimitIsScenarioAssumption: true`; it is never presented as an official limit.
- No Earth geodesy: distance is only grid steps × `cellSizeMeters` (diagonal step × √2). Ensuring the grid is in a projected Mars CRS with metric cells is the preprocessing step's responsibility.
- No `enum` (`erasableSyntaxOnly: true`); use string literal unions.
- `npm run build`, `npm run lint`, and `npm test` must pass at the end of every task.

## Review Focus

1. **Waypoint on a "no data" cell** → no route is produced; returns `WAYPOINT_BLOCKED` / `cause: 'noData'` (Task 4 test).
2. **Two consecutive waypoints on the same cell** → leg succeeds, `path` is a single cell, `distanceMeters: 0` (a real zero; Task 3 test).
3. **Slope array length does not match `rows*cols`, cell size ≤0 / NaN** → `createTerrainGrid` throws `RangeError` (Task 2 test).
4. **Slope limit is NaN or negative** → `findPath` throws `RangeError` instead of silently treating it as "unlimited" (Task 3 test).
5. **Large open grid (300×300) corner to corner** → finishes in reasonable time thanks to the binary heap and returns the correct octile distance (Task 3 test, no timing assertion).

---

### Task 1: Vitest setup, domain types, and waypoint list operations

**Files:**
- Modify: `package.json` (add `vitest` to devDependencies, `"test": "vitest run"` to scripts)
- Create: `src/features/routing/model/types.ts`
- Create: `src/features/routing/model/waypoints.ts`
- Test: `src/features/routing/model/waypoints.test.ts`

**Interfaces:**
- Produces (`model/types.ts`):
  ```ts
  export interface GridCell { readonly row: number; readonly col: number }
  export interface Waypoint { readonly id: string; readonly label: string; readonly cell: GridCell }
  // The list is ordered: first element is the start, last is the target, the rest are intermediate stops.
  export type BlockCause = 'outOfCoverage' | 'noData' | 'hazard' | 'slope'
  export type RouteProfile =
    | { readonly kind: 'distance' }
    | { readonly kind: 'terrain'; readonly maxSlopeDegrees: number; readonly slopeLimitIsScenarioAssumption: true }
  export type LegKind = 'outbound' | 'return'
  export type RouteFailureReason =
    | { readonly code: 'WAYPOINT_BLOCKED'; readonly waypointId: string; readonly cause: BlockCause }
    | { readonly code: 'NO_PATH'; readonly blockedBy: readonly BlockCause[] }
  export type LegResult =
    | { readonly status: 'ok'; readonly kind: LegKind; readonly fromId: string; readonly toId: string; readonly path: readonly GridCell[]; readonly distanceMeters: number }
    | { readonly status: 'failed'; readonly kind: LegKind; readonly fromId: string; readonly toId: string; readonly reason: RouteFailureReason }
  export interface RouteResult {
    readonly profile: RouteProfile
    readonly legs: readonly LegResult[]
    readonly complete: boolean                  // at least one leg and every leg is 'ok'
    readonly totalDistanceMeters: number | null // null unless complete
  }
  ```
- Produces (`model/waypoints.ts`); every function returns a new array and never mutates its input:
  - `insertWaypoint(list: readonly Waypoint[], waypoint: Waypoint, index?: number): Waypoint[]` — appends when no index is given; throws `Error` if the `id` already exists.
  - `removeWaypoint(list: readonly Waypoint[], id: string): Waypoint[]` — returns an unchanged copy for an unknown id.
  - `moveWaypoint(list: readonly Waypoint[], id: string, toIndex: number): Waypoint[]` — `toIndex` is clamped to `[0, length-1]`.
  - `updateWaypoint(list: readonly Waypoint[], id: string, patch: Partial<Omit<Waypoint, 'id'>>): Waypoint[]`

- [ ] **Step 1: Install Vitest and add the script**

Run: `npm install -D vitest`, then add `"test": "vitest run"` to `package.json` scripts.
Expected: `npm test` exits with "No test files found" (no tests yet).

- [ ] **Step 2: Write the failing tests** (`waypoints.test.ts`, `import { describe, expect, it } from 'vitest'`)

```ts
const a = { id: 'a', label: 'A', cell: { row: 0, col: 0 } }
const b = { id: 'b', label: 'B', cell: { row: 1, col: 1 } }
const c = { id: 'c', label: 'C', cell: { row: 2, col: 2 } }

it('insertWaypoint appends by default and inserts at index', () => {
  expect(insertWaypoint([a, c], b).map(w => w.id)).toEqual(['a', 'c', 'b'])
  expect(insertWaypoint([a, c], b, 1).map(w => w.id)).toEqual(['a', 'b', 'c'])
})
it('insertWaypoint rejects duplicate ids', () => {
  expect(() => insertWaypoint([a], { ...a, label: 'x' })).toThrow()
})
it('removeWaypoint removes by id and ignores unknown ids', () => {
  expect(removeWaypoint([a, b, c], 'b').map(w => w.id)).toEqual(['a', 'c'])
  expect(removeWaypoint([a, b], 'zzz').map(w => w.id)).toEqual(['a', 'b'])
})
it('moveWaypoint reorders and clamps the target index', () => {
  expect(moveWaypoint([a, b, c], 'a', 2).map(w => w.id)).toEqual(['b', 'c', 'a'])
  expect(moveWaypoint([a, b, c], 'c', -5).map(w => w.id)).toEqual(['c', 'a', 'b'])
})
it('updateWaypoint patches label and cell without touching others', () => {
  const out = updateWaypoint([a, b], 'b', { label: 'B2' })
  expect(out[1]).toEqual({ ...b, label: 'B2' })
  expect(out[0]).toBe(a)
})
it('does not mutate the input list', () => {
  const list = [a, b]
  removeWaypoint(list, 'a'); insertWaypoint(list, c); moveWaypoint(list, 'a', 1)
  expect(list.map(w => w.id)).toEqual(['a', 'b'])
})
```

- [ ] **Step 3: Verify the tests fail**

Run: `npm test`
Expected: FAIL — module `waypoints.ts` not found.

- [ ] **Step 4: Write `model/types.ts` and `model/waypoints.ts` with the signatures from the Interfaces block**

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build && npm run lint`
Expected: 6 tests PASS; build and lint clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/routing/model
git commit -m "feat(routing): add route domain types and waypoint list operations"
```

---

### Task 2: Terrain grid and cell classification

**Files:**
- Create: `src/features/routing/pathfinding/terrainGrid.ts`
- Create: `src/features/routing/testing/gridFromAscii.ts` (used only by tests)
- Test: `src/features/routing/pathfinding/terrainGrid.test.ts`

**Interfaces:**
- Consumes: `GridCell`, `BlockCause` (Task 1)
- Produces (`terrainGrid.ts`):
  ```ts
  export interface TerrainGridInput {
    rows: number; cols: number; cellSizeMeters: number
    slopeDegrees: readonly (number | null)[]   // row-major, length rows*cols, null = no data
    hazard?: readonly boolean[]                // row-major, true = known hazard
  }
  export interface TerrainGrid { readonly rows: number; readonly cols: number; readonly cellSizeMeters: number
    readonly slopeDegrees: readonly (number | null)[]; readonly hazard: readonly boolean[] }
  export function createTerrainGrid(input: TerrainGridInput): TerrainGrid
  export function isInBounds(grid: TerrainGrid, cell: GridCell): boolean
  export type CellClass = { passable: true } | { passable: false; cause: BlockCause }
  export function classifyCell(grid: TerrainGrid, cell: GridCell, maxSlopeDegrees: number | null): CellClass
  ```
  - `createTerrainGrid` throws `RangeError` if `rows`/`cols` are not positive integers, if `cellSizeMeters` is not finite and >0, if the length of `slopeDegrees` or a provided `hazard` is not `rows*cols`, or if any non-`null` slope is non-finite or negative. When `hazard` is omitted, every cell is `false`.
  - `classifyCell` priority order: `outOfCoverage` (outside the grid) → `noData` → `hazard` → `slope` (only when `maxSlopeDegrees !== null` and slope `>` limit; a slope equal to the limit is passable).
- Produces (`testing/gridFromAscii.ts`): `gridFromAscii(rows: string[], cellSizeMeters = 1): TerrainGrid` — `.` = 0°, `0`–`9` = digit×5°, `#` = hazard (slope 0), `?` = no data.

- [ ] **Step 1: Write the failing tests**

```ts
it('createTerrainGrid rejects mismatched slope length', () => {
  expect(() => createTerrainGrid({ rows: 2, cols: 2, cellSizeMeters: 1, slopeDegrees: [0, 0, 0] })).toThrow(RangeError)
})
it.each([0, -1, Number.NaN, Infinity])('createTerrainGrid rejects cellSizeMeters %s', (size) => {
  expect(() => createTerrainGrid({ rows: 1, cols: 1, cellSizeMeters: size, slopeDegrees: [0] })).toThrow(RangeError)
})
it('createTerrainGrid rejects mismatched hazard length and negative slope', () => {
  expect(() => createTerrainGrid({ rows: 1, cols: 2, cellSizeMeters: 1, slopeDegrees: [0, 0], hazard: [false] })).toThrow(RangeError)
  expect(() => createTerrainGrid({ rows: 1, cols: 1, cellSizeMeters: 1, slopeDegrees: [-3] })).toThrow(RangeError)
})
it('classifyCell reports causes in priority order', () => {
  const g = gridFromAscii(['.#?4'])
  expect(classifyCell(g, { row: 0, col: 0 }, null)).toEqual({ passable: true })
  expect(classifyCell(g, { row: 0, col: 1 }, null)).toEqual({ passable: false, cause: 'hazard' })
  expect(classifyCell(g, { row: 0, col: 2 }, null)).toEqual({ passable: false, cause: 'noData' })
  expect(classifyCell(g, { row: 0, col: 9 }, null)).toEqual({ passable: false, cause: 'outOfCoverage' })
  expect(classifyCell(g, { row: -1, col: 0 }, null)).toEqual({ passable: false, cause: 'outOfCoverage' })
})
it('classifyCell applies the slope limit only when given, inclusive at the limit', () => {
  const g = gridFromAscii(['4'])                       // 20°
  expect(classifyCell(g, { row: 0, col: 0 }, null).passable).toBe(true)
  expect(classifyCell(g, { row: 0, col: 0 }, 20).passable).toBe(true)
  expect(classifyCell(g, { row: 0, col: 0 }, 19)).toEqual({ passable: false, cause: 'slope' })
})
```

- [ ] **Step 2: Verify they fail** — Run: `npm test` → FAIL (module not found).
- [ ] **Step 3: Write `terrainGrid.ts` and `gridFromAscii.ts` per the Interfaces block**
- [ ] **Step 4: Verify** — Run: `npm test && npm run build && npm run lint` → all tests PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/routing/pathfinding src/features/routing/testing
git commit -m "feat(routing): add terrain grid model and cell classification"
```

---

### Task 3: Single-leg A* pathfinding

**Files:**
- Create: `src/features/routing/pathfinding/minHeap.ts`
- Create: `src/features/routing/pathfinding/findPath.ts`
- Test: `src/features/routing/pathfinding/findPath.test.ts`

**Interfaces:**
- Consumes: `TerrainGrid`, `classifyCell`, `isInBounds` (Task 2); `GridCell`, `BlockCause` (Task 1)
- Produces:
  ```ts
  // minHeap.ts — priority queue (binary heap)
  export class MinHeap<T> { constructor(); push(item: T, priority: number): void; pop(): T | undefined; get size(): number }
  // findPath.ts
  export interface PathConstraints { readonly maxSlopeDegrees: number | null }
  export type PathFailure =
    | { readonly code: 'ENDPOINT_BLOCKED'; readonly endpoint: 'from' | 'to'; readonly cause: BlockCause }
    | { readonly code: 'NO_PATH'; readonly blockedBy: readonly BlockCause[] }
  export type PathResult =
    | { readonly status: 'ok'; readonly path: readonly GridCell[]; readonly distanceMeters: number }
    | { readonly status: 'failed'; readonly reason: PathFailure }
  export function findPath(grid: TerrainGrid, from: GridCell, to: GridCell, constraints: PathConstraints): PathResult
  ```
- Algorithm decisions (not determined by the tests):
  - 8-neighbour movement. Orthogonal step cost `cellSizeMeters`, diagonal step `cellSizeMeters * Math.SQRT2`.
  - No corner cutting: a diagonal step is not allowed if either of its two orthogonal neighbours is impassable.
  - Heuristic: octile distance × `cellSizeMeters` (admissible, so the result is optimal).
  - `blockedBy`: the `cause` values of impassable neighbour cells **inside** the grid encountered during the search; deduplicated and ordered as `['noData','hazard','slope']`. The grid edge (`outOfCoverage`) is not added to `blockedBy`.
  - Throw `RangeError` if `maxSlopeDegrees` is NaN or negative.
  - `from` and `to` are checked with `classifyCell` first; if impassable, return `ENDPOINT_BLOCKED`.

- [ ] **Step 1: Write the failing tests** — where there is no unique optimal path, assert properties rather than the exact path using an `expectValidPath` helper (first/last cell correct, consecutive cells are 8-neighbours, every cell is `classifyCell(...).passable`).

```ts
const opts = { maxSlopeDegrees: null }
it('measures a straight corridor in metres', () => {
  const r = findPath(gridFromAscii(['.....'], 10), { row: 0, col: 0 }, { row: 0, col: 4 }, opts)
  expect(r).toMatchObject({ status: 'ok', distanceMeters: 40 })
  expect(r.status === 'ok' && r.path.length).toBe(5)
})
it('uses diagonal steps with sqrt2 cost', () => {
  const r = findPath(gridFromAscii(['...', '...', '...'], 10), { row: 0, col: 0 }, { row: 2, col: 2 }, opts)
  expect(r.status === 'ok' && r.distanceMeters).toBeCloseTo(20 * Math.SQRT2)
})
it('returns a zero-length path when from equals to', () => {
  expect(findPath(gridFromAscii(['..']), { row: 0, col: 1 }, { row: 0, col: 1 }, opts))
    .toEqual({ status: 'ok', path: [{ row: 0, col: 1 }], distanceMeters: 0 })
})
it('detours around hazards in both profiles', () => {
  const g = gridFromAscii(['.#.', '.#.', '...'])
  const r = findPath(g, { row: 0, col: 0 }, { row: 0, col: 2 }, opts)
  expectValidPath(g, r, { row: 0, col: 0 }, { row: 0, col: 2 }, opts)
  // corner cutting is forbidden, so no diagonal shortcut: down 2, right 2, up 2
  expect(r.status === 'ok' && r.distanceMeters).toBeCloseTo(6)
})
it('treats no-data cells as impassable', () => {
  const r = findPath(gridFromAscii(['.?.']), { row: 0, col: 0 }, { row: 0, col: 2 }, opts)
  expect(r).toEqual({ status: 'failed', reason: { code: 'NO_PATH', blockedBy: ['noData'] } })
})
it('does not cut corners between two blocked orthogonal cells', () => {
  const r = findPath(gridFromAscii(['.#', '#.']), { row: 0, col: 0 }, { row: 1, col: 1 }, opts)
  expect(r).toEqual({ status: 'failed', reason: { code: 'NO_PATH', blockedBy: ['hazard'] } })
})
it('respects the slope limit and reports it as the blocker', () => {
  const g = gridFromAscii(['.6.'])                     // 30° in the middle
  expect(findPath(g, { row: 0, col: 0 }, { row: 0, col: 2 }, { maxSlopeDegrees: null }).status).toBe('ok')
  expect(findPath(g, { row: 0, col: 0 }, { row: 0, col: 2 }, { maxSlopeDegrees: 25 }))
    .toEqual({ status: 'failed', reason: { code: 'NO_PATH', blockedBy: ['slope'] } })
})
it('reports blocked endpoints before searching', () => {
  const g = gridFromAscii(['.#?'])
  expect(findPath(g, { row: 0, col: 1 }, { row: 0, col: 0 }, opts))
    .toEqual({ status: 'failed', reason: { code: 'ENDPOINT_BLOCKED', endpoint: 'from', cause: 'hazard' } })
  expect(findPath(g, { row: 0, col: 0 }, { row: 0, col: 2 }, opts))
    .toEqual({ status: 'failed', reason: { code: 'ENDPOINT_BLOCKED', endpoint: 'to', cause: 'noData' } })
  expect(findPath(g, { row: 0, col: 0 }, { row: 5, col: 5 }, opts))
    .toEqual({ status: 'failed', reason: { code: 'ENDPOINT_BLOCKED', endpoint: 'to', cause: 'outOfCoverage' } })
})
it.each([Number.NaN, -1])('rejects invalid slope limit %s', (limit) => {
  expect(() => findPath(gridFromAscii(['..']), { row: 0, col: 0 }, { row: 0, col: 1 }, { maxSlopeDegrees: limit })).toThrow(RangeError)
})
it('solves a 300x300 open grid corner to corner', () => {
  const g = gridFromAscii(Array.from({ length: 300 }, () => '.'.repeat(300)))
  const r = findPath(g, { row: 0, col: 0 }, { row: 299, col: 299 }, opts)
  expect(r.status === 'ok' && r.distanceMeters).toBeCloseTo(299 * Math.SQRT2)
})
```

Also for `minHeap`: 100 items pushed in random order pop out in ascending priority; `pop()` on an empty heap returns `undefined`.

- [ ] **Step 2: Verify they fail** — Run: `npm test` → FAIL (module not found).
- [ ] **Step 3: Write `minHeap.ts` and `findPath.ts` following the decisions above**
- [ ] **Step 4: Verify** — Run: `npm test && npm run build && npm run lint` → all tests PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/routing/pathfinding
git commit -m "feat(routing): add A* grid pathfinding with explicit failure reasons"
```

---

### Task 4: Multi-leg routes, return leg, and alternative comparison

**Files:**
- Create: `src/features/routing/planRoute.ts`
- Create: `src/features/routing/index.ts` (public API: types, waypoint operations, `createTerrainGrid`, `planRoute`, `planAlternatives`)
- Modify: `src/features/routing/README.md` (one-paragraph description of the new modules; update the "No route ... calculation exists yet" sentence)
- Test: `src/features/routing/planRoute.test.ts`

**Interfaces:**
- Consumes: `findPath`, `PathFailure` (Task 3); `TerrainGrid`, `classifyCell` (Task 2); `Waypoint`, `RouteProfile`, `RouteResult`, `LegResult`, `RouteFailureReason` (Task 1)
- Produces:
  ```ts
  export interface RoutePlanInput { readonly waypoints: readonly Waypoint[]; readonly returnToStart: boolean }
  export function planRoute(grid: TerrainGrid, input: RoutePlanInput, profile: RouteProfile): RouteResult
  export interface RouteAlternatives { readonly distance: RouteResult; readonly terrain: RouteResult; readonly identical: boolean }
  export function planAlternatives(grid: TerrainGrid, input: RoutePlanInput, maxSlopeDegrees: number): RouteAlternatives
  ```
- Behaviour decisions:
  - Profile → constraint: `distance` → `maxSlopeDegrees: null`; `terrain` → the profile's `maxSlopeDegrees`.
  - Legs: one `outbound` leg per consecutive waypoint pair; if `returnToStart`, one `return` leg from the last to the first waypoint via a separate `findPath` call. With fewer than 2 waypoints: `legs: []`, `complete: false`, `totalDistanceMeters: null`.
  - `PathFailure` → `RouteFailureReason` mapping: `ENDPOINT_BLOCKED` → `WAYPOINT_BLOCKED` (the leg's `fromId` / `toId` waypoint depending on `endpoint`); `NO_PATH` passes through unchanged.
  - Remaining legs are still computed after a failed leg, so the user can see every problem at once.
  - `identical` is `true` when both results are `complete` and every leg's `path` is equal cell by cell; otherwise `false`.

- [ ] **Step 1: Write the failing tests**

```ts
const wp = (id: string, row: number, col: number) => ({ id, label: id, cell: { row, col } })
const open = gridFromAscii(['.....', '.....', '.....'], 10)

it('splits waypoints into ordered outbound legs and sums distance', () => {
  const r = planRoute(open, { waypoints: [wp('s', 0, 0), wp('m', 0, 2), wp('t', 0, 4)], returnToStart: false }, { kind: 'distance' })
  expect(r.legs.map(l => [l.kind, l.fromId, l.toId])).toEqual([['outbound', 's', 'm'], ['outbound', 'm', 't']])
  expect(r).toMatchObject({ complete: true, totalDistanceMeters: 40 })
})
it('computes the return leg as its own search', () => {
  // even when the return path is the same, the leg is listed separately and added to the total
  const r = planRoute(open, { waypoints: [wp('s', 0, 0), wp('t', 0, 4)], returnToStart: true }, { kind: 'distance' })
  expect(r.legs.map(l => [l.kind, l.fromId, l.toId])).toEqual([['outbound', 's', 't'], ['return', 't', 's']])
  expect(r.totalDistanceMeters).toBe(80)
})
it('returns an incomplete result with fewer than two waypoints', () => {
  expect(planRoute(open, { waypoints: [wp('s', 0, 0)], returnToStart: true }, { kind: 'distance' }))
    .toEqual({ profile: { kind: 'distance' }, legs: [], complete: false, totalDistanceMeters: null })
})
it('reports a waypoint on a no-data cell and leaves the total empty', () => {
  const g = gridFromAscii(['..?'])
  const r = planRoute(g, { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false }, { kind: 'distance' })
  expect(r.legs[0]).toMatchObject({ status: 'failed', reason: { code: 'WAYPOINT_BLOCKED', waypointId: 't', cause: 'noData' } })
  expect(r).toMatchObject({ complete: false, totalDistanceMeters: null })
})
it('still computes later legs after a failed leg', () => {
  const g = gridFromAscii(['.#..'])
  const r = planRoute(g, { waypoints: [wp('a', 0, 0), wp('b', 0, 2), wp('c', 0, 3)], returnToStart: false }, { kind: 'distance' })
  expect(r.legs.map(l => l.status)).toEqual(['failed', 'ok'])
})
it('planAlternatives flags identical results instead of inventing a detour', () => {
  const r = planAlternatives(open, { waypoints: [wp('s', 0, 0), wp('t', 0, 4)], returnToStart: false }, 25)
  expect(r.identical).toBe(true)
  expect(r.terrain.profile).toEqual({ kind: 'terrain', maxSlopeDegrees: 25, slopeLimitIsScenarioAssumption: true })
})
it('planAlternatives differs when a steep shortcut exists', () => {
  const g = gridFromAscii(['.6.', '...'], 10)
  const r = planAlternatives(g, { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false }, 25)
  expect(r.distance.totalDistanceMeters).toBe(20)
  // a diagonal step next to the steep cell counts as corner cutting: down, right 2, up
  expect(r.terrain.totalDistanceMeters).toBeCloseTo(40)
  expect(r.identical).toBe(false)
})
it('planAlternatives reports a terrain failure without relaxing the limit', () => {
  const g = gridFromAscii(['.6.'])
  const r = planAlternatives(g, { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false }, 25)
  expect(r.distance.complete).toBe(true)
  expect(r.terrain.legs[0]).toMatchObject({ status: 'failed', reason: { code: 'NO_PATH', blockedBy: ['slope'] } })
  expect(r.identical).toBe(false)
})
```

- [ ] **Step 2: Verify they fail** — Run: `npm test` → FAIL (module not found).
- [ ] **Step 3: Write `planRoute.ts` and `index.ts`; update `routing/README.md`**
- [ ] **Step 4: Independence check** — Grep `src/features/routing` (excluding `components/`) for imports from `react`, `leaflet`, or `three` → no matches.
- [ ] **Step 5: Verify** — Run: `npm test && npm run build && npm run lint` → all tests PASS; build and lint clean; `npm run dev` still opens the app unchanged (no UI changes).
- [ ] **Step 6: Commit**

```bash
git add src/features/routing
git commit -m "feat(routing): plan multi-leg routes with return leg and alternatives"
```

---

## Out of scope for this plan (future plans)

- Duration estimates (walking speed, stop durations) — SCOPE "Walking speed and duration".
- Wiring the `RoutePlanner` UI to these modules and showing waypoints on the map (requires the Mars CRS decision and real data).
- Slope-weighted cost (for now the terrain profile only applies a limit; cost is distance).
- Python preprocessing that produces a `TerrainGrid` from a real DEM.
