# Guardian / Microsoft Defender for DevOps — Checkov on Windows

## Important: GitHub workflow removal ≠ scans stopped

Deleting `.github/workflows/defender-for-devops.yml` only removes **GitHub Actions** automation from this repo. The error below often comes from **Azure DevOps** instead:

- Path contains `C:\Users\RUNNER~1\AppData\Local\Temp\...` and `D:\a\_msdo\...`
- Task **MicrosoftSecurityDevOps@1** on **`windows-latest`**

To **stop** scans: edit or remove the MSDO step in your **Azure DevOps pipeline**, or disconnect the repo under **Defender for Cloud → DevOps**.

To **fix** scans (keep Guardian): use the repo files below or set `GDN_CHECKOV_SKIPFRAMEWORK=kustomize` on the MSDO task.

| Repo file | Purpose |
|-----------|---------|
| [`.checkov.yaml`](../.checkov.yaml) | Tells Checkov to skip the `kustomize` framework |
| [`msdo.gdnconfig`](../msdo.gdnconfig) | MSDO config (`config:` input on MicrosoftSecurityDevOps@1) |
| [`azure-pipelines.yml`](../azure-pipelines.yml) | Example ADO pipeline on **ubuntu-latest** with skip env |

## What breaks

On **Windows** agents (`RUNNER~1`, `D:\a\_msdo\...`), Checkov’s **Kustomize** runner unpacks manifests under `%TEMP%` and renames files. Other handles (parallel threads, Defender, indexer) can cause:

`PermissionError: [WinError 32] The process cannot access the file because it is being used by another process`

Checkov may then hit a secondary bug: `NameError: name 'exit' is not defined` in its error handler.

`.checkovignore` **cannot** fix this: the locked paths are **temporary extracted files**, not your repo.

## Fix options (pick one)

### 1. Skip the Kustomize framework (fastest)

Tell MSDO / Checkov not to use the Kustomize runner. Kubernetes YAML under `k8s/` is still scanned as **kubernetes** where applicable.

Set this environment variable for the Guardian / Security DevOps step:

| Variable | Value |
|----------|--------|
| `GDN_CHECKOV_SKIPFRAMEWORK` | `kustomize` |

**GitHub Actions:** add the same variable to the MSDO / Guardian job’s `env` in your workflow YAML.

**Azure DevOps** (YAML pipeline example):

```yaml
variables:
  GDN_CHECKOV_SKIPFRAMEWORK: kustomize

steps:
  - task: MicrosoftSecurityDevOps@1
    displayName: "Microsoft Security DevOps"
    env:
      GDN_CHECKOV_SKIPFRAMEWORK: kustomize
```

(Classic UI: add the same variable under the task’s **Environment variables**, or set **config** to `tam-app/tam/msdo.gdnconfig`.)

**Disable MSDO:** remove the `MicrosoftSecurityDevOps@1` step from your Azure DevOps pipeline, or disconnect the repo in **Defender for Cloud → DevOps**.

### 2. Use a Linux agent for the MSDO job

Run Checkov on **`ubuntu-latest`** (or another Linux pool). The rename race is uncommon there compared to Windows.

### 3. Pre-render Kustomize, then scan flat YAML

From `tam-app/tam`:

```bash
npm run k8s:render
```

This writes `k8s/rendered/local.yaml` (gitignored). Combine with **Option 1** so Checkov never invokes the Kustomize runner on `kustomization.yaml`.

If your tooling supports passing a single file to Checkov via MSDO, use **`GDN_CHECKOV_FILE`** pointing at `tam-app/tam/k8s/rendered/local.yaml` (paths relative to repo root). Do not use **FILE** and **TARGET DIRECTORY** together per MSDO docs.

## “Breaking results” vs tool crash

If the log shows **`BreakException: Guardian detected one or more breaking results`**, the Checkov **run finished** but policies failed (expected findings). That is separate from **WinError 32**. Address those by fixing IaC, baselines, or suppressions per your org’s Defender rules — not by skipping Kustomize.

## More detail

See [KUBERNETES_DEPLOYMENT.md](../KUBERNETES_DEPLOYMENT.md) → **Static analysis (Checkov / Guardian)**.
