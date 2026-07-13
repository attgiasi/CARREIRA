from __future__ import annotations

from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "resumes" / "CV-Giasi-Master-Premium.pdf"

INK = colors.HexColor("#17262D")
MUTED = colors.HexColor("#53666F")
TEAL = colors.HexColor("#0B7A75")
GOLD = colors.HexColor("#B36B00")
LINE = colors.HexColor("#C9D8D8")
WHITE = colors.white


EXPERIENCES = [
    {
        "company": "Grand Mercure Curitiba Rayon",
        "role": "Bartender Jr.",
        "period": "Curitiba/PR | 06/05/2025 a 04/12/2025",
        "bullets": [
            "Atendimento em hotelaria premium, com foco em hospitalidade, agilidade e padrão de apresentação.",
            "Preparo de coquetéis e insumos, abertura e fechamento de praça, reposição e integração com salão e cozinha.",
        ],
    },
    {
        "company": "ACO Bar e Restaurante",
        "role": "Barman",
        "period": "Curitiba/PR | 28/02/2025 a 10/03/2025",
        "bullets": [
            "Preparo de bebidas, mise en place, reposição e manutenção da estação de trabalho.",
            "Atendimento ao público com rapidez, cordialidade e adaptação imediata à operação.",
        ],
    },
    {
        "company": "Kirin Company",
        "role": "Bartender",
        "period": "Curitiba/PR | 13/11/2024 a 30/01/2025",
        "bullets": [
            "Operação de bar, preparo de coquetéis, organização de praça e atendimento ao cliente.",
            "Apoio à padronização, controle de insumos e melhoria prática do fluxo de serviço.",
        ],
    },
    {
        "company": "Concentrix",
        "role": "Agente de Teleatendimento",
        "period": "Curitiba/PR | 07/12/2023 a 12/11/2024",
        "bullets": [
            "Atendimento ao cliente com escuta ativa, comunicação clara, registro de informações e resolução de solicitações.",
            "Atuação com sistemas, procedimentos, metas e indicadores de qualidade em ambiente de alta exigência.",
        ],
    },
    {
        "company": "Ponto Jazz Gastrobar",
        "role": "Head Bartender",
        "period": "Curitiba/PR | 07/2023 a 12/2023",
        "bullets": [
            "Liderança da operação do bar, organização da equipe e manutenção do padrão de serviço.",
            "Coquetelaria, produção de insumos, controle de estoque e integração com a operação do gastrobar.",
        ],
    },
    {
        "company": "Ile de France",
        "role": "Head Bartender",
        "period": "Curitiba/PR | 02/05/2022 a 22/07/2023",
        "bullets": [
            "Responsável pela operação do bar em restaurante de alto padrão, com atendimento personalizado e hospitalidade.",
            "Padronização de coquetéis e insumos, organização de praça, estoque, reposição e integração com salão e cozinha.",
            "Participação no desenvolvimento e execução da carta de coquetéis, mantendo consistência, qualidade e apresentação.",
        ],
    },
    {
        "company": "Restaurante Hai-Yo",
        "role": "Head Bartender",
        "period": "Curitiba/PR | 14/01/2022 a 16/03/2022",
        "bullets": [
            "Responsável pela operação do bar, mise en place, preparo e padronização de bebidas e insumos.",
            "Organização de praça, controle de materiais, integração com o salão e atendimento em alta demanda.",
            "Orientação da rotina de serviço para assegurar agilidade, organização e experiência consistente ao cliente.",
        ],
    },
    {
        "company": "Restaurante Hai-Yo",
        "role": "Head Bartender",
        "period": "Curitiba/PR | 11/2018 a 09/2019",
        "bullets": [
            "Liderança da operação de bar em restaurante de alta gastronomia.",
            "Padronização de receitas, apresentação, estoque e fluxo de atendimento integrado ao salão.",
            "Distribuição das rotinas da equipe e acompanhamento da qualidade durante o serviço.",
        ],
    },
    {
        "company": "Siberiano Bar",
        "role": "Head Bartender",
        "period": "Curitiba/PR | 08/2016 a 09/2018",
        "bullets": [
            "Coordenação da rotina de bar, orientação da equipe e controle operacional durante o serviço.",
            "Coquetelaria, produção de insumos e manutenção da qualidade em períodos de alto fluxo.",
            "Organização de praça, estoque e reposição para assegurar continuidade e padrão da operação.",
        ],
    },
    {
        "company": "Lucci Meeting Club",
        "role": "Gerente",
        "period": "Curitiba/PR | 08/2014 a 11/2015",
        "bullets": [
            "Gestão da rotina da casa, organização da equipe e acompanhamento da qualidade do atendimento.",
            "Compras, pedidos, relacionamento com fornecedores, controle de caixa e rotinas administrativas.",
            "Apoio a eventos, relacionamento com clientes e solução de ocorrências operacionais.",
        ],
    },
]


CORE_SKILLS = [
    "Operação completa de bar: abertura, fechamento, mise en place, estoque, inventário e reposição.",
    "Coquetelaria clássica e autoral, produção de insumos, fichas técnicas e padronização.",
    "Liderança operacional, integração, treinamento e orientação de equipes.",
    "Hospitalidade premium, guest experience, atendimento consultivo e recuperação de serviço.",
    "Desenvolvimento e execução de carta de bebidas, qualidade e apresentação.",
    "Consultoria operacional para bares e restaurantes, organização de processos e visão de negócio.",
]


