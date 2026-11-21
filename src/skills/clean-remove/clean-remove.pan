---
name: clean-remove
description: Cleanly remove code or configuration from a codebase without backwards compatibility or  
disable-model-invocation: true 
---

Remove the specified feature completely with a clean break. Leave the codebase behind like the feature never existed.

Start with defining the scope of the deletion using the `grill-with-docs` skill. 

- Do not consider backwards compatibility, the user is sure this needs to be removed
- Remove all related tests to the feature
- Clean up all references to the feature; input/output contracts, types, function signatures
- Do not write new tests to prove the feature was removed
- Update documentation to remove the requested feature. Do not include meta commentary like "This feature was removed" just remove the docs.