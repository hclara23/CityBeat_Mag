"""Bounded offline PDF/DOCX text extraction for the reviewed property importer."""
import json
import os
from pathlib import Path
import socket
import sys
import zipfile


def convert(path):
    path = Path(path).resolve()
    if path.suffix.lower() not in {'.pdf', '.docx'} or not 0 < path.stat().st_size <= 10 * 1024 * 1024:
        raise ValueError('Invalid or oversized brochure')
    if path.suffix.lower() == '.docx':
        with zipfile.ZipFile(path) as archive:
            files = archive.infolist()
            if len(files) > 2000 or sum(f.file_size for f in files) > 50 * 1024 * 1024:
                raise ValueError('Expanded document too large')
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex

    def denied(*args, **kwargs):
        raise RuntimeError('Network disabled during brochure conversion')

    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    try:
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        options = PdfPipelineOptions()
        options.enable_remote_services = False
        options.do_ocr = False  # Image-only pages must be reviewed/uploaded as text; no hidden model downloads.
        options.do_table_structure = False
        converter = DocumentConverter(allowed_formats=[InputFormat.PDF, InputFormat.DOCX],
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})
        result = converter.convert(path, max_num_pages=30, max_file_size=10 * 1024 * 1024)
        text = result.document.export_to_text()
        if not text.strip() or len(text) > 40000:
            raise ValueError('Brochure is empty, scanned, or exceeds text limit')
        return {'text': text, 'method': 'docling_offline', 'ocr': False}
    finally:
        socket.socket.connect = original_connect
        socket.socket.connect_ex = original_connect_ex


if __name__ == '__main__':
    try:
        # Converter logs must not corrupt the machine-readable stdout protocol.
        from contextlib import redirect_stdout
        with redirect_stdout(sys.stderr):
            result = convert(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception:
        print('Brochure conversion unavailable; check format, limits, and offline model cache.', file=sys.stderr)
        sys.exit(1)
