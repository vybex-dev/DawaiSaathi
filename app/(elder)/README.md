# app/(elder)

**Belongs here:** the elder's screens: index (home hub), scan, confirm, medicines, result, ask, settings, show-code. Screens only assemble components and call services and stores.

**Never here:** rules, matching or validation logic (that is `src/engine`), raw SQL, network calls, or hard-coded wording (use `t()`).
