# Kubernetes Deployment — TAM App

Deploy the **backend API** and supporting services (Redis, RabbitMQ) on Kubernetes. The Expo mobile app is distributed separately (EAS / app stores); point it at your cluster API URL after deploy.

## Architecture

```
                    ┌─────────────────┐
   Mobile / Web     │    Ingress      │  api.yourdomain.com
        ──────────► │  (nginx/etc.)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  tam-backend    │  :3006  (2 replicas in base)
                    │  Deployment     │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
       │    Redis    │ │ RabbitMQ  │ │  Firebase   │  (external RTDB)
       │  (in-cluster)│ │ (in-cluster)│ │  (not in K8s) │
       └─────────────┘ └───────────┘ └─────────────┘
```

| Component | K8s resource | Notes |
|-----------|--------------|--------|
| Backend API | `Deployment` + `Service` | `backend/hono.js`, port 3006 |
| Redis | `Deployment` + `PVC` | Cache / rate limits |
| RabbitMQ | `Deployment` + `PVC` | AMQP (optional for basic API) |
| Secrets | `Secret` | JWT, Redis, RabbitMQ passwords |
| Ingress | `Ingress` | TLS + routing (production) |

## Prerequisites

- **kubectl** configured for your cluster
- **Docker** to build images
- A cluster: **minikube**, **kind**, **Docker Desktop Kubernetes**, or cloud (AKS/EKS/GKE)
- For Ingress: **nginx-ingress** controller installed

### Local cluster quick start

**minikube:**
```powershell
minikube start --cpus=4 --memory=8192
minikube addons enable ingress
```

**Docker Desktop:** Settings → Kubernetes → Enable

## File layout

```
tam/
├── Dockerfile.k8s          # Backend production image
├── k8s/
│   ├── base/               # Production-oriented manifests
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   ├── secrets.example.yaml
│   │   ├── redis.yaml
│   │   ├── rabbitmq.yaml
│   │   ├── backend.yaml
│   │   ├── ingress.yaml
│   │   └── kustomization.yaml
│   └── overlays/
│       └── local/          # 1 replica + NodePort 30080
└── scripts/k8s-deploy.ps1
```

## Deploy (local overlay)

From `tam-app/tam`:

### 1. Build and load the image

```powershell
docker build -f Dockerfile.k8s -t tam-backend:latest .

# minikube
minikube image load tam-backend:latest

# kind
kind load docker-image tam-backend:latest
```

### 2. Create secrets

```powershell
copy k8s\base\secrets.example.yaml k8s\base\secrets.yaml
# Edit k8s\base\secrets.yaml — use strong passwords (32+ chars for JWT)
kubectl apply -f k8s\base\secrets.yaml
```

> **Never commit `secrets.yaml`** — it is gitignored.

### 3. Apply manifests

```powershell
kubectl apply -k k8s/overlays/local
```

Or use the helper script:

```powershell
.\scripts\k8s-deploy.ps1 all
```

### 4. Verify

```powershell
kubectl -n tam-app get pods
kubectl -n tam-app wait --for=condition=ready pod -l app.kubernetes.io/name=tam-backend --timeout=120s

# NodePort (local overlay)
curl http://localhost:30080/health

# Or port-forward
kubectl -n tam-app port-forward svc/tam-backend 3006:80
curl http://localhost:3006/health
```

## Production overlay

Use `k8s/base` directly (2 backend replicas, ClusterIP + Ingress):

1. Push image to your registry:
   ```bash
   docker tag tam-backend:latest your-registry.io/tam-backend:v1.0.0
   docker push your-registry.io/tam-backend:v1.0.0
   ```

2. Update `k8s/base/backend.yaml` image field or use Kustomize `images:` patch.

3. Set `CORS_ORIGIN` in `configmap.yaml` to your real frontend origin.

4. Configure Ingress host + TLS (`ingress.yaml`).

5. Apply:
   ```bash
   kubectl apply -f k8s/base/secrets.yaml
   kubectl apply -k k8s/base
   ```

## Environment variables

| Variable | Source | Description |
|----------|--------|-------------|
| `REDIS_HOST` | ConfigMap | Service name `redis` |
| `REDIS_PASSWORD` | Secret | Must match Redis deployment |
| `JWT_SECRET` | Secret | Auth signing key |
| `PORT` | ConfigMap | `3006` |
| `CORS_ORIGIN` | ConfigMap | Allowed frontend origin |

See `.env.docker` for the full list of app variables; add any extra keys to `k8s/base/configmap.yaml` and `secrets.example.yaml`.

## Mobile app configuration

After the API is reachable, set the app API URL (build-time or runtime config):

- Development: `http://<node-ip>:30080` or port-forward URL
- Production: `https://api.yourdomain.com`

Firebase Realtime Database stays on Firebase — not deployed to this cluster.

## Scaling

```bash
kubectl -n tam-app scale deployment tam-backend --replicas=3
```

Horizontal Pod Autoscaler (optional):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tam-backend
  namespace: tam-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tam-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Static analysis (Checkov / Guardian)

Checkov’s **kustomize** runner extracts manifests under `%TEMP%` and renames temp files. On **Windows** (including some CI agents under `RUNNER~1`), parallel workers plus antivirus or filesystem locking often trigger:

`PermissionError: [WinError 32] The process cannot access the file because it is being used by another process`

That failure can cascade into a bogus `NameError: name 'exit' is not defined` inside Checkov’s own error path.

**Recommended fixes (pick one):**

1. **Render then scan as plain Kubernetes YAML** (works on Windows):

   From `tam-app/tam`:

   ```bash
   npm run k8s:render
   checkov --framework kubernetes -f k8s/rendered/local.yaml
   ```

   Ensure Checkov is **not** pointed at a directory that contains `kustomization.yaml`, or it may enable the kustomize runner again.

2. **Run the scan on Linux** (e.g. `ubuntu-latest` in GitHub Actions): the rename race is far less common than on Windows.

3. **Exclude the kustomize framework** in your Guardian / pipeline config if it offers framework toggles, and only scan rendered YAML or `k8s/base/*.yaml` with `--framework kubernetes`.

For **Microsoft Defender for DevOps / Guardian** (Azure DevOps or GitHub), see **[docs/GUARDIAN_MSDO_CHECKOV.md](./docs/GUARDIAN_MSDO_CHECKOV.md)** — use `GDN_CHECKOV_SKIPFRAMEWORK=kustomize` or run MSDO on **Linux**.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Checkov `WinError 32` on kustomize | Use `npm run k8s:render` + `checkov --framework kubernetes -f k8s/rendered/local.yaml`, or Linux runner |
| `ImagePullBackOff` | Build & load image into cluster (`minikube image load`) |
| Backend `CrashLoopBackOff` | `kubectl -n tam-app logs deployment/tam-backend` |
| Redis auth errors | Ensure `REDIS_PASSWORD` in Secret matches Redis container |
| `ENOTFOUND redis` | Run backend inside cluster; don't use host `.env` `REDIS_HOST=redis` locally |
| Ingress 404 | Check ingress controller + host DNS (`api.tam.local` → cluster IP) |

## Cleanup

```powershell
kubectl delete -k k8s/overlays/local
kubectl delete -f k8s/base/secrets.yaml
```

## Related docs

- [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) — Docker Compose (dev parity)
- [README.md](./README.md) — App development
