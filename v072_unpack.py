from pathlib import Path
import base64, gzip
ROOT=Path(__file__).resolve().parent
parts=sorted((ROOT/'v072_bundle').glob('part*.txt'))
data=''.join(p.read_text(encoding='utf-8').strip() for p in parts)
html=gzip.decompress(base64.b64decode(data))
public=ROOT/'v072_public'
public.mkdir(exist_ok=True)
(public/'index.html').write_bytes(html)
print(f'[SUMUS] V0.7.2.1 client ready: {len(parts)} parts -> {len(html)} bytes')
