#!/usr/bin/env python3
"""Generate and verify the internal CityBeat sales playbook PDF.

The script writes a canonical copy to output/pdf and an identical web-download
copy to apps/web/public/downloads. It requires reportlab; --verify also requires
pypdf. The Codex bundled document runtime provides both dependencies.
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
CANONICAL_PDF = ROOT / "output" / "pdf" / "citybeat-sales-guide.pdf"
PUBLIC_PDF = ROOT / "apps" / "web" / "public" / "downloads" / "citybeat-sales-guide.pdf"

AS_OF = "July 21, 2026"
NEW_SALE_URL = "https://citybeatmag.co/en/admin/sales/new"
PIPELINE_URL = "https://citybeatmag.co/en/admin/sales/me"
PAYOUTS_URL = "https://citybeatmag.co/en/account/payments"

DARK = HexColor("#0B0D10")
CHARCOAL = HexColor("#1A1A1A")
INK = HexColor("#17212B")
MUTED = HexColor("#5E6B76")
CYAN = HexColor("#06B6D4")
MAGENTA = HexColor("#D946EF")
GOLD = HexColor("#EAB308")
PALE_CYAN = HexColor("#E7F9FC")
PALE_MAGENTA = HexColor("#FBEAFD")
PALE_GOLD = HexColor("#FFF8D9")
PALE_GRAY = HexColor("#F3F5F7")
LINE = HexColor("#D8DEE4")
WHITE = colors.white


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "CoverKicker",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=CYAN,
            tracking=2,
            spaceAfter=12,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=39,
            leading=40,
            textColor=WHITE,
            alignment=TA_LEFT,
            spaceAfter=18,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=16,
            leading=22,
            textColor=HexColor("#D9E0E5"),
            spaceAfter=22,
        ),
        "cover_body": ParagraphStyle(
            "CoverBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=HexColor("#CBD5DC"),
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=27,
            textColor=INK,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=INK,
            spaceBefore=9,
            spaceAfter=5,
        ),
        "kicker": ParagraphStyle(
            "Kicker",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=MAGENTA,
            tracking=1.4,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=12.4,
            textColor=INK,
            spaceAfter=5,
        ),
        "body_tight": ParagraphStyle(
            "BodyTight",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=10.7,
            textColor=INK,
            spaceAfter=3,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.4,
            leading=9.4,
            textColor=MUTED,
        ),
        "table": ParagraphStyle(
            "Table",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.2,
            textColor=INK,
        ),
        "table_bold": ParagraphStyle(
            "TableBold",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.2,
            textColor=INK,
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=8.5,
            textColor=WHITE,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.2,
            textColor=INK,
        ),
        "step": ParagraphStyle(
            "Step",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.1,
            textColor=INK,
            spaceAfter=4,
        ),
        "center_small": ParagraphStyle(
            "CenterSmall",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=9,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }


S = styles()


def para(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def heading(kicker: str, title: str, intro: str | None = None) -> list:
    items = [para(kicker.upper(), "kicker"), para(title, "h1")]
    if intro:
        items.append(para(intro, "body"))
    items.append(Spacer(1, 4))
    return items


def callout(title: str, body: str, accent=CYAN, background=PALE_CYAN) -> Table:
    cell = para(f"<b>{title}</b><br/>{body}", "callout")
    table = Table([[cell]], colWidths=[7.18 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.8, accent),
                ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def bullet_list(items: list[str], style: str = "body_tight") -> list[Paragraph]:
    return [Paragraph(item, S[style], bulletText="-") for item in items]


def numbered_steps(items: list[tuple[str, str]]) -> list[Paragraph]:
    return [
        para(f"<font color='#06B6D4'><b>{index}.</b></font> <b>{title}</b> {body}", "step")
        for index, (title, body) in enumerate(items, start=1)
    ]


def data_table(
    rows: list[list[str]],
    widths: list[float],
    header: bool = True,
    header_color=CHARCOAL,
    font_style: str = "table",
) -> Table:
    rendered: list[list[Paragraph]] = []
    for row_index, row in enumerate(rows):
        rendered.append(
            [
                para(value, "table_head" if header and row_index == 0 else font_style)
                for value in row
            ]
        )
    table = Table(rendered, colWidths=[value * inch for value in widths], repeatRows=1 if header else 0)
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_color),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ]
        )
        first_body_row = 1
    else:
        first_body_row = 0
    for row_index in range(first_body_row, len(rows)):
        if (row_index - first_body_row) % 2:
            commands.append(("BACKGROUND", (0, row_index), (-1, row_index), PALE_GRAY))
    table.setStyle(TableStyle(commands))
    return table


def qr_code(url: str, size: float = 0.82 * inch) -> Drawing:
    widget = QrCodeWidget(url)
    x1, y1, x2, y2 = widget.getBounds()
    width = x2 - x1
    height = y2 - y1
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


def cover_page(canvas, doc) -> None:
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setFillColor(CYAN)
    canvas.rect(0, height - 0.16 * inch, width, 0.16 * inch, stroke=0, fill=1)
    canvas.setFillColor(MAGENTA)
    canvas.rect(width - 1.55 * inch, 0, 1.55 * inch, 0.12 * inch, stroke=0, fill=1)
    canvas.setFont("Helvetica-Bold", 22)
    canvas.setFillColor(WHITE)
    canvas.drawString(0.62 * inch, height - 0.58 * inch, "city")
    canvas.setFillColor(CYAN)
    canvas.drawString(1.07 * inch, height - 0.58 * inch, "BEat")
    canvas.setFillColor(HexColor("#8B98A3"))
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawString(1.68 * inch, height - 0.54 * inch, "MAG")
    canvas.setFillColor(HexColor("#82909B"))
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.62 * inch, 0.42 * inch, f"INTERNAL USE ONLY | RATE CARD CURRENT AS OF {AS_OF.upper()}")
    canvas.setTitle("CityBeat Sales Playbook")
    canvas.setAuthor("CityBeat Mag")
    canvas.setSubject("Internal product, promotion, and payment procedure guide for CityBeat sales representatives")
    canvas.restoreState()


def body_page(canvas, doc) -> None:
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(HexColor("#FCFDFE"))
    canvas.rect(0, 0, width, height, stroke=0, fill=1)
    canvas.setStrokeColor(CYAN)
    canvas.setLineWidth(2)
    canvas.line(0.55 * inch, height - 0.39 * inch, width - 0.55 * inch, height - 0.39 * inch)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(INK)
    canvas.drawString(0.55 * inch, height - 0.30 * inch, "city")
    canvas.setFillColor(CYAN)
    canvas.drawString(0.69 * inch, height - 0.30 * inch, "BEat")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica-Bold", 6.5)
    canvas.drawRightString(width - 0.55 * inch, height - 0.30 * inch, "INTERNAL SALES PLAYBOOK")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(0.55 * inch, 0.42 * inch, width - 0.55 * inch, 0.42 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 6.8)
    canvas.drawString(0.55 * inch, 0.25 * inch, f"Rates and workflows verified {AS_OF}. Confirm live pricing before every close.")
    canvas.drawRightString(width - 0.55 * inch, 0.25 * inch, f"PAGE {doc.page}")
    canvas.restoreState()


def build_story() -> list:
    story: list = []

    # Cover
    story.extend(
        [
            Spacer(1, 0.92 * inch),
            para("FIELD + PHONE SALES", "cover_kicker"),
            para("CITYBEAT<br/>SALES PLAYBOOK", "cover_title"),
            para("Product knowledge. Safe checkout. Confident closes.", "cover_sub"),
            Spacer(1, 0.18 * inch),
        ]
    )
    cover_rows = [
        [
            para("<b>SELL THE RIGHT FIT</b><br/>Match the customer's goal to a directory plan, ad placement, job post, or featured event.", "cover_body"),
            para("<b>CLOSE SECURELY</b><br/>Use CityBeat's Stripe Checkout link. The customer always enters their own card details.", "cover_body"),
            para("<b>FOLLOW THROUGH</b><br/>Confirm payment, ownership handoff, fulfillment, and your commission record.", "cover_body"),
        ]
    ]
    cover_table = Table(cover_rows, colWidths=[2.32 * inch] * 3)
    cover_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#171C21")),
                ("BOX", (0, 0), (-1, -1), 0.7, HexColor("#39434B")),
                ("INNERGRID", (0, 0), (-1, -1), 0.7, HexColor("#39434B")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 13),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
            ]
        )
    )
    story.extend(
        [
            cover_table,
            Spacer(1, 0.44 * inch),
            para(
                "Built for CityBeat sales representatives working in person, by phone, and through warm-lead follow-up. Keep this guide internal and use the live sales wizard as the final pricing authority.",
                "cover_body",
            ),
            Spacer(1, 0.23 * inch),
            para(f"Version 1.0 | {AS_OF}", "cover_kicker"),
            PageBreak(),
        ]
    )

    # Page 2 - Fast start
    story.extend(
        heading(
            "01 | Fast start",
            "The four moves behind every clean sale",
            "A sale is not complete when a link is sent. It is complete when Stripe confirms payment and the correct product can be fulfilled.",
        )
    )
    flow_rows = [
        [
            para("<b>1. DISCOVER</b><br/>What outcome does the business need now?", "callout"),
            para("<b>2. RECOMMEND</b><br/>One primary product and one clear reason.", "callout"),
            para("<b>3. CHECK OUT</b><br/>Generate the secure CityBeat Stripe link.", "callout"),
            para("<b>4. CONFIRM</b><br/>Verify successful payment and next steps.", "callout"),
        ]
    ]
    flow = Table(flow_rows, colWidths=[1.78 * inch] * 4)
    flow.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), PALE_CYAN),
                ("BOX", (0, 0), (-1, -1), 0.7, CYAN),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, CYAN),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([flow, Spacer(1, 10), para("NON-NEGOTIABLE RULES", "h2")])
    story.extend(
        bullet_list(
            [
                "<b>Use the live wizard as final authority.</b> Prices and availability can change after this guide is printed.",
                "<b>Never handle card details.</b> The customer types their card into Stripe Checkout on their own device.",
                "<b>Confirm the exact product, term, and total before generating a link.</b>",
                "<b>Only send CityBeat-generated Stripe links.</b> Valid links begin with checkout.stripe.com or buy.stripe.com.",
                "<b>Do not promise guaranteed leads, sales, traffic, placement dates, or editorial coverage.</b>",
                "<b>Do not invent discounts.</b> Use Founding 100, annual savings, or a manager-approved custom amount only.",
            ]
        )
    )
    story.append(Spacer(1, 7))
    quick_links = Table(
        [
            [qr_code(NEW_SALE_URL, 0.9 * inch), para("<b>OPEN A NEW SALE</b><br/><link href='%s' color='#067C8E'>%s</link><br/><br/>Scan or click to open the field-sales wizard. Login and an approved sales role are required." % (NEW_SALE_URL, NEW_SALE_URL), "callout")],
            [para("<b>PIPELINE</b><br/><link href='%s' color='#067C8E'>%s</link>" % (PIPELINE_URL, PIPELINE_URL), "callout"), para("<b>MY BANK AND PAYOUTS</b><br/><link href='%s' color='#067C8E'>%s</link>" % (PAYOUTS_URL, PAYOUTS_URL), "callout")],
        ],
        colWidths=[2.1 * inch, 5.08 * inch],
    )
    quick_links.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("SPAN", (1, 0), (1, 0)),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
                ("BACKGROUND", (0, 0), (-1, -1), WHITE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([quick_links, PageBreak()])

    # Page 3 - Directory rate card
    story.extend(
        heading(
            "02 | Product knowledge",
            "Directory plans and the Founding 100 offer",
            "Directory subscriptions are priced per location. Start with the customer's need: accurate presence, immediate leads, richer content, or maximum category visibility.",
        )
    )
    directory_rows = [
        ["PLAN", "PRICE", "BEST FOR", "CUSTOMER VALUE / SALES ANGLE"],
        ["Basic", "$0", "A no-risk first step", "Listed in the directory, eligible for reviews, and able to see that leads exist. Lead contact details remain masked."],
        ["Founding Monthly", "$9.99/mo", "Price-sensitive early adopters", "All Premium features at the Founding 100 launch rate, locked for the life of the active subscription. Limited to the first 100 paid claimers."],
        ["Founding Annual", "$99/yr<br/>$8.25/mo effective", "Owners ready to commit", "Lowest published Premium price. Saves $140 versus twelve Premium Monthly payments and stays locked for the life of the active subscription."],
        ["Premium Monthly", "$19.99/mo", "Flexible month-to-month buyers", "Full leads, photo gallery, cover image, custom description, social links, business hours, deals, and priority directory placement."],
        ["Premium Annual", "$199/yr<br/>$16.58/mo effective", "Stable businesses seeking savings", "All Premium benefits with two months free versus monthly billing."],
        ["Featured", "$49/mo", "Businesses fighting for category leadership", "Everything in Premium plus top-of-category placement, a Featured badge, and homepage rotation."],
    ]
    story.append(data_table(directory_rows, [1.13, 1.02, 1.55, 3.48], header_color=CHARCOAL))
    story.extend([Spacer(1, 8), callout("Founding 100 must be confirmed live", "Never promise Founding availability until checkout accepts it. The offer is capped at 100 paid claimers. If a customer cancels, do not promise they can return at the same price. Founding Annual appears on the public claim page but is not currently selectable in the rep sales wizard.", GOLD, PALE_GOLD)])
    story.extend([Spacer(1, 7), para("THE PREMIUM VALUE STACK", "h2")])
    value_rows = [
        ["NEED", "LIVE BENEFIT", "HOW TO SAY IT"],
        ["More customer inquiries", "Full lead contact details instead of masked leads", "You can respond while the customer is still deciding."],
        ["A stronger storefront", "Photos, cover image, description, hours, and social links", "Give local customers enough confidence to call, visit, or request a quote."],
        ["More visibility", "Priority placement; Featured adds top-category and homepage rotation", "Stand above basic listings when readers are actively browsing your category."],
        ["Retention and proof", "Monthly views, leads, and review reporting", "Use real activity to judge value rather than relying on guesswork."],
    ]
    story.append(data_table(value_rows, [1.45, 2.55, 3.18]))
    story.extend([Spacer(1, 6), para("AI assistant and AI-concierge benefits appear in product documentation, but AI services may be dormant until platform keys are enabled. Do not sell them as guaranteed live features without management confirmation.", "small"), PageBreak()])

    # Page 4 - Advertising and add-ons
    story.extend(
        heading(
            "03 | Product knowledge",
            "Advertising, recruitment, and event products",
            "Published rates are the starting rate card. Advertising uses a clearly described custom charge in the rep wizard. Jobs and featured events use their dedicated public forms so successful payment can trigger automatic publishing.",
        )
    )
    ad_rows = [
        ["PRODUCT", "RATE", "WHAT THE CUSTOMER GETS", "BEST SALES ANGLE"],
        ["Newsletter Sponsorship", "$50 monthly", "Top placement in the weekly send, bilingual creative review, and a campaign performance summary.", "Reach readers in a focused, repeat habit: the newsletter they already open."],
        ["Sponsored Story", "$30 per post", "Native story placement, editorial production guidance, and category plus social distribution.", "Explain a business, launch, founder story, or community impact with more depth than an ad."],
        ["Category Banner", "$25 monthly", "Category-page placement, leaderboard and rectangle formats, and simple monthly reporting.", "Put a timely offer beside readers already browsing a relevant topic."],
        ["Featured Event", "$25 one time", "Top placement, Featured badge, and immediate publication after payment through the event-submission flow.", "Give a time-sensitive event stronger visibility when every day matters."],
        ["Job Posting", "$50 one time", "A paid job listing published for 30 days after payment through the job-posting flow.", "Recruit from the El Paso and Juarez community without a long campaign commitment."],
        ["Custom Ad / Package", "Approved quote", "A one-time custom charge for a banner, sponsored placement, or negotiated package. The receipt carries the description you enter.", "Fit the campaign to the customer's goal, timing, and budget while keeping every deliverable explicit."],
    ]
    story.append(data_table(ad_rows, [1.28, 0.86, 2.75, 2.29], header_color=CHARCOAL))
    story.extend([Spacer(1, 8), callout("Approved audience statements", "The advertising page currently states 50,000+ monthly bilingual readers, 5 core coverage zones, and a 24-hour campaign review target. Present these as CityBeat's current published claims, not as guaranteed impressions, sales, or approval times.", MAGENTA, PALE_MAGENTA)])
    story.extend([Spacer(1, 8), para("SMART COMBINATIONS - WITHOUT INVENTING A DISCOUNT", "h2")])
    combinations = [
        ["CUSTOMER GOAL", "RECOMMENDED COMBINATION", "WHY IT WORKS"],
        ["Launch a new location", "Premium Annual + Sponsored Story", "Build an always-on business profile, then tell the launch story."],
        ["Promote a seasonal offer", "Premium Monthly + Category Banner", "Strengthen the listing and add a timely category-level call to action."],
        ["Drive event awareness", "Featured Event + Sponsored Story", "Add immediate placement plus context that explains why the event matters."],
        ["Hire locally", "Job Posting + Newsletter Sponsorship", "Keep the job live for 30 days and add concentrated newsletter reach."],
    ]
    story.append(data_table(combinations, [1.65, 2.45, 3.08]))
    story.extend([Spacer(1, 6), para("Quote each published line item or use one manager-approved custom amount with a detailed receipt description. A combination is not automatically a discount.", "small"), PageBreak()])

    # Page 5 - Discovery and fit
    story.extend(
        heading(
            "04 | Consultative selling",
            "Diagnose first, recommend second",
            "The strongest close is a short recommendation tied directly to what the owner said they need. Do not present every product at once.",
        )
    )
    discovery_rows = [
        [
            para("<b>DISCOVERY QUESTIONS</b>", "callout"),
            para("<b>LISTEN FOR</b>", "callout"),
        ],
        [
            para("1. How do new customers find you today?<br/>2. Which service, product, event, or opening matters most this month?<br/>3. Do you need ongoing visibility or a one-time push?<br/>4. Are customers calling, visiting, requesting quotes, buying tickets, or applying?<br/>5. What area or category should see the offer?<br/>6. Do you have photos, a story, or an offer ready?<br/>7. What would make this worthwhile in the next 30 to 90 days?", "body_tight"),
            para("- Weak or incomplete online presence<br/>- Missed or slow lead follow-up<br/>- A launch, sale, hiring need, or event deadline<br/>- Desire for bilingual local reach<br/>- Need for a measurable report<br/>- Need for category leadership<br/>- Budget preference: monthly, annual, or one-time", "body_tight"),
        ],
    ]
    discovery = Table(discovery_rows, colWidths=[4.15 * inch, 3.03 * inch])
    discovery.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PALE_CYAN),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([discovery, Spacer(1, 9), para("THE ONE-LINE RECOMMENDATION", "h2"), callout("Use this formula", "Because you said <b>[goal/problem]</b>, I recommend <b>[one product]</b> because it gives you <b>[specific benefit]</b>. The investment is <b>[exact price and term]</b>. Would you like to activate it now?", CYAN, PALE_CYAN), Spacer(1, 8)])
    fit_rows = [
        ["IF THE CUSTOMER SAYS...", "LEAD WITH...", "WHY"],
        ["I just need to be found accurately", "Basic or Premium", "Basic removes risk; Premium turns the profile into a richer storefront."],
        ["I need customer inquiries now", "Premium", "Full lead details and a stronger profile support faster response."],
        ["I want the top position", "Featured", "Top-of-category, badge, and homepage rotation are the clearest visibility upgrade."],
        ["I have an announcement or story", "Sponsored Story", "More room for context, trust, and distribution than a banner."],
        ["I have a short-term offer", "Category Banner", "Contextual placement supports a focused call to action."],
        ["I need repeat exposure", "Newsletter Sponsorship", "Weekly placement supports repetition and recall."],
        ["I need applicants", "Job Posting", "A simple 30-day local recruitment product."],
        ["My event is soon", "Featured Event", "Immediate paid publishing and enhanced placement."],
    ]
    story.append(data_table(fit_rows, [2.25, 1.55, 3.38]))
    story.extend([Spacer(1, 7), callout("Pricing discipline", "Say the full term every time: '$19.99 per month,' '$199 per year,' or '$50 for 30 days.' Never present recurring pricing as if it were a one-time charge.", GOLD, PALE_GOLD), PageBreak()])

    # Page 6 - Product angles
    story.extend(
        heading(
            "05 | Sales angles",
            "Turn features into customer outcomes",
            "Use one angle that fits the conversation. Keep claims specific, believable, and connected to a live product benefit.",
        )
    )
    angle_rows = [
        ["PRODUCT", "ANGLE", "HIGHLIGHT", "CLOSE QUESTION"],
        ["Basic", "No-risk ownership", "Claim the presence customers may already find, correct details, and start building reviews.", "Would it help to secure the profile first, then decide on promotion?"],
        ["Founding", "Urgency plus protected value", "Premium capability at the lowest launch pricing while limited inventory remains.", "If checkout confirms a Founding spot, would you prefer monthly or the annual value?"],
        ["Premium", "A better digital storefront", "Full leads, richer information, deals, and stronger directory placement support conversion.", "Would faster access to customer inquiries be worth activating today?"],
        ["Featured", "Category leadership", "The strongest directory visibility package for a competitive category.", "Is being seen before basic and Premium listings the priority?"],
        ["Newsletter", "Concentrated repeat attention", "A weekly habit, premium placement, bilingual creative review, and reporting.", "Which four-week period matters most for your campaign?"],
        ["Sponsored Story", "Trust through explanation", "Tell the founder, launch, expertise, or community story in a useful format.", "What would you want a local reader to understand after reading it?"],
        ["Category Banner", "Contextual demand", "Put a focused offer beside people already browsing the relevant subject.", "Which category and offer should the banner own this month?"],
        ["Featured Event", "Time-sensitive visibility", "Top placement and immediate publishing after payment support a short runway.", "How many days do you have before the event?"],
        ["Job Posting", "Simple local recruiting", "One price for a 30-day listing aimed at the regional community.", "When do you need applications to start arriving?"],
    ]
    story.append(data_table(angle_rows, [1.0, 1.45, 3.2, 1.53]))
    story.extend([Spacer(1, 8), callout("Use proof without overpromising", "Show the live directory preview, product page, placement examples, or available campaign reporting. Say 'designed to improve visibility' rather than 'guaranteed to bring customers.'", MAGENTA, PALE_MAGENTA), Spacer(1, 7), para("A GOOD RECOMMENDATION IS NARROW", "h2")])
    story.extend(
        bullet_list(
            [
                "Recommend one main product first. Offer an add-on only when it serves the same stated goal.",
                "Use the customer's own words when describing the problem and expected outcome.",
                "Anchor annual plans to their effective monthly value, then state the full annual charge clearly.",
                "When a customer is not ready to buy, claim Basic free and schedule the next conversation.",
            ]
        )
    )
    story.append(PageBreak())

    # Page 7 - In-person close
    story.extend(
        heading(
            "06 | In-person procedure",
            "Charge on the spot with a Stripe QR code",
            "The sales wizard creates a Stripe-hosted checkout link and a QR code. The customer completes payment on their own device; the sale stays attributed to the signed-in rep.",
        )
    )
    story.append(callout("Before you begin", "Confirm your sales access, connect your bank under My Bank and Payouts, and collect the business name, customer email, optional phone, exact product, exact term, and permission to send the link.", CYAN, PALE_CYAN))
    story.extend([Spacer(1, 8), para("STEP BY STEP", "h2")])
    story.extend(
        numbered_steps(
            [
                ("Open the sales wizard.", f"Sign in and go to <link href='{NEW_SALE_URL}' color='#067C8E'>{NEW_SALE_URL}</link>."),
                ("Choose the product path.", "Use <b>Directory listing</b> for a recurring plan or <b>Ad / custom amount</b> for an ad, banner, sponsored placement, or approved package. Use the dedicated public form for a job or featured event; ask management before substituting a custom charge."),
                ("Enter the client.", "Add the exact business name and a valid email for the checkout and receipt. Add a phone only with permission."),
                ("Set the product.", "For directory, choose the plan shown in the wizard. For custom, enter the approved USD amount and a precise receipt description."),
                ("Read back the offer.", "Say the product, deliverable, amount, and billing term. Correct any error before continuing."),
                ("Generate the payment link.", "Select <b>Generate payment link</b>. A Stripe URL and QR code appear."),
                ("Let the customer pay.", "Have the customer scan the QR code. They review Stripe Checkout and enter their own card details."),
                ("Stay on the result screen.", "Do not assume that scanning means payment. Wait for Stripe's success confirmation or the paid receipt."),
                ("Confirm next steps.", "Explain activation, creative handoff, owner attachment, or publishing timing for the product sold."),
                ("Record the close.", "Check your pipeline and start another sale only after the first customer's outcome is clear."),
            ]
        )
    )
    story.extend([Spacer(1, 6), callout("Card safety", "Never type, photograph, write down, repeat, or store a customer's card number, security code, banking login, or Stripe password. If the customer cannot complete checkout privately, send the link for later instead of taking the card yourself.", MAGENTA, PALE_MAGENTA), Spacer(1, 7)])
    in_person_rows = [
        ["IF THIS HAPPENS", "DO THIS"],
        ["Wrong price or description", "Stop. Start a new sale and generate a fresh link. Do not ask the customer to pay an incorrect checkout."],
        ["Customer cancels Stripe", "Clarify the concern, correct the offer if needed, and generate a new link only when they are ready."],
        ["Payment fails", "Let Stripe display the error. The customer may retry or use another card; you do not troubleshoot their card details."],
        ["QR will not scan", "Use Open checkout on a separate device or Copy link and send it to the customer."],
    ]
    story.append(data_table(in_person_rows, [2.0, 5.18]))
    story.append(PageBreak())

    # Page 8 - Phone close
    story.extend(
        heading(
            "07 | Phone procedure",
            "Close remotely with email, SMS, link, or QR",
            "For a customer using the same phone, a clickable link is better than a QR code. Keep the customer on the call while they open and review Stripe Checkout.",
        )
    )
    story.extend(
        numbered_steps(
            [
                ("Verify the decision maker.", "Confirm the business, contact name, callback number, and email. Never ask for card details."),
                ("Agree on the offer.", "Read the product, deliverables, exact charge, and recurring or one-time term."),
                ("Build the checkout.", "Use the sales wizard for directory and advertising sales. Use the dedicated job-posting or event-submission form when that product must auto-publish after payment."),
                ("Choose the best handoff.", "Use <b>Email the link</b> for a clear branded message. Use <b>Text the link</b> only with permission and only when SMS is configured. Otherwise use <b>Copy link</b> and send it through the approved business channel."),
                ("Have the customer verify it.", "Ask them to confirm the Stripe page shows the expected business, product, price, and term before paying."),
                ("Stay available, not intrusive.", "Remain on the line for questions, but be silent while they enter card information."),
                ("Confirm payment.", "Look for success and ask the customer to confirm the Stripe receipt. A sent link is not a paid sale."),
                ("Send fulfillment expectations.", "Restate what happens next and who will contact them for listing ownership, creative, job, or event details."),
            ]
        )
    )
    story.extend([Spacer(1, 8), callout("SMS fallback", "The current app can email payment links. Texting works only when Twilio is configured. If the wizard reports that texting is unavailable, copy the Stripe link and send it through an approved business messaging channel. Do not use a personal channel if company policy forbids it.", GOLD, PALE_GOLD), Spacer(1, 8), para("REMOTE QR CODE USE", "h2")])
    qr_rows = [
        [qr_code(NEW_SALE_URL, 0.84 * inch), para("<b>Use QR only when it helps.</b><br/>A customer cannot easily scan a QR displayed on the same phone they are using. Prefer the clickable payment link. If the customer has a second device, they can scan the live QR. If policy permits, you may send a screenshot of the generated payment QR through the approved channel - but never edit, crop away the price context, or reuse an old customer's QR.", "callout")],
    ]
    qr_table = Table(qr_rows, colWidths=[1.12 * inch, 6.06 * inch])
    qr_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), PALE_CYAN),
                ("BOX", (0, 0), (-1, -1), 0.7, CYAN),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([qr_table, Spacer(1, 8), para("PHONE CLOSE TALK TRACK", "h2"), callout("Suggested language", "I just sent a secure CityBeat payment link. Please check that the Stripe page shows [product] at [price and term]. I will stay on the line for questions, but you will enter the card privately. Once Stripe confirms payment, I will explain the activation steps.", MAGENTA, PALE_MAGENTA), PageBreak()])

    # Page 9 - Scripts and objections
    story.extend(
        heading(
            "08 | Conversation tools",
            "Simple scripts that keep the customer in control",
            "Use these as frameworks, not speeches. Personalize the problem, product, and proof while keeping pricing and security exact.",
        )
    )
    script_rows = [
        ["MOMENT", "SUGGESTED LANGUAGE"],
        ["Opening", "CityBeat helps local customers discover businesses, events, jobs, and offers across the borderland. May I ask how people find and contact you today?"],
        ["Problem summary", "It sounds like the main gap is [visibility / leads / launch awareness / hiring / event reach]."],
        ["Recommendation", "Because you need [goal], I recommend [product]. It gives you [specific benefit] for [exact price and term]."],
        ["Proof", "Let me show you the live placement, profile preview, product page, or reporting that comes with it."],
        ["Close", "Would you like to activate it now? I can generate a secure Stripe link while we are together."],
        ["No-pressure next step", "If today is not the day, I can send the exact offer and we can schedule a short follow-up."],
    ]
    story.append(data_table(script_rows, [1.35, 5.83]))
    story.extend([Spacer(1, 10), para("OBJECTION HANDLING", "h2")])
    objection_rows = [
        ["OBJECTION", "RESPONSE"],
        ["I already use Google or Facebook.", "That is useful. CityBeat adds a bilingual local context, a controllable business profile, directory discovery, reviews, deals, and local editorial or advertising placements. It complements those channels."],
        ["It costs too much.", "Which outcome matters enough to pay for: faster lead access, stronger visibility, or a one-time campaign? We can compare monthly, annual, Founding if available, or a smaller one-time product without inventing a discount."],
        ["Can you guarantee customers?", "No responsible placement can guarantee sales. CityBeat sells visibility, lead access, placement, content, and reporting so you can evaluate performance."],
        ["I need to think about it.", "Absolutely. Which part needs clarity - fit, timing, price, or deliverables? I can send the exact secure link and follow up at an agreed time."],
        ["I do not want a subscription.", "A Sponsored Story, Featured Event, Job Posting, or approved custom campaign can be a one-time purchase. I will label the deliverable clearly on the receipt."],
        ["Is the payment secure?", "Yes. You pay on Stripe's hosted checkout. I never see or collect your card number, and Stripe emails the receipt."],
        ["Give me the Founding rate.", "I can select Founding Monthly in the rep wizard and let checkout confirm availability. Founding Annual uses the public claim flow. I cannot promise either after the 100 spots are filled."],
    ]
    story.append(data_table(objection_rows, [1.72, 5.46]))
    story.extend([Spacer(1, 7), para("Never argue. Clarify the concern, answer once, and let the customer decide. Pressure creates refunds and damages trust.", "small"), PageBreak()])

    # Page 10 - Promotions and follow-up
    story.extend(
        heading(
            "09 | Promotions and follow-up",
            "Create urgency without creating mistrust",
            "Urgency must come from a real limit, a real deadline, or the customer's own timing - never from a made-up expiration or discount.",
        )
    )
    promo_rows = [
        ["OFFER", "WHAT IS TRUE", "HOW TO PRESENT IT", "DO NOT SAY"],
        ["Founding 100 Monthly", "$9.99/month; Premium features; first 100 paid claimers; rate locked for life of active subscription.", "If a spot is available, this is the lowest monthly entry into Premium and the rate stays protected while the subscription remains active.", "There will always be a spot; you can cancel and return at the same rate; lifetime means forever regardless of subscription status."],
        ["Founding 100 Annual", "$99/year; $8.25/month effective; saves $140 versus twelve Premium Monthly payments; public claim flow.", "Best published value for an owner ready to commit for a year, subject to live availability.", "It is selectable in the rep wizard; it is refundable; availability is guaranteed."],
        ["Premium Annual", "$199/year; $16.58/month effective; two months free versus monthly.", "A straightforward savings choice for a stable business that wants Premium for a full year.", "It is monthly billing; it includes an extra discount beyond the published annual price."],
        ["Custom approved quote", "A manager-approved one-time amount with exact deliverables written on the Stripe receipt.", "Use when the published products need a clear, negotiated package.", "Custom automatically means discounted; verbal extras are included."],
    ]
    story.append(data_table(promo_rows, [1.3, 2.1, 2.3, 1.48]))
    story.extend([Spacer(1, 10), para("FOLLOW-UP CADENCE", "h2")])
    follow_rows = [
        ["WHEN", "ACTION", "GOAL"],
        ["Immediately", "Send the exact payment link and a one-sentence recap of product, price, and term.", "Remove friction and prevent confusion."],
        ["10 to 20 minutes", "If they expected to pay on the call but did not, ask whether the link opened correctly. Do not ask for card details.", "Solve link or product confusion."],
        ["Next business day", "Follow up with the stated customer goal and one clear call to action.", "Reconnect value to their own need."],
        ["Day 3", "Offer a short answer, preview, or alternate fit - not an unapproved discount.", "Address the real blocker."],
        ["Day 7", "Ask whether to close the file or schedule a future date.", "Respect the customer's decision and protect your time."],
    ]
    story.append(data_table(follow_rows, [1.2, 4.45, 1.53]))
    story.extend([Spacer(1, 8), callout("Work warm leads first", "The sales dashboard ranks businesses that opened or clicked outreach. A click is the strongest buying signal; call clickers before open-only prospects. Some email opens can be automated security scans.", CYAN, PALE_CYAN), PageBreak()])

    # Page 11 - After sale and commission
    story.extend(
        heading(
            "10 | After the checkout",
            "Fulfillment, commissions, and customer trust",
            "A clean handoff reduces refunds. Set the next expectation before leaving the customer or ending the call.",
        )
    )
    after_rows = [
        ["PRODUCT", "WHAT HAPPENS AFTER PAYMENT", "REP HANDOFF"],
        ["Directory subscription", "The listing records the paid tier and rep attribution. A new rep-created listing may require an admin to attach the real owner.", "Confirm business name, owner contact, listing, plan, and any claim or ownership step."],
        ["Custom ad / sponsored placement", "The payment is recorded as an advertising purchase with the receipt description.", "Send the exact deliverables, dates, creative files, approvals, and contact owner to the fulfillment team."],
        ["Featured Event", "Successful payment marks the event Featured and publishes it immediately through the webhook flow.", "Confirm title, date, venue, ticket link, image, and visibility on the event page."],
        ["Job Posting", "Successful payment publishes the job for 30 days.", "Confirm title, company, application URL/contact, and public listing."],
    ]
    story.append(data_table(after_rows, [1.45, 3.25, 2.48]))
    story.extend([Spacer(1, 9), para("YOUR COMMISSION", "h2")])
    story.append(callout("Current rep split in the application", "The current code assigns a sales rep 40% of an attributed directory sale and 50% of an attributed ad or add-on sale. Management controls payout policy and whether recurring subscriptions pay once or residually. Confirm the current compensation policy in your dashboard; never discuss internal splits with customers.", GOLD, PALE_GOLD))
    story.extend(
        [
            Spacer(1, 7),
            *bullet_list(
                [
                    "Connect your bank at <link href='%s' color='#067C8E'>%s</link>. Stripe transfers require a connected account with payouts enabled." % (PAYOUTS_URL, PAYOUTS_URL),
                    "Commission records appear after successful processing. A generated or sent link does not earn commission.",
                    "Refunds, failed renewals, or cancellations can change payment and listing status. Do not promise payout timing before it appears in the system.",
                    "The sale stays attributed through the signed-in rep wizard's checkout metadata. Dedicated public job and event flows may not carry rep attribution, so confirm the approved process before promising commission. Never use another rep's login or reuse another customer's link.",
                ]
            ),
            Spacer(1, 7),
            para("CUSTOMER DATA AND CONSENT", "h2"),
        ]
    )
    safety_rows = [
        ["DO", "DO NOT"],
        ["Ask permission before emailing or texting; use the business contact data needed for the sale; keep notes factual; use approved CityBeat systems.", "Collect card data; send arbitrary links; expose one customer's link to another; promise refunds; upload customer documents to personal storage; claim guaranteed results."],
    ]
    story.append(data_table(safety_rows, [3.59, 3.59], header_color=CHARCOAL))
    story.extend([Spacer(1, 8), callout("When in doubt", "Pause the sale. Confirm the product, price, availability, fulfillment, or policy with management. Then generate a fresh link. It is better to delay checkout than to process the wrong offer.", MAGENTA, PALE_MAGENTA), PageBreak()])

    # Page 12 - Quick reference
    story.extend(
        heading(
            "11 | Desk reference",
            "The one-page close checklist",
            "Keep this page beside you during calls. The live wizard and Stripe confirmation remain the final authority.",
        )
    )
    checklist_rows = [
        [
            para("<b>BEFORE</b><br/>[ ] Correct customer and business<br/>[ ] Decision maker confirmed<br/>[ ] Goal and best-fit product<br/>[ ] Exact price and term<br/>[ ] Email and consent to send<br/>[ ] Fulfillment expectation", "body_tight"),
            para("<b>BUILD</b><br/>[ ] Directory or custom path<br/>[ ] Correct plan or amount<br/>[ ] Clear receipt description<br/>[ ] Offer read back aloud<br/>[ ] Fresh Stripe link generated<br/>[ ] Valid Stripe host", "body_tight"),
            para("<b>CLOSE</b><br/>[ ] Customer enters own card<br/>[ ] Success or receipt confirmed<br/>[ ] No card data recorded<br/>[ ] Next steps explained<br/>[ ] Pipeline checked<br/>[ ] Follow-up scheduled", "body_tight"),
        ]
    ]
    checklist = Table(checklist_rows, colWidths=[2.39 * inch] * 3)
    checklist.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, 0), PALE_CYAN),
                ("BACKGROUND", (1, 0), (1, 0), PALE_GOLD),
                ("BACKGROUND", (2, 0), (2, 0), PALE_MAGENTA),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.extend([checklist, Spacer(1, 9), para("CURRENT REP-WIZARD DIRECTORY OPTIONS", "h2")])
    wizard_rows = [
        ["AVAILABLE IN REP WIZARD", "NOT CURRENTLY IN REP WIZARD"],
        ["Founding Monthly - $9.99/mo<br/>Premium Monthly - $19.99/mo<br/>Premium Annual - $199/yr<br/>Featured - $49/mo", "Founding Annual - $99/yr<br/><br/>Use the public claim flow or confirm the approved process with management."],
    ]
    story.append(data_table(wizard_rows, [3.59, 3.59]))
    story.extend([Spacer(1, 8), para("DIRECT LINKS", "h2")])
    links = [
        ["New sale", NEW_SALE_URL],
        ["My pipeline", PIPELINE_URL],
        ["My bank and payouts", PAYOUTS_URL],
        ["Advertising products", "https://citybeatmag.co/en/ads"],
        ["Directory", "https://citybeatmag.co/en/directory"],
        ["Submit / feature event", "https://citybeatmag.co/en/events/submit"],
        ["Post a job", "https://citybeatmag.co/en/jobs/post"],
    ]
    link_rows = [["RESOURCE", "LINK"]] + [[label, f"<link href='{url}' color='#067C8E'>{url}</link>"] for label, url in links]
    story.append(data_table(link_rows, [1.62, 5.56]))
    story.extend([Spacer(1, 8), callout("Final close standard", "Recommend the right product. State the exact price and term. Let the customer pay privately through Stripe. Confirm success. Explain fulfillment. Record the handoff.", CYAN, PALE_CYAN), Spacer(1, 8), para("CityBeat internal sales enablement | Questions or pricing exceptions: contact platform management before checkout.", "center_small")])

    return story


def build_pdf(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output),
        pagesize=letter,
        leftMargin=0.66 * inch,
        rightMargin=0.66 * inch,
        topMargin=0.56 * inch,
        bottomMargin=0.75 * inch,
        title="CityBeat Sales Playbook",
        author="CityBeat Mag",
        subject="Internal product, promotion, and secure payment guide",
        pageCompression=1,
    )
    doc.build(build_story(), onFirstPage=cover_page, onLaterPages=body_page)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_pdf(path: Path, public_copy: Path | None = None) -> None:
    from pypdf import PdfReader

    if not path.exists() or path.stat().st_size < 40_000:
        raise SystemExit(f"PDF missing or unexpectedly small: {path}")
    reader = PdfReader(str(path))
    if len(reader.pages) < 10:
        raise SystemExit(f"Expected at least 10 pages, found {len(reader.pages)}")
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    normalized_text = " ".join(text.split()).lower()
    required = [
        "CITYBEAT SALES PLAYBOOK",
        "Founding Monthly",
        "$19.99/mo",
        "Newsletter Sponsorship",
        "Charge on the spot",
        "Phone procedure",
        "checkout.stripe.com",
        "Current rep split",
        "The one-page close checklist",
    ]
    missing = [value for value in required if " ".join(value.split()).lower() not in normalized_text]
    if missing:
        raise SystemExit(f"Missing required PDF text: {missing}")

    link_count = 0
    for page in reader.pages:
        annotations = page.get("/Annots", [])
        for annotation in annotations:
            obj = annotation.get_object()
            action = obj.get("/A")
            if action and action.get("/URI"):
                link_count += 1
    if link_count < 8:
        raise SystemExit(f"Expected at least 8 clickable links, found {link_count}")

    if public_copy:
        if not public_copy.exists():
            raise SystemExit(f"Public PDF copy missing: {public_copy}")
        if sha256(path) != sha256(public_copy):
            raise SystemExit("Canonical and public PDF copies differ")

    print(f"Verified {path}: pages={len(reader.pages)}, links={link_count}, bytes={path.stat().st_size}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the CityBeat sales playbook PDF")
    parser.add_argument("--verify", action="store_true", help="verify PDF text, links, size, and duplicate hash")
    parser.add_argument("--verify-only", action="store_true", help="verify existing PDFs without regenerating")
    args = parser.parse_args()

    if not args.verify_only:
        build_pdf(CANONICAL_PDF)
        PUBLIC_PDF.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(CANONICAL_PDF, PUBLIC_PDF)
        print(f"Generated {CANONICAL_PDF}")
        print(f"Published {PUBLIC_PDF}")

    if args.verify or args.verify_only:
        verify_pdf(CANONICAL_PDF, PUBLIC_PDF)


if __name__ == "__main__":
    main()
