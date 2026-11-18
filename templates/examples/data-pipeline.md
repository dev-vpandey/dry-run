# Examples: data pipeline (readers, writers, configs)

One short example per name in `dry-run-design.md`, in the same order. Each entry shows the same idea in Java and in Python. A name missing here falls back to `generic.md`.

## SOLID

### Single Responsibility
```java
// before: one Job class read, cleaned and wrote
class CsvReader { java.util.List<String> read(String path) { return java.util.List.of(path); } }
class RowCleaner { String clean(String row) { return row.trim(); } }
class ParquetWriter { void write(String row) { System.out.println(row); } }
```
```python
# before: one Job class read, cleaned and wrote
class CsvReader:
    def read(self, path): return [path]
class RowCleaner:
    def clean(self, row): return row.strip()
class ParquetWriter:
    def write(self, row): print(row)
```

### Open/Closed
```java
interface Reader { java.util.List<String> read(); }
class CsvReader implements Reader { public java.util.List<String> read() { return java.util.List.of("a"); } }
class JsonReader implements Reader { public java.util.List<String> read() { return java.util.List.of("b"); } }
class Job { int count(Reader r) { return r.read().size(); } }
// a new source adds a class. Job does not change.
```
```python
class CsvReader:
    def read(self): return ["a"]
class JsonReader:
    def read(self): return ["b"]
def count(reader): return len(reader.read())
# a new source adds a class. count does not change.
```

### Liskov Substitution
```java
interface Writer { void write(String row); }
class S3Writer implements Writer { public void write(String r) { System.out.println("s3 " + r); } }
class LocalWriter implements Writer { public void write(String r) { System.out.println("local " + r); } }
class Job { void run(Writer w) { w.write("row"); } }
// Job works with either one. Neither throws on a valid row.
```
```python
class S3Writer:
    def write(self, row): print("s3", row)
class LocalWriter:
    def write(self, row): print("local", row)
def run(writer): writer.write("row")
# run works with either one. Neither raises on a valid row.
```

### Interface Segregation
```java
interface Source { String read(); }
interface Seekable { void seek(long pos); }
class FileSource implements Source, Seekable { public String read() { return ""; } public void seek(long p) {} }
class StreamSource implements Source { public String read() { return ""; } }
```
```python
class FileSource:
    def read(self): return ""
    def seek(self, pos): pass
class StreamSource:
    def read(self): return ""  # no seek method to fake
```

### Dependency Inversion
```java
interface Writer { void write(String row); }
class Job {
    private final Writer writer;
    Job(Writer writer) { this.writer = writer; }
    void run(String row) { writer.write(row); }
}
// Job knows Writer, not S3Writer
```
```python
class Job:
    def __init__(self, writer):
        self.writer = writer
    def run(self, row):
        self.writer.write(row)
# Job knows a writer, not S3Writer
```

## Patterns

### Strategy
```java
interface Parser { String parse(String line); }
class CsvParser implements Parser { public String parse(String l) { return l.split(",")[0]; } }
class Job { String run(String line, Parser p) { return p.parse(line); } }
```
```python
class CsvParser:
    def parse(self, line): return line.split(",")[0]
def run(line, parser): return parser.parse(line)
```

### Factory Method
```java
interface Reader { String read(); }
class CsvReader implements Reader { public String read() { return "csv"; } }
abstract class JobBase {
    abstract Reader open();
    String run() { return open().read(); }
}
class CsvJob extends JobBase { Reader open() { return new CsvReader(); } }
```
```python
class CsvReader:
    def read(self): return "csv"
class JobBase:
    def open(self): raise NotImplementedError
    def run(self): return self.open().read()
class CsvJob(JobBase):
    def open(self): return CsvReader()
```

### Builder
```java
class Config { String path; int batch;
    static class Builder {
        private final Config c = new Config();
        Builder path(String p) { c.path = p; return this; }
        Builder batch(int b) { c.batch = b; return this; }
        Config build() { return c; }
    }
}
```
```python
class ConfigBuilder:
    def __init__(self): self.config = {}
    def path(self, v): self.config["path"] = v; return self
    def batch(self, v): self.config["batch"] = v; return self
    def build(self): return self.config
```

### Adapter
```java
interface Reader { String read(); }
class LegacyFtp { String fetch() { return "data"; } }
class FtpAdapter implements Reader {
    private final LegacyFtp ftp = new LegacyFtp();
    public String read() { return ftp.fetch(); }
}
```
```python
class LegacyFtp:
    def fetch(self): return "data"
class FtpAdapter:
    def __init__(self): self.ftp = LegacyFtp()
    def read(self): return self.ftp.fetch()
```

