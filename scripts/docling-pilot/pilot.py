"""Offline DOCX/HTML to review-only drafts. No database, API, OCR or publishing."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import zipfile

ROOT = Path(__file__).resolve().parents[2]
AREA = json.loads((ROOT / 'packages/lib/src/directory/service-area.json').read_text())

def draft_from_text(text, filename, digest):
    labels = {
        'name': ['Business', 'Negocio'], 'address': ['Address', 'Dirección'],
        'city': ['City', 'Ciudad'], 'state': ['State', 'Estado'],
        'phone': ['Phone', 'Teléfono'], 'website': ['Website', 'Sitio web'],
        'services': ['Services', 'Servicios'],
    }
    fields, evidence = {}, {}
    for field, names in labels.items():
        matches = re.findall(r'(?im)^\s*(?:' + '|'.join(map(re.escape, names)) + r')\s*:\s*([^\n]+)', text)
        # Conflicting repetitions must not silently choose a convenient value.
        values = list(dict.fromkeys(v.strip() for v in matches))
        fields[field] = values[0] if len(values) == 1 else None
        evidence[field] = values
    city, state = (fields['city'] or '').casefold(), (fields['state'] or '').upper()
    allowed = any(city in c['aliases'] and state in c['states'] for c in AREA['cities'])
    address_match = re.search(r',\s*([^,]+),?\s+(TX|NM|Texas|New Mexico)\b(?:\s*\d{5}(?:-\d{4})?)?\s*$', fields['address'] or '', re.I)
    matched_city = next((c for c in AREA['cities'] if city in c['aliases']), None)
    address_state = {'TEXAS': 'TX', 'NEW MEXICO': 'NM'}.get(address_match[2].upper(), address_match[2].upper()) if address_match else None
    consistent = bool(address_match and matched_city and address_match[1].strip().casefold() in matched_city['aliases'] and address_state == state)
    missing = [k for k in ['name', 'address', 'city', 'state'] if not fields[k]]
    reasons = ['human_source_and_duplicate_review_required', 'document_content_is_not_verified']
    if missing: reasons.append('missing_or_conflicting_fields:' + ','.join(missing))
    if not allowed: reasons.append('locality_not_confirmed_in_service_area')
    if not consistent: reasons.append('address_locality_missing_or_conflicting')
    return {'schema_version': 1, 'decision': 'review' if allowed and consistent and not missing else 'reject_or_correct',
            'is_published': False, 'publication_hold': 'document_review', 'last_verified_at': None,
            'service_area_version': AREA['version'], 'draft': fields, 'evidence': evidence,
            'source': {'file': filename, 'sha256': digest, 'method': 'docling_local'}, 'review_reasons': reasons}

def convert(path):
    path = Path(path).resolve()
    if not path.is_relative_to(ROOT): raise ValueError('Pilot inputs must be inside this repository.')
    if path.suffix.lower() not in {'.docx', '.html'}: raise ValueError('This bounded pilot supports DOCX and HTML only.')
    if path.stat().st_size > 10 * 1024 * 1024: raise ValueError('Input exceeds 10 MiB.')
    if path.suffix.lower() == '.docx':
        with zipfile.ZipFile(path) as z:
            entries = z.infolist()
            if len(entries) > 2000 or sum(e.file_size for e in entries) > 50 * 1024 * 1024:
                raise ValueError('Expanded document exceeds pilot limits.')
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    def denied(*args, **kwargs): raise RuntimeError('Network disabled for local document conversion')
    original = socket.socket.connect
    socket.socket.connect = denied
    try:
        from docling.document_converter import DocumentConverter
        from docling.datamodel.base_models import InputFormat
        converter = DocumentConverter(allowed_formats=[InputFormat.DOCX, InputFormat.HTML])
        result = converter.convert(path)
        text = result.document.export_to_text()
    finally:
        socket.socket.connect = original
    return draft_from_text(text, path.name, hashlib.sha256(path.read_bytes()).hexdigest())

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / '.tmp'): parser.error('Output must be within repository .tmp; no production writes.')
    draft = convert(args.input)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{draft["decision"]}: {output}')
