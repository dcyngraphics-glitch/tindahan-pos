import urllib.request
import json

url = "https://zo7vbabeq.dexie.cloud/auth/otp"
data = json.dumps({"email": "test@example.com"}).encode("utf-8")

req = urllib.request.Request(
    url,
    data=data,
    method="POST",
    headers={"Content-Type": "application/json"},
)

try:
    resp = urllib.request.urlopen(req, timeout=10)
    print("Status:", resp.status)
    print("Headers:", dict(resp.headers))
    print("Body:", resp.read()[:500])
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Headers:", dict(e.headers))
    print("Body:", e.read()[:500])
except Exception as e:
    print("Error:", e)
