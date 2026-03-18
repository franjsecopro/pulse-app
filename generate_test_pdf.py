"""
Generate a fake Hello Bank / BNP Paribas PDF statement for testing the parser.
The parser looks for lines starting with DD/MM/YYYY and ending with an amount.
"""


def write_test_pdf(output_path: str):
    # Text lines the PDF parser will extract (pdfplumber reads these as plain text)
    lines = [
        "Relevé de compte Hello Bank / BNP Paribas",
        "Période: 01/03/2026 - 31/03/2026",
        "",
        "Date         Description                                          Débit       Crédit",
        "--------------------------------------------------------------------------",
        "05/03/2026   VIR GARCIA MONTALBAN JUAN                                        45,00",
        "10/03/2026   VIR MANOLO GARCIA                                                55,00",
        "12/03/2026   CARTE SUPERMERCADO LIDL                              12,50",
        "",
        "Solde final: 87,50",
    ]

    stream_text = "\n".join(lines)
    # Use Courier (monospace) so columns align and pdfplumber extracts text cleanly
    pdf_stream_content = "BT\n/F1 10 Tf\n50 780 Td\n12 TL\n"
    for line in lines:
        # Escape parentheses and backslashes for PDF string syntax
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        pdf_stream_content += f"({escaped}) Tj T*\n"
    pdf_stream_content += "ET"

    stream_bytes = pdf_stream_content.encode("latin-1")

    objects: list[bytes] = [
        b"1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n",
        b"2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n",
        (
            b"3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n"
            b"/Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n"
        ),
        (
            f"4 0 obj\n<</Length {len(stream_bytes)}>>\nstream\n".encode("latin-1")
            + stream_bytes
            + b"\nendstream\nendobj\n"
        ),
        b"5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Courier>>\nendobj\n",
    ]

    pdf = b"%PDF-1.4\n"
    offsets: list[int] = []
    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj

    xref_offset = len(pdf)
    xref = f"xref\n0 {len(objects) + 1}\n"
    xref += "0000000000 65535 f \n"
    for offset in offsets:
        xref += f"{offset:010d} 00000 n \n"

    trailer = (
        f"trailer\n<</Size {len(objects) + 1} /Root 1 0 R>>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    )

    pdf += xref.encode("latin-1") + trailer.encode("latin-1")

    with open(output_path, "wb") as f:
        f.write(pdf)

    print(f"PDF generado: {output_path}")
    print("Transacciones incluidas:")
    print("  - 05/03/2026  VIR GARCIA MONTALBAN JUAN  45,00 (credito)")
    print("  - 10/03/2026  VIR MANOLO GARCIA           55,00 (credito)")
    print("  - 12/03/2026  LIDL                         12,50 (debito -- debe ignorarse)")


if __name__ == "__main__":
    write_test_pdf("test_statement.pdf")
