# Rota Domain Modeli ve Grid Yol Bulma — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rota noktalarını (waypoint) ve rota sonuçlarını tanımlayan saf TypeScript domain modelini ve soyut bir arazi ızgarası üzerinde mesafe odaklı / arazi kısıtlı rota hesaplayan A* yol bulmayı, gerçek NASA verisi olmadan birim testlerle doğrulanmış şekilde eklemek.

**Architecture:** Tüm kod `src/features/routing/` altında, React / Leaflet / Three.js import etmeyen saf modüllerdir. Arazi, ön işlemeden gelecek projeksiyonlu bir ızgara (`TerrainGrid`: hücre boyutu metre, hücre başına eğim veya "veri yok", isteğe bağlı tehlike maskesi) olarak modellenir. `findPath` tek bir bacağı A* (8 komşu, köşe kesme yok) ile çözer; `planRoute` sıralı waypoint listesini bacaklara böler, isteğe bağlı dönüş bacağını ayrıca hesaplar; `planAlternatives` iki profili yan yana üretir.

**Tech Stack:** TypeScript 6, Vitest (yeni dev bağımlılığı), mevcut Vite 8 / ESLint 10 kurulumu.

**Spec:** [SCOPE.md](../../../SCOPE.md) — özellikle "Aşama 1" tablosundaki *Rota noktaları*, *Mesafe odaklı rota*, *Arazi kısıtlı rota*, *Alternatif rotalar*, *Gidiş dönüş* satırları ve "Rota modelinin sınırları" bölümü. Ayrıca [src/features/routing/README.md](../../../src/features/routing/README.md).

## Global Constraints

- Rota modülleri React, Leaflet veya Three.js import etmez; veri çekmez, harita durumunu okumaz (`routing/README.md`).
- "Veri yokluğu güvenli arazi olarak yorumlanmaz": eğimi `null` olan hücre geçilemezdir.
- "Mesafe odaklı rota da temel geçilebilirlik kısıtlarına uymalı": tehlike maskesi ve veri yok hücreleri her iki profilde de geçilemez.
- "Geçerli rota bulunamıyorsa neden gösterilmeli; algoritma kısıtları sessizce gevşetmemeli."
- "Hesaplanamayan alanlar boş bırakılır; sıfırla doldurulmaz": başarısız bacak varsa toplam mesafe `null`.
- "Dönüş ayrı değerlendirilir; mesafe veya süre doğrudan ikiyle çarpılmaz": dönüş bacağı ayrı A* çağrısıyla hesaplanır.
- "İki sonuç aynı olabilir; alternatif uydurulmaz": aynı yol çıkarsa `identical: true` döner, farklı yol üretilmeye çalışılmaz.
- Eğim eşiği kullanıcı girdisidir ve tipte `slopeLimitIsScenarioAssumption: true` ile işaretlenir; resmî sınır gibi sunulmaz.
- Dünya geodezisi yok: mesafe yalnızca ızgara adımı × `cellSizeMeters` (çapraz adım × √2). Izgaranın projeksiyonlu Mars CRS'inde metrik hücreli olması ön işlemenin sorumluluğudur.
- `enum` kullanılmaz (`erasableSyntaxOnly: true`); string literal union kullanılır.
- `npm run build`, `npm run lint` ve `npm test` her task sonunda geçmelidir.

## Review Focus

