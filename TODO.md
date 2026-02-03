# High Finance - Security TODO

## Completed

- [x] Removed `.env` from git history
- [x] Fixed CORS configuration (now uses explicit origin whitelist)
- [x] Fixed broken `deps.py` dependency injection
- [x] Added security headers middleware (X-Frame-Options, X-Content-Type-Options, etc.)
- [x] Added rate limiting infrastructure
- [x] Added JWT authentication module
- [x] Added authorization checks to project routes (IDOR fix)
- [x] Added `owner_id` to Project model
- [x] Created `.env.example` template
- [x] Created root `.gitignore`
- [x] Added global exception handler (prevents leaking internal details)

---

## Manual Tasks Required

### 1. Install New Dependencies

```bash
pip install python-jose[cryptography] passlib[bcrypt] slowapi
# Or:
pip install -r requirements.txt
```

### 2. Run Database Migration

Add the `owner_id` column to the `projects` table:

```bash
# Run inside Docker container
docker compose exec api alembic revision --autogenerate -m "Add owner_id to projects"
docker compose exec api alembic upgrade head
```

### 3. Re-add Git Remote and Push

```bash
git remote add origin https://github.com/jmas123/high_finance.git
git push origin --force --all
```

### 4. Set Environment Variables

Create a `.env` file (copy from `.env.example`) with:

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_hex(32))"
```

Set these in your environment:
- `SECRET_KEY` - Use the generated value
- `ALLOWED_ORIGINS` - Your frontend URLs (comma-separated)
- `DEBUG=False` for production

---

## Future Improvements (Lower Priority)

### Authentication
- [ ] Implement user registration endpoint (`/auth/register`)
- [ ] Implement login endpoint (`/auth/login`)
- [ ] Add password reset flow
- [ ] Add refresh token endpoint

### Security Hardening
- [ ] Add HTTPS/TLS in production
- [ ] Add HSTS header after HTTPS is configured
- [ ] Implement audit logging for sensitive operations
- [ ] Add request validation (max input lengths)

### Code Quality
- [ ] Remove 17+ debug `print()` statements from services
- [ ] Add comprehensive test coverage for security features
- [ ] Pin dependency versions in requirements.txt

---

## Files Modified

| File | Change |
|------|--------|
| `src/main.py` | CORS fix, security headers, rate limiting, error handling |
| `src/high_finance/core/config.py` | Added security settings |
| `src/high_finance/core/security.py` | JWT authentication module (new) |
| `src/high_finance/core/rate_limit.py` | Rate limiting module (new) |
| `src/high_finance/api/deps.py` | Fixed dependency injection |
| `src/high_finance/db/models/project.py` | Added `owner_id` column |
| `src/high_finance/services/project.py` | Added owner filtering |
| `src/high_finance/api/v1/routes/project.py` | Added authorization checks |
| `src/high_finance/api/v1/schemas/project.py` | Added `owner_id` to schemas |
| `requirements.txt` | Added security dependencies |
| `infra/.env.example` | Template for environment variables (new) |
| `.gitignore` | Root-level gitignore (new) |
