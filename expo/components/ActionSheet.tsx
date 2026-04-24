import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

export type ActionOption = {
  id: string;
  label: string;
  sublabel?: string;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: ActionOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function ActionSheet({
  visible,
  title,
  subtitle,
  options,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        testID="actionsheet-backdrop"
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
          <View style={styles.optionList}>
            {options.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => onSelect(opt.id)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && { opacity: 0.55 },
                ]}
                testID={`actionsheet-${opt.id}`}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    opt.destructive && styles.destructiveText,
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.sublabel && (
                  <Text style={styles.optionSub}>{opt.sublabel}</Text>
                )}
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              pressed && { opacity: 0.7 },
            ]}
            testID="actionsheet-cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(14,20,16,0.38)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 34,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.inkMuted,
    marginTop: 3,
    marginBottom: 6,
    lineHeight: 18,
  },
  optionList: { marginTop: 6 },
  option: {
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  optionLabel: {
    fontSize: 15.5,
    fontWeight: "600",
    color: Colors.ink,
    letterSpacing: -0.1,
  },
  optionSub: {
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  destructiveText: { color: Colors.urgent },
  cancel: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Colors.paper,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: Colors.inkSoft },
});
