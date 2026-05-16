import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  Animated, StyleSheet, Dimensions,
} from 'react-native';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.5;
const OFF_SCREEN   = SHEET_HEIGHT + 50;

export default function BottomSheetPicker({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const translateY = useRef(new Animated.Value(OFF_SCREEN)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue:        0,
        useNativeDriver: true,
        tension:         65,
        friction:        11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue:         OFF_SCREEN,
        duration:        220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelect = (value) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop — tap to close */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Options */}
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {options.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  activeOpacity={0.75}
                  onPress={() => handleSelect(opt.value)}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getStyles(colors) { return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:            SHEET_HEIGHT,
    paddingBottom:        spacing.xl,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#3A3A3A',
    alignSelf:       'center',
    marginTop:       spacing.sm,
  },
  title: {
    fontSize:    15,
    fontWeight:  '700',
    color:       colors.textPrimary,
    textAlign:   'center',
    marginTop:   spacing.lg,
    marginBottom: spacing.md,
  },
  scroll:        { flexGrow: 0 },
  scrollContent: { paddingHorizontal: spacing.lg },
  option: {
    height:         52,
    borderRadius:   radius.md,
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.accentPrimary,
  },
  optionText: {
    fontSize: 14,
    color:    colors.textPrimary,
  },
  optionTextSelected: {
    fontWeight: '700',
  },
}); }
