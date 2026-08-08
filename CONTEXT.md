# Prove It

Prove It produces trustworthy user-facing evidence for a code change across command-line, REST API, and visual web application surfaces.

## Language

**Proof run**:
A single execution of Prove It against the relevant working-tree change.
_Avoid_: Verification run, demo

**User journey**:
The smallest end-to-end interaction that demonstrates the changed behavior.
_Avoid_: Scenario, test case

**Surface**:
The user-facing form being exercised: CLI, REST API, or visual web application.
_Avoid_: Interface, frontend

**Evidence report**:
A self-contained HTML artifact containing the proof run’s steps, outputs, assertions, and visual evidence.
_Avoid_: Test report, log

**Blocked**:
A proof run that cannot safely or completely execute because required setup, access, or tooling is unavailable.
_Avoid_: Passed, skipped

**Visual artifact**:
A self-contained HTML report, plan, or documentation package assembled from ordered reusable components.
_Avoid_: Web page, dashboard

**Component**:
An independently renderable document unit with a type, stable ID, and content-specific properties.
_Avoid_: Widget, fragment

**Visual grammar**:
The small set of generic components that can be composed to express reports, plans, and documentation.
_Avoid_: Component library, design system

**Artifact adapter**:
A translator that turns a purpose-specific source, such as proof evidence, into the visual grammar.
_Avoid_: Report component, template
