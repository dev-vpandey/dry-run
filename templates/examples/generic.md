# Examples: generic (orders, payments, notifications)

One short example per name in `dry-run-design.md`, in the same order. Each entry shows the same idea in Java and in Python.

## SOLID

### Single Responsibility
```java
// before: one OrderService parsed, saved and mailed
class OrderParser { Order parse(String json) { return new Order(json); } }
class OrderRepo { void save(Order o) { System.out.println("saved " + o.id); } }
class Order { String id; Order(String id) { this.id = id; } }
```
```python
# before: one OrderService parsed, saved and mailed
class OrderParser:
    def parse(self, text): return Order(text)
class OrderRepo:
    def save(self, order): print("saved", order.id)
class Order:
    def __init__(self, id): self.id = id
```

### Open/Closed
```java
interface Fee { double of(double amount); }
class CardFee implements Fee { public double of(double a) { return a * 0.03; } }
class BankFee implements Fee { public double of(double a) { return 0.5; } }
class Checkout { double total(double a, Fee fee) { return a + fee.of(a); } }
// a new payment type adds a class. Checkout does not change.
```
```python
class CardFee:
    def of(self, amount): return amount * 0.03
class BankFee:
    def of(self, amount): return 0.5
def total(amount, fee): return amount + fee.of(amount)
# a new payment type adds a class. total does not change.
```

### Liskov Substitution
```java
interface Notifier { void send(String msg); }
class EmailNotifier implements Notifier { public void send(String m) { System.out.println("mail " + m); } }
class SmsNotifier implements Notifier { public void send(String m) { System.out.println("sms " + m); } }
class Alert { void raise(Notifier n) { n.send("paid"); } }
// Alert works with either one. Neither throws on a valid message.
```
```python
class EmailNotifier:
    def send(self, msg): print("mail", msg)
class SmsNotifier:
    def send(self, msg): print("sms", msg)
def raise_alert(notifier): notifier.send("paid")
# raise_alert works with either one. Neither raises on a valid message.
```

### Interface Segregation
```java
interface Payable { void pay(double amount); }
interface Refundable { void refund(double amount); }
class Card implements Payable, Refundable { public void pay(double a) {} public void refund(double a) {} }
class Voucher implements Payable { public void pay(double a) {} }
```
```python
class Card:
    def pay(self, amount): pass
    def refund(self, amount): pass
class Voucher:
    def pay(self, amount): pass  # no refund method to fake
```

### Dependency Inversion
```java
interface Mailer { void send(String to); }
class OrderService {
    private final Mailer mailer;
    OrderService(Mailer mailer) { this.mailer = mailer; }
    void confirm(String to) { mailer.send(to); }
}
// OrderService knows Mailer, not SmtpMailer
```
```python
class OrderService:
    def __init__(self, mailer):
        self.mailer = mailer
    def confirm(self, to):
        self.mailer.send(to)
# OrderService knows a mailer, not SmtpMailer
```

## Patterns

### Strategy
```java
interface Discount { double apply(double total); }
class TenOff implements Discount { public double apply(double t) { return t * 0.9; } }
class Order { double price(double t, Discount d) { return d.apply(t); } }
```
```python
class TenOff:
    def apply(self, total): return total * 0.9
def price(total, discount): return discount.apply(total)
```

### Factory Method
```java
interface Payment { void pay(double a); }
class CardPayment implements Payment { public void pay(double a) {} }
abstract class PaymentApp {
    abstract Payment make();
    void checkout(double a) { make().pay(a); }
}
class CardApp extends PaymentApp { Payment make() { return new CardPayment(); } }
```
```python
class CardPayment:
    def pay(self, amount): pass
class PaymentApp:
    def make(self): raise NotImplementedError
    def checkout(self, amount): self.make().pay(amount)
class CardApp(PaymentApp):
    def make(self): return CardPayment()
```

### Builder
```java
class Order { String id; int qty;
    static class Builder {
        private final Order o = new Order();
        Builder id(String id) { o.id = id; return this; }
        Builder qty(int qty) { o.qty = qty; return this; }
        Order build() { return o; }
    }
}
```
```python
class OrderBuilder:
    def __init__(self): self.order = {}
    def id(self, v): self.order["id"] = v; return self
    def qty(self, v): self.order["qty"] = v; return self
    def build(self): return self.order
```

### Adapter
```java
interface Notifier { void send(String msg); }
class LegacySms { void push(String text) {} }
class SmsAdapter implements Notifier {
    private final LegacySms sms = new LegacySms();
    public void send(String msg) { sms.push(msg); }
}
```
```python
class LegacySms:
    def push(self, text): pass
class SmsAdapter:
    def __init__(self): self.sms = LegacySms()
    def send(self, msg): self.sms.push(msg)
```

