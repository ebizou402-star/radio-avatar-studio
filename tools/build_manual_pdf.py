from pathlib import Path

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import registerFont, registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "EBIZO_TALK_Manual_JA.pdf"
HOST_URL = "https://ebizou402-star.github.io/radio-avatar-studio/"
GUEST_URL = f"{HOST_URL}?guest=1"

CORAL = colors.HexColor("#EE6148")
TEAL = colors.HexColor("#55A6A1")
INK = colors.HexColor("#111A1D")
MUTED = colors.HexColor("#58676B")
PAPER = colors.HexColor("#F7F1E9")
PALE = colors.HexColor("#EEF3F1")
LINE = colors.HexColor("#CBD5D2")
WHITE = colors.white

registerFont(TTFont("JPFont", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))
registerFontFamily(
    "JPFont",
    normal="JPFont",
    bold="JPFont",
    italic="JPFont",
    boldItalic="JPFont",
)

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="JPBody",
        parent=styles["BodyText"],
        fontName="JPFont",
        fontSize=9.6,
        leading=15,
        textColor=INK,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="JPSmall",
        parent=styles["JPBody"],
        fontSize=8.2,
        leading=12,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="JPSection",
        parent=styles["Heading2"],
        fontName="JPFont",
        fontSize=18,
        leading=24,
        textColor=INK,
        spaceBefore=2,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        name="JPSubhead",
        parent=styles["Heading3"],
        fontName="JPFont",
        fontSize=12,
        leading=17,
        textColor=TEAL,
        spaceBefore=8,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="JPCoverTitle",
        parent=styles["Title"],
        fontName="JPFont",
        fontSize=30,
        leading=36,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="JPCoverSub",
        parent=styles["JPBody"],
        fontSize=15,
        leading=22,
        textColor=CORAL,
    )
)
styles.add(
    ParagraphStyle(
        name="JPURL",
        parent=styles["JPSmall"],
        fontName="Helvetica",
        fontSize=6.8,
        leading=9,
        textColor=colors.HexColor("#246B67"),
        alignment=TA_CENTER,
        wordWrap="CJK",
    )
)
styles.add(
    ParagraphStyle(
        name="JPTable",
        parent=styles["JPBody"],
        fontSize=8.7,
        leading=13,
    )
)
styles.add(
    ParagraphStyle(
        name="JPTableHeader",
        parent=styles["JPTable"],
        textColor=WHITE,
    )
)


def qr_code(url: str, size: float = 28 * mm) -> Drawing:
    widget = QrCodeWidget(url)
    x1, y1, x2, y2 = widget.getBounds()
    width = x2 - x1
    height = y2 - y1
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


def section_title(number: str, title: str):
    return Table(
        [[Paragraph(f'<font color="#FFFFFF"><b>{number}</b></font>', styles["JPBody"]), Paragraph(title, styles["JPSection"])]],
        colWidths=[13 * mm, 158 * mm],
        style=TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), CORAL),
                ("TEXTCOLOR", (0, 0), (0, 0), WHITE),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
                ("TOPPADDING", (0, 0), (0, 0), 4),
                ("BOTTOMPADDING", (0, 0), (0, 0), 4),
                ("LEFTPADDING", (1, 0), (1, 0), 8),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ]
        ),
    )


def step(number: int, title: str, detail: str):
    body = Paragraph(f"<b>{title}</b><br/>{detail}", styles["JPBody"])
    marker = Paragraph(f'<font color="#FFFFFF"><b>{number}</b></font>', styles["JPBody"])
    table = Table([[marker, body]], colWidths=[11 * mm, 157 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), TEAL),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
                ("TOPPADDING", (0, 0), (0, 0), 6),
                ("BOTTOMPADDING", (0, 0), (0, 0), 6),
                ("LEFTPADDING", (1, 0), (1, 0), 9),
                ("RIGHTPADDING", (1, 0), (1, 0), 6),
                ("TOPPADDING", (1, 0), (1, 0), 6),
                ("BOTTOMPADDING", (1, 0), (1, 0), 6),
                ("LINEBELOW", (1, 0), (1, 0), 0.4, LINE),
            ]
        )
    )
    return table


