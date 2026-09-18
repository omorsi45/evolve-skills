# Privacy and safe sharing

Execution traces can contain prompts, private reasoning, local paths, source code, tool output, credentials, tokens, personal data, customer data, and internal service responses. Treat every trace as sensitive until reviewed.

## Required handling

- Keep raw traces local. The generated `evolution/.gitignore` excludes `raw/traces/` and `raw/digests/`.
- Do not ingest a trace that the user is not authorized to store.
- Do not paste secrets or personal data into wiki pattern pages, proposal notes, patches, logs, commits, issues, or public examples.
- Refer to evidence by manifest hash when the underlying content cannot be shared.
- Before publishing a target skill, inspect every tracked file under `evolution/`, run the repository's secret scanner, and remove or generalize organization-specific details.
- Share compiled, de-identified patterns only when their source policy allows it. A useful abstraction can still leak confidential context.

Deleting a raw trace breaks integrity verification. If retention policy requires deletion, remove its manifest row in the same reviewed change and record the reason in `wiki/log.md`.
