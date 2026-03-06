import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 52,
    paddingLeft: 44,
    paddingRight: 44,
    direction: "rtl",
    fontFamily: "Heebo",
    backgroundColor: "#F9FAFB",
  },
  bH: {
    fontSize: 9,
    color: "#4338CA",
    fontFamily: "Heebo",
    direction: "rtl",
    textAlign: "right",
    marginBottom: 4,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    paddingHorizontal: 44,
    paddingTop: 8,
    backgroundColor: "#EEF2FF",
    borderBottomWidth: 2,
    borderBottomColor: "#4F46E5",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "right",
    direction: "rtl",
    color: "#312E81",
  },
  content: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    direction: "rtl",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 16,
    textAlign: "right",
    direction: "rtl",
    color: "#374151",
  },
  bodyLine: {
    fontSize: 11,
    lineHeight: 1.7,
    textAlign: "right",
    direction: "rtl",
    marginBottom: 2,
    color: "#1F2937",
  },
  bodySingle: {
    fontSize: 11,
    lineHeight: 1.7,
    textAlign: "right",
    direction: "rtl",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    color: "#1F2937",
  },
  footnoteSeparatorWrap: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    marginBottom: 12,
  },
  footnoteSeparator: {
    width: 142,
    borderBottomWidth: 1,
    borderBottomColor: "#94A3B8",
  },
  footnoteLine: {
    fontSize: 11,
    lineHeight: 1.6,
    textAlign: "right",
    direction: "rtl",
    marginBottom: 6,
    paddingRight: 8,
    color: "#374151",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    paddingHorizontal: 44,
    paddingTop: 12,
    backgroundColor: "#EEF2FF",
    borderTopWidth: 1,
    borderTopColor: "#C7D2FE",
    fontSize: 9,
    color: "#4B5563",
    textAlign: "center",
  },
});

const RTL_MARK = "\u200F";

export interface ResponsePdfProps {
  questionContent: string;
  bodyPlain: string;
  footnotes: string[];
  createdAt?: string;
}

/**
 * מסמך PDF: שאלה + תשובה (גוף + הפניות נפרדים), RTL, תבנית מעוצבת.
 */
export function ResponsePdfDocument({
  questionContent,
  bodyPlain,
  footnotes,
  createdAt,
}: ResponsePdfProps) {
  const bodyLines = bodyPlain ? bodyPlain.split("\n") : [];
  const hasBodyLines = bodyLines.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.bH}>ב&quot;ה</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>שאלה</Text>
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.bodySingle}>
              {RTL_MARK}
              {questionContent || "—"}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>תשובה</Text>
          <View>
            {hasBodyLines ? (
              bodyLines.map((line, i) => (
                <Text key={i} style={styles.bodyLine}>
                  {RTL_MARK}
                  {line.trimEnd() || "\u00A0"}
                </Text>
              ))
            ) : (
              <Text style={styles.bodySingle}>
                {RTL_MARK}
                {bodyPlain || "—"}
              </Text>
            )}
          </View>

          {footnotes.length > 0 && (
            <>
              <View style={styles.footnoteSeparatorWrap}>
                <View style={styles.footnoteSeparator} />
              </View>
              {footnotes.map((line, i) => (
                <Text key={i} style={styles.footnoteLine}>
                  {RTL_MARK}
                  {line}
                </Text>
              ))}
            </>
          )}
        </View>

        {createdAt && (
          <Text style={styles.footer} fixed>
            נוצר בתאריך:{" "}
            {new Date(createdAt).toLocaleDateString("he-IL", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </Text>
        )}
      </Page>
    </Document>
  );
}
