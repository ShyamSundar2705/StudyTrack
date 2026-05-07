import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
  Animated, StyleSheet, Alert, Keyboard, Dimensions,
} from 'react-native';
import { colors, radius, spacing } from '../constraints/theme';

const OFF_SCREEN = Dimensions.get('window').height;

const QUICK_TAGS = [
  '#focused', '#struggling', '#review-needed',
  '#great-session', '#distracted', '#breakthrough',
];

export default function NoteBottomSheet({ visible, initialNote, onSave, onClose }) {
  const [noteText, setNoteText]         = useState(initialNote ?? '');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const translateY = useRef(new Animated.Value(OFF_SCREEN)).current;

  // Re-sync when sheet opens with a different initialNote
  useEffect(() => {
    setNoteText(initialNote ?? '');
  }, [visible, initialNote]);

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: OFF_SCREEN, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Keyboard height tracking
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const isSaveDisabled = noteText.trim() === (initialNote ?? '').trim();

  const handleSave = () => {
    onSave(noteText.trim());
    onClose();
  };

  const handleOverlayPress = () => {
    if (noteText.trim() !== (initialNote ?? '').trim()) {
      Alert.alert(
        'Discard note?',
        'Your changes will not be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  const handleTagPress = (tag) => {
    setNoteText((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleOverlayPress}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleOverlayPress}
        />

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>

          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header row */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Session Note</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaveDisabled}>
              <Text style={[styles.saveBtn, isSaveDisabled && styles.saveBtnDisabled]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* Text input */}
          <TextInput
            style={styles.input}
            value={noteText}
            onChangeText={setNoteText}
            placeholder={"What are you working on? Any thoughts or goals for this session..."}
            placeholderTextColor={colors.textSecondary}
            multiline
            autoFocus
            maxLength={500}
            textAlignVertical="top"
          />

          {/* Character count + Clear row */}
          <View style={styles.countRow}>
            {noteText.length > 0 ? (
              <TouchableOpacity onPress={() => setNoteText('')}>
                <Text style={styles.clearBtn}>Clear</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <Text style={[styles.charCount, noteText.length > 450 && styles.charCountWarn]}>
              {noteText.length} / 500
            </Text>
          </View>

          {/* Quick tags */}
          <Text style={styles.tagsLabel}>QUICK ADD</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScroll}
          >
            {QUICK_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => handleTagPress(tag)}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Keyboard spacer */}
          <View style={{ height: keyboardHeight + spacing.xxl }} />

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#3A3A3A',
    alignSelf:       'center',
    marginTop:       spacing.md,
  },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: spacing.xxl,
    marginTop:       spacing.lg,
  },
  headerTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.textPrimary,
  },
  saveBtn: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentPrimary,
  },
  saveBtnDisabled: {
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surfaceDeep,
    borderRadius:    radius.md,
    padding:         14,
    paddingHorizontal: spacing.lg,
    color:           colors.textPrimary,
    fontSize:        15,
    lineHeight:      22,
    minHeight:       120,
    marginHorizontal: spacing.xxl,
    marginTop:       spacing.md,
  },
  countRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: spacing.xxl,
    marginTop:      spacing.sm,
  },
  clearBtn: {
    fontSize: 13,
    color:    colors.danger,
  },
  charCount: {
    fontSize: 12,
    color:    colors.textSecondary,
  },
  charCountWarn: {
    color: colors.danger,
  },
  tagsLabel: {
    fontSize:    11,
    color:       colors.textSecondary,
    letterSpacing: 1,
    marginLeft:  spacing.xxl,
    marginTop:   spacing.md,
    marginBottom: spacing.xs,
  },
  tagsScroll: {
    paddingHorizontal: spacing.xxl,
    gap:               spacing.sm,
    paddingBottom:     spacing.sm,
  },
  tagChip: {
    backgroundColor: colors.border,
    height:          28,
    borderRadius:    999,
    paddingHorizontal: spacing.md,
    justifyContent:  'center',
  },
  tagText: {
    fontSize: 12,
    color:    colors.textSecondary,
  },
});
