UPDATE auth_user 
SET password='pbkdf2_sha256$600000$5h4qBLIDF27uTxNDJXuChZ4Smrnn2VofPPfDEOMQql4=$YNoWNEhtIsGnPcUwB/VhB+5Fdvy5SR5aGkHJzSFxOM0=' 
WHERE username='admin';

SELECT id, username, email, is_staff, is_superuser, password FROM auth_user WHERE username='admin';
