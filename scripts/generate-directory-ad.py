"""Customer-facing print ad for the CityBeat Directory Premium plan.

WHY THIS IS SEPARATE from generate-sales-guide.py: that script builds INTERNAL
material ("a short internal guide to what we sell"). This one is handed to a
business owner, so it carries different obligations — every feature named here
must be one the entitlement registry actually grants a `premium` listing, and
the page may not imply a search ranking we cannot deliver.

The palette, page geometry and QR helper are imported from the sales-guide
script rather than copied, so the two print artifacts cannot drift into looking
like they came from different companies. Those colours are deliberately
darker than the on-screen brand tokens (#06B6D4 cyan, #D946EF magenta,
#EAB308 gold) because the screen values wash out in CMYK.

Feature copy is lifted verbatim from ENTITLEMENT_COPY in
apps/web/src/lib/directory-entitlements.ts — including the Spanish, which is
reviewed product copy rather than a translation made for this page. El Paso
County is roughly 90% Spanish-speaking, so page 2 is not an afterthought.

`--verify` greps the real entitlement and pricing sources for every number and
claim printed here. Change the media limit, a manager seat count or a price in
the code and this gate fails instead of the ad quietly becoming false.

Usage:
    python scripts/generate-directory-ad.py            # build + publish
    python scripts/generate-directory-ad.py --verify    # build, then check
    python scripts/generate-directory-ad.py --verify-only
"""

from __future__ import annotations

import argparse
import importlib.util
import shutil
from pathlib import Path

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
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


