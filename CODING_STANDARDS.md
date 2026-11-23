# Coding standards

The reviewer agent checks each diff against these rules.

- **Root-cause fixes.** Fix the cause. When a workaround is the only option, put a comment on it that says why.
- **Purposeful lines.** Every line serves a behaviour that exists today.
- **Evidence-based code.** Write code for cases that occur. Leave out cases nobody has shown.
- **Testable code.** Every new behaviour has a test that fails without it.
