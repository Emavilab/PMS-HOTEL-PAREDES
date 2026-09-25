from datetime import date, datetime
from io import BytesIO
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle


HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
HEADER_FILL = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)
THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
DATA_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _normalizar_valor(valor: Any) -> Any:
    if isinstance(valor, (datetime, date)):
        return valor.isoformat() if isinstance(valor, datetime) else valor.strftime("%Y-%m-%d")
    if isinstance(valor, float):
        return round(valor, 2)
    return valor


def exportar_excel(
    datos: list[dict],
    columnas: list[dict],
    titulo: str = "Reporte",
) -> bytes:
    """
    columnas: [{"key": "fecha", "header": "Fecha", "width": 15}, ...]
    """
    wb = Workbook()
    ws = wb.active
    ws.title = titulo[:31]

    # Título
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(columnas))
    cell_titulo = ws.cell(row=1, column=1, value=titulo)
    cell_titulo.font = Font(bold=True, size=14)
    cell_titulo.alignment = Alignment(horizontal="center")
    ws.row_dimensions[1].height = 30

    # Encabezados
    for col_idx, col in enumerate(columnas, 1):
        cell = ws.cell(row=2, column=col_idx, value=col["header"])
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = HEADER_ALIGN
        cell.border = THIN_BORDER
        if "width" in col:
            ws.column_dimensions[cell.column_letter].width = col["width"]

    # Datos
    for row_idx, fila in enumerate(datos, 3):
        for col_idx, col in enumerate(columnas, 1):
            valor = _normalizar_valor(fila.get(col["key"], ""))
            cell = ws.cell(row=row_idx, column=col_idx, value=valor)
            cell.alignment = DATA_ALIGN
            cell.border = THIN_BORDER
            if isinstance(valor, float):
                cell.number_format = "#,##0.00"

    # Auto-filtro
    ws.auto_filter.ref = f"A2:{ws.cell(row=2, column=len(columnas)).coordinate}"

    output = BytesIO()
    wb.save(output)
    return output.getvalue()


def exportar_pdf(
    datos: list[dict],
    columnas: list[dict],
    titulo: str = "Reporte",
    subtitulo: str = "",
) -> bytes:
    """
    Genera un PDF simple con tabla usando reportlab.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    elementos = []

    # Título
    titulo_style = styles["Title"]
    titulo_style.alignment = 1
    elementos.append(Paragraph(titulo, titulo_style))
    if subtitulo:
        sub_style = styles["Normal"]
        sub_style.alignment = 1
        elementos.append(Paragraph(subtitulo, sub_style))
    elementos.append(Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Normal"]))
    elementos.append(Paragraph("<br/>", styles["Normal"]))

    # Tabla
    encabezados = [col["header"] for col in columnas]
    filas = [encabezados]
    for fila in datos:
        filas.append([str(_normalizar_valor(fila.get(col["key"], ""))) for col in columnas])

    tabla = Table(filas, repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elementos.append(tabla)

    doc.build(elementos)
    return buffer.getvalue()