---
name: clean-remove
description: Cleanly remove features or configuration from a codebase without concern for backwards compatibility
disable-model-invocation: true 
---

Remove the specified feature completely with a clean break.

Start with defining the scope of the deletion using the `grill-with-docs` skill. 

- Do not consider backwards compatibility, the user is sure this can be removed without issue
- Remove all tests related to the feature
- Do not write new tests to prove the feature was removed
- Update documentation to remove the requested feature. Do not include meta commentary like "This feature was removed" just remove the docs.
