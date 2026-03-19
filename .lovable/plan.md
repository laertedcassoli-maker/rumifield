

## Evaluation of the Bug Analysis

After reviewing the actual code, here is my assessment of each bug:

### Bug #1 — CRÍTICO: CONFIRMED ✓
`addManualPartMutation` (line 280-311 in ConsumedPartsBlock.tsx) only calls `offlineChecklistDb.addPartConsumptionLocally()` — no Supabase insert when online. Then `invalidateQueries` fetches from Supabase where the record doesn't exist yet. The part flashes and disappears. Note: `deleteManualPartMutation` (line 314) correctly calls Supabase when online, confirming the add mutation is inconsistent.

### Bug #2 — ALTO: CONFIRMED ✓
Line 300 in ChecklistExecution.tsx: `const isOnline = navigator.onLine;` is a static snapshot captured once per render. Not reactive. ConsumedPartsBlock.tsx already uses `useState` + event listeners correctly (lines 63-76), so this is an inconsistency.

### Bug #3 — ALTO: CONFIRMED ✓
The main checklist query (line 90-129), templateActions (line 153), and templateNonconformities all lack `staleTime` and `refetchOnWindowFocus` settings. Default `staleTime: 0` means any window focus triggers a refetch that can overwrite optimistic `setQueryData` updates.

### Bug #4 — MÉDIO: PARTIALLY VALID ⚠️
The `useState<Set>` pattern (lines 86-87) works correctly in practice because `setProcessingActions` in the `finally` block creates a new Set. The risk is theoretical — React batches state updates, so the `finally` will execute. However, migrating to `useRef` is a valid defensive improvement that also eliminates unnecessary re-renders.

**Caveat**: Since `processingActions.has()` and `processingNonconformities.has()` are used in the JSX (lines 1188, 1223) to show loading state on `SelectableOptionCard`, switching to `useRef` will **break the visual processing indicator** because ref changes don't trigger re-renders. The fix needs a `forceUpdate` mechanism or should keep the state for UI but use ref for the lock logic.

### Bug #5 — MÉDIO: VALID ✓
Supabase returns `error: null` when RLS silently blocks an update (0 rows affected). The `.select('id')` approach to validate affected rows is correct.

---

## Implementation Plan

### 1. Fix Bug #1 — ConsumedPartsBlock.tsx addManualPartMutation
When online, insert directly into Supabase first, then update Dexie. When offline, keep current Dexie-only behavior. This matches the pattern already used by `deleteManualPartMutation`.

### 2. Fix Bug #2 — ChecklistExecution.tsx reactive isOnline
Replace the static `const isOnline = navigator.onLine` with a `useState` + `useEffect` pattern (identical to what ConsumedPartsBlock already uses).

### 3. Fix Bug #3 — Add staleTime to queries
- Main checklist query: `staleTime: 30_000, refetchOnWindowFocus: false`
- Template actions query: `staleTime: 300_000, refetchOnWindowFocus: false`
- Template nonconformities query: `staleTime: 300_000, refetchOnWindowFocus: false`

### 4. Fix Bug #4 — Hybrid lock approach
Use `useRef` for the actual lock logic (synchronous, no re-render dependency) but keep a `useState` counter to trigger re-renders for the UI processing indicators. This avoids the stuck-lock risk while keeping visual feedback.

### 5. Fix Bug #5 — Validate affected rows
Add `.select('id')` to update/insert mutations and check that data was actually returned. Show a toast on silent RLS failure.

### Files Modified
- `src/components/preventivas/ConsumedPartsBlock.tsx` — Bug #1
- `src/components/preventivas/ChecklistExecution.tsx` — Bugs #2, #3, #4, #5

