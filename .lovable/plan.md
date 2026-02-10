

## Fix: Text Disappearing in Observations Block

### Problem
When typing in the internal/public observations fields, text intermittently disappears or gets partially deleted.

### Root Cause
A race condition between three mechanisms:

1. User types → state updates locally → debounced save triggers after 800ms
2. Save succeeds → `queryClient.invalidateQueries` refetches data from server
3. `useEffect` watches `initialInternalNotes`/`initialPublicNotes` and resets local state from server response

The server response can arrive while the user is still typing, overwriting their current input with a stale value.

### Solution
Remove the `useEffect` that syncs external props into local state. Since this component already manages its own local state and saves via debounce, the external sync is unnecessary and harmful. The component should treat `initialInternalNotes`/`initialPublicNotes` as initial values only (already handled by `useState` initializer).

Additionally, stop invalidating queries on save success -- the local state is already correct, so a refetch only causes conflicts.

### Technical Details

**File:** `src/components/preventivas/ObservationsBlock.tsx`

1. **Remove the `useEffect`** (lines ~48-53) that resets `internalLines`/`publicLines` from props -- this is the direct cause of the overwrite.

2. **Remove `queryClient.invalidateQueries`** from `onSuccess` -- the local state already reflects the saved value, so refetching is unnecessary and triggers the race condition in parent components.

3. Keep the `setSaveStatus` feedback logic intact.

These are minimal, targeted changes that preserve all existing functionality while eliminating the race condition.

