# Design rules: SOLID and patterns

Use this file for sections 3 (SOLID) and 4 (Pattern) of a dry run. It holds rules only. Code examples live in the example pack.

## Repo rules win

If the repo has its own rules (`CODING_STANDARDS.md`, `CLAUDE.md`, a style the code already follows), they beat this file. When they clash, follow the repo and say so in the dry run.

Pick a principle or pattern only when the code needs it today. "We might need it later" is speculative. When nothing is at stake, say so. `None at stake` and `No pattern, because speculative` are good answers.

## SOLID

### Single Responsibility
- **Means:** a class or function has one reason to change.
- **Use when:** one unit mixes two jobs (for example parse and save) and a change to one job risks the other.
- **Do not use when:** the split gives one tiny unit per line of code. Speculative: no second case yet.

### Open/Closed
- **Means:** add new behaviour by adding code, not by editing tested code.
- **Use when:** you keep editing one `if`/`switch` chain to add each new case.
- **Do not use when:** there is one case and no sign of a second. Speculative: no second case yet.

### Liskov Substitution
- **Means:** a subtype works anywhere its parent type is expected, with no surprises.
- **Use when:** a subclass throws on, ignores or changes the meaning of a parent method.
- **Do not use when:** there is no inheritance or interface in the change. Speculative: no second case yet.

### Interface Segregation
- **Means:** callers depend only on the methods they use.
- **Use when:** implementers must write empty or throwing methods they do not need.
- **Do not use when:** the interface is small and every user needs all of it. Speculative: no second case yet.

### Dependency Inversion
- **Means:** high-level code depends on an abstraction. Low-level code implements it.
- **Use when:** business code builds a database, HTTP or file client itself, and tests cannot swap it.
- **Do not use when:** the dependency is stable and has one implementation, such as a standard library call. Speculative: no second case yet.

## Patterns

### Strategy
- **Means:** put each way of doing one job behind one interface and pick one at run time.
- **Use when:** one step has two or more real variants today (for example two pricing rules) chosen by a flag or type check.
- **Do not use when:** there is one variant. Speculative: no second case yet.

### Factory Method
- **Means:** one method decides which concrete type to create, and callers use only the interface.
- **Use when:** creation logic with type checks is repeated in several places.
- **Do not use when:** one type is created in one place. Speculative: no second case yet.

### Builder
- **Means:** build a complex object step by step, then produce it in one valid state.
- **Use when:** a constructor has many optional or same-typed parameters and call sites are hard to read.
- **Do not use when:** the object has a few required fields. Speculative: no second case yet.

### Adapter
- **Means:** wrap one interface so it looks like the interface the caller expects.
- **Use when:** you must use a library or service whose interface you cannot change, and its shape differs from yours.
- **Do not use when:** you own both sides and can change one. Speculative: no second case yet.

### Facade
- **Means:** give a group of classes one simple entry point.
- **Use when:** callers repeat the same multi-step call sequence on several subsystems.
- **Do not use when:** the facade only forwards one call. Speculative: no second case yet.

### Decorator
- **Means:** wrap an object to add behaviour, with the same interface, without changing the original.
- **Use when:** you add optional behaviour (logging, retry, cache) in different combinations.
- **Do not use when:** the behaviour is always on, so plain code is simpler. Speculative: no second case yet.

### Template Method
- **Means:** a base method fixes the steps. Subclasses fill in some of them.
- **Use when:** two or more flows share the same steps in the same order and differ in one or two.
- **Do not use when:** there is one flow, or composition (Strategy) is simpler. Speculative: no second case yet.

### Observer
- **Means:** an object tells its subscribers when its state changes, and it does not know who they are.
- **Use when:** several parts must react to one event and the source should not call each one.
- **Do not use when:** one caller reacts, so a direct call is clearer. Speculative: no second case yet.

### Command
- **Means:** turn a request into an object that can be queued, logged, retried or undone.
- **Use when:** you need undo, retry, a job queue or an audit trail of actions.
- **Do not use when:** the action runs at once and never needs those features. Speculative: no second case yet.

### Repository
- **Means:** hide storage behind a collection-like interface (find, save, delete).
- **Use when:** business code mixes in query or storage details, or tests need an in-memory store.
- **Do not use when:** there is one simple query in one place. Speculative: no second case yet.

### Dependency Injection
- **Means:** pass a class its dependencies from outside. It does not build them.
- **Use when:** a class creates its own collaborator and tests need to replace it.
- **Do not use when:** the dependency is a plain value or a stable utility. Speculative: no second case yet.

### Null Object
- **Means:** use a do-nothing object in place of `null`, so callers skip the null check.
- **Use when:** the same null check is repeated and "do nothing" is a correct default.
- **Do not use when:** a missing value is an error that must be seen. Speculative: no second case yet.
