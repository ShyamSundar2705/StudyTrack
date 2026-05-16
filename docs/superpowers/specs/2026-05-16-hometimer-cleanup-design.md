# HomeTimerScreen Cleanup & Add Subject Sheet

**Date:** 2026-05-16  
**Status:** Approved

## Summary

Three changes to `HomeTimerScreen`:

1. Remove the static notification icon from the header.
2. Remove the static profile/avatar icon from the header.
3. Implement the "Add" subject chip — opens an animated bottom sheet to create a new subject inline without leaving the timer screen.

---

## Header Cleanup (items 1 & 2)

Remove the `headerActions` `View` and everything inside it (the `TouchableOpacity` wrapping `notifications-outline` and the `avatar` `View` wrapping `person-outline`). Remove unused styles: `headerActions`, `iconBtn`, `avatar`.

The header becomes a single row with only the `StudyTrack` title text.

---

## Add Subject Sheet (item 3)

### New component: `src/components/AddSubjectSheet.jsx`

Follows the animated bottom sheet pattern established by `SubjectFilterSheet`:

- `Modal` with `transparent` + `animationType="none"`
- `Animated.Value` spring-in from off-screen on `visible=true`, timing-out on `visible=false`
- Semi-transparent overlay `TouchableOpacity` that calls `onClose`
- Handle bar, title "New Subject"

**Sheet contents:**

| Element | Detail |
|---|---|
| `TextInput` | Auto-focused on open. Placeholder "Subject name". Submits on `returnKeyType="done"`. |
| Color swatches | 5 options: `accentLight`, `success`, `accent2`, `danger`, `gold` — same as `SubjectSetupScreen`. Default selected: `accentLight`. Selected swatch shows outer ring border (same as `SubjectSetupScreen` `swatchRing` style). |
| Save button | "Add Subject" — disabled + `ActivityIndicator` while saving. Calls `createSubject({ name, colorHex })`. |

**Props:**

```
visible: bool
onClose: () => void
onAdded: (subject: { id, name, color, totalSeconds }) => void
```

**Save flow:**

1. Validate name is non-empty (trim).
2. Set `saving = true`.
3. Call `createSubject({ name: name.trim(), colorHex: selectedColor })`.
4. Map response `r.data.subject` → `{ id, name, color: colorHex, totalSeconds: 0 }`.
5. Call `addSubject(newSubject)` on `useSubjectStore`.
6. Call `onAdded(newSubject)`.
7. Call `onClose()`.
8. On error: `Alert.alert('Could not add subject', ...)` and reset `saving`.

---

## HomeTimerScreen wiring

- Add `showAddSubject` state (default `false`).
- Add `addSubject` from `useSubjectStore`.
- Wire `addChip` `onPress` → `setShowAddSubject(true)`.
- Render `<AddSubjectSheet>` at bottom of the component (alongside existing `ManualLogModal`):
  ```jsx
  <AddSubjectSheet
    visible={showAddSubject}
    onClose={() => setShowAddSubject(false)}
    onAdded={(s) => setSelectedId(s.id)}
  />
  ```
  (`addSubject` is called inside the sheet itself, so only `setSelectedId` is needed in the callback.)

---

## Files Changed

| File | Change |
|---|---|
| `src/screens/HomeTimerScreen.jsx` | Remove header icons; wire Add chip; render AddSubjectSheet |
| `src/components/AddSubjectSheet.jsx` | New file |
