# Frontend user journeys

```mermaid
flowchart TB
    home[Browse home/feed] --> view[View post]
    view --> interact[View, like, or save]
    home --> search[Search posts/tags]
    signin[Sign in] --> create[Create post or draft]
    create --> review[Review queue]
    view --> chat[Ask chat question]
    interact --> feed[Updated future recommendations]
```

The route pages and feature modules reveal the product surface: authoring,
review, search, profile, chat, and feed features are separate frontend areas.
The backend sequence details are documented in the corresponding service guides
rather than duplicated here.
