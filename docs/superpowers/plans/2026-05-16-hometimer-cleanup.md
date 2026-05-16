# HomeTimerScreen Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove static notification and profile icons from the HomeTimer header, and implement the "Add" subject chip as an animated bottom sheet that creates a new subject without leaving the timer screen.

**Architecture:** Two-file change — a new `AddSubjectSheet` component that owns its own API call and store write, plus targeted edits to `HomeTimerScreen` to remove header icons and wire the sheet. The sheet follows the exact animated-Modal pattern used by `SubjectFilterSheet`.

**Tech Stack:** React Native, Expo, Zustand, Animated API, `react-native-safe-area-context`

---

## File Map

| File | Action |
|---|---|
| `studytrack-frontend/src/components/AddSubjectSheet.jsx` | **Create** — animated bottom sheet for new subject |
| `studytrack-frontend/src/screens/HomeTimerScreen.jsx` | **Modify** — remove icons; wire Add chip; render sheet |

---

### Task 1: Remove header icons from HomeTimerScreen

**Files:**
- Modify: `studytrack-frontend/src/screens/HomeTimerScreen.jsx`

- [ ] **Step 1: Remove the `headerActions` block from JSX**

In `HomeTimerScreen.jsx`, find the header section (lines 210–220). Replace the entire header `View` with the icon-free version:

```jsx
{/* ── Header ──────────────────────────────────────────── */}
<View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
  <Text style={styles.headerTitle}>StudyTrack</Text>
</View>
```

(Delete the `<View style={styles.headerActions}>` block and everything inside it — the `TouchableOpacity` with `notifications-outline` and the `View` with `person-outline`.)

- [ ] **Step 2: Remove unused styles**

In the `StyleSheet.create` block, delete these three style entries:

```js
// DELETE these:
headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.lg,
},
iconBtn: {
  padding: spacing.xs,
  borderRadius: 20,
},
avatar: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: colors.surface,
  alignItems: 'center',
  justifyContent: 'center',
},
```

- [ ] **Step 3: Verify visually**

Reload Expo Go. The HomeTimer header should show only "StudyTrack" in blue — no bell icon, no person avatar.

- [ ] **Step 4: Commit**

```bash
git add studytrack-frontend/src/screens/HomeTimerScreen.jsx
git commit -m "feat: remove static notification and profile icons from HomeTimer header"
```

---

### Task 2: Create AddSubjectSheet component

**Files:**
- Create: `studytrack-frontend/src/components/AddSubjectSheet.jsx`

- [ ] **Step 1: Create the file with full implementation**

Create `studytrack-frontend/src/components/AddSubjectSheet.jsx` with this exact content:

```jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  Animated, StyleSheet, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../constraints/theme';
import { createSubject } from '../api/subjects';
import useSubjectStore from '../store/useSubjectStore';

const OFF_SCREEN = Dimensions.get('window').height;

const SWATCH_COLORS = [
  colors.accentLight,
  colors.success,
  colors.accent2,
  colors.danger,
  colors.gold,
];

export default function AddSubjectSheet({ visible, onClose, onAdded }) {
  const translateY = useRef(new Animated.Value(OFF_SCREEN)).current;
  const insets = useSafeAreaInsets();
  const addSubject = useSubjectStore((s) => s.addSubject);
  const inputRef = useRef(null);

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(SWATCH_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start(() => inputRef.current?.focus());
    } else {
      Animated.timing(translateY, {
        toValue: OFF_SCREEN, duration: 220, useNativeDriver: true,
      }).start();
      setName('');
      setSelectedColor(SWATCH_COLORS[0]);
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const r = await createSubject({ name: trimmed, colorHex: selectedColor });
      const s = r?.data?.subject;
      const newSubject = {
        id: s.id,
        name: s.name,
        color: s.colorHex,
        totalSeconds: 0,
      };
      addSubject(newSubject);
      onAdded(newSubject);
      onClose();
    } catch (_) {
      setSaving(false);
      Alert.alert('Could not add subject', 'Make sure the backend is running and try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Subject</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Subject name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleSave}
            returnKeyType="done"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.swatches}>
          {SWATCH_COLORS.map((color) =>
            color === selectedColor ? (
              <View key={color} style={[styles.swatchRing, { borderColor: color }]}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
              </View>
            ) : (
              <TouchableOpacity
                key={color}
                style={[styles.swatch, { backgroundColor: color }]}
                onPress={() => setSelectedColor(color)}
                activeOpacity={0.8}
              />
            )
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={colors.textPrimary} />
            : <Text style={styles.saveBtnText}>Add Subject</Text>
          }
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inputWrap: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
  },
  swatches: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  swatchRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  saveBtn: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    height: 52,
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add studytrack-frontend/src/components/AddSubjectSheet.jsx
git commit -m "feat: add AddSubjectSheet component"
```

---

### Task 3: Wire AddSubjectSheet into HomeTimerScreen

**Files:**
- Modify: `studytrack-frontend/src/screens/HomeTimerScreen.jsx`

- [ ] **Step 1: Add the import**

At the top of `HomeTimerScreen.jsx`, after the `ManualLogModal` import (line 24), add:

```jsx
import AddSubjectSheet from '../components/AddSubjectSheet';
```

- [ ] **Step 2: Add store selector and state**

Inside the component body, after `const addSession = useSessionStore((s) => s.addSession);` (line 61), add:

```jsx
const addSubject = useSubjectStore((s) => s.addSubject);
```

After `const [showManualLog, setShowManualLog] = useState(false);` (line 75), add:

```jsx
const [showAddSubject, setShowAddSubject] = useState(false);
```

- [ ] **Step 3: Wire the Add chip's onPress**

Find the `addChip` TouchableOpacity (around line 247):

```jsx
// BEFORE:
<TouchableOpacity style={styles.addChip}>

// AFTER:
<TouchableOpacity style={styles.addChip} onPress={() => setShowAddSubject(true)}>
```

- [ ] **Step 4: Render the sheet**

Just before the closing `</View>` of the root container (after the `ManualLogModal` around line 363), add:

```jsx
<AddSubjectSheet
  visible={showAddSubject}
  onClose={() => setShowAddSubject(false)}
  onAdded={(s) => setSelectedId(s.id)}
/>
```

- [ ] **Step 5: Verify the full flow in Expo Go**

1. Reload the app. The subject chip row should end with the `+ Add` chip.
2. Tap `+ Add` — the sheet slides up with "New Subject" title, a text input (auto-focused), 5 color swatches, and a greyed-out "Add Subject" button.
3. Type a name — the button activates.
4. Tap a different swatch color to select it.
5. Tap "Add Subject" — loading spinner shows, sheet closes, new chip appears in the subject row and is auto-selected.
6. Tap overlay without typing — sheet dismisses with no changes.
7. Tap `×` close button — sheet dismisses.

- [ ] **Step 6: Commit**

```bash
git add studytrack-frontend/src/screens/HomeTimerScreen.jsx
git commit -m "feat: wire AddSubjectSheet to Add chip in HomeTimerScreen"
```
