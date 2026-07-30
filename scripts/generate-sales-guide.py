from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path

from pypdf import PdfReader
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
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "apps" / "web" / "public" / "downloads"

SALES_GUIDE = OUTPUT_DIR / "citybeat-sales-guide.pdf"
SALES_GUIDE_PUBLIC = PUBLIC_DIR / "citybeat-sales-guide.pdf"
QUICK_START = OUTPUT_DIR / "citybeat-sales-desk-quick-start.pdf"
QUICK_START_PUBLIC = PUBLIC_DIR / "citybeat-sales-desk-quick-start.pdf"

SALES_DESK_URL = "https://citybeatmag.co/en/admin/sales/new"
SEO_SOURCE_URL = "https://support.google.com/business/answer/7091"
PRODUCT_SOURCE = ROOT / "apps" / "web" / "src" / "lib" / "sales-products.ts"
PRICING_SOURCE = ROOT / "apps" / "web" / "src" / "lib" / "pricing.ts"

DARK = HexColor("#0B0F12")
INK = HexColor("#172027")
MUTED = HexColor("#53626D")
CYAN = HexColor("#00AFC8")
CYAN_DARK = HexColor("#067C8E")
PALE_CYAN = HexColor("#E8F8FA")
MAGENTA = HexColor("#D21FC9")
PALE_MAGENTA = HexColor("#FBEAF9")
GOLD = HexColor("#B77900")
PALE_GOLD = HexColor("#FFF6DD")
LINE = HexColor("#C9D2D8")
LIGHT = HexColor("#F3F6F7")
WHITE = colors.white

PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT = 0.55 * inch
RIGHT = 0.55 * inch
TOP = 0.62 * inch
BOTTOM = 0.58 * inch
CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=25,
            leading=27,
            textColor=DARK,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=MUTED,
            spaceAfter=8,
        ),
        "eyebrow": ParagraphStyle(
            "Eyebrow",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.8,
            leading=9,
            textColor=CYAN_DARK,
            spaceBefore=0,
            spaceAfter=4,
            tracking=1.2,
        ),
        "h1": ParagraphStyle(
            "Heading1",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=DARK,
            spaceBefore=8,
            spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            textColor=CYAN_DARK,
            spaceBefore=4,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=12.2,
            textColor=INK,
            spaceAfter=5,
        ),
        "body_tight": ParagraphStyle(
            "BodyTight",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.4,
            textColor=INK,
            spaceAfter=2,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=9.2,
            textColor=MUTED,
            spaceAfter=2,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=8.5,
            textColor=WHITE,
            alignment=TA_LEFT,
        ),
        "table_body": ParagraphStyle(
            "TableBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.4,
            textColor=INK,
        ),
        "table_body_small": ParagraphStyle(
            "TableBodySmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=8.7,
            textColor=INK,
        ),
        "center_small": ParagraphStyle(
            "CenterSmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.3,
            alignment=TA_CENTER,
            textColor=MUTED,
        ),
    }


STYLES = styles()


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, STYLES[style])


def brand_header(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(CYAN)
    canvas.rect(0, PAGE_HEIGHT - 0.08 * inch, PAGE_WIDTH, 0.08 * inch, fill=1, stroke=0)
    x = LEFT
    y = PAGE_HEIGHT - 0.38 * inch
    canvas.setFillColor(DARK)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(x, y, "city")
    x += canvas.stringWidth("city", "Helvetica-Bold", 13)
    canvas.setFillColor(CYAN)
    canvas.drawString(x, y, "BEAT")
    x += canvas.stringWidth("BEAT", "Helvetica-Bold", 13)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica-Bold", 5.5)
    canvas.drawString(x + 1, y + 1, "MAG")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 6.7)
    canvas.drawRightString(
        PAGE_WIDTH - RIGHT,
        0.3 * inch,
        f"INTERNAL SALES TOOL | CURRENT JULY 30, 2026 | {doc.page}",
    )
    canvas.restoreState()