def _load_brand():
    """Import the sales-guide module for its print palette and helpers.

    The filename has dashes, so it is not importable by name. Its module level
    is constants and function definitions only — `main()` is guarded — so this
    is safe and keeps ONE definition of the print brand.
    """
    path = ROOT / "scripts" / "generate-sales-guide.py"
    spec = importlib.util.spec_from_file_location("citybeat_sales_guide", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Cannot load the shared print brand from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BRAND = _load_brand()

DARK, INK, MUTED = BRAND.DARK, BRAND.INK, BRAND.MUTED
CYAN, CYAN_DARK, PALE_CYAN = BRAND.CYAN, BRAND.CYAN_DARK, BRAND.PALE_CYAN
MAGENTA, PALE_MAGENTA = BRAND.MAGENTA, BRAND.PALE_MAGENTA
GOLD, PALE_GOLD = BRAND.GOLD, BRAND.PALE_GOLD
LINE, LIGHT, WHITE = BRAND.LINE, BRAND.LIGHT, BRAND.WHITE

PAGE_WIDTH, PAGE_HEIGHT = BRAND.PAGE_WIDTH, BRAND.PAGE_HEIGHT
LEFT, RIGHT = BRAND.LEFT, BRAND.RIGHT
TOP, BOTTOM = BRAND.TOP, BRAND.BOTTOM
CONTENT_WIDTH = BRAND.CONTENT_WIDTH

OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "apps" / "web" / "public" / "downloads"
AD = OUTPUT_DIR / "citybeat-premium-ad.pdf"
AD_PUBLIC = PUBLIC_DIR / "citybeat-premium-ad.pdf"

ENTITLEMENTS_SOURCE = ROOT / "apps" / "web" / "src" / "lib" / "directory-entitlements.ts"
PRICING_SOURCE = ROOT / "apps" / "web" / "src" / "lib" / "pricing.ts"

CTA_EN = "citybeatmag.co/en/premium"
CTA_ES = "citybeatmag.co/es/premium"
CTA_EN_URL = f"https://{CTA_EN}"
CTA_ES_URL = f"https://{CTA_ES}"


# --- Content -----------------------------------------------------------------
#
# Every row below maps to one `true` entitlement in the PREMIUM set, and its
# text is the ENTITLEMENT_COPY benefit for that entitlement. Nothing here is
# invented, and nothing Featured-only is listed as a Premium feature.

PREMIUM_FEATURES = {
    "en": [
        (
            "Your profile",
            [
                ("Detailed bilingual profile", "Tell your full story in English and Spanish to reach every El Paso customer."),
                ("Full photo gallery", "Show up to 15 photos instead of one so customers see the real you."),
                ("Video", "Add a video tour or promo to stand out in search results."),
                ("Social links", "Send visitors straight to your Facebook, Instagram, and more."),
                ("Services & products", "List what you offer with prices so customers arrive ready to buy."),
                ("Booking & action links", "Add “Book”, “Order”, or “Quote” buttons to your listing."),
            ],
        ),
        (
            "Getting found, and getting chosen",
            [
                ("A larger card, placed first", "Your listing is shown ahead of every free Basic listing in your category."),
                ("A direct link to your website", "Your profile sends visitors straight to your own site."),
                ("Posts, offers & events", "Publish deals and events that surface across CityBeat."),
            ],
        ),
        (
            "Knowing what it is doing for you",
            [
                ("Full lead inbox", "See every customer inquiry with full contact details, not just totals."),
                ("Full analytics", "See full history, comparisons, and exportable performance reports."),
                ("Export reports", "Download your performance data as CSV for your own records."),
            ],
        ),
        (
            "Help running it",
            [
                ("AI assistance", "Let CityBeat draft replies, posts, and captions for you."),
                ("Team access", "Invite up to 3 staff to help manage your listing."),
            ],
        ),
    ],
    "es": [
        (
            "Tu perfil",
            [
                ("Perfil bilingüe detallado", "Cuenta tu historia completa en inglés y español para llegar a todo El Paso."),
                ("Galería de fotos completa", "Muestra hasta 15 fotos en vez de una para que te conozcan de verdad."),
                ("Video", "Agrega un video o promoción para destacar en los resultados."),
                ("Redes sociales", "Envía a los visitantes directo a tu Facebook, Instagram y más."),
                ("Servicios y productos", "Publica lo que ofreces con precios para que lleguen listos para comprar."),
                ("Enlaces de reserva y acción", "Agrega botones de “Reservar”, “Pedir” o “Cotizar” a tu ficha."),
            ],
        ),
        (
            "Que te encuentren y te elijan",
            [
                ("Una tarjeta más grande, primero", "Tu ficha aparece antes que todas las fichas Básicas gratuitas de tu categoría."),
                ("Un enlace directo a tu sitio web", "Tu perfil envía visitantes directo a tu propio sitio."),
                ("Publicaciones, ofertas y eventos", "Publica ofertas y eventos que aparecen en todo CityBeat."),
            ],
        ),
        (
            "Saber qué está funcionando",
            [
                ("Bandeja de clientes completa", "Ve cada solicitud con datos de contacto completos, no solo totales."),
                ("Analíticas completas", "Ve historial completo, comparaciones e informes exportables."),
                ("Exportar informes", "Descarga tus datos de rendimiento en CSV para tus registros."),
            ],
        ),
        (
            "Ayuda para administrarla",
            [
                ("Asistencia con IA", "Deja que CityBeat redacte respuestas, publicaciones y textos por ti."),
                ("Acceso de equipo", "Invita hasta 3 personas de tu personal a administrar tu ficha."),
            ],
        ),
    ],
}

COPY = {
    "en": {
        "eyebrow": "CityBeat Directory  ·  El Paso County",
        "title": "Everything your business gets with Premium",
        "subtitle": (
            "One complete, bilingual profile in El Paso's local magazine — and the owner tools "
            "to keep it earning its place."
        ),
        "price_heading": "Choose how you pay",
        "prices": [
            ("Premium Monthly", "$19.99 / mo", "No commitment. Cancel any time."),
            ("Premium Annual", "$199 / yr", "Works out to $16.58/mo — two months free."),
        ],
        "founding_label": "Founding",
        "founding_price": "$9.99 / mo  or  $99 / yr",
        "founding_note": (
            "Limited to the first 100 paid businesses, subject to availability at checkout. "
            "All Premium features included. Your Founding rate stays locked while the "
            "subscription remains active."
        ),
        "free_heading": "Already free with any claimed listing",
        "free_body": (
            "Business name, phone, website, category and address · standard and holiday hours · "
            "service areas and extra categories · a short description · one photo · replies to your "
            "reviews · rolling 30-day headline numbers. Claiming is free and there is no card."
        ),
        "more_heading": "If you need to be impossible to miss",
        "more_rows": [
            (
                "Featured — $49 / mo",
                "Everything in Premium, plus top-of-category placement, a Featured badge, homepage "
                "rotation, competitor benchmarks, up to 30 photos, 10 team seats, and multi-location tools.",
            ),
            (
                "Sponsored — $99 / mo",
                "Everything in Premium, plus a rotating spot in the Sponsored Listings grid at the very "
                "top of the directory. Only three show at a time, rotated among all sponsors.",
            ),
        ],
        "honest_heading": "What a listing can and cannot do",
        "honest_body": (
            "A CityBeat listing gives your business another complete local profile and a direct link "
            "back to your website. That can support local relevance, prominence, and referral traffic, "
            "but no ethical publisher can guarantee a search ranking."
        ),
        "cta_heading": "Claim your business",
        "cta_body": "Search for your business, claim it, and choose a plan. Ownership verification is required.",
        "cta_url": CTA_EN,
        "footer": "CityBeat · citybeatmag.co · Local news and the business directory for El Paso County",
        "lang_note": "Esta página también está en español — ver la siguiente página.",
    },
    "es": {
        "eyebrow": "Directorio CityBeat  ·  Condado de El Paso",
        "title": "Todo lo que recibe tu negocio con Premium",
        "subtitle": (
            "Un perfil completo y bilingüe en la revista local de El Paso — y las herramientas "
            "para que siga valiendo la pena."
        ),
        "price_heading": "Elige cómo pagar",
        "prices": [
            ("Premium Mensual", "$19.99 / mes", "Sin compromiso. Cancela cuando quieras."),
            ("Premium Anual", "$199 / año", "Equivale a $16.58/mes — dos meses gratis."),
        ],
        "founding_label": "Fundadores",
        "founding_price": "$9.99 / mes  o  $99 / año",
        "founding_note": (
            "Limitado a los primeros 100 negocios de paga, sujeto a disponibilidad al momento del pago. "
            "Incluye todas las funciones Premium. Tu precio de Fundador queda fijo mientras la "
            "suscripción siga activa."
        ),
        "free_heading": "Ya es gratis con cualquier ficha reclamada",
        "free_body": (
            "Nombre, teléfono, sitio web, categoría y dirección · horario normal y de días festivos · "
            "zonas de servicio y categorías adicionales · una descripción breve · una foto · respuestas "
            "a tus reseñas · números principales de los últimos 30 días. Reclamar es gratis y sin tarjeta."
        ),
        "more_heading": "Si necesitas que no te puedan pasar por alto",
        "more_rows": [
            (
                "Destacado — $49 / mes",
                "Todo lo de Premium, más el primer lugar de tu categoría, una insignia de Destacado, "
                "rotación en la página principal, comparativas de competencia, hasta 30 fotos, 10 lugares "
                "de equipo y herramientas para varias ubicaciones.",
            ),
            (
                "Patrocinado — $99 / mes",
                "Todo lo de Premium, más un lugar rotativo en la cuadrícula de Fichas Patrocinadas, "
                "arriba de todo el directorio. Solo se muestran tres a la vez, rotando entre todos los "
                "patrocinadores.",
            ),
        ],
        "honest_heading": "Lo que una ficha sí puede y no puede hacer",
        "honest_body": (
            "Una ficha de CityBeat le da a tu negocio otro perfil local completo y un enlace directo a "
            "tu sitio web. Eso puede apoyar la relevancia local, la prominencia y el tráfico de "
            "referencia, pero ningún medio ético puede garantizar una posición en los buscadores."
        ),
        "cta_heading": "Reclama tu negocio",
        "cta_body": "Busca tu negocio, reclámalo y elige un plan. Se requiere verificación de propiedad.",
        "cta_url": CTA_ES,
        "footer": "CityBeat · citybeatmag.co · Noticias locales y el directorio de negocios del Condado de El Paso",
        "lang_note": "This page is also available in English — see the previous page.",
    },
}


# --- Styles ------------------------------------------------------------------


def ad_styles():
    base = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "AdEyebrow",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            textColor=CYAN_DARK,
            spaceAfter=4,
        ),
        "title": ParagraphStyle(
            "AdTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=26,
            textColor=DARK,
            spaceAfter=5,
        ),
        "subtitle": ParagraphStyle(
            "AdSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=13.4,
            textColor=MUTED,
            spaceAfter=7,
        ),
        "section": ParagraphStyle(
            "AdSection",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.8,
            leading=10.4,
            textColor=DARK,
            spaceBefore=1,
            spaceAfter=2,
        ),
        "feature": ParagraphStyle(
            "AdFeature",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=10.9,
            textColor=INK,
        ),
        "small": ParagraphStyle(
            "AdSmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.9,
            leading=10,
            textColor=INK,
        ),
        "tiny": ParagraphStyle(
            "AdTiny",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=8.6,
            textColor=MUTED,
        ),
        "price_label": ParagraphStyle(
            "AdPriceLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=CYAN_DARK,
            alignment=TA_CENTER,
        ),
        "price": ParagraphStyle(
            "AdPrice",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=15.5,
            leading=17,
            textColor=DARK,
            alignment=TA_CENTER,
        ),
        "price_note": ParagraphStyle(
            "AdPriceNote",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.3,
            leading=9,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "cta_heading": ParagraphStyle(
            "AdCtaHeading",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=14,
            textColor=WHITE,
        ),
        "cta_body": ParagraphStyle(
            "AdCtaBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=11,
            textColor=HexWhiteish(),
        ),
        "cta_url": ParagraphStyle(
            "AdCtaUrl",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=13,
            textColor=CYAN,
        ),
    }


