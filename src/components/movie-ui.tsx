import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

const COLORS = {
  background: "#101116",
  surface: "#1B1D26",
  text: "#F4F4F6",
  muted: "#9295A3",
  accent: "#8B7CFF",
  border: "#292C38",
};

type PageProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};
// MoviePage：页面外层容器，统一背景和滚动。
export function MoviePage({ title, subtitle, children }: PageProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type SectionProps = {
  title: string;
  children?: ReactNode;
};
// MovieSection：页面中的内容分区。
export function MovieSection({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

type InfoCardProps = {
  title: string;
  description: string;
};
// InfoCard：统一风格的信息卡片。
export function InfoCard({ title, description }: InfoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});
