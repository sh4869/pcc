# pcs

> Package Conflict Solver in npm

## Command

### Check

```bash
$ pcs check .
find 3 conflicts package
- get-stream
    5.1.0
      package-json@6.5.0
      +-got@9.6.0
        +-cacheable-request@6.1.0
          +-get-stream@5.1.0
    4.1.0
      package-json@6.5.0
      +-got@9.6.0
        +-get-stream@4.1.0
- lowercase-keys
    2.0.0
      package-json@6.5.0
      +-got@9.6.0
        +-cacheable-request@6.1.0
          +-lowercase-keys@2.0.0
    1.0.1
      package-json@6.5.0
      +-got@9.6.0
        +-cacheable-request@6.1.0
          +-responselike@1.0.2
            +-lowercase-keys@1.0.1
- semver
    6.3.0
      package-json@6.5.0
      +-semver@6.3.0
    6.0.0
      semver@6.0.0
```

### solve

```
$ pcs solve .
- semver
    semver@6.3.0
      package-json@6.5.0 -> package-json@6.5.0
      semver@6.0.0 -> semver@6.3.0
- get-stream
    can't solve get-stream conflict :(
- lowercase-keys
    can't solve lowercase-keys conflict :(
```
