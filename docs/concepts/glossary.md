# Glossary

| Term | Meaning in Topos |
| --- | --- |
| API | A program interface used by another program. Topos exposes GraphQL and gRPC APIs. |
| GraphQL | A query language. The browser asks the gateway for the data it needs. |
| Subgraph | A GraphQL service that owns part of the shared API. Topos has user and content subgraphs. |
| gRPC | A typed service-to-service protocol. Content workers use it to call the AI service. |
| Event | A message that something happened, such as `post.created`. |
| Kafka | The event broker that holds events until workers consume them. |
| Worker | A process that handles work outside the original browser request. |
| DLQ | Dead-letter queue: a Kafka topic for messages that repeatedly failed processing. |
| JWT | A signed token used to identify an authenticated user. |
| Vector | A numeric representation of text used for similarity search. |
| Qdrant | The vector database used by the AI service. |
| SSM | AWS Systems Manager Parameter Store, used for non-secret configuration. |
