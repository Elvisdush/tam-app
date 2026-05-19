# Rendered manifests (generated)

YAML files in this folder are produced by:

```bash
npm run k8s:render
```

They are **gitignored** after generation. Use them for tools that should not run Checkov’s **kustomize** runner on Windows (see `KUBERNETES_DEPLOYMENT.md` → Static analysis).

Example Checkov invocation:

```bash
checkov --framework kubernetes -f k8s/rendered/local.yaml
```

Do not commit secrets into rendered files.