def callout(title: str, body: str, accent=CYAN, fill=PALE_CYAN) -> Table:
    content = p(
        f"<font color='{accent.hexval()}'><b>{title.upper()}</b></font><br/>{body}",
        "body_tight",
    )
    table = Table([[content]], colWidths=[CONTENT_WIDTH])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.7, accent),
                ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def data_table(
    rows: list[list[str]],
    widths: list[float],
    *,
    small: bool = False,
    header_color=DARK,
) -> Table:
    body_style = "table_body_small" if small else "table_body"
    rendered = [
        [p(cell, "table_header" if row_index == 0 else body_style) for cell in row]
        for row_index, row in enumerate(rows)
    ]
    table = Table(
        rendered,
        colWidths=[width * inch for width in widths],
        repeatRows=1,
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_color),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
            ]
        )
    )
    return table


def step_table(steps: list[tuple[str, str, str]]) -> Table:
    rows = [["STEP", "CLICK / ENTER", "RESULT"]] + [
        [f"<b>{number}</b>", f"<b>{action}</b>", result] for number, action, result in steps
    ]
    return data_table(rows, [0.55, 2.55, 3.75], header_color=CYAN_DARK)


def qr_code(url: str, size: float = 0.9 * inch) -> Drawing:
    qr = QrCodeWidget(url)
    x1, y1, x2, y2 = qr.getBounds()
    width = x2 - x1
    height = y2 - y1
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(qr)
    return drawing


def title_block(eyebrow: str, title: str, subtitle: str) -> list:
    return [
        Spacer(1, 7),
        p(eyebrow.upper(), "eyebrow"),
        p(title, "title"),
        p(subtitle, "subtitle"),
    ]