def register_fonts() -> None:
    font_dir = Path(r"C:\Windows\Fonts")
    pdfmetrics.registerFont(TTFont("SegoeUI", str(font_dir / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont("SegoeUISemibold", str(font_dir / "seguisb.ttf")))
    pdfmetrics.registerFont(TTFont("SegoeUIBold", str(font_dir / "segoeuib.ttf")))


def build_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "name": ParagraphStyle(
            "Name",
            parent=sample["Title"],
            fontName="SegoeUIBold",
            fontSize=24,
            leading=27,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "Contact",
            parent=sample["BodyText"],
            fontName="SegoeUI",
            fontSize=8.7,
            leading=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=6,
        ),
        "position": ParagraphStyle(
            "Position",
            parent=sample["Heading2"],
            fontName="SegoeUIBold",
            fontSize=10.8,
            leading=14,
            textColor=TEAL,
            alignment=TA_CENTER,
            spaceAfter=9,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=sample["Heading2"],
            fontName="SegoeUIBold",
            fontSize=12.2,
            leading=14,
            textColor=INK,
            spaceBefore=6,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="SegoeUI",
            fontSize=9.2,
            leading=12.2,
            textColor=INK,
            spaceAfter=3,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=sample["BodyText"],
            fontName="SegoeUI",
            fontSize=8.8,
            leading=11.2,
            leftIndent=9,
            firstLineIndent=-9,
            textColor=INK,
            spaceAfter=1.5,
        ),
        "company": ParagraphStyle(
            "Company",
            parent=sample["BodyText"],
            fontName="SegoeUIBold",
            fontSize=9.8,
            leading=12,
            textColor=INK,
            spaceAfter=0.5,
        ),
        "period": ParagraphStyle(
            "Period",
            parent=sample["BodyText"],
            fontName="SegoeUISemibold",
            fontSize=8.2,
            leading=10,
            textColor=GOLD,
            spaceAfter=1.5,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=sample["BodyText"],
            fontName="SegoeUI",
            fontSize=7.8,
            leading=9,
            textColor=MUTED,
        ),
    }


def page_chrome(canvas, doc) -> None:
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, height - 7 * mm, width, 7 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, 14 * mm, width - doc.rightMargin, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("SegoeUI", 7.5)
    canvas.drawString(doc.leftMargin, 9 * mm, "Giasi Mandela Silva | Hospitalidade, liderança e consultoria de A&B")
    canvas.drawRightString(width - doc.rightMargin, 9 * mm, f"Página {doc.page}")
    canvas.restoreState()


def experience_block(styles, item):
    parts = [
        Paragraph(
            f"{escape(item['company'])} | {escape(item['role'])}",
            styles["company"],
        ),
        Paragraph(escape(item["period"]), styles["period"]),
    ]
    parts.extend(Paragraph(f"- {escape(text)}", styles["bullet"]) for text in item["bullets"])
    parts.append(Spacer(1, 2.5))
    return KeepTogether(parts)


def build_pdf() -> None:
    register_fonts()
    styles = build_styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title="Currículo - Giasi Mandela Silva",
        author="Giasi Mandela Silva",
        subject="Head Bartender, gestão e consultoria de bares e restaurantes",
    )

    story = [
        Paragraph("Giasi Mandela Silva", styles["name"]),
        Paragraph(
            "Curitiba/PR | +55 41 92000-1904 | "
            '<link href="mailto:att.giasi@gmail.com" color="#53666F">att.giasi@gmail.com</link> | '
            '<link href="https://www.linkedin.com/in/giasimandela/" color="#53666F">linkedin.com/in/giasimandela</link>',
            styles["contact"],
        ),
        Paragraph(
            "HEAD BARTENDER | CHEFE DE BAR | GESTÃO E CONSULTORIA DE BARES, RESTAURANTES E A&amp;B",
            styles["position"],
        ),
        HRFlowable(width="100%", thickness=0.8, color=LINE, spaceBefore=0, spaceAfter=5),
        Paragraph("Resumo profissional", styles["section"]),
        Paragraph(
            "Profissional de hospitalidade e alimentos e bebidas com mais de 10 anos de experiência em bares, restaurantes, hotelaria e eventos. Especialista em operação de bar, coquetelaria clássica e autoral, padronização, controle de estoque, treinamento de equipes e atendimento de alto padrão. Atua como Head Bartender responsável pela rotina completa do bar, integração com salão e cozinha e consistência da experiência do cliente. Disponível para posições de liderança, gestão e consultoria em PR, SC e SP.",
            styles["body"],
        ),
        Paragraph("Competências estratégicas", styles["section"]),
    ]

    story.extend(Paragraph(f"- {escape(skill)}", styles["bullet"]) for skill in CORE_SKILLS)
    story.append(Paragraph("Experiência profissional", styles["section"]))

    for index, item in enumerate(EXPERIENCES):
        story.append(experience_block(styles, item))
        if index == 4:
            story.append(PageBreak())
            story.append(Paragraph("Experiência profissional - continuação", styles["section"]))

    story.extend(
        [
            Paragraph("Formação", styles["section"]),
            Paragraph("- Administração de Empresas | Unicastelo | 2010 a 2013", styles["bullet"]),
            Paragraph(
                "- Gestão de Eventos e Cerimonial Público e Privado | UEPG | 2017 a 2018",
                styles["bullet"],
            ),
            Paragraph("Disponibilidade", styles["section"]),
            Paragraph(
                "Curitiba e Região Metropolitana, com interesse em oportunidades no Paraná, Santa Catarina e São Paulo. Disponibilidade de horários para operações de hospitalidade, eventos e atendimento de alto padrão.",
                styles["body"],
            ),
            Paragraph("Posições de interesse", styles["section"]),
            Paragraph(
                "Head Bartender, Chefe de Bar, Gerente de Bar, Consultor de Bares e Restaurantes, Gestão de Alimentos e Bebidas, Treinamento de Equipes e Experiência do Cliente.",
                styles["body"],
            ),
        ]
    )

    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
