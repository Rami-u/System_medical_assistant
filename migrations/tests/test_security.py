from app.core.security import hash_password, verify_password, create_access_token, decode_token

h = hash_password("khafagy2511")
print("Hash OK:", h[:10], "...")

print("Verify correct:", verify_password("khafgay2511", h))
print("Verify wrong:", verify_password("wrongpass", h))

token = create_access_token(user_id=1, role="patient")
decoded = decode_token(token, expected_type="access")

print("Decoded:", decoded)