def HexWhiteish():
    # Slightly dimmed white so body text inside the dark CTA band does not
    # vibrate against the background at print resolution.
    return colors.Color(1, 1, 1, alpha=0.82)


# --- Page furniture ----------------------------------------------------------


def ad_header(canvas, doc) -> None:
    """A thin brand rule at the top and a hairline footer. Kept lighter than the
    sales-guide header: this page's own hero has to carry the eye, not a band."""
    canvas.saveState()
    canvas.setFillColor(DARK)
    canvas.rect(0, PAGE_HEIGHT - 0.3 * inch, PAGE_WIDTH, 0.3 * inch, stroke=0, fill=1)
    canvas.setFillColor(CYAN)
    canvas.rect(0, PAGE_HEIGHT - 0.34 * inch, PAGE_WIDTH, 0.04 * inch, stroke=0, fill=1)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(WHITE)
    canvas.drawString(LEFT, PAGE_HEIGHT - 0.21 * inch, "CITYBEAT")
    canvas.setFont("Helvetica", 7.4)
    canvas.drawRightString(PAGE_WIDTH - RIGHT, PAGE_HEIGHT - 0.21 * inch, "citybeatmag.co")

    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(LEFT, BOTTOM - 0.12 * inch, PAGE_WIDTH - RIGHT, BOTTOM - 0.12 * inch)
    canvas.restoreState()


