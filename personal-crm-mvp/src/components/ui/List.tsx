import { ReactElement } from "react";
import { FlatList, FlatListProps, ListRenderItem, StyleSheet, View } from "react-native";

import { layout } from "../../theme/tokens";

type AppListProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: ListRenderItem<T>;
  ListEmptyComponent?: ReactElement;
} & Omit<
  FlatListProps<T>,
  "data" | "keyExtractor" | "renderItem" | "ListEmptyComponent"
>;

export function AppList<T>({
  data,
  keyExtractor,
  renderItem,
  ListEmptyComponent,
  contentContainerStyle,
  ...props
}: AppListProps<T>) {
  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  separator: {
    height: layout.stackGap,
  },
});
