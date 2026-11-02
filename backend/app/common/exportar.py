from datetime import date, datetime
from io import BytesIO
from pathlib import Path
import re
from typing import Any

from openpyxl import Workbook
from openpyxl.drawing.image import Image as ExcelImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


INSTITUTIONAL_BLUE = "1E3A8A"
INSTITUTIONAL_LIGHT = "EFF6FF"
HEADER_FONT = Font(bold=True, color="FFFFFF", size=10)
HEADER_FILL = PatternFill(start_color=INSTITUTIONAL_BLUE, end_color=INSTITUTIONAL_BLUE, fill_type="solid")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)
THIN_BORDER = Border(
    left=Side(style="thin", color="D1D5DB"),
    right=Side(style="thin", color="D1D5DB"),
    top=Side(style="thin", color="D1D5DB"),
    bottom=Side(style="thin", color="D1D5DB"),
)
DATA_ALIGN = Alignment(vertical="center", wrap_text=True)


def _normalizar_valor(valor: Any) -> Any:
    if isinstance(valor, datetime):
        return valor.replace(tzinfo=None) if valor.tzinfo else valor
    if isinstance(valor, date):
        return valor
    if isinstance(valor, float):
        return round(valor, 2)
    return valor


def _config_value(config: dict | None, key: str, default: str = "") -> str:
    value = (config or {}).get(key)
    return str(value) if value else default


def _logo_path(config: dict | None) -> Path | None:
    logo_url = _config_value(config, "logo_url")
    if not logo_url:
        return None
    path = Path(logo_url.lstrip("/\\"))
    if not path.exists():
        path = Path(__file__).resolve().parents[2] / logo_url.lstrip("/\\")
    if path.exists() and path.is_file():
        return path
    return None


def _metadata(config: dict | None, generado_por: str | None, subtitulo: str) -> list[str]:
    hotel = _config_value(config, "nombre", "Hotel Paredes")
    contacto = " · ".join(filter(None, [
        _config_value(config, "direccion"),
        _config_value(config, "telefono"),
        _config_value(config, "email"),
    ]))
    return [
        hotel,
        contacto,
        subtitulo,
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')} · Usuario: {generado_por or 'Sistema'}",
    ]


def _column_format(column: dict, value: Any) -> str | None:
    if column.get("format") == "currency":
        return '#,##0.00'
    if isinstance(value, float):
        return '#,##0.00'
    return None


def _sheet_title(titulo: str) -> str:
    limpio = re.sub(r"[\\/*?:\[\]]", "-", titulo).strip()
    return (limpio or "Reporte")[:31]