def price_strip(locale: str, st) -> Table:
    text = COPY[locale]
    cells = []
    for label, price, note in text["prices"]:
        cells.append(
            [
                Paragraph(label.upper(), st["price_label"]),
                Paragraph(price, st["price"]),
                Paragraph(note, st["price_note"]),
            ]
        )
    # The two standard prices sit side by side; Founding gets its own, visually
    # quieter cell because it is conditional and must never read as a promise.
    founding = [
        Paragraph(text["founding_label"].upper(), st["price_label"]),
        Paragraph(text["founding_price"], st["price"]),
        Paragraph(text["founding_note"], st["price_note"]),
    ]

    inner = []
    for cell in cells:
        t = Table([[c] for c in cell], colWidths=[2.3 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), PALE_CYAN),
                    ("BOX", (0, 0), (-1, -1), 0.8, CYAN),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        inner.append(t)

    ft = Table([[c] for c in founding], colWidths=[2.65 * inch])
    ft.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_GOLD),
                ("BOX", (0, 0), (-1, -1), 0.8, GOLD),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    outer = Table(
        [[inner[0], inner[1], ft]],
        colWidths=[2.42 * inch, 2.42 * inch, 2.76 * inch],
    )
    outer.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 6),
                ("RIGHTPADDING", (1, 0), (1, -1), 6),
                ("RIGHTPADDING", (2, 0), (2, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return outer


def feature_columns(locale: str, st) -> Table:
    """The feature list, in two columns, grouped by what the owner is trying to do.

    Grouping is not decoration: an undifferentiated list of fourteen ticks reads
    as filler, while four named jobs let an owner find the one they came for.
    """
    groups = PREMIUM_FEATURES[locale]
    left_groups = groups[:1]
    right_groups = groups[1:]

    def column(group_list):
        flow = []
        for heading, rows in group_list:
            flow.append(Paragraph(heading.upper(), st["section"]))
            for label, benefit in rows:
                flow.append(
                    Paragraph(
                        f'<font color="{CYAN_DARK.hexval()}"><b>✓</b></font> '
                        f"<b>{label}.</b> {benefit}",
                        st["feature"],
                    )
                )
                flow.append(Spacer(1, 2.2))
            flow.append(Spacer(1, 2))
        return flow

    table = Table(
        [[column(left_groups), column(right_groups)]],
        colWidths=[CONTENT_WIDTH / 2 - 6, CONTENT_WIDTH / 2 - 6],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 12),
                ("LEFTPADDING", (1, 0), (1, -1), 12),
                ("RIGHTPADDING", (1, 0), (1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LINEBEFORE", (1, 0), (1, -1), 0.5, LINE),
            ]
        )
    )
    return table


def tier_upsell(locale: str, st) -> Table:
    text = COPY[locale]
    body = [Paragraph(text["more_heading"].upper(), st["section"])]
    for label, detail in text["more_rows"]:
        body.append(Paragraph(f"<b>{label}.</b> {detail}", st["small"]))
        body.append(Spacer(1, 2))
    table = Table([[body]], colWidths=[CONTENT_WIDTH])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def cta_band(locale: str, st) -> Table:
    text = COPY[locale]
    url = CTA_EN_URL if locale == "en" else CTA_ES_URL
    left = [
        Paragraph(text["cta_heading"], st["cta_heading"]),
        Spacer(1, 2),
        Paragraph(text["cta_body"], st["cta_body"]),
        Spacer(1, 4),
        Paragraph(f'<link href="{url}">{text["cta_url"]}</link>', st["cta_url"]),
    ]
    table = Table(
        [[left, BRAND.qr_code(url, 0.98 * inch)]],
        colWidths=[CONTENT_WIDTH - 1.3 * inch, 1.3 * inch],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), DARK),
                ("VALIGN", (0, 0), (0, -1), "MIDDLE"),
                ("VALIGN", (1, 0), (1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def note_box(heading: str, body: str, st, accent, fill) -> Table:
    table = Table(
        [[[Paragraph(heading.upper(), st["section"]), Paragraph(body, st["tiny"])]]],
        colWidths=[CONTENT_WIDTH],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("LINEBEFORE", (0, 0), (0, -1), 2, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def build_page(locale: str, st) -> list:
    text = COPY[locale]
    return [
        Paragraph(text["eyebrow"].upper(), st["eyebrow"]),
        Paragraph(text["title"], st["title"]),
        Paragraph(text["subtitle"], st["subtitle"]),
        price_strip(locale, st),
        Spacer(1, 11),
        feature_columns(locale, st),
        Spacer(1, 8),
        note_box(text["free_heading"], text["free_body"], st, CYAN, PALE_CYAN),
        Spacer(1, 6),
        tier_upsell(locale, st),
        Spacer(1, 6),
        note_box(text["honest_heading"], text["honest_body"], st, GOLD, PALE_GOLD),
        Spacer(1, 9),
        cta_band(locale, st),
        Spacer(1, 4),
        Paragraph(text["footer"], st["tiny"]),
        Paragraph(text["lang_note"], st["tiny"]),
    ]


def build_story() -> list:
    st = ad_styles()
    story = build_page("en", st)
    story.append(PageBreak())
    story.extend(build_page("es", st))
    return story


def build_pdf(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(path),
        pagesize=(PAGE_WIDTH, PAGE_HEIGHT),
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=TOP,
        bottomMargin=BOTTOM,
        title="CityBeat Directory — Premium",
        author="CityBeat",
        subject="Everything a business gets with a CityBeat Directory Premium listing",
    )
    doc.build(build_story(), onFirstPage=ad_header, onLaterPages=ad_header)


# --- Verification ------------------------------------------------------------


def assert_sources_match() -> None:
    """Fail if the ad claims something the code no longer grants.

    This is the whole reason the ad is generated rather than designed once in a
    layout tool: a price change or a lowered media limit must break the build,
    not quietly leave a false promise in circulation on paper we have printed.
    """
    entitlements = ENTITLEMENTS_SOURCE.read_text(encoding="utf-8")
    pricing = PRICING_SOURCE.read_text(encoding="utf-8")

    required_pricing = ["$19.99 / mo", "$199 / yr", "$9.99 / mo", "$99 / yr", "$49 / mo", "$99 / mo"]
    missing = [v for v in required_pricing if v not in pricing]

    # The PREMIUM entitlement block must still grant every capability the ad
    # lists, at the quantities it prints.
    premium_block = entitlements[entitlements.index("const PREMIUM:") : entitlements.index("const FEATURED:")]
    required_premium = [
        "enhancedDescription: true",
        "mediaLimit: 15",
        "video: true",
        "socialLinks: true",
        "servicesAndProducts: true",
        "postsOffersEvents: true",
        "fullAnalytics: true",
        "analyticsExport: true",
        "detailedLeads: true",
        "aiAssistance: true",
        "additionalManagers: 3",
        "bookingLinks: true",
    ]
    missing += [f"PREMIUM.{v}" for v in required_premium if v not in premium_block]

    # Premium must NOT be sold as having the Featured-only perks.
    for forbidden in ["priorityPlacement: true", "categoryBenchmarking: true", "multiLocation: true"]:
        if forbidden in premium_block:
            missing.append(f"PREMIUM unexpectedly grants {forbidden}; the ad understates the plan")

    featured_block = entitlements[entitlements.index("const FEATURED:") :]
    for value in ["mediaLimit: 30", "additionalManagers: 10", "priorityPlacement: true"]:
        if value not in featured_block:
            missing.append(f"FEATURED.{value}")

    # The benefit sentences are quoted verbatim from ENTITLEMENT_COPY; if that
    # copy is reworded the ad must be re-reviewed, not silently diverge.
    for sentence in [
        "Show up to 15 photos instead of one so customers see the real you.",
        "See every customer inquiry with full contact details, not just totals.",
        "Muestra hasta 15 fotos en vez de una para que te conozcan de verdad.",
    ]:
        if sentence not in entitlements:
            missing.append(f"ENTITLEMENT_COPY no longer contains: {sentence!r}")

    if missing:
        raise SystemExit("Ad is out of date with the product code; fix the ad: " + "; ".join(missing))


def verify_pdf() -> None:
    if not AD.exists() or AD.stat().st_size < 8_000:
        raise SystemExit(f"PDF missing or unexpectedly small: {AD}")
    reader = PdfReader(str(AD))
    if len(reader.pages) != 2:
        raise SystemExit(f"Expected 2 pages (EN + ES), found {len(reader.pages)}")

    pages = [" ".join((page.extract_text() or "").split()) for page in reader.pages]
    checks = {
        0: [
            "Everything your business gets with Premium",
            "$19.99 / mo",
            "$199 / yr",
            "Show up to 15 photos",
            "Invite up to 3 staff",
            "no ethical publisher can guarantee a search ranking",
            "subject to availability at checkout",
            "Featured — $49 / mo",
            "Sponsored — $99 / mo",
            CTA_EN,
        ],
        1: [
            "Todo lo que recibe tu negocio con Premium",
            "$19.99 / mes",
            "Muestra hasta 15 fotos",
            "ningún medio ético puede garantizar una posición",
            "sujeto a disponibilidad",
            CTA_ES,
        ],
    }
    for index, required in checks.items():
        text = pages[index].lower()
        missing = [v for v in required if " ".join(v.split()).lower() not in text]
        if missing:
            raise SystemExit(f"Missing required text on page {index + 1}: {missing}")

    # A printed page cannot be clicked, but the PDF is also emailed, so the CTA
    # must be a real link on both language pages.
    links = 0
    for page in reader.pages:
        for annotation in page.get("/Annots", []) or []:
            obj = annotation.get_object()
            action = obj.get("/A")
            if action and action.get("/URI"):
                links += 1
    if links < 2:
        raise SystemExit(f"Expected a live CTA link on each page, found {links}")

    if not AD_PUBLIC.exists() or BRAND.sha256(AD) != BRAND.sha256(AD_PUBLIC):
        raise SystemExit("Canonical and public copies of the ad differ")

    print(
        f"Verified {AD}: pages={len(reader.pages)}, links={links}, "
        f"bytes={AD.stat().st_size}, sha256={BRAND.sha256(AD)}"
    )


def publish() -> None:
    build_pdf(AD)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(AD, AD_PUBLIC)
    print(f"Generated {AD}")
    print(f"Published {AD_PUBLIC}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the CityBeat Premium directory print ad")
    parser.add_argument("--verify", action="store_true", help="generate, then verify")
    parser.add_argument("--verify-only", action="store_true", help="verify the existing PDF")
    args = parser.parse_args()
    if not args.verify_only:
        publish()
    if args.verify or args.verify_only:
        assert_sources_match()
        verify_pdf()


if __name__ == "__main__":
    main()
