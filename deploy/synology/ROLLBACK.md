# Synology web player rollback

## Baseline

- Date: 2026-10-21
- Git tag: `web-baseline-2026-10-21`
- Source: `deploy/synology/ysp.html`
- SHA256: `4E07C7F9CCC2B2D8B28F01481452F3EFA8A38797AEE757E7D04E4F3890FC760A`

## Live URLs

- `http://10.10.10.2/ysp/`
- `http://10.10.10.2/ysp.html`

## Synology backup

```text
\\10.10.10.2\docker\ysp-backups\ysp-web-2026-10-21.html
```

To roll back, copy that file over both live paths:

```powershell
Copy-Item `
  '\\10.10.10.2\docker\ysp-backups\ysp-web-2026-10-21.html' `
  '\\10.10.10.2\web\ysp\index.html' -Force

Copy-Item `
  '\\10.10.10.2\docker\ysp-backups\ysp-web-2026-10-21.html' `
  '\\10.10.10.2\web\ysp.html' -Force
```

## Git rollback

```powershell
git checkout web-baseline-2026-10-21 -- deploy/synology/ysp.html
```
