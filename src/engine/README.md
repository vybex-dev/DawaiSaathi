# src/engine

**Belongs here:** the safety engine as small pure TypeScript functions: normalize, similarity, match, rules, check, validate, presenter. Data (rules, classes, catalogue search) comes in as arguments.

**Never here:** imports from react, expo or the database; network calls; logging of medicine names; AI model calls. The engine decides safety, never the AI.
