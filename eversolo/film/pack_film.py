#!/usr/bin/env python3
"""ZRL Sprawl: adds the flight film to the CI-built base APK (new entries are stored + aligned) and re-signs.
Based on browser/tools/repack_sign.py.

Emergency APK re-pack + APK Signature Scheme v2 signer (no Android SDK, no CI).

Takes an existing built APK, swaps in replacement files (e.g. assets/), rewrites the zip with
4-byte alignment for stored entries (zipalign rule), and signs it with v2 using the dev key.
Used while CI was unavailable. Needs: python3 + cryptography.

usage: repack_sign.py in.apk out.apk key.p12 password  zip/path=local/file ...
"""
import hashlib, struct, sys, zipfile, io
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa, ec
from cryptography.hazmat.primitives.serialization import pkcs12

src, dst, p12, pw = sys.argv[1:5]
repl = dict(a.split('=', 1) for a in sys.argv[5:])

# ---- 1. rewrite the zip, aligned ----
zin = zipfile.ZipFile(src)
buf = io.BytesIO()
zout = zipfile.ZipFile(buf, 'w')
for info in zin.infolist():
    if info.filename.startswith('META-INF/') and info.filename.upper().endswith(('.SF', '.RSA', '.EC', '.DSA', 'MANIFEST.MF')):
        continue  # drop any v1 signature; we sign v2 only (minSdk 24)
    data = open(repl.pop(info.filename), 'rb').read() if info.filename in repl else zin.read(info.filename)
    zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
    zi.compress_type = info.compress_type
    zi.external_attr = info.external_attr
    zi.create_system = info.create_system
    zi.extra = b''
    if zi.compress_type == zipfile.ZIP_STORED:
        hdr = 30 + len(zi.filename.encode())
        off = buf.tell() + hdr + 6  # 6 = our extra field header (4) + 2-byte align value
        pad = (4 - off % 4) % 4
        zi.extra = struct.pack('<HHH', 0xd935, 2 + pad, 4) + b'\0' * pad
    zout.writestr(zi, data)
for name in list(repl):   # entries that are new to the APK (the film): stored, 4-byte aligned
    data = open(repl.pop(name), 'rb').read()
    zi = zipfile.ZipInfo(name, date_time=(1981, 1, 1, 1, 1, 2))
    zi.compress_type = zipfile.ZIP_STORED
    hdr = 30 + len(zi.filename.encode())
    off = buf.tell() + hdr + 6
    pad = (4 - off % 4) % 4
    zi.extra = struct.pack('<HHH', 0xd935, 2 + pad, 4) + b'\0' * pad
    zout.writestr(zi, data)
zout.close()
apk = buf.getvalue()

# ---- 2. split into sections ----
eocd = apk.rfind(b'PK\x05\x06')
cd_off = struct.unpack('<I', apk[eocd + 16:eocd + 20])[0]
contents, cdir, eocd_b = apk[:cd_off], apk[cd_off:eocd], apk[eocd:]

def chunks_digest(sections):
    ds = []
    for s in sections:
        for i in range(0, len(s), 1 << 20):
            c = s[i:i + (1 << 20)]
            ds.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
    return hashlib.sha256(b'\x5a' + struct.pack('<I', len(ds)) + b''.join(ds)).digest()

digest = chunks_digest([contents, cdir, eocd_b])

# ---- 3. key ----
key, cert, _ = pkcs12.load_key_and_certificates(open(p12, 'rb').read(), pw.encode())
cert_der = cert.public_bytes(serialization.Encoding.DER)
pub_der = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
if isinstance(key, rsa.RSAPrivateKey):
    algo = 0x0103
    sign = lambda m: key.sign(m, padding.PKCS1v15(), hashes.SHA256())
elif isinstance(key, ec.EllipticCurvePrivateKey):
    algo = 0x0201
    sign = lambda m: key.sign(m, ec.ECDSA(hashes.SHA256()))
else:
    raise SystemExit('unsupported key type')

lp = lambda b: struct.pack('<I', len(b)) + b
seq = lambda items: lp(b''.join(lp(i) for i in items))

signed_data = seq([struct.pack('<I', algo) + lp(digest)]) + seq([cert_der]) + lp(b'')
signer = lp(signed_data) + seq([struct.pack('<I', algo) + lp(sign(signed_data))]) + lp(pub_der)
v2 = seq([signer])

pair = struct.pack('<Q', 4 + len(v2)) + struct.pack('<I', 0x7109871a) + v2
size = len(pair) + 8 + 16
block = struct.pack('<Q', size) + pair + struct.pack('<Q', size) + b'APK Sig Block 42'

new_eocd = eocd_b[:16] + struct.pack('<I', cd_off + len(block)) + eocd_b[20:]
open(dst, 'wb').write(contents + block + cdir + new_eocd)
print('signed', dst, 'algo 0x%04x' % algo, 'cert sha256', hashlib.sha256(cert_der).hexdigest())