def info_box(title: str, lines: list[str], accent=TEAL):
    rows = [[Paragraph(title, styles["JPSubhead"])]]
    for line in lines:
        rows.append([Paragraph(f"• {line}", styles["JPBody"])])
    table = Table(rows, colWidths=[168 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.8, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def footer(canvas, document):
    canvas.saveState()
    width, _ = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(20 * mm, 9 * mm, "EBIZO TALK Avatar Studio")
    canvas.drawRightString(width - 20 * mm, 9 * mm, f"{document.page}")
    canvas.restoreState()


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=17 * mm,
        bottomMargin=20 * mm,
        title="EBIZO TALK 遠隔収録 取扱説明書",
        author="EBIZO TALK",
        subject="ホスト版・ゲスト版の遠隔収録手順",
    )

    story = []
    cover_image = Image(str(ROOT / "assets" / "radio-background-hybrid.png"), 59 * mm, 59 * mm)
    cover_text = [
        Paragraph("EBIZO TALK", styles["JPCoverTitle"]),
        Paragraph("遠隔収録 取扱説明書", styles["JPCoverSub"]),
        Paragraph("ホスト版・ゲスト版", styles["JPBody"]),
        Spacer(1, 7 * mm),
        Paragraph("アメリカと日本から、二人の音声とアバターを同時に収録するための手順です。", styles["JPBody"]),
        Spacer(1, 3 * mm),
        Paragraph("2026年6月版", styles["JPSmall"]),
    ]
    cover = Table([[cover_text, cover_image]], colWidths=[105 * mm, 63 * mm])
    cover.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    story.extend([cover, Spacer(1, 10 * mm)])
    story.append(
        info_box(
            "最初に確認",
            [
                "SafariまたはChromeでHTTPS版を開きます。アプリ内ブラウザやfile://画面では録音しません。",
                "二人ともイヤホンまたはヘッドホンを使用します。",
                "外部課金、音声の自動アップロード、クラウド保存はありません。",
            ],
        )
    )
    story.append(Spacer(1, 7 * mm))

    host_qr = [qr_code(HOST_URL), Paragraph("ホスト", styles["JPSubhead"]), Paragraph(f'<link href="{HOST_URL}">{HOST_URL}</link>', styles["JPURL"])]
    guest_qr = [qr_code(GUEST_URL), Paragraph("ゲスト", styles["JPSubhead"]), Paragraph(f'<link href="{GUEST_URL}">{GUEST_URL}</link>', styles["JPURL"])]
    qr_table = Table([[host_qr, guest_qr]], colWidths=[84 * mm, 84 * mm])
    qr_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(qr_table)

    story.append(PageBreak())
    story.append(section_title("1", "ホスト版の使い方"))
    story.append(Paragraph(f'<link href="{HOST_URL}">{HOST_URL}</link>', styles["JPURL"]))
    story.append(Spacer(1, 4 * mm))
    host_steps = [
        ("通常ブラウザで開く", "MacのSafariまたはChromeでホストURLを開きます。"),
        ("マイクを有効にする", "「マイク」を押し、確認画面で「許可」を選びます。表示が「MIC」になれば成功です。"),
        ("招待コードを作る", "遠隔欄の「招待」を押し、「送るコード」に表示されたコードをゲストへ送ります。"),
        ("回答コードを受け取る", "ゲストから返ってきた回答コードを「相手コード」へ貼り付けます。"),
        ("接続する", "「適用」を押します。遠隔表示が「接続中」になれば二人の音声接続は完了です。"),
        ("動きを確認する", "短く交互に話します。ホストの声で左、ゲストの声で右の人物が動くことを確認します。"),
        ("録音する", "「録音開始」を押します。終了時に「録音停止」を押し、「録音ファイル」を再生・保存します。"),
        ("終了する", "録音ファイルを確認したら「切断」を押します。招待・回答コードは自動で消去されます。"),
    ]
    for index, (title, detail) in enumerate(host_steps, 1):
        story.extend([step(index, title, detail), Spacer(1, 2.5 * mm)])
    story.append(
        info_box(
            "ホストの確認ポイント",
            [
                "録音とファイル保存はホストが担当します。",
                "左チャンネルがホスト、右チャンネルがゲストです。",
                "二人が同時に話すと、二人のアバターが同時に動きます。",
            ],
            accent=CORAL,
        )
    )

    story.append(PageBreak())
    story.append(section_title("2", "ゲスト版の使い方"))
    story.append(Paragraph(f'<link href="{GUEST_URL}">{GUEST_URL}</link>', styles["JPURL"]))
    story.append(Spacer(1, 4 * mm))
    guest_steps = [
        ("携帯で開く", "iPhoneはSafari、AndroidはChromeでゲストURLを開きます。"),
        ("招待コードを貼る", "ホストから届いた招待コードを「相手コード」へ、最初から最後まで貼り付けます。"),
        ("回答を作る", "「回答」を押します。マイク確認が出たら「許可」を選びます。"),
        ("回答コードを返す", "「送るコード」に表示された回答コードをコピーし、ホストへ送ります。"),
        ("接続を待つ", "ホストが回答コードを適用すると、遠隔表示が「接続中」に変わります。"),
        ("音声を確認する", "普段の声で話し、ホスト側で右の人物が動くことを確認します。"),
        ("収録中", "イヤホンを使用し、画面を閉じずに会話します。録音開始・停止はホストが操作します。"),
        ("終了する", "ホストの「切断」を確認して画面を閉じます。送ったコードもチャットから削除します。"),
    ]
    for index, (title, detail) in enumerate(guest_steps, 1):
        story.extend([step(index, title, detail), Spacer(1, 2.5 * mm)])
    story.append(
        info_box(
            "携帯ゲストの注意",
            [
                "通話中に別アプリへ切り替えると、ブラウザがマイクを停止する場合があります。",
                "画面ロックをせず、通信が安定した場所で使用してください。",
                "音の回り込みを防ぐため、スピーカーではなくイヤホンを使ってください。",
            ],
            accent=CORAL,
        )
    )

    story.append(PageBreak())
    story.append(section_title("3", "表示・トラブル対応・安全確認"))
    story.append(Paragraph("表示の意味", styles["JPSubhead"]))
    status_rows = [
        ["表示", "意味と対応"],
        ["MIC", "マイク接続成功。録音テストへ進めます。"],
        ["接続中", "ホストとゲストの遠隔音声接続が成功しています。"],
        ["マイク許可", "ブラウザまたは端末設定でマイクを許可し、もう一度押します。"],
        ["ブラウザ制限", "URLをSafariまたはChromeで開き直します。"],
        ["接続待ち", "ホスト側でゲストの回答コードを適用します。"],
        ["マイク使用中", "ほかの通話・録音アプリを閉じて再試行します。"],
        ["失敗", "二人とも切断し、新しい招待コードで最初からやり直します。"],
    ]
    status_table = Table(
        [
            [
                Paragraph(cell, styles["JPTableHeader"] if row_index == 0 else styles["JPTable"])
                for cell in row
            ]
            for row_index, row in enumerate(status_rows)
        ],
        colWidths=[34 * mm, 134 * mm],
        repeatRows=1,
    )
    status_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), INK),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("BACKGROUND", (0, 1), (0, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(status_table)
    story.append(Spacer(1, 6 * mm))
    story.append(
        info_box(
            "テスト収録チェック",
            [
                "二人の遠隔表示が「接続中」になっている。",
                "ホストの声で左、ゲストの声で右の人物・口・体が動く。",
                "10秒録音し、「録音ファイル」を再生すると二人の声が聞こえる。",
                "録音停止後、招待・回答コード欄が空になる。",
            ],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(
        info_box(
            "安全に使うために",
            [
                "招待・回答コードは接続相手だけに送ります。SNSへ公開しません。",
                "録音完了または切断後、チャットへ送ったコードも削除します。",
                "一時トンネルURLは使わず、github.ioのHTTPS URLだけを使います。",
                "このアプリは音声を外部サーバーへ保存せず、課金APIも使用しません。",
            ],
            accent=CORAL,
        )
    )

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