def build_sales_story() -> list:
    story: list = []

    # Page 1 - value and SEO
    story.extend(
        title_block(
            "Products, prices and proof",
            "CityBeat Sales Guide",
            "A short internal guide to what we sell, what the customer receives, and how to explain the value clearly.",
        )
    )
    story.append(
        callout(
            "The one-line pitch",
            "CityBeat gives local businesses a searchable public presence and targeted ways to reach readers, then sends customers back to the business through website, ticket, application, and campaign links.",
        )
    )
    story.extend(
        [
            Spacer(1, 7),
            p("WHY DIRECTORY LISTINGS CAN SUPPORT LOCAL SEO", "h1"),
            data_table(
                [
                    ["SIGNAL", "WHAT CITYBEAT ADDS", "WHY IT MATTERS"],
                    [
                        "Public profile",
                        "A crawlable CityBeat page with the business name, category, location, description, hours, photos, and reviews.",
                        "Complete, consistent information gives search engines another source for understanding the business.",
                    ],
                    [
                        "Website backlink",
                        "The public profile can link directly to the customer's website and social channels.",
                        "The link creates a third-party path for discovery and referral traffic. Links and directories can contribute to local prominence.",
                    ],
                    [
                        "Local relevance",
                        "Category and city context place the business beside relevant local content and directory searches.",
                        "It reinforces what the business does and where it serves customers.",
                    ],
                    [
                        "Fresh proof",
                        "Photos, reviews, offers, events, and complete business details make the profile useful to real people.",
                        "Useful, accurate information improves trust and can increase clicks even when ranking does not change.",
                    ],
                ],
                [1.15, 2.85, 2.85],
                small=True,
                header_color=CYAN_DARK,
            ),
            Spacer(1, 7),
            callout(
                "Say this",
                '"A CityBeat listing gives your business another complete local profile and a direct link back to your website. That can support local relevance, prominence, and referral traffic, but no ethical publisher can guarantee a search ranking."',
                GOLD,
                PALE_GOLD,
            ),
            Spacer(1, 6),
            p(
                f"<b>SEO source:</b> Google says local results are mainly based on relevance, distance, and prominence; complete information and websites linking to a business can help. <link href='{SEO_SOURCE_URL}' color='{CYAN_DARK.hexval()}'>Google Business Profile guidance</link>.",
                "small",
            ),
            Spacer(1, 6),
            p("BILLING KEY", "h2"),
            data_table(
                [
                    ["RECURRING", "ONE-TIME"],
                    [
                        "Basic Free has no card or charge. Paid Directory plans, Newsletter Sponsorship, and Category Banner renew through Stripe until canceled.",
                        "Sponsored Story, Featured Event, 30-Day Job Posting, and approved custom quote. One charge; no automatic renewal.",
                    ],
                ],
                [3.43, 3.42],
            ),
            PageBreak(),
        ]
    )

    # Page 2 - directory
    story.extend(
        title_block(
            "Directory products",
            "Sell the business presence first",
            "Every business can start with a public claimable page. Paid plans add richer tools and visibility; Founding is limited to the first 100 paid claimers.",
        )
    )
    directory_rows = [
        ["PRODUCT", "PRICE", "CUSTOMER GETS", "BEST FIT"],
        [
            "Basic Free",
            "<b>$0</b><br/>No card",
            "A public, claimable CityBeat listing with no payment link or recurring charge.",
            "Business that needs a credible starting presence now and may upgrade later.",
        ],
        [
            "Founding Annual",
            "<b>$99 / yr</b><br/>$8.25/mo effective",
            "All Premium features at the lowest published rate, locked while the subscription stays active.",
            "Owner ready to commit for a year; best value if a Founding spot remains.",
        ],
        [
            "Founding Monthly",
            "<b>$9.99 / mo</b>",
            "All Premium features with the Founding launch rate locked while active.",
            "Owner who wants the lowest monthly entry and a Founding spot remains.",
        ],
        [
            "Premium Annual",
            "<b>$199 / yr</b><br/>$16.58/mo effective",
            "Photos, cover image, description, website/social links, hours, priority placement, leads, deals, and owner tools.",
            "Stable business that wants Premium and two months of value versus monthly billing.",
        ],
        [
            "Premium Monthly",
            "<b>$19.99 / mo</b>",
            "The full Premium business profile and owner growth tools with flexible monthly billing.",
            "Most businesses starting paid local visibility without a yearly commitment.",
        ],
        [
            "Featured Monthly",
            "<b>$49 / mo</b>",
            "Everything in Premium plus top-of-category placement, Featured badge, and homepage rotation.",
            "Business that needs to stand out immediately in a competitive category.",
        ],
    ]
    story.append(data_table(directory_rows, [1.15, 1.0, 3.05, 1.65], small=True))
    story.extend(
        [
            Spacer(1, 8),
            callout(
                "Founding 100 rule",
                "Never promise availability. Select Founding in the Sales Desk and let checkout confirm the cap. The locked rate lasts only while that subscription remains active.",
                MAGENTA,
                PALE_MAGENTA,
            ),
            Spacer(1, 7),
            p("REFERRAL PROMOTION", "h1"),
            callout(
                "A paid listing can earn automatic discounts",
                "Each paid listing receives a personalized referral link. When a referred customer remains paid and active for three calendar months, the referrer earns three discount months at 25% off. Maximum: 16 qualified referrals per listing per calendar year. Annual plans receive the equivalent value on renewal.",
                GOLD,
                PALE_GOLD,
            ),
            Spacer(1, 7),
            p("FAST RECOMMENDATION", "h2"),
            data_table(
                [
                    ["CUSTOMER SAYS", "RECOMMEND"],
                    ["\"I want the best long-term value.\"", "Founding Annual if available; otherwise Premium Annual."],
                    ["\"I need flexibility.\"", "Premium Monthly; Founding Monthly only if available."],
                    ["\"I need to be seen first.\"", "Featured Monthly."],
                    ["\"I only want the free listing.\"", "Basic remains free; explain what Premium adds without pressure."],
                ],
                [2.5, 4.35],
            ),
            Spacer(1, 7),
            p(
                "<b>Do not say:</b> \"This guarantees first place on Google,\" \"you will receive a certain number of leads,\" or \"Founding will always be available.\"",
                "small",
            ),
            PageBreak(),
        ]
    )

    # Page 3 - add-ons
    story.extend(
        title_block(
            "Advertising, events and jobs",
            "Match the product to the immediate goal",
            "These products create targeted visibility, referral traffic, or a complete public opportunity page. Use the exact price and billing term below.",
        )
    )
    other_rows = [
        ["PRODUCT", "PRICE", "CUSTOMER GETS", "WHY IT HELPS"],
        [
            "Newsletter Sponsorship",
            "<b>$50 / mo</b><br/>Recurring",
            "Recurring sponsor placement in CityBeat email newsletters.",
            "Repeated exposure in a high-attention inbox. Best for brand familiarity, not a direct SEO promise.",
        ],
        [
            "Sponsored Story",
            "<b>$30 once</b>",
            "One sponsored editorial-style story prepared from the customer brief and reviewed before publication.",
            "More room to explain an opening, mission, product, or offer; published content can send readers to the approved destination.",
        ],
        [
            "Category Banner",
            "<b>$25 / mo</b><br/>Recurring",
            "Recurring banner placement beside a relevant CityBeat category.",
            "Reaches readers while they are already exploring the subject; paid links are treated as advertising.",
        ],
        [
            "Featured Event",
            "<b>$25 once</b>",
            "One enhanced event listing with featured placement after staff review.",
            "Adds urgency, discovery, ticket information, and an event destination link.",
        ],
        [
            "30-Day Job Posting",
            "<b>$50 once</b>",
            "One complete local job listing published for 30 days after staff review.",
            "Reaches local candidates with pay, benefits, qualifications, and a direct application path.",
        ],
        [
            "Custom One-Time Quote",
            "<b>Approved amount</b>",
            "A manager-approved CityBeat product with exact deliverables written into the order.",
            "Keeps a negotiated package inside the same secure payment and fulfillment workflow.",
        ],
    ]
    story.append(data_table(other_rows, [1.25, 0.95, 2.65, 2.0], small=True))
    story.extend(
        [
            Spacer(1, 8),
            p("GOAL TO PRODUCT", "h1"),
            data_table(
                [
                    ["GOAL", "BEST START"],
                    ["Build an ongoing local presence and website pathway", "Paid Directory"],
                    ["Own the top position in a directory category", "Featured Directory"],
                    ["Stay visible in readers' inboxes", "Newsletter Sponsorship"],
                    ["Explain a story, launch, mission, or offer", "Sponsored Story"],
                    ["Reach category-specific readers repeatedly", "Category Banner"],
                    ["Increase event discovery and ticket clicks", "Featured Event"],
                    ["Hire local candidates", "30-Day Job Posting"],
                    ["Sell a negotiated package", "Manager-approved Custom Quote"],
                ],
                [3.7, 3.15],
                small=True,
                header_color=CYAN_DARK,
            ),
            Spacer(1, 7),
            callout(
                "Paid links and SEO",
                "Advertising links can drive qualified referral traffic, but paid placements should not be sold as an organic ranking shortcut. Lead with audience fit, visibility, and a clear destination.",
                MAGENTA,
                PALE_MAGENTA,
            ),
            PageBreak(),
        ]
    )

    # Page 4 - close
    story.extend(
        title_block(
            "Simple sales conversation",
            "Ask. Match. Explain. Close.",
            "Short language is easier to understand and harder to misstate.",
        )
    )
    story.append(
        step_table(
            [
                ("1", "Ask the goal", "\"Do you need ongoing visibility, a campaign, event attendance, or local applicants?\""),
                ("2", "Match one product", "Recommend the smallest product that directly addresses the goal."),
                ("3", "State the exact offer", "Say the product, deliverable, price, and whether it renews."),
                ("4", "Explain the next step", "Free creates a claimable listing with no card. Paid products use Stripe, then the product brief."),
                ("5", "Create the handoffs", "Free shows the Listing link only. A paid new listing shows separate Payment and Listing links."),
                ("6", "Confirm the handoff", "Send the correct links; check paid order, brief, and fulfillment status in the Sales Desk."),
            ]
        )
    )
    story.extend(
        [
            Spacer(1, 8),
            p("CLOSE LANGUAGE", "h1"),
            callout(
                "Recommended",
                '"Based on your goal, I recommend [product] for [exact price and term]. Basic Free needs no card; I create the listing and send its claim link. Paid products use a private Stripe link, followed by the fulfillment brief."',
            ),
            Spacer(1, 7),
            p("TRUTH CHECK", "h1"),
            data_table(
                [
                    ["SAY", "NEVER PROMISE"],
                    [
                        "Crawlable profile, website link, local relevance, targeted visibility, referral traffic, clear deliverables, and reporting.",
                        "A specific Google rank, guaranteed leads or sales, unapproved discounts, instant publication, refunds, or Founding availability.",
                    ],
                ],
                [3.43, 3.42],
                header_color=GOLD,
            ),
            Spacer(1, 8),
            callout(
                "Payment safety",
                "Never collect or type a customer's card number. Stripe hosts checkout. Subscriptions save the payment method and renew automatically until canceled; one-time products do not renew.",
                MAGENTA,
                PALE_MAGENTA,
            ),
            Spacer(1, 8),
            p(
                f"<b>Start a sale:</b> <link href='{SALES_DESK_URL}' color='{CYAN_DARK.hexval()}'>{SALES_DESK_URL}</link>",
                "body",
            ),
            p(
                "Use the live Sales Desk as the final authority for availability, price, billing cadence, order status, discounts, and commission.",
                "small",
            ),
        ]
    )
    return story