1. **Waypoint "veri yok" hücresinde** → rota üretilmez, `WAYPOINT_BLOCKED` / `cause: 'noData'` döner (Task 4 testi).
2. **Ardışık iki waypoint aynı hücrede** → bacak başarılı, `path` tek hücre, `distanceMeters: 0` (gerçek sıfır; Task 3 testi).
3. **Eğim dizisi uzunluğu `rows*cols` ile uyuşmuyor, hücre boyutu ≤0 / NaN** → `createTerrainGrid` `RangeError` fırlatır (Task 2 testi).
4. **Eğim eşiği NaN veya negatif** → `findPath` `RangeError` fırlatır, sessizce "sınırsız" sayılmaz (Task 3 testi).
5. **Büyük açık ızgara (300×300) köşeden köşeye** → binary heap sayesinde makul sürede biter ve doğru octile mesafeyi verir (Task 3 testi, süre assert'i yok).

---

### Task 1: Vitest kurulumu, domain tipleri ve waypoint listesi işlemleri

**Files:**
- Modify: `package.json` (devDependencies'e `vitest`, scripts'e `"test": "vitest run"`)
- Create: `src/features/routing/model/types.ts`
- Create: `src/features/routing/model/waypoints.ts`
- Test: `src/features/routing/model/waypoints.test.ts`

**Interfaces:**
- Produces (`model/types.ts`):
  ```ts
  export interface GridCell { readonly row: number; readonly col: number }
  export interface Waypoint { readonly id: string; readonly label: string; readonly cell: GridCell }
  // Liste sıralıdır: ilk eleman başlangıç, son eleman hedef, aradakiler ara duraklar.
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
    readonly complete: boolean               // en az bir bacak var ve hepsi 'ok'
    readonly totalDistanceMeters: number | null // complete değilse null
  }
  ```
- Produces (`model/waypoints.ts`), hepsi yeni dizi döner, girdiyi değiştirmez:
  - `insertWaypoint(list: readonly Waypoint[], waypoint: Waypoint, index?: number): Waypoint[]` — index verilmezse sona ekler; aynı `id` zaten varsa `Error`.
  - `removeWaypoint(list: readonly Waypoint[], id: string): Waypoint[]` — bilinmeyen id'de listeyi aynen (kopya) döner.
  - `moveWaypoint(list: readonly Waypoint[], id: string, toIndex: number): Waypoint[]` — `toIndex` `[0, length-1]` aralığına sıkıştırılır.
  - `updateWaypoint(list: readonly Waypoint[], id: string, patch: Partial<Omit<Waypoint, 'id'>>): Waypoint[]`

- [ ] **Step 1: Vitest kur ve script ekle**

Run: `npm install -D vitest` ve `package.json` scripts'e `"test": "vitest run"` ekle.
Expected: `npm test` "No test files found" ile çıkar (henüz test yok).

- [ ] **Step 2: Failing testleri yaz** (`waypoints.test.ts`, `import { describe, expect, it } from 'vitest'`)

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

- [ ] **Step 3: Testin fail ettiğini doğrula**

Run: `npm test`
Expected: FAIL — `waypoints.ts` modülü bulunamıyor.

- [ ] **Step 4: `model/types.ts` ve `model/waypoints.ts`'i Interfaces bloğundaki imzalarla yaz**

- [ ] **Step 5: Testleri ve build'i çalıştır**

Run: `npm test && npm run build && npm run lint`
Expected: 6 test PASS; build ve lint hatasız.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/routing/model
git commit -m "feat(routing): add route domain types and waypoint list operations"
```

---

### Task 2: Arazi ızgarası ve hücre sınıflandırma

**Files:**
- Create: `src/features/routing/pathfinding/terrainGrid.ts`
- Create: `src/features/routing/testing/gridFromAscii.ts` (yalnızca testlerde kullanılır)
- Test: `src/features/routing/pathfinding/terrainGrid.test.ts`

**Interfaces:**
- Consumes: `GridCell`, `BlockCause` (Task 1)
- Produces (`terrainGrid.ts`):
  ```ts
  export interface TerrainGridInput {
    rows: number; cols: number; cellSizeMeters: number
    slopeDegrees: readonly (number | null)[]   // row-major, uzunluk rows*cols, null = veri yok
    hazard?: readonly boolean[]                // row-major, true = bilinen tehlike
  }
  export interface TerrainGrid { readonly rows: number; readonly cols: number; readonly cellSizeMeters: number
    readonly slopeDegrees: readonly (number | null)[]; readonly hazard: readonly boolean[] }
  export function createTerrainGrid(input: TerrainGridInput): TerrainGrid
  export function isInBounds(grid: TerrainGrid, cell: GridCell): boolean
  export type CellClass = { passable: true } | { passable: false; cause: BlockCause }
  export function classifyCell(grid: TerrainGrid, cell: GridCell, maxSlopeDegrees: number | null): CellClass
  ```
  - `createTerrainGrid`: `rows`/`cols` pozitif tam sayı değilse, `cellSizeMeters` sonlu ve >0 değilse, `slopeDegrees` veya verilen `hazard` uzunluğu `rows*cols` değilse, ya da `null` olmayan bir eğim sonlu değil / negatifse `RangeError`. `hazard` verilmezse tümü `false`.
  - `classifyCell` öncelik sırası: `outOfCoverage` (ızgara dışı) → `noData` → `hazard` → `slope` (yalnızca `maxSlopeDegrees !== null` ve eğim `>` eşik; eşiğe eşit eğim geçilebilir).
- Produces (`testing/gridFromAscii.ts`): `gridFromAscii(rows: string[], cellSizeMeters = 1): TerrainGrid` — `.` = 0°, `0`–`9` = rakam×5°, `#` = tehlike (eğim 0), `?` = veri yok.

- [ ] **Step 1: Failing testleri yaz**

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

- [ ] **Step 2: Fail ettiğini doğrula** — Run: `npm test` → FAIL (modül yok).
- [ ] **Step 3: `terrainGrid.ts` ve `gridFromAscii.ts`'i Interfaces'e göre yaz**
- [ ] **Step 4: Doğrula** — Run: `npm test && npm run build && npm run lint` → tüm testler PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/routing/pathfinding src/features/routing/testing
git commit -m "feat(routing): add terrain grid model and cell classification"
```

---

### Task 3: A* ile tek bacak yol bulma

**Files:**
- Create: `src/features/routing/pathfinding/minHeap.ts`
- Create: `src/features/routing/pathfinding/findPath.ts`
- Test: `src/features/routing/pathfinding/findPath.test.ts`

**Interfaces:**
- Consumes: `TerrainGrid`, `classifyCell`, `isInBounds` (Task 2); `GridCell`, `BlockCause` (Task 1)
- Produces:
  ```ts
  // minHeap.ts — öncelik kuyruğu (binary heap)
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
- Algoritma kararları (testlerin belirlemediği):
  - 8 komşuluk. Düz adım maliyeti `cellSizeMeters`, çapraz adım `cellSizeMeters * Math.SQRT2`.
  - Köşe kesme yok: çapraz adım, iki ortogonal komşudan biri geçilemezse yapılamaz.
  - Sezgisel: octile mesafe × `cellSizeMeters` (kabul edilebilir, dolayısıyla sonuç optimal).
  - `blockedBy`: arama sırasında ızgara **içinde** karşılaşılan geçilemez komşu hücrelerin `cause` değerleri; tekilleştirilmiş ve `['noData','hazard','slope']` sırasında sıralı. Izgara kenarı (`outOfCoverage`) `blockedBy`'a eklenmez.
  - `maxSlopeDegrees` NaN veya negatifse `RangeError` fırlat.
  - `from` ve `to` önce `classifyCell` ile kontrol edilir; geçilemezse `ENDPOINT_BLOCKED`.

- [ ] **Step 1: Failing testleri yaz** — tek optimal yol olmayan durumlarda tam yolu değil, `expectValidPath` yardımcı fonksiyonuyla özellikleri assert et (ilk/son hücre doğru, ardışık hücreler 8-komşu, her hücre `classifyCell(...).passable`).

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
  // köşe kesme yasak olduğu için çapraz kısayol yok: aşağı 2, sağa 2, yukarı 2
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
  const g = gridFromAscii(['.6.'])                     // 30° ortada
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

Ayrıca `minHeap` için: rastgele sırayla eklenen 100 öğe artan öncelikle çıkar; boş heap'te `pop()` `undefined` döner.

- [ ] **Step 2: Fail ettiğini doğrula** — Run: `npm test` → FAIL (modül yok).
- [ ] **Step 3: `minHeap.ts` ve `findPath.ts`'i yukarıdaki kararlarla yaz**
- [ ] **Step 4: Doğrula** — Run: `npm test && npm run build && npm run lint` → tüm testler PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/routing/pathfinding
git commit -m "feat(routing): add A* grid pathfinding with explicit failure reasons"
```

---

### Task 4: Çok bacaklı rota, dönüş bacağı ve alternatif karşılaştırma

**Files:**
- Create: `src/features/routing/planRoute.ts`
- Create: `src/features/routing/index.ts` (public API: tipler, waypoint işlemleri, `createTerrainGrid`, `planRoute`, `planAlternatives`)
- Modify: `src/features/routing/README.md` (yeni modüllerin bir paragraflık açıklaması; "No route ... calculation exists yet" cümlesini güncelle)
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
- Davranış kararları:
  - Profil → kısıt: `distance` → `maxSlopeDegrees: null`; `terrain` → profilin `maxSlopeDegrees` değeri.
  - Bacaklar: ardışık her waypoint çifti için bir `outbound` bacak; `returnToStart` ise son → ilk waypoint için ayrı `findPath` çağrısıyla bir `return` bacak. 2'den az waypoint varsa `legs: []`, `complete: false`, `totalDistanceMeters: null`.
  - `PathFailure` → `RouteFailureReason` eşlemesi: `ENDPOINT_BLOCKED` → `WAYPOINT_BLOCKED` (`endpoint`'e göre bacağın `fromId` / `toId` waypoint'i); `NO_PATH` aynen.
  - Bir bacak başarısız olsa bile diğer bacaklar yine hesaplanır (kullanıcı tüm sorunları görebilsin).
  - `identical`: iki sonuç da `complete` ve her bacağın `path` dizisi hücre hücre eşitse `true`; aksi halde `false`.

- [ ] **Step 1: Failing testleri yaz**

```ts
const wp = (id: string, row: number, col: number) => ({ id, label: id, cell: { row, col } })
const open = gridFromAscii(['.....', '.....', '.....'], 10)

it('splits waypoints into ordered outbound legs and sums distance', () => {
  const r = planRoute(open, { waypoints: [wp('s', 0, 0), wp('m', 0, 2), wp('t', 0, 4)], returnToStart: false }, { kind: 'distance' })
  expect(r.legs.map(l => [l.kind, l.fromId, l.toId])).toEqual([['outbound', 's', 'm'], ['outbound', 'm', 't']])
  expect(r).toMatchObject({ complete: true, totalDistanceMeters: 40 })
})
it('computes the return leg as its own search', () => {
  // dönüşte yol farklı olmasa da bacak ayrıca listelenir ve toplama eklenir
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
  // dik hücrenin yanından çapraz geçiş köşe kesme sayılır: aşağı, sağa 2, yukarı
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

- [ ] **Step 2: Fail ettiğini doğrula** — Run: `npm test` → FAIL (modül yok).
- [ ] **Step 3: `planRoute.ts` ve `index.ts`'i yaz; `routing/README.md`'yi güncelle**
- [ ] **Step 4: Bağımsızlık kontrolü** — Run: `npx rg "from '(react|leaflet|three)" src/features/routing --glob "!components/**"` (veya Grep aracı) → eşleşme yok.
- [ ] **Step 5: Doğrula** — Run: `npm test && npm run build && npm run lint` → tüm testler PASS; build ve lint hatasız; `npm run dev` ile uygulama eskisi gibi açılıyor (UI değişmedi).
- [ ] **Step 6: Commit**

```bash
git add src/features/routing
git commit -m "feat(routing): plan multi-leg routes with return leg and alternatives"
```

---

## Bu planın kapsamı dışında (sonraki planlar)

- Süre tahmini (yürüyüş hızı, durak süreleri) — SCOPE "Yürüyüş hızı ve süre".
- `RoutePlanner` arayüzünü bu modüllere bağlamak ve waypoint'leri haritada göstermek (Mars CRS kararı ve gerçek veri gerektirir).
- Eğime göre ağırlıklı maliyet (şimdilik arazi profili yalnızca eşik uygular, maliyet mesafedir).
- Gerçek DEM'den `TerrainGrid` üreten Python ön işleme.
