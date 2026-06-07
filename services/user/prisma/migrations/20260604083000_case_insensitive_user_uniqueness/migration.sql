-- Normalize existing data so the new functional indexes can be built
-- without violating uniqueness on rows that already differ only in case.
UPDATE "User"
SET email = LOWER(email)
WHERE email <> LOWER(email);

UPDATE "User"
SET username = LOWER(username)
WHERE username <> LOWER(username);

-- Functional unique indexes that back the application's normalization.
-- The application lowercases email and username before persisting, so these
-- indexes are the authoritative uniqueness constraint.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER(email));
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (LOWER(username));
