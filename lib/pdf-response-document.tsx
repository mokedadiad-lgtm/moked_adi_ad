import { PdfAnswerBodyFromHtml } from "@/lib/pdf-body-html-react-pdf";
import { parseSignatureHtmlSegments } from "@/lib/response-text";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 56,
    paddingLeft: 44,
    paddingRight: 44,
    direction: "rtl",
    fontFamily: "Heebo",
    backgroundColor: "#FAF7F9",
  },
  headerBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 4,
    paddingBottom: 6,
    paddingHorizontal: 44,
    backgroundColor: "#FAF7F9",
    minHeight: 96,
  },
  /** שורה אחת: תאריך (שמאל) | לוגו (מרכז) | ב"ה (ימין) — מיקום מוחלט כדי שלא יתהפך ב-RTL */
  headerRow: {
    width: "100%",
    height: 86,
    position: "relative",
  },
  headerDateAbs: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "24%",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerLogosAbs: {
    position: "absolute",
    left: "24%",
    width: "52%",
    top: 0,
    bottom: 0,
    flexDirection: "row",
    direction: "ltr",
    justifyContent: "center",
    alignItems: "center",
  },
  headerLogoSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBhAbs: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "24%",
    justifyContent: "center",
    alignItems: "flex-end",
  },
  logo: {
    width: 56,
    height: 82,
    objectFit: "contain",
  },
  bH: {
    fontSize: 9,
    color: "#2C2C54",
    fontFamily: "Heebo",
    fontWeight: 700,
    textAlign: "right",
  },
  dateText: {
    fontSize: 9,
    color: "#75759E",
    fontFamily: "Heebo",
  },
  content: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8E0E5",
    direction: "rtl",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 16,
    textAlign: "right",
    direction: "rtl",
    color: "#2C2C54",
  },
  bodyLine: {
    fontSize: 11,
    lineHeight: 1.7,
    textAlign: "right",
    direction: "rtl",
    marginBottom: 2,
    color: "#2C2C54",
  },
  bodySingle: {
    fontSize: 11,
    lineHeight: 1.7,
    textAlign: "right",
    direction: "rtl",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    color: "#75759E",
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
    color: "#5C5C78",
  },
  signatureBlock: {
    marginTop: 16,
    paddingHorizontal: 28,
    width: "100%",
    alignItems: "flex-start",
  },
  signatureText: {
    fontSize: 11,
    lineHeight: 1.6,
    textAlign: "left",
    direction: "ltr",
    color: "#2C2C54",
    width: "100%",
    whiteSpace: "pre-wrap" as const,
  },
  signatureBold: {
    fontWeight: 700,
    fontFamily: "Heebo",
  },
  footerFixed: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 6,
    paddingBottom: 12,
    paddingHorizontal: 44,
    backgroundColor: "#FAF7F9",
    alignItems: "center",
  },
  footerTopRule: {
    width: "75%",
    height: 2,
    backgroundColor: "#E8B4C8",
    marginBottom: 6,
  },
  footerBody: {
    fontSize: 8,
    lineHeight: 1.55,
    textAlign: "center",
    color: "#5C5C78",
  },
  footerLine1: {
    fontWeight: 700,
    color: "#2C2C54",
  },
  footerLine2: {
    color: "#AD1457",
  },
});

const RTL_MARK = "\u200F";

export interface ResponsePdfProps {
  questionContent: string;
  bodyPlain: string;
  /** כשמועבר — react-pdf מציג מודגש/כותרות/עילית במקום טקסט שטוח */
  bodyHtmlForPdf?: string | null;
  footnotes: string[];
  createdAt?: string;
  leftLogoDataUri?: string;
  centerLogoDataUri?: string;
  rightLogoDataUri?: string;
  linguisticSignature?: string | null;
}

function formatHebrewCreatedDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * מסמך PDF: שאלה + תשובה (גוף + הפניות נפרדים), RTL, תבנית מעוצבת.
 */
export function ResponsePdfDocument({
  questionContent,
  bodyPlain,
  bodyHtmlForPdf,
  footnotes,
  createdAt,
  leftLogoDataUri,
  centerLogoDataUri,
  rightLogoDataUri,
  linguisticSignature,
}: ResponsePdfProps) {
  const useStructuredBody = Boolean(bodyHtmlForPdf && String(bodyHtmlForPdf).trim());
  const bodyLines = bodyPlain ? bodyPlain.split("\n") : [];
  const hasBodyLines = bodyLines.length > 0;

  const sigSegments = parseSignatureHtmlSegments(linguisticSignature ?? "");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand} wrap={false}>
          <View style={styles.headerRow}>
            <View style={styles.headerDateAbs}>
              {createdAt ? (
                <Text style={styles.dateText}>
                  נוצר ב: {formatHebrewCreatedDate(createdAt)}
                </Text>
              ) : (
                <Text style={styles.dateText}> </Text>
              )}
            </View>
            <View style={styles.headerLogosAbs}>
              <View style={styles.headerLogoSlot}>
                {rightLogoDataUri ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not DOM img */
                  <Image src={rightLogoDataUri} style={styles.logo} />
                ) : null}
              </View>
              <View style={styles.headerLogoSlot}>
                {centerLogoDataUri ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not DOM img */
                  <Image src={centerLogoDataUri} style={styles.logo} />
                ) : null}
              </View>
              <View style={styles.headerLogoSlot}>
                {leftLogoDataUri ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not DOM img */
                  <Image src={leftLogoDataUri} style={styles.logo} />
                ) : null}
              </View>
            </View>
            <View style={styles.headerBhAbs}>
              <Text style={styles.bH}>ב&quot;ה</Text>
            </View>
          </View>
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
            {useStructuredBody ? (
              <PdfAnswerBodyFromHtml html={bodyHtmlForPdf!} fallbackPlain={bodyPlain} />
            ) : hasBodyLines ? (
              bodyLines.map((line, i) => (
                <Text key={i} style={styles.bodyLine}>
                  {RTL_MARK}
                  {line.trimEnd() || "\u00A0"}
                </Text>
              ))
            ) : (
              <Text style={styles.bodyLine}>
                {RTL_MARK}
                {bodyPlain || "—"}
              </Text>
            )}
          </View>

          {sigSegments.length > 0 && (
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureText}>
                {sigSegments.map((seg, i) => (
                  <Text key={i} style={seg.bold ? styles.signatureBold : undefined}>
                    {seg.text}
                  </Text>
                ))}
              </Text>
            </View>
          )}

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

        <View style={styles.footerFixed} fixed>
          <View style={styles.footerTopRule} />
          <Text style={styles.footerBody}>
            <Text style={styles.footerLine1}>
              אסק מי פלוס – מענה אנונימי מטעם ארגון &quot;עדי עד&quot;
            </Text>
            {"\n"}
            <Text style={styles.footerLine2}>אתר עדי עד: www.adeyad.org</Text>
            {"\n"}
            המידע בתשובה זו הינו כללי ואינו מהווה תחליף לייעוץ מקצועי אישי.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