def build_quick_start_story() -> list:
    story: list = []

    # Page 1 - exact click path
    story.extend(
        title_block(
            "Click-by-click desk reference",
            "New Sale Quick Start",
            "Use this sheet after signing in. Free listings skip Stripe; paid customers enter their own card.",
        )
    )
    start_table = Table(
        [
            [
                p(
                    f"<b>OPEN NEW SALE</b><br/><link href='{SALES_DESK_URL}' color='{CYAN_DARK.hexval()}'>{SALES_DESK_URL}</link><br/><br/>Developer Control: click the bright <b>+ NEW SALE</b> button.<br/>Sales account: click <b>DASHBOARD</b>, then use the <b>New sale</b> form.",
                    "body_tight",
                ),
                qr_code(SALES_DESK_URL, 0.95 * inch),
            ]
        ],
        colWidths=[CONTENT_WIDTH - 1.2 * inch, 1.2 * inch],
    )
    start_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_CYAN),
                ("BOX", (0, 0), (-1, -1), 0.7, CYAN),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend(
        [
            start_table,
            Spacer(1, 8),
            step_table(
                [
                    ("1", "Select Product", "For a new directory business choose Basic Free, Founders $9.99/mo, or Premium $19.99/mo."),
                    ("2", "Set up the listing", "Choose an existing listing or New business. Select a category or type a correct new category."),
                    ("3", "Enter the essentials", "Business name and client email are required. Phone is optional but needed for Text."),
                    ("4", "Review the product card", "Confirm the customer benefit and whether the choice is Free, recurring, or one-time."),
                    ("5", "Click Create", "Basic Free publishes the listing without Stripe. Paid products create the secure checkout."),
                    ("6", "Check both handoffs", "Free shows only Listing ready to claim. A paid new listing shows Payment plus Listing."),
                ]
            ),
            Spacer(1, 8),
            p("HAND OFF THE RIGHT LINK", "h1"),
            data_table(
                [
                    ["HANDOFF", "WHEN IT APPEARS", "WHAT THE CUSTOMER DOES"],
                    ["Payment", "Every paid product.", "Pays on Stripe. Use Open, QR, Email, Text, or Copy."],
                    ["Listing", "Every newly added directory business.", "Opens the public page and selects Claim. Use Open, QR, Email, Text, or Copy."],
                    ["Free listing", "Basic Free ($0).", "Only the Listing handoff appears. There is no payment link or payment QR."],
                    ["Paid new listing", "Founders or Premium.", "Both Payment and Listing handoffs appear. Send both links."],
                ],
                [1.05, 2.1, 3.7],
                small=True,
                header_color=CYAN_DARK,
            ),
            Spacer(1, 7),
            callout(
                "Use the correct card",
                "Payment pays for the product. Listing opens the business page for claiming. Claiming never creates a second Sales Desk charge.",
                GOLD,
                PALE_GOLD,
            ),
            PageBreak(),
        ]
    )

    # Page 2 - after payment
    story.extend(
        title_block(
            "What happens after the handoff",
            "Paid orders continue; new listings get claimed",
            "Stripe opens the paid-product brief. The separate public listing link lets the business owner verify and claim the page.",
        )
    )
    story.append(
        step_table(
            [
                ("7", "Free skips Stripe", "The Basic listing is already public. Send its listing link so the customer can claim it."),
                ("8", "Paid customer completes Stripe", "They enter their own card. Recurring products save it securely and renew automatically."),
                ("9", "Customer claims the listing", "From the public listing link, they select Claim and verify the business email."),
                ("10", "Paid customer finishes the brief", "Stripe returns them to the private product wizard for fulfillment details."),
                ("11", "Check Recent orders", "For paid sales, confirm Payment, Billing, Brief, Fulfillment, Discount, and Commission."),
                ("12", "Click Start next sale", "Clear the previous customer and begin with a new order."),
            ]
        )
    )
    story.extend(
        [
            Spacer(1, 8),
            p("WHAT EACH PAID CUSTOMER BRIEF COLLECTS", "h1"),
            data_table(
                [
                    ["PRODUCT", "MAIN INFORMATION REQUIRED"],
                    ["Directory", "Category, description, address, hours, website, social links, logo, cover, and gallery."],
                    ["Job", "Title, category, employment/workplace type, location, pay, benefits, description, qualifications, and application details."],
                    ["Event", "Dates, time zone, format, venue, ticket link, price, accessibility, organizer, description, and artwork."],
                    ["Advertising", "Objective, dates, destination link, copy, call to action, logo/artwork, sources, and approval contact."],
                    ["Custom", "Manager-approved deliverable, goal, timing, destination, assets, and approval contact."],
                ],
                [1.25, 5.6],
                small=True,
            ),
            Spacer(1, 8),
            p("FINAL CHECK", "h1"),
            data_table(
                [
                    ["BEFORE", "PAYMENT", "AFTER"],
                    [
                        "[ ] Right customer<br/>[ ] Right product<br/>[ ] Exact price/term<br/>[ ] Consent to email/text",
                        "[ ] Free has no Stripe link<br/>[ ] Paid Stripe page matches<br/>[ ] Customer enters own card",
                        "[ ] Listing link sent<br/>[ ] Claim explained<br/>[ ] Paid brief explained<br/>[ ] Start next sale",
                    ],
                ],
                [2.28, 2.28, 2.29],
                header_color=GOLD,
            ),
            Spacer(1, 8),
            callout(
                "Stop and correct",
                "Pause if the product, price, term, customer, availability, or deliverable is unclear. Confirm with management, then create a fresh handoff. Accuracy prevents refunds and protects trust.",
                MAGENTA,
                PALE_MAGENTA,
            ),
            Spacer(1, 8),
            p(
                "Customer card data stays with Stripe. CityBeat staff should never request, record, photograph, or type a card number.",
                "center_small",
            ),
        ]
    )
    return story