### Facade
```java
class Stock { void reserve(String id) {} }
class Billing { void charge(String id) {} }
class Checkout {
    private final Stock stock = new Stock();
    private final Billing billing = new Billing();
    void place(String id) { stock.reserve(id); billing.charge(id); }
}
```
```python
class Stock:
    def reserve(self, order_id): pass
class Billing:
    def charge(self, order_id): pass
class Checkout:
    def place(self, order_id): Stock().reserve(order_id); Billing().charge(order_id)
```

### Decorator
```java
interface Notifier { void send(String msg); }
class Email implements Notifier { public void send(String m) {} }
class Logged implements Notifier {
    private final Notifier inner;
    Logged(Notifier inner) { this.inner = inner; }
    public void send(String m) { System.out.println(m); inner.send(m); }
}
```
```python
class Email:
    def send(self, msg): pass
class Logged:
    def __init__(self, inner): self.inner = inner
    def send(self, msg):
        print(msg)
        self.inner.send(msg)
```

### Template Method
```java
abstract class Report {
    String run() { return header() + body(); }
    String header() { return "Orders\n"; }
    abstract String body();
}
class DailyReport extends Report { String body() { return "today"; } }
```
```python
class Report:
    def run(self): return self.header() + self.body()
    def header(self): return "Orders\n"
    def body(self): raise NotImplementedError
class DailyReport(Report):
    def body(self): return "today"
```

### Observer
```java
import java.util.*;
interface Listener { void onPaid(String id); }
class Payments {
    private final List<Listener> listeners = new ArrayList<>();
    void add(Listener l) { listeners.add(l); }
    void paid(String id) { for (Listener l : listeners) { l.onPaid(id); } }
}
```
```python
class Payments:
    def __init__(self): self.listeners = []
    def add(self, fn): self.listeners.append(fn)
    def paid(self, order_id):
        for fn in self.listeners:
            fn(order_id)
```

### Command
```java
interface Command { void run(); }
class Refund implements Command {
    private final String orderId;
    Refund(String orderId) { this.orderId = orderId; }
    public void run() { System.out.println("refund " + orderId); }
}
class Queue { java.util.List<Command> items = new java.util.ArrayList<>(); void runAll() { for (Command c : items) { c.run(); } } }
// add Refund("a1") now, runAll() later
```
```python
class Refund:
    def __init__(self, order_id): self.order_id = order_id
    def run(self): print("refund", self.order_id)
class Queue:
    def __init__(self): self.items = []
    def run_all(self):
        for command in self.items: command.run()
# add Refund("a1") now, run_all() later
```

### Repository
```java
import java.util.*;
interface OrderRepo { Optional<String> find(String id); void save(String id, String customer); }
class MemoryOrderRepo implements OrderRepo {
    private final Map<String, String> customers = new HashMap<>();
    public Optional<String> find(String id) { return Optional.ofNullable(customers.get(id)); }
    public void save(String id, String customer) { customers.put(id, customer); }
}
```
```python
class MemoryOrderRepo:
    def __init__(self): self.customers = {}
    def find(self, order_id): return self.customers.get(order_id)
    def save(self, order_id, customer): self.customers[order_id] = customer
```

### Dependency Injection
```java
interface Mailer { void send(String to); }
class SmtpMailer implements Mailer { public void send(String to) {} }
class FakeMailer implements Mailer { public void send(String to) { System.out.println("fake " + to); } }
class Confirm {
    private final Mailer mailer;
    Confirm(Mailer mailer) { this.mailer = mailer; }
}
class Main { Confirm prod = new Confirm(new SmtpMailer()), test = new Confirm(new FakeMailer()); }
```
```python
class SmtpMailer:
    def send(self, to): pass
class FakeMailer:
    def send(self, to): print("fake", to)
class Confirm:
    def __init__(self, mailer): self.mailer = mailer
prod, test = Confirm(SmtpMailer()), Confirm(FakeMailer())
```

### Null Object
```java
interface Notifier { void send(String msg); }
class NoNotifier implements Notifier { public void send(String msg) {} }
class Order {
    private final Notifier notifier;
    Order(Notifier n) { this.notifier = n; }
    void ship() { notifier.send("shipped"); }
}
// new Order(new NoNotifier()).ship() needs no null check
```
```python
class NoNotifier:
    def send(self, msg): pass
class Order:
    def __init__(self, notifier=None): self.notifier = notifier or NoNotifier()
    def ship(self): self.notifier.send("shipped")
# Order().ship() needs no None check
```
