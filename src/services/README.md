# src/services

**Belongs here:** service interfaces and their real and fake implementations: scan, voice, share, auth, family, reminders. Anything that touches the camera, network, speech or Supabase.

**Never here:** screens, rules logic, API keys (Gemini and Groq keys live only in Supabase secrets), strip photos written to disk, or logs containing medicine names.