def build_pdf(path: Path, story: list, title: str, subject: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=TOP,
        bottomMargin=BOTTOM,
        title=title,
        author="CityBeat Mag",
        subject=subject,
        pageCompression=1,
    )
    doc.build(story, onFirstPage=brand_header, onLaterPages=brand_header)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def assert_catalog_source() -> None:
    source = PRODUCT_SOURCE.read_text(encoding="utf-8") + PRICING_SOURCE.read_text(encoding="utf-8")
    required_source_values = [
        "directory_basic_free",
        "$99 / yr",
        "$9.99 / mo",
        "$199 / yr",
        "$19.99 / mo",
        "$49 / mo",
        "$50 / mo",
        "$30 once",
        "$25 / mo",
        "$25 once",
        "$50 once",
        "Custom amount",
    ]
    missing = [value for value in required_source_values if value not in source]
    if missing:
        raise SystemExit(f"Canonical product catalog changed; update the sales PDFs: {missing}")


def verify_pdf(
    path: Path,
    public_copy: Path,
    *,
    expected_pages: int,
    required_text: list[str],
    minimum_links: int,
) -> None:
    if not path.exists() or path.stat().st_size < 8_000:
        raise SystemExit(f"PDF missing or unexpectedly small: {path}")
    reader = PdfReader(str(path))
    if len(reader.pages) != expected_pages:
        raise SystemExit(f"Expected {expected_pages} pages in {path.name}, found {len(reader.pages)}")
    normalized = " ".join(
        " ".join((page.extract_text() or "").split()) for page in reader.pages
    ).lower()
    missing = [value for value in required_text if " ".join(value.split()).lower() not in normalized]
    if missing:
        raise SystemExit(f"Missing required text in {path.name}: {missing}")

    links = 0
    for page in reader.pages:
        for annotation in page.get("/Annots", []):
            obj = annotation.get_object()
            action = obj.get("/A")
            if action and action.get("/URI"):
                links += 1
    if links < minimum_links:
        raise SystemExit(f"Expected at least {minimum_links} links in {path.name}, found {links}")
    if not public_copy.exists() or sha256(path) != sha256(public_copy):
        raise SystemExit(f"Canonical and public copies differ for {path.name}")
    print(
        f"Verified {path}: pages={len(reader.pages)}, links={links}, "
        f"bytes={path.stat().st_size}, sha256={sha256(path)}"
    )