def exportar_excel(
    datos: list[dict],
    columnas: list[dict],
    titulo: str = "Reporte",
    subtitulo: str = "",
    config: dict | None = None,
    generado_por: str | None = None,
) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = _sheet_title(titulo)
    total_columnas = max(len(columnas), 1)
    logo = _logo_path(config)
    fila_encabezado = 6 if logo else 5

    if logo:
        imagen = ExcelImage(str(logo))
        imagen.width = 90
        imagen.height = 45
        ws.add_image(imagen, "A1")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=total_columnas)
    titulo_cell = ws.cell(row=1, column=1, value=_config_value(config, "nombre", "Hotel Paredes"))
    titulo_cell.font = Font(bold=True, size=16, color=INSTITUTIONAL_BLUE)
    titulo_cell.alignment = Alignment(horizontal="center")
    ws.row_dimensions[1].height = 25
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=total_columnas)
    ws.cell(row=2, column=1, value=titulo).font = Font(bold=True, size=13)
    ws.cell(row=2, column=1).alignment = Alignment(horizontal="center")
    ws.merge_cells(start_row=3, start_column=1, end_row=3, end_column=total_columnas)
    ws.cell(row=3, column=1, value=subtitulo or "Sin período especificado").alignment = Alignment(horizontal="center")
    ws.merge_cells(start_row=4, start_column=1, end_row=4, end_column=total_columnas)
    ws.cell(row=4, column=1, value=f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')} · Usuario: {generado_por or 'Sistema'}").alignment = Alignment(horizontal="center")
    for col_idx, col in enumerate(columnas, 1):
        cell = ws.cell(row=fila_encabezado, column=col_idx, value=col["header"])
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = HEADER_ALIGN
        cell.border = THIN_BORDER
        ws.column_dimensions[get_column_letter(col_idx)].width = col.get("width", 16)
    for row_idx, fila in enumerate(datos, fila_encabezado + 1):
        for col_idx, col in enumerate(columnas, 1):
            valor = _normalizar_valor(fila.get(col["key"], ""))
            cell = ws.cell(row=row_idx, column=col_idx, value=valor)
            cell.alignment = DATA_ALIGN
            cell.border = THIN_BORDER
            formato = _column_format(col, valor)
            if formato:
                cell.number_format = formato
            elif isinstance(valor, datetime):
                cell.number_format = "dd/mm/yyyy hh:mm"
            elif isinstance(valor, date):
                cell.number_format = "dd/mm/yyyy"
            if row_idx % 2 == 0:
                cell.fill = PatternFill(start_color=INSTITUTIONAL_LIGHT, end_color=INSTITUTIONAL_LIGHT, fill_type="solid")
    if not datos:
        ws.merge_cells(start_row=fila_encabezado + 1, start_column=1, end_row=fila_encabezado + 1, end_column=total_columnas)
        vacio = ws.cell(row=fila_encabezado + 1, column=1, value="No existen registros para los filtros seleccionados.")
        vacio.alignment = Alignment(horizontal="center", vertical="center")
        vacio.font = Font(italic=True, color="6B7280")
    final_row = max(fila_encabezado, fila_encabezado + len(datos) + (1 if not datos else 0))
    ws.auto_filter.ref = f"A{fila_encabezado}:{get_column_letter(total_columnas)}{final_row}"
    ws.freeze_panes = f"A{fila_encabezado + 1}"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_margins.left = 0.25
    ws.page_margins.right = 0.25
    ws.print_title_rows = f"${fila_encabezado}:${fila_encabezado}"

    output = BytesIO()
    wb.save(output)
    return output.getvalue()


def _footer(canvas, doc, hotel: str) -> None:
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D1D5DB"))
    canvas.line(doc.leftMargin, 0.45 * inch, doc.pagesize[0] - doc.rightMargin, 0.45 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(doc.leftMargin, 0.25 * inch, f"{hotel} · Documento generado por el PMS")
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 0.25 * inch, f"Página {doc.page}")
    canvas.restoreState()


def exportar_pdf(
    datos: list[dict],
    columnas: list[dict],
    titulo: str = "Reporte",
    subtitulo: str = "",
    config: dict | None = None,
    generado_por: str | None = None,
) -> bytes:
    ancho_estimado = sum(float(col.get("width", 16)) for col in columnas)
    pagina = landscape(A4) if ancho_estimado > 115 else A4
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=pagina,
        leftMargin=0.45 * inch,
        rightMargin=0.45 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.65 * inch,
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle("ReportBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.5, leading=9)
    header = ParagraphStyle("ReportHeader", parent=body, fontName="Helvetica-Bold", textColor=colors.white, alignment=1)
    elements = []
    logo = _logo_path(config)
    datos_institucionales = _metadata(config, generado_por, subtitulo)
    if logo:
        logo_img = Image(str(logo), width=0.85 * inch, height=0.45 * inch)
        encabezado = Table([[logo_img, Paragraph("<b>%s</b><br/><font size='9'>%s</font>" % (
            datos_institucionales[0], "<br/>".join(datos_institucionales[1:])
        ), body)]], colWidths=[1.0 * inch, pagina[0] - 1.9 * inch])
        encabezado.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
        elements.append(encabezado)
    else:
        elements.extend([Paragraph(f"<b>{datos_institucionales[0]}</b>", styles["Heading2"]), Paragraph("<br/>".join(datos_institucionales[1:]), body)])
    elements.extend([Spacer(1, 0.15 * inch), Paragraph(titulo, styles["Title"]), Spacer(1, 0.08 * inch)])
    if not datos:
        elements.append(Paragraph("No existen registros para los filtros seleccionados.", body))
    else:
        encabezados = [Paragraph(str(col["header"]), header) for col in columnas]
        filas = [encabezados]
        for fila in datos:
            filas.append([Paragraph(str(_normalizar_valor(fila.get(col["key"], ""))).replace("\n", "<br/>"), body) for col in columnas])
        ancho_disponible = pagina[0] - doc.leftMargin - doc.rightMargin
        suma = sum(float(col.get("width", 16)) for col in columnas)
        anchos = [ancho_disponible * float(col.get("width", 16)) / suma for col in columnas]
        tabla = Table(filas, colWidths=anchos, repeatRows=1, hAlign="LEFT")
        tabla.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{INSTITUTIONAL_BLUE}")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D1D5DB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(tabla)
    hotel = _config_value(config, "nombre", "Hotel Paredes")
    doc.build(elements, onFirstPage=lambda canvas, document: _footer(canvas, document, hotel), onLaterPages=lambda canvas, document: _footer(canvas, document, hotel))
    return buffer.getvalue()
