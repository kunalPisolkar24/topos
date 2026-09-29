# Request and event flows

Topos has several distinct flows. Keeping them on separate pages prevents a
single large diagram from hiding important failure or ownership details.

| Flow | What it explains |
| --- | --- |
| [Sign-in](../../services/user/docs/concepts/authentication-flow.md) | Credentials, JWT issuance, and federation header propagation |
| [Publishing and indexing](../../services/content/docs/concepts/publishing-flow.md) | Persisting a post, Kafka events, summary generation, and search indexing |
| [Draft review](../../services/content/docs/concepts/draft-lifecycle.md) | AI/content draft states and peer approval |
| [Chat](../../services/content/docs/concepts/chat-flow.md) | Conversation persistence, grounding, and citations |
| [Search and recommendations](../../services/ai/docs/concepts/retrieval-and-recommendations.md) | Qdrant ranking, hydration, and interaction-driven feeds |
| [Worker failure and replay](../../services/content/docs/operations/reliability.md) | Retry, DLQ, and replay behaviour |