def publish() -> None:
    build_pdf(
        SALES_GUIDE,
        build_sales_story(),
        "CityBeat Sales Guide",
        "Products, prices, customer value, and accurate SEO/backlink language",
    )
    build_pdf(
        QUICK_START,
        build_quick_start_story(),
        "CityBeat New Sale Quick Start",
        "Click-by-click Sales Desk payment and fulfillment instructions",
    )
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SALES_GUIDE, SALES_GUIDE_PUBLIC)
    shutil.copyfile(QUICK_START, QUICK_START_PUBLIC)
    print(f"Generated {SALES_GUIDE}")
    print(f"Generated {QUICK_START}")
    print(f"Published {SALES_GUIDE_PUBLIC}")
    print(f"Published {QUICK_START_PUBLIC}")


def verify_all() -> None:
    assert_catalog_source()
    verify_pdf(
        SALES_GUIDE,
        SALES_GUIDE_PUBLIC,
        expected_pages=4,
        required_text=[
            "CityBeat Sales Guide",
            "Website backlink",
            "no ethical publisher can guarantee a search ranking",
            "Founding Annual",
            "$19.99 / mo",
            "Newsletter Sponsorship",
            "Sponsored Story",
            "Featured Event",
            "30-Day Job Posting",
            "Referral Promotion",
            "16 qualified referrals",
        ],
        minimum_links=2,
    )
    verify_pdf(
        QUICK_START,
        QUICK_START_PUBLIC,
        expected_pages=2,
        required_text=[
            "New Sale Quick Start",
            "+ NEW SALE",
            "Basic Free",
            "HAND OFF THE RIGHT LINK",
            "Listing ready to claim",
            "Text",
            "Paid orders continue",
            "Start next sale",
        ],
        minimum_links=1,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate concise CityBeat sales print materials")
    parser.add_argument("--verify", action="store_true", help="generate and verify both PDFs")
    parser.add_argument("--verify-only", action="store_true", help="verify existing PDFs")
    args = parser.parse_args()
    if not args.verify_only:
        publish()
    if args.verify or args.verify_only:
        verify_all()


if __name__ == "__main__":
    main()
