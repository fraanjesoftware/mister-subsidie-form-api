# Claude Code Guidelines

## Core Principles

### 🚫 DRY (Don't Repeat Yourself)

Every piece of knowledge must have a single, unambiguous, authoritative representation within the system.

**Apply DRY by:**

- Extracting common logic into reusable functions/modules
- Creating shared utilities for repeated patterns
- Using configuration objects instead of hardcoded values
- Building generic components that accept parameters
- Centralizing database queries in repository/service layers

**Red flags to watch for:**

- Copy-pasted code blocks
- Similar functions with slight variations
- Hardcoded values appearing multiple times
- Repeated string literals
- Duplicate validation logic

### 🧪 TDD (Test-Driven Development)

Write tests first, then write the minimum code to make them pass.

**TDD Cycle:**

1. **Red** - Write a failing test
2. **Green** - Write minimal code to pass
3. **Refactor** - Improve code while keeping tests green

**Test guidelines:**

- Test behavior, not implementation
- One assertion per test when possible
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies
- Keep tests fast and isolated

## Practical Examples

### Instead of:

```javascript
// ❌ Repeated validation logic
function validateUser(user) {
  if (!user.email || !user.email.includes('@')) {
    throw new Error('Invalid email');
  }
}

function validateContact(contact) {
  if (!contact.email || !contact.email.includes('@')) {
    throw new Error('Invalid email');
  }
}
```

### Do this:

```javascript
// ✅ DRY validation
const validators = {
  email: email => {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email');
    }
  },
};

function validateUser(user) {
  validators.email(user.email);
}
```

### TDD Example:

```javascript
// 1. Write test first
test('should create dossier with unique number', () => {
  const dossier = createDossier({ userId: 1 });
  expect(dossier.dossierNummer).toMatch(/^2024-\d{4}$/);
});

// 2. Then implement
function createDossier({ userId }) {
  return {
    dossierNummer: generateDossierNumber(),
    userId,
    createdAt: new Date(),
  };
}
```

## Remember

- **Refactor mercilessly** - When you see duplication, eliminate it
- **Test first, code second** - Let tests drive your design
- **Small steps** - Make one change at a time
- **Keep it simple** - The best code is no code