### Facade
```java
class Extract { String run() { return "rows"; } }
class Load { void run(String rows) {} }
class Pipeline {
    private final Extract extract = new Extract();
    private final Load load = new Load();
    void go() { load.run(extract.run()); }
}
```
```python
class Extract:
    def run(self): return "rows"
class Load:
    def run(self, rows): pass
class Pipeline:
    def go(self): Load().run(Extract().run())
```

### Decorator
```java
interface Writer { void write(String row); }
class S3Writer implements Writer { public void write(String r) {} }
class RetryWriter implements Writer {
    private final Writer inner;
    RetryWriter(Writer inner) { this.inner = inner; }
    public void write(String r) { try { inner.write(r); } catch (RuntimeException e) { inner.write(r); } }
}
```
```python
class S3Writer:
    def write(self, row): pass
class RetryWriter:
    def __init__(self, inner): self.inner = inner
    def write(self, row):
        try: self.inner.write(row)
        except Exception: self.inner.write(row)
```

### Template Method
```java
abstract class Job {
    void run() { extract(); transform(); load(); }
    abstract void extract();
    void transform() {}
    abstract void load();
}
class OrdersJob extends Job { void extract() {} void load() {} }
```
```python
class Job:
    def run(self): self.extract(); self.transform(); self.load()
    def extract(self): raise NotImplementedError
    def transform(self): pass
    def load(self): raise NotImplementedError
class OrdersJob(Job):
    def extract(self): pass
    def load(self): pass
```

### Observer
```java
import java.util.*;
interface Listener { void onFile(String name); }
class Landing {
    private final List<Listener> listeners = new ArrayList<>();
    void add(Listener l) { listeners.add(l); }
    void arrived(String name) { for (Listener l : listeners) { l.onFile(name); } }
}
```
```python
class Landing:
    def __init__(self): self.listeners = []
    def add(self, fn): self.listeners.append(fn)
    def arrived(self, name):
        for fn in self.listeners:
            fn(name)
```

### Command
```java
interface Step { void run(); }
class LoadStep implements Step {
    private final String table;
    LoadStep(String table) { this.table = table; }
    public void run() { System.out.println("load " + table); }
}
class Flow { java.util.List<Step> steps = new java.util.ArrayList<>(); void runAll() { for (Step s : steps) { s.run(); } } }
// add LoadStep("orders") now, runAll() later
```
```python
class LoadStep:
    def __init__(self, table): self.table = table
    def run(self): print("load", self.table)
class Flow:
    def __init__(self): self.steps = []
    def run_all(self):
        for step in self.steps: step.run()
# add LoadStep("orders") now, run_all() later
```

### Repository
```java
import java.util.*;
interface CheckpointRepo { Optional<Long> last(String job); void save(String job, long offset); }
class MemoryCheckpointRepo implements CheckpointRepo {
    private final Map<String, Long> offsets = new HashMap<>();
    public Optional<Long> last(String job) { return Optional.ofNullable(offsets.get(job)); }
    public void save(String job, long offset) { offsets.put(job, offset); }
}
```
```python
class MemoryCheckpointRepo:
    def __init__(self): self.offsets = {}
    def last(self, job): return self.offsets.get(job)
    def save(self, job, offset): self.offsets[job] = offset
```

### Dependency Injection
```java
interface Writer { void write(String row); }
class S3Writer implements Writer { public void write(String r) {} }
class FakeWriter implements Writer { public void write(String r) { System.out.println("fake " + r); } }
class Job {
    private final Writer writer;
    Job(Writer writer) { this.writer = writer; }
}
class Main { Job prod = new Job(new S3Writer()), test = new Job(new FakeWriter()); }
```
```python
class S3Writer:
    def write(self, row): pass
class FakeWriter:
    def write(self, row): print("fake", row)
class Job:
    def __init__(self, writer): self.writer = writer
prod, test = Job(S3Writer()), Job(FakeWriter())
```

### Null Object
```java
interface Writer { void write(String row); }
class NoWriter implements Writer { public void write(String row) {} }
class Job {
    private final Writer writer;
    Job(Writer w) { this.writer = w; }
    void run(String row) { writer.write(row); }
}
// new Job(new NoWriter()).run("r") needs no null check
```
```python
class NoWriter:
    def write(self, row): pass
class Job:
    def __init__(self, writer=None): self.writer = writer or NoWriter()
    def run(self, row): self.writer.write(row)
# Job().run("r") needs no None check
```
