import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { typography } from "../theme";
import type { CatalogueStatus } from "../types";

type Props = {
  status: Exclude<CatalogueStatus, "ready">;
  /** One line under the error title, e.g. what the device still remembers. */
  detail?: string;
  onReload: () => void;
};

/** What a list says in place of its items while the index loads or is unreachable. */
export function IndexStatus({ status, detail, onReload }: Props) {
  if (status === "loading") {
    return <Text style={styles.title}>Loading the index…</Text>;
  }
  return (
    <View>
      <Text accessibilityRole="alert" style={styles.title}>Couldn't reach the index.</Text>
      {detail ? <Text style={styles.body}>{detail}</Text> : null}
      <View style={styles.retry}>
        <Button label="Try again" onPress={onReload} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.titleL, textAlign: "center" },
  body: { ...typography.body, marginTop: 7, textAlign: "center" },
  retry: { marginTop: 18 },
});
